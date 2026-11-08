BEGIN;

-- Location labels use compact, expanding numbers (B01, B100), while the shared
-- company-scoped generator owns allocation. Namespace includes warehouse and parent code.
CREATE FUNCTION public.warehouse_location_type_prefix(p_type TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
BEGIN
  RETURN CASE p_type WHEN 'zone' THEN 'Z' WHEN 'aisle' THEN 'A' WHEN 'rack' THEN 'R'
    WHEN 'shelf' THEN 'S' WHEN 'bin' THEN 'B' WHEN 'crate' THEN 'C'
    ELSE NULL END;
END $$;

CREATE FUNCTION public.next_warehouse_location_code(
  p_company UUID, p_warehouse UUID, p_parent_code TEXT, p_type TEXT
) RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_prefix TEXT; v_namespace TEXT; v_number BIGINT; v_code TEXT;
BEGIN
  v_prefix := concat_ws('-', NULLIF(p_parent_code, ''), public.warehouse_location_type_prefix(p_type));
  IF public.warehouse_location_type_prefix(p_type) IS NULL THEN RAISE EXCEPTION 'LOCATION_TYPE_INVALID'; END IF;
  IF length(v_prefix) > 98 THEN RAISE EXCEPTION 'LOCATION_CODE_TOO_LONG'; END IF;
  v_namespace := 'warehouse-location:' || p_warehouse::TEXT || ':' || v_prefix;
  LOOP
    -- Nine digit allocation, rendered compactly for warehouse labels. Never truncate overflow.
    PERFORM public.generate_document_code(p_company, v_namespace, 9);
    SELECT seq.last_number INTO v_number FROM public.document_code_sequences seq
      WHERE seq.company_id = p_company AND seq.code_prefix = v_namespace;
    v_code := v_prefix || lpad(v_number::TEXT, GREATEST(2, length(v_number::TEXT)), '0');
    IF length(v_code) > 100 THEN RAISE EXCEPTION 'LOCATION_CODE_TOO_LONG'; END IF;
    -- Existing/manual historical codes and soft-deleted codes remain reserved.
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.warehouse_locations l
      WHERE l.company_id = p_company AND l.warehouse_id = p_warehouse AND l.code = v_code);
  END LOOP;
  RETURN v_code;
