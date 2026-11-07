-- Run with psql -v ON_ERROR_STOP=1. All fixtures and changes roll back.
BEGIN;
DO $$
DECLARE
  v_company UUID; v_warehouse UUID; v_bu UUID; v_item UUID; v_batch UUID; v_user UUID;
  v_zone UUID; v_shelf UUID; v_bin UUID; v_crate UUID; v_stock UUID;
  v_detail RECORD; v_count INTEGER;
BEGIN
  SELECT stock.company_id, stock.warehouse_id, w.business_unit_id, stock.item_id, stock.item_batch_id
  INTO v_company, v_warehouse, v_bu, v_item, v_batch
  FROM public.item_batch_locations stock JOIN public.warehouses w ON w.id = stock.warehouse_id
  WHERE stock.deleted_at IS NULL AND w.is_active LIMIT 1;
  IF v_batch IS NULL THEN RAISE EXCEPTION 'TEST_REQUIRES_SEEDED_STOCK'; END IF;
  SELECT u.id INTO v_user FROM public.users u
  WHERE u.company_id = v_company AND u.is_active
    AND public.user_has_permission(u.id, 'manage_locations', 'view', v_bu)
    AND EXISTS (SELECT 1 FROM public.user_business_unit_access a WHERE a.user_id = u.id AND a.business_unit_id = v_bu)
  LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'TEST_REQUIRES_AUTHORIZED_SEED_USER'; END IF;

  INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, location_type, is_storable)
    VALUES(v_company, v_warehouse, '__DETAIL_ZONE', 'zone', false) RETURNING id INTO v_zone;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, code, location_type, is_storable)
    VALUES(v_company, v_warehouse, v_zone, '__DETAIL_SHELF', 'shelf', false) RETURNING id INTO v_shelf;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, code, name, location_type)
    VALUES(v_company, v_warehouse, v_shelf, '__DETAIL_BIN', 'Bin 1', 'bin') RETURNING id INTO v_bin;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, code, location_type, is_active)
    VALUES(v_company, v_warehouse, v_zone, '__DETAIL_CRATE', 'crate', false) RETURNING id INTO v_crate;
  INSERT INTO public.item_batch_locations(company_id, warehouse_id, item_id, item_batch_id, location_id, qty_on_hand)
    VALUES(v_company, v_warehouse, v_item, v_batch, v_bin, 10) RETURNING id INTO v_stock;
  UPDATE public.item_batch_locations SET qty_reserved = 2 WHERE id = v_stock;

  PERFORM set_config('request.jwt.claim.sub', v_user::TEXT, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user, 'role', 'authenticated')::TEXT, true);
  SET LOCAL ROLE authenticated;

  SELECT * INTO v_detail FROM public.get_warehouse_location_detail(v_bu, v_zone);
  IF v_detail.id IS DISTINCT FROM v_zone OR v_detail.ancestors <> '[]'::jsonb
     OR v_detail.child_count <> 2 OR v_detail.active_child_count <> 1 OR v_detail.descendant_count <> 3
     OR v_detail.direct_on_hand <> 0 OR v_detail.subtree_on_hand <> 10 OR v_detail.subtree_reserved <> 2
     OR v_detail.stocked_location_count <> 1 OR v_detail.subtree_pending_putaway <> 0 THEN
    RAISE EXCEPTION 'ZONE_DETAIL_FAILED: %', row_to_json(v_detail);
  END IF;

  SELECT * INTO v_detail FROM public.get_warehouse_location_detail(v_bu, v_bin);
  IF jsonb_array_length(v_detail.ancestors) <> 2
     OR v_detail.ancestors->0->>'code' <> '__DETAIL_ZONE' OR v_detail.ancestors->1->>'code' <> '__DETAIL_SHELF'
     OR v_detail.location_path <> '__DETAIL_ZONE / __DETAIL_SHELF / __DETAIL_BIN - Bin 1'
     OR v_detail.direct_on_hand <> 10 OR v_detail.direct_reserved <> 2 OR v_detail.descendant_count <> 0 THEN
    RAISE EXCEPTION 'BIN_DETAIL_FAILED: %', row_to_json(v_detail);
  END IF;

  -- Branch search returns descendants only, never the scope itself or other branches.
  SELECT COUNT(*) INTO v_count
  FROM public.get_warehouse_location_capacities(v_bu, v_warehouse, 1, 100, NULL, false, '__DETAIL', v_zone);
  IF v_count <> 3 THEN RAISE EXCEPTION 'SCOPED_SEARCH_FAILED: %', v_count; END IF;
  SELECT COUNT(*) INTO v_count
  FROM public.get_warehouse_location_capacities(v_bu, v_warehouse, 1, 100, NULL, false, '__DETAIL', v_shelf);
  IF v_count <> 1 THEN RAISE EXCEPTION 'NESTED_SCOPED_SEARCH_FAILED: %', v_count; END IF;

  -- The counts that block a move must agree with the trigger that enforces it.
  RESET ROLE;
  BEGIN
    UPDATE public.warehouse_locations SET parent_id = NULL WHERE id = v_shelf;
    RAISE EXCEPTION 'STOCKED_BRANCH_MOVE_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'LOCATION_IN_USE' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::TEXT, true);
  PERFORM set_config('request.jwt.claims', '{}'::TEXT, true);
  SET LOCAL ROLE authenticated;
  SELECT COUNT(*) INTO v_count FROM public.get_warehouse_location_detail(v_bu, v_zone);
  IF v_count <> 0 THEN RAISE EXCEPTION 'UNAUTHORIZED_DETAIL_VISIBLE'; END IF;
  RESET ROLE;
  RAISE NOTICE 'PASS: location detail ancestors, subtree counts, scoped search, move gate parity, unauthorized read';
END $$;
ROLLBACK;
