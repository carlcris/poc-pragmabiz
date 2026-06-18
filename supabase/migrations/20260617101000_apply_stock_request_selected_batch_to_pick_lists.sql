BEGIN;

DO $$
DECLARE
  v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.create_pick_list_with_allocation(UUID, UUID, UUID, UUID[], TEXT, UUID, TEXT)'::REGPROCEDURE
  )
  INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'create_pick_list_with_allocation function is missing';
  END IF;

  IF v_definition NOT LIKE '%v_selected_item_batch_id%' THEN
    v_definition := replace(
      v_definition,
      E'  v_source RECORD;\nBEGIN',
      E'  v_source RECORD;\n  v_selected_item_batch_id UUID;\nBEGIN'
    );

    v_definition := replace(
      v_definition,
      E'    v_required_base_qty := v_outstanding_qty * v_qty_per_unit;\n\n    SELECT\n',
      E'    v_required_base_qty := v_outstanding_qty * v_qty_per_unit;\n    v_selected_item_batch_id := NULL;\n\n    SELECT sri.selected_item_batch_id\n    INTO v_selected_item_batch_id\n    FROM public.stock_request_items sri\n    WHERE sri.id = v_dni.sr_item_id;\n\n    SELECT\n'
    );

    v_definition := replace(
      v_definition,
      E'      AND ilb.deleted_at IS NULL\n      AND GREATEST(',
      E'      AND ilb.deleted_at IS NULL\n      AND (v_selected_item_batch_id IS NULL OR ib.id = v_selected_item_batch_id)\n      AND GREATEST('
    );

    v_definition := replace(
      v_definition,
      E'          AND ilb.deleted_at IS NULL\n      ) source_rows;',
      E'          AND ilb.deleted_at IS NULL\n          AND (v_selected_item_batch_id IS NULL OR ib.id = v_selected_item_batch_id)\n      ) source_rows;'
    );

    v_definition := replace(
      v_definition,
      E'          AND ilb.deleted_at IS NULL\n          AND FLOOR(',
      E'          AND ilb.deleted_at IS NULL\n          AND (v_selected_item_batch_id IS NULL OR ib.id = v_selected_item_batch_id)\n          AND FLOOR('
    );

    EXECUTE v_definition;
  END IF;
END $$;

COMMIT;
