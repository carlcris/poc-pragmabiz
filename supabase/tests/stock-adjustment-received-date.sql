-- Run against the seeded local DB after the received-date migration. All writes roll back.
BEGIN;
CREATE TEMP TABLE received_date_context ON COMMIT DROP AS
SELECT actor.id AS actor_id, actor.company_id, wh.business_unit_id, wh.id AS warehouse_id,
  loc.id AS location_id, item.id AS item_id, item.uom_id,
  'DATE-TEST-' || gen_random_uuid()::TEXT AS batch_prefix
FROM public.users actor
JOIN public.user_business_unit_access access_row ON access_row.user_id = actor.id
JOIN public.warehouses wh ON wh.business_unit_id = access_row.business_unit_id
  AND wh.company_id = actor.company_id AND wh.is_active AND wh.deleted_at IS NULL
JOIN public.warehouse_locations loc ON loc.warehouse_id = wh.id
  AND loc.is_active AND loc.deleted_at IS NULL
JOIN public.items item ON item.company_id = actor.company_id AND item.deleted_at IS NULL
WHERE actor.is_active AND actor.deleted_at IS NULL
  AND public.user_has_permission(actor.id, 'stock_adjustments', 'create', wh.business_unit_id)
LIMIT 1;
GRANT SELECT ON received_date_context TO authenticated;
SELECT set_config('request.jwt.claim.sub', actor_id::TEXT, TRUE) FROM received_date_context;
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  ctx RECORD;
  line JSONB;
  saved_id UUID;
  batch_location_id UUID;
  adjustment_count BIGINT;
  ordered_codes TEXT[];
BEGIN
  SELECT actor_id, company_id, business_unit_id, warehouse_id, location_id, item_id, uom_id, batch_prefix
  INTO STRICT ctx FROM received_date_context;
  line := jsonb_build_object('itemId', ctx.item_id, 'uomId', ctx.uom_id,
    'batchCode', ctx.batch_prefix || '-old', 'batchReceivedDate', '1999-01-01',
    'currentQty', 0, 'adjustedQty', 1, 'unitCost', 1);
  SELECT adjustment_id INTO saved_id FROM public.create_stock_adjustment(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, 'physical_count', CURRENT_DATE,
    ctx.warehouse_id, ctx.location_id, 'Received date test', NULL,
    jsonb_build_array(line, line || jsonb_build_object('batchCode', ctx.batch_prefix || '-new', 'batchReceivedDate', '2024-02-29')));
  SELECT array_agg(batch_code ORDER BY received_at) INTO ordered_codes
  FROM public.item_batches WHERE batch_code IN (ctx.batch_prefix || '-old', ctx.batch_prefix || '-new');
  IF ordered_codes IS DISTINCT FROM ARRAY[ctx.batch_prefix || '-old', ctx.batch_prefix || '-new'] THEN
    RAISE EXCEPTION 'Historical batch ordering failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.item_batches WHERE batch_code = ctx.batch_prefix || '-old'
    AND received_at = TIMESTAMP '1999-01-01 00:00:00') THEN
    RAISE EXCEPTION 'Received date was not persisted';
  END IF;
  SELECT item_batch_location_id INTO batch_location_id FROM public.stock_adjustment_items
  WHERE adjustment_id = saved_id ORDER BY created_at, id LIMIT 1;
  PERFORM adjustment_id FROM public.update_stock_adjustment(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, saved_id,
    p_items => jsonb_build_array((line - 'batchReceivedDate' - 'batchCode') ||
      jsonb_build_object('itemBatchLocationId', batch_location_id)));
  IF NOT EXISTS (SELECT 1 FROM public.item_batches WHERE batch_code = ctx.batch_prefix || '-old'
    AND received_at = TIMESTAMP '1999-01-01 00:00:00') THEN
    RAISE EXCEPTION 'Existing batch date changed on draft update';
  END IF;
  SELECT count(*) INTO adjustment_count FROM public.stock_adjustments;
  BEGIN
    PERFORM adjustment_id FROM public.create_stock_adjustment(
      ctx.company_id, ctx.business_unit_id, ctx.actor_id, 'physical_count', CURRENT_DATE,
      ctx.warehouse_id, ctx.location_id, 'Rollback test', NULL,
      jsonb_build_array(line || jsonb_build_object('batchCode', ctx.batch_prefix || '-rollback'),
        line || jsonb_build_object('batchCode', ctx.batch_prefix || '-invalid', 'batchReceivedDate', '2025-02-29')));
    RAISE EXCEPTION 'Invalid date unexpectedly accepted';
  EXCEPTION WHEN SQLSTATE 'SA001' THEN NULL;
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
    RAISE EXCEPTION 'Conflicting date unexpectedly accepted';
  EXCEPTION WHEN SQLSTATE 'SA002' THEN NULL;
  END;
  RAISE NOTICE 'Passed: historical date, batch age ordering, draft update preservation, invalid-date rollback, date conflict';
END $$;
ROLLBACK;
