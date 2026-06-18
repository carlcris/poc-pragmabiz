BEGIN;

CREATE OR REPLACE FUNCTION public.set_delivery_note_item_pick_batch_location_sku()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.batch_location_sku IS NULL OR BTRIM(NEW.batch_location_sku) = '' THEN
    SELECT ilb.batch_location_sku
    INTO NEW.batch_location_sku
    FROM public.item_batches ib
    JOIN public.item_batch_locations ilb
      ON ilb.item_batch_id = ib.id
     AND ilb.company_id = ib.company_id
     AND ilb.deleted_at IS NULL
    WHERE ib.company_id = NEW.company_id
      AND ib.item_id = NEW.item_id
      AND ib.warehouse_id = NEW.source_warehouse_id
      AND ib.batch_code = NEW.picked_batch_code
      AND ib.received_at = NEW.picked_batch_received_at
      AND ib.deleted_at IS NULL
      AND ilb.item_id = NEW.item_id
      AND ilb.warehouse_id = NEW.source_warehouse_id
      AND ilb.location_id = NEW.picked_location_id
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_delivery_note_item_pick_batch_location_sku
  ON public.delivery_note_item_picks;

CREATE TRIGGER trigger_delivery_note_item_pick_batch_location_sku
  BEFORE INSERT OR UPDATE OF
    picked_location_id,
    picked_batch_code,
    picked_batch_received_at,
    batch_location_sku
  ON public.delivery_note_item_picks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_delivery_note_item_pick_batch_location_sku();

UPDATE public.delivery_note_item_picks p
SET batch_location_sku = ilb.batch_location_sku
FROM public.item_batches ib
JOIN public.item_batch_locations ilb
  ON ilb.item_batch_id = ib.id
 AND ilb.company_id = ib.company_id
 AND ilb.deleted_at IS NULL
WHERE p.batch_location_sku IS NULL
  AND p.company_id = ib.company_id
  AND p.item_id = ib.item_id
  AND p.source_warehouse_id = ib.warehouse_id
  AND p.picked_batch_code = ib.batch_code
  AND p.picked_batch_received_at = ib.received_at
  AND p.item_id = ilb.item_id
  AND p.source_warehouse_id = ilb.warehouse_id
  AND p.picked_location_id = ilb.location_id
  AND ib.deleted_at IS NULL
  AND p.deleted_at IS NULL;

COMMIT;
