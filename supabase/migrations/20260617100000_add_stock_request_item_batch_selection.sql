BEGIN;

ALTER TABLE public.stock_request_items
  ADD COLUMN IF NOT EXISTS selected_item_batch_id UUID
  REFERENCES public.item_batches(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.stock_request_items.selected_item_batch_id IS
  'Optional source item batch selected by the requester for allocation/picking.';

CREATE INDEX IF NOT EXISTS idx_stock_request_items_selected_item_batch_id
  ON public.stock_request_items(selected_item_batch_id)
  WHERE selected_item_batch_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_stock_request_item_selected_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_request_company_id UUID;
  v_fulfilling_warehouse_id UUID;
  v_batch_item_id UUID;
  v_batch_warehouse_id UUID;
  v_batch_deleted_at TIMESTAMPTZ;
BEGIN
  IF NEW.selected_item_batch_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT company_id, fulfilling_warehouse_id
    INTO v_request_company_id, v_fulfilling_warehouse_id
  FROM public.stock_requests
  WHERE id = NEW.stock_request_id;

  IF v_request_company_id IS NULL THEN
    RAISE EXCEPTION 'Stock request % does not exist', NEW.stock_request_id;
  END IF;

  IF v_fulfilling_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Stock request % has no fulfilling warehouse', NEW.stock_request_id;
  END IF;

  SELECT item_id, warehouse_id, deleted_at
    INTO v_batch_item_id, v_batch_warehouse_id, v_batch_deleted_at
  FROM public.item_batches
  WHERE id = NEW.selected_item_batch_id
    AND company_id = v_request_company_id;

  IF v_batch_item_id IS NULL THEN
    RAISE EXCEPTION 'Selected item batch % does not exist', NEW.selected_item_batch_id;
  END IF;

  IF v_batch_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Selected item batch % has been deleted', NEW.selected_item_batch_id;
  END IF;

  IF v_batch_item_id <> NEW.item_id THEN
    RAISE EXCEPTION 'Selected item batch % does not belong to item %', NEW.selected_item_batch_id, NEW.item_id;
  END IF;

  IF v_batch_warehouse_id <> v_fulfilling_warehouse_id THEN
    RAISE EXCEPTION 'Selected item batch % does not belong to fulfilling warehouse %', NEW.selected_item_batch_id, v_fulfilling_warehouse_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_stock_request_items_validate_selected_batch ON public.stock_request_items;
CREATE TRIGGER trigger_stock_request_items_validate_selected_batch
  BEFORE INSERT OR UPDATE ON public.stock_request_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_stock_request_item_selected_batch();

COMMIT;