END $$;
REVOKE ALL ON FUNCTION public.next_warehouse_location_code(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_warehouse_location_code(UUID, UUID, TEXT, TEXT) TO authenticated;

CREATE FUNCTION public.assign_warehouse_location_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_parent_code TEXT;
BEGIN
  -- Nested updates are the DB-owned subtree refresh, never user-supplied codes.
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'LOCATION_CODE_READ_ONLY';
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- Explicit fixture/import codes are retained for trusted database maintenance only.
    IF NEW.code IS NOT NULL THEN
      IF current_user IN ('postgres', 'supabase_admin') THEN RETURN NEW; END IF;
      RAISE EXCEPTION 'LOCATION_CODE_READ_ONLY';
    END IF;
  ELSIF NEW.parent_id IS NOT DISTINCT FROM OLD.parent_id
    AND NEW.location_type IS NOT DISTINCT FROM OLD.location_type THEN
    RETURN NEW;
  END IF;
  PERFORM 1 FROM public.warehouses w WHERE w.id = NEW.warehouse_id
    AND w.company_id = NEW.company_id AND w.deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_WAREHOUSE_INVALID'; END IF;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT l.code INTO v_parent_code FROM public.warehouse_locations l
      WHERE l.id = NEW.parent_id AND l.company_id = NEW.company_id
        AND l.warehouse_id = NEW.warehouse_id AND l.deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_PARENT_INVALID'; END IF;
  END IF;
  NEW.code := public.next_warehouse_location_code(NEW.company_id, NEW.warehouse_id, v_parent_code, NEW.location_type);
  RETURN NEW;
END $$;
-- Alphabetical trigger order: assign before hierarchy validation/materialized address construction.
CREATE TRIGGER assign_warehouse_location_code
BEFORE INSERT OR UPDATE OF code, parent_id, location_type ON public.warehouse_locations
FOR EACH ROW EXECUTE FUNCTION public.assign_warehouse_location_code();

CREATE OR REPLACE FUNCTION public.refresh_warehouse_location_descendants()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NULL; END IF;
  -- One recursive traversal and one set-based write; no repeated descendant rebuild per row.
  WITH RECURSIVE tree AS (
    SELECT NEW.id AS id, NEW.code::TEXT AS code, NEW.path_ids AS ids, NEW.location_path AS address
    UNION ALL
    SELECT child.id, generated.code, tree.ids || child.id,
      tree.address || ' / ' || concat_ws(' - ', generated.code, NULLIF(child.name, ''))
    FROM public.warehouse_locations child JOIN tree ON child.parent_id = tree.id
    CROSS JOIN LATERAL (SELECT CASE WHEN NEW.code IS DISTINCT FROM OLD.code
      THEN public.next_warehouse_location_code(child.company_id, child.warehouse_id, tree.code, child.location_type)
      ELSE child.code::TEXT END AS code) generated
  )
  UPDATE public.warehouse_locations l
    SET code = tree.code, path_ids = tree.ids, location_path = tree.address,
        updated_by = NEW.updated_by, updated_at = now()
    FROM tree WHERE l.id = tree.id AND l.id <> NEW.id;
  RETURN NULL;
END $$;

-- Nested subtree writes already contain validated addresses computed by the recursive update.
CREATE OR REPLACE FUNCTION public.validate_warehouse_location_hierarchy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_parent public.warehouse_locations%ROWTYPE;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  -- Serialize structural edits within a warehouse, including competing reparent operations.
  PERFORM 1 FROM public.warehouses
  WHERE id = NEW.warehouse_id AND company_id = NEW.company_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_WAREHOUSE_INVALID'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.warehouse_id <> OLD.warehouse_id OR NEW.company_id <> OLD.company_id) THEN
    RAISE EXCEPTION 'LOCATION_OWNERSHIP_IMMUTABLE';
  END IF;
  IF NEW.location_type NOT IN ('zone', 'aisle', 'rack', 'shelf', 'bin', 'crate') THEN
    RAISE EXCEPTION 'LOCATION_TYPE_INVALID';
  END IF;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT l.id, l.company_id, l.warehouse_id, l.code, l.name, l.parent_id, l.location_type,
      l.is_pickable, l.is_storable, l.is_active, l.created_at, l.created_by, l.updated_at,
      l.updated_by, l.deleted_at, l.version, l.max_capacity, l.path_ids, l.location_path
    INTO v_parent FROM public.warehouse_locations l
    WHERE l.id = NEW.parent_id AND l.company_id = NEW.company_id
      AND l.warehouse_id = NEW.warehouse_id AND l.deleted_at IS NULL;
    IF NOT FOUND OR (NEW.is_active AND v_parent.is_active IS NOT TRUE) THEN
      RAISE EXCEPTION 'LOCATION_PARENT_INVALID';
    END IF;
    IF NEW.id = ANY(v_parent.path_ids) THEN RAISE EXCEPTION 'LOCATION_HIERARCHY_CYCLE'; END IF;
    NEW.path_ids := v_parent.path_ids || NEW.id;
    NEW.location_path := v_parent.location_path || ' / ' || concat_ws(' - ', NEW.code, NULLIF(NEW.name, ''));
  ELSE
    NEW.path_ids := ARRAY[NEW.id];
    NEW.location_path := concat_ws(' - ', NEW.code, NULLIF(NEW.name, ''));
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.is_active IS NOT TRUE OR NEW.deleted_at IS NOT NULL) AND EXISTS (
      SELECT 1 FROM public.warehouse_locations child WHERE child.parent_id = NEW.id
        AND child.deleted_at IS NULL AND (child.is_active OR NEW.deleted_at IS NOT NULL)
    ) THEN RAISE EXCEPTION 'LOCATION_HAS_CHILDREN'; END IF;
    IF NEW.parent_id IS DISTINCT FROM OLD.parent_id
       OR (OLD.is_active IS TRUE AND NEW.is_active IS NOT TRUE)
       OR (OLD.is_storable IS TRUE AND NEW.is_storable IS NOT TRUE)
       OR (OLD.is_pickable IS TRUE AND NEW.is_pickable IS NOT TRUE)
       OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
      PERFORM child.id FROM public.warehouse_locations child
      WHERE child.path_ids @> ARRAY[NEW.id] ORDER BY child.id FOR UPDATE;
      IF EXISTS (
        SELECT 1 FROM public.item_batch_locations stock
        JOIN public.warehouse_locations l ON l.id = stock.location_id
        WHERE l.path_ids @> ARRAY[NEW.id] AND stock.deleted_at IS NULL
          AND ((stock.qty_reserved > 0 AND (l.id = NEW.id
            OR NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.is_active IS NOT TRUE OR NEW.deleted_at IS NOT NULL)) OR (
            stock.qty_on_hand > 0 AND (NEW.parent_id IS DISTINCT FROM OLD.parent_id
              OR NEW.is_active IS NOT TRUE OR NEW.deleted_at IS NOT NULL
              OR (l.id = NEW.id AND NEW.is_storable IS NOT TRUE))
          ))
      ) OR EXISTS (
        SELECT 1 FROM public.putaway_tasks task
        JOIN public.warehouse_locations l ON l.id = task.suggested_location_id
        WHERE l.path_ids @> ARRAY[NEW.id] AND task.deleted_at IS NULL AND task.status = 'pending'
          AND (NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.is_active IS NOT TRUE
            OR NEW.deleted_at IS NOT NULL OR (l.id = NEW.id AND NEW.is_storable IS NOT TRUE))
      ) THEN RAISE EXCEPTION 'LOCATION_IN_USE'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER refresh_warehouse_location_descendants ON public.warehouse_locations;
