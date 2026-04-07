-- ============================================================================
-- Migration: Add item_unit_option_id to pick_list_items
-- Version: 20260405152000
-- Description: Persists the exact item-specific unit option selected on
--              pick list lines. Historical rows are not backfilled.
-- Date: 2026-04-05
-- ============================================================================

BEGIN;

ALTER TABLE public.pick_list_items
  ADD COLUMN IF NOT EXISTS item_unit_option_id UUID
  REFERENCES public.item_unit_options(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.pick_list_items.item_unit_option_id IS
  'Selected item-specific unit option for the pick list line.';

CREATE INDEX IF NOT EXISTS idx_pick_list_items_item_unit_option_id
  ON public.pick_list_items(item_unit_option_id)
  WHERE item_unit_option_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_pick_list_item_unit_option()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_option_item_id UUID;
  v_option_uom_id UUID;
  v_option_is_active BOOLEAN;
  v_option_deleted_at TIMESTAMP;
BEGIN
  IF NEW.item_unit_option_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT item_id, uom_id, is_active, deleted_at
    INTO v_option_item_id, v_option_uom_id, v_option_is_active, v_option_deleted_at
  FROM public.item_unit_options
  WHERE id = NEW.item_unit_option_id;

  IF v_option_item_id IS NULL THEN
    RAISE EXCEPTION 'Item unit option % does not exist', NEW.item_unit_option_id;
  END IF;

  IF v_option_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Item unit option % has been deleted', NEW.item_unit_option_id;
  END IF;

  IF v_option_is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Item unit option % is inactive', NEW.item_unit_option_id;
  END IF;

  IF v_option_item_id <> NEW.item_id THEN
    RAISE EXCEPTION 'Item unit option % does not belong to item %', NEW.item_unit_option_id, NEW.item_id;
  END IF;

  IF NEW.uom_id IS DISTINCT FROM v_option_uom_id THEN
    RAISE EXCEPTION 'Item unit option % does not match unit of measure %', NEW.item_unit_option_id, NEW.uom_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_pick_list_items_validate_item_unit_option ON public.pick_list_items;
CREATE TRIGGER trigger_pick_list_items_validate_item_unit_option
  BEFORE INSERT OR UPDATE ON public.pick_list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pick_list_item_unit_option();

COMMIT;
