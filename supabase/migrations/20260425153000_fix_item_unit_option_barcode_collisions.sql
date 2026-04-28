-- ============================================================================
-- Migration: Fix Item Unit Option Barcode Collisions
-- Version: 20260425153000
-- Description: Prevent barcode collisions after seeded/manual item_unit_options
--              inserts and retry barcode generation inside the trigger.
-- Date: 2026-04-25
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_item_unit_option_defaults_and_validate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_item_company_id UUID;
  v_item_base_uom_id UUID;
  v_uom_company_id UUID;
  v_barcode_attempts INTEGER := 0;
  v_max_barcode_attempts CONSTANT INTEGER := 25;
BEGIN
  IF NEW.barcode IS NULL OR BTRIM(NEW.barcode) = '' THEN
    LOOP
      v_barcode_attempts := v_barcode_attempts + 1;

      IF v_barcode_attempts > v_max_barcode_attempts THEN
        RAISE EXCEPTION 'Unable to generate a unique item unit option barcode after % attempts', v_max_barcode_attempts;
      END IF;

      NEW.barcode := public.generate_item_unit_option_barcode();

      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.item_unit_options iuo
        WHERE iuo.company_id = NEW.company_id
          AND iuo.barcode = NEW.barcode
          AND iuo.deleted_at IS NULL
          AND (TG_OP = 'INSERT' OR iuo.id <> NEW.id)
      );
    END LOOP;
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

DO $$
DECLARE
  v_row_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_row_count
  FROM public.item_unit_options;

  PERFORM setval(
    'public.item_unit_option_barcode_seq',
    GREATEST(v_row_count, 1),
    v_row_count > 0
  );
END;
$$;

COMMIT;
