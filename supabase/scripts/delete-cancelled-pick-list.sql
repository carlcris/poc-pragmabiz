-- Run the entire file as a database administrator in PostgreSQL or Supabase SQL Editor.
-- This cleanup permanently removes the selected pick list and its pick and allocation history.
-- Run with ROLLBACK to review the counts, then change the final line to COMMIT to apply it.
BEGIN;

SET LOCAL row_security = off;
SET LOCAL lock_timeout = '5s';

DO $delete_cancelled_pick_list$
DECLARE
  v_pick_list_id CONSTANT UUID := '3c91a4ce-1ef2-4760-bbf1-47428bf372b6';
  v_company_id UUID;
  v_delivery_note_id UUID;
  v_pick_list_item_ids UUID[];
  v_allocation_count BIGINT;
  v_pick_count BIGINT;
  v_operation_count BIGINT;
  v_unsafe_allocation BOOLEAN;
BEGIN
  SELECT note.company_id, note.id
  INTO v_company_id, v_delivery_note_id
  FROM public.delivery_notes AS note
  JOIN public.pick_lists AS pick_list
    ON pick_list.dn_id = note.id AND pick_list.company_id = note.company_id
  WHERE pick_list.id = v_pick_list_id AND pick_list.pick_list_no = 'PL-000000001'
    AND pick_list.status = 'cancelled'
    AND note.dn_no = 'DN-000000001' AND note.status = 'voided'
    AND note.dispatched_at IS NULL
  FOR UPDATE OF note, pick_list;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected PL-000000001 to be cancelled and DN-000000001 to be voided before dispatch';
  END IF;

  SELECT COALESCE(ARRAY_AGG(line.id), ARRAY[]::UUID[])
  INTO v_pick_list_item_ids
  FROM (
    SELECT item.id
    FROM public.pick_list_items AS item
    WHERE item.pick_list_id = v_pick_list_id
    FOR UPDATE
  ) AS line;

  SELECT COUNT(*), COALESCE(BOOL_OR(
    allocation.company_id <> v_company_id
    OR allocation.pick_list_id IS DISTINCT FROM v_pick_list_id
    OR (allocation.pick_list_item_id = ANY(v_pick_list_item_ids)) IS NOT TRUE
    OR allocation.active_quantity_base IS DISTINCT FROM 0
    OR allocation.consumed_base <> 0
  ), FALSE)
  INTO v_allocation_count, v_unsafe_allocation
  FROM (
    SELECT a.company_id, a.pick_list_id, a.pick_list_item_id, a.active_quantity_base, a.consumed_base
    FROM public.inventory_reservation_allocations AS a
    WHERE a.pick_list_id = v_pick_list_id OR a.pick_list_item_id = ANY(v_pick_list_item_ids)
    FOR UPDATE
  ) AS allocation;

  IF v_unsafe_allocation OR EXISTS (
    SELECT 1 FROM public.inventory_reservations AS reservation
    WHERE reservation.delivery_note_id = v_delivery_note_id
      AND reservation.deleted_at IS NULL AND reservation.active_quantity_base > 0
  ) THEN
    RAISE EXCEPTION 'The pick list or delivery note has active, consumed, or inconsistent reservations';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.delivery_note_items AS line
    WHERE line.dn_id = v_delivery_note_id AND line.dispatched_qty > 0
  ) THEN
    RAISE EXCEPTION 'The delivery note has dispatched stock';
  END IF;

  -- Any remaining pick reference blocks the final delete and rolls the transaction back.
  DELETE FROM public.delivery_note_item_picks AS pick
  WHERE pick.pick_list_id = v_pick_list_id AND pick.company_id = v_company_id
    AND pick.dn_id = v_delivery_note_id AND pick.deleted_at IS NOT NULL
    AND pick.dispatched_qty = 0 AND pick.received_qty = 0 AND pick.reversed_qty = 0;
  GET DIAGNOSTICS v_pick_count = ROW_COUNT;

  DELETE FROM public.pick_list_item_pick_operations AS operation
  WHERE operation.pick_list_id = v_pick_list_id AND operation.company_id = v_company_id
    AND operation.pick_list_item_id = ANY(v_pick_list_item_ids);
  GET DIAGNOSTICS v_operation_count = ROW_COUNT;

  -- The foreign keys cascade to pick-list lines, assignments, claims, and inactive allocations.
  DELETE FROM public.pick_lists WHERE id = v_pick_list_id AND company_id = v_company_id;

  RAISE NOTICE 'Pick list PL-000000001 removed with % lines, % pick records, % pick operations, and % allocations',
    CARDINALITY(v_pick_list_item_ids), v_pick_count, v_operation_count, v_allocation_count;
END;
$delete_cancelled_pick_list$;

-- Check deferred constraints during the dry run as well as when committing.
SET CONSTRAINTS ALL IMMEDIATE;

ROLLBACK; -- Change to COMMIT after reviewing the dry run.