CREATE TRIGGER refresh_warehouse_location_descendants
AFTER UPDATE OF parent_id, code, name, location_type ON public.warehouse_locations FOR EACH ROW
WHEN (OLD.parent_id IS DISTINCT FROM NEW.parent_id OR OLD.code IS DISTINCT FROM NEW.code
  OR OLD.name IS DISTINCT FROM NEW.name)
EXECUTE FUNCTION public.refresh_warehouse_location_descendants();

CREATE FUNCTION public.update_warehouse_location(p_business_unit_id UUID, p_location_id UUID, p_changes JSONB)
RETURNS SETOF public.warehouse_locations LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_company UUID; v_warehouse UUID; v_storable BOOLEAN;
BEGIN
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::JSONB
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_changes) k WHERE k NOT IN
      ('name','parent_id','location_type','is_pickable','is_storable','is_active','max_capacity')) THEN
    RAISE EXCEPTION 'LOCATION_CODE_READ_ONLY';
  END IF;
  SELECT l.company_id, l.warehouse_id INTO v_company, v_warehouse
    FROM public.warehouse_locations l WHERE l.id = p_location_id AND l.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_WAREHOUSE_INVALID'; END IF;
  PERFORM 1 FROM public.resolve_warehouse_location_batch_scope(p_business_unit_id, v_warehouse, NULL, TRUE);
  SELECT l.is_storable INTO v_storable FROM public.warehouse_locations l
    WHERE l.id = p_location_id AND l.company_id = v_company AND l.deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_WAREHOUSE_INVALID'; END IF;
  v_storable := COALESCE((p_changes->>'is_storable')::BOOLEAN, v_storable);
  IF NOT v_storable AND (p_changes->>'max_capacity')::NUMERIC IS NOT NULL THEN
    RAISE EXCEPTION 'CAPACITY_REQUIRES_STORABLE_LOCATION';
  END IF;
  RETURN QUERY UPDATE public.warehouse_locations l SET
    name = CASE WHEN p_changes ? 'name' THEN p_changes->>'name' ELSE l.name END,
    parent_id = CASE WHEN p_changes ? 'parent_id' THEN (p_changes->>'parent_id')::UUID ELSE l.parent_id END,
    location_type = COALESCE(p_changes->>'location_type', l.location_type),
    is_pickable = COALESCE((p_changes->>'is_pickable')::BOOLEAN, l.is_pickable),
    is_storable = v_storable,
    is_active = COALESCE((p_changes->>'is_active')::BOOLEAN, l.is_active),
    max_capacity = CASE WHEN NOT v_storable THEN NULL WHEN p_changes ? 'max_capacity'
      THEN (p_changes->>'max_capacity')::NUMERIC ELSE l.max_capacity END,
    updated_by = (SELECT auth.uid()), updated_at = now()
    WHERE l.id = p_location_id
    RETURNING l.id, l.company_id, l.warehouse_id, l.code, l.name, l.parent_id,
      l.location_type, l.is_pickable, l.is_storable, l.is_active, l.created_at,
      l.created_by, l.updated_at, l.updated_by, l.deleted_at, l.version,
      l.max_capacity, l.path_ids, l.location_path;
