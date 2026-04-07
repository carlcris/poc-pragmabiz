CREATE OR REPLACE FUNCTION public.recalculate_stock_requisition_fulfillment_for_load_list(
  p_company_id UUID,
  p_load_list_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  WITH affected_sr_items AS (
    SELECT DISTINCT llsi.sr_item_id
    FROM public.load_list_sr_items llsi
    JOIN public.load_list_items lli
      ON lli.id = llsi.load_list_item_id
    JOIN public.stock_requisition_items sri
      ON sri.id = llsi.sr_item_id
    JOIN public.stock_requisitions sr
      ON sr.id = sri.sr_id
    WHERE lli.load_list_id = p_load_list_id
      AND sr.company_id = p_company_id
  ),
  approved_load_list_actuals AS (
    SELECT
      gi.load_list_item_id,
      SUM(COALESCE(gi.received_qty, 0) + COALESCE(gi.damaged_qty, 0))::NUMERIC AS accounted_qty
    FROM public.grn_items gi
    JOIN public.grns g
      ON g.id = gi.grn_id
    WHERE gi.load_list_item_id IS NOT NULL
      AND g.company_id = p_company_id
      AND g.status = 'approved'
      AND g.deleted_at IS NULL
    GROUP BY gi.load_list_item_id
  ),
  distributed_link_fulfillment AS (
    SELECT
      llsi.sr_item_id,
      GREATEST(
        LEAST(
          COALESCE(llsi.fulfilled_qty, 0),
          COALESCE(ala.accounted_qty, 0) -
            COALESCE(
              SUM(COALESCE(llsi.fulfilled_qty, 0)) OVER (
                PARTITION BY llsi.load_list_item_id
                ORDER BY llsi.created_at, llsi.id
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            )
        ),
        0
      ) AS actual_fulfilled_qty
    FROM public.load_list_sr_items llsi
    JOIN affected_sr_items asi
      ON asi.sr_item_id = llsi.sr_item_id
    LEFT JOIN approved_load_list_actuals ala
      ON ala.load_list_item_id = llsi.load_list_item_id
  ),
  aggregated_sr_fulfillment AS (
    SELECT
      asi.sr_item_id,
      COALESCE(SUM(dlf.actual_fulfilled_qty), 0)::NUMERIC AS fulfilled_qty
    FROM affected_sr_items asi
    LEFT JOIN distributed_link_fulfillment dlf
      ON dlf.sr_item_id = asi.sr_item_id
    GROUP BY asi.sr_item_id
  )
  UPDATE public.stock_requisition_items sri
  SET fulfilled_qty = agg.fulfilled_qty
  FROM aggregated_sr_fulfillment agg
  WHERE sri.id = agg.sr_item_id;

  WITH affected_srs AS (
    SELECT DISTINCT sri.sr_id
    FROM public.stock_requisition_items sri
    WHERE sri.id IN (
      SELECT sr_item_id FROM public.load_list_sr_items llsi
      JOIN public.load_list_items lli
        ON lli.id = llsi.load_list_item_id
      WHERE lli.load_list_id = p_load_list_id
    )
  ),
  sr_status AS (
    SELECT
      sri.sr_id,
      BOOL_AND(COALESCE(sri.fulfilled_qty, 0) >= COALESCE(sri.requested_qty, 0)) AS all_fulfilled,
      BOOL_OR(COALESCE(sri.fulfilled_qty, 0) > 0) AS any_fulfilled
    FROM public.stock_requisition_items sri
    WHERE sri.sr_id IN (SELECT sr_id FROM affected_srs)
    GROUP BY sri.sr_id
  )
  UPDATE public.stock_requisitions sr
  SET status = CASE
    WHEN sr.status = 'draft' THEN sr.status
    WHEN ss.all_fulfilled THEN 'fulfilled'
    WHEN ss.any_fulfilled THEN 'partially_fulfilled'
    ELSE 'submitted'
  END
  FROM sr_status ss
  WHERE sr.id = ss.sr_id
    AND sr.company_id = p_company_id
    AND sr.status <> 'cancelled';
END;
$$;

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
  v_received_base_qty NUMERIC;
  v_expected_base_qty NUMERIC;
  v_damaged_qty NUMERIC;
  v_qty_per_unit NUMERIC;
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

  INSERT INTO stock_transactions (
    company_id,
    business_unit_id,
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
  RETURNING id, transaction_code INTO v_tx_id, v_tx_code;

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

    SELECT COALESCE(iuo.qty_per_unit, 1)
    INTO v_qty_per_unit
    FROM item_unit_options iuo
    WHERE iuo.id = v_grn_item.item_unit_option_id;

    v_qty_per_unit := COALESCE(v_qty_per_unit, 1);
    v_expected_base_qty := COALESCE(v_grn_item.load_list_qty, 0) * v_qty_per_unit;
    v_received_base_qty := v_received_qty * v_qty_per_unit;

    IF v_received_qty <= 0 THEN
      UPDATE item_warehouse
      SET
        in_transit = GREATEST(0, COALESCE(in_transit, 0) - v_expected_base_qty),
        estimated_arrival_date = CASE
          WHEN GREATEST(0, COALESCE(in_transit, 0) - v_expected_base_qty) > 0 THEN estimated_arrival_date
          ELSE NULL
        END,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE company_id = p_company_id
        AND item_id = v_grn_item.item_id
        AND warehouse_id = v_grn.warehouse_id
        AND deleted_at IS NULL;

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
      v_item_wh_next_stock := v_item_wh_current_stock + v_received_base_qty;

      UPDATE item_warehouse
      SET
        current_stock = v_item_wh_next_stock,
        in_transit = GREATEST(0, COALESCE(in_transit, 0) - v_expected_base_qty),
        estimated_arrival_date = CASE
          WHEN GREATEST(0, COALESCE(in_transit, 0) - v_expected_base_qty) > 0 THEN estimated_arrival_date
          ELSE NULL
        END,
        default_location_id = COALESCE(default_location_id, v_default_location_id),
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_item_wh.id;
    ELSE
      v_item_wh_current_stock := 0;
      v_item_wh_reserved_stock := 0;
      v_item_wh_next_stock := v_received_base_qty;

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
      v_received_base_qty,
      0,
      p_user_id,
      p_user_id
    )
    RETURNING * INTO v_item_batch;

    v_boxes_total_qty := 0;

    FOR v_line_location IN
      SELECT
        gb.warehouse_location_id AS location_id,
        MIN(NULLIF(BTRIM(gb.batch_location_sku), '')) AS batch_location_sku,
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
        batch_location_sku,
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
        NULLIF(BTRIM(v_line_location.batch_location_sku::TEXT), ''),
        v_line_location.qty,
        0,
        p_user_id,
        p_user_id
      )
      ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE
      SET
        qty_on_hand = item_location_batch.qty_on_hand + EXCLUDED.qty_on_hand,
        batch_location_sku = COALESCE(item_location_batch.batch_location_sku, EXCLUDED.batch_location_sku),
        updated_by = EXCLUDED.updated_by,
        updated_at = v_now
      RETURNING * INTO v_item_loc_batch;

      UPDATE grn_boxes
      SET
        batch_location_sku = v_item_loc_batch.batch_location_sku
      WHERE grn_item_id = v_grn_item.id
        AND warehouse_location_id = v_line_location.location_id;
    END LOOP;

    v_remainder_qty := GREATEST(0, v_received_base_qty - COALESCE(v_boxes_total_qty, 0));
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
      v_received_base_qty,
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

  IF v_grn.load_list_id IS NOT NULL THEN
    PERFORM public.recalculate_stock_requisition_fulfillment_for_load_list(
      p_company_id,
      v_grn.load_list_id
    );
  END IF;

  UPDATE load_lists
  SET
    status = 'received',
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = v_grn.load_list_id;

  RETURN v_tx_code;
END;
$$;
