-- Run with psql -v ON_ERROR_STOP=1. All fixtures and changes roll back.
BEGIN;
DO $$
DECLARE
  v_company UUID; v_warehouse UUID; v_item UUID; v_batch UUID; v_stock UUID;
  v_root UUID; v_shelf UUID; v_bin UUID; v_crate UUID; v_other UUID;
  v_path TEXT; v_before NUMERIC; v_count INTEGER;
BEGIN
  SELECT company_id, warehouse_id, item_id, item_batch_id INTO v_company, v_warehouse, v_item, v_batch
  FROM public.item_batch_locations WHERE deleted_at IS NULL LIMIT 1;
  IF v_batch IS NULL THEN RAISE EXCEPTION 'TEST_REQUIRES_SEEDED_STOCK'; END IF;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, location_type, is_storable)
  VALUES(v_company, v_warehouse, '__TEST_ZONE', 'zone', false) RETURNING id INTO v_root;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, code, location_type, is_storable)
  VALUES(v_company, v_warehouse, v_root, '__TEST_SHELF', 'shelf', false) RETURNING id INTO v_shelf;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, code, location_type)
  VALUES(v_company, v_warehouse, v_shelf, '__TEST_BIN', 'bin') RETURNING id INTO v_bin;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, code, location_type)
  VALUES(v_company, v_warehouse, v_root, '__TEST_CRATE', 'crate') RETURNING id INTO v_crate;
  SELECT location_path INTO v_path FROM public.warehouse_locations WHERE id = v_bin;
  IF v_path <> '__TEST_ZONE / __TEST_SHELF / __TEST_BIN' THEN RAISE EXCEPTION 'PATH_FAILED: %', v_path; END IF;
  BEGIN
    UPDATE public.warehouse_locations SET path_ids = ARRAY[v_crate, v_bin] WHERE id = v_bin;
    RAISE EXCEPTION 'DERIVED_ADDRESS_TAMPERING_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'LOCATION_ADDRESS_READ_ONLY' THEN RAISE; END IF;
  END;
  UPDATE public.warehouse_locations SET name = 'Renamed' WHERE id = v_root;
  SELECT location_path INTO v_path FROM public.warehouse_locations WHERE id = v_bin;
  IF v_path <> '__TEST_ZONE - Renamed / __TEST_SHELF / __TEST_BIN' THEN RAISE EXCEPTION 'DESCENDANT_REFRESH_FAILED'; END IF;
  UPDATE public.warehouse_locations SET parent_id = v_root WHERE id = v_bin;
  IF (SELECT cardinality(path_ids) FROM public.warehouse_locations WHERE id = v_bin) <> 2 THEN RAISE EXCEPTION 'REPARENT_FAILED'; END IF;
  BEGIN
    UPDATE public.warehouse_locations SET parent_id = v_bin WHERE id = v_root;
    RAISE EXCEPTION 'CYCLE_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'LOCATION_HIERARCHY_CYCLE' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.warehouse_locations SET is_active = false WHERE id = v_root;
    RAISE EXCEPTION 'ACTIVE_CHILD_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'LOCATION_HAS_CHILDREN' THEN RAISE; END IF;
  END;
  INSERT INTO public.item_batch_locations(company_id, warehouse_id, item_id, item_batch_id, location_id, qty_on_hand)
  VALUES(v_company, v_warehouse, v_item, v_batch, v_bin, 10) RETURNING id INTO v_stock;
  BEGIN
    UPDATE public.warehouse_locations SET parent_id = v_crate WHERE id = v_bin;
    RAISE EXCEPTION 'STOCK_REPARENT_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'LOCATION_IN_USE' THEN RAISE; END IF;
  END;
  -- A failed later reservation must roll back the earlier stock write.
  UPDATE public.warehouse_locations SET is_pickable = false WHERE id = v_bin;
  SELECT qty_on_hand INTO v_before FROM public.item_batch_locations WHERE id = v_stock;
  BEGIN
    UPDATE public.item_batch_locations SET qty_on_hand = qty_on_hand + 5 WHERE id = v_stock;
    UPDATE public.item_batch_locations SET qty_reserved = 1 WHERE id = v_stock;
    RAISE EXCEPTION 'UNPICKABLE_SOURCE_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'LOCATION_PICKING_UNAVAILABLE' THEN RAISE; END IF;
  END;
  IF (SELECT qty_on_hand FROM public.item_batch_locations WHERE id = v_stock) <> v_before THEN
    RAISE EXCEPTION 'ROLLBACK_FAILED';
  END IF;
  UPDATE public.warehouse_locations SET is_pickable = true WHERE id = v_bin;
  UPDATE public.item_batch_locations SET qty_reserved = 2 WHERE id = v_stock;
  BEGIN
    UPDATE public.warehouse_locations SET is_pickable = false WHERE id = v_bin;
    RAISE EXCEPTION 'RESERVED_LOCATION_NOT_PROTECTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'LOCATION_IN_USE' THEN RAISE; END IF;
  END;
  UPDATE public.warehouse_locations SET is_pickable = false WHERE id = v_root;
  SELECT COUNT(*) INTO v_count FROM public.warehouse_locations WHERE path_ids @> ARRAY[v_root] AND deleted_at IS NULL;
  IF v_count <> 4 THEN RAISE EXCEPTION 'SUBTREE_SCOPE_FAILED'; END IF;
  SELECT id INTO v_other FROM public.warehouses WHERE company_id = v_company AND id <> v_warehouse AND deleted_at IS NULL LIMIT 1;
  IF v_other IS NOT NULL THEN
    BEGIN
      INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, parent_id)
      VALUES(v_company, v_other, '__TEST_CROSS_WAREHOUSE', v_root);
      RAISE EXCEPTION 'CROSS_WAREHOUSE_NOT_REJECTED';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'LOCATION_PARENT_INVALID' THEN RAISE; END IF;
    END;
  END IF;
  RAISE NOTICE 'PASS: mixed levels, skipped levels, paths, subtree updates, cycle/scope checks, reservations, rollback';
END $$;
ROLLBACK;
