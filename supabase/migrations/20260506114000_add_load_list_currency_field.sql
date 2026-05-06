ALTER TABLE public.load_lists
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'PHP';

ALTER TABLE public.load_lists
  DROP CONSTRAINT IF EXISTS chk_load_lists_currency_format,
  ADD CONSTRAINT chk_load_lists_currency_format
    CHECK (currency ~ '^[A-Z]{3}$');

COMMENT ON COLUMN public.load_lists.currency IS
  'Currency used for all line prices on this load list.';
