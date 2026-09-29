-- Run after migrations on a local seeded database. All fixtures are rolled back.
\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION pg_temp.fail_waiver_insert() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.storage_path LIKE '%/force-failure.pdf' THEN
    RAISE EXCEPTION 'TEST_WAIVER_FAILURE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_waiver_failure BEFORE INSERT ON public.sales_quotation_waivers
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_waiver_insert();

DO $test$
DECLARE
  v_context RECORD;
  v_quote uuid;
  v_status text;
  v_name text;
  v_count integer;
BEGIN
  SELECT actor.id AS actor_id, actor.company_id, access.business_unit_id, customer.id AS customer_id
  INTO STRICT v_context
  FROM public.users actor
  JOIN public.user_business_unit_access access ON access.user_id = actor.id
  JOIN public.customers customer ON customer.company_id = actor.company_id AND customer.deleted_at IS NULL
  WHERE actor.deleted_at IS NULL AND actor.is_active
  LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub', v_context.actor_id::text, true);
  INSERT INTO public.sales_quotations (company_id, business_unit_id, customer_id, quotation_date, date_received, due_date, status, created_by, updated_by)
  VALUES (v_context.company_id, v_context.business_unit_id, v_context.customer_id, CURRENT_DATE, CURRENT_DATE, CURRENT_DATE + 14, 'draft', v_context.actor_id, v_context.actor_id)
  RETURNING id INTO v_quote;

  -- The first waiver is inserted after acceptance; the second deliberately fails.
  BEGIN
    PERFORM public.change_sales_quotation_status_transaction(v_quote, 'accepted', 'Test customer', 'email',
      jsonb_build_array(v_context.company_id || '/valid.pdf', v_context.company_id || '/force-failure.pdf'));
    RAISE EXCEPTION 'Expected waiver insertion failure';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'TEST_WAIVER_FAILURE' THEN RAISE; END IF;
  END;
  SELECT status, accepted_by_name INTO v_status, v_name FROM public.sales_quotations WHERE id = v_quote;
  SELECT count(*) INTO v_count FROM public.sales_quotation_waivers WHERE quotation_id = v_quote;
  IF v_status <> 'draft' OR v_name IS NOT NULL OR v_count <> 0 THEN
    RAISE EXCEPTION 'Acceptance failure left partial writes';
  END IF;

  PERFORM public.change_sales_quotation_status_transaction(v_quote, 'sent');
  PERFORM public.change_sales_quotation_status_transaction(v_quote, 'accepted', 'Test customer', 'email',
    jsonb_build_array(v_context.company_id || '/valid.pdf'));
  SELECT status, accepted_by_name INTO v_status, v_name FROM public.sales_quotations WHERE id = v_quote;
  SELECT count(*) INTO v_count FROM public.sales_quotation_waivers WHERE quotation_id = v_quote AND deleted_at IS NULL;
  IF v_status <> 'accepted' OR v_name <> 'Test customer' OR v_count <> 1 THEN
    RAISE EXCEPTION 'Acceptance success did not persist its evidence';
  END IF;
  BEGIN
    PERFORM public.change_sales_quotation_status_transaction(v_quote, 'rejected');
    RAISE EXCEPTION 'Expected invalid transition';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'QUOTATION_STATUS_TRANSITION_INVALID' THEN RAISE; END IF;
  END;
END;
$test$;
ROLLBACK;
