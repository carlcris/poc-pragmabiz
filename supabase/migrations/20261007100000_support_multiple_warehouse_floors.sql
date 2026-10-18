BEGIN;

-- Existing warehouse maps and rack mappings retain their IDs and become Floor 1.
ALTER TABLE public.warehouse_floor_maps
  ADD COLUMN floor_number INTEGER NOT NULL DEFAULT 1 CHECK (floor_number > 0),
  DROP CONSTRAINT warehouse_floor_maps_warehouse_id_key,
  ADD CONSTRAINT warehouse_floor_maps_warehouse_floor_key UNIQUE (warehouse_id, floor_number);
ALTER TABLE public.warehouse_floor_maps ALTER COLUMN floor_number DROP DEFAULT;

-- A physical rack has one navigable floor; it cannot appear on two maps.
ALTER TABLE public.warehouse_floor_map_racks
  ADD CONSTRAINT warehouse_floor_map_racks_location_key UNIQUE (warehouse_location_id);
DROP INDEX public.warehouse_floor_map_racks_location_id_idx;

DROP FUNCTION public.save_warehouse_floor_map(UUID, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER, JSONB);

CREATE OR REPLACE FUNCTION public.save_warehouse_floor_map(
  p_company_id UUID,
  p_warehouse_id UUID,
  p_actor_user_id UUID,
  p_floor_number INTEGER,
  p_expected_version INTEGER,
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
  v_existing_version INTEGER;
  v_business_unit_id UUID;
  v_rack_count INTEGER;
  v_valid_rack_count INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_actor_user_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF p_floor_number IS NULL OR p_floor_number <= 0 THEN
    RAISE EXCEPTION 'INVALID_FLOOR_NUMBER';
  END IF;

  IF p_name IS NULL OR length(btrim(p_name)) = 0 OR length(p_name) > 120 THEN
    RAISE EXCEPTION 'INVALID_MAP_NAME';
  END IF;

  IF p_image_path IS NULL OR length(btrim(p_image_path)) = 0 THEN
    RAISE EXCEPTION 'MAP_IMAGE_REQUIRED';
  END IF;

  IF p_image_width IS NULL OR p_image_height IS NULL OR p_image_width <= 0 OR p_image_height <= 0 THEN
    RAISE EXCEPTION 'INVALID_IMAGE_DIMENSIONS';
  END IF;

  IF p_racks IS NULL OR jsonb_typeof(p_racks) <> 'array' OR jsonb_array_length(p_racks) > 500 THEN
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

  SELECT id, version INTO v_map_id, v_existing_version
  FROM public.warehouse_floor_maps
  WHERE warehouse_id = p_warehouse_id AND company_id = p_company_id
    AND floor_number = p_floor_number
  FOR UPDATE;

  IF p_expected_version IS NULL OR COALESCE(v_existing_version, 0) <> p_expected_version THEN
    RAISE EXCEPTION 'FLOOR_MAP_VERSION_CONFLICT';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.warehouse_floor_map_racks existing_rack
    JOIN public.warehouse_floor_maps existing_map ON existing_map.id = existing_rack.floor_map_id
    JOIN jsonb_to_recordset(p_racks) AS rack(warehouse_location_id UUID)
      ON rack.warehouse_location_id = existing_rack.warehouse_location_id
    WHERE existing_map.warehouse_id = p_warehouse_id
      AND existing_map.floor_number <> p_floor_number
  ) THEN
    RAISE EXCEPTION 'RACK_ALREADY_MAPPED_ON_ANOTHER_FLOOR';
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
    floor_number,
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
    p_floor_number,
    btrim(p_name),
    p_image_path,
    p_image_width,
    p_image_height,
    p_actor_user_id,
    p_actor_user_id
  )
  ON CONFLICT (warehouse_id, floor_number) DO UPDATE SET
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
  INTEGER,
  INTEGER,
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
  INTEGER,
  INTEGER,
  TEXT,
  TEXT,
  INTEGER,
  INTEGER,
  JSONB
) TO authenticated;

COMMENT ON FUNCTION public.save_warehouse_floor_map(UUID, UUID, UUID, INTEGER, INTEGER, TEXT, TEXT, INTEGER, INTEGER, JSONB) IS
  'Atomically saves one numbered floor and its rack mappings with version checking and Warehouse floor-map permissions.';

NOTIFY pgrst, 'reload schema';
COMMIT;
