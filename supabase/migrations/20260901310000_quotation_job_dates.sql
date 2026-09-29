-- ============================================================================
-- Migration: Job dates on a quotation
-- Description:
--   `date_received` is when the customer's artwork came in; `due_date` is when
--   the finished frame is promised back. These are shop-floor dates and are
--   independent of `quotation_date` / `valid_until`, which are commercial: a
--   quote can be raised days after the artwork arrives, and its validity window
--   has nothing to do with the promise date.
--
--   Both are NOT NULL going forward, but existing rows have no such dates to
--   recover. They are backfilled from the commercial dates rather than invented:
--   `quotation_date` is the closest thing to "when this job started", and
--   `valid_until` (or +14 days) the closest to a promise. The backfill runs
--   before the NOT NULL is applied.
-- Date: 2026-09-01
-- ============================================================================

BEGIN;

ALTER TABLE public.sales_quotations
  ADD COLUMN IF NOT EXISTS date_received DATE,
  ADD COLUMN IF NOT EXISTS due_date DATE;

UPDATE public.sales_quotations
SET date_received = COALESCE(date_received, quotation_date)
WHERE date_received IS NULL;

UPDATE public.sales_quotations
SET due_date = COALESCE(due_date, valid_until, quotation_date + INTERVAL '14 days')
WHERE due_date IS NULL;

ALTER TABLE public.sales_quotations
  ALTER COLUMN date_received SET NOT NULL,
  ALTER COLUMN due_date SET NOT NULL;

-- A frame promised before its artwork arrived is a data-entry slip, not a rush
-- job. Same-day is legitimate, so the boundary is inclusive.
ALTER TABLE public.sales_quotations
  DROP CONSTRAINT IF EXISTS chk_quotation_due_after_received;
ALTER TABLE public.sales_quotations
  ADD CONSTRAINT chk_quotation_due_after_received
  CHECK (due_date >= date_received);

COMMENT ON COLUMN public.sales_quotations.date_received IS
  'When the customer''s artwork was received by the shop.';
COMMENT ON COLUMN public.sales_quotations.due_date IS
  'When the finished work is promised back to the customer.';

COMMIT;
