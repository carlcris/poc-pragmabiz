ALTER TABLE public.sales_order_items
  ADD COLUMN IF NOT EXISTS skip_inventory BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.sales_invoice_items
  ADD COLUMN IF NOT EXISTS skip_inventory BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.sales_order_items.skip_inventory IS
  'When true, this sales order line is invoiced financially but must not trigger invoice stock validation or stock deduction.';

COMMENT ON COLUMN public.sales_invoice_items.skip_inventory IS
  'Copied from the source sales line. When true, this invoice line does not represent invoice-driven stock deduction.';

UPDATE public.sales_order_items soi
SET skip_inventory = TRUE
WHERE EXISTS (
  SELECT 1
  FROM public.sales_order_item_configurations cfg
  WHERE cfg.order_item_id = soi.id
    AND cfg.deleted_at IS NULL
)
  AND soi.deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.create_sales_order_transaction(
  p_quotation_id UUID,
  p_business_unit_id UUID
)
RETURNS TABLE (
  sales_order_id UUID,
  order_code TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_quotation RECORD;
  v_quote_item RECORD;
  v_configuration RECORD;
  v_sales_order_id UUID;
  v_order_item_id UUID;
  v_order_configuration_id UUID;
  v_order_code TEXT;
  v_item_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required';
  END IF;

  SELECT *
  INTO v_quotation
  FROM public.sales_quotations
  WHERE id = p_quotation_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_quotation.id IS NULL THEN
    RAISE EXCEPTION 'Quotation not found';
  END IF;

  IF v_quotation.status <> 'accepted' THEN
    RAISE EXCEPTION 'Only accepted quotations can be converted to sales orders';
  END IF;

  IF v_quotation.sales_order_id IS NOT NULL THEN
    RAISE EXCEPTION 'This quotation has already been converted to a sales order';
  END IF;

  SELECT COUNT(*) INTO v_item_count
  FROM public.sales_quotation_items
  WHERE quotation_id = p_quotation_id
    AND deleted_at IS NULL;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Quotation must have at least one item';
  END IF;

  INSERT INTO public.sales_orders (
    company_id,
    business_unit_id,
    customer_id,
    quotation_id,
    order_date,
    expected_delivery_date,
    status,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    payment_terms,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    v_quotation.company_id,
    p_business_unit_id,
    v_quotation.customer_id,
    p_quotation_id,
    CURRENT_DATE,
    COALESCE(v_quotation.valid_until, CURRENT_DATE + 14),
    'confirmed',
    v_quotation.subtotal,
    v_quotation.discount_amount,
    v_quotation.tax_amount,
    v_quotation.total_amount,
    COALESCE(v_quotation.terms_conditions, 'Payment due within 30 days'),
    COALESCE(v_quotation.notes, ''),
    v_user_id,
    v_user_id
  )
  RETURNING id, sales_orders.order_code INTO v_sales_order_id, v_order_code;

  FOR v_quote_item IN
    SELECT *
    FROM public.sales_quotation_items
    WHERE quotation_id = p_quotation_id
      AND deleted_at IS NULL
    ORDER BY sort_order ASC NULLS LAST, created_at ASC
  LOOP
    INSERT INTO public.sales_order_items (
      company_id,
      order_id,
      item_id,
      item_description,
      quantity,
      uom_id,
      rate,
      discount_percent,
      discount_amount,
      tax_percent,
      tax_amount,
      line_total,
      quantity_shipped,
      quantity_delivered,
      sort_order,
      notes,
      created_by,
      updated_by,
      skip_inventory
    )
    VALUES (
      v_quote_item.company_id,
      v_sales_order_id,
      v_quote_item.item_id,
      v_quote_item.item_description,
      v_quote_item.quantity,
      v_quote_item.uom_id,
      v_quote_item.rate,
      COALESCE(v_quote_item.discount_percent, 0),
      COALESCE(v_quote_item.discount_amount, 0),
      COALESCE(v_quote_item.tax_percent, 0),
      COALESCE(v_quote_item.tax_amount, 0),
      v_quote_item.line_total,
      0,
      0,
      v_quote_item.sort_order,
      v_quote_item.notes,
      v_user_id,
      v_user_id,
      FALSE
    )
    RETURNING id INTO v_order_item_id;

    SELECT *
    INTO v_configuration
    FROM public.sales_quotation_item_configurations
    WHERE quotation_item_id = v_quote_item.id
      AND deleted_at IS NULL;

    IF v_configuration.id IS NOT NULL THEN
      UPDATE public.sales_order_items
      SET skip_inventory = TRUE,
          updated_by = v_user_id,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = v_order_item_id;

      INSERT INTO public.sales_order_item_configurations (
        company_id,
        order_item_id,
        quotation_configuration_id,
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
        created_by,
        updated_by
      )
      VALUES (
        v_configuration.company_id,
        v_order_item_id,
        v_configuration.id,
        v_configuration.width,
        v_configuration.height,
        v_configuration.fixed_allowance,
        v_configuration.molding_item_id,
        v_configuration.molding_stick_length,
        v_configuration.molding_sticks_required,
        v_configuration.service_fee_mode,
        v_configuration.service_type,
        v_configuration.service_fee_amount,
        v_configuration.total_service_fee,
        v_configuration.invoice_display_mode,
        v_user_id,
        v_user_id
      )
      RETURNING id INTO v_order_configuration_id;

      INSERT INTO public.sales_order_item_components (
        company_id,
        order_item_id,
        configuration_id,
        quotation_component_id,
        component_type,
        source,
        item_id,
        description,
        qty_per_frame,
        total_quantity,
        uom_id,
        unit_rate,
        total_amount,
        rounding_mode,
        sort_order,
        created_by,
        updated_by
      )
      SELECT
        company_id,
        v_order_item_id,
        v_order_configuration_id,
        id,
        component_type,
        source,
        item_id,
        description,
        qty_per_frame,
        total_quantity,
        uom_id,
        unit_rate,
        total_amount,
        rounding_mode,
        sort_order,
        v_user_id,
        v_user_id
      FROM public.sales_quotation_item_components
      WHERE quotation_item_id = v_quote_item.id
        AND deleted_at IS NULL
      ORDER BY sort_order ASC NULLS LAST, created_at ASC;
    END IF;
  END LOOP;

  UPDATE public.sales_quotations
  SET
    status = 'ordered',
    sales_order_id = v_sales_order_id,
    updated_by = v_user_id
  WHERE id = p_quotation_id;

  sales_order_id := v_sales_order_id;
  order_code := v_order_code;
  RETURN NEXT;
END;
$$;
