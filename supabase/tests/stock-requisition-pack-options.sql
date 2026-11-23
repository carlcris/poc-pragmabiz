-- Authenticated mixed-pack workflow regression. Every fixture and write rolls back.
-- docker exec -i supabase_db_backend psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/stock-requisition-pack-options.sql
BEGIN;

CREATE TEMP TABLE pack_test_context ON COMMIT DROP AS
SELECT actor.id AS actor_id, actor.company_id, wh.business_unit_id, wh.id AS warehouse_id,
  loc.id AS location_id, item.id AS item_id, box50.uom_id,
  box50.id AS option50_id, box144.id AS option144_id, supplier.id AS supplier_id,
  'PACK-TEST-' || GEN_RANDOM_UUID()::TEXT AS prefix
FROM public.users actor
JOIN public.user_business_unit_access access_row ON access_row.user_id = actor.id
JOIN public.warehouses wh ON wh.business_unit_id = access_row.business_unit_id
  AND wh.company_id = actor.company_id AND wh.is_active AND wh.deleted_at IS NULL
JOIN public.warehouse_locations loc ON loc.warehouse_id = wh.id
  AND loc.is_active AND loc.is_storable AND loc.deleted_at IS NULL
JOIN public.items item ON item.company_id = actor.company_id AND item.deleted_at IS NULL
JOIN public.item_unit_options box50 ON box50.item_id = item.id
  AND box50.qty_per_unit = 50 AND box50.is_active AND box50.deleted_at IS NULL
JOIN public.item_unit_options box144 ON box144.item_id = item.id AND box144.uom_id = box50.uom_id
  AND box144.qty_per_unit = 144 AND box144.is_active AND box144.deleted_at IS NULL
JOIN public.suppliers supplier ON supplier.company_id = actor.company_id AND supplier.deleted_at IS NULL
WHERE actor.is_active AND actor.deleted_at IS NULL
  AND public.user_has_permission(actor.id, 'stock_requisitions', 'create', wh.business_unit_id)
  AND public.user_has_permission(actor.id, 'stock_requisitions', 'edit', wh.business_unit_id)
  AND public.user_has_permission(actor.id, 'stock_requisitions.field.unit_cost.view', 'view', wh.business_unit_id)
  AND public.user_has_permission(actor.id, 'load_lists.operation.link_stock_requisitions.edit', 'edit', wh.business_unit_id)
ORDER BY actor.id, wh.id, loc.id, item.id, supplier.id LIMIT 1;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pack_test_context) THEN
    RAISE EXCEPTION 'Test requires an authorized local actor, location, supplier, and same-item BOX(50)/BOX(144) options';
  END IF;
END $$;
GRANT SELECT ON pack_test_context TO authenticated;
SELECT SET_CONFIG('request.jwt.claim.sub', actor_id::TEXT, TRUE),
  SET_CONFIG('request.jwt.claims', JSONB_BUILD_OBJECT('sub', actor_id, 'role', 'authenticated',
    'current_business_unit_id', business_unit_id)::TEXT, TRUE)
FROM pack_test_context;

CREATE FUNCTION pg_temp.force_pack_save_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.notes = 'force-pack-save-failure' THEN
    IF NOT EXISTS (SELECT 1 FROM public.stock_requisition_items sri
      JOIN pack_test_context ctx ON ctx.option50_id = sri.item_unit_option_id
      WHERE sri.sr_id = NEW.sr_id) THEN
      RAISE EXCEPTION 'Forced rollback did not run after the first pack line was written';
    END IF;
    RAISE EXCEPTION 'forced mixed pack save rollback';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pack_save_failure BEFORE INSERT ON public.stock_requisition_items
FOR EACH ROW EXECUTE FUNCTION pg_temp.force_pack_save_failure();

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  ctx RECORD; line50 JSONB; line144 JSONB; lines JSONB; header JSONB;
  v_sr_id UUID; v_sr_number TEXT; v_sr50_id UUID; v_sr144_id UUID; v_ll_id UUID;
  v_ll50_id UUID; v_ll144_id UUID; v_grn_id UUID; v_task50_id UUID; v_task144_id UUID;
  before_count BIGINT; before_lines JSONB; result_count BIGINT; original_stock NUMERIC;
  allocated INTEGER; staged50 NUMERIC; staged144 NUMERIC;
