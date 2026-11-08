-- Run with psql -v ON_ERROR_STOP=1. Fixtures and changes are rolled back.
BEGIN;
CREATE FUNCTION pg_temp.fail_location_row() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.location_failure',true)='on' AND NEW.name='Fail 12' THEN
    RAISE EXCEPTION 'TEST_FORCED_ROW_FAILURE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER z_fail_test_row AFTER INSERT ON public.warehouse_locations
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_location_row();
DO $$
DECLARE c UUID; w UUID; bu UUID; u UUID; root UUID; closed UUID; child UUID; big UUID;
  r RECORD; n INTEGER; before_count INTEGER; before_seq NUMERIC;
BEGIN
  SELECT company_id,id,business_unit_id INTO c,w,bu FROM public.warehouses
    WHERE deleted_at IS NULL AND is_active LIMIT 1;
  SELECT usr.id INTO u FROM public.users usr WHERE usr.company_id=c AND usr.is_active
    AND public.user_has_permission(usr.id,'manage_locations','create',bu)
    AND EXISTS (SELECT 1 FROM public.user_business_unit_access a WHERE a.user_id=usr.id AND a.business_unit_id=bu) LIMIT 1;
  IF u IS NULL THEN RAISE EXCEPTION 'AUTHORIZED_SEED_USER_REQUIRED'; END IF;
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,code,location_type,name)
    VALUES(c,w,'__AUTOTEST','rack','Source') RETURNING id INTO root;
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,code,location_type,is_active)
    VALUES(c,w,'__AUTOCLOSED','zone',false) RETURNING id INTO closed;

  INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,code,location_type,name,max_capacity)
    VALUES(c,w,root,'__AUTOTEST-S','shelf','Shelf',50) RETURNING id INTO child;
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,code,location_type,name,max_capacity)
    VALUES(c,w,child,'__AUTOTEST-B','bin','Fail 12',40);
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,code,location_type)
    VALUES(c,w,'__AUTOBIG','zone') RETURNING id INTO big;
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,code,location_type)
    SELECT c,w,big,'__AUTOBIG-'||series.value,'bin' FROM generate_series(1,200) AS series(value);
  PERFORM set_config('request.jwt.claim.sub',u::TEXT,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::TEXT,true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO n FROM public.plan_warehouse_location_copy(bu,root,NULL,'Source','Copy');
  IF n<>3 THEN RAISE EXCEPTION 'PLAN_COUNT_FAILED'; END IF;
  SELECT p.root_id,p.created_count INTO r FROM public.copy_warehouse_location_structure(bu,root,NULL,'Source','Copy') p;
  IF r.created_count<>3 OR NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE id=r.root_id AND name='Copy')
    OR NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE path_ids @> ARRAY[r.root_id] AND name='Fail 12' AND max_capacity=40)
    THEN RAISE EXCEPTION 'COPY_FAILED'; END IF;
  IF (SELECT count(*) FROM public.warehouse_locations WHERE path_ids @> ARRAY[root])<>3 THEN RAISE EXCEPTION 'SOURCE_CHANGED'; END IF;
  BEGIN
    PERFORM public.copy_warehouse_location_structure(bu,root,child,NULL,NULL);
    RAISE EXCEPTION 'CYCLE_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'LOCATION_HIERARCHY_CYCLE' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.plan_warehouse_location_copy(bu,big,NULL,NULL,NULL);
    RAISE EXCEPTION 'OVERSIZED_COPY_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'LOCATION_COPY_TOO_LARGE' THEN RAISE; END IF; END;
  SELECT count(*) INTO before_count FROM public.warehouse_locations WHERE warehouse_id=w;
  SELECT COALESCE(sum(last_number),0) INTO before_seq FROM public.document_code_sequences;
  PERFORM set_config('test.location_failure','on',true);
  BEGIN
    PERFORM public.copy_warehouse_location_structure(bu,root,NULL,NULL,NULL);
    RAISE EXCEPTION 'FORCED_FAILURE_MISSING';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'TEST_FORCED_ROW_FAILURE' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.warehouse_locations WHERE warehouse_id=w)<>before_count
    OR (SELECT COALESCE(sum(last_number),0) FROM public.document_code_sequences)<>before_seq
    THEN RAISE EXCEPTION 'COPY_ROLLBACK_FAILED'; END IF;
END $$;
ROLLBACK;
