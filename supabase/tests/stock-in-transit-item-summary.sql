-- Rollback-only fixtures. Summary reads run as authenticated with RLS applied.
-- docker exec -i supabase_db_backend psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/stock-in-transit-item-summary.sql
BEGIN;

CREATE TEMP TABLE transit_summary_context ON COMMIT DROP AS
SELECT actor.id AS actor_id, actor.company_id, business_unit.id AS business_unit_id,
  supplier.id AS supplier_id, unit.id AS uom_id, unit.name AS unit_name,
  'TRANSIT-SUMMARY-' || gen_random_uuid()::TEXT AS prefix,
  gen_random_uuid() AS other_business_unit_id,
  gen_random_uuid() AS other_company_id,
  gen_random_uuid() AS other_company_business_unit_id,
  gen_random_uuid() AS other_company_supplier_id,
  gen_random_uuid() AS other_company_uom_id,
  gen_random_uuid() AS other_company_item_id,
  gen_random_uuid() AS other_company_load_list_id
FROM public.users actor
JOIN public.user_business_unit_access access_row ON access_row.user_id = actor.id
JOIN public.business_units business_unit ON business_unit.id = access_row.business_unit_id
  AND business_unit.company_id = actor.company_id AND business_unit.is_active IS TRUE
JOIN public.suppliers supplier ON supplier.company_id = actor.company_id AND supplier.deleted_at IS NULL
JOIN public.units_of_measure unit ON unit.company_id = actor.company_id AND unit.deleted_at IS NULL
WHERE actor.is_active IS TRUE AND actor.deleted_at IS NULL
ORDER BY actor.id, business_unit.id, supplier.id, unit.id
LIMIT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM transit_summary_context) THEN
    RAISE EXCEPTION 'Test needs an active user with business-unit access, supplier, and base unit';
  END IF;
END $$;

GRANT SELECT ON transit_summary_context TO authenticated;
SELECT set_config('request.jwt.claim.sub', actor_id::TEXT, TRUE),
  set_config('request.jwt.claims', jsonb_build_object('sub', actor_id,
    'role', 'authenticated', 'current_business_unit_id', business_unit_id)::TEXT, TRUE)
FROM transit_summary_context;

INSERT INTO public.business_units (id, company_id, code, name)
SELECT other_business_unit_id, company_id, 'TRANSIT-' || LEFT(other_business_unit_id::TEXT, 8),
  'Transit summary other destination'
FROM transit_summary_context;

CREATE TEMP TABLE transit_summary_items (ordinal INTEGER, item_id UUID) ON COMMIT DROP;
INSERT INTO transit_summary_items SELECT ordinal, gen_random_uuid() FROM generate_series(1, 3) ordinal;
GRANT SELECT ON transit_summary_items TO authenticated;

INSERT INTO public.items (id, company_id, item_code, item_name, uom_id, item_type)
SELECT fixture.item_id, context.company_id, context.prefix || '-' || fixture.ordinal,
  context.prefix || ' Item ' || fixture.ordinal, context.uom_id, 'product'
FROM transit_summary_context context CROSS JOIN transit_summary_items fixture;

CREATE TEMP TABLE transit_summary_shipments (ordinal INTEGER, load_list_id UUID) ON COMMIT DROP;
INSERT INTO transit_summary_shipments SELECT ordinal, gen_random_uuid() FROM generate_series(1, 5) ordinal;
GRANT SELECT ON transit_summary_shipments TO authenticated;

INSERT INTO public.load_lists (id, company_id, business_unit_id, destination_business_unit_id,
  supplier_id, created_by, status, estimated_arrival_date, deleted_at)
