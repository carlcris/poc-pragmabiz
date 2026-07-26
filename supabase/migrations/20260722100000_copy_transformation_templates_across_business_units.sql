-- Allow transformation templates to be copied across business units without
-- sharing ownership or creating a live dependency on the source template.

-- Keep database-owned BU scoping aligned with the server request context when
-- a session does not yet contain the custom current_business_unit_id claim.
-- The selected is_current row must take precedence over the default BU.
CREATE OR REPLACE FUNCTION public.get_current_business_unit_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_business_unit_id TEXT := NULLIF(auth.jwt() ->> 'current_business_unit_id', '');
  v_user_id UUID := auth.uid();
BEGIN
  IF v_business_unit_id IS NULL AND v_user_id IS NOT NULL THEN
    SELECT access.business_unit_id::TEXT
    INTO v_business_unit_id
    FROM public.user_business_unit_access access
    WHERE access.user_id = v_user_id
      AND access.is_current IS TRUE
    LIMIT 1;
  END IF;

  IF v_business_unit_id IS NULL AND v_user_id IS NOT NULL THEN
    SELECT access.business_unit_id::TEXT
    INTO v_business_unit_id
    FROM public.user_business_unit_access access
    WHERE access.user_id = v_user_id
      AND access.is_default IS TRUE
    LIMIT 1;
  END IF;

  RETURN v_business_unit_id::UUID;
EXCEPTION
  WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_current_business_unit_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_business_unit_id()
  TO postgres, service_role, authenticated, anon;

ALTER TABLE public.transformation_templates
ADD COLUMN copied_from_template_id UUID REFERENCES public.transformation_templates(id) ON DELETE SET NULL,
ADD COLUMN copied_from_business_unit_id UUID REFERENCES public.business_units(id) ON DELETE SET NULL,
ADD COLUMN copied_at TIMESTAMPTZ;

COMMENT ON COLUMN public.transformation_templates.copied_from_template_id IS
  'Optional source template used to initialize this independent template copy';
COMMENT ON COLUMN public.transformation_templates.copied_from_business_unit_id IS
  'Business unit that owned the source template when this copy was created';
COMMENT ON COLUMN public.transformation_templates.copied_at IS
  'Timestamp when this independent template copy was created';

CREATE INDEX idx_transformation_templates_copied_from
ON public.transformation_templates(copied_from_template_id)
WHERE copied_from_template_id IS NOT NULL;

