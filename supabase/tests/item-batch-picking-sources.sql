-- Seeded local Supabase only. All fixtures and stock changes roll back.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE qr_pick_test_context (
  company_id uuid, business_unit_id uuid, actor_id uuid, item_id uuid, warehouse_id uuid,
  batch_id uuid, pick_list_id uuid, line_id uuid, location_id uuid
) ON COMMIT DROP;
DO $$
DECLARE
  c record;
  v_batch uuid;
  v_requesting_bu uuid;
  v_sr uuid;
  v_sr_item uuid;
  v_dn uuid;
  v_dn_item uuid;
  v_list uuid;
  v_line uuid;
  v_unit_option uuid;
  v_location uuid;
  v_first_location uuid;
  v_sku text;
  v_received timestamptz := now();
BEGIN
  SELECT stock.company_id, stock.item_id, stock.warehouse_id, warehouse.business_unit_id,
    actor.id AS actor_id, item.uom_id
  INTO STRICT c
  FROM public.item_batch_locations stock
  JOIN public.warehouses warehouse ON warehouse.id = stock.warehouse_id
  JOIN public.items item ON item.id = stock.item_id
  JOIN public.users actor ON actor.company_id = stock.company_id
  WHERE stock.deleted_at IS NULL AND warehouse.is_active AND warehouse.deleted_at IS NULL
    AND public.user_has_permission(actor.id, 'pick_lists', 'edit', warehouse.business_unit_id)
  ORDER BY stock.id, actor.id LIMIT 1;

  SELECT id INTO STRICT v_requesting_bu FROM public.business_units
  WHERE company_id=c.company_id AND id<>c.business_unit_id AND is_active LIMIT 1;

  INSERT INTO public.item_unit_options (company_id, item_id, uom_id, qty_per_unit)
  VALUES(c.company_id,c.item_id,c.uom_id,3)
  ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL
  DO UPDATE SET is_active = TRUE
  RETURNING id INTO v_unit_option;
  INSERT INTO public.item_batches(company_id, item_id, warehouse_id, batch_code, received_at, qty_on_hand)
  VALUES(c.company_id,c.item_id,c.warehouse_id,'QR-INDEPENDENCE-TEST',v_received,210) RETURNING id INTO v_batch;
  FOR n IN 1..7 LOOP
    INSERT INTO public.warehouse_locations(company_id,warehouse_id,code,name,is_active,is_pickable,is_storable)
    VALUES(c.company_id,c.warehouse_id,'QR-TEST-'||n,'QR test '||n,true,true,true)
    RETURNING id INTO v_location;
    INSERT INTO public.item_batch_locations(company_id,item_id,warehouse_id,location_id,item_batch_id,qty_on_hand)
    VALUES(c.company_id,c.item_id,c.warehouse_id,v_location,v_batch,30);
    IF n=1 THEN v_first_location := v_location; END IF;
  END LOOP;
  SELECT batch_location_sku INTO v_sku FROM public.item_batch_locations
  WHERE item_batch_id=v_batch AND location_id=v_first_location;
  INSERT INTO public.stock_requests(company_id,business_unit_id,fulfilling_business_unit_id,
    required_date,requested_by_user_id)
  VALUES(c.company_id,v_requesting_bu,c.business_unit_id,current_date,c.actor_id) RETURNING id INTO v_sr;
  INSERT INTO public.stock_request_items(stock_request_id,item_id,requested_qty,uom_id)
  VALUES(v_sr,c.item_id,5,c.uom_id) RETURNING id INTO v_sr_item;
  INSERT INTO public.delivery_notes(company_id,business_unit_id,fulfilling_warehouse_id,
    requesting_business_unit_id,fulfilling_business_unit_id,created_by)
  VALUES(c.company_id,c.business_unit_id,c.warehouse_id,v_requesting_bu,c.business_unit_id,c.actor_id) RETURNING id INTO v_dn;
  INSERT INTO public.delivery_note_items(company_id,dn_id,sr_id,sr_item_id,item_id,uom_id,item_unit_option_id,
    fulfilling_warehouse_id,allocated_qty,short_qty)
  VALUES(c.company_id,v_dn,v_sr,v_sr_item,c.item_id,c.uom_id,v_unit_option,c.warehouse_id,5,5)
    RETURNING id INTO v_dn_item;
  INSERT INTO public.pick_lists(company_id,business_unit_id,dn_id,status,created_by)
  VALUES(c.company_id,c.business_unit_id,v_dn,'in_progress',c.actor_id) RETURNING id INTO v_list;
  INSERT INTO public.pick_list_items(company_id,pick_list_id,dn_item_id,sr_id,sr_item_id,item_id,uom_id,item_unit_option_id,
    allocated_qty,short_qty,suggested_pick_location_id,suggested_pick_batch_code,
    suggested_pick_batch_received_at,suggested_batch_location_sku)
  VALUES(c.company_id,v_list,v_dn_item,v_sr,v_sr_item,c.item_id,c.uom_id,v_unit_option,5,5,
    v_first_location,'QR-INDEPENDENCE-TEST',v_received,v_sku) RETURNING id INTO v_line;
  INSERT INTO public.pick_list_assignees(company_id,pick_list_id,user_id) VALUES(c.company_id,v_list,c.actor_id);
  INSERT INTO qr_pick_test_context VALUES(c.company_id,c.business_unit_id,c.actor_id,c.item_id,
    c.warehouse_id,v_batch,v_list,v_line,v_first_location);
  DELETE FROM public.settings WHERE company_id=c.company_id AND business_unit_id=c.business_unit_id
    AND group_key='inventory' AND setting_key='picking_validation_policy';
  INSERT INTO public.settings(company_id,business_unit_id,group_key,setting_key,value)
  VALUES(c.company_id,c.business_unit_id,'inventory','picking_validation_policy','"batch_only"');
