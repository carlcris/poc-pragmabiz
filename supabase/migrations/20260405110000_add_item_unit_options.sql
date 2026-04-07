-- ============================================================================
-- Migration: Add Item Unit Options
-- Version: 20260405110000
-- Description: Adds item-specific unit options with qty_per_unit and a
--              database-generated 10-digit barcode per row.
-- Date: 2026-04-05
-- ============================================================================

BEGIN;

-- ============================================================================
-- BARCODE GENERATION
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS public.item_unit_option_barcode_seq
  AS bigint
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 20;

CREATE OR REPLACE FUNCTION public.generate_item_unit_option_barcode()
RETURNS VARCHAR(10)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_seq NUMERIC;
  v_mod_base CONSTANT NUMERIC := 10000000000; -- 10^10
  v_val NUMERIC;
BEGIN
  -- Sequence-backed pseudo-randomized permutation keeps generation in the DB
  -- while avoiding app-side race conditions.
  v_seq := nextval('public.item_unit_option_barcode_seq');
  v_val := mod((v_seq * 2454267029) + 518734127, v_mod_base);

  RETURN LPAD(TRUNC(v_val)::BIGINT::TEXT, 10, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_item_unit_option_barcode() IS
  'Returns a unique 10-digit numeric barcode candidate for item_unit_options.';

-- ============================================================================
-- TABLE: item_unit_options
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.item_unit_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  uom_id UUID NOT NULL REFERENCES public.units_of_measure(id) ON DELETE RESTRICT,
  option_label VARCHAR(120),
  qty_per_unit NUMERIC(15,4) NOT NULL,
  barcode VARCHAR(10) NOT NULL,
  is_base BOOLEAN NOT NULL DEFAULT FALSE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMP NULL,
  version INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT item_unit_options_qty_positive_chk CHECK (qty_per_unit > 0),
  CONSTRAINT item_unit_options_barcode_format_chk CHECK (barcode ~ '^[0-9]{10}$'),
  CONSTRAINT item_unit_options_base_qty_chk CHECK (NOT is_base OR qty_per_unit = 1),
  CONSTRAINT item_unit_options_base_active_chk CHECK (NOT is_base OR is_active),
  CONSTRAINT item_unit_options_default_active_chk CHECK (NOT is_default OR is_active),
  CONSTRAINT item_unit_options_sort_order_chk CHECK (sort_order >= 0)
);

COMMENT ON TABLE public.item_unit_options IS
  'Item-specific unit options, including qty_per_unit and a 10-digit scannable barcode.';
COMMENT ON COLUMN public.item_unit_options.option_label IS
  'Optional item-specific label used when the same UoM appears multiple times for one item.';
COMMENT ON COLUMN public.item_unit_options.qty_per_unit IS
  'How many base units this option represents for the item. Base rows must be 1.';
COMMENT ON COLUMN public.item_unit_options.barcode IS
  'Database-generated 10-digit numeric barcode for this exact item-unit option row.';

