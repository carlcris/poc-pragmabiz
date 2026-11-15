-- Run against the seeded local DB after the expiration-date migration. All writes roll back.
BEGIN;
CREATE TEMP TABLE expiration_date_context ON COMMIT DROP AS
SELECT actor.id AS actor_id, actor.company_id, wh.business_unit_id, wh.id AS warehouse_id,
  loc.id AS location_id, item.id AS item_id, item.uom_id,
  'EXPIRATION-TEST-' || gen_random_uuid()::TEXT AS batch_prefix
FROM public.users actor
JOIN public.user_business_unit_access access_row ON access_row.user_id = actor.id
JOIN public.warehouses wh ON wh.business_unit_id = access_row.business_unit_id
  AND wh.company_id = actor.company_id AND wh.is_active AND wh.deleted_at IS NULL
JOIN public.warehouse_locations loc ON loc.warehouse_id = wh.id
  AND loc.is_active AND loc.is_storable AND loc.deleted_at IS NULL
JOIN public.items item ON item.company_id = actor.company_id AND item.deleted_at IS NULL
WHERE actor.is_active AND actor.deleted_at IS NULL
  AND public.user_has_permission(actor.id, 'stock_adjustments', 'create', wh.business_unit_id)
  AND public.user_has_permission(actor.id, 'stock_adjustments', 'edit', wh.business_unit_id)
LIMIT 1;
GRANT SELECT ON expiration_date_context TO authenticated;
SELECT set_config('request.jwt.claim.sub', actor_id::TEXT, TRUE) FROM expiration_date_context;
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SELECT set_config('request.jwt.claims', jsonb_build_object('current_business_unit_id', business_unit_id)::text, TRUE)
FROM expiration_date_context;
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  ctx RECORD;
  line JSONB;
  saved_id UUID;
  saved_batch_id UUID;
  adjustment_count BIGINT;
  ordered_codes TEXT[];
