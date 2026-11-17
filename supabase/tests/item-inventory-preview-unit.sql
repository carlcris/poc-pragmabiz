-- Run against the seeded local DB after applying the inventory preview migration.
-- docker exec -i supabase_db_backend psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/item-inventory-preview-unit.sql
-- All fixtures and failure triggers are rolled back.
BEGIN;

CREATE TEMP TABLE inventory_preview_test_context ON COMMIT DROP AS
WITH stale_scope AS (SELECT gen_random_uuid() AS business_unit_id)
SELECT actor.id AS actor_id, denied.id AS denied_id, actor.company_id,
  unit.id AS business_unit_id, stale_scope.business_unit_id AS stale_business_unit_id, uom.id AS uom_id,
  gen_random_uuid() AS item_id, gen_random_uuid() AS other_item_id, gen_random_uuid() AS base_id,
  gen_random_uuid() AS first_id, gen_random_uuid() AS second_id
FROM public.users actor
JOIN public.user_business_unit_access access_row ON access_row.user_id = actor.id
JOIN public.business_units unit ON unit.id = access_row.business_unit_id
  AND unit.company_id = actor.company_id AND unit.is_active IS TRUE
JOIN public.user_business_unit_access denied_access ON denied_access.business_unit_id = unit.id
JOIN public.users denied ON denied.id = denied_access.user_id AND denied.company_id = actor.company_id
JOIN public.units_of_measure uom ON uom.company_id = actor.company_id AND uom.deleted_at IS NULL
CROSS JOIN stale_scope
WHERE actor.is_active IS TRUE AND actor.deleted_at IS NULL
  AND denied.is_active IS TRUE AND denied.deleted_at IS NULL
  AND public.user_has_permission(actor.id, 'items', 'edit', unit.id)
  AND public.user_has_permission(actor.id, 'items', 'edit', stale_scope.business_unit_id)
  AND NOT public.user_has_permission(denied.id, 'items', 'edit', unit.id)
ORDER BY actor.id, denied.id, unit.id, uom.id
LIMIT 1;

INSERT INTO public.business_units (id, company_id, code, name)
SELECT stale_business_unit_id, company_id, 'PREVIEW-' || LEFT(stale_business_unit_id::TEXT, 8),
  'Business unit for stale claim'
FROM inventory_preview_test_context;

INSERT INTO public.items (id, company_id, item_code, item_name, uom_id, item_type)
SELECT fixture.id, context.company_id, 'PREVIEW-' || LEFT(fixture.id::TEXT, 8),
  'Inventory preview test', context.uom_id, 'product'
FROM inventory_preview_test_context context
CROSS JOIN LATERAL (VALUES (context.item_id), (context.other_item_id)) fixture(id);

INSERT INTO public.item_unit_options (id, company_id, item_id, uom_id, qty_per_unit, is_base, is_default)
SELECT fixture.id, context.company_id, context.item_id, context.uom_id, fixture.qty, fixture.base, fixture.base
FROM inventory_preview_test_context context
CROSS JOIN LATERAL (VALUES (context.base_id, 1, TRUE), (context.first_id, 50, FALSE),
  (context.second_id, 100, FALSE)) fixture(id, qty, base);

GRANT SELECT ON inventory_preview_test_context TO authenticated;

CREATE FUNCTION pg_temp.fail_inventory_preview_replacement() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_inventory_preview AND current_setting('test.fail_inventory_preview', TRUE) = 'on' THEN
    IF EXISTS (SELECT 1 FROM public.item_unit_options old_option
      WHERE old_option.item_id = NEW.item_id AND old_option.id <> NEW.id AND old_option.is_inventory_preview) THEN
      RAISE EXCEPTION 'Previous inventory preview was not cleared before replacement';
    END IF;
    RAISE EXCEPTION 'TEST_INVENTORY_PREVIEW_LATE_FAILURE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_fail_inventory_preview_replacement BEFORE UPDATE OF is_inventory_preview
  ON public.item_unit_options FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_inventory_preview_replacement();

CREATE FUNCTION pg_temp.fail_item_default_replacement() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_default AND NOT OLD.is_default
    AND current_setting('test.fail_item_default_replacement', TRUE) = 'on' THEN
    IF EXISTS (
      SELECT 1 FROM public.item_unit_options prior_default
      WHERE prior_default.item_id = NEW.item_id AND prior_default.id <> NEW.id
        AND prior_default.deleted_at IS NULL AND prior_default.is_default
    ) THEN
      RAISE EXCEPTION 'Previous default was not cleared before replacement';
    END IF;
    RAISE EXCEPTION 'TEST_ITEM_DEFAULT_LATE_FAILURE';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_fail_item_default_replacement BEFORE UPDATE OF is_default
  ON public.item_unit_options FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_item_default_replacement();

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  context RECORD;
  updated_option RECORD;
