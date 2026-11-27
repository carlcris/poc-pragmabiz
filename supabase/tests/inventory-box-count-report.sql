-- Run after applying the report migration to a local seeded database.
-- All fixtures are rolled back. Assertions run as authenticated with RLS applied.
BEGIN;

CREATE TEMP TABLE box_report_test_context ON COMMIT DROP AS
SELECT actor.id AS actor_id, actor.company_id, base.id AS base_uom_id,
  box.id AS box_uom_id, gen_random_uuid() AS category_id,
  gen_random_uuid() AS empty_category_id, gen_random_uuid() AS main_unit_id,
  gen_random_uuid() AS branch_unit_id, gen_random_uuid() AS denied_unit_id,
  gen_random_uuid() AS first_warehouse_id, gen_random_uuid() AS second_warehouse_id,
  gen_random_uuid() AS branch_warehouse_id, gen_random_uuid() AS denied_warehouse_id,
  gen_random_uuid() AS deleted_warehouse_id, gen_random_uuid() AS unassigned_warehouse_id,
  gen_random_uuid() AS largest_item_id, gen_random_uuid() AS missing_item_id,
  gen_random_uuid() AS zero_item_id, gen_random_uuid() AS negative_item_id,
  gen_random_uuid() AS deleted_item_id, gen_random_uuid() AS other_item_id,
  gen_random_uuid() AS scoped_role_id, gen_random_uuid() AS pack_uom_id,
  gen_random_uuid() AS inactive_uom_id, gen_random_uuid() AS deleted_uom_id,
  gen_random_uuid() AS foreign_company_id, gen_random_uuid() AS foreign_uom_id,
  gen_random_uuid() AS empty_uom_id, gen_random_uuid() AS inactive_only_item_id,
  gen_random_uuid() AS deleted_only_item_id
FROM public.users actor
JOIN public.units_of_measure base ON base.company_id = actor.company_id
  AND base.deleted_at IS NULL AND base.is_active IS TRUE AND UPPER(base.code) = 'PCS'
JOIN public.units_of_measure box ON box.company_id = actor.company_id
  AND box.deleted_at IS NULL AND box.is_active IS TRUE AND UPPER(box.code) = 'BOX'
WHERE actor.is_active IS TRUE AND actor.deleted_at IS NULL
  AND public.user_has_permission(actor.id, 'reports', 'view', gen_random_uuid())
ORDER BY actor.id, base.id, box.id
LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM box_report_test_context) THEN
    RAISE EXCEPTION 'Test needs an active global report viewer and PCS/BOX units';
  END IF;
END;
$$;

INSERT INTO public.companies (id, code, name)
SELECT foreign_company_id, 'PACK-' || LEFT(foreign_company_id::TEXT, 8), 'Packing unit other company'
FROM box_report_test_context;

INSERT INTO public.units_of_measure (id, company_id, code, name, is_active, deleted_at)
SELECT fixture.id, fixture.company_id, fixture.code, fixture.name, fixture.active, fixture.deleted_at
FROM box_report_test_context context
CROSS JOIN LATERAL (VALUES
  (context.empty_uom_id, context.company_id, 'EMPTY-' || LEFT(context.empty_uom_id::TEXT, 8), 'Unused calculation unit', TRUE, NULL::TIMESTAMP),
  (context.pack_uom_id, context.company_id, 'PACK-' || LEFT(context.pack_uom_id::TEXT, 8), 'Pack', TRUE, NULL::TIMESTAMP),
  (context.inactive_uom_id, context.company_id, 'OFF-' || LEFT(context.inactive_uom_id::TEXT, 8), 'Inactive packing unit', FALSE, NULL::TIMESTAMP),
  (context.deleted_uom_id, context.company_id, 'DEL-' || LEFT(context.deleted_uom_id::TEXT, 8), 'Deleted packing unit', TRUE, CURRENT_TIMESTAMP::TIMESTAMP),
  (context.foreign_uom_id, context.foreign_company_id, 'FOREIGN', 'Foreign packing unit', TRUE, NULL::TIMESTAMP)
) fixture(id, company_id, code, name, active, deleted_at);

