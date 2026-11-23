-- Run against the seeded local DB. Fixture writes and assertions roll back.
BEGIN;
DO $$
DECLARE
  v_actor UUID;
  v_company UUID;
  v_business_unit UUID;
  v_warehouse UUID;
  v_item UUID;
  v_location UUID;
  v_empty_location UUID;
  v_batch UUID;
  v_reserved_batch UUID;
  v_deleted_batch UUID;
  v_prefix TEXT := 'LOCATION-BATCH-TEST-' || gen_random_uuid()::TEXT;
  v_result JSONB;
  v_page_one JSONB;
  v_page_two JSONB;
  v_warehouse_on_hand NUMERIC;
  v_index INTEGER;
BEGIN
  SELECT actor.id, actor.company_id, warehouse.business_unit_id, warehouse.id, item.id
  INTO STRICT v_actor, v_company, v_business_unit, v_warehouse, v_item
  FROM public.users actor
  JOIN public.user_business_unit_access access_row ON access_row.user_id = actor.id
  JOIN public.warehouses warehouse ON warehouse.business_unit_id = access_row.business_unit_id
    AND warehouse.company_id = actor.company_id
    AND warehouse.is_active AND warehouse.deleted_at IS NULL
  JOIN public.items item ON item.company_id = actor.company_id AND item.deleted_at IS NULL
  WHERE actor.is_active AND actor.deleted_at IS NULL
    AND public.user_has_permission(actor.id, 'items', 'view', warehouse.business_unit_id)
  LIMIT 1;

  INSERT INTO public.warehouse_locations(company_id, warehouse_id, name, location_type)
  VALUES (v_company, v_warehouse, v_prefix, 'bin') RETURNING id INTO v_location;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, name, location_type)
  VALUES (v_company, v_warehouse, v_prefix || '-empty', 'bin') RETURNING id INTO v_empty_location;

  -- Older depleted rows previously occupied the entire first batch page.
  FOR v_index IN 1..25 LOOP
    INSERT INTO public.item_batches(company_id, item_id, warehouse_id, batch_code, received_at, qty_on_hand)
    VALUES (v_company, v_item, v_warehouse, v_prefix || '-empty-' || v_index,
      DATE '2020-01-01' + v_index, 0) RETURNING id INTO v_batch;
    INSERT INTO public.item_batch_locations(company_id, item_id, warehouse_id, location_id, item_batch_id, qty_on_hand)
    VALUES (v_company, v_item, v_warehouse, v_location, v_batch, 0);
  END LOOP;

  FOR v_index IN 1..21 LOOP
    INSERT INTO public.item_batches(company_id, item_id, warehouse_id, batch_code, received_at, qty_on_hand)
    VALUES (v_company, v_item, v_warehouse, v_prefix || '-stocked-' || v_index,
      DATE '2021-01-01' + v_index, 2) RETURNING id INTO v_batch;
    INSERT INTO public.item_batch_locations(company_id, item_id, warehouse_id, location_id, item_batch_id, qty_on_hand)
    VALUES (v_company, v_item, v_warehouse, v_location, v_batch, 2);
  END LOOP;

  -- A positive warehouse batch is still empty at this particular location.
  INSERT INTO public.item_batch_locations(company_id, item_id, warehouse_id, location_id, item_batch_id, qty_on_hand)
  VALUES (v_company, v_item, v_warehouse, v_empty_location, v_batch, 0);

  INSERT INTO public.item_batches(company_id, item_id, warehouse_id, batch_code, received_at, qty_on_hand, qty_reserved)
  VALUES (v_company, v_item, v_warehouse, v_prefix || '-reserved', DATE '2022-01-01', 5, 5)
  RETURNING id INTO v_reserved_batch;
  INSERT INTO public.item_batch_locations(company_id, item_id, warehouse_id, location_id, item_batch_id, qty_on_hand, qty_reserved)
  VALUES (v_company, v_item, v_warehouse, v_location, v_reserved_batch, 5, 5);

  -- The page count uses the same parent soft-delete predicate as the batch list.
  INSERT INTO public.item_batches(company_id, item_id, warehouse_id, batch_code, received_at, qty_on_hand, deleted_at)
  VALUES (v_company, v_item, v_warehouse, v_prefix || '-deleted', DATE '2023-01-01', 7, now())
  RETURNING id INTO v_deleted_batch;
  INSERT INTO public.item_batch_locations(company_id, item_id, warehouse_id, location_id, item_batch_id, qty_on_hand)
  VALUES (v_company, v_item, v_warehouse, v_location, v_deleted_batch, 7);

  PERFORM set_config('request.jwt.claim.sub', v_actor::TEXT, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_actor, 'role', 'authenticated', 'current_business_unit_id', v_business_unit)::TEXT, true);
  SET LOCAL ROLE authenticated;

  v_result := public.get_item_location_stock_page(v_company, v_item, v_business_unit, 1, 1, NULL, v_location, 1);
  v_page_one := v_result->'data'->0;
  IF (v_page_one->>'batchCount')::INTEGER IS DISTINCT FROM 22
    OR jsonb_array_length(v_page_one->'batches') IS DISTINCT FROM 20
    OR v_page_one->'batches'->0->>'batchCode' IS DISTINCT FROM v_prefix || '-stocked-1'
    OR v_page_one->'batches'->19->>'batchCode' IS DISTINCT FROM v_prefix || '-stocked-20' THEN
    RAISE EXCEPTION 'First page must contain twenty stocked batches and count twenty-two';
  END IF;
  IF (v_page_one->>'qtyOnHand')::NUMERIC IS DISTINCT FROM 54
    OR (v_page_one->>'qtyReserved')::NUMERIC IS DISTINCT FROM 5
    OR (v_page_one->>'qtyAvailable')::NUMERIC IS DISTINCT FROM 49 THEN
    RAISE EXCEPTION 'Location quantity aggregates changed';
  END IF;
  v_warehouse_on_hand := (v_page_one->>'warehouseOnHand')::NUMERIC;

  v_result := public.get_item_location_stock_page(v_company, v_item, v_business_unit, 1, 1, NULL, v_location, 2);
  v_page_two := v_result->'data'->0;
  IF (v_page_two->>'batchCount')::INTEGER IS DISTINCT FROM 22
    OR (v_page_two->>'batchPage')::INTEGER IS DISTINCT FROM 2
    OR jsonb_array_length(v_page_two->'batches') IS DISTINCT FROM 2
    OR v_page_two->'batches'->0->>'batchCode' IS DISTINCT FROM v_prefix || '-stocked-21'
    OR v_page_two->'batches'->1->>'batchCode' IS DISTINCT FROM v_prefix || '-reserved'
    OR (v_page_two->'batches'->1->>'qtyOnHand')::NUMERIC IS DISTINCT FROM 5
    OR (v_page_two->'batches'->1->>'qtyReserved')::NUMERIC IS DISTINCT FROM 5
    OR (v_page_two->'batches'->1->>'qtyAvailable')::NUMERIC IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Later page must retain the fully reserved batch';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements((v_page_one->'batches') || (v_page_two->'batches')) batch
    WHERE (batch->>'qtyOnHand')::NUMERIC <= 0 OR batch->>'batchCode' = v_prefix || '-deleted'
  ) THEN RAISE EXCEPTION 'Batch pages included depleted or deleted-parent rows'; END IF;

  v_result := public.get_item_location_stock_page(v_company, v_item, v_business_unit, 1, 1, NULL, v_location, 3);
  IF (v_result->'data'->0->>'batchCount')::INTEGER IS DISTINCT FROM 22
    OR jsonb_array_length(v_result->'data'->0->'batches') IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Out-of-range page must keep its filtered count and return no batches';
  END IF;

  v_result := public.get_item_location_stock_page(v_company, v_item, v_business_unit, 1, 20, v_prefix, NULL, 1);
  IF (v_result->'pagination'->>'total')::INTEGER IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Location search must retain the location with only depleted stock';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_result->'data') location
    WHERE (location->>'locationId')::UUID = v_empty_location
      AND (location->>'qtyOnHand')::NUMERIC = 0
      AND (location->>'batchCount')::INTEGER = 0
      AND location->'batches' = '[]'::JSONB
      AND (location->>'warehouseOnHand')::NUMERIC = v_warehouse_on_hand
  ) THEN RAISE EXCEPTION 'Empty location response or warehouse total changed'; END IF;

  IF (SELECT COUNT(*) FROM public.item_batch_locations
      WHERE location_id = v_location AND qty_on_hand = 0 AND deleted_at IS NULL) <> 25
    OR (SELECT COUNT(*) FROM public.item_batches
      WHERE batch_code LIKE v_prefix || '-empty-%' AND deleted_at IS NULL) <> 25 THEN
    RAISE EXCEPTION 'Depleted batch records were removed';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::TEXT, true);
  PERFORM set_config('request.jwt.claims', '{}'::TEXT, true);
  v_result := public.get_item_location_stock_page(v_company, v_item, v_business_unit, 1, 20, v_prefix);
  IF jsonb_array_length(v_result->'data') IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Unauthorized caller can see location stock';
  END IF;
  RAISE NOTICE 'PASS: depleted records retained, positive on-hand pages/count, fully reserved stock, empty-location search, totals, and caller scope';
END $$;
ROLLBACK;
