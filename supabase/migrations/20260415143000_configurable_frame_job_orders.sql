-- ============================================================================
-- Migration: Configurable frame quotation job orders
-- Description:
--   - Stores configurable frame quotation details and material breakdowns.
--   - Confirms quotations into frame job orders, inventory reservations, and draft invoices.
--   - Completes frame job orders by consuming reserved inventory.
-- Date: 2026-04-15
-- ============================================================================

ALTER TABLE public.sales_quotations
  ADD COLUMN IF NOT EXISTS frame_job_order_id UUID,
  ADD COLUMN IF NOT EXISTS draft_invoice_id UUID;

CREATE TABLE IF NOT EXISTS public.sales_quotation_item_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  quotation_item_id UUID NOT NULL REFERENCES public.sales_quotation_items(id) ON DELETE CASCADE,
  width NUMERIC(20, 4) NOT NULL,
  height NUMERIC(20, 4) NOT NULL,
  fixed_allowance NUMERIC(20, 4) NOT NULL DEFAULT 0,
  molding_item_id UUID REFERENCES public.items(id),
  molding_stick_length NUMERIC(20, 4),
  molding_sticks_required NUMERIC(20, 4),
  service_fee_mode TEXT NOT NULL DEFAULT 'per_frame',
  service_type TEXT,
  service_fee_amount NUMERIC(20, 4) NOT NULL DEFAULT 0,
  total_service_fee NUMERIC(20, 4) NOT NULL DEFAULT 0,
  invoice_display_mode TEXT NOT NULL DEFAULT 'summary',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMP NULL,
  CONSTRAINT chk_frame_config_dimensions CHECK (width > 0 AND height > 0),
  CONSTRAINT chk_frame_config_service_fee_mode CHECK (service_fee_mode IN ('per_frame', 'per_order', 'size_based', 'service_type', 'manual')),
  CONSTRAINT chk_frame_config_invoice_display CHECK (invoice_display_mode IN ('summary', 'components', 'both')),
  UNIQUE (quotation_item_id)
);

CREATE TABLE IF NOT EXISTS public.sales_quotation_item_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  quotation_item_id UUID NOT NULL REFERENCES public.sales_quotation_items(id) ON DELETE CASCADE,
  configuration_id UUID REFERENCES public.sales_quotation_item_configurations(id) ON DELETE CASCADE,
  component_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  item_id UUID NOT NULL REFERENCES public.items(id),
  description TEXT,
  qty_per_frame NUMERIC(20, 4) NOT NULL DEFAULT 0,
  total_quantity NUMERIC(20, 4) NOT NULL,
  uom_id UUID NOT NULL REFERENCES public.units_of_measure(id),
  unit_rate NUMERIC(20, 4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(20, 4) NOT NULL DEFAULT 0,
  rounding_mode TEXT NOT NULL DEFAULT 'none',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMP NULL,
  CONSTRAINT chk_frame_component_type CHECK (component_type IN ('molding', 'material', 'accessory')),
  CONSTRAINT chk_frame_component_source CHECK (source IN ('auto', 'manual')),
  CONSTRAINT chk_frame_component_qty CHECK (total_quantity > 0),
  CONSTRAINT chk_frame_component_rounding CHECK (rounding_mode IN ('none', 'ceil_per_order'))
);

