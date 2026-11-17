BEGIN;

ALTER TABLE public.item_unit_options
  ADD COLUMN is_inventory_preview BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT item_unit_options_inventory_preview_eligible_chk
    CHECK (NOT is_inventory_preview OR (is_active AND NOT is_base AND deleted_at IS NULL));

COMMENT ON COLUMN public.item_unit_options.is_inventory_preview IS
  'Optional alternate unit for displaying inventory balances. Independent of the transaction default.';

CREATE UNIQUE INDEX ux_item_unit_options_inventory_preview
  ON public.item_unit_options (item_id)
  WHERE is_inventory_preview;

CREATE FUNCTION public.prepare_item_unit_option_inventory_preview()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_business_unit_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_inventory_preview IS NOT DISTINCT FROM OLD.is_inventory_preview
      AND (NOT OLD.is_inventory_preview OR
        ROW(NEW.item_id, NEW.uom_id, NEW.qty_per_unit, NEW.option_label, NEW.is_active, NEW.deleted_at)
          IS NOT DISTINCT FROM
        ROW(OLD.item_id, OLD.uom_id, OLD.qty_per_unit, OLD.option_label, OLD.is_active, OLD.deleted_at)) THEN
      RETURN NEW;
    END IF;
  ELSIF NOT NEW.is_inventory_preview THEN
    RETURN NEW;
  END IF;

  -- Existing table grants permit direct option edits. Also authorize changes that
  -- affect a selected preview, including changes made outside the preview RPC.
  IF current_user = 'authenticated' THEN
    v_actor_id := (SELECT auth.uid());
    v_business_unit_id := public.get_current_business_unit_id();

    IF NOT EXISTS (
      SELECT 1
      FROM public.users actor
      JOIN public.user_business_unit_access access_row ON access_row.user_id = actor.id
      JOIN public.business_units unit ON unit.id = access_row.business_unit_id
      WHERE actor.id = v_actor_id AND actor.company_id = NEW.company_id
        AND actor.is_active IS TRUE AND actor.deleted_at IS NULL
        AND unit.id = v_business_unit_id AND unit.company_id = NEW.company_id
        AND unit.is_active IS TRUE
    ) OR NOT public.user_has_permission(v_actor_id, 'items', 'edit', v_business_unit_id) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ITEM_INVENTORY_PREVIEW_FORBIDDEN';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.is_inventory_preview
    AND (NOT NEW.is_active OR NEW.deleted_at IS NOT NULL) THEN
    NEW.is_inventory_preview := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prepare_item_unit_option_inventory_preview
  BEFORE INSERT OR UPDATE OF is_inventory_preview, item_id, uom_id, qty_per_unit, option_label, is_active, deleted_at
  ON public.item_unit_options
  FOR EACH ROW EXECUTE FUNCTION public.prepare_item_unit_option_inventory_preview();