INSERT INTO public.business_units (id, company_id, code, name)
SELECT fixture.id, context.company_id, 'BOX-TEST-' || fixture.id::TEXT, fixture.name
FROM box_report_test_context context
CROSS JOIN LATERAL (VALUES
  (context.main_unit_id, 'Box report main'),
  (context.branch_unit_id, 'Box report branch'),
  (context.denied_unit_id, 'Box report inaccessible')
) fixture(id, name);

INSERT INTO public.user_business_unit_access (user_id, business_unit_id)
SELECT context.actor_id, fixture.id
FROM box_report_test_context context
CROSS JOIN LATERAL (VALUES (context.main_unit_id), (context.branch_unit_id)) fixture(id);

INSERT INTO public.item_categories (id, company_id, code, name)
SELECT fixture.id, context.company_id, 'BOX-' || fixture.id::TEXT, fixture.name
FROM box_report_test_context context
CROSS JOIN LATERAL (VALUES (context.category_id, 'Box report category'),
  (context.empty_category_id, 'Box report empty category')) fixture(id, name);

INSERT INTO public.warehouses (id, company_id, business_unit_id, warehouse_code, warehouse_name, deleted_at)
SELECT fixture.id, context.company_id, fixture.unit_id, 'BOX-' || fixture.id::TEXT,
  'Box report warehouse', fixture.deleted_at
FROM box_report_test_context context
CROSS JOIN LATERAL (VALUES
  (context.first_warehouse_id, context.main_unit_id, NULL::TIMESTAMP),
  (context.second_warehouse_id, context.main_unit_id, NULL::TIMESTAMP),
  (context.branch_warehouse_id, context.branch_unit_id, NULL::TIMESTAMP),
  (context.denied_warehouse_id, context.denied_unit_id, NULL::TIMESTAMP),
  (context.deleted_warehouse_id, context.main_unit_id, CURRENT_TIMESTAMP::TIMESTAMP),
  (context.unassigned_warehouse_id, NULL::UUID, NULL::TIMESTAMP)
) fixture(id, unit_id, deleted_at);

INSERT INTO public.items (id, company_id, category_id, item_code, item_name, uom_id, item_type)
SELECT fixture.id, context.company_id, context.category_id, fixture.code,
  CASE WHEN fixture.id = context.other_item_id THEN 'Zulu item' ELSE 'Box report test item' END,
  context.base_uom_id, 'product'
FROM box_report_test_context context
CROSS JOIN LATERAL (VALUES
  (context.largest_item_id, 'BOX-TEST-A'), (context.missing_item_id, 'BOX-TEST-B'),
  (context.zero_item_id, 'BOX-TEST-C'), (context.negative_item_id, 'BOX-TEST-D'),
  (context.deleted_item_id, 'BOX-TEST-E'), (context.other_item_id, 'BOX-TEST-0'),
  (context.inactive_only_item_id, 'BOX-TEST-G'), (context.deleted_only_item_id, 'BOX-TEST-H')
) fixture(id, code);

INSERT INTO public.item_unit_options (company_id, item_id, uom_id, qty_per_unit, is_active, deleted_at)
SELECT context.company_id, fixture.item_id, context.box_uom_id, fixture.qty,
  fixture.active, fixture.deleted_at
FROM box_report_test_context context
CROSS JOIN LATERAL (VALUES
  (context.largest_item_id, 25, TRUE, NULL::TIMESTAMP),
  (context.largest_item_id, 50, TRUE, NULL::TIMESTAMP),
  (context.largest_item_id, 100, FALSE, NULL::TIMESTAMP),
  (context.largest_item_id, 200, TRUE, CURRENT_TIMESTAMP::TIMESTAMP),
  (context.zero_item_id, 40, TRUE, NULL::TIMESTAMP),
  (context.negative_item_id, 20, TRUE, NULL::TIMESTAMP),
  (context.other_item_id, 30, TRUE, NULL::TIMESTAMP),
  (context.inactive_only_item_id, 100, FALSE, NULL::TIMESTAMP),
  (context.deleted_only_item_id, 100, TRUE, CURRENT_TIMESTAMP::TIMESTAMP)
) fixture(item_id, qty, active, deleted_at);

INSERT INTO public.item_unit_options (company_id, item_id, uom_id, qty_per_unit, is_active, deleted_at)
SELECT context.company_id, fixture.item_id, context.pack_uom_id, fixture.qty,
  fixture.active, fixture.deleted_at
