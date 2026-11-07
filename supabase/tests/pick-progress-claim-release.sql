-- Run against a local database containing an active allocated pick list.
-- All fixture changes, fault injection, and picking operations are rolled back.
\set ON_ERROR_STOP on
BEGIN;

CREATE FUNCTION pg_temp.reject_pick_claim_release() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.fail_pick_claim_release', true) = 'on'
     AND NEW.released_at IS NOT NULL THEN
    RAISE EXCEPTION 'TEST_PICK_CLAIM_RELEASE_FAILURE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_pick_claim_release_failure
BEFORE UPDATE ON public.pick_list_item_claims
FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_pick_claim_release();

DO $test$
DECLARE
  v_context record;
  v_operation uuid := gen_random_uuid();
  v_final_operation uuid := gen_random_uuid();
  v_quantity numeric;
BEGIN
  SELECT list.id AS list_id, list.company_id, list.business_unit_id,
    list.created_by AS actor_id, item.id AS item_id, item.dn_item_id,
    item.allocated_qty, item.suggested_batch_location_sku AS sku
  INTO STRICT v_context
  FROM public.pick_lists list
  JOIN public.pick_list_items item ON item.pick_list_id = list.id
  WHERE list.status = 'in_progress' AND list.deleted_at IS NULL
    AND item.allocated_qty >= 0.02 AND item.suggested_batch_location_sku IS NOT NULL
    AND public.user_has_permission(list.created_by, 'pick_lists', 'edit', list.business_unit_id)
  ORDER BY list.id, item.id
  LIMIT 1;

  -- Reset only this fixture inside the surrounding rollback transaction.
  DELETE FROM public.delivery_note_item_picks WHERE pick_list_item_id = v_context.item_id;
  DELETE FROM public.pick_list_item_pick_operations WHERE pick_list_item_id = v_context.item_id;
  DELETE FROM public.pick_list_item_claims WHERE pick_list_id = v_context.list_id;
  UPDATE public.pick_list_items SET picked_qty = 0, short_qty = allocated_qty
  WHERE id = v_context.item_id;
  UPDATE public.delivery_note_items SET picked_qty = 0, short_qty = allocated_qty
  WHERE id = v_context.dn_item_id;
  PERFORM set_config('request.jwt.claim.sub', v_context.actor_id::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_context.actor_id, 'current_business_unit_id', v_context.business_unit_id
  )::text, true);
  v_quantity := trunc(v_context.allocated_qty / 2, 2);

  PERFORM public.claim_pick_list_item(v_context.company_id, v_context.actor_id,
    v_context.list_id, v_context.item_id);
  BEGIN
    UPDATE public.pick_lists SET status = 'done' WHERE id = v_context.list_id;
    RAISE EXCEPTION 'Expected active claim to block completion';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'PICK_LIST_ACTIVE_CLAIMS' THEN RAISE; END IF;
  END;

  -- Fail at the final claim update, after quantity and operation writes.
  PERFORM set_config('test.fail_pick_claim_release', 'on', true);
  BEGIN
    PERFORM public.record_pick_list_item_progress(v_context.company_id, v_context.actor_id,
      v_context.list_id, v_context.item_id, v_operation, v_quantity, v_context.sku);
    RAISE EXCEPTION 'Expected injected claim release failure';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'TEST_PICK_CLAIM_RELEASE_FAILURE' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.pick_list_item_pick_operations WHERE operation_id = v_operation)
     OR EXISTS (SELECT 1 FROM public.delivery_note_item_picks WHERE pick_list_item_id = v_context.item_id)
     OR EXISTS (SELECT 1 FROM public.pick_list_items WHERE id = v_context.item_id AND picked_qty <> 0)
     OR EXISTS (SELECT 1 FROM public.delivery_note_items WHERE id = v_context.dn_item_id AND picked_qty <> 0)
     OR NOT EXISTS (SELECT 1 FROM public.pick_list_item_claims
       WHERE pick_list_item_id = v_context.item_id AND released_at IS NULL) THEN
    RAISE EXCEPTION 'Failed confirmation left partial writes or released its claim';
  END IF;

  PERFORM set_config('test.fail_pick_claim_release', 'off', true);
  PERFORM public.record_pick_list_item_progress(v_context.company_id, v_context.actor_id,
    v_context.list_id, v_context.item_id, v_operation, v_quantity, v_context.sku);
  IF NOT EXISTS (SELECT 1 FROM public.pick_list_item_claims
    WHERE pick_list_item_id = v_context.item_id AND released_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Partial confirmation retained its claim';
  END IF;
  -- A retry must not duplicate quantity or release a subsequently acquired claim.
  PERFORM public.claim_pick_list_item(v_context.company_id, v_context.actor_id,
    v_context.list_id, v_context.item_id);
  PERFORM public.record_pick_list_item_progress(v_context.company_id, v_context.actor_id,
    v_context.list_id, v_context.item_id, v_operation, v_quantity, v_context.sku);
  IF NOT EXISTS (SELECT 1 FROM public.pick_list_items
      WHERE id = v_context.item_id AND picked_qty = v_quantity)
     OR NOT EXISTS (SELECT 1 FROM public.pick_list_item_claims
      WHERE pick_list_item_id = v_context.item_id AND released_at IS NULL) THEN
    RAISE EXCEPTION 'Retry changed quantity or released a new claim';
  END IF;

  PERFORM public.record_pick_list_item_progress(v_context.company_id, v_context.actor_id,
    v_context.list_id, v_context.item_id, v_final_operation,
    v_context.allocated_qty - v_quantity, v_context.sku);
  IF EXISTS (SELECT 1 FROM public.pick_list_item_claims
    WHERE pick_list_item_id = v_context.item_id AND released_at IS NULL) THEN
    RAISE EXCEPTION 'Final confirmation retained its claim and would disable Finish';
  END IF;
  PERFORM public.complete_pick_list_transaction(v_context.company_id, v_context.actor_id,
    v_context.list_id, '[]'::jsonb);
  IF NOT EXISTS (SELECT 1 FROM public.pick_lists WHERE id = v_context.list_id AND status = 'done') THEN
    RAISE EXCEPTION 'Finish did not complete the pick list';
  END IF;
END;
$test$;
ROLLBACK;