BEGIN
  SELECT actor_id, company_id, business_unit_id, warehouse_id, location_id,
    item_id, uom_id, option50_id, option144_id, supplier_id, prefix INTO STRICT ctx FROM pack_test_context;
  line50 := JSONB_BUILD_OBJECT('item_id', ctx.item_id, 'item_unit_option_id', ctx.option50_id,
    'uom_id', ctx.uom_id, 'requested_qty', 50, 'unit_price', 1.08);
  line144 := JSONB_BUILD_OBJECT('item_id', ctx.item_id, 'item_unit_option_id', ctx.option144_id,
    'uom_id', ctx.uom_id, 'requested_qty', 100, 'unit_price', 1.08);
  lines := JSONB_BUILD_ARRAY(line50, line144);
  header := JSONB_BUILD_OBJECT('supplier_id', ctx.supplier_id, 'currency', 'PHP', 'notes', ctx.prefix);

  -- Same-item distinct options save with both conversions and one correct document total.
  SELECT saved.id, saved.sr_number INTO v_sr_id, v_sr_number FROM public.save_stock_requisition(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, header, lines) saved;
  IF (SELECT COUNT(*) FROM public.stock_requisition_items sri WHERE sri.sr_id = v_sr_id) <> 2
    OR NOT EXISTS (SELECT 1 FROM public.stock_requisitions sr WHERE sr.id = v_sr_id
      AND sr.total_amount = 18252 AND sr.status = 'draft') THEN
    RAISE EXCEPTION 'Mixed pack creation or base-unit cost calculation failed';
  END IF;

  SELECT JSONB_AGG(TO_JSONB(sri) ORDER BY sri.id) INTO before_lines
  FROM public.stock_requisition_items sri WHERE sri.sr_id = v_sr_id;
  BEGIN
    PERFORM public.save_stock_requisition(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
      header, JSONB_BUILD_ARRAY(line50, line50), v_sr_id);
    RAISE EXCEPTION 'Duplicate pack was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Duplicate stock requisition pack option' THEN RAISE; END IF;
  END;
  IF (SELECT JSONB_AGG(TO_JSONB(sri) ORDER BY sri.id) FROM public.stock_requisition_items sri
      WHERE sri.sr_id = v_sr_id) IS DISTINCT FROM before_lines THEN
    RAISE EXCEPTION 'Duplicate rejection changed the saved lines';
  END IF;

  SELECT COUNT(*) INTO before_count FROM public.stock_requisitions;
  BEGIN
    PERFORM public.save_stock_requisition(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
      header, JSONB_BUILD_ARRAY(line144, line144));
    RAISE EXCEPTION 'Duplicate pack create was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Duplicate stock requisition pack option' THEN RAISE; END IF;
  END;
  IF (SELECT COUNT(*) FROM public.stock_requisitions) <> before_count THEN
    RAISE EXCEPTION 'Duplicate creation left a header';
  END IF;

  -- Force failure after the first new line is written on update and on create.
  BEGIN
    PERFORM public.save_stock_requisition(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
      header || JSONB_BUILD_OBJECT('notes', ctx.prefix || '-failed'),
      JSONB_BUILD_ARRAY(line50, line144 || JSONB_BUILD_OBJECT('notes', 'force-pack-save-failure')), v_sr_id);
    RAISE EXCEPTION 'Expected update rollback failure';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'forced mixed pack save rollback' THEN RAISE; END IF;
  END;
  IF (SELECT JSONB_AGG(TO_JSONB(sri) ORDER BY sri.id) FROM public.stock_requisition_items sri
      WHERE sri.sr_id = v_sr_id) IS DISTINCT FROM before_lines
    OR (SELECT sr.notes FROM public.stock_requisitions sr WHERE sr.id = v_sr_id) <> ctx.prefix THEN
    RAISE EXCEPTION 'Failed update kept partial header or line writes';
  END IF;
  SELECT COUNT(*) INTO before_count FROM public.stock_requisitions;
  BEGIN
    PERFORM public.save_stock_requisition(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
      header, JSONB_BUILD_ARRAY(line50, line144 || JSONB_BUILD_OBJECT('notes', 'force-pack-save-failure')));
    RAISE EXCEPTION 'Expected create rollback failure';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'forced mixed pack save rollback' THEN RAISE; END IF;
  END;
  IF (SELECT COUNT(*) FROM public.stock_requisitions) <> before_count THEN
    RAISE EXCEPTION 'Failed creation kept a partial header';
  END IF;

  -- Header-only edits preserve omitted dates, notes, lines, costs, and total.
  PERFORM public.save_stock_requisition(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
    '{}'::JSONB, NULL, v_sr_id);
  IF (SELECT JSONB_AGG(TO_JSONB(sri) ORDER BY sri.id) FROM public.stock_requisition_items sri
      WHERE sri.sr_id = v_sr_id) IS DISTINCT FROM before_lines THEN
    RAISE EXCEPTION 'Header-only save changed lines';
  END IF;
  PERFORM public.save_stock_requisition(ctx.company_id, ctx.business_unit_id, ctx.actor_id, header, lines, v_sr_id);
  SELECT sri.id INTO v_sr50_id FROM public.stock_requisition_items sri
  WHERE sri.sr_id = v_sr_id AND sri.item_unit_option_id = ctx.option50_id;
  SELECT sri.id INTO v_sr144_id FROM public.stock_requisition_items sri
  WHERE sri.sr_id = v_sr_id AND sri.item_unit_option_id = ctx.option144_id;
  UPDATE public.stock_requisitions sr SET status = 'submitted' WHERE sr.id = v_sr_id;

  SELECT saved.id INTO v_ll_id FROM public.create_load_list(ctx.company_id, ctx.business_unit_id,
    ctx.business_unit_id, ctx.actor_id, ctx.supplier_id, ctx.prefix, NULL, NULL,
    ctx.prefix, NULL, CURRENT_DATE, CURRENT_DATE, 'PHP', NULL,
    JSONB_BUILD_ARRAY(
      JSONB_BUILD_OBJECT('item_id', ctx.item_id, 'item_unit_option_id', ctx.option50_id,
        'load_list_qty', 50, 'unit_price', 1.08),
      JSONB_BUILD_OBJECT('item_id', ctx.item_id, 'item_unit_option_id', ctx.option144_id,
        'load_list_qty', 100, 'unit_price', 1.08))) saved;
  SELECT lli.id INTO v_ll50_id FROM public.load_list_items lli
  WHERE lli.load_list_id = v_ll_id AND lli.item_unit_option_id = ctx.option50_id;
  SELECT lli.id INTO v_ll144_id FROM public.load_list_items lli
  WHERE lli.load_list_id = v_ll_id AND lli.item_unit_option_id = ctx.option144_id;

  -- The chosen load-list option filters before pagination and its total count.
  SELECT COUNT(*) INTO result_count FROM public.list_eligible_load_list_requisition_items(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, v_ll_id, v_sr_number, 1, 1, v_ll144_id) row
  WHERE row.sr_item_id = v_sr144_id AND row.item_unit_option_id = ctx.option144_id
    AND row.qty_per_unit = 144 AND row.total_count = 1;
  IF result_count <> 1 THEN RAISE EXCEPTION 'Pack-aware eligibility or pagination failed'; END IF;
  BEGIN
    PERFORM public.list_eligible_load_list_requisition_items(ctx.company_id, ctx.business_unit_id,
      ctx.actor_id, v_ll_id, NULL, 1, 20, GEN_RANDOM_UUID());
    RAISE EXCEPTION 'Foreign line filter accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Load list item not found' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.link_load_list_stock_requisitions(ctx.company_id, ctx.business_unit_id,
      ctx.actor_id, v_ll_id, JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('load_list_item_id', v_ll50_id,
        'sr_item_id', v_sr144_id, 'fulfilled_qty', 1)));
    RAISE EXCEPTION 'Cross-pack allocation accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Load list and stock requisition items must reference the same pack option' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.link_load_list_stock_requisitions(ctx.company_id, ctx.business_unit_id,
      ctx.actor_id, v_ll_id, JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('load_list_item_id', v_ll144_id,
        'sr_item_id', v_sr50_id, 'fulfilled_qty', 1)));
    RAISE EXCEPTION 'Reverse cross-pack allocation accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Load list and stock requisition items must reference the same pack option' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.link_load_list_stock_requisitions(ctx.company_id, ctx.business_unit_id,
      ctx.actor_id, v_ll_id, JSONB_BUILD_ARRAY(
        JSONB_BUILD_OBJECT('load_list_item_id', v_ll50_id, 'sr_item_id', v_sr50_id, 'fulfilled_qty', 1),
        JSONB_BUILD_OBJECT('load_list_item_id', v_ll144_id, 'sr_item_id', v_sr50_id, 'fulfilled_qty', 1)));
    RAISE EXCEPTION 'Mixed valid and invalid packs were accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Load list and stock requisition items must reference the same pack option' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.load_list_sr_items link
    WHERE link.load_list_item_id IN (v_ll50_id, v_ll144_id)) THEN
    RAISE EXCEPTION 'Mixed valid and invalid packs left partial links';
  END IF;

  -- A saved shipment factor cannot be linked after the same option changes size.
  UPDATE public.item_unit_options SET qty_per_unit = 145 WHERE id = ctx.option144_id;
  IF EXISTS (SELECT 1 FROM public.list_eligible_load_list_requisition_items(
    ctx.company_id, ctx.business_unit_id, ctx.actor_id, v_ll_id, v_sr_number, 1, 20, v_ll144_id)) THEN
    RAISE EXCEPTION 'Stale pack snapshot appeared in eligible lines';
  END IF;
  BEGIN
    PERFORM public.link_load_list_stock_requisitions(ctx.company_id, ctx.business_unit_id,
      ctx.actor_id, v_ll_id, JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('load_list_item_id', v_ll144_id,
        'sr_item_id', v_sr144_id, 'fulfilled_qty', 1)));
    RAISE EXCEPTION 'Stale pack snapshot link accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Load list and stock requisition items must reference the same pack option' THEN RAISE; END IF;
  END;
  UPDATE public.item_unit_options SET qty_per_unit = 144 WHERE id = ctx.option144_id;

  -- Both matching lines link in one request with independent capacities.
  allocated := public.link_load_list_stock_requisitions(ctx.company_id, ctx.business_unit_id,
    ctx.actor_id, v_ll_id, JSONB_BUILD_ARRAY(
      JSONB_BUILD_OBJECT('load_list_item_id', v_ll50_id, 'sr_item_id', v_sr50_id, 'fulfilled_qty', 50),
      JSONB_BUILD_OBJECT('load_list_item_id', v_ll144_id, 'sr_item_id', v_sr144_id, 'fulfilled_qty', 100)));
  IF allocated <> 2 THEN RAISE EXCEPTION 'Mixed pack allocation failed'; END IF;

  UPDATE public.load_lists ll SET status = 'confirmed' WHERE ll.id = v_ll_id;
  PERFORM public.mark_load_list_in_transit(ctx.company_id, ctx.business_unit_id, ctx.actor_id, v_ll_id, NULL, NULL);
  PERFORM public.mark_load_list_arrived(ctx.company_id, ctx.business_unit_id, ctx.actor_id, v_ll_id, CURRENT_DATE);
  SELECT grn.id INTO v_grn_id FROM public.grns grn WHERE grn.load_list_id = v_ll_id;
  SELECT COALESCE(SUM(iw.current_stock), 0) INTO original_stock FROM public.item_warehouse iw
  WHERE iw.company_id = ctx.company_id AND iw.item_id = ctx.item_id AND iw.warehouse_id = ctx.warehouse_id;
  PERFORM public.start_grn_receiving(ctx.company_id, ctx.actor_id, v_grn_id);
  UPDATE public.grn_items gi SET received_qty = CASE WHEN gi.qty_per_unit = 50 THEN 20 ELSE 40 END,
    damaged_qty = CASE WHEN gi.qty_per_unit = 50 THEN 2 ELSE 5 END WHERE gi.grn_id = v_grn_id;
  PERFORM public.submit_grn_to_putaway(ctx.company_id, ctx.actor_id, v_grn_id, NULL);

  SELECT task.id, task.quantity INTO v_task50_id, staged50 FROM public.putaway_tasks task
  JOIN public.grn_items gi ON gi.id = task.source_line_id
  WHERE task.source_id = v_grn_id AND gi.item_unit_option_id = ctx.option50_id;
  SELECT task.id, task.quantity INTO v_task144_id, staged144 FROM public.putaway_tasks task
  JOIN public.grn_items gi ON gi.id = task.source_line_id
  WHERE task.source_id = v_grn_id AND gi.item_unit_option_id = ctx.option144_id;
  IF staged50 IS DISTINCT FROM 1000 OR staged144 IS DISTINCT FROM 5760 THEN
    RAISE EXCEPTION 'Partial receipts were not staged as 1000 and 5760 base units';
  END IF;
  PERFORM public.confirm_grn_with_putaway(ctx.company_id, ctx.actor_id, v_grn_id, NULL);
  IF NOT EXISTS (SELECT 1 FROM public.stock_requisition_items sri WHERE sri.id = v_sr50_id
      AND sri.fulfilled_qty = 22 AND sri.outstanding_qty = 28)
    OR NOT EXISTS (SELECT 1 FROM public.stock_requisition_items sri WHERE sri.id = v_sr144_id
      AND sri.fulfilled_qty = 45 AND sri.outstanding_qty = 55)
    OR (SELECT sr.status FROM public.stock_requisitions sr WHERE sr.id = v_sr_id) <> 'partially_fulfilled' THEN
    RAISE EXCEPTION 'Partial pack fulfillment or damage accounting failed';
  END IF;

  IF (SELECT COALESCE(SUM(iw.current_stock), 0) FROM public.item_warehouse iw
    WHERE iw.company_id = ctx.company_id AND iw.item_id = ctx.item_id AND iw.warehouse_id = ctx.warehouse_id)
    <> original_stock THEN RAISE EXCEPTION 'GRN staging changed warehouse stock before putaway'; END IF;
  PERFORM public.post_putaway_task(v_task50_id, ctx.location_id, 500, ctx.prefix, ctx.actor_id);
  PERFORM public.post_putaway_task(v_task144_id, ctx.location_id, 2880, ctx.prefix, ctx.actor_id);
  IF (SELECT SUM(task.pending_quantity) FROM public.putaway_tasks task
      WHERE task.id IN (v_task50_id, v_task144_id)) <> 3380
    OR (SELECT SUM(iw.current_stock) FROM public.item_warehouse iw WHERE iw.company_id = ctx.company_id
      AND iw.item_id = ctx.item_id AND iw.warehouse_id = ctx.warehouse_id) <> original_stock + 3380 THEN
    RAISE EXCEPTION 'Partial putaway did not post exactly 3380 base units';
  END IF;
  PERFORM public.post_putaway_task(v_task50_id, ctx.location_id, 500, ctx.prefix, ctx.actor_id);
  PERFORM public.post_putaway_task(v_task144_id, ctx.location_id, 2880, ctx.prefix, ctx.actor_id);
  IF (SELECT SUM(iw.current_stock) FROM public.item_warehouse iw WHERE iw.company_id = ctx.company_id
      AND iw.item_id = ctx.item_id AND iw.warehouse_id = ctx.warehouse_id) <> original_stock + 6760
    OR EXISTS (SELECT 1 FROM public.putaway_tasks task WHERE task.id IN (v_task50_id, v_task144_id)
      AND (task.status <> 'completed' OR task.pending_quantity <> 0))
    OR NOT EXISTS (SELECT 1 FROM public.item_batches batch WHERE batch.item_id = ctx.item_id
      AND batch.warehouse_id = ctx.warehouse_id AND batch.batch_code = ctx.prefix AND batch.qty_on_hand = 6760)
    OR NOT EXISTS (SELECT 1 FROM public.item_batch_locations bl JOIN public.item_batches batch ON batch.id = bl.item_batch_id
      WHERE bl.location_id = ctx.location_id AND batch.batch_code = ctx.prefix AND bl.qty_on_hand = 6760) THEN
    RAISE EXCEPTION 'Completed putaway lost or double-counted mixed pack stock';
  END IF;
  RAISE NOTICE 'Passed mixed BOX(50)/BOX(144) save, duplicate rejection, rollback, pack links, partial receiving, damage, and partial/full putaway';
