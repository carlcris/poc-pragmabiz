-- Seeded local DB; temporary hierarchy and all fixtures roll back.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE tree_test_context ON COMMIT DROP AS
SELECT u.id AS actor_id, u.company_id, w.id AS warehouse_id, w.business_unit_id,
  (SELECT s.item_id FROM public.item_batch_locations s WHERE s.warehouse_id = w.id
    AND s.qty_on_hand > 0 AND s.deleted_at IS NULL LIMIT 1) AS item_id
FROM public.users u JOIN public.user_business_unit_access a ON a.user_id = u.id
JOIN public.warehouses w ON w.business_unit_id = a.business_unit_id AND w.company_id = u.company_id
WHERE u.is_active AND u.deleted_at IS NULL AND w.deleted_at IS NULL
ORDER BY w.id LIMIT 1;
CREATE TEMP TABLE tree_test_ids ON COMMIT DROP AS
SELECT n, gen_random_uuid() AS id FROM generate_series(1, 8420) AS n;
INSERT INTO public.warehouse_locations(id, company_id, warehouse_id, code, name, location_type)
SELECT i.id, c.company_id, c.warehouse_id, 'QA-TREE-' || lpad(i.n::text, 5, '0'), 'QA tree', 'zone'
FROM tree_test_ids i CROSS JOIN tree_test_context c WHERE n <= 20;
INSERT INTO public.warehouse_locations(id, company_id, warehouse_id, parent_id, code, name, location_type)
SELECT i.id, c.company_id, c.warehouse_id, parent.id, 'QA-TREE-' || lpad(i.n::text, 5, '0'), 'QA tree', 'rack'
FROM tree_test_ids i JOIN tree_test_ids parent ON parent.n = 1 + (i.n - 21) / 20
CROSS JOIN tree_test_context c WHERE i.n BETWEEN 21 AND 420;
INSERT INTO public.warehouse_locations(id, company_id, warehouse_id, parent_id, code, name, location_type)
SELECT i.id, c.company_id, c.warehouse_id, parent.id, 'QA-TREE-' || lpad(i.n::text, 5, '0'), 'QA tree', 'bin'
FROM tree_test_ids i JOIN tree_test_ids parent ON parent.n = 21 + (i.n - 421) / 20
CROSS JOIN tree_test_context c WHERE i.n > 420;
GRANT SELECT ON tree_test_context TO authenticated;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', actor_id, 'role', 'authenticated',
  'current_business_unit_id', business_unit_id)::text, true) FROM tree_test_context;
SELECT set_config('request.jwt.claim.sub', actor_id::text, true) FROM tree_test_context;
SET LOCAL ROLE authenticated;
SET LOCAL statement_timeout = '60s';
\timing on
DO $$
DECLARE ctx record; first_page jsonb; last_page jsonb; old_node jsonb; new_nodes jsonb;
  total integer; expected integer;
BEGIN
  SELECT actor_id, company_id, warehouse_id, business_unit_id, item_id INTO STRICT ctx FROM tree_test_context;
  first_page := public.get_warehouse_location_tree_page(ctx.company_id, ctx.warehouse_id, ctx.business_unit_id);
  SELECT count(*) INTO expected FROM public.warehouse_locations WHERE warehouse_id = ctx.warehouse_id AND deleted_at IS NULL;
  total := (first_page #>> '{pagination,total}')::integer;
  IF total <> expected OR total < 8420 OR jsonb_array_length(first_page->'data') <> 500 THEN
    RAISE EXCEPTION 'First page/total mismatch: % vs %', total, expected;
  END IF;
  last_page := public.get_warehouse_location_tree_page(ctx.company_id, ctx.warehouse_id, ctx.business_unit_id,
    NULL, (first_page #>> '{pagination,totalPages}')::integer);
  IF jsonb_array_length(last_page->'data') <> total - 500 * ((first_page #>> '{pagination,totalPages}')::integer - 1) THEN
    RAISE EXCEPTION 'Last page mismatch';
  END IF;
  IF jsonb_array_length(public.get_warehouse_location_tree_page(gen_random_uuid(), ctx.warehouse_id, ctx.business_unit_id)->'data') <> 0
    OR jsonb_array_length(public.get_warehouse_location_tree_page(ctx.company_id, ctx.warehouse_id, gen_random_uuid())->'data') <> 0 THEN
    RAISE EXCEPTION 'Scope leaked';
  END IF;
  IF ctx.item_id IS NOT NULL THEN
    new_nodes := public.get_warehouse_location_tree_page(ctx.company_id, ctx.warehouse_id, ctx.business_unit_id, ctx.item_id)->'data';
    FOR old_node IN SELECT value FROM jsonb_array_elements(public.get_item_location_stock_tree(ctx.company_id, ctx.item_id, ctx.warehouse_id, ctx.business_unit_id)->'data') LOOP
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(new_nodes) AS n WHERE n->>'id' = old_node->>'locationId'
        AND n->'onHand' = old_node->'subtreeOnHand' AND n->'available' = old_node->'subtreeAvailable'
        AND n->'directOnHand' = old_node->'directOnHand' AND n->'directAvailable' = old_node->'directAvailable') THEN
        RAISE EXCEPTION 'Stock totals differ from existing tree';
      END IF;
    END LOOP;
  END IF;
END $$;
ROLLBACK;
