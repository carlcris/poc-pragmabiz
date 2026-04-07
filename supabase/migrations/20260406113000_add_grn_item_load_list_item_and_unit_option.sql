ALTER TABLE public.grn_items
ADD COLUMN load_list_item_id UUID REFERENCES public.load_list_items(id) ON DELETE SET NULL,
ADD COLUMN item_unit_option_id UUID REFERENCES public.item_unit_options(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_grn_items_load_list_item_id
  ON public.grn_items(load_list_item_id);

CREATE INDEX IF NOT EXISTS idx_grn_items_item_unit_option_id
  ON public.grn_items(item_unit_option_id);

WITH matched AS (
  SELECT DISTINCT ON (gi.id)
    gi.id AS grn_item_id,
    lli.id AS load_list_item_id,
    lli.item_unit_option_id
  FROM public.grn_items gi
  JOIN public.grns g
    ON g.id = gi.grn_id
  JOIN public.load_list_items lli
    ON lli.load_list_id = g.load_list_id
   AND lli.item_id = gi.item_id
   AND lli.load_list_qty = gi.load_list_qty
  WHERE gi.load_list_item_id IS NULL
  ORDER BY gi.id, lli.id
)
UPDATE public.grn_items gi
SET
  load_list_item_id = matched.load_list_item_id,
  item_unit_option_id = matched.item_unit_option_id
FROM matched
WHERE matched.grn_item_id = gi.id;

CREATE OR REPLACE FUNCTION public.validate_grn_item_source_link()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_grn_load_list_id UUID;
  v_load_list_item RECORD;
BEGIN
  IF NEW.load_list_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT load_list_id
  INTO v_grn_load_list_id
  FROM public.grns
  WHERE id = NEW.grn_id;

  IF v_grn_load_list_id IS NULL THEN
    RAISE EXCEPTION 'GRN % not found for GRN item validation', NEW.grn_id;
  END IF;

  SELECT id, item_id, item_unit_option_id, load_list_qty
  INTO v_load_list_item
  FROM public.load_list_items
  WHERE id = NEW.load_list_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Load list item % not found', NEW.load_list_item_id;
  END IF;

  IF v_load_list_item.item_id IS DISTINCT FROM NEW.item_id THEN
    RAISE EXCEPTION 'GRN item % item_id does not match load list item %', NEW.id, NEW.load_list_item_id;
  END IF;

  IF v_grn_load_list_id IS DISTINCT FROM (
    SELECT load_list_id FROM public.load_list_items WHERE id = NEW.load_list_item_id
  ) THEN
    RAISE EXCEPTION 'Load list item % does not belong to GRN load list %', NEW.load_list_item_id, v_grn_load_list_id;
  END IF;

  IF NEW.item_unit_option_id IS NOT NULL
     AND v_load_list_item.item_unit_option_id IS DISTINCT FROM NEW.item_unit_option_id THEN
    RAISE EXCEPTION 'GRN item % unit option does not match load list item %', NEW.id, NEW.load_list_item_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_grn_item_source_link_trigger ON public.grn_items;

CREATE TRIGGER validate_grn_item_source_link_trigger
BEFORE INSERT OR UPDATE ON public.grn_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_grn_item_source_link();
