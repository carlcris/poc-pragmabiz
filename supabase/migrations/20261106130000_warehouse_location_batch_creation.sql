BEGIN;

-- Expands a numbered location range. Preview and creation share it so they cannot drift.
CREATE FUNCTION public.expand_warehouse_location_batch(
  p_code_prefix TEXT, p_from INTEGER, p_to INTEGER, p_digits INTEGER, p_name_prefix TEXT
)
RETURNS TABLE (sequence_number INTEGER, code TEXT, name TEXT)
LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE v_number INTEGER;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_digits IS NULL OR p_from < 0 OR p_to < p_from
     OR p_to - p_from >= 100 OR p_digits < 1 OR p_digits > 6 THEN
    RAISE EXCEPTION 'LOCATION_BATCH_INVALID';
  END IF;
  FOR v_number IN p_from..p_to LOOP
    sequence_number := v_number - p_from + 1;
    -- Pad to the requested width without truncating longer numbers.
    code := btrim(COALESCE(p_code_prefix, '')
      || lpad(v_number::TEXT, GREATEST(p_digits, length(v_number::TEXT)), '0'));
    name := CASE WHEN btrim(COALESCE(p_name_prefix, '')) = '' THEN NULL
      ELSE btrim(p_name_prefix || v_number::TEXT) END;
    IF length(code) NOT BETWEEN 1 AND 100 OR length(name) > 200 THEN
      RAISE EXCEPTION 'LOCATION_BATCH_INVALID';
    END IF;
    RETURN NEXT;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.expand_warehouse_location_batch(TEXT, INTEGER, INTEGER, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expand_warehouse_location_batch(TEXT, INTEGER, INTEGER, INTEGER, TEXT) TO authenticated;

-- Resolves caller scope and the optional parent; shared by preview and create.
CREATE FUNCTION public.resolve_warehouse_location_batch_scope(
  p_business_unit_id UUID, p_warehouse_id UUID, p_parent_id UUID, p_lock BOOLEAN
)
RETURNS TABLE (company_id UUID, parent_path TEXT, parent_active BOOLEAN)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_company UUID;
BEGIN
  SELECT u.company_id INTO v_company FROM public.users u WHERE u.id = (SELECT auth.uid());
  IF v_company IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_business_unit_access a
    WHERE a.user_id = (SELECT auth.uid()) AND a.business_unit_id = p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'LOCATION_WAREHOUSE_INVALID';
  END IF;
  IF p_lock THEN
    -- Same serialization point as validate_warehouse_location_hierarchy.
    PERFORM 1 FROM public.warehouses w
    WHERE w.id = p_warehouse_id AND w.company_id = v_company
      AND w.business_unit_id = p_business_unit_id AND w.deleted_at IS NULL
    FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.warehouses w
    WHERE w.id = p_warehouse_id AND w.company_id = v_company
      AND w.business_unit_id = p_business_unit_id AND w.deleted_at IS NULL;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_WAREHOUSE_INVALID'; END IF;

  IF p_parent_id IS NULL THEN
    RETURN QUERY SELECT v_company, NULL::TEXT, TRUE;
    RETURN;
  END IF;
  RETURN QUERY
  SELECT v_company, l.location_path, COALESCE(l.is_active, FALSE)
  FROM public.warehouse_locations l
  WHERE l.id = p_parent_id AND l.company_id = v_company
    AND l.warehouse_id = p_warehouse_id AND l.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_PARENT_INVALID'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.resolve_warehouse_location_batch_scope(UUID, UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_warehouse_location_batch_scope(UUID, UUID, UUID, BOOLEAN) TO authenticated;

-- Read-only preview: every generated code with its future address and availability.
-- Codes are unique per warehouse including soft-deleted rows, so availability checks every row.
CREATE FUNCTION public.preview_warehouse_locations_batch(
  p_business_unit_id UUID, p_warehouse_id UUID, p_code_prefix TEXT, p_from INTEGER,
  p_to INTEGER, p_digits INTEGER, p_parent_id UUID DEFAULT NULL, p_name_prefix TEXT DEFAULT NULL
)
RETURNS TABLE (code TEXT, name TEXT, location_path TEXT, already_exists BOOLEAN)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT batch.code, batch.name,
    concat_ws(' / ', scope.parent_path, concat_ws(' - ', batch.code, batch.name)),
    EXISTS (
      SELECT 1 FROM public.warehouse_locations l
      WHERE l.company_id = scope.company_id AND l.warehouse_id = p_warehouse_id
        AND l.code = batch.code
    )
  FROM public.resolve_warehouse_location_batch_scope(
    p_business_unit_id, p_warehouse_id, p_parent_id, FALSE
  ) scope
  CROSS JOIN public.expand_warehouse_location_batch(
    p_code_prefix, p_from, p_to, p_digits, p_name_prefix
  ) batch
  ORDER BY batch.sequence_number;
$$;
REVOKE ALL ON FUNCTION public.preview_warehouse_locations_batch(UUID, UUID, TEXT, INTEGER, INTEGER, INTEGER, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_warehouse_locations_batch(UUID, UUID, TEXT, INTEGER, INTEGER, INTEGER, UUID, TEXT) TO authenticated;

-- Creates up to 100 sibling locations in one transaction. Any failure, including a later row's
-- hierarchy trigger, rolls back every row. Existing codes either block the batch or are skipped.
CREATE FUNCTION public.create_warehouse_locations_batch(
  p_business_unit_id UUID, p_warehouse_id UUID, p_code_prefix TEXT, p_from INTEGER,
  p_to INTEGER, p_digits INTEGER, p_location_type TEXT, p_is_storable BOOLEAN,
  p_is_pickable BOOLEAN, p_is_active BOOLEAN, p_skip_existing BOOLEAN,
  p_parent_id UUID DEFAULT NULL, p_name_prefix TEXT DEFAULT NULL, p_max_capacity NUMERIC DEFAULT NULL
)
RETURNS TABLE (created_count INTEGER, skipped_count INTEGER)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_company UUID; v_parent_active BOOLEAN; v_requested INTEGER; v_existing INTEGER; v_created INTEGER;
BEGIN
  IF p_is_storable IS NULL OR p_is_pickable IS NULL OR p_is_active IS NULL OR p_skip_existing IS NULL
     OR (p_is_pickable AND NOT p_is_storable) OR (p_max_capacity IS NOT NULL AND p_max_capacity <= 0) THEN
    RAISE EXCEPTION 'LOCATION_BATCH_INVALID';
  END IF;
  IF p_max_capacity IS NOT NULL AND NOT p_is_storable THEN
    RAISE EXCEPTION 'CAPACITY_REQUIRES_STORABLE_LOCATION';
  END IF;

  SELECT scope.company_id, scope.parent_active INTO v_company, v_parent_active
  FROM public.resolve_warehouse_location_batch_scope(
    p_business_unit_id, p_warehouse_id, p_parent_id, TRUE
  ) scope;
  IF p_is_active AND NOT v_parent_active THEN RAISE EXCEPTION 'LOCATION_PARENT_INVALID'; END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM public.warehouse_locations l
      WHERE l.company_id = v_company AND l.warehouse_id = p_warehouse_id AND l.code = batch.code
    ))
  INTO v_requested, v_existing
  FROM public.expand_warehouse_location_batch(p_code_prefix, p_from, p_to, p_digits, p_name_prefix) batch;
  IF v_existing > 0 AND NOT p_skip_existing THEN RAISE EXCEPTION 'LOCATION_CODE_EXISTS'; END IF;
  IF v_existing = v_requested THEN RAISE EXCEPTION 'LOCATION_BATCH_EMPTY'; END IF;

  INSERT INTO public.warehouse_locations(
    company_id, warehouse_id, parent_id, code, name, location_type, is_storable, is_pickable,
    is_active, max_capacity, created_by, updated_by
  )
  SELECT v_company, p_warehouse_id, p_parent_id, batch.code, batch.name, p_location_type,
    p_is_storable, p_is_pickable, p_is_active, p_max_capacity, (SELECT auth.uid()), (SELECT auth.uid())
  FROM public.expand_warehouse_location_batch(p_code_prefix, p_from, p_to, p_digits, p_name_prefix) batch
  WHERE NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations l
    WHERE l.company_id = v_company AND l.warehouse_id = p_warehouse_id AND l.code = batch.code
  )
  ORDER BY batch.sequence_number;
  GET DIAGNOSTICS v_created = ROW_COUNT;

  RETURN QUERY SELECT v_created, v_requested - v_created;
END $$;
REVOKE ALL ON FUNCTION public.create_warehouse_locations_batch(UUID, UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, UUID, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_warehouse_locations_batch(UUID, UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, UUID, TEXT, NUMERIC) TO authenticated;

COMMIT;
