-- Run against the seeded local DB after the received-date migration. All writes roll back.
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
  AND loc.is_active AND loc.deleted_at IS NULL
JOIN public.items item ON item.company_id = actor.company_id AND item.deleted_at IS NULL
WHERE actor.is_active AND actor.deleted_at IS NULL
  AND public.user_has_permission(actor.id, 'stock_adjustments', 'create', wh.business_unit_id)
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
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  ctx RECORD; source_line JSONB; destination_line JSONB;
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
  SELECT item_batch_location_id INTO destination_batch_location FROM public.stock_adjustment_items
    WHERE adjustment_id=destination_adjustment;
  IF destination_batch_location=source_batch_location OR NOT EXISTS (
    SELECT 1 FROM public.item_batch_locations WHERE id=destination_batch_location
    AND item_batch_id=batch_id AND location_id=ctx.destination_id AND qty_on_hand=0
  ) THEN RAISE EXCEPTION 'Destination identity not created correctly'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.item_batches WHERE id=batch_id AND received_at=TIMESTAMP '1999-01-01')
    THEN RAISE EXCEPTION 'Original received date changed'; END IF;
  -- Editing and another draft both reuse the same destination record.
  PERFORM public.update_stock_adjustment(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
    destination_adjustment, p_items=>jsonb_build_array(destination_line));
  SELECT adjustment_id INTO saved_id FROM public.create_stock_adjustment(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, 'physical_count', CURRENT_DATE,
    ctx.destination_warehouse_id, ctx.destination_id, 'Reuse batch test', NULL, jsonb_build_array(destination_line));
  IF (SELECT count(*) FROM public.item_batch_locations WHERE item_batch_id=batch_id AND location_id=ctx.destination_id)<>1
    OR NOT EXISTS (SELECT 1 FROM public.stock_adjustment_items WHERE adjustment_id=saved_id
      AND item_batch_location_id=destination_batch_location)
    THEN RAISE EXCEPTION 'Destination was duplicated'; END IF;
  PERFORM public.post_stock_adjustment(destination_adjustment, ctx.company_id, ctx.business_unit_id, ctx.actor_id);
  IF NOT EXISTS (SELECT 1 FROM public.item_batch_locations WHERE id=source_batch_location AND qty_on_hand=10)
    OR NOT EXISTS (SELECT 1 FROM public.item_batch_locations WHERE id=destination_batch_location AND qty_on_hand=7)
    OR NOT EXISTS (SELECT 1 FROM public.item_batches WHERE id=batch_id AND qty_on_hand=17)
    THEN RAISE EXCEPTION 'Posting modified source stock or incorrect totals'; END IF;
  -- Existing destination quantities support normal decreases.
  SELECT adjustment_id INTO saved_id FROM public.create_stock_adjustment(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, 'physical_count', CURRENT_DATE,
    ctx.destination_warehouse_id, ctx.destination_id, 'Decrease test', NULL,
    jsonb_build_array(destination_line || jsonb_build_object('currentQty',7,'adjustedQty',5,'enteredQty',2,'enteredUnitOptionId',null)));
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
  -- One warehouse code can be selected for another item without borrowing its stock.
  UPDATE public.item_batches SET qty_reserved=2 WHERE id=batch_id;
  UPDATE public.item_batch_locations SET qty_reserved=2 WHERE id=destination_batch_location;
  SELECT id,uom_id INTO STRICT other_item,other_uom FROM public.items
    WHERE company_id=ctx.company_id AND id<>ctx.item_id AND deleted_at IS NULL ORDER BY id LIMIT 1;
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
      'itemBatchLocationId',(SELECT item_batch_location_id FROM public.stock_adjustment_items WHERE adjustment_id=saved_id),
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
  SELECT bl.item_batch_id,bl.id INTO other_batch,other_batch_location
    FROM public.stock_adjustment_items sai JOIN public.item_batch_locations bl ON bl.id=sai.item_batch_location_id
    WHERE sai.adjustment_id=saved_id;
  IF other_batch=batch_id OR NOT EXISTS(SELECT 1 FROM public.item_batches WHERE id=other_batch AND item_id=other_item
    AND received_at=TIMESTAMPTZ '1999-01-01 12:34:56+00' AND qty_on_hand=0) THEN
    RAISE EXCEPTION 'Cross item identity/date not preserved';
  END IF;
  PERFORM public.update_stock_adjustment(ctx.company_id,ctx.business_unit_id,ctx.actor_id,saved_id,p_items=>jsonb_build_array(cross_item_line));
  PERFORM public.post_stock_adjustment(saved_id,ctx.company_id,ctx.business_unit_id,ctx.actor_id);
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
