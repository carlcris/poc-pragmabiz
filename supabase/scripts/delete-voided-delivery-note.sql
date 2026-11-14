-- Run the entire file as a database administrator in PostgreSQL or Supabase SQL Editor.
-- This permanently removes one pre-dispatch voided delivery note, its lines, source links,
-- and inactive reservation history. Stock requests are retained.
-- Review the result with ROLLBACK, then change the final line to COMMIT to apply it.
BEGIN;

SET LOCAL row_security = off;
SET LOCAL lock_timeout = '5s';

DO $delete_voided_delivery_note$
DECLARE
  v_delivery_note_id CONSTANT UUID := 'b3bb987f-044d-41f8-96d8-17d2ad8597d6';
  v_note RECORD;
  v_pick_list_no TEXT;
  v_line_ids UUID[];
  v_line_count BIGINT;
  v_source_count BIGINT;
  v_reservation_count BIGINT;
  v_has_unsafe_reservation BOOLEAN;
BEGIN
  SELECT note.dn_no, note.company_id, note.status, note.dispatched_at, note.received_at,
    note.receiving_started_at, note.receiving_completed_at
  INTO v_note
  FROM public.delivery_notes AS note
  WHERE note.id = v_delivery_note_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note % was not found', v_delivery_note_id;
  END IF;

  IF v_note.status <> 'voided' OR v_note.dispatched_at IS NOT NULL OR v_note.received_at IS NOT NULL
    OR v_note.receiving_started_at IS NOT NULL OR v_note.receiving_completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Delivery note % must be voided before dispatch or receiving (current status %)',
      v_note.dn_no, v_note.status;
  END IF;

  SELECT COUNT(*), COALESCE(ARRAY_AGG(line.id), ARRAY[]::UUID[])
  INTO v_line_count, v_line_ids
  FROM (
    SELECT item.id FROM public.delivery_note_items AS item
    WHERE item.dn_id = v_delivery_note_id
    FOR UPDATE
  ) AS line;

  SELECT pick_list.pick_list_no INTO v_pick_list_no
  FROM public.pick_lists AS pick_list
  WHERE pick_list.dn_id = v_delivery_note_id
  ORDER BY pick_list.pick_list_no
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Delivery note % still has pick list %', v_note.dn_no, v_pick_list_no
      USING HINT = 'Resolve the linked pick list separately, then retry.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.delivery_note_items AS line
    WHERE line.id = ANY(v_line_ids)
      AND (line.company_id <> v_note.company_id OR line.dispatched_qty <> 0 OR line.received_qty <> 0)
  ) OR EXISTS (
    SELECT 1 FROM public.delivery_note_item_picks AS pick
    WHERE pick.dn_id = v_delivery_note_id OR pick.delivery_note_item_id = ANY(v_line_ids)
  ) OR EXISTS (
    SELECT 1 FROM public.delivery_note_item_receiving_scans AS scan
    WHERE scan.dn_id = v_delivery_note_id OR scan.dn_item_id = ANY(v_line_ids)
  ) OR EXISTS (
    SELECT 1 FROM public.delivery_note_receiving_exceptions AS exception
    WHERE exception.dn_id = v_delivery_note_id
  ) OR EXISTS (
    SELECT 1 FROM public.delivery_note_item_adjustments AS adjustment
    WHERE adjustment.dn_id = v_delivery_note_id OR adjustment.delivery_note_item_id = ANY(v_line_ids)
  ) OR EXISTS (
    SELECT 1 FROM public.stock_transactions AS movement
    WHERE movement.company_id = v_note.company_id AND movement.reference_id = v_delivery_note_id
      AND movement.reference_type IN ('delivery_note', 'delivery_note_adjustment')
  ) THEN
    RAISE EXCEPTION 'Delivery note % has pick, dispatch, receiving, or stock transaction history', v_note.dn_no;
  END IF;

  SELECT COUNT(*), COALESCE(BOOL_OR(
    reservation.company_id <> v_note.company_id OR reservation.active_quantity_base IS DISTINCT FROM 0
    OR reservation.consumed_base <> 0
    OR EXISTS (
      SELECT 1 FROM public.inventory_reservation_allocations AS allocation
      WHERE allocation.reservation_id = reservation.id
    )
  ), FALSE)
  INTO v_reservation_count, v_has_unsafe_reservation
  FROM (
    SELECT reservation.id, reservation.company_id, reservation.active_quantity_base, reservation.consumed_base
    FROM public.inventory_reservations AS reservation
    WHERE reservation.delivery_note_id = v_delivery_note_id OR reservation.delivery_note_item_id = ANY(v_line_ids)
    FOR UPDATE
  ) AS reservation;

  IF v_has_unsafe_reservation THEN
    RAISE EXCEPTION 'Delivery note % still has an active or consumed reservation or allocation history', v_note.dn_no;
  END IF;

  SELECT COUNT(*) INTO v_source_count
  FROM public.delivery_note_sources AS source
  WHERE source.dn_id = v_delivery_note_id;

  -- Foreign keys delete the note's lines, source links, and released reservations.
  DELETE FROM public.delivery_notes WHERE id = v_delivery_note_id;

  RAISE NOTICE 'Delivery note % removed with % lines, % source links, and % inactive reservations',
    v_note.dn_no, v_line_count, v_source_count, v_reservation_count;
END;
$delete_voided_delivery_note$;

SET CONSTRAINTS ALL IMMEDIATE;

ROLLBACK; -- Change to COMMIT after reviewing the dry run.
