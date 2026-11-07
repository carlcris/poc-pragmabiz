-- Representative authenticated lookup and bounded item-stock reader, all fixtures rolled back.
BEGIN;
SELECT stock.company_id AS company, stock.warehouse_id AS warehouse, w.business_unit_id AS bu,
  stock.item_id AS item,
  (SELECT u.id FROM public.users u WHERE u.company_id = stock.company_id AND u.is_active
    AND EXISTS (SELECT 1 FROM public.user_business_unit_access a WHERE a.user_id=u.id AND a.business_unit_id=w.business_unit_id) LIMIT 1) AS actor
FROM public.item_batch_locations stock JOIN public.warehouses w ON w.id=stock.warehouse_id
WHERE stock.deleted_at IS NULL LIMIT 1 \gset
INSERT INTO public.warehouse_locations(company_id, warehouse_id, code, name, location_type)
SELECT :'company'::UUID, :'warehouse'::UUID, '__PERF_' || lpad(n::TEXT, 5, '0'), 'Search fixture ' || n, 'bin'
FROM generate_series(1,2000) n;
ANALYZE public.warehouse_locations;
SELECT set_config('request.jwt.claim.sub', :'actor', true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', :'actor', 'role', 'authenticated', 'current_business_unit_id', :'bu')::TEXT, true);
SET LOCAL ROLE authenticated;
SELECT current_user, current_setting('row_security');
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, code, location_path FROM public.warehouse_locations
WHERE company_id=:'company'::UUID AND warehouse_id=:'warehouse'::UUID AND deleted_at IS NULL
  AND is_active AND location_path ILIKE '%Search fixture 1999%'
ORDER BY code, id LIMIT 5;
EXPLAIN (ANALYZE, BUFFERS)
SELECT public.get_item_location_stock_page(:'company'::UUID, :'item'::UUID, :'bu'::UUID, 1, 20);
ROLLBACK;
