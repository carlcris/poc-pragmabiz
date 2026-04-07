-- ============================================================================
-- Migration: Add unit option support to stock requisition items
-- Version: 20260405193000
-- Description: Persists the exact selected item unit option on purchasing
--              stock requisition lines while keeping uom_id for compatibility.
-- Date: 2026-04-05
-- ============================================================================

BEGIN;

ALTER TABLE public.stock_requisition_items
  ADD COLUMN IF NOT EXISTS uom_id UUID REFERENCES public.units_of_measure(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS item_unit_option_id UUID
    REFERENCES public.item_unit_options(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.stock_requisition_items.uom_id IS
  'Selected unit of measure for the requisition line.';

COMMENT ON COLUMN public.stock_requisition_items.item_unit_option_id IS
  'Selected item-specific unit option for the requisition line.';

CREATE INDEX IF NOT EXISTS idx_stock_requisition_items_uom_id
  ON public.stock_requisition_items(uom_id)
  WHERE uom_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stock_requisition_items_item_unit_option_id
  ON public.stock_requisition_items(item_unit_option_id)
  WHERE item_unit_option_id IS NOT NULL;

UPDATE public.stock_requisition_items sri
SET uom_id = i.uom_id
FROM public.items i
WHERE sri.item_id = i.id
  AND sri.uom_id IS NULL;

WITH matched_options AS (
  SELECT DISTINCT ON (sri.id)
    sri.id AS requisition_item_id,
    iuo.id AS item_unit_option_id
  FROM public.stock_requisition_items sri
  JOIN public.item_unit_options iuo
    ON iuo.item_id = sri.item_id
   AND iuo.uom_id = sri.uom_id
   AND iuo.is_active = TRUE
   AND iuo.deleted_at IS NULL
  WHERE sri.item_unit_option_id IS NULL
  ORDER BY sri.id, iuo.is_base DESC, iuo.is_default DESC, iuo.sort_order ASC, iuo.created_at ASC
)
UPDATE public.stock_requisition_items sri
SET item_unit_option_id = matched_options.item_unit_option_id
FROM matched_options
WHERE matched_options.requisition_item_id = sri.id;

ALTER TABLE public.stock_requisition_items
  ALTER COLUMN uom_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_stock_requisition_item_unit_option()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_option_item_id UUID;
  v_option_uom_id UUID;
  v_option_is_active BOOLEAN;
  v_option_deleted_at TIMESTAMPTZ;
BEGIN
  IF NEW.item_unit_option_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT item_id, uom_id, is_active, deleted_at
    INTO v_option_item_id, v_option_uom_id, v_option_is_active, v_option_deleted_at
  FROM public.item_unit_options
  WHERE id = NEW.item_unit_option_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item unit option % does not exist', NEW.item_unit_option_id;
  END IF;

  IF v_option_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Item unit option % has been deleted', NEW.item_unit_option_id;
  END IF;

  IF NOT v_option_is_active THEN
    RAISE EXCEPTION 'Item unit option % is inactive', NEW.item_unit_option_id;
  END IF;

  IF NEW.item_id IS DISTINCT FROM v_option_item_id THEN
    RAISE EXCEPTION 'Item unit option % does not belong to item %', NEW.item_unit_option_id, NEW.item_id;
  END IF;

  IF NEW.uom_id IS DISTINCT FROM v_option_uom_id THEN
    RAISE EXCEPTION 'Item unit option % does not match unit of measure %', NEW.item_unit_option_id, NEW.uom_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_requisition_items_validate_unit_option ON public.stock_requisition_items;
CREATE TRIGGER trg_stock_requisition_items_validate_unit_option
  BEFORE INSERT OR UPDATE ON public.stock_requisition_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_stock_requisition_item_unit_option();

COMMIT;
