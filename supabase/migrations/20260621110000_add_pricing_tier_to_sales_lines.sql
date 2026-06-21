ALTER TABLE public.sales_quotation_items
  ADD COLUMN IF NOT EXISTS pricing_tier VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pricing_tier_name VARCHAR(100);

ALTER TABLE public.sales_order_items
  ADD COLUMN IF NOT EXISTS pricing_tier VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pricing_tier_name VARCHAR(100);

ALTER TABLE public.sales_invoice_items
  ADD COLUMN IF NOT EXISTS pricing_tier VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pricing_tier_name VARCHAR(100);

ALTER TABLE public.pos_transaction_items
  ADD COLUMN IF NOT EXISTS pricing_tier VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pricing_tier_name VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_sales_quotation_items_pricing_tier
  ON public.sales_quotation_items(pricing_tier)
  WHERE deleted_at IS NULL AND pricing_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_order_items_pricing_tier
  ON public.sales_order_items(pricing_tier)
  WHERE deleted_at IS NULL AND pricing_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_invoice_items_pricing_tier
  ON public.sales_invoice_items(pricing_tier)
  WHERE deleted_at IS NULL AND pricing_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pos_transaction_items_pricing_tier
  ON public.pos_transaction_items(pricing_tier)
  WHERE pricing_tier IS NOT NULL;

COMMENT ON COLUMN public.sales_quotation_items.pricing_tier IS
  'Selected item price tier code used to price this quotation line.';
COMMENT ON COLUMN public.sales_quotation_items.pricing_tier_name IS
  'Display name of the selected item price tier used to price this quotation line.';

COMMENT ON COLUMN public.sales_order_items.pricing_tier IS
  'Selected item price tier code used to price this sales order line.';
COMMENT ON COLUMN public.sales_order_items.pricing_tier_name IS
  'Display name of the selected item price tier used to price this sales order line.';

COMMENT ON COLUMN public.sales_invoice_items.pricing_tier IS
  'Selected item price tier code used to price this invoice line.';
COMMENT ON COLUMN public.sales_invoice_items.pricing_tier_name IS
  'Display name of the selected item price tier used to price this invoice line.';

COMMENT ON COLUMN public.pos_transaction_items.pricing_tier IS
  'Selected item price tier code used to price this POS line.';
COMMENT ON COLUMN public.pos_transaction_items.pricing_tier_name IS
  'Display name of the selected item price tier used to price this POS line.';
