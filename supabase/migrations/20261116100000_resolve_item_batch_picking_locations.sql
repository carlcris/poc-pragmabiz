-- QR identity is item + batch code. Location remains an internal stock-source identity.
-- Invoker access preserves table privileges and RLS; no writes occur during resolution.
CREATE FUNCTION public.get_pick_item_batch_sources(
  p_company_id UUID,
  p_pick_list_id UUID,
  p_item_id UUID,
  p_batch_code TEXT,
  p_location_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 1
)
RETURNS TABLE (
  batch_location_sku TEXT,
  warehouse_id UUID,
  warehouse_name TEXT,
  location_id UUID,
  location_code TEXT,
  location_name TEXT,
  location_path_ids UUID[],
  batch_received_at TIMESTAMPTZ,
  qty_on_hand NUMERIC,
  pick_list_item_id UUID,
  delivery_note_item_id UUID,
  allocated_qty NUMERIC,
  picked_qty NUMERIC,
  remaining_base_qty NUMERIC,
  is_suggested BOOLEAN,
  available_base_qty NUMERIC,
  max_pick_qty NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_business_unit_id UUID;
  v_actor_id UUID := (SELECT auth.uid());
  v_policy TEXT;
BEGIN
  IF p_page IS NULL OR p_page < 1 OR p_page > 10000
     OR p_batch_code IS NULL OR length(btrim(p_batch_code)) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'PICK_SOURCE_INVALID_INPUT';
  END IF;

  SELECT list.business_unit_id INTO v_business_unit_id
  FROM public.pick_lists list
  WHERE list.id = p_pick_list_id AND list.company_id = p_company_id
    AND list.deleted_at IS NULL AND list.status = 'in_progress';
  IF NOT FOUND THEN RAISE EXCEPTION 'PICK_SOURCE_NOT_ACTIVE'; END IF;
  IF v_actor_id IS NULL
     OR v_business_unit_id IS DISTINCT FROM public.get_current_business_unit_id()
     OR NOT public.user_has_permission(v_actor_id, 'pick_lists', 'edit', v_business_unit_id)
     OR (public.user_has_permission(v_actor_id,
          'pick_lists.operation.view_only_assigned_pick_lists.view', 'view', v_business_unit_id)
       AND NOT EXISTS (
         SELECT 1 FROM public.pick_list_assignees assignee
         WHERE assignee.company_id = p_company_id AND assignee.pick_list_id = p_pick_list_id
           AND assignee.user_id = v_actor_id
       )) THEN
    RAISE EXCEPTION 'PICK_SOURCE_FORBIDDEN';
  END IF;
  v_policy := public.get_inventory_picking_policy(p_company_id, v_business_unit_id);

  RETURN QUERY
  WITH lines AS MATERIALIZED (
    SELECT line.id, line.dn_item_id, line.allocated_qty, line.picked_qty, line.created_at,
      line.allocated_qty - line.picked_qty AS remaining_qty, line.suggested_pick_location_id,
      line.suggested_pick_batch_received_at, dn_line.fulfilling_warehouse_id,
      planned_stock.id AS planned_stock_id, planned_batch.id AS planned_batch_id,
      conversion.qty_per_unit,
      -- A recorded pick at the suggested source still occupies its original allocation.
      LEAST(planned_stock.qty_reserved, planned_batch.qty_reserved, allocation.active_quantity_base)
        - COALESCE(planned_picks.qty, 0) * conversion.qty_per_unit AS planned_base_qty,
      allocation.id IS NOT NULL AS has_planned_allocation,
      COALESCE(planned_warehouse_stock.reserved_stock, 0) AS planned_warehouse_reserved
    FROM public.pick_list_items line
    JOIN public.delivery_note_items dn_line ON dn_line.id = line.dn_item_id
      AND dn_line.company_id = line.company_id AND dn_line.is_voided IS FALSE
    LEFT JOIN public.item_unit_options unit_option ON unit_option.id = line.item_unit_option_id
      AND unit_option.company_id = line.company_id AND unit_option.deleted_at IS NULL
    CROSS JOIN LATERAL (
      SELECT GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1) AS qty_per_unit
    ) conversion
    JOIN public.item_batch_locations planned_stock
      ON planned_stock.company_id = line.company_id AND planned_stock.item_id = line.item_id
      AND planned_stock.batch_location_sku = line.suggested_batch_location_sku
      AND planned_stock.deleted_at IS NULL
    JOIN public.item_batches planned_batch ON planned_batch.id = planned_stock.item_batch_id
      AND planned_batch.company_id = line.company_id AND planned_batch.item_id = line.item_id
      AND planned_batch.deleted_at IS NULL
    LEFT JOIN public.inventory_reservation_allocations allocation
      ON allocation.company_id = line.company_id AND allocation.pick_list_item_id = line.id
      AND allocation.item_batch_location_id = planned_stock.id
    LEFT JOIN public.item_warehouse planned_warehouse_stock
      ON v_policy = 'batch_only' AND planned_warehouse_stock.company_id = line.company_id
      AND planned_warehouse_stock.item_id = line.item_id AND planned_warehouse_stock.deleted_at IS NULL
      AND planned_warehouse_stock.warehouse_id = dn_line.fulfilling_warehouse_id
    LEFT JOIN LATERAL (
      SELECT SUM(pick.picked_qty) AS qty
      FROM public.delivery_note_item_picks pick
      WHERE line.picked_qty > 0 AND pick.company_id = line.company_id
        AND pick.pick_list_id = line.pick_list_id AND pick.pick_list_item_id = line.id
        AND pick.batch_location_sku = line.suggested_batch_location_sku AND pick.deleted_at IS NULL
    ) planned_picks ON TRUE
    WHERE line.company_id = p_company_id AND line.pick_list_id = p_pick_list_id
      AND line.item_id = p_item_id AND line.suggested_pick_batch_code = p_batch_code
      AND line.picked_qty < line.allocated_qty
  )
  SELECT stock.batch_location_sku::TEXT, stock.warehouse_id, warehouse.warehouse_name::TEXT,
    location.id, location.code::TEXT, location.name::TEXT, location.path_ids,
    batch.received_at, stock.qty_on_hand,
    matched.id, matched.dn_item_id, matched.allocated_qty, matched.picked_qty,
    matched.remaining_qty * matched.qty_per_unit, matched.is_suggested,
    matched.available_base_qty, matched.max_pick_qty
  FROM public.item_batches batch
  JOIN public.item_batch_locations stock ON stock.item_batch_id = batch.id
    AND stock.company_id = batch.company_id AND stock.item_id = batch.item_id
    AND stock.warehouse_id = batch.warehouse_id
  JOIN public.warehouses warehouse ON warehouse.id = stock.warehouse_id
    AND warehouse.company_id = p_company_id AND warehouse.business_unit_id = v_business_unit_id
    AND warehouse.is_active AND warehouse.deleted_at IS NULL
  JOIN public.warehouse_locations location ON location.id = stock.location_id
    AND location.company_id = p_company_id AND location.warehouse_id = warehouse.id
    AND location.is_active AND location.is_pickable AND location.is_storable
    AND location.deleted_at IS NULL
  LEFT JOIN public.item_warehouse target_warehouse_stock
    ON v_policy = 'batch_only' AND target_warehouse_stock.company_id = batch.company_id
    AND target_warehouse_stock.item_id = batch.item_id AND target_warehouse_stock.deleted_at IS NULL
    AND target_warehouse_stock.warehouse_id = stock.warehouse_id
  JOIN LATERAL (
    SELECT line.id, line.dn_item_id, line.allocated_qty, line.picked_qty, line.remaining_qty,
      line.qty_per_unit, stock.id = line.planned_stock_id AS is_suggested,
      capacity.available_base_qty,
      CASE WHEN line.qty_per_unit > 1
        THEN LEAST(floor(line.remaining_qty), div(capacity.available_base_qty, line.qty_per_unit))
        -- Base-unit pick quantities support four decimals. Truncate to avoid overstating capacity.
        ELSE LEAST(line.remaining_qty, trunc(capacity.available_base_qty, 4))
      END AS max_pick_qty
    FROM lines line
    CROSS JOIN LATERAL (
      SELECT LEAST(
        CASE WHEN stock.id = line.planned_stock_id THEN LEAST(stock.qty_on_hand, batch.qty_on_hand)
          ELSE stock.qty_available END,
        CASE WHEN batch.id <> line.planned_batch_id THEN batch.qty_available END,
        CASE WHEN stock.warehouse_id IS DISTINCT FROM line.fulfilling_warehouse_id
          THEN COALESCE(target_warehouse_stock.available_stock, 0) END
      ) AS source_base_qty
    ) target
    CROSS JOIN LATERAL (
      SELECT LEAST(target.source_base_qty, line.planned_base_qty,
        CASE WHEN NOT line.has_planned_allocation THEN line.remaining_qty * line.qty_per_unit END,
        CASE WHEN stock.warehouse_id IS DISTINCT FROM line.fulfilling_warehouse_id
          THEN line.planned_warehouse_reserved END
      ) AS available_base_qty
    ) capacity
    WHERE line.suggested_pick_batch_received_at = batch.received_at
      -- The writer requires a ledger allocation to move a reservation, even within a warehouse.
      AND (stock.id = line.planned_stock_id OR line.has_planned_allocation)
      AND (line.qty_per_unit = 1 OR line.remaining_qty >= 1)
      AND target.source_base_qty >= line.qty_per_unit
      AND capacity.available_base_qty >= LEAST(line.qty_per_unit, line.remaining_qty * line.qty_per_unit)
      AND (v_policy = 'batch_only' OR stock.warehouse_id = line.fulfilling_warehouse_id)
      AND (v_policy <> 'batch_and_rack' OR stock.location_id = line.suggested_pick_location_id)
    ORDER BY is_suggested DESC, line.created_at, line.id
    LIMIT 1
  ) matched ON TRUE
  WHERE batch.company_id = p_company_id AND batch.item_id = p_item_id
    AND batch.batch_code = p_batch_code AND batch.deleted_at IS NULL
    AND stock.deleted_at IS NULL AND stock.qty_on_hand > 0
    AND stock.batch_location_sku IS NOT NULL
    AND (p_location_id IS NULL OR stock.location_id = p_location_id)
  ORDER BY matched.is_suggested DESC, warehouse.warehouse_name, location.code, stock.id
  -- Three displayed choices and one lookahead; never fetch all locations.
  LIMIT 4 OFFSET ((p_page - 1) * 3);
END;
$$;
REVOKE ALL ON FUNCTION public.get_pick_item_batch_sources(UUID, UUID, UUID, TEXT, UUID, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pick_item_batch_sources(UUID, UUID, UUID, TEXT, UUID, INTEGER)
  TO authenticated;
