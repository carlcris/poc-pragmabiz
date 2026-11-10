-- Local seeded DB, rollback-only. Report reads run as authenticated with RLS.
BEGIN;
CREATE TEMP TABLE expired_report_context ON COMMIT DROP AS
SELECT u.id AS user_id, u.company_id, w.id AS warehouse_id, w.business_unit_id,
  i.id AS item_id, other.id AS other_item_id, 'EXPIRED-TEST-' || gen_random_uuid()::TEXT AS prefix
FROM public.users u JOIN public.user_business_unit_access a ON a.user_id = u.id
JOIN public.warehouses w ON w.business_unit_id = a.business_unit_id AND w.company_id = u.company_id AND w.deleted_at IS NULL
JOIN public.items i ON i.company_id = u.company_id AND i.deleted_at IS NULL
JOIN public.items other ON other.company_id = u.company_id AND other.id <> i.id AND other.deleted_at IS NULL
WHERE u.is_active AND u.deleted_at IS NULL LIMIT 1;
GRANT SELECT ON expired_report_context TO authenticated;
SELECT set_config('request.jwt.claim.sub', user_id::TEXT, TRUE) FROM expired_report_context;
SET LOCAL ROLE authenticated;
DO $$
DECLARE c RECORD; result JSONB; first_key TEXT; second_key TEXT;
BEGIN
  SELECT user_id, company_id, warehouse_id, business_unit_id, item_id, other_item_id, prefix INTO STRICT c FROM expired_report_context;
  INSERT INTO public.item_batches(company_id, item_id, warehouse_id, batch_code, received_at, expiration_date, qty_on_hand)
  VALUES
    (c.company_id,c.item_id,c.warehouse_id,c.prefix || '-shared','2026-01-01','2026-11-01',2),
    (c.company_id,c.other_item_id,c.warehouse_id,c.prefix || '-shared','2026-01-01','2026-11-02',3),
    (c.company_id,c.item_id,c.warehouse_id,c.prefix || '-other','2026-01-01','2026-11-03',4),
    (c.company_id,c.item_id,c.warehouse_id,c.prefix || '-today','2026-01-01','2026-11-10',5),
    (c.company_id,c.item_id,c.warehouse_id,c.prefix || '-empty','2026-01-01','2026-11-01',0),
    (c.company_id,c.item_id,c.warehouse_id,c.prefix || '-future','2026-01-01','2026-11-11',1),
    (c.company_id,c.item_id,c.warehouse_id,c.prefix || '-unset','2026-01-01',NULL,1);
  result := public.get_expired_batches_report(c.company_id,'2026-11-10',c.business_unit_id,c.warehouse_id,NULL,c.prefix,'item',1,20);
  IF (result->>'totalRows')::INT <> 3 OR (result->'pagination'->>'total')::INT <> 2 OR jsonb_array_length(result->'data') <> 3 THEN
    RAISE EXCEPTION 'Expiry, quantity, or item grouping failed: %', result;
  END IF;
  result := public.get_expired_batches_report(c.company_id,'2026-11-10',c.business_unit_id,c.warehouse_id,NULL,c.prefix,'batch',1,1);
  first_key := result->'data'->0->>'groupKey';
  IF jsonb_array_length(result->'data') <> 1 THEN RAISE EXCEPTION 'First whole group page failed'; END IF;
  result := public.get_expired_batches_report(c.company_id,'2026-11-10',c.business_unit_id,c.warehouse_id,NULL,c.prefix,'batch',2,1);
  second_key := result->'data'->0->>'groupKey';
  IF first_key = second_key OR jsonb_array_length(result->'data') <> 2 THEN RAISE EXCEPTION 'Second whole group page failed'; END IF;
  result := public.get_expired_batches_report(c.company_id,'2026-11-10',gen_random_uuid(),NULL,NULL,c.prefix);
  IF (result->>'totalRows')::INT <> 0 THEN RAISE EXCEPTION 'Business unit scope failed'; END IF;
  result := public.get_expired_batches_report(gen_random_uuid(),'2026-11-10',NULL,NULL,NULL,c.prefix);
  IF (result->>'totalRows')::INT <> 0 THEN RAISE EXCEPTION 'Company scope failed'; END IF;
  result := public.get_expired_batches_report(c.company_id,'2026-11-10',c.business_unit_id,NULL,gen_random_uuid(),c.prefix);
  IF (result->>'totalRows')::INT <> 0 THEN RAISE EXCEPTION 'Category filter failed'; END IF;
  INSERT INTO public.item_batches(company_id, item_id, warehouse_id, batch_code, received_at, expiration_date, qty_on_hand)
  SELECT c.company_id,c.item_id,c.warehouse_id,c.prefix || '-bulk-' || n,'2026-01-01'::DATE,'2026-11-01'::DATE,1
  FROM generate_series(1,502) n;
  result := public.get_expired_batches_report(c.company_id,'2026-11-10',c.business_unit_id,c.warehouse_id,NULL,c.prefix || '-bulk-','item',1,20);
  IF (result->>'pageRows')::INT <> 502 OR jsonb_array_length(result->'data') <> 501 THEN
    RAISE EXCEPTION 'Bounded response or complete oversized group count failed';
  END IF;
  RAISE NOTICE 'Passed: expired stocked batches only, item/batch grouping, whole-group pages, company/BU scope, category filter';
END $$;
ROLLBACK;
