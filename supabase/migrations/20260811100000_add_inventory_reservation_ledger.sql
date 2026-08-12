BEGIN;

ALTER TABLE public.inventory_reservations
  DROP CONSTRAINT chk_inventory_reservation_type,
  DROP CONSTRAINT chk_inventory_reservation_status,
  DROP CONSTRAINT chk_inventory_reservation_qty,
  ADD COLUMN business_unit_id UUID REFERENCES public.business_units(id),
  ADD COLUMN delivery_note_id UUID REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  ADD COLUMN delivery_note_item_id UUID REFERENCES public.delivery_note_items(id) ON DELETE CASCADE,
  ADD COLUMN transferred_in_base NUMERIC(20,2) NOT NULL DEFAULT 0
    CHECK (transferred_in_base >= 0),
  ADD COLUMN transferred_out_base NUMERIC(20,2) NOT NULL DEFAULT 0
    CHECK (transferred_out_base >= 0),
  ADD COLUMN consumed_base NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (consumed_base >= 0),
  ADD COLUMN released_base NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (released_base >= 0),
  ADD COLUMN active_quantity_base NUMERIC(20,2) GENERATED ALWAYS AS (
    CASE
      WHEN reservation_type = 'delivery_note' THEN
        quantity + transferred_in_base - transferred_out_base - consumed_base - released_base
      WHEN status = 'active' THEN quantity
      ELSE 0
    END
  ) STORED,
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD CONSTRAINT chk_inventory_reservation_type CHECK (
    reservation_type IN ('frame_job_order', 'delivery_note')
  ),
  ADD CONSTRAINT chk_inventory_reservation_status CHECK (
    status IN ('active', 'partial', 'consumed', 'released', 'transferred', 'closed')
  ),
  ADD CONSTRAINT chk_inventory_reservation_qty CHECK (
    (reservation_type = 'frame_job_order' AND quantity > 0)
    OR (reservation_type = 'delivery_note' AND quantity >= 0)
  ),
  ADD CONSTRAINT inventory_reservations_effective_quantity_check CHECK (
    reservation_type <> 'delivery_note'
    OR quantity + transferred_in_base >=
      transferred_out_base + consumed_base + released_base
  ),
  ADD CONSTRAINT inventory_reservations_delivery_note_ownership_check CHECK (
    reservation_type <> 'delivery_note'
    OR (
      business_unit_id IS NOT NULL
      AND delivery_note_id IS NOT NULL
      AND delivery_note_item_id IS NOT NULL
      AND created_by IS NOT NULL
      AND updated_by IS NOT NULL
      AND source_type = 'delivery_note_item'
      AND source_id = delivery_note_item_id
      AND quantity >= 0
    )
  ),
  ADD CONSTRAINT inventory_reservations_delivery_item_warehouse_key
    UNIQUE (delivery_note_item_id, warehouse_id);

CREATE TABLE public.inventory_reservation_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_unit_id UUID NOT NULL REFERENCES public.business_units(id),
  reservation_id UUID NOT NULL REFERENCES public.inventory_reservations(id) ON DELETE CASCADE,
  pick_list_id UUID NOT NULL REFERENCES public.pick_lists(id) ON DELETE CASCADE,
  pick_list_item_id UUID NOT NULL REFERENCES public.pick_list_items(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  item_batch_id UUID NOT NULL REFERENCES public.item_batches(id),
  item_batch_location_id UUID NOT NULL REFERENCES public.item_batch_locations(id),
  quantity_base NUMERIC(20,2) NOT NULL CHECK (quantity_base >= 0),
  transferred_in_base NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (transferred_in_base >= 0),
  transferred_out_base NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (transferred_out_base >= 0),
  consumed_base NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (consumed_base >= 0),
  released_base NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (released_base >= 0),
  active_quantity_base NUMERIC(20,2) GENERATED ALWAYS AS (
    quantity_base + transferred_in_base - transferred_out_base - consumed_base - released_base
  ) STORED,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'partial', 'consumed', 'released', 'transferred', 'closed')
  ),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL REFERENCES public.users(id),
  CONSTRAINT inventory_reservation_allocations_effective_quantity_check CHECK (
    quantity_base + transferred_in_base >=
      transferred_out_base + consumed_base + released_base
  ),
  CONSTRAINT inventory_reservation_allocations_pick_source_key
    UNIQUE (pick_list_item_id, item_batch_location_id)
);