BEGIN
  SELECT actor_id, denied_id, company_id, business_unit_id, stale_business_unit_id,
    item_id, other_item_id, base_id, first_id, second_id
    INTO context FROM inventory_preview_test_context;
  IF NOT FOUND THEN RAISE EXCEPTION 'Test needs a global item editor and a user without item edit permission in the same active BU'; END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', context.actor_id,
    'role', 'authenticated', 'current_business_unit_id', context.business_unit_id)::TEXT, TRUE);
  PERFORM public.set_item_inventory_preview_unit(context.company_id, context.item_id,
    context.first_id, TRUE, context.business_unit_id);

  PERFORM set_config('test.fail_inventory_preview', 'on', TRUE);
  BEGIN
    PERFORM public.set_item_inventory_preview_unit(context.company_id, context.item_id,
      context.second_id, TRUE, context.business_unit_id);
    RAISE EXCEPTION 'Expected the replacement to fail';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'TEST_INVENTORY_PREVIEW_LATE_FAILURE' THEN RAISE; END IF;
  END;
  PERFORM set_config('test.fail_inventory_preview', 'off', TRUE);
  IF NOT EXISTS (SELECT 1 FROM public.item_unit_options WHERE id = context.first_id AND is_inventory_preview) THEN
    RAISE EXCEPTION 'Failed replacement did not restore the previous preview';
  END IF;

  PERFORM public.set_item_inventory_preview_unit(context.company_id, context.item_id,
    context.second_id, TRUE, context.business_unit_id);
  PERFORM public.set_item_inventory_preview_unit(context.company_id, context.item_id,
    context.first_id, FALSE, context.business_unit_id);
  IF NOT EXISTS (SELECT 1 FROM public.item_unit_options WHERE id = context.second_id AND is_inventory_preview)
    OR NOT EXISTS (SELECT 1 FROM public.item_unit_options WHERE id = context.base_id AND is_default) THEN
    RAISE EXCEPTION 'Replacing the preview or clearing a stale selection changed the wrong option';
  END IF;

  BEGIN
    PERFORM public.set_item_inventory_preview_unit(context.company_id, context.item_id,
      context.base_id, TRUE, context.business_unit_id);
    RAISE EXCEPTION 'Base option was accepted for preview';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  UPDATE public.item_unit_options SET is_active = FALSE WHERE id = context.second_id;
  BEGIN
    PERFORM public.set_item_inventory_preview_unit(context.company_id, context.item_id,
      context.second_id, TRUE, context.business_unit_id);
    RAISE EXCEPTION 'Inactive option was accepted for preview';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  UPDATE public.item_unit_options SET is_active = TRUE WHERE id = context.second_id;
  IF EXISTS (SELECT 1 FROM public.item_unit_options WHERE item_id = context.item_id AND is_inventory_preview) THEN
    RAISE EXCEPTION 'Reactivation restored a cleared preview';
  END IF;

  PERFORM public.set_item_inventory_preview_unit(context.company_id, context.item_id,
    context.second_id, TRUE, context.business_unit_id);
  UPDATE public.item_unit_options SET deleted_at = NOW() WHERE id = context.second_id;
  IF EXISTS (SELECT 1 FROM public.item_unit_options WHERE item_id = context.item_id AND is_inventory_preview) THEN
    RAISE EXCEPTION 'Deleting the option did not clear the preview';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', context.denied_id,
    'role', 'authenticated', 'current_business_unit_id', context.business_unit_id)::TEXT, TRUE);
  BEGIN
    PERFORM public.set_item_inventory_preview_unit(context.company_id, context.item_id,
      context.first_id, TRUE, context.business_unit_id);
    RAISE EXCEPTION 'User without item edit permission could nominate a preview through the RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.item_unit_options SET is_inventory_preview = TRUE WHERE id = context.first_id;
    RAISE EXCEPTION 'User without item edit permission could nominate a preview directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', context.actor_id,
    'role', 'authenticated', 'current_business_unit_id', context.business_unit_id)::TEXT, TRUE);
  PERFORM public.set_item_inventory_preview_unit(context.company_id, context.item_id,
    context.first_id, TRUE, context.business_unit_id);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', context.denied_id,
    'role', 'authenticated', 'current_business_unit_id', context.business_unit_id)::TEXT, TRUE);
  BEGIN
    UPDATE public.item_unit_options SET item_id = context.other_item_id WHERE id = context.first_id;
    RAISE EXCEPTION 'User without item edit permission could move a preview to a different item';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.item_unit_options SET is_active = FALSE WHERE id = context.first_id;
    RAISE EXCEPTION 'User without item edit permission could deactivate the preview';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.item_unit_options SET qty_per_unit = 25 WHERE id = context.first_id;
    RAISE EXCEPTION 'User without item edit permission could change the preview conversion';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  IF NOT EXISTS (SELECT 1 FROM public.item_unit_options WHERE id = context.first_id
    AND item_id = context.item_id AND is_inventory_preview AND is_active AND qty_per_unit = 50) THEN
    RAISE EXCEPTION 'Denied writes changed the preview';
  END IF;

  -- The session claim still names an active BU, but the editor has no membership there.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', context.actor_id,
    'role', 'authenticated', 'current_business_unit_id', context.stale_business_unit_id)::TEXT, TRUE);
  IF public.get_current_business_unit_id() IS DISTINCT FROM context.stale_business_unit_id
    OR EXISTS (
      SELECT 1 FROM public.user_business_unit_access membership
      WHERE membership.user_id = context.actor_id AND membership.business_unit_id = context.stale_business_unit_id
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.get_user_permissions(context.actor_id, context.stale_business_unit_id) permission
      WHERE permission.resource = 'items' AND permission.can_edit
    ) THEN
    RAISE EXCEPTION 'Expected a stale claim with Items edit from the application permission lookup';
  END IF;
  BEGIN
    PERFORM public.update_item_unit_option(context.company_id, context.item_id, context.first_id,
      context.stale_business_unit_id, p_qty_per_unit => 25, p_is_default => TRUE);
    RAISE EXCEPTION 'Stale business unit claim updated a unit option';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'ITEM_UNIT_OPTION_UPDATE_FORBIDDEN' THEN RAISE; END IF;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.item_unit_options WHERE id = context.base_id AND is_default)
    OR NOT EXISTS (SELECT 1 FROM public.item_unit_options WHERE id = context.first_id
      AND NOT is_default AND is_inventory_preview AND qty_per_unit = 50) THEN
    RAISE EXCEPTION 'Stale business unit claim changed default or preview state';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', context.actor_id,
    'role', 'authenticated', 'current_business_unit_id', context.business_unit_id)::TEXT, TRUE);
  PERFORM set_config('test.fail_item_default_replacement', 'on', TRUE);
  BEGIN
    PERFORM public.update_item_unit_option(context.company_id, context.item_id, context.first_id,
      context.business_unit_id, p_qty_per_unit => 25, p_is_default => TRUE);
    RAISE EXCEPTION 'Expected a failure after clearing the default';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'TEST_ITEM_DEFAULT_LATE_FAILURE' THEN RAISE; END IF;
  END;
  PERFORM set_config('test.fail_item_default_replacement', 'off', TRUE);
  IF NOT EXISTS (SELECT 1 FROM public.item_unit_options WHERE id = context.base_id AND is_default)
    OR NOT EXISTS (SELECT 1 FROM public.item_unit_options WHERE id = context.first_id
      AND NOT is_default AND is_inventory_preview AND qty_per_unit = 50) THEN
    RAISE EXCEPTION 'A failed unit option update did not restore default or preview state';
  END IF;

  SELECT updated.id, updated.is_default, updated.qty_per_unit
  INTO updated_option
  FROM public.update_item_unit_option(context.company_id, context.item_id, context.first_id,
    context.business_unit_id, p_qty_per_unit => 25, p_is_default => TRUE) updated;
  IF updated_option.id IS DISTINCT FROM context.first_id
    OR updated_option.is_default IS DISTINCT FROM TRUE OR updated_option.qty_per_unit IS DISTINCT FROM 25
    OR EXISTS (SELECT 1 FROM public.item_unit_options WHERE id = context.base_id AND is_default)
    OR NOT EXISTS (SELECT 1 FROM public.item_unit_options WHERE id = context.first_id
      AND is_default AND is_inventory_preview AND qty_per_unit = 25) THEN
    RAISE EXCEPTION 'Successful unit option update did not replace the default and persist the conversion';
  END IF;

  RAISE NOTICE 'PASS: authenticated preview and default replacement, forced rollback, stale claim, eligibility, lifecycle and authorization';
END;
$$;
ROLLBACK;
