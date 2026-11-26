-- Authenticated arrival/reversal regression. Fixture data and trigger changes roll back.
-- docker exec -i supabase_db_backend psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/grn-arrival-reversal.sql
BEGIN;

CREATE TEMP TABLE arrival_test_context ON COMMIT DROP AS
SELECT actor.id AS actor_id, actor.company_id, shipment.destination_business_unit_id AS business_unit_id,
  shipment.supplier_id, line.item_id, line.item_unit_option_id, line.uom_id, line.unit_name, line.qty_per_unit,
  GEN_RANDOM_UUID() AS load_list_id
FROM public.users actor
JOIN public.load_lists shipment ON shipment.company_id = actor.company_id
  AND shipment.deleted_at IS NULL
JOIN public.load_list_items line ON line.load_list_id = shipment.id
JOIN public.items item ON item.id = line.item_id AND item.deleted_at IS NULL
WHERE actor.is_active AND actor.deleted_at IS NULL
  AND public.user_has_permission(actor.id, 'load_lists', 'view', shipment.destination_business_unit_id)
  AND public.user_has_permission(actor.id, 'load_lists', 'edit', shipment.destination_business_unit_id)
  AND public.user_has_permission(actor.id, 'load_lists.operation.mark_arrived.edit', 'edit', shipment.destination_business_unit_id)
  AND public.user_has_permission(actor.id, 'goods_receipt_notes', 'view', shipment.destination_business_unit_id)
  AND public.user_has_permission(actor.id, 'goods_receipt_notes', 'delete', shipment.destination_business_unit_id)
ORDER BY actor.id, shipment.id, line.id LIMIT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM arrival_test_context) THEN
    RAISE EXCEPTION 'Test requires an authorized actor and a load-list line in its destination business unit';
  END IF;
END $$;
GRANT SELECT ON arrival_test_context TO authenticated;
SELECT SET_CONFIG('request.jwt.claim.sub', actor_id::TEXT, TRUE),
  SET_CONFIG('request.jwt.claims', JSONB_BUILD_OBJECT('sub', actor_id, 'role', 'authenticated',
    'current_business_unit_id', business_unit_id)::TEXT, TRUE)
FROM arrival_test_context;

INSERT INTO public.load_lists (
  id, company_id, business_unit_id, destination_business_unit_id, supplier_id,
  status, estimated_arrival_date, created_by, updated_by
)
SELECT load_list_id, company_id, business_unit_id, business_unit_id, supplier_id,
  'in_transit', CURRENT_DATE, actor_id, actor_id
FROM arrival_test_context;
INSERT INTO public.load_list_items (
  load_list_id, item_id, item_unit_option_id, uom_id, unit_name, qty_per_unit, load_list_qty, unit_price
)
SELECT load_list_id, item_id, item_unit_option_id, uom_id, unit_name, qty_per_unit, 3, 1
FROM arrival_test_context;

-- Fail after arrival status and the GRN header were written.
CREATE FUNCTION pg_temp.force_grn_arrival_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.grns grn
    JOIN public.load_lists shipment ON shipment.id = grn.load_list_id
    WHERE grn.id = NEW.grn_id AND shipment.status = 'arrived') THEN
    RAISE EXCEPTION 'Arrival failure trigger ran before the earlier writes';
  END IF;
  RAISE EXCEPTION 'forced GRN arrival rollback';
END $$;
CREATE TRIGGER arrival_test_failure BEFORE INSERT ON public.grn_items
FOR EACH ROW EXECUTE FUNCTION pg_temp.force_grn_arrival_failure();
SET LOCAL ROLE authenticated;
DO $$
DECLARE ctx RECORD;
BEGIN
  SELECT company_id, business_unit_id, actor_id, load_list_id INTO STRICT ctx FROM arrival_test_context;
  BEGIN
    PERFORM public.mark_load_list_arrived(ctx.company_id, ctx.business_unit_id, ctx.actor_id,
      ctx.load_list_id, CURRENT_DATE);
    RAISE EXCEPTION 'Expected arrival failure did not occur';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'forced GRN arrival rollback' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
DROP TRIGGER arrival_test_failure ON public.grn_items;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.grns WHERE load_list_id = (SELECT load_list_id FROM arrival_test_context))
    OR NOT EXISTS (SELECT 1 FROM public.load_lists
      WHERE id = (SELECT load_list_id FROM arrival_test_context)
        AND status = 'in_transit' AND actual_arrival_date IS NULL) THEN
    RAISE EXCEPTION 'Failed arrival left partial GRN or load-list writes';
  END IF;
END $$;

