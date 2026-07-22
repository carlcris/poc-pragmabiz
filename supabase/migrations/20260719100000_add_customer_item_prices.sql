BEGIN;

CREATE TABLE public.customer_item_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_unit_id UUID NOT NULL REFERENCES public.business_units(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  price_tier VARCHAR(50) NOT NULL,
  price NUMERIC(20, 2) NOT NULL,
  currency_code VARCHAR(3) NOT NULL DEFAULT 'PHP',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT customer_item_prices_price_non_negative CHECK (price >= 0),
  CONSTRAINT customer_item_prices_currency_code_format
    CHECK (currency_code ~ '^[A-Z]{3}$'),
  CONSTRAINT customer_item_prices_effective_range
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_customer_item_prices_customer_list
  ON public.customer_item_prices(
    company_id,
    business_unit_id,
    customer_id,
    effective_from DESC,
    id
  )
  WHERE deleted_at IS NULL;

CREATE INDEX idx_customer_item_prices_resolution
  ON public.customer_item_prices(
    company_id,
    business_unit_id,
    customer_id,
    item_id,
    price_tier,
    effective_from DESC
  )
  WHERE deleted_at IS NULL AND is_active = TRUE;

CREATE OR REPLACE FUNCTION public.validate_customer_item_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_customer_company_id UUID;
  v_customer_business_unit_id UUID;
  v_item_company_id UUID;
BEGIN
  NEW.price_tier := LOWER(BTRIM(NEW.price_tier));
  NEW.currency_code := UPPER(BTRIM(NEW.currency_code));

  IF TG_OP = 'UPDATE' AND (
    NEW.company_id IS DISTINCT FROM OLD.company_id
    OR NEW.business_unit_id IS DISTINCT FROM OLD.business_unit_id
    OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
    OR NEW.item_id IS DISTINCT FROM OLD.item_id
    OR NEW.price_tier IS DISTINCT FROM OLD.price_tier
  ) THEN
    RAISE EXCEPTION 'Customer price ownership fields are immutable';
  END IF;

  SELECT customer.company_id, customer.business_unit_id
  INTO v_customer_company_id, v_customer_business_unit_id
  FROM public.customers AS customer
  WHERE customer.id = NEW.customer_id
    AND customer.deleted_at IS NULL;

  IF v_customer_company_id IS NULL OR v_customer_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Customer is unavailable for customer-specific pricing';
  END IF;

  IF NEW.company_id <> v_customer_company_id
    OR NEW.business_unit_id <> v_customer_business_unit_id THEN
    RAISE EXCEPTION 'Customer price scope does not match the customer';
  END IF;

  SELECT item.company_id
  INTO v_item_company_id
  FROM public.items AS item
  WHERE item.id = NEW.item_id
    AND item.deleted_at IS NULL;

  IF v_item_company_id IS NULL OR NEW.company_id <> v_item_company_id THEN
    RAISE EXCEPTION 'Customer price scope does not match the item';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.item_prices AS item_price
    WHERE item_price.company_id = NEW.company_id
      AND item_price.item_id = NEW.item_id
      AND item_price.price_tier = NEW.price_tier
      AND item_price.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Customer price tier is not configured for the item';
  END IF;

  IF NEW.deleted_at IS NULL AND NEW.is_active THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        NEW.customer_id::TEXT || ':' || NEW.item_id::TEXT || ':' || NEW.price_tier,
        0
      )
    );

    IF EXISTS (
      SELECT 1
      FROM public.customer_item_prices AS existing
      WHERE existing.company_id = NEW.company_id
        AND existing.business_unit_id = NEW.business_unit_id
        AND existing.customer_id = NEW.customer_id
        AND existing.item_id = NEW.item_id
        AND existing.price_tier = NEW.price_tier
        AND existing.id <> NEW.id
        AND existing.deleted_at IS NULL
        AND existing.is_active = TRUE
        AND daterange(
          existing.effective_from,
          COALESCE(existing.effective_to, 'infinity'::DATE),
          '[]'
        ) && daterange(
          NEW.effective_from,
          COALESCE(NEW.effective_to, 'infinity'::DATE),
          '[]'
        )
    ) THEN
      RAISE EXCEPTION 'Customer price effective period overlaps an active price';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_validate_customer_item_price
  BEFORE INSERT OR UPDATE ON public.customer_item_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_customer_item_price();