END $$;
GRANT SELECT ON qr_pick_test_context TO authenticated;
SELECT set_config('request.jwt.claim.sub',actor_id::text,true),
  set_config('request.jwt.claims',jsonb_build_object('sub',actor_id,'role','authenticated',
    'current_business_unit_id',business_unit_id)::text,true)
FROM qr_pick_test_context;
SET LOCAL ROLE authenticated;
DO $$
DECLARE c record; v_count integer; v_source record;
BEGIN
  SELECT company_id,business_unit_id,actor_id,item_id,warehouse_id,batch_id,pick_list_id,line_id,location_id
  INTO c FROM qr_pick_test_context;
  SELECT count(*) INTO v_count FROM public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST');
  IF v_count <> 4 THEN RAISE EXCEPTION 'Expected three choices plus lookahead, got %',v_count; END IF;
  SELECT is_suggested, remaining_base_qty, available_base_qty, max_pick_qty INTO v_source
  FROM public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST') LIMIT 1;
  IF v_source.is_suggested IS NOT TRUE THEN RAISE EXCEPTION 'Suggested pick-list location must sort first'; END IF;
  IF v_source.remaining_base_qty IS DISTINCT FROM 15 OR v_source.available_base_qty IS DISTINCT FROM 15
     OR v_source.max_pick_qty IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'Suggested source should have five pick units from its own reservation, got %', v_source;
  END IF;
  SELECT count(*) INTO v_count FROM public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',NULL,2);
  IF v_count <> 4 THEN RAISE EXCEPTION 'Second page should have three choices plus lookahead'; END IF;
  SELECT count(*) INTO v_count FROM public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',NULL,3);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Third page should have one remaining location'; END IF;
  SELECT count(*) INTO v_count FROM public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',c.location_id);
  IF v_count <> 1 THEN RAISE EXCEPTION 'Explicit source selection must resolve exactly once'; END IF;
  IF EXISTS(SELECT 1 FROM public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'WRONG-BATCH')) THEN RAISE EXCEPTION 'Wrong batch accepted'; END IF;
  IF EXISTS(SELECT 1 FROM public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,gen_random_uuid(),'QR-INDEPENDENCE-TEST')) THEN RAISE EXCEPTION 'Wrong item accepted'; END IF;
END $$;
RESET ROLE;

