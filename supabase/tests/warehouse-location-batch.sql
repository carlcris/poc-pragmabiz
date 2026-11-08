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
  PERFORM set_config('request.jwt.claim.sub',u::TEXT,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::TEXT,true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO n FROM public.preview_warehouse_locations_batch(bu,w,9,11,'bin',root,'Bin ');
  IF n<>3 THEN RAISE EXCEPTION 'PREVIEW_COUNT_FAILED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.preview_warehouse_locations_batch(bu,w,9,11,'bin',root,'Bin ') p
    WHERE p.name='Bin 10' AND p.code='__AUTOTEST-B…') THEN RAISE EXCEPTION 'PREVIEW_NAME_FAILED'; END IF;
  SELECT p.created_count INTO n FROM public.create_warehouse_locations_batch(bu,w,9,11,'bin',true,true,true,root,'Bin ',40) p;
  IF n<>3 OR NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE parent_id=root AND code='__AUTOTEST-B03' AND name='Bin 11' AND max_capacity=40)
    THEN RAISE EXCEPTION 'CREATE_FAILED'; END IF;
  -- Repeating a name range allocates fresh codes instead of skipping or colliding.
  SELECT p.created_count INTO n FROM public.create_warehouse_locations_batch(bu,w,9,11,'bin',true,true,true,root,'Bin ',40) p;
  IF n<>3 OR NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE parent_id=root AND code='__AUTOTEST-B06')
    THEN RAISE EXCEPTION 'REPEATED_RANGE_FAILED'; END IF;
  SELECT count(*) INTO before_count FROM public.warehouse_locations WHERE warehouse_id=w;
  SELECT COALESCE(sum(last_number),0) INTO before_seq FROM public.document_code_sequences;
  PERFORM set_config('test.location_failure','on',true);
  BEGIN
    PERFORM public.create_warehouse_locations_batch(bu,w,11,13,'crate',true,true,true,root,'Fail ',NULL);
    RAISE EXCEPTION 'FORCED_FAILURE_MISSING';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'TEST_FORCED_ROW_FAILURE' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.warehouse_locations WHERE warehouse_id=w)<>before_count
    OR (SELECT COALESCE(sum(last_number),0) FROM public.document_code_sequences)<>before_seq
    THEN RAISE EXCEPTION 'BATCH_ROLLBACK_FAILED'; END IF;
  BEGIN
    PERFORM public.create_warehouse_locations_batch(bu,w,1,2,'bin',true,true,true,closed,'Bin ',NULL);
    RAISE EXCEPTION 'INACTIVE_PARENT_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'LOCATION_PARENT_INVALID' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.create_warehouse_locations_batch(bu,w,1,2,'bin',false,false,true,root,'Bin ',10);
    RAISE EXCEPTION 'INVALID_CAPACITY_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'CAPACITY_REQUIRES_STORABLE_LOCATION' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.preview_warehouse_locations_batch(bu,w,1,101,'bin',root,'Bin ');
    RAISE EXCEPTION 'OVERSIZED_BATCH_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'LOCATION_BATCH_INVALID' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
