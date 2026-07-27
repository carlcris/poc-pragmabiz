-- Add predetermined template outputs that are produced by a transformation
-- but are intentionally not represented as primary cuts in the template layout.

CREATE TABLE public.transformation_template_additional_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL
    REFERENCES public.transformation_templates(id) ON DELETE CASCADE,
  item_id UUID NOT NULL
    REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity NUMERIC(20, 2) NOT NULL CHECK (quantity > 0),
  sequence INTEGER NOT NULL DEFAULT 1 CHECK (sequence > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID NOT NULL REFERENCES public.users(id),
  CONSTRAINT uq_transformation_template_additional_output_item
    UNIQUE (template_id, item_id)
);

CREATE INDEX idx_transformation_template_additional_outputs_template
ON public.transformation_template_additional_outputs(template_id, sequence);

CREATE INDEX idx_transformation_template_additional_outputs_item
ON public.transformation_template_additional_outputs(item_id);

ALTER TABLE public.transformation_template_additional_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY transformation_template_additional_outputs_select
ON public.transformation_template_additional_outputs
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.transformation_templates template
    WHERE template.id = template_id
      AND template.business_unit_id = public.get_current_business_unit_id()
      AND template.deleted_at IS NULL
  )
);

CREATE POLICY transformation_template_additional_outputs_insert
ON public.transformation_template_additional_outputs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.transformation_templates template
    WHERE template.id = template_id
      AND template.business_unit_id = public.get_current_business_unit_id()
      AND template.deleted_at IS NULL
  )
);

CREATE POLICY transformation_template_additional_outputs_update
ON public.transformation_template_additional_outputs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.transformation_templates template
    WHERE template.id = template_id
      AND template.business_unit_id = public.get_current_business_unit_id()
      AND template.deleted_at IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.transformation_templates template
    WHERE template.id = template_id
      AND template.business_unit_id = public.get_current_business_unit_id()
      AND template.deleted_at IS NULL
  )
);

CREATE POLICY transformation_template_additional_outputs_delete
ON public.transformation_template_additional_outputs
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.transformation_templates template
    WHERE template.id = template_id
      AND template.business_unit_id = public.get_current_business_unit_id()
      AND template.deleted_at IS NULL
  )
);

CREATE TRIGGER prevent_used_template_additional_output_modification
BEFORE UPDATE OR DELETE ON public.transformation_template_additional_outputs
FOR EACH ROW EXECUTE FUNCTION public.prevent_template_detail_modification();

COMMENT ON TABLE public.transformation_template_additional_outputs IS
  'Predetermined inventory outputs inherited by orders but not represented as primary template layout cuts.';
COMMENT ON COLUMN public.transformation_template_additional_outputs.quantity IS
  'Output quantity per one template execution; the item base UOM is always used.';

ALTER TABLE public.transformation_order_outputs
ADD COLUMN output_origin TEXT NOT NULL DEFAULT 'template_primary';

ALTER TABLE public.transformation_order_outputs
ADD CONSTRAINT transformation_order_outputs_origin_check
CHECK (output_origin IN ('template_primary', 'planned_additional'));

ALTER TABLE public.transformation_order_outputs
DROP CONSTRAINT chk_produced_qty_when_executing;

ALTER TABLE public.transformation_order_outputs
ADD CONSTRAINT chk_produced_qty_when_executing
CHECK (produced_quantity IS NULL OR produced_quantity >= 0);

COMMENT ON COLUMN public.transformation_order_outputs.output_origin IS
  'Identifies whether an order output came from a primary template cut or a predetermined additional template output.';

