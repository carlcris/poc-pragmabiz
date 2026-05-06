ALTER TABLE public.stock_requisitions
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'PHP';

ALTER TABLE public.stock_requisitions
  DROP CONSTRAINT IF EXISTS chk_stock_requisitions_currency_format,
  ADD CONSTRAINT chk_stock_requisitions_currency_format
    CHECK (currency ~ '^[A-Z]{3}$');

COMMENT ON COLUMN public.stock_requisitions.currency IS
  'Currency used for all line prices and total_amount on this stock requisition.';