CREATE INDEX inventory_reservations_owner_idx
  ON public.inventory_reservations (company_id, business_unit_id, delivery_note_id);
CREATE INDEX inventory_reservations_item_warehouse_status_idx
  ON public.inventory_reservations (company_id, item_id, warehouse_id, status);
CREATE INDEX inventory_reservation_allocations_owner_idx
  ON public.inventory_reservation_allocations (company_id, business_unit_id, pick_list_id);
CREATE INDEX inventory_reservation_allocations_reservation_idx
  ON public.inventory_reservation_allocations (reservation_id, status);
CREATE INDEX inventory_reservation_allocations_source_idx
  ON public.inventory_reservation_allocations (
    company_id,
    item_batch_location_id,
    status
  );

COMMENT ON TABLE public.inventory_reservations IS
  'Inventory-owned warehouse commitments. Effective active quantity is projected into item_warehouse.reserved_stock.';
COMMENT ON TABLE public.inventory_reservation_allocations IS
  'Physical batch-location allocations owned by pick-list lines. Effective active quantity is projected into item_batches and item_batch_locations qty_reserved.';

ALTER TABLE public.inventory_reservation_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY inventory_reservations_company_all ON public.inventory_reservations;
CREATE POLICY inventory_reservations_select
  ON public.inventory_reservations
  FOR SELECT TO authenticated
  USING (
    company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid())
    AND (
      reservation_type <> 'delivery_note'
      OR EXISTS (
        SELECT 1
        FROM public.user_business_unit_access access_row
        WHERE access_row.user_id = auth.uid()
          AND access_row.business_unit_id = inventory_reservations.business_unit_id
      )
    )
  );

CREATE POLICY inventory_reservations_frame_job_mutation
  ON public.inventory_reservations
  FOR ALL TO authenticated
  USING (
    reservation_type = 'frame_job_order'
    AND company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid())
  )
  WITH CHECK (
    reservation_type = 'frame_job_order'
    AND company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid())
  );

CREATE POLICY inventory_reservation_allocations_select
  ON public.inventory_reservation_allocations
  FOR SELECT TO authenticated
  USING (
    company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.user_business_unit_access access_row
      WHERE access_row.user_id = auth.uid()
        AND access_row.business_unit_id = inventory_reservation_allocations.business_unit_id
    )
  );