-- Arrival still creates one draft GRN with the unit snapshot and carton count.
SET LOCAL ROLE authenticated;
SELECT public.mark_load_list_arrived(company_id, business_unit_id, actor_id, load_list_id, CURRENT_DATE)
FROM arrival_test_context;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM public.grns grn JOIN arrival_test_context ctx ON ctx.load_list_id = grn.load_list_id
      WHERE grn.status = 'draft' AND grn.business_unit_id = ctx.business_unit_id AND grn.warehouse_id IS NULL) <> 1
    OR (SELECT COUNT(*) FROM public.grn_items line
      JOIN public.grns grn ON grn.id = line.grn_id
      JOIN arrival_test_context ctx ON ctx.load_list_id = grn.load_list_id
      WHERE line.item_id = ctx.item_id AND line.unit_name = ctx.unit_name
        AND line.qty_per_unit = ctx.qty_per_unit AND line.load_list_qty = 3
        AND line.received_qty = 0 AND line.damaged_qty = 0 AND line.num_boxes = 0) <> 1 THEN
    RAISE EXCEPTION 'Arrival lost the GRN line or its receiving snapshot';
  END IF;
END $$;

-- Reversal still rejects received quantities, damage, and independent carton counts.
SET LOCAL ROLE authenticated;
DO $$
DECLARE ctx RECORD; activity RECORD; v_grn_id UUID;
BEGIN
  SELECT company_id, actor_id, load_list_id INTO STRICT ctx FROM arrival_test_context;
  SELECT id INTO STRICT v_grn_id FROM public.grns WHERE load_list_id = ctx.load_list_id;
  FOR activity IN SELECT received_qty, damaged_qty, num_boxes
    FROM (VALUES (1, 0, 0), (0, 1, 0), (0, 0, 1)) AS cases(received_qty, damaged_qty, num_boxes)
  LOOP
    UPDATE public.grn_items SET received_qty = activity.received_qty,
      damaged_qty = activity.damaged_qty, num_boxes = activity.num_boxes WHERE grn_id = v_grn_id;
    BEGIN
      PERFORM public.reverse_load_list_arrival(ctx.company_id, ctx.load_list_id, ctx.actor_id);
      RAISE EXCEPTION 'Reversal accepted receiving activity';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'Cannot reverse arrival after GRN receiving activity exists' THEN RAISE; END IF;
    END;
  END LOOP;
  UPDATE public.grn_items SET received_qty = 0, damaged_qty = 0, num_boxes = 0 WHERE grn_id = v_grn_id;
END $$;
RESET ROLE;

-- Fail the final status write after the GRN and its line were deleted.
CREATE FUNCTION pg_temp.force_grn_reversal_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id = (SELECT load_list_id FROM arrival_test_context) AND NEW.status = 'in_transit' THEN
    IF EXISTS (SELECT 1 FROM public.grns WHERE load_list_id = NEW.id) THEN
      RAISE EXCEPTION 'Reversal failure trigger ran before the GRN deletion';
    END IF;
    RAISE EXCEPTION 'forced GRN reversal rollback';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reversal_test_failure BEFORE UPDATE ON public.load_lists
FOR EACH ROW EXECUTE FUNCTION pg_temp.force_grn_reversal_failure();
SET LOCAL ROLE authenticated;
DO $$
DECLARE ctx RECORD;
BEGIN
  SELECT company_id, actor_id, load_list_id INTO STRICT ctx FROM arrival_test_context;
  BEGIN
    PERFORM public.reverse_load_list_arrival(ctx.company_id, ctx.load_list_id, ctx.actor_id);
    RAISE EXCEPTION 'Expected reversal failure did not occur';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'forced GRN reversal rollback' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
DROP TRIGGER reversal_test_failure ON public.load_lists;
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM public.grn_items line JOIN public.grns grn ON grn.id = line.grn_id
      WHERE grn.load_list_id = (SELECT load_list_id FROM arrival_test_context)) <> 1
    OR NOT EXISTS (SELECT 1 FROM public.load_lists WHERE id = (SELECT load_list_id FROM arrival_test_context)
      AND status = 'arrived' AND actual_arrival_date = CURRENT_DATE) THEN
    RAISE EXCEPTION 'Failed reversal kept partial deletions or status writes';
  END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT public.reverse_load_list_arrival(company_id, load_list_id, actor_id) FROM arrival_test_context;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.grns WHERE load_list_id = (SELECT load_list_id FROM arrival_test_context))
    OR NOT EXISTS (SELECT 1 FROM public.load_lists WHERE id = (SELECT load_list_id FROM arrival_test_context)
      AND status = 'in_transit' AND actual_arrival_date IS NULL) THEN
    RAISE EXCEPTION 'Clean arrival reversal failed';
  END IF;
END $$;

-- The hard-deleted draft no longer blocks another arrival for the same shipment.
SET LOCAL ROLE authenticated;
SELECT public.mark_load_list_arrived(company_id, business_unit_id, actor_id, load_list_id, CURRENT_DATE)
FROM arrival_test_context;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT COUNT(*) FROM public.grns WHERE load_list_id = (SELECT load_list_id FROM arrival_test_context)) <> 1 THEN
    RAISE EXCEPTION 'Re-arrival did not recreate one draft GRN';
  END IF;
  RAISE NOTICE 'Passed arrival, received/damaged/carton reversal guards, forced arrival/reversal rollback, clean reversal, and re-arrival';
END $$;

ROLLBACK;
