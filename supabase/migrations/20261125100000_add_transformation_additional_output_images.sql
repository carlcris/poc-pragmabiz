-- Private originals and generated thumbnails for additional template outputs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transformation-output-images',
  'transformation-output-images',
  false,
  4194304,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);
-- Storage access is server-owned. Existing object policies target item-images.

ALTER TABLE public.transformation_template_additional_outputs
ADD COLUMN image_path TEXT,
ADD CONSTRAINT transformation_template_additional_output_image_path_check
CHECK (
  image_path IS NULL OR image_path ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}){3}$'
);

COMMENT ON COLUMN public.transformation_template_additional_outputs.image_path IS
  'Private image base path. Originals use /original and generated thumbnails use /thumbnail.webp.';

-- Prevent a direct Data API write from bypassing image ownership validation.
-- Retain authenticated mutation access to all existing columns under current RLS.
REVOKE INSERT, UPDATE ON public.transformation_template_additional_outputs
FROM authenticated, anon, PUBLIC;
GRANT INSERT (
  id, template_id, item_id, quantity, sequence, notes,
  created_at, created_by, updated_at, updated_by
), UPDATE (
  id, template_id, item_id, quantity, sequence, notes,
  created_at, created_by, updated_at, updated_by
) ON public.transformation_template_additional_outputs TO authenticated;

