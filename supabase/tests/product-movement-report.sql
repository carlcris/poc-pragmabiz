-- Seeded local Supabase. Fixtures roll back and report calls run with RLS.
BEGIN;

CREATE TEMP TABLE product_movement_context ON COMMIT DROP AS
SELECT u.id AS user_id, u.company_id, access.business_unit_id, w.id AS warehouse_id,
  customer.id AS customer_id, unit.id AS unit_id, 'MOVEMENT-' || gen_random_uuid()::TEXT AS prefix,
  gen_random_uuid() AS selected_item_id, gen_random_uuid() AS other_item_id,
  gen_random_uuid() AS unsold_item_id, gen_random_uuid() AS invoice_id,
  gen_random_uuid() AS pos_id, DATE '2000-01-15' AS sale_date
FROM public.users u
JOIN public.user_business_unit_access access ON access.user_id = u.id
JOIN public.warehouses w ON w.company_id = u.company_id
  AND w.business_unit_id = access.business_unit_id AND w.deleted_at IS NULL
JOIN public.customers customer ON customer.company_id = u.company_id AND customer.deleted_at IS NULL
JOIN public.units_of_measure unit ON unit.company_id = u.company_id AND unit.deleted_at IS NULL
WHERE u.is_active AND u.deleted_at IS NULL
LIMIT 1;

DO $$
DECLARE c RECORD;
BEGIN
  SELECT user_id, company_id, business_unit_id, warehouse_id, customer_id, unit_id, prefix,
    selected_item_id, other_item_id, unsold_item_id, invoice_id, pos_id, sale_date
  INTO STRICT c
  FROM product_movement_context;

  INSERT INTO public.items (
    id, company_id, item_code, item_name, uom_id, item_type, purchase_price, is_active, is_stock_item
  ) VALUES
    (c.selected_item_id, c.company_id, c.prefix || '-A', c.prefix, c.unit_id, 'finished_good', 3, TRUE, TRUE),
    (c.other_item_id, c.company_id, c.prefix || '-B', c.prefix, c.unit_id, 'finished_good', 2, TRUE, TRUE),
    (c.unsold_item_id, c.company_id, c.prefix || '-C', c.prefix, c.unit_id, 'finished_good', 4, TRUE, TRUE);

  INSERT INTO public.item_warehouse (
    company_id, item_id, warehouse_id, current_stock, reserved_stock
  ) VALUES
    (c.company_id, c.selected_item_id, c.warehouse_id, 7, 1),
    (c.company_id, c.other_item_id, c.warehouse_id, 8, 0),
    (c.company_id, c.unsold_item_id, c.warehouse_id, 4, 0);

  INSERT INTO public.sales_invoices (
    id, company_id, business_unit_id, customer_id, invoice_date, due_date, status,
    subtotal, total_amount, amount_due
  ) VALUES (c.invoice_id, c.company_id, c.business_unit_id, c.customer_id,
    c.sale_date, c.sale_date, 'sent', 60, 60, 60);

  INSERT INTO public.sales_invoice_items (company_id, invoice_id, item_id, quantity, rate, line_total)
  VALUES
    (c.company_id, c.invoice_id, c.selected_item_id, 2, 10, 20),
    (c.company_id, c.invoice_id, c.other_item_id, 4, 10, 40);

  INSERT INTO public.pos_transactions (
    id, company_id, business_unit_id, transaction_date, status, subtotal, total_amount,
    amount_paid, cashier_id, cashier_name
  ) VALUES (c.pos_id, c.company_id, c.business_unit_id, c.sale_date::TIMESTAMP AT TIME ZONE 'UTC',
    'completed', 80, 80, 80, c.user_id, 'Product movement test');

  INSERT INTO public.pos_transaction_items (
    pos_transaction_id, item_id, item_code, item_name, quantity, unit_price, line_total
  ) VALUES
    (c.pos_id, c.selected_item_id, c.prefix || '-A', c.prefix, 3, 10, 30),
    (c.pos_id, c.other_item_id, c.prefix || '-B', c.prefix, 5, 10, 50);
END $$;

GRANT SELECT ON product_movement_context TO authenticated;
SELECT set_config('request.jwt.claims', jsonb_build_object(
  'sub', user_id, 'role', 'authenticated', 'current_business_unit_id', business_unit_id
)::TEXT, TRUE) FROM product_movement_context;
SET LOCAL ROLE authenticated;

