-- Run against the seeded local DB after applying the warehouse floor migration.
-- docker exec -i supabase_db_backend psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/warehouse-floors.sql
-- All fixtures, map changes, and fault injection are rolled back.
BEGIN;

CREATE TEMP TABLE floor_test_context ON COMMIT DROP AS
SELECT actor.id AS actor_id, actor.company_id, access_row.business_unit_id,
  gen_random_uuid() AS warehouse_id, gen_random_uuid() AS rack_one_id,
  gen_random_uuid() AS rack_two_id
FROM public.users actor
JOIN public.user_business_unit_access access_row ON access_row.user_id = actor.id
WHERE actor.is_active IS TRUE AND actor.deleted_at IS NULL
  AND public.user_has_permission(actor.id, 'warehouses', 'view', access_row.business_unit_id)
  AND public.user_has_permission(actor.id, 'warehouses', 'edit', access_row.business_unit_id)
  AND public.user_has_permission(actor.id, 'warehouses.operation.manage_floor_map.edit', 'edit', access_row.business_unit_id)
ORDER BY actor.id, access_row.business_unit_id LIMIT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM floor_test_context) THEN
    RAISE EXCEPTION 'Test needs a user authorized to manage warehouse floor maps';
  END IF;
END $$;

INSERT INTO public.warehouses (id, company_id, business_unit_id, warehouse_code, warehouse_name,
  is_active, created_by, updated_by)
SELECT warehouse_id, company_id, business_unit_id, 'FLOORS-' || LEFT(warehouse_id::TEXT, 8),
  'Warehouse floor test', TRUE, actor_id, actor_id FROM floor_test_context;

INSERT INTO public.warehouse_locations (id, company_id, warehouse_id, code, location_type,
  is_active, is_storable, is_pickable, created_by, updated_by)
SELECT rack.id, context.company_id, context.warehouse_id, rack.code, 'rack', TRUE, TRUE, TRUE,
  context.actor_id, context.actor_id
FROM floor_test_context context
CROSS JOIN LATERAL (VALUES (context.rack_one_id, 'FIRST'), (context.rack_two_id, 'SECOND')) rack(id, code);

GRANT SELECT ON floor_test_context TO authenticated;

CREATE FUNCTION pg_temp.fail_floor_rack_insert() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.fail_floor_rack_insert', TRUE) = 'on' THEN
    RAISE EXCEPTION 'FORCED_RACK_INSERT_FAILURE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER floor_test_fail_insert BEFORE INSERT ON public.warehouse_floor_map_racks
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_floor_rack_insert();

SELECT set_config('request.jwt.claim.sub', actor_id::TEXT, TRUE) FROM floor_test_context;
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  context RECORD;
  first_map UUID;
  second_map UUID;
  snapshot_before JSONB;
  snapshot_after JSONB;
  rack_one JSONB;
  rack_two JSONB;
