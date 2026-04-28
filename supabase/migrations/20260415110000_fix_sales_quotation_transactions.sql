-- ============================================================================
-- Migration: Fix sales quotation transactions and document code format
-- Description:
--   - Align future generated document codes with the standard 9-digit suffix.
--   - Add transactional RPCs for quotation create, update, and conversion.
-- Date: 2026-04-15
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_document_code(
  p_company_id UUID,
  p_code_prefix TEXT,
  p_digits INTEGER DEFAULT 9
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT := btrim(p_code_prefix);
  v_next_number BIGINT;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'generate_document_code requires company_id';
  END IF;

  IF v_prefix IS NULL OR v_prefix = '' THEN
    RAISE EXCEPTION 'generate_document_code requires a non-empty code_prefix';
  END IF;

  IF p_digits IS NULL OR p_digits < 1 OR p_digits > 18 THEN
    RAISE EXCEPTION 'generate_document_code requires digits between 1 and 18';
  END IF;

  INSERT INTO public.document_code_sequences (company_id, code_prefix, last_number)
  VALUES (p_company_id, v_prefix, 1)
  ON CONFLICT (company_id, code_prefix)
  DO UPDATE SET
    last_number = public.document_code_sequences.last_number + 1,
    updated_at = timezone('utc', now())
  RETURNING last_number INTO v_next_number;

  RETURN v_prefix || '-' || lpad(v_next_number::TEXT, p_digits, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_document_code(UUID, TEXT, INTEGER) IS
  'Generates the next sequential company-scoped document code using PREFIX plus a fixed-width numeric suffix.';

DROP TRIGGER IF EXISTS trigger_generate_stock_transaction_code ON public.stock_transactions;
CREATE TRIGGER trigger_generate_stock_transaction_code
  BEFORE INSERT ON public.stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('transaction_code', 'ST', '9');

DROP TRIGGER IF EXISTS trigger_set_stock_request_code ON public.stock_requests;
CREATE TRIGGER trigger_set_stock_request_code
  BEFORE INSERT ON public.stock_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('request_code', 'SR', '9');

DROP TRIGGER IF EXISTS trigger_generate_sales_order_code ON public.sales_orders;
CREATE TRIGGER trigger_generate_sales_order_code
  BEFORE INSERT ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('order_code', 'SO', '9');

DROP TRIGGER IF EXISTS trigger_generate_sales_quotation_code ON public.sales_quotations;
CREATE TRIGGER trigger_generate_sales_quotation_code
  BEFORE INSERT ON public.sales_quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('quotation_code', 'QT', '9');

DROP TRIGGER IF EXISTS trigger_generate_sales_invoice_code ON public.sales_invoices;
CREATE TRIGGER trigger_generate_sales_invoice_code
  BEFORE INSERT ON public.sales_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('invoice_code', 'INV', '9');

DROP TRIGGER IF EXISTS trigger_generate_purchase_order_code ON public.purchase_orders;
CREATE TRIGGER trigger_generate_purchase_order_code
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('order_code', 'PO', '9');

DROP TRIGGER IF EXISTS trigger_generate_purchase_receipt_code ON public.purchase_receipts;
CREATE TRIGGER trigger_generate_purchase_receipt_code
  BEFORE INSERT ON public.purchase_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('receipt_code', 'GRN', '9');

DROP TRIGGER IF EXISTS trigger_generate_stock_adjustment_code ON public.stock_adjustments;
CREATE TRIGGER trigger_generate_stock_adjustment_code
  BEFORE INSERT ON public.stock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('adjustment_code', 'ADJ', '9');

DROP TRIGGER IF EXISTS trigger_generate_stock_transfer_code ON public.stock_transfers;
CREATE TRIGGER trigger_generate_stock_transfer_code
  BEFORE INSERT ON public.stock_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('transfer_code', 'STX', '9');

DROP TRIGGER IF EXISTS trigger_generate_transformation_order_code ON public.transformation_orders;
CREATE TRIGGER trigger_generate_transformation_order_code
  BEFORE INSERT ON public.transformation_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('order_code', 'TRN', '9');

DROP TRIGGER IF EXISTS trigger_generate_invoice_payment_code ON public.invoice_payments;
CREATE TRIGGER trigger_generate_invoice_payment_code
  BEFORE INSERT ON public.invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('payment_code', 'PAY', '9');

DROP TRIGGER IF EXISTS trigger_generate_grn_number ON public.grns;
CREATE TRIGGER trigger_generate_grn_number
  BEFORE INSERT ON public.grns
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('grn_number', 'GRN', '9');

DROP TRIGGER IF EXISTS trigger_generate_pick_list_no ON public.pick_lists;
CREATE TRIGGER trigger_generate_pick_list_no
  BEFORE INSERT ON public.pick_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('pick_list_no', 'PL', '9');

DROP TRIGGER IF EXISTS trigger_generate_pos_transaction_code ON public.pos_transactions;
CREATE TRIGGER trigger_generate_pos_transaction_code
  BEFORE INSERT ON public.pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('transaction_code', 'POS', '9');

DROP TRIGGER IF EXISTS trigger_generate_journal_code ON public.journal_entries;
CREATE TRIGGER trigger_generate_journal_code
  BEFORE INSERT ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('journal_code', 'JE', '9');

DROP TRIGGER IF EXISTS trigger_generate_load_list_no ON public.load_lists;
CREATE TRIGGER trigger_generate_load_list_no
  BEFORE INSERT ON public.load_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('ll_number', 'LL', '9');

DROP TRIGGER IF EXISTS trigger_generate_delivery_note_no ON public.delivery_notes;
CREATE TRIGGER trigger_generate_delivery_note_no
  BEFORE INSERT ON public.delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('dn_no', 'DN', '9');

CREATE OR REPLACE FUNCTION public.calculate_sales_quotation_item(p_item JSONB)
RETURNS TABLE (
  item_id UUID,
  item_description TEXT,
  quantity NUMERIC,
  uom_id UUID,
  rate NUMERIC,
  discount_percent NUMERIC,
  discount_amount NUMERIC,
  tax_percent NUMERIC,
  tax_amount NUMERIC,
  line_total NUMERIC,
  sort_order INTEGER,
  notes TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_subtotal NUMERIC;
  v_taxable_amount NUMERIC;
BEGIN
  item_id := NULLIF(p_item ->> 'itemId', '')::UUID;
  item_description := NULLIF(p_item ->> 'description', '');
  quantity := COALESCE(NULLIF(p_item ->> 'quantity', '')::NUMERIC, 0);
  uom_id := NULLIF(p_item ->> 'uomId', '')::UUID;
  rate := COALESCE(NULLIF(p_item ->> 'rate', '')::NUMERIC, 0);
  discount_percent := COALESCE(NULLIF(p_item ->> 'discountPercent', '')::NUMERIC, 0);
  tax_percent := COALESCE(NULLIF(p_item ->> 'taxPercent', '')::NUMERIC, 0);
  sort_order := COALESCE(NULLIF(p_item ->> 'sortOrder', '')::INTEGER, 0);
  notes := NULLIF(p_item ->> 'notes', '');

  IF item_id IS NULL THEN
    RAISE EXCEPTION 'Quotation item is missing itemId';
  END IF;

  IF uom_id IS NULL THEN
    RAISE EXCEPTION 'Quotation item is missing uomId';
  END IF;

  IF quantity <= 0 THEN
    RAISE EXCEPTION 'Quotation item quantity must be greater than zero';
  END IF;

  IF rate < 0 THEN
    RAISE EXCEPTION 'Quotation item rate cannot be negative';
  END IF;

  v_subtotal := quantity * rate;
  discount_amount := COALESCE(
    NULLIF(p_item ->> 'discountAmount', '')::NUMERIC,
    v_subtotal * discount_percent / 100
  );
  v_taxable_amount := v_subtotal - discount_amount;
  tax_amount := COALESCE(
    NULLIF(p_item ->> 'taxAmount', '')::NUMERIC,
    v_taxable_amount * tax_percent / 100
  );
  line_total := v_taxable_amount + tax_amount;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_sales_quotation_transaction(
  p_customer_id UUID,
  p_quotation_date DATE,
  p_valid_until DATE,
  p_price_list_id UUID,
  p_terms_conditions TEXT,
  p_notes TEXT,
  p_business_unit_id UUID,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_quotation_id UUID;
  v_subtotal NUMERIC := 0;
  v_discount_amount NUMERIC := 0;
  v_tax_amount NUMERIC := 0;
  v_item JSONB;
  v_ordinality INTEGER;
  v_calculated RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.users
  WHERE id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User company not found';
  END IF;

  IF p_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Quotation must have at least one item';
  END IF;

  INSERT INTO public.sales_quotations (
    company_id,
    business_unit_id,
    quotation_date,
    customer_id,
    valid_until,
    price_list_id,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    status,
    notes,
    terms_conditions,
    created_by,
    updated_by
  )
  VALUES (
    v_company_id,
    p_business_unit_id,
    p_quotation_date,
    p_customer_id,
    p_valid_until,
    p_price_list_id,
    0,
    0,
    0,
    0,
    'draft',
    p_notes,
    p_terms_conditions,
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_quotation_id;

  FOR v_item, v_ordinality IN
    SELECT value, ordinality::INTEGER - 1
    FROM jsonb_array_elements(p_items) WITH ORDINALITY
  LOOP
    v_item := jsonb_set(v_item, '{sortOrder}', to_jsonb(v_ordinality), true);
    SELECT * INTO v_calculated FROM public.calculate_sales_quotation_item(v_item);

    v_subtotal := v_subtotal + (v_calculated.quantity * v_calculated.rate);
    v_discount_amount := v_discount_amount + v_calculated.discount_amount;
    v_tax_amount := v_tax_amount + v_calculated.tax_amount;

    INSERT INTO public.sales_quotation_items (
      company_id,
      quotation_id,
      item_id,
      item_description,
      quantity,
      uom_id,
      rate,
      discount_percent,
      discount_amount,
      tax_percent,
      tax_amount,
      line_total,
      sort_order,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      v_company_id,
      v_quotation_id,
      v_calculated.item_id,
      v_calculated.item_description,
      v_calculated.quantity,
      v_calculated.uom_id,
      v_calculated.rate,
      v_calculated.discount_percent,
      v_calculated.discount_amount,
      v_calculated.tax_percent,
      v_calculated.tax_amount,
      v_calculated.line_total,
      v_calculated.sort_order,
      v_calculated.notes,
      v_user_id,
      v_user_id
    );
  END LOOP;

  UPDATE public.sales_quotations
  SET
    subtotal = v_subtotal,
    discount_amount = v_discount_amount,
    tax_amount = v_tax_amount,
    total_amount = v_subtotal - v_discount_amount + v_tax_amount,
    updated_by = v_user_id
  WHERE id = v_quotation_id;

  RETURN v_quotation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_sales_quotation_transaction(
  p_quotation_id UUID,
  p_quotation_date DATE,
  p_valid_until DATE,
  p_terms_conditions TEXT,
  p_notes TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing RECORD;
  v_item JSONB;
  v_ordinality INTEGER;
  v_calculated RECORD;
  v_subtotal NUMERIC := 0;
  v_discount_amount NUMERIC := 0;
  v_tax_amount NUMERIC := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id, company_id, status
  INTO v_existing
  FROM public.sales_quotations
  WHERE id = p_quotation_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'Quotation not found';
  END IF;

  IF v_existing.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft quotations can be edited';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Quotation must have at least one item';
  END IF;

  UPDATE public.sales_quotation_items
  SET
    deleted_at = timezone('utc', now()),
    updated_by = v_user_id
  WHERE quotation_id = p_quotation_id
    AND deleted_at IS NULL;

  FOR v_item, v_ordinality IN
    SELECT value, ordinality::INTEGER - 1
    FROM jsonb_array_elements(p_items) WITH ORDINALITY
  LOOP
    v_item := jsonb_set(v_item, '{sortOrder}', to_jsonb(v_ordinality), true);
    SELECT * INTO v_calculated FROM public.calculate_sales_quotation_item(v_item);

    v_subtotal := v_subtotal + (v_calculated.quantity * v_calculated.rate);
    v_discount_amount := v_discount_amount + v_calculated.discount_amount;
    v_tax_amount := v_tax_amount + v_calculated.tax_amount;

    INSERT INTO public.sales_quotation_items (
      company_id,
      quotation_id,
      item_id,
      item_description,
      quantity,
      uom_id,
      rate,
      discount_percent,
      discount_amount,
      tax_percent,
      tax_amount,
      line_total,
      sort_order,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      v_existing.company_id,
      p_quotation_id,
      v_calculated.item_id,
      v_calculated.item_description,
      v_calculated.quantity,
      v_calculated.uom_id,
      v_calculated.rate,
      v_calculated.discount_percent,
      v_calculated.discount_amount,
      v_calculated.tax_percent,
      v_calculated.tax_amount,
      v_calculated.line_total,
      v_calculated.sort_order,
      v_calculated.notes,
      v_user_id,
      v_user_id
    );
  END LOOP;

  UPDATE public.sales_quotations
  SET
    quotation_date = p_quotation_date,
    valid_until = p_valid_until,
    terms_conditions = p_terms_conditions,
    notes = p_notes,
    subtotal = v_subtotal,
    discount_amount = v_discount_amount,
    tax_amount = v_tax_amount,
    total_amount = v_subtotal - v_discount_amount + v_tax_amount,
    updated_by = v_user_id
  WHERE id = p_quotation_id;

  RETURN p_quotation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_sales_quotation_to_order_transaction(
  p_quotation_id UUID,
  p_business_unit_id UUID
)
RETURNS TABLE (
  sales_order_id UUID,
  order_code TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_quotation RECORD;
  v_sales_order_id UUID;
  v_order_code TEXT;
  v_item_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required';
  END IF;

  SELECT *
  INTO v_quotation
  FROM public.sales_quotations
  WHERE id = p_quotation_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_quotation.id IS NULL THEN
    RAISE EXCEPTION 'Quotation not found';
  END IF;

  IF v_quotation.status <> 'accepted' THEN
    RAISE EXCEPTION 'Only accepted quotations can be converted to sales orders';
  END IF;

  IF v_quotation.sales_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'This quotation has already been converted to a sales order';
  END IF;

  SELECT COUNT(*) INTO v_item_count
  FROM public.sales_quotation_items
  WHERE quotation_id = p_quotation_id
    AND deleted_at IS NULL;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Quotation must have at least one item';
  END IF;

  INSERT INTO public.sales_orders (
    company_id,
    business_unit_id,
    customer_id,
    quotation_id,
    order_date,
    expected_delivery_date,
    status,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    payment_terms,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    v_quotation.company_id,
    p_business_unit_id,
    v_quotation.customer_id,
    p_quotation_id,
    CURRENT_DATE,
    COALESCE(v_quotation.valid_until, CURRENT_DATE + 14),
    'confirmed',
    v_quotation.subtotal,
    v_quotation.discount_amount,
    v_quotation.tax_amount,
    v_quotation.total_amount,
    COALESCE(v_quotation.terms_conditions, 'Payment due within 30 days'),
    COALESCE(v_quotation.notes, ''),
    v_user_id,
    v_user_id
  )
  RETURNING id, sales_orders.order_code INTO v_sales_order_id, v_order_code;

  INSERT INTO public.sales_order_items (
    company_id,
    order_id,
    item_id,
    item_description,
    quantity,
    uom_id,
    rate,
    discount_percent,
    discount_amount,
    tax_percent,
    tax_amount,
    line_total,
    quantity_shipped,
    quantity_delivered,
    sort_order,
    notes,
    created_by,
    updated_by
  )
  SELECT
    company_id,
    v_sales_order_id,
    item_id,
    item_description,
    quantity,
    uom_id,
    rate,
    COALESCE(discount_percent, 0),
    COALESCE(discount_amount, 0),
    COALESCE(tax_percent, 0),
    COALESCE(tax_amount, 0),
    line_total,
    0,
    0,
    sort_order,
    notes,
    v_user_id,
    v_user_id
  FROM public.sales_quotation_items
  WHERE quotation_id = p_quotation_id
    AND deleted_at IS NULL
  ORDER BY sort_order ASC NULLS LAST, created_at ASC;

  UPDATE public.sales_quotations
  SET
    status = 'ordered',
    sales_order_id = v_sales_order_id,
    updated_by = v_user_id
  WHERE id = p_quotation_id;

  sales_order_id := v_sales_order_id;
  order_code := v_order_code;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_sales_quotation_transaction(
  p_quotation_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing RECORD;
  v_deleted_at TIMESTAMPTZ := timezone('utc', now());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id, status
  INTO v_existing
  FROM public.sales_quotations
  WHERE id = p_quotation_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'Quotation not found';
  END IF;

  IF v_existing.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft quotations can be deleted';
  END IF;

  UPDATE public.sales_quotations
  SET
    deleted_at = v_deleted_at,
    updated_by = v_user_id
  WHERE id = p_quotation_id;

  UPDATE public.sales_quotation_items
  SET
    deleted_at = v_deleted_at,
    updated_by = v_user_id
  WHERE quotation_id = p_quotation_id
    AND deleted_at IS NULL;

  RETURN p_quotation_id;
END;
$$;