SELECT fixture.load_list_id, context.company_id,
  CASE WHEN fixture.ordinal = 2 THEN context.other_business_unit_id ELSE context.business_unit_id END,
  CASE WHEN fixture.ordinal = 2 THEN context.other_business_unit_id ELSE context.business_unit_id END,
  context.supplier_id, context.actor_id,
  CASE fixture.ordinal WHEN 3 THEN 'confirmed' WHEN 4 THEN 'arrived' ELSE 'in_transit' END,
  DATE '2026-11-27',
  CASE WHEN fixture.ordinal = 5 THEN now() ELSE NULL END
FROM transit_summary_context context CROSS JOIN transit_summary_shipments fixture;

-- Item 1 is split across two shipments and three lines, with mixed saved conversions.
-- The expected totals are item 1 = 400, item 2 = 100, item 3 = 500.
INSERT INTO public.load_list_items (load_list_id, item_id, uom_id, load_list_qty, unit_name, qty_per_unit)
SELECT shipment.load_list_id, item.item_id, context.uom_id, line.quantity, line.unit_name, line.conversion
FROM transit_summary_context context
CROSS JOIN (VALUES
  (1, 1, 100, 'Each', 1), (1, 1, 2, 'Carton', 50),
  (1, 2, 100, 'Each', 1), (2, 1, 4, 'Box', 50), (2, 3, 500, 'Each', 1),
  (3, 1, 900, 'Each', 1), (4, 1, 800, 'Each', 1), (5, 1, 700, 'Each', 1)
) line(shipment_ordinal, item_ordinal, quantity, unit_name, conversion)
JOIN transit_summary_shipments shipment ON shipment.ordinal = line.shipment_ordinal
JOIN transit_summary_items item ON item.ordinal = line.item_ordinal;

-- A complete second-company shipment proves isolation against real matching data.
INSERT INTO public.companies (id, code, name)
SELECT other_company_id, 'TS-' || LEFT(other_company_id::TEXT, 12), 'Transit summary other company'
FROM transit_summary_context;
INSERT INTO public.business_units (id, company_id, code, name)
SELECT other_company_business_unit_id, other_company_id, 'OTHER', 'Transit other company destination'
FROM transit_summary_context;
INSERT INTO public.units_of_measure (id, company_id, code, name)
SELECT other_company_uom_id, other_company_id, 'EA', 'Each' FROM transit_summary_context;
INSERT INTO public.suppliers (id, company_id, supplier_code, supplier_name, contact_person,
  email, phone, billing_address_line1, billing_city, billing_state, billing_country, billing_postal_code)
SELECT other_company_supplier_id, other_company_id, 'TRANSIT-OTHER', 'Transit other supplier',
  'Test', 'transit@example.test', '000', 'Test', 'Test', 'Test', 'PH', '0000'
FROM transit_summary_context;
INSERT INTO public.items (id, company_id, item_code, item_name, uom_id, item_type)
SELECT other_company_item_id, other_company_id, prefix || '-other-company',
  prefix || ' other company item', other_company_uom_id, 'product'
FROM transit_summary_context;
-- The generator allocates per company while ll_number is globally unique.
-- Reserve an unused test suffix for the second company within this rollback-only transaction.
INSERT INTO public.document_code_sequences (company_id, code_prefix, last_number)
SELECT context.other_company_id, 'LL', COALESCE(MAX(substring(load_list.ll_number FROM '[0-9]+$')::BIGINT), 0) + 1000
FROM transit_summary_context context
LEFT JOIN public.load_lists load_list ON load_list.ll_number ~ '^LL-[0-9]+$'
GROUP BY context.other_company_id;

INSERT INTO public.load_lists (id, company_id, business_unit_id, destination_business_unit_id,
  supplier_id, created_by, status)
SELECT other_company_load_list_id, other_company_id, other_company_business_unit_id,
  other_company_business_unit_id, other_company_supplier_id, actor_id, 'in_transit'
FROM transit_summary_context;
INSERT INTO public.load_list_items (load_list_id, item_id, uom_id, load_list_qty, unit_name, qty_per_unit)
SELECT other_company_load_list_id, other_company_item_id, other_company_uom_id, 999, 'Each', 1
FROM transit_summary_context;