BEGIN
  SELECT actor_id, company_id, warehouse_id, rack_one_id, rack_two_id INTO context FROM floor_test_context;
  rack_one := jsonb_build_array(jsonb_build_object('warehouse_location_id', context.rack_one_id,
    'x_basis_points', 100, 'y_basis_points', 100, 'width_basis_points', 500, 'height_basis_points', 500));
  rack_two := jsonb_build_array(jsonb_build_object('warehouse_location_id', context.rack_two_id,
    'x_basis_points', 200, 'y_basis_points', 200, 'width_basis_points', 500, 'height_basis_points', 500));

  first_map := public.save_warehouse_floor_map(context.company_id, context.warehouse_id,
    context.actor_id, 1, 0, 'First floor', 'floor-test/first.png', 1000, 800, rack_one);
  second_map := public.save_warehouse_floor_map(context.company_id, context.warehouse_id,
    context.actor_id, 2, 0, 'Second floor', 'floor-test/second.png', 1000, 800, rack_two);
  IF first_map = second_map OR (SELECT COUNT(*) FROM public.warehouse_floor_maps
    WHERE warehouse_id = context.warehouse_id) <> 2 THEN
    RAISE EXCEPTION 'Each floor must retain its own map';
  END IF;
  IF (SELECT floor_map_id FROM public.warehouse_floor_map_racks
    WHERE warehouse_location_id = context.rack_two_id) <> second_map THEN
    RAISE EXCEPTION 'Picking must resolve the second-floor rack to the second-floor map';
  END IF;

  PERFORM public.save_warehouse_floor_map(context.company_id, context.warehouse_id,
    context.actor_id, 2, 1, 'Updated second floor', 'floor-test/updated.png', 1200, 900, rack_two);
  IF (SELECT version FROM public.warehouse_floor_maps WHERE id = first_map) <> 1 OR
    (SELECT version FROM public.warehouse_floor_maps WHERE id = second_map) <> 2 THEN
    RAISE EXCEPTION 'Editing one floor must not modify another';
  END IF;

  BEGIN
    PERFORM public.save_warehouse_floor_map(context.company_id, context.warehouse_id,
      context.actor_id, 2, 1, 'Stale edit', 'floor-test/stale.png', 1000, 800, rack_two);
    RAISE EXCEPTION 'Stale version was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'FLOOR_MAP_VERSION_CONFLICT' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.save_warehouse_floor_map(context.company_id, context.warehouse_id,
      context.actor_id, 3, 0, 'Duplicate rack', 'floor-test/third.png', 1000, 800, rack_one);
    RAISE EXCEPTION 'Duplicate cross-floor rack was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'RACK_ALREADY_MAPPED_ON_ANOTHER_FLOOR' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.save_warehouse_floor_map(context.company_id, context.warehouse_id,
      context.actor_id, 0, 0, 'Invalid floor', 'floor-test/zero.png', 1000, 800, '[]');
    RAISE EXCEPTION 'Invalid floor was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'INVALID_FLOOR_NUMBER' THEN RAISE; END IF;
  END;

  SELECT jsonb_build_object('name', name, 'path', image_path, 'version', version,
    'width', image_width, 'height', image_height, 'updated_at', updated_at,
    'racks', (SELECT jsonb_agg(jsonb_build_array(id, warehouse_location_id, x_basis_points,
      y_basis_points, width_basis_points, height_basis_points) ORDER BY id)
      FROM public.warehouse_floor_map_racks WHERE floor_map_id = second_map))
  INTO snapshot_before FROM public.warehouse_floor_maps WHERE id = second_map;
  PERFORM set_config('test.fail_floor_rack_insert', 'on', TRUE);
  BEGIN
    PERFORM public.save_warehouse_floor_map(context.company_id, context.warehouse_id,
      context.actor_id, 2, 2, 'Must roll back', 'floor-test/rollback.png', 500, 500, rack_two);
    RAISE EXCEPTION 'Injected insert failure did not occur';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'FORCED_RACK_INSERT_FAILURE' THEN RAISE; END IF;
  END;
  PERFORM set_config('test.fail_floor_rack_insert', 'off', TRUE);
  SELECT jsonb_build_object('name', name, 'path', image_path, 'version', version,
    'width', image_width, 'height', image_height, 'updated_at', updated_at,
    'racks', (SELECT jsonb_agg(jsonb_build_array(id, warehouse_location_id, x_basis_points,
      y_basis_points, width_basis_points, height_basis_points) ORDER BY id)
      FROM public.warehouse_floor_map_racks WHERE floor_map_id = second_map))
  INTO snapshot_after FROM public.warehouse_floor_maps WHERE id = second_map;
  IF snapshot_before IS DISTINCT FROM snapshot_after THEN
    RAISE EXCEPTION 'Failed save left partial map or rack changes';
  END IF;
  RAISE NOTICE 'Warehouse multi-floor, stale-version, cross-floor conflict, and rollback checks passed';
END $$;

ROLLBACK;
