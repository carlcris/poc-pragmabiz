-- Migration: Drop legacy item cost_price column
-- Date: 2026-06-10

BEGIN;

ALTER TABLE public.items
  DROP COLUMN IF EXISTS cost_price;

COMMIT;
