-- ============================================================================
-- Migration: Delivery note receiving exception review
-- Description:
--   Adds explicit review actions for unexpected delivery note receiving scans.
--   Accepted exceptions post stock through a separate inventory transaction.
--   Rejected exceptions create no stock movement.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.reject_delivery_note_receiving_exception(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_exception_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exception public.delivery_note_receiving_exceptions%ROWTYPE;
  v_dn public.delivery_notes%ROWTYPE;
BEGIN
  SELECT *
  INTO v_dn
  FROM public.delivery_notes
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note not found';
  END IF;

  SELECT *
  INTO v_exception
  FROM public.delivery_note_receiving_exceptions
  WHERE id = p_exception_id
    AND company_id = p_company_id
    AND dn_id = p_dn_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receiving exception not found';
  END IF;

  IF v_exception.status <> 'pending_review' THEN
    RAISE EXCEPTION 'Only pending receiving exceptions can be reviewed';
  END IF;

  UPDATE public.delivery_note_receiving_exceptions
  SET
    status = 'rejected',
    notes = CONCAT_WS(E'\n', NULLIF(BTRIM(notes), ''), NULLIF(BTRIM(p_notes), '')),
    reviewed_by = p_user_id,
    reviewed_at = now(),
    updated_at = now()
  WHERE id = p_exception_id
    AND company_id = p_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_delivery_note_receiving_exception(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_exception_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exception public.delivery_note_receiving_exceptions%ROWTYPE;
  v_dn public.delivery_notes%ROWTYPE;
  v_item public.items%ROWTYPE;
  v_warehouse_id UUID;
  v_location_id UUID;
  v_stock_tx_id UUID;
  v_now TIMESTAMPTZ := now();
  v_posting_date DATE := CURRENT_DATE;
  v_posting_time TIME := now()::TIME;
  v_qty NUMERIC;
  v_current_stock NUMERIC := 0;
  v_next_stock NUMERIC := 0;
  v_item_batch public.item_batch%ROWTYPE;
BEGIN
  SELECT *
  INTO v_dn
  FROM public.delivery_notes
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note not found';
  END IF;

  SELECT *
  INTO v_exception
  FROM public.delivery_note_receiving_exceptions
  WHERE id = p_exception_id
    AND company_id = p_company_id
    AND dn_id = p_dn_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receiving exception not found';
  END IF;

  IF v_exception.status <> 'pending_review' THEN
    RAISE EXCEPTION 'Only pending receiving exceptions can be reviewed';
  END IF;

  v_qty := COALESCE(v_exception.accepted_qty, 0);
  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'Accepted quantity must be greater than zero';
  END IF;

  SELECT *
  INTO v_item
  FROM public.items
  WHERE id = v_exception.item_id
    AND company_id = p_company_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  v_warehouse_id := v_dn.requesting_warehouse_id;
  IF v_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Delivery note receiving warehouse is missing';
  END IF;

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
    v_warehouse_id,
    'MAIN',
    'Main',
    'bin',
    TRUE,
    TRUE,
    TRUE,
    p_user_id,
    p_user_id
  )
  ON CONFLICT (company_id, warehouse_id, code) DO UPDATE
  SET updated_by = EXCLUDED.updated_by
  RETURNING id INTO v_location_id;

  v_location_id := COALESCE(v_exception.location_id, v_location_id);

  SELECT COALESCE(current_stock, 0)
  INTO v_current_stock
  FROM public.item_warehouse
  WHERE company_id = p_company_id
    AND item_id = v_exception.item_id
    AND warehouse_id = v_warehouse_id
    AND deleted_at IS NULL
  FOR UPDATE;

  v_current_stock := COALESCE(v_current_stock, 0);
  v_next_stock := v_current_stock + v_qty;

  INSERT INTO public.stock_transactions (
    company_id,
    business_unit_id,
    transaction_type,
    transaction_date,
    warehouse_id,
    to_location_id,
    reference_type,
    reference_id,
    reference_code,
    status,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    p_business_unit_id,
    'in',
    v_posting_date,
    v_warehouse_id,
    v_location_id,
    'delivery_note_receiving_exception',
    v_exception.id,
    v_dn.dn_no,
    'posted',
    COALESCE(NULLIF(BTRIM(p_notes), ''), 'Accepted unexpected item from delivery note ' || v_dn.dn_no),
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_stock_tx_id;

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
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    v_stock_tx_id,
    v_exception.item_id,
    v_qty,
    v_exception.uom_id,
    0,
    0,
    v_current_stock,
    v_next_stock,
    0,
    0,
    0,
    v_posting_date,
    v_posting_time,
    COALESCE(NULLIF(BTRIM(p_notes), ''), 'Accepted unexpected receiving exception'),
    p_user_id,
    p_user_id
  );

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
    v_exception.item_id,
    v_warehouse_id,
    v_qty,
    v_location_id,
    p_user_id,
    p_user_id
  )
  ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE
  SET
    current_stock = public.item_warehouse.current_stock + EXCLUDED.current_stock,
    default_location_id = COALESCE(public.item_warehouse.default_location_id, EXCLUDED.default_location_id),
    updated_by = EXCLUDED.updated_by,
    updated_at = v_now;

  INSERT INTO public.item_location (
    company_id,
    item_id,
    warehouse_id,
    location_id,
    qty_on_hand,
    qty_reserved,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    v_exception.item_id,
    v_warehouse_id,
    v_location_id,
    v_qty,
    0,
    p_user_id,
    p_user_id
  )
  ON CONFLICT (company_id, item_id, warehouse_id, location_id) DO UPDATE
  SET
    qty_on_hand = public.item_location.qty_on_hand + EXCLUDED.qty_on_hand,
    updated_by = EXCLUDED.updated_by,
    updated_at = v_now;

  IF NULLIF(BTRIM(v_exception.batch_number), '') IS NOT NULL THEN
    SELECT *
    INTO v_item_batch
    FROM public.item_batch
    WHERE company_id = p_company_id
      AND item_id = v_exception.item_id
      AND warehouse_id = v_warehouse_id
      AND batch_code = v_exception.batch_number
      AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.item_batch
      SET
        qty_on_hand = qty_on_hand + v_qty,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_item_batch.id
      RETURNING * INTO v_item_batch;
    ELSE
      INSERT INTO public.item_batch (
        company_id,
        item_id,
        warehouse_id,
        batch_code,
        received_at,
        qty_on_hand,
        qty_reserved,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_exception.item_id,
        v_warehouse_id,
        v_exception.batch_number,
        v_now,
        v_qty,
        0,
        p_user_id,
        p_user_id
      )
      RETURNING * INTO v_item_batch;
    END IF;

    INSERT INTO public.item_location_batch (
      company_id,
      item_id,
      warehouse_id,
      location_id,
      item_batch_id,
      qty_on_hand,
      qty_reserved,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_exception.item_id,
      v_warehouse_id,
      v_location_id,
      v_item_batch.id,
      v_qty,
      0,
      p_user_id,
      p_user_id
    )
    ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE
    SET
      qty_on_hand = public.item_location_batch.qty_on_hand + EXCLUDED.qty_on_hand,
      updated_by = EXCLUDED.updated_by,
      updated_at = v_now;
  END IF;

  UPDATE public.delivery_note_receiving_exceptions
  SET
    status = 'accepted',
    notes = CONCAT_WS(E'\n', NULLIF(BTRIM(notes), ''), NULLIF(BTRIM(p_notes), '')),
    reviewed_by = p_user_id,
    reviewed_at = v_now,
    updated_at = v_now
  WHERE id = p_exception_id
    AND company_id = p_company_id;
END;
$$;

COMMIT;
