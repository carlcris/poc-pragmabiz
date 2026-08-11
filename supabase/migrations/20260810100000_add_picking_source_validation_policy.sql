BEGIN;

CREATE OR REPLACE FUNCTION public.get_inventory_picking_policy(
  p_company_id UUID,
  p_business_unit_id UUID
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE COALESCE(
    (
      SELECT setting.value #>> '{}'
      FROM public.settings setting
      WHERE setting.company_id = p_company_id
        AND setting.business_unit_id = p_business_unit_id
        AND setting.group_key = 'inventory'
        AND setting.setting_key = 'picking_validation_policy'
      LIMIT 1
    ),
    'batch_only'
  )
    WHEN 'batch_and_warehouse' THEN 'batch_and_warehouse'
    WHEN 'batch_and_rack' THEN 'batch_and_rack'
    ELSE 'batch_only'
  END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_picking_policy(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_picking_policy(UUID, UUID)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_inventory_picking_policy(UUID, UUID) IS
  'Returns the validated BU-scoped picking policy, defaulting to batch_only.';

CREATE OR REPLACE FUNCTION public.save_settings_group_transactionally(
  p_company_id UUID,
  p_user_id UUID,
  p_business_unit_id UUID,
  p_group_key TEXT,
  p_settings JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_settings JSONB := COALESCE(p_settings, '{}'::JSONB);
  v_setting_count INTEGER;
  v_display_name TEXT;
  v_short_code TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'SETTINGS_UNAUTHORIZED';
  END IF;

  IF p_group_key NOT IN (
    'financial', 'inventory', 'pos', 'workflow', 'integration', 'business_unit', 'security'
  ) OR jsonb_typeof(v_settings) <> 'object' THEN
    RAISE EXCEPTION 'SETTINGS_INVALID_INPUT';
  END IF;

  SELECT COUNT(*) INTO v_setting_count FROM jsonb_object_keys(v_settings);
  IF v_setting_count > 100 OR EXISTS (
    SELECT 1
    FROM jsonb_each(v_settings) entry
    WHERE entry.key !~ '^[a-z][a-z0-9_]{0,99}$'
      OR entry.value = 'null'::JSONB
  ) THEN
    RAISE EXCEPTION 'SETTINGS_INVALID_INPUT';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users user_row
    WHERE user_row.id = p_user_id
      AND user_row.company_id = p_company_id
      AND user_row.deleted_at IS NULL
  ) OR p_business_unit_id IS NULL
     OR p_business_unit_id IS DISTINCT FROM public.get_current_business_unit_id()
     OR NOT public.user_has_permission(
       p_user_id,
       'company_settings',
       'edit',
       p_business_unit_id
     ) THEN
    RAISE EXCEPTION 'SETTINGS_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.business_units business_unit
    WHERE business_unit.id = p_business_unit_id
      AND business_unit.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'SETTINGS_BUSINESS_UNIT_NOT_FOUND';
  END IF;

  IF p_group_key = 'inventory'
     AND v_settings ? 'picking_validation_policy'
     AND v_settings->>'picking_validation_policy' NOT IN (
       'batch_only', 'batch_and_warehouse', 'batch_and_rack'
     ) THEN
    RAISE EXCEPTION 'SETTINGS_INVALID_PICKING_POLICY';
  END IF;

  IF p_group_key = 'business_unit' THEN
    v_display_name := NULLIF(BTRIM(v_settings->>'display_name'), '');
    v_short_code := NULLIF(BTRIM(v_settings->>'short_code'), '');

    IF v_settings ? 'display_name' OR v_settings ? 'short_code' THEN
      IF (v_settings ? 'display_name' AND v_display_name IS NULL)
         OR (v_settings ? 'short_code' AND v_short_code IS NULL) THEN
        RAISE EXCEPTION 'SETTINGS_INVALID_INPUT';
      END IF;

      UPDATE public.business_units
      SET name = CASE WHEN v_settings ? 'display_name' THEN v_display_name ELSE name END,
          code = CASE WHEN v_settings ? 'short_code' THEN v_short_code ELSE code END,
          updated_by = p_user_id,
          updated_at = NOW()
      WHERE id = p_business_unit_id
        AND company_id = p_company_id;
    END IF;

    v_settings := v_settings - ARRAY['display_name', 'short_code'];
  END IF;

  INSERT INTO public.settings (
    company_id,
    business_unit_id,
    group_key,
    setting_key,
    value,
    created_by,
    updated_by
  )
  SELECT
    p_company_id,
    p_business_unit_id,
    p_group_key,
    entry.key,
    entry.value,
    p_user_id,
    p_user_id
  FROM jsonb_each(v_settings) entry
  ON CONFLICT (company_id, business_unit_id, group_key, setting_key)
    WHERE business_unit_id IS NOT NULL
  DO UPDATE
  SET value = EXCLUDED.value,
      updated_by = p_user_id,
      updated_at = NOW();

  RETURN p_settings;
END;
$$;

REVOKE ALL ON FUNCTION public.save_settings_group_transactionally(
  UUID, UUID, UUID, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_settings_group_transactionally(
  UUID, UUID, UUID, TEXT, JSONB
) TO authenticated, service_role;

COMMENT ON FUNCTION public.save_settings_group_transactionally(UUID, UUID, UUID, TEXT, JSONB) IS
  'Atomically saves one BU-scoped settings group and its business-unit identity fields.';

CREATE OR REPLACE FUNCTION public.reserve_pick_list_item_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_base_qty NUMERIC;
  v_qty_per_unit NUMERIC;
  v_batch_location RECORD;
  v_batch RECORD;
BEGIN
  IF NEW.suggested_batch_location_sku IS NULL OR COALESCE(NEW.allocated_qty, 0) <= 0 THEN
    RAISE EXCEPTION 'PICK_ALLOCATION_SOURCE_REQUIRED';
  END IF;

  SELECT GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1)
  INTO v_qty_per_unit
  FROM public.item_unit_options unit_option
  WHERE unit_option.id = NEW.item_unit_option_id
    AND unit_option.company_id = NEW.company_id
    AND unit_option.deleted_at IS NULL;
  v_qty_per_unit := GREATEST(COALESCE(v_qty_per_unit, 1), 1);
  v_base_qty := NEW.allocated_qty * v_qty_per_unit;

  SELECT
    batch_location.id,
    batch_location.item_batch_id,
    batch_location.qty_on_hand,
    batch_location.qty_reserved
  INTO v_batch_location
  FROM public.item_batch_locations batch_location
  WHERE batch_location.company_id = NEW.company_id
    AND batch_location.item_id = NEW.item_id
    AND batch_location.batch_location_sku = NEW.suggested_batch_location_sku
    AND batch_location.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PICK_ALLOCATION_SOURCE_REQUIRED';
  END IF;

  SELECT batch.id, batch.qty_on_hand, batch.qty_reserved
  INTO v_batch
  FROM public.item_batches batch
  WHERE batch.id = v_batch_location.item_batch_id
    AND batch.company_id = NEW.company_id
    AND batch.item_id = NEW.item_id
    AND batch.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND
     OR COALESCE(v_batch_location.qty_on_hand, 0)
          - COALESCE(v_batch_location.qty_reserved, 0) < v_base_qty
     OR COALESCE(v_batch.qty_on_hand, 0) - COALESCE(v_batch.qty_reserved, 0) < v_base_qty THEN
    RAISE EXCEPTION 'PICK_ALLOCATION_INSUFFICIENT_BATCH_QUANTITY';
  END IF;

  UPDATE public.item_batch_locations
  SET qty_reserved = COALESCE(qty_reserved, 0) + v_base_qty,
      updated_at = NOW()
  WHERE id = v_batch_location.id;

  UPDATE public.item_batches
  SET qty_reserved = COALESCE(qty_reserved, 0) + v_base_qty,
      updated_at = NOW()
  WHERE id = v_batch.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_pick_list_item_source() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reserve_pick_list_item_source ON public.pick_list_items;
CREATE TRIGGER trg_reserve_pick_list_item_source
  AFTER INSERT ON public.pick_list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.reserve_pick_list_item_source();

COMMENT ON FUNCTION public.reserve_pick_list_item_source() IS
  'Reserves the exact batch and rack quantity when a pick-list allocation line is created.';

CREATE OR REPLACE FUNCTION public.release_pick_list_short_source_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_release RECORD;
  v_batch_location RECORD;
  v_batch RECORD;
BEGIN
  IF NEW.status IS DISTINCT FROM 'done' OR OLD.status = 'done' THEN
    RETURN NEW;
  END IF;

  FOR v_release IN
    SELECT
      item.item_id,
      item.suggested_batch_location_sku AS batch_location_sku,
      SUM(
        COALESCE(item.short_qty, 0)
          * GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1)
      )::NUMERIC AS base_qty
    FROM public.pick_list_items item
    LEFT JOIN public.item_unit_options unit_option
      ON unit_option.id = item.item_unit_option_id
     AND unit_option.company_id = item.company_id
     AND unit_option.deleted_at IS NULL
    WHERE item.company_id = NEW.company_id
      AND item.pick_list_id = NEW.id
      AND item.suggested_batch_location_sku IS NOT NULL
      AND COALESCE(item.short_qty, 0) > 0
    GROUP BY item.item_id, item.suggested_batch_location_sku
    ORDER BY item.suggested_batch_location_sku
  LOOP
    SELECT
      batch_location.id,
      batch_location.item_batch_id,
      batch_location.qty_reserved
    INTO v_batch_location
    FROM public.item_batch_locations batch_location
    WHERE batch_location.company_id = NEW.company_id
      AND batch_location.item_id = v_release.item_id
      AND batch_location.batch_location_sku = v_release.batch_location_sku
      AND batch_location.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PICK_LIST_SOURCE_RESERVATION_CONFLICT';
    END IF;

    SELECT batch.id, batch.qty_reserved
    INTO v_batch
    FROM public.item_batches batch
    WHERE batch.id = v_batch_location.item_batch_id
      AND batch.company_id = NEW.company_id
      AND batch.item_id = v_release.item_id
      AND batch.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND
       OR COALESCE(v_batch_location.qty_reserved, 0) < v_release.base_qty
       OR COALESCE(v_batch.qty_reserved, 0) < v_release.base_qty THEN
      RAISE EXCEPTION 'PICK_LIST_SOURCE_RESERVATION_CONFLICT';
    END IF;

    UPDATE public.item_batch_locations
    SET qty_reserved = COALESCE(qty_reserved, 0) - v_release.base_qty,
        updated_by = COALESCE(NEW.updated_by, NEW.created_by),
        updated_at = NOW()
    WHERE id = v_batch_location.id;

    UPDATE public.item_batches
    SET qty_reserved = COALESCE(qty_reserved, 0) - v_release.base_qty,
        updated_by = COALESCE(NEW.updated_by, NEW.created_by),
        updated_at = NOW()
    WHERE id = v_batch.id;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.release_pick_list_short_source_reservation()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_release_pick_list_short_source_reservation ON public.pick_lists;
CREATE TRIGGER trg_release_pick_list_short_source_reservation
  AFTER UPDATE OF status ON public.pick_lists
  FOR EACH ROW
  WHEN (NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done')
  EXECUTE FUNCTION public.release_pick_list_short_source_reservation();

COMMENT ON FUNCTION public.release_pick_list_short_source_reservation() IS
  'Releases unpicked batch and rack reservations when a pick list finalizes with short quantities.';

CREATE OR REPLACE FUNCTION public.move_pick_list_source_reservation(
  p_company_id UUID,
  p_user_id UUID,
  p_item_id UUID,
  p_from_batch_location_sku TEXT,
  p_to_batch_location_sku TEXT,
  p_base_qty NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from RECORD;
  v_to RECORD;
  v_from_batch RECORD;
  v_to_batch RECORD;
BEGIN
  IF p_base_qty IS NULL OR p_base_qty <= 0
     OR NULLIF(BTRIM(COALESCE(p_from_batch_location_sku, '')), '') IS NULL
     OR NULLIF(BTRIM(COALESCE(p_to_batch_location_sku, '')), '') IS NULL THEN
    RAISE EXCEPTION 'PICK_PROGRESS_RESERVATION_CONFLICT';
  END IF;

  PERFORM batch_location.id
  FROM public.item_batch_locations batch_location
  WHERE batch_location.company_id = p_company_id
    AND batch_location.item_id = p_item_id
    AND batch_location.batch_location_sku IN (
      p_from_batch_location_sku,
      p_to_batch_location_sku
    )
    AND batch_location.deleted_at IS NULL
  ORDER BY batch_location.id
  FOR UPDATE;

  SELECT
    batch_location.id,
    batch_location.item_batch_id,
    batch_location.qty_on_hand,
    batch_location.qty_reserved
  INTO v_from
  FROM public.item_batch_locations batch_location
  WHERE batch_location.company_id = p_company_id
    AND batch_location.item_id = p_item_id
    AND batch_location.batch_location_sku = p_from_batch_location_sku
    AND batch_location.deleted_at IS NULL;

  SELECT
    batch_location.id,
    batch_location.item_batch_id,
    batch_location.qty_on_hand,
    batch_location.qty_reserved
  INTO v_to
  FROM public.item_batch_locations batch_location
  WHERE batch_location.company_id = p_company_id
    AND batch_location.item_id = p_item_id
    AND batch_location.batch_location_sku = p_to_batch_location_sku
    AND batch_location.deleted_at IS NULL;

  IF v_from.id IS NULL OR v_to.id IS NULL THEN
    RAISE EXCEPTION 'PICK_PROGRESS_SOURCE_NOT_FOUND';
  END IF;

  PERFORM batch.id
  FROM public.item_batches batch
  WHERE batch.company_id = p_company_id
    AND batch.item_id = p_item_id
    AND batch.id IN (v_from.item_batch_id, v_to.item_batch_id)
    AND batch.deleted_at IS NULL
  ORDER BY batch.id
  FOR UPDATE;

  SELECT batch.id, batch.qty_on_hand, batch.qty_reserved
  INTO v_from_batch
  FROM public.item_batches batch
  WHERE batch.id = v_from.item_batch_id
    AND batch.company_id = p_company_id
    AND batch.item_id = p_item_id
    AND batch.deleted_at IS NULL;

  SELECT batch.id, batch.qty_on_hand, batch.qty_reserved
  INTO v_to_batch
  FROM public.item_batches batch
  WHERE batch.id = v_to.item_batch_id
    AND batch.company_id = p_company_id
    AND batch.item_id = p_item_id
    AND batch.deleted_at IS NULL;

  IF v_from_batch.id IS NULL OR v_to_batch.id IS NULL
     OR COALESCE(v_from.qty_reserved, 0) < p_base_qty
     OR COALESCE(v_from_batch.qty_reserved, 0) < p_base_qty THEN
    RAISE EXCEPTION 'PICK_PROGRESS_RESERVATION_CONFLICT';
  END IF;

  IF v_from.id = v_to.id THEN
    IF COALESCE(v_from.qty_on_hand, 0) < p_base_qty
       OR COALESCE(v_from_batch.qty_on_hand, 0) < p_base_qty THEN
      RAISE EXCEPTION 'PICK_PROGRESS_INSUFFICIENT_QUANTITY';
    END IF;
    RETURN;
  END IF;

  IF COALESCE(v_to.qty_on_hand, 0) - COALESCE(v_to.qty_reserved, 0) < p_base_qty
     OR (
       v_from.item_batch_id IS DISTINCT FROM v_to.item_batch_id
       AND COALESCE(v_to_batch.qty_on_hand, 0) - COALESCE(v_to_batch.qty_reserved, 0) < p_base_qty
     ) THEN
    RAISE EXCEPTION 'PICK_PROGRESS_INSUFFICIENT_QUANTITY';
  END IF;

  UPDATE public.item_batch_locations
  SET qty_reserved = COALESCE(qty_reserved, 0) - p_base_qty,
      updated_by = p_user_id,
      updated_at = NOW()
  WHERE id = v_from.id;

  UPDATE public.item_batch_locations
  SET qty_reserved = COALESCE(qty_reserved, 0) + p_base_qty,
      updated_by = p_user_id,
      updated_at = NOW()
  WHERE id = v_to.id;

  IF v_from.item_batch_id IS DISTINCT FROM v_to.item_batch_id THEN
    UPDATE public.item_batches
    SET qty_reserved = COALESCE(qty_reserved, 0) - p_base_qty,
        updated_by = p_user_id,
        updated_at = NOW()
    WHERE id = v_from.item_batch_id;

    UPDATE public.item_batches
    SET qty_reserved = COALESCE(qty_reserved, 0) + p_base_qty,
        updated_by = p_user_id,
        updated_at = NOW()
    WHERE id = v_to.item_batch_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.move_pick_list_source_reservation(
  UUID, UUID, UUID, TEXT, TEXT, NUMERIC
) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.move_pick_list_source_reservation(
  UUID, UUID, UUID, TEXT, TEXT, NUMERIC
) IS
  'Validates an exact allocated source or atomically moves reserved quantity to an acknowledged alternative source.';

CREATE OR REPLACE FUNCTION public.release_pick_list_source_reservations(
  p_company_id UUID,
  p_user_id UUID,
  p_pick_list_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_release RECORD;
  v_batch_location RECORD;
  v_batch RECORD;
  v_pick_list_status TEXT;
BEGIN
  SELECT pick_list.status
  INTO v_pick_list_status
  FROM public.pick_lists pick_list
  WHERE pick_list.id = p_pick_list_id
    AND pick_list.company_id = p_company_id
    AND pick_list.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PICK_LIST_SOURCE_RESERVATION_CONFLICT';
  END IF;

  FOR v_release IN
    WITH planned_allocations AS (
      SELECT
        item.id AS pick_list_item_id,
        item.item_id,
        item.suggested_batch_location_sku AS batch_location_sku,
        COALESCE(item.allocated_qty, 0)
          * GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1) AS base_qty,
        CASE
          WHEN v_pick_list_status = 'done' THEN
            COALESCE(item.short_qty, 0)
              * GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1)
          ELSE 0
        END AS released_short_base_qty
      FROM public.pick_list_items item
      LEFT JOIN public.item_unit_options unit_option
        ON unit_option.id = item.item_unit_option_id
       AND unit_option.company_id = item.company_id
       AND unit_option.deleted_at IS NULL
      WHERE item.company_id = p_company_id
        AND item.pick_list_id = p_pick_list_id
        AND item.suggested_batch_location_sku IS NOT NULL
    ),
    alternative_picks AS (
      SELECT
        pick.pick_list_item_id,
        pick.item_id,
        pick.batch_location_sku,
        SUM(
          COALESCE(pick.picked_qty, 0)
            * GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1)
        )::NUMERIC AS base_qty
      FROM public.delivery_note_item_picks pick
      JOIN public.pick_list_items item
        ON item.id = pick.pick_list_item_id
       AND item.company_id = pick.company_id
      LEFT JOIN public.item_unit_options unit_option
        ON unit_option.id = item.item_unit_option_id
       AND unit_option.company_id = item.company_id
       AND unit_option.deleted_at IS NULL
      WHERE pick.company_id = p_company_id
        AND pick.pick_list_id = p_pick_list_id
        AND pick.deleted_at IS NULL
        AND pick.batch_location_sku IS NOT NULL
        AND pick.batch_location_sku IS DISTINCT FROM item.suggested_batch_location_sku
      GROUP BY pick.pick_list_item_id, pick.item_id, pick.batch_location_sku
    ),
    planned_remaining AS (
      SELECT
        planned.item_id,
        planned.batch_location_sku,
        GREATEST(
          planned.base_qty - COALESCE((
            SELECT SUM(alternative.base_qty)
            FROM alternative_picks alternative
            WHERE alternative.pick_list_item_id = planned.pick_list_item_id
          ), 0) - planned.released_short_base_qty,
          0
        )::NUMERIC AS base_qty
      FROM planned_allocations planned
    ),
    final_reservations AS (
      SELECT item_id, batch_location_sku, base_qty FROM planned_remaining
      UNION ALL
      SELECT item_id, batch_location_sku, base_qty FROM alternative_picks
    )
    SELECT
      reservation.item_id,
      reservation.batch_location_sku,
      SUM(reservation.base_qty)::NUMERIC AS base_qty
    FROM final_reservations reservation
    WHERE reservation.batch_location_sku IS NOT NULL
      AND reservation.base_qty > 0
    GROUP BY reservation.item_id, reservation.batch_location_sku
    ORDER BY reservation.batch_location_sku
  LOOP
    SELECT
      batch_location.id,
      batch_location.item_batch_id,
      batch_location.qty_reserved
    INTO v_batch_location
    FROM public.item_batch_locations batch_location
    WHERE batch_location.company_id = p_company_id
      AND batch_location.item_id = v_release.item_id
      AND batch_location.batch_location_sku = v_release.batch_location_sku
      AND batch_location.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PICK_LIST_SOURCE_RESERVATION_CONFLICT';
    END IF;

    SELECT batch.id, batch.qty_reserved
    INTO v_batch
    FROM public.item_batches batch
    WHERE batch.id = v_batch_location.item_batch_id
      AND batch.company_id = p_company_id
      AND batch.item_id = v_release.item_id
      AND batch.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND
       OR COALESCE(v_batch_location.qty_reserved, 0) < v_release.base_qty
       OR COALESCE(v_batch.qty_reserved, 0) < v_release.base_qty THEN
      RAISE EXCEPTION 'PICK_LIST_SOURCE_RESERVATION_CONFLICT';
    END IF;

    UPDATE public.item_batch_locations
    SET qty_reserved = COALESCE(qty_reserved, 0) - v_release.base_qty,
        updated_by = p_user_id,
        updated_at = NOW()
    WHERE id = v_batch_location.id;

    UPDATE public.item_batches
    SET qty_reserved = COALESCE(qty_reserved, 0) - v_release.base_qty,
        updated_by = p_user_id,
        updated_at = NOW()
    WHERE id = v_batch.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.release_pick_list_source_reservations(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.release_pick_list_source_reservations(UUID, UUID, UUID) IS
  'Releases the exact source reservations still owned by one undispatched pick list.';

CREATE OR REPLACE FUNCTION public.record_pick_list_item_progress(
  p_company_id UUID,
  p_user_id UUID,
  p_pick_list_id UUID,
  p_pick_list_item_id UUID,
  p_operation_id UUID,
  p_picked_qty NUMERIC,
  p_batch_location_sku TEXT DEFAULT NULL,
  p_picked_location_id UUID DEFAULT NULL,
  p_picked_batch_code TEXT DEFAULT NULL,
  p_picked_batch_received_at TIMESTAMPTZ DEFAULT NULL,
  p_mismatch_acknowledged BOOLEAN DEFAULT FALSE,
  p_mismatch_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pick_list RECORD;
  v_pick_list_item RECORD;
  v_dn_line RECORD;
  v_policy TEXT;
  v_source_warehouse_id UUID;
  v_source_business_unit_id UUID;
  v_source_location_id UUID;
  v_source_batch_location_sku TEXT;
  v_source_batch_code TEXT;
  v_source_batch_received_at TIMESTAMPTZ;
  v_source_location_pickable BOOLEAN;
  v_source_location_active BOOLEAN;
  v_source_warehouse_active BOOLEAN;
  v_qty_per_unit NUMERIC;
  v_picked_base_qty NUMERIC;
  v_actual_available_stock NUMERIC;
  v_planned_reserved_stock NUMERIC;
  v_existing_pick_id UUID;
  v_is_mismatch BOOLEAN;
  v_operation_inserted BOOLEAN := FALSE;
  v_line_picked_total NUMERIC;
  v_dn_picked_total NUMERIC;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'PICK_PROGRESS_UNAUTHORIZED';
  END IF;
  IF p_operation_id IS NULL OR p_picked_qty IS NULL OR p_picked_qty <= 0 THEN
    RAISE EXCEPTION 'PICK_PROGRESS_INVALID_QUANTITY';
  END IF;
  v_source_batch_location_sku := NULLIF(BTRIM(COALESCE(p_batch_location_sku, '')), '');
  IF v_source_batch_location_sku IS NULL THEN
    RAISE EXCEPTION 'PICK_PROGRESS_SOURCE_REQUIRED';
  END IF;

  SELECT
    pick_list.status,
    pick_list.business_unit_id,
    pick_list.dn_id
  INTO v_pick_list
  FROM public.pick_lists pick_list
  WHERE pick_list.id = p_pick_list_id
    AND pick_list.company_id = p_company_id
    AND pick_list.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'PICK_PROGRESS_NOT_FOUND'; END IF;
  IF v_pick_list.status <> 'in_progress' THEN
    RAISE EXCEPTION 'PICK_PROGRESS_NOT_ACTIVE';
  END IF;
  IF v_pick_list.business_unit_id IS DISTINCT FROM public.get_current_business_unit_id()
     OR NOT public.user_has_permission(
       p_user_id, 'pick_lists', 'edit', v_pick_list.business_unit_id
     )
     OR (
       public.user_has_permission(
         p_user_id,
         'pick_lists.operation.view_only_assigned_pick_lists.view',
         'view',
         v_pick_list.business_unit_id
       )
       AND NOT EXISTS (
         SELECT 1
         FROM public.pick_list_assignees assignee
         WHERE assignee.company_id = p_company_id
           AND assignee.pick_list_id = p_pick_list_id
           AND assignee.user_id = p_user_id
       )
     ) THEN
    RAISE EXCEPTION 'PICK_PROGRESS_UNAUTHORIZED';
  END IF;

  SELECT
    item.dn_item_id,
    item.item_id,
    item.item_unit_option_id,
    item.allocated_qty,
    item.suggested_batch_location_sku,
    item.suggested_pick_location_id,
    item.suggested_pick_batch_code,
    item.suggested_pick_batch_received_at
  INTO v_pick_list_item
  FROM public.pick_list_items item
  WHERE item.id = p_pick_list_item_id
    AND item.company_id = p_company_id
    AND item.pick_list_id = p_pick_list_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'PICK_PROGRESS_LINE_NOT_FOUND'; END IF;
  IF v_pick_list_item.suggested_batch_location_sku IS NULL
     OR v_pick_list_item.suggested_pick_location_id IS NULL
     OR v_pick_list_item.suggested_pick_batch_code IS NULL
     OR v_pick_list_item.suggested_pick_batch_received_at IS NULL THEN
    RAISE EXCEPTION 'PICK_PROGRESS_SUGGESTED_SOURCE_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pick_list_item_pick_operations operation
    WHERE operation.operation_id = p_operation_id
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.pick_list_item_pick_operations operation
      WHERE operation.operation_id = p_operation_id
        AND operation.company_id = p_company_id
        AND operation.pick_list_id = p_pick_list_id
        AND operation.pick_list_item_id = p_pick_list_item_id
        AND operation.picker_user_id = p_user_id
        AND operation.picked_qty = p_picked_qty
    ) THEN
      RAISE EXCEPTION 'PICK_PROGRESS_OPERATION_CONFLICT';
    END IF;
    RETURN p_pick_list_item_id;
  END IF;

  SELECT
    line.id,
    line.fulfilling_warehouse_id
  INTO v_dn_line
  FROM public.delivery_note_items line
  WHERE line.id = v_pick_list_item.dn_item_id
    AND line.company_id = p_company_id
    AND line.dn_id = v_pick_list.dn_id
    AND line.is_voided IS FALSE
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'PICK_PROGRESS_LINE_NOT_FOUND'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pick_list_item_claims claim
    WHERE claim.company_id = p_company_id
      AND claim.pick_list_id = p_pick_list_id
      AND claim.pick_list_item_id = p_pick_list_item_id
      AND claim.claimed_by = p_user_id
      AND claim.released_at IS NULL
      AND claim.expires_at > NOW()
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'PICK_PROGRESS_CLAIM_REQUIRED';
  END IF;

  SELECT
    batch_location.warehouse_id,
    warehouse.business_unit_id,
    batch_location.location_id,
    batch_location.batch_location_sku,
    batch.batch_code,
    batch.received_at,
    location.is_pickable,
    location.is_active,
    warehouse.is_active
  INTO
    v_source_warehouse_id,
    v_source_business_unit_id,
    v_source_location_id,
    v_source_batch_location_sku,
    v_source_batch_code,
    v_source_batch_received_at,
    v_source_location_pickable,
    v_source_location_active,
    v_source_warehouse_active
  FROM public.item_batch_locations batch_location
  JOIN public.item_batches batch
    ON batch.id = batch_location.item_batch_id
   AND batch.company_id = batch_location.company_id
   AND batch.deleted_at IS NULL
  JOIN public.warehouses warehouse
    ON warehouse.id = batch_location.warehouse_id
   AND warehouse.company_id = batch_location.company_id
   AND warehouse.deleted_at IS NULL
  JOIN public.warehouse_locations location
    ON location.id = batch_location.location_id
   AND location.company_id = batch_location.company_id
   AND location.deleted_at IS NULL
  WHERE batch_location.company_id = p_company_id
    AND batch_location.batch_location_sku = v_source_batch_location_sku
    AND batch_location.item_id = v_pick_list_item.item_id
    AND batch_location.deleted_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'PICK_PROGRESS_SOURCE_NOT_FOUND'; END IF;
  IF NOT v_source_warehouse_active OR NOT v_source_location_active OR NOT v_source_location_pickable THEN
    RAISE EXCEPTION 'PICK_PROGRESS_SOURCE_UNAVAILABLE';
  END IF;
  IF v_source_business_unit_id IS DISTINCT FROM v_pick_list.business_unit_id THEN
    RAISE EXCEPTION 'PICK_PROGRESS_SOURCE_OUTSIDE_BUSINESS_UNIT';
  END IF;
  IF v_source_batch_code IS DISTINCT FROM v_pick_list_item.suggested_pick_batch_code
     OR v_source_batch_received_at IS DISTINCT FROM
       v_pick_list_item.suggested_pick_batch_received_at THEN
    RAISE EXCEPTION 'PICK_PROGRESS_BATCH_IDENTITY_MISMATCH';
  END IF;

  v_policy := public.get_inventory_picking_policy(p_company_id, v_pick_list.business_unit_id);
  IF v_policy IN ('batch_and_warehouse', 'batch_and_rack')
     AND v_source_warehouse_id IS DISTINCT FROM v_dn_line.fulfilling_warehouse_id THEN
    RAISE EXCEPTION 'PICK_PROGRESS_WAREHOUSE_POLICY_MISMATCH';
  END IF;
  IF v_policy = 'batch_and_rack'
     AND v_source_location_id IS DISTINCT FROM v_pick_list_item.suggested_pick_location_id THEN
    RAISE EXCEPTION 'PICK_PROGRESS_RACK_POLICY_MISMATCH';
  END IF;

  v_is_mismatch :=
    v_source_batch_location_sku IS DISTINCT FROM v_pick_list_item.suggested_batch_location_sku;
  IF v_is_mismatch AND NOT p_mismatch_acknowledged THEN
    RAISE EXCEPTION 'PICK_PROGRESS_MISMATCH_ACKNOWLEDGEMENT_REQUIRED';
  END IF;

  SELECT GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1)
  INTO v_qty_per_unit
  FROM public.item_unit_options unit_option
  WHERE unit_option.id = v_pick_list_item.item_unit_option_id
    AND unit_option.company_id = p_company_id
    AND unit_option.deleted_at IS NULL;
  v_qty_per_unit := GREATEST(COALESCE(v_qty_per_unit, 1), 1);
  v_picked_base_qty := p_picked_qty * v_qty_per_unit;

  SELECT COALESCE(SUM(pick.picked_qty), 0)
  INTO v_line_picked_total
  FROM public.delivery_note_item_picks pick
  WHERE pick.company_id = p_company_id
    AND pick.pick_list_id = p_pick_list_id
    AND pick.pick_list_item_id = p_pick_list_item_id
    AND pick.deleted_at IS NULL;

  IF v_line_picked_total + p_picked_qty > v_pick_list_item.allocated_qty THEN
    RAISE EXCEPTION 'PICK_PROGRESS_INVALID_QUANTITY';
  END IF;

  IF v_source_warehouse_id IS DISTINCT FROM v_dn_line.fulfilling_warehouse_id THEN
    PERFORM stock.id
    FROM public.item_warehouse stock
    WHERE stock.company_id = p_company_id
      AND stock.item_id = v_pick_list_item.item_id
      AND stock.warehouse_id IN (v_dn_line.fulfilling_warehouse_id, v_source_warehouse_id)
      AND stock.deleted_at IS NULL
    ORDER BY stock.warehouse_id
    FOR UPDATE;

    SELECT COALESCE(stock.reserved_stock, 0)
    INTO v_planned_reserved_stock
    FROM public.item_warehouse stock
    WHERE stock.company_id = p_company_id
      AND stock.item_id = v_pick_list_item.item_id
      AND stock.warehouse_id = v_dn_line.fulfilling_warehouse_id
      AND stock.deleted_at IS NULL;

    SELECT COALESCE(stock.available_stock, 0)
    INTO v_actual_available_stock
    FROM public.item_warehouse stock
    WHERE stock.company_id = p_company_id
      AND stock.item_id = v_pick_list_item.item_id
      AND stock.warehouse_id = v_source_warehouse_id
      AND stock.deleted_at IS NULL;

    IF v_planned_reserved_stock IS NULL OR v_planned_reserved_stock < v_picked_base_qty THEN
      RAISE EXCEPTION 'PICK_PROGRESS_RESERVATION_CONFLICT';
    END IF;
    IF v_actual_available_stock IS NULL OR v_actual_available_stock < v_picked_base_qty THEN
      RAISE EXCEPTION 'PICK_PROGRESS_ALTERNATIVE_SOURCE_UNAVAILABLE';
    END IF;
  END IF;

  INSERT INTO public.pick_list_item_pick_operations (
    operation_id, company_id, pick_list_id, pick_list_item_id, picker_user_id, picked_qty
  )
  VALUES (
    p_operation_id, p_company_id, p_pick_list_id, p_pick_list_item_id, p_user_id, p_picked_qty
  )
  ON CONFLICT (operation_id) DO NOTHING
  RETURNING TRUE INTO v_operation_inserted;

  IF NOT v_operation_inserted THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.pick_list_item_pick_operations operation
      WHERE operation.operation_id = p_operation_id
        AND operation.company_id = p_company_id
        AND operation.pick_list_id = p_pick_list_id
        AND operation.pick_list_item_id = p_pick_list_item_id
        AND operation.picker_user_id = p_user_id
        AND operation.picked_qty = p_picked_qty
    ) THEN
      RAISE EXCEPTION 'PICK_PROGRESS_OPERATION_CONFLICT';
    END IF;
    RETURN p_pick_list_item_id;
  END IF;

  PERFORM public.move_pick_list_source_reservation(
    p_company_id,
    p_user_id,
    v_pick_list_item.item_id,
    v_pick_list_item.suggested_batch_location_sku,
    v_source_batch_location_sku,
    v_picked_base_qty
  );

  IF v_source_warehouse_id IS DISTINCT FROM v_dn_line.fulfilling_warehouse_id THEN
    UPDATE public.item_warehouse
    SET reserved_stock = COALESCE(reserved_stock, 0) - v_picked_base_qty,
        updated_by = p_user_id,
        updated_at = v_now
    WHERE company_id = p_company_id
      AND item_id = v_pick_list_item.item_id
      AND warehouse_id = v_dn_line.fulfilling_warehouse_id
      AND deleted_at IS NULL;

    UPDATE public.item_warehouse
    SET reserved_stock = COALESCE(reserved_stock, 0) + v_picked_base_qty,
        updated_by = p_user_id,
        updated_at = v_now
    WHERE company_id = p_company_id
      AND item_id = v_pick_list_item.item_id
      AND warehouse_id = v_source_warehouse_id
      AND deleted_at IS NULL;
  END IF;

  SELECT pick.id
  INTO v_existing_pick_id
  FROM public.delivery_note_item_picks pick
  WHERE pick.company_id = p_company_id
    AND pick.pick_list_id = p_pick_list_id
    AND pick.pick_list_item_id = p_pick_list_item_id
    AND pick.source_warehouse_id = v_source_warehouse_id
    AND pick.picked_location_id = v_source_location_id
    AND pick.picked_batch_code = v_source_batch_code
    AND pick.picked_batch_received_at = v_source_batch_received_at
    AND pick.deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.delivery_note_item_picks
    SET picked_qty = picked_qty + p_picked_qty,
        batch_location_sku = v_source_batch_location_sku,
        picker_user_id = p_user_id,
        picked_at = v_now,
        is_mismatch_warning_acknowledged = v_is_mismatch,
        mismatch_reason = CASE
          WHEN v_is_mismatch THEN NULLIF(BTRIM(COALESCE(p_mismatch_reason, '')), '')
          ELSE NULL
        END,
        updated_by = p_user_id,
        updated_at = v_now
    WHERE id = v_existing_pick_id;
  ELSE
    INSERT INTO public.delivery_note_item_picks (
      company_id, dn_id, delivery_note_item_id, pick_list_item_id, pick_list_id, item_id,
      source_warehouse_id, picked_location_id, picked_batch_code, picked_batch_received_at,
      batch_location_sku, picked_qty, dispatched_qty, picker_user_id, picked_at,
      is_mismatch_warning_acknowledged, mismatch_reason, created_by, updated_by
    )
    VALUES (
      p_company_id, v_pick_list.dn_id, v_dn_line.id, p_pick_list_item_id, p_pick_list_id,
      v_pick_list_item.item_id, v_source_warehouse_id, v_source_location_id,
      v_source_batch_code, v_source_batch_received_at, v_source_batch_location_sku,
      p_picked_qty, 0, p_user_id, v_now, v_is_mismatch,
      CASE
        WHEN v_is_mismatch THEN NULLIF(BTRIM(COALESCE(p_mismatch_reason, '')), '')
        ELSE NULL
      END,
      p_user_id, p_user_id
    );
  END IF;

  SELECT COALESCE(SUM(pick.picked_qty), 0)
  INTO v_line_picked_total
  FROM public.delivery_note_item_picks pick
  WHERE pick.company_id = p_company_id
    AND pick.pick_list_id = p_pick_list_id
    AND pick.pick_list_item_id = p_pick_list_item_id
    AND pick.deleted_at IS NULL;

  UPDATE public.pick_list_items
  SET picked_qty = LEAST(allocated_qty, v_line_picked_total),
      short_qty = GREATEST(0, allocated_qty - v_line_picked_total),
      updated_at = v_now
  WHERE id = p_pick_list_item_id;

  SELECT COALESCE(SUM(item.picked_qty), 0)
  INTO v_dn_picked_total
  FROM public.pick_list_items item
  WHERE item.company_id = p_company_id
    AND item.pick_list_id = p_pick_list_id
    AND item.dn_item_id = v_dn_line.id;

  UPDATE public.delivery_note_items
  SET picked_qty = LEAST(allocated_qty, v_dn_picked_total),
      short_qty = GREATEST(0, allocated_qty - v_dn_picked_total),
      updated_at = v_now
  WHERE id = v_dn_line.id
    AND company_id = p_company_id;

  RETURN p_pick_list_item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_pick_list_item_progress(
  UUID, UUID, UUID, UUID, UUID, NUMERIC, TEXT, UUID, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_pick_list_item_progress(
  UUID, UUID, UUID, UUID, UUID, NUMERIC, TEXT, UUID, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT
) TO authenticated, service_role;

COMMENT ON FUNCTION public.record_pick_list_item_progress(
  UUID, UUID, UUID, UUID, UUID, NUMERIC, TEXT, UUID, TEXT, TIMESTAMPTZ, BOOLEAN, TEXT
) IS
  'Records one idempotent pick, enforces the BU picking policy, and atomically moves source and aggregate reservations for an allowed alternative.';

CREATE OR REPLACE FUNCTION public.post_delivery_note_dispatch(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_business_unit_id UUID,
  p_dispatch_date DATE,
  p_notes TEXT,
  p_driver_name TEXT,
  p_driver_signature TEXT,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dn RECORD;
  v_dn_item RECORD;
  v_source_stock RECORD;
  v_source_batch RECORD;
  v_source_batch_location RECORD;
  v_line JSONB;
  v_pick RECORD;
  v_delivery_note_item_id UUID;
  v_dispatch_qty NUMERIC;
  v_remaining_picked_qty NUMERIC;
  v_remaining_dispatch_qty NUMERIC;
  v_take_qty NUMERIC;
  v_take_base_qty NUMERIC;
  v_qty_per_unit NUMERIC;
  v_base_uom_id UUID;
  v_stock_before NUMERIC;
  v_stock_after NUMERIC;
  v_transaction_id UUID;
  v_has_dispatch BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
  v_posting_date DATE;
  v_posting_time TIME;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_DISPATCH_UNAUTHORIZED';
  END IF;
  IF jsonb_typeof(COALESCE(p_items, '[]'::JSONB)) <> 'array'
     OR jsonb_array_length(COALESCE(p_items, '[]'::JSONB)) = 0
     OR jsonb_array_length(COALESCE(p_items, '[]'::JSONB)) > 100 THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_DISPATCH_INVALID_ITEMS';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT NULLIF(value->>'deliveryNoteItemId', '') AS line_id, COUNT(*) AS occurrences
      FROM jsonb_array_elements(p_items)
      GROUP BY NULLIF(value->>'deliveryNoteItemId', '')
    ) duplicate_line
    WHERE duplicate_line.line_id IS NULL OR duplicate_line.occurrences > 1
  ) THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_DISPATCH_INVALID_ITEMS';
  END IF;

  SELECT
    delivery_note.status,
    delivery_note.fulfilling_business_unit_id,
    delivery_note.dn_no
  INTO v_dn
  FROM public.delivery_notes delivery_note
  WHERE delivery_note.id = p_dn_id
    AND delivery_note.company_id = p_company_id
    AND delivery_note.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_NOTE_NOT_FOUND'; END IF;
  IF v_dn.status <> 'dispatch_ready' THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_NOT_DISPATCH_READY';
  END IF;
  IF p_business_unit_id IS NULL
     OR p_business_unit_id IS DISTINCT FROM v_dn.fulfilling_business_unit_id
     OR p_business_unit_id IS DISTINCT FROM public.get_current_business_unit_id()
     OR NOT public.user_has_permission(
       p_user_id, 'delivery_notes', 'edit', p_business_unit_id
     ) THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_DISPATCH_UNAUTHORIZED';
  END IF;

  v_posting_date := COALESCE(p_dispatch_date, v_now::DATE);
  v_posting_time := v_now::TIME;

  FOR v_line IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_delivery_note_item_id := NULLIF(v_line->>'deliveryNoteItemId', '')::UUID;
      v_dispatch_qty := (v_line->>'dispatchQty')::NUMERIC;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_DISPATCH_INVALID_ITEMS';
    END;

    IF v_delivery_note_item_id IS NULL
       OR v_dispatch_qty IS NULL
       OR v_dispatch_qty <= 0 THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_DISPATCH_INVALID_ITEMS';
    END IF;

    SELECT
      line.id,
      line.item_id,
      line.item_unit_option_id,
      line.picked_qty,
      line.dispatched_qty,
      line.sr_item_id
    INTO v_dn_item
    FROM public.delivery_note_items line
    WHERE line.id = v_delivery_note_item_id
      AND line.company_id = p_company_id
      AND line.dn_id = p_dn_id
      AND line.is_voided IS FALSE
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_NOTE_ITEM_NOT_FOUND'; END IF;

    SELECT
      GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1),
      item.uom_id
    INTO v_qty_per_unit, v_base_uom_id
    FROM public.items item
    LEFT JOIN public.item_unit_options unit_option
      ON unit_option.id = v_dn_item.item_unit_option_id
     AND unit_option.company_id = item.company_id
     AND unit_option.deleted_at IS NULL
    WHERE item.id = v_dn_item.item_id
      AND item.company_id = p_company_id
      AND item.deleted_at IS NULL;

    IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_NOTE_ITEM_NOT_FOUND'; END IF;

    v_remaining_picked_qty := GREATEST(
      COALESCE(v_dn_item.picked_qty, 0) - COALESCE(v_dn_item.dispatched_qty, 0),
      0
    );
    IF v_dispatch_qty > v_remaining_picked_qty THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_DISPATCH_INVALID_QUANTITY';
    END IF;

    v_remaining_dispatch_qty := v_dispatch_qty;
    FOR v_pick IN
      SELECT
        pick.id,
        pick.source_warehouse_id,
        pick.picked_location_id,
        pick.picked_batch_code,
        pick.picked_batch_received_at,
        pick.batch_location_sku,
        GREATEST(COALESCE(pick.picked_qty, 0) - COALESCE(pick.dispatched_qty, 0), 0)
          AS remaining_qty
      FROM public.delivery_note_item_picks pick
      WHERE pick.company_id = p_company_id
        AND pick.dn_id = p_dn_id
        AND pick.delivery_note_item_id = v_dn_item.id
        AND pick.deleted_at IS NULL
        AND COALESCE(pick.picked_qty, 0) > COALESCE(pick.dispatched_qty, 0)
      ORDER BY pick.created_at, pick.id
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining_dispatch_qty <= 0;
      v_take_qty := LEAST(v_remaining_dispatch_qty, v_pick.remaining_qty);
      v_take_base_qty := v_take_qty * v_qty_per_unit;

      SELECT
        batch_location.id,
        batch_location.item_batch_id,
        batch_location.qty_on_hand,
        batch_location.qty_reserved
      INTO v_source_batch_location
      FROM public.item_batch_locations batch_location
      WHERE batch_location.company_id = p_company_id
        AND batch_location.batch_location_sku = v_pick.batch_location_sku
        AND batch_location.item_id = v_dn_item.item_id
        AND batch_location.warehouse_id = v_pick.source_warehouse_id
        AND batch_location.location_id = v_pick.picked_location_id
        AND batch_location.deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_NOTE_PICK_SOURCE_NOT_FOUND'; END IF;

      SELECT
        batch.id,
        batch.qty_on_hand,
        batch.qty_reserved
      INTO v_source_batch
      FROM public.item_batches batch
      WHERE batch.id = v_source_batch_location.item_batch_id
        AND batch.company_id = p_company_id
        AND batch.item_id = v_dn_item.item_id
        AND batch.warehouse_id = v_pick.source_warehouse_id
        AND batch.batch_code = v_pick.picked_batch_code
        AND batch.received_at = v_pick.picked_batch_received_at
        AND batch.deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_NOTE_PICK_SOURCE_NOT_FOUND'; END IF;
      IF COALESCE(v_source_batch_location.qty_on_hand, 0) < v_take_base_qty
         OR COALESCE(v_source_batch.qty_on_hand, 0) < v_take_base_qty
         OR COALESCE(v_source_batch_location.qty_reserved, 0) < v_take_base_qty
         OR COALESCE(v_source_batch.qty_reserved, 0) < v_take_base_qty THEN
        RAISE EXCEPTION 'DELIVERY_NOTE_PICK_SOURCE_INSUFFICIENT';
      END IF;

      SELECT
        stock.id,
        stock.current_stock,
        stock.reserved_stock
      INTO v_source_stock
      FROM public.item_warehouse stock
      WHERE stock.company_id = p_company_id
        AND stock.item_id = v_dn_item.item_id
        AND stock.warehouse_id = v_pick.source_warehouse_id
        AND stock.deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND
         OR COALESCE(v_source_stock.current_stock, 0) < v_take_base_qty
         OR COALESCE(v_source_stock.reserved_stock, 0) < v_take_base_qty THEN
        RAISE EXCEPTION 'DELIVERY_NOTE_DISPATCH_RESERVATION_CONFLICT';
      END IF;

      v_stock_before := COALESCE(v_source_stock.current_stock, 0);
      v_stock_after := v_stock_before - v_take_base_qty;

      UPDATE public.item_batch_locations
      SET qty_on_hand = qty_on_hand - v_take_base_qty,
          qty_reserved = COALESCE(qty_reserved, 0) - v_take_base_qty,
          updated_by = p_user_id,
          updated_at = v_now
      WHERE id = v_source_batch_location.id;

      UPDATE public.item_batches
      SET qty_on_hand = qty_on_hand - v_take_base_qty,
          qty_reserved = COALESCE(qty_reserved, 0) - v_take_base_qty,
          updated_by = p_user_id,
          updated_at = v_now
      WHERE id = v_source_batch.id;

      UPDATE public.item_warehouse
      SET current_stock = v_stock_after,
          reserved_stock = COALESCE(reserved_stock, 0) - v_take_base_qty,
          updated_by = p_user_id,
          updated_at = v_now
      WHERE id = v_source_stock.id;

      INSERT INTO public.stock_transactions (
        company_id, business_unit_id, transaction_type, transaction_date,
        warehouse_id, from_location_id, reference_type, reference_id,
        reference_code, status, notes, created_by, updated_by
      )
      VALUES (
        p_company_id, p_business_unit_id, 'out', v_posting_date,
        v_pick.source_warehouse_id, v_pick.picked_location_id, 'delivery_note', p_dn_id,
        v_dn.dn_no, 'posted',
        COALESCE(NULLIF(BTRIM(p_notes), ''), 'Delivery note ' || v_dn.dn_no || ' dispatched'),
        p_user_id, p_user_id
      )
      RETURNING id INTO v_transaction_id;

      INSERT INTO public.stock_transaction_items (
        company_id, transaction_id, item_id, quantity, uom_id,
        qty_before, qty_after, posting_date, posting_time, notes,
        created_by, updated_by
      )
      VALUES (
        p_company_id, v_transaction_id, v_dn_item.item_id, v_take_base_qty, v_base_uom_id,
        v_stock_before, v_stock_after, v_posting_date, v_posting_time,
        COALESCE(NULLIF(BTRIM(p_notes), ''), 'Delivery note ' || v_dn.dn_no || ' dispatched'),
        p_user_id, p_user_id
      );

      UPDATE public.delivery_note_item_picks
      SET dispatched_qty = COALESCE(dispatched_qty, 0) + v_take_qty,
          updated_by = p_user_id,
          updated_at = v_now
      WHERE id = v_pick.id;

      v_remaining_dispatch_qty := v_remaining_dispatch_qty - v_take_qty;
      v_has_dispatch := TRUE;
    END LOOP;

    IF v_remaining_dispatch_qty > 0 THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_DISPATCH_PICK_SHORTAGE';
    END IF;

    UPDATE public.delivery_note_items
    SET dispatched_qty = COALESCE(dispatched_qty, 0) + v_dispatch_qty,
        updated_at = v_now
    WHERE id = v_dn_item.id;

    UPDATE public.stock_request_items
    SET dispatch_qty = COALESCE(dispatch_qty, 0) + v_dispatch_qty,
        updated_at = v_now
    WHERE id = v_dn_item.sr_item_id;
  END LOOP;

  IF NOT v_has_dispatch THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_DISPATCH_INVALID_ITEMS';
  END IF;

  UPDATE public.delivery_notes
  SET status = 'dispatched',
      dispatched_at = v_now,
      driver_name = COALESCE(NULLIF(BTRIM(p_driver_name), ''), driver_name),
      driver_signature = COALESCE(NULLIF(BTRIM(p_driver_signature), ''), driver_signature),
      notes = COALESCE(NULLIF(BTRIM(p_notes), ''), notes),
      updated_by = p_user_id,
      updated_at = v_now
  WHERE id = p_dn_id
    AND company_id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.post_delivery_note_dispatch(
  UUID, UUID, UUID, UUID, DATE, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_delivery_note_dispatch(
  UUID, UUID, UUID, UUID, DATE, TEXT, TEXT, TEXT, JSONB
) TO authenticated, service_role;

COMMENT ON FUNCTION public.post_delivery_note_dispatch(
  UUID, UUID, UUID, UUID, DATE, TEXT, TEXT, TEXT, JSONB
) IS
  'Atomically dispatches each picked quantity and consumes its warehouse, batch, and rack reservation.';

CREATE OR REPLACE FUNCTION public.cancel_pick_list_reset_progress(
  p_company_id UUID,
  p_user_id UUID,
  p_pick_list_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pick_list RECORD;
  v_move RECORD;
  v_actual_reserved NUMERIC;
  v_planned_available NUMERIC;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'PICK_LIST_UNAUTHORIZED';
  END IF;

  SELECT
    pick_list.status,
    pick_list.business_unit_id,
    pick_list.dn_id
  INTO v_pick_list
  FROM public.pick_lists pick_list
  WHERE pick_list.id = p_pick_list_id
    AND pick_list.company_id = p_company_id
    AND pick_list.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'PICK_LIST_NOT_FOUND'; END IF;
  IF v_pick_list.status NOT IN ('pending', 'in_progress', 'paused') THEN
    RAISE EXCEPTION 'PICK_LIST_CANNOT_CANCEL';
  END IF;
  IF v_pick_list.business_unit_id IS DISTINCT FROM public.get_current_business_unit_id()
     OR NOT public.user_has_permission(
       p_user_id, 'pick_lists', 'edit', v_pick_list.business_unit_id
     ) THEN
    RAISE EXCEPTION 'PICK_LIST_UNAUTHORIZED';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.delivery_note_items line
    WHERE line.company_id = p_company_id
      AND line.dn_id = v_pick_list.dn_id
      AND COALESCE(line.dispatched_qty, 0) > 0
  ) THEN
    RAISE EXCEPTION 'PICK_LIST_DISPATCH_STARTED';
  END IF;

  PERFORM public.release_pick_list_source_reservations(
    p_company_id,
    p_user_id,
    p_pick_list_id
  );

  FOR v_move IN
    SELECT
      pick.item_id,
      line.fulfilling_warehouse_id AS planned_warehouse_id,
      pick.source_warehouse_id AS actual_warehouse_id,
      SUM(
        COALESCE(pick.picked_qty, 0)
          * GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1)
      )::NUMERIC AS base_qty
    FROM public.delivery_note_item_picks pick
    JOIN public.delivery_note_items line
      ON line.id = pick.delivery_note_item_id
     AND line.company_id = pick.company_id
    LEFT JOIN public.item_unit_options unit_option
      ON unit_option.id = line.item_unit_option_id
     AND unit_option.company_id = line.company_id
     AND unit_option.deleted_at IS NULL
    WHERE pick.company_id = p_company_id
      AND pick.pick_list_id = p_pick_list_id
      AND pick.deleted_at IS NULL
      AND pick.source_warehouse_id IS DISTINCT FROM line.fulfilling_warehouse_id
    GROUP BY pick.item_id, line.fulfilling_warehouse_id, pick.source_warehouse_id
    ORDER BY pick.item_id, line.fulfilling_warehouse_id, pick.source_warehouse_id
  LOOP
    PERFORM stock.id
    FROM public.item_warehouse stock
    WHERE stock.company_id = p_company_id
      AND stock.item_id = v_move.item_id
      AND stock.warehouse_id IN (v_move.planned_warehouse_id, v_move.actual_warehouse_id)
      AND stock.deleted_at IS NULL
    ORDER BY stock.warehouse_id
    FOR UPDATE;

    SELECT COALESCE(stock.reserved_stock, 0)
    INTO v_actual_reserved
    FROM public.item_warehouse stock
    WHERE stock.company_id = p_company_id
      AND stock.item_id = v_move.item_id
      AND stock.warehouse_id = v_move.actual_warehouse_id
      AND stock.deleted_at IS NULL;

    SELECT COALESCE(stock.available_stock, 0)
    INTO v_planned_available
    FROM public.item_warehouse stock
    WHERE stock.company_id = p_company_id
      AND stock.item_id = v_move.item_id
      AND stock.warehouse_id = v_move.planned_warehouse_id
      AND stock.deleted_at IS NULL;

    IF v_actual_reserved IS NULL OR v_actual_reserved < v_move.base_qty
       OR v_planned_available IS NULL OR v_planned_available < v_move.base_qty THEN
      RAISE EXCEPTION 'PICK_LIST_RESERVATION_CONFLICT';
    END IF;

    UPDATE public.item_warehouse
    SET reserved_stock = COALESCE(reserved_stock, 0) - v_move.base_qty,
        updated_by = p_user_id,
        updated_at = v_now
    WHERE company_id = p_company_id
      AND item_id = v_move.item_id
      AND warehouse_id = v_move.actual_warehouse_id
      AND deleted_at IS NULL;

    UPDATE public.item_warehouse
    SET reserved_stock = COALESCE(reserved_stock, 0) + v_move.base_qty,
        updated_by = p_user_id,
        updated_at = v_now
    WHERE company_id = p_company_id
      AND item_id = v_move.item_id
      AND warehouse_id = v_move.planned_warehouse_id
      AND deleted_at IS NULL;
  END LOOP;

  UPDATE public.pick_list_items
  SET picked_qty = 0,
      short_qty = allocated_qty,
      updated_at = v_now
  WHERE company_id = p_company_id
    AND pick_list_id = p_pick_list_id;

  UPDATE public.delivery_note_item_picks
  SET deleted_at = v_now,
      updated_at = v_now,
      updated_by = p_user_id
  WHERE company_id = p_company_id
    AND pick_list_id = p_pick_list_id
    AND deleted_at IS NULL;

  UPDATE public.delivery_note_items line
  SET picked_qty = 0,
      short_qty = line.allocated_qty,
      updated_at = v_now
  WHERE line.company_id = p_company_id
    AND line.dn_id = v_pick_list.dn_id;

  UPDATE public.pick_lists
  SET status = 'cancelled',
      cancel_reason = NULLIF(BTRIM(COALESCE(p_reason, '')), ''),
      updated_by = p_user_id,
      updated_at = v_now
  WHERE id = p_pick_list_id
    AND company_id = p_company_id;

  UPDATE public.delivery_notes
  SET status = 'confirmed',
      picking_started_at = NULL,
      picking_started_by = NULL,
      picking_completed_at = NULL,
      picking_completed_by = NULL,
      updated_by = p_user_id,
      updated_at = v_now
  WHERE id = v_pick_list.dn_id
    AND company_id = p_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_delivery_note_pre_dispatch(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dn RECORD;
  v_release RECORD;
  v_source_pick_list RECORD;
  v_reserved NUMERIC;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_UNAUTHORIZED';
  END IF;

  SELECT
    delivery_note.status,
    delivery_note.fulfilling_business_unit_id
  INTO v_dn
  FROM public.delivery_notes delivery_note
  WHERE delivery_note.id = p_dn_id
    AND delivery_note.company_id = p_company_id
    AND delivery_note.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'DELIVERY_NOTE_NOT_FOUND'; END IF;
  IF v_dn.fulfilling_business_unit_id IS DISTINCT FROM public.get_current_business_unit_id()
     OR NOT public.user_has_permission(
       p_user_id, 'delivery_notes', 'edit', v_dn.fulfilling_business_unit_id
     ) THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_UNAUTHORIZED';
  END IF;
  IF v_dn.status NOT IN (
    'draft', 'confirmed', 'queued_for_picking', 'picking_in_progress', 'dispatch_ready'
  ) OR EXISTS (
    SELECT 1
    FROM public.delivery_note_items line
    WHERE line.company_id = p_company_id
      AND line.dn_id = p_dn_id
      AND COALESCE(line.dispatched_qty, 0) > 0
  ) THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_CANNOT_VOID';
  END IF;

  FOR v_source_pick_list IN
    SELECT pick_list.id
    FROM public.pick_lists pick_list
    WHERE pick_list.company_id = p_company_id
      AND pick_list.dn_id = p_dn_id
      AND pick_list.deleted_at IS NULL
      AND pick_list.status <> 'cancelled'
    ORDER BY pick_list.id
    FOR UPDATE
  LOOP
    PERFORM public.release_pick_list_source_reservations(
      p_company_id,
      p_user_id,
      v_source_pick_list.id
    );
  END LOOP;

  FOR v_release IN
    WITH line_allocations AS (
      SELECT
        line.id AS delivery_note_item_id,
        line.item_id,
        line.fulfilling_warehouse_id AS warehouse_id,
        COALESCE(line.allocated_qty, 0)
          * GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1) AS allocated_base_qty
      FROM public.delivery_note_items line
      LEFT JOIN public.item_unit_options unit_option
        ON unit_option.id = line.item_unit_option_id
       AND unit_option.company_id = line.company_id
       AND unit_option.deleted_at IS NULL
      WHERE line.company_id = p_company_id
        AND line.dn_id = p_dn_id
        AND line.is_voided IS FALSE
    ),
    alternative_picks AS (
      SELECT
        pick.delivery_note_item_id,
        pick.item_id,
        pick.source_warehouse_id AS warehouse_id,
        SUM(
          COALESCE(pick.picked_qty, 0)
            * GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1)
        )::NUMERIC AS base_qty
      FROM public.delivery_note_item_picks pick
      JOIN public.delivery_note_items line
        ON line.id = pick.delivery_note_item_id
       AND line.company_id = pick.company_id
      LEFT JOIN public.item_unit_options unit_option
        ON unit_option.id = line.item_unit_option_id
       AND unit_option.company_id = line.company_id
       AND unit_option.deleted_at IS NULL
      WHERE pick.company_id = p_company_id
        AND pick.dn_id = p_dn_id
        AND pick.deleted_at IS NULL
        AND pick.source_warehouse_id IS DISTINCT FROM line.fulfilling_warehouse_id
      GROUP BY pick.delivery_note_item_id, pick.item_id, pick.source_warehouse_id
    ),
    planned_releases AS (
      SELECT
        allocation.item_id,
        allocation.warehouse_id,
        GREATEST(
          allocation.allocated_base_qty - COALESCE((
            SELECT SUM(alternative.base_qty)
            FROM alternative_picks alternative
            WHERE alternative.delivery_note_item_id = allocation.delivery_note_item_id
          ), 0),
          0
        )::NUMERIC AS base_qty
      FROM line_allocations allocation
    ),
    all_releases AS (
      SELECT item_id, warehouse_id, base_qty FROM planned_releases
      UNION ALL
      SELECT item_id, warehouse_id, base_qty FROM alternative_picks
    )
    SELECT item_id, warehouse_id, SUM(base_qty)::NUMERIC AS base_qty
    FROM all_releases
    WHERE warehouse_id IS NOT NULL AND base_qty > 0
    GROUP BY item_id, warehouse_id
    ORDER BY item_id, warehouse_id
  LOOP
    SELECT COALESCE(stock.reserved_stock, 0)
    INTO v_reserved
    FROM public.item_warehouse stock
    WHERE stock.company_id = p_company_id
      AND stock.item_id = v_release.item_id
      AND stock.warehouse_id = v_release.warehouse_id
      AND stock.deleted_at IS NULL
    FOR UPDATE;

    IF v_reserved IS NULL OR v_reserved < v_release.base_qty THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_RESERVATION_CONFLICT';
    END IF;

    UPDATE public.item_warehouse
    SET reserved_stock = COALESCE(reserved_stock, 0) - v_release.base_qty,
        updated_by = p_user_id,
        updated_at = v_now
    WHERE company_id = p_company_id
      AND item_id = v_release.item_id
      AND warehouse_id = v_release.warehouse_id
      AND deleted_at IS NULL;
  END LOOP;

  UPDATE public.pick_list_items item
  SET picked_qty = 0,
      short_qty = item.allocated_qty,
      updated_at = v_now
  FROM public.pick_lists pick_list
  WHERE pick_list.id = item.pick_list_id
    AND pick_list.company_id = p_company_id
    AND pick_list.dn_id = p_dn_id
    AND item.company_id = p_company_id;

  UPDATE public.pick_lists
  SET status = 'cancelled',
      cancel_reason = 'Delivery note voided' || COALESCE(': ' || NULLIF(BTRIM(p_reason), ''), ''),
      updated_by = p_user_id,
      updated_at = v_now
  WHERE company_id = p_company_id
    AND dn_id = p_dn_id
    AND deleted_at IS NULL
    AND status <> 'cancelled';

  UPDATE public.delivery_note_item_picks
  SET deleted_at = v_now,
      updated_at = v_now,
      updated_by = p_user_id
  WHERE company_id = p_company_id
    AND dn_id = p_dn_id
    AND deleted_at IS NULL;

  UPDATE public.delivery_note_items
  SET picked_qty = 0,
      short_qty = allocated_qty,
      updated_at = v_now
  WHERE company_id = p_company_id
    AND dn_id = p_dn_id;

  UPDATE public.delivery_notes
  SET status = 'voided',
      voided_at = v_now,
      void_reason = NULLIF(BTRIM(COALESCE(p_reason, '')), ''),
      updated_by = p_user_id,
      updated_at = v_now
  WHERE id = p_dn_id
    AND company_id = p_company_id;
END;
$$;

DROP FUNCTION IF EXISTS public.cancel_pick_list_reset_progress(UUID, UUID, UUID);

REVOKE ALL ON FUNCTION public.cancel_pick_list_reset_progress(UUID, UUID, UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_pick_list_reset_progress(UUID, UUID, UUID, TEXT)
  TO authenticated, service_role;

COMMIT;
