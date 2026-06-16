-- Migration: Create Core ERP Tables (Inventory Domain)
-- Version: 00001
-- Description: Creates companies, users, units_of_measure, item_categories, items, warehouses, and item_warehouse tables following database-design.md
-- Author: System
-- Date: 2025-11-04

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SHARED FUNCTIONS
-- ============================================================================

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLE: companies
-- ============================================================================

CREATE TABLE companies (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code              VARCHAR(20) UNIQUE NOT NULL,
    name              VARCHAR(200) NOT NULL,
    legal_name        VARCHAR(200),
    tax_id            VARCHAR(50),
    email             VARCHAR(100),
    phone             VARCHAR(50),
    address_line1     VARCHAR(200),
    address_line2     VARCHAR(200),
    city              VARCHAR(100),
    state             VARCHAR(100),
    country           VARCHAR(100),
    postal_code       VARCHAR(20),
    currency_code     VARCHAR(3) DEFAULT 'USD',
    is_active         BOOLEAN DEFAULT true,
    settings          JSONB,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_companies_code ON companies(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_active ON companies(is_active) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE companies IS 'Multi-company support for future ERP expansion';

-- ============================================================================
-- TABLE: users
-- ============================================================================
-- Note: Integrates with Supabase auth.users

CREATE TABLE users (
    id                UUID PRIMARY KEY REFERENCES auth.users(id),
    company_id        UUID NOT NULL REFERENCES companies(id),
    username          VARCHAR(50) UNIQUE NOT NULL,
    email             VARCHAR(100) UNIQUE NOT NULL,
    first_name        VARCHAR(100),
    last_name         VARCHAR(100),
    phone             VARCHAR(50),
    is_active         BOOLEAN DEFAULT true,
    last_login_at     TIMESTAMP,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_users_company ON users(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE users IS 'User accounts linked to Supabase authentication';

-- ============================================================================
-- TABLE: units_of_measure
-- ============================================================================

CREATE TABLE units_of_measure (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    code              VARCHAR(20) NOT NULL,
    name              VARCHAR(100) NOT NULL,
    symbol            VARCHAR(20),
    is_base_unit      BOOLEAN DEFAULT false,
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    UNIQUE(company_id, code)
);

CREATE INDEX idx_uom_company ON units_of_measure(company_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_uom_updated_at
    BEFORE UPDATE ON units_of_measure
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE units_of_measure IS 'Standard and custom units of measure';

-- ============================================================================
-- TABLE: item_categories
-- ============================================================================

CREATE TABLE item_categories (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    parent_id         UUID REFERENCES item_categories(id),
    code              VARCHAR(50) NOT NULL,
    name              VARCHAR(200) NOT NULL,
    description       TEXT,
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, code)
);

CREATE INDEX idx_item_categories_company ON item_categories(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_categories_parent ON item_categories(parent_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_item_categories_updated_at
    BEFORE UPDATE ON item_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE item_categories IS 'Hierarchical categorization of items';

-- ============================================================================
-- TABLE: items
-- ============================================================================

CREATE TABLE items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    item_code         VARCHAR(100) NOT NULL,
    item_name         VARCHAR(200) NOT NULL,
    item_name_cn      VARCHAR(200),  -- Chinese (Simplified) name
    description       TEXT,
    category_id       UUID REFERENCES item_categories(id),
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    item_type         VARCHAR(50) NOT NULL,  -- 'raw_material', 'finished_good', 'service', 'asset'

    -- Pricing
    purchase_price    DECIMAL(20, 4),
    sales_price       DECIMAL(20, 4),
    cost_price        DECIMAL(20, 4),

    -- Inventory control
    is_stock_item     BOOLEAN DEFAULT true,
    track_serial      BOOLEAN DEFAULT false,
    track_batch       BOOLEAN DEFAULT false,

    -- Physical attributes
    weight            DECIMAL(15, 4),
    weight_uom        VARCHAR(20),
    dimensions        JSONB,  -- {length, width, height, uom}

    -- Accounting
    default_warehouse UUID,  -- Will reference warehouses(id)

    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, item_code)
);

CREATE INDEX idx_items_company ON items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_items_category ON items(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_items_code ON items(item_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_items_name ON items(item_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_items_name_cn ON items(item_name_cn) WHERE deleted_at IS NULL;
CREATE INDEX idx_items_type ON items(item_type) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE items IS 'Central repository for all items/products';

-- ============================================================================
-- TABLE: warehouses
-- ============================================================================

CREATE TABLE warehouses (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    warehouse_code    VARCHAR(50) NOT NULL,
    warehouse_name    VARCHAR(200) NOT NULL,
    warehouse_type    VARCHAR(50),  -- 'main', 'transit', 'retail', 'virtual'
    address_line1     VARCHAR(200),
    address_line2     VARCHAR(200),
    city              VARCHAR(100),
    state             VARCHAR(100),
    country           VARCHAR(100),
    postal_code       VARCHAR(20),
    contact_person    VARCHAR(100),
    phone             VARCHAR(50),
    email             VARCHAR(100),
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, warehouse_code)
);

CREATE INDEX idx_warehouses_company ON warehouses(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_warehouses_code ON warehouses(warehouse_code) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE warehouses IS 'Physical or logical storage locations';

-- ============================================================================
-- TABLE: item_warehouse
-- ============================================================================

CREATE TABLE item_warehouse (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    item_id           UUID NOT NULL REFERENCES items(id),
    warehouse_id      UUID NOT NULL REFERENCES warehouses(id),
    reorder_level     DECIMAL(20, 4) DEFAULT 0,
    reorder_quantity  DECIMAL(20, 4) DEFAULT 0,
    max_quantity      DECIMAL(20, 4),
    current_stock     DECIMAL(20, 4) DEFAULT 0,  -- Denormalized for performance
    reserved_stock    DECIMAL(20, 4) DEFAULT 0,  -- Reserved for orders
    available_stock   DECIMAL(20, 4) GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    UNIQUE(company_id, item_id, warehouse_id)
);

CREATE INDEX idx_item_warehouse_company ON item_warehouse(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_warehouse_item ON item_warehouse(item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_warehouse_warehouse ON item_warehouse(warehouse_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_item_warehouse_updated_at
    BEFORE UPDATE ON item_warehouse
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE item_warehouse IS 'Link items to warehouses with reorder levels and stock tracking';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_warehouse ENABLE ROW LEVEL SECURITY;

-- RLS Policies (simplified for authenticated users)
-- TODO: Implement proper company_id isolation policies using security schema functions

-- Companies: authenticated users can read all companies
CREATE POLICY "Allow authenticated users to read companies"
    ON companies FOR SELECT
    TO authenticated
    USING (true);

-- Users: authenticated users can read all users
CREATE POLICY "Allow authenticated users to read users"
    ON users FOR SELECT
    TO authenticated
    USING (true);

-- Units of Measure: authenticated users can read/write
CREATE POLICY "Allow authenticated users to read units_of_measure"
    ON units_of_measure FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to write units_of_measure"
    ON units_of_measure FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Item Categories: authenticated users can read/write
CREATE POLICY "Allow authenticated users to read item_categories"
    ON item_categories FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to write item_categories"
    ON item_categories FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Items: authenticated users can read/write
CREATE POLICY "Allow authenticated users to read items"
    ON items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to write items"
    ON items FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Warehouses: authenticated users can read/write
CREATE POLICY "Allow authenticated users to read warehouses"
    ON warehouses FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to write warehouses"
    ON warehouses FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Item Warehouse: authenticated users can read/write
CREATE POLICY "Allow authenticated users to read item_warehouse"
    ON item_warehouse FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to write item_warehouse"
    ON item_warehouse FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- TABLE: stock_transactions
-- ============================================================================

CREATE TABLE stock_transactions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    transaction_code  VARCHAR(100) NOT NULL,
    transaction_date  DATE NOT NULL,
    transaction_type  VARCHAR(50) NOT NULL,  -- 'in', 'out', 'transfer', 'adjustment'
    reference_type    VARCHAR(50),  -- 'purchase', 'sales', 'adjustment', 'return'
    reference_id      UUID,  -- ID of related document (PO, SO, etc.)
    warehouse_id      UUID NOT NULL REFERENCES warehouses(id),
    to_warehouse_id   UUID REFERENCES warehouses(id),  -- For transfers
    status            VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'posted', 'cancelled'
    notes             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, transaction_code)
);

CREATE INDEX idx_stock_trans_company ON stock_transactions(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_trans_code ON stock_transactions(transaction_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_trans_date ON stock_transactions(transaction_date);
CREATE INDEX idx_stock_trans_warehouse ON stock_transactions(warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_trans_type ON stock_transactions(transaction_type);
CREATE INDEX idx_stock_trans_reference ON stock_transactions(reference_type, reference_id);

CREATE TRIGGER trigger_stock_transactions_updated_at
    BEFORE UPDATE ON stock_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE stock_transactions IS 'All stock movements (in, out, transfer, adjustment)';

-- ============================================================================
-- TABLE: stock_transaction_items
-- ============================================================================

CREATE TABLE stock_transaction_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    transaction_id    UUID NOT NULL REFERENCES stock_transactions(id),
    item_id           UUID NOT NULL REFERENCES items(id),
    quantity          DECIMAL(20, 4) NOT NULL,
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    unit_cost         DECIMAL(20, 4),
    total_cost        DECIMAL(20, 4),
    batch_no          VARCHAR(100),
    serial_no         VARCHAR(100),
    expiry_date       DATE,
    notes             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_stock_trans_items_company ON stock_transaction_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_trans_items_trans ON stock_transaction_items(transaction_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_trans_items_item ON stock_transaction_items(item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_trans_items_batch ON stock_transaction_items(batch_no) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_trans_items_serial ON stock_transaction_items(serial_no) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_stock_transaction_items_updated_at
    BEFORE UPDATE ON stock_transaction_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE stock_transaction_items IS 'Line items for stock transactions';

-- ============================================================================
-- TABLE: stock_ledger
-- ============================================================================

CREATE TABLE stock_ledger (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    item_id           UUID NOT NULL REFERENCES items(id),
    warehouse_id      UUID NOT NULL REFERENCES warehouses(id),
    transaction_id    UUID NOT NULL REFERENCES stock_transactions(id),
    transaction_item_id UUID NOT NULL REFERENCES stock_transaction_items(id),
    posting_date      DATE NOT NULL,
    posting_time      TIME NOT NULL,
    voucher_type      VARCHAR(50) NOT NULL,
    voucher_no        VARCHAR(100) NOT NULL,
    actual_qty        DECIMAL(20, 4) NOT NULL,  -- +ve for in, -ve for out
    qty_after_trans   DECIMAL(20, 4) NOT NULL,  -- Running balance
    incoming_rate     DECIMAL(20, 4),
    valuation_rate    DECIMAL(20, 4),
    stock_value       DECIMAL(20, 4),
    stock_value_diff  DECIMAL(20, 4),
    batch_no          VARCHAR(100),
    serial_no         VARCHAR(100),
    is_cancelled      BOOLEAN DEFAULT false,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_ledger_company ON stock_ledger(company_id);
CREATE INDEX idx_stock_ledger_item_warehouse ON stock_ledger(item_id, warehouse_id);
CREATE INDEX idx_stock_ledger_posting_date ON stock_ledger(posting_date);
CREATE INDEX idx_stock_ledger_voucher ON stock_ledger(voucher_type, voucher_no);
CREATE INDEX idx_stock_ledger_batch ON stock_ledger(batch_no) WHERE batch_no IS NOT NULL;
CREATE INDEX idx_stock_ledger_serial ON stock_ledger(serial_no) WHERE serial_no IS NOT NULL;

COMMENT ON TABLE stock_ledger IS 'Immutable ledger for all stock movements (event sourcing pattern)';

-- Enable RLS on stock tables
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_transactions
CREATE POLICY "Allow authenticated users to read stock_transactions"
    ON stock_transactions FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to write stock_transactions"
    ON stock_transactions FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- RLS Policies for stock_transaction_items
CREATE POLICY "Allow authenticated users to read stock_transaction_items"
    ON stock_transaction_items FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to write stock_transaction_items"
    ON stock_transaction_items FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- RLS Policies for stock_ledger
CREATE POLICY "Allow authenticated users to read stock_ledger"
    ON stock_ledger FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to write stock_ledger"
    ON stock_ledger FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