CREATE OR REPLACE FUNCTION public.get_transformation_template_copy_source_with_additional_outputs(
  p_template_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  v_result := public.get_transformation_template_copy_source(p_template_id);

  RETURN v_result || jsonb_build_object(
    'additional_outputs',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', additional.id,
          'item_id', additional.item_id,
          'quantity', additional.quantity,
          'sequence', additional.sequence,
          'notes', additional.notes,
          'image_path', additional.image_path,
          'items', jsonb_build_object(
            'id', item.id,
            'item_code', item.item_code,
            'item_name', item.item_name
          ),
          'uom', jsonb_build_object(
            'id', uom.id,
            'code', uom.code,
            'name', uom.name
          )
        )
        ORDER BY additional.sequence, additional.id
      )
      FROM public.transformation_template_additional_outputs additional
      INNER JOIN public.items item
        ON item.id = additional.item_id
       AND item.deleted_at IS NULL
      INNER JOIN public.units_of_measure uom
        ON uom.id = item.uom_id
       AND uom.deleted_at IS NULL
      WHERE additional.template_id = p_template_id
    ), '[]'::JSONB)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_transformation_template_with_additional_outputs(
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
  p_copied_from_template_id UUID DEFAULT NULL,
  p_additional_outputs JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_business_unit_id UUID := public.get_current_business_unit_id();
  v_template_id UUID;
  v_uuid_pattern CONSTANT TEXT :=
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_number_pattern CONSTANT TEXT := '^[0-9]+([.][0-9]+)?$';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
  END IF;

  SELECT user_row.company_id
  INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_user_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User company not found' USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(COALESCE(p_additional_outputs, '[]'::JSONB)) <> 'array'
     OR jsonb_array_length(COALESCE(p_additional_outputs, '[]'::JSONB)) > 50 THEN
    RAISE EXCEPTION 'Invalid additional outputs' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_additional_outputs, '[]'::JSONB)) additional
    WHERE COALESCE(additional ->> 'itemId', '') !~ v_uuid_pattern
      OR COALESCE(additional ->> 'quantity', '') !~ v_number_pattern
      OR (additional ->> 'quantity')::NUMERIC <= 0
      OR (
        additional ? 'sequence'
        AND COALESCE(additional ->> 'sequence', '') !~ '^[1-9][0-9]*$'
      )
      OR LENGTH(COALESCE(additional ->> 'notes', '')) > 500
  ) THEN
    RAISE EXCEPTION 'Template additional output data is invalid' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT additional ->> 'itemId'
    FROM jsonb_array_elements(COALESCE(p_additional_outputs, '[]'::JSONB)) additional
    GROUP BY additional ->> 'itemId'
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate additional output items are not allowed' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_additional_outputs, '[]'::JSONB)) additional
    INNER JOIN jsonb_array_elements(COALESCE(p_outputs, '[]'::JSONB)) primary_output
      ON primary_output ->> 'itemId' = additional ->> 'itemId'
  ) THEN
    RAISE EXCEPTION 'Additional outputs must be different from primary outputs'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_additional_outputs, '[]'::JSONB)) additional
    LEFT JOIN public.items item
      ON item.id = (additional ->> 'itemId')::UUID
     AND item.company_id = v_company_id
     AND item.is_active IS TRUE
     AND item.is_stock_item IS TRUE
     AND item.item_type IN ('raw_material', 'finished_good')
     AND item.deleted_at IS NULL
    LEFT JOIN public.units_of_measure uom
      ON uom.id = item.uom_id
     AND uom.company_id = v_company_id
     AND uom.is_active IS TRUE
     AND uom.deleted_at IS NULL
    WHERE item.id IS NULL OR uom.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Template additional output item is unavailable'
      USING ERRCODE = 'P0001';
  END IF;

  v_template_id := public.create_transformation_template(
    p_template_code,
    p_template_name,
    p_template_kind,
    p_description,
    p_image_url,
    p_sheet_width,
    p_sheet_height,
    p_sheet_unit,
    p_layout,
    p_inputs,
    p_outputs,
    p_copied_from_template_id
  );

  -- The base operation has already checked caller permission, company, business
  -- unit, and the exact copy source. A later failure rolls back its header/lines.
  PERFORM 1
  FROM public.transformation_templates template
  WHERE template.id = v_template_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_additional_outputs, '[]'::JSONB)) additional
    LEFT JOIN storage.objects original
      ON original.bucket_id = 'transformation-output-images'
     AND original.name = (additional ->> 'imagePath') || '/original'
    LEFT JOIN storage.objects thumbnail
      ON thumbnail.bucket_id = 'transformation-output-images'
     AND thumbnail.name = (additional ->> 'imagePath') || '/thumbnail.webp'
    LEFT JOIN public.transformation_template_additional_outputs source_output
      ON source_output.template_id = p_copied_from_template_id
     AND source_output.item_id = (additional ->> 'itemId')::UUID
     AND source_output.image_path = additional ->> 'imagePath'
    WHERE additional ? 'imagePath'
      AND (
        jsonb_typeof(additional -> 'imagePath') IS DISTINCT FROM 'string'
        OR (additional ->> 'imagePath') !~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}){3}$'
        OR original.id IS NULL
        OR thumbnail.id IS NULL
        OR (
          split_part(additional ->> 'imagePath', '/', 1) || '/' ||
          split_part(additional ->> 'imagePath', '/', 2) || '/' ||
          split_part(additional ->> 'imagePath', '/', 3)
            IS DISTINCT FROM v_company_id::TEXT || '/' || v_business_unit_id::TEXT || '/' || v_user_id::TEXT
          AND source_output.id IS NULL
        )
      )
  ) THEN
    RAISE EXCEPTION 'Invalid additional output image' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.transformation_template_additional_outputs (
    template_id,
    item_id,
    quantity,
    sequence,
    notes,
    image_path,
    created_by,
    updated_by
  )
  SELECT
    v_template_id,
    (additional ->> 'itemId')::UUID,
    (additional ->> 'quantity')::NUMERIC,
    COALESCE((additional ->> 'sequence')::INTEGER, ordinality::INTEGER),
    NULLIF(BTRIM(COALESCE(additional ->> 'notes', '')), ''),
    additional ->> 'imagePath',
    v_user_id,
    v_user_id
  FROM jsonb_array_elements(COALESCE(p_additional_outputs, '[]'::JSONB))
    WITH ORDINALITY AS source(additional, ordinality);

  RETURN v_template_id;
END;
$$;