FROM box_report_test_context context
CROSS JOIN LATERAL (VALUES
  (context.largest_item_id, 10, TRUE, NULL::TIMESTAMP),
  (context.largest_item_id, 20, TRUE, NULL::TIMESTAMP),
  (context.largest_item_id, 40, FALSE, NULL::TIMESTAMP),
  (context.largest_item_id, 60, TRUE, CURRENT_TIMESTAMP::TIMESTAMP),
  (context.missing_item_id, 3, TRUE, NULL::TIMESTAMP),
  (context.negative_item_id, 5, TRUE, NULL::TIMESTAMP),
  (context.other_item_id, 24, TRUE, NULL::TIMESTAMP),
  (context.inactive_only_item_id, 100, FALSE, NULL::TIMESTAMP),
  (context.deleted_only_item_id, 100, TRUE, CURRENT_TIMESTAMP::TIMESTAMP)
) fixture(item_id, qty, active, deleted_at);

UPDATE public.items item SET deleted_at = CURRENT_TIMESTAMP
FROM box_report_test_context context WHERE item.id = context.deleted_item_id;

INSERT INTO public.item_warehouse (company_id, item_id, warehouse_id, current_stock)
SELECT context.company_id, fixture.item_id, fixture.warehouse_id, fixture.qty
FROM box_report_test_context context
CROSS JOIN LATERAL (VALUES
  (context.largest_item_id, context.first_warehouse_id, 35),
  (context.largest_item_id, context.second_warehouse_id, 25),
  (context.largest_item_id, context.branch_warehouse_id, 70),
  (context.largest_item_id, context.denied_warehouse_id, 1000),
  (context.largest_item_id, context.deleted_warehouse_id, 1000),
  (context.largest_item_id, context.unassigned_warehouse_id, 1000),
  (context.missing_item_id, context.branch_warehouse_id, 9),
  (context.negative_item_id, context.first_warehouse_id, -10),
  (context.deleted_item_id, context.first_warehouse_id, 1000),
  (context.other_item_id, context.first_warehouse_id, 96),
  (context.inactive_only_item_id, context.first_warehouse_id, 1000),
  (context.deleted_only_item_id, context.first_warehouse_id, 1000)
) fixture(item_id, warehouse_id, qty);

GRANT SELECT ON box_report_test_context TO authenticated;
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  context RECORD;
  report JSONB;
  first_page_summary JSONB;
  item JSONB;
  invalid_unit_id UUID;
