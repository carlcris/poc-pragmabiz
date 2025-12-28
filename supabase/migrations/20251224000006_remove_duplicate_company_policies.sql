-- Remove duplicate company-based RLS policies that cause data leaks
-- The BU policies (bu_select_policy, etc.) should be the only active policies

-- Sales Quotations
DROP POLICY IF EXISTS sales_quotations_select ON sales_quotations;
DROP POLICY IF EXISTS sales_quotations_insert ON sales_quotations;
DROP POLICY IF EXISTS sales_quotations_update ON sales_quotations;
DROP POLICY IF EXISTS sales_quotations_delete ON sales_quotations;

-- Sales Orders
DROP POLICY IF EXISTS sales_orders_select ON sales_orders;
DROP POLICY IF EXISTS sales_orders_insert ON sales_orders;
DROP POLICY IF EXISTS sales_orders_update ON sales_orders;
DROP POLICY IF EXISTS sales_orders_delete ON sales_orders;

-- Sales Invoices
DROP POLICY IF EXISTS sales_invoices_select ON sales_invoices;
DROP POLICY IF EXISTS sales_invoices_insert ON sales_invoices;
DROP POLICY IF EXISTS sales_invoices_update ON sales_invoices;
DROP POLICY IF EXISTS sales_invoices_delete ON sales_invoices;
DROP POLICY IF EXISTS sales_invoices_select_policy ON sales_invoices;
DROP POLICY IF EXISTS sales_invoices_insert_policy ON sales_invoices;
DROP POLICY IF EXISTS sales_invoices_update_policy ON sales_invoices;
DROP POLICY IF EXISTS sales_invoices_delete_policy ON sales_invoices;

-- Customers
DROP POLICY IF EXISTS customers_select ON customers;
DROP POLICY IF EXISTS customers_insert ON customers;
DROP POLICY IF EXISTS customers_update ON customers;
DROP POLICY IF EXISTS customers_delete ON customers;

-- Suppliers
DROP POLICY IF EXISTS suppliers_select ON suppliers;
DROP POLICY IF EXISTS suppliers_insert ON suppliers;
DROP POLICY IF EXISTS suppliers_update ON suppliers;
DROP POLICY IF EXISTS suppliers_delete ON suppliers;

-- Warehouses
DROP POLICY IF EXISTS warehouses_select ON warehouses;
DROP POLICY IF EXISTS warehouses_insert ON warehouses;
DROP POLICY IF EXISTS warehouses_update ON warehouses;
DROP POLICY IF EXISTS warehouses_delete ON warehouses;

COMMENT ON TABLE sales_quotations IS 'Sales quotations table - RLS enforced by business unit policies only';