END $$;
REVOKE ALL ON FUNCTION public.update_warehouse_location(UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_warehouse_location(UUID, UUID, JSONB) TO authenticated;
DROP FUNCTION public.preview_warehouse_locations_batch(UUID, UUID, TEXT, INTEGER, INTEGER, INTEGER, UUID, TEXT);
DROP FUNCTION public.create_warehouse_locations_batch(UUID, UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, UUID, TEXT, NUMERIC);
DROP FUNCTION public.expand_warehouse_location_batch(TEXT, INTEGER, INTEGER, INTEGER, TEXT);
CREATE FUNCTION public.preview_warehouse_locations_batch(
  p_business_unit_id UUID, p_warehouse_id UUID, p_from INTEGER, p_to INTEGER,
  p_location_type TEXT, p_parent_id UUID DEFAULT NULL, p_name_prefix TEXT DEFAULT NULL
) RETURNS TABLE (code TEXT, name TEXT, location_path TEXT)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_scope RECORD; v_number INTEGER; v_parent_code TEXT;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from < 0 OR p_to < p_from OR p_to - p_from >= 100
    OR p_to > 999999 OR length(p_name_prefix) > 190 THEN RAISE EXCEPTION 'LOCATION_BATCH_INVALID'; END IF;
  IF public.warehouse_location_type_prefix(p_location_type) IS NULL THEN RAISE EXCEPTION 'LOCATION_TYPE_INVALID'; END IF;
  SELECT scope.company_id, scope.parent_path INTO v_scope
    FROM public.resolve_warehouse_location_batch_scope(p_business_unit_id,p_warehouse_id,p_parent_id,FALSE) scope;
  SELECT l.code INTO v_parent_code FROM public.warehouse_locations l WHERE l.id = p_parent_id;
  FOR v_number IN p_from..p_to LOOP
    code := concat_ws('-', v_parent_code, public.warehouse_location_type_prefix(p_location_type) || '…');
    name := CASE WHEN btrim(COALESCE(p_name_prefix,'')) = '' THEN NULL ELSE btrim(p_name_prefix || v_number::TEXT) END;
    location_path := concat_ws(' / ',v_scope.parent_path,concat_ws(' - ',code,name));
    RETURN NEXT;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.preview_warehouse_locations_batch(UUID, UUID, INTEGER, INTEGER, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_warehouse_locations_batch(UUID, UUID, INTEGER, INTEGER, TEXT, UUID, TEXT) TO authenticated;

CREATE FUNCTION public.create_warehouse_locations_batch(
  p_business_unit_id UUID, p_warehouse_id UUID, p_from INTEGER, p_to INTEGER,
  p_location_type TEXT, p_is_storable BOOLEAN, p_is_pickable BOOLEAN, p_is_active BOOLEAN,
  p_parent_id UUID DEFAULT NULL, p_name_prefix TEXT DEFAULT NULL, p_max_capacity NUMERIC DEFAULT NULL
) RETURNS TABLE (created_count INTEGER)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_company UUID; v_created INTEGER;
BEGIN
  IF p_is_storable IS NULL OR p_is_pickable IS NULL OR p_is_active IS NULL
    OR (p_is_pickable AND NOT p_is_storable) OR (p_max_capacity IS NOT NULL AND p_max_capacity <= 0)
    THEN RAISE EXCEPTION 'LOCATION_BATCH_INVALID'; END IF;
  IF p_max_capacity IS NOT NULL AND NOT p_is_storable THEN RAISE EXCEPTION 'CAPACITY_REQUIRES_STORABLE_LOCATION'; END IF;
  SELECT scope.company_id INTO v_company FROM public.resolve_warehouse_location_batch_scope(
    p_business_unit_id,p_warehouse_id,p_parent_id,TRUE) scope;
  INSERT INTO public.warehouse_locations(company_id,warehouse_id,parent_id,name,location_type,
    is_storable,is_pickable,is_active,max_capacity,created_by,updated_by)
  SELECT v_company,p_warehouse_id,p_parent_id,preview.name,p_location_type,
    p_is_storable,p_is_pickable,p_is_active,p_max_capacity,(SELECT auth.uid()),(SELECT auth.uid())
  FROM public.preview_warehouse_locations_batch(p_business_unit_id,p_warehouse_id,p_from,p_to,
    p_location_type,p_parent_id,p_name_prefix) preview;
  GET DIAGNOSTICS v_created = ROW_COUNT;
  RETURN QUERY SELECT v_created;
END $$;
REVOKE ALL ON FUNCTION public.create_warehouse_locations_batch(UUID, UUID, INTEGER, INTEGER, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, UUID, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_warehouse_locations_batch(UUID, UUID, INTEGER, INTEGER, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, UUID, TEXT, NUMERIC) TO authenticated;
DROP FUNCTION public.copy_warehouse_location_structure(UUID,UUID,TEXT,TEXT,UUID,TEXT,TEXT);
DROP FUNCTION public.plan_warehouse_location_copy(UUID,UUID,TEXT,TEXT,UUID,TEXT,TEXT);
CREATE FUNCTION public.plan_warehouse_location_copy(
  p_business_unit_id UUID, p_source_id UUID,
  p_destination_parent_id UUID DEFAULT NULL, p_name_find TEXT DEFAULT NULL,
  p_name_replace TEXT DEFAULT NULL
)
RETURNS TABLE (
  source_id UUID, source_parent_id UUID, depth INTEGER, code TEXT, name TEXT, location_path TEXT,
  location_type TEXT, is_storable BOOLEAN, is_pickable BOOLEAN, is_active BOOLEAN,
  max_capacity NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_company UUID; v_warehouse UUID; v_destination_path TEXT; v_destination_inside BOOLEAN;
  v_size INTEGER; v_rows JSONB; v_destination_code TEXT;
BEGIN

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
    SELECT l.location_path, l.path_ids @> ARRAY[p_source_id], l.code
    INTO v_destination_path, v_destination_inside, v_destination_code
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
      public.warehouse_location_type_prefix(l.location_type) || '…' AS new_code,
      CASE WHEN btrim(COALESCE(p_name_find, '')) = '' OR l.name IS NULL THEN l.name::TEXT
        ELSE NULLIF(btrim(replace(l.name, p_name_find, COALESCE(p_name_replace, ''))), '') END AS new_name
    FROM public.warehouse_locations l
    WHERE l.company_id = v_company AND l.path_ids @> ARRAY[p_source_id] AND l.deleted_at IS NULL
  ),
  tree AS (
    SELECT b.id, b.parent_id, 0 AS depth, concat_ws('-', v_destination_code, b.new_code) AS new_code, b.new_name, b.location_type, b.is_storable,
      b.is_pickable, b.is_active, b.max_capacity,
      concat_ws(' / ', v_destination_path, concat_ws(' - ', concat_ws('-', v_destination_code, b.new_code), b.new_name)) AS new_path
    FROM branch b WHERE b.id = p_source_id
    UNION ALL
    SELECT b.id, b.parent_id, tree.depth + 1, tree.new_code || '-' || b.new_code, b.new_name, b.location_type,
      b.is_storable, b.is_pickable, b.is_active, b.max_capacity,
      tree.new_path || ' / ' || concat_ws(' - ', tree.new_code || '-' || b.new_code, b.new_name)
    FROM branch b JOIN tree ON b.parent_id = tree.id
  )
  SELECT jsonb_agg(jsonb_build_object(
      'source_id', tree.id, 'source_parent_id', tree.parent_id, 'depth', tree.depth,
      'code', tree.new_code, 'name', tree.new_name, 'location_path', tree.new_path,
      'location_type', tree.location_type, 'is_storable', tree.is_storable,
      'is_pickable', tree.is_pickable, 'is_active', tree.is_active,
      'max_capacity', tree.max_capacity
    ) ORDER BY tree.new_path)
  INTO v_rows FROM tree;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(v_rows) AS r(code TEXT, name TEXT)
    WHERE length(r.code) NOT BETWEEN 1 AND 100 OR length(r.name) > 200
  ) THEN
    RAISE EXCEPTION 'LOCATION_COPY_INVALID';
  END IF;

  RETURN QUERY
  SELECT r.source_id, r.source_parent_id, r.depth, r.code, r.name, r.location_path,
    r.location_type, r.is_storable, r.is_pickable, r.is_active, r.max_capacity
  FROM jsonb_to_recordset(v_rows) AS r(
    source_id UUID, source_parent_id UUID, depth INTEGER, code TEXT, name TEXT,
    location_path TEXT, location_type TEXT, is_storable BOOLEAN, is_pickable BOOLEAN,
    is_active BOOLEAN, max_capacity NUMERIC
  );
END $$;
REVOKE ALL ON FUNCTION public.plan_warehouse_location_copy(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.plan_warehouse_location_copy(UUID, UUID, UUID, TEXT, TEXT) TO authenticated;

-- Copies the planned branch in one transaction: settings are copied, stock and floor-map
-- positions are not. Rows are inserted level by level with pre-assigned ids so each child's
-- parent already exists for the hierarchy trigger. Any failure leaves no copied rows.
CREATE FUNCTION public.copy_warehouse_location_structure(
  p_business_unit_id UUID, p_source_id UUID,
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

  PERFORM 1 FROM public.warehouse_locations WHERE id = p_source_id FOR UPDATE;

  SELECT jsonb_agg(jsonb_build_object(
      'new_id', gen_random_uuid(), 'source_id', plan.source_id,
      'source_parent_id', plan.source_parent_id, 'depth', plan.depth, 'code', plan.code,
      'name', plan.name, 'location_type', plan.location_type, 'is_storable', plan.is_storable,
      'is_pickable', plan.is_pickable, 'is_active', plan.is_active,
      'max_capacity', plan.max_capacity
    ))
  INTO v_plan
  FROM public.plan_warehouse_location_copy(
    p_business_unit_id, p_source_id, p_destination_parent_id,
    p_name_find, p_name_replace
  ) plan;

  SELECT MAX(r.depth) INTO v_max_depth FROM jsonb_to_recordset(v_plan) AS r(depth INTEGER);
  FOR v_depth IN 0..v_max_depth LOOP
    INSERT INTO public.warehouse_locations(
      id, company_id, warehouse_id, parent_id, name, location_type, is_storable,
      is_pickable, is_active, max_capacity, created_by, updated_by
    )
    SELECT r.new_id, v_company, v_warehouse,
      CASE WHEN r.depth = 0 THEN p_destination_parent_id ELSE parent.new_id END,
      r.name, r.location_type, r.is_storable, r.is_pickable, r.is_active,
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
REVOKE ALL ON FUNCTION public.copy_warehouse_location_structure(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.copy_warehouse_location_structure(UUID, UUID, UUID, TEXT, TEXT) TO authenticated;


COMMIT;