DO $$
DECLARE c RECORD; report RECORD; ranked_ids UUID[];
BEGIN
  SELECT company_id, business_unit_id, prefix, selected_item_id, other_item_id,
    unsold_item_id, sale_date
  INTO STRICT c
  FROM product_movement_context;

  SELECT array_agg(r.item_id ORDER BY r.movement_rank)
  INTO ranked_ids
  FROM public.get_product_movement_report(
    c.company_id, c.business_unit_id, 'fast', c.sale_date, c.sale_date, p_search => c.prefix
  ) r;
  IF ranked_ids IS DISTINCT FROM ARRAY[c.other_item_id, c.selected_item_id] THEN
    RAISE EXCEPTION 'Unfiltered fast report must rank only sold products by quantity: %', ranked_ids;
  END IF;

  SELECT array_agg(r.item_id ORDER BY r.movement_rank)
  INTO ranked_ids
  FROM public.get_product_movement_report(
    c.company_id, c.business_unit_id, 'slow', c.sale_date, c.sale_date, p_search => c.prefix
  ) r;
  IF ranked_ids IS DISTINCT FROM ARRAY[c.unsold_item_id, c.selected_item_id, c.other_item_id] THEN
    RAISE EXCEPTION 'Unfiltered slow report must put unsold stocked products first: %', ranked_ids;
  END IF;

  SELECT r.item_id, r.quantity_sold, r.revenue, r.transaction_count, r.current_stock,
    r.available_stock, r.unit_cost, r.stock_value, r.movement_rank, r.total_count,
    r.summary_total_quantity_sold, r.summary_total_revenue, r.summary_total_stock_value
  INTO STRICT report
  FROM public.get_product_movement_report(
    c.company_id, c.business_unit_id, 'fast', c.sale_date, c.sale_date, p_item_id => c.selected_item_id
  ) r;
  IF report.item_id <> c.selected_item_id OR report.quantity_sold <> 5 OR report.revenue <> 50
    OR report.transaction_count <> 2 OR report.current_stock <> 7 OR report.available_stock <> 6
    OR report.unit_cost <> 3 OR report.stock_value <> 21 OR report.movement_rank <> 1
    OR report.total_count <> 1 OR report.summary_total_quantity_sold <> 5
    OR report.summary_total_revenue <> 50 OR report.summary_total_stock_value <> 21
  THEN RAISE EXCEPTION 'Selected fast product must aggregate only its own sales and stock: %', report;
  END IF;

  SELECT r.item_id, r.quantity_sold, r.current_stock, r.movement_rank, r.total_count,
    r.summary_zero_sales_count, r.summary_total_stock_value
  INTO STRICT report
  FROM public.get_product_movement_report(
    c.company_id, c.business_unit_id, 'slow', c.sale_date, c.sale_date, p_item_id => c.unsold_item_id
  ) r;
  IF report.item_id <> c.unsold_item_id OR report.quantity_sold <> 0 OR report.current_stock <> 4
    OR report.movement_rank <> 1 OR report.total_count <> 1 OR report.summary_zero_sales_count <> 1
    OR report.summary_total_stock_value <> 16
  THEN RAISE EXCEPTION 'Selected slow product must keep its own unsold stock and totals: %', report;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.get_product_movement_report(
      c.company_id, c.business_unit_id, 'fast', c.sale_date, c.sale_date, p_item_id => c.unsold_item_id
    )
  ) OR EXISTS (
    SELECT 1 FROM public.get_product_movement_report(
      c.company_id, c.business_unit_id, 'slow', c.sale_date, c.sale_date, p_item_id => gen_random_uuid()
    )
  ) OR EXISTS (
    SELECT 1 FROM public.get_product_movement_report(
      c.company_id, gen_random_uuid(), 'fast', c.sale_date, c.sale_date, p_item_id => c.selected_item_id
    )
  ) OR EXISTS (
    SELECT 1 FROM public.get_product_movement_report(
      gen_random_uuid(), c.business_unit_id, 'slow', c.sale_date, c.sale_date, p_item_id => c.unsold_item_id
    )
  ) THEN RAISE EXCEPTION 'Selected item must respect movement eligibility and company/BU scope';
  END IF;
  RAISE NOTICE 'Passed: exact Product Movement item, invoice/POS and stock aggregation, ranking, totals, company and BU scope';
END $$;

ROLLBACK;