BEGIN
  SELECT actor_id, company_id, business_unit_id, warehouse_id, location_id, item_id, uom_id, batch_prefix
  INTO STRICT ctx FROM expiration_date_context;
  line := jsonb_build_object('itemId', ctx.item_id, 'uomId', ctx.uom_id,
    'batchCode', ctx.batch_prefix || '-old', 'batchReceivedDate', '1999-01-01', 'batchExpirationDate', '2000-02-29',
    'currentQty', 0, 'adjustedQty', 1,'enteredQty',1,'enteredUnitOptionId',null, 'unitCost', 1);
  SELECT adjustment_id INTO saved_id FROM public.create_stock_adjustment(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, 'physical_count', CURRENT_DATE,
    ctx.warehouse_id, ctx.location_id, 'Received date test', NULL,
    jsonb_build_array(line, line || jsonb_build_object('batchCode', ctx.batch_prefix || '-new', 'batchReceivedDate', '2024-02-29', 'batchExpirationDate', NULL)));
  SELECT array_agg(batch_code ORDER BY received_at) INTO ordered_codes
  FROM public.item_batches WHERE batch_code IN (ctx.batch_prefix || '-old', ctx.batch_prefix || '-new');
  IF ordered_codes IS DISTINCT FROM ARRAY[ctx.batch_prefix || '-old', ctx.batch_prefix || '-new'] THEN
    RAISE EXCEPTION 'Historical batch ordering failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.item_batches WHERE batch_code = ctx.batch_prefix || '-old'
    AND received_at = TIMESTAMP '1999-01-01 00:00:00' AND expiration_date = DATE '2000-02-29') THEN
    RAISE EXCEPTION 'Received date was not persisted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.item_batches WHERE batch_code = ctx.batch_prefix || '-new'
    AND expiration_date IS NULL) THEN
    RAISE EXCEPTION 'Blank expiration was not preserved';
  END IF;
  SELECT line_item.item_batch_id INTO STRICT saved_batch_id
  FROM public.stock_adjustment_items line_item
  JOIN public.item_batches batch ON batch.id = line_item.item_batch_id
  WHERE line_item.adjustment_id = saved_id AND batch.batch_code = ctx.batch_prefix || '-old';
  PERFORM adjustment_id FROM public.update_stock_adjustment(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, saved_id,
    p_items => jsonb_build_array((line - 'batchReceivedDate' - 'batchCode' - 'batchExpirationDate') ||
      jsonb_build_object('itemBatchId', saved_batch_id)));
  IF NOT EXISTS (SELECT 1 FROM public.item_batches WHERE batch_code = ctx.batch_prefix || '-old'
    AND received_at = TIMESTAMP '1999-01-01 00:00:00' AND expiration_date = DATE '2000-02-29') THEN
    RAISE EXCEPTION 'Existing batch date changed on draft update';
  END IF;
  SELECT count(*) INTO adjustment_count FROM public.stock_adjustments;
  BEGIN
    PERFORM adjustment_id FROM public.create_stock_adjustment(
      ctx.company_id, ctx.business_unit_id, ctx.actor_id, 'physical_count', CURRENT_DATE,
      ctx.warehouse_id, ctx.location_id, 'Rollback test', NULL,
      jsonb_build_array(line || jsonb_build_object('batchCode', ctx.batch_prefix || '-rollback'),
        line || jsonb_build_object('batchCode', ctx.batch_prefix || '-invalid', 'batchExpirationDate', '2025-02-29')));
    RAISE EXCEPTION 'Invalid date unexpectedly accepted';
  EXCEPTION WHEN SQLSTATE 'SA005' THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.item_batches WHERE batch_code = ctx.batch_prefix || '-rollback')
    OR (SELECT count(*) FROM public.stock_adjustments) <> adjustment_count THEN
    RAISE EXCEPTION 'Failed save left partial batch or header writes';
  END IF;
  BEGIN
    PERFORM adjustment_id FROM public.create_stock_adjustment(
      ctx.company_id, ctx.business_unit_id, ctx.actor_id, 'physical_count', CURRENT_DATE,
      ctx.warehouse_id, ctx.location_id, 'Conflict test', NULL,
      jsonb_build_array(line || jsonb_build_object('batchReceivedDate', '2000-01-01')));
    RAISE EXCEPTION 'Duplicate New Batch unexpectedly accepted';
  EXCEPTION WHEN SQLSTATE 'SA003' THEN NULL;
  END;
  PERFORM adjustment_id FROM public.update_stock_adjustment(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, saved_id,
    p_items => jsonb_build_array(line || jsonb_build_object('batchCode', ctx.batch_prefix || '-added', 'batchReceivedDate', '1900-01-01', 'batchExpirationDate', '2027-03-01')));
  IF NOT EXISTS (SELECT 1 FROM public.item_batches WHERE batch_code = ctx.batch_prefix || '-added'
    AND expiration_date = DATE '2027-03-01') THEN
    RAISE EXCEPTION 'Expiration not saved when adding new batch to draft';
  END IF;
  PERFORM public.post_stock_adjustment(saved_id, ctx.company_id, ctx.business_unit_id, ctx.actor_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.item_batch_locations bl
    JOIN public.item_batches b ON b.id = bl.item_batch_id
    WHERE b.batch_code = ctx.batch_prefix || '-added' AND bl.location_id = ctx.location_id
      AND b.expiration_date = DATE '2027-03-01' AND bl.qty_on_hand = 1
  ) THEN RAISE EXCEPTION 'Posted batch location lost the saved expiration date'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(public.get_item_location_stock_page(
      ctx.company_id, ctx.item_id, ctx.business_unit_id, 1, 1, NULL, ctx.location_id, 1)->'data') location,
      jsonb_array_elements(location->'batches') batch
    WHERE batch->>'batchCode' = ctx.batch_prefix || '-added'
      AND batch->>'expirationDate' = '2027-03-01'
  ) THEN RAISE EXCEPTION 'Location batch response omitted expiration'; END IF;
  RAISE NOTICE 'Passed: manual expiration, blank expiration, draft preservation and new-batch addition, invalid-date rollback, duplicate rejection';
END $$;
ROLLBACK;