SET LOCAL ROLE authenticated;
DO $$
DECLARE context RECORD; summary RECORD; first_item UUID; second_item UUID; result_count BIGINT;
BEGIN
  SELECT actor_id, company_id, business_unit_id, prefix, unit_name, other_business_unit_id,
    other_company_id INTO STRICT context
  FROM transit_summary_context;

  SELECT COUNT(*) INTO result_count FROM public.get_stock_in_transit_item_summary_page(
    context.company_id, DATE '2026-11-22', context.prefix, 1, 25);
  IF result_count <> 3 THEN RAISE EXCEPTION 'Expected three grouped items, got %', result_count; END IF;

  IF EXISTS (SELECT 1 FROM public.user_business_unit_access
    WHERE user_id = context.actor_id AND business_unit_id = context.other_business_unit_id) THEN
    RAISE EXCEPTION 'Fixture unexpectedly grants destination business-unit membership';
  END IF;

  SELECT item_id INTO STRICT first_item FROM transit_summary_items WHERE ordinal = 1;
  IF (SELECT COUNT(*) FROM public.get_stock_in_transit_item_arrivals_page(
      context.company_id, first_item, DATE '2026-11-22', 1, 25)) <> 2
    OR EXISTS (SELECT 1 FROM public.get_stock_in_transit_item_arrivals_page(
      context.company_id, first_item, DATE '2026-11-22', 1, 25) result
      WHERE result.base_quantity <> 200 OR result.arrival_base_quantity <> 400
        OR result.arrival_shipment_count <> 2 OR result.arrival_container_count <> 0
        OR jsonb_array_length(result.arrival_destination_totals) <> 2
        OR result.arrival_window <> 'next_7_days' OR result.days_until_arrival <> 5
        OR result.next_7_days_base_quantity <> 400 OR result.total_count <> 2) THEN
    RAISE EXCEPTION 'Same-date shipment grouping, destination split, or arrival window failed';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.get_stock_in_transit_item_summary_page(
      context.company_id, DATE '2026-11-22', context.prefix, 1, 25) result
      WHERE result.item_id = first_item
        AND result.ordered_unit_totals = '[{"quantity": 4, "unit_name": "Box", "qty_per_unit": 50}, {"quantity": 2, "unit_name": "Carton", "qty_per_unit": 50}, {"quantity": 100, "unit_name": "Each", "qty_per_unit": 1}]'::JSONB)
    OR NOT EXISTS (SELECT 1 FROM public.get_stock_in_transit_item_arrivals_page(
      context.company_id, first_item, DATE '2026-11-22', 1, 25) result
      WHERE result.base_quantity = 200
        AND result.ordered_unit_totals = '[{"quantity": 4, "unit_name": "Box", "qty_per_unit": 50}]'::JSONB
        AND result.arrival_ordered_unit_totals = '[{"quantity": 4, "unit_name": "Box", "qty_per_unit": 50}, {"quantity": 2, "unit_name": "Carton", "qty_per_unit": 50}, {"quantity": 100, "unit_name": "Each", "qty_per_unit": 1}]'::JSONB
        AND result.arrival_window_ordered_unit_totals -> 'next_7_days' = result.arrival_ordered_unit_totals
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(result.arrival_destination_totals) destination
          WHERE destination -> 'ordered_unit_totals' = '[{"quantity": 4, "unit_name": "Box", "qty_per_unit": 50}]'::JSONB)) THEN
    RAISE EXCEPTION 'Ordered-unit totals must stay separate at item, shipment, date, destination, and window level';
  END IF;

  IF (SELECT COUNT(*) FROM public.get_stock_in_transit_item_summary_page(
      context.company_id, DATE '2026-11-22', 'Transit summary other destination', 1, 25)) <> 2
    OR NOT EXISTS (SELECT 1 FROM public.get_stock_in_transit_item_summary_page(
      context.company_id, DATE '2026-11-22', 'Transit summary other destination', 1, 25) result
      WHERE result.item_id = first_item AND result.total_base_quantity = 400
        AND result.load_list_count = 2 AND result.late_load_list_count = 0) THEN
    RAISE EXCEPTION 'Shipment search must find items while keeping their complete totals';
  END IF;

  IF EXISTS (SELECT 1 FROM public.get_stock_in_transit_item_summary_page(
    context.other_company_id, DATE '2026-11-22', context.prefix, 1, 25))
    OR EXISTS (SELECT 1 FROM public.get_stock_in_transit_item_arrivals_page(
      context.other_company_id, first_item, DATE '2026-11-22', 1, 25)) THEN
    RAISE EXCEPTION 'Authenticated caller can read a different company shipment';
  END IF;

  -- Changing the session BU must leave both company views unchanged.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', context.actor_id,
    'role', 'authenticated', 'current_business_unit_id', context.other_business_unit_id)::TEXT, TRUE);
  IF (SELECT COUNT(*) FROM public.get_stock_in_transit_item_summary_page(
    context.company_id, DATE '2026-11-22', context.prefix, 1, 25)) <> 3
    OR (SELECT COUNT(*) FROM public.get_stock_in_transit_item_arrivals_page(
      context.company_id, first_item, DATE '2026-11-22', 1, 25)) <> 2 THEN
    RAISE EXCEPTION 'Selected business unit changed the company transit result';
  END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', context.actor_id,
    'role', 'authenticated', 'current_business_unit_id', context.business_unit_id)::TEXT, TRUE);

  FOR summary IN
    SELECT result.item_id, result.total_base_quantity, result.shipment_count,
      result.total_count, result.base_unit_name, fixture.ordinal
    FROM public.get_stock_in_transit_item_summary_page(
    context.company_id, DATE '2026-11-22', context.prefix, 1, 25) result
    JOIN transit_summary_items fixture ON fixture.item_id = result.item_id
  LOOP
    IF summary.total_base_quantity <> (CASE summary.ordinal WHEN 1 THEN 400 WHEN 2 THEN 100 ELSE 500 END)
      OR summary.shipment_count <> (CASE summary.ordinal WHEN 1 THEN 2 ELSE 1 END)
      OR summary.total_count <> 3 OR summary.base_unit_name IS DISTINCT FROM context.unit_name THEN
      RAISE EXCEPTION 'Incorrect mixed-unit aggregate, distinct shipment count, total, or base-unit label';
    END IF;
  END LOOP;

  SELECT result.item_id INTO first_item FROM public.get_stock_in_transit_item_summary_page(
    context.company_id, DATE '2026-11-22', context.prefix, 1, 1) result;
  SELECT result.item_id INTO second_item FROM public.get_stock_in_transit_item_summary_page(
    context.company_id, DATE '2026-11-22', context.prefix, 2, 1) result;
  IF first_item IS DISTINCT FROM (SELECT item_id FROM transit_summary_items WHERE ordinal = 1)
    OR second_item IS DISTINCT FROM (SELECT item_id FROM transit_summary_items WHERE ordinal = 2) THEN
    RAISE EXCEPTION 'Deterministic item pagination failed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.get_stock_in_transit_item_summary_page(
    context.company_id, DATE '2026-11-22', context.prefix, 1, 1) result
    WHERE result.total_base_quantity = 400 AND result.total_count = 3) THEN
    RAISE EXCEPTION 'Pagination truncated the aggregate or item count';
  END IF;

  IF (SELECT COUNT(*) FROM public.get_stock_in_transit_item_summary_page(
    context.company_id, DATE '2026-11-22', context.prefix || ' Item 2', 1, 25)) <> 1 THEN
    RAISE EXCEPTION 'Item-name search failed';
  END IF;
  IF (SELECT COUNT(*) FROM public.get_stock_in_transit_item_summary_page(
    context.company_id, DATE '2026-11-22', context.prefix || '-3', 1, 25)) <> 1 THEN
    RAISE EXCEPTION 'Item-code search failed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.get_stock_in_transit_item_summary_page(
    context.company_id, DATE '2026-11-22', context.prefix || '-missing', 1, 25))
    OR EXISTS (SELECT 1 FROM public.get_stock_in_transit_item_summary_page(
      gen_random_uuid(), DATE '2026-11-22', context.prefix, 1, 25))
    OR EXISTS (SELECT 1 FROM public.get_stock_in_transit_item_summary_page(
    context.company_id, DATE '2026-11-22', context.prefix, 2147483647, 50)) THEN
    RAISE EXCEPTION 'Empty search, company scope, or large page handling failed';
  END IF;
  IF (SELECT COUNT(*) FROM public.get_stock_in_transit_item_summary_page(
    context.company_id, DATE '2026-11-22', context.prefix, 0, 0)) <> 1 THEN
    RAISE EXCEPTION 'Lower page and page-size bounds failed';
  END IF;
