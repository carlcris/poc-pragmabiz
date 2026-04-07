ALTER TABLE public.load_list_items
ADD COLUMN uom_id uuid REFERENCES public.units_of_measure(id) ON DELETE RESTRICT,
ADD COLUMN item_unit_option_id uuid REFERENCES public.item_unit_options(id) ON DELETE RESTRICT;

UPDATE public.load_list_items lli
SET uom_id = i.uom_id
FROM public.items i
WHERE i.id = lli.item_id
  AND lli.uom_id IS NULL;

UPDATE public.load_list_items lli
SET item_unit_option_id = matched.id
FROM (
  SELECT DISTINCT ON (lli_inner.id)
    lli_inner.id AS load_list_item_id,
    iuo.id
  FROM public.load_list_items lli_inner
  JOIN public.item_unit_options iuo
    ON iuo.item_id = lli_inner.item_id
   AND iuo.uom_id = lli_inner.uom_id
   AND iuo.is_active = true
   AND iuo.deleted_at IS NULL
  ORDER BY
    lli_inner.id,
    iuo.is_base DESC,
    iuo.is_default DESC,
    iuo.sort_order ASC,
    iuo.created_at ASC
) AS matched
WHERE matched.load_list_item_id = lli.id
  AND lli.item_unit_option_id IS NULL;

ALTER TABLE public.load_list_items
ALTER COLUMN uom_id SET NOT NULL;

CREATE INDEX idx_load_list_items_uom_id ON public.load_list_items(uom_id);
CREATE INDEX idx_load_list_items_item_unit_option_id ON public.load_list_items(item_unit_option_id);

CREATE OR REPLACE FUNCTION public.validate_load_list_item_unit_option()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  option_item_id uuid;
  option_uom_id uuid;
BEGIN
  IF NEW.item_unit_option_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT item_id, uom_id
  INTO option_item_id, option_uom_id
  FROM public.item_unit_options
  WHERE id = NEW.item_unit_option_id
    AND deleted_at IS NULL
    AND is_active = true;

  IF option_item_id IS NULL THEN
    RAISE EXCEPTION 'Selected item unit option is invalid or inactive';
  END IF;

  IF option_item_id <> NEW.item_id THEN
    RAISE EXCEPTION 'Selected item unit option does not belong to the item';
  END IF;

  IF option_uom_id <> NEW.uom_id THEN
    RAISE EXCEPTION 'Selected item unit option does not match the unit';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_load_list_item_unit_option ON public.load_list_items;

CREATE TRIGGER trg_validate_load_list_item_unit_option
BEFORE INSERT OR UPDATE ON public.load_list_items
FOR EACH ROW
EXECUTE FUNCTION public.validate_load_list_item_unit_option();