END $$;
RESET ROLE;

-- The master option retains four decimals while the shipment snapshot stores two.
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  ctx RECORD; v_sr_id UUID; v_sr_number TEXT; v_sr_item_id UUID;
  v_ll_id UUID; v_ll_item_id UUID; v_other_uom_id UUID;
BEGIN
  SELECT actor_id, company_id, business_unit_id, supplier_id, item_id, uom_id,
    option50_id, prefix INTO STRICT ctx FROM pack_test_context;
  UPDATE public.item_unit_options SET qty_per_unit = 1.2345 WHERE id = ctx.option50_id;
  SELECT saved.id, saved.sr_number INTO v_sr_id, v_sr_number
  FROM public.save_stock_requisition(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
    JSONB_BUILD_OBJECT('supplier_id', ctx.supplier_id, 'currency', 'PHP'),
    JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('item_id', ctx.item_id,
      'item_unit_option_id', ctx.option50_id, 'uom_id', ctx.uom_id,
      'requested_qty', 5, 'unit_price', 1.08))) saved;
  SELECT sri.id INTO v_sr_item_id FROM public.stock_requisition_items sri WHERE sri.sr_id = v_sr_id;
  UPDATE public.stock_requisitions sr SET status = 'submitted' WHERE sr.id = v_sr_id;
  SELECT saved.id INTO v_ll_id FROM public.create_load_list(ctx.company_id, ctx.business_unit_id,
    ctx.business_unit_id, ctx.actor_id, ctx.supplier_id, ctx.prefix || '-fractional', NULL,
    NULL, ctx.prefix || '-fractional', NULL, CURRENT_DATE, CURRENT_DATE, 'PHP', NULL,
    JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('item_id', ctx.item_id,
      'item_unit_option_id', ctx.option50_id, 'load_list_qty', 5, 'unit_price', 1.08))) saved;
  SELECT lli.id INTO v_ll_item_id FROM public.load_list_items lli
  WHERE lli.load_list_id = v_ll_id AND lli.item_unit_option_id = ctx.option50_id AND lli.qty_per_unit = 1.23;
  IF v_ll_item_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.list_eligible_load_list_requisition_items(ctx.company_id,
      ctx.business_unit_id, ctx.actor_id, v_ll_id, v_sr_number, 1, 20, v_ll_item_id) eligible
    WHERE eligible.sr_item_id = v_sr_item_id
  ) THEN RAISE EXCEPTION 'Rounded shipment snapshot incorrectly hid an unchanged fractional pack'; END IF;

  -- A changed master UOM is incompatible even when pack identity and factor match.
  SELECT unit.id INTO STRICT v_other_uom_id FROM public.units_of_measure unit
  WHERE unit.company_id = ctx.company_id AND unit.deleted_at IS NULL AND unit.id <> ctx.uom_id
  ORDER BY unit.id LIMIT 1;
  UPDATE public.item_unit_options SET uom_id = v_other_uom_id WHERE id = ctx.option50_id;
  IF EXISTS (SELECT 1 FROM public.list_eligible_load_list_requisition_items(ctx.company_id,
    ctx.business_unit_id, ctx.actor_id, v_ll_id, v_sr_number, 1, 20, v_ll_item_id)) THEN
    RAISE EXCEPTION 'Changed master UOM appeared in eligible lines';
  END IF;
  BEGIN
    PERFORM public.link_load_list_stock_requisitions(ctx.company_id, ctx.business_unit_id,
      ctx.actor_id, v_ll_id, JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('load_list_item_id', v_ll_item_id,
        'sr_item_id', v_sr_item_id, 'fulfilled_qty', 5)));
    RAISE EXCEPTION 'Changed master UOM was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Load list and stock requisition items must reference the same pack option' THEN RAISE; END IF;
  END;
  UPDATE public.item_unit_options SET uom_id = ctx.uom_id WHERE id = ctx.option50_id;
  IF public.link_load_list_stock_requisitions(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
    v_ll_id, JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('load_list_item_id', v_ll_item_id,
      'sr_item_id', v_sr_item_id, 'fulfilled_qty', 5))) <> 1 THEN
    RAISE EXCEPTION 'Unchanged fractional pack failed exact-pack linking';
  END IF;
  UPDATE public.item_unit_options SET qty_per_unit = 50 WHERE id = ctx.option50_id;
  RAISE NOTICE 'Passed fractional master1.2345 to shipment1.23 linking and changed-master-UOM rejection';
