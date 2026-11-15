-- Run against a seeded local database after applying the overview migration.
-- The overview runs as an authenticated user. All fixtures are rolled back.
BEGIN;

DO $$
DECLARE
  v_scope RECORD;
  v_before JSONB;
  v_after JSONB;
  v_shortages UUID[];
  v_denied_user UUID;
  v_test_unit UUID := gen_random_uuid();
  v_test_warehouse UUID := gen_random_uuid();
  v_day DATE := (now() AT TIME ZONE 'Asia/Manila')::DATE;
  v_prefix TEXT := 'OVERVIEW-' || gen_random_uuid()::TEXT;
  v_putaway_item UUID := gen_random_uuid();
  v_staged_item UUID := gen_random_uuid();
  v_cancelled_item UUID := gen_random_uuid();
  v_reserved_item UUID := gen_random_uuid();
  v_below_reorder_item UUID := gen_random_uuid();
  v_in_stock_item UUID := gen_random_uuid();
  v_adjustment UUID;
  v_grn UUID;
  v_move UUID;
BEGIN
  SELECT u.id AS user_id, u.company_id, w.business_unit_id, w.id AS warehouse_id, i.uom_id
  INTO STRICT v_scope
  FROM public.users u
  JOIN public.user_business_unit_access a ON a.user_id = u.id
  JOIN public.warehouses w ON w.company_id = u.company_id AND w.business_unit_id = a.business_unit_id
  JOIN public.items i ON i.company_id = u.company_id AND i.deleted_at IS NULL
  WHERE u.is_active AND u.deleted_at IS NULL AND w.is_active AND w.deleted_at IS NULL
    AND public.user_has_permission(u.id, 'dashboard', 'view', a.business_unit_id)
    AND public.user_has_permission(u.id, 'dashboard.widget.stock_value.view', 'view', a.business_unit_id)
  ORDER BY u.id, w.id, i.id
  LIMIT 1;

  -- Isolate the top-five check from seeded shortages and retain the actor's grants.
  INSERT INTO public.business_units (id, company_id, code, name)
  VALUES (v_test_unit, v_scope.company_id, 'OV-' || LEFT(v_test_unit::TEXT, 8), 'Overview test unit');
  INSERT INTO public.user_business_unit_access (user_id, business_unit_id)
  VALUES (v_scope.user_id, v_test_unit);
  INSERT INTO public.user_roles (user_id, role_id, business_unit_id)
  SELECT DISTINCT ur.user_id, ur.role_id, v_test_unit
  FROM public.user_roles ur
  WHERE ur.user_id = v_scope.user_id AND ur.business_unit_id = v_scope.business_unit_id
    AND ur.deleted_at IS NULL;
  INSERT INTO public.warehouses (id, company_id, business_unit_id, warehouse_code, warehouse_name)
  VALUES (
    v_test_warehouse, v_scope.company_id, v_test_unit,
    'OV-' || LEFT(v_test_warehouse::TEXT, 8), 'Overview test warehouse'
  );
  v_scope.business_unit_id := v_test_unit;
  v_scope.warehouse_id := v_test_warehouse;

  PERFORM set_config('request.jwt.claim.sub', v_scope.user_id::TEXT, TRUE);
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_scope.user_id,
    'role', 'authenticated',
    'company_id', v_scope.company_id,
    'current_business_unit_id', v_scope.business_unit_id
  )::TEXT, TRUE);

  SET LOCAL ROLE authenticated;
  v_before := public.get_warehouse_operations_overview(
    v_scope.company_id, ARRAY[v_scope.business_unit_id], 'Asia/Manila', 7,
    TRUE, TRUE, FALSE, FALSE, FALSE, FALSE
  );
  RESET ROLE;

  INSERT INTO public.items (id, company_id, item_code, item_name, uom_id, item_type, reorder_level)
  SELECT fixture.id, v_scope.company_id, v_prefix || fixture.label, fixture.label, v_scope.uom_id,
    'product', 5
  FROM (VALUES
    (v_putaway_item, 'pending putaway'),
    (v_staged_item, 'first receipt awaiting putaway'),
    (v_cancelled_item, 'cancelled putaway only'),
    (v_reserved_item, 'fully reserved'),
    (v_below_reorder_item, 'below reorder'),
    (v_in_stock_item, 'in stock')
  ) AS fixture(id, label);

  INSERT INTO public.item_warehouse (
    company_id, item_id, warehouse_id, current_stock, reserved_stock, putaway_qty
  )
  SELECT v_scope.company_id, fixture.item_id, v_scope.warehouse_id,
    fixture.current_stock, fixture.reserved_stock, fixture.putaway_qty
  FROM (VALUES
    (v_putaway_item, 10, 0, 10),       -- out of stock in storage
    (v_reserved_item, 10, 6, 4),      -- all six stored units reserved
    (v_below_reorder_item, 10, 2, 4), -- four available, below the reorder point
    (v_in_stock_item, 10, 1, 0)       -- nine available
  ) AS fixture(item_id, current_stock, reserved_stock, putaway_qty);

  -- An unassigned GRN receipt stages tasks at business-unit level without an item_warehouse row.
  INSERT INTO public.putaway_tasks (
    company_id, business_unit_id, warehouse_id, item_id, uom_id, source_type, source_id,
    source_line_id, source_unit_name, source_qty_per_unit, quantity, pending_quantity,
    posted_quantity, status
  )
  SELECT v_scope.company_id, v_scope.business_unit_id, NULL, task.item_id, v_scope.uom_id,
    'grn', gen_random_uuid(), gen_random_uuid(), 'unit', 1, task.quantity,
    task.pending_quantity, task.posted_quantity, task.status
  FROM (VALUES
    (v_staged_item, 10, 10, 0, 'pending'),
    (v_staged_item, 4, 4, 0, 'pending'), -- same item must count only once
    (v_in_stock_item, 5, 2, 3, 'partial'), -- an item already in storage must keep its category
    (v_cancelled_item, 3, 3, 0, 'cancelled')
  ) AS task(item_id, quantity, pending_quantity, posted_quantity, status);

  INSERT INTO public.stock_transactions (
    company_id, business_unit_id, warehouse_id, transaction_date, transaction_type, reference_type, status
  )
  VALUES (
    v_scope.company_id, v_scope.business_unit_id, v_scope.warehouse_id, v_day, 'in', 'stock_adjustment', 'posted'
  ) RETURNING id INTO v_adjustment;
  INSERT INTO public.stock_transactions (
    company_id, business_unit_id, warehouse_id, transaction_date, transaction_type, reference_type, status
  )
  VALUES (
    v_scope.company_id, v_scope.business_unit_id, v_scope.warehouse_id, v_day, 'in', 'grn', 'posted'
  ) RETURNING id INTO v_grn;
  INSERT INTO public.stock_transactions (
    company_id, business_unit_id, warehouse_id, transaction_date, transaction_type, reference_type, status
  )
  VALUES (
    v_scope.company_id, v_scope.business_unit_id, v_scope.warehouse_id, v_day, 'in', 'stock_move', 'posted'
  ) RETURNING id INTO v_move;

  INSERT INTO public.stock_transaction_items (
    company_id, transaction_id, item_id, uom_id, quantity, qty_before, qty_after, posting_date, created_by, updated_by
  )
  SELECT v_scope.company_id, line.transaction_id, line.item_id, v_scope.uom_id,
    ABS(line.qty_after - line.qty_before), line.qty_before, line.qty_after,
    v_day, v_scope.user_id, v_scope.user_id
  FROM (VALUES
    (v_adjustment, v_putaway_item, 0, 10),
    (v_adjustment, v_reserved_item, 13, 10),
    (v_grn, v_in_stock_item, 0, 10),
    (v_move, v_below_reorder_item, 0, 1)
  ) AS line(transaction_id, item_id, qty_before, qty_after);

  SET LOCAL ROLE authenticated;
  v_after := public.get_warehouse_operations_overview(
    v_scope.company_id, ARRAY[v_scope.business_unit_id], 'Asia/Manila', 7,
    TRUE, TRUE, FALSE, FALSE, FALSE, FALSE
  );
  RESET ROLE;

  IF ((v_after #>> '{stockMovements,6,in}')::INT - (v_before #>> '{stockMovements,6,in}')::INT
       IS DISTINCT FROM 2)
    OR ((v_after #>> '{stockMovements,6,out}')::INT - (v_before #>> '{stockMovements,6,out}')::INT
       IS DISTINCT FROM 1) THEN
    RAISE EXCEPTION 'Expected two incoming lines (adjustment and GRN) and one outgoing adjustment line';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (VALUES ('outOfStock', 2), ('fullyReserved', 1), ('belowReorder', 1), ('inStock', 1))
      AS health(category, expected)
    WHERE (v_after -> 'stockHealth' ->> health.category)::INT
        - (v_before -> 'stockHealth' ->> health.category)::INT IS DISTINCT FROM health.expected
  ) THEN
    RAISE EXCEPTION 'Expected two additional out-of-stock items and one in each other category. Before: %, after: %',
      v_before -> 'stockHealth', v_after -> 'stockHealth';
  END IF;

  SET LOCAL ROLE authenticated;
  SELECT ARRAY(
    SELECT row.item_id
    FROM public.get_warehouse_dashboard_out_of_stocks(v_scope.company_id, ARRAY[v_test_unit]) row
  ) INTO v_shortages;
  IF v_shortages IS DISTINCT FROM ARRAY[v_staged_item, v_putaway_item] THEN
    RAISE EXCEPTION 'Stock Attention must match the two out-of-stock items in Stock Health: %', v_shortages;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.get_warehouse_dashboard_out_of_stocks(v_scope.company_id, ARRAY[gen_random_uuid()])
  ) THEN
    RAISE EXCEPTION 'Stock Attention must reject a business unit outside the user access scope';
  END IF;
  RESET ROLE;

  WITH extra_items AS (
    INSERT INTO public.items (company_id, item_code, item_name, uom_id, item_type)
    SELECT v_scope.company_id, v_prefix || '-extra-' || n, 'warehouse shortage ' || n, v_scope.uom_id, 'product'
    FROM generate_series(1, 5) n
    RETURNING id
  )
  INSERT INTO public.item_warehouse (company_id, item_id, warehouse_id)
  SELECT v_scope.company_id, extra_items.id, v_test_warehouse
  FROM extra_items;

  SET LOCAL ROLE authenticated;
  SELECT ARRAY(
    SELECT row.item_id
    FROM public.get_warehouse_dashboard_out_of_stocks(v_scope.company_id, ARRAY[v_test_unit]) row
  ) INTO v_shortages;
  IF cardinality(v_shortages) <> 5
    OR v_shortages[1:2] IS DISTINCT FROM ARRAY[v_staged_item, v_putaway_item] THEN
    RAISE EXCEPTION 'Stock Attention must return the first five ordered shortages';
  END IF;
  RESET ROLE;

  SELECT u.id INTO v_denied_user
  FROM public.users u
  WHERE u.company_id = v_scope.company_id AND u.is_active AND u.deleted_at IS NULL
    AND NOT public.user_has_permission(u.id, 'dashboard.widget.stock_value.view', 'view', v_test_unit)
  ORDER BY u.id
  LIMIT 1;
  IF v_denied_user IS NOT NULL THEN
    INSERT INTO public.user_business_unit_access (user_id, business_unit_id)
    VALUES (v_denied_user, v_test_unit);
    PERFORM set_config('request.jwt.claim.sub', v_denied_user::TEXT, TRUE);
    PERFORM set_config('request.jwt.claims', jsonb_build_object(
      'sub', v_denied_user, 'role', 'authenticated', 'company_id', v_scope.company_id,
      'current_business_unit_id', v_test_unit
    )::TEXT, TRUE);
    SET LOCAL ROLE authenticated;
    IF EXISTS (
      SELECT 1
      FROM public.get_warehouse_dashboard_out_of_stocks(v_scope.company_id, ARRAY[v_test_unit])
    ) THEN
      RAISE EXCEPTION 'Unit membership alone must not grant access to Stock Attention';
    END IF;
    RESET ROLE;
    RAISE NOTICE 'Passed: direct Stock Attention RPC denies unit members without the stock widget';
  END IF;

  RAISE NOTICE 'Passed: movement counts, stock health, unassigned putaway, and scoped Stock Attention';
END $$;

ROLLBACK;
