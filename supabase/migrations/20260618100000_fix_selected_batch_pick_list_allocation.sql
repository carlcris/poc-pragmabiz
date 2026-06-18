BEGIN;

DO $$
DECLARE
  v_definition TEXT;
  v_selected_batch_branch TEXT := $selected_batch_branch$
    IF v_selected_item_batch_id IS NOT NULL THEN
      SELECT COALESCE(SUM(FLOOR(source_rows.available_base_qty / v_qty_per_unit)), 0)
      INTO v_total_available_qty
      FROM (
        SELECT GREATEST(
          0,
          LEAST(
            COALESCE(ilb.qty_on_hand, 0) - COALESCE(ilb.qty_reserved, 0),
            COALESCE(ib.qty_on_hand, 0) - COALESCE(ib.qty_reserved, 0)
          )
        ) AS available_base_qty
        FROM public.item_batch_locations ilb
        JOIN public.item_batches ib
          ON ib.id = ilb.item_batch_id
         AND ib.company_id = ilb.company_id
         AND ib.deleted_at IS NULL
        WHERE ilb.company_id = p_company_id
          AND ilb.item_id = v_dni.item_id
          AND ilb.warehouse_id = v_dni.fulfilling_warehouse_id
          AND ilb.deleted_at IS NULL
          AND ib.id = v_selected_item_batch_id
      ) source_rows;

      IF v_total_available_qty < v_outstanding_qty THEN
        RAISE EXCEPTION 'PICK_ALLOCATION_INSUFFICIENT_BATCH_QUANTITY';
      END IF;

      v_remaining_qty := v_outstanding_qty;

      FOR v_source IN
        SELECT
          ilb.id AS batch_location_id,
          ilb.location_id,
          ilb.batch_location_sku,
          ib.id AS item_batch_id,
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
        WHERE ilb.company_id = p_company_id
          AND ilb.item_id = v_dni.item_id
          AND ilb.warehouse_id = v_dni.fulfilling_warehouse_id
          AND ilb.deleted_at IS NULL
          AND ib.id = v_selected_item_batch_id
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
          p_company_id,
          v_pick_list_id,
          v_dni.id,
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

      IF v_remaining_qty > 0 THEN
        RAISE EXCEPTION 'PICK_ALLOCATION_INSUFFICIENT_BATCH_QUANTITY';
      END IF;

      CONTINUE;
    END IF;
$selected_batch_branch$;
BEGIN
  SELECT pg_get_functiondef(
    'public.create_pick_list_with_allocation(UUID, UUID, UUID, UUID[], TEXT, UUID, TEXT)'::REGPROCEDURE
  )
  INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'create_pick_list_with_allocation function is missing';
  END IF;

  IF v_definition NOT LIKE '%v_selected_item_batch_id UUID;%' THEN
    v_definition := regexp_replace(
      v_definition,
      E'(\\n\\s*v_source RECORD;)',
      E'\\1\n  v_selected_item_batch_id UUID;',
      'n'
    );
  END IF;

  IF v_definition NOT LIKE '%SELECT sri.selected_item_batch_id%' THEN
    v_definition := replace(
      v_definition,
      $needle$
    v_required_base_qty := v_outstanding_qty * v_qty_per_unit;

    SELECT
$needle$,
      $replacement$
    v_required_base_qty := v_outstanding_qty * v_qty_per_unit;
    v_selected_item_batch_id := NULL;

    SELECT sri.selected_item_batch_id
    INTO v_selected_item_batch_id
    FROM public.stock_request_items sri
    WHERE sri.id = v_dni.sr_item_id;

    SELECT
$replacement$
    );
  END IF;

  IF v_definition NOT LIKE '%IF v_selected_item_batch_id IS NOT NULL THEN%' THEN
    v_definition := replace(
      v_definition,
      $needle$
    SELECT
      ilb.id AS batch_location_id,
$needle$,
      v_selected_batch_branch || $replacement$

    SELECT
      ilb.id AS batch_location_id,
$replacement$
    );
  END IF;

  IF v_definition NOT LIKE '%v_selected_item_batch_id UUID;%'
     OR v_definition NOT LIKE '%IF v_selected_item_batch_id IS NOT NULL THEN%' THEN
    RAISE EXCEPTION 'Failed to patch create_pick_list_with_allocation selected batch allocation';
  END IF;

  EXECUTE v_definition;
END $$;

COMMIT;