END $$;
RESET ROLE;

-- The database caps output while aggregating all matching items before applying the cap.
INSERT INTO public.items (id, company_id, item_code, item_name, uom_id, item_type)
SELECT gen_random_uuid(), context.company_id, context.prefix || '-bulk-' || ordinal,
  context.prefix || ' bulk ' || ordinal, context.uom_id, 'product'
FROM transit_summary_context context CROSS JOIN generate_series(1, 55) ordinal;
INSERT INTO public.load_list_items (load_list_id, item_id, uom_id, load_list_qty, unit_name, qty_per_unit)
SELECT shipment.load_list_id, item.id, context.uom_id, 1, context.unit_name, 1
FROM transit_summary_context context
JOIN transit_summary_shipments shipment ON shipment.ordinal = 1
JOIN public.items item ON item.company_id = context.company_id
  AND item.item_code LIKE context.prefix || '-bulk-%';

SET LOCAL ROLE authenticated;
DO $$
DECLARE context RECORD;
BEGIN
  SELECT company_id, business_unit_id, prefix INTO STRICT context FROM transit_summary_context;
  IF (SELECT COUNT(*) FROM public.get_stock_in_transit_item_summary_page(
    context.company_id, DATE '2026-11-22', context.prefix || '-bulk-', 1, 500)) <> 50
    OR EXISTS (SELECT 1 FROM public.get_stock_in_transit_item_summary_page(
    context.company_id, DATE '2026-11-22', context.prefix || '-bulk-', 1, 500) result
      WHERE result.total_count <> 55) THEN
    RAISE EXCEPTION 'Page-size cap or complete grouped count failed';
  END IF;
