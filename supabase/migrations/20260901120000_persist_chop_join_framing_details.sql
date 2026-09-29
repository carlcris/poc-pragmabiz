-- ============================================================================
-- Migration: Persist chop & join / framing line details
-- Description:
--   Extends save_sales_quotation_item_frame_details so a configured line also
--   stores all sizes, geometry, mat layers, fittings, attachments, discounts,
--   and rates. This is the sole unfinalized definition of the save function.
--
--   Mat layers are soft-deleted alongside the configuration they hang off, so
--   the existing update path (soft-delete then re-save) keeps working without
--   leaving orphaned layers behind.
-- Date: 2026-09-01
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.save_sales_quotation_item_frame_details(p_company_id uuid, p_quotation_item_id uuid, p_item jsonb, p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  -- A line may carry several sizes, each its own configuration with its own mat
  -- layers and components. `frameSizes` is the list form; `frameConfiguration`
  -- is the single-size form every existing caller still sends, normalised here
  -- into a one-element list so there is only one code path below.
  v_sizes JSONB := CASE
    WHEN jsonb_typeof(p_item -> 'frameSizes') = 'array'
      THEN p_item -> 'frameSizes'
    WHEN p_item -> 'frameConfiguration' IS NOT NULL
     AND p_item -> 'frameConfiguration' <> 'null'::JSONB
      THEN jsonb_build_array(
        jsonb_build_object(
          'frameConfiguration', p_item -> 'frameConfiguration',
          'matLayers', COALESCE(p_item -> 'matLayers', '[]'::JSONB),
          'frameComponents', COALESCE(p_item -> 'frameComponents', '[]'::JSONB)
        )
      )
    ELSE NULL
  END;
  v_size JSONB;
  v_size_index INTEGER := 0;
  v_config JSONB;
  v_component JSONB;
  v_layer JSONB;
  v_attachment JSONB;
  v_config_id UUID;
  v_component_type TEXT;
  v_billing_mode TEXT;
  v_invoice_display_mode TEXT;
BEGIN
  IF v_sizes IS NULL OR jsonb_array_length(v_sizes) = 0 THEN
    RETURN;
  END IF;

  FOR v_size IN SELECT value FROM jsonb_array_elements(v_sizes)
  LOOP
    v_config := v_size -> 'frameConfiguration';
    IF v_config IS NULL OR v_config = 'null'::JSONB THEN
      CONTINUE;
    END IF;

  v_billing_mode := COALESCE(NULLIF(v_config ->> 'billingMode', ''), 'framing');
  IF v_billing_mode NOT IN ('framing', 'chop_join') THEN
    RAISE EXCEPTION 'FRAME_CONFIG_INVALID_BILLING_MODE';
  END IF;

  -- Chop & join bills each part as its own invoice line; framing rolls the
  -- parts up into one. An explicit invoiceDisplayMode still wins so the two
  -- remain independently settable.
  v_invoice_display_mode := COALESCE(
    NULLIF(v_config ->> 'invoiceDisplayMode', ''),
    CASE WHEN v_billing_mode = 'chop_join' THEN 'components' ELSE 'summary' END
  );

  INSERT INTO public.sales_quotation_item_configurations (
    company_id,
    quotation_item_id,
    width,
    height,
    fixed_allowance,
    molding_item_id,
    molding_stick_length,
    molding_sticks_required,
    service_fee_mode,
    service_type,
    service_fee_amount,
    total_service_fee,
    invoice_display_mode,
    billing_mode,
    size_index,
    frame_quantity,
    artwork_length_in,
    artwork_width_in,
    frame_width_in,
    size_mode,
    overlap_in,
    mat_source,
    glazing_cut_to_mat_outer,
    mat_included,
    glazing_included,
    glazing_type,
    glazing_unit_rate,
    glazing_sheets,
    glazing_remarks,
    backing_type,
    moulding_material,
    backing_unit_rate,
    framing_instructions,
    backing_thickness_in,
    component_discounts,
    frame_rate,
    mat_unit_rate,
    mat_border_l_in,
    mat_border_w_in,
    flexipoints_numerator,
    flexipoints_denominator,
    multipoints_numerator,
    multipoints_denominator,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    p_quotation_item_id,
    COALESCE(NULLIF(v_config ->> 'width', '')::NUMERIC, 0),
    COALESCE(NULLIF(v_config ->> 'height', '')::NUMERIC, 0),
    COALESCE(NULLIF(v_config ->> 'fixedAllowance', '')::NUMERIC, 0),
    NULLIF(v_config ->> 'moldingItemId', '')::UUID,
    NULLIF(v_config ->> 'moldingStickLength', '')::NUMERIC,
    NULLIF(v_config ->> 'moldingSticksRequired', '')::NUMERIC,
    COALESCE(NULLIF(v_config ->> 'serviceFeeMode', ''), 'per_frame'),
    NULLIF(v_config ->> 'serviceType', ''),
    COALESCE(NULLIF(v_config ->> 'serviceFeeAmount', '')::NUMERIC, 0),
    COALESCE(NULLIF(v_config ->> 'totalServiceFee', '')::NUMERIC, 0),
    v_invoice_display_mode,
    v_billing_mode,
    v_size_index,
    COALESCE(NULLIF(v_config ->> 'frameQuantity', '')::NUMERIC, 1),
    NULLIF(v_config ->> 'artworkLengthIn', '')::NUMERIC,
    NULLIF(v_config ->> 'artworkWidthIn', '')::NUMERIC,
    NULLIF(v_config ->> 'frameWidthIn', '')::NUMERIC,
    COALESCE(NULLIF(v_config ->> 'sizeMode', ''), 'artwork'),
    COALESCE(NULLIF(v_config ->> 'overlapIn', '')::NUMERIC, 0),
    COALESCE(NULLIF(v_config ->> 'matSource', ''), 'store'),
    COALESCE(NULLIF(v_config ->> 'glazingCutToMatOuter', '')::BOOLEAN, TRUE),
    COALESCE(NULLIF(v_config ->> 'matIncluded', '')::BOOLEAN, FALSE),
    COALESCE(NULLIF(v_config ->> 'glazingIncluded', '')::BOOLEAN, FALSE),
    NULLIF(v_config ->> 'glazingType', ''),
    NULLIF(v_config ->> 'glazingUnitRate', '')::NUMERIC,
    COALESCE(NULLIF(v_config ->> 'glazingSheets', '')::INTEGER, 1),
    NULLIF(v_config ->> 'glazingRemarks', ''),
    NULLIF(v_config ->> 'backingType', ''),
    NULLIF(v_config ->> 'mouldingMaterial', ''),
    NULLIF(v_config ->> 'backingUnitRate', '')::NUMERIC,
    -- Blank and absent are the same thing for a note; store NULL for both.
    NULLIF(btrim(COALESCE(v_config ->> 'framingInstructions', '')), ''),
    NULLIF(v_config ->> 'backingThicknessIn', '')::NUMERIC,
    CASE WHEN jsonb_typeof(v_config -> 'componentDiscounts') = 'object'
         THEN v_config -> 'componentDiscounts' END,
    NULLIF(v_config ->> 'frameRate', '')::NUMERIC,
    NULLIF(v_config ->> 'matUnitRate', '')::NUMERIC,
    NULLIF(v_config ->> 'matBorderLIn', '')::NUMERIC,
    NULLIF(v_config ->> 'matBorderWIn', '')::NUMERIC,
    NULLIF(v_config ->> 'flexipointsNumerator', '')::INTEGER,
    NULLIF(v_config ->> 'flexipointsDenominator', '')::INTEGER,
    NULLIF(v_config ->> 'multipointsNumerator', '')::INTEGER,
    NULLIF(v_config ->> 'multipointsDenominator', '')::INTEGER,
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_config_id;

  -- Mat layers. layer_index 0 is the top mat; the unique constraint on
  -- (configuration_id, layer_index) rejects a duplicated position.
  IF jsonb_typeof(v_size -> 'matLayers') = 'array' THEN
    FOR v_layer IN SELECT value FROM jsonb_array_elements(v_size -> 'matLayers')
    LOOP
      INSERT INTO public.sales_quotation_item_mat_layers (
        company_id,
        configuration_id,
        layer_index,
        mat_board_item_id,
        unit_rate,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_config_id,
        COALESCE(NULLIF(v_layer ->> 'layerIndex', '')::INTEGER, 0),
        NULLIF(v_layer ->> 'matBoardItemId', '')::UUID,
        COALESCE(NULLIF(v_layer ->> 'unitRate', '')::NUMERIC, 0),
        p_user_id,
        p_user_id
      );
    END LOOP;
  END IF;

  -- Reference files for this size. Unpriced and never billed, so they are kept
  -- well away from the component rows that feed the line total.
  IF jsonb_typeof(v_config -> 'attachments') = 'array' THEN
    FOR v_attachment IN SELECT value FROM jsonb_array_elements(v_config -> 'attachments')
    LOOP
      CONTINUE WHEN COALESCE(NULLIF(v_attachment ->> 'storagePath', ''), '') = '';

      INSERT INTO public.sales_quotation_item_attachments (
        company_id,
        configuration_id,
        storage_path,
        file_name,
        mime_type,
        file_size_bytes,
        sort_order,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_config_id,
        v_attachment ->> 'storagePath',
        COALESCE(NULLIF(v_attachment ->> 'fileName', ''), 'attachment'),
        COALESCE(NULLIF(v_attachment ->> 'mimeType', ''), 'application/octet-stream'),
        GREATEST(COALESCE(NULLIF(v_attachment ->> 'fileSizeBytes', '')::BIGINT, 1), 1),
        COALESCE(NULLIF(v_attachment ->> 'sortOrder', '')::INTEGER, 0),
        p_user_id,
        p_user_id
      );
    END LOOP;
  END IF;

  IF jsonb_typeof(v_size -> 'frameComponents') <> 'array' THEN
    v_size_index := v_size_index + 1;
    CONTINUE;
  END IF;

  FOR v_component IN SELECT value FROM jsonb_array_elements(v_size -> 'frameComponents')
  LOOP
    v_component_type := COALESCE(NULLIF(v_component ->> 'componentType', ''), 'material');

    INSERT INTO public.sales_quotation_item_components (
      company_id,
      quotation_item_id,
      configuration_id,
      component_type,
      source,
      item_id,
      description,
      qty_per_frame,
      total_quantity,
      uom_id,
      unit_rate,
      discount_percent,
      discount_amount,
      total_amount,
      rounding_mode,
      sort_order,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      p_quotation_item_id,
      v_config_id,
      v_component_type,
      COALESCE(NULLIF(v_component ->> 'source', ''), 'manual'),
      NULLIF(v_component ->> 'itemId', '')::UUID,
      NULLIF(v_component ->> 'description', ''),
      COALESCE(NULLIF(v_component ->> 'qtyPerFrame', '')::NUMERIC, 0),
      COALESCE(NULLIF(v_component ->> 'totalQuantity', '')::NUMERIC, 0),
      NULLIF(v_component ->> 'uomId', '')::UUID,
      COALESCE(NULLIF(v_component ->> 'unitRate', '')::NUMERIC, 0),
      COALESCE(NULLIF(v_component ->> 'discountPercent', '')::NUMERIC, 0),
      COALESCE(NULLIF(v_component ->> 'discountAmount', '')::NUMERIC, 0),
      -- Already net of the discount; the line total is the sum of these.
      COALESCE(NULLIF(v_component ->> 'totalAmount', '')::NUMERIC, 0),
      COALESCE(NULLIF(v_component ->> 'roundingMode', ''), 'none'),
      COALESCE(NULLIF(v_component ->> 'sortOrder', '')::INTEGER, 0),
      p_user_id,
      p_user_id
    );
  END LOOP;
    v_size_index := v_size_index + 1;
  END LOOP;
END;
$function$;

-- ============================================================================
-- Soft-delete mat layers with their configuration.
-- The quotation update path soft-deletes configurations and re-saves; without
-- this the old layers would survive and collide with the re-inserted ones.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.soft_delete_quotation_mat_layers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.sales_quotation_item_mat_layers
    SET deleted_at = NEW.deleted_at,
        updated_by = NEW.updated_by,
        updated_at = NOW()
    WHERE configuration_id = NEW.id
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_quotation_mat_layers()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_soft_delete_quotation_mat_layers
  ON public.sales_quotation_item_configurations;
CREATE TRIGGER trg_soft_delete_quotation_mat_layers
  AFTER UPDATE OF deleted_at ON public.sales_quotation_item_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.soft_delete_quotation_mat_layers();

COMMIT;