CREATE TABLE IF NOT EXISTS public.sales_order_item_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  order_item_id UUID NOT NULL REFERENCES public.sales_order_items(id) ON DELETE CASCADE,
  quotation_configuration_id UUID REFERENCES public.sales_quotation_item_configurations(id),
  width NUMERIC(20, 4) NOT NULL,
  height NUMERIC(20, 4) NOT NULL,
  fixed_allowance NUMERIC(20, 4) NOT NULL DEFAULT 0,
  molding_item_id UUID REFERENCES public.items(id),
  molding_stick_length NUMERIC(20, 4),
  molding_sticks_required NUMERIC(20, 4),
  service_fee_mode TEXT NOT NULL DEFAULT 'per_frame',
  service_type TEXT,
  service_fee_amount NUMERIC(20, 4) NOT NULL DEFAULT 0,
  total_service_fee NUMERIC(20, 4) NOT NULL DEFAULT 0,
  invoice_display_mode TEXT NOT NULL DEFAULT 'summary',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMP NULL,
  CONSTRAINT chk_sales_order_frame_config_dimensions CHECK (width > 0 AND height > 0),
  CONSTRAINT chk_sales_order_frame_config_service_fee_mode CHECK (service_fee_mode IN ('per_frame', 'per_order', 'size_based', 'service_type', 'manual')),
  CONSTRAINT chk_sales_order_frame_config_invoice_display CHECK (invoice_display_mode IN ('summary', 'components', 'both')),
  UNIQUE (order_item_id)
);

CREATE TABLE IF NOT EXISTS public.sales_order_item_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  order_item_id UUID NOT NULL REFERENCES public.sales_order_items(id) ON DELETE CASCADE,
  configuration_id UUID REFERENCES public.sales_order_item_configurations(id) ON DELETE CASCADE,
  quotation_component_id UUID REFERENCES public.sales_quotation_item_components(id),
  component_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  item_id UUID NOT NULL REFERENCES public.items(id),
  description TEXT,
  qty_per_frame NUMERIC(20, 4) NOT NULL DEFAULT 0,
  total_quantity NUMERIC(20, 4) NOT NULL,
  uom_id UUID NOT NULL REFERENCES public.units_of_measure(id),
  unit_rate NUMERIC(20, 4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(20, 4) NOT NULL DEFAULT 0,
  rounding_mode TEXT NOT NULL DEFAULT 'none',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMP NULL,
  CONSTRAINT chk_sales_order_frame_component_type CHECK (component_type IN ('molding', 'material', 'accessory')),
  CONSTRAINT chk_sales_order_frame_component_source CHECK (source IN ('auto', 'manual')),
  CONSTRAINT chk_sales_order_frame_component_qty CHECK (total_quantity > 0),
  CONSTRAINT chk_sales_order_frame_component_rounding CHECK (rounding_mode IN ('none', 'ceil_per_order'))
);

CREATE TABLE IF NOT EXISTS public.frame_job_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_unit_id UUID REFERENCES public.business_units(id),
  job_order_code VARCHAR(100) NOT NULL,
  quotation_id UUID REFERENCES public.sales_quotations(id),
  sales_order_id UUID REFERENCES public.sales_orders(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  sales_invoice_id UUID REFERENCES public.sales_invoices(id),
  status TEXT NOT NULL DEFAULT 'draft',
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMP NULL,
  custom_fields JSONB,
  CONSTRAINT chk_frame_job_order_status CHECK (status IN ('draft', 'reserved', 'in_progress', 'completed', 'cancelled')),
  UNIQUE (company_id, job_order_code),
  UNIQUE (quotation_id)
);

