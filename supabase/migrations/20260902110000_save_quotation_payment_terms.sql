-- ============================================================================
-- Migration: Carry payment terms through the quotation RPCs
-- Description:
--   Companion to 20260902100000. Appended last with a NULL default so callers
--   that have not been updated still bind.
--
--   As with the job dates and items received, a defaulted parameter creates an
--   OVERLOAD rather than replacing the function, and two matching arities make
--   PostgREST report an ambiguous call. The old arities are dropped below.
-- Date: 2026-09-02
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_sales_quotation_transaction(p_customer_id uuid, p_quotation_date date, p_valid_until date, p_price_list_id uuid, p_terms_conditions text, p_notes text, p_business_unit_id uuid, p_items jsonb, p_date_received date DEFAULT NULL::date, p_due_date date DEFAULT NULL::date, p_items_received text DEFAULT NULL::text, p_payment_terms text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_quotation_id UUID;
  v_quotation_item_id UUID;
  v_subtotal NUMERIC := 0;
  v_discount_amount NUMERIC := 0;
  v_tax_amount NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_component_discount_amount NUMERIC := 0;
  v_item JSONB;
  v_ordinality INTEGER;
  v_calculated RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.users
  WHERE id = v_user_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User company not found';
  END IF;

  IF p_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Quotation must have at least one item';
  END IF;

  INSERT INTO public.sales_quotations (
    company_id, business_unit_id, quotation_date, customer_id, valid_until, price_list_id,
    date_received, due_date, items_received, payment_terms,
    subtotal, discount_amount, tax_amount, total_amount, status, notes, terms_conditions,
    created_by, updated_by
  )
  VALUES (
    v_company_id, p_business_unit_id, p_quotation_date, p_customer_id, p_valid_until, p_price_list_id,
    -- Older callers send neither; fall back to the commercial dates rather
    -- than rejecting a quote they have no way to supply these for.
    COALESCE(p_date_received, p_quotation_date),
    COALESCE(p_due_date, p_valid_until, p_quotation_date + INTERVAL '14 days'),
    NULLIF(btrim(COALESCE(p_items_received, '')), ''),
    -- Older callers send nothing; the column default applies.
    COALESCE(NULLIF(btrim(COALESCE(p_payment_terms, '')), ''), 'cash'),
    0, 0, 0, 0, 'draft', p_notes, p_terms_conditions, v_user_id, v_user_id
  )
  RETURNING id INTO v_quotation_id;

  FOR v_item, v_ordinality IN
    SELECT value, ordinality::INTEGER - 1
    FROM jsonb_array_elements(p_items) WITH ORDINALITY
  LOOP
    v_item := jsonb_set(v_item, '{sortOrder}', to_jsonb(v_ordinality), true);
    SELECT item_id, item_description, quantity, uom_id, rate, discount_percent,
      discount_amount, tax_percent, tax_amount, line_total, sort_order, notes
    INTO v_calculated FROM public.calculate_sales_quotation_item(v_item);

    -- The rate is a rounded display average for configured frames. Reconstruct
    -- the gross amount from the authoritative net snapshot, never quantity * rate.
    v_subtotal := v_subtotal + v_calculated.line_total
      + v_calculated.discount_amount - v_calculated.tax_amount;
    v_discount_amount := v_discount_amount + v_calculated.discount_amount;
    v_tax_amount := v_tax_amount + v_calculated.tax_amount;
    v_total_amount := v_total_amount + v_calculated.line_total;

    INSERT INTO public.sales_quotation_items (
      company_id, quotation_id, item_id, item_description, quantity, uom_id,
      pricing_tier, pricing_tier_name, rate,
      discount_percent, discount_amount, tax_percent, tax_amount, line_total,
      sort_order, notes, created_by, updated_by
    )
    VALUES (
      v_company_id, v_quotation_id, v_calculated.item_id, v_calculated.item_description,
      v_calculated.quantity, v_calculated.uom_id,
      NULLIF(v_item ->> 'pricingTier', ''), NULLIF(v_item ->> 'pricingTierName', ''),
      v_calculated.rate,
      v_calculated.discount_percent, v_calculated.discount_amount, v_calculated.tax_percent,
      v_calculated.tax_amount, v_calculated.line_total, v_calculated.sort_order,
      v_calculated.notes, v_user_id, v_user_id
    )
    RETURNING id INTO v_quotation_item_id;

    PERFORM public.save_sales_quotation_item_frame_details(
      v_company_id,
      v_quotation_item_id,
      v_item,
      v_user_id
    );
  END LOOP;

  -- Component snapshots are already net of their own discounts. Expose those
  -- deductions in the header only; parent-line fixed discounts and net totals
  -- remain independent for subsequent sales-order allocation.
  SELECT COALESCE(SUM(component.discount_amount), 0)
  INTO v_component_discount_amount
  FROM public.sales_quotation_item_components component
  JOIN public.sales_quotation_items item ON item.id = component.quotation_item_id
  WHERE item.quotation_id = v_quotation_id
    AND item.deleted_at IS NULL
    AND component.deleted_at IS NULL;

  UPDATE public.sales_quotations
  SET
    subtotal = v_subtotal + v_component_discount_amount,
    discount_amount = v_discount_amount + v_component_discount_amount,
    tax_amount = v_tax_amount,
    total_amount = v_total_amount,
    updated_by = v_user_id
  WHERE id = v_quotation_id;

  RETURN v_quotation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_sales_quotation_transaction(p_quotation_id uuid, p_quotation_date date, p_valid_until date, p_terms_conditions text, p_notes text, p_items jsonb, p_date_received date DEFAULT NULL::date, p_due_date date DEFAULT NULL::date, p_items_received text DEFAULT NULL::text, p_payment_terms text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing RECORD;
  v_item JSONB;
  v_ordinality INTEGER;
  v_calculated RECORD;
  v_quotation_item_id UUID;
  v_subtotal NUMERIC := 0;
  v_discount_amount NUMERIC := 0;
  v_tax_amount NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_component_discount_amount NUMERIC := 0;
  v_deleted_at TIMESTAMPTZ := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id, company_id, status
  INTO v_existing
  FROM public.sales_quotations
  WHERE id = p_quotation_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'Quotation not found';
  END IF;

  IF v_existing.status IS NULL OR v_existing.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'QUOTATION_NOT_EDITABLE';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Quotation must have at least one item';
  END IF;

  UPDATE public.sales_quotation_item_components c
  SET deleted_at = v_deleted_at, updated_by = v_user_id
  FROM public.sales_quotation_items qi
  WHERE c.quotation_item_id = qi.id
    AND qi.quotation_id = p_quotation_id
    AND c.deleted_at IS NULL;

  UPDATE public.sales_quotation_item_configurations cfg
  SET deleted_at = v_deleted_at, updated_by = v_user_id
  FROM public.sales_quotation_items qi
  WHERE cfg.quotation_item_id = qi.id
    AND qi.quotation_id = p_quotation_id
    AND cfg.deleted_at IS NULL;

  UPDATE public.sales_quotation_items
  SET deleted_at = v_deleted_at, updated_by = v_user_id
  WHERE quotation_id = p_quotation_id
    AND deleted_at IS NULL;

  FOR v_item, v_ordinality IN
    SELECT value, ordinality::INTEGER - 1
    FROM jsonb_array_elements(p_items) WITH ORDINALITY
  LOOP
    v_item := jsonb_set(v_item, '{sortOrder}', to_jsonb(v_ordinality), true);
    SELECT item_id, item_description, quantity, uom_id, rate, discount_percent,
      discount_amount, tax_percent, tax_amount, line_total, sort_order, notes
    INTO v_calculated FROM public.calculate_sales_quotation_item(v_item);

    v_subtotal := v_subtotal + v_calculated.line_total
      + v_calculated.discount_amount - v_calculated.tax_amount;
    v_discount_amount := v_discount_amount + v_calculated.discount_amount;
    v_tax_amount := v_tax_amount + v_calculated.tax_amount;
    v_total_amount := v_total_amount + v_calculated.line_total;

    INSERT INTO public.sales_quotation_items (
      company_id, quotation_id, item_id, item_description, quantity, uom_id,
      pricing_tier, pricing_tier_name, rate,
      discount_percent, discount_amount, tax_percent, tax_amount, line_total,
      sort_order, notes, created_by, updated_by
    )
    VALUES (
      v_existing.company_id, p_quotation_id, v_calculated.item_id, v_calculated.item_description,
      v_calculated.quantity, v_calculated.uom_id,
      NULLIF(v_item ->> 'pricingTier', ''), NULLIF(v_item ->> 'pricingTierName', ''),
      v_calculated.rate,
      v_calculated.discount_percent, v_calculated.discount_amount, v_calculated.tax_percent,
      v_calculated.tax_amount, v_calculated.line_total, v_calculated.sort_order,
      v_calculated.notes, v_user_id, v_user_id
    )
    RETURNING id INTO v_quotation_item_id;

    PERFORM public.save_sales_quotation_item_frame_details(
      v_existing.company_id,
      v_quotation_item_id,
      v_item,
      v_user_id
    );
  END LOOP;

  -- Scope once to the replacement's active rows so soft-deleted versions cannot
  -- add their discounts again on repeated saves.
  SELECT COALESCE(SUM(component.discount_amount), 0)
  INTO v_component_discount_amount
  FROM public.sales_quotation_item_components component
  JOIN public.sales_quotation_items item ON item.id = component.quotation_item_id
  WHERE item.quotation_id = p_quotation_id
    AND item.deleted_at IS NULL
    AND component.deleted_at IS NULL;

  UPDATE public.sales_quotations
  SET
    quotation_date = p_quotation_date,
    valid_until = p_valid_until,
    -- NULL means "not sent by this caller", so keep what is stored.
    date_received = COALESCE(p_date_received, date_received),
    due_date = COALESCE(p_due_date, due_date),
    -- NULL means "not sent by this caller"; a blank string means "cleared".
    -- NULL means "not sent by this caller"; keep what is stored.
    payment_terms = COALESCE(NULLIF(btrim(COALESCE(p_payment_terms, '')), ''), payment_terms),
    items_received = CASE WHEN p_items_received IS NULL THEN items_received
                          ELSE NULLIF(btrim(p_items_received), '') END,
    terms_conditions = p_terms_conditions,
    notes = p_notes,
    subtotal = v_subtotal + v_component_discount_amount,
    discount_amount = v_discount_amount + v_component_discount_amount,
    tax_amount = v_tax_amount,
    total_amount = v_total_amount,
    -- Editing invalidates the previously sent version. The revised quotation
    -- must be sent again before it can be accepted.
    status = 'draft',
    updated_by = v_user_id
  WHERE id = p_quotation_id;

  RETURN p_quotation_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.create_sales_quotation_transaction(
  uuid, date, date, uuid, text, text, uuid, jsonb, date, date, text
);
DROP FUNCTION IF EXISTS public.update_sales_quotation_transaction(
  uuid, date, date, text, text, jsonb, date, date, text
);

COMMIT;
