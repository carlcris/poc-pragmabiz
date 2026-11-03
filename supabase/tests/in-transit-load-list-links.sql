-- Rollback-only regression checks using a local load list and matching requisition.
-- docker exec -i supabase_db_backend psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/in-transit-load-list-links.sql
BEGIN;
CREATE TEMP TABLE link_test_context ON COMMIT DROP AS
SELECT ll.id AS load_list_id, ll.company_id, ll.business_unit_id,
  ll.created_by AS actor_id, lli.id AS load_list_item_id, sri.id AS sr_item_id
FROM public.load_lists ll
JOIN public.load_list_items lli ON lli.load_list_id = ll.id
JOIN public.stock_requisitions sr ON sr.company_id = ll.company_id
  AND sr.business_unit_id = ll.business_unit_id AND sr.deleted_at IS NULL
  AND sr.status <> 'cancelled'
JOIN public.stock_requisition_items sri ON sri.sr_id = sr.id AND sri.item_id = lli.item_id
WHERE ll.status = 'in_transit' AND ll.deleted_at IS NULL
  AND lli.load_list_qty >= 1 AND sri.requested_qty >= 1
ORDER BY ll.created_at DESC, lli.id, sri.id LIMIT 1;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM link_test_context) THEN
    RAISE EXCEPTION 'Test needs an in-transit load list and matching source-unit requisition';
  END IF;
END $$;
-- Isolate the selected pair's allocation capacity; rollback restores all links.
DELETE FROM public.load_list_sr_items
WHERE load_list_item_id = (SELECT load_list_item_id FROM link_test_context)
   OR sr_item_id = (SELECT sr_item_id FROM link_test_context);
GRANT SELECT ON link_test_context TO authenticated;
SELECT set_config('request.jwt.claim.sub', actor_id::TEXT, TRUE),
  set_config('request.jwt.claims', jsonb_build_object('sub', actor_id,
    'role', 'authenticated', 'current_business_unit_id', business_unit_id)::TEXT, TRUE)
FROM link_test_context;

CREATE FUNCTION pg_temp.create_test_link(p_quantity NUMERIC DEFAULT 1)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE context RECORD;
BEGIN
  SELECT load_list_id, company_id, business_unit_id, actor_id,
    load_list_item_id, sr_item_id INTO context FROM link_test_context;
  RETURN public.link_load_list_stock_requisitions(context.company_id,
    context.business_unit_id, context.actor_id, context.load_list_id,
    jsonb_build_array(jsonb_build_object('load_list_item_id', context.load_list_item_id,
      'sr_item_id', context.sr_item_id, 'fulfilled_qty', p_quantity)));
END $$;

-- In Transit succeeds as the actual authenticated source-unit actor.
SET LOCAL ROLE authenticated;
SELECT pg_temp.create_test_link();
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.load_list_sr_items l
    JOIN link_test_context c ON c.load_list_item_id = l.load_list_item_id
      AND c.sr_item_id = l.sr_item_id WHERE l.fulfilled_qty = 1) THEN
    RAISE EXCEPTION 'In-transit link was not created';
  END IF;
END $$;
DELETE FROM public.load_list_sr_items
WHERE load_list_item_id = (SELECT load_list_item_id FROM link_test_context);

-- Draft and Confirmed remain supported.
DO $$
DECLARE test_status TEXT;
BEGIN
  FOREACH test_status IN ARRAY ARRAY['draft', 'confirmed'] LOOP
    UPDATE public.load_lists SET status = test_status
    WHERE id = (SELECT load_list_id FROM link_test_context);
    IF pg_temp.create_test_link() <> 1 THEN RAISE EXCEPTION 'Expected one link'; END IF;
    DELETE FROM public.load_list_sr_items
    WHERE load_list_item_id = (SELECT load_list_item_id FROM link_test_context);
  END LOOP;
END $$;

-- A different business-unit context cannot link this source-owned load list.
SET LOCAL ROLE authenticated;
DO $$
DECLARE context RECORD;
BEGIN
  SELECT company_id, actor_id, load_list_id, load_list_item_id, sr_item_id
  INTO context FROM link_test_context;
  BEGIN
    PERFORM public.link_load_list_stock_requisitions(context.company_id, gen_random_uuid(),
      context.actor_id, context.load_list_id,
      jsonb_build_array(jsonb_build_object('load_list_item_id', context.load_list_item_id,
        'sr_item_id', context.sr_item_id, 'fulfilled_qty', 1)));
    RAISE EXCEPTION 'Expected source-unit rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Load list not found' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

-- Received and other non-linkable statuses cannot bypass the server guard.
DO $$
DECLARE test_status TEXT;
BEGIN
  FOREACH test_status IN ARRAY ARRAY['arrived', 'receiving', 'pending_approval', 'received', 'cancelled'] LOOP
    UPDATE public.load_lists SET status = test_status
    WHERE id = (SELECT load_list_id FROM link_test_context);
    BEGIN
      PERFORM pg_temp.create_test_link();
      RAISE EXCEPTION 'Expected status rejection';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'Links can only be added to draft, confirmed, or in-transit load lists' THEN
        RAISE;
      END IF;
    END;
  END LOOP;
END $$;
UPDATE public.load_lists SET status = 'in_transit'
WHERE id = (SELECT load_list_id FROM link_test_context);

-- Over-allocation still fails.
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM pg_temp.create_test_link(999999999);
    RAISE EXCEPTION 'Expected allocation rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Linked quantity would exceed load list item quantity' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

-- Fail reconciliation after insertion; the inserted link must roll back.
CREATE FUNCTION pg_temp.fail_link_reconciliation() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'forced link rollback test';
END $$;
CREATE TRIGGER link_test_failure BEFORE UPDATE ON public.stock_requisition_items
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_link_reconciliation();
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM pg_temp.create_test_link();
    RAISE EXCEPTION 'Expected reconciliation failure';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'forced link rollback test' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.load_list_sr_items
    WHERE load_list_item_id = (SELECT load_list_item_id FROM link_test_context)) THEN
    RAISE EXCEPTION 'Failed linking left a partial insert';
  END IF;
END $$;
ROLLBACK;
