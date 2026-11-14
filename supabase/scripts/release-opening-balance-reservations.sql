-- Run the entire file as a database administrator in PostgreSQL or Supabase SQL Editor.
-- Use the same company, item, and warehouse filters as delete-opening-balance-batches.sql.
-- Releases unowned reserved balances. Active workflow owners must release their own stock.
-- The companion deletion script archives batches with closed document or inactive allocation references.
-- Review the counts with ROLLBACK, then change it to COMMIT to save the release.
BEGIN ISOLATION LEVEL REPEATABLE READ;

SET LOCAL row_security = off;
SET LOCAL lock_timeout = '5s';

DO $release_opening_balance$
DECLARE
  v_company_id UUID := NULL; -- Replace NULL with 'your-company-uuid'::UUID.
  v_item_id UUID := NULL;
  v_warehouse_id UUID := NULL;
  v_owner RECORD;
  v_invalid_batch_id UUID;
  v_batch_count BIGINT;
  v_location_count BIGINT;
  v_warehouse_count BIGINT;
  v_quantity_released NUMERIC;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Set v_company_id before running this script';
  END IF;

  CREATE TEMP TABLE opening_balance_reserved_batches ON COMMIT DROP AS
  SELECT batch.id, batch.item_id, batch.warehouse_id, batch.qty_reserved
  FROM public.item_batches AS batch
  WHERE batch.company_id = v_company_id
    AND batch.batch_code = 'OPENING-BAL'
    AND batch.deleted_at IS NULL
    AND batch.qty_reserved > 0
    AND (v_item_id IS NULL OR batch.item_id = v_item_id)
    AND (v_warehouse_id IS NULL OR batch.warehouse_id = v_warehouse_id)
  FOR UPDATE OF batch;

  SELECT COUNT(*), COALESCE(SUM(qty_reserved), 0)
  INTO v_batch_count, v_quantity_released
  FROM opening_balance_reserved_batches;

  IF v_batch_count = 0 THEN
    RAISE NOTICE 'No active OPENING-BAL batches with reserved stock match these filters';
    RETURN;
  END IF;

  CREATE TEMP TABLE opening_balance_locations ON COMMIT DROP AS
  SELECT location.id, location.item_batch_id, location.item_id, location.warehouse_id,
    location.batch_location_sku, location.qty_reserved
  FROM public.item_batch_locations AS location
  JOIN opening_balance_reserved_batches AS batch ON batch.id = location.item_batch_id
  WHERE location.company_id = v_company_id
    AND location.deleted_at IS NULL
  FOR UPDATE OF location;

  SELECT batch.id INTO v_invalid_batch_id
  FROM opening_balance_reserved_batches AS batch
  LEFT JOIN opening_balance_locations AS location ON location.item_batch_id = batch.id
  GROUP BY batch.id, batch.qty_reserved, batch.item_id, batch.warehouse_id
  HAVING batch.qty_reserved <> COALESCE(SUM(location.qty_reserved), 0)
    OR BOOL_OR((location.item_id, location.warehouse_id) <> (batch.item_id, batch.warehouse_id))
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Reserved stock does not reconcile between OPENING-BAL batch % and its locations',
      v_invalid_batch_id;
  END IF;

  SELECT allocation.id, allocation.pick_list_id, allocation.transformation_order_id
  INTO v_owner
  FROM public.inventory_reservation_allocations AS allocation
  JOIN opening_balance_reserved_batches AS batch ON batch.id = allocation.item_batch_id
  WHERE allocation.company_id = v_company_id AND allocation.active_quantity_base > 0
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'OPENING-BAL stock has active allocation %', v_owner.id
      USING HINT = CASE WHEN v_owner.pick_list_id IS NOT NULL
        THEN FORMAT('Release the stock through pick list %s or its delivery note, then retry.',
          v_owner.pick_list_id)
        ELSE FORMAT('Release the stock through transformation order %s, then retry.',
          v_owner.transformation_order_id)
      END;
  END IF;

  -- Check live planned and scanned sources. Pre-ledger pick lists can still hold reservations.
  WITH source_pick_lists AS (
    SELECT line.pick_list_id
    FROM public.pick_list_items AS line
    JOIN opening_balance_locations AS location
      ON location.batch_location_sku = line.suggested_batch_location_sku
      AND location.item_id = line.item_id
    WHERE line.company_id = v_company_id AND line.allocated_qty > 0
    UNION
    SELECT pick.pick_list_id
    FROM public.delivery_note_item_picks AS pick
    JOIN opening_balance_locations AS location
      ON location.batch_location_sku = pick.batch_location_sku
      AND location.item_id = pick.item_id
    WHERE pick.company_id = v_company_id AND pick.deleted_at IS NULL AND pick.picked_qty > 0
  )
  SELECT pick_list.pick_list_no, note.dn_no INTO v_owner
  FROM source_pick_lists AS source
  JOIN public.pick_lists AS pick_list ON pick_list.id = source.pick_list_id
  JOIN public.delivery_notes AS note ON note.id = pick_list.dn_id
  WHERE pick_list.company_id = v_company_id AND pick_list.deleted_at IS NULL
    AND pick_list.status <> 'cancelled'
    AND note.company_id = v_company_id AND note.deleted_at IS NULL
    AND note.status NOT IN ('voided', 'dispatched', 'received')
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'OPENING-BAL stock is referenced by active pick list % on delivery note %',
      v_owner.pick_list_no, v_owner.dn_no
      USING HINT = 'Release the stock through the pick list or delivery note, then retry.';
  END IF;

  -- Warehouse-only reservations can predate the ledger too.
  SELECT note.dn_no INTO v_owner
  FROM opening_balance_reserved_batches AS batch
  JOIN public.delivery_note_items AS line
    ON line.item_id = batch.item_id AND line.fulfilling_warehouse_id = batch.warehouse_id
  JOIN public.delivery_notes AS note ON note.id = line.dn_id
  WHERE line.company_id = v_company_id AND line.is_voided IS FALSE AND line.allocated_qty > 0
    AND note.company_id = v_company_id AND note.deleted_at IS NULL
    AND note.status NOT IN ('voided', 'dispatched', 'received')
    AND NOT EXISTS (
      SELECT 1 FROM public.inventory_reservations AS reservation
      WHERE reservation.delivery_note_item_id = line.id
        AND reservation.company_id = v_company_id AND reservation.deleted_at IS NULL
    )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Delivery note % may hold an untracked warehouse reservation', v_owner.dn_no
      USING HINT = 'Resolve the delivery note through its normal workflow, then retry.';
  END IF;

  UPDATE public.item_batch_locations AS location
  SET qty_reserved = 0
  FROM opening_balance_locations AS target
  WHERE location.id = target.id AND target.qty_reserved > 0;
  GET DIAGNOSTICS v_location_count = ROW_COUNT;

  UPDATE public.item_batches AS batch
  SET qty_reserved = 0
  FROM opening_balance_reserved_batches AS target
  WHERE batch.id = target.id;

  -- Preserve every active warehouse commitment and any reserved stock on other batches
  -- that is not already represented by those commitments.
  WITH commitments AS (
    SELECT reservation.id, reservation.item_id, reservation.warehouse_id, reservation.active_quantity_base
    FROM public.inventory_reservations AS reservation
    JOIN opening_balance_reserved_batches AS target
      ON (target.item_id, target.warehouse_id) = (reservation.item_id, reservation.warehouse_id)
    WHERE reservation.company_id = v_company_id AND reservation.deleted_at IS NULL
      AND reservation.active_quantity_base > 0
  ), commitment_totals AS (
    SELECT item_id, warehouse_id, SUM(active_quantity_base) AS qty_reserved
    FROM commitments
    GROUP BY item_id, warehouse_id
  ), allocated_totals AS (
    SELECT allocation.item_batch_id, SUM(allocation.active_quantity_base) AS qty_reserved
    FROM public.inventory_reservation_allocations AS allocation
    JOIN commitments AS commitment ON commitment.id = allocation.reservation_id
    WHERE allocation.company_id = v_company_id AND allocation.active_quantity_base > 0
    GROUP BY allocation.item_batch_id
  ), unowned_other_batches AS (
    SELECT batch.item_id, batch.warehouse_id,
      SUM(GREATEST(batch.qty_reserved - COALESCE(allocated.qty_reserved, 0), 0)) AS qty_reserved
    FROM public.item_batches AS batch
    JOIN opening_balance_reserved_batches AS target
      ON (target.item_id, target.warehouse_id) = (batch.item_id, batch.warehouse_id)
    LEFT JOIN allocated_totals AS allocated ON allocated.item_batch_id = batch.id
    WHERE batch.company_id = v_company_id AND batch.deleted_at IS NULL AND batch.qty_reserved > 0
    GROUP BY batch.item_id, batch.warehouse_id
  )
  UPDATE public.item_warehouse AS stock
  SET reserved_stock = stock.reserved_stock - target.qty_reserved
  FROM opening_balance_reserved_batches AS target
  LEFT JOIN commitment_totals AS commitment USING (item_id, warehouse_id)
  LEFT JOIN unowned_other_batches AS other USING (item_id, warehouse_id)
  WHERE stock.company_id = v_company_id AND stock.deleted_at IS NULL
    AND (stock.item_id, stock.warehouse_id) = (target.item_id, target.warehouse_id)
    AND stock.reserved_stock - target.qty_reserved >=
      COALESCE(commitment.qty_reserved, 0) + COALESCE(other.qty_reserved, 0);
  GET DIAGNOSTICS v_warehouse_count = ROW_COUNT;

  IF v_warehouse_count <> v_batch_count THEN
    RAISE EXCEPTION 'Cannot release OPENING-BAL stock in % item/warehouse balances without affecting other reservations',
      v_batch_count - v_warehouse_count;
  END IF;

  RAISE NOTICE 'Batches released: %, batch locations released: %, warehouse balances updated: %, reserved base units released: %',
    v_batch_count, v_location_count, v_warehouse_count, v_quantity_released;
END;
$release_opening_balance$;

ROLLBACK; -- Change to COMMIT after reviewing the dry run.