CREATE OR REPLACE FUNCTION public.inventory_reservation_status(
  p_active NUMERIC,
  p_consumed NUMERIC,
  p_released NUMERIC,
  p_transferred_out NUMERIC
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_active > 0 AND (p_consumed > 0 OR p_released > 0 OR p_transferred_out > 0)
      THEN 'partial'
    WHEN p_active > 0 THEN 'active'
    WHEN p_consumed > 0 AND p_released > 0 THEN 'closed'
    WHEN p_consumed > 0 THEN 'consumed'
    WHEN p_released > 0 THEN 'released'
    ELSE 'transferred'
  END;
$$;

REVOKE ALL ON FUNCTION public.inventory_reservation_status(NUMERIC, NUMERIC, NUMERIC, NUMERIC)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assert_inventory_reservation_allocation_invariant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reservation_id UUID;
  v_active_commitment NUMERIC;
  v_active_allocation NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'inventory_reservations' THEN
    IF TG_OP = 'DELETE' THEN
      v_reservation_id := OLD.id;
    ELSE
      v_reservation_id := NEW.id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_reservation_id := OLD.reservation_id;
  ELSE
    v_reservation_id := NEW.reservation_id;
  END IF;

  SELECT reservation.active_quantity_base
  INTO v_active_commitment
  FROM public.inventory_reservations reservation
  WHERE reservation.id = v_reservation_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(SUM(allocation.active_quantity_base), 0)
  INTO v_active_allocation
  FROM public.inventory_reservation_allocations allocation
  WHERE allocation.reservation_id = v_reservation_id;

  IF v_active_allocation > v_active_commitment THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_ALLOCATION_CONFLICT';
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_inventory_reservation_allocation_invariant()
  FROM PUBLIC, anon, authenticated;

CREATE CONSTRAINT TRIGGER inventory_reservations_allocation_invariant
  AFTER INSERT OR UPDATE ON public.inventory_reservations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_inventory_reservation_allocation_invariant();

CREATE CONSTRAINT TRIGGER inventory_reservation_allocations_parent_invariant
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_reservation_allocations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_inventory_reservation_allocation_invariant();

CREATE OR REPLACE FUNCTION public.create_delivery_note_item_inventory_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_business_unit_id UUID;
  v_warehouse_business_unit_id UUID;
  v_qty_per_unit NUMERIC;
  v_base_qty NUMERIC;
  v_base_uom_id UUID;
  v_actor_id UUID;
BEGIN
  SELECT delivery_note.fulfilling_business_unit_id
  INTO v_business_unit_id
  FROM public.delivery_notes delivery_note
  WHERE delivery_note.id = NEW.dn_id
    AND delivery_note.company_id = NEW.company_id
    AND delivery_note.deleted_at IS NULL;

  SELECT warehouse.business_unit_id
  INTO v_warehouse_business_unit_id
  FROM public.warehouses warehouse
  WHERE warehouse.id = NEW.fulfilling_warehouse_id
    AND warehouse.company_id = NEW.company_id
    AND warehouse.deleted_at IS NULL;

  IF v_business_unit_id IS NULL
     OR v_warehouse_business_unit_id IS DISTINCT FROM v_business_unit_id THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_SCOPE_CONFLICT';
  END IF;

  SELECT GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1)
  INTO v_qty_per_unit
  FROM public.item_unit_options unit_option
  WHERE unit_option.id = NEW.item_unit_option_id
    AND unit_option.company_id = NEW.company_id
    AND unit_option.deleted_at IS NULL;

  v_qty_per_unit := GREATEST(COALESCE(v_qty_per_unit, 1), 1);
  v_base_qty := ROUND(COALESCE(NEW.allocated_qty, 0) * v_qty_per_unit, 2);
  SELECT item.uom_id
  INTO v_base_uom_id
  FROM public.items item
  WHERE item.id = NEW.item_id
    AND item.company_id = NEW.company_id
    AND item.deleted_at IS NULL;
  v_actor_id := COALESCE(auth.uid(), (
    SELECT delivery_note.created_by
    FROM public.delivery_notes delivery_note
    WHERE delivery_note.id = NEW.dn_id
  ));

  IF v_base_qty <= 0 OR v_actor_id IS NULL OR v_base_uom_id IS NULL THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_INVALID_QUANTITY';
  END IF;

  INSERT INTO public.inventory_reservations (
    company_id,
    reservation_type,
    source_type,
    source_id,
    business_unit_id,
    delivery_note_id,
    delivery_note_item_id,
    item_id,
    warehouse_id,
    quantity,
    uom_id,
    created_by,
    updated_by
  )
  VALUES (
    NEW.company_id,
    'delivery_note',
    'delivery_note_item',
    NEW.id,
    v_business_unit_id,
    NEW.dn_id,
    NEW.id,
    NEW.item_id,
    NEW.fulfilling_warehouse_id,
    v_base_qty,
    v_base_uom_id,
    v_actor_id,
    v_actor_id
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_delivery_note_item_inventory_reservation()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_create_delivery_note_item_inventory_reservation
  AFTER INSERT ON public.delivery_note_items
  FOR EACH ROW
  EXECUTE FUNCTION public.create_delivery_note_item_inventory_reservation();

CREATE OR REPLACE FUNCTION public.create_pick_list_item_inventory_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch_location RECORD;
  v_reservation RECORD;
  v_business_unit_id UUID;
  v_qty_per_unit NUMERIC;
  v_base_qty NUMERIC;
  v_actor_id UUID;
BEGIN
  SELECT pick_list.business_unit_id, COALESCE(pick_list.created_by, auth.uid())
  INTO v_business_unit_id, v_actor_id
  FROM public.pick_lists pick_list
  WHERE pick_list.id = NEW.pick_list_id
    AND pick_list.company_id = NEW.company_id
    AND pick_list.deleted_at IS NULL;

  SELECT
    batch_location.id,
    batch_location.item_batch_id,
    batch_location.warehouse_id
  INTO v_batch_location
  FROM public.item_batch_locations batch_location
  WHERE batch_location.company_id = NEW.company_id
    AND batch_location.item_id = NEW.item_id
    AND batch_location.batch_location_sku = NEW.suggested_batch_location_sku
    AND batch_location.deleted_at IS NULL;

  SELECT GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1)
  INTO v_qty_per_unit
  FROM public.item_unit_options unit_option
  WHERE unit_option.id = NEW.item_unit_option_id
    AND unit_option.company_id = NEW.company_id
    AND unit_option.deleted_at IS NULL;

  v_qty_per_unit := GREATEST(COALESCE(v_qty_per_unit, 1), 1);
  v_base_qty := ROUND(COALESCE(NEW.allocated_qty, 0) * v_qty_per_unit, 2);

  IF v_business_unit_id IS NULL OR v_actor_id IS NULL OR v_batch_location.id IS NULL
     OR v_base_qty <= 0 THEN
    RAISE EXCEPTION 'INVENTORY_ALLOCATION_SOURCE_REQUIRED';
  END IF;

  SELECT reservation.id, reservation.active_quantity_base
  INTO v_reservation
  FROM public.inventory_reservations reservation
  WHERE reservation.company_id = NEW.company_id
    AND reservation.delivery_note_item_id = NEW.dn_item_id
    AND reservation.item_id = NEW.item_id
    AND reservation.warehouse_id = v_batch_location.warehouse_id
    AND reservation.active_quantity_base > 0
  FOR UPDATE;

  IF NOT FOUND OR v_reservation.active_quantity_base < v_base_qty THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_ALLOCATION_CONFLICT';
  END IF;

  INSERT INTO public.inventory_reservation_allocations (
    company_id,
    business_unit_id,
    reservation_id,
    pick_list_id,
    pick_list_item_id,
    item_id,
    warehouse_id,
    item_batch_id,
    item_batch_location_id,
    quantity_base,
    created_by,
    updated_by
  )
  VALUES (
    NEW.company_id,
    v_business_unit_id,
    v_reservation.id,
    NEW.pick_list_id,
    NEW.id,
    NEW.item_id,
    v_batch_location.warehouse_id,
    v_batch_location.item_batch_id,
    v_batch_location.id,
    v_base_qty,
    v_actor_id,
    v_actor_id
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pick_list_item_inventory_allocation()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_create_pick_list_item_inventory_allocation
  AFTER INSERT ON public.pick_list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.create_pick_list_item_inventory_allocation();

CREATE OR REPLACE FUNCTION public.move_picked_inventory_reservation_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delta_qty NUMERIC;
  v_qty_per_unit NUMERIC;
  v_delta_base NUMERIC;
  v_pick_item RECORD;
  v_actual_source RECORD;
  v_planned_source RECORD;
  v_source_allocation RECORD;
  v_source_reservation RECORD;
  v_target_reservation_id UUID;
  v_actor_id UUID;
BEGIN
  v_delta_qty := COALESCE(NEW.picked_qty, 0) - CASE
    WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.picked_qty, 0)
    ELSE 0
  END;

  IF v_delta_qty <= 0 OR NEW.pick_list_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    pick_item.dn_item_id,
    pick_item.item_id,
    pick_item.item_unit_option_id,
    pick_item.suggested_batch_location_sku
  INTO v_pick_item
  FROM public.pick_list_items pick_item
  WHERE pick_item.id = NEW.pick_list_item_id
    AND pick_item.company_id = NEW.company_id
  FOR UPDATE;

  SELECT GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1)
  INTO v_qty_per_unit
  FROM public.item_unit_options unit_option
  WHERE unit_option.id = v_pick_item.item_unit_option_id
    AND unit_option.company_id = NEW.company_id
    AND unit_option.deleted_at IS NULL;

  v_qty_per_unit := GREATEST(COALESCE(v_qty_per_unit, 1), 1);
  v_delta_base := ROUND(v_delta_qty * v_qty_per_unit, 2);
  v_actor_id := COALESCE(NEW.updated_by, NEW.created_by, auth.uid());

  SELECT id, item_batch_id, warehouse_id
  INTO v_actual_source
  FROM public.item_batch_locations
  WHERE company_id = NEW.company_id
    AND item_id = NEW.item_id
    AND batch_location_sku = NEW.batch_location_sku
    AND deleted_at IS NULL;

  SELECT id, item_batch_id, warehouse_id
  INTO v_planned_source
  FROM public.item_batch_locations
  WHERE company_id = NEW.company_id
    AND item_id = NEW.item_id
    AND batch_location_sku = v_pick_item.suggested_batch_location_sku
    AND deleted_at IS NULL;

  IF v_actor_id IS NULL OR v_actual_source.id IS NULL OR v_planned_source.id IS NULL THEN
    RAISE EXCEPTION 'INVENTORY_ALLOCATION_SOURCE_REQUIRED';
  END IF;

  IF v_actual_source.id = v_planned_source.id THEN
    RETURN NEW;
  END IF;

  SELECT allocation.id, allocation.reservation_id, allocation.active_quantity_base
  INTO v_source_allocation
  FROM public.inventory_reservation_allocations allocation
  WHERE allocation.company_id = NEW.company_id
    AND allocation.pick_list_item_id = NEW.pick_list_item_id
    AND allocation.item_batch_location_id = v_planned_source.id
  FOR UPDATE;

  IF NOT FOUND OR v_source_allocation.active_quantity_base < v_delta_base THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_ALLOCATION_CONFLICT';
  END IF;

  SELECT
    reservation.id,
    reservation.company_id,
    reservation.business_unit_id,
    reservation.delivery_note_id,
    reservation.delivery_note_item_id,
    reservation.item_id,
    reservation.warehouse_id,
    reservation.uom_id
  INTO v_source_reservation
  FROM public.inventory_reservations reservation
  WHERE reservation.id = v_source_allocation.reservation_id
  FOR UPDATE;

  v_target_reservation_id := v_source_reservation.id;
  IF v_actual_source.warehouse_id IS DISTINCT FROM v_source_reservation.warehouse_id THEN
    INSERT INTO public.inventory_reservations (
      company_id,
      reservation_type,
      source_type,
      source_id,
      business_unit_id,
      delivery_note_id,
      delivery_note_item_id,
      item_id,
      warehouse_id,
      quantity,
      uom_id,
      transferred_in_base,
      created_by,
      updated_by
    )
    VALUES (
      v_source_reservation.company_id,
      'delivery_note',
      'delivery_note_item',
      v_source_reservation.delivery_note_item_id,
      v_source_reservation.business_unit_id,
      v_source_reservation.delivery_note_id,
      v_source_reservation.delivery_note_item_id,
      v_source_reservation.item_id,
      v_actual_source.warehouse_id,
      0,
      v_source_reservation.uom_id,
      v_delta_base,
      v_actor_id,
      v_actor_id
    )
    ON CONFLICT (delivery_note_item_id, warehouse_id)
    DO UPDATE SET
      transferred_in_base = inventory_reservations.transferred_in_base + EXCLUDED.transferred_in_base,
      version = inventory_reservations.version + 1,
      updated_at = NOW(),
      updated_by = EXCLUDED.updated_by
    RETURNING id INTO v_target_reservation_id;

    UPDATE public.inventory_reservations reservation
    SET transferred_out_base = reservation.transferred_out_base + v_delta_base,
        status = public.inventory_reservation_status(
          reservation.active_quantity_base - v_delta_base,
          reservation.consumed_base,
          reservation.released_base,
          reservation.transferred_out_base + v_delta_base
        ),
        version = reservation.version + 1,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE reservation.id = v_source_reservation.id;

    UPDATE public.inventory_reservations reservation
    SET status = public.inventory_reservation_status(
          reservation.active_quantity_base,
          reservation.consumed_base,
          reservation.released_base,
          reservation.transferred_out_base
        )
    WHERE reservation.id = v_target_reservation_id;
  END IF;

  UPDATE public.inventory_reservation_allocations allocation
  SET transferred_out_base = allocation.transferred_out_base + v_delta_base,
      status = public.inventory_reservation_status(
        allocation.active_quantity_base - v_delta_base,
        allocation.consumed_base,
        allocation.released_base,
        allocation.transferred_out_base + v_delta_base
      ),
      version = allocation.version + 1,
      updated_at = NOW(),
      updated_by = v_actor_id
  WHERE allocation.id = v_source_allocation.id;

  INSERT INTO public.inventory_reservation_allocations (
    company_id,
    business_unit_id,
    reservation_id,
    pick_list_id,
    pick_list_item_id,
    item_id,
    warehouse_id,
    item_batch_id,
    item_batch_location_id,
    quantity_base,
    transferred_in_base,
    created_by,
    updated_by
  )
  VALUES (
    NEW.company_id,
    v_source_reservation.business_unit_id,
    v_target_reservation_id,
    NEW.pick_list_id,
    NEW.pick_list_item_id,
    NEW.item_id,
    v_actual_source.warehouse_id,
    v_actual_source.item_batch_id,
    v_actual_source.id,
    0,
    v_delta_base,
    v_actor_id,
    v_actor_id
  )
  ON CONFLICT (pick_list_item_id, item_batch_location_id)
  DO UPDATE SET
    transferred_in_base = inventory_reservation_allocations.transferred_in_base
      + EXCLUDED.transferred_in_base,
    status = 'active',
    version = inventory_reservation_allocations.version + 1,
    updated_at = NOW(),
    updated_by = EXCLUDED.updated_by;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.move_picked_inventory_reservation_allocation()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_move_picked_inventory_reservation_allocation
  AFTER INSERT OR UPDATE OF picked_qty ON public.delivery_note_item_picks
  FOR EACH ROW
  EXECUTE FUNCTION public.move_picked_inventory_reservation_allocation();

