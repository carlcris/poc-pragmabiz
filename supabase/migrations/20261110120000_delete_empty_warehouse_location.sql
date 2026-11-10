BEGIN;

CREATE INDEX putaway_tasks_open_suggested_location_idx
  ON public.putaway_tasks(suggested_location_id)
  WHERE deleted_at IS NULL AND status IN ('pending', 'partial');

CREATE OR REPLACE FUNCTION public.delete_warehouse_location(p_business_unit_id UUID, p_location_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_warehouse UUID;
BEGIN
  IF NOT COALESCE(public.user_has_permission((SELECT auth.uid()), 'manage_locations', 'delete', p_business_unit_id), FALSE) THEN
    RAISE EXCEPTION 'LOCATION_DELETE_FORBIDDEN';
  END IF;
  SELECT l.warehouse_id INTO v_warehouse FROM public.warehouse_locations l
    WHERE l.id = p_location_id AND l.deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_LOCATION_NOT_FOUND'; END IF;
  -- Match structural-edit lock order: warehouse first, then the location.
  PERFORM 1 FROM public.resolve_warehouse_location_batch_scope(p_business_unit_id, v_warehouse, NULL, TRUE);
  PERFORM l.id FROM public.warehouse_locations l
    WHERE l.id = p_location_id AND l.deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'WAREHOUSE_LOCATION_NOT_FOUND'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.putaway_tasks task WHERE task.suggested_location_id = p_location_id
      AND task.deleted_at IS NULL AND task.status IN ('pending', 'partial')
  ) THEN RAISE EXCEPTION 'LOCATION_IN_USE'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.item_warehouse stock
    WHERE stock.default_location_id = p_location_id AND stock.deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'LOCATION_IS_PREFERRED'; END IF;
  -- The hierarchy trigger rejects children, stock, reservations and pending putaway.
  -- Stock and putaway writers lock the same location, preventing concurrent use.
  UPDATE public.warehouse_locations SET deleted_at = now(), is_active = FALSE,
    updated_at = now(), updated_by = (SELECT auth.uid()) WHERE id = p_location_id;
END $$;

REVOKE ALL ON FUNCTION public.delete_warehouse_location(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_warehouse_location(UUID, UUID) TO authenticated;

-- Partially completed tasks still reserve their suggested destination for remaining work.
CREATE OR REPLACE FUNCTION public.lock_putaway_suggested_location()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.suggested_location_id IS NOT NULL AND NEW.status IN ('pending', 'partial') AND NEW.deleted_at IS NULL THEN
    PERFORM l.id FROM public.warehouse_locations l WHERE l.id = NEW.suggested_location_id
      AND l.company_id = NEW.company_id AND l.warehouse_id = NEW.warehouse_id
      AND l.deleted_at IS NULL AND l.is_active IS TRUE AND l.is_storable IS TRUE FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Suggested putaway location is not valid'; END IF;
  END IF;
  RETURN NEW;
END $$;

-- Serialize preferred-location assignment with deletion. The FK alone cannot guard soft deletes.
CREATE OR REPLACE FUNCTION public.validate_item_warehouse_preferred_location()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.default_location_id IS NULL OR NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.default_location_id IS NOT DISTINCT FROM OLD.default_location_id
      AND OLD.deleted_at IS NULL AND NEW.company_id = OLD.company_id
      AND NEW.warehouse_id = OLD.warehouse_id THEN RETURN NEW; END IF;
  END IF;
  PERFORM l.id FROM public.warehouse_locations l
    WHERE l.id = NEW.default_location_id AND l.company_id = NEW.company_id
      AND l.warehouse_id = NEW.warehouse_id AND l.deleted_at IS NULL
      AND l.is_active IS TRUE AND l.is_storable IS TRUE
    FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_STORAGE_UNAVAILABLE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_item_warehouse_preferred_location
BEFORE INSERT OR UPDATE OF default_location_id, deleted_at, company_id, warehouse_id ON public.item_warehouse
FOR EACH ROW EXECUTE FUNCTION public.validate_item_warehouse_preferred_location();

COMMIT;
