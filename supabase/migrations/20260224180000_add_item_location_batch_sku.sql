-- ============================================================================
-- Migration: Add Item Location Batch SKU
-- Version: 20260224180000
-- Description: Adds a database-generated 10-digit scan code on item_location_batch
--              to identify a specific item + batch + location(shelf/rack/bin).
-- Date: 2026-02-24
-- ============================================================================

BEGIN;

-- Sequence-backed generator avoids race conditions from app-side generation.
CREATE SEQUENCE IF NOT EXISTS public.item_location_batch_sku_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 20;

CREATE OR REPLACE FUNCTION public.generate_item_location_batch_sku()
RETURNS VARCHAR(10)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_seq NUMERIC;
  v_mod_base CONSTANT NUMERIC := 10000000000; -- 10^10
  v_val NUMERIC;
BEGIN
  -- Pseudo-randomized permutation from a monotonically increasing sequence.
  -- Multiplier is coprime with 10^10 (not divisible by 2 or 5), preserving uniqueness
  -- within the modulus cycle.
  v_seq := nextval('public.item_location_batch_sku_seq');
  v_val := mod((v_seq * 2454267029) + 518734127, v_mod_base);

  RETURN LPAD(TRUNC(v_val)::BIGINT::TEXT, 10, '0');
END;
$$;

ALTER TABLE item_location_batch
  ADD COLUMN IF NOT EXISTS batch_location_sku VARCHAR(10);

COMMENT ON COLUMN item_location_batch.batch_location_sku IS
  'Database-generated 10-digit scan code for a specific item+batch+location row.';


CREATE UNIQUE INDEX IF NOT EXISTS ux_item_location_batch_company_batch_location_sku
  ON item_location_batch(company_id, batch_location_sku)
  WHERE deleted_at IS NULL;

ALTER TABLE item_location_batch
  ALTER COLUMN batch_location_sku SET NOT NULL;

CREATE OR REPLACE FUNCTION public.set_item_location_batch_sku()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF NEW.batch_location_sku IS NULL OR BTRIM(NEW.batch_location_sku) = '' THEN
    NEW.batch_location_sku := public.generate_item_location_batch_sku();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_item_location_batch_set_sku ON item_location_batch;
CREATE TRIGGER trigger_item_location_batch_set_sku
  BEFORE INSERT ON item_location_batch
  FOR EACH ROW
  EXECUTE FUNCTION public.set_item_location_batch_sku();

COMMIT;
