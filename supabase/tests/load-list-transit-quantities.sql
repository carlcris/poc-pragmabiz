-- Rollback-only test using an existing load-list supplier, actor, and active unit option.
-- docker exec -i supabase_db_backend psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/load-list-transit-quantities.sql
BEGIN;
CREATE TEMP TABLE transit_test_context ON COMMIT DROP AS
SELECT ll.company_id, ll.business_unit_id, ll.destination_business_unit_id,
  ll.created_by AS actor_id, ll.supplier_id, lli.item_id, lli.item_unit_option_id
FROM public.load_lists ll
JOIN public.load_list_items lli ON lli.load_list_id = ll.id
JOIN public.item_unit_options unit_option ON unit_option.id = lli.item_unit_option_id
WHERE ll.deleted_at IS NULL AND unit_option.is_active AND unit_option.deleted_at IS NULL
ORDER BY ll.created_at DESC LIMIT 1;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM transit_test_context) THEN
    RAISE EXCEPTION 'Test needs a load list with an active item unit option';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'load_list_items'
      AND column_name IN ('received_qty', 'damaged_qty', 'shortage_qty')) THEN
    RAISE EXCEPTION 'Load-list receipt columns still exist';
  END IF;
END $$;
GRANT SELECT ON transit_test_context TO authenticated;
SELECT set_config('request.jwt.claim.sub', actor_id::TEXT, TRUE),
  set_config('request.jwt.claims', jsonb_build_object('sub', actor_id,
    'role', 'authenticated', 'current_business_unit_id', business_unit_id)::TEXT, TRUE)
FROM transit_test_context;

CREATE FUNCTION pg_temp.create_transit_list() RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE context RECORD; result_id UUID;
BEGIN
  SELECT company_id, business_unit_id, destination_business_unit_id, actor_id,
    supplier_id, item_id, item_unit_option_id INTO context FROM transit_test_context;
  SELECT result.id INTO result_id FROM public.create_load_list(
    context.company_id, context.business_unit_id, context.destination_business_unit_id,
    context.actor_id, context.supplier_id, NULL, NULL, NULL, NULL, NULL, NULL,
    CURRENT_DATE, 'PHP', NULL,
    jsonb_build_array(jsonb_build_object('item_id', context.item_id,
      'item_unit_option_id', context.item_unit_option_id, 'load_list_qty', 15, 'unit_price', 1))) result;
  RETURN result_id;
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE list_id UUID; context RECORD;
BEGIN
  list_id := pg_temp.create_transit_list();
  SELECT company_id, business_unit_id, actor_id, supplier_id, item_id, item_unit_option_id
  INTO context FROM transit_test_context;
  PERFORM public.update_load_list(context.company_id, context.business_unit_id,
    context.actor_id, list_id, context.supplier_id, NULL, NULL, NULL, NULL, NULL, NULL,
    CURRENT_DATE, 'PHP', NULL,
    jsonb_build_array(jsonb_build_object('item_id', context.item_id,
      'item_unit_option_id', context.item_unit_option_id, 'load_list_qty', 20, 'unit_price', 1)));
  IF NOT EXISTS (SELECT 1 FROM public.load_list_items
    WHERE load_list_id = list_id AND load_list_qty = 20) THEN
    RAISE EXCEPTION 'Load-list create/edit quantities were not persisted';
  END IF;
END $$;
RESET ROLE;

CREATE FUNCTION pg_temp.fail_transit_line() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'forced transit rollback'; END $$;
CREATE TRIGGER transit_test_failure BEFORE INSERT ON public.load_list_items
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_transit_line();
SET LOCAL ROLE authenticated;
DO $$
DECLARE before_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO before_count FROM public.load_lists;
  BEGIN
    PERFORM pg_temp.create_transit_list();
    RAISE EXCEPTION 'Expected line insertion failure';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'forced transit rollback' THEN RAISE; END IF;
  END;
  IF (SELECT COUNT(*) FROM public.load_lists) <> before_count THEN
    RAISE EXCEPTION 'Failed create retained a partial parent row';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;
