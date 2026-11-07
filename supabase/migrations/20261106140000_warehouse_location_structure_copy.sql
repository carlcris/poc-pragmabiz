BEGIN;

-- Plans a copy of one location and its whole branch under another parent. Codes are rewritten by
-- replacing text, names optionally too. Preview and copy share this plan so they cannot drift.
CREATE FUNCTION public.plan_warehouse_location_copy(
  p_business_unit_id UUID, p_source_id UUID, p_code_find TEXT, p_code_replace TEXT,
  p_destination_parent_id UUID DEFAULT NULL, p_name_find TEXT DEFAULT NULL,
  p_name_replace TEXT DEFAULT NULL
)
RETURNS TABLE (
  source_id UUID, source_parent_id UUID, depth INTEGER, code TEXT, name TEXT, location_path TEXT,
  location_type TEXT, is_storable BOOLEAN, is_pickable BOOLEAN, is_active BOOLEAN,
  max_capacity NUMERIC, already_exists BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_company UUID; v_warehouse UUID; v_destination_path TEXT; v_destination_inside BOOLEAN;
  v_size INTEGER; v_rows JSONB;
BEGIN
  IF btrim(COALESCE(p_code_find, '')) = '' OR p_code_replace IS NULL THEN
    RAISE EXCEPTION 'LOCATION_COPY_INVALID';
  END IF;
  SELECT u.company_id INTO v_company FROM public.users u WHERE u.id = (SELECT auth.uid());
  IF v_company IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_business_unit_access a
    WHERE a.user_id = (SELECT auth.uid()) AND a.business_unit_id = p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'LOCATION_WAREHOUSE_INVALID';
  END IF;
  SELECT l.warehouse_id INTO v_warehouse
  FROM public.warehouse_locations l
  JOIN public.warehouses w ON w.id = l.warehouse_id AND w.company_id = l.company_id
  WHERE l.id = p_source_id AND l.company_id = v_company AND l.deleted_at IS NULL
    AND w.business_unit_id = p_business_unit_id AND w.deleted_at IS NULL;
  IF v_warehouse IS NULL THEN RAISE EXCEPTION 'LOCATION_WAREHOUSE_INVALID'; END IF;

  IF p_destination_parent_id IS NOT NULL THEN
    SELECT l.location_path, l.path_ids @> ARRAY[p_source_id]
    INTO v_destination_path, v_destination_inside
    FROM public.warehouse_locations l
    WHERE l.id = p_destination_parent_id AND l.company_id = v_company
      AND l.warehouse_id = v_warehouse AND l.deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_PARENT_INVALID'; END IF;
    IF v_destination_inside THEN RAISE EXCEPTION 'LOCATION_HIERARCHY_CYCLE'; END IF;
  END IF;

  SELECT COUNT(*) INTO v_size FROM public.warehouse_locations l
  WHERE l.company_id = v_company AND l.path_ids @> ARRAY[p_source_id] AND l.deleted_at IS NULL;
  IF v_size > 200 THEN RAISE EXCEPTION 'LOCATION_COPY_TOO_LARGE'; END IF;

  WITH RECURSIVE branch AS (
    SELECT l.id, l.parent_id, l.location_type::TEXT AS location_type, l.is_storable, l.is_pickable,
      l.is_active, l.max_capacity,
      btrim(replace(l.code, p_code_find, p_code_replace)) AS new_code,
      CASE WHEN btrim(COALESCE(p_name_find, '')) = '' OR l.name IS NULL THEN l.name::TEXT
        ELSE NULLIF(btrim(replace(l.name, p_name_find, COALESCE(p_name_replace, ''))), '') END AS new_name
    FROM public.warehouse_locations l
    WHERE l.company_id = v_company AND l.path_ids @> ARRAY[p_source_id] AND l.deleted_at IS NULL
  ),
  tree AS (
    SELECT b.id, b.parent_id, 0 AS depth, b.new_code, b.new_name, b.location_type, b.is_storable,
      b.is_pickable, b.is_active, b.max_capacity,
      concat_ws(' / ', v_destination_path, concat_ws(' - ', b.new_code, b.new_name)) AS new_path
    FROM branch b WHERE b.id = p_source_id
    UNION ALL
    SELECT b.id, b.parent_id, tree.depth + 1, b.new_code, b.new_name, b.location_type,
      b.is_storable, b.is_pickable, b.is_active, b.max_capacity,
      tree.new_path || ' / ' || concat_ws(' - ', b.new_code, b.new_name)
    FROM branch b JOIN tree ON b.parent_id = tree.id
  )
  SELECT jsonb_agg(jsonb_build_object(
      'source_id', tree.id, 'source_parent_id', tree.parent_id, 'depth', tree.depth,
      'code', tree.new_code, 'name', tree.new_name, 'location_path', tree.new_path,
      'location_type', tree.location_type, 'is_storable', tree.is_storable,
      'is_pickable', tree.is_pickable, 'is_active', tree.is_active,
      'max_capacity', tree.max_capacity,
      'already_exists', EXISTS (
        SELECT 1 FROM public.warehouse_locations existing
        WHERE existing.company_id = v_company AND existing.warehouse_id = v_warehouse
          AND existing.code = tree.new_code
      )
    ) ORDER BY tree.new_path)
  INTO v_rows FROM tree;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(v_rows) AS r(code TEXT, name TEXT)
    WHERE length(r.code) NOT BETWEEN 1 AND 100 OR length(r.name) > 200
  ) OR (
    SELECT COUNT(DISTINCT r.code) <> COUNT(*) FROM jsonb_to_recordset(v_rows) AS r(code TEXT)
  ) THEN
    RAISE EXCEPTION 'LOCATION_COPY_INVALID';
  END IF;

  RETURN QUERY
  SELECT r.source_id, r.source_parent_id, r.depth, r.code, r.name, r.location_path,
    r.location_type, r.is_storable, r.is_pickable, r.is_active, r.max_capacity, r.already_exists
  FROM jsonb_to_recordset(v_rows) AS r(
    source_id UUID, source_parent_id UUID, depth INTEGER, code TEXT, name TEXT,
    location_path TEXT, location_type TEXT, is_storable BOOLEAN, is_pickable BOOLEAN,
    is_active BOOLEAN, max_capacity NUMERIC, already_exists BOOLEAN
  );
