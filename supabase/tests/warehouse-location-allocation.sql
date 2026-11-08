BEGIN;
DO $$
DECLARE
  v_company UUID; v_warehouse UUID; v_bu UUID; v_request_bu UUID; v_item UUID; v_uom UUID; v_option UUID; v_user UUID;
  v_zone UUID; v_shelf UUID; v_bin UUID; v_crate UUID; v_blocked UUID;
  v_batch_old UUID; v_batch_new UUID; v_sr UUID; v_sr_line UUID; v_dn UUID; v_dn_line UUID;
  v_pick UUID; v_line UUID; v_spare UUID; v_sku TEXT; v_spare_sku TEXT; v_result JSONB; v_count INTEGER; v_qty NUMERIC; v_pick_count INTEGER;
BEGIN
  SELECT stock.company_id, stock.warehouse_id, w.business_unit_id, stock.item_id, i.uom_id
  INTO v_company, v_warehouse, v_bu, v_item, v_uom
  FROM public.item_batch_locations stock JOIN public.warehouses w ON w.id = stock.warehouse_id
  JOIN public.items i ON i.id = stock.item_id WHERE stock.deleted_at IS NULL AND w.is_active LIMIT 1;
  SELECT u.id INTO v_user FROM public.users u
  WHERE u.company_id = v_company AND u.is_active
    AND public.user_has_permission(u.id, 'stock_requests', 'edit', v_bu)
    AND EXISTS (SELECT 1 FROM public.user_business_unit_access a WHERE a.user_id = u.id AND a.business_unit_id = v_bu)
  LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'TEST_REQUIRES_AUTHORIZED_SEED_USER'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_user::TEXT, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user, 'role', 'authenticated', 'current_business_unit_id', v_bu)::TEXT, true);
  SELECT id INTO v_option FROM public.item_unit_options
  WHERE item_id = v_item AND is_active AND is_base AND deleted_at IS NULL LIMIT 1;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, location_type, is_storable)
    VALUES(v_company, v_warehouse, '__ALLOC_ZONE', 'zone', false) RETURNING id INTO v_zone;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, parent_id, location_type, is_storable)
    VALUES(v_company, v_warehouse, '__ALLOC_SHELF', v_zone, 'shelf', false) RETURNING id INTO v_shelf;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, parent_id, location_type)
    VALUES(v_company, v_warehouse, '__ALLOC_BIN', v_shelf, 'bin') RETURNING id INTO v_bin;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, parent_id, location_type)
    VALUES(v_company, v_warehouse, '__ALLOC_CRATE', v_zone, 'crate') RETURNING id INTO v_crate;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, parent_id, location_type, is_pickable)
    VALUES(v_company, v_warehouse, '__ALLOC_BLOCKED', v_zone, 'bin', false) RETURNING id INTO v_blocked;
  INSERT INTO public.item_batches(company_id, warehouse_id, item_id, batch_code, received_at, qty_on_hand)
    VALUES(v_company, v_warehouse, v_item, '__ALLOC_OLD', '2020-01-01', 107) RETURNING id INTO v_batch_old;
  INSERT INTO public.item_batches(company_id, warehouse_id, item_id, batch_code, received_at, qty_on_hand)
    VALUES(v_company, v_warehouse, v_item, '__ALLOC_NEW', '2021-01-01', 8) RETURNING id INTO v_batch_new;
  INSERT INTO public.item_batch_locations(company_id, warehouse_id, item_id, item_batch_id, location_id, qty_on_hand)
    VALUES (v_company, v_warehouse, v_item, v_batch_old, v_bin, 4),
           (v_company, v_warehouse, v_item, v_batch_old, v_crate, 3),
           (v_company, v_warehouse, v_item, v_batch_old, v_blocked, 100),
           (v_company, v_warehouse, v_item, v_batch_new, v_crate, 8);
  SELECT id INTO v_request_bu FROM public.business_units WHERE company_id = v_company AND id <> v_bu LIMIT 1;
  INSERT INTO public.stock_requests(company_id, business_unit_id, fulfilling_business_unit_id, required_date, requested_by_user_id, created_by)
    VALUES(v_company, v_request_bu, v_bu, CURRENT_DATE, v_user, v_user) RETURNING id INTO v_sr;
  INSERT INTO public.stock_request_items(stock_request_id, item_id, requested_qty, uom_id, item_unit_option_id)
    VALUES(v_sr, v_item, 10, v_uom, v_option) RETURNING id INTO v_sr_line;
  INSERT INTO public.delivery_notes(company_id, business_unit_id, requesting_business_unit_id, fulfilling_business_unit_id,
    fulfilling_warehouse_id, status, created_by)
    VALUES(v_company, v_bu, v_request_bu, v_bu, v_warehouse, 'confirmed', v_user) RETURNING id INTO v_dn;
  INSERT INTO public.delivery_note_items(company_id, dn_id, sr_id, sr_item_id, item_id, uom_id,
    item_unit_option_id, allocated_qty, short_qty, fulfilling_warehouse_id)
    VALUES(v_company, v_dn, v_sr, v_sr_line, v_item, v_uom, v_option, 10, 10, v_warehouse) RETURNING id INTO v_dn_line;
  SELECT COUNT(*) INTO v_pick_count FROM public.pick_lists WHERE dn_id = v_dn;
  SET LOCAL ROLE authenticated;
  -- Scope is too narrow: function already inserted header/assignees before failing.
  BEGIN
    PERFORM public.create_pick_list_with_allocation(v_company, v_user, v_dn, ARRAY[v_user], NULL, v_bu, 'split', v_bin);
    RAISE EXCEPTION 'INSUFFICIENT_SCOPE_NOT_REJECTED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'PICK_ALLOCATION_INSUFFICIENT_BATCH_QUANTITY' THEN RAISE; END IF;
  END;
  IF (SELECT COUNT(*) FROM public.pick_lists WHERE dn_id = v_dn) <> v_pick_count THEN RAISE EXCEPTION 'PICK_HEADER_ROLLBACK_FAILED'; END IF;
  IF EXISTS (SELECT 1 FROM public.item_batch_locations WHERE location_id IN(v_bin,v_crate,v_blocked) AND qty_reserved > 0) THEN RAISE EXCEPTION 'RESERVATION_ROLLBACK_FAILED'; END IF;
  v_result := public.create_pick_list_with_allocation(v_company, v_user, v_dn, ARRAY[v_user], NULL, v_bu, 'split', v_zone);
  v_pick := (v_result->>'pickListId')::UUID;
  SELECT COUNT(*), SUM(allocated_qty) INTO v_count, v_qty FROM public.pick_list_items WHERE pick_list_id = v_pick;
  IF v_count <> 3 OR v_qty <> 10 THEN RAISE EXCEPTION 'SPLIT_FAILED: %, %', v_count, v_qty; END IF;
  IF (SELECT SUM(qty_reserved) FROM public.item_batch_locations WHERE item_batch_id = v_batch_old AND location_id IN(v_bin,v_crate)) <> 7 THEN RAISE EXCEPTION 'FIFO_FAILED'; END IF;
  IF (SELECT qty_reserved FROM public.item_batch_locations WHERE item_batch_id = v_batch_new AND location_id = v_crate) <> 3 THEN RAISE EXCEPTION 'NEW_BATCH_REMAINDER_FAILED'; END IF;
  IF (SELECT qty_reserved FROM public.item_batch_locations WHERE location_id = v_blocked) <> 0 THEN RAISE EXCEPTION 'NON_PICKABLE_ALLOCATED'; END IF;
  IF (SELECT SUM(active_quantity_base) FROM public.inventory_reservation_allocations WHERE pick_list_id = v_pick) <> 10 THEN RAISE EXCEPTION 'LEDGER_FAILED'; END IF;
  RESET ROLE;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, location_type)
    VALUES(v_company, v_warehouse, '__ALT_SHELF', 'shelf') RETURNING id INTO v_spare;
  INSERT INTO public.item_batch_locations(company_id, warehouse_id, item_id, item_batch_id, location_id, qty_on_hand)
    VALUES(v_company, v_warehouse, v_item, v_batch_old, v_spare, 2) RETURNING batch_location_sku INTO v_spare_sku;
  UPDATE public.item_batches SET qty_on_hand=qty_on_hand+2 WHERE id=v_batch_old;
  UPDATE public.pick_lists SET status='in_progress' WHERE id=v_pick;
  INSERT INTO public.settings(company_id, business_unit_id, group_key, setting_key, value)
    VALUES(v_company, v_bu, 'inventory', 'picking_validation_policy', '"batch_and_rack"'::JSONB)
    ON CONFLICT(company_id,business_unit_id,group_key,setting_key) WHERE business_unit_id IS NOT NULL
    DO UPDATE SET value=EXCLUDED.value;
  SET LOCAL ROLE authenticated;
  SELECT id, suggested_batch_location_sku INTO v_line, v_sku FROM public.pick_list_items
    WHERE pick_list_id=v_pick AND suggested_pick_location_id=v_bin;
  PERFORM public.claim_pick_list_item(v_company,v_user,v_pick,v_line);
  BEGIN
    PERFORM public.record_pick_list_item_progress(v_company,v_user,v_pick,v_line,gen_random_uuid(),1,v_spare_sku,
      NULL,NULL,NULL,true,'test substitution');
    RAISE EXCEPTION 'STRICT_LOCATION_POLICY_NOT_ENFORCED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'PICK_PROGRESS_RACK_POLICY_MISMATCH' THEN RAISE; END IF;
  END;
  PERFORM public.record_pick_list_item_progress(v_company,v_user,v_pick,v_line,gen_random_uuid(),1,v_sku);
  RESET ROLE;
  UPDATE public.settings SET value='"batch_only"'::JSONB WHERE company_id=v_company AND business_unit_id=v_bu
    AND group_key='inventory' AND setting_key='picking_validation_policy';
  SET LOCAL ROLE authenticated;
  -- The previous completed scan releases its claim; reacquire before the next scan.
  PERFORM public.claim_pick_list_item(v_company,v_user,v_pick,v_line);
  PERFORM public.record_pick_list_item_progress(v_company,v_user,v_pick,v_line,gen_random_uuid(),1,v_spare_sku,
    NULL,NULL,NULL,true,'test substitution');
  IF (SELECT qty_reserved FROM public.item_batch_locations WHERE location_id=v_spare) <> 1
    OR (SELECT qty_reserved FROM public.item_batch_locations WHERE location_id=v_bin) <> 3 THEN
    RAISE EXCEPTION 'EXACT_SOURCE_SUBSTITUTION_RESERVATION_FAILED';
  END IF;
  v_result := public.get_item_location_stock_page(v_company, v_item, v_bu, 1, 1, '__ALLOC', NULL, 1);
  IF jsonb_array_length(v_result->'data') <> 1 OR (v_result->'pagination'->>'total')::INTEGER <> 3 THEN
    RAISE EXCEPTION 'BOUNDED_ITEM_LOCATION_PAGE_FAILED';
  END IF;
  v_result := public.get_item_location_stock_page(v_company, v_item, v_bu, 1, 20, NULL, v_crate, 1);
  IF (v_result->'data'->0->>'batchCount')::INTEGER <> 2 OR jsonb_array_length(v_result->'data'->0->'batches') <> 2 THEN
    RAISE EXCEPTION 'BATCH_PAGE_FAILED';
  END IF;
  SELECT subtree_quantity INTO v_qty FROM public.get_warehouse_location_capacities(v_bu, v_warehouse, 1, 20, NULL, true, '__ALLOC_ZONE');
  IF v_qty <> 115 THEN RAISE EXCEPTION 'SUBTREE_TOTAL_FAILED: %', v_qty; END IF;
  PERFORM public.cancel_pick_list_reset_progress(v_company, v_user, v_pick, 'rollback-only test');
  IF EXISTS (SELECT 1 FROM public.item_batch_locations WHERE location_id IN(v_bin,v_crate,v_spare) AND qty_reserved > 0)
     OR EXISTS (SELECT 1 FROM public.inventory_reservation_allocations WHERE pick_list_id=v_pick AND active_quantity_base > 0) THEN
    RAISE EXCEPTION 'CANCELLATION_SOURCE_RELEASE_FAILED';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::TEXT, true);
  PERFORM set_config('request.jwt.claims', '{}'::TEXT, true);
  v_result := public.get_item_location_stock_page(v_company, v_item, v_bu);
  IF jsonb_array_length(v_result->'data') <> 0 THEN RAISE EXCEPTION 'UNAUTHORIZED_STOCK_VISIBLE'; END IF;
  RAISE NOTICE 'PASS: authenticated FIFO, mixed depths/types, subtree scope, exact reservations, strict picking, allowed substitution, cancellation release, unavailable sources, RPC rollback';
END $$;
ROLLBACK;