REVOKE ALL ON FUNCTION public.prepare_item_unit_option_inventory_preview() FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.set_item_inventory_preview_unit(
  p_company_id UUID,
  p_item_id UUID,
  p_unit_option_id UUID,
  p_enabled BOOLEAN,
  p_business_unit_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := (SELECT auth.uid());
  v_option RECORD;
BEGIN
  IF p_business_unit_id IS NULL
    OR p_business_unit_id IS DISTINCT FROM public.get_current_business_unit_id()
    OR NOT EXISTS (
      SELECT 1
      FROM public.users actor
      JOIN public.user_business_unit_access access_row ON access_row.user_id = actor.id
      JOIN public.business_units unit ON unit.id = access_row.business_unit_id
      WHERE actor.id = v_actor_id AND actor.company_id = p_company_id
        AND actor.is_active IS TRUE AND actor.deleted_at IS NULL
        AND unit.id = p_business_unit_id AND unit.company_id = p_company_id
        AND unit.is_active IS TRUE
    ) OR NOT public.user_has_permission(v_actor_id, 'items', 'edit', p_business_unit_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ITEM_INVENTORY_PREVIEW_FORBIDDEN';
  END IF;

  IF p_enabled IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ITEM_INVENTORY_PREVIEW_INVALID_INPUT';
  END IF;

  -- Serialize preview selections for the item, including when no option is selected yet.
  PERFORM item.id FROM public.items item
  WHERE item.id = p_item_id AND item.company_id = p_company_id AND item.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'ITEM_INVENTORY_PREVIEW_NOT_FOUND';
  END IF;

  SELECT option.is_active, option.is_base, option.is_inventory_preview INTO v_option
  FROM public.item_unit_options option
  WHERE option.id = p_unit_option_id AND option.item_id = p_item_id
    AND option.company_id = p_company_id AND option.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'ITEM_INVENTORY_PREVIEW_NOT_FOUND';
  END IF;

  IF p_enabled AND (NOT v_option.is_active OR v_option.is_base) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ITEM_INVENTORY_PREVIEW_INELIGIBLE';
  END IF;

  IF v_option.is_inventory_preview = p_enabled THEN
    RETURN;
  END IF;

  IF p_enabled THEN
    UPDATE public.item_unit_options
    SET is_inventory_preview = FALSE, updated_by = v_actor_id
    WHERE item_id = p_item_id AND company_id = p_company_id AND is_inventory_preview;
  END IF;

  UPDATE public.item_unit_options
  SET is_inventory_preview = p_enabled, updated_by = v_actor_id
  WHERE id = p_unit_option_id AND item_id = p_item_id AND company_id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_item_inventory_preview_unit(UUID, UUID, UUID, BOOLEAN, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_item_inventory_preview_unit(UUID, UUID, UUID, BOOLEAN, UUID) TO authenticated;

CREATE FUNCTION public.update_item_unit_option(
  p_company_id UUID,
  p_item_id UUID,
  p_unit_option_id UUID,
  p_business_unit_id UUID,
  p_uom_id UUID DEFAULT NULL,
  p_qty_per_unit NUMERIC DEFAULT NULL,
  p_option_label TEXT DEFAULT NULL,
  p_is_default BOOLEAN DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  item_id UUID,
  uom_id UUID,
  option_label VARCHAR,
  qty_per_unit NUMERIC,
  barcode VARCHAR,
  is_base BOOLEAN,
  is_default BOOLEAN,
  is_active BOOLEAN,
  sort_order INTEGER,
  uom_code VARCHAR,
  uom_name VARCHAR,
  uom_symbol VARCHAR,
  base_uom_code VARCHAR
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := (SELECT auth.uid());
  v_base_uom_id UUID;
  v_option RECORD;
BEGIN
  IF p_business_unit_id IS NULL
    OR p_business_unit_id IS DISTINCT FROM public.get_current_business_unit_id()
    OR NOT EXISTS (
      SELECT 1
      FROM public.users actor
      JOIN public.user_business_unit_access access_row ON access_row.user_id = actor.id
      JOIN public.business_units unit ON unit.id = access_row.business_unit_id
      WHERE actor.id = v_actor_id AND actor.company_id = p_company_id
        AND actor.is_active IS TRUE AND actor.deleted_at IS NULL
        AND unit.id = p_business_unit_id AND unit.company_id = p_company_id
        AND unit.is_active IS TRUE
    ) OR NOT public.user_has_permission(v_actor_id, 'items', 'edit', p_business_unit_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'ITEM_UNIT_OPTION_UPDATE_FORBIDDEN';
  END IF;

  -- Use the same lock order as the preview RPC. Default and preview edits share option rows.
  SELECT item.uom_id INTO v_base_uom_id
  FROM public.items item
  WHERE item.id = p_item_id AND item.company_id = p_company_id AND item.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'ITEM_UNIT_OPTION_ITEM_NOT_FOUND';
  END IF;

  SELECT unit_option.is_base, unit_option.is_default, unit_option.is_active INTO v_option
  FROM public.item_unit_options unit_option
  WHERE unit_option.id = p_unit_option_id AND unit_option.item_id = p_item_id
    AND unit_option.company_id = p_company_id AND unit_option.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'ITEM_UNIT_OPTION_NOT_FOUND';
  END IF;

  IF v_option.is_base AND p_qty_per_unit IS NOT NULL AND p_qty_per_unit <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ITEM_UNIT_OPTION_BASE_QTY_FIXED';
  END IF;
  IF v_option.is_base AND p_is_active IS FALSE THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ITEM_UNIT_OPTION_BASE_INACTIVE';
  END IF;
  IF COALESCE(p_is_default, v_option.is_default) AND NOT COALESCE(p_is_active, v_option.is_active) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ITEM_UNIT_OPTION_DEFAULT_INACTIVE';
  END IF;
  IF p_uom_id IS NOT NULL AND (
    (v_option.is_base AND p_uom_id <> v_base_uom_id)
    OR NOT EXISTS (
      SELECT 1 FROM public.units_of_measure unit
      WHERE unit.id = p_uom_id AND unit.company_id = p_company_id AND unit.deleted_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ITEM_UNIT_OPTION_INVALID_UOM';
  END IF;
  IF ROUND(p_qty_per_unit, 4) NOT BETWEEN 0.0001 AND 99999999999.9999 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ITEM_UNIT_OPTION_INVALID_QTY';
  END IF;
  IF CHAR_LENGTH(BTRIM(p_option_label)) > 120 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'ITEM_UNIT_OPTION_LABEL_TOO_LONG';
  END IF;

  IF p_is_default IS TRUE THEN
    UPDATE public.item_unit_options prior_default
    SET is_default = FALSE, updated_by = v_actor_id
    WHERE prior_default.item_id = p_item_id AND prior_default.company_id = p_company_id
      AND prior_default.id <> p_unit_option_id
      AND prior_default.deleted_at IS NULL AND prior_default.is_default;
  END IF;

  RETURN QUERY
  WITH updated AS (
    UPDATE public.item_unit_options unit_option
    SET uom_id = COALESCE(p_uom_id, unit_option.uom_id),
      option_label = CASE WHEN p_option_label IS NULL THEN unit_option.option_label
        ELSE NULLIF(BTRIM(p_option_label), '') END,
      qty_per_unit = COALESCE(p_qty_per_unit, unit_option.qty_per_unit),
      is_default = COALESCE(p_is_default, unit_option.is_default),
      is_active = COALESCE(p_is_active, unit_option.is_active),
      updated_by = v_actor_id
    WHERE unit_option.id = p_unit_option_id AND unit_option.item_id = p_item_id
      AND unit_option.company_id = p_company_id AND unit_option.deleted_at IS NULL
    RETURNING unit_option.id, unit_option.item_id, unit_option.uom_id, unit_option.option_label,
      unit_option.qty_per_unit, unit_option.barcode, unit_option.is_base, unit_option.is_default,
      unit_option.is_active, unit_option.sort_order
  )
  SELECT updated.id, updated.item_id, updated.uom_id, updated.option_label, updated.qty_per_unit,
    updated.barcode, updated.is_base, updated.is_default, updated.is_active, updated.sort_order,
    unit.code, unit.name, unit.symbol, base_unit.code
  FROM updated
  LEFT JOIN public.units_of_measure unit ON unit.id = updated.uom_id AND unit.company_id = p_company_id
  LEFT JOIN public.units_of_measure base_unit ON base_unit.id = v_base_uom_id
    AND base_unit.company_id = p_company_id AND base_unit.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'ITEM_UNIT_OPTION_NOT_FOUND';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_item_unit_option(UUID, UUID, UUID, UUID, UUID, NUMERIC, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.update_item_unit_option(UUID, UUID, UUID, UUID, UUID, NUMERIC, TEXT, BOOLEAN, BOOLEAN) TO authenticated;

COMMIT;