CREATE TRIGGER trigger_customer_item_prices_updated_at
  BEFORE UPDATE ON public.customer_item_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.customer_item_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_item_prices_select_policy
  ON public.customer_item_prices
  FOR SELECT
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND business_unit_id = public.get_current_business_unit_id()
    AND deleted_at IS NULL
  );

CREATE POLICY customer_item_prices_insert_policy
  ON public.customer_item_prices
  FOR INSERT
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND business_unit_id = public.get_current_business_unit_id()
  );

CREATE POLICY customer_item_prices_update_policy
  ON public.customer_item_prices
  FOR UPDATE
  USING (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND business_unit_id = public.get_current_business_unit_id()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND business_unit_id = public.get_current_business_unit_id()
  );

COMMENT ON TABLE public.customer_item_prices IS
  'Customer-specific selling-price overrides for an existing item price tier.';
COMMENT ON COLUMN public.customer_item_prices.price_tier IS
  'Existing item price tier code overridden for this customer.';
COMMENT ON COLUMN public.customer_item_prices.price IS
  'Customer-specific unit price used before falling back to the standard item-tier price.';

WITH granular_permissions AS (
  SELECT *
  FROM (
    VALUES
      (
        'customers.tab.special_prices.view',
        'customers',
        'tab',
        'special_prices',
        'view',
        'View Customer Special Prices',
        'Customer Pricing',
        'Allows viewing customer-specific item-tier prices.'
      ),
      (
        'customers.operation.special_prices.edit',
        'customers',
        'operation',
        'special_prices',
        'edit',
        'Manage Customer Special Prices',
        'Customer Pricing',
        'Allows creating, editing, and deactivating customer-specific item-tier prices.'
      )
  ) AS capability(
    resource,
    parent_resource,
    surface,
    capability_key,
    capability_action,
    label,
    permission_group,
    description
  )
)
INSERT INTO public.permissions (
  resource,
  parent_resource,
  surface,
  capability_key,
  capability_action,
  label,
  permission_group,
  description,
  is_granular,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  resource,
  parent_resource,
  surface,
  capability_key,
  capability_action,
  label,
  permission_group,
  description,
  TRUE,
  capability_action = 'view',
  FALSE,
  capability_action = 'edit',
  FALSE
FROM granular_permissions
ON CONFLICT (resource) DO UPDATE
SET
  parent_resource = EXCLUDED.parent_resource,
  surface = EXCLUDED.surface,
  capability_key = EXCLUDED.capability_key,
  capability_action = EXCLUDED.capability_action,
  label = EXCLUDED.label,
  permission_group = EXCLUDED.permission_group,
  description = EXCLUDED.description,
  is_granular = TRUE,
  can_view = EXCLUDED.can_view,
  can_create = FALSE,
  can_edit = EXCLUDED.can_edit,
  can_delete = FALSE,
  updated_at = NOW();

INSERT INTO public.role_permissions (
  role_id,
  permission_id,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  role.id,
  permission.id,
  permission.can_view,
  FALSE,
  permission.can_edit,
  FALSE
FROM public.roles AS role
CROSS JOIN public.permissions AS permission
WHERE role.deleted_at IS NULL
  AND LOWER(role.name) IN ('super admin', 'admin')
  AND permission.resource IN (
    'customers.tab.special_prices.view',
    'customers.operation.special_prices.edit'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = EXCLUDED.can_view,
  can_create = FALSE,
  can_edit = EXCLUDED.can_edit,
  can_delete = FALSE;

WITH quotation_price_tier_candidates AS (
  SELECT
    quotation_item.id AS quotation_item_id,
    MIN(customer_price.price_tier) AS pricing_tier,
    MIN(item_price.price_tier_name) AS pricing_tier_name
  FROM public.sales_quotation_items AS quotation_item
  JOIN public.sales_quotations AS quotation
    ON quotation.id = quotation_item.quotation_id
  JOIN public.customer_item_prices AS customer_price
    ON customer_price.company_id = quotation.company_id
    AND customer_price.business_unit_id = quotation.business_unit_id
    AND customer_price.customer_id = quotation.customer_id
    AND customer_price.item_id = quotation_item.item_id
    AND customer_price.price = quotation_item.rate
    AND customer_price.is_active = TRUE
    AND customer_price.deleted_at IS NULL
    AND customer_price.effective_from <= quotation.quotation_date
    AND (
      customer_price.effective_to IS NULL
      OR customer_price.effective_to >= quotation.quotation_date
    )
  JOIN public.item_prices AS item_price
    ON item_price.company_id = quotation.company_id
    AND item_price.item_id = quotation_item.item_id
    AND item_price.price_tier = customer_price.price_tier
    AND item_price.deleted_at IS NULL
  WHERE quotation.deleted_at IS NULL
    AND quotation_item.deleted_at IS NULL
    AND quotation_item.pricing_tier IS NULL
  GROUP BY quotation_item.id
  HAVING COUNT(*) = 1
)
UPDATE public.sales_quotation_items AS quotation_item
SET
  pricing_tier = candidate.pricing_tier,
  pricing_tier_name = candidate.pricing_tier_name,
  updated_at = CURRENT_TIMESTAMP
FROM quotation_price_tier_candidates AS candidate
WHERE quotation_item.id = candidate.quotation_item_id;

DROP FUNCTION public.get_available_sales_quotation_lines(UUID, TEXT, INTEGER, INTEGER);

CREATE FUNCTION public.get_available_sales_quotation_lines(
  p_customer_id UUID,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  quotation_id UUID,
  quotation_code TEXT,
  quotation_item_id UUID,
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  item_description TEXT,
  quantity NUMERIC,
  ordered_quantity NUMERIC,
  remaining_quantity NUMERIC,
  uom_id UUID,
  uom_code TEXT,
  uom_name TEXT,
  pricing_tier TEXT,
  pricing_tier_name TEXT,
  rate NUMERIC,
  discount_percent NUMERIC,
  tax_percent NUMERIC,
  line_total NUMERIC,
  quotation_date DATE,
  valid_until DATE
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH lines AS (
    SELECT
      quotation.id AS quotation_id,
      quotation.quotation_code,
      quotation_item.id AS quotation_item_id,
      quotation_item.item_id,
      item.item_code,
      item.item_name,
      quotation_item.item_description,
      quotation_item.quantity,
      LEAST(
        quotation_item.quantity,
        COALESCE(quotation_item.fulfilled_qty, 0)
      ) AS ordered_quantity,
      GREATEST(
        quotation_item.quantity - LEAST(
          quotation_item.quantity,
          COALESCE(quotation_item.fulfilled_qty, 0)
        ),
        0
      ) AS remaining_quantity,
      quotation_item.uom_id,
      unit.code AS uom_code,
      unit.name AS uom_name,
      quotation_item.pricing_tier,
      quotation_item.pricing_tier_name,
      quotation_item.rate,
      COALESCE(quotation_item.discount_percent, 0) AS discount_percent,
      COALESCE(quotation_item.tax_percent, 0) AS tax_percent,
      quotation_item.line_total,
      quotation.quotation_date,
      quotation.valid_until
    FROM public.sales_quotations AS quotation
    JOIN public.sales_quotation_items AS quotation_item
      ON quotation_item.quotation_id = quotation.id
    JOIN public.items AS item
      ON item.id = quotation_item.item_id
    LEFT JOIN public.units_of_measure AS unit
      ON unit.id = quotation_item.uom_id
    WHERE quotation.customer_id = p_customer_id
      AND quotation.status IN ('accepted', 'partially_ordered')
      AND quotation.deleted_at IS NULL
      AND quotation_item.deleted_at IS NULL
      AND (
        NULLIF(BTRIM(COALESCE(p_search, '')), '') IS NULL
        OR quotation.quotation_code ILIKE '%' || BTRIM(p_search) || '%'
        OR item.item_code ILIKE '%' || BTRIM(p_search) || '%'
        OR item.item_name ILIKE '%' || BTRIM(p_search) || '%'
        OR quotation_item.item_description ILIKE '%' || BTRIM(p_search) || '%'
      )
  )
  SELECT
    lines.quotation_id,
    lines.quotation_code,
    lines.quotation_item_id,
    lines.item_id,
    lines.item_code,
    lines.item_name,
    lines.item_description,
    lines.quantity,
    lines.ordered_quantity,
    lines.remaining_quantity,
    lines.uom_id,
    lines.uom_code,
    lines.uom_name,
    lines.pricing_tier,
    lines.pricing_tier_name,
    lines.rate,
    lines.discount_percent,
    lines.tax_percent,
    lines.line_total,
    lines.quotation_date,
    lines.valid_until
  FROM lines
  WHERE lines.remaining_quantity > 0
  ORDER BY
    lines.quotation_date DESC,
    lines.quotation_code DESC,
    lines.item_code ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

COMMIT;