BEGIN
  SELECT actor_id, company_id, category_id, empty_category_id, box_uom_id, pack_uom_id,
    inactive_uom_id, deleted_uom_id, foreign_uom_id, empty_uom_id,
    main_unit_id, branch_unit_id, denied_unit_id INTO context
  FROM box_report_test_context;
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', context.actor_id, 'role', 'authenticated',
    'current_business_unit_id', context.main_unit_id)::TEXT, TRUE);

  report := public.get_inventory_box_count_report(context.company_id, context.category_id, context.box_uom_id,
    context.main_unit_id, 1, 2);
  IF report->'summary' <> '{"totalItems":4,"totalFullPackingUnits":4,"itemsWithoutPackingUnitSize":3}'::JSONB
    OR jsonb_array_length(report->'data') <> 2
    OR (report->'pagination'->>'totalPages')::INTEGER <> 2 THEN
    RAISE EXCEPTION 'Main report or complete summary incorrect: %', report;
  END IF;
  item := report->'data'->0;
  IF item->>'itemCode' <> 'BOX-TEST-A' OR (item->>'onHand')::NUMERIC <> 60
    OR (item->>'qtyPerPackingUnit')::NUMERIC <> 50 OR (item->>'fullPackingUnits')::NUMERIC <> 1
    OR (item->>'looseUnits')::NUMERIC <> 10 THEN
    RAISE EXCEPTION 'Largest active box and pooled unit stock incorrect: %', item;
  END IF;
  IF report->'data'->1->>'itemCode' <> 'BOX-TEST-C'
    OR (report->'data'->1->>'onHand')::NUMERIC <> 0
    OR (report->'data'->1->>'fullPackingUnits')::NUMERIC <> 0 THEN
    RAISE EXCEPTION 'Eligible zero-stock item must follow the first row';
  END IF;
  first_page_summary := report->'summary';
  report := public.get_inventory_box_count_report(context.company_id, context.category_id, context.box_uom_id,
    context.main_unit_id, 2, 2);
  IF report->'summary' <> first_page_summary
    OR report->'data'->0->>'itemCode' <> 'BOX-TEST-D'
    OR (report->'data'->0->>'onHand')::NUMERIC <> -10
    OR (report->'data'->0->>'fullPackingUnits')::NUMERIC <> 0
    OR report->'data'->1->>'itemCode' <> 'BOX-TEST-0' THEN
    RAISE EXCEPTION 'Later-page totals, zero stock, or negative stock incorrect: %', report;
  END IF;

  report := public.get_inventory_box_count_report(context.company_id, context.category_id, context.box_uom_id,
    context.branch_unit_id, 1, 25);
  IF (report->'summary'->>'totalFullPackingUnits')::NUMERIC <> 1
    OR (report->'data'->0->>'onHand')::NUMERIC <> 70 THEN
    RAISE EXCEPTION 'Branch stock incorrect: %', report;
  END IF;
  report := public.get_inventory_box_count_report(context.company_id, context.category_id, context.box_uom_id,
    NULL, 1, 25);
  IF (report->'summary'->>'totalFullPackingUnits')::NUMERIC <> 5
    OR (report->'data'->0->>'onHand')::NUMERIC <> 130 THEN
    RAISE EXCEPTION 'All accessible units included unauthorized, deleted, or unassigned stock: %', report;
  END IF;

  report := public.get_inventory_box_count_report(context.company_id, context.empty_category_id, context.box_uom_id,
    context.main_unit_id, 1, 25);
  IF report->'summary' <> '{"totalItems":0,"totalFullPackingUnits":0,"itemsWithoutPackingUnitSize":0}'::JSONB
    OR report->'data' <> '[]'::JSONB THEN
    RAISE EXCEPTION 'Empty category incorrect: %', report;
  END IF;
  IF public.get_inventory_box_count_report(context.company_id, gen_random_uuid(), context.box_uom_id,
    context.main_unit_id, 1, 25) IS NOT NULL THEN
    RAISE EXCEPTION 'Missing category must return SQL NULL';
  END IF;

  BEGIN
    PERFORM public.get_inventory_box_count_report(context.company_id, context.category_id, context.box_uom_id,
      context.denied_unit_id, 1, 25);
    RAISE EXCEPTION 'Expected inaccessible unit to fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.get_inventory_box_count_report(gen_random_uuid(), context.category_id, context.box_uom_id,
      context.main_unit_id, 1, 25);
    RAISE EXCEPTION 'Expected cross-company request to fail';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.get_inventory_box_count_report(context.company_id, context.category_id, context.box_uom_id,
      context.main_unit_id, 1, 5001);
    RAISE EXCEPTION 'Expected excessive page size to fail';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  report := public.get_inventory_box_count_report(context.company_id, context.category_id,
    context.pack_uom_id, context.main_unit_id, 1, 25);
  IF report->'summary' <> '{"totalItems":4,"totalFullPackingUnits":7,"itemsWithoutPackingUnitSize":3}'::JSONB
    OR report->'packingUnit'->>'id' <> context.pack_uom_id::TEXT
    OR report->'packingUnit'->>'name' <> 'Pack'
    OR (report->'data'->0->>'qtyPerPackingUnit')::NUMERIC <> 20
    OR (report->'data'->0->>'fullPackingUnits')::NUMERIC <> 3
    OR report->'data'->2->>'itemCode' <> 'BOX-TEST-D'
    OR jsonb_array_length(report->'data') <> 4 THEN
    RAISE EXCEPTION 'PACK conversion, largest PACK size, or missing selected size incorrect: %', report;
  END IF;
  report := public.get_inventory_box_count_report(context.company_id, context.category_id,
    context.pack_uom_id, context.branch_unit_id, 1, 25);
  IF (report->'summary'->>'totalFullPackingUnits')::NUMERIC <> 6 THEN
    RAISE EXCEPTION 'Branch PACK count incorrect: %', report;
  END IF;
  report := public.get_inventory_box_count_report(context.company_id, context.category_id,
    context.pack_uom_id, NULL, 1, 25);
  IF (report->'summary'->>'totalFullPackingUnits')::NUMERIC <> 13 THEN
    RAISE EXCEPTION 'All-unit PACK count incorrect: %', report;
  END IF;
  -- Every emitted numeric conversion is populated, and ineligible rows never consume a page.
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(report->'data') item_row
    WHERE item_row->'qtyPerPackingUnit' = 'null'::JSONB
      OR item_row->'fullPackingUnits' = 'null'::JSONB OR item_row->'looseUnits' = 'null'::JSONB
      OR item_row->>'itemCode' IN ('BOX-TEST-C', 'BOX-TEST-G', 'BOX-TEST-H')
  ) THEN
    RAISE EXCEPTION 'PACK report contains an ineligible or unconverted row';
  END IF;
  report := public.get_inventory_box_count_report(context.company_id, context.category_id,
    context.pack_uom_id, context.main_unit_id, 3, 2);
  IF report->'data' <> '[]'::JSONB
    OR (report->'pagination'->>'totalPages')::INTEGER <> 2
    OR (report->'summary'->>'totalItems')::INTEGER <> 4 THEN
    RAISE EXCEPTION 'Pages must be based on eligible items only: %', report;
  END IF;
  report := public.get_inventory_box_count_report(context.company_id, context.category_id,
    context.empty_uom_id, context.main_unit_id, 1, 25);
  IF report->'data' <> '[]'::JSONB
    OR report->'summary' <> '{"totalItems":0,"totalFullPackingUnits":0,"itemsWithoutPackingUnitSize":7}'::JSONB
    OR (report->'pagination'->>'totalPages')::INTEGER <> 0 THEN
    RAISE EXCEPTION 'All-excluded category must return zero rows and the full skipped count: %', report;
  END IF;
  FOREACH invalid_unit_id IN ARRAY ARRAY[
    context.inactive_uom_id, context.deleted_uom_id, context.foreign_uom_id,
    gen_random_uuid(), NULL::UUID
  ] LOOP
    BEGIN
      PERFORM public.get_inventory_box_count_report(context.company_id, context.category_id,
        invalid_unit_id, context.main_unit_id, 1, 25);
      RAISE EXCEPTION 'Expected invalid packing unit to fail';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM <> 'INVENTORY_BOX_COUNT_PACKING_UNIT_NOT_FOUND' THEN RAISE; END IF;
    END;
  END LOOP;
  RAISE NOTICE 'PASS: BOX/PACK eligibility, missing/inactive/deleted exclusions, zero and negative stock, eligible pagination, all-excluded totals, unit scope, and direct RPC authorization';
