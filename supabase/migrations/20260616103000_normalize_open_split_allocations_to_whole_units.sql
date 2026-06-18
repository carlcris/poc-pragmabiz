BEGIN;

DO $$
DECLARE
  v_group RECORD;
  v_dni RECORD;
  v_qty_per_unit NUMERIC;
  v_total_available_qty NUMERIC;
  v_remaining_qty NUMERIC;
  v_take_qty NUMERIC;
  v_source RECORD;
  v_selected_item_batch_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  FOR v_group IN
    SELECT
      pl.company_id,
      pl.id AS pick_list_id,
      pli.dn_item_id,
      SUM(COALESCE(pli.allocated_qty, 0)) AS allocated_qty
    FROM public.pick_lists pl
    JOIN public.pick_list_items pli
      ON pli.pick_list_id = pl.id
     AND pli.company_id = pl.company_id
    WHERE pl.deleted_at IS NULL
      AND pl.status IN ('pending', 'in_progress', 'paused')
      AND NOT EXISTS (
        SELECT 1
        FROM public.delivery_note_item_picks dip
        WHERE dip.company_id = pl.company_id
          AND dip.pick_list_id = pl.id
          AND dip.deleted_at IS NULL
      )
    GROUP BY pl.company_id, pl.id, pli.dn_item_id
    HAVING BOOL_OR(COALESCE(pli.allocated_qty, 0) <> FLOOR(COALESCE(pli.allocated_qty, 0)))
      AND COALESCE(SUM(pli.picked_qty), 0) = 0
  LOOP
    SELECT
      dni.*,
      GREATEST(COALESCE(iuo.qty_per_unit, 1), 1) AS qty_per_unit
    INTO v_dni
    FROM public.delivery_note_items dni
    LEFT JOIN public.item_unit_options iuo
      ON iuo.id = dni.item_unit_option_id
     AND iuo.company_id = dni.company_id
     AND iuo.deleted_at IS NULL
    WHERE dni.company_id = v_group.company_id
      AND dni.id = v_group.dn_item_id
      AND dni.is_voided = FALSE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_qty_per_unit := GREATEST(COALESCE(v_dni.qty_per_unit, 1), 1);
    v_selected_item_batch_id := NULL;

    SELECT sri.selected_item_batch_id
    INTO v_selected_item_batch_id
    FROM public.stock_request_items sri
    WHERE sri.id = v_dni.sr_item_id;

    SELECT COALESCE(SUM(source_rows.available_qty), 0)
    INTO v_total_available_qty
    FROM (
      SELECT FLOOR(
        GREATEST(
          0,
          LEAST(
            COALESCE(ilb.qty_on_hand, 0) - COALESCE(ilb.qty_reserved, 0),
            COALESCE(ib.qty_on_hand, 0) - COALESCE(ib.qty_reserved, 0)
          )
        ) / v_qty_per_unit
      ) AS available_qty
      FROM public.item_batch_locations ilb
      JOIN public.item_batches ib
        ON ib.id = ilb.item_batch_id
       AND ib.company_id = ilb.company_id
       AND ib.deleted_at IS NULL
      WHERE ilb.company_id = v_group.company_id
        AND ilb.item_id = v_dni.item_id
        AND ilb.warehouse_id = v_dni.fulfilling_warehouse_id
        AND ilb.deleted_at IS NULL
        AND (v_selected_item_batch_id IS NULL OR ib.id = v_selected_item_batch_id)
    ) source_rows;

    IF v_total_available_qty < v_group.allocated_qty THEN
      CONTINUE;
    END IF;

    DELETE FROM public.pick_list_items
    WHERE company_id = v_group.company_id
      AND pick_list_id = v_group.pick_list_id
      AND dn_item_id = v_group.dn_item_id;

    v_remaining_qty := v_group.allocated_qty;

    FOR v_source IN
      SELECT
        ilb.location_id,
        ilb.batch_location_sku,
        ib.batch_code,
        ib.received_at,
        FLOOR(
          GREATEST(
            0,
            LEAST(
              COALESCE(ilb.qty_on_hand, 0) - COALESCE(ilb.qty_reserved, 0),
              COALESCE(ib.qty_on_hand, 0) - COALESCE(ib.qty_reserved, 0)
            )
          ) / v_qty_per_unit
        ) AS available_qty
      FROM public.item_batch_locations ilb
      JOIN public.item_batches ib
        ON ib.id = ilb.item_batch_id
       AND ib.company_id = ilb.company_id
       AND ib.deleted_at IS NULL
      WHERE ilb.company_id = v_group.company_id
        AND ilb.item_id = v_dni.item_id
        AND ilb.warehouse_id = v_dni.fulfilling_warehouse_id
        AND ilb.deleted_at IS NULL
        AND (v_selected_item_batch_id IS NULL OR ib.id = v_selected_item_batch_id)
        AND FLOOR(
          GREATEST(
            0,
            LEAST(
              COALESCE(ilb.qty_on_hand, 0) - COALESCE(ilb.qty_reserved, 0),
              COALESCE(ib.qty_on_hand, 0) - COALESCE(ib.qty_reserved, 0)
            )
          ) / v_qty_per_unit
        ) > 0
      ORDER BY ib.received_at ASC, ilb.created_at ASC, ilb.id ASC
    LOOP
      EXIT WHEN v_remaining_qty <= 0;

      v_take_qty := LEAST(v_remaining_qty, v_source.available_qty);
      IF v_take_qty <= 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO public.pick_list_items (
        company_id,
        pick_list_id,
        dn_item_id,
        sr_id,
        sr_item_id,
        item_id,
        item_unit_option_id,
        uom_id,
        allocated_qty,
        picked_qty,
        short_qty,
        suggested_pick_location_id,
        suggested_pick_batch_code,
        suggested_pick_batch_received_at,
        suggested_batch_location_sku,
        created_at,
        updated_at
      )
      VALUES (
        v_group.company_id,
        v_group.pick_list_id,
        v_group.dn_item_id,
        v_dni.sr_id,
        v_dni.sr_item_id,
        v_dni.item_id,
        v_dni.item_unit_option_id,
        v_dni.uom_id,
        v_take_qty,
        0,
        v_take_qty,
        v_source.location_id,
        v_source.batch_code,
        v_source.received_at,
        v_source.batch_location_sku,
        v_now,
        v_now
      );

      v_remaining_qty := v_remaining_qty - v_take_qty;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