CREATE OR REPLACE FUNCTION public.list_transformation_additional_output_items(
  p_search TEXT DEFAULT NULL,
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 5,
  p_excluded_item_ids UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS TABLE (
  id UUID,
  item_code TEXT,
  item_name TEXT,
  uom_id UUID,
  uom_code TEXT,
  uom_name TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_business_unit_id UUID := public.get_current_business_unit_id();
  v_search TEXT := NULLIF(BTRIM(p_search), '');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = 'P0001';
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

  IF v_company_id IS NULL OR v_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.business_units bu
    WHERE bu.id = v_business_unit_id
      AND bu.company_id = v_company_id
      AND bu.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Business unit context is invalid' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.user_has_permission(
    v_user_id,
    'stock_transformations',
    'create',
    v_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.item_code::TEXT,
    i.item_name::TEXT,
    i.uom_id,
    uom.code::TEXT,
    uom.name::TEXT,
    COUNT(*) OVER ()::BIGINT
  FROM public.items i
  INNER JOIN public.units_of_measure uom
    ON uom.id = i.uom_id
   AND uom.company_id = v_company_id
   AND uom.is_active IS TRUE
   AND uom.deleted_at IS NULL
  WHERE i.company_id = v_company_id
    AND i.is_active IS TRUE
    AND i.is_stock_item IS TRUE
    AND i.item_type IN ('raw_material', 'finished_good')
    AND i.deleted_at IS NULL
    AND NOT (i.id = ANY(COALESCE(p_excluded_item_ids, ARRAY[]::UUID[])))
    AND (
      v_search IS NULL
      OR i.item_code ILIKE '%' || v_search || '%'
      OR i.item_name ILIKE '%' || v_search || '%'
    )
  ORDER BY i.item_name ASC, i.item_code ASC, i.id ASC
  OFFSET p_offset
  LIMIT p_limit;
END;
$$;

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

  INSERT INTO public.transformation_template_additional_outputs (
    template_id,
    item_id,
    quantity,
    sequence,
    notes,
    created_by,
    updated_by
  )
  SELECT
    v_template_id,
    (additional ->> 'itemId')::UUID,
    (additional ->> 'quantity')::NUMERIC,
    COALESCE((additional ->> 'sequence')::INTEGER, ordinality::INTEGER),
    NULLIF(BTRIM(COALESCE(additional ->> 'notes', '')), ''),
    v_user_id,
    v_user_id
  FROM jsonb_array_elements(COALESCE(p_additional_outputs, '[]'::JSONB))
    WITH ORDINALITY AS source(additional, ordinality);

  RETURN v_template_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_transformation_order_transaction(
  p_template_id UUID,
  p_warehouse_id UUID,
  p_planned_quantity NUMERIC,
  p_order_date DATE DEFAULT CURRENT_DATE,
  p_planned_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
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
  v_order_id UUID;
  v_template_output_count INTEGER;
  v_total_input_cost NUMERIC;
  v_total_output_quantity NUMERIC;
  v_allocated_cost_per_unit NUMERIC;
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

  IF v_company_id IS NULL OR v_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.user_has_permission(
    v_user_id,
    'stock_transformations',
    'create',
    v_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(p_planned_quantity, 0) <= 0 THEN
    RAISE EXCEPTION 'Planned quantity must be greater than zero' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.business_units bu
    WHERE bu.id = v_business_unit_id
      AND bu.company_id = v_company_id
      AND bu.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Business unit context is invalid' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
  FROM public.transformation_templates t
  WHERE t.id = p_template_id
    AND t.company_id = v_company_id
    AND t.business_unit_id = v_business_unit_id
    AND t.is_active IS TRUE
    AND t.deleted_at IS NULL
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.warehouses w
    WHERE w.id = p_warehouse_id
      AND w.company_id = v_company_id
      AND w.business_unit_id = v_business_unit_id
      AND w.is_active IS TRUE
      AND w.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Warehouse not found' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.transformation_template_inputs tti
    WHERE tti.template_id = p_template_id
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.transformation_template_outputs tto
    WHERE tto.template_id = p_template_id
  ) THEN
    RAISE EXCEPTION 'Template requires input and output lines' USING ERRCODE = 'P0001';
  END IF;

  PERFORM i.id
  FROM public.items i
  WHERE i.id IN (
    SELECT tti.item_id
    FROM public.transformation_template_inputs tti
    WHERE tti.template_id = p_template_id

    UNION

    SELECT tto.item_id
    FROM public.transformation_template_outputs tto
    WHERE tto.template_id = p_template_id

    UNION

    SELECT additional.item_id
    FROM public.transformation_template_additional_outputs additional
    WHERE additional.template_id = p_template_id
  )
  ORDER BY i.id
  FOR SHARE;

  PERFORM uom.id
  FROM public.units_of_measure uom
  WHERE uom.id IN (
    SELECT tti.uom_id
    FROM public.transformation_template_inputs tti
    WHERE tti.template_id = p_template_id

    UNION

    SELECT tto.uom_id
    FROM public.transformation_template_outputs tto
    WHERE tto.template_id = p_template_id

    UNION

    SELECT i.uom_id
    FROM public.transformation_template_additional_outputs additional
    INNER JOIN public.items i
      ON i.id = additional.item_id
    WHERE additional.template_id = p_template_id
  )
  ORDER BY uom.id
  FOR SHARE;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT tti.item_id, tti.uom_id
      FROM public.transformation_template_inputs tti
      WHERE tti.template_id = p_template_id

      UNION ALL

      SELECT tto.item_id, tto.uom_id
      FROM public.transformation_template_outputs tto
      WHERE tto.template_id = p_template_id
    ) referenced
    LEFT JOIN public.items i
      ON i.id = referenced.item_id
    LEFT JOIN public.units_of_measure line_uom
      ON line_uom.id = referenced.uom_id
    LEFT JOIN public.units_of_measure base_uom
      ON base_uom.id = i.uom_id
    WHERE i.id IS NULL
      OR i.company_id IS DISTINCT FROM v_company_id
      OR i.is_active IS NOT TRUE
      OR i.deleted_at IS NOT NULL
      OR line_uom.id IS NULL
      OR line_uom.company_id IS DISTINCT FROM v_company_id
      OR line_uom.is_active IS NOT TRUE
      OR line_uom.deleted_at IS NOT NULL
      OR base_uom.id IS NULL
      OR base_uom.company_id IS DISTINCT FROM v_company_id
      OR base_uom.is_active IS NOT TRUE
      OR base_uom.deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Template contains an unavailable input or output item'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.transformation_template_additional_outputs additional
    LEFT JOIN public.items i
      ON i.id = additional.item_id
     AND i.company_id = v_company_id
     AND i.is_active IS TRUE
     AND i.is_stock_item IS TRUE
     AND i.item_type IN ('raw_material', 'finished_good')
     AND i.deleted_at IS NULL
    LEFT JOIN public.units_of_measure uom
      ON uom.id = i.uom_id
     AND uom.company_id = v_company_id
     AND uom.is_active IS TRUE
     AND uom.deleted_at IS NULL
    WHERE additional.template_id = p_template_id
      AND (i.id IS NULL OR uom.id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Template additional output item is unavailable' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.transformation_orders (
    company_id,
    business_unit_id,
    template_id,
    source_warehouse_id,
    status,
    planned_quantity,
    order_date,
    planned_date,
    notes,
    reference_type,
    reference_id,
    created_by,
    updated_by
  )
  VALUES (
    v_company_id,
    v_business_unit_id,
    p_template_id,
    p_warehouse_id,
    'DRAFT',
    p_planned_quantity,
    COALESCE(p_order_date, CURRENT_DATE),
    p_planned_date,
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    NULLIF(BTRIM(COALESCE(p_reference_type, '')), ''),
    p_reference_id,
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.transformation_order_inputs (
    order_id,
    item_id,
    warehouse_id,
    planned_quantity,
    uom_id,
    unit_cost,
    total_cost,
    sequence,
    notes,
    created_by,
    updated_by
  )
  SELECT
    v_order_id,
    tti.item_id,
    p_warehouse_id,
    tti.quantity * p_planned_quantity,
    tti.uom_id,
    COALESCE(i.purchase_price, 0),
    COALESCE(i.purchase_price, 0) * tti.quantity * p_planned_quantity,
    tti.sequence,
    tti.notes,
    v_user_id,
    v_user_id
  FROM public.transformation_template_inputs tti
  INNER JOIN public.items i
    ON i.id = tti.item_id
   AND i.company_id = v_company_id
   AND i.deleted_at IS NULL
  WHERE tti.template_id = p_template_id
  ORDER BY tti.sequence, tti.id;

  SELECT COALESCE(SUM(toi.total_cost), 0)
  INTO v_total_input_cost
  FROM public.transformation_order_inputs toi
  WHERE toi.order_id = v_order_id;

  INSERT INTO public.transformation_order_outputs (
    order_id,
    item_id,
    warehouse_id,
    planned_quantity,
    uom_id,
    is_scrap,
    output_origin,
    sequence,
    notes,
    created_by,
    updated_by
  )
  SELECT
    v_order_id,
    tto.item_id,
    p_warehouse_id,
    tto.quantity * p_planned_quantity,
    tto.uom_id,
    tto.is_scrap,
    'template_primary',
    tto.sequence,
    tto.notes,
    v_user_id,
    v_user_id
  FROM public.transformation_template_outputs tto
  WHERE tto.template_id = p_template_id
  ORDER BY tto.sequence, tto.id;

  SELECT COUNT(*)
  INTO v_template_output_count
  FROM public.transformation_template_outputs tto
  WHERE tto.template_id = p_template_id;

  INSERT INTO public.transformation_order_outputs (
    order_id,
    item_id,
    warehouse_id,
    planned_quantity,
    uom_id,
    is_scrap,
    output_origin,
    sequence,
    notes,
    created_by,
    updated_by
  )
  SELECT
    v_order_id,
    additional.item_id,
    p_warehouse_id,
    additional.quantity * p_planned_quantity,
    i.uom_id,
    FALSE,
    'planned_additional',
    v_template_output_count + additional.sequence,
    additional.notes,
    v_user_id,
    v_user_id
  FROM public.transformation_template_additional_outputs additional
  INNER JOIN public.items i
    ON i.id = additional.item_id
   AND i.company_id = v_company_id
   AND i.deleted_at IS NULL
  WHERE additional.template_id = p_template_id
  ORDER BY additional.sequence, additional.id;

  SELECT COALESCE(SUM(too.planned_quantity) FILTER (WHERE too.is_scrap IS FALSE), 0)
  INTO v_total_output_quantity
  FROM public.transformation_order_outputs too
  WHERE too.order_id = v_order_id;

  v_allocated_cost_per_unit := CASE
    WHEN v_total_output_quantity > 0
      THEN v_total_input_cost / v_total_output_quantity
    ELSE 0
  END;

  UPDATE public.transformation_order_outputs
  SET allocated_cost_per_unit = CASE WHEN is_scrap THEN 0 ELSE v_allocated_cost_per_unit END,
      total_allocated_cost = CASE
        WHEN is_scrap THEN 0
        ELSE v_allocated_cost_per_unit * planned_quantity
      END,
      updated_by = v_user_id,
      updated_at = NOW()
  WHERE order_id = v_order_id;

  UPDATE public.transformation_orders
  SET total_input_cost = v_total_input_cost,
      total_output_cost = (
        SELECT COALESCE(SUM(too.total_allocated_cost), 0)
        FROM public.transformation_order_outputs too
        WHERE too.order_id = v_order_id
      ),
      cost_variance = (
        SELECT COALESCE(SUM(too.total_allocated_cost), 0)
        FROM public.transformation_order_outputs too
        WHERE too.order_id = v_order_id
      ) - v_total_input_cost,
      updated_by = v_user_id,
      updated_at = NOW()
  WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_transformation_order_transaction(
  p_order_id UUID,
  p_inputs JSONB,
  p_outputs JSONB,
  p_execution_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_business_unit_id UUID := public.get_current_business_unit_id();
  v_order RECORD;
  v_input RECORD;
  v_output RECORD;
  v_warehouse_stock RECORD;
  v_batch_location RECORD;
  v_default_location_id UUID;
  v_transaction_id UUID;
  v_input_first_transaction_id UUID;
  v_input_first_location_id UUID;
  v_waste_transaction_id UUID;
  v_remaining_quantity NUMERIC;
  v_available_quantity NUMERIC;
  v_take_quantity NUMERIC;
  v_next_stock NUMERIC;
  v_total_input_cost NUMERIC := 0;
  v_total_output_quantity NUMERIC := 0;
  v_cost_per_unit NUMERIC := 0;
  v_total_output_cost NUMERIC := 0;
  v_total_waste_cost NUMERIC := 0;
  v_actual_quantity NUMERIC := 0;
  v_input_transaction_ids JSONB := '[]'::JSONB;
  v_output_transaction_ids JSONB := '[]'::JSONB;
  v_waste_transaction_ids JSONB := '[]'::JSONB;
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

  IF v_company_id IS NULL OR v_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.business_units bu
    WHERE bu.id = v_business_unit_id
      AND bu.company_id = v_company_id
      AND bu.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Business unit context is invalid' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.user_has_permission(
    v_user_id,
    'stock_transformations',
    'edit',
    v_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    too.order_code,
    too.source_warehouse_id,
    too.status
  INTO v_order
  FROM public.transformation_orders too
  WHERE too.id = p_order_id
    AND too.company_id = v_company_id
    AND too.business_unit_id = v_business_unit_id
    AND too.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0001';
  END IF;

  IF v_order.status <> 'PREPARING' THEN
    RAISE EXCEPTION 'Order must be preparing' USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(COALESCE(p_inputs, 'null'::JSONB)) <> 'array'
     OR jsonb_typeof(COALESCE(p_outputs, 'null'::JSONB)) <> 'array'
     OR jsonb_array_length(p_inputs) > 100
     OR jsonb_array_length(p_outputs) > 100 THEN
    RAISE EXCEPTION 'Invalid execution lines' USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_array_length(p_inputs) <> (
    SELECT COUNT(*) FROM public.transformation_order_inputs toi WHERE toi.order_id = p_order_id
  ) OR jsonb_array_length(p_outputs) <> (
    SELECT COUNT(*) FROM public.transformation_order_outputs too WHERE too.order_id = p_order_id
  ) THEN
    RAISE EXCEPTION 'All order lines must be supplied' USING ERRCODE = 'P0001';
  END IF;

  IF (
    SELECT COUNT(DISTINCT entry ->> 'inputLineId')
    FROM jsonb_array_elements(p_inputs) entry
  ) <> jsonb_array_length(p_inputs)
  OR (
    SELECT COUNT(DISTINCT entry ->> 'outputLineId')
    FROM jsonb_array_elements(p_outputs) entry
  ) <> jsonb_array_length(p_outputs) THEN
    RAISE EXCEPTION 'Execution lines must be unique' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_inputs) entry
    LEFT JOIN public.transformation_order_inputs toi
      ON toi.id = (entry ->> 'inputLineId')::UUID
     AND toi.order_id = p_order_id
    WHERE toi.id IS NULL
      OR COALESCE((entry ->> 'consumedQuantity')::NUMERIC, 0) <= 0
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_outputs) entry
    LEFT JOIN public.transformation_order_outputs too
      ON too.id = (entry ->> 'outputLineId')::UUID
     AND too.order_id = p_order_id
    WHERE too.id IS NULL
      OR COALESCE((entry ->> 'producedQuantity')::NUMERIC, -1) < 0
      OR COALESCE((entry ->> 'wastedQuantity')::NUMERIC, 0) < 0
      OR COALESCE((entry ->> 'producedQuantity')::NUMERIC, 0)
         + COALESCE((entry ->> 'wastedQuantity')::NUMERIC, 0) <> too.planned_quantity
      OR (
        COALESCE((entry ->> 'wastedQuantity')::NUMERIC, 0) > 0
        AND NULLIF(BTRIM(COALESCE(entry ->> 'wasteReason', '')), '') IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'Invalid execution quantities' USING ERRCODE = 'P0001';
  END IF;

  PERFORM i.id
  FROM public.items i
  WHERE i.id IN (
    SELECT toi.item_id
    FROM public.transformation_order_inputs toi
    WHERE toi.order_id = p_order_id

    UNION

    SELECT too.item_id
    FROM public.transformation_order_outputs too
    WHERE too.order_id = p_order_id
  )
  ORDER BY i.id
  FOR SHARE;

  PERFORM uom.id
  FROM public.units_of_measure uom
  WHERE uom.id IN (
    SELECT toi.uom_id
    FROM public.transformation_order_inputs toi
    WHERE toi.order_id = p_order_id

    UNION

    SELECT too.uom_id
    FROM public.transformation_order_outputs too
    WHERE too.order_id = p_order_id

    UNION

    SELECT i.uom_id
    FROM (
      SELECT toi.item_id
      FROM public.transformation_order_inputs toi
      WHERE toi.order_id = p_order_id

      UNION

      SELECT too.item_id
      FROM public.transformation_order_outputs too
      WHERE too.order_id = p_order_id
    ) referenced
    INNER JOIN public.items i
      ON i.id = referenced.item_id
  )
  ORDER BY uom.id
  FOR SHARE;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT toi.item_id, toi.uom_id
      FROM public.transformation_order_inputs toi
      WHERE toi.order_id = p_order_id

      UNION ALL

      SELECT too.item_id, too.uom_id
      FROM public.transformation_order_outputs too
      WHERE too.order_id = p_order_id
    ) referenced
    LEFT JOIN public.items i
      ON i.id = referenced.item_id
    LEFT JOIN public.units_of_measure line_uom
      ON line_uom.id = referenced.uom_id
    LEFT JOIN public.units_of_measure base_uom
      ON base_uom.id = i.uom_id
    WHERE i.id IS NULL
      OR i.company_id IS DISTINCT FROM v_company_id
      OR i.is_active IS NOT TRUE
      OR i.deleted_at IS NOT NULL
      OR line_uom.id IS NULL
      OR line_uom.company_id IS DISTINCT FROM v_company_id
      OR line_uom.is_active IS NOT TRUE
      OR line_uom.deleted_at IS NOT NULL
      OR base_uom.id IS NULL
      OR base_uom.company_id IS DISTINCT FROM v_company_id
      OR base_uom.is_active IS NOT TRUE
      OR base_uom.deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Transformation order contains an unavailable input or output item'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.warehouse_locations (
    company_id,
    warehouse_id,
    code,
    name,
    location_type,
    is_pickable,
    is_storable,
    is_active,
    created_by,
    updated_by
  )
  VALUES (
    v_company_id,
    v_order.source_warehouse_id,
    'MAIN',
    'Main',
    'bin',
    TRUE,
    TRUE,
    TRUE,
    v_user_id,
    v_user_id
  )
  ON CONFLICT (company_id, warehouse_id, code) DO UPDATE
  SET is_active = TRUE,
      is_pickable = TRUE,
      is_storable = TRUE,
      deleted_at = NULL,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
  RETURNING id INTO v_default_location_id;

  FOR v_input IN
    SELECT
      toi.id,
      toi.item_id,
      i.uom_id,
      COALESCE(i.purchase_price, 0) AS unit_cost,
      (entry.value ->> 'consumedQuantity')::NUMERIC AS consumed_quantity
    FROM jsonb_array_elements(p_inputs) WITH ORDINALITY entry(value, ordinality)
    INNER JOIN public.transformation_order_inputs toi
      ON toi.id = (entry.value ->> 'inputLineId')::UUID
     AND toi.order_id = p_order_id
    INNER JOIN public.items i
      ON i.id = toi.item_id
     AND i.company_id = v_company_id
     AND i.deleted_at IS NULL
    ORDER BY entry.ordinality
  LOOP
    SELECT
      iw.id,
      iw.current_stock,
      iw.available_stock,
      iw.default_location_id
    INTO v_warehouse_stock
    FROM public.item_warehouse iw
    WHERE iw.company_id = v_company_id
      AND iw.item_id = v_input.item_id
      AND iw.warehouse_id = v_order.source_warehouse_id
      AND iw.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND OR COALESCE(v_warehouse_stock.available_stock, 0) < v_input.consumed_quantity THEN
      RAISE EXCEPTION 'Insufficient input stock' USING ERRCODE = 'P0001';
    END IF;

    v_remaining_quantity := v_input.consumed_quantity;
    v_next_stock := COALESCE(v_warehouse_stock.current_stock, 0);
    v_input_first_transaction_id := NULL;
    v_input_first_location_id := NULL;

    FOR v_batch_location IN
      SELECT
        ibl.id,
        ibl.item_batch_id,
        ibl.location_id,
        ibl.qty_on_hand,
        ibl.qty_reserved,
        ib.batch_code
      FROM public.item_batch_locations ibl
      INNER JOIN public.item_batches ib
        ON ib.id = ibl.item_batch_id
       AND ib.company_id = v_company_id
       AND ib.deleted_at IS NULL
      WHERE ibl.company_id = v_company_id
        AND ibl.item_id = v_input.item_id
        AND ibl.warehouse_id = v_order.source_warehouse_id
        AND ibl.deleted_at IS NULL
      ORDER BY ib.received_at ASC, ibl.created_at ASC, ibl.id ASC
      FOR UPDATE OF ibl, ib
    LOOP
      EXIT WHEN v_remaining_quantity <= 0;

      v_available_quantity := GREATEST(
        0,
        COALESCE(v_batch_location.qty_on_hand, 0)
          - COALESCE(v_batch_location.qty_reserved, 0)
      );

      IF v_available_quantity <= 0 THEN
        CONTINUE;
      END IF;

      v_take_quantity := LEAST(v_available_quantity, v_remaining_quantity);

      UPDATE public.item_batch_locations
      SET qty_on_hand = qty_on_hand - v_take_quantity,
          updated_by = v_user_id,
          updated_at = NOW()
      WHERE id = v_batch_location.id;

      UPDATE public.item_batches
      SET qty_on_hand = qty_on_hand - v_take_quantity,
          updated_by = v_user_id,
          updated_at = NOW()
      WHERE id = v_batch_location.item_batch_id;

      INSERT INTO public.stock_transactions (
        company_id,
        business_unit_id,
        transaction_type,
        transaction_date,
        warehouse_id,
        from_location_id,
        reference_type,
        reference_id,
        reference_code,
        notes,
        status,
        created_by,
        updated_by
      )
      VALUES (
        v_company_id,
        v_business_unit_id,
        'out',
        COALESCE(p_execution_date, CURRENT_DATE),
        v_order.source_warehouse_id,
        v_batch_location.location_id,
        'transformation_order',
        p_order_id,
        v_order.order_code,
        'Transformation input consumption - batch '
          || v_batch_location.batch_code
          || ' - '
          || v_order.order_code,
        'posted',
        v_user_id,
        v_user_id
      )
      RETURNING id INTO v_transaction_id;

      INSERT INTO public.stock_transaction_items (
        company_id,
        transaction_id,
        item_id,
        quantity,
        uom_id,
        unit_cost,
        total_cost,
        batch_no,
        qty_before,
        qty_after,
        valuation_rate,
        stock_value_before,
        stock_value_after,
        posting_date,
        posting_time,
        created_by,
        updated_by
      )
      VALUES (
        v_company_id,
        v_transaction_id,
        v_input.item_id,
        v_take_quantity,
        v_input.uom_id,
        v_input.unit_cost,
        v_input.unit_cost * v_take_quantity,
        v_batch_location.batch_code,
        v_next_stock,
        v_next_stock - v_take_quantity,
        v_input.unit_cost,
        v_next_stock * v_input.unit_cost,
        (v_next_stock - v_take_quantity) * v_input.unit_cost,
        COALESCE(p_execution_date, CURRENT_DATE),
        CURRENT_TIME,
        v_user_id,
        v_user_id
      );

      v_input_first_transaction_id := COALESCE(
        v_input_first_transaction_id,
        v_transaction_id
      );
      v_input_first_location_id := COALESCE(
        v_input_first_location_id,
        v_batch_location.location_id
      );
      v_input_transaction_ids := v_input_transaction_ids
        || jsonb_build_array(v_transaction_id);
      v_next_stock := v_next_stock - v_take_quantity;
      v_remaining_quantity := v_remaining_quantity - v_take_quantity;
    END LOOP;

    IF v_remaining_quantity > 0 THEN
      RAISE EXCEPTION 'Insufficient input batch stock' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.item_warehouse
    SET current_stock = v_next_stock,
        default_location_id = COALESCE(
          default_location_id,
          v_input_first_location_id,
          v_default_location_id
        ),
        updated_by = v_user_id,
        updated_at = NOW()
    WHERE id = v_warehouse_stock.id;

    UPDATE public.transformation_order_inputs
    SET consumed_quantity = v_input.consumed_quantity,
        unit_cost = v_input.unit_cost,
        total_cost = v_input.unit_cost * v_input.consumed_quantity,
        stock_transaction_id = v_input_first_transaction_id,
        updated_by = v_user_id,
        updated_at = NOW()
    WHERE id = v_input.id;

    v_total_input_cost := v_total_input_cost
      + (v_input.unit_cost * v_input.consumed_quantity);
  END LOOP;

  SELECT COALESCE(
    SUM(
      CASE
        WHEN too.is_scrap THEN 0
        ELSE COALESCE((entry ->> 'producedQuantity')::NUMERIC, 0)
          + COALESCE((entry ->> 'wastedQuantity')::NUMERIC, 0)
      END
    ),
    0
  )
  INTO v_total_output_quantity
  FROM jsonb_array_elements(p_outputs) entry
  INNER JOIN public.transformation_order_outputs too
    ON too.id = (entry ->> 'outputLineId')::UUID
   AND too.order_id = p_order_id;

  v_cost_per_unit := CASE
    WHEN v_total_output_quantity > 0
      THEN v_total_input_cost / v_total_output_quantity
    ELSE 0
  END;

  FOR v_output IN
    SELECT
      too.id,
      too.item_id,
      too.is_scrap,
      i.uom_id,
      COALESCE((entry.value ->> 'producedQuantity')::NUMERIC, 0) AS produced_quantity,
      COALESCE((entry.value ->> 'wastedQuantity')::NUMERIC, 0) AS wasted_quantity,
      NULLIF(BTRIM(COALESCE(entry.value ->> 'wasteReason', '')), '') AS waste_reason
    FROM jsonb_array_elements(p_outputs) WITH ORDINALITY entry(value, ordinality)
    INNER JOIN public.transformation_order_outputs too
      ON too.id = (entry.value ->> 'outputLineId')::UUID
     AND too.order_id = p_order_id
    INNER JOIN public.items i
      ON i.id = too.item_id
     AND i.company_id = v_company_id
     AND i.deleted_at IS NULL
    ORDER BY entry.ordinality
  LOOP
    IF v_output.produced_quantity > 0 THEN
      v_transaction_id := public.create_transformation_output_putaway(
        v_company_id,
        v_business_unit_id,
        p_order_id,
        v_output.id,
        v_output.item_id,
        v_order.source_warehouse_id,
        v_output.uom_id,
        v_order.order_code,
        COALESCE(p_execution_date, CURRENT_DATE),
        v_output.produced_quantity,
        v_output.wasted_quantity,
        v_output.waste_reason,
        CASE WHEN v_output.is_scrap THEN 0 ELSE v_cost_per_unit END,
        CASE
          WHEN v_output.is_scrap THEN 0
          ELSE v_cost_per_unit * v_output.produced_quantity
        END,
        v_user_id
      );

      v_output_transaction_ids := v_output_transaction_ids || jsonb_build_array(v_transaction_id);
    ELSE
      UPDATE public.transformation_order_outputs
      SET produced_quantity = 0,
          wasted_quantity = v_output.wasted_quantity,
          waste_reason = v_output.waste_reason,
          allocated_cost_per_unit = CASE WHEN v_output.is_scrap THEN 0 ELSE v_cost_per_unit END,
          total_allocated_cost = 0,
          stock_transaction_id = NULL,
          updated_by = v_user_id,
          updated_at = NOW()
      WHERE id = v_output.id;
    END IF;

    IF v_output.wasted_quantity > 0 THEN
      INSERT INTO public.stock_transactions (
        company_id,
        business_unit_id,
        transaction_type,
        transaction_date,
        warehouse_id,
        from_location_id,
        reference_type,
        reference_id,
        reference_code,
        notes,
        status,
        created_by,
        updated_by
      )
      VALUES (
        v_company_id,
        v_business_unit_id,
        'out',
        COALESCE(p_execution_date, CURRENT_DATE),
        v_order.source_warehouse_id,
        v_default_location_id,
        'transformation_order',
        p_order_id,
        v_order.order_code,
        'Transformation waste - ' || v_output.waste_reason || ' - ' || v_order.order_code,
        'posted',
        v_user_id,
        v_user_id
      )
      RETURNING id INTO v_waste_transaction_id;

      INSERT INTO public.stock_transaction_items (
        company_id,
        transaction_id,
        item_id,
        quantity,
        uom_id,
        unit_cost,
        total_cost,
        qty_before,
        qty_after,
        valuation_rate,
        stock_value_before,
        stock_value_after,
        posting_date,
        posting_time,
        created_by,
        updated_by
      )
      VALUES (
        v_company_id,
        v_waste_transaction_id,
        v_output.item_id,
        v_output.wasted_quantity,
        v_output.uom_id,
        CASE WHEN v_output.is_scrap THEN 0 ELSE v_cost_per_unit END,
        CASE
          WHEN v_output.is_scrap THEN 0
          ELSE v_cost_per_unit * v_output.wasted_quantity
        END,
        0,
        0,
        CASE WHEN v_output.is_scrap THEN 0 ELSE v_cost_per_unit END,
        0,
        0,
        COALESCE(p_execution_date, CURRENT_DATE),
        CURRENT_TIME,
        v_user_id,
        v_user_id
      );

      UPDATE public.transformation_order_outputs
      SET stock_transaction_waste_id = v_waste_transaction_id,
          updated_by = v_user_id,
          updated_at = NOW()
      WHERE id = v_output.id;

      v_waste_transaction_ids := v_waste_transaction_ids
        || jsonb_build_array(v_waste_transaction_id);
    END IF;

    IF v_output.produced_quantity > 0 THEN
      INSERT INTO public.transformation_lineage (
        order_id,
        input_line_id,
        output_line_id,
        input_quantity_used,
        output_quantity_from,
        cost_attributed
      )
      SELECT
        p_order_id,
        toi.id,
        v_output.id,
        toi.consumed_quantity,
        v_output.produced_quantity,
        CASE
          WHEN v_output.is_scrap OR v_total_input_cost <= 0 THEN 0
          ELSE (
            v_cost_per_unit
              * v_output.produced_quantity
              * (toi.total_cost / v_total_input_cost)
          )
        END
      FROM public.transformation_order_inputs toi
      WHERE toi.order_id = p_order_id;
    END IF;

    IF v_output.is_scrap IS FALSE THEN
      v_total_output_cost := v_total_output_cost
        + (v_cost_per_unit * v_output.produced_quantity);
      v_total_waste_cost := v_total_waste_cost
        + (v_cost_per_unit * v_output.wasted_quantity);
    END IF;

    v_actual_quantity := v_actual_quantity + v_output.produced_quantity;
  END LOOP;

  UPDATE public.transformation_orders
  SET status = 'COMPLETED',
      execution_date = COALESCE(p_execution_date, CURRENT_DATE),
      completion_date = CURRENT_DATE,
      actual_quantity = v_actual_quantity,
      total_input_cost = v_total_input_cost,
      total_output_cost = v_total_output_cost,
      cost_variance = v_total_waste_cost,
      notes = COALESCE(NULLIF(BTRIM(COALESCE(p_notes, '')), ''), notes),
      updated_by = v_user_id,
      updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'inputs', v_input_transaction_ids,
    'outputs', v_output_transaction_ids,
    'waste', v_waste_transaction_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_transformation_additional_output_items(
  TEXT, INTEGER, INTEGER, UUID[]
)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_transformation_template_copy_source_with_additional_outputs(UUID)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_transformation_template_with_additional_outputs(
  TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, JSONB, JSONB, UUID, JSONB
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_transformation_order_transaction(
  UUID, UUID, NUMERIC, DATE, DATE, TEXT, TEXT, UUID
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_transformation_order_transaction(
  UUID, JSONB, JSONB, DATE, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_transformation_additional_output_items(
  TEXT, INTEGER, INTEGER, UUID[]
)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_transformation_template_copy_source_with_additional_outputs(UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_transformation_template_with_additional_outputs(
  TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, JSONB, JSONB, UUID, JSONB
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_transformation_order_transaction(
  UUID, UUID, NUMERIC, DATE, DATE, TEXT, TEXT, UUID
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_transformation_order_transaction(
  UUID, JSONB, JSONB, DATE, TEXT
) TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.transformation_template_additional_outputs
TO authenticated, service_role;

COMMENT ON FUNCTION public.list_transformation_additional_output_items(
  TEXT, INTEGER, INTEGER, UUID[]
) IS
  'Returns a bounded, searchable list of active stock items and their immutable base UOM for additional template outputs.';
COMMENT ON FUNCTION public.get_transformation_template_copy_source_with_additional_outputs(UUID) IS
  'Returns an authorized template copy source including its independent additional output definitions.';
COMMENT ON FUNCTION public.create_transformation_template_with_additional_outputs(
  TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, JSONB, JSONB, JSONB, UUID, JSONB
) IS
  'Creates a template, its primary lines, and its base-UOM additional outputs atomically.';
COMMENT ON FUNCTION public.create_transformation_order_transaction(
  UUID, UUID, NUMERIC, DATE, DATE, TEXT, TEXT, UUID
) IS
  'Creates a draft transformation order and inherits all primary and additional template outputs atomically.';
COMMENT ON FUNCTION public.complete_transformation_order_transaction(
  UUID, JSONB, JSONB, DATE, TEXT
) IS
  'Completes a transformation atomically, consuming FIFO input stock with one ledger transaction per batch-location slice and posting all primary and planned additional outputs, waste, putaway, lineage, costs, and final status.';
