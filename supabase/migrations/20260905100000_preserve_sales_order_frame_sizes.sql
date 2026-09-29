-- Preserve every selected quotation frame size when a quotation line is added
-- to a sales order. The client submits only source configuration ids and partial
-- quantities; geometry, components, mat layers, and commercial terms are copied
-- from the accepted quotation inside the transaction.

BEGIN;

CREATE OR REPLACE FUNCTION public.save_sales_order_item_frame_sizes(
  p_company_id UUID,
  p_order_item_id UUID,
  p_quotation_item_id UUID,
  p_item JSONB,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_selections JSONB := p_item -> 'frameSizeSelections';
  v_selection JSONB;
  v_config_id UUID;
  v_quotation_config_id UUID;
  v_source_config RECORD;
  v_frame_quantity NUMERIC;
  v_frame_quantity_total NUMERIC := 0;
  v_line_quantity NUMERIC := COALESCE(NULLIF(p_item ->> 'quantity', '')::NUMERIC, 0);
  v_quotation_size_count INTEGER;
  v_allocated_quantity NUMERIC;
BEGIN
  SELECT COUNT(*)
  INTO v_quotation_size_count
  FROM public.sales_quotation_item_configurations quotation_configuration
  WHERE quotation_configuration.quotation_item_id = p_quotation_item_id
    AND quotation_configuration.deleted_at IS NULL;

  IF v_quotation_size_count = 0 THEN
    IF v_selections IS NOT NULL THEN
      RAISE EXCEPTION 'SALES_ORDER_FRAME_SOURCE_REQUIRED';
    END IF;
    RETURN;
  END IF;

  IF p_quotation_item_id IS NULL
    OR v_selections IS NULL
    OR jsonb_typeof(v_selections) <> 'array'
    OR jsonb_array_length(v_selections) = 0
    OR jsonb_array_length(v_selections) > 50 THEN
    RAISE EXCEPTION 'SALES_ORDER_FRAME_SIZE_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_selections) selection
    GROUP BY selection ->> 'quotationConfigurationId'
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'SALES_ORDER_QUOTATION_FRAME_INVALID';
  END IF;

  FOR v_selection IN
    SELECT value FROM jsonb_array_elements(v_selections)
  LOOP
    v_quotation_config_id := NULLIF(v_selection ->> 'quotationConfigurationId', '')::UUID;
    v_frame_quantity := COALESCE(NULLIF(v_selection ->> 'quantity', '')::NUMERIC, 0);
    IF v_quotation_config_id IS NULL
      OR v_frame_quantity <= 0
      OR TRUNC(v_frame_quantity) <> v_frame_quantity THEN
      RAISE EXCEPTION 'SALES_ORDER_FRAME_SIZE_INVALID';
    END IF;

    SELECT
      quotation_configuration.id,
      quotation_configuration.size_index,
      quotation_configuration.frame_quantity,
      quotation_configuration.width,
      quotation_configuration.height,
      quotation_configuration.fixed_allowance,
      quotation_configuration.molding_item_id,
      quotation_configuration.molding_stick_length,
      quotation_configuration.molding_sticks_required,
      quotation_configuration.service_fee_mode,
      quotation_configuration.service_type,
      quotation_configuration.service_fee_amount,
      quotation_configuration.total_service_fee,
      quotation_configuration.invoice_display_mode,
      quotation_configuration.billing_mode,
      quotation_configuration.artwork_length_in,
      quotation_configuration.artwork_width_in,
      quotation_configuration.frame_width_in,
      quotation_configuration.size_mode,
      quotation_configuration.overlap_in,
      quotation_configuration.mat_source,
      quotation_configuration.glazing_cut_to_mat_outer,
      quotation_configuration.mat_included,
      quotation_configuration.glazing_included,
      quotation_configuration.glazing_type,
      quotation_configuration.glazing_unit_rate,
      quotation_configuration.glazing_sheets,
      quotation_configuration.glazing_remarks,
      quotation_configuration.backing_type,
      quotation_configuration.moulding_material,
      quotation_configuration.backing_unit_rate,
      quotation_configuration.frame_rate,
      quotation_configuration.mat_unit_rate,
      quotation_configuration.mat_border_l_in,
      quotation_configuration.mat_border_w_in,
      quotation_configuration.flexipoints_numerator,
      quotation_configuration.flexipoints_denominator,
      quotation_configuration.multipoints_numerator,
      quotation_configuration.multipoints_denominator
    INTO v_source_config
    FROM public.sales_quotation_item_configurations quotation_configuration
    WHERE quotation_configuration.id = v_quotation_config_id
      AND quotation_configuration.quotation_item_id = p_quotation_item_id
      AND quotation_configuration.company_id = p_company_id
      AND quotation_configuration.deleted_at IS NULL
    FOR UPDATE;

    IF v_source_config.id IS NULL THEN
      RAISE EXCEPTION 'SALES_ORDER_QUOTATION_FRAME_INVALID';
    END IF;

    SELECT COALESCE(SUM(order_configuration.frame_quantity), 0)
    INTO v_allocated_quantity
    FROM public.sales_order_item_configurations order_configuration
    JOIN public.sales_order_items order_item
      ON order_item.id = order_configuration.order_item_id
    JOIN public.sales_orders sales_order
      ON sales_order.id = order_item.order_id
    WHERE order_configuration.quotation_configuration_id = v_quotation_config_id
      AND order_configuration.deleted_at IS NULL
      AND order_item.deleted_at IS NULL
      AND sales_order.deleted_at IS NULL
      AND sales_order.status <> 'cancelled';

    IF v_frame_quantity > GREATEST(v_source_config.frame_quantity - v_allocated_quantity, 0) THEN
      RAISE EXCEPTION 'SALES_ORDER_FRAME_QUANTITY_EXCEEDS_REMAINING';
    END IF;
    v_frame_quantity_total := v_frame_quantity_total + v_frame_quantity;

    INSERT INTO public.sales_order_item_configurations (
      company_id,
      order_item_id,
      quotation_configuration_id,
      size_index,
      frame_quantity,
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
      p_order_item_id,
      CASE WHEN p_quotation_item_id IS NOT NULL THEN v_quotation_config_id ELSE NULL END,
      v_source_config.size_index,
      v_frame_quantity,
      v_source_config.width, v_source_config.height, v_source_config.fixed_allowance,
      v_source_config.molding_item_id, v_source_config.molding_stick_length,
      v_source_config.molding_sticks_required, v_source_config.service_fee_mode,
      v_source_config.service_type, v_source_config.service_fee_amount,
      CASE WHEN v_frame_quantity = v_source_config.frame_quantity
        THEN v_source_config.total_service_fee
        ELSE ROUND(v_source_config.total_service_fee
          * v_frame_quantity / v_source_config.frame_quantity, 2)
      END,
      v_source_config.invoice_display_mode,
      v_source_config.billing_mode, v_source_config.artwork_length_in,
      v_source_config.artwork_width_in, v_source_config.frame_width_in,
      v_source_config.size_mode, v_source_config.overlap_in, v_source_config.mat_source,
      v_source_config.glazing_cut_to_mat_outer, v_source_config.mat_included,
      v_source_config.glazing_included, v_source_config.glazing_type,
      v_source_config.glazing_unit_rate, v_source_config.glazing_sheets,
      v_source_config.glazing_remarks, v_source_config.backing_type,
      v_source_config.moulding_material, v_source_config.backing_unit_rate,
      v_source_config.frame_rate, v_source_config.mat_unit_rate,
      v_source_config.mat_border_l_in, v_source_config.mat_border_w_in,
      v_source_config.flexipoints_numerator, v_source_config.flexipoints_denominator,
      v_source_config.multipoints_numerator, v_source_config.multipoints_denominator,
      p_user_id,
      p_user_id
    )
    RETURNING id INTO v_config_id;

    INSERT INTO public.sales_order_item_mat_layers (
      company_id, configuration_id, quotation_mat_layer_id, layer_index,
      mat_board_item_id, border_or_reveal_l_in, border_or_reveal_w_in, unit_rate,
      created_by, updated_by
    )
    SELECT
      p_company_id, v_config_id, quotation_layer.id, quotation_layer.layer_index,
      quotation_layer.mat_board_item_id, quotation_layer.border_or_reveal_l_in,
      quotation_layer.border_or_reveal_w_in, quotation_layer.unit_rate,
      p_user_id, p_user_id
    FROM public.sales_quotation_item_mat_layers quotation_layer
    WHERE quotation_layer.configuration_id = v_quotation_config_id
      AND quotation_layer.deleted_at IS NULL;

    INSERT INTO public.sales_order_item_components (
      company_id, order_item_id, configuration_id, quotation_component_id,
      component_type, source, item_id, description, qty_per_frame, total_quantity,
      uom_id, unit_rate, total_amount, discount_percent, discount_amount,
      rounding_mode, sort_order, created_by, updated_by
    )
    SELECT
      p_company_id, p_order_item_id, v_config_id, quotation_component.id,
      quotation_component.component_type, quotation_component.source,
      quotation_component.item_id, quotation_component.description,
      quotation_component.qty_per_frame,
      CASE
        WHEN quotation_component.rounding_mode = 'ceil'
          THEN CEIL(quotation_component.qty_per_frame * v_frame_quantity)
        ELSE quotation_component.qty_per_frame * v_frame_quantity
      END,
      quotation_component.uom_id, quotation_component.unit_rate,
      -- A saved amount is priced for this size's frame count, not by multiplying
      -- its formula rate or rounded material quantity. Keep full snapshots exact.
      CASE WHEN v_frame_quantity = v_source_config.frame_quantity
        THEN quotation_component.total_amount
        ELSE ROUND(quotation_component.total_amount
          * v_frame_quantity / v_source_config.frame_quantity, 2)
      END,
      quotation_component.discount_percent,
      CASE WHEN v_frame_quantity = v_source_config.frame_quantity
        THEN quotation_component.discount_amount
        ELSE ROUND(quotation_component.discount_amount
          * v_frame_quantity / v_source_config.frame_quantity, 2)
      END,
      quotation_component.rounding_mode, quotation_component.sort_order,
      p_user_id, p_user_id
    FROM public.sales_quotation_item_components quotation_component
    WHERE quotation_component.quotation_item_id = p_quotation_item_id
      AND quotation_component.configuration_id = v_quotation_config_id
      AND quotation_component.deleted_at IS NULL;
  END LOOP;

  IF v_frame_quantity_total <> v_line_quantity THEN
    RAISE EXCEPTION 'SALES_ORDER_FRAME_QUANTITY_MISMATCH';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_available_sales_quotation_frame_sizes(
  p_quotation_item_ids UUID[]
)
RETURNS TABLE(
  configuration_id UUID,
  quoted_quantity NUMERIC,
  ordered_quantity NUMERIC,
  remaining_quantity NUMERIC
)
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  WITH requested_configurations AS (
    SELECT
      quotation_configuration.id,
      quotation_configuration.frame_quantity
    FROM public.sales_quotation_item_configurations quotation_configuration
    JOIN public.sales_quotation_items quotation_item
      ON quotation_item.id = quotation_configuration.quotation_item_id
    JOIN public.sales_quotations quotation
      ON quotation.id = quotation_item.quotation_id
    WHERE quotation_configuration.quotation_item_id = ANY(p_quotation_item_ids)
      AND COALESCE(CARDINALITY(p_quotation_item_ids), 0) BETWEEN 1 AND 50
      AND quotation_configuration.deleted_at IS NULL
      AND quotation_item.deleted_at IS NULL
      AND quotation.deleted_at IS NULL
  ), allocated_quantities AS (
    SELECT
      order_configuration.quotation_configuration_id AS configuration_id,
      SUM(order_configuration.frame_quantity) AS ordered_quantity
    FROM public.sales_order_item_configurations order_configuration
    JOIN public.sales_order_items order_item
      ON order_item.id = order_configuration.order_item_id
    JOIN public.sales_orders sales_order
      ON sales_order.id = order_item.order_id
    WHERE order_configuration.quotation_configuration_id IN (
        SELECT requested.id FROM requested_configurations requested
      )
      AND order_configuration.deleted_at IS NULL
      AND order_item.deleted_at IS NULL
      AND sales_order.deleted_at IS NULL
      AND sales_order.status <> 'cancelled'
    GROUP BY order_configuration.quotation_configuration_id
  )
  SELECT
    requested.id,
    requested.frame_quantity,
    LEAST(COALESCE(allocated.ordered_quantity, 0), requested.frame_quantity),
    GREATEST(requested.frame_quantity - COALESCE(allocated.ordered_quantity, 0), 0)
  FROM requested_configurations requested
  LEFT JOIN allocated_quantities allocated ON allocated.configuration_id = requested.id;
$$;

CREATE OR REPLACE FUNCTION public.prepare_sales_order_draft_item(
  p_company_id UUID,
  p_customer_id UUID,
  p_item JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quotation_item_id UUID := NULLIF(p_item ->> 'quotationItemId', '')::UUID;
  v_quotation_id UUID := NULLIF(p_item ->> 'quotationId', '')::UUID;
  v_source RECORD;
  v_quantity NUMERIC := COALESCE(NULLIF(p_item ->> 'quantity', '')::NUMERIC, 0);
  v_rate NUMERIC;
  v_discount_percent NUMERIC;
  v_tax_percent NUMERIC;
  v_subtotal NUMERIC;
  v_discount_amount NUMERIC;
  v_component_discount_amount NUMERIC := 0;
  v_tax_amount NUMERIC;
  v_line_total NUMERIC;
  v_source_subtotal NUMERIC;
  v_share NUMERIC;
  v_frame_size_count INTEGER;
  v_selected_size_count INTEGER;
  v_selected_quantity NUMERIC;
  v_selection_valid BOOLEAN;
  v_full_selection BOOLEAN;
  v_has_frame_configuration BOOLEAN := FALSE;
BEGIN
  IF p_item ?| ARRAY[
    'frameSizes', 'frameConfiguration', 'frameComponents', 'matLayers', 'skipInventory'
  ] THEN
    RAISE EXCEPTION 'SALES_ORDER_FRAME_SOURCE_REQUIRED';
  END IF;

  IF v_quantity <= 0 THEN
    RAISE EXCEPTION 'SALES_ORDER_ITEMS_REQUIRED';
  END IF;

  IF v_quotation_item_id IS NOT NULL OR v_quotation_id IS NOT NULL THEN
    IF v_quotation_item_id IS NULL OR v_quotation_id IS NULL THEN
      RAISE EXCEPTION 'SALES_ORDER_QUOTATION_LINE_INVALID';
    END IF;

    SELECT
      quotation_item.item_id,
      quotation_item.item_description,
      quotation_item.quantity,
      quotation_item.fulfilled_qty,
      quotation_item.uom_id,
      quotation_item.pricing_tier,
      quotation_item.pricing_tier_name,
      quotation_item.rate,
      quotation_item.discount_percent,
      quotation_item.discount_amount,
      quotation_item.tax_percent,
      quotation_item.tax_amount,
      quotation_item.line_total
    INTO v_source
    FROM public.sales_quotation_items quotation_item
    JOIN public.sales_quotations quotation ON quotation.id = quotation_item.quotation_id
    WHERE quotation_item.id = v_quotation_item_id
      AND quotation_item.quotation_id = v_quotation_id
      AND quotation.customer_id = p_customer_id
      AND quotation.company_id = p_company_id
      AND quotation.status IN ('accepted', 'partially_ordered', 'ordered')
      AND quotation_item.deleted_at IS NULL
      AND quotation.deleted_at IS NULL
    FOR UPDATE OF quotation_item, quotation;

    IF v_source.item_id IS NULL
      OR v_quantity > GREATEST(v_source.quantity - COALESCE(v_source.fulfilled_qty, 0), 0) THEN
      RAISE EXCEPTION 'SALES_ORDER_QUOTATION_LINE_INVALID';
    END IF;

    SELECT COUNT(*) INTO v_frame_size_count
    FROM public.sales_quotation_item_configurations quotation_configuration
    WHERE quotation_configuration.quotation_item_id = v_quotation_item_id
      AND quotation_configuration.deleted_at IS NULL;
    v_has_frame_configuration := v_frame_size_count > 0;

    v_rate := v_source.rate;
    v_discount_percent := COALESCE(v_source.discount_percent, 0);
    v_tax_percent := COALESCE(v_source.tax_percent, 0);
    v_source_subtotal := v_source.line_total
      + COALESCE(v_source.discount_amount, 0) - COALESCE(v_source.tax_amount, 0);
    v_full_selection := v_quantity = v_source.quantity;

    IF v_has_frame_configuration THEN
      IF jsonb_typeof(p_item -> 'frameSizeSelections') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'SALES_ORDER_FRAME_SIZE_INVALID';
      END IF;
      IF jsonb_array_length(p_item -> 'frameSizeSelections') NOT BETWEEN 1 AND 50 THEN
        RAISE EXCEPTION 'SALES_ORDER_FRAME_SIZE_INVALID';
      END IF;
      IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_item -> 'frameSizeSelections') selection
        GROUP BY selection ->> 'quotationConfigurationId' HAVING COUNT(*) > 1
      ) THEN
        RAISE EXCEPTION 'SALES_ORDER_QUOTATION_FRAME_INVALID';
      END IF;

      -- One scoped aggregate for the entire selection. Use the same per-component
      -- cent rounding as the copied size snapshots; do not price from the line's
      -- average rate or perform another query inside the size-copy loop.
      WITH selected_sizes AS (
        SELECT configuration.id, configuration.frame_quantity,
          configuration.total_service_fee, selection.quantity,
          COALESCE(SUM(CASE WHEN selection.quantity = configuration.frame_quantity
            THEN component.total_amount
            ELSE ROUND(component.total_amount * selection.quantity
              / NULLIF(configuration.frame_quantity, 0), 2)
          END), 0) AS component_amount,
          COALESCE(SUM(CASE WHEN selection.quantity = configuration.frame_quantity
            THEN component.discount_amount
            ELSE ROUND(component.discount_amount * selection.quantity
              / NULLIF(configuration.frame_quantity, 0), 2)
          END), 0) AS component_discount_amount
        FROM jsonb_to_recordset(p_item -> 'frameSizeSelections')
          AS selection("quotationConfigurationId" UUID, quantity NUMERIC)
        JOIN public.sales_quotation_item_configurations configuration
          ON configuration.id = selection."quotationConfigurationId"
          AND configuration.quotation_item_id = v_quotation_item_id
          AND configuration.company_id = p_company_id
          AND configuration.deleted_at IS NULL
        LEFT JOIN public.sales_quotation_item_components component
          ON component.configuration_id = configuration.id
          AND component.quotation_item_id = v_quotation_item_id
          AND component.deleted_at IS NULL
        GROUP BY configuration.id, selection.quantity
      )
      SELECT COUNT(*), SUM(quantity),
        BOOL_AND(COALESCE(quantity > 0 AND TRUNC(quantity) = quantity
          AND quantity <= frame_quantity, FALSE)),
        BOOL_AND(quantity = frame_quantity),
        SUM(component_amount + CASE WHEN quantity = frame_quantity
          THEN total_service_fee
          ELSE ROUND(total_service_fee * quantity / NULLIF(frame_quantity, 0), 2)
        END), SUM(component_discount_amount)
      INTO v_selected_size_count, v_selected_quantity, v_selection_valid,
        v_full_selection, v_subtotal, v_component_discount_amount
      FROM selected_sizes;

      IF v_selected_size_count <> jsonb_array_length(p_item -> 'frameSizeSelections')
        OR v_selection_valid IS NOT TRUE THEN
        RAISE EXCEPTION 'SALES_ORDER_QUOTATION_FRAME_INVALID';
      END IF;
      IF v_selected_quantity <> v_quantity THEN
        RAISE EXCEPTION 'SALES_ORDER_FRAME_QUANTITY_MISMATCH';
      END IF;
      v_full_selection := v_full_selection AND v_selected_size_count = v_frame_size_count
        AND v_quantity = v_source.quantity;
    ELSE
      v_subtotal := ROUND(v_source_subtotal * v_quantity / v_source.quantity, 2);
    END IF;

    IF v_full_selection THEN
      -- Includes a notes-only edit of a converted draft. Explicit money columns
      -- remain authoritative even when the saved percentage is zero.
      v_discount_amount := COALESCE(v_source.discount_amount, 0);
      v_tax_amount := COALESCE(v_source.tax_amount, 0);
      v_line_total := v_source.line_total;
    ELSE
      IF v_source_subtotal < 0 OR v_subtotal < 0 OR v_subtotal > v_source_subtotal THEN
        RAISE EXCEPTION 'SALES_ORDER_QUOTATION_LINE_INVALID';
      END IF;
      -- Allocate a job-wide fixed deduction by the selected commercial value.
      -- Repeating the same selection produces the same amounts on every edit.
      v_share := CASE WHEN v_source_subtotal = 0 THEN 0
        ELSE v_subtotal / v_source_subtotal END;
      v_discount_amount := ROUND(COALESCE(v_source.discount_amount, 0) * v_share, 2);
      v_tax_amount := CASE
        WHEN v_source_subtotal - COALESCE(v_source.discount_amount, 0) = 0 THEN 0
        ELSE ROUND(COALESCE(v_source.tax_amount, 0)
          * (v_subtotal - v_discount_amount)
          / (v_source_subtotal - COALESCE(v_source.discount_amount, 0)), 2)
      END;
      v_line_total := v_subtotal - v_discount_amount + v_tax_amount;
      v_rate := ROUND(v_subtotal / v_quantity, 2);
    END IF;
    p_item := p_item || jsonb_build_object(
      'itemId', v_source.item_id,
      'description', COALESCE(v_source.item_description, ''),
      'uomId', v_source.uom_id,
      'pricingTier', v_source.pricing_tier,
      'pricingTierName', v_source.pricing_tier_name,
      'unitPrice', v_rate,
      'discount', v_discount_percent,
      'taxRate', v_tax_percent,
      'skipInventory', v_has_frame_configuration
    );
  ELSE
    IF p_item ? 'frameSizeSelections' THEN
      RAISE EXCEPTION 'SALES_ORDER_FRAME_SOURCE_REQUIRED';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.items item
      WHERE item.id = NULLIF(p_item ->> 'itemId', '')::UUID
        AND item.company_id = p_company_id
        AND item.is_active = TRUE
        AND item.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'SALES_ORDER_ITEMS_REQUIRED';
    END IF;
    v_rate := COALESCE(NULLIF(p_item ->> 'unitPrice', '')::NUMERIC, 0);
    v_discount_percent := COALESCE(NULLIF(p_item ->> 'discount', '')::NUMERIC, 0);
    v_tax_percent := COALESCE(NULLIF(p_item ->> 'taxRate', '')::NUMERIC, 0);
    IF NULLIF(p_item ->> 'uomId', '') IS NULL
      OR v_rate < 0
      OR v_discount_percent < 0 OR v_discount_percent > 100
      OR v_tax_percent < 0 OR v_tax_percent > 100 THEN
      RAISE EXCEPTION 'SALES_ORDER_ITEMS_REQUIRED';
    END IF;
    v_subtotal := v_quantity * v_rate;
    v_discount_amount := v_subtotal * v_discount_percent / 100;
    v_tax_amount := (v_subtotal - v_discount_amount) * v_tax_percent / 100;
    v_line_total := v_subtotal - v_discount_amount + v_tax_amount;
  END IF;

  RETURN p_item || jsonb_build_object(
    'quantity', v_quantity,
    'unitPrice', v_rate,
    'discount', v_discount_percent,
    'discountAmount', v_discount_amount,
    'componentDiscountAmount', v_component_discount_amount,
    'taxRate', v_tax_percent,
    'taxAmount', v_tax_amount,
    'lineTotal', v_line_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_sales_order_draft_transaction(
  p_customer_id UUID,
  p_order_date DATE,
  p_expected_delivery_date DATE,
  p_business_unit_id UUID,
  p_shipping_address TEXT,
  p_shipping_city TEXT,
  p_shipping_state TEXT,
  p_shipping_postal_code TEXT,
  p_shipping_country TEXT,
  p_payment_terms TEXT,
  p_notes TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_order_id UUID;
  v_order_item_id UUID;
  v_item JSONB;
  v_sort_order INTEGER;
  v_subtotal NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_tax NUMERIC := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'SALES_ORDER_UNAUTHENTICATED'; END IF;
  SELECT company_id INTO v_company_id FROM public.users WHERE id = v_user_id;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'SALES_ORDER_FORBIDDEN'; END IF;
  IF p_business_unit_id IS NULL
    OR NOT public.user_has_permission(v_user_id, 'sales_orders', 'create', p_business_unit_id) THEN
    RAISE EXCEPTION 'SALES_ORDER_FORBIDDEN';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.customers customer
    WHERE customer.id = p_customer_id
      AND customer.company_id = v_company_id
      AND customer.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SALES_ORDER_CUSTOMER_INVALID';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 200 THEN
    RAISE EXCEPTION 'SALES_ORDER_ITEMS_REQUIRED';
  END IF;

  INSERT INTO public.sales_orders (
    company_id, business_unit_id, order_date, customer_id, expected_delivery_date,
    subtotal, discount_amount, tax_amount, total_amount,
    shipping_address, shipping_city, shipping_state, shipping_postal_code,
    shipping_country, payment_terms, notes, created_by, updated_by
  ) VALUES (
    v_company_id, p_business_unit_id, p_order_date, p_customer_id, p_expected_delivery_date,
    0, 0, 0, 0,
    p_shipping_address, p_shipping_city, p_shipping_state, p_shipping_postal_code,
    p_shipping_country, p_payment_terms, p_notes, v_user_id, v_user_id
  ) RETURNING id INTO v_order_id;

  FOR v_item, v_sort_order IN
    SELECT value, ordinality::INTEGER - 1
    FROM jsonb_array_elements(p_items) WITH ORDINALITY
  LOOP
    v_item := public.prepare_sales_order_draft_item(
      v_company_id,
      p_customer_id,
      v_item
    );

    INSERT INTO public.sales_order_items (
      company_id, order_id, item_id, quotation_id, quotation_item_id, skip_inventory,
      item_description, quantity, uom_id, pricing_tier, pricing_tier_name, rate,
      discount_percent, discount_amount, tax_percent, tax_amount, line_total,
      quantity_shipped, quantity_delivered, sort_order, created_by, updated_by
    ) VALUES (
      v_company_id, v_order_id, NULLIF(v_item ->> 'itemId', '')::UUID,
      NULLIF(v_item ->> 'quotationId', '')::UUID,
      NULLIF(v_item ->> 'quotationItemId', '')::UUID,
      COALESCE(NULLIF(v_item ->> 'skipInventory', '')::BOOLEAN, FALSE),
      COALESCE(v_item ->> 'description', ''),
      NULLIF(v_item ->> 'quantity', '')::NUMERIC,
      NULLIF(v_item ->> 'uomId', '')::UUID,
      NULLIF(v_item ->> 'pricingTier', ''), NULLIF(v_item ->> 'pricingTierName', ''),
      NULLIF(v_item ->> 'unitPrice', '')::NUMERIC,
      COALESCE(NULLIF(v_item ->> 'discount', '')::NUMERIC, 0),
      COALESCE(NULLIF(v_item ->> 'discountAmount', '')::NUMERIC, 0),
      COALESCE(NULLIF(v_item ->> 'taxRate', '')::NUMERIC, 0),
      COALESCE(NULLIF(v_item ->> 'taxAmount', '')::NUMERIC, 0),
      NULLIF(v_item ->> 'lineTotal', '')::NUMERIC,
      0, 0, v_sort_order, v_user_id, v_user_id
    ) RETURNING id INTO v_order_item_id;

    v_subtotal := v_subtotal + (
      (v_item ->> 'lineTotal')::NUMERIC + (v_item ->> 'discountAmount')::NUMERIC
        + (v_item ->> 'componentDiscountAmount')::NUMERIC
        - (v_item ->> 'taxAmount')::NUMERIC
    );
    v_discount := v_discount + (v_item ->> 'discountAmount')::NUMERIC
      + (v_item ->> 'componentDiscountAmount')::NUMERIC;
    v_tax := v_tax + COALESCE(NULLIF(v_item ->> 'taxAmount', '')::NUMERIC, 0);

    PERFORM public.save_sales_order_item_frame_sizes(
      v_company_id,
      v_order_item_id,
      NULLIF(v_item ->> 'quotationItemId', '')::UUID,
      v_item,
      v_user_id
    );
  END LOOP;

  UPDATE public.sales_orders
  SET subtotal = v_subtotal,
      discount_amount = v_discount,
      tax_amount = v_tax,
      total_amount = v_subtotal - v_discount + v_tax,
      updated_by = v_user_id
  WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_sales_order_draft_transaction(
  p_sales_order_id UUID,
  p_customer_id UUID,
  p_order_date DATE,
  p_expected_delivery_date DATE,
  p_shipping_address TEXT,
  p_shipping_city TEXT,
  p_shipping_state TEXT,
  p_shipping_postal_code TEXT,
  p_shipping_country TEXT,
  p_payment_terms TEXT,
  p_notes TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_order RECORD;
  v_order_item_id UUID;
  v_item JSONB;
  v_sort_order INTEGER;
  v_subtotal NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_tax NUMERIC := 0;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'SALES_ORDER_UNAUTHENTICATED'; END IF;
  SELECT id, company_id, business_unit_id, status
  INTO v_order
  FROM public.sales_orders
  WHERE id = p_sales_order_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'SALES_ORDER_NOT_FOUND'; END IF;
  IF v_order.status <> 'draft' THEN RAISE EXCEPTION 'SALES_ORDER_NOT_EDITABLE'; END IF;
  IF NOT public.user_has_permission(v_user_id, 'sales_orders', 'edit', v_order.business_unit_id) THEN
    RAISE EXCEPTION 'SALES_ORDER_FORBIDDEN';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.customers customer
    WHERE customer.id = p_customer_id
      AND customer.company_id = v_order.company_id
      AND customer.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'SALES_ORDER_CUSTOMER_INVALID';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 200 THEN
    RAISE EXCEPTION 'SALES_ORDER_ITEMS_REQUIRED';
  END IF;

  DELETE FROM public.sales_order_items WHERE order_id = p_sales_order_id;

  FOR v_item, v_sort_order IN
    SELECT value, ordinality::INTEGER - 1
    FROM jsonb_array_elements(p_items) WITH ORDINALITY
  LOOP
    v_item := public.prepare_sales_order_draft_item(
      v_order.company_id,
      p_customer_id,
      v_item
    );

    INSERT INTO public.sales_order_items (
      company_id, order_id, item_id, quotation_id, quotation_item_id, skip_inventory,
      item_description, quantity, uom_id, pricing_tier, pricing_tier_name, rate,
      discount_percent, discount_amount, tax_percent, tax_amount, line_total,
      quantity_shipped, quantity_delivered, sort_order, created_by, updated_by
    ) VALUES (
      v_order.company_id, p_sales_order_id, NULLIF(v_item ->> 'itemId', '')::UUID,
      NULLIF(v_item ->> 'quotationId', '')::UUID,
      NULLIF(v_item ->> 'quotationItemId', '')::UUID,
      COALESCE(NULLIF(v_item ->> 'skipInventory', '')::BOOLEAN, FALSE),
      COALESCE(v_item ->> 'description', ''),
      NULLIF(v_item ->> 'quantity', '')::NUMERIC,
      NULLIF(v_item ->> 'uomId', '')::UUID,
      NULLIF(v_item ->> 'pricingTier', ''), NULLIF(v_item ->> 'pricingTierName', ''),
      NULLIF(v_item ->> 'unitPrice', '')::NUMERIC,
      COALESCE(NULLIF(v_item ->> 'discount', '')::NUMERIC, 0),
      COALESCE(NULLIF(v_item ->> 'discountAmount', '')::NUMERIC, 0),
      COALESCE(NULLIF(v_item ->> 'taxRate', '')::NUMERIC, 0),
      COALESCE(NULLIF(v_item ->> 'taxAmount', '')::NUMERIC, 0),
      NULLIF(v_item ->> 'lineTotal', '')::NUMERIC,
      COALESCE(NULLIF(v_item ->> 'quantityShipped', '')::NUMERIC, 0),
      COALESCE(NULLIF(v_item ->> 'quantityDelivered', '')::NUMERIC, 0),
      v_sort_order, v_user_id, v_user_id
    ) RETURNING id INTO v_order_item_id;

    v_subtotal := v_subtotal + (
      (v_item ->> 'lineTotal')::NUMERIC + (v_item ->> 'discountAmount')::NUMERIC
        + (v_item ->> 'componentDiscountAmount')::NUMERIC
        - (v_item ->> 'taxAmount')::NUMERIC
    );
    v_discount := v_discount + (v_item ->> 'discountAmount')::NUMERIC
      + (v_item ->> 'componentDiscountAmount')::NUMERIC;
    v_tax := v_tax + COALESCE(NULLIF(v_item ->> 'taxAmount', '')::NUMERIC, 0);

    PERFORM public.save_sales_order_item_frame_sizes(
      v_order.company_id,
      v_order_item_id,
      NULLIF(v_item ->> 'quotationItemId', '')::UUID,
      v_item,
      v_user_id
    );
  END LOOP;

  UPDATE public.sales_orders
  SET customer_id = p_customer_id,
      order_date = p_order_date,
      expected_delivery_date = p_expected_delivery_date,
      shipping_address = p_shipping_address,
      shipping_city = p_shipping_city,
      shipping_state = p_shipping_state,
      shipping_postal_code = p_shipping_postal_code,
      shipping_country = p_shipping_country,
      payment_terms = p_payment_terms,
      notes = p_notes,
      subtotal = v_subtotal,
      discount_amount = v_discount,
      tax_amount = v_tax,
      total_amount = v_subtotal - v_discount + v_tax,
      updated_by = v_user_id
  WHERE id = p_sales_order_id;

  RETURN p_sales_order_id;
END;
$$;

-- A component belongs to exactly one size configuration. Joining configurations
-- through the order item duplicates every component once per size, which would
-- over-reserve stock for a multi-size line.
CREATE OR REPLACE FUNCTION public.create_frame_job_order_from_sales_order_transaction(
  p_sales_order_id UUID,
  p_warehouse_id UUID
)
RETURNS TABLE(job_order_id UUID, job_order_code TEXT, billing_mode TEXT)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sales_order RECORD;
  v_mode RECORD;
  v_job_order_id UUID;
  v_job_order_code TEXT;
  v_component RECORD;
  v_stock RECORD;
  v_available NUMERIC;
  v_created INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Warehouse is required to reserve frame materials';
  END IF;

  SELECT id, company_id, business_unit_id, customer_id, status, notes
  INTO v_sales_order
  FROM public.sales_orders
  WHERE id = p_sales_order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_sales_order.id IS NULL THEN
    RAISE EXCEPTION 'Sales order not found';
  END IF;

  IF v_sales_order.status NOT IN ('confirmed', 'in_progress', 'invoiced') THEN
    RAISE EXCEPTION 'Only confirmed, in-progress, or invoiced sales orders can create frame job orders';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sales_order_item_configurations configuration
    JOIN public.sales_order_items order_item ON order_item.id = configuration.order_item_id
    WHERE order_item.order_id = p_sales_order_id
      AND order_item.deleted_at IS NULL
      AND configuration.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Sales order has no frame-configured items';
  END IF;

  FOR v_mode IN
    SELECT DISTINCT configuration.billing_mode
    FROM public.sales_order_item_configurations configuration
    JOIN public.sales_order_items order_item ON order_item.id = configuration.order_item_id
    WHERE order_item.order_id = p_sales_order_id
      AND order_item.deleted_at IS NULL
      AND configuration.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.frame_job_orders existing
        WHERE existing.sales_order_id = p_sales_order_id
          AND existing.billing_mode = configuration.billing_mode
          AND existing.status <> 'cancelled'
          AND existing.deleted_at IS NULL
      )
    ORDER BY configuration.billing_mode
  LOOP
    INSERT INTO public.frame_job_orders (
      company_id,
      business_unit_id,
      quotation_id,
      sales_order_id,
      customer_id,
      status,
      billing_mode,
      order_date,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      v_sales_order.company_id,
      v_sales_order.business_unit_id,
      NULL,
      p_sales_order_id,
      v_sales_order.customer_id,
      'pending',
      v_mode.billing_mode,
      CURRENT_DATE,
      v_sales_order.notes,
      v_user_id,
      v_user_id
    )
    RETURNING id, frame_job_orders.job_order_code
    INTO v_job_order_id, v_job_order_code;

    FOR v_component IN
      SELECT
        component.id,
        component.order_item_id,
        component.quotation_component_id,
        component.item_id,
        component.description,
        component.total_quantity,
        component.uom_id,
        component.unit_rate,
        component.total_amount
      FROM public.sales_order_item_components component
      JOIN public.sales_order_items order_item ON order_item.id = component.order_item_id
      JOIN public.sales_order_item_configurations configuration
        ON configuration.id = component.configuration_id
      WHERE order_item.order_id = p_sales_order_id
        AND order_item.deleted_at IS NULL
        AND component.deleted_at IS NULL
        AND configuration.deleted_at IS NULL
        AND configuration.billing_mode = v_mode.billing_mode
      ORDER BY order_item.sort_order ASC NULLS LAST,
        configuration.size_index ASC,
        component.sort_order ASC
    LOOP
      SELECT id, current_stock, reserved_stock
      INTO v_stock
      FROM public.item_warehouse
      WHERE company_id = v_sales_order.company_id
        AND item_id = v_component.item_id
        AND warehouse_id = p_warehouse_id
        AND deleted_at IS NULL
      FOR UPDATE;

      IF v_stock.id IS NULL THEN
        RAISE EXCEPTION 'No stock record exists for a required frame component';
      END IF;

      v_available := COALESCE(v_stock.current_stock, 0) - COALESCE(v_stock.reserved_stock, 0);
      IF v_available < v_component.total_quantity THEN
        RAISE EXCEPTION 'Insufficient available stock for a required frame component';
      END IF;

      INSERT INTO public.frame_job_order_items (
        company_id,
        job_order_id,
        sales_order_item_id,
        sales_order_component_id,
        quotation_component_id,
        item_id,
        item_description,
        required_quantity,
        uom_id,
        unit_rate,
        total_amount,
        created_by,
        updated_by
      )
      VALUES (
        v_sales_order.company_id,
        v_job_order_id,
        v_component.order_item_id,
        v_component.id,
        v_component.quotation_component_id,
        v_component.item_id,
        v_component.description,
        v_component.total_quantity,
        v_component.uom_id,
        v_component.unit_rate,
        v_component.total_amount,
        v_user_id,
        v_user_id
      );

      INSERT INTO public.inventory_reservations (
        company_id,
        reservation_type,
        source_type,
        source_id,
        quotation_id,
        sales_order_id,
        sales_order_item_id,
        sales_order_component_id,
        quotation_component_id,
        job_order_id,
        item_id,
        warehouse_id,
        quantity,
        uom_id,
        status,
        created_by,
        updated_by
      )
      VALUES (
        v_sales_order.company_id,
        'frame_job_order',
        'sales_order',
        p_sales_order_id,
        NULL,
        p_sales_order_id,
        v_component.order_item_id,
        v_component.id,
        v_component.quotation_component_id,
        v_job_order_id,
        v_component.item_id,
        p_warehouse_id,
        v_component.total_quantity,
        v_component.uom_id,
        'active',
        v_user_id,
        v_user_id
      );

      UPDATE public.item_warehouse
      SET reserved_stock = COALESCE(reserved_stock, 0) + v_component.total_quantity,
          updated_by = v_user_id
      WHERE id = v_stock.id;
    END LOOP;

    v_created := v_created + 1;
    job_order_id := v_job_order_id;
    job_order_code := v_job_order_code;
    billing_mode := v_mode.billing_mode;
    RETURN NEXT;
  END LOOP;

  IF v_created = 0 THEN
    RAISE EXCEPTION 'This sales order already has a frame job order for every billing mode';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_sales_order_item_frame_sizes(UUID, UUID, UUID, JSONB, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_sales_order_draft_item(UUID, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_available_sales_quotation_frame_sizes(UUID[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_sales_quotation_frame_sizes(UUID[])
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_sales_order_draft_transaction(
  UUID, DATE, DATE, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_sales_order_draft_transaction(
  UUID, UUID, DATE, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated;

COMMIT;