END $$;
RESET ROLE;

-- Binary quantities make every arrival-window boundary visible in its total.
CREATE TEMP TABLE transit_window_fixture ON COMMIT DROP AS
SELECT gen_random_uuid() AS item_id;
GRANT SELECT ON transit_window_fixture TO authenticated;
CREATE TEMP TABLE transit_window_shipments (load_list_id UUID, arrival DATE, quantity NUMERIC) ON COMMIT DROP;
INSERT INTO transit_window_shipments VALUES
  (gen_random_uuid(), DATE '2026-11-21', 1), (gen_random_uuid(), DATE '2026-11-22', 2),
  (gen_random_uuid(), DATE '2026-11-28', 4), (gen_random_uuid(), DATE '2026-11-29', 8),
  (gen_random_uuid(), DATE '2026-12-05', 16), (gen_random_uuid(), DATE '2026-12-06', 32),
  (gen_random_uuid(), NULL, 64);
INSERT INTO public.items (id, company_id, item_code, item_name, uom_id, item_type)
SELECT fixture.item_id, context.company_id, context.prefix || '-windows',
  context.prefix || ' arrival windows', context.uom_id, 'product'
FROM transit_summary_context context CROSS JOIN transit_window_fixture fixture;
INSERT INTO public.load_lists (id, company_id, business_unit_id, destination_business_unit_id,
  supplier_id, created_by, status, estimated_arrival_date)