-- A location with 238 base units can supply only one package of 144 from a five-package line.
SAVEPOINT before_box_capacity;
DO $$
DECLARE c record; v_unit_option uuid;
BEGIN
  SELECT company_id, item_id, batch_id, line_id, location_id INTO c FROM qr_pick_test_context;
  INSERT INTO public.item_unit_options (company_id, item_id, uom_id, qty_per_unit)
  SELECT c.company_id, c.item_id, line.uom_id, 144 FROM public.pick_list_items line WHERE line.id = c.line_id
  ON CONFLICT (company_id, item_id, uom_id, qty_per_unit) WHERE deleted_at IS NULL
  DO UPDATE SET is_active = TRUE
  RETURNING id INTO v_unit_option;
  UPDATE public.pick_list_items SET item_unit_option_id = v_unit_option WHERE id = c.line_id;
  UPDATE public.inventory_reservation_allocations SET quantity_base = 720 WHERE pick_list_item_id = c.line_id;
  UPDATE public.item_batch_locations SET qty_on_hand = 720, qty_reserved = 720
  WHERE item_batch_id = c.batch_id AND location_id = c.location_id;
  UPDATE public.item_batch_locations stock SET qty_on_hand = 238
  FROM public.warehouse_locations location
  WHERE stock.item_batch_id = c.batch_id AND stock.location_id = location.id AND location.code = 'QR-TEST-2';
  UPDATE public.item_batches SET qty_on_hand = 1108, qty_reserved = 720 WHERE id = c.batch_id;
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE c record; v_source record; v_codes text[];
BEGIN
  SELECT company_id, pick_list_id, item_id, warehouse_id INTO c FROM qr_pick_test_context;
  SELECT source.remaining_base_qty, source.available_base_qty, source.max_pick_qty INTO STRICT v_source
  FROM public.warehouse_locations location
  CROSS JOIN LATERAL public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',location.id) source
  WHERE location.warehouse_id = c.warehouse_id AND location.code = 'QR-TEST-2';
  IF v_source.remaining_base_qty IS DISTINCT FROM 720 OR v_source.available_base_qty IS DISTINCT FROM 238
     OR v_source.max_pick_qty IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Expected one package of 144 from 238 base units against a five-package line, got %', v_source;
  END IF;
  SELECT array_agg(location_code ORDER BY location_code) INTO v_codes
  FROM public.get_pick_item_batch_sources(c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST');
  IF v_codes IS DISTINCT FROM ARRAY['QR-TEST-1','QR-TEST-2'] THEN
    RAISE EXCEPTION 'Only sources with a whole package should appear in the page, got %', v_codes;
  END IF;
END $$;
RESET ROLE;
ROLLBACK TO SAVEPOINT before_box_capacity;
RELEASE SAVEPOINT before_box_capacity;

-- A base-unit line can still confirm a fractional remainder at a bin holding a full base unit.
SAVEPOINT before_base_unit_remainder;
UPDATE public.pick_list_items SET item_unit_option_id = NULL WHERE id = (SELECT line_id FROM qr_pick_test_context);
UPDATE public.inventory_reservation_allocations SET quantity_base = 5
WHERE pick_list_item_id = (SELECT line_id FROM qr_pick_test_context);
SET LOCAL ROLE authenticated;
DO $$
DECLARE c record; v_sku text; v_source record;
BEGIN
  SELECT company_id, actor_id, pick_list_id, line_id, item_id, location_id INTO c FROM qr_pick_test_context;
  SELECT batch_location_sku INTO STRICT v_sku
  FROM public.get_pick_item_batch_sources(c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',c.location_id);
  PERFORM public.claim_pick_list_item(c.company_id,c.actor_id,c.pick_list_id,c.line_id);
  PERFORM public.record_pick_list_item_progress(c.company_id,c.actor_id,c.pick_list_id,
    c.line_id,gen_random_uuid(),4.99,v_sku);
  SELECT remaining_base_qty, available_base_qty, max_pick_qty INTO STRICT v_source
  FROM public.get_pick_item_batch_sources(c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',c.location_id);
  IF v_source.remaining_base_qty IS DISTINCT FROM 0.01 OR v_source.available_base_qty IS DISTINCT FROM 0.01
     OR v_source.max_pick_qty IS DISTINCT FROM 0.01 THEN
    RAISE EXCEPTION 'Expected 0.01 base units to remain pickable, got %', v_source;
  END IF;
  PERFORM public.claim_pick_list_item(c.company_id,c.actor_id,c.pick_list_id,c.line_id);
  PERFORM public.record_pick_list_item_progress(c.company_id,c.actor_id,c.pick_list_id,
    c.line_id,gen_random_uuid(),v_source.max_pick_qty,v_sku);
  IF EXISTS (SELECT 1 FROM public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST')) THEN
    RAISE EXCEPTION 'A fully picked line is still eligible';
  END IF;
END $$;
RESET ROLE;
ROLLBACK TO SAVEPOINT before_base_unit_remainder;
RELEASE SAVEPOINT before_base_unit_remainder;

-- Confirm an alternative resolved source using the existing transactional writer.
CREATE FUNCTION pg_temp.fail_qr_pick_claim_release() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.fail_qr_pick',true)='on' AND NEW.released_at IS NOT NULL THEN
    RAISE EXCEPTION 'TEST_QR_PICK_ROLLBACK';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER test_qr_pick_failure BEFORE UPDATE ON public.pick_list_item_claims
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_qr_pick_claim_release();
SET LOCAL ROLE authenticated;
DO $$
DECLARE c record; v_sku text; v_operation uuid := gen_random_uuid();
BEGIN
  SELECT company_id,actor_id,item_id,pick_list_id,line_id INTO c FROM qr_pick_test_context;
  SELECT batch_location_sku INTO STRICT v_sku FROM public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST') WHERE NOT is_suggested LIMIT 1;
  PERFORM public.claim_pick_list_item(c.company_id,c.actor_id,c.pick_list_id,c.line_id);
  PERFORM set_config('test.fail_qr_pick','on',true);
  BEGIN
    PERFORM public.record_pick_list_item_progress(c.company_id,c.actor_id,c.pick_list_id,
      c.line_id,v_operation,1,v_sku,NULL,NULL,NULL,true,'ALTERNATIVE_BATCH_LOCATION_SKU');
    RAISE EXCEPTION 'Expected forced rollback';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'TEST_QR_PICK_ROLLBACK' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM public.delivery_note_item_picks WHERE pick_list_item_id=c.line_id)
    OR EXISTS(SELECT 1 FROM public.pick_list_item_pick_operations WHERE operation_id=v_operation)
    OR EXISTS(SELECT 1 FROM public.pick_list_items WHERE id=c.line_id AND picked_qty<>0) THEN
    RAISE EXCEPTION 'Forced failure left partial pick writes';
  END IF;
  PERFORM set_config('test.fail_qr_pick','off',true);
  PERFORM public.record_pick_list_item_progress(c.company_id,c.actor_id,c.pick_list_id,
    c.line_id,v_operation,1,v_sku,NULL,NULL,NULL,true,'ALTERNATIVE_BATCH_LOCATION_SKU');
  IF NOT EXISTS(SELECT 1 FROM public.delivery_note_item_picks
      WHERE pick_list_item_id=c.line_id AND batch_location_sku=v_sku AND picked_qty=1)
    OR NOT EXISTS(SELECT 1 FROM public.pick_list_items WHERE id=c.line_id AND picked_qty=1) THEN
    RAISE EXCEPTION 'Confirmation did not persist the chosen source';
  END IF;
END $$;
RESET ROLE;
-- Simulate a move of free stock while keeping the existing planned reservation intact.
UPDATE public.item_batch_locations stock SET qty_on_hand = stock.qty_reserved
FROM public.warehouse_locations location
WHERE stock.item_batch_id = (SELECT batch_id FROM qr_pick_test_context)
  AND location.id = stock.location_id AND location.code <> 'QR-TEST-7';
SET LOCAL ROLE authenticated;
DO $$
DECLARE c record; v_codes text[];
BEGIN
  SELECT company_id,item_id,pick_list_id,warehouse_id INTO c FROM qr_pick_test_context;
  SELECT array_agg(location_code ORDER BY location_code) INTO v_codes FROM public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST');
  IF v_codes IS DISTINCT FROM ARRAY['QR-TEST-1','QR-TEST-7'] THEN
    RAISE EXCEPTION 'Moved batch did not resolve to the planned rack and the current free-stock location';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.warehouse_locations location
    CROSS JOIN LATERAL public.get_pick_item_batch_sources(
      c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',location.id)
    WHERE location.warehouse_id = c.warehouse_id AND location.code = 'QR-TEST-6'
  ) THEN
    RAISE EXCEPTION 'Stale source selection was accepted'; END IF;
END $$;
RESET ROLE;
UPDATE public.settings SET value='"batch_and_rack"' WHERE company_id=(SELECT company_id FROM qr_pick_test_context)
  AND business_unit_id=(SELECT business_unit_id FROM qr_pick_test_context)
  AND group_key='inventory' AND setting_key='picking_validation_policy';
SET LOCAL ROLE authenticated;
DO $$
DECLARE c record; v_codes text[];
BEGIN
  SELECT company_id,item_id,pick_list_id INTO c FROM qr_pick_test_context;
  SELECT array_agg(location_code) INTO v_codes FROM public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST');
  IF v_codes IS DISTINCT FROM ARRAY['QR-TEST-1'] THEN
    RAISE EXCEPTION 'Assigned rack restriction was bypassed'; END IF;
END $$;
RESET ROLE;
-- Verify reservation-aware eligibility and pagination after one of five pick units has been picked.
UPDATE public.settings SET value='"batch_only"' WHERE company_id=(SELECT company_id FROM qr_pick_test_context)
  AND business_unit_id=(SELECT business_unit_id FROM qr_pick_test_context)
  AND group_key='inventory' AND setting_key='picking_validation_policy';
UPDATE public.item_batch_locations stock
SET qty_on_hand = CASE location.code
  WHEN 'QR-TEST-1' THEN 30
  WHEN 'QR-TEST-2' THEN stock.qty_reserved + 3
  WHEN 'QR-TEST-3' THEN 9
  WHEN 'QR-TEST-4' THEN 10
  WHEN 'QR-TEST-5' THEN 10
  ELSE 3
END,
qty_reserved = CASE location.code
  WHEN 'QR-TEST-1' THEN stock.qty_reserved + 3
  WHEN 'QR-TEST-3' THEN 9
  WHEN 'QR-TEST-4' THEN 4.0001
  WHEN 'QR-TEST-5' THEN 7.0001
  ELSE stock.qty_reserved
END
FROM public.warehouse_locations location
WHERE location.id = stock.location_id
  AND stock.item_batch_id = (SELECT batch_id FROM qr_pick_test_context);
UPDATE public.item_batches batch SET qty_on_hand = totals.on_hand, qty_reserved = totals.reserved
FROM (
  SELECT stock.item_batch_id, SUM(stock.qty_on_hand) AS on_hand, SUM(stock.qty_reserved) AS reserved
  FROM public.item_batch_locations stock JOIN qr_pick_test_context ctx ON ctx.batch_id = stock.item_batch_id
  GROUP BY stock.item_batch_id
) totals
WHERE batch.id = totals.item_batch_id;
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  c record;
  v_codes text[];
  v_remaining_base_qty numeric;
  v_source record;
BEGIN
  SELECT company_id,pick_list_id,item_id,warehouse_id INTO c FROM qr_pick_test_context;
  SELECT array_agg(location_code ORDER BY location_code), min(remaining_base_qty)
  INTO v_codes, v_remaining_base_qty
  FROM public.get_pick_item_batch_sources(c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST');
  IF v_codes IS DISTINCT FROM ARRAY['QR-TEST-1','QR-TEST-2','QR-TEST-4','QR-TEST-6'] THEN
    RAISE EXCEPTION 'Expected three eligible choices plus one lookahead, got %', v_codes;
  END IF;
  IF v_remaining_base_qty IS DISTINCT FROM 12 THEN
    RAISE EXCEPTION 'Expected four pick units left, got % base units', v_remaining_base_qty;
  END IF;
  SELECT array_agg(location_code ORDER BY location_code) INTO v_codes
  FROM public.get_pick_item_batch_sources(c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',NULL,2);
  IF v_codes IS DISTINCT FROM ARRAY['QR-TEST-6','QR-TEST-7'] THEN
    RAISE EXCEPTION 'Expected the two remaining eligible bins on page two, got %', v_codes;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.warehouse_locations location
    CROSS JOIN LATERAL public.get_pick_item_batch_sources(
      c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',location.id)
    WHERE location.warehouse_id = c.warehouse_id AND location.code IN ('QR-TEST-3','QR-TEST-5')
  ) THEN
    RAISE EXCEPTION 'Explicit selection accepted a fully reserved location or one with less than one free unit';
  END IF;
  SELECT source.qty_on_hand, source.available_base_qty, source.max_pick_qty INTO STRICT v_source
  FROM public.warehouse_locations location
  CROSS JOIN LATERAL public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',location.id) source
  WHERE location.warehouse_id = c.warehouse_id AND location.code = 'QR-TEST-4';
  IF v_source.qty_on_hand IS DISTINCT FROM 10 OR v_source.available_base_qty IS DISTINCT FROM 5.9999
     OR v_source.max_pick_qty IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Expected 5.9999 free base units and a cap of one whole package, got %', v_source;
  END IF;
END $$;
RESET ROLE;

-- Existing lines without a ledger allocation can still confirm their original reserved source.
SAVEPOINT before_no_allocation;
DELETE FROM public.inventory_reservation_allocations allocation
USING qr_pick_test_context ctx, public.item_batch_locations stock
WHERE allocation.pick_list_item_id = ctx.line_id
  AND allocation.item_batch_location_id = stock.id AND stock.location_id = ctx.location_id;
SET LOCAL ROLE authenticated;
DO $$
DECLARE c record; v_codes text[]; v_sku text;
BEGIN
  SELECT company_id, actor_id, pick_list_id, line_id, item_id, location_id INTO c FROM qr_pick_test_context;
  SELECT array_agg(location_code) INTO v_codes FROM public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST');
  IF v_codes IS DISTINCT FROM ARRAY['QR-TEST-1'] THEN
    RAISE EXCEPTION 'A line without an allocation must resolve only its suggested source, got %', v_codes;
  END IF;
  SELECT batch_location_sku INTO STRICT v_sku FROM public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',c.location_id);
  PERFORM public.claim_pick_list_item(c.company_id,c.actor_id,c.pick_list_id,c.line_id);
  PERFORM public.record_pick_list_item_progress(c.company_id,c.actor_id,c.pick_list_id,
    c.line_id,gen_random_uuid(),1,v_sku);
  IF NOT EXISTS(SELECT 1 FROM public.pick_list_items WHERE id=c.line_id AND picked_qty=2) THEN
    RAISE EXCEPTION 'The original reserved source could not be confirmed without a ledger allocation';
  END IF;
END $$;
RESET ROLE;
ROLLBACK TO SAVEPOINT before_no_allocation;
RELEASE SAVEPOINT before_no_allocation;

-- The same batch identity can resolve across warehouses only within both warehouse and batch limits.
ALTER TABLE qr_pick_test_context ADD COLUMN target_warehouse_id uuid,
  ADD COLUMN target_batch_id uuid, ADD COLUMN target_location_id uuid;
DO $$
DECLARE
  c record;
  v_target_warehouse uuid;
  v_target_batch uuid;
  v_target_location uuid;
BEGIN
  SELECT company_id, business_unit_id, actor_id, item_id, warehouse_id, batch_id
  INTO c FROM qr_pick_test_context;
  INSERT INTO public.warehouses (
    company_id, business_unit_id, warehouse_code, warehouse_name, created_by, updated_by
  )
  VALUES (c.company_id, c.business_unit_id, 'QR-TEST-ALT', 'QR test alternative', c.actor_id, c.actor_id)
  RETURNING id INTO v_target_warehouse;
  INSERT INTO public.warehouse_locations (company_id, warehouse_id, code, name, is_pickable, is_storable)
  VALUES (c.company_id, v_target_warehouse, 'QR-TEST-ALT', 'QR test alternative', TRUE, TRUE)
  RETURNING id INTO v_target_location;
  INSERT INTO public.item_batches (
    company_id, item_id, warehouse_id, batch_code, received_at, qty_on_hand, qty_reserved
  )
  SELECT c.company_id, c.item_id, v_target_warehouse, batch.batch_code, batch.received_at, 30, 25.7499
  FROM public.item_batches batch WHERE batch.id = c.batch_id
  RETURNING id INTO v_target_batch;
  INSERT INTO public.item_batch_locations (
    company_id, item_id, warehouse_id, location_id, item_batch_id, qty_on_hand, qty_reserved
  )
  VALUES (c.company_id, c.item_id, v_target_warehouse, v_target_location, v_target_batch, 20, 5);
  INSERT INTO public.item_warehouse (
    company_id, item_id, warehouse_id, current_stock, reserved_stock, created_by, updated_by
  )
  VALUES (c.company_id, c.item_id, v_target_warehouse, 30, 25.5, c.actor_id, c.actor_id),
    (c.company_id, c.item_id, c.warehouse_id, 30, 2.9999, c.actor_id, c.actor_id)
  ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE
  SET current_stock = GREATEST(public.item_warehouse.current_stock, EXCLUDED.current_stock),
    reserved_stock = EXCLUDED.reserved_stock;
  UPDATE qr_pick_test_context SET target_warehouse_id = v_target_warehouse, target_batch_id = v_target_batch,
    target_location_id = v_target_location;
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE c record;
BEGIN
  SELECT company_id, pick_list_id, item_id, target_location_id INTO c FROM qr_pick_test_context;
  IF EXISTS (SELECT 1 FROM public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',c.target_location_id)) THEN
    RAISE EXCEPTION 'Cross-warehouse source exceeded the planned warehouse reservation';
  END IF;
END $$;
RESET ROLE;
UPDATE public.item_warehouse stock SET reserved_stock = 12 FROM qr_pick_test_context ctx
WHERE stock.company_id = ctx.company_id AND stock.item_id = ctx.item_id AND stock.warehouse_id = ctx.warehouse_id;
SET LOCAL ROLE authenticated;
DO $$
DECLARE c record; v_available numeric;
BEGIN
  SELECT company_id, pick_list_id, item_id, target_location_id INTO c FROM qr_pick_test_context;
  SELECT available_base_qty INTO STRICT v_available FROM public.get_pick_item_batch_sources(
    c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',c.target_location_id);
  IF v_available IS DISTINCT FROM 4.2501 THEN
    RAISE EXCEPTION 'Expected the target batch to cap free stock at 4.2501, got %', v_available;
  END IF;
END $$;
RESET ROLE;
UPDATE public.item_warehouse stock SET reserved_stock = 26.2499 FROM qr_pick_test_context ctx
WHERE stock.company_id = ctx.company_id AND stock.item_id = ctx.item_id
  AND stock.warehouse_id = ctx.target_warehouse_id;
SET LOCAL ROLE authenticated;
DO $$
DECLARE c record; v_source record; v_planned_sku text;
BEGIN
  SELECT company_id, actor_id, pick_list_id, line_id, item_id, location_id, target_location_id
  INTO c FROM qr_pick_test_context;
  SELECT batch_location_sku, available_base_qty, max_pick_qty INTO STRICT v_source
  FROM public.get_pick_item_batch_sources(c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',
    c.target_location_id);
  IF v_source.available_base_qty IS DISTINCT FROM 3.7501 OR v_source.max_pick_qty IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Expected the target warehouse to cap availability at 3.7501 base units, got %', v_source;
  END IF;
  PERFORM public.claim_pick_list_item(c.company_id,c.actor_id,c.pick_list_id,c.line_id);
  PERFORM public.record_pick_list_item_progress(c.company_id,c.actor_id,c.pick_list_id,
    c.line_id,gen_random_uuid(),v_source.max_pick_qty,v_source.batch_location_sku,
    NULL,NULL,NULL,true,'ALTERNATIVE_BATCH_LOCATION_SKU');

  -- A previously recorded fractional package can leave less than one whole package to pick.
  SELECT batch_location_sku INTO STRICT v_planned_sku
  FROM public.get_pick_item_batch_sources(c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',c.location_id);
  PERFORM public.claim_pick_list_item(c.company_id,c.actor_id,c.pick_list_id,c.line_id);
  PERFORM public.record_pick_list_item_progress(c.company_id,c.actor_id,c.pick_list_id,
    c.line_id,gen_random_uuid(),2.5,v_planned_sku);
  IF EXISTS (SELECT 1
    FROM public.get_pick_item_batch_sources(c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST',
      c.location_id))
    OR EXISTS (SELECT 1
    FROM public.get_pick_item_batch_sources(c.company_id,c.pick_list_id,c.item_id,'QR-INDEPENDENCE-TEST')) THEN
    RAISE EXCEPTION 'A line with only a fractional package remaining still resolved';
  END IF;
END $$;
RESET ROLE;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