END;
$$;

-- Keep both memberships while granting report access only in the main unit.
RESET ROLE;
UPDATE public.user_roles assigned_role SET deleted_at = CURRENT_TIMESTAMP
FROM box_report_test_context context
WHERE assigned_role.user_id = context.actor_id AND assigned_role.deleted_at IS NULL;

INSERT INTO public.roles (id, company_id, name)
SELECT scoped_role_id, company_id, 'Box report scoped ' || scoped_role_id::TEXT
FROM box_report_test_context;

INSERT INTO public.role_permissions (role_id, permission_id, can_view)
SELECT context.scoped_role_id, permission.id, TRUE
FROM box_report_test_context context
JOIN public.permissions permission ON permission.resource = 'reports'
  AND permission.deleted_at IS NULL;

INSERT INTO public.user_roles (user_id, role_id, business_unit_id)
SELECT actor_id, scoped_role_id, main_unit_id FROM box_report_test_context;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  context RECORD;
  report JSONB;
BEGIN
  SELECT actor_id, company_id, category_id, main_unit_id, branch_unit_id, box_uom_id
    INTO context FROM box_report_test_context;
  report := public.get_inventory_box_count_report(context.company_id, context.category_id, context.box_uom_id,
    NULL, 1, 25);
  IF (report->'summary'->>'totalFullPackingUnits')::NUMERIC <> 4
    OR (report->'data'->0->>'onHand')::NUMERIC <> 60 THEN
    RAISE EXCEPTION 'All-unit report included a membership without report permission: %', report;
  END IF;
  BEGIN
    PERFORM public.get_inventory_box_count_report(context.company_id, context.category_id, context.box_uom_id,
      context.branch_unit_id, 1, 25);
    RAISE EXCEPTION 'Expected report permission denial despite unit membership';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS: unit membership alone cannot expose report stock';
END;
$$;

ROLLBACK;
