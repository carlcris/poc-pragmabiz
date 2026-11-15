-- Run against seeded local Supabase. All fixture rows roll back.
BEGIN;
CREATE TEMP TABLE batch_destination_context ON COMMIT DROP AS
SELECT actor.id AS actor_id, actor.company_id, wh.business_unit_id, wh.id AS warehouse_id,
  wh.id AS destination_warehouse_id, other.id AS other_warehouse_id,
  loc.id AS location_id, item.id AS item_id, item.uom_id,
  'DATE-TEST-' || gen_random_uuid()::TEXT AS batch_prefix
FROM public.users actor
JOIN public.user_business_unit_access access_row ON access_row.user_id = actor.id
JOIN public.warehouses wh ON wh.business_unit_id = access_row.business_unit_id
  AND wh.company_id = actor.company_id AND wh.is_active AND wh.deleted_at IS NULL
JOIN public.warehouses other ON other.company_id=wh.company_id AND other.business_unit_id=wh.business_unit_id
  AND other.id<>wh.id AND other.is_active AND other.deleted_at IS NULL
JOIN public.warehouse_locations loc ON loc.warehouse_id = wh.id
  AND loc.is_active AND loc.is_storable AND loc.deleted_at IS NULL
JOIN public.items item ON item.company_id = actor.company_id AND item.deleted_at IS NULL
WHERE actor.is_active AND actor.deleted_at IS NULL
  AND public.user_has_permission(actor.id, 'stock_adjustments', 'create', wh.business_unit_id)
  AND public.user_has_permission(actor.id, 'stock_adjustments', 'edit', wh.business_unit_id)
LIMIT 1;
ALTER TABLE batch_destination_context ADD COLUMN destination_id UUID, ADD COLUMN empty_location_id UUID, ADD COLUMN other_location_id UUID;
DO $$
DECLARE ctx RECORD; destination UUID; empty_location UUID; other_location UUID;
BEGIN
  SELECT company_id, destination_warehouse_id, other_warehouse_id INTO STRICT ctx FROM batch_destination_context;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, name, location_type)
  VALUES(ctx.company_id, ctx.destination_warehouse_id, 'Batch destination test', 'bin') RETURNING id INTO destination;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, name, location_type)
  VALUES(ctx.company_id, ctx.destination_warehouse_id, 'Empty batch destination test', 'bin') RETURNING id INTO empty_location;
  INSERT INTO public.warehouse_locations(company_id, warehouse_id, name, location_type)
  VALUES(ctx.company_id, ctx.other_warehouse_id, 'Other warehouse test', 'bin') RETURNING id INTO other_location;
  UPDATE batch_destination_context SET destination_id=destination, empty_location_id=empty_location, other_location_id=other_location;
END $$;
GRANT SELECT ON batch_destination_context TO authenticated;
SELECT set_config('request.jwt.claim.sub', actor_id::TEXT, TRUE) FROM batch_destination_context;
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SELECT set_config('request.jwt.claims', jsonb_build_object('current_business_unit_id', business_unit_id)::text, TRUE)
FROM batch_destination_context;
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  ctx RECORD; source_line JSONB; destination_line JSONB; posting_rollback_id UUID; rollback_batch_id UUID;
  discarded_draft_id UUID;
  other_item UUID; other_uom UUID; other_batch UUID; other_batch_location UUID; cross_item_line JSONB; option_row RECORD;
  duplicate_item UUID; duplicate_date TEXT;
  source_adjustment UUID; destination_adjustment UUID; source_batch_location UUID;
  destination_batch_location UUID; batch_id UUID; saved_id UUID; before_count BIGINT;
