BEGIN;

INSERT INTO public.permissions (
  resource,
  description,
  can_view,
  can_create,
  can_edit,
  can_delete,
  is_granular
)
VALUES (
  'inventory_reservations',
  'View inventory commitments and their physical batch-location allocations',
  TRUE,
  FALSE,
  FALSE,
  FALSE,
  FALSE
)
ON CONFLICT (resource) DO UPDATE
SET description = EXCLUDED.description,
    parent_resource = NULL,
    surface = NULL,
    capability_key = NULL,
    capability_action = NULL,
    label = NULL,
    permission_group = NULL,
    is_granular = FALSE,
    can_view = TRUE,
    can_create = FALSE,
    can_edit = FALSE,
    can_delete = FALSE,
    deleted_at = NULL,
    updated_at = NOW();

-- Reservation history is an inventory audit surface. Preserve access for
-- roles that can already inspect stock transactions without granting writes.
INSERT INTO public.role_permissions (
  role_id,
  permission_id,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  source_grant.role_id,
  reservation_permission.id,
  source_grant.can_view,
  FALSE,
  FALSE,
  FALSE
FROM public.role_permissions source_grant
JOIN public.permissions source_permission
  ON source_permission.id = source_grant.permission_id
 AND source_permission.resource = 'stock_transactions'
JOIN public.permissions reservation_permission
  ON reservation_permission.resource = 'inventory_reservations'
WHERE source_grant.can_view IS TRUE
ON CONFLICT (role_id, permission_id) DO UPDATE
SET can_view = EXCLUDED.can_view,
    can_create = FALSE,
    can_edit = FALSE,
    can_delete = FALSE;

CREATE INDEX IF NOT EXISTS inventory_reservations_ledger_page_idx
  ON public.inventory_reservations (
    company_id,
    business_unit_id,
    updated_at DESC,
    id
  )
  WHERE deleted_at IS NULL
    AND reservation_type = 'delivery_note';

CREATE OR REPLACE FUNCTION public.get_inventory_reservations_page(
  p_company_id UUID,
  p_user_id UUID,
  p_business_unit_id UUID,
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_item_id UUID DEFAULT NULL,
  p_warehouse_id UUID DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'updated_at',
  p_sort_order TEXT DEFAULT 'desc',
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offset INTEGER;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users user_row
    WHERE user_row.id = p_user_id
      AND user_row.company_id = p_company_id
      AND user_row.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_business_unit_access access_row
    WHERE access_row.user_id = p_user_id
      AND access_row.business_unit_id = p_business_unit_id
  ) OR NOT public.user_has_permission(
    p_user_id,
    'inventory_reservations',
    'view',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_PERMISSION_DENIED';
  END IF;

  IF p_page < 1 OR p_limit < 10 OR p_limit > 50 THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_INVALID_PAGINATION';
  END IF;

  IF length(COALESCE(p_search, '')) > 100 THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_SEARCH_TOO_LONG';
  END IF;

  IF COALESCE(p_status, 'all') NOT IN (
    'all',
    'active',
    'partial',
    'consumed',
    'released',
    'transferred',
    'closed'
  ) THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_INVALID_STATUS';
  END IF;

  IF p_sort_by NOT IN (
    'updated_at',
    'delivery_note_no',
    'item_code',
    'warehouse_code',
    'active_quantity_base',
    'status'
  ) OR p_sort_order NOT IN ('asc', 'desc') THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_INVALID_SORT';
  END IF;

  v_offset := (p_page - 1) * p_limit;

  WITH filtered_reservations AS MATERIALIZED (
    SELECT
      reservation.id AS reservation_id,
      reservation.delivery_note_id,
      delivery_note.dn_no AS delivery_note_no,
      reservation.delivery_note_item_id,
      reservation.item_id,
      item.item_code,
      item.item_name,
      reservation.uom_id,
      unit.code AS uom_code,
      reservation.warehouse_id,
      warehouse.warehouse_code,
      warehouse.warehouse_name,
      reservation.quantity + reservation.transferred_in_base AS committed_quantity_base,
      reservation.active_quantity_base,
      reservation.consumed_base,
      reservation.released_base,
      reservation.transferred_out_base,
      reservation.status,
      reservation.updated_at
    FROM public.inventory_reservations reservation
    JOIN public.delivery_notes delivery_note
      ON delivery_note.id = reservation.delivery_note_id
     AND delivery_note.company_id = reservation.company_id
     AND delivery_note.deleted_at IS NULL
    JOIN public.items item
      ON item.id = reservation.item_id
     AND item.company_id = reservation.company_id
    JOIN public.units_of_measure unit
      ON unit.id = reservation.uom_id
    JOIN public.warehouses warehouse
      ON warehouse.id = reservation.warehouse_id
     AND warehouse.company_id = reservation.company_id
    WHERE reservation.company_id = p_company_id
      AND reservation.business_unit_id = p_business_unit_id
      AND reservation.reservation_type = 'delivery_note'
      AND reservation.deleted_at IS NULL
      AND (COALESCE(p_status, 'all') = 'all' OR reservation.status = p_status)
      AND (p_item_id IS NULL OR reservation.item_id = p_item_id)
      AND (p_warehouse_id IS NULL OR reservation.warehouse_id = p_warehouse_id)
      AND (
        NULLIF(BTRIM(COALESCE(p_search, '')), '') IS NULL
        OR delivery_note.dn_no ILIKE '%' || BTRIM(p_search) || '%'
        OR item.item_code ILIKE '%' || BTRIM(p_search) || '%'
        OR item.item_name ILIKE '%' || BTRIM(p_search) || '%'
        OR warehouse.warehouse_code ILIKE '%' || BTRIM(p_search) || '%'
        OR warehouse.warehouse_name ILIKE '%' || BTRIM(p_search) || '%'
      )
  ),
  page_reservations AS (
    SELECT
      filtered_reservations.reservation_id,
      filtered_reservations.delivery_note_id,
      filtered_reservations.delivery_note_no,
      filtered_reservations.delivery_note_item_id,
      filtered_reservations.item_id,
      filtered_reservations.item_code,
      filtered_reservations.item_name,
      filtered_reservations.uom_id,
      filtered_reservations.uom_code,
      filtered_reservations.warehouse_id,
      filtered_reservations.warehouse_code,
      filtered_reservations.warehouse_name,
      filtered_reservations.committed_quantity_base,
      filtered_reservations.active_quantity_base,
      filtered_reservations.consumed_base,
      filtered_reservations.released_base,
      filtered_reservations.transferred_out_base,
      filtered_reservations.status,
      filtered_reservations.updated_at,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN p_sort_by = 'updated_at' AND p_sort_order = 'asc'
            THEN filtered_reservations.updated_at END ASC,
          CASE WHEN p_sort_by = 'updated_at' AND p_sort_order = 'desc'
            THEN filtered_reservations.updated_at END DESC,
          CASE WHEN p_sort_by = 'delivery_note_no' AND p_sort_order = 'asc'
            THEN filtered_reservations.delivery_note_no END ASC,
          CASE WHEN p_sort_by = 'delivery_note_no' AND p_sort_order = 'desc'
            THEN filtered_reservations.delivery_note_no END DESC,
          CASE WHEN p_sort_by = 'item_code' AND p_sort_order = 'asc'
            THEN filtered_reservations.item_code END ASC,
          CASE WHEN p_sort_by = 'item_code' AND p_sort_order = 'desc'
            THEN filtered_reservations.item_code END DESC,
          CASE WHEN p_sort_by = 'warehouse_code' AND p_sort_order = 'asc'
            THEN filtered_reservations.warehouse_code END ASC,
          CASE WHEN p_sort_by = 'warehouse_code' AND p_sort_order = 'desc'
            THEN filtered_reservations.warehouse_code END DESC,
          CASE WHEN p_sort_by = 'active_quantity_base' AND p_sort_order = 'asc'
            THEN filtered_reservations.active_quantity_base END ASC,
          CASE WHEN p_sort_by = 'active_quantity_base' AND p_sort_order = 'desc'
            THEN filtered_reservations.active_quantity_base END DESC,
          CASE WHEN p_sort_by = 'status' AND p_sort_order = 'asc'
            THEN filtered_reservations.status END ASC,
          CASE WHEN p_sort_by = 'status' AND p_sort_order = 'desc'
            THEN filtered_reservations.status END DESC,
          filtered_reservations.reservation_id ASC
      ) AS row_position
    FROM filtered_reservations
    ORDER BY
      CASE WHEN p_sort_by = 'updated_at' AND p_sort_order = 'asc'
        THEN filtered_reservations.updated_at END ASC,
      CASE WHEN p_sort_by = 'updated_at' AND p_sort_order = 'desc'
        THEN filtered_reservations.updated_at END DESC,
      CASE WHEN p_sort_by = 'delivery_note_no' AND p_sort_order = 'asc'
        THEN filtered_reservations.delivery_note_no END ASC,
      CASE WHEN p_sort_by = 'delivery_note_no' AND p_sort_order = 'desc'
        THEN filtered_reservations.delivery_note_no END DESC,
      CASE WHEN p_sort_by = 'item_code' AND p_sort_order = 'asc'
        THEN filtered_reservations.item_code END ASC,
      CASE WHEN p_sort_by = 'item_code' AND p_sort_order = 'desc'
        THEN filtered_reservations.item_code END DESC,
      CASE WHEN p_sort_by = 'warehouse_code' AND p_sort_order = 'asc'
        THEN filtered_reservations.warehouse_code END ASC,
      CASE WHEN p_sort_by = 'warehouse_code' AND p_sort_order = 'desc'
        THEN filtered_reservations.warehouse_code END DESC,
      CASE WHEN p_sort_by = 'active_quantity_base' AND p_sort_order = 'asc'
        THEN filtered_reservations.active_quantity_base END ASC,
      CASE WHEN p_sort_by = 'active_quantity_base' AND p_sort_order = 'desc'
        THEN filtered_reservations.active_quantity_base END DESC,
      CASE WHEN p_sort_by = 'status' AND p_sort_order = 'asc'
        THEN filtered_reservations.status END ASC,
      CASE WHEN p_sort_by = 'status' AND p_sort_order = 'desc'
        THEN filtered_reservations.status END DESC,
      filtered_reservations.reservation_id ASC
    OFFSET v_offset
    LIMIT p_limit
  ),
  page_rows AS (
    SELECT
      page_reservations.reservation_id,
      page_reservations.delivery_note_id,
      page_reservations.delivery_note_no,
      page_reservations.delivery_note_item_id,
      page_reservations.item_id,
      page_reservations.item_code,
      page_reservations.item_name,
      page_reservations.uom_id,
      page_reservations.uom_code,
      page_reservations.warehouse_id,
      page_reservations.warehouse_code,
      page_reservations.warehouse_name,
      page_reservations.committed_quantity_base,
      page_reservations.active_quantity_base,
      page_reservations.consumed_base,
      page_reservations.released_base,
      page_reservations.transferred_out_base,
      page_reservations.status,
      page_reservations.updated_at,
      page_reservations.row_position,
      COALESCE(allocation_totals.physically_allocated_base, 0) AS physically_allocated_base
    FROM page_reservations
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(SUM(allocation.active_quantity_base), 0) AS physically_allocated_base
      FROM public.inventory_reservation_allocations allocation
      WHERE allocation.reservation_id = page_reservations.reservation_id
    ) allocation_totals ON TRUE
  )
  SELECT jsonb_build_object(
    'data', COALESCE(
      (
        SELECT jsonb_agg(
          to_jsonb(page_rows) - 'row_position'
          ORDER BY page_rows.row_position
        )
        FROM page_rows
      ),
      '[]'::JSONB
    ),
    'total', (SELECT COUNT(*) FROM filtered_reservations)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_inventory_reservations_page(
  UUID, UUID, UUID, TEXT, TEXT, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER
) IS
  'Returns one bounded page of delivery-note warehouse commitments for the current business unit.';

REVOKE ALL ON FUNCTION public.get_inventory_reservations_page(
  UUID, UUID, UUID, TEXT, TEXT, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_reservations_page(
  UUID, UUID, UUID, TEXT, TEXT, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER
) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_inventory_reservation_allocations_page(
  p_company_id UUID,
  p_user_id UUID,
  p_business_unit_id UUID,
  p_reservation_id UUID,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offset INTEGER;
  v_result JSONB;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users user_row
    WHERE user_row.id = p_user_id
      AND user_row.company_id = p_company_id
      AND user_row.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_business_unit_access access_row
    WHERE access_row.user_id = p_user_id
      AND access_row.business_unit_id = p_business_unit_id
  ) OR NOT public.user_has_permission(
    p_user_id,
    'inventory_reservations',
    'view',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_PERMISSION_DENIED';
  END IF;

  IF p_page < 1 OR p_limit < 10 OR p_limit > 50 THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATIONS_INVALID_PAGINATION';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.inventory_reservations reservation
    WHERE reservation.id = p_reservation_id
      AND reservation.company_id = p_company_id
      AND reservation.business_unit_id = p_business_unit_id
      AND reservation.reservation_type = 'delivery_note'
      AND reservation.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'INVENTORY_RESERVATION_NOT_FOUND';
  END IF;

  v_offset := (p_page - 1) * p_limit;

  WITH filtered_allocations AS MATERIALIZED (
    SELECT
      allocation.id AS allocation_id,
      allocation.pick_list_id,
      pick_list.pick_list_no,
      allocation.pick_list_item_id,
      allocation.warehouse_id,
      warehouse.warehouse_code,
      warehouse.warehouse_name,
      allocation.item_batch_id,
      item_batch.batch_code,
      allocation.item_batch_location_id,
      batch_location.batch_location_sku AS location_sku,
      warehouse_location.id AS location_id,
      warehouse_location.code AS location_code,
      warehouse_location.name AS location_name,
      allocation.quantity_base,
      allocation.transferred_in_base,
      allocation.transferred_out_base,
      allocation.active_quantity_base,
      allocation.consumed_base,
      allocation.released_base,
      allocation.status,
      allocation.updated_at
    FROM public.inventory_reservation_allocations allocation
    JOIN public.pick_lists pick_list
      ON pick_list.id = allocation.pick_list_id
     AND pick_list.company_id = allocation.company_id
    JOIN public.warehouses warehouse
      ON warehouse.id = allocation.warehouse_id
     AND warehouse.company_id = allocation.company_id
    JOIN public.item_batches item_batch
      ON item_batch.id = allocation.item_batch_id
     AND item_batch.company_id = allocation.company_id
    JOIN public.item_batch_locations batch_location
      ON batch_location.id = allocation.item_batch_location_id
     AND batch_location.company_id = allocation.company_id
    JOIN public.warehouse_locations warehouse_location
      ON warehouse_location.id = batch_location.location_id
     AND warehouse_location.company_id = allocation.company_id
    WHERE allocation.company_id = p_company_id
      AND allocation.business_unit_id = p_business_unit_id
      AND allocation.reservation_id = p_reservation_id
  ),
  page_rows AS (
    SELECT
      filtered_allocations.allocation_id,
      filtered_allocations.owner_type,
      filtered_allocations.owner_id,
      filtered_allocations.owner_reference,
      filtered_allocations.warehouse_id,
      filtered_allocations.warehouse_code,
      filtered_allocations.warehouse_name,
      filtered_allocations.item_batch_id,
      filtered_allocations.batch_code,
      filtered_allocations.item_batch_location_id,
      filtered_allocations.location_sku,
      filtered_allocations.location_id,
      filtered_allocations.location_code,
      filtered_allocations.location_name,
      filtered_allocations.quantity_base,
      filtered_allocations.transferred_in_base,
      filtered_allocations.transferred_out_base,
      filtered_allocations.active_quantity_base,
      filtered_allocations.consumed_base,
      filtered_allocations.released_base,
      filtered_allocations.status,
      filtered_allocations.updated_at
    FROM filtered_allocations
    ORDER BY filtered_allocations.updated_at DESC, filtered_allocations.allocation_id ASC
    OFFSET v_offset
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'data', COALESCE(
      (SELECT jsonb_agg(to_jsonb(page_rows)) FROM page_rows),
      '[]'::JSONB
    ),
    'total', (SELECT COUNT(*) FROM filtered_allocations)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_inventory_reservation_allocations_page(
  UUID, UUID, UUID, UUID, INTEGER, INTEGER
) IS
  'Returns one bounded page of physical batch-location allocations for a warehouse commitment.';

REVOKE ALL ON FUNCTION public.get_inventory_reservation_allocations_page(
  UUID, UUID, UUID, UUID, INTEGER, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_reservation_allocations_page(
  UUID, UUID, UUID, UUID, INTEGER, INTEGER
) TO authenticated;

COMMIT;