CREATE OR REPLACE FUNCTION public.finalize_pick_list_inventory_allocations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allocation RECORD;
  v_desired_active NUMERIC;
  v_release_base NUMERIC;
  v_actor_id UUID;
BEGIN
  IF NEW.status IS DISTINCT FROM 'done' OR OLD.status = 'done' THEN
    RETURN NEW;
  END IF;

  v_actor_id := COALESCE(NEW.updated_by, NEW.created_by, auth.uid());
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_ACTOR_REQUIRED';
  END IF;

  FOR v_allocation IN
    SELECT allocation.id, allocation.active_quantity_base, batch_location.batch_location_sku
    FROM public.inventory_reservation_allocations allocation
    JOIN public.item_batch_locations batch_location
      ON batch_location.id = allocation.item_batch_location_id
    WHERE allocation.company_id = NEW.company_id
      AND allocation.pick_list_id = NEW.id
      AND allocation.active_quantity_base > 0
    ORDER BY allocation.id
    FOR UPDATE OF allocation
  LOOP
    SELECT COALESCE(SUM(
      pick.picked_qty * GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1)
    ), 0)
    INTO v_desired_active
    FROM public.delivery_note_item_picks pick
    JOIN public.pick_list_items pick_item
      ON pick_item.id = pick.pick_list_item_id
     AND pick_item.company_id = pick.company_id
    LEFT JOIN public.item_unit_options unit_option
      ON unit_option.id = pick_item.item_unit_option_id
     AND unit_option.company_id = pick_item.company_id
     AND unit_option.deleted_at IS NULL
    WHERE pick.company_id = NEW.company_id
      AND pick.pick_list_id = NEW.id
      AND pick.pick_list_item_id = (
        SELECT allocation.pick_list_item_id
        FROM public.inventory_reservation_allocations allocation
        WHERE allocation.id = v_allocation.id
      )
      AND pick.batch_location_sku = v_allocation.batch_location_sku
      AND pick.deleted_at IS NULL;

    v_desired_active := ROUND(v_desired_active, 2);
    IF v_desired_active > v_allocation.active_quantity_base THEN
      RAISE EXCEPTION 'INVENTORY_RESERVATION_ALLOCATION_CONFLICT';
    END IF;

    v_release_base := v_allocation.active_quantity_base - v_desired_active;
    IF v_release_base > 0 THEN
      UPDATE public.inventory_reservation_allocations allocation
      SET released_base = allocation.released_base + v_release_base,
          status = public.inventory_reservation_status(
            allocation.active_quantity_base - v_release_base,
            allocation.consumed_base,
            allocation.released_base + v_release_base,
            allocation.transferred_out_base
          ),
          version = allocation.version + 1,
          updated_at = NOW(),
          updated_by = v_actor_id
      WHERE allocation.id = v_allocation.id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_pick_list_inventory_allocations()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_pick_list_inventory_allocations
  AFTER UPDATE OF status ON public.pick_lists
  FOR EACH ROW
  WHEN (NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done')
  EXECUTE FUNCTION public.finalize_pick_list_inventory_allocations();

CREATE OR REPLACE FUNCTION public.cancel_pick_list_inventory_allocations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group RECORD;
  v_original_reservation_id UUID;
  v_actor_id UUID;
BEGIN
  IF NEW.status IS DISTINCT FROM 'cancelled' OR OLD.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  v_actor_id := COALESCE(NEW.updated_by, NEW.created_by, auth.uid());
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_ACTOR_REQUIRED';
  END IF;

  FOR v_group IN
    SELECT
      allocation.reservation_id,
      allocation.pick_list_item_id,
      reservation.delivery_note_item_id,
      reservation.warehouse_id,
      delivery_item.fulfilling_warehouse_id AS original_warehouse_id,
      SUM(allocation.active_quantity_base)::NUMERIC AS active_quantity_base
    FROM public.inventory_reservation_allocations allocation
    JOIN public.inventory_reservations reservation
      ON reservation.id = allocation.reservation_id
    JOIN public.delivery_note_items delivery_item
      ON delivery_item.id = reservation.delivery_note_item_id
    WHERE allocation.company_id = NEW.company_id
      AND allocation.pick_list_id = NEW.id
      AND allocation.active_quantity_base > 0
    GROUP BY
      allocation.reservation_id,
      allocation.pick_list_item_id,
      reservation.delivery_note_item_id,
      reservation.warehouse_id,
      delivery_item.fulfilling_warehouse_id
    ORDER BY allocation.reservation_id, allocation.pick_list_item_id
  LOOP
    IF v_group.warehouse_id IS DISTINCT FROM v_group.original_warehouse_id THEN
      SELECT reservation.id
      INTO v_original_reservation_id
      FROM public.inventory_reservations reservation
      WHERE reservation.delivery_note_item_id = v_group.delivery_note_item_id
        AND reservation.warehouse_id = v_group.original_warehouse_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'INVENTORY_RESERVATION_ALLOCATION_CONFLICT';
      END IF;

      UPDATE public.inventory_reservations reservation
      SET transferred_out_base = reservation.transferred_out_base + v_group.active_quantity_base,
          status = public.inventory_reservation_status(
            reservation.active_quantity_base - v_group.active_quantity_base,
            reservation.consumed_base,
            reservation.released_base,
            reservation.transferred_out_base + v_group.active_quantity_base
          ),
          version = reservation.version + 1,
          updated_at = NOW(),
          updated_by = v_actor_id
      WHERE reservation.id = v_group.reservation_id;

      UPDATE public.inventory_reservations reservation
      SET transferred_in_base = reservation.transferred_in_base + v_group.active_quantity_base,
          status = public.inventory_reservation_status(
            reservation.active_quantity_base + v_group.active_quantity_base,
            reservation.consumed_base,
            reservation.released_base,
            reservation.transferred_out_base
          ),
          version = reservation.version + 1,
          updated_at = NOW(),
          updated_by = v_actor_id
      WHERE reservation.id = v_original_reservation_id;
    END IF;
  END LOOP;

  UPDATE public.inventory_reservation_allocations allocation
  SET released_base = allocation.released_base + allocation.active_quantity_base,
      status = public.inventory_reservation_status(
        0,
        allocation.consumed_base,
        allocation.released_base + allocation.active_quantity_base,
        allocation.transferred_out_base
      ),
      version = allocation.version + 1,
      updated_at = NOW(),
      updated_by = v_actor_id
  WHERE allocation.company_id = NEW.company_id
    AND allocation.pick_list_id = NEW.id
    AND allocation.active_quantity_base > 0;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_pick_list_inventory_allocations()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_cancelled_pick_list_inventory_allocations
  AFTER UPDATE OF status ON public.pick_lists
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled')
  EXECUTE FUNCTION public.cancel_pick_list_inventory_allocations();

CREATE OR REPLACE FUNCTION public.finalize_delivery_note_inventory_reservations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reservation RECORD;
  v_consumed_base NUMERIC;
  v_release_base NUMERIC;
  v_reserved_stock NUMERIC;
  v_actor_id UUID;
BEGIN
  IF NEW.status NOT IN ('dispatched', 'voided') OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_actor_id := COALESCE(NEW.updated_by, NEW.created_by, auth.uid());
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_ACTOR_REQUIRED';
  END IF;

  IF NEW.status = 'voided' THEN
    UPDATE public.inventory_reservation_allocations allocation
    SET released_base = allocation.released_base + allocation.active_quantity_base,
        status = public.inventory_reservation_status(
          0,
          allocation.consumed_base,
          allocation.released_base + allocation.active_quantity_base,
          allocation.transferred_out_base
        ),
        version = allocation.version + 1,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE allocation.company_id = NEW.company_id
      AND allocation.reservation_id IN (
        SELECT reservation.id
        FROM public.inventory_reservations reservation
        WHERE reservation.delivery_note_id = NEW.id
      )
      AND allocation.active_quantity_base > 0;

    UPDATE public.inventory_reservations reservation
    SET released_base = reservation.released_base + reservation.active_quantity_base,
        status = public.inventory_reservation_status(
          0,
          reservation.consumed_base,
          reservation.released_base + reservation.active_quantity_base,
          reservation.transferred_out_base
        ),
        version = reservation.version + 1,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE reservation.company_id = NEW.company_id
      AND reservation.delivery_note_id = NEW.id
      AND reservation.active_quantity_base > 0;

    RETURN NEW;
  END IF;

  FOR v_reservation IN
    SELECT reservation.id, reservation.item_id, reservation.warehouse_id,
      reservation.active_quantity_base
    FROM public.inventory_reservations reservation
    WHERE reservation.company_id = NEW.company_id
      AND reservation.delivery_note_id = NEW.id
      AND reservation.active_quantity_base > 0
    ORDER BY reservation.warehouse_id, reservation.item_id, reservation.id
    FOR UPDATE
  LOOP
    SELECT COALESCE(SUM(allocation.active_quantity_base), 0)
    INTO v_consumed_base
    FROM public.inventory_reservation_allocations allocation
    WHERE allocation.reservation_id = v_reservation.id
      AND allocation.active_quantity_base > 0;

    v_consumed_base := ROUND(v_consumed_base, 2);
    IF v_consumed_base > v_reservation.active_quantity_base THEN
      RAISE EXCEPTION 'INVENTORY_RESERVATION_ALLOCATION_CONFLICT';
    END IF;

    UPDATE public.inventory_reservation_allocations allocation
    SET consumed_base = allocation.consumed_base + allocation.active_quantity_base,
        status = public.inventory_reservation_status(
          0,
          allocation.consumed_base + allocation.active_quantity_base,
          allocation.released_base,
          allocation.transferred_out_base
        ),
        version = allocation.version + 1,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE allocation.reservation_id = v_reservation.id
      AND allocation.active_quantity_base > 0;

    v_release_base := v_reservation.active_quantity_base - v_consumed_base;
    IF v_release_base > 0 THEN
      SELECT stock.reserved_stock
      INTO v_reserved_stock
      FROM public.item_warehouse stock
      WHERE stock.company_id = NEW.company_id
        AND stock.item_id = v_reservation.item_id
        AND stock.warehouse_id = v_reservation.warehouse_id
        AND stock.deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND OR COALESCE(v_reserved_stock, 0) < v_release_base THEN
        RAISE EXCEPTION 'INVENTORY_RESERVATION_PROJECTION_CONFLICT';
      END IF;

      UPDATE public.item_warehouse stock
      SET reserved_stock = COALESCE(stock.reserved_stock, 0) - v_release_base,
          updated_by = v_actor_id,
          updated_at = NOW()
      WHERE stock.company_id = NEW.company_id
        AND stock.item_id = v_reservation.item_id
        AND stock.warehouse_id = v_reservation.warehouse_id
        AND stock.deleted_at IS NULL;
    END IF;

    UPDATE public.inventory_reservations reservation
    SET consumed_base = reservation.consumed_base + v_consumed_base,
        released_base = reservation.released_base + v_release_base,
        status = public.inventory_reservation_status(
          0,
          reservation.consumed_base + v_consumed_base,
          reservation.released_base + v_release_base,
          reservation.transferred_out_base
        ),
        version = reservation.version + 1,
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE reservation.id = v_reservation.id;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_delivery_note_inventory_reservations()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_finalize_delivery_note_inventory_reservations
  AFTER UPDATE OF status ON public.delivery_notes
  FOR EACH ROW
  WHEN (
    NEW.status IN ('dispatched', 'voided')
    AND OLD.status IS DISTINCT FROM NEW.status
  )
  EXECUTE FUNCTION public.finalize_delivery_note_inventory_reservations();

COMMIT;