CREATE TABLE IF NOT EXISTS public.frame_job_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  job_order_id UUID NOT NULL REFERENCES public.frame_job_orders(id) ON DELETE CASCADE,
  quotation_item_id UUID REFERENCES public.sales_quotation_items(id),
  quotation_component_id UUID REFERENCES public.sales_quotation_item_components(id),
  sales_order_item_id UUID REFERENCES public.sales_order_items(id),
  sales_order_component_id UUID REFERENCES public.sales_order_item_components(id),
  item_id UUID NOT NULL REFERENCES public.items(id),
  item_description TEXT,
  required_quantity NUMERIC(20, 4) NOT NULL,
  issued_quantity NUMERIC(20, 4) NOT NULL DEFAULT 0,
  uom_id UUID NOT NULL REFERENCES public.units_of_measure(id),
  unit_rate NUMERIC(20, 4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(20, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMP NULL,
  CONSTRAINT chk_frame_job_item_qty CHECK (required_quantity > 0)
);

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  reservation_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  quotation_id UUID REFERENCES public.sales_quotations(id),
  quotation_item_id UUID REFERENCES public.sales_quotation_items(id),
  quotation_component_id UUID REFERENCES public.sales_quotation_item_components(id),
  sales_order_id UUID REFERENCES public.sales_orders(id),
  sales_order_item_id UUID REFERENCES public.sales_order_items(id),
  sales_order_component_id UUID REFERENCES public.sales_order_item_components(id),
  job_order_id UUID REFERENCES public.frame_job_orders(id),
  item_id UUID NOT NULL REFERENCES public.items(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  quantity NUMERIC(20, 4) NOT NULL,
  uom_id UUID NOT NULL REFERENCES public.units_of_measure(id),
  status TEXT NOT NULL DEFAULT 'active',
  reserved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at TIMESTAMP NULL,
  released_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMP NULL,
  CONSTRAINT chk_inventory_reservation_type CHECK (reservation_type IN ('frame_job_order')),
  CONSTRAINT chk_inventory_reservation_status CHECK (status IN ('active', 'consumed', 'released')),
  CONSTRAINT chk_inventory_reservation_qty CHECK (quantity > 0)
);

DO $$
BEGIN
  ALTER TABLE public.frame_job_orders
    ALTER COLUMN quotation_id DROP NOT NULL;

  ALTER TABLE public.frame_job_orders
    ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES public.sales_orders(id);

  ALTER TABLE public.frame_job_order_items
    ADD COLUMN IF NOT EXISTS sales_order_item_id UUID REFERENCES public.sales_order_items(id),
    ADD COLUMN IF NOT EXISTS sales_order_component_id UUID REFERENCES public.sales_order_item_components(id);

  ALTER TABLE public.inventory_reservations
    ADD COLUMN IF NOT EXISTS sales_order_id UUID REFERENCES public.sales_orders(id),
    ADD COLUMN IF NOT EXISTS sales_order_item_id UUID REFERENCES public.sales_order_items(id),
    ADD COLUMN IF NOT EXISTS sales_order_component_id UUID REFERENCES public.sales_order_item_components(id);

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_quotations_frame_job_order_id_fkey'
  ) THEN
    ALTER TABLE public.sales_quotations
      ADD CONSTRAINT sales_quotations_frame_job_order_id_fkey
      FOREIGN KEY (frame_job_order_id) REFERENCES public.frame_job_orders(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sales_quotations_draft_invoice_id_fkey'
  ) THEN
    ALTER TABLE public.sales_quotations
      ADD CONSTRAINT sales_quotations_draft_invoice_id_fkey
      FOREIGN KEY (draft_invoice_id) REFERENCES public.sales_invoices(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sq_item_configs_company ON public.sales_quotation_item_configurations(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sq_item_configs_item ON public.sales_quotation_item_configurations(quotation_item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sq_item_components_company ON public.sales_quotation_item_components(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sq_item_components_item ON public.sales_quotation_item_components(quotation_item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_so_item_configs_company ON public.sales_order_item_configurations(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_so_item_configs_item ON public.sales_order_item_configurations(order_item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_so_item_components_company ON public.sales_order_item_components(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_so_item_components_item ON public.sales_order_item_components(order_item_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_frame_job_orders_company ON public.frame_job_orders(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_frame_job_orders_quotation ON public.frame_job_orders(quotation_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_frame_job_orders_sales_order ON public.frame_job_orders(sales_order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_frame_job_orders_status ON public.frame_job_orders(status) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_frame_job_orders_active_sales_order
  ON public.frame_job_orders(sales_order_id)
  WHERE sales_order_id IS NOT NULL
    AND status <> 'cancelled'
    AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_frame_job_order_items_job ON public.frame_job_order_items(job_order_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_source ON public.inventory_reservations(source_type, source_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_reservations_item ON public.inventory_reservations(item_id, warehouse_id, status) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS update_sales_quotation_item_configurations_updated_at ON public.sales_quotation_item_configurations;
CREATE TRIGGER update_sales_quotation_item_configurations_updated_at
  BEFORE UPDATE ON public.sales_quotation_item_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_quotation_item_components_updated_at ON public.sales_quotation_item_components;
CREATE TRIGGER update_sales_quotation_item_components_updated_at
  BEFORE UPDATE ON public.sales_quotation_item_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_order_item_configurations_updated_at ON public.sales_order_item_configurations;
CREATE TRIGGER update_sales_order_item_configurations_updated_at
  BEFORE UPDATE ON public.sales_order_item_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_order_item_components_updated_at ON public.sales_order_item_components;
CREATE TRIGGER update_sales_order_item_components_updated_at
  BEFORE UPDATE ON public.sales_order_item_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_frame_job_orders_updated_at ON public.frame_job_orders;
CREATE TRIGGER update_frame_job_orders_updated_at
  BEFORE UPDATE ON public.frame_job_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_frame_job_order_items_updated_at ON public.frame_job_order_items;
CREATE TRIGGER update_frame_job_order_items_updated_at
  BEFORE UPDATE ON public.frame_job_order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_reservations_updated_at ON public.inventory_reservations;
CREATE TRIGGER update_inventory_reservations_updated_at
  BEFORE UPDATE ON public.inventory_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_generate_frame_job_order_code ON public.frame_job_orders;
CREATE TRIGGER trigger_generate_frame_job_order_code
  BEFORE INSERT ON public.frame_job_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('job_order_code', 'FJO', '9');

ALTER TABLE public.sales_quotation_item_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotation_item_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_item_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_item_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frame_job_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frame_job_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sq_item_configs_company_all ON public.sales_quotation_item_configurations;
CREATE POLICY sq_item_configs_company_all ON public.sales_quotation_item_configurations
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS sq_item_components_company_all ON public.sales_quotation_item_components;
CREATE POLICY sq_item_components_company_all ON public.sales_quotation_item_components
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS so_item_configs_company_all ON public.sales_order_item_configurations;
CREATE POLICY so_item_configs_company_all ON public.sales_order_item_configurations
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS so_item_components_company_all ON public.sales_order_item_components;
CREATE POLICY so_item_components_company_all ON public.sales_order_item_components
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS frame_job_orders_company_all ON public.frame_job_orders;
CREATE POLICY frame_job_orders_company_all ON public.frame_job_orders
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS frame_job_order_items_company_all ON public.frame_job_order_items;
CREATE POLICY frame_job_order_items_company_all ON public.frame_job_order_items
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS inventory_reservations_company_all ON public.inventory_reservations;
CREATE POLICY inventory_reservations_company_all ON public.inventory_reservations
  FOR ALL
  USING (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION public.save_sales_quotation_item_frame_details(
  p_company_id UUID,
  p_quotation_item_id UUID,
  p_item JSONB,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_config JSONB := p_item -> 'frameConfiguration';
  v_component JSONB;
  v_config_id UUID;
  v_component_type TEXT;
BEGIN
  IF v_config IS NULL OR v_config = 'null'::JSONB THEN
    RETURN;
  END IF;

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
    COALESCE(NULLIF(v_config ->> 'invoiceDisplayMode', ''), 'summary'),
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_config_id;

  IF p_item -> 'frameComponents' IS NULL OR jsonb_typeof(p_item -> 'frameComponents') <> 'array' THEN
    RETURN;
  END IF;

  FOR v_component IN SELECT value FROM jsonb_array_elements(p_item -> 'frameComponents')
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
      COALESCE(NULLIF(v_component ->> 'totalAmount', '')::NUMERIC, 0),
      COALESCE(NULLIF(v_component ->> 'roundingMode', ''), 'none'),
      COALESCE(NULLIF(v_component ->> 'sortOrder', '')::INTEGER, 0),
      p_user_id,
      p_user_id
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_sales_quotation_transaction(
  p_customer_id UUID,
  p_quotation_date DATE,
  p_valid_until DATE,
  p_price_list_id UUID,
  p_terms_conditions TEXT,
  p_notes TEXT,
  p_business_unit_id UUID,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_quotation_id UUID;
  v_quotation_item_id UUID;
  v_subtotal NUMERIC := 0;
  v_discount_amount NUMERIC := 0;
  v_tax_amount NUMERIC := 0;
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
    subtotal, discount_amount, tax_amount, total_amount, status, notes, terms_conditions,
    created_by, updated_by
  )
  VALUES (
    v_company_id, p_business_unit_id, p_quotation_date, p_customer_id, p_valid_until, p_price_list_id,
    0, 0, 0, 0, 'draft', p_notes, p_terms_conditions, v_user_id, v_user_id
  )
  RETURNING id INTO v_quotation_id;

  FOR v_item, v_ordinality IN
    SELECT value, ordinality::INTEGER - 1
    FROM jsonb_array_elements(p_items) WITH ORDINALITY
  LOOP
    v_item := jsonb_set(v_item, '{sortOrder}', to_jsonb(v_ordinality), true);
    SELECT * INTO v_calculated FROM public.calculate_sales_quotation_item(v_item);

    v_subtotal := v_subtotal + (v_calculated.quantity * v_calculated.rate);
    v_discount_amount := v_discount_amount + v_calculated.discount_amount;
    v_tax_amount := v_tax_amount + v_calculated.tax_amount;

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

  UPDATE public.sales_quotations
  SET
    subtotal = v_subtotal,
    discount_amount = v_discount_amount,
    tax_amount = v_tax_amount,
    total_amount = v_subtotal - v_discount_amount + v_tax_amount,
    updated_by = v_user_id
  WHERE id = v_quotation_id;

  RETURN v_quotation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_sales_quotation_transaction(
  p_quotation_id UUID,
  p_quotation_date DATE,
  p_valid_until DATE,
  p_terms_conditions TEXT,
  p_notes TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
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
  v_deleted_at TIMESTAMPTZ := timezone('utc', now());
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

  IF v_existing.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft quotations can be edited';
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
    SELECT * INTO v_calculated FROM public.calculate_sales_quotation_item(v_item);

    v_subtotal := v_subtotal + (v_calculated.quantity * v_calculated.rate);
    v_discount_amount := v_discount_amount + v_calculated.discount_amount;
    v_tax_amount := v_tax_amount + v_calculated.tax_amount;

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

  UPDATE public.sales_quotations
  SET
    quotation_date = p_quotation_date,
    valid_until = p_valid_until,
    terms_conditions = p_terms_conditions,
    notes = p_notes,
    subtotal = v_subtotal,
    discount_amount = v_discount_amount,
    tax_amount = v_tax_amount,
    total_amount = v_subtotal - v_discount_amount + v_tax_amount,
    updated_by = v_user_id
  WHERE id = p_quotation_id;

  RETURN p_quotation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_sales_quotation_transaction(
  p_quotation_id UUID,
  p_business_unit_id UUID,
  p_warehouse_id UUID
)
RETURNS TABLE (
  quotation_id UUID,
  frame_job_order_id UUID,
  job_order_code TEXT,
  draft_invoice_id UUID,
  invoice_code TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_quotation RECORD;
  v_has_frame_items BOOLEAN;
  v_job_order_id UUID;
  v_job_order_code TEXT;
  v_invoice_id UUID;
  v_invoice_code TEXT;
  v_component RECORD;
  v_stock RECORD;
  v_available NUMERIC;
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

  IF v_quotation.status NOT IN ('draft', 'sent', 'accepted') THEN
    RAISE EXCEPTION 'Only draft, sent, or accepted quotations can be confirmed';
  END IF;

  IF v_quotation.draft_invoice_id IS NOT NULL THEN
    RAISE EXCEPTION 'This quotation has already been confirmed';
  END IF;

  -- Frame quotations are priced here, but operational job orders are created
  -- explicitly from the resulting sales order.
  v_has_frame_items := FALSE;

  IF v_has_frame_items AND p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Warehouse is required to reserve frame materials';
  END IF;

  IF v_has_frame_items THEN
    INSERT INTO public.frame_job_orders (
      company_id,
      business_unit_id,
      quotation_id,
      customer_id,
      status,
      order_date,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      v_quotation.company_id,
      p_business_unit_id,
      p_quotation_id,
      v_quotation.customer_id,
      'reserved',
      CURRENT_DATE,
      v_quotation.notes,
      v_user_id,
      v_user_id
    )
    RETURNING id, frame_job_orders.job_order_code INTO v_job_order_id, v_job_order_code;

    FOR v_component IN
      SELECT c.*
      FROM public.sales_quotation_item_components c
      JOIN public.sales_quotation_items qi ON qi.id = c.quotation_item_id
      WHERE qi.quotation_id = p_quotation_id
        AND qi.deleted_at IS NULL
        AND c.deleted_at IS NULL
      ORDER BY qi.sort_order ASC NULLS LAST, c.sort_order ASC
    LOOP
      SELECT *
      INTO v_stock
      FROM public.item_warehouse
      WHERE company_id = v_quotation.company_id
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
        quotation_item_id,
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
        v_quotation.company_id,
        v_job_order_id,
        v_component.quotation_item_id,
        v_component.id,
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
        quotation_item_id,
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
        v_quotation.company_id,
        'frame_job_order',
        'sales_quotation',
        p_quotation_id,
        p_quotation_id,
        v_component.quotation_item_id,
        v_component.id,
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
      SET
        reserved_stock = COALESCE(reserved_stock, 0) + v_component.total_quantity,
        updated_by = v_user_id
      WHERE id = v_stock.id;
    END LOOP;
  END IF;

  INSERT INTO public.sales_invoices (
    company_id,
    business_unit_id,
    customer_id,
    invoice_date,
    due_date,
    status,
    subtotal,
    discount_amount,
    tax_amount,
    total_amount,
    amount_due,
    warehouse_id,
    payment_terms,
    notes,
    custom_fields,
    created_by,
    updated_by
  )
  VALUES (
    v_quotation.company_id,
    p_business_unit_id,
    v_quotation.customer_id,
    CURRENT_DATE,
    CURRENT_DATE + 30,
    'draft',
    v_quotation.subtotal,
    v_quotation.discount_amount,
    v_quotation.tax_amount,
    v_quotation.total_amount,
    v_quotation.total_amount,
    p_warehouse_id,
    v_quotation.terms_conditions,
    v_quotation.notes,
    jsonb_build_object(
      'source', 'sales_quotation_confirmation',
      'quotationId', p_quotation_id,
      'frameJobOrderId', v_job_order_id
    ),
    v_user_id,
    v_user_id
  )
  RETURNING id, sales_invoices.invoice_code INTO v_invoice_id, v_invoice_code;

  INSERT INTO public.sales_invoice_items (
    company_id,
    invoice_id,
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
    sort_order,
    created_by,
    updated_by
  )
  SELECT
    qi.company_id,
    v_invoice_id,
    qi.item_id,
    qi.item_description,
    qi.quantity,
    qi.uom_id,
    qi.rate,
    COALESCE(qi.discount_percent, 0),
    COALESCE(qi.discount_amount, 0),
    COALESCE(qi.tax_percent, 0),
    COALESCE(qi.tax_amount, 0),
    qi.line_total,
    qi.sort_order,
    v_user_id,
    v_user_id
  FROM public.sales_quotation_items qi
  WHERE qi.quotation_id = p_quotation_id
    AND qi.deleted_at IS NULL
  ORDER BY qi.sort_order ASC NULLS LAST, qi.created_at ASC;

  IF v_job_order_id IS NOT NULL THEN
    UPDATE public.frame_job_orders
    SET
      sales_invoice_id = v_invoice_id,
      updated_by = v_user_id
    WHERE id = v_job_order_id;
  END IF;

  UPDATE public.sales_quotations
  SET
    status = 'accepted',
    frame_job_order_id = v_job_order_id,
    draft_invoice_id = v_invoice_id,
    updated_by = v_user_id
  WHERE id = p_quotation_id;

  quotation_id := p_quotation_id;
  frame_job_order_id := v_job_order_id;
  job_order_code := v_job_order_code;
  draft_invoice_id := v_invoice_id;
  invoice_code := v_invoice_code;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_sales_quotation_to_order_transaction(
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
      updated_by
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
      v_user_id
    )
    RETURNING id INTO v_order_item_id;

    SELECT *
    INTO v_configuration
    FROM public.sales_quotation_item_configurations
    WHERE quotation_item_id = v_quote_item.id
      AND deleted_at IS NULL;

    IF v_configuration.id IS NOT NULL THEN
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

CREATE OR REPLACE FUNCTION public.create_frame_job_order_from_sales_order_transaction(
  p_sales_order_id UUID,
  p_warehouse_id UUID
)
RETURNS TABLE (
  job_order_id UUID,
  job_order_code TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sales_order RECORD;
  v_has_frame_items BOOLEAN;
  v_existing_job RECORD;
  v_job_order_id UUID;
  v_job_order_code TEXT;
  v_component RECORD;
  v_stock RECORD;
  v_available NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Warehouse is required to reserve frame materials';
  END IF;

  SELECT *
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

  SELECT *
  INTO v_existing_job
  FROM public.frame_job_orders
  WHERE sales_order_id = p_sales_order_id
    AND status <> 'cancelled'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing_job.id IS NOT NULL THEN
    RAISE EXCEPTION 'This sales order already has a frame job order';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.sales_order_item_configurations cfg
    JOIN public.sales_order_items soi ON soi.id = cfg.order_item_id
    WHERE soi.order_id = p_sales_order_id
      AND soi.deleted_at IS NULL
      AND cfg.deleted_at IS NULL
  ) INTO v_has_frame_items;

  IF NOT v_has_frame_items THEN
    RAISE EXCEPTION 'Sales order has no frame-configured items';
  END IF;

  INSERT INTO public.frame_job_orders (
    company_id,
    business_unit_id,
    quotation_id,
    sales_order_id,
    customer_id,
    status,
    order_date,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    v_sales_order.company_id,
    v_sales_order.business_unit_id,
    v_sales_order.quotation_id,
    p_sales_order_id,
    v_sales_order.customer_id,
    'reserved',
    CURRENT_DATE,
    v_sales_order.notes,
    v_user_id,
    v_user_id
  )
  RETURNING id, frame_job_orders.job_order_code INTO v_job_order_id, v_job_order_code;

  FOR v_component IN
    SELECT c.*
    FROM public.sales_order_item_components c
    JOIN public.sales_order_items soi ON soi.id = c.order_item_id
    WHERE soi.order_id = p_sales_order_id
      AND soi.deleted_at IS NULL
      AND c.deleted_at IS NULL
    ORDER BY soi.sort_order ASC NULLS LAST, c.sort_order ASC
  LOOP
    SELECT *
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
      v_sales_order.quotation_id,
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
    SET
      reserved_stock = COALESCE(reserved_stock, 0) + v_component.total_quantity,
      updated_by = v_user_id
    WHERE id = v_stock.id;
  END LOOP;

  UPDATE public.sales_orders
  SET
    status = CASE WHEN status = 'confirmed' THEN 'in_progress' ELSE status END,
    updated_by = v_user_id
  WHERE id = p_sales_order_id;

  job_order_id := v_job_order_id;
  job_order_code := v_job_order_code;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_frame_job_order_transaction(
  p_job_order_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_job_order RECORD;
  v_manufacturing_order RECORD;
  v_reservation RECORD;
  v_stock RECORD;
  v_stock_transaction_id UUID;
  v_next_stock NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_job_order
  FROM public.frame_job_orders
  WHERE id = p_job_order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_job_order.id IS NULL THEN
    RAISE EXCEPTION 'Frame job order not found';
  END IF;

  IF v_job_order.status = 'completed' THEN
    RETURN p_job_order_id;
  END IF;

  IF v_job_order.status NOT IN ('reserved', 'in_progress') THEN
    RAISE EXCEPTION 'Only reserved or in-progress frame job orders can be completed';
  END IF;

  SELECT id, manufacturing_order_code, status
  INTO v_manufacturing_order
  FROM public.manufacturing_orders
  WHERE frame_job_order_id = p_job_order_id
    AND deleted_at IS NULL
    AND status <> 'cancelled'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_manufacturing_order.id IS NOT NULL
     AND v_manufacturing_order.status <> 'completed' THEN
    RAISE EXCEPTION 'Production must be completed before the job order can be completed';
  END IF;

  FOR v_reservation IN
    SELECT *
    FROM public.inventory_reservations
    WHERE job_order_id = p_job_order_id
      AND status = 'active'
      AND deleted_at IS NULL
    ORDER BY created_at ASC
  LOOP
    IF v_stock_transaction_id IS NULL THEN
      INSERT INTO public.stock_transactions (
        company_id,
        business_unit_id,
        transaction_date,
        transaction_type,
        reference_type,
        reference_id,
        warehouse_id,
        status,
        notes,
        custom_fields,
        created_by,
        updated_by
      )
      VALUES (
        v_job_order.company_id,
        v_job_order.business_unit_id,
        CURRENT_DATE,
        'out',
        'frame_job_order',
        p_job_order_id,
        v_reservation.warehouse_id,
        'posted',
        'Frame job order material consumption',
        jsonb_build_object('frameJobOrderId', p_job_order_id),
        v_user_id,
        v_user_id
      )
      RETURNING id INTO v_stock_transaction_id;
    END IF;

    SELECT *
    INTO v_stock
    FROM public.item_warehouse
    WHERE company_id = v_job_order.company_id
      AND item_id = v_reservation.item_id
      AND warehouse_id = v_reservation.warehouse_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF v_stock.id IS NULL THEN
      RAISE EXCEPTION 'No stock record exists for a reserved frame component';
    END IF;

    IF COALESCE(v_stock.current_stock, 0) < v_reservation.quantity THEN
      RAISE EXCEPTION 'Insufficient stock to complete frame job order';
    END IF;

    v_next_stock := COALESCE(v_stock.current_stock, 0) - v_reservation.quantity;

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
      notes,
      created_by,
      updated_by
    )
    VALUES (
      v_job_order.company_id,
      v_stock_transaction_id,
      v_reservation.item_id,
      v_reservation.quantity,
      v_reservation.uom_id,
      0,
      0,
      COALESCE(v_stock.current_stock, 0),
      v_next_stock,
      0,
      0,
      0,
      CURRENT_DATE,
      CURRENT_TIME,
      'Consumed by frame job order',
      v_user_id,
      v_user_id
    );

    UPDATE public.item_warehouse
    SET
      current_stock = v_next_stock,
      reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - v_reservation.quantity),
      updated_by = v_user_id
    WHERE id = v_stock.id;

    UPDATE public.inventory_reservations
    SET
      status = 'consumed',
      consumed_at = timezone('utc', now()),
      updated_by = v_user_id
    WHERE id = v_reservation.id;

    UPDATE public.frame_job_order_items
    SET
      issued_quantity = required_quantity,
      updated_by = v_user_id
    WHERE job_order_id = p_job_order_id
      AND (
        (v_reservation.sales_order_component_id IS NOT NULL AND sales_order_component_id = v_reservation.sales_order_component_id)
        OR (v_reservation.sales_order_component_id IS NULL AND quotation_component_id = v_reservation.quotation_component_id)
      )
      AND deleted_at IS NULL;
  END LOOP;

  UPDATE public.frame_job_orders
  SET
    status = 'completed',
    completed_at = timezone('utc', now()),
    updated_by = v_user_id
  WHERE id = p_job_order_id;

  RETURN p_job_order_id;
END;
$$;