END $$;
RESET ROLE;

-- Existing four-decimal costs and fractional reorder inputs survive hidden-cost editing.
CREATE TEMP TABLE hidden_pack_test (sr_id UUID) ON COMMIT DROP;
GRANT SELECT, INSERT ON hidden_pack_test TO authenticated;
SET LOCAL ROLE authenticated;
INSERT INTO hidden_pack_test
SELECT saved.id FROM pack_test_context ctx
CROSS JOIN LATERAL public.save_stock_requisition(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
  JSONB_BUILD_OBJECT('supplier_id', ctx.supplier_id, 'currency', 'PHP'),
  JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('item_id', ctx.item_id, 'item_unit_option_id', ctx.option50_id,
    'uom_id', ctx.uom_id, 'requested_qty', 0.123456, 'unit_price', 1.2345))) saved;
RESET ROLE;
UPDATE public.items item SET import_cost = 3.4567, import_currency = 'PHP'
FROM pack_test_context ctx WHERE item.id = ctx.item_id;
UPDATE public.role_permissions rp SET can_view = FALSE
FROM public.permissions permission, public.user_roles user_role, pack_test_context ctx
WHERE rp.permission_id = permission.id AND permission.resource = 'stock_requisitions.field.unit_cost.view'
  AND user_role.role_id = rp.role_id AND user_role.user_id = ctx.actor_id AND user_role.deleted_at IS NULL;
