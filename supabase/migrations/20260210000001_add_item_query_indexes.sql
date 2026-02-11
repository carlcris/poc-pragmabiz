-- Migration: Add indexes to speed up items-enhanced queries

-- Enable trigram extension for fast ILIKE searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Items lookups (company + active)
CREATE INDEX IF NOT EXISTS idx_items_company_active
ON items (company_id)
WHERE deleted_at IS NULL;

-- Items filters
CREATE INDEX IF NOT EXISTS idx_items_company_category
ON items (company_id, category_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_items_company_item_type
ON items (company_id, item_type)
WHERE deleted_at IS NULL;

-- Items search (ILIKE)
CREATE INDEX IF NOT EXISTS idx_items_code_trgm
ON items
USING gin (item_code gin_trgm_ops)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_items_name_trgm
ON items
USING gin (item_name gin_trgm_ops)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_items_name_cn_trgm
ON items
USING gin (item_name_cn gin_trgm_ops)
WHERE deleted_at IS NULL;

-- Item warehouse lookups
CREATE INDEX IF NOT EXISTS idx_item_warehouse_company_item
ON item_warehouse (company_id, item_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_warehouse_company_warehouse_item
ON item_warehouse (company_id, warehouse_id, item_id)
WHERE deleted_at IS NULL;

-- Sales order items lookups
CREATE INDEX IF NOT EXISTS idx_sales_order_items_item
ON sales_order_items (item_id);

CREATE INDEX IF NOT EXISTS idx_sales_orders_company_status_bu
ON sales_orders (company_id, status, business_unit_id)
WHERE deleted_at IS NULL;

-- Purchase order items lookups
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_item
ON purchase_order_items (item_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_company_status_bu
ON purchase_orders (company_id, status, business_unit_id)
WHERE deleted_at IS NULL;
