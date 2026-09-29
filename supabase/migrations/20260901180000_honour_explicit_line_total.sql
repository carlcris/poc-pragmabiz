-- ============================================================================
-- Migration: Honour an explicitly supplied line total on quotation items
-- Description:
--   `calculate_sales_quotation_item` derived `line_total` from
--   `quantity × rate`, discarding any total the caller supplied.
--
--   For a plain item that is correct. For a configured frame it is not: the
--   line total is defined as the *sum of its component amounts* (see
--   `priceLine` in src/lib/framing/pricing.ts), each already rounded to the cent
--   because each is a figure printed on the customer's invoice. The line's
--   `rate` is a derived per-frame view of that total — `total ÷ quantity`,
--   rounded — so multiplying it back cannot recover the total. A 5-frame line
--   totalling 1624.79 came back as 1624.80, and the invoice's own rows then did
--   not add up to its total.
--
--   The function already honours an explicit `discountAmount` and `taxAmount`
--   over its own derivation; this extends the same courtesy to `lineTotal`.
--   Callers that omit it are unaffected.
-- Date: 2026-09-01
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.calculate_sales_quotation_item(p_item jsonb)
RETURNS TABLE(
  item_id uuid,
  item_description text,
  quantity numeric,
  uom_id uuid,
  rate numeric,
  discount_percent numeric,
  discount_amount numeric,
  tax_percent numeric,
  tax_amount numeric,
  line_total numeric,
  sort_order integer,
  notes text
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_subtotal NUMERIC;
  v_taxable_amount NUMERIC;
BEGIN
  item_id := NULLIF(p_item ->> 'itemId', '')::UUID;
  item_description := NULLIF(p_item ->> 'description', '');
  quantity := COALESCE(NULLIF(p_item ->> 'quantity', '')::NUMERIC, 0);
  uom_id := NULLIF(p_item ->> 'uomId', '')::UUID;
  rate := COALESCE(NULLIF(p_item ->> 'rate', '')::NUMERIC, 0);
  discount_percent := COALESCE(NULLIF(p_item ->> 'discountPercent', '')::NUMERIC, 0);
  tax_percent := COALESCE(NULLIF(p_item ->> 'taxPercent', '')::NUMERIC, 0);
  sort_order := COALESCE(NULLIF(p_item ->> 'sortOrder', '')::INTEGER, 0);
  notes := NULLIF(p_item ->> 'notes', '');

  IF item_id IS NULL THEN
    RAISE EXCEPTION 'Quotation item is missing itemId';
  END IF;

  IF uom_id IS NULL THEN
    RAISE EXCEPTION 'Quotation item is missing uomId';
  END IF;

  IF quantity <= 0 THEN
    RAISE EXCEPTION 'Quotation item quantity must be greater than zero';
  END IF;

  IF rate < 0 THEN
    RAISE EXCEPTION 'Quotation item rate cannot be negative';
  END IF;

  v_subtotal := quantity * rate;
  discount_amount := COALESCE(
    NULLIF(p_item ->> 'discountAmount', '')::NUMERIC,
    v_subtotal * discount_percent / 100
  );
  v_taxable_amount := v_subtotal - discount_amount;
  tax_amount := COALESCE(
    NULLIF(p_item ->> 'taxAmount', '')::NUMERIC,
    v_taxable_amount * tax_percent / 100
  );

  -- An explicit total wins. A configured frame's total is the sum of its printed
  -- component amounts, which quantity × rate cannot reproduce exactly.
  line_total := COALESCE(
    NULLIF(p_item ->> 'lineTotal', '')::NUMERIC,
    v_taxable_amount + tax_amount
  );

  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.calculate_sales_quotation_item(jsonb) IS
  'Derives a quotation item''s money columns. An explicitly supplied lineTotal, discountAmount or taxAmount overrides the derivation — configured frame lines carry an exact total that quantity × rate cannot reproduce.';

COMMIT;
