-- Migration: Add transactional POS void RPC
-- Description: Reverses POS status, linked invoice/payment impact, stock, and GL postings atomically.

CREATE OR REPLACE FUNCTION public.void_pos_transaction(
  p_transaction_id UUID,
  p_company_id UUID,
  p_user_id UUID,
  p_business_unit_id UUID DEFAULT NULL,
  p_void_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction public.pos_transactions%ROWTYPE;
  v_invoice public.sales_invoices%ROWTYPE;
  v_original_stock public.stock_transactions%ROWTYPE;
  v_original_stock_item public.stock_transaction_items%ROWTYPE;
  v_reversal_stock_id UUID;
  v_reversal_location_id UUID;
  v_current_stock NUMERIC;
  v_new_stock NUMERIC;
  v_original_journal public.journal_entries%ROWTYPE;
  v_reversal_journal_id UUID;
  v_rows INTEGER;
  v_invoice_count INTEGER := 0;
  v_payment_void_count INTEGER := 0;
  v_stock_reversal_count INTEGER := 0;
  v_journal_reversal_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'POS_VOID_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'POS_VOID_UNAUTHORIZED';
  END IF;

  SELECT *
  INTO v_transaction
  FROM public.pos_transactions pt
  WHERE pt.id = p_transaction_id
    AND pt.company_id = p_company_id
    AND (p_business_unit_id IS NULL OR pt.business_unit_id = p_business_unit_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POS_VOID_TRANSACTION_NOT_FOUND';
  END IF;

  IF v_transaction.status = 'voided' THEN
    RAISE EXCEPTION 'POS_VOID_ALREADY_VOIDED';
  END IF;

  IF v_transaction.status <> 'completed' THEN
    RAISE EXCEPTION 'POS_VOID_UNSUPPORTED_STATUS';
  END IF;

  FOR v_invoice IN
    SELECT *
    FROM public.sales_invoices si
    WHERE si.company_id = p_company_id
      AND si.deleted_at IS NULL
      AND si.custom_fields ->> 'posTransactionId' = p_transaction_id::TEXT
    FOR UPDATE
  LOOP
    UPDATE public.invoice_payments ip
    SET
      deleted_at = NOW(),
      updated_at = NOW(),
      updated_by = p_user_id,
      notes = CONCAT_WS(
        E'\n',
        ip.notes,
        'Voided with POS transaction ' || v_transaction.transaction_code
      )
    WHERE ip.company_id = p_company_id
      AND ip.invoice_id = v_invoice.id
      AND ip.deleted_at IS NULL;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_payment_void_count := v_payment_void_count + v_rows;

    UPDATE public.sales_invoices si
    SET
      status = 'cancelled',
      amount_paid = 0,
      amount_due = 0,
      updated_at = NOW(),
      updated_by = p_user_id,
      notes = CONCAT_WS(
        E'\n',
        si.notes,
        'Cancelled by POS void ' || v_transaction.transaction_code
      ),
      custom_fields = COALESCE(si.custom_fields, '{}'::JSONB)
        || JSONB_BUILD_OBJECT(
          'posVoidedAt', NOW(),
          'posVoidedBy', p_user_id,
          'posVoidReason', NULLIF(BTRIM(COALESCE(p_void_reason, '')), '')
        )
    WHERE si.id = v_invoice.id;

    v_invoice_count := v_invoice_count + 1;
  END LOOP;

  FOR v_original_stock IN
    SELECT *
    FROM public.stock_transactions st
    WHERE st.company_id = p_company_id
      AND st.reference_type = 'pos_transaction'
      AND st.reference_id = p_transaction_id
      AND st.transaction_type = 'out'
      AND st.status = 'posted'
      AND st.deleted_at IS NULL
    FOR UPDATE
  LOOP
    INSERT INTO public.warehouse_locations (
      company_id,
      warehouse_id,
      code,
      name,
      location_type,
      is_pickable,
      is_storable,
      is_active,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_original_stock.warehouse_id,
      'MAIN',
      'Main Location',
      'bin',
      TRUE,
      TRUE,
      TRUE,
      p_user_id,
      p_user_id
    )
    ON CONFLICT (company_id, warehouse_id, code)
    DO UPDATE SET
      deleted_at = NULL,
      is_active = TRUE,
      is_storable = TRUE,
      updated_at = NOW(),
      updated_by = EXCLUDED.updated_by
    RETURNING id INTO v_reversal_location_id;

    v_reversal_location_id := COALESCE(v_original_stock.from_location_id, v_reversal_location_id);

    INSERT INTO public.stock_transactions (
      company_id,
      business_unit_id,
      transaction_date,
      transaction_type,
      reference_type,
      reference_id,
      reference_code,
      warehouse_id,
      to_location_id,
      status,
      notes,
      custom_fields,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_original_stock.business_unit_id,
      CURRENT_DATE,
      'in',
      'pos_transaction',
      p_transaction_id,
      v_transaction.transaction_code,
      v_original_stock.warehouse_id,
      v_reversal_location_id,
      'posted',
      'Void/Reversal - POS Sale ' || v_transaction.transaction_code,
      JSONB_BUILD_OBJECT(
        'voidedOriginalStockTransactionId', v_original_stock.id,
        'posTransactionId', p_transaction_id,
        'voidedAt', NOW(),
        'voidedBy', p_user_id
      ),
      p_user_id,
      p_user_id
    )
    RETURNING id INTO v_reversal_stock_id;

    FOR v_original_stock_item IN
      SELECT *
      FROM public.stock_transaction_items sti
      WHERE sti.transaction_id = v_original_stock.id
        AND sti.company_id = p_company_id
        AND sti.deleted_at IS NULL
      FOR UPDATE
    LOOP
      SELECT COALESCE(iw.current_stock, 0)
      INTO v_current_stock
      FROM public.item_warehouse iw
      WHERE iw.company_id = p_company_id
        AND iw.item_id = v_original_stock_item.item_id
        AND iw.warehouse_id = v_original_stock.warehouse_id
        AND iw.deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        INSERT INTO public.item_warehouse (
          company_id,
          item_id,
          warehouse_id,
          current_stock,
          default_location_id,
          created_by,
          updated_by
        )
        VALUES (
          p_company_id,
          v_original_stock_item.item_id,
          v_original_stock.warehouse_id,
          0,
          v_reversal_location_id,
          p_user_id,
          p_user_id
        )
        ON CONFLICT (company_id, item_id, warehouse_id)
        DO UPDATE SET
          deleted_at = NULL,
          is_active = TRUE,
          default_location_id = COALESCE(
            public.item_warehouse.default_location_id,
            EXCLUDED.default_location_id
          ),
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by
        RETURNING COALESCE(public.item_warehouse.current_stock, 0) INTO v_current_stock;
      END IF;

      v_new_stock := v_current_stock + v_original_stock_item.quantity;

      INSERT INTO public.stock_transaction_items (
        company_id,
        transaction_id,
        item_id,
        quantity,
        uom_id,
        unit_cost,
        total_cost,
        qty_before,
        qty_after,
        valuation_rate,
        stock_value_before,
        stock_value_after,
        posting_date,
        posting_time,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_reversal_stock_id,
        v_original_stock_item.item_id,
        v_original_stock_item.quantity,
        v_original_stock_item.uom_id,
        COALESCE(v_original_stock_item.unit_cost, v_original_stock_item.valuation_rate, 0),
        v_original_stock_item.quantity * COALESCE(v_original_stock_item.unit_cost, v_original_stock_item.valuation_rate, 0),
        v_current_stock,
        v_new_stock,
        COALESCE(v_original_stock_item.valuation_rate, v_original_stock_item.unit_cost, 0),
        v_current_stock * COALESCE(v_original_stock_item.unit_cost, v_original_stock_item.valuation_rate, 0),
        v_new_stock * COALESCE(v_original_stock_item.unit_cost, v_original_stock_item.valuation_rate, 0),
        CURRENT_DATE,
        CURRENT_TIME,
        p_user_id,
        p_user_id
      );

      UPDATE public.item_warehouse iw
      SET
        current_stock = v_new_stock,
        default_location_id = COALESCE(iw.default_location_id, v_reversal_location_id),
        updated_at = NOW(),
        updated_by = p_user_id
      WHERE iw.company_id = p_company_id
        AND iw.item_id = v_original_stock_item.item_id
        AND iw.warehouse_id = v_original_stock.warehouse_id
        AND iw.deleted_at IS NULL;

      INSERT INTO public.item_location (
        company_id,
        item_id,
        warehouse_id,
        location_id,
        qty_on_hand,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_original_stock_item.item_id,
        v_original_stock.warehouse_id,
        v_reversal_location_id,
        v_original_stock_item.quantity,
        p_user_id,
        p_user_id
      )
      ON CONFLICT (company_id, item_id, warehouse_id, location_id)
      DO UPDATE SET
        qty_on_hand = public.item_location.qty_on_hand + EXCLUDED.qty_on_hand,
        deleted_at = NULL,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by;
    END LOOP;

    v_stock_reversal_count := v_stock_reversal_count + 1;
  END LOOP;

  FOR v_original_journal IN
    SELECT *
    FROM public.journal_entries je
    WHERE je.company_id = p_company_id
      AND je.reference_type = 'pos_transaction'
      AND je.reference_id = p_transaction_id
      AND je.status = 'posted'
      AND je.deleted_at IS NULL
      AND COALESCE(je.description, '') NOT ILIKE 'Void%'
    FOR UPDATE
  LOOP
    INSERT INTO public.journal_entries (
      company_id,
      business_unit_id,
      posting_date,
      reference_type,
      reference_id,
      reference_code,
      description,
      status,
      source_module,
      total_debit,
      total_credit,
      posted_at,
      posted_by,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_original_journal.business_unit_id,
      CURRENT_DATE,
      'pos_transaction',
      p_transaction_id,
      v_transaction.transaction_code,
      'Void/Reversal - ' || COALESCE(v_original_journal.description, v_transaction.transaction_code),
      'posted',
      v_original_journal.source_module,
      v_original_journal.total_credit,
      v_original_journal.total_debit,
      NOW(),
      p_user_id,
      p_user_id,
      p_user_id
    )
    RETURNING id INTO v_reversal_journal_id;

    INSERT INTO public.journal_lines (
      company_id,
      journal_entry_id,
      account_id,
      debit,
      credit,
      description,
      line_number,
      cost_center_id,
      project_id,
      created_by
    )
    SELECT
      jl.company_id,
      v_reversal_journal_id,
      jl.account_id,
      jl.credit,
      jl.debit,
      'Void/Reversal - ' || COALESCE(jl.description, v_transaction.transaction_code),
      jl.line_number,
      jl.cost_center_id,
      jl.project_id,
      p_user_id
    FROM public.journal_lines jl
    WHERE jl.journal_entry_id = v_original_journal.id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      RAISE EXCEPTION 'POS_VOID_ORIGINAL_JOURNAL_LINES_NOT_FOUND';
    END IF;

    v_journal_reversal_count := v_journal_reversal_count + 1;
  END LOOP;

  UPDATE public.pos_transactions pt
  SET
    status = 'voided',
    notes = CASE
      WHEN NULLIF(BTRIM(COALESCE(p_void_reason, '')), '') IS NULL THEN pt.notes
      ELSE CONCAT_WS(E'\n', pt.notes, 'Void reason: ' || BTRIM(p_void_reason))
    END,
    updated_at = NOW(),
    updated_by = p_user_id
  WHERE pt.id = p_transaction_id;

  RETURN JSONB_BUILD_OBJECT(
    'transactionId', p_transaction_id,
    'status', 'voided',
    'cancelledInvoices', v_invoice_count,
    'voidedInvoicePayments', v_payment_void_count,
    'stockReversals', v_stock_reversal_count,
    'journalReversals', v_journal_reversal_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_pos_transaction(UUID, UUID, UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.void_pos_transaction(UUID, UUID, UUID, UUID, TEXT) IS
  'Atomically voids a completed POS transaction and reverses linked invoice payments, invoice status, stock movements, and posted GL entries.';
