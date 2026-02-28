-- ============================================================================
-- Migration: Add GRN Batch-Aware Approval RPC
-- Version: 20260224110000
-- Description: Replaces app-layer GRN approval inventory posting with a single
--              transactional RPC that updates item_warehouse, item_location,
--              item_batch, and item_location_batch.
-- Date: 2026-02-24
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.approve_grn_with_batch_inventory(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_grn grns%ROWTYPE;
  v_grn_item grn_items%ROWTYPE;
  v_item_uom_id UUID;
  v_now TIMESTAMP := NOW();
  v_tx_id UUID;
  v_tx_code TEXT;
  v_posting_date DATE;
  v_posting_time TIME;
  v_default_location_id UUID;
  v_generated_batch_code TEXT;
  v_batch_code TEXT;
  v_item_wh item_warehouse%ROWTYPE;
  v_item_batch item_batch%ROWTYPE;
  v_item_loc item_location%ROWTYPE;
  v_item_loc_batch item_location_batch%ROWTYPE;
  v_received_qty NUMERIC;
  v_damaged_qty NUMERIC;
  v_batch_received_at TIMESTAMP;
  v_boxes_total_qty NUMERIC;
  v_remainder_qty NUMERIC;
  v_has_items BOOLEAN := FALSE;
  v_line_location RECORD;
  v_item_wh_current_stock NUMERIC;
  v_item_wh_reserved_stock NUMERIC;
  v_item_wh_next_stock NUMERIC;
BEGIN
  SELECT *
  INTO v_grn
  FROM grns
  WHERE id = p_grn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;

  IF v_grn.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only GRNs in pending approval can be approved';
  END IF;

  v_posting_date := COALESCE(v_grn.receiving_date, CURRENT_DATE);
  v_posting_time := v_now::TIME;
  v_batch_received_at := v_posting_date::TIMESTAMP + v_posting_time;

  INSERT INTO warehouse_locations (
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
    v_grn.warehouse_id,
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
  RETURNING id INTO v_default_location_id;

  v_tx_code := 'ST-' || TO_CHAR(v_now, 'YYYYMMDDHH24MISSMS') ||
               SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 4);

  INSERT INTO stock_transactions (
    company_id,
    business_unit_id,
    transaction_code,
    transaction_type,
    transaction_date,
    warehouse_id,
    to_location_id,
    reference_type,
    reference_id,
    status,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    v_grn.business_unit_id,
    v_tx_code,
    'in',
    v_posting_date,
    v_grn.warehouse_id,
    v_default_location_id,
    'grn',
    v_grn.id,
    'posted',
    COALESCE(NULLIF(BTRIM(p_notes), ''), 'Auto-created from GRN ' || v_grn.grn_number),
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_tx_id;

  FOR v_grn_item IN
    SELECT gi.*
    FROM grn_items gi
    WHERE gi.grn_id = v_grn.id
    ORDER BY gi.created_at ASC, gi.id ASC
    FOR UPDATE
  LOOP
    v_has_items := TRUE;
    v_received_qty := COALESCE(v_grn_item.received_qty, 0);
    v_damaged_qty := COALESCE(v_grn_item.damaged_qty, 0);

    IF v_received_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT i.uom_id
    INTO v_item_uom_id
    FROM items i
    WHERE i.id = v_grn_item.item_id;

    IF v_item_uom_id IS NULL THEN
      RAISE EXCEPTION 'Item UOM not found for item %', v_grn_item.item_id;
    END IF;

    v_generated_batch_code := COALESCE(
      NULLIF(BTRIM(v_grn.batch_number), ''),
      'GRN-' || v_grn.grn_number || '-' || SUBSTRING(REPLACE(v_grn_item.id::TEXT, '-', ''), 1, 8)
    );
    v_batch_code := v_generated_batch_code;

    -- GRN rule: duplicate item+warehouse+batch_code is not allowed.
    PERFORM 1
    FROM item_batch ib_dup
    WHERE ib_dup.company_id = p_company_id
      AND ib_dup.item_id = v_grn_item.item_id
      AND ib_dup.warehouse_id = v_grn.warehouse_id
      AND ib_dup.batch_code = v_batch_code
      AND ib_dup.deleted_at IS NULL;

    IF FOUND THEN
      RAISE EXCEPTION 'Duplicate batch code % for item % in warehouse %',
        v_batch_code, v_grn_item.item_id, v_grn.warehouse_id;
    END IF;

    SELECT *
    INTO v_item_wh
    FROM item_warehouse
    WHERE company_id = p_company_id
      AND item_id = v_grn_item.item_id
      AND warehouse_id = v_grn.warehouse_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
      v_item_wh_current_stock := COALESCE(v_item_wh.current_stock, 0);
      v_item_wh_reserved_stock := COALESCE(v_item_wh.reserved_stock, 0);
      v_item_wh_next_stock := v_item_wh_current_stock + v_received_qty;

      UPDATE item_warehouse
      SET
        current_stock = v_item_wh_next_stock,
        in_transit = GREATEST(0, COALESCE(in_transit, 0) - v_received_qty),
        estimated_arrival_date = CASE
          WHEN GREATEST(0, COALESCE(in_transit, 0) - v_received_qty) > 0 THEN estimated_arrival_date
          ELSE NULL
        END,
        default_location_id = COALESCE(default_location_id, v_default_location_id),
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_item_wh.id;
    ELSE
      v_item_wh_current_stock := 0;
      v_item_wh_reserved_stock := 0;
      v_item_wh_next_stock := v_received_qty;

      INSERT INTO item_warehouse (
        company_id,
        item_id,
        warehouse_id,
        current_stock,
        reserved_stock,
        in_transit,
        estimated_arrival_date,
        default_location_id,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_grn_item.item_id,
        v_grn.warehouse_id,
        v_item_wh_next_stock,
        0,
        0,
        NULL,
        v_default_location_id,
        p_user_id,
        p_user_id
      );
    END IF;

    INSERT INTO item_batch (
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
      v_grn_item.item_id,
      v_grn.warehouse_id,
      v_batch_code,
      v_batch_received_at,
      v_received_qty,
      0,
      p_user_id,
      p_user_id
    )
    RETURNING * INTO v_item_batch;

    -- Post into item_location / item_location_batch using assigned box locations where available.
    v_boxes_total_qty := 0;

    FOR v_line_location IN
      SELECT
        gb.warehouse_location_id AS location_id,
        SUM(COALESCE(gb.qty_per_box, 0))::NUMERIC AS qty
      FROM grn_boxes gb
      WHERE gb.grn_item_id = v_grn_item.id
        AND gb.warehouse_location_id IS NOT NULL
      GROUP BY gb.warehouse_location_id
      ORDER BY gb.warehouse_location_id
    LOOP
      EXIT WHEN v_line_location.qty IS NULL OR v_line_location.qty <= 0;
      v_boxes_total_qty := v_boxes_total_qty + COALESCE(v_line_location.qty, 0);

      INSERT INTO item_location (
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
        v_grn_item.item_id,
        v_grn.warehouse_id,
        v_line_location.location_id,
        v_line_location.qty,
        0,
        p_user_id,
        p_user_id
      )
      ON CONFLICT (company_id, item_id, warehouse_id, location_id) DO UPDATE
      SET
        qty_on_hand = item_location.qty_on_hand + EXCLUDED.qty_on_hand,
        updated_by = EXCLUDED.updated_by,
        updated_at = v_now
      RETURNING * INTO v_item_loc;

      INSERT INTO item_location_batch (
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
        v_grn_item.item_id,
        v_grn.warehouse_id,
        v_line_location.location_id,
        v_item_batch.id,
        v_line_location.qty,
        0,
        p_user_id,
        p_user_id
      )
      ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE
      SET
        qty_on_hand = item_location_batch.qty_on_hand + EXCLUDED.qty_on_hand,
        updated_by = EXCLUDED.updated_by,
        updated_at = v_now;
    END LOOP;

    v_remainder_qty := GREATEST(0, v_received_qty - COALESCE(v_boxes_total_qty, 0));
    IF v_remainder_qty > 0 THEN
      INSERT INTO item_location (
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
        v_grn_item.item_id,
        v_grn.warehouse_id,
        COALESCE(v_item_wh.default_location_id, v_default_location_id),
        v_remainder_qty,
        0,
        p_user_id,
        p_user_id
      )
      ON CONFLICT (company_id, item_id, warehouse_id, location_id) DO UPDATE
      SET
        qty_on_hand = item_location.qty_on_hand + EXCLUDED.qty_on_hand,
        updated_by = EXCLUDED.updated_by,
        updated_at = v_now;

      INSERT INTO item_location_batch (
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
        v_grn_item.item_id,
        v_grn.warehouse_id,
        COALESCE(v_item_wh.default_location_id, v_default_location_id),
        v_item_batch.id,
        v_remainder_qty,
        0,
        p_user_id,
        p_user_id
      )
      ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE
      SET
        qty_on_hand = item_location_batch.qty_on_hand + EXCLUDED.qty_on_hand,
        updated_by = EXCLUDED.updated_by,
        updated_at = v_now;
    END IF;

    INSERT INTO stock_transaction_items (
      company_id,
      transaction_id,
      item_id,
      quantity,
      uom_id,
      batch_no,
      qty_before,
      qty_after,
      posting_date,
      posting_time,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_tx_id,
      v_grn_item.item_id,
      v_received_qty,
      v_item_uom_id,
      v_batch_code,
      v_item_wh_current_stock,
      v_item_wh_next_stock,
      v_posting_date,
      v_posting_time,
      CASE
        WHEN v_damaged_qty > 0 THEN 'GRN ' || v_grn.grn_number || ' (Damaged: ' || v_damaged_qty || ')'
        ELSE 'GRN ' || v_grn.grn_number
      END,
      p_user_id,
      p_user_id
    );
  END LOOP;

  IF NOT v_has_items THEN
    RAISE EXCEPTION 'GRN has no items';
  END IF;

  UPDATE grns
  SET
    status = 'approved',
    checked_by = p_user_id,
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = v_grn.id;

  UPDATE load_lists
  SET
    status = 'received',
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = v_grn.load_list_id;

  RETURN v_tx_code;
END;
$$;

COMMENT ON FUNCTION public.approve_grn_with_batch_inventory(UUID, UUID, UUID, TEXT) IS
  'Approves a GRN and posts inventory into warehouse/location/batch tables in one transaction.';

COMMIT;