CREATE INDEX IF NOT EXISTS idx_item_unit_options_item
  ON public.item_unit_options(item_id, sort_order, created_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_unit_options_uom
  ON public.item_unit_options(uom_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_unit_options_barcode
  ON public.item_unit_options(company_id, barcode)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_item_unit_options_company_barcode
  ON public.item_unit_options(company_id, barcode)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_item_unit_options_active_base
  ON public.item_unit_options(item_id)
  WHERE deleted_at IS NULL AND is_base;

CREATE UNIQUE INDEX IF NOT EXISTS ux_item_unit_options_active_default
  ON public.item_unit_options(item_id)
  WHERE deleted_at IS NULL AND is_default;

CREATE UNIQUE INDEX IF NOT EXISTS ux_item_unit_options_item_uom_qty
  ON public.item_unit_options(company_id, item_id, uom_id, qty_per_unit)
  WHERE deleted_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_item_unit_options_updated_at'
      AND tgrelid = 'public.item_unit_options'::regclass
      AND NOT tgisinternal
  ) THEN
    EXECUTE 'DROP TRIGGER trigger_item_unit_options_updated_at ON public.item_unit_options';
  END IF;
END
$$;
CREATE TRIGGER trigger_item_unit_options_updated_at
  BEFORE UPDATE ON public.item_unit_options
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- VALIDATION / DEFAULTING
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_item_unit_option_defaults_and_validate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_item_company_id UUID;
  v_item_base_uom_id UUID;
  v_uom_company_id UUID;
BEGIN
  IF NEW.barcode IS NULL OR BTRIM(NEW.barcode) = '' THEN
    NEW.barcode := public.generate_item_unit_option_barcode();
  END IF;

  IF NEW.barcode !~ '^[0-9]{10}$' THEN
    RAISE EXCEPTION 'Barcode must be exactly 10 numeric digits';
  END IF;

  SELECT i.company_id, i.uom_id
    INTO v_item_company_id, v_item_base_uom_id
  FROM public.items i
  WHERE i.id = NEW.item_id
    AND i.deleted_at IS NULL;

  IF v_item_company_id IS NULL THEN
    RAISE EXCEPTION 'Item % does not exist or has been deleted', NEW.item_id;
  END IF;

  IF v_item_company_id <> NEW.company_id THEN
    RAISE EXCEPTION 'Item % does not belong to company %', NEW.item_id, NEW.company_id;
  END IF;

  SELECT u.company_id
    INTO v_uom_company_id
  FROM public.units_of_measure u
  WHERE u.id = NEW.uom_id
    AND u.deleted_at IS NULL;

  IF v_uom_company_id IS NULL THEN
    RAISE EXCEPTION 'Unit of measure % does not exist or has been deleted', NEW.uom_id;
  END IF;

  IF v_uom_company_id <> NEW.company_id THEN
    RAISE EXCEPTION 'Unit of measure % does not belong to company %', NEW.uom_id, NEW.company_id;
  END IF;

  IF NEW.is_base AND NEW.uom_id <> v_item_base_uom_id THEN
    RAISE EXCEPTION 'Base item unit option must use the item base uom_id';
  END IF;

  IF NEW.deleted_at IS NOT NULL AND NEW.is_base THEN
    RAISE EXCEPTION 'Base item unit option cannot be soft-deleted';
  END IF;

  IF NEW.deleted_at IS NOT NULL AND NEW.is_default THEN
    RAISE EXCEPTION 'Default item unit option cannot be soft-deleted while marked default';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.apply_item_unit_option_defaults_and_validate() IS
  'Generates item-unit-option barcodes and enforces item/company/UoM/base-row consistency.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_item_unit_options_apply_defaults_and_validate'
      AND tgrelid = 'public.item_unit_options'::regclass
      AND NOT tgisinternal
  ) THEN
    EXECUTE 'DROP TRIGGER trigger_item_unit_options_apply_defaults_and_validate ON public.item_unit_options';
  END IF;
END
$$;
CREATE TRIGGER trigger_item_unit_options_apply_defaults_and_validate
  BEFORE INSERT OR UPDATE ON public.item_unit_options
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_item_unit_option_defaults_and_validate();

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.item_unit_options ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'item_unit_options'
      AND policyname = 'item_unit_options_select'
  ) THEN
    EXECUTE 'DROP POLICY item_unit_options_select ON public.item_unit_options';
  END IF;
END
$$;
CREATE POLICY item_unit_options_select
  ON public.item_unit_options FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'item_unit_options'
      AND policyname = 'item_unit_options_insert'
  ) THEN
    EXECUTE 'DROP POLICY item_unit_options_insert ON public.item_unit_options';
  END IF;
END
$$;
CREATE POLICY item_unit_options_insert
  ON public.item_unit_options FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'item_unit_options'
      AND policyname = 'item_unit_options_update'
  ) THEN
    EXECUTE 'DROP POLICY item_unit_options_update ON public.item_unit_options';
  END IF;
END
$$;
CREATE POLICY item_unit_options_update
  ON public.item_unit_options FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

COMMIT;

