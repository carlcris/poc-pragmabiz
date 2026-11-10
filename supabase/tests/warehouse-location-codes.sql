-- Authenticated integration and rollback checks. All fixture/data changes roll back.
BEGIN;
-- Exercise allocation without direct access, even on permissive local databases.
REVOKE SELECT ON public.document_code_sequences FROM authenticated, PUBLIC;
CREATE FUNCTION pg_temp.fail_location_code_test() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.location_failure', true) = 'on' AND NEW.name = 'Fail second' THEN
    RAISE EXCEPTION 'TEST_FORCED_FAILURE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER z_test_location_failure AFTER INSERT OR UPDATE ON public.warehouse_locations
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_location_code_test();
DO $$
DECLARE c UUID; w UUID; bu UUID; u UUID; root UUID; dest UUID; rack UUID; bin UUID; long_parent UUID;
  r RECORD; old_code TEXT; old_path TEXT; n INTEGER; before_count INTEGER; before_seq NUMERIC;
BEGIN
  SELECT wh.company_id,wh.id,wh.business_unit_id INTO c,w,bu
    FROM public.warehouses wh WHERE wh.deleted_at IS NULL AND wh.is_active LIMIT 1;
  SELECT usr.id INTO u FROM public.users usr WHERE usr.company_id=c AND usr.is_active
    AND public.user_has_permission(usr.id,'manage_locations','create',bu)
    AND EXISTS (SELECT 1 FROM public.user_business_unit_access a WHERE a.user_id=usr.id AND a.business_unit_id=bu) LIMIT 1;
  IF u IS NULL THEN RAISE EXCEPTION 'AUTHORIZED_FIXTURE_REQUIRED'; END IF;
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,code,location_type)
    VALUES(c,w,'__CODE_TEST','zone') RETURNING id INTO root;
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,code,location_type)
    VALUES(c,w,'__CODE_DEST','zone') RETURNING id INTO dest;
  -- A historical/soft-deleted code is never reused by the allocator.
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,code,location_type,deleted_at)
    VALUES(c,w,root,'__CODE_TEST-R01','rack',now());
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,code,location_type)
    VALUES(c,w,repeat('L',96),'rack') RETURNING id INTO long_parent;
  -- Padding must not truncate the allocator result once it exceeds nine digits.
  INSERT INTO public.document_code_sequences(company_id,code_prefix,last_number)
    VALUES(c,'warehouse-location:' || w::TEXT || ':__CODE_TEST-C',999999999)
    ON CONFLICT (company_id,code_prefix) DO UPDATE SET last_number=999999999;
  PERFORM set_config('request.jwt.claim.sub',u::TEXT,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::TEXT,true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,location_type)
    VALUES(c,w,root,'crate') RETURNING code INTO old_code;
  IF old_code <> '__CODE_TEST-C1000000000' THEN RAISE EXCEPTION 'ALLOCATION_TRUNCATED'; END IF;
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,location_type,name)
    VALUES(c,w,root,'rack','Rack') RETURNING id,code INTO r;
  rack:=r.id;
  IF r.code <> '__CODE_TEST-R02' THEN RAISE EXCEPTION 'COLLISION_SKIP_FAILED: %',r.code; END IF;
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,location_type,name)
    VALUES(c,w,rack,'bin','Fail second') RETURNING id,code INTO r;
  bin:=r.id;
  IF r.code <> '__CODE_TEST-R02-B01' THEN RAISE EXCEPTION 'PARENT_CODE_FAILED'; END IF;
  BEGIN
    INSERT INTO public.warehouse_locations(company_id,warehouse_id,code) VALUES(c,w,'BAD');
    RAISE EXCEPTION 'MANUAL_CODE_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_CODE_READ_ONLY' THEN RAISE; END IF; END;
  SELECT l.code,l.location_path INTO old_code,old_path FROM public.warehouse_locations l WHERE id=rack;
  RESET ROLE;
  SELECT COALESCE(sum(last_number),0) INTO before_seq FROM public.document_code_sequences;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.location_failure','on',true);
  BEGIN
    PERFORM public.update_warehouse_location(bu,rack,jsonb_build_object('parent_id',dest));
    RAISE EXCEPTION 'MOVE_FAILURE_NOT_TRIGGERED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'TEST_FORCED_FAILURE' THEN RAISE; END IF; END;
  RESET ROLE;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE id=rack AND code=old_code AND parent_id=root AND location_path=old_path)
    OR NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE id=bin AND code='__CODE_TEST-R02-B01')
    OR (SELECT COALESCE(sum(last_number),0) FROM public.document_code_sequences) <> before_seq
    THEN RAISE EXCEPTION 'MOVE_ROLLBACK_FAILED'; END IF;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.location_failure','off',true);
  PERFORM public.update_warehouse_location(bu,rack,jsonb_build_object('parent_id',dest));
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE id=rack AND code='__CODE_DEST-R01' AND parent_id=dest)
    OR NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE id=bin AND code='__CODE_DEST-R01-B01'
      AND path_ids=ARRAY[dest,rack,bin] AND location_path LIKE '%__CODE_DEST-R01-B01%')
    THEN RAISE EXCEPTION 'MOVE_REGENERATION_FAILED'; END IF;
  PERFORM public.update_warehouse_location(bu,rack,jsonb_build_object('location_type','shelf'));
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE id=bin AND code='__CODE_DEST-S01-B01')
    THEN RAISE EXCEPTION 'TYPE_REGENERATION_FAILED'; END IF;
  BEGIN
    PERFORM public.update_warehouse_location(bu,dest,jsonb_build_object('parent_id',bin));
    RAISE EXCEPTION 'CYCLE_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_HIERARCHY_CYCLE' THEN RAISE; END IF; END;

  SELECT count(*) INTO before_count FROM public.warehouse_locations WHERE warehouse_id=w;
  SELECT p.created_count INTO n FROM public.create_warehouse_locations_batch(bu,w,1,100,'bin',true,true,true,root,'Bin ',NULL) p;
  IF n<>100 OR NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE parent_id=root AND code='__CODE_TEST-B100')
    THEN RAISE EXCEPTION 'BATCH_WIDTH_FAILED'; END IF;
  BEGIN
    PERFORM public.create_warehouse_locations_batch(bu,w,1,101,'bin',true,true,true,root,'Bin ',NULL);
    RAISE EXCEPTION 'UNBOUNDED_BATCH_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_BATCH_INVALID' THEN RAISE; END IF; END;
  SELECT count(*) INTO n FROM public.preview_warehouse_locations_batch(bu,w,1,3,'crate',root,'Crate ');
  IF n<>3 THEN RAISE EXCEPTION 'PREVIEW_FAILED'; END IF;

  SELECT p.root_id,p.created_count INTO r FROM public.copy_warehouse_location_structure(bu,rack,root,NULL,NULL) p;
  IF r.created_count<>2 OR NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE id=r.root_id AND code='__CODE_TEST-S01')
    OR NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE parent_id=r.root_id AND code='__CODE_TEST-S01-B01')
    THEN RAISE EXCEPTION 'COPY_GENERATION_FAILED'; END IF;
  SELECT count(*) INTO before_count FROM public.warehouse_locations WHERE warehouse_id=w;
  RESET ROLE;
  SELECT COALESCE(sum(last_number),0) INTO before_seq FROM public.document_code_sequences;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.location_failure','on',true);
  BEGIN
    PERFORM public.copy_warehouse_location_structure(bu,rack,root,NULL,NULL);
    RAISE EXCEPTION 'COPY_FAILURE_NOT_TRIGGERED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'TEST_FORCED_FAILURE' THEN RAISE; END IF; END;
  RESET ROLE;
  IF (SELECT count(*) FROM public.warehouse_locations WHERE warehouse_id=w)<>before_count
    OR (SELECT COALESCE(sum(last_number),0) FROM public.document_code_sequences)<>before_seq
    THEN RAISE EXCEPTION 'COPY_ROLLBACK_FAILED'; END IF;
  SET LOCAL ROLE authenticated;
  PERFORM set_config('test.location_failure','off',true);
  BEGIN
    PERFORM public.update_warehouse_location(bu,rack,jsonb_build_object('code','MANUAL'));
    RAISE EXCEPTION 'RPC_CODE_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_CODE_READ_ONLY' THEN RAISE; END IF; END;
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,location_type)
    VALUES(c,w,long_parent,'bin') RETURNING id,code INTO r;
  IF length(r.code)<>100 THEN RAISE EXCEPTION 'CODE_LENGTH_BOUNDARY_FAILED'; END IF;
  BEGIN
    INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,location_type)
      VALUES(c,w,r.id,'crate');
    RAISE EXCEPTION 'OVERLONG_CODE_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'LOCATION_CODE_TOO_LONG' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::TEXT,true);
  BEGIN
    PERFORM public.create_warehouse_locations_batch(bu,w,1,2,'bin',true,true,true,root,'Bin ',NULL);
    RAISE EXCEPTION 'UNAUTHORIZED_BATCH_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_WAREHOUSE_INVALID' THEN RAISE; END IF; END;
END $$;
ROLLBACK;
