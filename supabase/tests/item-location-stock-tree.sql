-- Run with psql -v ON_ERROR_STOP=1. All fixtures and changes roll back.
BEGIN;
DO $$
DECLARE
  v_company UUID; v_warehouse UUID; v_bu UUID; v_item UUID; v_batch UUID; v_user UUID;
  v_zone UUID; v_shelf UUID; v_bin UUID; v_crate UUID;
  v_tree JSONB; v_node JSONB; v_summary JSONB; v_root_total NUMERIC; v_page_total NUMERIC;
  v_page INTEGER;
BEGIN
  SELECT stock.company_id, stock.warehouse_id, w.business_unit_id, stock.item_id, stock.item_batch_id
  INTO v_company, v_warehouse, v_bu, v_item, v_batch
  FROM public.item_batch_locations stock JOIN public.warehouses w ON w.id = stock.warehouse_id
  WHERE stock.deleted_at IS NULL AND w.is_active LIMIT 1;
  IF v_batch IS NULL THEN RAISE EXCEPTION 'TEST_REQUIRES_SEEDED_STOCK'; END IF;
  SELECT u.id INTO v_user FROM public.users u
  WHERE u.company_id = v_company AND u.is_active
    AND EXISTS (SELECT 1 FROM public.user_business_unit_access a WHERE a.user_id = u.id AND a.business_unit_id = v_bu)
  LIMIT 1;

  INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, name, location_type)
    VALUES(v_company, v_warehouse, '__TREE_ZONE', 'Tree Zone', 'zone') RETURNING id INTO v_zone;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, code, location_type, is_storable)
    VALUES(v_company, v_warehouse, v_zone, '__TREE_SHELF', 'shelf', false) RETURNING id INTO v_shelf;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, code, name, location_type)
    VALUES(v_company, v_warehouse, v_shelf, '__TREE_BIN', 'Bin 1', 'bin') RETURNING id INTO v_bin;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, parent_id, code, location_type)
    VALUES(v_company, v_warehouse, v_zone, '__TREE_CRATE', 'crate') RETURNING id INTO v_crate;
  INSERT INTO public.item_batch_locations(company_id, warehouse_id, item_id, item_batch_id, location_id, qty_on_hand)
    VALUES(v_company, v_warehouse, v_item, v_batch, v_bin, 10),
          (v_company, v_warehouse, v_item, v_batch, v_crate, 5),
          (v_company, v_warehouse, v_item, v_batch, v_zone, 2);

  PERFORM set_config('request.jwt.claim.sub', v_user::TEXT, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user, 'role', 'authenticated', 'current_business_unit_id', v_bu)::TEXT, true);
  SET LOCAL ROLE authenticated;

  -- Top level: the zone's total includes everything inside it, plus what sits on it directly.
  v_page := 1; v_root_total := 0;
  LOOP
    v_tree := public.get_item_location_stock_tree(v_company, v_item, v_warehouse, v_bu, NULL, v_page, 50);
    SELECT COALESCE(SUM((node->>'subtreeOnHand')::NUMERIC), 0) INTO v_page_total
    FROM jsonb_array_elements(v_tree->'data') node;
    v_root_total := v_root_total + v_page_total;
    EXIT WHEN v_page >= (v_tree->'pagination'->>'totalPages')::INTEGER;
    v_page := v_page + 1;
  END LOOP;
  SELECT node INTO v_node FROM generate_series(1, (v_tree->'pagination'->>'totalPages')::INTEGER) p,
    jsonb_array_elements(public.get_item_location_stock_tree(v_company, v_item, v_warehouse, v_bu, NULL, p, 50)->'data') node
  WHERE node->>'locationId' = v_zone::TEXT;
  IF (v_node->>'subtreeOnHand')::NUMERIC <> 17 OR (v_node->>'directOnHand')::NUMERIC <> 2
     OR NOT (v_node->>'hasStockedChildren')::BOOLEAN OR v_node->>'namePath' <> 'Tree Zone' THEN
    RAISE EXCEPTION 'ZONE_NODE_FAILED: %', v_node;
  END IF;

  -- Branch totals at the top level reconcile with the warehouse summary.
  SELECT row INTO v_summary FROM jsonb_array_elements(
    public.get_item_warehouse_stock_summary(v_company, v_item, v_bu, 1, 50)->'data') row
  WHERE row->>'warehouseId' = v_warehouse::TEXT;
  IF (v_summary->>'qtyOnHand')::NUMERIC <> v_root_total THEN
    RAISE EXCEPTION 'SUMMARY_MISMATCH: summary % vs tree %', v_summary->>'qtyOnHand', v_root_total;
  END IF;

  v_tree := public.get_item_location_stock_tree(v_company, v_item, v_warehouse, v_bu, v_zone, 1, 50);
  IF jsonb_array_length(v_tree->'data') <> 2 THEN RAISE EXCEPTION 'ZONE_CHILDREN_FAILED: %', v_tree; END IF;
  SELECT node INTO v_node FROM jsonb_array_elements(v_tree->'data') node WHERE node->>'locationId' = v_shelf::TEXT;
  IF (v_node->>'subtreeOnHand')::NUMERIC <> 10 OR (v_node->>'directOnHand')::NUMERIC <> 0
     OR NOT (v_node->>'hasStockedChildren')::BOOLEAN THEN RAISE EXCEPTION 'SHELF_NODE_FAILED: %', v_node; END IF;
  SELECT node INTO v_node FROM jsonb_array_elements(v_tree->'data') node WHERE node->>'locationId' = v_crate::TEXT;
  IF (v_node->>'subtreeOnHand')::NUMERIC <> 5 OR (v_node->>'directBatchCount')::INTEGER <> 1
     OR (v_node->>'hasStockedChildren')::BOOLEAN THEN RAISE EXCEPTION 'CRATE_NODE_FAILED: %', v_node; END IF;

  v_tree := public.get_item_location_stock_tree(v_company, v_item, v_warehouse, v_bu, v_shelf, 1, 50);
  SELECT node INTO v_node FROM jsonb_array_elements(v_tree->'data') node;
  IF jsonb_array_length(v_tree->'data') <> 1 OR v_node->>'namePath' <> 'Tree Zone / __TREE_SHELF / Bin 1'
     OR (v_node->>'directOnHand')::NUMERIC <> 10 THEN RAISE EXCEPTION 'BIN_NODE_FAILED: %', v_node; END IF;

  -- Search selection must return a real node, including 2 direct units plus 10 in its bin.
  RESET ROLE;
  UPDATE public.warehouse_locations SET is_storable = true WHERE id = v_shelf;
  INSERT INTO public.item_batch_locations(company_id, warehouse_id, item_id, item_batch_id, location_id, qty_on_hand)
    VALUES(v_company, v_warehouse, v_item, v_batch, v_shelf, 2);
  SET LOCAL ROLE authenticated;
  v_tree := public.get_item_location_stock_tree(v_company, v_item, v_warehouse, v_bu, NULL, 1, 1, v_shelf);
  v_node := v_tree->'data'->0;
  IF jsonb_array_length(v_tree->'data') <> 1 OR (v_node->>'subtreeOnHand')::NUMERIC <> 12
    OR (v_node->>'directOnHand')::NUMERIC <> 2 OR NOT (v_node->>'hasStockedChildren')::BOOLEAN THEN
    RAISE EXCEPTION 'EXACT_SEARCH_NODE_FAILED: %', v_tree;
  END IF;

  -- Refresh the exact selected node after moving stock, including when it becomes empty.
  RESET ROLE;
  UPDATE public.item_batch_locations SET qty_on_hand = 0
    WHERE location_id = v_crate AND item_id = v_item;
  UPDATE public.item_batch_locations SET qty_on_hand = 15
    WHERE location_id = v_bin AND item_id = v_item;
  SET LOCAL ROLE authenticated;
  v_tree := public.get_item_location_stock_tree(v_company, v_item, v_warehouse, v_bu, NULL, 1, 1, v_crate);
  v_node := v_tree->'data'->0;
  IF jsonb_array_length(v_tree->'data') <> 1 OR (v_node->>'directOnHand')::NUMERIC <> 0
    OR (v_node->>'directAvailable')::NUMERIC <> 0 OR (v_node->>'hasStockedChildren')::BOOLEAN THEN
    RAISE EXCEPTION 'EMPTY_SELECTED_NODE_FAILED: %', v_tree;
  END IF;
  v_tree := public.get_item_location_stock_tree(v_company, v_item, v_warehouse, v_bu, NULL, 1, 1, v_shelf);
  IF (v_tree->'data'->0->>'subtreeOnHand')::NUMERIC <> 17 THEN
    RAISE EXCEPTION 'REFRESHED_SUBTREE_FAILED: %', v_tree;
  END IF;
  v_tree := public.get_item_location_stock_tree(v_company, v_item, gen_random_uuid(), v_bu, NULL, 1, 1, v_crate);
  IF jsonb_array_length(v_tree->'data') <> 0 THEN RAISE EXCEPTION 'FOREIGN_EXACT_LOCATION_VISIBLE'; END IF;

  -- A parent from another warehouse yields nothing; an outsider sees nothing.
  v_tree := public.get_item_location_stock_tree(v_company, v_item, gen_random_uuid(), v_bu, v_zone, 1, 50);
  IF jsonb_array_length(v_tree->'data') <> 0 THEN RAISE EXCEPTION 'FOREIGN_PARENT_VISIBLE'; END IF;
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::TEXT, true);
  PERFORM set_config('request.jwt.claims', '{}'::TEXT, true);
  v_tree := public.get_item_location_stock_tree(v_company, v_item, v_warehouse, v_bu, NULL, 1, 50);
  v_summary := public.get_item_warehouse_stock_summary(v_company, v_item, v_bu, 1, 50);
  IF jsonb_array_length(v_tree->'data') <> 0 OR jsonb_array_length(v_summary->'data') <> 0 THEN
    RAISE EXCEPTION 'UNAUTHORIZED_STOCK_VISIBLE';
  END IF;
  v_tree := public.get_item_location_stock_tree(v_company, v_item, v_warehouse, v_bu, NULL, 1, 1, v_crate);
  IF jsonb_array_length(v_tree->'data') <> 0 THEN RAISE EXCEPTION 'UNAUTHORIZED_EMPTY_NODE_VISIBLE'; END IF;
  RESET ROLE;
  RAISE NOTICE 'PASS: item stock tree rollups, direct stock, nested name paths, summary reconciliation, scope, unauthorized';
END $$;
ROLLBACK;
