-- Run the entire file as a database administrator during an inventory maintenance window.
-- Set the company UUID below. Optional filters narrow the deletion to an item or warehouse.
-- This removes stock directly and does not create stock ledger entries.
-- Batches referenced by closed inventory documents or inactive allocations are archived and zeroed.
-- Open stock requests, adjustments, and active allocations block the operation.
-- An archived batch keeps its code and identity for historical lookups. Its code stays occupied.
-- Review the counts with ROLLBACK, then change it to COMMIT to persist the deletion.
BEGIN ISOLATION LEVEL REPEATABLE READ;

SET LOCAL row_security = off;
SET LOCAL lock_timeout = '5s';

DO $delete_opening_balance$
DECLARE
  v_company_id UUID := NULL; -- Replace NULL with 'your-company-uuid'::UUID.
  v_item_id UUID := NULL;
  v_warehouse_id UUID := NULL;
  v_batch_count BIGINT;
  v_location_count BIGINT;
  v_archived_batch_count BIGINT;
  v_archived_location_count BIGINT;
  v_invalid_batch_count BIGINT;
  v_warehouse_count BIGINT;
  v_expected_warehouse_count BIGINT;
  v_quantity_removed NUMERIC;
  v_blocker TEXT;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Set v_company_id before running this script';
  END IF;

  -- A batch code is unique per company, item, and warehouse.
  CREATE TEMP TABLE opening_balance_targets ON COMMIT DROP AS
  SELECT batch.id, batch.company_id, batch.item_id, batch.warehouse_id, batch.qty_on_hand, batch.qty_reserved
  FROM public.item_batches AS batch
  WHERE batch.company_id = v_company_id
    AND batch.batch_code = 'OPENING-BAL'
    AND batch.deleted_at IS NULL
    AND (v_item_id IS NULL OR batch.item_id = v_item_id)
    AND (v_warehouse_id IS NULL OR batch.warehouse_id = v_warehouse_id)
  FOR UPDATE OF batch;

  IF NOT EXISTS (SELECT 1 FROM opening_balance_targets) THEN
    RAISE NOTICE 'No active OPENING-BAL batches match these filters';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM opening_balance_targets WHERE qty_reserved > 0) THEN
    RAISE EXCEPTION 'Release reservations on the selected OPENING-BAL batches before deleting them';
  END IF;

  CREATE TEMP TABLE opening_balance_locations ON COMMIT DROP AS
  SELECT location.id, location.item_batch_id, location.deleted_at, location.qty_on_hand, location.qty_reserved,
    (location.company_id, location.item_id, location.warehouse_id)
      = (batch.company_id, batch.item_id, batch.warehouse_id) AS matches_batch_scope
  FROM public.item_batch_locations AS location
  JOIN opening_balance_targets AS batch ON batch.id = location.item_batch_id
  FOR UPDATE OF location;

  WITH location_totals AS (
    SELECT item_batch_id, SUM(qty_on_hand) FILTER (WHERE deleted_at IS NULL) AS qty_on_hand,
      SUM(qty_reserved) FILTER (WHERE deleted_at IS NULL) AS qty_reserved,
      BOOL_AND(matches_batch_scope) AS matches_batch_scope
    FROM opening_balance_locations
    GROUP BY item_batch_id
  )
  SELECT COUNT(*) INTO v_invalid_batch_count
  FROM opening_balance_targets AS batch
  LEFT JOIN location_totals AS location ON location.item_batch_id = batch.id
  WHERE batch.qty_on_hand <> COALESCE(location.qty_on_hand, 0)
    OR COALESCE(location.qty_reserved, 0) > 0
    OR location.matches_batch_scope IS FALSE;

  IF v_invalid_batch_count > 0 THEN
    RAISE EXCEPTION '% OPENING-BAL batches have inconsistent location balances or reserved location stock',
      v_invalid_batch_count;
  END IF;

  -- Keep the original identities used by allocation, request, and adjustment history.
  CREATE TEMP TABLE opening_balance_references ON COMMIT DROP AS
  WITH referenced_batches AS (
    SELECT target.id AS item_batch_id,
      CASE WHEN allocation.active_quantity_base > 0
        THEN FORMAT('inventory allocation %s is still active', allocation.id) END AS blocker
    FROM public.inventory_reservation_allocations AS allocation
    JOIN opening_balance_targets AS target ON target.id = allocation.item_batch_id
    UNION ALL
    SELECT location.item_batch_id,
      CASE WHEN allocation.active_quantity_base > 0
        THEN FORMAT('inventory allocation %s is still active', allocation.id) END
    FROM public.inventory_reservation_allocations AS allocation
    JOIN opening_balance_locations AS location ON location.id = allocation.item_batch_location_id
    UNION ALL
    SELECT target.id,
      CASE WHEN (
        request.deleted_at IS NULL
        AND COALESCE(request.status, '') NOT IN ('cancelled', 'fulfilled', 'completed', 'received')
      )
        OR EXISTS (
          SELECT 1
          FROM public.delivery_note_items AS delivery_line
          JOIN public.delivery_notes AS note ON note.id = delivery_line.dn_id
          WHERE delivery_line.company_id = request.company_id
            AND delivery_line.sr_id = request.id AND delivery_line.sr_item_id = line.id
            AND delivery_line.is_voided IS FALSE
            AND note.deleted_at IS NULL AND note.status NOT IN ('voided', 'dispatched', 'received')
        )
        THEN FORMAT('stock request %s (status %s) or its linked delivery is still open',
          request.request_code, COALESCE(request.status, 'unknown'))
      END
    FROM public.stock_request_items AS line
    JOIN opening_balance_targets AS target ON target.id = line.selected_item_batch_id
    JOIN public.stock_requests AS request ON request.id = line.stock_request_id
    UNION ALL
    SELECT location.item_batch_id,
      CASE WHEN line.deleted_at IS NULL AND adjustment.deleted_at IS NULL
        AND COALESCE(adjustment.status, '') NOT IN ('posted', 'rejected', 'cancelled')
        THEN FORMAT('stock adjustment %s (status %s) is still open', adjustment.adjustment_code, COALESCE(adjustment.status, 'unknown'))
      END
    FROM public.stock_adjustment_items AS line
    JOIN opening_balance_locations AS location ON location.id = line.item_batch_location_id
    JOIN public.stock_adjustments AS adjustment ON adjustment.id = line.adjustment_id
  )
  SELECT item_batch_id, MIN(blocker) AS blocker
  FROM referenced_batches
  GROUP BY item_batch_id;

  SELECT blocker INTO v_blocker
  FROM opening_balance_references
  WHERE blocker IS NOT NULL
  ORDER BY blocker
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Cannot remove OPENING-BAL stock because %', v_blocker
      USING HINT = 'Resolve the record through its normal workflow, then rerun the cleanup.';
  END IF;

  DELETE FROM public.item_batch_locations AS location
  USING opening_balance_locations AS target
  WHERE location.id = target.id
    AND NOT EXISTS (
      SELECT 1 FROM opening_balance_references AS reference
      WHERE reference.item_batch_id = target.item_batch_id
    );
  GET DIAGNOSTICS v_location_count = ROW_COUNT;

  DELETE FROM public.item_batches AS batch
  USING opening_balance_targets AS target
  WHERE batch.id = target.id
    AND NOT EXISTS (
      SELECT 1 FROM opening_balance_references AS reference
      WHERE reference.item_batch_id = target.id
    );
  GET DIAGNOSTICS v_batch_count = ROW_COUNT;

  UPDATE public.item_batch_locations AS location
  SET deleted_at = NOW(), qty_on_hand = 0, qty_reserved = 0
  FROM opening_balance_locations AS target
  JOIN opening_balance_references AS reference ON reference.item_batch_id = target.item_batch_id
  WHERE location.id = target.id AND location.deleted_at IS NULL;
  GET DIAGNOSTICS v_archived_location_count = ROW_COUNT;

  UPDATE public.item_batches AS batch
  SET deleted_at = NOW(), qty_on_hand = 0, qty_reserved = 0
  FROM opening_balance_references AS target
  WHERE batch.id = target.item_batch_id;
  GET DIAGNOSTICS v_archived_batch_count = ROW_COUNT;

  SELECT COUNT(*) FILTER (WHERE qty_on_hand > 0), COALESCE(SUM(qty_on_hand), 0)
  INTO v_expected_warehouse_count, v_quantity_removed
  FROM opening_balance_targets;

  -- Available stock already excludes warehouse reservations and pending putaway.
  UPDATE public.item_warehouse AS stock
  SET current_stock = stock.current_stock - batch.qty_on_hand
  FROM opening_balance_targets AS batch
  WHERE stock.company_id = batch.company_id
    AND stock.item_id = batch.item_id
    AND stock.warehouse_id = batch.warehouse_id
    AND stock.deleted_at IS NULL
    AND batch.qty_on_hand > 0
    AND stock.available_stock >= batch.qty_on_hand;
  GET DIAGNOSTICS v_warehouse_count = ROW_COUNT;

  IF v_warehouse_count <> v_expected_warehouse_count THEN
    RAISE EXCEPTION 'Missing or insufficient available warehouse stock for % OPENING-BAL batches',
      v_expected_warehouse_count - v_warehouse_count;
  END IF;

  RAISE NOTICE 'Batches deleted: %, batch locations deleted: %, warehouse balances updated: %, on-hand quantity removed in base units: %',
    v_batch_count, v_location_count, v_warehouse_count, v_quantity_removed;
  RAISE NOTICE 'Batches archived to preserve inventory history: %, batch locations archived: %',
    v_archived_batch_count, v_archived_location_count;
END;
$delete_opening_balance$;

ROLLBACK; -- Change to COMMIT after reviewing the dry run.