SET LOCAL ROLE authenticated;
DO $$
DECLARE ctx RECORD; v_sr_id UUID; line50 JSONB; line144 JSONB;
BEGIN
  SELECT actor_id, company_id, business_unit_id, item_id, uom_id, option50_id, option144_id,
    supplier_id INTO STRICT ctx FROM pack_test_context;
  SELECT sr_id INTO STRICT v_sr_id FROM hidden_pack_test;
  IF NOT EXISTS (SELECT 1 FROM public.stock_requisition_items sri WHERE sri.sr_id = v_sr_id
    AND sri.requested_qty = 0.1235 AND sri.unit_price = 1.2345) THEN
    RAISE EXCEPTION 'Existing quantity or cost precision was lost';
  END IF;
  line50 := JSONB_BUILD_OBJECT('item_id', ctx.item_id, 'item_unit_option_id', ctx.option50_id,
    'uom_id', ctx.uom_id, 'requested_qty', 2, 'notes', REPEAT('x', 3000));
  line144 := JSONB_BUILD_OBJECT('item_id', ctx.item_id, 'item_unit_option_id', ctx.option144_id,
    'uom_id', ctx.uom_id, 'requested_qty', 3);
  PERFORM public.save_stock_requisition(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
    '{}'::JSONB, JSONB_BUILD_ARRAY(line50, line144), v_sr_id);
  IF NOT EXISTS (SELECT 1 FROM public.stock_requisition_items sri WHERE sri.sr_id = v_sr_id
      AND sri.item_unit_option_id = ctx.option50_id AND sri.unit_price = 1.2345)
    OR NOT EXISTS (SELECT 1 FROM public.stock_requisition_items sri WHERE sri.sr_id = v_sr_id
      AND sri.item_unit_option_id = ctx.option144_id AND sri.unit_price = 3.4567)
    OR NOT EXISTS (SELECT 1 FROM public.stock_requisitions sr WHERE sr.id = v_sr_id
      AND sr.total_amount = 2 * 50 * 1.2345 + 3 * 144 * 3.4567 AND sr.currency = 'PHP') THEN
    RAISE EXCEPTION 'Hidden pack cost preservation or new-pack default price failed';
  END IF;
  BEGIN
    PERFORM public.save_stock_requisition(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
      '{}'::JSONB, JSONB_BUILD_ARRAY(line50 || JSONB_BUILD_OBJECT('unit_price', 0)), v_sr_id);
    RAISE EXCEPTION 'Hidden unit cost submission accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Unauthorized' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.save_stock_requisition(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
      JSONB_BUILD_OBJECT('currency', 'USD'), JSONB_BUILD_ARRAY(line50), v_sr_id);
    RAISE EXCEPTION 'Hidden currency submission accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Unauthorized' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.save_stock_requisition(ctx.company_id, GEN_RANDOM_UUID(), ctx.actor_id,
      '{}'::JSONB, JSONB_BUILD_ARRAY(line50), v_sr_id);
    RAISE EXCEPTION 'Wrong business-unit save accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Unauthorized' THEN RAISE; END IF; END;
  RAISE NOTICE 'Passed hidden-cost preservation, new-pack defaults, restricted cost/currency rejection, stored precision, and BU scope';
END $$;
RESET ROLE;
ROLLBACK;
