-- Add optional image URL for transformation templates

ALTER TABLE public.transformation_templates
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.transformation_templates.image_url
IS 'Optional image/thumbnail URL for the transformation template';


-- Transactional RPC for updating transformation template header and replacing input/output rows.
-- Keeps delete+insert strategy for lines, but executes atomically in the database.

DROP FUNCTION IF EXISTS public.update_transformation_template(
  UUID,
  UUID,
  UUID,
  BOOLEAN,
  TEXT,
  BOOLEAN,
  TEXT,
  BOOLEAN,
  TEXT,
  BOOLEAN,
  BOOLEAN,
  JSONB,
  JSONB
);

CREATE OR REPLACE FUNCTION public.update_transformation_template(
  p_template_id UUID,
  p_company_id UUID,
  p_user_id UUID,
  p_template_name_provided BOOLEAN DEFAULT FALSE,
  p_template_name TEXT DEFAULT NULL,
  p_description_provided BOOLEAN DEFAULT FALSE,
  p_description TEXT DEFAULT NULL,
  p_image_url_provided BOOLEAN DEFAULT FALSE,
  p_image_url TEXT DEFAULT NULL,
  p_is_active_provided BOOLEAN DEFAULT FALSE,
  p_is_active BOOLEAN DEFAULT NULL,
  p_inputs JSONB DEFAULT NULL,
  p_outputs JSONB DEFAULT NULL
)
RETURNS public.transformation_templates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template public.transformation_templates%ROWTYPE;
  v_has_structural_changes BOOLEAN := (p_inputs IS NOT NULL OR p_outputs IS NOT NULL);
BEGIN
  SELECT *
  INTO v_template
  FROM public.transformation_templates
  WHERE id = p_template_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_template.usage_count > 0 AND (
    v_has_structural_changes
    OR p_template_name_provided
    OR p_description_provided
    OR p_image_url_provided
  ) THEN
    RAISE EXCEPTION 'Template is locked because it is used by % order(s). Only status changes are allowed.',
      v_template.usage_count
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.transformation_templates
  SET
    template_name = CASE WHEN p_template_name_provided THEN p_template_name ELSE template_name END,
    description = CASE WHEN p_description_provided THEN p_description ELSE description END,
    image_url = CASE WHEN p_image_url_provided THEN p_image_url ELSE image_url END,
    is_active = CASE WHEN p_is_active_provided THEN COALESCE(p_is_active, is_active) ELSE is_active END,
    updated_by = p_user_id,
    updated_at = CURRENT_TIMESTAMP
  WHERE id = p_template_id;

  IF v_template.usage_count = 0 THEN
    IF p_inputs IS NOT NULL THEN
      DELETE FROM public.transformation_template_inputs
      WHERE template_id = p_template_id;

      IF jsonb_typeof(p_inputs) = 'array' AND jsonb_array_length(p_inputs) > 0 THEN
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
          p_template_id,
          (i->>'itemId')::UUID,
          (i->>'quantity')::NUMERIC,
          (i->>'uomId')::UUID,
          COALESCE((i->>'sequence')::INTEGER, ordinality::INTEGER),
          NULLIF(i->>'notes', ''),
          p_user_id,
          p_user_id
        FROM jsonb_array_elements(p_inputs) WITH ORDINALITY AS t(i, ordinality);
      END IF;
    END IF;

    IF p_outputs IS NOT NULL THEN
      DELETE FROM public.transformation_template_outputs
      WHERE template_id = p_template_id;

      IF jsonb_typeof(p_outputs) = 'array' AND jsonb_array_length(p_outputs) > 0 THEN
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
          p_template_id,
          (o->>'itemId')::UUID,
          (o->>'quantity')::NUMERIC,
          (o->>'uomId')::UUID,
          COALESCE((o->>'sequence')::INTEGER, ordinality::INTEGER),
          COALESCE((o->>'isScrap')::BOOLEAN, FALSE),
          NULLIF(o->>'notes', ''),
          p_user_id,
          p_user_id
        FROM jsonb_array_elements(p_outputs) WITH ORDINALITY AS t(o, ordinality);
      END IF;
    END IF;
  END IF;

  SELECT *
  INTO v_template
  FROM public.transformation_templates
  WHERE id = p_template_id;

  RETURN v_template;
END;
$$;

REVOKE ALL ON FUNCTION public.update_transformation_template(
  UUID,
  UUID,
  UUID,
  BOOLEAN,
  TEXT,
  BOOLEAN,
  TEXT,
  BOOLEAN,
  TEXT,
  BOOLEAN,
  BOOLEAN,
  JSONB,
  JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_transformation_template(
  UUID,
  UUID,
  UUID,
  BOOLEAN,
  TEXT,
  BOOLEAN,
  TEXT,
  BOOLEAN,
  TEXT,
  BOOLEAN,
  BOOLEAN,
  JSONB,
  JSONB
) TO authenticated;

-- Fix DELETE behavior for template detail lock trigger.
-- In a BEFORE DELETE trigger, returning NEW (NULL) cancels the delete silently.
-- This caused delete-then-insert updates to leave old rows in place and then hit
-- uq_template_input_item / uq_template_output_item on re-insert.

CREATE OR REPLACE FUNCTION public.prevent_template_detail_modification()
RETURNS TRIGGER AS $$
DECLARE
    v_usage_count INTEGER;
BEGIN
    -- Get the template's usage count from the affected row's template_id
    SELECT usage_count INTO v_usage_count
    FROM public.transformation_templates
    WHERE id = OLD.template_id;

    IF v_usage_count > 0 THEN
        RAISE EXCEPTION 'Cannot modify template inputs/outputs because template is used by % order(s). Template is locked.',
            v_usage_count
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;

    -- BEFORE DELETE must return OLD to allow the delete to proceed.
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