-- The original UNIQUE(company_id, template_code, deleted_at) constraint permits
-- duplicate active codes because NULL values are distinct. Enforce the intended
-- active-row uniqueness contract and protect concurrent template creation.
CREATE UNIQUE INDEX uq_transformation_templates_active_code
ON public.transformation_templates(company_id, template_code)
WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.list_transformation_template_copy_sources(
  p_scope TEXT,
  p_template_kind TEXT,
  p_search TEXT DEFAULT NULL,
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  template_code TEXT,
  template_name TEXT,
  description TEXT,
  template_kind TEXT,
  business_unit_id UUID,
  business_unit_code TEXT,
  business_unit_name TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_current_business_unit_id UUID := public.get_current_business_unit_id();
  v_search TEXT := NULLIF(BTRIM(p_search), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  IF p_scope NOT IN ('current', 'other') THEN
    RAISE EXCEPTION 'Invalid copy source scope' USING ERRCODE = 'P0001';
  END IF;

  IF p_template_kind NOT IN ('recipe', 'sheet_layout') THEN
    RAISE EXCEPTION 'Invalid template kind' USING ERRCODE = 'P0001';
  END IF;

  IF p_offset < 0 OR p_limit < 1 OR p_limit > 50 THEN
    RAISE EXCEPTION 'Invalid pagination' USING ERRCODE = 'P0001';
  END IF;

  SELECT u.company_id
  INTO v_company_id
  FROM public.users u
  WHERE u.id = v_user_id
    AND u.is_active IS TRUE
    AND u.deleted_at IS NULL;

  IF v_company_id IS NULL OR v_current_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.business_units bu
    WHERE bu.id = v_current_business_unit_id
      AND bu.company_id = v_company_id
      AND bu.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Business unit context is invalid' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.user_has_permission(
    v_user_id,
    'stock_transformations',
    'create',
    v_current_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.template_code::TEXT,
    t.template_name::TEXT,
    t.description,
    t.template_kind,
    bu.id,
    bu.code::TEXT,
    bu.name::TEXT,
    COUNT(*) OVER ()::BIGINT
  FROM public.transformation_templates t
  INNER JOIN public.business_units bu
    ON bu.id = t.business_unit_id
   AND bu.company_id = v_company_id
   AND bu.is_active IS TRUE
  WHERE t.company_id = v_company_id
    AND t.deleted_at IS NULL
    AND t.is_active IS TRUE
    AND t.template_kind = p_template_kind
    AND (
      (p_scope = 'current' AND t.business_unit_id = v_current_business_unit_id)
      OR
      (p_scope = 'other' AND t.business_unit_id <> v_current_business_unit_id)
    )
    AND (
      v_search IS NULL
      OR t.template_code ILIKE '%' || v_search || '%'
      OR t.template_name ILIKE '%' || v_search || '%'
      OR COALESCE(t.description, '') ILIKE '%' || v_search || '%'
      OR bu.code ILIKE '%' || v_search || '%'
      OR bu.name ILIKE '%' || v_search || '%'
    )
  ORDER BY bu.name ASC, t.template_name ASC, t.id ASC
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_transformation_template_copy_source(
  p_template_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_current_business_unit_id UUID := public.get_current_business_unit_id();
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT u.company_id
  INTO v_company_id
  FROM public.users u
  WHERE u.id = v_user_id
    AND u.is_active IS TRUE
    AND u.deleted_at IS NULL;

  IF v_company_id IS NULL OR v_current_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.user_has_permission(
    v_user_id,
    'stock_transformations',
    'create',
    v_current_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'id', t.id,
    'company_id', t.company_id,
    'business_unit_id', t.business_unit_id,
    'source_business_unit_code', bu.code,
    'source_business_unit_name', bu.name,
    'template_code', t.template_code,
    'template_name', t.template_name,
    'description', t.description,
    'image_url', t.image_url,
    'template_kind', t.template_kind,
    'sheet_width', t.sheet_width,
    'sheet_height', t.sheet_height,
    'sheet_unit', t.sheet_unit,
    'layout_json', t.layout_json,
    'is_active', t.is_active,
    'usage_count', t.usage_count,
    'inputs', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', ti.id,
          'item_id', ti.item_id,
          'quantity', ti.quantity,
          'uom_id', ti.uom_id,
          'sequence', ti.sequence,
          'notes', ti.notes,
          'items', jsonb_build_object(
            'id', i.id,
            'item_code', i.item_code,
            'item_name', i.item_name
          ),
          'uom', jsonb_build_object(
            'id', uom.id,
            'code', uom.code,
            'name', uom.name
          )
        )
        ORDER BY ti.sequence ASC, ti.id ASC
      )
      FROM public.transformation_template_inputs ti
      INNER JOIN public.items i ON i.id = ti.item_id
      INNER JOIN public.units_of_measure uom ON uom.id = ti.uom_id
      WHERE ti.template_id = t.id
    ), '[]'::JSONB),
    'outputs', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', tout.id,
          'item_id', tout.item_id,
          'quantity', tout.quantity,
          'uom_id', tout.uom_id,
          'sequence', tout.sequence,
          'is_scrap', tout.is_scrap,
          'notes', tout.notes,
          'items', jsonb_build_object(
            'id', i.id,
            'item_code', i.item_code,
            'item_name', i.item_name
          ),
          'uom', jsonb_build_object(
            'id', uom.id,
            'code', uom.code,
            'name', uom.name
          )
        )
        ORDER BY tout.sequence ASC, tout.id ASC
      )
      FROM public.transformation_template_outputs tout
      INNER JOIN public.items i ON i.id = tout.item_id
      INNER JOIN public.units_of_measure uom ON uom.id = tout.uom_id
      WHERE tout.template_id = t.id
    ), '[]'::JSONB)
  )
  INTO v_result
  FROM public.transformation_templates t
  INNER JOIN public.business_units bu
    ON bu.id = t.business_unit_id
   AND bu.company_id = v_company_id
   AND bu.is_active IS TRUE
  WHERE t.id = p_template_id
    AND t.company_id = v_company_id
    AND t.is_active IS TRUE
    AND t.deleted_at IS NULL;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Copy source not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_transformation_template(
  p_template_code TEXT,
  p_template_name TEXT,
  p_template_kind TEXT DEFAULT 'recipe',
  p_description TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_sheet_width NUMERIC DEFAULT NULL,
  p_sheet_height NUMERIC DEFAULT NULL,
  p_sheet_unit TEXT DEFAULT NULL,
  p_layout JSONB DEFAULT NULL,
  p_inputs JSONB DEFAULT '[]'::JSONB,
  p_outputs JSONB DEFAULT '[]'::JSONB,
  p_copied_from_template_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_current_business_unit_id UUID := public.get_current_business_unit_id();
  v_source_business_unit_id UUID;
  v_source_template_kind TEXT;
  v_template_id UUID;
  v_uuid_pattern CONSTANT TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_number_pattern CONSTANT TEXT := '^[0-9]+([.][0-9]+)?$';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT u.company_id
  INTO v_company_id
  FROM public.users u
  WHERE u.id = v_user_id
    AND u.is_active IS TRUE
    AND u.deleted_at IS NULL;

  IF v_company_id IS NULL OR v_current_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.business_units bu
    WHERE bu.id = v_current_business_unit_id
      AND bu.company_id = v_company_id
      AND bu.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Business unit context is invalid' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.user_has_permission(
    v_user_id,
    'stock_transformations',
    'create',
    v_current_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = 'P0001';
  END IF;

  IF NULLIF(BTRIM(p_template_code), '') IS NULL OR LENGTH(BTRIM(p_template_code)) > 50 THEN
    RAISE EXCEPTION 'Template code is required and must not exceed 50 characters'
      USING ERRCODE = 'P0001';
  END IF;

  IF NULLIF(BTRIM(p_template_name), '') IS NULL OR LENGTH(BTRIM(p_template_name)) > 200 THEN
    RAISE EXCEPTION 'Template name is required and must not exceed 200 characters'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_template_kind NOT IN ('recipe', 'sheet_layout') THEN
    RAISE EXCEPTION 'Invalid template kind' USING ERRCODE = 'P0001';
  END IF;

  IF p_description IS NOT NULL AND LENGTH(p_description) > 1000 THEN
    RAISE EXCEPTION 'Description must not exceed 1000 characters' USING ERRCODE = 'P0001';
  END IF;

  IF JSONB_TYPEOF(p_inputs) <> 'array' OR JSONB_TYPEOF(p_outputs) <> 'array' THEN
    RAISE EXCEPTION 'Template inputs and outputs must be arrays' USING ERRCODE = 'P0001';
  END IF;

  IF JSONB_ARRAY_LENGTH(p_inputs) < 1 OR JSONB_ARRAY_LENGTH(p_inputs) > 100
     OR JSONB_ARRAY_LENGTH(p_outputs) < 1 OR JSONB_ARRAY_LENGTH(p_outputs) > 100 THEN
    RAISE EXCEPTION 'Templates require between 1 and 100 inputs and outputs'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_template_kind = 'sheet_layout' AND (
    p_sheet_width IS NULL OR p_sheet_width <= 0
    OR p_sheet_height IS NULL OR p_sheet_height <= 0
    OR p_sheet_unit NOT IN ('in', 'cm', 'mm')
    OR p_layout IS NULL OR JSONB_TYPEOF(p_layout) <> 'object'
  ) THEN
    RAISE EXCEPTION 'Sheet size, unit, and layout are required for designer templates'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_inputs) input_row
    WHERE COALESCE(input_row->>'itemId', '') !~ v_uuid_pattern
       OR COALESCE(input_row->>'uomId', '') !~ v_uuid_pattern
       OR COALESCE(input_row->>'quantity', '') !~ v_number_pattern
       OR (input_row->>'quantity')::NUMERIC <= 0
       OR (
         input_row ? 'sequence'
         AND COALESCE(input_row->>'sequence', '') !~ '^[1-9][0-9]*$'
       )
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_outputs) output_row
    WHERE COALESCE(output_row->>'itemId', '') !~ v_uuid_pattern
       OR COALESCE(output_row->>'uomId', '') !~ v_uuid_pattern
       OR COALESCE(output_row->>'quantity', '') !~ v_number_pattern
       OR (output_row->>'quantity')::NUMERIC <= 0
       OR (
         output_row ? 'sequence'
         AND COALESCE(output_row->>'sequence', '') !~ '^[1-9][0-9]*$'
       )
       OR (
         output_row ? 'isScrap'
         AND JSONB_TYPEOF(output_row->'isScrap') <> 'boolean'
       )
  ) THEN
    RAISE EXCEPTION 'Template input or output data is invalid' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT input_row->>'itemId'
    FROM jsonb_array_elements(p_inputs) input_row
    GROUP BY input_row->>'itemId'
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate items in inputs are not allowed' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT output_row->>'itemId'
    FROM jsonb_array_elements(p_outputs) output_row
    GROUP BY output_row->>'itemId'
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate items in outputs are not allowed' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_inputs) input_row
    INNER JOIN jsonb_array_elements(p_outputs) output_row
      ON output_row->>'itemId' = input_row->>'itemId'
  ) THEN
    RAISE EXCEPTION 'Input and output items must be different' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT input_row->>'itemId' AS item_id, input_row->>'uomId' AS uom_id
      FROM jsonb_array_elements(p_inputs) input_row
      UNION ALL
      SELECT output_row->>'itemId' AS item_id, output_row->>'uomId' AS uom_id
      FROM jsonb_array_elements(p_outputs) output_row
    ) referenced
    LEFT JOIN public.items i
      ON i.id = referenced.item_id::UUID
     AND i.company_id = v_company_id
     AND i.is_active IS TRUE
     AND i.deleted_at IS NULL
    LEFT JOIN public.units_of_measure uom
      ON uom.id = referenced.uom_id::UUID
     AND uom.company_id = v_company_id
     AND uom.is_active IS TRUE
     AND uom.deleted_at IS NULL
    WHERE i.id IS NULL OR uom.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Template contains an unavailable item or unit of measure'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_copied_from_template_id IS NOT NULL THEN
    SELECT source.business_unit_id, source.template_kind
    INTO v_source_business_unit_id, v_source_template_kind
    FROM public.transformation_templates source
    INNER JOIN public.business_units source_bu
      ON source_bu.id = source.business_unit_id
     AND source_bu.company_id = v_company_id
     AND source_bu.is_active IS TRUE
    WHERE source.id = p_copied_from_template_id
      AND source.company_id = v_company_id
      AND source.is_active IS TRUE
      AND source.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Copy source not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_source_template_kind <> p_template_kind THEN
      RAISE EXCEPTION 'Copy source template kind does not match'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.transformation_templates (
    company_id,
    business_unit_id,
    template_code,
    template_name,
    description,
    image_url,
    template_kind,
    sheet_width,
    sheet_height,
    sheet_unit,
    layout_json,
    is_active,
    usage_count,
    copied_from_template_id,
    copied_from_business_unit_id,
    copied_at,
    created_by,
    updated_by
  ) VALUES (
    v_company_id,
    v_current_business_unit_id,
    BTRIM(p_template_code),
    BTRIM(p_template_name),
    NULLIF(BTRIM(p_description), ''),
    NULLIF(BTRIM(p_image_url), ''),
    p_template_kind,
    p_sheet_width,
    p_sheet_height,
    p_sheet_unit,
    p_layout,
    TRUE,
    0,
    p_copied_from_template_id,
    v_source_business_unit_id,
    CASE WHEN p_copied_from_template_id IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END,
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_template_id;

  INSERT INTO public.transformation_template_inputs (
    template_id,
    item_id,
    quantity,
    uom_id,
    sequence,
    notes,
    created_by,
    updated_by
  )
  SELECT
    v_template_id,
    (input_row->>'itemId')::UUID,
    (input_row->>'quantity')::NUMERIC,
    (input_row->>'uomId')::UUID,
    COALESCE((input_row->>'sequence')::INTEGER, ordinality::INTEGER),
    NULLIF(input_row->>'notes', ''),
    v_user_id,
    v_user_id
  FROM jsonb_array_elements(p_inputs) WITH ORDINALITY AS source(input_row, ordinality);

  INSERT INTO public.transformation_template_outputs (
    template_id,
    item_id,
    quantity,
    uom_id,
    sequence,
    is_scrap,
    notes,
    created_by,
    updated_by
  )
  SELECT
    v_template_id,
    (output_row->>'itemId')::UUID,
    (output_row->>'quantity')::NUMERIC,
    (output_row->>'uomId')::UUID,
    COALESCE((output_row->>'sequence')::INTEGER, ordinality::INTEGER),
    COALESCE((output_row->>'isScrap')::BOOLEAN, FALSE),
    NULLIF(output_row->>'notes', ''),
    v_user_id,
    v_user_id
  FROM jsonb_array_elements(p_outputs) WITH ORDINALITY AS source(output_row, ordinality);

  RETURN v_template_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Template code already exists' USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION public.list_transformation_template_copy_sources(TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_transformation_template_copy_source(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_transformation_template(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, JSONB, JSONB, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_transformation_template_copy_sources(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_transformation_template_copy_source(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_transformation_template(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, JSONB, JSONB, UUID) TO authenticated;
