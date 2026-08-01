BEGIN;

INSERT INTO public.permissions (
  resource,
  parent_resource,
  surface,
  capability_key,
  capability_action,
  label,
  permission_group,
  description,
  is_granular,
  can_view,
  can_create,
  can_edit,
  can_delete
)
VALUES (
  'warehouses.operation.manage_floor_map.edit',
  'warehouses',
  'operation',
  'manage_floor_map',
  'edit',
  'Manage Warehouse Floor Map',
  'Warehouse Operations',
  'Allows uploading warehouse floor-plan images and changing rack mappings.',
  TRUE,
  FALSE,
  FALSE,
  TRUE,
  FALSE
)
ON CONFLICT (resource) DO UPDATE
SET
  parent_resource = EXCLUDED.parent_resource,
  surface = EXCLUDED.surface,
  capability_key = EXCLUDED.capability_key,
  capability_action = EXCLUDED.capability_action,
  label = EXCLUDED.label,
  permission_group = EXCLUDED.permission_group,
  description = EXCLUDED.description,
  is_granular = TRUE,
  can_view = FALSE,
  can_create = FALSE,
  can_edit = TRUE,
  can_delete = FALSE,
  updated_at = NOW();

-- Preserve floor-map editing only for roles that already have Warehouse edit access.
INSERT INTO public.role_permissions (
  role_id,
  permission_id,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  parent_role_permission.role_id,
  floor_map_permission.id,
  FALSE,
  FALSE,
  TRUE,
  FALSE
FROM public.role_permissions parent_role_permission
JOIN public.permissions parent_permission
  ON parent_permission.id = parent_role_permission.permission_id
 AND parent_permission.resource = 'warehouses'
 AND parent_permission.deleted_at IS NULL
CROSS JOIN public.permissions floor_map_permission
WHERE parent_role_permission.can_edit IS TRUE
  AND floor_map_permission.resource = 'warehouses.operation.manage_floor_map.edit'
  AND floor_map_permission.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = FALSE,
  can_create = FALSE,
  can_edit = TRUE,
  can_delete = FALSE;

CREATE OR REPLACE FUNCTION public.save_warehouse_floor_map(
  p_company_id UUID,
  p_warehouse_id UUID,
  p_actor_user_id UUID,
  p_name TEXT,
  p_image_path TEXT,
  p_image_width INTEGER,
  p_image_height INTEGER,
  p_racks JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_map_id UUID;
  v_business_unit_id UUID;
  v_rack_count INTEGER;
  v_valid_rack_count INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF p_name IS NULL OR length(btrim(p_name)) = 0 OR length(p_name) > 120 THEN
    RAISE EXCEPTION 'INVALID_MAP_NAME';
  END IF;

  IF p_image_path IS NULL OR length(btrim(p_image_path)) = 0 THEN
    RAISE EXCEPTION 'MAP_IMAGE_REQUIRED';
  END IF;

  IF p_image_width <= 0 OR p_image_height <= 0 THEN
    RAISE EXCEPTION 'INVALID_IMAGE_DIMENSIONS';
  END IF;

  IF jsonb_typeof(p_racks) <> 'array' OR jsonb_array_length(p_racks) > 500 THEN
    RAISE EXCEPTION 'INVALID_RACK_MAPPINGS';
  END IF;

  SELECT warehouses.business_unit_id
  INTO v_business_unit_id
  FROM public.warehouses
  WHERE warehouses.id = p_warehouse_id
    AND warehouses.company_id = p_company_id
    AND warehouses.is_active IS TRUE
    AND warehouses.deleted_at IS NULL
  FOR UPDATE;

  IF v_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'WAREHOUSE_NOT_FOUND';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = p_actor_user_id
      AND users.company_id = p_company_id
      AND users.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'ACTOR_COMPANY_MISMATCH';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_business_unit_access
    WHERE user_business_unit_access.user_id = p_actor_user_id
      AND user_business_unit_access.business_unit_id = v_business_unit_id
  ) THEN
    RAISE EXCEPTION 'WAREHOUSE_ACCESS_DENIED';
  END IF;

  IF NOT public.user_has_permission(
    p_actor_user_id,
    'warehouses',
    'view',
    v_business_unit_id
  ) OR NOT public.user_has_permission(
    p_actor_user_id,
    'warehouses',
    'edit',
    v_business_unit_id
  ) OR NOT public.user_has_permission(
    p_actor_user_id,
    'warehouses.operation.manage_floor_map.edit',
    'edit',
    v_business_unit_id
  ) THEN
    RAISE EXCEPTION 'FLOOR_MAP_PERMISSION_DENIED';
  END IF;

  SELECT count(*)
  INTO v_rack_count
  FROM jsonb_to_recordset(p_racks) AS rack(
    warehouse_location_id UUID,
    x_basis_points INTEGER,
    y_basis_points INTEGER,
    width_basis_points INTEGER,
    height_basis_points INTEGER
  );

  IF v_rack_count <> (
    SELECT count(DISTINCT rack.warehouse_location_id)
    FROM jsonb_to_recordset(p_racks) AS rack(
      warehouse_location_id UUID,
      x_basis_points INTEGER,
      y_basis_points INTEGER,
      width_basis_points INTEGER,
      height_basis_points INTEGER
    )
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_RACK_MAPPING';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_racks) AS rack(
      warehouse_location_id UUID,
      x_basis_points INTEGER,
      y_basis_points INTEGER,
      width_basis_points INTEGER,
      height_basis_points INTEGER
    )
    WHERE GREATEST(rack.width_basis_points, rack.height_basis_points) < 300
       OR (rack.width_basis_points::BIGINT * rack.height_basis_points::BIGINT) < 30000
  ) THEN
    RAISE EXCEPTION 'RACK_MAPPING_TOO_SMALL';
  END IF;

  SELECT count(*)
  INTO v_valid_rack_count
  FROM jsonb_to_recordset(p_racks) AS rack(
    warehouse_location_id UUID,
    x_basis_points INTEGER,
    y_basis_points INTEGER,
    width_basis_points INTEGER,
    height_basis_points INTEGER
  )
  JOIN public.warehouse_locations
    ON warehouse_locations.id = rack.warehouse_location_id
   AND warehouse_locations.company_id = p_company_id
   AND warehouse_locations.warehouse_id = p_warehouse_id
   AND warehouse_locations.location_type = 'rack'
   AND warehouse_locations.is_active IS TRUE
   AND warehouse_locations.deleted_at IS NULL
  WHERE rack.x_basis_points BETWEEN 0 AND 10000
    AND rack.y_basis_points BETWEEN 0 AND 10000
    AND rack.width_basis_points BETWEEN 1 AND 10000
    AND rack.height_basis_points BETWEEN 1 AND 10000
    AND GREATEST(rack.width_basis_points, rack.height_basis_points) >= 300
    AND (rack.width_basis_points::BIGINT * rack.height_basis_points::BIGINT) >= 30000
    AND rack.x_basis_points + rack.width_basis_points <= 10000
    AND rack.y_basis_points + rack.height_basis_points <= 10000;

  IF v_valid_rack_count <> v_rack_count THEN
    RAISE EXCEPTION 'INVALID_RACK_MAPPINGS';
  END IF;

  INSERT INTO public.warehouse_floor_maps (
    company_id,
    warehouse_id,
    name,
    image_path,
    image_width,
    image_height,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    p_warehouse_id,
    btrim(p_name),
    p_image_path,
    p_image_width,
    p_image_height,
    p_actor_user_id,
    p_actor_user_id
  )
  ON CONFLICT (warehouse_id) DO UPDATE SET
    name = EXCLUDED.name,
    image_path = EXCLUDED.image_path,
    image_width = EXCLUDED.image_width,
    image_height = EXCLUDED.image_height,
    version = warehouse_floor_maps.version + 1,
    updated_at = now(),
    updated_by = p_actor_user_id
  RETURNING id INTO v_map_id;

  DELETE FROM public.warehouse_floor_map_racks
  WHERE floor_map_id = v_map_id;

  INSERT INTO public.warehouse_floor_map_racks (
    company_id,
    floor_map_id,
    warehouse_location_id,
    x_basis_points,
    y_basis_points,
    width_basis_points,
    height_basis_points,
    created_by,
    updated_by
  )
  SELECT
    p_company_id,
    v_map_id,
    rack.warehouse_location_id,
    rack.x_basis_points,
    rack.y_basis_points,
    rack.width_basis_points,
    rack.height_basis_points,
    p_actor_user_id,
    p_actor_user_id
  FROM jsonb_to_recordset(p_racks) AS rack(
    warehouse_location_id UUID,
    x_basis_points INTEGER,
    y_basis_points INTEGER,
    width_basis_points INTEGER,
    height_basis_points INTEGER
  );

  RETURN v_map_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_warehouse_floor_map(
  UUID,
  UUID,
  UUID,
  TEXT,
  TEXT,
  INTEGER,
  INTEGER,
  JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.save_warehouse_floor_map(
  UUID,
  UUID,
  UUID,
  TEXT,
  TEXT,
  INTEGER,
  INTEGER,
  JSONB
) TO authenticated;

COMMENT ON FUNCTION public.save_warehouse_floor_map(UUID, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, JSONB) IS
  'Saves a warehouse floor map and rack mappings for users with Warehouse view/edit and the granular floor-map management capability.';

COMMIT;
