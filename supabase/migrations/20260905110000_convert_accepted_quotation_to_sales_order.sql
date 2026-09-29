-- Convert a fully accepted quotation into one draft sales order without
-- flattening its per-size frame configurations. The existing draft-order RPC
-- remains the single implementation for copying quotation-owned frame data;
-- this wrapper owns the whole-quotation validation and exact commercial totals.

BEGIN;

CREATE OR REPLACE FUNCTION public.convert_accepted_sales_quotation_to_order_transaction(
  p_quotation_id UUID,
  p_business_unit_id UUID
)
RETURNS TABLE (
  sales_order_id UUID,
  order_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_quotation RECORD;
  v_customer RECORD;
  v_items JSONB;
  v_order_id UUID;
  v_order_code TEXT;
  v_item_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'SALES_ORDER_UNAUTHENTICATED';
  END IF;

  SELECT app_user.company_id
  INTO v_user_company_id
  FROM public.users app_user
  WHERE app_user.id = v_user_id;

  IF v_user_company_id IS NULL
    OR p_business_unit_id IS NULL
    OR NOT public.user_has_permission(
      v_user_id,
      'sales_orders',
      'create',
      p_business_unit_id
    ) THEN
    RAISE EXCEPTION 'SALES_ORDER_FORBIDDEN';
  END IF;

  SELECT
    quotation.id,
    quotation.company_id,
    quotation.business_unit_id,
    quotation.customer_id,
    quotation.status,
    quotation.valid_until,
    quotation.due_date,
    quotation.payment_terms,
    quotation.notes
  INTO v_quotation
  FROM public.sales_quotations quotation
  WHERE quotation.id = p_quotation_id
    AND quotation.deleted_at IS NULL
  FOR UPDATE;

  IF v_quotation.id IS NULL OR v_quotation.company_id <> v_user_company_id THEN
    RAISE EXCEPTION 'QUOTATION_CONVERT_NOT_FOUND';
  END IF;

  IF v_quotation.business_unit_id IS DISTINCT FROM p_business_unit_id THEN
    RAISE EXCEPTION 'QUOTATION_CONVERT_WRONG_BUSINESS_UNIT';
  END IF;

  IF v_quotation.status <> 'accepted' THEN
    RAISE EXCEPTION 'QUOTATION_CONVERT_NOT_ACCEPTED';
  END IF;

  SELECT
    customer.shipping_address_line1,
    customer.shipping_address_line2,
    customer.shipping_city,
    customer.shipping_state,
    customer.shipping_postal_code,
    customer.shipping_country,
    customer.billing_address_line1,
    customer.billing_address_line2,
    customer.billing_city,
    customer.billing_state,
    customer.billing_postal_code,
    customer.billing_country,
    customer.payment_terms
  INTO v_customer
  FROM public.customers customer
  WHERE customer.id = v_quotation.customer_id
    AND customer.company_id = v_quotation.company_id
    AND customer.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SALES_ORDER_CUSTOMER_INVALID';
  END IF;

  SELECT COUNT(*)
  INTO v_item_count
  FROM public.sales_quotation_items quotation_item
  WHERE quotation_item.quotation_id = p_quotation_id
    AND quotation_item.deleted_at IS NULL;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'QUOTATION_CONVERT_EMPTY';
  END IF;

  IF v_item_count > 200 THEN
    RAISE EXCEPTION 'QUOTATION_CONVERT_TOO_MANY_ITEMS';
  END IF;

  -- This action is intentionally all-or-nothing. Once any part has already
  -- been ordered, operators use the size-aware partial-order selector instead.
  IF EXISTS (
    SELECT 1
    FROM public.sales_quotation_items quotation_item
    WHERE quotation_item.quotation_id = p_quotation_id
      AND quotation_item.deleted_at IS NULL
      AND (
        quotation_item.quantity <= 0
        OR COALESCE(quotation_item.fulfilled_qty, 0) > 0
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.sales_order_items order_item
    JOIN public.sales_orders sales_order ON sales_order.id = order_item.order_id
    WHERE order_item.quotation_id = p_quotation_id
      AND order_item.deleted_at IS NULL
      AND sales_order.deleted_at IS NULL
      AND sales_order.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'QUOTATION_CONVERT_ALREADY_ORDERED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sales_quotation_items quotation_item
    WHERE quotation_item.quotation_id = p_quotation_id
      AND quotation_item.deleted_at IS NULL
      AND (
        quotation_item.item_id IS NULL
        OR quotation_item.uom_id IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'QUOTATION_CONVERT_INVALID_LINE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sales_quotation_items quotation_item
    JOIN LATERAL (
      SELECT
        COUNT(*) AS configuration_count,
        COALESCE(SUM(configuration.frame_quantity), 0) AS frame_quantity
      FROM public.sales_quotation_item_configurations configuration
      WHERE configuration.quotation_item_id = quotation_item.id
        AND configuration.deleted_at IS NULL
    ) configuration_summary ON TRUE
    WHERE quotation_item.quotation_id = p_quotation_id
      AND quotation_item.deleted_at IS NULL
      AND configuration_summary.configuration_count > 0
      AND (
        configuration_summary.configuration_count > 50
        OR configuration_summary.frame_quantity <> quotation_item.quantity
      )
  ) THEN
    RAISE EXCEPTION 'QUOTATION_CONVERT_INVALID_FRAME_SIZES';
  END IF;

  SELECT jsonb_agg(
    jsonb_strip_nulls(
      jsonb_build_object(
        'itemId', quotation_item.item_id,
        'quotationId', p_quotation_id,
        'quotationItemId', quotation_item.id,
        'description', COALESCE(quotation_item.item_description, ''),
        'quantity', quotation_item.quantity,
        'uomId', quotation_item.uom_id,
        'pricingTier', quotation_item.pricing_tier,
        'pricingTierName', quotation_item.pricing_tier_name,
        'unitPrice', quotation_item.rate,
        'discount', COALESCE(quotation_item.discount_percent, 0),
        'taxRate', COALESCE(quotation_item.tax_percent, 0)
      )
    ) || CASE
      WHEN frame_sizes.selections IS NULL THEN '{}'::JSONB
      ELSE jsonb_build_object('frameSizeSelections', frame_sizes.selections)
    END
    ORDER BY quotation_item.sort_order ASC NULLS LAST, quotation_item.created_at, quotation_item.id
  )
  INTO v_items
  FROM public.sales_quotation_items quotation_item
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'quotationConfigurationId', configuration.id,
        'quantity', configuration.frame_quantity
      )
      ORDER BY configuration.size_index ASC NULLS LAST, configuration.id
    ) AS selections
    FROM public.sales_quotation_item_configurations configuration
    WHERE configuration.quotation_item_id = quotation_item.id
      AND configuration.deleted_at IS NULL
  ) frame_sizes ON TRUE
  WHERE quotation_item.quotation_id = p_quotation_id
    AND quotation_item.deleted_at IS NULL;

  SELECT public.create_sales_order_draft_transaction(
    p_customer_id := v_quotation.customer_id,
    p_order_date := CURRENT_DATE,
    p_expected_delivery_date := GREATEST(
      COALESCE(v_quotation.due_date, v_quotation.valid_until, CURRENT_DATE),
      CURRENT_DATE
    ),
    p_business_unit_id := p_business_unit_id,
    p_shipping_address := COALESCE(
      NULLIF(BTRIM(CONCAT_WS(
        ' ',
        v_customer.shipping_address_line1,
        v_customer.shipping_address_line2
      )), ''),
      NULLIF(BTRIM(CONCAT_WS(
        ' ',
        v_customer.billing_address_line1,
        v_customer.billing_address_line2
      )), ''),
      ''
    ),
    p_shipping_city := COALESCE(v_customer.shipping_city, v_customer.billing_city, ''),
    p_shipping_state := COALESCE(v_customer.shipping_state, v_customer.billing_state, ''),
    p_shipping_postal_code := COALESCE(
      v_customer.shipping_postal_code,
      v_customer.billing_postal_code,
      ''
    ),
    p_shipping_country := COALESCE(
      v_customer.shipping_country,
      v_customer.billing_country,
      ''
    ),
    p_payment_terms := COALESCE(
      NULLIF(BTRIM(v_quotation.payment_terms), ''),
      NULLIF(BTRIM(v_customer.payment_terms), ''),
      'cash'
    ),
    p_notes := COALESCE(v_quotation.notes, ''),
    p_items := v_items
  )
  INTO v_order_id;

  -- The shared draft operation preserves full-line monetary snapshots and
  -- aggregates those exact amounts. Conversion and subsequent edits therefore
  -- use the same financial path, with no post-save monetary override.
  SELECT sales_order.order_code INTO v_order_code
  FROM public.sales_orders sales_order
  WHERE sales_order.id = v_order_id;

  sales_order_id := v_order_id;
  order_code := v_order_code;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_accepted_sales_quotation_to_order_transaction(UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_accepted_sales_quotation_to_order_transaction(UUID, UUID)
  TO authenticated;

COMMIT;