END $$;
REVOKE ALL ON FUNCTION public.plan_warehouse_location_copy(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.plan_warehouse_location_copy(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated;

-- Copies the planned branch in one transaction: settings are copied, stock and floor-map
-- positions are not. Rows are inserted level by level with pre-assigned ids so each child's
-- parent already exists for the hierarchy trigger. Any failure leaves no copied rows.
CREATE FUNCTION public.copy_warehouse_location_structure(
  p_business_unit_id UUID, p_source_id UUID, p_code_find TEXT, p_code_replace TEXT,
  p_destination_parent_id UUID DEFAULT NULL, p_name_find TEXT DEFAULT NULL,
  p_name_replace TEXT DEFAULT NULL
)
RETURNS TABLE (root_id UUID, created_count INTEGER)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_company UUID; v_warehouse UUID; v_plan JSONB; v_depth INTEGER; v_max_depth INTEGER;
BEGIN
  SELECT l.company_id, l.warehouse_id INTO v_company, v_warehouse
  FROM public.warehouse_locations l
  JOIN public.warehouses w ON w.id = l.warehouse_id AND w.company_id = l.company_id
  WHERE l.id = p_source_id AND l.deleted_at IS NULL AND w.deleted_at IS NULL
    AND w.business_unit_id = p_business_unit_id
    AND l.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = (SELECT auth.uid()));
  IF v_warehouse IS NULL THEN RAISE EXCEPTION 'LOCATION_WAREHOUSE_INVALID'; END IF;

  -- Locks the warehouse (the hierarchy trigger's serialization point) and checks the destination.
  PERFORM 1 FROM public.resolve_warehouse_location_batch_scope(
    p_business_unit_id, v_warehouse, p_destination_parent_id, TRUE
  );

  SELECT jsonb_agg(jsonb_build_object(
      'new_id', gen_random_uuid(), 'source_id', plan.source_id,
      'source_parent_id', plan.source_parent_id, 'depth', plan.depth, 'code', plan.code,
      'name', plan.name, 'location_type', plan.location_type, 'is_storable', plan.is_storable,
      'is_pickable', plan.is_pickable, 'is_active', plan.is_active,
      'max_capacity', plan.max_capacity, 'already_exists', plan.already_exists
    ))
  INTO v_plan
  FROM public.plan_warehouse_location_copy(
    p_business_unit_id, p_source_id, p_code_find, p_code_replace, p_destination_parent_id,
    p_name_find, p_name_replace
  ) plan;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(v_plan) AS r(already_exists BOOLEAN) WHERE r.already_exists
  ) THEN
    RAISE EXCEPTION 'LOCATION_CODE_EXISTS';
  END IF;

  SELECT MAX(r.depth) INTO v_max_depth FROM jsonb_to_recordset(v_plan) AS r(depth INTEGER);
  FOR v_depth IN 0..v_max_depth LOOP
    INSERT INTO public.warehouse_locations(
      id, company_id, warehouse_id, parent_id, code, name, location_type, is_storable,
      is_pickable, is_active, max_capacity, created_by, updated_by
    )
    SELECT r.new_id, v_company, v_warehouse,
      CASE WHEN r.depth = 0 THEN p_destination_parent_id ELSE parent.new_id END,
      r.code, r.name, r.location_type, r.is_storable, r.is_pickable, r.is_active,
      r.max_capacity, (SELECT auth.uid()), (SELECT auth.uid())
    FROM jsonb_to_recordset(v_plan) AS r(
      new_id UUID, source_parent_id UUID, depth INTEGER, code TEXT, name TEXT,
      location_type TEXT, is_storable BOOLEAN, is_pickable BOOLEAN, is_active BOOLEAN,
      max_capacity NUMERIC
    )
    LEFT JOIN jsonb_to_recordset(v_plan) AS parent(new_id UUID, source_id UUID)
      ON parent.source_id = r.source_parent_id
    WHERE r.depth = v_depth
    ORDER BY r.code;
  END LOOP;

  RETURN QUERY
  SELECT r.new_id, jsonb_array_length(v_plan)
  FROM jsonb_to_recordset(v_plan) AS r(new_id UUID, depth INTEGER)
  WHERE r.depth = 0;
END $$;
REVOKE ALL ON FUNCTION public.copy_warehouse_location_structure(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.copy_warehouse_location_structure(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated;

COMMIT;
