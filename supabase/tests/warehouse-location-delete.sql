-- Run with psql -v ON_ERROR_STOP=1. Fixtures and trigger roll back.
BEGIN;
CREATE FUNCTION public.test_location_delete_failure() RETURNS TRIGGER
LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.name = '__DELETE_FAIL' AND NEW.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'TEST_FORCED_FAILURE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER test_location_delete_failure AFTER UPDATE ON public.warehouse_locations
FOR EACH ROW EXECUTE FUNCTION public.test_location_delete_failure();
DO $$
DECLARE c UUID; w UUID; bu UUID; u UUID; item UUID; batch UUID;
  preferred_row UUID; parent UUID; leaf UUID; stock UUID; task UUID; missing UUID := gen_random_uuid();
BEGIN
  SELECT s.company_id,s.warehouse_id,wh.business_unit_id,s.item_id,s.item_batch_id
    INTO c,w,bu,item,batch FROM public.item_batch_locations s
    JOIN public.warehouses wh ON wh.id=s.warehouse_id
    WHERE s.deleted_at IS NULL AND wh.deleted_at IS NULL AND wh.is_active LIMIT 1;
  SELECT usr.id INTO u FROM public.users usr WHERE usr.company_id=c AND usr.is_active
    AND public.user_has_permission(usr.id,'manage_locations','delete',bu)
    AND EXISTS (SELECT 1 FROM public.user_business_unit_access a WHERE a.user_id=usr.id AND a.business_unit_id=bu) LIMIT 1;
  IF u IS NULL OR batch IS NULL THEN RAISE EXCEPTION 'AUTHORIZED_STOCK_FIXTURE_REQUIRED'; END IF;
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,code,location_type)
    VALUES(c,w,'__DELETE_PARENT','zone') RETURNING id INTO parent;
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,code,location_type)
    VALUES(c,w,parent,'__DELETE_LEAF','bin') RETURNING id INTO leaf;
  INSERT INTO public.item_batch_locations(company_id,warehouse_id,item_id,item_batch_id,location_id,qty_on_hand,qty_reserved)
    VALUES(c,w,item,batch,leaf,10,2) RETURNING id INTO stock;
  PERFORM set_config('request.jwt.claim.sub',u::TEXT,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::TEXT,true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.delete_warehouse_location(bu,parent);
    RAISE EXCEPTION 'CHILDREN_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_HAS_CHILDREN' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.delete_warehouse_location(bu,leaf);
    RAISE EXCEPTION 'STOCK_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_IN_USE' THEN RAISE; END IF; END;
  RESET ROLE;
  UPDATE public.item_batch_locations SET qty_on_hand=0,qty_reserved=0 WHERE id=stock;
  INSERT INTO public.putaway_tasks(company_id,business_unit_id,warehouse_id,item_id,source_type,source_id,source_line_id,quantity,pending_quantity,suggested_location_id,source_unit_name,source_qty_per_unit)
    VALUES(c,bu,w,item,'grn',gen_random_uuid(),gen_random_uuid(),1,1,leaf,'unit',1) RETURNING id INTO task;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.delete_warehouse_location(bu,leaf);
    RAISE EXCEPTION 'PUTAWAY_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_IN_USE' THEN RAISE; END IF; END;
  RESET ROLE;
  UPDATE public.putaway_tasks SET status='partial' WHERE id=task;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.delete_warehouse_location(bu,leaf);
    RAISE EXCEPTION 'PARTIAL_PUTAWAY_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_IN_USE' THEN RAISE; END IF; END;
  RESET ROLE;
  UPDATE public.putaway_tasks SET status='cancelled' WHERE id=task;
  SELECT id INTO preferred_row
    FROM public.item_warehouse WHERE item_id=item AND warehouse_id=w AND deleted_at IS NULL LIMIT 1;
  IF preferred_row IS NULL THEN RAISE EXCEPTION 'ITEM_WAREHOUSE_FIXTURE_REQUIRED'; END IF;
  UPDATE public.item_warehouse SET default_location_id=leaf WHERE id=preferred_row;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.delete_warehouse_location(bu,leaf);
    RAISE EXCEPTION 'PREFERRED_LOCATION_DELETED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_IS_PREFERRED' THEN RAISE; END IF; END;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE id=leaf AND deleted_at IS NULL AND is_active)
    OR NOT EXISTS (SELECT 1 FROM public.item_warehouse WHERE id=preferred_row AND default_location_id=leaf) THEN
    RAISE EXCEPTION 'PREFERENCE_CHANGED_ON_REJECTION';
  END IF;
  RESET ROLE;
  UPDATE public.item_warehouse SET default_location_id=NULL WHERE id=preferred_row;
  UPDATE public.warehouse_locations SET name='__DELETE_FAIL' WHERE id=leaf;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.delete_warehouse_location(bu,leaf);
    RAISE EXCEPTION 'FAILURE_NOT_TRIGGERED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'TEST_FORCED_FAILURE' THEN RAISE; END IF; END;
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE id=leaf AND deleted_at IS NULL AND is_active) THEN
    RAISE EXCEPTION 'DELETE_ROLLBACK_FAILED';
  END IF;
  RESET ROLE;
  UPDATE public.warehouse_locations SET name=NULL,is_active=FALSE WHERE id=leaf;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM public.delete_warehouse_location(bu,parent);
    RAISE EXCEPTION 'INACTIVE_CHILD_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_HAS_CHILDREN' THEN RAISE; END IF; END;
  PERFORM public.delete_warehouse_location(bu,leaf);
  IF NOT EXISTS (SELECT 1 FROM public.warehouse_locations WHERE id=leaf AND deleted_at IS NOT NULL AND NOT is_active AND updated_by=u) THEN
    RAISE EXCEPTION 'DELETE_FAILED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.item_batch_locations WHERE id=stock AND location_id=leaf) THEN
    RAISE EXCEPTION 'HISTORY_REMOVED';
  END IF;
  BEGIN
    PERFORM public.delete_warehouse_location(bu,leaf);
    RAISE EXCEPTION 'REPEATED_DELETE_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'WAREHOUSE_LOCATION_NOT_FOUND' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.item_warehouse SET default_location_id=leaf WHERE id=preferred_row;
    RAISE EXCEPTION 'DELETED_LOCATION_ASSIGNED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_STORAGE_UNAVAILABLE' THEN RAISE; END IF; END;
  IF EXISTS (SELECT 1 FROM public.item_warehouse WHERE id=preferred_row AND default_location_id IS NOT NULL) THEN
    RAISE EXCEPTION 'FAILED_ASSIGNMENT_CHANGED_PREFERENCE';
  END IF;
  PERFORM public.delete_warehouse_location(bu,parent);
  PERFORM set_config('request.jwt.claim.sub',missing::TEXT,true);
  BEGIN
    PERFORM public.delete_warehouse_location(bu,missing);
    RAISE EXCEPTION 'UNAUTHORIZED_DELETE_ACCEPTED';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'LOCATION_DELETE_FORBIDDEN' THEN RAISE; END IF; END;
  RESET ROLE;
  RAISE NOTICE 'PASS: authenticated deletion, children, inactive children, stock/reservations, pending putaway, preferred-location protection, deleted-location assignment, rollback, history, duplicate and permission checks';
END $$;
ROLLBACK;