SELECT shipment.load_list_id, context.company_id, context.business_unit_id, context.business_unit_id,
  context.supplier_id, context.actor_id, 'in_transit', shipment.arrival
FROM transit_summary_context context CROSS JOIN transit_window_shipments shipment;
INSERT INTO public.load_list_items (load_list_id, item_id, uom_id, load_list_qty, unit_name, qty_per_unit)
SELECT shipment.load_list_id, fixture.item_id, context.uom_id, shipment.quantity, context.unit_name, 1
FROM transit_summary_context context
CROSS JOIN transit_window_fixture fixture
CROSS JOIN transit_window_shipments shipment;

SET LOCAL ROLE authenticated;
DO $$
DECLARE context RECORD; window_item UUID; page_row RECORD;
BEGIN
  SELECT company_id, prefix INTO STRICT context FROM transit_summary_context;
  SELECT item_id INTO STRICT window_item FROM transit_window_fixture;
  SELECT result.late_base_quantity, result.next_7_days_base_quantity, result.days_8_to_14_base_quantity,
    result.later_base_quantity, result.no_eta_base_quantity, result.total_count, result.estimated_arrival_date
  INTO STRICT page_row
  FROM public.get_stock_in_transit_item_arrivals_page(
    context.company_id, window_item, DATE '2026-11-22', 1, 1) result;
  IF page_row.late_base_quantity <> 1 OR page_row.next_7_days_base_quantity <> 6
    OR page_row.days_8_to_14_base_quantity <> 24 OR page_row.later_base_quantity <> 32
    OR page_row.no_eta_base_quantity <> 64 OR page_row.total_count <> 7
    OR page_row.estimated_arrival_date <> DATE '2026-11-21' THEN
    RAISE EXCEPTION 'Arrival-window boundaries or pre-pagination totals failed';
  END IF;
  IF (SELECT result.estimated_arrival_date FROM public.get_stock_in_transit_item_arrivals_page(
    context.company_id, window_item, DATE '2026-11-22', 7, 1) result) IS NOT NULL THEN
    RAISE EXCEPTION 'Shipments without an ETA must sort last';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.get_stock_in_transit_item_summary_page(
    context.company_id, DATE '2026-11-22', context.prefix || '-windows', 1, 1) result
    WHERE result.next_estimated_arrival_date = DATE '2026-11-21'
      AND result.next_days_until_arrival = -1 AND result.late_load_list_count = 1
      AND result.load_list_count = 7) THEN
    RAISE EXCEPTION 'Next arrival or late load-list summary failed';
  END IF;
  RAISE NOTICE 'Passed company transit totals, mixed units, same-date grouping, arrival windows, destinations without membership, company isolation, status, search, pagination and bounds';
END $$;
RESET ROLE;

-- Equal labels and base totals still preserve each snapshotted pack conversion.
CREATE TEMP TABLE transit_pack_fixture ON COMMIT DROP AS
SELECT gen_random_uuid() AS item_id;
GRANT SELECT ON transit_pack_fixture TO authenticated;
CREATE TEMP TABLE transit_pack_shipments (ordinal INTEGER, load_list_id UUID) ON COMMIT DROP;
INSERT INTO transit_pack_shipments
SELECT ordinal, gen_random_uuid() FROM generate_series(1, 2) ordinal;
GRANT SELECT ON transit_pack_shipments TO authenticated;

INSERT INTO public.items (id, company_id, item_code, item_name, uom_id, item_type)
SELECT fixture.item_id, context.company_id, context.prefix || '-packs',
  context.prefix || ' pack conversions', context.uom_id, 'product'
