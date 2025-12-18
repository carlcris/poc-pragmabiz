-- Add warehouse_id column to sales_invoices table
ALTER TABLE sales_invoices
ADD COLUMN warehouse_id UUID REFERENCES warehouses(id);

-- Create index for warehouse_id
CREATE INDEX idx_invoices_warehouse ON sales_invoices(warehouse_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN sales_invoices.warehouse_id IS 'Warehouse from which the invoice items are fulfilled';
