-- ============================================================================
-- Migration: Delivery note overage review
-- Description:
--   Records over-received delivery note line quantities as reviewable overages.
--   Accepted overages post stock through a separate inventory transaction.
--   Rejected overages create no stock movement.
-- ============================================================================

BEGIN;

ALTER TABLE public.delivery_note_items
  ADD COLUMN IF NOT EXISTS receiving_overage_review_status TEXT,
  ADD COLUMN IF NOT EXISTS receiving_overage_posted_qty NUMERIC(20, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receiving_overage_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS receiving_overage_reviewed_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS receiving_overage_reviewed_at TIMESTAMPTZ;

ALTER TABLE public.delivery_note_items
  DROP CONSTRAINT IF EXISTS chk_delivery_note_items_overage_review_status,
  ADD CONSTRAINT chk_delivery_note_items_overage_review_status
    CHECK (
      receiving_overage_review_status IS NULL
      OR receiving_overage_review_status IN ('pending_review', 'accepted', 'rejected')
    );

CREATE OR REPLACE FUNCTION public.submit_delivery_note_receiving(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_received_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_acknowledge_discrepancy BOOLEAN DEFAULT FALSE,
  p_discrepancy_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dn public.delivery_notes%ROWTYPE;
  v_item RECORD;
  v_items JSONB := '[]'::jsonb;
  v_has_postable_received_qty BOOLEAN := FALSE;
  v_has_any_scan BOOLEAN := FALSE;
  v_has_discrepancy BOOLEAN := FALSE;
  v_discrepancy_notes TEXT := NULLIF(BTRIM(p_discrepancy_notes), '');
  v_line_note TEXT;
  v_line_status TEXT;
  v_line_variance NUMERIC;
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

  IF v_dn.status <> 'dispatched' THEN
    RAISE EXCEPTION 'Only dispatched delivery notes can be submitted for receiving';
  END IF;

  IF v_dn.receiving_started_at IS NULL THEN
    RAISE EXCEPTION 'Receiving has not been started';
  END IF;

  FOR v_item IN
    SELECT
      dni.id,
      COALESCE(dni.dispatched_qty, 0) AS dispatched_qty,
      COALESCE(COUNT(scans.id) FILTER (WHERE scans.voided_at IS NULL), 0)::NUMERIC AS received_scan_count,
      LEAST(
        COALESCE(COUNT(scans.id) FILTER (WHERE scans.voided_at IS NULL), 0)::NUMERIC,
        COALESCE(dni.dispatched_qty, 0)
      ) AS post_received_qty
    FROM public.delivery_note_items dni
    LEFT JOIN public.delivery_note_item_receiving_scans scans
      ON scans.company_id = dni.company_id
     AND scans.dn_item_id = dni.id
    WHERE dni.company_id = p_company_id
      AND dni.dn_id = p_dn_id
      AND COALESCE(dni.is_voided, FALSE) = FALSE
    GROUP BY dni.id, dni.dispatched_qty
    ORDER BY dni.id
  LOOP
    v_line_variance := v_item.received_scan_count - v_item.dispatched_qty;
    v_line_status := CASE
      WHEN v_line_variance = 0 THEN 'exact'
      WHEN v_line_variance < 0 THEN 'short'
      ELSE 'over'
    END;
    v_line_note := CASE
      WHEN v_line_variance = 0 THEN
        FORMAT('Exact receive: scanned %s of %s.', v_item.received_scan_count, v_item.dispatched_qty)
      WHEN v_line_variance < 0 THEN
        FORMAT(
          'Short receive: scanned %s of %s. Short %s.',
          v_item.received_scan_count,
          v_item.dispatched_qty,
          ABS(v_line_variance)
        )
      ELSE
        FORMAT(
          'Over receive: scanned %s of %s. Over %s.',
          v_item.received_scan_count,
          v_item.dispatched_qty,
          v_line_variance
        )
    END;

    v_has_any_scan := v_has_any_scan OR v_item.received_scan_count > 0;
    v_has_discrepancy := v_has_discrepancy OR v_line_variance <> 0;

    UPDATE public.delivery_note_items
    SET
      received_qty = v_item.received_scan_count,
      receiving_variance_qty = v_line_variance,
      receiving_status = v_line_status,
      receiving_discrepancy_flag = v_line_variance <> 0,
      receiving_notes = CONCAT_WS(E'\n', v_line_note, v_discrepancy_notes),
      receiving_overage_review_status = CASE
        WHEN v_line_variance > 0 THEN 'pending_review'
        ELSE NULL
      END,
      receiving_overage_posted_qty = CASE
        WHEN v_line_variance > 0 THEN receiving_overage_posted_qty
        ELSE 0
      END,
      receiving_overage_review_notes = CASE
        WHEN v_line_variance > 0 THEN receiving_overage_review_notes
        ELSE NULL
      END,
      receiving_overage_reviewed_by = CASE
        WHEN v_line_variance > 0 THEN receiving_overage_reviewed_by
        ELSE NULL
      END,
      receiving_overage_reviewed_at = CASE
        WHEN v_line_variance > 0 THEN receiving_overage_reviewed_at
        ELSE NULL
      END,
      updated_at = now()
    WHERE company_id = p_company_id
      AND id = v_item.id;

    IF v_item.post_received_qty > 0 THEN
      v_has_postable_received_qty := TRUE;
      v_items := v_items || jsonb_build_array(
        jsonb_build_object(
          'deliveryNoteItemId', v_item.id,
          'receivedQty', v_item.post_received_qty,
          'locationId', NULL
        )
      );
    END IF;
  END LOOP;

  IF NOT v_has_any_scan THEN
    RAISE EXCEPTION 'No receiving scans have been recorded';
  END IF;

  IF v_has_discrepancy AND NOT COALESCE(p_acknowledge_discrepancy, FALSE) THEN
    RAISE EXCEPTION 'Receiving discrepancy acknowledgement is required';
  END IF;

  IF v_has_discrepancy AND v_discrepancy_notes IS NULL THEN
    RAISE EXCEPTION 'Receiving discrepancy notes are required';
  END IF;

  IF NOT v_has_postable_received_qty THEN
    RAISE EXCEPTION 'No receiving scans have been recorded';
  END IF;

  PERFORM public.post_delivery_note_receive(
    p_company_id,
    p_user_id,
    p_dn_id,
    p_business_unit_id,
    COALESCE(p_received_date, now()::DATE),
    p_notes,
    v_items
  );

  UPDATE public.delivery_notes
  SET
    receiving_completed_at = now(),
    receiving_completed_by = p_user_id,
    received_by = p_user_id,
    receiving_notes = COALESCE(NULLIF(BTRIM(p_notes), ''), receiving_notes),
    receiving_has_discrepancy = v_has_discrepancy,
    receiving_discrepancy_notes = CASE
      WHEN v_has_discrepancy THEN v_discrepancy_notes
      ELSE receiving_discrepancy_notes
    END,
    updated_by = p_user_id,
    updated_at = now()
  WHERE id = p_dn_id
    AND company_id = p_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_delivery_note_receiving_overage(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_dn_item_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dn public.delivery_notes%ROWTYPE;
  v_dn_item public.delivery_note_items%ROWTYPE;
  v_warehouse_id UUID;
  v_location_id UUID;
  v_stock_tx_id UUID;
  v_now TIMESTAMPTZ := now();
  v_posting_date DATE := CURRENT_DATE;
  v_posting_time TIME := now()::TIME;
  v_overage_qty NUMERIC;
  v_overage_base_qty NUMERIC;
  v_qty_per_unit NUMERIC := 1;
  v_item_base_uom_id UUID;
  v_current_stock NUMERIC := 0;
  v_next_stock NUMERIC := 0;
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
  INTO v_dn_item
  FROM public.delivery_note_items
  WHERE id = p_dn_item_id
    AND company_id = p_company_id
    AND dn_id = p_dn_id
    AND COALESCE(is_voided, FALSE) = FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note item not found';
  END IF;

  IF v_dn_item.receiving_overage_review_status <> 'pending_review' THEN
    RAISE EXCEPTION 'Only pending receiving overages can be reviewed';
  END IF;

  v_overage_qty := GREATEST(
    0,
    COALESCE(v_dn_item.received_qty, 0)
      - COALESCE(v_dn_item.dispatched_qty, 0)
      - COALESCE(v_dn_item.receiving_overage_posted_qty, 0)
  );

  IF v_overage_qty <= 0 THEN
    RAISE EXCEPTION 'No receiving overage is available to post';
  END IF;

  SELECT
    COALESCE(iuo.qty_per_unit, 1),
    i.uom_id
  INTO
    v_qty_per_unit,
    v_item_base_uom_id
  FROM public.items i
  LEFT JOIN public.item_unit_options iuo
    ON iuo.id = v_dn_item.item_unit_option_id
   AND iuo.deleted_at IS NULL
  WHERE i.id = v_dn_item.item_id
    AND i.company_id = p_company_id
    AND i.deleted_at IS NULL;

  IF v_item_base_uom_id IS NULL THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  v_overage_base_qty := v_overage_qty * COALESCE(v_qty_per_unit, 1);

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

  SELECT COALESCE(current_stock, 0)
  INTO v_current_stock
  FROM public.item_warehouse
  WHERE company_id = p_company_id
    AND item_id = v_dn_item.item_id
    AND warehouse_id = v_warehouse_id
    AND deleted_at IS NULL
  FOR UPDATE;

  v_current_stock := COALESCE(v_current_stock, 0);
  v_next_stock := v_current_stock + v_overage_base_qty;

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
    'delivery_note_receiving_overage',
    v_dn_item.id,
    v_dn.dn_no,
    'posted',
    COALESCE(NULLIF(BTRIM(p_notes), ''), 'Accepted over-received quantity from delivery note ' || v_dn.dn_no),
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
    v_dn_item.item_id,
    v_overage_base_qty,
    v_item_base_uom_id,
    0,
    0,
    v_current_stock,
    v_next_stock,
    0,
    0,
    0,
    v_posting_date,
    v_posting_time,
    COALESCE(NULLIF(BTRIM(p_notes), ''), 'Accepted delivery note receiving overage'),
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
    v_dn_item.item_id,
    v_warehouse_id,
    v_overage_base_qty,
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
    v_dn_item.item_id,
    v_warehouse_id,
    v_location_id,
    v_overage_base_qty,
    0,
    p_user_id,
    p_user_id
  )
  ON CONFLICT (company_id, item_id, warehouse_id, location_id) DO UPDATE
  SET
    qty_on_hand = public.item_location.qty_on_hand + EXCLUDED.qty_on_hand,
    updated_by = EXCLUDED.updated_by,
    updated_at = v_now;

  UPDATE public.delivery_note_items
  SET
    receiving_overage_review_status = 'accepted',
    receiving_overage_posted_qty = COALESCE(receiving_overage_posted_qty, 0) + v_overage_qty,
    receiving_overage_review_notes = CONCAT_WS(E'\n', NULLIF(BTRIM(receiving_overage_review_notes), ''), NULLIF(BTRIM(p_notes), '')),
    receiving_overage_reviewed_by = p_user_id,
    receiving_overage_reviewed_at = v_now,
    updated_at = v_now
  WHERE id = p_dn_item_id
    AND company_id = p_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_delivery_note_receiving_overage(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_dn_item_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dn_item public.delivery_note_items%ROWTYPE;
BEGIN
  IF p_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required';
  END IF;

  PERFORM 1
  FROM public.delivery_notes
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note not found';
  END IF;

  SELECT *
  INTO v_dn_item
  FROM public.delivery_note_items
  WHERE id = p_dn_item_id
    AND company_id = p_company_id
    AND dn_id = p_dn_id
    AND COALESCE(is_voided, FALSE) = FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note item not found';
  END IF;

  IF v_dn_item.receiving_overage_review_status <> 'pending_review' THEN
    RAISE EXCEPTION 'Only pending receiving overages can be reviewed';
  END IF;

  UPDATE public.delivery_note_items
  SET
    receiving_overage_review_status = 'rejected',
    receiving_overage_review_notes = CONCAT_WS(E'\n', NULLIF(BTRIM(receiving_overage_review_notes), ''), NULLIF(BTRIM(p_notes), '')),
    receiving_overage_reviewed_by = p_user_id,
    receiving_overage_reviewed_at = now(),
    updated_at = now()
  WHERE id = p_dn_item_id
    AND company_id = p_company_id;
END;
$$;

COMMIT;