FROM transit_summary_context context CROSS JOIN transit_pack_fixture fixture;
INSERT INTO public.load_lists (id, company_id, business_unit_id, destination_business_unit_id,
  supplier_id, created_by, status, estimated_arrival_date)
SELECT shipment.load_list_id, context.company_id, context.business_unit_id, context.business_unit_id,
  context.supplier_id, context.actor_id, 'in_transit', DATE '2026-11-27'
FROM transit_summary_context context CROSS JOIN transit_pack_shipments shipment;
INSERT INTO public.load_list_items (load_list_id, item_id, uom_id, load_list_qty, unit_name, qty_per_unit)
SELECT shipment.load_list_id, fixture.item_id, context.uom_id, line.quantity, 'BOX', line.conversion
FROM transit_summary_context context
CROSS JOIN transit_pack_fixture fixture
CROSS JOIN (VALUES (1, 2, 144), (1, 4, 72), (2, 1, 144), (2, 2, 72))
  line(shipment_ordinal, quantity, conversion)
JOIN transit_pack_shipments shipment ON shipment.ordinal = line.shipment_ordinal;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  context RECORD;
  pack_item UUID;
  expected_units JSONB := '[{"unit_name": "BOX", "qty_per_unit": 72, "quantity": 6},
    {"unit_name": "BOX", "qty_per_unit": 144, "quantity": 3}]'::JSONB;
BEGIN
  SELECT company_id, business_unit_id, prefix INTO STRICT context FROM transit_summary_context;
  SELECT item_id INTO STRICT pack_item FROM transit_pack_fixture;

  IF NOT EXISTS (
    SELECT 1 FROM public.get_stock_in_transit_item_summary_page(
      context.company_id, DATE '2026-11-22', context.prefix || '-packs', 1, 25) result
    WHERE result.ordered_unit_totals = expected_units AND result.total_base_quantity = 864
      AND result.shipment_count = 2
  ) THEN
    RAISE EXCEPTION 'Item totals merged different pack conversions with the same label';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.get_stock_in_transit_item_arrivals_page(
      context.company_id, pack_item, DATE '2026-11-22', 1, 25) result
    JOIN transit_pack_shipments shipment ON shipment.load_list_id = result.load_list_id
    WHERE result.arrival_ordered_unit_totals <> expected_units
      OR result.arrival_window_ordered_unit_totals -> 'next_7_days' <> expected_units
      OR result.arrival_base_quantity <> 864 OR result.next_7_days_base_quantity <> 864
      OR result.base_quantity <> CASE shipment.ordinal WHEN 1 THEN 576 ELSE 288 END
      OR result.ordered_unit_totals <> CASE shipment.ordinal
        WHEN 1 THEN '[{"unit_name": "BOX", "qty_per_unit": 72, "quantity": 4},
          {"unit_name": "BOX", "qty_per_unit": 144, "quantity": 2}]'::JSONB
        ELSE '[{"unit_name": "BOX", "qty_per_unit": 72, "quantity": 2},
          {"unit_name": "BOX", "qty_per_unit": 144, "quantity": 1}]'::JSONB END
      OR result.arrival_destination_totals <> jsonb_build_array(jsonb_build_object(
        'destination_business_unit_id', context.business_unit_id,
        'destination_business_unit_name', (SELECT name FROM public.business_units
          WHERE id = context.business_unit_id),
        'base_quantity', 864, 'ordered_unit_totals', expected_units))
  ) OR (
    SELECT COUNT(*) FROM public.get_stock_in_transit_item_arrivals_page(
      context.company_id, pack_item, DATE '2026-11-22', 1, 25)
  ) <> 2 THEN
    RAISE EXCEPTION 'Shipment, date, destination, or arrival-window totals merged pack conversions';
  END IF;
END $$;
RESET ROLE;
ROLLBACK;