BEGIN
  SELECT actor_id, company_id, business_unit_id, warehouse_id, location_id, item_id, uom_id,
    batch_prefix, destination_warehouse_id, destination_id, empty_location_id, other_warehouse_id, other_location_id INTO STRICT ctx FROM batch_destination_context;
  source_line := jsonb_build_object('itemId', ctx.item_id, 'uomId', ctx.uom_id,
    'batchCode', ctx.batch_prefix, 'batchReceivedDate', '1999-01-01',
    'currentQty', 0, 'adjustedQty', 10,'enteredQty',10,'enteredUnitOptionId',null, 'unitCost', 1);
  SELECT adjustment_id INTO source_adjustment FROM public.create_stock_adjustment(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, 'physical_count', CURRENT_DATE,
    ctx.warehouse_id, ctx.location_id, 'Source batch test', NULL, jsonb_build_array(source_line));
  PERFORM public.post_stock_adjustment(source_adjustment, ctx.company_id, ctx.business_unit_id, ctx.actor_id);
  SELECT sai.item_batch_location_id, bl.item_batch_id INTO source_batch_location, batch_id
    FROM public.stock_adjustment_items sai JOIN public.item_batch_locations bl ON bl.id=sai.item_batch_location_id
    WHERE sai.adjustment_id=source_adjustment;
  destination_line := jsonb_build_object('itemId', ctx.item_id, 'uomId', ctx.uom_id,
    'itemBatchId', batch_id, 'currentQty', 0, 'adjustedQty', 7,'enteredQty',7,'enteredUnitOptionId',null, 'unitCost', 1);
  -- No received date is required; even a supplied date must never change batch identity.
  SELECT adjustment_id INTO destination_adjustment FROM public.create_stock_adjustment(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, 'physical_count', CURRENT_DATE,
    ctx.destination_warehouse_id, ctx.destination_id, 'Destination batch test', NULL,
    jsonb_build_array(destination_line || jsonb_build_object('batchReceivedDate', '2026-11-08')));
  IF NOT EXISTS (
    SELECT 1 FROM public.stock_adjustment_items
    WHERE adjustment_id = destination_adjustment AND item_batch_id = batch_id
      AND item_batch_location_id IS NULL
  ) THEN RAISE EXCEPTION 'Draft did not retain the batch without a location'; END IF;

  -- Retarget the draft to another bin without making any inventory records.
  PERFORM public.update_stock_adjustment(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
    destination_adjustment, p_location_id => ctx.empty_location_id, p_location_id_provided => TRUE);
  IF EXISTS (
    SELECT 1 FROM public.item_batch_locations
    WHERE item_batch_id = batch_id AND location_id IN (ctx.destination_id, ctx.empty_location_id)
  ) THEN RAISE EXCEPTION 'Draft created a batch location'; END IF;

  SELECT adjustment_id INTO discarded_draft_id FROM public.create_stock_adjustment(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, 'physical_count', CURRENT_DATE,
    ctx.warehouse_id, ctx.destination_id, 'Discard destination test', NULL,
    jsonb_build_array(destination_line));
  UPDATE public.stock_adjustments SET deleted_at = NOW() WHERE id = discarded_draft_id;
  IF EXISTS (
    SELECT 1 FROM public.item_batch_locations
    WHERE item_batch_id = batch_id AND location_id = ctx.destination_id
  ) THEN RAISE EXCEPTION 'Discarded draft left a batch location'; END IF;

  SELECT adjustment_id INTO saved_id FROM public.create_stock_adjustment(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, 'physical_count', CURRENT_DATE,
    ctx.destination_warehouse_id, ctx.empty_location_id, 'Reuse batch test', NULL,
    jsonb_build_array(destination_line));
  PERFORM public.post_stock_adjustment(destination_adjustment, ctx.company_id, ctx.business_unit_id, ctx.actor_id);
  SELECT item_batch_location_id INTO STRICT destination_batch_location FROM public.stock_adjustment_items
    WHERE adjustment_id = destination_adjustment;
  IF NOT EXISTS (
    SELECT 1 FROM public.item_batch_locations WHERE id = destination_batch_location
      AND item_batch_id = batch_id AND location_id = ctx.empty_location_id
      AND qty_on_hand = 7 AND batch_location_sku IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.item_batch_locations WHERE item_batch_id = batch_id AND location_id = ctx.destination_id
  ) THEN RAISE EXCEPTION 'Posting should create stock only in the final bin'; END IF;

  PERFORM public.post_stock_adjustment(saved_id, ctx.company_id, ctx.business_unit_id, ctx.actor_id);
  IF NOT EXISTS (
    SELECT 1 FROM public.stock_adjustment_items WHERE adjustment_id = saved_id
      AND item_batch_location_id = destination_batch_location
  ) OR NOT EXISTS (
    SELECT 1 FROM public.item_batch_locations WHERE id = destination_batch_location AND qty_on_hand = 14
  ) THEN RAISE EXCEPTION 'Posting did not reuse the existing destination'; END IF;

  SELECT ctx.empty_location_id, ctx.destination_id INTO ctx.destination_id, ctx.empty_location_id;

  -- Existing destination quantities support normal decreases.
  SELECT adjustment_id INTO saved_id FROM public.create_stock_adjustment(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, 'physical_count', CURRENT_DATE,
    ctx.destination_warehouse_id, ctx.destination_id, 'Decrease test', NULL,
    jsonb_build_array(destination_line || jsonb_build_object('currentQty',14,'adjustedQty',5,'enteredQty',9,'enteredUnitOptionId',null)));
  PERFORM public.post_stock_adjustment(saved_id, ctx.company_id, ctx.business_unit_id, ctx.actor_id);
  IF NOT EXISTS (SELECT 1 FROM public.item_batch_locations WHERE id=destination_batch_location AND qty_on_hand=5)
    THEN RAISE EXCEPTION 'Existing destination decrease failed'; END IF;
  SELECT count(*) INTO before_count FROM public.stock_adjustments;
  BEGIN
    PERFORM public.create_stock_adjustment(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
      'physical_count', CURRENT_DATE, ctx.destination_warehouse_id, ctx.empty_location_id, 'Invalid decrease', NULL,
      jsonb_build_array(destination_line || jsonb_build_object('currentQty',2,'adjustedQty',1,'enteredQty',1,'enteredUnitOptionId',null)));
    RAISE EXCEPTION 'Missing destination accepted a decrease';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'A new batch location requires a positive stock increase from zero' THEN RAISE; END IF;
  END;
  -- A warehouse-scoped batch cannot be reused in another warehouse, even in the same BU.
  BEGIN
    PERFORM public.create_stock_adjustment(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
      'physical_count', CURRENT_DATE, ctx.other_warehouse_id, ctx.other_location_id, 'Cross warehouse rejected', NULL,
      jsonb_build_array(destination_line));
    RAISE EXCEPTION 'Batch from another warehouse was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Selected batch location is not valid for the adjustment' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.item_batch_locations WHERE item_batch_id=batch_id AND location_id=ctx.other_location_id)
    THEN RAISE EXCEPTION 'Cross warehouse rejection left a location record'; END IF;
  -- The first line creates a destination; the invalid second line must roll it back.
  BEGIN
    PERFORM public.create_stock_adjustment(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
      'physical_count', CURRENT_DATE, ctx.destination_warehouse_id, ctx.empty_location_id, 'Rollback test', NULL,
      jsonb_build_array(destination_line, destination_line || jsonb_build_object('itemBatchId',gen_random_uuid())));
    RAISE EXCEPTION 'Invalid batch unexpectedly accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Selected batch location is not valid for the adjustment' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.item_batch_locations WHERE item_batch_id=batch_id AND location_id=ctx.empty_location_id)
    OR (SELECT count(*) FROM public.stock_adjustments)<>before_count
    THEN RAISE EXCEPTION 'Failed save left partial writes'; END IF;
  -- The first posted line creates stock before a later line's decrease fails.
  SELECT adjustment_id INTO posting_rollback_id FROM public.create_stock_adjustment(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, 'physical_count', CURRENT_DATE,
    ctx.warehouse_id, ctx.destination_id, 'Posting rollback', NULL,
    jsonb_build_array(
      source_line || jsonb_build_object('batchCode', replace(ctx.batch_prefix, 'DATE-TEST-', 'POST-ROLLBACK-')),
      destination_line || jsonb_build_object('itemBatchLocationId', destination_batch_location,
        'currentQty', 5, 'adjustedQty', 0, 'enteredQty', 5)
    ));
  SELECT sai.item_batch_id INTO STRICT rollback_batch_id
  FROM public.stock_adjustment_items sai
  JOIN public.item_batches batch ON batch.id = sai.item_batch_id
  WHERE sai.adjustment_id = posting_rollback_id AND batch.batch_code = replace(ctx.batch_prefix, 'DATE-TEST-', 'POST-ROLLBACK-');
  -- The adjustment rows share an item, so creation time fixes the execution order.
  UPDATE public.stock_adjustment_items SET created_at = created_at - INTERVAL '1 second'
  WHERE adjustment_id = posting_rollback_id AND item_batch_id = rollback_batch_id;
  UPDATE public.item_batch_locations SET qty_reserved = 2 WHERE id = destination_batch_location;
  BEGIN
    PERFORM public.post_stock_adjustment(posting_rollback_id, ctx.company_id, ctx.business_unit_id, ctx.actor_id);
    RAISE EXCEPTION 'Posting accepted a decrease below reserved stock';
  EXCEPTION WHEN SQLSTATE 'SA006' THEN NULL;
  END;
  IF EXISTS (
    SELECT 1 FROM public.item_batch_locations WHERE item_batch_id = rollback_batch_id
  ) OR EXISTS (
    SELECT 1 FROM public.stock_transactions WHERE reference_id = posting_rollback_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.stock_adjustments WHERE id = posting_rollback_id
      AND status = 'draft' AND stock_transaction_id IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.stock_adjustment_items WHERE adjustment_id = posting_rollback_id
      AND item_batch_id = rollback_batch_id AND item_batch_location_id IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.item_batches WHERE id = rollback_batch_id AND qty_on_hand = 0
  ) THEN RAISE EXCEPTION 'Failed posting left a transaction, batch location, or stock change'; END IF;

  BEGIN
    PERFORM public.post_stock_adjustment(posting_rollback_id, ctx.company_id, ctx.business_unit_id, gen_random_uuid());
    RAISE EXCEPTION 'Posting accepted a different user';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- One warehouse code can be selected for another item without borrowing its stock.
  UPDATE public.item_batches SET qty_reserved=2 WHERE id=batch_id;
  SELECT id,uom_id INTO STRICT other_item,other_uom FROM public.items
    WHERE company_id=ctx.company_id AND id<>ctx.item_id AND deleted_at IS NULL ORDER BY id LIMIT 1;
  SELECT count(*) INTO before_count FROM public.stock_adjustments;
  -- New Batch cannot reuse a warehouse code for any item/date, even at an empty location.
  FOREACH duplicate_item IN ARRAY ARRAY[ctx.item_id, other_item] LOOP
    FOREACH duplicate_date IN ARRAY ARRAY['1999-01-01', '2000-01-01'] LOOP
      BEGIN
        PERFORM public.create_stock_adjustment(ctx.company_id,ctx.business_unit_id,ctx.actor_id,
          'physical_count',CURRENT_DATE,ctx.warehouse_id,ctx.empty_location_id,'Duplicate new batch',NULL,
          jsonb_build_array(source_line || jsonb_build_object('batchCode',ctx.batch_prefix || '-rollback'),
            source_line || jsonb_build_object('itemId',duplicate_item,'batchReceivedDate',duplicate_date)));
        RAISE EXCEPTION 'New Batch accepted an existing warehouse code';
      EXCEPTION WHEN SQLSTATE 'SA003' THEN NULL;
      END;
      IF EXISTS(SELECT 1 FROM public.item_batches WHERE batch_code=ctx.batch_prefix || '-rollback')
        OR (SELECT count(*) FROM public.stock_adjustments)<>before_count THEN
        RAISE EXCEPTION 'Duplicate rejection did not roll back the earlier line and header';
      END IF;
    END LOOP;
  END LOOP;
  -- A different warehouse may independently create the same code.
  SELECT adjustment_id INTO saved_id FROM public.create_stock_adjustment(
    ctx.company_id,ctx.business_unit_id,ctx.actor_id,'physical_count',CURRENT_DATE,
    ctx.other_warehouse_id,ctx.other_location_id,'Independent warehouse code',NULL,jsonb_build_array(source_line));
  PERFORM public.update_stock_adjustment(ctx.company_id,ctx.business_unit_id,ctx.actor_id,saved_id,
    p_items=>jsonb_build_array(jsonb_build_object('itemId',ctx.item_id,'uomId',ctx.uom_id,
      'itemBatchId',(SELECT item_batch_id FROM public.stock_adjustment_items WHERE adjustment_id=saved_id),
      'currentQty',0,'adjustedQty',11,'enteredQty',11,'enteredUnitOptionId',null,'unitCost',1)));
  -- An update rejects New Batch too and restores the draft lines deleted earlier in the RPC.
  BEGIN
    PERFORM public.update_stock_adjustment(ctx.company_id,ctx.business_unit_id,ctx.actor_id,saved_id,
      p_items=>jsonb_build_array(source_line));
    RAISE EXCEPTION 'Draft update accepted an existing code as New Batch';
  EXCEPTION WHEN SQLSTATE 'SA003' THEN NULL;
  END;
  IF NOT EXISTS(SELECT 1 FROM public.stock_adjustment_items WHERE adjustment_id=saved_id AND adjusted_qty=11)
    THEN RAISE EXCEPTION 'Rejected draft update lost its original line'; END IF;
  SELECT count(*) INTO before_count FROM public.stock_adjustments;
  UPDATE public.item_batches SET received_at=TIMESTAMPTZ '1999-01-01 12:34:56+00' WHERE id=batch_id;
  SELECT item_batch_id,item_batch_location_id,qty_on_hand,received_at INTO STRICT option_row
    FROM public.search_stock_adjustment_batches(ctx.company_id,other_item,ctx.warehouse_id,ctx.destination_id,ctx.batch_prefix,5);
  IF option_row.item_batch_id<>batch_id OR option_row.item_batch_location_id IS NOT NULL
    OR option_row.qty_on_hand<>0 OR option_row.received_at<>TIMESTAMPTZ '1999-01-01 12:34:56+00' THEN
    RAISE EXCEPTION 'Other item inherited source stock or lost batch date';
  END IF;
  IF EXISTS (SELECT 1 FROM public.search_stock_adjustment_batches(ctx.company_id,other_item,ctx.warehouse_id,ctx.destination_id,
    (SELECT batch_location_sku FROM public.item_batch_locations WHERE id=source_batch_location),5)) THEN
    RAISE EXCEPTION 'Another item QR resolved as target stock';
  END IF;
  cross_item_line := jsonb_build_object('itemId',other_item,'uomId',other_uom,'itemBatchId',batch_id,
    'currentQty',0,'adjustedQty',4,'enteredQty',4,'enteredUnitOptionId',null,'unitCost',1,'batchReceivedDate','2026-11-08');
  BEGIN
    PERFORM public.create_stock_adjustment(ctx.company_id,ctx.business_unit_id,ctx.actor_id,
      'physical_count',CURRENT_DATE,ctx.warehouse_id,ctx.destination_id,'Cross item rollback',NULL,
      jsonb_build_array(cross_item_line,cross_item_line || jsonb_build_object('itemBatchId',gen_random_uuid())));
    RAISE EXCEPTION 'Invalid second line accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Selected batch location is not valid for the adjustment' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM public.item_batches WHERE item_id=other_item AND batch_code=ctx.batch_prefix)
    OR (SELECT count(*) FROM public.stock_adjustments)<>before_count THEN
    RAISE EXCEPTION 'Cross item failure left a batch or header';
  END IF;
  SELECT adjustment_id INTO saved_id FROM public.create_stock_adjustment(ctx.company_id,ctx.business_unit_id,ctx.actor_id,
    'physical_count',CURRENT_DATE,ctx.warehouse_id,ctx.destination_id,'Cross item reuse',NULL,jsonb_build_array(cross_item_line));
  SELECT item_batch_id, item_batch_location_id INTO STRICT other_batch, other_batch_location
    FROM public.stock_adjustment_items WHERE adjustment_id = saved_id;
  IF other_batch_location IS NOT NULL THEN RAISE EXCEPTION 'Draft created a cross-item batch location'; END IF;
  IF other_batch=batch_id OR NOT EXISTS(SELECT 1 FROM public.item_batches WHERE id=other_batch AND item_id=other_item
    AND received_at=TIMESTAMPTZ '1999-01-01 12:34:56+00' AND qty_on_hand=0) THEN
    RAISE EXCEPTION 'Cross item identity/date not preserved';
  END IF;
  PERFORM public.update_stock_adjustment(ctx.company_id,ctx.business_unit_id,ctx.actor_id,saved_id,p_items=>jsonb_build_array(cross_item_line));
  PERFORM public.post_stock_adjustment(saved_id,ctx.company_id,ctx.business_unit_id,ctx.actor_id);
  SELECT item_batch_location_id INTO STRICT other_batch_location
    FROM public.stock_adjustment_items WHERE adjustment_id = saved_id;
  IF NOT EXISTS(SELECT 1 FROM public.item_batches WHERE id=other_batch AND qty_on_hand=4 AND qty_reserved=0)
    OR NOT EXISTS(SELECT 1 FROM public.item_batches WHERE id=batch_id AND qty_on_hand=15 AND qty_reserved=2)
    OR NOT EXISTS(SELECT 1 FROM public.item_batch_locations WHERE id=source_batch_location AND qty_on_hand=10)
    OR NOT EXISTS(SELECT 1 FROM public.item_batch_locations WHERE id=destination_batch_location AND qty_on_hand=5) THEN
    RAISE EXCEPTION 'Posting mixed item quantities';
  END IF;
  SELECT item_batch_id,item_batch_location_id,qty_on_hand INTO STRICT option_row
    FROM public.search_stock_adjustment_batches(ctx.company_id,other_item,ctx.warehouse_id,ctx.destination_id,ctx.batch_prefix,5);
  IF option_row.item_batch_id<>other_batch OR option_row.item_batch_location_id<>other_batch_location OR option_row.qty_on_hand<>4 THEN
    RAISE EXCEPTION 'Selector duplicated codes or mixed item stock';
  END IF;
  -- Even when the source item is at the same destination, only requested-item quantities appear.
  SELECT qty_on_hand,qty_available,qty_reserved INTO STRICT option_row FROM public.search_stock_adjustment_batches(
    ctx.company_id,ctx.item_id,ctx.warehouse_id,ctx.destination_id,ctx.batch_prefix,5);
  IF option_row.qty_on_hand<>5 OR option_row.qty_available<>3 OR option_row.qty_reserved<>2 THEN
    RAISE EXCEPTION 'Source selector included other item stock or changed reservations'; END IF;
  SELECT item_batch_id,qty_on_hand INTO STRICT option_row FROM public.search_stock_adjustment_batches(
    ctx.company_id,ctx.item_id,ctx.warehouse_id,ctx.destination_id,
    (SELECT batch_location_sku FROM public.item_batch_locations WHERE id=source_batch_location),5);
  IF option_row.item_batch_id<>batch_id OR option_row.qty_on_hand<>5 THEN
    RAISE EXCEPTION 'Same item QR lost destination scope';
  END IF;
  -- Existing conflicting dates are rejected, never rewritten or silently chosen.
  UPDATE public.item_batches SET received_at=TIMESTAMPTZ '2000-01-01 12:34:56+00' WHERE id=other_batch;
  BEGIN
    PERFORM public.create_stock_adjustment(ctx.company_id,ctx.business_unit_id,ctx.actor_id,
      'physical_count',CURRENT_DATE,ctx.warehouse_id,ctx.destination_id,'Cross item date conflict',NULL,
      jsonb_build_array(cross_item_line || jsonb_build_object('itemBatchId',other_batch,'itemBatchLocationId',other_batch_location,'currentQty',4,'adjustedQty',5,'enteredQty',1,'enteredUnitOptionId',null)));
    RAISE EXCEPTION 'Conflicting original date accepted';
  EXCEPTION WHEN SQLSTATE 'SA002' THEN NULL;
  END;
  IF NOT EXISTS(SELECT 1 FROM public.item_batches WHERE id=batch_id AND received_at=TIMESTAMPTZ '1999-01-01 12:34:56+00' AND qty_on_hand=15)
    OR NOT EXISTS(SELECT 1 FROM public.item_batches WHERE id=other_batch AND received_at=TIMESTAMPTZ '2000-01-01 12:34:56+00' AND qty_on_hand=4) THEN
    RAISE EXCEPTION 'Conflicting dates or stock were overwritten';
  END IF;
  RAISE NOTICE 'Passed same-warehouse cross-item/code reuse, exact received timestamps, separate stock, deduplicated lookup, conflict rejection, and rollback';
  RAISE NOTICE 'Passed authenticated batch destination creation, date preservation, reuse, draft edit, posting, decrease, and rollback';
END $$;
ROLLBACK;
