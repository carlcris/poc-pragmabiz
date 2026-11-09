-- Seeded local database; authenticated workflow, all test changes roll back.
BEGIN;
CREATE TEMP TABLE entered_unit_context ON COMMIT DROP AS
SELECT actor.id AS actor_id, actor.company_id, wh.business_unit_id, wh.id AS warehouse_id,
  loc.id AS location_id, item.id AS item_id, item.uom_id, opt.id AS unit_option_id,
  opt.qty_per_unit AS factor, 'UNIT-TEST-' || gen_random_uuid()::text AS batch_prefix
FROM public.users actor
JOIN public.user_business_unit_access access_row ON access_row.user_id = actor.id
JOIN public.warehouses wh ON wh.business_unit_id = access_row.business_unit_id
  AND wh.company_id = actor.company_id AND wh.is_active AND wh.deleted_at IS NULL
JOIN public.warehouse_locations loc ON loc.warehouse_id = wh.id AND loc.is_active AND loc.deleted_at IS NULL
JOIN public.items item ON item.company_id = actor.company_id AND item.deleted_at IS NULL
JOIN public.item_unit_options opt ON opt.item_id = item.id AND opt.is_active
  AND NOT opt.is_base AND opt.deleted_at IS NULL AND opt.qty_per_unit = 144
WHERE actor.is_active AND actor.deleted_at IS NULL
  AND public.user_has_permission(actor.id, 'stock_adjustments', 'create', wh.business_unit_id)
LIMIT 1;
GRANT SELECT ON entered_unit_context TO authenticated;
SELECT set_config('request.jwt.claim.sub', actor_id::text, TRUE) FROM entered_unit_context;
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  ctx RECORD; line JSONB; saved_id UUID; decrease_id UUID; batch_location UUID;
  before_count BIGINT; saved_label TEXT;
BEGIN
  SELECT actor_id,company_id,business_unit_id,warehouse_id,location_id,item_id,uom_id,
    unit_option_id,factor,batch_prefix INTO STRICT ctx FROM entered_unit_context;
  line := jsonb_build_object('itemId',ctx.item_id,'uomId',ctx.uom_id,
    'batchCode',ctx.batch_prefix,'batchReceivedDate','2026-01-01',
    'currentQty',0,'adjustedQty',ctx.factor,'unitCost',2,
    'enteredQty',1,'enteredUnitOptionId',ctx.unit_option_id);
  SELECT adjustment_id INTO saved_id FROM public.create_stock_adjustment(
    ctx.company_id,ctx.business_unit_id,ctx.actor_id,'physical_count',CURRENT_DATE,
    ctx.warehouse_id,ctx.location_id,'Entered units test',NULL,jsonb_build_array(line));
  SELECT item_batch_location_id,entered_unit_label INTO batch_location,saved_label
    FROM public.stock_adjustment_items WHERE adjustment_id=saved_id;
  IF NOT EXISTS (SELECT 1 FROM public.stock_adjustment_items WHERE adjustment_id=saved_id
    AND entered_qty=1 AND entered_qty_per_unit=144 AND entered_unit_option_id=ctx.unit_option_id
    AND difference=144 AND total_cost=288 AND entered_unit_label IS NOT NULL) THEN
    RAISE EXCEPTION 'Entered unit snapshot or base quantities incorrect';
  END IF;
  line := (line - 'batchCode' - 'batchReceivedDate') || jsonb_build_object('itemBatchLocationId',batch_location);
  PERFORM public.update_stock_adjustment(ctx.company_id,ctx.business_unit_id,ctx.actor_id,saved_id,
    p_items=>jsonb_build_array(line || jsonb_build_object('enteredQty',1.5,'adjustedQty',216)));
  IF NOT EXISTS (SELECT 1 FROM public.stock_adjustment_items WHERE adjustment_id=saved_id
    AND entered_qty=1.5 AND difference=216 AND entered_unit_option_id=ctx.unit_option_id) THEN
    RAISE EXCEPTION 'Draft edit lost entered quantity';
  END IF;
  -- Failure after deleting old lines and inserting the first replacement must restore the draft.
  BEGIN
    PERFORM public.update_stock_adjustment(ctx.company_id,ctx.business_unit_id,ctx.actor_id,saved_id,
      p_items=>jsonb_build_array(line,line || jsonb_build_object('enteredQty',2)));
    RAISE EXCEPTION 'Mismatched conversion accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Invalid stock adjustment entered quantity or unit' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.stock_adjustment_items WHERE adjustment_id=saved_id)<>1
    OR NOT EXISTS (SELECT 1 FROM public.stock_adjustment_items WHERE adjustment_id=saved_id
      AND entered_qty=1.5 AND difference=216) THEN RAISE EXCEPTION 'Update rollback failed'; END IF;
  PERFORM public.post_stock_adjustment(saved_id,ctx.company_id,ctx.business_unit_id,ctx.actor_id);
  IF NOT EXISTS (SELECT 1 FROM public.item_batch_locations WHERE id=batch_location AND qty_on_hand=216)
    THEN RAISE EXCEPTION 'Posting did not add base units'; END IF;
  SELECT adjustment_id INTO decrease_id FROM public.create_stock_adjustment(
    ctx.company_id,ctx.business_unit_id,ctx.actor_id,'damage',CURRENT_DATE,
    ctx.warehouse_id,ctx.location_id,'Decrease entered units',NULL,
    jsonb_build_array(line || jsonb_build_object('currentQty',216,'adjustedQty',72)));
  PERFORM public.post_stock_adjustment(decrease_id,ctx.company_id,ctx.business_unit_id,ctx.actor_id);
  IF NOT EXISTS (SELECT 1 FROM public.item_batch_locations WHERE id=batch_location AND qty_on_hand=72)
    OR NOT EXISTS (SELECT 1 FROM public.stock_adjustment_items WHERE adjustment_id=decrease_id
      AND entered_qty=1 AND difference=-144) THEN RAISE EXCEPTION 'Decrease did not subtract base units'; END IF;
  SELECT count(*) INTO before_count FROM public.stock_adjustments;
  BEGIN
    PERFORM public.create_stock_adjustment(ctx.company_id,ctx.business_unit_id,ctx.actor_id,
      'physical_count',CURRENT_DATE,ctx.warehouse_id,ctx.location_id,'Create rollback',NULL,
      jsonb_build_array((line - 'itemBatchLocationId') || jsonb_build_object('batchCode',ctx.batch_prefix || '-rollback','batchReceivedDate','2026-01-01'),
        line || jsonb_build_object('enteredQty',2)));
    RAISE EXCEPTION 'Invalid second line accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Invalid stock adjustment entered quantity or unit' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.stock_adjustments)<>before_count
    OR EXISTS (SELECT 1 FROM public.item_batches WHERE batch_code=ctx.batch_prefix || '-rollback')
    THEN RAISE EXCEPTION 'Create rollback left partial writes'; END IF;
  UPDATE public.item_unit_options SET option_label='Changed label' WHERE id=ctx.unit_option_id;
  IF NOT EXISTS (SELECT 1 FROM public.stock_adjustment_items WHERE adjustment_id=saved_id
    AND entered_unit_label=saved_label) THEN RAISE EXCEPTION 'Historical label changed'; END IF;
  RAISE NOTICE 'Passed entered-unit create/edit/decrease, base-unit posting, snapshots, create/update rollback';
END $$;
ROLLBACK;
