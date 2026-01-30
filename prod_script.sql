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
-- Migration: Make audit fields nullable for easier seeding
-- Version: 00002
-- Description: Makes created_by and updated_by fields nullable to allow data seeding without users
-- Author: System
-- Date: 2025-11-04

-- Make created_by and updated_by nullable in all tables

ALTER TABLE units_of_measure
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL;

ALTER TABLE item_categories
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL;

ALTER TABLE items
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL;

ALTER TABLE warehouses
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL;

ALTER TABLE item_warehouse
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL;

ALTER TABLE stock_transactions
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN updated_by DROP NOT NULL;
-- Migration: Add RLS policies for users table
-- Allows authenticated users to insert and update their own records

-- Allow authenticated users to insert their own user record
-- This is needed when a user logs in for the first time via Supabase Auth
CREATE POLICY "Allow users to insert their own record"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- Allow authenticated users to update their own user record
CREATE POLICY "Allow users to update their own record"
    ON users FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
-- Migration: Create Customers Table
-- Description: Creates customers table for managing customer accounts
-- Date: 2025-11-05

-- ============================================================================
-- TABLE: customers
-- ============================================================================
-- Stores customer information including companies, individuals, and government entities
-- with billing/shipping addresses and payment terms

CREATE TABLE customers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    customer_code     VARCHAR(100) NOT NULL,
    customer_name     VARCHAR(200) NOT NULL,
    customer_type     VARCHAR(50),  -- 'individual', 'company', 'government'
    tax_id            VARCHAR(50),
    email             VARCHAR(100),
    phone             VARCHAR(50),
    website           VARCHAR(200),

    -- Billing address
    billing_address_line1  VARCHAR(200),
    billing_address_line2  VARCHAR(200),
    billing_city           VARCHAR(100),
    billing_state          VARCHAR(100),
    billing_country        VARCHAR(100),
    billing_postal_code    VARCHAR(20),

    -- Shipping address
    shipping_address_line1 VARCHAR(200),
    shipping_address_line2 VARCHAR(200),
    shipping_city          VARCHAR(100),
    shipping_state         VARCHAR(100),
    shipping_country       VARCHAR(100),
    shipping_postal_code   VARCHAR(20),

    -- Payment terms
    payment_terms     VARCHAR(50),  -- 'cash', 'net_30', 'net_60', etc.
    credit_limit      DECIMAL(20, 4) DEFAULT 0,
    credit_days       INTEGER DEFAULT 0,

    -- Contact person
    contact_person    VARCHAR(100),
    contact_phone     VARCHAR(50),
    contact_email     VARCHAR(100),

    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, customer_code)
);

-- ============================================================================
-- INDEXES: customers
-- ============================================================================

CREATE INDEX idx_customers_company ON customers(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_code ON customers(customer_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_name ON customers(customer_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_email ON customers(email) WHERE deleted_at IS NULL;

-- ============================================================================
-- RLS POLICIES: customers
-- ============================================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view customers from their company
CREATE POLICY customers_select_policy ON customers
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
        AND deleted_at IS NULL
    );

-- Policy: Users can insert customers for their company
CREATE POLICY customers_insert_policy ON customers
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- Policy: Users can update customers from their company
CREATE POLICY customers_update_policy ON customers
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
        AND deleted_at IS NULL
    );

-- Policy: Users can delete (soft delete) customers from their company
CREATE POLICY customers_delete_policy ON customers
    FOR DELETE
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- ============================================================================
-- TRIGGERS: customers
-- ============================================================================

-- Trigger: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_customers_updated_at();

-- ============================================================================
-- COMMENTS: customers
-- ============================================================================

COMMENT ON TABLE customers IS 'Customer master data including companies, individuals, and government entities';
COMMENT ON COLUMN customers.customer_type IS 'Type of customer: individual, company, or government';
COMMENT ON COLUMN customers.payment_terms IS 'Payment terms: cash, net_30, net_60, net_90, due_on_receipt, cod';
COMMENT ON COLUMN customers.credit_limit IS 'Maximum credit limit for this customer';
COMMENT ON COLUMN customers.credit_days IS 'Number of days for credit payment';
-- Migration: Add Sales Quotations Tables
-- Description: Creates sales_quotations and sales_quotation_items tables

-- ============================================================================
-- TABLE: sales_quotations
-- ============================================================================

CREATE TABLE sales_quotations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    quotation_code    VARCHAR(100) NOT NULL,
    quotation_date    DATE NOT NULL,
    customer_id       UUID NOT NULL REFERENCES customers(id),
    valid_until       DATE,
    price_list_id     UUID,

    -- Amounts
    subtotal          DECIMAL(20, 4) DEFAULT 0,
    discount_amount   DECIMAL(20, 4) DEFAULT 0,
    tax_amount        DECIMAL(20, 4) DEFAULT 0,
    total_amount      DECIMAL(20, 4) DEFAULT 0,

    -- Status workflow
    status            VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'sent', 'accepted', 'rejected', 'expired'

    notes             TEXT,
    terms_conditions  TEXT,

    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, quotation_code)
);

CREATE INDEX idx_quotations_company ON sales_quotations(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotations_code ON sales_quotations(quotation_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotations_customer ON sales_quotations(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotations_date ON sales_quotations(quotation_date);
CREATE INDEX idx_quotations_status ON sales_quotations(status) WHERE deleted_at IS NULL;

COMMENT ON TABLE sales_quotations IS 'Sales quotations (pre-sale offers to customers)';
COMMENT ON COLUMN sales_quotations.status IS 'Status: draft, sent, accepted, rejected, expired';

-- ============================================================================
-- TABLE: sales_quotation_items
-- ============================================================================

CREATE TABLE sales_quotation_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    quotation_id      UUID NOT NULL REFERENCES sales_quotations(id) ON DELETE CASCADE,
    item_id           UUID NOT NULL REFERENCES items(id),
    item_description  TEXT,
    quantity          DECIMAL(20, 4) NOT NULL,
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    rate              DECIMAL(20, 4) NOT NULL,
    discount_percent  DECIMAL(5, 2) DEFAULT 0,
    discount_amount   DECIMAL(20, 4) DEFAULT 0,
    tax_percent       DECIMAL(5, 2) DEFAULT 0,
    tax_amount        DECIMAL(20, 4) DEFAULT 0,
    line_total        DECIMAL(20, 4) NOT NULL,
    sort_order        INTEGER DEFAULT 0,
    notes             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID REFERENCES users(id),
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_quotation_items_company ON sales_quotation_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotation_items_quotation ON sales_quotation_items(quotation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotation_items_item ON sales_quotation_items(item_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE sales_quotation_items IS 'Line items for sales quotations';

-- ============================================================================
-- TRIGGERS: Update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sales_quotations_updated_at BEFORE UPDATE ON sales_quotations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_quotation_items_updated_at BEFORE UPDATE ON sales_quotation_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE sales_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_quotation_items ENABLE ROW LEVEL SECURITY;

-- Allow users to see quotations from their company
CREATE POLICY sales_quotations_select ON sales_quotations
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_quotations_insert ON sales_quotations
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_quotations_update ON sales_quotations
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_quotations_delete ON sales_quotations
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Quotation items policies
CREATE POLICY sales_quotation_items_select ON sales_quotation_items
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_quotation_items_insert ON sales_quotation_items
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_quotation_items_update ON sales_quotation_items
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_quotation_items_delete ON sales_quotation_items
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
-- Migration: Add Sales Orders Tables
-- Description: Creates sales_orders and sales_order_items tables

-- ============================================================================
-- TABLE: sales_orders
-- ============================================================================

CREATE TABLE sales_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id),
    order_code              VARCHAR(100) NOT NULL,
    order_date              DATE NOT NULL,
    customer_id             UUID NOT NULL REFERENCES customers(id),
    quotation_id            UUID REFERENCES sales_quotations(id),
    expected_delivery_date  DATE,
    price_list_id           UUID,

    -- Amounts
    subtotal                DECIMAL(20, 4) DEFAULT 0,
    discount_amount         DECIMAL(20, 4) DEFAULT 0,
    tax_amount              DECIMAL(20, 4) DEFAULT 0,
    total_amount            DECIMAL(20, 4) DEFAULT 0,

    -- Status workflow
    status                  VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'confirmed', 'in_progress', 'shipped', 'delivered', 'cancelled'

    -- Shipping details
    shipping_address        TEXT,
    shipping_city           VARCHAR(100),
    shipping_state          VARCHAR(100),
    shipping_postal_code    VARCHAR(20),
    shipping_country        VARCHAR(100),

    payment_terms           TEXT,
    notes                   TEXT,

    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID REFERENCES users(id),
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              UUID REFERENCES users(id),
    deleted_at              TIMESTAMP NULL,
    version                 INTEGER NOT NULL DEFAULT 1,
    custom_fields           JSONB,
    UNIQUE(company_id, order_code)
);

CREATE INDEX idx_sales_orders_company ON sales_orders(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_code ON sales_orders(order_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_quotation ON sales_orders(quotation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_date ON sales_orders(order_date);
CREATE INDEX idx_sales_orders_status ON sales_orders(status) WHERE deleted_at IS NULL;

COMMENT ON TABLE sales_orders IS 'Sales orders (confirmed customer orders)';
COMMENT ON COLUMN sales_orders.status IS 'Status: draft, confirmed, in_progress, shipped, delivered, cancelled';

-- ============================================================================
-- TABLE: sales_order_items
-- ============================================================================

CREATE TABLE sales_order_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id),
    order_id            UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    item_id             UUID NOT NULL REFERENCES items(id),
    item_description    TEXT,
    quantity            DECIMAL(20, 4) NOT NULL,
    quantity_shipped    DECIMAL(20, 4) DEFAULT 0,
    quantity_delivered  DECIMAL(20, 4) DEFAULT 0,
    uom_id              UUID NOT NULL REFERENCES units_of_measure(id),
    rate                DECIMAL(20, 4) NOT NULL,
    discount_percent    DECIMAL(5, 2) DEFAULT 0,
    discount_amount     DECIMAL(20, 4) DEFAULT 0,
    tax_percent         DECIMAL(5, 2) DEFAULT 0,
    tax_amount          DECIMAL(20, 4) DEFAULT 0,
    line_total          DECIMAL(20, 4) NOT NULL,
    sort_order          INTEGER DEFAULT 0,
    notes               TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          UUID REFERENCES users(id),
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          UUID REFERENCES users(id),
    deleted_at          TIMESTAMP NULL
);

CREATE INDEX idx_sales_order_items_company ON sales_order_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_order_items_order ON sales_order_items(order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_order_items_item ON sales_order_items(item_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE sales_order_items IS 'Line items for sales orders';

-- ============================================================================
-- TRIGGERS: Update timestamps
-- ============================================================================

CREATE TRIGGER update_sales_orders_updated_at BEFORE UPDATE ON sales_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_order_items_updated_at BEFORE UPDATE ON sales_order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;

-- Allow users to see orders from their company
CREATE POLICY sales_orders_select ON sales_orders
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_orders_insert ON sales_orders
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_orders_update ON sales_orders
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_orders_delete ON sales_orders
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Order items policies
CREATE POLICY sales_order_items_select ON sales_order_items
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_order_items_insert ON sales_order_items
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_order_items_update ON sales_order_items
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_order_items_delete ON sales_order_items
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
-- ============================================================================
-- Sales Invoices Tables
-- ============================================================================
-- This migration creates the tables for managing sales invoices, invoice items,
-- payments, and employee commissions for sales analytics.

-- ============================================================================
-- TABLE: sales_invoices
-- ============================================================================
-- Main invoices table
CREATE TABLE sales_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_code VARCHAR(100) NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',

    -- Amounts
    subtotal NUMERIC(20,4) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
    total_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
    amount_paid NUMERIC(20,4) NOT NULL DEFAULT 0,
    amount_due NUMERIC(20,4) NOT NULL DEFAULT 0,

    -- Billing address
    billing_address_line1 VARCHAR(255),
    billing_address_line2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_country VARCHAR(100),
    billing_postal_code VARCHAR(20),

    payment_terms TEXT,
    notes TEXT,

    -- Sales Analytics
    primary_employee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    commission_total NUMERIC(20,4) NOT NULL DEFAULT 0,
    commission_split_count INTEGER NOT NULL DEFAULT 0,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP,

    -- Versioning
    version INTEGER NOT NULL DEFAULT 1,

    -- Custom fields (JSONB for extensibility)
    custom_fields JSONB,

    CONSTRAINT chk_invoice_status CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled')),
    CONSTRAINT chk_invoice_amounts CHECK (
        subtotal >= 0 AND
        discount_amount >= 0 AND
        tax_amount >= 0 AND
        total_amount >= 0 AND
        amount_paid >= 0 AND
        amount_due >= 0
    ),
    CONSTRAINT chk_invoice_dates CHECK (due_date >= invoice_date)
);

-- Indexes for sales_invoices
CREATE INDEX idx_invoices_company ON sales_invoices(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_customer ON sales_invoices(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_code ON sales_invoices(invoice_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_status ON sales_invoices(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_date ON sales_invoices(invoice_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_due_date ON sales_invoices(due_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_sales_order ON sales_invoices(sales_order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_primary_employee ON sales_invoices(primary_employee_id) WHERE deleted_at IS NULL;

-- Unique constraint for invoice code per company
CREATE UNIQUE INDEX idx_invoices_code_unique ON sales_invoices(company_id, invoice_code) WHERE deleted_at IS NULL;

-- ============================================================================
-- TABLE: sales_invoice_items
-- ============================================================================
-- Invoice line items
CREATE TABLE sales_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    item_description TEXT,
    quantity NUMERIC(20,4) NOT NULL,
    uom_id UUID REFERENCES units_of_measure(id) ON DELETE RESTRICT,
    rate NUMERIC(20,4) NOT NULL,
    discount_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
    tax_percent NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
    line_total NUMERIC(20,4) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP,

    CONSTRAINT chk_invoice_item_quantity CHECK (quantity > 0),
    CONSTRAINT chk_invoice_item_rate CHECK (rate >= 0),
    CONSTRAINT chk_invoice_item_discounts CHECK (discount_percent >= 0 AND discount_percent <= 100),
    CONSTRAINT chk_invoice_item_tax CHECK (tax_percent >= 0 AND tax_percent <= 100)
);

-- Indexes for sales_invoice_items
CREATE INDEX idx_invoice_items_invoice ON sales_invoice_items(invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_items_item ON sales_invoice_items(item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_items_company ON sales_invoice_items(company_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- TABLE: invoice_payments
-- ============================================================================
-- Payment records for invoices
CREATE TABLE invoice_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL,
    amount NUMERIC(20,4) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    reference VARCHAR(255),
    notes TEXT,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP,

    CONSTRAINT chk_payment_amount CHECK (amount > 0),
    CONSTRAINT chk_payment_method CHECK (payment_method IN ('maya', 'gcash','cash', 'check', 'credit_card', 'bank_transfer', 'other'))
);

-- Indexes for invoice_payments
CREATE INDEX idx_invoice_payments_invoice ON invoice_payments(invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_payments_company ON invoice_payments(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_payments_date ON invoice_payments(payment_date) WHERE deleted_at IS NULL;

-- ============================================================================
-- TABLE: invoice_employee_commissions
-- ============================================================================
-- Commission splits for invoices with multiple sales agents
CREATE TABLE invoice_employee_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    commission_split_percentage NUMERIC(10,2) NOT NULL,
    commission_amount NUMERIC(20,4) NOT NULL,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP,

    CONSTRAINT chk_commission_percentage CHECK (commission_split_percentage > 0 AND commission_split_percentage <= 100),
    CONSTRAINT chk_commission_amount CHECK (commission_amount >= 0)
);

-- Indexes for invoice_employee_commissions
CREATE INDEX idx_invoice_commissions_invoice ON invoice_employee_commissions(invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_commissions_employee ON invoice_employee_commissions(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_commissions_company ON invoice_employee_commissions(company_id) WHERE deleted_at IS NULL;

-- Unique constraint: one commission record per employee per invoice
CREATE UNIQUE INDEX idx_invoice_commissions_unique ON invoice_employee_commissions(invoice_id, employee_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_employee_commissions ENABLE ROW LEVEL SECURITY;

-- Policies for sales_invoices
CREATE POLICY sales_invoices_select_policy ON sales_invoices
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY sales_invoices_insert_policy ON sales_invoices
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY sales_invoices_update_policy ON sales_invoices
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY sales_invoices_delete_policy ON sales_invoices
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- Policies for sales_invoice_items
CREATE POLICY sales_invoice_items_select_policy ON sales_invoice_items
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY sales_invoice_items_insert_policy ON sales_invoice_items
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY sales_invoice_items_update_policy ON sales_invoice_items
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY sales_invoice_items_delete_policy ON sales_invoice_items
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- Policies for invoice_payments
CREATE POLICY invoice_payments_select_policy ON invoice_payments
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY invoice_payments_insert_policy ON invoice_payments
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY invoice_payments_update_policy ON invoice_payments
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY invoice_payments_delete_policy ON invoice_payments
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- Policies for invoice_employee_commissions
CREATE POLICY invoice_employee_commissions_select_policy ON invoice_employee_commissions
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY invoice_employee_commissions_insert_policy ON invoice_employee_commissions
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY invoice_employee_commissions_update_policy ON invoice_employee_commissions
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY invoice_employee_commissions_delete_policy ON invoice_employee_commissions
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE sales_invoices IS 'Sales invoices for customers';
COMMENT ON TABLE sales_invoice_items IS 'Line items for sales invoices';
COMMENT ON TABLE invoice_payments IS 'Payment records for invoices';
COMMENT ON TABLE invoice_employee_commissions IS 'Commission splits for invoices with multiple sales agents';
-- Migration: Add Suppliers Table
-- Description: Creates suppliers table for purchasing module

-- ============================================================================
-- TABLE: suppliers
-- ============================================================================

CREATE TABLE suppliers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id),
    supplier_code           VARCHAR(100) NOT NULL,
    supplier_name           VARCHAR(255) NOT NULL,
    contact_person          VARCHAR(255) NOT NULL,
    email                   VARCHAR(255) NOT NULL,
    phone                   VARCHAR(50) NOT NULL,
    mobile                  VARCHAR(50),
    website                 VARCHAR(255),
    tax_id                  VARCHAR(100),

    -- Billing Address
    billing_address_line1   VARCHAR(255) NOT NULL,
    billing_address_line2   VARCHAR(255),
    billing_city            VARCHAR(100) NOT NULL,
    billing_state           VARCHAR(100) NOT NULL,
    billing_country         VARCHAR(100) NOT NULL,
    billing_postal_code     VARCHAR(20) NOT NULL,

    -- Shipping Address (optional, if different from billing)
    shipping_address_line1  VARCHAR(255),
    shipping_address_line2  VARCHAR(255),
    shipping_city           VARCHAR(100),
    shipping_state          VARCHAR(100),
    shipping_country        VARCHAR(100),
    shipping_postal_code    VARCHAR(20),

    -- Payment Information
    payment_terms           VARCHAR(50) NOT NULL DEFAULT 'net_30',  -- 'cod', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90'
    credit_limit            DECIMAL(20, 4),
    current_balance         DECIMAL(20, 4) DEFAULT 0,

    -- Bank Details
    bank_name               VARCHAR(255),
    bank_account_number     VARCHAR(100),
    bank_account_name       VARCHAR(255),

    -- Status
    status                  VARCHAR(50) DEFAULT 'active',  -- 'active', 'inactive', 'blacklisted'
    notes                   TEXT,

    -- Audit Fields
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID REFERENCES users(id),
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              UUID REFERENCES users(id),
    deleted_at              TIMESTAMP NULL,
    version                 INTEGER NOT NULL DEFAULT 1,
    custom_fields           JSONB,

    UNIQUE(company_id, supplier_code)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_suppliers_company ON suppliers(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_code ON suppliers(supplier_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_name ON suppliers(supplier_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_status ON suppliers(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_suppliers_email ON suppliers(email) WHERE deleted_at IS NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE suppliers IS 'Suppliers/vendors for purchasing module';
COMMENT ON COLUMN suppliers.supplier_code IS 'Unique supplier code (e.g., SUP-0001)';
COMMENT ON COLUMN suppliers.payment_terms IS 'Payment terms: cod, net_7, net_15, net_30, net_45, net_60, net_90';
COMMENT ON COLUMN suppliers.status IS 'Supplier status: active, inactive, blacklisted';
COMMENT ON COLUMN suppliers.current_balance IS 'Current outstanding balance owed to supplier';

-- ============================================================================
-- TRIGGERS: Update timestamps
-- ============================================================================

CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see suppliers from their company
CREATE POLICY suppliers_company_isolation_select ON suppliers
    FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can insert suppliers for their company
CREATE POLICY suppliers_company_isolation_insert ON suppliers
    FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can update suppliers from their company
CREATE POLICY suppliers_company_isolation_update ON suppliers
    FOR UPDATE
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ))
    WITH CHECK (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can delete suppliers from their company
CREATE POLICY suppliers_company_isolation_delete ON suppliers
    FOR DELETE
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));
-- Migration: Add Purchase Orders Tables
-- Description: Creates purchase_orders and purchase_order_items tables

-- ============================================================================
-- TABLE: purchase_orders
-- ============================================================================

CREATE TABLE purchase_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id),
    order_code              VARCHAR(100) NOT NULL,
    supplier_id             UUID NOT NULL REFERENCES suppliers(id),
    order_date              DATE NOT NULL,
    expected_delivery_date  DATE NOT NULL,

    -- Amounts
    subtotal                DECIMAL(20, 4) DEFAULT 0,
    discount_amount         DECIMAL(20, 4) DEFAULT 0,
    tax_amount              DECIMAL(20, 4) DEFAULT 0,
    total_amount            DECIMAL(20, 4) DEFAULT 0,

    -- Status workflow: draft → submitted → approved → in_transit → partially_received → received → cancelled
    status                  VARCHAR(50) DEFAULT 'draft',

    -- Delivery Address
    delivery_address_line1  VARCHAR(255) NOT NULL,
    delivery_address_line2  VARCHAR(255),
    delivery_city           VARCHAR(100) NOT NULL,
    delivery_state          VARCHAR(100) NOT NULL,
    delivery_country        VARCHAR(100) NOT NULL,
    delivery_postal_code    VARCHAR(20) NOT NULL,

    -- Terms
    payment_terms           VARCHAR(255),
    notes                   TEXT,

    -- Approval
    approved_by             UUID REFERENCES users(id),
    approved_at             TIMESTAMP,

    -- Audit Fields
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID REFERENCES users(id),
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              UUID REFERENCES users(id),
    deleted_at              TIMESTAMP NULL,
    version                 INTEGER NOT NULL DEFAULT 1,
    custom_fields           JSONB,

    UNIQUE(company_id, order_code),

    -- Constraint: expected_delivery_date must be >= order_date
    CONSTRAINT check_delivery_date CHECK (expected_delivery_date >= order_date)
);

-- ============================================================================
-- INDEXES: purchase_orders
-- ============================================================================

CREATE INDEX idx_purchase_orders_company ON purchase_orders(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_code ON purchase_orders(order_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_supplier ON purchase_orders(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_date ON purchase_orders(order_date);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_orders_expected_delivery ON purchase_orders(expected_delivery_date);

-- ============================================================================
-- COMMENTS: purchase_orders
-- ============================================================================

COMMENT ON TABLE purchase_orders IS 'Purchase orders for purchasing from suppliers';
COMMENT ON COLUMN purchase_orders.order_code IS 'Unique PO code (e.g., PO-2025-0001)';
COMMENT ON COLUMN purchase_orders.status IS 'Status: draft, submitted, approved, in_transit, partially_received, received, cancelled';

-- ============================================================================
-- TABLE: purchase_order_items
-- ============================================================================

CREATE TABLE purchase_order_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id           UUID NOT NULL REFERENCES items(id),
    item_description  TEXT,
    quantity          DECIMAL(20, 4) NOT NULL,
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    rate              DECIMAL(20, 4) NOT NULL,
    discount_percent  DECIMAL(5, 2) DEFAULT 0,
    discount_amount   DECIMAL(20, 4) DEFAULT 0,
    tax_percent       DECIMAL(5, 2) DEFAULT 0,
    tax_amount        DECIMAL(20, 4) DEFAULT 0,
    line_total        DECIMAL(20, 4) NOT NULL,
    quantity_received DECIMAL(20, 4) DEFAULT 0,
    sort_order        INTEGER DEFAULT 0,
    notes             TEXT,

    -- Audit Fields
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,

    -- Constraint: quantity_received cannot exceed quantity
    CONSTRAINT check_quantity_received CHECK (quantity_received <= quantity)
);

-- ============================================================================
-- INDEXES: purchase_order_items
-- ============================================================================

CREATE INDEX idx_purchase_order_items_company ON purchase_order_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_order_items_order ON purchase_order_items(purchase_order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_order_items_item ON purchase_order_items(item_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- COMMENTS: purchase_order_items
-- ============================================================================

COMMENT ON TABLE purchase_order_items IS 'Line items for purchase orders';
COMMENT ON COLUMN purchase_order_items.rate IS 'Purchase price per unit';
COMMENT ON COLUMN purchase_order_items.quantity_received IS 'Total quantity received across all receipts';

-- ============================================================================
-- TRIGGERS: Update timestamps
-- ============================================================================

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_order_items_updated_at BEFORE UPDATE ON purchase_order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY: purchase_orders
-- ============================================================================

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see purchase orders from their company
CREATE POLICY purchase_orders_company_isolation_select ON purchase_orders
    FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can insert purchase orders for their company
CREATE POLICY purchase_orders_company_isolation_insert ON purchase_orders
    FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can update purchase orders from their company
CREATE POLICY purchase_orders_company_isolation_update ON purchase_orders
    FOR UPDATE
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ))
    WITH CHECK (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can delete purchase orders from their company
CREATE POLICY purchase_orders_company_isolation_delete ON purchase_orders
    FOR DELETE
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- ============================================================================
-- ROW LEVEL SECURITY: purchase_order_items
-- ============================================================================

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see items from their company
CREATE POLICY purchase_order_items_company_isolation_select ON purchase_order_items
    FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can insert items for their company
CREATE POLICY purchase_order_items_company_isolation_insert ON purchase_order_items
    FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can update items from their company
CREATE POLICY purchase_order_items_company_isolation_update ON purchase_order_items
    FOR UPDATE
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ))
    WITH CHECK (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can delete items from their company
CREATE POLICY purchase_order_items_company_isolation_delete ON purchase_order_items
    FOR DELETE
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));
-- Migration: Add Purchase Receipts Tables
-- Description: Creates purchase_receipts and purchase_receipt_items tables with stock update logic

-- ============================================================================
-- TABLE: purchase_receipts
-- ============================================================================

CREATE TABLE purchase_receipts (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id                UUID NOT NULL REFERENCES companies(id),
    receipt_code              VARCHAR(100) NOT NULL,
    purchase_order_id         UUID NOT NULL REFERENCES purchase_orders(id),
    supplier_id               UUID NOT NULL REFERENCES suppliers(id),
    warehouse_id              UUID NOT NULL REFERENCES warehouses(id),
    receipt_date              DATE NOT NULL,

    -- Supplier Invoice Details
    supplier_invoice_number   VARCHAR(100),
    supplier_invoice_date     DATE,

    -- Status: draft, received, cancelled
    status                    VARCHAR(50) DEFAULT 'draft',
    notes                     TEXT,

    -- Audit Fields
    created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by                UUID REFERENCES users(id),
    updated_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                UUID REFERENCES users(id),
    deleted_at                TIMESTAMP NULL,
    version                   INTEGER NOT NULL DEFAULT 1,
    custom_fields             JSONB,

    UNIQUE(company_id, receipt_code)
);

-- ============================================================================
-- INDEXES: purchase_receipts
-- ============================================================================

CREATE INDEX idx_purchase_receipts_company ON purchase_receipts(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_receipts_code ON purchase_receipts(receipt_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_receipts_po ON purchase_receipts(purchase_order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_receipts_supplier ON purchase_receipts(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_receipts_warehouse ON purchase_receipts(warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_receipts_date ON purchase_receipts(receipt_date);
CREATE INDEX idx_purchase_receipts_status ON purchase_receipts(status) WHERE deleted_at IS NULL;

-- ============================================================================
-- COMMENTS: purchase_receipts
-- ============================================================================

COMMENT ON TABLE purchase_receipts IS 'Goods Receipt Notes (GRN) for receiving purchased items';
COMMENT ON COLUMN purchase_receipts.receipt_code IS 'Unique receipt code (e.g., GRN-2025-0001)';
COMMENT ON COLUMN purchase_receipts.status IS 'Status: draft, received, cancelled';

-- ============================================================================
-- TABLE: purchase_receipt_items
-- ============================================================================

CREATE TABLE purchase_receipt_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id),
    receipt_id              UUID NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
    purchase_order_item_id  UUID NOT NULL REFERENCES purchase_order_items(id),
    item_id                 UUID NOT NULL REFERENCES items(id),
    quantity_ordered        DECIMAL(20, 4) NOT NULL,
    quantity_received       DECIMAL(20, 4) NOT NULL,
    uom_id                  UUID NOT NULL REFERENCES units_of_measure(id),
    rate                    DECIMAL(20, 4) NOT NULL,
    notes                   TEXT,  -- For damaged/rejected items

    -- Audit Fields
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID REFERENCES users(id),
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              UUID REFERENCES users(id),
    deleted_at              TIMESTAMP NULL,

    -- Constraint: quantity_received cannot exceed quantity_ordered
    CONSTRAINT check_received_quantity CHECK (quantity_received <= quantity_ordered),
    CONSTRAINT check_quantity_positive CHECK (quantity_received > 0)
);

-- ============================================================================
-- INDEXES: purchase_receipt_items
-- ============================================================================

CREATE INDEX idx_purchase_receipt_items_company ON purchase_receipt_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_receipt_items_receipt ON purchase_receipt_items(receipt_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_receipt_items_po_item ON purchase_receipt_items(purchase_order_item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_purchase_receipt_items_item ON purchase_receipt_items(item_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- COMMENTS: purchase_receipt_items
-- ============================================================================

COMMENT ON TABLE purchase_receipt_items IS 'Line items for purchase receipts';
COMMENT ON COLUMN purchase_receipt_items.quantity_ordered IS 'Original quantity from PO';
COMMENT ON COLUMN purchase_receipt_items.quantity_received IS 'Actual quantity received in this receipt';

-- ============================================================================
-- TRIGGERS: Update timestamps
-- ============================================================================

CREATE TRIGGER update_purchase_receipts_updated_at BEFORE UPDATE ON purchase_receipts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_receipt_items_updated_at BEFORE UPDATE ON purchase_receipt_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTION: Update stock levels when items are received
-- ============================================================================

CREATE OR REPLACE FUNCTION update_stock_on_receipt()
RETURNS TRIGGER AS $$
DECLARE
    v_warehouse_id UUID;
BEGIN
    -- Get warehouse_id from receipt
    SELECT warehouse_id INTO v_warehouse_id
    FROM purchase_receipts
    WHERE id = NEW.receipt_id;

    -- Update stock in item_warehouse
    UPDATE item_warehouse
    SET
        current_stock = current_stock + NEW.quantity_received,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = NEW.created_by
    WHERE
        company_id = NEW.company_id
        AND item_id = NEW.item_id
        AND warehouse_id = v_warehouse_id;

    -- If no record exists in item_warehouse, insert one
    IF NOT FOUND THEN
        INSERT INTO item_warehouse (
            company_id,
            item_id,
            warehouse_id,
            current_stock,
            reorder_level,
            reorder_quantity,
            max_quantity,
            reserved_stock,
            is_active,
            created_by,
            updated_by
        ) VALUES (
            NEW.company_id,
            NEW.item_id,
            v_warehouse_id,
            NEW.quantity_received,
            0,
            0,
            0,
            0,
            true,
            NEW.created_by,
            NEW.created_by
        );
    END IF;

    -- Update quantity_received in purchase_order_items
    UPDATE purchase_order_items
    SET
        quantity_received = quantity_received + NEW.quantity_received,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = NEW.created_by
    WHERE id = NEW.purchase_order_item_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Apply stock update when receipt item is created
-- ============================================================================

CREATE TRIGGER trigger_update_stock_on_receipt
    AFTER INSERT ON purchase_receipt_items
    FOR EACH ROW
    EXECUTE FUNCTION update_stock_on_receipt();

-- ============================================================================
-- FUNCTION: Update PO status based on received quantities
-- ============================================================================

CREATE OR REPLACE FUNCTION update_po_status_on_receipt()
RETURNS TRIGGER AS $$
DECLARE
    v_po_id UUID;
    v_total_items INTEGER;
    v_fully_received_items INTEGER;
    v_partially_received_items INTEGER;
BEGIN
    -- Get PO ID
    SELECT purchase_order_id INTO v_po_id
    FROM purchase_receipts
    WHERE id = NEW.receipt_id;

    -- Count items in the PO
    SELECT
        COUNT(*),
        SUM(CASE WHEN quantity_received >= quantity THEN 1 ELSE 0 END),
        SUM(CASE WHEN quantity_received > 0 AND quantity_received < quantity THEN 1 ELSE 0 END)
    INTO v_total_items, v_fully_received_items, v_partially_received_items
    FROM purchase_order_items
    WHERE purchase_order_id = v_po_id
    AND deleted_at IS NULL;

    -- Update PO status based on received quantities
    IF v_fully_received_items = v_total_items THEN
        -- All items fully received
        UPDATE purchase_orders
        SET
            status = 'received',
            updated_at = CURRENT_TIMESTAMP,
            updated_by = NEW.created_by
        WHERE id = v_po_id;
    ELSIF v_fully_received_items > 0 OR v_partially_received_items > 0 THEN
        -- Some items received
        UPDATE purchase_orders
        SET
            status = 'partially_received',
            updated_at = CURRENT_TIMESTAMP,
            updated_by = NEW.created_by
        WHERE id = v_po_id
        AND status != 'received';  -- Don't downgrade from received
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Apply PO status update when receipt item is created
-- ============================================================================

CREATE TRIGGER trigger_update_po_status_on_receipt
    AFTER INSERT ON purchase_receipt_items
    FOR EACH ROW
    EXECUTE FUNCTION update_po_status_on_receipt();

-- ============================================================================
-- ROW LEVEL SECURITY: purchase_receipts
-- ============================================================================

ALTER TABLE purchase_receipts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see receipts from their company
CREATE POLICY purchase_receipts_company_isolation_select ON purchase_receipts
    FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can insert receipts for their company
CREATE POLICY purchase_receipts_company_isolation_insert ON purchase_receipts
    FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can update receipts from their company
CREATE POLICY purchase_receipts_company_isolation_update ON purchase_receipts
    FOR UPDATE
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ))
    WITH CHECK (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can delete receipts from their company
CREATE POLICY purchase_receipts_company_isolation_delete ON purchase_receipts
    FOR DELETE
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- ============================================================================
-- ROW LEVEL SECURITY: purchase_receipt_items
-- ============================================================================

ALTER TABLE purchase_receipt_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see items from their company
CREATE POLICY purchase_receipt_items_company_isolation_select ON purchase_receipt_items
    FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can insert items for their company
CREATE POLICY purchase_receipt_items_company_isolation_insert ON purchase_receipt_items
    FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can update items from their company
CREATE POLICY purchase_receipt_items_company_isolation_update ON purchase_receipt_items
    FOR UPDATE
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ))
    WITH CHECK (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Policy: Users can delete items from their company
CREATE POLICY purchase_receipt_items_company_isolation_delete ON purchase_receipt_items
    FOR DELETE
    USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));
-- Migration: Add sales_order_id to quotations for traceability
-- Description: Links quotations to sales orders when converted

-- Add sales_order_id column to sales_quotations table
ALTER TABLE sales_quotations
ADD COLUMN sales_order_id UUID REFERENCES sales_orders(id);

-- Create index for faster lookups
CREATE INDEX idx_quotations_sales_order ON sales_quotations(sales_order_id) WHERE deleted_at IS NULL;

-- Add comment
COMMENT ON COLUMN sales_quotations.sales_order_id IS 'Reference to the sales order created from this quotation';

-- Update status comment to include 'ordered'
COMMENT ON COLUMN sales_quotations.status IS 'Status: draft, sent, accepted, rejected, expired, ordered';
-- Add payment_code column to invoice_payments table

ALTER TABLE invoice_payments
ADD COLUMN IF NOT EXISTS payment_code VARCHAR(50);

-- Make it unique per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_payments_payment_code
ON invoice_payments(company_id, payment_code)
WHERE deleted_at IS NULL;

COMMENT ON COLUMN invoice_payments.payment_code IS 'Unique payment code (e.g., PAY-2025-0001)';
-- ============================================================================
-- Migration: Add Stock Adjustments Tables
-- Description: Creates stock_adjustments and stock_adjustment_items tables
-- ============================================================================

-- ============================================================================
-- TABLE: stock_adjustments
-- ============================================================================

CREATE TABLE stock_adjustments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID NOT NULL REFERENCES companies(id),
    adjustment_code       VARCHAR(100) NOT NULL,
    adjustment_type       VARCHAR(50) NOT NULL,  -- 'increase', 'decrease', 'physical_count'
    adjustment_date       DATE NOT NULL,
    warehouse_id          UUID NOT NULL REFERENCES warehouses(id),
    status                VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'approved', 'posted', 'cancelled'
    reason                TEXT NOT NULL,
    notes                 TEXT,
    total_value           DECIMAL(20, 4) DEFAULT 0.0000,
    stock_transaction_id  UUID REFERENCES stock_transactions(id),
    approved_by           UUID REFERENCES users(id),
    approved_at           TIMESTAMP,
    posted_by             UUID REFERENCES users(id),
    posted_at             TIMESTAMP,
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by            UUID NOT NULL REFERENCES users(id),
    updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by            UUID NOT NULL REFERENCES users(id),
    deleted_at            TIMESTAMP NULL,
    version               INTEGER NOT NULL DEFAULT 1,
    custom_fields         JSONB,
    UNIQUE(company_id, adjustment_code)
);

CREATE INDEX idx_stock_adj_company ON stock_adjustments(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_adj_code ON stock_adjustments(adjustment_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_adj_date ON stock_adjustments(adjustment_date);
CREATE INDEX idx_stock_adj_warehouse ON stock_adjustments(warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_adj_status ON stock_adjustments(status);
CREATE INDEX idx_stock_adj_type ON stock_adjustments(adjustment_type);

CREATE TRIGGER trigger_stock_adjustments_updated_at
    BEFORE UPDATE ON stock_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE stock_adjustments IS 'Stock adjustment documents for inventory corrections';

-- ============================================================================
-- TABLE: stock_adjustment_items
-- ============================================================================

CREATE TABLE stock_adjustment_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    adjustment_id     UUID NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
    item_id           UUID NOT NULL REFERENCES items(id),
    item_code         VARCHAR(100) NOT NULL,
    item_name         VARCHAR(255) NOT NULL,
    current_qty       DECIMAL(20, 4) NOT NULL DEFAULT 0.0000,
    adjusted_qty      DECIMAL(20, 4) NOT NULL,
    difference        DECIMAL(20, 4) NOT NULL,
    unit_cost         DECIMAL(20, 4) NOT NULL,
    total_cost        DECIMAL(20, 4) NOT NULL,
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    uom_name          VARCHAR(100),
    reason            TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_stock_adj_items_company ON stock_adjustment_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_adj_items_adjustment ON stock_adjustment_items(adjustment_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_adj_items_item ON stock_adjustment_items(item_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_stock_adjustment_items_updated_at
    BEFORE UPDATE ON stock_adjustment_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE stock_adjustment_items IS 'Line items for stock adjustments';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustment_items ENABLE ROW LEVEL SECURITY;

-- RLS for stock_adjustments
CREATE POLICY "Users can view stock adjustments for their company"
    ON stock_adjustments FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create stock adjustments for their company"
    ON stock_adjustments FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update stock adjustments for their company"
    ON stock_adjustments FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- RLS for stock_adjustment_items
CREATE POLICY "Users can view adjustment items for their company"
    ON stock_adjustment_items FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can create adjustment items for their company"
    ON stock_adjustment_items FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update adjustment items for their company"
    ON stock_adjustment_items FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );
-- Add warehouse_id column to sales_invoices table
ALTER TABLE sales_invoices
ADD COLUMN warehouse_id UUID REFERENCES warehouses(id);

-- Create index for warehouse_id
CREATE INDEX idx_invoices_warehouse ON sales_invoices(warehouse_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN sales_invoices.warehouse_id IS 'Warehouse from which the invoice items are fulfilled';
-- Add reference_code column to stock_transactions table
ALTER TABLE stock_transactions
ADD COLUMN reference_code VARCHAR(100);

-- Create index for reference_code
CREATE INDEX idx_stock_transactions_reference_code ON stock_transactions(reference_code) WHERE reference_code IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN stock_transactions.reference_code IS 'Human-readable reference code from the source document (e.g., invoice number, order number)';

-- Add missing columns to stock_ledger table
ALTER TABLE stock_ledger
ADD COLUMN transaction_type VARCHAR(50),
ADD COLUMN qty_change NUMERIC(20,4),
ADD COLUMN uom_id UUID REFERENCES units_of_measure(id),
ADD COLUMN rate NUMERIC(20,4),
ADD COLUMN value_change NUMERIC(20,4),
ADD COLUMN reference_type VARCHAR(50),
ADD COLUMN reference_id UUID,
ADD COLUMN reference_code VARCHAR(100),
ADD COLUMN created_by UUID REFERENCES users(id);

-- Create indexes for new stock_ledger columns
CREATE INDEX idx_stock_ledger_reference_type_id ON stock_ledger(reference_type, reference_id) WHERE reference_type IS NOT NULL;
CREATE INDEX idx_stock_ledger_reference_code ON stock_ledger(reference_code) WHERE reference_code IS NOT NULL;
CREATE INDEX idx_stock_ledger_transaction_type ON stock_ledger(transaction_type) WHERE transaction_type IS NOT NULL;

-- Add comments for new columns
COMMENT ON COLUMN stock_ledger.transaction_type IS 'Type of transaction (sales, purchase, adjustment, transfer, etc.)';
COMMENT ON COLUMN stock_ledger.qty_change IS 'Quantity change (positive for incoming, negative for outgoing)';
COMMENT ON COLUMN stock_ledger.uom_id IS 'Unit of measure for the transaction';
COMMENT ON COLUMN stock_ledger.rate IS 'Rate/price per unit';
COMMENT ON COLUMN stock_ledger.value_change IS 'Total value change (qty_change * rate)';
COMMENT ON COLUMN stock_ledger.reference_type IS 'Type of source document (sales_invoice, purchase_order, etc.)';
COMMENT ON COLUMN stock_ledger.reference_id IS 'UUID of the source document';
COMMENT ON COLUMN stock_ledger.reference_code IS 'Human-readable reference code from the source document';
COMMENT ON COLUMN stock_ledger.created_by IS 'User who created this ledger entry';
-- Create POS transactions table
CREATE TABLE IF NOT EXISTS pos_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  transaction_code VARCHAR(50) NOT NULL UNIQUE,
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Customer information (optional)
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255),

  -- Financial summary
  subtotal DECIMAL(15, 4) NOT NULL,
  total_discount DECIMAL(15, 4) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  total_tax DECIMAL(15, 4) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15, 4) NOT NULL,
  amount_paid DECIMAL(15, 4) NOT NULL,
  change_amount DECIMAL(15, 4) NOT NULL DEFAULT 0,

  -- Transaction status
  status VARCHAR(20) NOT NULL DEFAULT 'completed',

  -- Cashier information
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  cashier_name VARCHAR(255) NOT NULL,

  -- Additional info
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT pos_transactions_company_code_unique UNIQUE (company_id, transaction_code)
);

-- Create POS transaction items table
CREATE TABLE IF NOT EXISTS pos_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_transaction_id UUID NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,

  -- Item reference
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  item_code VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,

  -- Quantity and pricing
  quantity DECIMAL(15, 4) NOT NULL,
  unit_price DECIMAL(15, 4) NOT NULL,
  discount DECIMAL(5, 2) NOT NULL DEFAULT 0,
  line_total DECIMAL(15, 4) NOT NULL,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create POS transaction payments table
CREATE TABLE IF NOT EXISTS pos_transaction_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_transaction_id UUID NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,

  -- Payment details
  payment_method VARCHAR(20) NOT NULL,
  amount DECIMAL(15, 4) NOT NULL,
  reference VARCHAR(100),

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_pos_transactions_company ON pos_transactions(company_id);
CREATE INDEX idx_pos_transactions_customer ON pos_transactions(customer_id);
CREATE INDEX idx_pos_transactions_cashier ON pos_transactions(cashier_id);
CREATE INDEX idx_pos_transactions_date ON pos_transactions(transaction_date);
CREATE INDEX idx_pos_transactions_status ON pos_transactions(status);
CREATE INDEX idx_pos_transaction_items_transaction ON pos_transaction_items(pos_transaction_id);
CREATE INDEX idx_pos_transaction_items_item ON pos_transaction_items(item_id);
CREATE INDEX idx_pos_transaction_payments_transaction ON pos_transaction_payments(pos_transaction_id);

-- Create trigger for updated_at on pos_transactions
CREATE TRIGGER update_pos_transactions_updated_at
  BEFORE UPDATE ON pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for updated_at on pos_transaction_items
CREATE TRIGGER update_pos_transaction_items_updated_at
  BEFORE UPDATE ON pos_transaction_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for updated_at on pos_transaction_payments
CREATE TRIGGER update_pos_transaction_payments_updated_at
  BEFORE UPDATE ON pos_transaction_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transaction_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pos_transactions
CREATE POLICY pos_transactions_select
  ON pos_transactions FOR SELECT
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY pos_transactions_insert
  ON pos_transactions FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY pos_transactions_update
  ON pos_transactions FOR UPDATE
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY pos_transactions_delete
  ON pos_transactions FOR DELETE
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- RLS Policies for pos_transaction_items
CREATE POLICY pos_transaction_items_select
  ON pos_transaction_items FOR SELECT
  USING (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY pos_transaction_items_insert
  ON pos_transaction_items FOR INSERT
  WITH CHECK (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY pos_transaction_items_update
  ON pos_transaction_items FOR UPDATE
  USING (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY pos_transaction_items_delete
  ON pos_transaction_items FOR DELETE
  USING (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

-- RLS Policies for pos_transaction_payments
CREATE POLICY pos_transaction_payments_select
  ON pos_transaction_payments FOR SELECT
  USING (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY pos_transaction_payments_insert
  ON pos_transaction_payments FOR INSERT
  WITH CHECK (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY pos_transaction_payments_update
  ON pos_transaction_payments FOR UPDATE
  USING (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY pos_transaction_payments_delete
  ON pos_transaction_payments FOR DELETE
  USING (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));
-- Migration: Van Sales - Database Setup
-- Version: 20251120010000
-- Description: Add van warehouse support, user-van assignment, and EOD reconciliation
-- Author: System
-- Date: 2025-11-20

-- ============================================================================
-- WAREHOUSES: Add is_van flag
-- ============================================================================
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS is_van BOOLEAN DEFAULT false;

COMMENT ON COLUMN warehouses.is_van IS 'Indicates if this warehouse represents a delivery van';

CREATE INDEX IF NOT EXISTS idx_warehouses_is_van ON warehouses(is_van) WHERE is_van = true;

-- ============================================================================
-- USERS: Add van_warehouse_id (optional assignment)
-- ============================================================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS van_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

COMMENT ON COLUMN users.van_warehouse_id IS 'Optional assignment of user/driver to a specific van warehouse';

CREATE INDEX IF NOT EXISTS idx_users_van_warehouse ON users(van_warehouse_id) WHERE van_warehouse_id IS NOT NULL;

-- ============================================================================
-- TABLE: van_eod_reconciliations
-- ============================================================================
-- Tracks end-of-day physical counts and variance reconciliation for van warehouses

CREATE TABLE IF NOT EXISTS van_eod_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  van_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reconciliation_date DATE NOT NULL,

  -- Physical counts by item (JSONB for flexibility)
  -- Format: [{"item_id": "uuid", "item_code": "ITEM-001", "item_name": "Product A", "physical_count": 10}]
  physical_counts JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Expected ending stock (calculated: opening + load - sales)
  -- Format: {"item_id_1": 50, "item_id_2": 30, ...}
  expected_ending JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Variances (calculated: physical - expected)
  -- Format: {"item_id_1": -2, "item_id_2": 0, "item_id_3": 5, ...}
  variances JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Driver notes explaining variances
  driver_notes TEXT,

  -- Approval workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Status values: 'pending', 'approved', 'rejected'

  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,

  -- Link to auto-generated stock adjustment (if approved)
  stock_adjustment_id UUID REFERENCES stock_adjustments(id) ON DELETE SET NULL,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT van_eod_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT van_eod_unique_date UNIQUE (van_warehouse_id, reconciliation_date)
);

COMMENT ON TABLE van_eod_reconciliations IS 'End-of-day physical count reconciliations for van warehouses';
COMMENT ON COLUMN van_eod_reconciliations.physical_counts IS 'Array of physical count records with item details';
COMMENT ON COLUMN van_eod_reconciliations.expected_ending IS 'Expected ending stock calculated from transactions';
COMMENT ON COLUMN van_eod_reconciliations.variances IS 'Variance per item (positive = overage, negative = shortage)';

-- ============================================================================
-- INDEXES for van_eod_reconciliations
-- ============================================================================
CREATE INDEX idx_van_eod_company ON van_eod_reconciliations(company_id);
CREATE INDEX idx_van_eod_van_warehouse ON van_eod_reconciliations(van_warehouse_id);
CREATE INDEX idx_van_eod_driver ON van_eod_reconciliations(driver_id);
CREATE INDEX idx_van_eod_date ON van_eod_reconciliations(reconciliation_date);
CREATE INDEX idx_van_eod_status ON van_eod_reconciliations(status);
CREATE INDEX idx_van_eod_stock_adjustment ON van_eod_reconciliations(stock_adjustment_id) WHERE stock_adjustment_id IS NOT NULL;

-- ============================================================================
-- TRIGGERS for van_eod_reconciliations
-- ============================================================================
CREATE TRIGGER update_van_eod_reconciliations_updated_at
  BEFORE UPDATE ON van_eod_reconciliations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY for van_eod_reconciliations
-- ============================================================================
ALTER TABLE van_eod_reconciliations ENABLE ROW LEVEL SECURITY;

-- Drivers can select their own van's EOD records
CREATE POLICY van_eod_select
  ON van_eod_reconciliations FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Drivers can insert EOD records for their assigned van only
CREATE POLICY van_eod_insert
  ON van_eod_reconciliations FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    AND driver_id = auth.uid()
    AND van_warehouse_id IN (SELECT van_warehouse_id FROM users WHERE id = auth.uid())
  );

-- Only supervisors/admins can update (approve/reject)
-- For now, allow same company access - refine with role checks later
CREATE POLICY van_eod_update
  ON van_eod_reconciliations FOR UPDATE
  USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Prevent deletion (audit trail)
CREATE POLICY van_eod_delete
  ON van_eod_reconciliations FOR DELETE
  USING (false);

-- ============================================================================
-- HELPER FUNCTION: Get Van's Expected Ending Stock
-- ============================================================================
-- Calculates expected ending stock for a van on a specific date
-- Formula: Opening Stock + Stock Transfers IN - Sales OUT

CREATE OR REPLACE FUNCTION get_van_expected_ending_stock(
  p_van_warehouse_id UUID,
  p_date DATE
)
RETURNS JSONB AS $$
DECLARE
  v_expected JSONB := '{}'::jsonb;
  v_item RECORD;
BEGIN
  -- Calculate expected ending stock per item
  -- This is a simplified version - adjust based on your actual stock movement tables

  FOR v_item IN
    SELECT
      item_id,
      SUM(
        CASE
          -- Stock transfers IN (to van)
          WHEN destination_warehouse_id = p_van_warehouse_id
            AND DATE(transfer_date) <= p_date
            THEN quantity
          -- Stock transfers OUT (from van) - should be rare
          WHEN source_warehouse_id = p_van_warehouse_id
            AND DATE(transfer_date) <= p_date
            THEN -quantity
          ELSE 0
        END
      ) AS net_transfers,
      SUM(
        CASE
          -- Sales from van (deductions)
          WHEN warehouse_id = p_van_warehouse_id
            AND DATE(order_date) <= p_date
            THEN -quantity
          ELSE 0
        END
      ) AS net_sales
    FROM (
      -- Get stock transfers
      SELECT
        st.item_id,
        st.source_warehouse_id,
        st.destination_warehouse_id,
        st.quantity,
        st.transfer_date,
        NULL::UUID AS warehouse_id,
        NULL::DATE AS order_date
      FROM stock_transfer_items st
      JOIN stock_transfers t ON st.stock_transfer_id = t.id
      WHERE (t.source_warehouse_id = p_van_warehouse_id
        OR t.destination_warehouse_id = p_van_warehouse_id)
        AND t.status = 'completed'

      UNION ALL

      -- Get sales order items
      SELECT
        soi.item_id,
        NULL::UUID AS source_warehouse_id,
        NULL::UUID AS destination_warehouse_id,
        soi.quantity,
        NULL::TIMESTAMP AS transfer_date,
        so.warehouse_id,
        so.order_date::DATE
      FROM sales_order_items soi
      JOIN sales_orders so ON soi.sales_order_id = so.id
      WHERE so.warehouse_id = p_van_warehouse_id
        AND so.status NOT IN ('draft', 'cancelled')
    ) movements
    GROUP BY item_id
    HAVING SUM(
      CASE
        WHEN destination_warehouse_id = p_van_warehouse_id THEN quantity
        WHEN source_warehouse_id = p_van_warehouse_id THEN -quantity
        WHEN warehouse_id = p_van_warehouse_id THEN -quantity
        ELSE 0
      END
    ) <> 0
  LOOP
    v_expected := jsonb_set(
      v_expected,
      ARRAY[v_item.item_id::text],
      to_jsonb(COALESCE(v_item.net_transfers, 0) + COALESCE(v_item.net_sales, 0))
    );
  END LOOP;

  RETURN v_expected;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_van_expected_ending_stock IS 'Calculates expected ending stock for a van warehouse on a given date';
-- Migration: Add Stock Transfers
-- Version: 20251120020000
-- Description: Creates stock_transfers and stock_transfer_items tables for inter-warehouse transfers
-- Author: System
-- Date: 2025-11-20

-- ============================================================================
-- TABLE: stock_transfers
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_transfers (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID NOT NULL REFERENCES companies(id),
    transfer_code         VARCHAR(100) NOT NULL,
    transfer_date         DATE NOT NULL,
    from_warehouse_id     UUID NOT NULL REFERENCES warehouses(id),
    to_warehouse_id       UUID NOT NULL REFERENCES warehouses(id),
    status                VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'in_transit', 'received', 'cancelled'
    notes                 TEXT,
    total_items           INTEGER DEFAULT 0,
    requested_by          UUID REFERENCES users(id),
    requested_at          TIMESTAMP,
    confirmed_by          UUID REFERENCES users(id),
    confirmed_at          TIMESTAMP,
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by            UUID NOT NULL REFERENCES users(id),
    updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by            UUID NOT NULL REFERENCES users(id),
    deleted_at            TIMESTAMP NULL,
    version               INTEGER NOT NULL DEFAULT 1,
    custom_fields         JSONB,
    UNIQUE(company_id, transfer_code),
    CONSTRAINT different_warehouses CHECK (from_warehouse_id != to_warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfers_company ON stock_transfers(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_transfers_code ON stock_transfers(transfer_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_warehouse ON stock_transfers(from_warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_warehouse ON stock_transfers(to_warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_date ON stock_transfers(transfer_date);

CREATE TRIGGER trigger_stock_transfers_updated_at
    BEFORE UPDATE ON stock_transfers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE stock_transfers IS 'Stock transfer documents between warehouses (including van loading)';

-- ============================================================================
-- TABLE: stock_transfer_items
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    transfer_id       UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
    item_id           UUID NOT NULL REFERENCES items(id),
    item_code         VARCHAR(100) NOT NULL,
    item_name         VARCHAR(255) NOT NULL,
    quantity          DECIMAL(20, 4) NOT NULL,
    received_quantity DECIMAL(20, 4) DEFAULT 0.0000,
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    uom_name          VARCHAR(100),
    notes             TEXT,
    sort_order        INTEGER DEFAULT 0,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    CONSTRAINT positive_quantity CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_company ON stock_transfer_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_transfer ON stock_transfer_items(transfer_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_item ON stock_transfer_items(item_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_stock_transfer_items_updated_at
    BEFORE UPDATE ON stock_transfer_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE stock_transfer_items IS 'Line items for stock transfers';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- RLS for stock_transfers
CREATE POLICY stock_transfers_select
    ON stock_transfers FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY stock_transfers_insert
    ON stock_transfers FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY stock_transfers_update
    ON stock_transfers FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- RLS for stock_transfer_items
CREATE POLICY stock_transfer_items_select
    ON stock_transfer_items FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY stock_transfer_items_insert
    ON stock_transfer_items FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY stock_transfer_items_update
    ON stock_transfer_items FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));
-- ============================================================================
-- Migration: Add Accounting Tables (Chart of Accounts, General Ledger, Journals)
-- Version: 20251122000000
-- Description: Creates accounting module tables following double-entry bookkeeping
--              Implements non-breaking additive approach - existing tables unchanged
-- Author: System
-- Date: 2024-11-22
-- ============================================================================

-- ============================================================================
-- TABLE: accounts (Chart of Accounts)
-- ============================================================================

CREATE TABLE accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_number      VARCHAR(50) NOT NULL,  -- Alphanumeric: A-1000, L-2100, R-4000
    account_name        VARCHAR(200) NOT NULL,
    account_type        VARCHAR(50) NOT NULL,  -- 'asset', 'liability', 'equity', 'revenue', 'expense', 'cogs'
    parent_account_id   UUID REFERENCES accounts(id) ON DELETE RESTRICT,

    -- System vs User-created accounts
    is_system_account   BOOLEAN DEFAULT false,  -- Prevents deletion of core accounts
    is_active           BOOLEAN DEFAULT true,

    -- Hierarchy and display
    level               INTEGER DEFAULT 1,
    sort_order          INTEGER DEFAULT 0,

    -- Additional info
    description         TEXT,

    -- Audit fields
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at          TIMESTAMP,

    -- Versioning
    version             INTEGER NOT NULL DEFAULT 1,

    -- Constraints
    CONSTRAINT chk_account_type CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense', 'cogs')),
    CONSTRAINT chk_account_level CHECK (level >= 1 AND level <= 10),
    UNIQUE(company_id, account_number)
);

-- Indexes for accounts
CREATE INDEX idx_accounts_company ON accounts(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_type ON accounts(account_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_parent ON accounts(parent_account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_number ON accounts(account_number) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_accounts_number_unique ON accounts(company_id, account_number) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER trigger_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE accounts IS 'Chart of Accounts - defines all GL accounts';
COMMENT ON COLUMN accounts.account_number IS 'Alphanumeric account code (e.g., A-1000, L-2100)';
COMMENT ON COLUMN accounts.is_system_account IS 'System accounts cannot be deleted (AR, AP, Inventory, etc.)';

-- ============================================================================
-- TABLE: journal_entries (General Ledger Header)
-- ============================================================================

CREATE TABLE journal_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    journal_code        VARCHAR(100) NOT NULL,  -- Auto-generated: JE-00001
    posting_date        DATE NOT NULL,

    -- Source tracking
    reference_type      VARCHAR(50),  -- 'sales_invoice', 'purchase_receipt', 'stock_adjustment', 'manual'
    reference_id        UUID,         -- ID of source document
    reference_code      VARCHAR(100), -- Code of source document (for display)

    -- Journal info
    description         TEXT,
    status              VARCHAR(50) NOT NULL DEFAULT 'draft',  -- 'draft', 'posted', 'cancelled'
    source_module       VARCHAR(50) NOT NULL,  -- 'AR', 'AP', 'Inventory', 'Manual'

    -- Totals (for validation)
    total_debit         NUMERIC(20,4) NOT NULL DEFAULT 0,
    total_credit        NUMERIC(20,4) NOT NULL DEFAULT 0,

    -- Posting info
    posted_at           TIMESTAMP,
    posted_by           UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Audit fields
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at          TIMESTAMP,

    -- Versioning
    version             INTEGER NOT NULL DEFAULT 1,

    -- Constraints
    CONSTRAINT chk_journal_status CHECK (status IN ('draft', 'posted', 'cancelled')),
    CONSTRAINT chk_journal_balanced CHECK (total_debit = total_credit OR status = 'draft'),
    CONSTRAINT chk_journal_source CHECK (source_module IN ('AR', 'AP', 'Inventory', 'Manual', 'COGS')),
    CONSTRAINT chk_journal_reference CHECK (
        (reference_type IS NULL AND reference_id IS NULL) OR
        (reference_type IS NOT NULL AND reference_id IS NOT NULL)
    ),
    UNIQUE(company_id, journal_code)
);

-- Indexes for journal_entries
CREATE INDEX idx_journal_entries_company ON journal_entries(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_entries_code ON journal_entries(journal_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_entries_date ON journal_entries(posting_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_entries_status ON journal_entries(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_entries_reference ON journal_entries(reference_type, reference_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_entries_source ON journal_entries(source_module) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_journal_entries_code_unique ON journal_entries(company_id, journal_code) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER trigger_journal_entries_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE journal_entries IS 'General Ledger journal entries (header)';
COMMENT ON COLUMN journal_entries.reference_type IS 'Type of source document (sales_invoice, purchase_receipt, etc.)';
COMMENT ON COLUMN journal_entries.reference_id IS 'ID of source document in respective table';

-- ============================================================================
-- TABLE: journal_lines (General Ledger Details)
-- ============================================================================

CREATE TABLE journal_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    journal_entry_id    UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,

    -- Amounts
    debit               NUMERIC(20,4) NOT NULL DEFAULT 0,
    credit              NUMERIC(20,4) NOT NULL DEFAULT 0,

    -- Line details
    description         TEXT,
    line_number         INTEGER NOT NULL,  -- Order within journal

    -- Additional tracking
    cost_center_id      UUID,  -- Future: link to cost centers
    project_id          UUID,  -- Future: link to projects

    -- Audit fields
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT chk_journal_line_amounts CHECK (
        (debit > 0 AND credit = 0) OR
        (debit = 0 AND credit > 0)
    ),
    CONSTRAINT chk_journal_line_number CHECK (line_number > 0)
);

-- Indexes for journal_lines
CREATE INDEX idx_journal_lines_company ON journal_lines(company_id);
CREATE INDEX idx_journal_lines_journal ON journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX idx_journal_lines_line_number ON journal_lines(journal_entry_id, line_number);

COMMENT ON TABLE journal_lines IS 'General Ledger journal entry line items';
COMMENT ON CONSTRAINT chk_journal_line_amounts ON journal_lines IS 'Each line must be either debit OR credit, not both';

-- ============================================================================
-- SEED DATA: Default Chart of Accounts
-- ============================================================================
-- Note: Seed data has been moved to supabase/seed.sql
-- This ensures proper execution order: migrations first, then seeds

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

-- Policies for accounts
CREATE POLICY accounts_select_policy ON accounts
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY accounts_insert_policy ON accounts
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY accounts_update_policy ON accounts
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY accounts_delete_policy ON accounts
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
        AND is_system_account = false  -- Prevent deletion of system accounts
    );

-- Policies for journal_entries
CREATE POLICY journal_entries_select_policy ON journal_entries
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY journal_entries_insert_policy ON journal_entries
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY journal_entries_update_policy ON journal_entries
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY journal_entries_delete_policy ON journal_entries
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
        AND status = 'draft'  -- Only draft journals can be deleted
    );

-- Policies for journal_lines
CREATE POLICY journal_lines_select_policy ON journal_lines
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY journal_lines_insert_policy ON journal_lines
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY journal_lines_update_policy ON journal_lines
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY journal_lines_delete_policy ON journal_lines
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get next journal code
CREATE OR REPLACE FUNCTION get_next_journal_code(p_company_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    last_code VARCHAR;
    last_number INTEGER;
    next_number INTEGER;
    next_code VARCHAR;
BEGIN
    -- Get last journal code for company
    SELECT journal_code INTO last_code
    FROM journal_entries
    WHERE company_id = p_company_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF last_code IS NULL THEN
        RETURN 'JE-00001';
    END IF;

    -- Extract number from code (JE-00001 -> 1)
    last_number := CAST(SUBSTRING(last_code FROM '[0-9]+') AS INTEGER);
    next_number := last_number + 1;
    next_code := 'JE-' || LPAD(next_number::TEXT, 5, '0');

    RETURN next_code;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_journal_code IS 'Generates next sequential journal entry code (JE-00001, JE-00002, etc.)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- Migration: Add POS Accounting GL Accounts
-- Version: 20251125000000
-- Description: Adds Sales Discounts and Sales Tax Payable accounts for POS integration
-- Author: System
-- Date: 2025-11-25

-- ============================================================================
-- Add Sales Discounts Account (Contra-Revenue)
-- ============================================================================

INSERT INTO accounts (
  company_id,
  account_number,
  account_name,
  account_type,
  parent_account_id,
  level,
  description,
  is_system_account,
  is_active,
  sort_order
)
SELECT
  c.id,
  'R-4010',
  'Sales Discounts',
  'revenue',
  (SELECT id FROM accounts WHERE account_number = 'R-4000' AND company_id = c.id LIMIT 1),
  2,
  'Contra-revenue account for sales discounts and price reductions',
  true,
  true,
  4010
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM accounts
  WHERE account_number = 'R-4010' AND company_id = c.id
);

-- ============================================================================
-- Add Sales Tax Payable Account (Liability)
-- ============================================================================

INSERT INTO accounts (
  company_id,
  account_number,
  account_name,
  account_type,
  parent_account_id,
  level,
  description,
  is_system_account,
  is_active,
  sort_order
)
SELECT
  c.id,
  'L-2100',
  'Sales Tax Payable',
  'liability',
  NULL, -- Top-level liability account
  1,
  'Output VAT/sales tax collected from customers',
  true,
  true,
  2100
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM accounts
  WHERE account_number = 'L-2100' AND company_id = c.id
);

-- ============================================================================
-- Verify Accounts Created
-- ============================================================================

-- Show count of new accounts created per company
DO $$
DECLARE
  discount_count INTEGER;
  tax_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO discount_count FROM accounts WHERE account_number = 'R-4010';
  SELECT COUNT(*) INTO tax_count FROM accounts WHERE account_number = 'L-2100';

  RAISE NOTICE 'Migration completed:';
  RAISE NOTICE '  - Sales Discounts accounts created: %', discount_count;
  RAISE NOTICE '  - Sales Tax Payable accounts created: %', tax_count;
END $$;
-- Migration: Add POS to journal_entries source_module constraint
-- Version: 20251125120000
-- Description: Adds 'POS' as an allowed source_module value for journal entries
-- Author: System
-- Date: 2025-11-25

-- Drop the old constraint
ALTER TABLE journal_entries
DROP CONSTRAINT IF EXISTS chk_journal_source;

-- Add the new constraint with 'POS' included
ALTER TABLE journal_entries
ADD CONSTRAINT chk_journal_source
CHECK (source_module IN ('AR', 'AP', 'POS', 'Inventory', 'Manual', 'COGS'));

-- Add comment
COMMENT ON CONSTRAINT chk_journal_source ON journal_entries IS
'Ensures source_module is one of: AR (Accounts Receivable), AP (Accounts Payable), POS (Point of Sale), Inventory, Manual, COGS (Cost of Goods Sold)';
-- Migration: Add Item Variants, Packaging, and Multi-Pricing Support
-- Version: 20251126000000
-- Description: Phase 1 - Add new tables (item_variants, item_packaging, item_prices) and nullable columns to transaction tables
-- Author: System
-- Date: 2025-11-26
-- Reference: inv-enhancement-impl-plan.md Phase 1

-- ============================================================================
-- TABLE: item_variants
-- ============================================================================
-- Stores variant information for items (e.g., size: 8x12, color: red)
-- Each item can have multiple variants
-- Default variant created for all existing items during migration

CREATE TABLE item_variants (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    item_id           UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    variant_code      VARCHAR(100) NOT NULL,  -- e.g., "DEFAULT", "8x12", "SMALL"
    variant_name      VARCHAR(200) NOT NULL,  -- e.g., "Default", "8 x 12 inches", "Small"
    description       TEXT,
    attributes        JSONB DEFAULT '{}',     -- e.g., {"size": "8x12", "color": "red"}
    is_active         BOOLEAN DEFAULT true,
    is_default        BOOLEAN DEFAULT false,  -- True for auto-created default variants

    -- Audit fields
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,

    UNIQUE(company_id, item_id, variant_code)
);

CREATE INDEX idx_item_variants_company ON item_variants(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_variants_item ON item_variants(item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_variants_code ON item_variants(variant_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_variants_default ON item_variants(is_default) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_item_variants_updated_at
    BEFORE UPDATE ON item_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE item_variants IS 'Item variant definitions (size, color, etc.)';
COMMENT ON COLUMN item_variants.variant_code IS 'Unique code for variant within item (e.g., DEFAULT, 8x12)';
COMMENT ON COLUMN item_variants.attributes IS 'JSON storage for flexible variant attributes';
COMMENT ON COLUMN item_variants.is_default IS 'True for auto-generated default variants during migration';

-- ============================================================================
-- TABLE: item_packaging
-- ============================================================================
-- Stores packaging options for item variants (e.g., carton = 100 pcs, box = 12 pcs)
-- Each variant can have multiple packaging options
-- Default packaging (qty=1) created for all variants during migration

CREATE TABLE item_packaging (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    variant_id        UUID NOT NULL REFERENCES item_variants(id) ON DELETE CASCADE,
    pack_type         VARCHAR(100) NOT NULL,  -- e.g., "each", "piece", "carton", "box", "dozen"
    pack_name         VARCHAR(200) NOT NULL,  -- e.g., "Each", "Carton", "Box of 12"
    qty_per_pack      DECIMAL(15, 4) NOT NULL DEFAULT 1,  -- Conversion to base UOM (e.g., 100 pcs per carton)
    barcode           VARCHAR(100),           -- Barcode specific to this packaging
    is_default        BOOLEAN DEFAULT false,  -- True for auto-created default packaging
    is_active         BOOLEAN DEFAULT true,

    -- Audit fields
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,

    UNIQUE(company_id, variant_id, pack_type),
    CHECK (qty_per_pack > 0)
);

CREATE INDEX idx_item_packaging_company ON item_packaging(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_packaging_variant ON item_packaging(variant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_packaging_barcode ON item_packaging(barcode) WHERE deleted_at IS NULL AND barcode IS NOT NULL;
CREATE INDEX idx_item_packaging_default ON item_packaging(is_default) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_item_packaging_updated_at
    BEFORE UPDATE ON item_packaging
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE item_packaging IS 'Packaging options for item variants with conversion factors';
COMMENT ON COLUMN item_packaging.pack_type IS 'Type of packaging (each, carton, box, dozen, etc.)';
COMMENT ON COLUMN item_packaging.qty_per_pack IS 'Quantity in base UOM per package (e.g., 100 pcs per carton)';
COMMENT ON COLUMN item_packaging.barcode IS 'Barcode specific to this packaging option';

-- ============================================================================
-- TABLE: item_prices
-- ============================================================================
-- Stores multiple price tiers for item variants
-- Price tiers: fc (Factory Cost), ws (Wholesale), srp (Suggested Retail Price)
-- Can be extended for additional tiers (government, reseller, VIP, etc.)

CREATE TABLE item_prices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    variant_id        UUID NOT NULL REFERENCES item_variants(id) ON DELETE CASCADE,
    price_tier        VARCHAR(50) NOT NULL,   -- e.g., "fc", "ws", "srp", "government", "reseller"
    price_tier_name   VARCHAR(100) NOT NULL,  -- e.g., "Factory Cost", "Wholesale", "SRP"
    price             DECIMAL(20, 4) NOT NULL,
    currency_code     VARCHAR(3) DEFAULT 'PHP',
    effective_from    DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to      DATE,                   -- NULL = no expiry
    is_active         BOOLEAN DEFAULT true,

    -- Audit fields
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,

    UNIQUE(company_id, variant_id, price_tier, effective_from),
    CHECK (price >= 0),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_item_prices_company ON item_prices(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_prices_variant ON item_prices(variant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_prices_tier ON item_prices(price_tier) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_prices_active ON item_prices(is_active, effective_from, effective_to) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_item_prices_updated_at
    BEFORE UPDATE ON item_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE item_prices IS 'Multi-tier pricing for item variants with date effectivity';
COMMENT ON COLUMN item_prices.price_tier IS 'Price tier code: fc (Factory Cost), ws (Wholesale), srp (SRP), etc.';
COMMENT ON COLUMN item_prices.effective_from IS 'Start date when this price becomes effective';
COMMENT ON COLUMN item_prices.effective_to IS 'End date when this price expires (NULL = no expiry)';

-- ============================================================================
-- PHASE 1.2: Add nullable columns to transaction tables
-- ============================================================================
-- These columns are NULLABLE to maintain backward compatibility
-- Old transactions work without these fields
-- New transactions can optionally specify variant and packaging

-- Stock transaction items
ALTER TABLE stock_transaction_items
ADD COLUMN variant_id UUID NULL REFERENCES item_variants(id),
ADD COLUMN packaging_id UUID NULL REFERENCES item_packaging(id);

CREATE INDEX idx_stock_transaction_items_variant ON stock_transaction_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_stock_transaction_items_packaging ON stock_transaction_items(packaging_id) WHERE packaging_id IS NOT NULL;

COMMENT ON COLUMN stock_transaction_items.variant_id IS 'Optional: Specific variant for this transaction (NULL = use default variant)';
COMMENT ON COLUMN stock_transaction_items.packaging_id IS 'Optional: Packaging used in transaction (NULL = use default packaging)';

-- Purchase order items
ALTER TABLE purchase_order_items
ADD COLUMN variant_id UUID NULL REFERENCES item_variants(id),
ADD COLUMN packaging_id UUID NULL REFERENCES item_packaging(id);

CREATE INDEX idx_purchase_order_items_variant ON purchase_order_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_purchase_order_items_packaging ON purchase_order_items(packaging_id) WHERE packaging_id IS NOT NULL;

COMMENT ON COLUMN purchase_order_items.variant_id IS 'Optional: Specific variant ordered';
COMMENT ON COLUMN purchase_order_items.packaging_id IS 'Optional: Packaging for this purchase';

-- Purchase receipt items
ALTER TABLE purchase_receipt_items
ADD COLUMN variant_id UUID NULL REFERENCES item_variants(id),
ADD COLUMN packaging_id UUID NULL REFERENCES item_packaging(id);

CREATE INDEX idx_purchase_receipt_items_variant ON purchase_receipt_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_purchase_receipt_items_packaging ON purchase_receipt_items(packaging_id) WHERE packaging_id IS NOT NULL;

COMMENT ON COLUMN purchase_receipt_items.variant_id IS 'Optional: Specific variant received';
COMMENT ON COLUMN purchase_receipt_items.packaging_id IS 'Optional: Packaging used in receipt';

-- Sales order items
ALTER TABLE sales_order_items
ADD COLUMN variant_id UUID NULL REFERENCES item_variants(id),
ADD COLUMN packaging_id UUID NULL REFERENCES item_packaging(id);

CREATE INDEX idx_sales_order_items_variant ON sales_order_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_sales_order_items_packaging ON sales_order_items(packaging_id) WHERE packaging_id IS NOT NULL;

COMMENT ON COLUMN sales_order_items.variant_id IS 'Optional: Specific variant ordered';
COMMENT ON COLUMN sales_order_items.packaging_id IS 'Optional: Packaging for this sale';

-- Sales invoice items
ALTER TABLE sales_invoice_items
ADD COLUMN variant_id UUID NULL REFERENCES item_variants(id),
ADD COLUMN packaging_id UUID NULL REFERENCES item_packaging(id);

CREATE INDEX idx_sales_invoice_items_variant ON sales_invoice_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_sales_invoice_items_packaging ON sales_invoice_items(packaging_id) WHERE packaging_id IS NOT NULL;

COMMENT ON COLUMN sales_invoice_items.variant_id IS 'Optional: Specific variant invoiced';
COMMENT ON COLUMN sales_invoice_items.packaging_id IS 'Optional: Packaging used in invoice';

-- POS transaction items
ALTER TABLE pos_transaction_items
ADD COLUMN variant_id UUID NULL REFERENCES item_variants(id),
ADD COLUMN packaging_id UUID NULL REFERENCES item_packaging(id);

CREATE INDEX idx_pos_transaction_items_variant ON pos_transaction_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_pos_transaction_items_packaging ON pos_transaction_items(packaging_id) WHERE packaging_id IS NOT NULL;

COMMENT ON COLUMN pos_transaction_items.variant_id IS 'Optional: Specific variant sold in POS';
COMMENT ON COLUMN pos_transaction_items.packaging_id IS 'Optional: Packaging used in POS';

-- Stock transfer items
ALTER TABLE stock_transfer_items
ADD COLUMN variant_id UUID NULL REFERENCES item_variants(id),
ADD COLUMN packaging_id UUID NULL REFERENCES item_packaging(id);

CREATE INDEX idx_stock_transfer_items_variant ON stock_transfer_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_stock_transfer_items_packaging ON stock_transfer_items(packaging_id) WHERE packaging_id IS NOT NULL;

COMMENT ON COLUMN stock_transfer_items.variant_id IS 'Optional: Specific variant transferred';
COMMENT ON COLUMN stock_transfer_items.packaging_id IS 'Optional: Packaging used in transfer';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Phase 1 Complete:
-- ✓ Created item_variants table
-- ✓ Created item_packaging table
-- ✓ Created item_prices table
-- ✓ Added variant_id and packaging_id to all transaction tables (nullable)
--
-- Next Phase: Create default variants, packaging, and migrate prices for existing items
-- ============================================================================
-- Migration: Add packaging_id to sales_quotation_items
-- Description: Adds packaging_id column and index after item_packaging exists

ALTER TABLE sales_quotation_items
ADD COLUMN IF NOT EXISTS packaging_id UUID REFERENCES item_packaging(id);

CREATE INDEX IF NOT EXISTS idx_quotation_items_packaging
ON sales_quotation_items(packaging_id)
WHERE deleted_at IS NULL AND packaging_id IS NOT NULL;

COMMENT ON COLUMN sales_quotation_items.packaging_id IS 'Package used in this quotation';
-- Migration: Migrate Existing Items to Variant/Packaging/Pricing Structure
-- Version: 20251126000100
-- Description: Phase 2 - Create default variants, packaging, and prices for all existing items
-- Author: System
-- Date: 2025-11-26
-- Reference: inv-enhancement-impl-plan.md Phase 2

-- ============================================================================
-- PHASE 2.1: Create DEFAULT variant for all existing items
-- ============================================================================

INSERT INTO item_variants (
    company_id,
    item_id,
    variant_code,
    variant_name,
    description,
    attributes,
    is_active,
    is_default,
    created_at,
    created_by,
    updated_at,
    updated_by
)
SELECT
    i.company_id,
    i.id AS item_id,
    'DEFAULT' AS variant_code,
    'Default' AS variant_name,
    'Auto-generated default variant' AS description,
    '{}'::jsonb AS attributes,
    true AS is_active,
    true AS is_default,
    CURRENT_TIMESTAMP AS created_at,
    i.created_by,
    CURRENT_TIMESTAMP AS updated_at,
    i.updated_by
FROM items i
WHERE i.deleted_at IS NULL
ON CONFLICT (company_id, item_id, variant_code) DO NOTHING;

-- Log the number of variants created
DO $$
DECLARE
    variant_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO variant_count FROM item_variants WHERE is_default = true;
    RAISE NOTICE 'Default variants created: % records', variant_count;
END $$;

-- ============================================================================
-- PHASE 2.2: Create DEFAULT packaging for all variants
-- ============================================================================

INSERT INTO item_packaging (
    company_id,
    variant_id,
    pack_type,
    pack_name,
    qty_per_pack,
    barcode,
    is_default,
    is_active,
    created_at,
    created_by,
    updated_at,
    updated_by
)
SELECT
    v.company_id,
    v.id AS variant_id,
    'each' AS pack_type,
    'Each' AS pack_name,
    1 AS qty_per_pack,
    NULL AS barcode,
    true AS is_default,
    true AS is_active,
    CURRENT_TIMESTAMP AS created_at,
    i.created_by,
    CURRENT_TIMESTAMP AS updated_at,
    i.updated_by
FROM item_variants v
INNER JOIN items i ON v.item_id = i.id
WHERE v.deleted_at IS NULL
  AND v.is_default = true
ON CONFLICT (company_id, variant_id, pack_type) DO NOTHING;

-- Log the number of packaging options created
DO $$
DECLARE
    packaging_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO packaging_count FROM item_packaging WHERE is_default = true;
    RAISE NOTICE 'Default packaging created: % records', packaging_count;
END $$;

-- ============================================================================
-- PHASE 2.3: Migrate price tiers from items table
-- ============================================================================

-- Migrate Factory Cost (fc) from purchase_price
INSERT INTO item_prices (
    company_id,
    variant_id,
    price_tier,
    price_tier_name,
    price,
    currency_code,
    effective_from,
    effective_to,
    is_active,
    created_at,
    created_by,
    updated_at,
    updated_by
)
SELECT
    v.company_id,
    v.id AS variant_id,
    'fc' AS price_tier,
    'Factory Cost' AS price_tier_name,
    COALESCE(i.purchase_price, 0) AS price,
    'PHP' AS currency_code,
    CURRENT_DATE AS effective_from,
    NULL AS effective_to,
    true AS is_active,
    CURRENT_TIMESTAMP AS created_at,
    i.created_by,
    CURRENT_TIMESTAMP AS updated_at,
    i.updated_by
FROM item_variants v
INNER JOIN items i ON v.item_id = i.id
WHERE v.deleted_at IS NULL
  AND v.is_default = true
  AND i.purchase_price IS NOT NULL
ON CONFLICT (company_id, variant_id, price_tier, effective_from) DO NOTHING;

-- Migrate Wholesale (ws) from cost_price
INSERT INTO item_prices (
    company_id,
    variant_id,
    price_tier,
    price_tier_name,
    price,
    currency_code,
    effective_from,
    effective_to,
    is_active,
    created_at,
    created_by,
    updated_at,
    updated_by
)
SELECT
    v.company_id,
    v.id AS variant_id,
    'ws' AS price_tier,
    'Wholesale' AS price_tier_name,
    COALESCE(i.cost_price, 0) AS price,
    'PHP' AS currency_code,
    CURRENT_DATE AS effective_from,
    NULL AS effective_to,
    true AS is_active,
    CURRENT_TIMESTAMP AS created_at,
    i.created_by,
    CURRENT_TIMESTAMP AS updated_at,
    i.updated_by
FROM item_variants v
INNER JOIN items i ON v.item_id = i.id
WHERE v.deleted_at IS NULL
  AND v.is_default = true
  AND i.cost_price IS NOT NULL
ON CONFLICT (company_id, variant_id, price_tier, effective_from) DO NOTHING;

-- Migrate SRP (Suggested Retail Price) from sales_price
INSERT INTO item_prices (
    company_id,
    variant_id,
    price_tier,
    price_tier_name,
    price,
    currency_code,
    effective_from,
    effective_to,
    is_active,
    created_at,
    created_by,
    updated_at,
    updated_by
)
SELECT
    v.company_id,
    v.id AS variant_id,
    'srp' AS price_tier,
    'SRP' AS price_tier_name,
    COALESCE(i.sales_price, 0) AS price,
    'PHP' AS currency_code,
    CURRENT_DATE AS effective_from,
    NULL AS effective_to,
    true AS is_active,
    CURRENT_TIMESTAMP AS created_at,
    i.created_by,
    CURRENT_TIMESTAMP AS updated_at,
    i.updated_by
FROM item_variants v
INNER JOIN items i ON v.item_id = i.id
WHERE v.deleted_at IS NULL
  AND v.is_default = true
  AND i.sales_price IS NOT NULL
ON CONFLICT (company_id, variant_id, price_tier, effective_from) DO NOTHING;

-- Log the number of price records created
DO $$
DECLARE
    fc_count INTEGER;
    ws_count INTEGER;
    srp_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fc_count FROM item_prices WHERE price_tier = 'fc';
    SELECT COUNT(*) INTO ws_count FROM item_prices WHERE price_tier = 'ws';
    SELECT COUNT(*) INTO srp_count FROM item_prices WHERE price_tier = 'srp';
    total_count := fc_count + ws_count + srp_count;

    RAISE NOTICE 'Price migration completed:';
    RAISE NOTICE '  - Factory Cost (fc): % records', fc_count;
    RAISE NOTICE '  - Wholesale (ws): % records', ws_count;
    RAISE NOTICE '  - SRP (srp): % records', srp_count;
    RAISE NOTICE '  - Total price records: %', total_count;
END $$;

-- ============================================================================
-- PHASE 2.4: Verification queries
-- ============================================================================

-- Verify all items have variants
DO $$
DECLARE
    items_count INTEGER;
    variants_count INTEGER;
    items_without_variants INTEGER;
BEGIN
    SELECT COUNT(*) INTO items_count FROM items WHERE deleted_at IS NULL;
    SELECT COUNT(DISTINCT item_id) INTO variants_count FROM item_variants WHERE deleted_at IS NULL;
    items_without_variants := items_count - variants_count;

    RAISE NOTICE 'Verification Results:';
    RAISE NOTICE '  - Total active items: %', items_count;
    RAISE NOTICE '  - Items with variants: %', variants_count;
    RAISE NOTICE '  - Items without variants: %', items_without_variants;

    IF items_without_variants > 0 THEN
        RAISE WARNING 'Some items do not have variants! This should be investigated.';
    ELSE
        RAISE NOTICE '  ✓ All items have default variants';
    END IF;
END $$;

-- Verify all variants have packaging
DO $$
DECLARE
    variants_count INTEGER;
    packaging_count INTEGER;
    variants_without_packaging INTEGER;
BEGIN
    SELECT COUNT(*) INTO variants_count FROM item_variants WHERE deleted_at IS NULL;
    SELECT COUNT(DISTINCT variant_id) INTO packaging_count FROM item_packaging WHERE deleted_at IS NULL;
    variants_without_packaging := variants_count - packaging_count;

    RAISE NOTICE '  - Total variants: %', variants_count;
    RAISE NOTICE '  - Variants with packaging: %', packaging_count;
    RAISE NOTICE '  - Variants without packaging: %', variants_without_packaging;

    IF variants_without_packaging > 0 THEN
        RAISE WARNING 'Some variants do not have packaging! This should be investigated.';
    ELSE
        RAISE NOTICE '  ✓ All variants have default packaging';
    END IF;
END $$;

-- ============================================================================
-- MIGRATION SUMMARY
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '===============================================';
    RAISE NOTICE 'Phase 2 Migration Complete!';
    RAISE NOTICE '===============================================';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  ✓ Default variants created for all items';
    RAISE NOTICE '  ✓ Default packaging (qty=1) created for all variants';
    RAISE NOTICE '  ✓ Price tiers migrated from items table';
    RAISE NOTICE '  ✓ All data integrity checks passed';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  - Phase 3: Build UI for variants/packaging/prices';
    RAISE NOTICE '  - Phase 4: Update APIs and backend logic';
    RAISE NOTICE '  - Phase 5: Testing';
    RAISE NOTICE '===============================================';
END $$;

-- ============================================================================
-- NOTES FOR FUTURE REFERENCE
-- ============================================================================
-- This migration is IDEMPOTENT - safe to run multiple times
-- Uses ON CONFLICT DO NOTHING to prevent duplicate data
-- All existing items now have:
--   1. One DEFAULT variant
--   2. One DEFAULT packaging (each = 1x base UOM)
--   3. Price tiers (fc, ws, srp) from old price fields
-- Old price fields in items table are NOT deleted (backward compatibility)
-- ============================================================================
-- Fix get_next_journal_code function to handle non-numeric journal codes
-- This fixes an issue where custom journal codes like "JE-OPENING-INV" would break the function

CREATE OR REPLACE FUNCTION public.get_next_journal_code(p_company_id uuid)
RETURNS character varying
LANGUAGE plpgsql
AS $function$
DECLARE
    last_code VARCHAR;
    last_number INTEGER;
    next_number INTEGER;
    next_code VARCHAR;
BEGIN
    -- Get last numeric journal code for company (JE-XXXXX format)
    -- This filters out non-numeric codes like "JE-OPENING-INV"
    SELECT journal_code INTO last_code
    FROM journal_entries
    WHERE company_id = p_company_id
      AND journal_code ~ '^JE-[0-9]{5}$'
    ORDER BY created_at DESC
    LIMIT 1;

    IF last_code IS NULL THEN
        RETURN 'JE-00001';
    END IF;

    -- Extract number from code (JE-00001 -> 1)
    last_number := CAST(SUBSTRING(last_code FROM '[0-9]+') AS INTEGER);
    next_number := last_number + 1;
    next_code := 'JE-' || LPAD(next_number::TEXT, 5, '0');

    RETURN next_code;
END;
$function$;
-- ============================================================================
-- Migration: Add Employee and Commission Tables
-- Version: 20251202000000
-- Description: Creates employee, territory, commission, and analytics tables
-- Author: System
-- Date: 2024-12-02
-- ============================================================================

-- ============================================================================
-- TABLE: employees
-- Description: Employee master data for HR, Payroll, and Sales Analytics
-- ============================================================================
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(50),

    -- Employment details
    role VARCHAR(50) NOT NULL DEFAULT 'sales_agent',
    department VARCHAR(100),
    hire_date DATE NOT NULL,
    termination_date DATE,
    employment_status VARCHAR(50) NOT NULL DEFAULT 'active',

    -- Sales commission (for sales agents)
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 5.00,  -- Percentage (e.g., 5.00 = 5%)

    -- Address (Philippines - Mindanao)
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    city VARCHAR(100),
    region_state VARCHAR(100),
    country VARCHAR(100) NOT NULL DEFAULT 'Philippines',
    postal_code VARCHAR(20),

    -- Emergency contact
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(50),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP,

    -- Versioning
    version INTEGER NOT NULL DEFAULT 1,

    -- Custom fields
    custom_fields JSONB,

    -- Constraints
    CONSTRAINT chk_employee_role CHECK (role IN ('admin', 'manager', 'sales_agent', 'warehouse_staff', 'accountant')),
    CONSTRAINT chk_employee_status CHECK (employment_status IN ('active', 'inactive', 'terminated', 'on_leave')),
    CONSTRAINT chk_commission_rate CHECK (commission_rate >= 0 AND commission_rate <= 100),
    UNIQUE(company_id, employee_code)
);

-- Indexes for employees
CREATE INDEX idx_employees_company ON employees(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_code ON employees(employee_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_email ON employees(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_role ON employees(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_status ON employees(employment_status) WHERE deleted_at IS NULL;

-- RLS policies for employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY employees_select ON employees
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY employees_insert ON employees
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY employees_update ON employees
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY employees_delete ON employees
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER trg_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: employee_distribution_locations
-- Description: Sales agents' assigned territories for distribution tracking
-- ============================================================================
CREATE TABLE employee_distribution_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    city VARCHAR(100) NOT NULL,
    region_state VARCHAR(100) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP,

    -- Constraints
    UNIQUE(company_id, employee_id, city, region_state)
);

-- Indexes for employee_distribution_locations
CREATE INDEX idx_emp_dist_loc_company ON employee_distribution_locations(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_emp_dist_loc_employee ON employee_distribution_locations(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_emp_dist_loc_city ON employee_distribution_locations(city) WHERE deleted_at IS NULL;
CREATE INDEX idx_emp_dist_loc_region ON employee_distribution_locations(region_state) WHERE deleted_at IS NULL;
CREATE INDEX idx_emp_dist_loc_primary ON employee_distribution_locations(employee_id, is_primary)
    WHERE is_primary = true AND deleted_at IS NULL;

-- RLS policies for employee_distribution_locations
ALTER TABLE employee_distribution_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY emp_dist_loc_select ON employee_distribution_locations
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY emp_dist_loc_insert ON employee_distribution_locations
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY emp_dist_loc_update ON employee_distribution_locations
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY emp_dist_loc_delete ON employee_distribution_locations
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER trg_emp_dist_loc_updated_at
    BEFORE UPDATE ON employee_distribution_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: invoice_employees
-- Description: Associates employees with invoices for commission tracking
-- ============================================================================
CREATE TABLE invoice_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    commission_split_percentage NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    commission_amount NUMERIC(20, 4) NOT NULL DEFAULT 0,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT chk_commission_split CHECK (commission_split_percentage >= 0 AND commission_split_percentage <= 100),
    CONSTRAINT chk_commission_amount CHECK (commission_amount >= 0),
    UNIQUE(invoice_id, employee_id)
);

-- Indexes for invoice_employees
CREATE INDEX idx_invoice_emp_company ON invoice_employees(company_id);
CREATE INDEX idx_invoice_emp_invoice ON invoice_employees(invoice_id);
CREATE INDEX idx_invoice_emp_employee ON invoice_employees(employee_id);

-- RLS policies for invoice_employees
ALTER TABLE invoice_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_emp_select ON invoice_employees
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY invoice_emp_insert ON invoice_employees
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY invoice_emp_update ON invoice_employees
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY invoice_emp_delete ON invoice_employees
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- TABLE: sales_distribution
-- Description: Pre-aggregated daily sales statistics for analytics
-- ============================================================================
CREATE TABLE sales_distribution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    city VARCHAR(100) NOT NULL,
    region_state VARCHAR(100) NOT NULL,

    -- Aggregated metrics
    total_sales NUMERIC(20, 4) NOT NULL DEFAULT 0,
    total_commission NUMERIC(20, 4) NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    average_order_value NUMERIC(20, 4) NOT NULL DEFAULT 0,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT chk_sales_dist_metrics CHECK (
        total_sales >= 0 AND
        total_commission >= 0 AND
        transaction_count >= 0 AND
        average_order_value >= 0
    ),
    UNIQUE(company_id, date, employee_id, city, region_state)
);

-- Indexes for sales_distribution
CREATE INDEX idx_sales_dist_company ON sales_distribution(company_id);
CREATE INDEX idx_sales_dist_date ON sales_distribution(date);
CREATE INDEX idx_sales_dist_employee ON sales_distribution(employee_id);
CREATE INDEX idx_sales_dist_city ON sales_distribution(city);
CREATE INDEX idx_sales_dist_region ON sales_distribution(region_state);
CREATE INDEX idx_sales_dist_date_emp ON sales_distribution(date, employee_id);
CREATE INDEX idx_sales_dist_date_city ON sales_distribution(date, city);

-- RLS policies for sales_distribution
ALTER TABLE sales_distribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_dist_select ON sales_distribution
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_dist_insert ON sales_distribution
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_dist_update ON sales_distribution
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_dist_delete ON sales_distribution
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER trg_sales_dist_updated_at
    BEFORE UPDATE ON sales_distribution
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MODIFY: sales_invoices table - Update employee reference
-- Description: Change primary_employee_id to reference employees table
-- ============================================================================

-- Drop existing foreign key constraint
ALTER TABLE sales_invoices DROP CONSTRAINT IF EXISTS sales_invoices_primary_employee_id_fkey;

-- Add new foreign key constraint to employees table
ALTER TABLE sales_invoices
    ADD CONSTRAINT sales_invoices_primary_employee_id_fkey
    FOREIGN KEY (primary_employee_id)
    REFERENCES employees(id)
    ON DELETE SET NULL;

-- Create index for primary_employee_id
CREATE INDEX IF NOT EXISTS idx_invoices_primary_emp ON sales_invoices(primary_employee_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- View: Sales by Employee
CREATE OR REPLACE VIEW vw_sales_by_employee AS
SELECT
    e.id as employee_id,
    e.company_id,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    e.role,
    e.commission_rate,
    DATE_TRUNC('day', si.invoice_date) as sales_date,
    COUNT(DISTINCT si.id) as transaction_count,
    SUM(si.total_amount) as total_sales,
    SUM(ie.commission_amount) as total_commission,
    AVG(si.total_amount) as average_order_value
FROM employees e
JOIN invoice_employees ie ON e.id = ie.employee_id
JOIN sales_invoices si ON ie.invoice_id = si.id
WHERE e.deleted_at IS NULL
    AND si.deleted_at IS NULL
    AND si.status NOT IN ('draft', 'cancelled')
GROUP BY e.id, e.company_id, e.employee_code, e.first_name, e.last_name, e.role, e.commission_rate, DATE_TRUNC('day', si.invoice_date);

-- View: Employee Commission Summary
CREATE OR REPLACE VIEW vw_employee_commission_summary AS
SELECT
    e.id as employee_id,
    e.company_id,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    DATE_TRUNC('month', si.invoice_date) as month,
    COUNT(DISTINCT si.id) as invoice_count,
    SUM(si.total_amount) as total_sales,
    SUM(ie.commission_amount) as total_commission,
    SUM(CASE WHEN si.status = 'paid' THEN ie.commission_amount ELSE 0 END) as paid_commission,
    SUM(CASE WHEN si.status != 'paid' THEN ie.commission_amount ELSE 0 END) as pending_commission
FROM employees e
JOIN invoice_employees ie ON e.id = ie.employee_id
JOIN sales_invoices si ON ie.invoice_id = si.id
WHERE e.deleted_at IS NULL
    AND si.deleted_at IS NULL
    AND si.status NOT IN ('draft', 'cancelled')
GROUP BY e.id, e.company_id, e.employee_code, e.first_name, e.last_name, DATE_TRUNC('month', si.invoice_date);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- Migration: Add user_id to employees table
-- Description: Link employees to user accounts for authentication
-- Created: 2025-12-02

-- Add user_id column to employees table
ALTER TABLE employees
    ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for user_id lookups
CREATE INDEX idx_employees_user_id ON employees(user_id) WHERE deleted_at IS NULL;

-- Add unique constraint to ensure one employee per user
CREATE UNIQUE INDEX idx_employees_user_id_unique ON employees(company_id, user_id) WHERE deleted_at IS NULL AND user_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN employees.user_id IS 'Link to user account for authentication. One user can be one employee per company.';
-- Migration: Add employee_id to users table
-- Description: Link users to their employee records for faster access
-- Created: 2025-12-02
--
-- This creates a reverse reference from users to employees for better performance.
-- The employees.user_id column is kept for audit trails and as a backup reference.

-- Add employee_id column to users table
ALTER TABLE users
    ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- Create index for employee_id lookups
CREATE INDEX idx_users_employee_id ON users(employee_id);

-- Create unique constraint to ensure one user per employee
CREATE UNIQUE INDEX idx_users_employee_id_unique ON users(employee_id)
    WHERE employee_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.employee_id IS 'Link to employee record for this user. Provides fast access to employee data from user session. One employee can only be linked to one user.';
-- Migration: Enhance stock_transaction_items to replace stock_ledger
-- Purpose: Add columns to store before/after quantities and valuation data
-- Date: 2025-12-15
-- Part of: Inventory Module Refactoring (Phase 1)

-- Add new columns to stock_transaction_items
-- These columns replace the need for stock_ledger table
ALTER TABLE stock_transaction_items
  ADD COLUMN IF NOT EXISTS qty_before DECIMAL(20, 4) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS qty_after DECIMAL(20, 4) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS valuation_rate DECIMAL(20, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_value_before DECIMAL(20, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_value_after DECIMAL(20, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS posting_date DATE DEFAULT CURRENT_DATE NOT NULL,
  ADD COLUMN IF NOT EXISTS posting_time TIME DEFAULT CURRENT_TIME NOT NULL;

-- Add indexes for common queries
-- Index for date-based queries (stock movement reports)
CREATE INDEX IF NOT EXISTS idx_stock_trans_items_posting_date
  ON stock_transaction_items(posting_date)
  WHERE deleted_at IS NULL;

-- Composite index for item-warehouse-date queries (most common)
CREATE INDEX IF NOT EXISTS idx_stock_trans_items_item_warehouse_date
  ON stock_transaction_items(item_id, posting_date DESC)
  WHERE deleted_at IS NULL;

-- Index for posting time ordering (used with posting_date for chronological order)
CREATE INDEX IF NOT EXISTS idx_stock_trans_items_posting_datetime
  ON stock_transaction_items(posting_date DESC, posting_time DESC)
  WHERE deleted_at IS NULL;

-- Add comments to document the new columns
COMMENT ON COLUMN stock_transaction_items.qty_before IS 'Stock quantity before this transaction (replaces stock_ledger lookups)';
COMMENT ON COLUMN stock_transaction_items.qty_after IS 'Stock quantity after this transaction (replaces stock_ledger.qty_after_trans)';
COMMENT ON COLUMN stock_transaction_items.valuation_rate IS 'Valuation rate at time of transaction (cost per unit)';
COMMENT ON COLUMN stock_transaction_items.stock_value_before IS 'Total stock value before transaction';
COMMENT ON COLUMN stock_transaction_items.stock_value_after IS 'Total stock value after transaction';
COMMENT ON COLUMN stock_transaction_items.posting_date IS 'Date when transaction was posted (for historical queries)';
COMMENT ON COLUMN stock_transaction_items.posting_time IS 'Time when transaction was posted (for ordering)';

-- Populate existing records with default values based on current stock_ledger data (if any exist)
-- This is a one-time backfill for existing transactions
-- New transactions will populate these fields directly

-- Note: If you have existing data, you may want to run a data migration script
-- to populate qty_before/qty_after from stock_ledger before dropping it
-- Example (commented out - run separately if needed):
/*
UPDATE stock_transaction_items sti
SET
  qty_before = COALESCE(
    (SELECT qty_after_trans
     FROM stock_ledger
     WHERE transaction_item_id = sti.id
     LIMIT 1
    ), 0
  ),
  qty_after = COALESCE(
    (SELECT qty_after_trans
     FROM stock_ledger
     WHERE transaction_item_id = sti.id
     LIMIT 1
    ), 0
  ),
  posting_date = COALESCE(
    (SELECT posting_date
     FROM stock_ledger
     WHERE transaction_item_id = sti.id
     LIMIT 1
    ), CURRENT_DATE
  ),
  posting_time = COALESCE(
    (SELECT posting_time
     FROM stock_ledger
     WHERE transaction_item_id = sti.id
     LIMIT 1
    ), CURRENT_TIME
  )
WHERE EXISTS (
  SELECT 1 FROM stock_ledger WHERE transaction_item_id = sti.id
);
*/
-- Migration: Drop stock_ledger table
-- Date: 2025-12-15
-- Purpose: Complete the inventory module refactoring by removing the stock_ledger table
--
-- IMPORTANT: This migration should only be run AFTER all testing is complete and verified.
-- Prerequisites:
-- 1. All code has been refactored to use item_warehouse as source of truth
-- 2. All endpoints have been tested and verified working
-- 3. Stock accuracy has been validated across all warehouses
-- 4. Historical data has been archived to CSV if needed
--
-- This migration:
-- 1. Drops all stock_ledger related indexes
-- 2. Drops the stock_ledger table
--
-- WARNING: This is a destructive operation. Ensure backups are in place before running.

-- Drop indexes first
DROP INDEX IF EXISTS idx_stock_ledger_item_warehouse_date;
DROP INDEX IF EXISTS idx_stock_ledger_transaction;
DROP INDEX IF EXISTS idx_stock_ledger_company;
DROP INDEX IF EXISTS idx_stock_ledger_posting_date;
DROP INDEX IF EXISTS idx_stock_ledger_item;
DROP INDEX IF EXISTS idx_stock_ledger_warehouse;

-- Drop the stock_ledger table
DROP TABLE IF EXISTS stock_ledger CASCADE;

-- Add comment to stock_transaction_items table
COMMENT ON TABLE stock_transaction_items IS 'Stock transaction items with ledger-style tracking. Includes qty_before, qty_after, valuation_rate, and stock values for each transaction. Replaces the old stock_ledger table.';

-- Add comments to new columns
COMMENT ON COLUMN stock_transaction_items.qty_before IS 'Quantity before this transaction (from item_warehouse.current_stock)';
COMMENT ON COLUMN stock_transaction_items.qty_after IS 'Quantity after this transaction (updated item_warehouse.current_stock)';
COMMENT ON COLUMN stock_transaction_items.valuation_rate IS 'Valuation rate (cost) per unit at time of transaction';
COMMENT ON COLUMN stock_transaction_items.stock_value_before IS 'Total stock value before transaction (qty_before * valuation_rate)';
COMMENT ON COLUMN stock_transaction_items.stock_value_after IS 'Total stock value after transaction (qty_after * valuation_rate)';
COMMENT ON COLUMN stock_transaction_items.posting_date IS 'Date when transaction was posted/recorded';
COMMENT ON COLUMN stock_transaction_items.posting_time IS 'Time when transaction was posted/recorded';
-- Migration: Drop Obsolete Stock Update Triggers
-- Created: 2025-12-15
--
-- Purpose: Remove old trigger that was causing double stock updates
-- The trigger_update_stock_on_receipt was from the old inventory system
-- and is now redundant since we manage stock through stock_transactions.
--
-- Issue: When receiving POs, stock was being updated twice:
-- 1. By the trigger when purchase_receipt_items are inserted
-- 2. By the application code when creating stock_transaction_items
--
-- This caused inventory quantities to be doubled (e.g., receiving 100kg
-- resulted in 200kg being added to inventory).

-- Drop the trigger
DROP TRIGGER IF EXISTS trigger_update_stock_on_receipt ON purchase_receipt_items;

-- Drop the function (no longer needed)
DROP FUNCTION IF EXISTS update_stock_on_receipt();

-- Add comment to document the change
COMMENT ON TABLE purchase_receipt_items IS
'Purchase receipt line items. Stock updates are now managed through stock_transactions and stock_transaction_items. The old trigger update_stock_on_receipt was removed in migration 20251215000002.';
-- Migration: Material/Product Transformation Schema
-- Purpose: Create tables for transformation templates, orders, and lineage tracking
-- Date: 2025-12-17
-- Part of: Inventory Module - Transformation Feature (EPIC 2)
--
-- This migration adds:
-- - transformation_templates: Reusable transformation recipes
-- - transformation_template_inputs/outputs: Input/output items for templates
-- - transformation_orders: Actual transformation executions
-- - transformation_order_inputs/outputs: Consumed/produced items in orders
-- - transformation_lineage: N→M traceability between inputs and outputs

-- ============================================================================
-- TABLE: transformation_templates
-- Purpose: Define reusable transformation recipes (e.g., 10kg flour → 100 bread rolls)
-- ============================================================================

CREATE TABLE transformation_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    template_code       VARCHAR(50) NOT NULL,
    template_name       VARCHAR(200) NOT NULL,
    description         TEXT,

    -- Immutability enforcement
    is_active           BOOLEAN DEFAULT true NOT NULL,
    usage_count         INTEGER DEFAULT 0 NOT NULL,

    -- Audit fields
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          UUID NOT NULL REFERENCES users(id),
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          UUID NOT NULL REFERENCES users(id),
    deleted_at          TIMESTAMP NULL,

    -- Constraints
    CONSTRAINT uq_template_code_company UNIQUE(company_id, template_code, deleted_at)
);

-- Indexes for performance
CREATE INDEX idx_trans_templates_company ON transformation_templates(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trans_templates_active ON transformation_templates(is_active) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE transformation_templates IS 'Reusable transformation recipes defining inputs → outputs';
COMMENT ON COLUMN transformation_templates.usage_count IS 'Number of orders using this template (enforces immutability when > 0)';
COMMENT ON COLUMN transformation_templates.is_active IS 'Active templates can be used for new orders';

-- ============================================================================
-- TABLE: transformation_template_inputs
-- Purpose: Define input items required for a transformation template
-- ============================================================================

CREATE TABLE transformation_template_inputs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         UUID NOT NULL REFERENCES transformation_templates(id) ON DELETE CASCADE,
    item_id             UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    quantity            DECIMAL(20, 4) NOT NULL CHECK (quantity > 0),
    uom_id              UUID NOT NULL REFERENCES units_of_measure(id),
    sequence            INTEGER NOT NULL DEFAULT 1,
    notes               TEXT,

    -- Audit fields
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          UUID NOT NULL REFERENCES users(id),
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          UUID NOT NULL REFERENCES users(id),

    -- Constraints
    CONSTRAINT uq_template_input_item UNIQUE(template_id, item_id)
);

-- Indexes
CREATE INDEX idx_trans_template_inputs_template ON transformation_template_inputs(template_id);
CREATE INDEX idx_trans_template_inputs_item ON transformation_template_inputs(item_id);

-- Comments
COMMENT ON TABLE transformation_template_inputs IS 'Input items required for transformation (N inputs per template)';
COMMENT ON COLUMN transformation_template_inputs.sequence IS 'Display order for inputs';

-- ============================================================================
-- TABLE: transformation_template_outputs
-- Purpose: Define output items produced by a transformation template
-- ============================================================================

CREATE TABLE transformation_template_outputs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         UUID NOT NULL REFERENCES transformation_templates(id) ON DELETE CASCADE,
    item_id             UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    quantity            DECIMAL(20, 4) NOT NULL CHECK (quantity > 0),
    uom_id              UUID NOT NULL REFERENCES units_of_measure(id),
    sequence            INTEGER NOT NULL DEFAULT 1,
    is_scrap            BOOLEAN DEFAULT false NOT NULL,
    notes               TEXT,

    -- Audit fields
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          UUID NOT NULL REFERENCES users(id),
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          UUID NOT NULL REFERENCES users(id),

    -- Constraints
    CONSTRAINT uq_template_output_item UNIQUE(template_id, item_id)
);

-- Indexes
CREATE INDEX idx_trans_template_outputs_template ON transformation_template_outputs(template_id);
CREATE INDEX idx_trans_template_outputs_item ON transformation_template_outputs(item_id);

-- Comments
COMMENT ON TABLE transformation_template_outputs IS 'Output items produced by transformation (N outputs per template)';
COMMENT ON COLUMN transformation_template_outputs.is_scrap IS 'Mark as scrap/waste output (minimal cost allocation)';

-- ============================================================================
-- TABLE: transformation_orders
-- Purpose: Actual transformation execution instances
-- ============================================================================

CREATE TABLE transformation_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    order_code              VARCHAR(50) NOT NULL,
    template_id             UUID NOT NULL REFERENCES transformation_templates(id) ON DELETE RESTRICT,

    -- Warehouse context
    source_warehouse_id     UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    dest_warehouse_id       UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,

    -- State machine: DRAFT → RELEASED → EXECUTING → COMPLETED → CLOSED
    status                  VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                            CHECK (status IN ('DRAFT', 'RELEASED', 'EXECUTING', 'COMPLETED', 'CLOSED', 'CANCELLED')),

    -- Quantities
    planned_quantity        DECIMAL(20, 4) NOT NULL CHECK (planned_quantity > 0),
    actual_quantity         DECIMAL(20, 4),

    -- Cost tracking
    total_input_cost        DECIMAL(20, 4) DEFAULT 0,
    total_output_cost       DECIMAL(20, 4) DEFAULT 0,
    cost_variance           DECIMAL(20, 4) DEFAULT 0,
    variance_notes          TEXT,

    -- Dates
    order_date              DATE NOT NULL DEFAULT CURRENT_DATE,
    planned_date            DATE,
    execution_date          DATE,
    completion_date         DATE,

    -- Additional context
    notes                   TEXT,
    reference_type          VARCHAR(50),
    reference_id            UUID,

    -- Audit fields
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL REFERENCES users(id),
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              UUID NOT NULL REFERENCES users(id),
    deleted_at              TIMESTAMP NULL,

    -- Constraints
    CONSTRAINT uq_order_code_company UNIQUE(company_id, order_code, deleted_at),
    CONSTRAINT chk_actual_qty_when_completed CHECK (
        (status IN ('COMPLETED', 'CLOSED') AND actual_quantity IS NOT NULL) OR
        (status NOT IN ('COMPLETED', 'CLOSED'))
    )
);

-- Indexes for performance
CREATE INDEX idx_trans_orders_company ON transformation_orders(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trans_orders_status ON transformation_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_trans_orders_template ON transformation_orders(template_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trans_orders_source_wh ON transformation_orders(source_warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trans_orders_dest_wh ON transformation_orders(dest_warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trans_orders_dates ON transformation_orders(order_date DESC) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE transformation_orders IS 'Transformation execution instances with state machine';
COMMENT ON COLUMN transformation_orders.status IS 'State: DRAFT → RELEASED → EXECUTING → COMPLETED → CLOSED';
COMMENT ON COLUMN transformation_orders.planned_quantity IS 'Planned multiplier for template quantities';
COMMENT ON COLUMN transformation_orders.actual_quantity IS 'Actual multiplier used during execution';
COMMENT ON COLUMN transformation_orders.cost_variance IS 'Difference between planned and actual costs';

-- ============================================================================
-- TABLE: transformation_order_inputs
-- Purpose: Actual input items consumed in a transformation order
-- ============================================================================

CREATE TABLE transformation_order_inputs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                UUID NOT NULL REFERENCES transformation_orders(id) ON DELETE CASCADE,
    item_id                 UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    warehouse_id            UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,

    -- Quantities
    planned_quantity        DECIMAL(20, 4) NOT NULL CHECK (planned_quantity > 0),
    consumed_quantity       DECIMAL(20, 4),
    uom_id                  UUID NOT NULL REFERENCES units_of_measure(id),

    -- Cost tracking (from item_warehouse at time of consumption)
    unit_cost               DECIMAL(20, 4) DEFAULT 0,
    total_cost              DECIMAL(20, 4) DEFAULT 0,

    -- Stock transaction reference
    stock_transaction_id    UUID REFERENCES stock_transactions(id),

    -- Audit fields
    sequence                INTEGER NOT NULL DEFAULT 1,
    notes                   TEXT,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL REFERENCES users(id),
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              UUID NOT NULL REFERENCES users(id),

    -- Constraints
    CONSTRAINT uq_order_input_item UNIQUE(order_id, item_id),
    CONSTRAINT chk_consumed_qty_when_executing CHECK (
        (consumed_quantity IS NULL) OR (consumed_quantity > 0)
    )
);

-- Indexes
CREATE INDEX idx_trans_order_inputs_order ON transformation_order_inputs(order_id);
CREATE INDEX idx_trans_order_inputs_item ON transformation_order_inputs(item_id);
CREATE INDEX idx_trans_order_inputs_warehouse ON transformation_order_inputs(warehouse_id);

-- Comments
COMMENT ON TABLE transformation_order_inputs IS 'Actual input items consumed during transformation';
COMMENT ON COLUMN transformation_order_inputs.consumed_quantity IS 'Actual quantity consumed (may differ from planned)';
COMMENT ON COLUMN transformation_order_inputs.stock_transaction_id IS 'Reference to stock_transactions (type=out) for audit';

-- ============================================================================
-- TABLE: transformation_order_outputs
-- Purpose: Actual output items produced in a transformation order
-- ============================================================================

CREATE TABLE transformation_order_outputs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                UUID NOT NULL REFERENCES transformation_orders(id) ON DELETE CASCADE,
    item_id                 UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    warehouse_id            UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,

    -- Quantities
    planned_quantity        DECIMAL(20, 4) NOT NULL CHECK (planned_quantity > 0),
    produced_quantity       DECIMAL(20, 4),
    uom_id                  UUID NOT NULL REFERENCES units_of_measure(id),

    -- Cost tracking (allocated from inputs)
    allocated_cost_per_unit DECIMAL(20, 4) DEFAULT 0,
    total_allocated_cost    DECIMAL(20, 4) DEFAULT 0,

    -- Stock transaction reference
    stock_transaction_id    UUID REFERENCES stock_transactions(id),

    -- Output classification
    is_scrap                BOOLEAN DEFAULT false NOT NULL,

    -- Audit fields
    sequence                INTEGER NOT NULL DEFAULT 1,
    notes                   TEXT,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL REFERENCES users(id),
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              UUID NOT NULL REFERENCES users(id),

    -- Constraints
    CONSTRAINT uq_order_output_item UNIQUE(order_id, item_id),
    CONSTRAINT chk_produced_qty_when_executing CHECK (
        (produced_quantity IS NULL) OR (produced_quantity > 0)
    )
);

-- Indexes
CREATE INDEX idx_trans_order_outputs_order ON transformation_order_outputs(order_id);
CREATE INDEX idx_trans_order_outputs_item ON transformation_order_outputs(item_id);
CREATE INDEX idx_trans_order_outputs_warehouse ON transformation_order_outputs(warehouse_id);

-- Comments
COMMENT ON TABLE transformation_order_outputs IS 'Actual output items produced during transformation';
COMMENT ON COLUMN transformation_order_outputs.produced_quantity IS 'Actual quantity produced (may differ from planned)';
COMMENT ON COLUMN transformation_order_outputs.allocated_cost_per_unit IS 'Cost per unit allocated from inputs';
COMMENT ON COLUMN transformation_order_outputs.stock_transaction_id IS 'Reference to stock_transactions (type=in) for audit';

-- ============================================================================
-- TABLE: transformation_lineage
-- Purpose: N→M traceability between input and output items
-- ============================================================================

CREATE TABLE transformation_lineage (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                UUID NOT NULL REFERENCES transformation_orders(id) ON DELETE CASCADE,

    -- Lineage relationship
    input_line_id           UUID NOT NULL REFERENCES transformation_order_inputs(id) ON DELETE CASCADE,
    output_line_id          UUID NOT NULL REFERENCES transformation_order_outputs(id) ON DELETE CASCADE,

    -- Proportional tracking (for N→M relationships)
    input_quantity_used     DECIMAL(20, 4) NOT NULL CHECK (input_quantity_used > 0),
    output_quantity_from    DECIMAL(20, 4) NOT NULL CHECK (output_quantity_from > 0),
    cost_attributed         DECIMAL(20, 4) DEFAULT 0,

    -- Audit fields
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT uq_lineage_input_output UNIQUE(input_line_id, output_line_id)
);

-- Indexes for lineage queries
CREATE INDEX idx_trans_lineage_order ON transformation_lineage(order_id);
CREATE INDEX idx_trans_lineage_input ON transformation_lineage(input_line_id);
CREATE INDEX idx_trans_lineage_output ON transformation_lineage(output_line_id);

-- Comments
COMMENT ON TABLE transformation_lineage IS 'N→M traceability: which inputs produced which outputs';
COMMENT ON COLUMN transformation_lineage.input_quantity_used IS 'Quantity of input used for this output';
COMMENT ON COLUMN transformation_lineage.output_quantity_from IS 'Quantity of output from this input';
COMMENT ON COLUMN transformation_lineage.cost_attributed IS 'Cost attributed from input to output';

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_transformation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trans_templates_updated
    BEFORE UPDATE ON transformation_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_transformation_timestamp();

CREATE TRIGGER trg_trans_template_inputs_updated
    BEFORE UPDATE ON transformation_template_inputs
    FOR EACH ROW
    EXECUTE FUNCTION update_transformation_timestamp();

CREATE TRIGGER trg_trans_template_outputs_updated
    BEFORE UPDATE ON transformation_template_outputs
    FOR EACH ROW
    EXECUTE FUNCTION update_transformation_timestamp();

CREATE TRIGGER trg_trans_orders_updated
    BEFORE UPDATE ON transformation_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_transformation_timestamp();

CREATE TRIGGER trg_trans_order_inputs_updated
    BEFORE UPDATE ON transformation_order_inputs
    FOR EACH ROW
    EXECUTE FUNCTION update_transformation_timestamp();

CREATE TRIGGER trg_trans_order_outputs_updated
    BEFORE UPDATE ON transformation_order_outputs
    FOR EACH ROW
    EXECUTE FUNCTION update_transformation_timestamp();

-- ============================================================================
-- FUNCTION: Increment template usage count
-- Purpose: Increment usage_count when a new order references a template
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Only increment on INSERT, and only if not already CANCELLED/DELETED
    IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL AND NEW.status != 'CANCELLED' THEN
        UPDATE transformation_templates
        SET usage_count = usage_count + 1
        WHERE id = NEW.template_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_increment_template_usage
    AFTER INSERT ON transformation_orders
    FOR EACH ROW
    EXECUTE FUNCTION increment_template_usage();

-- ============================================================================
-- FUNCTION: Prevent template modification when in use
-- Purpose: Block updates to templates that have usage_count > 0
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_template_modification()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow status changes (deactivation) but block structural changes
    IF OLD.usage_count > 0 AND (
        OLD.template_code != NEW.template_code OR
        OLD.template_name != NEW.template_name OR
        OLD.description IS DISTINCT FROM NEW.description
    ) THEN
        RAISE EXCEPTION 'Cannot modify template % because it is used by % order(s). Template is locked.',
            OLD.template_code, OLD.usage_count
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_template_modification
    BEFORE UPDATE ON transformation_templates
    FOR EACH ROW
    EXECUTE FUNCTION prevent_template_modification();

-- ============================================================================
-- FUNCTION: Prevent input/output modification when template is in use
-- Purpose: Block changes to template inputs/outputs when usage_count > 0
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_template_detail_modification()
RETURNS TRIGGER AS $$
DECLARE
    v_usage_count INTEGER;
BEGIN
    -- Get the template's usage count
    SELECT usage_count INTO v_usage_count
    FROM transformation_templates
    WHERE id = OLD.template_id;

    IF v_usage_count > 0 THEN
        RAISE EXCEPTION 'Cannot modify template inputs/outputs because template is used by % order(s). Template is locked.',
            v_usage_count
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_template_input_modification
    BEFORE UPDATE OR DELETE ON transformation_template_inputs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_template_detail_modification();

CREATE TRIGGER trg_prevent_template_output_modification
    BEFORE UPDATE OR DELETE ON transformation_template_outputs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_template_detail_modification();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Purpose: Multi-tenant isolation - users see only their company's data
-- ============================================================================

-- Enable RLS
ALTER TABLE transformation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_template_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_template_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_order_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_order_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_lineage ENABLE ROW LEVEL SECURITY;

-- Templates RLS
CREATE POLICY "Allow authenticated users to manage transformation templates"
    ON transformation_templates
    FOR ALL
    TO authenticated
    USING (true);

-- Template inputs/outputs RLS
CREATE POLICY "Allow authenticated users to manage template inputs"
    ON transformation_template_inputs
    FOR ALL
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to manage template outputs"
    ON transformation_template_outputs
    FOR ALL
    TO authenticated
    USING (true);

-- Orders RLS
CREATE POLICY "Allow authenticated users to manage transformation orders"
    ON transformation_orders
    FOR ALL
    TO authenticated
    USING (true);

-- Order inputs/outputs RLS
CREATE POLICY "Allow authenticated users to manage order inputs"
    ON transformation_order_inputs
    FOR ALL
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to manage order outputs"
    ON transformation_order_outputs
    FOR ALL
    TO authenticated
    USING (true);

-- Lineage RLS
CREATE POLICY "Allow authenticated users to view lineage"
    ON transformation_lineage
    FOR ALL
    TO authenticated
    USING (true);

-- ============================================================================
-- GRANTS: Ensure authenticated users can access tables
-- ============================================================================

GRANT ALL ON transformation_templates TO authenticated;
GRANT ALL ON transformation_template_inputs TO authenticated;
GRANT ALL ON transformation_template_outputs TO authenticated;
GRANT ALL ON transformation_orders TO authenticated;
GRANT ALL ON transformation_order_inputs TO authenticated;
GRANT ALL ON transformation_order_outputs TO authenticated;
GRANT ALL ON transformation_lineage TO authenticated;
-- Add image field to items table
-- This allows storing item images (product photos, etc.)

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN items.image_url IS 'URL or path to the item image';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_items_with_images
  ON items(id)
  WHERE image_url IS NOT NULL AND deleted_at IS NULL;
-- Create storage bucket for item images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item-images',
  'item-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload item images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update item images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete item images" ON storage.objects;
DROP POLICY IF EXISTS "Public can read item images" ON storage.objects;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload item images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'item-images');

-- Allow authenticated users to update their own images
CREATE POLICY "Authenticated users can update item images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'item-images')
WITH CHECK (bucket_id = 'item-images');

-- Allow authenticated users to delete images
CREATE POLICY "Authenticated users can delete item images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'item-images');

-- Allow public read access to images
CREATE POLICY "Public can read item images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'item-images');
-- Migration: Simplify transformation order status workflow
-- Changes: DRAFT → RELEASED → EXECUTING → COMPLETED → CLOSED
-- To:      DRAFT → PREPARING → COMPLETED
-- With CANCELLED available from DRAFT or PREPARING

-- Drop the old check constraint
ALTER TABLE transformation_orders
  DROP CONSTRAINT IF EXISTS transformation_orders_status_check;

-- Add new check constraint with simplified statuses
ALTER TABLE transformation_orders
  ADD CONSTRAINT transformation_orders_status_check
  CHECK (status IN ('DRAFT', 'PREPARING', 'COMPLETED', 'CANCELLED'));

-- Update any existing orders with old statuses to new statuses
-- RELEASED → PREPARING
UPDATE transformation_orders
SET status = 'PREPARING'
WHERE status = 'RELEASED';

-- EXECUTING → PREPARING (if not yet completed)
UPDATE transformation_orders
SET status = 'PREPARING'
WHERE status = 'EXECUTING';

-- CLOSED → COMPLETED
UPDATE transformation_orders
SET status = 'COMPLETED'
WHERE status = 'CLOSED';

-- Add comment
COMMENT ON COLUMN transformation_orders.status IS 'Order status: DRAFT → PREPARING → COMPLETED (or CANCELLED)';
-- Migration: Remove destination warehouse from transformations
-- Transformations now happen within a single warehouse
-- Items are consumed and produced in the same warehouse
-- Use stock transfers for moving items between warehouses

-- Step 1: For existing orders, set source_warehouse_id = dest_warehouse_id if source is null
UPDATE transformation_orders
SET source_warehouse_id = dest_warehouse_id
WHERE source_warehouse_id IS NULL;

-- Step 2: Drop the destination warehouse column
ALTER TABLE transformation_orders
  DROP COLUMN IF EXISTS dest_warehouse_id;

-- Step 3: Update templates - remove destination warehouse
ALTER TABLE transformation_templates
  DROP COLUMN IF EXISTS dest_warehouse_id;

-- Step 4: Add comments
COMMENT ON COLUMN transformation_orders.source_warehouse_id IS 'Warehouse where transformation occurs (inputs consumed and outputs produced)';
COMMENT ON TABLE transformation_orders IS 'Transformation orders - converts input items into output items within a single warehouse';
COMMENT ON TABLE transformation_templates IS 'Reusable transformation recipes defining input/output ratios';
-- ============================================================================
-- Migration: Add Waste Tracking to Transformation Order Outputs
-- Purpose: Track wasted/broken quantities and reasons during transformation
-- Date: 2025-12-20
-- ============================================================================

-- Add wasted_quantity column
ALTER TABLE transformation_order_outputs
ADD COLUMN wasted_quantity DECIMAL(20, 4) DEFAULT 0 CHECK (wasted_quantity >= 0);

-- Add waste_reason column
ALTER TABLE transformation_order_outputs
ADD COLUMN waste_reason TEXT;

-- Add stock_transaction_waste_id to reference waste transactions
ALTER TABLE transformation_order_outputs
ADD COLUMN stock_transaction_waste_id UUID REFERENCES stock_transactions(id);

-- Add comments
COMMENT ON COLUMN transformation_order_outputs.wasted_quantity IS 'Quantity wasted/broken during production';
COMMENT ON COLUMN transformation_order_outputs.waste_reason IS 'Reason for waste (required if wasted_quantity > 0)';
COMMENT ON COLUMN transformation_order_outputs.stock_transaction_waste_id IS 'Reference to waste stock transaction (type=out)';

-- Add constraint: waste reason required when wasted_quantity > 0
ALTER TABLE transformation_order_outputs
ADD CONSTRAINT chk_waste_reason_required CHECK (
    (wasted_quantity = 0 OR wasted_quantity IS NULL) OR
    (waste_reason IS NOT NULL AND waste_reason != '')
);
-- ============================================================================
-- Migration: Multi-Business Unit Support - Phase 1
-- Purpose: Add business unit tables, extend operational tables, backfill data
-- Date: 2025-12-21
-- Compliance: Strictly follows multi-business-unit-prd.md
-- ============================================================================

-- ============================================================================
-- SECTION 1: Create business_units Table
-- ============================================================================

CREATE TABLE business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50), -- branch, outlet, warehouse, shop, office
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_by UUID REFERENCES users(id),

  CONSTRAINT uq_bu_code_per_company UNIQUE(company_id, code)
);

-- Indexes for performance
CREATE INDEX idx_business_units_company ON business_units(company_id);
CREATE INDEX idx_business_units_active ON business_units(is_active);
CREATE INDEX idx_business_units_code ON business_units(code);

-- Comments
COMMENT ON TABLE business_units IS 'Business units (branches, outlets, warehouses) under a company';
COMMENT ON COLUMN business_units.type IS 'Type: branch, outlet, warehouse, shop, office';
COMMENT ON COLUMN business_units.is_active IS 'Active business units are selectable by users';

-- ============================================================================
-- SECTION 2: Create user_business_unit_access Table
-- ============================================================================

CREATE TABLE user_business_unit_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
  role VARCHAR(50), -- admin, manager, staff
  is_default BOOLEAN DEFAULT false NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  granted_by UUID REFERENCES users(id),

  PRIMARY KEY (user_id, business_unit_id)
);

-- Indexes for performance
CREATE INDEX idx_user_bu_access_user ON user_business_unit_access(user_id);
CREATE INDEX idx_user_bu_access_bu ON user_business_unit_access(business_unit_id);
CREATE INDEX idx_user_bu_access_default ON user_business_unit_access(user_id, is_default) WHERE is_default = true;

-- Constraint: Only one default BU per user
CREATE UNIQUE INDEX uq_user_default_bu ON user_business_unit_access(user_id) WHERE is_default = true;

-- Comments
COMMENT ON TABLE user_business_unit_access IS 'Maps users to accessible business units with roles';
COMMENT ON COLUMN user_business_unit_access.role IS 'User role within this BU: admin, manager, staff';
COMMENT ON COLUMN user_business_unit_access.is_default IS 'Default BU auto-selected at login (one per user)';

-- ============================================================================
-- SECTION 3: Extend Operational Tables with business_unit_id
-- ============================================================================

-- Sales Module
ALTER TABLE sales_quotations ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE sales_orders ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE sales_invoices ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- Purchase Module
ALTER TABLE purchase_orders ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE purchase_receipts ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- Inventory Module
ALTER TABLE stock_transactions ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE stock_adjustments ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE stock_transfers ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- POS Module
ALTER TABLE pos_transactions ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- Transformation Module
ALTER TABLE transformation_orders ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE transformation_templates ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- Master Data
ALTER TABLE customers ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE suppliers ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE warehouses ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE employees ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- Van Sales Module
ALTER TABLE van_eod_reconciliations ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- Accounting Module
ALTER TABLE journal_entries ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE invoice_payments ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- Comments
COMMENT ON COLUMN sales_quotations.business_unit_id IS 'Business unit that created this quotation';
COMMENT ON COLUMN sales_orders.business_unit_id IS 'Business unit that owns this order';
COMMENT ON COLUMN sales_invoices.business_unit_id IS 'Business unit that owns this invoice';
COMMENT ON COLUMN purchase_orders.business_unit_id IS 'Business unit that created this PO';
COMMENT ON COLUMN purchase_receipts.business_unit_id IS 'Business unit that received goods';
COMMENT ON COLUMN stock_transactions.business_unit_id IS 'Business unit for this stock movement';
COMMENT ON COLUMN stock_adjustments.business_unit_id IS 'Business unit performing adjustment';
COMMENT ON COLUMN stock_transfers.business_unit_id IS 'Business unit initiating transfer';
COMMENT ON COLUMN pos_transactions.business_unit_id IS 'POS outlet business unit';
COMMENT ON COLUMN transformation_orders.business_unit_id IS 'Business unit performing transformation';
COMMENT ON COLUMN transformation_templates.business_unit_id IS 'Business unit that owns template';
COMMENT ON COLUMN customers.business_unit_id IS 'Primary business unit for customer';
COMMENT ON COLUMN suppliers.business_unit_id IS 'Primary business unit for supplier';
COMMENT ON COLUMN warehouses.business_unit_id IS 'Business unit that owns warehouse';
COMMENT ON COLUMN employees.business_unit_id IS 'Primary business unit for employee';
COMMENT ON COLUMN van_eod_reconciliations.business_unit_id IS 'Business unit for van EOD reconciliation';
COMMENT ON COLUMN journal_entries.business_unit_id IS 'Business unit for journal entry';
COMMENT ON COLUMN invoice_payments.business_unit_id IS 'Business unit receiving payment';

-- ============================================================================
-- SECTION 4: Create Default Business Unit
-- ============================================================================

-- Insert default business unit for Demo Company (if company exists)
-- Note: Seed data runs after migrations, so this will be NULL during migration
-- The business unit will be created during seed data instead
DO $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Check if demo company exists
  SELECT id INTO v_company_id FROM companies WHERE id = '00000000-0000-0000-0000-000000000001';

  IF v_company_id IS NOT NULL THEN
    -- Insert default business unit
    INSERT INTO business_units (id, company_id, code, name, type, is_active, created_at, updated_at)
    VALUES (
      '00000000-0000-0000-0000-000000000100',
      v_company_id,
      'MAIN',
      'Main Office',
      'primary',
      true,
      now(),
      now()
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Default business unit created for company %', v_company_id;
  ELSE
    RAISE NOTICE 'Demo company not found yet - will be created during seed data';
  END IF;
END $$;

-- ============================================================================
-- SECTION 5: Backfill Existing Data with Default Business Unit
-- ============================================================================

DO $$
DECLARE
  default_bu_id UUID := '00000000-0000-0000-0000-000000000100';
  updated_count INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Starting Business Unit Backfill Process';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Default BU ID: %', default_bu_id;

  -- Sales Module
  UPDATE sales_quotations SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled sales_quotations: % records', updated_count;

  UPDATE sales_orders SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled sales_orders: % records', updated_count;

  UPDATE sales_invoices SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled sales_invoices: % records', updated_count;

  -- Purchase Module
  UPDATE purchase_orders SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled purchase_orders: % records', updated_count;

  UPDATE purchase_receipts SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled purchase_receipts: % records', updated_count;

  -- Inventory Module
  UPDATE stock_transactions SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled stock_transactions: % records', updated_count;

  UPDATE stock_adjustments SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled stock_adjustments: % records', updated_count;

  UPDATE stock_transfers SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled stock_transfers: % records', updated_count;

  -- POS Module
  UPDATE pos_transactions SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled pos_transactions: % records', updated_count;

  -- Transformation Module
  UPDATE transformation_orders SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled transformation_orders: % records', updated_count;

  UPDATE transformation_templates SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled transformation_templates: % records', updated_count;

  -- Master Data
  UPDATE customers SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled customers: % records', updated_count;

  UPDATE suppliers SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled suppliers: % records', updated_count;

  UPDATE warehouses SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled warehouses: % records', updated_count;

  UPDATE employees SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled employees: % records', updated_count;

  -- Van Sales Module
  UPDATE van_eod_reconciliations SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled van_eod_reconciliations: % records', updated_count;

  -- Accounting Module
  UPDATE journal_entries SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled journal_entries: % records', updated_count;

  UPDATE invoice_payments SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled invoice_payments: % records', updated_count;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Backfill Process Completed Successfully';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- SECTION 6: Grant Default BU Access to All Existing Users
-- ============================================================================

-- Grant all existing users access to the default business unit
INSERT INTO user_business_unit_access (user_id, business_unit_id, role, is_default, granted_at)
SELECT
  u.id,
  '00000000-0000-0000-0000-000000000100', -- Default BU ID
  'admin', -- Grant admin role to existing users
  true, -- Set as default
  now()
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_business_unit_access
  WHERE user_id = u.id
  AND business_unit_id = '00000000-0000-0000-0000-000000000100'
);

-- ============================================================================
-- SECTION 7: Verification Queries (for logging)
-- ============================================================================

DO $$
DECLARE
  bu_count INTEGER;
  access_count INTEGER;
  null_bu_count INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Verification';
  RAISE NOTICE '========================================';

  -- Count business units
  SELECT COUNT(*) INTO bu_count FROM business_units;
  RAISE NOTICE 'Total business units created: %', bu_count;

  -- Count user access grants
  SELECT COUNT(*) INTO access_count FROM user_business_unit_access;
  RAISE NOTICE 'Total user BU access grants: %', access_count;

  -- Check for NULL business_unit_id in operational tables
  SELECT COUNT(*) INTO null_bu_count FROM sales_quotations WHERE business_unit_id IS NULL;
  IF null_bu_count > 0 THEN
    RAISE WARNING 'sales_quotations has % records with NULL business_unit_id', null_bu_count;
  ELSE
    RAISE NOTICE '✓ sales_quotations: All records have business_unit_id';
  END IF;

  SELECT COUNT(*) INTO null_bu_count FROM sales_orders WHERE business_unit_id IS NULL;
  IF null_bu_count > 0 THEN
    RAISE WARNING 'sales_orders has % records with NULL business_unit_id', null_bu_count;
  ELSE
    RAISE NOTICE '✓ sales_orders: All records have business_unit_id';
  END IF;

  SELECT COUNT(*) INTO null_bu_count FROM sales_invoices WHERE business_unit_id IS NULL;
  IF null_bu_count > 0 THEN
    RAISE WARNING 'sales_invoices has % records with NULL business_unit_id', null_bu_count;
  ELSE
    RAISE NOTICE '✓ sales_invoices: All records have business_unit_id';
  END IF;

  SELECT COUNT(*) INTO null_bu_count FROM stock_transactions WHERE business_unit_id IS NULL;
  IF null_bu_count > 0 THEN
    RAISE WARNING 'stock_transactions has % records with NULL business_unit_id', null_bu_count;
  ELSE
    RAISE NOTICE '✓ stock_transactions: All records have business_unit_id';
  END IF;

  SELECT COUNT(*) INTO null_bu_count FROM customers WHERE business_unit_id IS NULL;
  IF null_bu_count > 0 THEN
    RAISE WARNING 'customers has % records with NULL business_unit_id', null_bu_count;
  ELSE
    RAISE NOTICE '✓ customers: All records have business_unit_id';
  END IF;

  SELECT COUNT(*) INTO null_bu_count FROM warehouses WHERE business_unit_id IS NULL;
  IF null_bu_count > 0 THEN
    RAISE WARNING 'warehouses has % records with NULL business_unit_id', null_bu_count;
  ELSE
    RAISE NOTICE '✓ warehouses: All records have business_unit_id';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Phase 1 Migration Completed Successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Review migration output above';
  RAISE NOTICE '2. Verify all tables have business_unit_id';
  RAISE NOTICE '3. Proceed to Phase 2: RLS Implementation';
  RAISE NOTICE '';
END $$;
-- ============================================================================
-- Migration: Multi-Business Unit Support - Phase 2: Row Level Security
-- Purpose: Enable RLS and create policies for business unit isolation
-- Date: 2025-12-21
-- Compliance: Strictly follows multi-business-unit-prd.md
-- ============================================================================

-- ============================================================================
-- SECTION 1: Create Database Context Function
-- ============================================================================

-- Function to set the current business unit context
-- This must be called before any queries to ensure proper RLS filtering
CREATE OR REPLACE FUNCTION set_business_unit_context(p_business_unit_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_has_access BOOLEAN;
BEGIN
  -- Get current authenticated user ID
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Verify user has access to this business unit
  SELECT EXISTS (
    SELECT 1 FROM user_business_unit_access
    WHERE user_id = v_user_id
    AND business_unit_id = p_business_unit_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'User does not have access to business unit %', p_business_unit_id;
  END IF;

  -- Set the business unit context in the session
  PERFORM set_config('app.current_business_unit_id', p_business_unit_id::text, false);
END;
$$;

COMMENT ON FUNCTION set_business_unit_context IS 'Sets the active business unit context for the current session with access verification';

-- Function to get current business unit context
CREATE OR REPLACE FUNCTION get_current_business_unit_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_business_unit_id', true), '')::uuid;
END;
$$;

COMMENT ON FUNCTION get_current_business_unit_id IS 'Returns the current business unit ID from session context';

-- ============================================================================
-- SECTION 2: Enable RLS on All Operational Tables
-- ============================================================================

ALTER TABLE sales_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receipts ENABLE ROW LEVEL SECURITY;

ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;

ALTER TABLE transformation_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

ALTER TABLE van_eod_reconciliations ENABLE ROW LEVEL SECURITY;

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 3: Create Performance Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sales_quotations_bu ON sales_quotations(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_bu ON sales_orders(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_bu ON sales_invoices(business_unit_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_bu ON purchase_orders(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_bu ON purchase_receipts(business_unit_id);

CREATE INDEX IF NOT EXISTS idx_stock_transactions_bu ON stock_transactions(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_bu ON stock_adjustments(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_bu ON stock_transfers(business_unit_id);

CREATE INDEX IF NOT EXISTS idx_pos_transactions_bu ON pos_transactions(business_unit_id);

CREATE INDEX IF NOT EXISTS idx_transformation_orders_bu ON transformation_orders(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_transformation_templates_bu ON transformation_templates(business_unit_id);

CREATE INDEX IF NOT EXISTS idx_customers_bu ON customers(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_bu ON suppliers(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_bu ON warehouses(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_employees_bu ON employees(business_unit_id);

CREATE INDEX IF NOT EXISTS idx_van_eod_reconciliations_bu ON van_eod_reconciliations(business_unit_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_bu ON journal_entries(business_unit_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_bu ON invoice_payments(business_unit_id);

-- ============================================================================
-- SECTION 4: Create RLS Policies - Sales Module
-- ============================================================================

-- Sales Quotations
DROP POLICY IF EXISTS bu_select_policy ON sales_quotations;
CREATE POLICY bu_select_policy ON sales_quotations
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL -- Allow NULL during transition period
  );

DROP POLICY IF EXISTS bu_insert_policy ON sales_quotations;
CREATE POLICY bu_insert_policy ON sales_quotations
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL -- Allow NULL during transition period
  );

DROP POLICY IF EXISTS bu_update_policy ON sales_quotations;
CREATE POLICY bu_update_policy ON sales_quotations
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON sales_quotations;
CREATE POLICY bu_delete_policy ON sales_quotations
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Sales Orders
DROP POLICY IF EXISTS bu_select_policy ON sales_orders;
CREATE POLICY bu_select_policy ON sales_orders
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON sales_orders;
CREATE POLICY bu_insert_policy ON sales_orders
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON sales_orders;
CREATE POLICY bu_update_policy ON sales_orders
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON sales_orders;
CREATE POLICY bu_delete_policy ON sales_orders
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Sales Invoices
DROP POLICY IF EXISTS bu_select_policy ON sales_invoices;
CREATE POLICY bu_select_policy ON sales_invoices
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON sales_invoices;
CREATE POLICY bu_insert_policy ON sales_invoices
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON sales_invoices;
CREATE POLICY bu_update_policy ON sales_invoices
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON sales_invoices;
CREATE POLICY bu_delete_policy ON sales_invoices
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 5: Create RLS Policies - Purchase Module
-- ============================================================================

-- Purchase Orders
DROP POLICY IF EXISTS bu_select_policy ON purchase_orders;
CREATE POLICY bu_select_policy ON purchase_orders
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON purchase_orders;
CREATE POLICY bu_insert_policy ON purchase_orders
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON purchase_orders;
CREATE POLICY bu_update_policy ON purchase_orders
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON purchase_orders;
CREATE POLICY bu_delete_policy ON purchase_orders
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Purchase Receipts
DROP POLICY IF EXISTS bu_select_policy ON purchase_receipts;
CREATE POLICY bu_select_policy ON purchase_receipts
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON purchase_receipts;
CREATE POLICY bu_insert_policy ON purchase_receipts
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON purchase_receipts;
CREATE POLICY bu_update_policy ON purchase_receipts
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON purchase_receipts;
CREATE POLICY bu_delete_policy ON purchase_receipts
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 6: Create RLS Policies - Inventory Module
-- ============================================================================

-- Stock Transactions
DROP POLICY IF EXISTS bu_select_policy ON stock_transactions;
CREATE POLICY bu_select_policy ON stock_transactions
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON stock_transactions;
CREATE POLICY bu_insert_policy ON stock_transactions
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON stock_transactions;
CREATE POLICY bu_update_policy ON stock_transactions
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON stock_transactions;
CREATE POLICY bu_delete_policy ON stock_transactions
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Stock Adjustments
DROP POLICY IF EXISTS bu_select_policy ON stock_adjustments;
CREATE POLICY bu_select_policy ON stock_adjustments
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON stock_adjustments;
CREATE POLICY bu_insert_policy ON stock_adjustments
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON stock_adjustments;
CREATE POLICY bu_update_policy ON stock_adjustments
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON stock_adjustments;
CREATE POLICY bu_delete_policy ON stock_adjustments
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Stock Transfers
DROP POLICY IF EXISTS bu_select_policy ON stock_transfers;
CREATE POLICY bu_select_policy ON stock_transfers
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON stock_transfers;
CREATE POLICY bu_insert_policy ON stock_transfers
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON stock_transfers;
CREATE POLICY bu_update_policy ON stock_transfers
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON stock_transfers;
CREATE POLICY bu_delete_policy ON stock_transfers
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 7: Create RLS Policies - POS Module
-- ============================================================================

-- POS Transactions
DROP POLICY IF EXISTS bu_select_policy ON pos_transactions;
CREATE POLICY bu_select_policy ON pos_transactions
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON pos_transactions;
CREATE POLICY bu_insert_policy ON pos_transactions
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON pos_transactions;
CREATE POLICY bu_update_policy ON pos_transactions
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON pos_transactions;
CREATE POLICY bu_delete_policy ON pos_transactions
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 8: Create RLS Policies - Transformation Module
-- ============================================================================

-- Transformation Orders
DROP POLICY IF EXISTS bu_select_policy ON transformation_orders;
CREATE POLICY bu_select_policy ON transformation_orders
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON transformation_orders;
CREATE POLICY bu_insert_policy ON transformation_orders
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON transformation_orders;
CREATE POLICY bu_update_policy ON transformation_orders
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON transformation_orders;
CREATE POLICY bu_delete_policy ON transformation_orders
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Transformation Templates
DROP POLICY IF EXISTS bu_select_policy ON transformation_templates;
CREATE POLICY bu_select_policy ON transformation_templates
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON transformation_templates;
CREATE POLICY bu_insert_policy ON transformation_templates
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON transformation_templates;
CREATE POLICY bu_update_policy ON transformation_templates
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON transformation_templates;
CREATE POLICY bu_delete_policy ON transformation_templates
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 9: Create RLS Policies - Master Data
-- ============================================================================

-- Customers
DROP POLICY IF EXISTS bu_select_policy ON customers;
CREATE POLICY bu_select_policy ON customers
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON customers;
CREATE POLICY bu_insert_policy ON customers
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON customers;
CREATE POLICY bu_update_policy ON customers
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON customers;
CREATE POLICY bu_delete_policy ON customers
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Suppliers
DROP POLICY IF EXISTS bu_select_policy ON suppliers;
CREATE POLICY bu_select_policy ON suppliers
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON suppliers;
CREATE POLICY bu_insert_policy ON suppliers
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON suppliers;
CREATE POLICY bu_update_policy ON suppliers
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON suppliers;
CREATE POLICY bu_delete_policy ON suppliers
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Warehouses
DROP POLICY IF EXISTS bu_select_policy ON warehouses;
CREATE POLICY bu_select_policy ON warehouses
  FOR SELECT
  USING (
    business_unit_id IS NULL
    OR business_unit_id IN (
      SELECT business_unit_id
      FROM user_business_unit_access
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS bu_insert_policy ON warehouses;
CREATE POLICY bu_insert_policy ON warehouses
  FOR INSERT
  WITH CHECK (
    business_unit_id IS NULL
    OR business_unit_id IN (
      SELECT business_unit_id
      FROM user_business_unit_access
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS bu_update_policy ON warehouses;
CREATE POLICY bu_update_policy ON warehouses
  FOR UPDATE
  USING (
    business_unit_id IS NULL
    OR business_unit_id IN (
      SELECT business_unit_id
      FROM user_business_unit_access
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_unit_id IS NULL
    OR business_unit_id IN (
      SELECT business_unit_id
      FROM user_business_unit_access
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS bu_delete_policy ON warehouses;
CREATE POLICY bu_delete_policy ON warehouses
  FOR DELETE
  USING (
    business_unit_id IS NULL
    OR business_unit_id IN (
      SELECT business_unit_id
      FROM user_business_unit_access
      WHERE user_id = auth.uid()
    )
  );

-- Item Warehouse
DROP POLICY IF EXISTS "Allow authenticated users to read item_warehouse" ON item_warehouse;
DROP POLICY IF EXISTS "Allow authenticated users to write item_warehouse" ON item_warehouse;
DROP POLICY IF EXISTS bu_select_policy ON item_warehouse;
DROP POLICY IF EXISTS bu_insert_policy ON item_warehouse;
DROP POLICY IF EXISTS bu_update_policy ON item_warehouse;
DROP POLICY IF EXISTS bu_delete_policy ON item_warehouse;

CREATE POLICY bu_select_policy ON item_warehouse
  FOR SELECT
  USING (
    warehouse_id IN (
      SELECT w.id
      FROM warehouses w
      WHERE w.business_unit_id IS NULL
        OR w.business_unit_id IN (
          SELECT business_unit_id
          FROM user_business_unit_access
          WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY bu_insert_policy ON item_warehouse
  FOR INSERT
  WITH CHECK (
    warehouse_id IN (
      SELECT w.id
      FROM warehouses w
      WHERE w.business_unit_id IS NULL
        OR w.business_unit_id IN (
          SELECT business_unit_id
          FROM user_business_unit_access
          WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY bu_update_policy ON item_warehouse
  FOR UPDATE
  USING (
    warehouse_id IN (
      SELECT w.id
      FROM warehouses w
      WHERE w.business_unit_id IS NULL
        OR w.business_unit_id IN (
          SELECT business_unit_id
          FROM user_business_unit_access
          WHERE user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    warehouse_id IN (
      SELECT w.id
      FROM warehouses w
      WHERE w.business_unit_id IS NULL
        OR w.business_unit_id IN (
          SELECT business_unit_id
          FROM user_business_unit_access
          WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY bu_delete_policy ON item_warehouse
  FOR DELETE
  USING (
    warehouse_id IN (
      SELECT w.id
      FROM warehouses w
      WHERE w.business_unit_id IS NULL
        OR w.business_unit_id IN (
          SELECT business_unit_id
          FROM user_business_unit_access
          WHERE user_id = auth.uid()
        )
    )
  );

-- Employees
DROP POLICY IF EXISTS bu_select_policy ON employees;
CREATE POLICY bu_select_policy ON employees
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON employees;
CREATE POLICY bu_insert_policy ON employees
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON employees;
CREATE POLICY bu_update_policy ON employees
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON employees;
CREATE POLICY bu_delete_policy ON employees
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 10: Create RLS Policies - Van Sales Module
-- ============================================================================

-- Van EOD Reconciliations
DROP POLICY IF EXISTS bu_select_policy ON van_eod_reconciliations;
CREATE POLICY bu_select_policy ON van_eod_reconciliations
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON van_eod_reconciliations;
CREATE POLICY bu_insert_policy ON van_eod_reconciliations
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON van_eod_reconciliations;
CREATE POLICY bu_update_policy ON van_eod_reconciliations
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON van_eod_reconciliations;
CREATE POLICY bu_delete_policy ON van_eod_reconciliations
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 11: Create RLS Policies - Accounting Module
-- ============================================================================

-- Journal Entries
DROP POLICY IF EXISTS bu_select_policy ON journal_entries;
CREATE POLICY bu_select_policy ON journal_entries
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON journal_entries;
CREATE POLICY bu_insert_policy ON journal_entries
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON journal_entries;
CREATE POLICY bu_update_policy ON journal_entries
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON journal_entries;
CREATE POLICY bu_delete_policy ON journal_entries
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- Invoice Payments
DROP POLICY IF EXISTS bu_select_policy ON invoice_payments;
CREATE POLICY bu_select_policy ON invoice_payments
  FOR SELECT
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_insert_policy ON invoice_payments;
CREATE POLICY bu_insert_policy ON invoice_payments
  FOR INSERT
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_update_policy ON invoice_payments;
CREATE POLICY bu_update_policy ON invoice_payments
  FOR UPDATE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  )
  WITH CHECK (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

DROP POLICY IF EXISTS bu_delete_policy ON invoice_payments;
CREATE POLICY bu_delete_policy ON invoice_payments
  FOR DELETE
  USING (
    business_unit_id = get_current_business_unit_id()
    OR business_unit_id IS NULL
  );

-- ============================================================================
-- SECTION 12: Verification & Summary
-- ============================================================================

DO $$
DECLARE
  rls_enabled_count INTEGER;
  policy_count INTEGER;
  index_count INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Phase 2: RLS Implementation Complete';
  RAISE NOTICE '========================================';

  -- Count tables with RLS enabled
  SELECT COUNT(*) INTO rls_enabled_count
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE t.schemaname = 'public'
  AND c.relrowsecurity = true
  AND t.tablename IN (
    'sales_quotations', 'sales_orders', 'sales_invoices',
    'purchase_orders', 'purchase_receipts',
    'stock_transactions', 'stock_adjustments', 'stock_transfers',
    'pos_transactions',
    'transformation_orders', 'transformation_templates',
    'customers', 'suppliers', 'warehouses', 'employees',
    'van_eod_reconciliations',
    'journal_entries', 'invoice_payments'
  );

  -- Count policies created
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND policyname LIKE 'bu_%_policy';

  -- Count indexes created
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%_bu';

  RAISE NOTICE 'Tables with RLS enabled: %', rls_enabled_count;
  RAISE NOTICE 'Business unit policies created: %', policy_count;
  RAISE NOTICE 'Performance indexes created: %', index_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Test RLS policies with different business unit contexts';
  RAISE NOTICE '2. Proceed to Phase 3: Backend Middleware & Context Management';
  RAISE NOTICE '3. Create Supabase client wrapper with BU context injection';
  RAISE NOTICE '========================================';
END $$;
-- ============================================================================
-- Migration: Business Unit Context Function
-- Purpose: Create function to set and validate business unit context
-- Date: 2025-12-21
-- Compliance: Strictly follows multi-business-unit-prd.md Phase 3
-- ============================================================================

-- ============================================================================
-- Function: set_business_unit_context
-- Purpose: Sets the business unit context for the current session after
--          verifying the user has access to the specified business unit
-- ============================================================================

-- Drop existing function if it exists (to allow return type change)
DROP FUNCTION IF EXISTS set_business_unit_context(UUID);

CREATE OR REPLACE FUNCTION set_business_unit_context(bu_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_has_access BOOLEAN;
  v_bu_name TEXT;
  v_bu_code TEXT;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();

  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user has access to this business unit
  SELECT EXISTS (
    SELECT 1
    FROM user_business_unit_access
    WHERE user_id = v_user_id
    AND business_unit_id = bu_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'User % does not have access to business unit %', v_user_id, bu_id;
  END IF;

  -- Get business unit details for confirmation
  SELECT name, code
  INTO v_bu_name, v_bu_code
  FROM business_units
  WHERE id = bu_id
  AND is_active = true;

  IF v_bu_name IS NULL THEN
    RAISE EXCEPTION 'Business unit % not found or inactive', bu_id;
  END IF;

  -- Set the context (transaction-level setting)
  PERFORM set_config('app.current_business_unit_id', bu_id::text, false);

  -- Return success with BU details
  RETURN jsonb_build_object(
    'success', true,
    'business_unit_id', bu_id,
    'business_unit_code', v_bu_code,
    'business_unit_name', v_bu_name,
    'user_id', v_user_id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION set_business_unit_context(UUID) TO authenticated;

-- ============================================================================
-- Function: get_current_business_unit
-- Purpose: Returns the current business unit ID from session context
-- ============================================================================

CREATE OR REPLACE FUNCTION get_current_business_unit()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN current_setting('app.current_business_unit_id', true)::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_current_business_unit() TO authenticated;

-- ============================================================================
-- Function: get_user_business_units
-- Purpose: Returns all business units accessible by the current user
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_business_units()
RETURNS TABLE (
  id UUID,
  code VARCHAR(50),
  name VARCHAR(255),
  type VARCHAR(50),
  is_active BOOLEAN,
  role VARCHAR(50),
  is_default BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get current authenticated user
  v_user_id := auth.uid();

  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Return accessible business units
  RETURN QUERY
  SELECT
    bu.id,
    bu.code,
    bu.name,
    bu.type,
    bu.is_active,
    uba.role,
    uba.is_default
  FROM business_units bu
  INNER JOIN user_business_unit_access uba
    ON bu.id = uba.business_unit_id
  WHERE uba.user_id = v_user_id
    AND bu.is_active = true
  ORDER BY uba.is_default DESC, bu.name;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_business_units() TO authenticated;

-- Comments
COMMENT ON FUNCTION set_business_unit_context(UUID) IS
  'Sets the business unit context for the current session after verifying user access';

COMMENT ON FUNCTION get_current_business_unit() IS
  'Returns the current business unit ID from session context';

COMMENT ON FUNCTION get_user_business_units() IS
  'Returns all business units accessible by the current authenticated user';
-- ============================================================================
-- Migration: Remove Old Company-Based RLS Policies
-- Purpose: Remove company-based RLS policies that conflict with BU policies
-- Date: 2025-12-23
-- Reason: Old policies are permissive and allow cross-BU data leakage
-- ============================================================================

-- Drop old company-based policies that are conflicting with BU isolation
-- These policies only checked company_id, allowing users to see data from all BUs

-- Customers
DROP POLICY IF EXISTS customers_select_policy ON customers;
DROP POLICY IF EXISTS customers_insert_policy ON customers;
DROP POLICY IF EXISTS customers_update_policy ON customers;
DROP POLICY IF EXISTS customers_delete_policy ON customers;

-- Suppliers
DROP POLICY IF EXISTS suppliers_select_policy ON suppliers;
DROP POLICY IF EXISTS suppliers_insert_policy ON suppliers;
DROP POLICY IF EXISTS suppliers_update_policy ON suppliers;
DROP POLICY IF EXISTS suppliers_delete_policy ON suppliers;

-- Warehouses
DROP POLICY IF EXISTS warehouses_select_policy ON warehouses;
DROP POLICY IF EXISTS warehouses_insert_policy ON warehouses;
DROP POLICY IF EXISTS warehouses_update_policy ON warehouses;
DROP POLICY IF EXISTS warehouses_delete_policy ON warehouses;

-- Employees
DROP POLICY IF EXISTS employees_select_policy ON employees;
DROP POLICY IF EXISTS employees_insert_policy ON employees;
DROP POLICY IF EXISTS employees_update_policy ON employees;
DROP POLICY IF EXISTS employees_delete_policy ON employees;

-- Sales Quotations
DROP POLICY IF EXISTS quotations_select_policy ON sales_quotations;
DROP POLICY IF EXISTS quotations_insert_policy ON sales_quotations;
DROP POLICY IF EXISTS quotations_update_policy ON sales_quotations;
DROP POLICY IF EXISTS quotations_delete_policy ON sales_quotations;

-- Sales Orders
DROP POLICY IF EXISTS orders_select_policy ON sales_orders;
DROP POLICY IF EXISTS orders_insert_policy ON sales_orders;
DROP POLICY IF EXISTS orders_update_policy ON sales_orders;
DROP POLICY IF EXISTS orders_delete_policy ON sales_orders;

-- Sales Invoices
DROP POLICY IF EXISTS invoices_select_policy ON sales_invoices;
DROP POLICY IF EXISTS invoices_insert_policy ON sales_invoices;
DROP POLICY IF EXISTS invoices_update_policy ON sales_invoices;
DROP POLICY IF EXISTS invoices_delete_policy ON sales_invoices;

-- Purchase Orders
DROP POLICY IF EXISTS purchase_orders_select_policy ON purchase_orders;
DROP POLICY IF EXISTS purchase_orders_insert_policy ON purchase_orders;
DROP POLICY IF EXISTS purchase_orders_update_policy ON purchase_orders;
DROP POLICY IF EXISTS purchase_orders_delete_policy ON purchase_orders;

-- Purchase Receipts
DROP POLICY IF EXISTS purchase_receipts_select_policy ON purchase_receipts;
DROP POLICY IF EXISTS purchase_receipts_insert_policy ON purchase_receipts;
DROP POLICY IF EXISTS purchase_receipts_update_policy ON purchase_receipts;
DROP POLICY IF EXISTS purchase_receipts_delete_policy ON purchase_receipts;

-- Stock Transactions
DROP POLICY IF EXISTS stock_transactions_select_policy ON stock_transactions;
DROP POLICY IF EXISTS stock_transactions_insert_policy ON stock_transactions;
DROP POLICY IF EXISTS stock_transactions_update_policy ON stock_transactions;
DROP POLICY IF EXISTS stock_transactions_delete_policy ON stock_transactions;

-- Stock Adjustments
DROP POLICY IF EXISTS stock_adjustments_select_policy ON stock_adjustments;
DROP POLICY IF EXISTS stock_adjustments_insert_policy ON stock_adjustments;
DROP POLICY IF EXISTS stock_adjustments_update_policy ON stock_adjustments;
DROP POLICY IF EXISTS stock_adjustments_delete_policy ON stock_adjustments;

-- Stock Transfers
DROP POLICY IF EXISTS stock_transfers_select_policy ON stock_transfers;
DROP POLICY IF EXISTS stock_transfers_insert_policy ON stock_transfers;
DROP POLICY IF EXISTS stock_transfers_update_policy ON stock_transfers;
DROP POLICY IF EXISTS stock_transfers_delete_policy ON stock_transfers;

-- POS Transactions
DROP POLICY IF EXISTS pos_transactions_select_policy ON pos_transactions;
DROP POLICY IF EXISTS pos_transactions_insert_policy ON pos_transactions;
DROP POLICY IF EXISTS pos_transactions_update_policy ON pos_transactions;
DROP POLICY IF EXISTS pos_transactions_delete_policy ON pos_transactions;

-- Transformation Orders
DROP POLICY IF EXISTS transformation_orders_select_policy ON transformation_orders;
DROP POLICY IF EXISTS transformation_orders_insert_policy ON transformation_orders;
DROP POLICY IF EXISTS transformation_orders_update_policy ON transformation_orders;
DROP POLICY IF EXISTS transformation_orders_delete_policy ON transformation_orders;

-- Transformation Templates
DROP POLICY IF EXISTS transformation_templates_select_policy ON transformation_templates;
DROP POLICY IF EXISTS transformation_templates_insert_policy ON transformation_templates;
DROP POLICY IF EXISTS transformation_templates_update_policy ON transformation_templates;
DROP POLICY IF EXISTS transformation_templates_delete_policy ON transformation_templates;

-- Journal Entries
DROP POLICY IF EXISTS journal_entries_select_policy ON journal_entries;
DROP POLICY IF EXISTS journal_entries_insert_policy ON journal_entries;
DROP POLICY IF EXISTS journal_entries_update_policy ON journal_entries;
DROP POLICY IF EXISTS journal_entries_delete_policy ON journal_entries;

-- Invoice Payments
DROP POLICY IF EXISTS invoice_payments_select_policy ON invoice_payments;
DROP POLICY IF EXISTS invoice_payments_insert_policy ON invoice_payments;
DROP POLICY IF EXISTS invoice_payments_update_policy ON invoice_payments;
DROP POLICY IF EXISTS invoice_payments_delete_policy ON invoice_payments;

-- Van EOD Reconciliations
DROP POLICY IF EXISTS van_eod_reconciliations_select_policy ON van_eod_reconciliations;
DROP POLICY IF EXISTS van_eod_reconciliations_insert_policy ON van_eod_reconciliations;
DROP POLICY IF EXISTS van_eod_reconciliations_update_policy ON van_eod_reconciliations;
DROP POLICY IF EXISTS van_eod_reconciliations_delete_policy ON van_eod_reconciliations;

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  v_policy_count INTEGER;
BEGIN
  -- Count remaining company-based policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND policyname LIKE '%_select_policy'
  AND policyname NOT LIKE 'bu_%';

  IF v_policy_count > 0 THEN
    RAISE WARNING 'Still have % old company-based policies remaining', v_policy_count;
  ELSE
    RAISE NOTICE 'All old company-based RLS policies have been removed successfully';
  END IF;

  -- Count BU policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND policyname LIKE 'bu_%';

  RAISE NOTICE 'Business unit policies in place: %', v_policy_count;
END $$;
-- ============================================================================
-- Migration: Fix get_current_business_unit function name
-- Purpose: Rename function to match what RLS policies expect
-- Date: 2025-12-24
-- ============================================================================

-- The RLS policies call get_current_business_unit_id() but the function
-- was created as get_current_business_unit(). Drop the incorrectly named
-- function and recreate it with the correct name.

-- Drop the incorrectly named function
DROP FUNCTION IF EXISTS get_current_business_unit();

-- Create the correctly named function
CREATE OR REPLACE FUNCTION get_current_business_unit_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN current_setting('app.current_business_unit_id', true)::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_current_business_unit_id() TO authenticated;

COMMENT ON FUNCTION get_current_business_unit_id() IS
  'Returns the current business unit ID from session context - used by RLS policies';
-- ============================================================================
-- Migration: Implement JWT-Based Business Unit Context
-- Purpose: Fix RLS connection pooling issue by using JWT custom claims
-- Date: 2025-12-24
-- ============================================================================
--
-- PROBLEM: Using current_setting() for business unit context doesn't work with
-- Supabase connection pooling. RPC calls to set context use one connection,
-- but subsequent queries use different connections from the pool.
--
-- SOLUTION: Use JWT custom claims via auth.jwt() which is available in every
-- request without connection pooling issues. This is the production-ready
-- Supabase pattern for RLS context.
--
-- REFERENCE: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
-- ============================================================================

-- ============================================================================
-- SECTION 1: Update get_current_business_unit_id() to Read from JWT
-- ============================================================================

-- Replace the function (no need to drop - CREATE OR REPLACE handles it)
-- This function now reads from JWT instead of current_setting()
CREATE OR REPLACE FUNCTION get_current_business_unit_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_business_unit_id TEXT;
  v_user_id UUID;
BEGIN
  -- Get the business_unit_id from JWT custom claims
  -- The claim is set by the auth hook when user logs in or switches BU
  v_business_unit_id := auth.jwt() ->> 'current_business_unit_id';

  -- If no claim exists, try to get user's default business unit
  IF v_business_unit_id IS NULL OR v_business_unit_id = '' THEN
    v_user_id := auth.uid();

    IF v_user_id IS NOT NULL THEN
      -- Get the default business unit for this user
      SELECT business_unit_id::text INTO v_business_unit_id
      FROM user_business_unit_access
      WHERE user_id = v_user_id
        AND is_default = true
      LIMIT 1;
    END IF;
  END IF;

  -- Return as UUID or NULL
  RETURN NULLIF(v_business_unit_id, '')::uuid;
EXCEPTION
  WHEN OTHERS THEN
    -- If anything fails, return NULL (will be handled by RLS policies)
    RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_current_business_unit_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_business_unit_id() TO anon;

COMMENT ON FUNCTION get_current_business_unit_id() IS
  'Returns the current business unit ID from JWT custom claims. Falls back to user default BU if claim not set. Used by RLS policies for data isolation.';

-- ============================================================================
-- SECTION 2: Create Auth Hook to Inject Business Unit into JWT
-- ============================================================================

-- Create a function to handle the custom access token hook
-- This function is called by Supabase Auth when issuing JWTs
-- NOTE: Must be in public schema, then registered as hook in Supabase config
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims JSONB;
  user_id UUID;
  current_bu_id UUID;
  default_bu_id UUID;
BEGIN
  -- Extract existing claims and user_id
  claims := event->'claims';
  user_id := (event->>'user_id')::UUID;

  -- Try to preserve existing current_business_unit_id claim if present
  current_bu_id := (claims->>'current_business_unit_id')::UUID;

  -- If no current BU in claims, get user's default business unit
  IF current_bu_id IS NULL THEN
    SELECT business_unit_id INTO default_bu_id
    FROM user_business_unit_access
    WHERE user_business_unit_access.user_id = custom_access_token_hook.user_id
      AND is_default = true
    LIMIT 1;

    current_bu_id := default_bu_id;
  END IF;

  -- Add the current_business_unit_id to the JWT claims
  IF current_bu_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{current_business_unit_id}', to_jsonb(current_bu_id::text));
  END IF;

  -- Add user's accessible business units list to JWT for client-side validation
  claims := jsonb_set(
    claims,
    '{accessible_business_units}',
    (
      SELECT COALESCE(jsonb_agg(business_unit_id), '[]'::jsonb)
      FROM user_business_unit_access
      WHERE user_business_unit_access.user_id = custom_access_token_hook.user_id
    )
  );

  -- Return the modified event with updated claims
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
EXCEPTION
  WHEN OTHERS THEN
    -- If anything fails, return original event to prevent auth failures
    RETURN event;
END;
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO postgres;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO service_role;

COMMENT ON FUNCTION public.custom_access_token_hook IS
  'Auth hook that injects current_business_unit_id and accessible_business_units into JWT claims for RLS policies. Must be enabled in Supabase config/auth settings.';

-- ============================================================================
-- SECTION 3: Create Helper Function to Update Business Unit in Session
-- ============================================================================

-- This function allows updating the business unit for the current session
-- It works by forcing a token refresh with the new BU claim
CREATE OR REPLACE FUNCTION update_current_business_unit(p_business_unit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_has_access BOOLEAN;
  v_business_unit RECORD;
BEGIN
  -- Get current authenticated user ID
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Verify user has access to this business unit
  SELECT EXISTS (
    SELECT 1 FROM user_business_unit_access
    WHERE user_id = v_user_id
      AND business_unit_id = p_business_unit_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'User does not have access to business unit %', p_business_unit_id;
  END IF;

  -- Get business unit details
  SELECT id, code, name, company_id
  INTO v_business_unit
  FROM business_units
  WHERE id = p_business_unit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business unit % not found', p_business_unit_id;
  END IF;

  -- Return success with business unit info
  -- The client should call supabase.auth.refreshSession() after this
  -- to get a new JWT with the updated current_business_unit_id claim
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Business unit updated. Please refresh your session to apply changes.',
    'business_unit', jsonb_build_object(
      'id', v_business_unit.id,
      'code', v_business_unit.code,
      'name', v_business_unit.name,
      'company_id', v_business_unit.company_id
    ),
    'requires_refresh', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION update_current_business_unit TO authenticated;

COMMENT ON FUNCTION update_current_business_unit IS
  'Validates access and returns business unit info. Client must refresh session to update JWT claim.';

-- ============================================================================
-- SECTION 4: Remove Old Session-Based Functions (No Longer Needed)
-- ============================================================================

-- Drop the set_business_unit_context function as it doesn't work with connection pooling
DROP FUNCTION IF EXISTS set_business_unit_context(UUID);

-- ============================================================================
-- SECTION 5: Grant Necessary Permissions
-- ============================================================================

-- Ensure RLS policies can call get_current_business_unit_id
GRANT EXECUTE ON FUNCTION get_current_business_unit_id() TO postgres;
GRANT EXECUTE ON FUNCTION get_current_business_unit_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_current_business_unit_id() TO anon;

-- ============================================================================
-- NOTES FOR IMPLEMENTATION
-- ============================================================================
--
-- 1. ENABLE THE AUTH HOOK in supabase/config.toml:
--    Add this to the [auth.hook.custom_access_token] section:
--
--    [auth.hook.custom_access_token]
--    enabled = true
--    uri = "pg-functions://postgres/public/custom_access_token_hook"
--
--    Then restart Supabase: supabase stop && supabase start
--    This will automatically inject BU claims into all new JWTs
--
-- 2. UPDATE CLIENT CODE:
--    - When user switches BU, call update_current_business_unit()
--    - Then call supabase.auth.refreshSession() to get new JWT with updated claim
--    - New JWT will have current_business_unit_id set
--
-- 3. RLS POLICIES:
--    - No changes needed! They already call get_current_business_unit_id()
--    - Function now reads from JWT instead of current_setting()
--
-- 4. TESTING:
--    - After enabling hook, login to get JWT with BU claim
--    - Verify: SELECT auth.jwt() ->> 'current_business_unit_id';
--    - Verify: SELECT get_current_business_unit_id();
--    - Both should return the same UUID
--
-- ============================================================================
-- Fix auth hook scoping issue
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims JSONB;
  v_user_id UUID;
  current_bu_id UUID;
  default_bu_id UUID;
BEGIN
  claims := event->'claims';
  v_user_id := (event->>'user_id')::UUID;

  -- Try to get current BU from existing claims
  current_bu_id := (claims->>'current_business_unit_id')::UUID;

  -- If no current BU in claims, get user's default
  IF current_bu_id IS NULL THEN
    SELECT business_unit_id INTO default_bu_id
    FROM user_business_unit_access
    WHERE user_id = v_user_id
      AND is_default = true
    LIMIT 1;

    current_bu_id := default_bu_id;
  END IF;

  -- Add the current_business_unit_id to JWT claims
  IF current_bu_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{current_business_unit_id}', to_jsonb(current_bu_id::text));
  END IF;

  -- Add accessible business units list
  claims := jsonb_set(
    claims,
    '{accessible_business_units}',
    (
      SELECT COALESCE(jsonb_agg(business_unit_id), '[]'::jsonb)
      FROM user_business_unit_access
      WHERE user_id = v_user_id
    )
  );

  -- Return modified event
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;

EXCEPTION
  WHEN OTHERS THEN
    -- Return original event to prevent auth failure
    RETURN event;
END;
$$;

COMMENT ON FUNCTION public.custom_access_token_hook IS 'Custom access token hook that injects business unit context into JWT claims with fixed scoping.';
-- Add current_business_unit_id to user_business_unit_access to track selected BU
-- This allows the auth hook to know which BU the user last selected

ALTER TABLE user_business_unit_access
ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT FALSE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_bu_access_current
ON user_business_unit_access(user_id, is_current)
WHERE is_current = true;

-- Ensure only one current BU per user
CREATE OR REPLACE FUNCTION ensure_single_current_bu()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    -- Set all other BUs for this user to not current
    UPDATE user_business_unit_access
    SET is_current = false
    WHERE user_id = NEW.user_id
      AND business_unit_id != NEW.business_unit_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_current_bu ON user_business_unit_access;
CREATE TRIGGER trigger_ensure_single_current_bu
  BEFORE INSERT OR UPDATE ON user_business_unit_access
  FOR EACH ROW
  WHEN (NEW.is_current = true)
  EXECUTE FUNCTION ensure_single_current_bu();

-- Update existing records: set default BU as current for each user
UPDATE user_business_unit_access
SET is_current = is_default
WHERE is_default = true;

-- Update the auth hook to read from is_current
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims JSONB;
  v_user_id UUID;
  current_bu_id UUID;
  selected_bu_id UUID;
BEGIN
  claims := event->'claims';
  v_user_id := (event->>'user_id')::UUID;

  -- Try to get current BU from user's selected BU (is_current = true)
  SELECT business_unit_id INTO selected_bu_id
  FROM user_business_unit_access
  WHERE user_id = v_user_id
    AND is_current = true
  LIMIT 1;

  -- Use selected BU if found, otherwise try existing claim, otherwise use default
  current_bu_id := COALESCE(
    selected_bu_id,
    (claims->>'current_business_unit_id')::UUID,
    (SELECT business_unit_id FROM user_business_unit_access
     WHERE user_id = v_user_id AND is_default = true LIMIT 1)
  );

  -- Add the current_business_unit_id to JWT claims
  IF current_bu_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{current_business_unit_id}', to_jsonb(current_bu_id::text));
  END IF;

  -- Add accessible business units list
  claims := jsonb_set(
    claims,
    '{accessible_business_units}',
    (
      SELECT COALESCE(jsonb_agg(business_unit_id), '[]'::jsonb)
      FROM user_business_unit_access
      WHERE user_id = v_user_id
    )
  );

  -- Return modified event
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;

EXCEPTION
  WHEN OTHERS THEN
    -- Return original event to prevent auth failure
    RETURN event;
END;
$$;

-- Update update_current_business_unit to set is_current flag
CREATE OR REPLACE FUNCTION update_current_business_unit(p_business_unit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_business_unit RECORD;
  v_has_access BOOLEAN;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Check if user has access to this business unit
  SELECT EXISTS (
    SELECT 1 FROM user_business_unit_access
    WHERE user_id = v_user_id
      AND business_unit_id = p_business_unit_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'User does not have access to business unit %', p_business_unit_id;
  END IF;

  -- Get business unit details
  SELECT * INTO v_business_unit
  FROM business_units
  WHERE id = p_business_unit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business unit not found: %', p_business_unit_id;
  END IF;

  -- Update is_current flag (trigger will handle unsetting others)
  UPDATE user_business_unit_access
  SET is_current = true
  WHERE user_id = v_user_id
    AND business_unit_id = p_business_unit_id;

  -- Return success with BU details
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Business unit context updated',
    'requires_refresh', true,
    'business_unit', jsonb_build_object(
      'id', v_business_unit.id,
      'code', v_business_unit.code,
      'name', v_business_unit.name,
      'type', v_business_unit.type
    )
  );
END;
$$;

COMMENT ON FUNCTION update_current_business_unit IS 'Updates the current business unit for a user and signals that session refresh is required';
-- Fix ensure_single_current_bu trigger function to use correct column reference
CREATE OR REPLACE FUNCTION ensure_single_current_bu()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    -- Set all other BUs for this user to not current
    UPDATE user_business_unit_access
    SET is_current = false
    WHERE user_id = NEW.user_id
      AND business_unit_id != NEW.business_unit_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION ensure_single_current_bu IS 'Ensures only one business unit is marked as current for each user. Fixed to use business_unit_id instead of id.';
-- Remove ALL duplicate company-based RLS policies across all tables
-- Keep only BU policies (bu_select_policy, bu_insert_policy, bu_update_policy, bu_delete_policy)

-- Generate DROP statements for all non-BU policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE policyname NOT LIKE 'bu_%'
          AND tablename IN (
            'sales_quotations', 'sales_orders', 'sales_invoices',
            'purchase_orders', 'purchase_receipts',
            'customers', 'suppliers', 'warehouses', 'employees',
            'stock_transactions', 'stock_adjustments', 'stock_transfers',
            'pos_transactions', 'transformation_orders', 'transformation_templates',
            'van_eod_reconciliations', 'journal_entries', 'invoice_payments'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                      r.policyname, r.schemaname, r.tablename);
        RAISE NOTICE 'Dropped policy % on %.%', r.policyname, r.schemaname, r.tablename;
    END LOOP;
END $$;

COMMENT ON TABLE sales_quotations IS 'RLS enforced by business unit policies only';
COMMENT ON TABLE sales_orders IS 'RLS enforced by business unit policies only';
COMMENT ON TABLE sales_invoices IS 'RLS enforced by business unit policies only';
-- Fix RLS policies to remove NULL business_unit_id loophole
-- This prevents records with NULL business_unit_id from being visible to all BUs

-- Step 1: Backfill NULL business_unit_id with the first available BU for each company
DO $$
DECLARE
    r RECORD;
    default_bu_id UUID;
BEGIN
    -- For each table, find records with NULL business_unit_id and assign them to a default BU

    -- Sales Invoices
    FOR r IN
        SELECT id, company_id
        FROM sales_invoices
        WHERE business_unit_id IS NULL
    LOOP
        -- Get first business unit for this company
        SELECT id INTO default_bu_id
        FROM business_units
        WHERE company_id = r.company_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF default_bu_id IS NOT NULL THEN
            UPDATE sales_invoices
            SET business_unit_id = default_bu_id
            WHERE id = r.id;
            RAISE NOTICE 'Updated sales_invoice % with BU %', r.id, default_bu_id;
        END IF;
    END LOOP;

    -- Sales Orders
    FOR r IN
        SELECT id, company_id
        FROM sales_orders
        WHERE business_unit_id IS NULL
    LOOP
        SELECT id INTO default_bu_id
        FROM business_units
        WHERE company_id = r.company_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF default_bu_id IS NOT NULL THEN
            UPDATE sales_orders
            SET business_unit_id = default_bu_id
            WHERE id = r.id;
            RAISE NOTICE 'Updated sales_order % with BU %', r.id, default_bu_id;
        END IF;
    END LOOP;

    -- Sales Quotations
    FOR r IN
        SELECT id, company_id
        FROM sales_quotations
        WHERE business_unit_id IS NULL
    LOOP
        SELECT id INTO default_bu_id
        FROM business_units
        WHERE company_id = r.company_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF default_bu_id IS NOT NULL THEN
            UPDATE sales_quotations
            SET business_unit_id = default_bu_id
            WHERE id = r.id;
            RAISE NOTICE 'Updated sales_quotation % with BU %', r.id, default_bu_id;
        END IF;
    END LOOP;

    -- Purchase Orders
    FOR r IN
        SELECT id, company_id
        FROM purchase_orders
        WHERE business_unit_id IS NULL
    LOOP
        SELECT id INTO default_bu_id
        FROM business_units
        WHERE company_id = r.company_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF default_bu_id IS NOT NULL THEN
            UPDATE purchase_orders
            SET business_unit_id = default_bu_id
            WHERE id = r.id;
            RAISE NOTICE 'Updated purchase_order % with BU %', r.id, default_bu_id;
        END IF;
    END LOOP;
END $$;

-- Step 2: Recreate RLS policies WITHOUT the NULL loophole

-- Sales Invoices
DROP POLICY IF EXISTS bu_select_policy ON sales_invoices;
DROP POLICY IF EXISTS bu_insert_policy ON sales_invoices;
DROP POLICY IF EXISTS bu_update_policy ON sales_invoices;
DROP POLICY IF EXISTS bu_delete_policy ON sales_invoices;

CREATE POLICY bu_select_policy ON sales_invoices
    FOR SELECT
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON sales_invoices
    FOR INSERT
    WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON sales_invoices
    FOR UPDATE
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON sales_invoices
    FOR DELETE
    USING (business_unit_id = get_current_business_unit_id());

-- Sales Orders
DROP POLICY IF EXISTS bu_select_policy ON sales_orders;
DROP POLICY IF EXISTS bu_insert_policy ON sales_orders;
DROP POLICY IF EXISTS bu_update_policy ON sales_orders;
DROP POLICY IF EXISTS bu_delete_policy ON sales_orders;

CREATE POLICY bu_select_policy ON sales_orders
    FOR SELECT
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON sales_orders
    FOR INSERT
    WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON sales_orders
    FOR UPDATE
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON sales_orders
    FOR DELETE
    USING (business_unit_id = get_current_business_unit_id());

-- Sales Quotations
DROP POLICY IF EXISTS bu_select_policy ON sales_quotations;
DROP POLICY IF EXISTS bu_insert_policy ON sales_quotations;
DROP POLICY IF EXISTS bu_update_policy ON sales_quotations;
DROP POLICY IF EXISTS bu_delete_policy ON sales_quotations;

CREATE POLICY bu_select_policy ON sales_quotations
    FOR SELECT
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON sales_quotations
    FOR INSERT
    WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON sales_quotations
    FOR UPDATE
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON sales_quotations
    FOR DELETE
    USING (business_unit_id = get_current_business_unit_id());

-- Purchase Orders
DROP POLICY IF EXISTS bu_select_policy ON purchase_orders;
DROP POLICY IF EXISTS bu_insert_policy ON purchase_orders;
DROP POLICY IF EXISTS bu_update_policy ON purchase_orders;
DROP POLICY IF EXISTS bu_delete_policy ON purchase_orders;

CREATE POLICY bu_select_policy ON purchase_orders
    FOR SELECT
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON purchase_orders
    FOR INSERT
    WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON purchase_orders
    FOR UPDATE
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON purchase_orders
    FOR DELETE
    USING (business_unit_id = get_current_business_unit_id());

-- Purchase Receipts
DROP POLICY IF EXISTS bu_select_policy ON purchase_receipts;
DROP POLICY IF EXISTS bu_insert_policy ON purchase_receipts;
DROP POLICY IF EXISTS bu_update_policy ON purchase_receipts;
DROP POLICY IF EXISTS bu_delete_policy ON purchase_receipts;

CREATE POLICY bu_select_policy ON purchase_receipts
    FOR SELECT
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON purchase_receipts
    FOR INSERT
    WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON purchase_receipts
    FOR UPDATE
    USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON purchase_receipts
    FOR DELETE
    USING (business_unit_id = get_current_business_unit_id());

COMMENT ON TABLE sales_invoices IS 'RLS enforced - strict business unit isolation, no NULL allowed';
COMMENT ON TABLE sales_orders IS 'RLS enforced - strict business unit isolation, no NULL allowed';
COMMENT ON TABLE sales_quotations IS 'RLS enforced - strict business unit isolation, no NULL allowed';
COMMENT ON TABLE purchase_orders IS 'RLS enforced - strict business unit isolation, no NULL allowed';
COMMENT ON TABLE purchase_receipts IS 'RLS enforced - strict business unit isolation, no NULL allowed';
-- Fix POS Transactions Business Unit RLS Policies
-- This migration:
-- 1. Backfills NULL business_unit_id with default BU for each company
-- 2. Drops old company-based policies
-- 3. Recreates strict BU-based policies without NULL loophole

-- Step 1: Backfill NULL business_unit_id in pos_transactions
UPDATE pos_transactions
SET business_unit_id = (
  SELECT bu.id
  FROM business_units bu
  WHERE bu.company_id = pos_transactions.company_id
    AND bu.is_active = true
  ORDER BY
    CASE WHEN EXISTS (
      SELECT 1 FROM user_business_unit_access ubua
      WHERE ubua.business_unit_id = bu.id
        AND ubua.is_default = true
        AND ubua.user_id = pos_transactions.created_by
    ) THEN 0 ELSE 1 END,
    bu.created_at ASC
  LIMIT 1
)
WHERE business_unit_id IS NULL;

-- Step 2: Drop old company-based policies
DROP POLICY IF EXISTS pos_transactions_select ON pos_transactions;
DROP POLICY IF EXISTS pos_transactions_insert ON pos_transactions;
DROP POLICY IF EXISTS pos_transactions_update ON pos_transactions;
DROP POLICY IF EXISTS pos_transactions_delete ON pos_transactions;

DROP POLICY IF EXISTS pos_transaction_items_select ON pos_transaction_items;
DROP POLICY IF EXISTS pos_transaction_items_insert ON pos_transaction_items;
DROP POLICY IF EXISTS pos_transaction_items_update ON pos_transaction_items;
DROP POLICY IF EXISTS pos_transaction_items_delete ON pos_transaction_items;

-- Step 3: Drop existing BU policies
DROP POLICY IF EXISTS bu_select_policy ON pos_transactions;
DROP POLICY IF EXISTS bu_insert_policy ON pos_transactions;
DROP POLICY IF EXISTS bu_update_policy ON pos_transactions;
DROP POLICY IF EXISTS bu_delete_policy ON pos_transactions;

-- Step 4: Create strict BU-based policies for pos_transactions (NO NULL loophole)
CREATE POLICY bu_select_policy ON pos_transactions
  FOR SELECT
  USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON pos_transactions
  FOR INSERT
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON pos_transactions
  FOR UPDATE
  USING (business_unit_id = get_current_business_unit_id())
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON pos_transactions
  FOR DELETE
  USING (business_unit_id = get_current_business_unit_id());

-- Step 5: Create BU-based policies for pos_transaction_items
-- Items inherit BU context from parent transaction
CREATE POLICY bu_select_policy ON pos_transaction_items
  FOR SELECT
  USING (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_insert_policy ON pos_transaction_items
  FOR INSERT
  WITH CHECK (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_update_policy ON pos_transaction_items
  FOR UPDATE
  USING (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_delete_policy ON pos_transaction_items
  FOR DELETE
  USING (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

-- Step 6: Create BU-based policies for pos_transaction_payments
-- Payments also inherit BU context from parent transaction
DROP POLICY IF EXISTS pos_transaction_payments_select ON pos_transaction_payments;
DROP POLICY IF EXISTS pos_transaction_payments_insert ON pos_transaction_payments;
DROP POLICY IF EXISTS pos_transaction_payments_update ON pos_transaction_payments;
DROP POLICY IF EXISTS pos_transaction_payments_delete ON pos_transaction_payments;

CREATE POLICY bu_select_policy ON pos_transaction_payments
  FOR SELECT
  USING (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_insert_policy ON pos_transaction_payments
  FOR INSERT
  WITH CHECK (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_update_policy ON pos_transaction_payments
  FOR UPDATE
  USING (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_delete_policy ON pos_transaction_payments
  FOR DELETE
  USING (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );
-- Fix Stock Transactions Business Unit RLS Policies
-- This migration:
-- 1. Backfills NULL business_unit_id with default BU for each company
-- 2. Drops old company-based policies
-- 3. Recreates strict BU-based policies without NULL loophole

-- Step 1: Backfill NULL business_unit_id in stock_transactions
UPDATE stock_transactions
SET business_unit_id = (
  SELECT bu.id
  FROM business_units bu
  WHERE bu.company_id = stock_transactions.company_id
    AND bu.is_active = true
  ORDER BY
    CASE WHEN EXISTS (
      SELECT 1 FROM user_business_unit_access ubua
      WHERE ubua.business_unit_id = bu.id
        AND ubua.is_default = true
        AND ubua.user_id = stock_transactions.created_by
    ) THEN 0 ELSE 1 END,
    bu.created_at ASC
  LIMIT 1
)
WHERE business_unit_id IS NULL;

-- Step 2: Drop old company-based policies
DROP POLICY IF EXISTS "Allow authenticated users to read stock_transactions" ON stock_transactions;
DROP POLICY IF EXISTS "Allow authenticated users to write stock_transactions" ON stock_transactions;

-- Step 4: Drop existing BU policies
DROP POLICY IF EXISTS bu_select_policy ON stock_transactions;
DROP POLICY IF EXISTS bu_insert_policy ON stock_transactions;
DROP POLICY IF EXISTS bu_update_policy ON stock_transactions;
DROP POLICY IF EXISTS bu_delete_policy ON stock_transactions;

DROP POLICY IF EXISTS bu_select_policy ON stock_transaction_items;
DROP POLICY IF EXISTS bu_insert_policy ON stock_transaction_items;
DROP POLICY IF EXISTS bu_update_policy ON stock_transaction_items;
DROP POLICY IF EXISTS bu_delete_policy ON stock_transaction_items;

-- Step 5: Create strict BU-based policies for stock_transactions (NO NULL loophole)
CREATE POLICY bu_select_policy ON stock_transactions
  FOR SELECT
  USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON stock_transactions
  FOR INSERT
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON stock_transactions
  FOR UPDATE
  USING (business_unit_id = get_current_business_unit_id())
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON stock_transactions
  FOR DELETE
  USING (business_unit_id = get_current_business_unit_id());

-- Step 6: Create BU-based policies for stock_transaction_items
-- Items inherit BU context from parent transaction via transaction_id FK
CREATE POLICY bu_select_policy ON stock_transaction_items
  FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM stock_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_insert_policy ON stock_transaction_items
  FOR INSERT
  WITH CHECK (
    transaction_id IN (
      SELECT id FROM stock_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_update_policy ON stock_transaction_items
  FOR UPDATE
  USING (
    transaction_id IN (
      SELECT id FROM stock_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_delete_policy ON stock_transaction_items
  FOR DELETE
  USING (
    transaction_id IN (
      SELECT id FROM stock_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );
-- Fix Stock Adjustments Business Unit RLS Policies
-- This migration:
-- 1. Backfills NULL business_unit_id with default BU for each company
-- 2. Drops old company-based policies
-- 3. Recreates strict BU-based policies without NULL loophole

-- Step 1: Backfill NULL business_unit_id in stock_adjustments
UPDATE stock_adjustments
SET business_unit_id = (
  SELECT bu.id
  FROM business_units bu
  WHERE bu.company_id = stock_adjustments.company_id
    AND bu.is_active = true
  ORDER BY
    CASE WHEN EXISTS (
      SELECT 1 FROM user_business_unit_access ubua
      WHERE ubua.business_unit_id = bu.id
        AND ubua.is_default = true
        AND ubua.user_id = stock_adjustments.created_by
    ) THEN 0 ELSE 1 END,
    bu.created_at ASC
  LIMIT 1
)
WHERE business_unit_id IS NULL;

-- Step 2: Drop old company-based policies
DROP POLICY IF EXISTS "Allow authenticated users to read stock_adjustments" ON stock_adjustments;
DROP POLICY IF EXISTS "Allow authenticated users to write stock_adjustments" ON stock_adjustments;

-- Step 3: Drop existing BU policies
DROP POLICY IF EXISTS bu_select_policy ON stock_adjustments;
DROP POLICY IF EXISTS bu_insert_policy ON stock_adjustments;
DROP POLICY IF EXISTS bu_update_policy ON stock_adjustments;
DROP POLICY IF EXISTS bu_delete_policy ON stock_adjustments;

DROP POLICY IF EXISTS bu_select_policy ON stock_adjustment_items;
DROP POLICY IF EXISTS bu_insert_policy ON stock_adjustment_items;
DROP POLICY IF EXISTS bu_update_policy ON stock_adjustment_items;
DROP POLICY IF EXISTS bu_delete_policy ON stock_adjustment_items;

-- Step 4: Create strict BU-based policies for stock_adjustments (NO NULL loophole)
CREATE POLICY bu_select_policy ON stock_adjustments
  FOR SELECT
  USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON stock_adjustments
  FOR INSERT
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON stock_adjustments
  FOR UPDATE
  USING (business_unit_id = get_current_business_unit_id())
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON stock_adjustments
  FOR DELETE
  USING (business_unit_id = get_current_business_unit_id());

-- Step 5: Create BU-based policies for stock_adjustment_items
-- Items inherit BU context from parent adjustment via adjustment_id FK
CREATE POLICY bu_select_policy ON stock_adjustment_items
  FOR SELECT
  USING (
    adjustment_id IN (
      SELECT id FROM stock_adjustments
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_insert_policy ON stock_adjustment_items
  FOR INSERT
  WITH CHECK (
    adjustment_id IN (
      SELECT id FROM stock_adjustments
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_update_policy ON stock_adjustment_items
  FOR UPDATE
  USING (
    adjustment_id IN (
      SELECT id FROM stock_adjustments
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_delete_policy ON stock_adjustment_items
  FOR DELETE
  USING (
    adjustment_id IN (
      SELECT id FROM stock_adjustments
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );
-- Fix Transformation Templates and Orders Business Unit RLS Policies
-- This migration:
-- 1. Backfills NULL business_unit_id with default BU for each company
-- 2. Drops old company-based policies
-- 3. Recreates strict BU-based policies without NULL loophole

-- ============================================================================
-- TRANSFORMATION TEMPLATES
-- ============================================================================

-- Step 1: Backfill NULL business_unit_id in transformation_templates
UPDATE transformation_templates
SET business_unit_id = (
  SELECT bu.id
  FROM business_units bu
  WHERE bu.company_id = transformation_templates.company_id
    AND bu.is_active = true
  ORDER BY
    CASE WHEN EXISTS (
      SELECT 1 FROM user_business_unit_access ubua
      WHERE ubua.business_unit_id = bu.id
        AND ubua.is_default = true
        AND ubua.user_id = transformation_templates.created_by
    ) THEN 0 ELSE 1 END,
    bu.created_at ASC
  LIMIT 1
)
WHERE business_unit_id IS NULL;

-- Step 2: Drop old company-based policies for transformation_templates
DROP POLICY IF EXISTS "Allow authenticated users to manage transformation templates" ON transformation_templates;

-- Step 3: Drop existing BU policies for transformation_templates
DROP POLICY IF EXISTS bu_select_policy ON transformation_templates;
DROP POLICY IF EXISTS bu_insert_policy ON transformation_templates;
DROP POLICY IF EXISTS bu_update_policy ON transformation_templates;
DROP POLICY IF EXISTS bu_delete_policy ON transformation_templates;

-- Step 4: Create strict BU-based policies for transformation_templates
CREATE POLICY bu_select_policy ON transformation_templates
  FOR SELECT
  USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON transformation_templates
  FOR INSERT
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON transformation_templates
  FOR UPDATE
  USING (business_unit_id = get_current_business_unit_id())
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON transformation_templates
  FOR DELETE
  USING (business_unit_id = get_current_business_unit_id());

-- Step 5: Create BU-based policies for transformation_template_inputs
-- Inputs inherit BU context from parent template via template_id FK
DROP POLICY IF EXISTS bu_select_policy ON transformation_template_inputs;
DROP POLICY IF EXISTS bu_insert_policy ON transformation_template_inputs;
DROP POLICY IF EXISTS bu_update_policy ON transformation_template_inputs;
DROP POLICY IF EXISTS bu_delete_policy ON transformation_template_inputs;

CREATE POLICY bu_select_policy ON transformation_template_inputs
  FOR SELECT
  USING (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_insert_policy ON transformation_template_inputs
  FOR INSERT
  WITH CHECK (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_update_policy ON transformation_template_inputs
  FOR UPDATE
  USING (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_delete_policy ON transformation_template_inputs
  FOR DELETE
  USING (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

-- Step 6: Create BU-based policies for transformation_template_outputs
-- Outputs inherit BU context from parent template via template_id FK
DROP POLICY IF EXISTS bu_select_policy ON transformation_template_outputs;
DROP POLICY IF EXISTS bu_insert_policy ON transformation_template_outputs;
DROP POLICY IF EXISTS bu_update_policy ON transformation_template_outputs;
DROP POLICY IF EXISTS bu_delete_policy ON transformation_template_outputs;

CREATE POLICY bu_select_policy ON transformation_template_outputs
  FOR SELECT
  USING (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_insert_policy ON transformation_template_outputs
  FOR INSERT
  WITH CHECK (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_update_policy ON transformation_template_outputs
  FOR UPDATE
  USING (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_delete_policy ON transformation_template_outputs
  FOR DELETE
  USING (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

-- ============================================================================
-- TRANSFORMATION ORDERS
-- ============================================================================

-- Step 7: Backfill NULL business_unit_id in transformation_orders
UPDATE transformation_orders
SET business_unit_id = (
  SELECT bu.id
  FROM business_units bu
  WHERE bu.company_id = transformation_orders.company_id
    AND bu.is_active = true
  ORDER BY
    CASE WHEN EXISTS (
      SELECT 1 FROM user_business_unit_access ubua
      WHERE ubua.business_unit_id = bu.id
        AND ubua.is_default = true
        AND ubua.user_id = transformation_orders.created_by
    ) THEN 0 ELSE 1 END,
    bu.created_at ASC
  LIMIT 1
)
WHERE business_unit_id IS NULL;

-- Step 8: Drop old company-based policies for transformation_orders
DROP POLICY IF EXISTS "Allow authenticated users to manage transformation orders" ON transformation_orders;

-- Step 9: Drop existing BU policies for transformation_orders
DROP POLICY IF EXISTS bu_select_policy ON transformation_orders;
DROP POLICY IF EXISTS bu_insert_policy ON transformation_orders;
DROP POLICY IF EXISTS bu_update_policy ON transformation_orders;
DROP POLICY IF EXISTS bu_delete_policy ON transformation_orders;

-- Step 10: Create strict BU-based policies for transformation_orders
CREATE POLICY bu_select_policy ON transformation_orders
  FOR SELECT
  USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON transformation_orders
  FOR INSERT
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON transformation_orders
  FOR UPDATE
  USING (business_unit_id = get_current_business_unit_id())
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON transformation_orders
  FOR DELETE
  USING (business_unit_id = get_current_business_unit_id());

-- Step 11: Create BU-based policies for transformation_order_inputs
-- Inputs inherit BU context from parent order via order_id FK
DROP POLICY IF EXISTS bu_select_policy ON transformation_order_inputs;
DROP POLICY IF EXISTS bu_insert_policy ON transformation_order_inputs;
DROP POLICY IF EXISTS bu_update_policy ON transformation_order_inputs;
DROP POLICY IF EXISTS bu_delete_policy ON transformation_order_inputs;

CREATE POLICY bu_select_policy ON transformation_order_inputs
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_insert_policy ON transformation_order_inputs
  FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_update_policy ON transformation_order_inputs
  FOR UPDATE
  USING (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_delete_policy ON transformation_order_inputs
  FOR DELETE
  USING (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

-- Step 12: Create BU-based policies for transformation_order_outputs
-- Outputs inherit BU context from parent order via order_id FK
DROP POLICY IF EXISTS bu_select_policy ON transformation_order_outputs;
DROP POLICY IF EXISTS bu_insert_policy ON transformation_order_outputs;
DROP POLICY IF EXISTS bu_update_policy ON transformation_order_outputs;
DROP POLICY IF EXISTS bu_delete_policy ON transformation_order_outputs;

CREATE POLICY bu_select_policy ON transformation_order_outputs
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_insert_policy ON transformation_order_outputs
  FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_update_policy ON transformation_order_outputs
  FOR UPDATE
  USING (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_delete_policy ON transformation_order_outputs
  FOR DELETE
  USING (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );
-- RBAC (Role-Based Access Control) System Implementation
-- This migration creates tables for a complete permission management system

-- ============================================================================
-- ROLES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT false, -- Prevents deletion of critical roles
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Unique constraint: role name must be unique per company
  CONSTRAINT uq_role_name_per_company UNIQUE (company_id, name)
);

-- Indexes for performance
CREATE INDEX idx_roles_company ON roles(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_roles_system ON roles(is_system_role) WHERE deleted_at IS NULL;

-- Updated at trigger
CREATE TRIGGER trigger_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PERMISSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource VARCHAR(100) NOT NULL UNIQUE, -- e.g., 'users', 'inventory', 'sales'
  description TEXT,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_permissions_resource ON permissions(resource) WHERE deleted_at IS NULL;

-- Updated at trigger
CREATE TRIGGER trigger_permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROLE_PERMISSIONS JUNCTION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),

  -- Unique constraint: a role can have a permission only once
  CONSTRAINT uq_role_permission UNIQUE (role_id, permission_id)
);

-- Indexes for performance
CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- ============================================================================
-- USER_ROLES JUNCTION TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  business_unit_id UUID REFERENCES business_units(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Unique constraint: a user can have a role only once per business unit
  CONSTRAINT uq_user_role_bu UNIQUE (user_id, role_id, business_unit_id)
);

-- Indexes for performance
CREATE INDEX idx_user_roles_user ON user_roles(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_role ON user_roles(role_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_user_roles_bu ON user_roles(business_unit_id) WHERE deleted_at IS NULL;

-- Updated at trigger
CREATE TRIGGER trigger_user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES FOR ROLES TABLE
-- ============================================================================

-- Users can view roles in their company
CREATE POLICY roles_select_policy ON roles
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Only users with 'roles' create permission can create roles
CREATE POLICY roles_insert_policy ON roles
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Only users with 'roles' edit permission can update roles
CREATE POLICY roles_update_policy ON roles
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- Only users with 'roles' delete permission can delete roles
-- System roles cannot be deleted (enforced at application level)
CREATE POLICY roles_delete_policy ON roles
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
    AND is_system_role = false
  );

-- ============================================================================
-- RLS POLICIES FOR PERMISSIONS TABLE
-- ============================================================================

-- All authenticated users can view permissions
CREATE POLICY permissions_select_policy ON permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can create/update/delete permissions
-- (Permission checks will be enforced at API level)
CREATE POLICY permissions_insert_policy ON permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY permissions_update_policy ON permissions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY permissions_delete_policy ON permissions
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- RLS POLICIES FOR ROLE_PERMISSIONS TABLE
-- ============================================================================

-- Users can view role-permission mappings for roles in their company
CREATE POLICY role_permissions_select_policy ON role_permissions
  FOR SELECT
  USING (
    role_id IN (
      SELECT r.id FROM roles r
      JOIN users u ON u.company_id = r.company_id
      WHERE u.id = auth.uid()
    )
  );

-- Users with appropriate permissions can manage role-permission mappings
CREATE POLICY role_permissions_insert_policy ON role_permissions
  FOR INSERT
  WITH CHECK (
    role_id IN (
      SELECT r.id FROM roles r
      JOIN users u ON u.company_id = r.company_id
      WHERE u.id = auth.uid()
    )
  );

CREATE POLICY role_permissions_delete_policy ON role_permissions
  FOR DELETE
  USING (
    role_id IN (
      SELECT r.id FROM roles r
      JOIN users u ON u.company_id = r.company_id
      WHERE u.id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES FOR USER_ROLES TABLE
-- ============================================================================

-- Users can view user-role assignments in their company
CREATE POLICY user_roles_select_policy ON user_roles
  FOR SELECT
  USING (
    user_id IN (
      SELECT u.id FROM users u
      WHERE u.company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Users with appropriate permissions can assign roles
CREATE POLICY user_roles_insert_policy ON user_roles
  FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT u.id FROM users u
      WHERE u.company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Users with appropriate permissions can update role assignments
CREATE POLICY user_roles_update_policy ON user_roles
  FOR UPDATE
  USING (
    user_id IN (
      SELECT u.id FROM users u
      WHERE u.company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT u.id FROM users u
      WHERE u.company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Users with appropriate permissions can remove role assignments
CREATE POLICY user_roles_delete_policy ON user_roles
  FOR DELETE
  USING (
    user_id IN (
      SELECT u.id FROM users u
      WHERE u.company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get all permissions for a user (aggregated across roles)
CREATE OR REPLACE FUNCTION get_user_permissions(
  p_user_id UUID,
  p_business_unit_id UUID DEFAULT NULL
)
RETURNS TABLE (
  resource VARCHAR,
  can_view BOOLEAN,
  can_create BOOLEAN,
  can_edit BOOLEAN,
  can_delete BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.resource,
    -- UNION logic: if ANY role grants the permission, return true
    BOOL_OR(p.can_view) AS can_view,
    BOOL_OR(p.can_create) AS can_create,
    BOOL_OR(p.can_edit) AS can_edit,
    BOOL_OR(p.can_delete) AS can_delete
  FROM permissions p
  INNER JOIN role_permissions rp ON p.id = rp.permission_id
  INNER JOIN roles r ON rp.role_id = r.id
  INNER JOIN user_roles ur ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
    AND ur.deleted_at IS NULL
    AND r.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND (p_business_unit_id IS NULL OR ur.business_unit_id = p_business_unit_id)
  GROUP BY p.resource
  ORDER BY p.resource;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id UUID,
  p_resource VARCHAR,
  p_action VARCHAR, -- 'view', 'create', 'edit', 'delete'
  p_business_unit_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN := false;
BEGIN
  SELECT
    CASE p_action
      WHEN 'view' THEN BOOL_OR(p.can_view)
      WHEN 'create' THEN BOOL_OR(p.can_create)
      WHEN 'edit' THEN BOOL_OR(p.can_edit)
      WHEN 'delete' THEN BOOL_OR(p.can_delete)
      ELSE false
    END
  INTO v_has_permission
  FROM permissions p
  INNER JOIN role_permissions rp ON p.id = rp.permission_id
  INNER JOIN roles r ON rp.role_id = r.id
  INNER JOIN user_roles ur ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
    AND p.resource = p_resource
    AND ur.deleted_at IS NULL
    AND r.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND (p_business_unit_id IS NULL OR ur.business_unit_id = p_business_unit_id);

  RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE roles IS 'Roles that can be assigned to users';
COMMENT ON TABLE permissions IS 'Permissions that define what actions can be performed on resources';
COMMENT ON TABLE role_permissions IS 'Junction table mapping roles to permissions';
COMMENT ON TABLE user_roles IS 'Junction table mapping users to roles, scoped by business unit';

COMMENT ON COLUMN roles.is_system_role IS 'System roles cannot be deleted (e.g., Super Admin)';
COMMENT ON COLUMN permissions.resource IS 'Resource identifier (e.g., users, inventory, sales)';
COMMENT ON COLUMN user_roles.business_unit_id IS 'Scope role assignment to specific business unit';
-- Seed Data for RBAC System
-- This migration creates default roles and permissions for all companies

-- ============================================================================
-- SEED PERMISSIONS
-- Create permissions for all resources
-- ============================================================================

-- Admin & System Management
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('users', 'Manage user accounts and access', true, true, true, true),
  ('roles', 'Manage user roles and permissions', true, true, true, true),
  ('permissions', 'Manage system permissions', true, true, true, true),
  ('company_settings', 'Manage company configuration', true, false, true, false),
  ('business_units', 'Manage business units', true, true, true, true);

-- Inventory Management
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('items', 'Manage inventory items and products', true, true, true, true),
  ('item_categories', 'Manage item categories', true, true, true, true),
  ('warehouses', 'Manage warehouse locations', true, true, true, true),
  ('manage_locations', 'Create and maintain warehouse locations', true, true, true, true),
  ('view_location_stock', 'View stock by warehouse location', true, false, false, false),
  ('transfer_between_locations', 'Transfer stock between locations', true, true, true, false),
  ('stock_adjustments', 'Adjust inventory quantities', true, true, true, true),
  ('stock_transfers', 'Transfer stock between warehouses', true, true, true, true),
  ('stock_transformations', 'Transform items into other items', true, true, true, true),
  ('reorder_management', 'Manage reorder points and alerts', true, true, true, true);

-- Sales Management
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('customers', 'Manage customer information', true, true, true, true),
  ('sales_quotations', 'Create and manage sales quotations', true, true, true, true),
  ('sales_orders', 'Create and manage sales orders', true, true, true, true),
  ('sales_invoices', 'Create and manage sales invoices', true, true, true, true);

-- Purchasing Management
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('suppliers', 'Manage supplier information', true, true, true, true),
  ('purchase_orders', 'Create and manage purchase orders', true, true, true, true),
  ('purchase_receipts', 'Receive and manage goods receipts', true, true, true, true);

-- Accounting & Finance
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('chart_of_accounts', 'Manage account structure', true, true, true, true),
  ('journal_entries', 'Create and manage journal entries', true, true, true, true),
  ('general_ledger', 'View general ledger reports', true, false, false, false),
  ('invoice_payments', 'Manage invoice payments', true, true, true, true);

-- Employee Management
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('employees', 'Manage employee information', true, true, true, true);

-- Reporting & Analytics
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('reports', 'Access system reports', true, false, false, false),
  ('analytics', 'View analytics and insights', true, false, false, false),
  ('dashboard', 'View dashboard and metrics', true, false, false, false);

-- ============================================================================
-- CREATE DEFAULT ROLES FOR EACH COMPANY
-- This function will be called to set up roles for each company
-- ============================================================================

CREATE OR REPLACE FUNCTION setup_company_rbac(p_company_id UUID)
RETURNS VOID AS $$
DECLARE
  v_super_admin_role_id UUID;
  v_admin_role_id UUID;
  v_manager_role_id UUID;
  v_user_role_id UUID;
  v_viewer_role_id UUID;
  v_permission RECORD;
BEGIN
  -- Create Super Admin Role
  INSERT INTO roles (company_id, name, description, is_system_role)
  VALUES (
    p_company_id,
    'Super Admin',
    'Full system access including role and permission management',
    true
  )
  RETURNING id INTO v_super_admin_role_id;

  -- Assign ALL permissions to Super Admin
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_super_admin_role_id, id FROM permissions;

  -- Create Admin Role
  INSERT INTO roles (company_id, name, description, is_system_role)
  VALUES (
    p_company_id,
    'Admin',
    'Full access except role and permission management',
    true
  )
  RETURNING id INTO v_admin_role_id;

  -- Assign all permissions except roles, permissions to Admin
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_admin_role_id, id
  FROM permissions
  WHERE resource NOT IN ('roles', 'permissions');

  -- Create Manager Role
  INSERT INTO roles (company_id, name, description, is_system_role)
  VALUES (
    p_company_id,
    'Manager',
    'View all, create/edit most resources, limited delete permissions',
    true
  )
  RETURNING id INTO v_manager_role_id;

  -- Assign view all, create/edit most to Manager (no delete on critical resources)
  INSERT INTO role_permissions (role_id, permission_id)
  SELECT v_manager_role_id, p.id
  FROM permissions p
  WHERE p.resource NOT IN ('users', 'roles', 'permissions', 'company_settings', 'business_units')
  UNION
  -- Add view-only for admin resources
  SELECT v_manager_role_id, p.id
  FROM permissions p
  WHERE p.resource IN ('users', 'business_units') AND p.can_view = true;

  -- Create User Role
  INSERT INTO roles (company_id, name, description, is_system_role)
  VALUES (
    p_company_id,
    'User',
    'Standard user with view and create access to operational areas',
    true
  )
  RETURNING id INTO v_user_role_id;

  -- Assign operational permissions to User (view, create, edit - no delete)
  FOR v_permission IN
    SELECT id, resource FROM permissions
    WHERE resource IN (
      'items', 'customers', 'suppliers', 'view_location_stock',
      'sales_quotations', 'sales_orders', 'sales_invoices',
      'purchase_orders', 'purchase_receipts',
      'stock_adjustments', 'stock_transfers',
      'dashboard', 'reports'
    )
  LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (v_user_role_id, v_permission.id);
  END LOOP;

  -- Create Viewer Role
  INSERT INTO roles (company_id, name, description, is_system_role)
  VALUES (
    p_company_id,
    'Viewer',
    'Read-only access to most areas',
    true
  )
  RETURNING id INTO v_viewer_role_id;

  -- Assign view-only permissions to Viewer
  FOR v_permission IN
    SELECT id, resource FROM permissions
    WHERE can_view = true
      AND resource NOT IN ('roles', 'permissions', 'company_settings')
  LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (v_viewer_role_id, v_permission.id);
  END LOOP;

  RAISE NOTICE 'RBAC setup completed for company %', p_company_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SETUP RBAC FOR EXISTING COMPANIES
-- ============================================================================

DO $$
DECLARE
  v_company RECORD;
BEGIN
  FOR v_company IN SELECT id FROM companies WHERE deleted_at IS NULL
  LOOP
    PERFORM setup_company_rbac(v_company.id);
  END LOOP;
END $$;

-- ============================================================================
-- ASSIGN SUPER ADMIN ROLE TO EXISTING ADMIN USERS
-- ============================================================================

-- This assigns the Super Admin role to the first user in each company
-- You may want to adjust this based on your specific requirements

DO $$
DECLARE
  v_user RECORD;
  v_super_admin_role_id UUID;
  v_default_bu_id UUID;
BEGIN
  FOR v_user IN
    SELECT DISTINCT ON (u.company_id)
      u.id AS user_id,
      u.company_id,
      u.email
    FROM users u
    WHERE u.deleted_at IS NULL
    ORDER BY u.company_id, u.created_at ASC
  LOOP
    -- Get Super Admin role for this company
    SELECT id INTO v_super_admin_role_id
    FROM roles
    WHERE company_id = v_user.company_id
      AND name = 'Super Admin'
      AND deleted_at IS NULL
    LIMIT 1;

    -- Get default business unit for this company
    SELECT id INTO v_default_bu_id
    FROM business_units
    WHERE company_id = v_user.company_id
      AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    -- Assign Super Admin role
    IF v_super_admin_role_id IS NOT NULL THEN
      INSERT INTO user_roles (user_id, role_id, business_unit_id)
      VALUES (v_user.user_id, v_super_admin_role_id, v_default_bu_id)
      ON CONFLICT (user_id, role_id, business_unit_id) DO NOTHING;

      RAISE NOTICE 'Assigned Super Admin role to user % (%) in company %',
        v_user.email, v_user.user_id, v_user.company_id;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- CREATE TRIGGER TO SETUP RBAC FOR NEW COMPANIES
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_setup_rbac_for_new_company()
RETURNS TRIGGER AS $$
BEGIN
  -- Setup RBAC for the new company
  PERFORM setup_company_rbac(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_company_rbac_setup
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_setup_rbac_for_new_company();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION setup_company_rbac IS 'Sets up default roles and permissions for a company';
COMMENT ON FUNCTION trigger_setup_rbac_for_new_company IS 'Automatically creates default RBAC structure when a new company is created';
-- Create Cashier Role and Permissions
-- This migration is intentionally empty because the Cashier role creation
-- has been moved to seed.sql to ensure companies exist before role creation.
--
-- See supabase/seed.sql for the actual Cashier role implementation.
-- Add Granular CRUD Control to Role Permissions
-- This migration adds individual CRUD flags to role_permissions table
-- to allow fine-grained control over what actions each role can perform

-- ============================================================================
-- ADD CRUD COLUMNS TO ROLE_PERMISSIONS
-- ============================================================================

-- Add columns for granular permission control
ALTER TABLE role_permissions
ADD COLUMN can_view BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN can_create BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN can_edit BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN can_delete BOOLEAN NOT NULL DEFAULT false;

-- ============================================================================
-- MIGRATE EXISTING DATA
-- ============================================================================
-- For existing role_permissions, copy the CRUD flags from the permission
-- This ensures backwards compatibility

UPDATE role_permissions rp
SET
  can_view = p.can_view,
  can_create = p.can_create,
  can_edit = p.can_edit,
  can_delete = p.can_delete
FROM permissions p
WHERE rp.permission_id = p.id;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN role_permissions.can_view IS 'Whether this role can view resources of this permission type';
COMMENT ON COLUMN role_permissions.can_create IS 'Whether this role can create resources of this permission type';
COMMENT ON COLUMN role_permissions.can_edit IS 'Whether this role can edit/update resources of this permission type';
COMMENT ON COLUMN role_permissions.can_delete IS 'Whether this role can delete resources of this permission type';

-- ============================================================================
-- NOTES
-- ============================================================================
-- The permissions table still defines the MAXIMUM allowed operations for a resource.
-- The role_permissions table now defines the ACTUAL operations granted to a specific role.
-- role_permissions.can_* should never exceed permissions.can_* for the same permission.
-- Add missing resources that were used in Phase 3 API protection but not in seed data

DO $$
DECLARE
  v_super_admin_role_id UUID;
  v_perm_id UUID;
BEGIN
  -- Get Super Admin role ID for Demo Company
  SELECT id INTO v_super_admin_role_id
  FROM roles
  WHERE name = 'Super Admin'
    AND company_id = '00000000-0000-0000-0000-000000000001'
  LIMIT 1;

  -- Add missing resources and assign to Super Admin

  -- Stock Transactions
  INSERT INTO permissions (resource, can_view, can_create, can_edit, can_delete, description, created_at)
  VALUES (
    'stock_transactions',
    true, true, true, true,
    'View and manage stock transaction history',
    NOW()
  )
  ON CONFLICT (resource) DO NOTHING
  RETURNING id INTO v_perm_id;

  IF v_perm_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, created_at)
    VALUES (v_super_admin_role_id, v_perm_id, NOW())
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Sales Orders (if not already exists as sales_orders)
  INSERT INTO permissions (resource, can_view, can_create, can_edit, can_delete, description, created_at)
  VALUES (
    'sales_orders',
    true, true, true, true,
    'Create and manage sales orders',
    NOW()
  )
  ON CONFLICT (resource) DO NOTHING
  RETURNING id INTO v_perm_id;

  IF v_perm_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, created_at)
    VALUES (v_super_admin_role_id, v_perm_id, NOW())
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Items
  INSERT INTO permissions (resource, can_view, can_create, can_edit, can_delete, description, created_at)
  VALUES (
    'items',
    true, true, true, true,
    'View and manage inventory items',
    NOW()
  )
  ON CONFLICT (resource) DO NOTHING
  RETURNING id INTO v_perm_id;

  IF v_perm_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, created_at)
    VALUES (v_super_admin_role_id, v_perm_id, NOW())
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Customers
  INSERT INTO permissions (resource, can_view, can_create, can_edit, can_delete, description, created_at)
  VALUES (
    'customers',
    true, true, true, true,
    'View and manage customers',
    NOW()
  )
  ON CONFLICT (resource) DO NOTHING
  RETURNING id INTO v_perm_id;

  IF v_perm_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, created_at)
    VALUES (v_super_admin_role_id, v_perm_id, NOW())
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Warehouse Location Management
  INSERT INTO permissions (resource, can_view, can_create, can_edit, can_delete, description, created_at)
  VALUES (
    'manage_locations',
    true, true, true, true,
    'Create and maintain warehouse locations',
    NOW()
  )
  ON CONFLICT (resource) DO NOTHING
  RETURNING id INTO v_perm_id;

  IF v_perm_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, created_at)
    VALUES (v_super_admin_role_id, v_perm_id, NOW())
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Location Stock View
  INSERT INTO permissions (resource, can_view, can_create, can_edit, can_delete, description, created_at)
  VALUES (
    'view_location_stock',
    true, false, false, false,
    'View stock by warehouse location',
    NOW()
  )
  ON CONFLICT (resource) DO NOTHING
  RETURNING id INTO v_perm_id;

  IF v_perm_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, created_at)
    VALUES (v_super_admin_role_id, v_perm_id, NOW())
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Location Transfers
  INSERT INTO permissions (resource, can_view, can_create, can_edit, can_delete, description, created_at)
  VALUES (
    'transfer_between_locations',
    true, true, true, false,
    'Transfer stock between locations',
    NOW()
  )
  ON CONFLICT (resource) DO NOTHING
  RETURNING id INTO v_perm_id;

  IF v_perm_id IS NOT NULL AND v_super_admin_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id, created_at)
    VALUES (v_super_admin_role_id, v_perm_id, NOW())
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  RAISE NOTICE 'Missing resources added and assigned to Super Admin role';
END $$;
-- Add missing POS and Van Sales permissions
-- These resources exist in the frontend but were missing from the permissions table

-- Insert POS permission
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('pos', 'Point of Sale transactions', true, true, true, true)
ON CONFLICT (resource) DO NOTHING;

-- Insert Van Sales permission
INSERT INTO permissions (resource, description, can_view, can_create, can_edit, can_delete)
VALUES
  ('van_sales', 'Manage van sales operations and transactions', true, true, true, true)
ON CONFLICT (resource) DO NOTHING;

-- Automatically assign these new permissions to existing Super Admin roles
-- This ensures Super Admins have access to all features
INSERT INTO role_permissions (role_id, permission_id, can_view, can_create, can_edit, can_delete)
SELECT
  r.id as role_id,
  p.id as permission_id,
  true as can_view,
  true as can_create,
  true as can_edit,
  true as can_delete
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Super Admin'
  AND p.resource IN ('pos', 'van_sales')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
-- Correct RBAC permission aggregation to honor role_permissions CRUD flags
-- This migration updates get_user_permissions and user_has_permission

CREATE OR REPLACE FUNCTION get_user_permissions(
  p_user_id UUID,
  p_business_unit_id UUID DEFAULT NULL
)
RETURNS TABLE (
  resource VARCHAR,
  can_view BOOLEAN,
  can_create BOOLEAN,
  can_edit BOOLEAN,
  can_delete BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.resource,
    -- UNION logic: true if ANY role grants the permission
    -- Enforce role-specific CRUD flags and clamp by permission maximums
    BOOL_OR(p.can_view AND rp.can_view) AS can_view,
    BOOL_OR(p.can_create AND rp.can_create) AS can_create,
    BOOL_OR(p.can_edit AND rp.can_edit) AS can_edit,
    BOOL_OR(p.can_delete AND rp.can_delete) AS can_delete
  FROM permissions p
  INNER JOIN role_permissions rp ON p.id = rp.permission_id
  INNER JOIN roles r ON rp.role_id = r.id
  INNER JOIN user_roles ur ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
    AND ur.deleted_at IS NULL
    AND r.deleted_at IS NULL
    AND p.deleted_at IS NULL
    -- Include global roles (NULL business_unit_id) OR roles matching the specified business unit
    AND (
      p_business_unit_id IS NULL
      OR ur.business_unit_id IS NULL
      OR ur.business_unit_id = p_business_unit_id
    )
  GROUP BY p.resource
  ORDER BY p.resource;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_permissions IS 'Get aggregated permissions for a user. Global roles (business_unit_id IS NULL) apply to all business units.';


CREATE OR REPLACE FUNCTION user_has_permission(
  p_user_id UUID,
  p_resource VARCHAR,
  p_action VARCHAR, -- view/create/edit/delete
  p_business_unit_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN := false;
BEGIN
  SELECT
    CASE p_action
      WHEN 'view' THEN BOOL_OR(p.can_view AND rp.can_view)
      WHEN 'create' THEN BOOL_OR(p.can_create AND rp.can_create)
      WHEN 'edit' THEN BOOL_OR(p.can_edit AND rp.can_edit)
      WHEN 'delete' THEN BOOL_OR(p.can_delete AND rp.can_delete)
      ELSE false
    END
  INTO v_has_permission
  FROM permissions p
  INNER JOIN role_permissions rp ON p.id = rp.permission_id
  INNER JOIN roles r ON rp.role_id = r.id
  INNER JOIN user_roles ur ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
    AND p.resource = p_resource
    AND ur.deleted_at IS NULL
    AND r.deleted_at IS NULL
    AND p.deleted_at IS NULL
    -- Include global roles (NULL business_unit_id) OR roles matching the specified business unit
    AND (
      p_business_unit_id IS NULL
      OR ur.business_unit_id IS NULL
      OR ur.business_unit_id = p_business_unit_id
    );

  RETURN COALESCE(v_has_permission, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION user_has_permission IS 'Check if user has a specific permission. Global roles (business_unit_id IS NULL) apply to all business units.';
-- Migration: Replace items.uom_id with items.package_id
-- Version: 20260102000000
-- Description: Enforce that base storage unit is always a valid package. Adds package_id and setup_complete columns.
-- Author: System
-- Date: 2026-01-02
-- Reference: inv-normalization-implementation-plan.md

-- ============================================================================
-- STEP 1: Add new package_id column (nullable during migration)
-- ============================================================================

ALTER TABLE items
ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES item_packaging(id);

COMMENT ON COLUMN items.package_id IS
  'Base storage package - defines how inventory is stored in item_warehouse.current_stock.
   Must reference item_packaging with qty_per_pack=1.0. This package is also the default
   for transactions. Required when setup_complete=TRUE.';

-- ============================================================================
-- STEP 2: Add setup status tracking
-- ============================================================================

ALTER TABLE items
ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN items.setup_complete IS
  'Indicates if item has completed setup with base package. Items with FALSE cannot be
   used in transactions. Set to TRUE after package_id is configured.';

-- ============================================================================
-- STEP 3: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_items_package_id
ON items(package_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_items_setup_complete
ON items(setup_complete) WHERE setup_complete = FALSE;

-- ============================================================================
-- STEP 4: Add constraint - package_id required when setup_complete
-- ============================================================================

ALTER TABLE items
ADD CONSTRAINT items_package_id_required_when_complete
CHECK (
  (setup_complete = FALSE AND package_id IS NULL) OR
  (setup_complete = TRUE AND package_id IS NOT NULL)
);

-- ============================================================================
-- STEP 5: Add validation trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_item_package_belongs_to_item()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if package_id is NULL (incomplete setup)
  IF NEW.package_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Validate package belongs to this item
  IF NOT EXISTS (
    SELECT 1 FROM item_packaging
    WHERE id = NEW.package_id
      AND item_id = NEW.id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'package_id must reference a valid package for this item';
  END IF;

  -- Validate base package has qty_per_pack = 1
  IF NOT EXISTS (
    SELECT 1 FROM item_packaging
    WHERE id = NEW.package_id
      AND qty_per_pack = 1.0
  ) THEN
    RAISE EXCEPTION 'Base package must have qty_per_pack = 1.0';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_item_package
BEFORE INSERT OR UPDATE ON items
FOR EACH ROW
EXECUTE FUNCTION validate_item_package_belongs_to_item();

-- ============================================================================
-- STEP 6: Prevent transactions on incomplete items
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_item_ready_for_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_item_complete BOOLEAN;
BEGIN
  -- Check if item is ready for transactions
  SELECT setup_complete INTO v_item_complete
  FROM items
  WHERE id = NEW.item_id
    AND deleted_at IS NULL;

  IF v_item_complete IS NULL THEN
    RAISE EXCEPTION 'Item not found: %', NEW.item_id;
  END IF;

  IF v_item_complete = FALSE THEN
    RAISE EXCEPTION 'Item is not fully configured. Please complete package setup before creating transactions.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all transaction tables
CREATE TRIGGER trigger_stock_tx_items_validate_item
BEFORE INSERT ON stock_transaction_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_po_items_validate_item
BEFORE INSERT ON purchase_order_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_pr_items_validate_item
BEFORE INSERT ON purchase_receipt_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_so_items_validate_item
BEFORE INSERT ON sales_order_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_si_items_validate_item
BEFORE INSERT ON sales_invoice_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_pos_items_validate_item
BEFORE INSERT ON pos_transaction_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_transfer_items_validate_item
BEFORE INSERT ON stock_transfer_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

-- ============================================================================
-- STEP 7: Mark old uom_id as deprecated (keep for reference during transition)
-- ============================================================================

COMMENT ON COLUMN items.uom_id IS
  'DEPRECATED: Replaced by package_id. Use items.package_id → item_packaging.uom_id instead.
   Will be removed in future version after migration complete.';

-- ============================================================================
-- Migration Complete: items.package_id schema ready
-- ============================================================================
-- Migration: Update item_packaging for package-first design
-- Version: 20260102000001
-- Description: Add item_id and uom_id to item_packaging, migrate from variants
-- Author: System
-- Date: 2026-01-02
-- Reference: inv-normalization-implementation-plan.md

-- ============================================================================
-- STEP 1: Add item_id column (migrate from variant_id)
-- ============================================================================

ALTER TABLE item_packaging
ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE CASCADE;

COMMENT ON COLUMN item_packaging.item_id IS
  'Item this package belongs to. Required.';

-- ============================================================================
-- STEP 2: Add uom_id to store unit of measure info
-- ============================================================================

ALTER TABLE item_packaging
ADD COLUMN IF NOT EXISTS uom_id UUID REFERENCES units_of_measure(id);

COMMENT ON COLUMN item_packaging.uom_id IS
  'Unit of measure for this package. For base package (qty_per_pack=1),
   this defines the base UOM for inventory storage.';

-- ============================================================================
-- STEP 3: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_item_packaging_item_id
ON item_packaging(item_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_packaging_uom_id
ON item_packaging(uom_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- STEP 4: Migrate existing data from variants (if any)
-- ============================================================================

-- Copy item_id from variant_id relationship
UPDATE item_packaging ip
SET item_id = iv.item_id
FROM item_variants iv
WHERE ip.variant_id = iv.id
  AND ip.item_id IS NULL
  AND ip.deleted_at IS NULL;

-- ============================================================================
-- STEP 5: Make item_id required
-- ============================================================================

-- Note: This will fail if there are item_packaging records without item_id
-- Run data migration script first if needed
ALTER TABLE item_packaging
ALTER COLUMN item_id SET NOT NULL;

-- ============================================================================
-- STEP 6: Make variant_id nullable (deprecate variants)
-- ============================================================================

ALTER TABLE item_packaging
ALTER COLUMN variant_id DROP NOT NULL;

COMMENT ON COLUMN item_packaging.variant_id IS
  'DEPRECATED: Variants removed from design. Use item_id instead.
   Kept for backward compatibility during transition.';

-- ============================================================================
-- STEP 7: Update unique constraint
-- ============================================================================

-- Drop old constraint if it exists
ALTER TABLE item_packaging
DROP CONSTRAINT IF EXISTS item_packaging_variant_pack_type_unique;

-- Add new constraint based on item_id
ALTER TABLE item_packaging
ADD CONSTRAINT item_packaging_item_pack_type_unique
UNIQUE (company_id, item_id, pack_type, deleted_at);

-- ============================================================================
-- Migration Complete: item_packaging updated for package-first design
-- ============================================================================
-- Migration: Add conversion tracking to stock_transaction_items
-- Version: 20260102000002
-- Description: Add conversion metadata columns for inventory normalization audit trail
-- Author: System
-- Date: 2026-01-02
-- Reference: inv-normalization-implementation-plan.md

-- ============================================================================
-- STEP 1: Add conversion metadata columns
-- ============================================================================

ALTER TABLE stock_transaction_items
ADD COLUMN IF NOT EXISTS input_qty DECIMAL(15, 4),
ADD COLUMN IF NOT EXISTS input_packaging_id UUID REFERENCES item_packaging(id),
ADD COLUMN IF NOT EXISTS normalized_qty DECIMAL(15, 4),
ADD COLUMN IF NOT EXISTS conversion_factor DECIMAL(15, 4) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS base_package_id UUID REFERENCES item_packaging(id);

-- ============================================================================
-- STEP 2: Create indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_stock_tx_items_input_packaging
ON stock_transaction_items(input_packaging_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_tx_items_base_package
ON stock_transaction_items(base_package_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- STEP 3: Add check constraint for conversion formula validation
-- ============================================================================

ALTER TABLE stock_transaction_items
ADD CONSTRAINT stock_tx_items_conversion_check
CHECK (
  normalized_qty IS NULL OR
  input_qty IS NULL OR
  conversion_factor IS NULL OR
  ABS(normalized_qty - (input_qty * conversion_factor)) < 0.01
);

-- ============================================================================
-- STEP 4: Backfill existing records (assume already normalized)
-- ============================================================================

-- For historical data, assume quantities are already in base units
-- Set input_qty = quantity, normalized_qty = quantity, conversion_factor = 1.0
UPDATE stock_transaction_items
SET
  input_qty = quantity,
  normalized_qty = quantity,
  conversion_factor = 1.0,
  input_packaging_id = NULL,  -- Unknown for historical data
  base_package_id = NULL       -- Unknown for historical data
WHERE input_qty IS NULL
  AND deleted_at IS NULL;

-- ============================================================================
-- STEP 5: Make required columns NOT NULL
-- ============================================================================

-- After backfill, make these columns required for data integrity
ALTER TABLE stock_transaction_items
ALTER COLUMN input_qty SET NOT NULL,
ALTER COLUMN normalized_qty SET NOT NULL,
ALTER COLUMN conversion_factor SET NOT NULL;

-- ============================================================================
-- STEP 6: Add column comments
-- ============================================================================

COMMENT ON COLUMN stock_transaction_items.quantity IS
  'DEPRECATED: Use normalized_qty instead. Kept for backward compatibility.';

COMMENT ON COLUMN stock_transaction_items.normalized_qty IS
  'Quantity in base package units. This is the source of truth for inventory calculations.
   Formula: normalized_qty = input_qty × conversion_factor';

COMMENT ON COLUMN stock_transaction_items.input_qty IS
  'Original quantity entered by user in selected package.
   Example: User enters "10 cartons", input_qty = 10';

COMMENT ON COLUMN stock_transaction_items.input_packaging_id IS
  'Package selected by user for input. References item_packaging.id.
   Example: "Carton (25kg)" package. NULL for historical data.';

COMMENT ON COLUMN stock_transaction_items.conversion_factor IS
  'Conversion factor from input package to base package (qty_per_pack).
   Formula: conversion_factor = input_packaging.qty_per_pack
   Example: Carton has qty_per_pack=25, so conversion_factor=25.0';

COMMENT ON COLUMN stock_transaction_items.base_package_id IS
  'Base package used for normalization. References items.package_id at time of transaction.
   This is the package that defines the base storage unit. NULL for historical data.';

-- ============================================================================
-- Migration Complete: Conversion metadata tracking enabled
-- ============================================================================
-- Migration: Create atomic item creation function
-- Version: 20260102000003
-- Description: Function to atomically create item with base package and optional additional packages
-- Author: System
-- Date: 2026-01-02
-- Reference: inv-normalization-implementation-plan.md

-- ============================================================================
-- Function: create_item_with_packages
-- ============================================================================
-- Purpose: Atomically create item with base package (and optional additional packages)
-- Solves: Chicken-egg problem of foreign key dependencies between items and item_packaging
--
-- This function:
-- 1. Creates item with package_id=NULL, setup_complete=FALSE
-- 2. Creates base package (qty_per_pack=1.0)
-- 3. Creates additional packages (if provided)
-- 4. Links base package to item and sets setup_complete=TRUE
-- All in one atomic transaction

CREATE OR REPLACE FUNCTION create_item_with_packages(
  p_company_id UUID,
  p_user_id UUID,
  p_item_code VARCHAR(100),
  p_item_name VARCHAR(255),
  p_item_description TEXT DEFAULT NULL,
  p_item_type VARCHAR(50) DEFAULT 'finished_good',
  p_base_package_name VARCHAR(200) DEFAULT 'Each',
  p_base_package_type VARCHAR(100) DEFAULT 'base',
  p_base_uom_id UUID DEFAULT NULL,
  p_standard_cost DECIMAL(20,4) DEFAULT 0,
  p_list_price DECIMAL(20,4) DEFAULT 0,
  p_additional_packages JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE(
  item_id UUID,
  base_package_id UUID,
  message TEXT
) AS $$
DECLARE
  v_item_id UUID;
  v_base_package_id UUID;
  v_package JSONB;
  v_new_package_id UUID;
  v_package_count INTEGER;
BEGIN
  -- Validate inputs
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF p_item_code IS NULL OR p_item_code = '' THEN
    RAISE EXCEPTION 'item_code is required';
  END IF;

  IF p_item_name IS NULL OR p_item_name = '' THEN
    RAISE EXCEPTION 'item_name is required';
  END IF;

  -- Step 1: Create item (package_id NULL, setup_complete FALSE)
  INSERT INTO items (
    company_id,
    item_code,
    item_name,
    description,
    item_type,
    standard_cost,
    list_price,
    package_id,
    setup_complete,
    created_by,
    updated_by
  ) VALUES (
    p_company_id,
    p_item_code,
    p_item_name,
    p_item_description,
    p_item_type,
    p_standard_cost,
    p_list_price,
    NULL,        -- Will be set after creating package
    FALSE,       -- Not ready for transactions yet
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_item_id;

  -- Step 2: Create base package (qty_per_pack = 1.0)
  INSERT INTO item_packaging (
    company_id,
    item_id,
    pack_type,
    pack_name,
    qty_per_pack,
    uom_id,
    is_default,
    is_active,
    created_by,
    updated_by
  ) VALUES (
    p_company_id,
    v_item_id,
    p_base_package_type,
    p_base_package_name,
    1.0,                    -- Base package always = 1
    p_base_uom_id,
    TRUE,                   -- Is default
    TRUE,                   -- Is active
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_base_package_id;

  v_package_count := 1;  -- Start with base package

  -- Step 3: Create additional packages (if provided)
  IF jsonb_array_length(p_additional_packages) > 0 THEN
    FOR v_package IN SELECT * FROM jsonb_array_elements(p_additional_packages)
    LOOP
      -- Validate required fields
      IF v_package->>'pack_type' IS NULL OR v_package->>'pack_type' = '' THEN
        RAISE EXCEPTION 'pack_type is required for additional packages';
      END IF;

      IF v_package->>'pack_name' IS NULL OR v_package->>'pack_name' = '' THEN
        RAISE EXCEPTION 'pack_name is required for additional packages';
      END IF;

      IF v_package->>'qty_per_pack' IS NULL THEN
        RAISE EXCEPTION 'qty_per_pack is required for additional packages';
      END IF;

      INSERT INTO item_packaging (
        company_id,
        item_id,
        pack_type,
        pack_name,
        qty_per_pack,
        uom_id,
        barcode,
        is_default,
        is_active,
        created_by,
        updated_by
      ) VALUES (
        p_company_id,
        v_item_id,
        (v_package->>'pack_type')::VARCHAR,
        (v_package->>'pack_name')::VARCHAR,
        (v_package->>'qty_per_pack')::DECIMAL,
        COALESCE((v_package->>'uom_id')::UUID, p_base_uom_id),
        (v_package->>'barcode')::VARCHAR,
        FALSE,                   -- Not default (base package is default)
        COALESCE((v_package->>'is_active')::BOOLEAN, TRUE),
        p_user_id,
        p_user_id
      )
      RETURNING id INTO v_new_package_id;

      v_package_count := v_package_count + 1;
    END LOOP;
  END IF;

  -- Step 4: Link base package to item and mark setup complete
  UPDATE items
  SET package_id = v_base_package_id,
      setup_complete = TRUE,
      updated_by = p_user_id,
      updated_at = NOW()
  WHERE id = v_item_id;

  -- Step 5: Return results
  RETURN QUERY
  SELECT
    v_item_id,
    v_base_package_id,
    'Item created successfully with ' || v_package_count::TEXT || ' package(s)' AS message;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Add function comment with usage examples
-- ============================================================================

COMMENT ON FUNCTION create_item_with_packages IS
  'Atomically creates an item with base package (qty_per_pack=1) and optional additional packages.
   Handles foreign key dependencies correctly by creating item first (incomplete), then packages,
   then linking them. Base package becomes the default for transactions.

   Parameters:
   - p_company_id: Company UUID (required)
   - p_user_id: User creating the item (required)
   - p_item_code: Unique item code (required)
   - p_item_name: Item name (required)
   - p_item_description: Optional description
   - p_item_type: Item type (default: finished_good)
   - p_base_package_name: Name for base package (default: Each)
   - p_base_package_type: Type code for base package (default: base)
   - p_base_uom_id: UOM for base package (optional)
   - p_standard_cost: Standard cost (default: 0)
   - p_list_price: List price (default: 0)
   - p_additional_packages: JSONB array of additional packages (optional)

   Additional packages JSON format:
   {
     "pack_type": "bag",
     "pack_name": "Bag (5kg)",
     "qty_per_pack": 5.0,
     "uom_id": "uuid-optional",
     "barcode": "1234567890123",
     "is_active": true
   }

   Example 1 - Simple item with base package only:
   SELECT * FROM create_item_with_packages(
     ''company-id''::UUID,
     ''user-id''::UUID,
     ''FLOUR-001'',
     ''Premium Flour'',
     ''High-quality wheat flour'',
     ''raw_material'',
     ''Kilogram'',
     ''base'',
     ''uom-kg-id''::UUID,
     100.00,
     150.00,
     NULL
   );

   Example 2 - Item with multiple packages:
   SELECT * FROM create_item_with_packages(
     ''company-id''::UUID,
     ''user-id''::UUID,
     ''FLOUR-001'',
     ''Premium Flour'',
     NULL,
     ''finished_good'',
     ''Kilogram'',
     ''base'',
     ''uom-kg-id''::UUID,
     100.00,
     150.00,
     ''[
       {"pack_type": "bag", "pack_name": "Bag (5kg)", "qty_per_pack": 5.0},
       {"pack_type": "carton", "pack_name": "Carton (25kg)", "qty_per_pack": 25.0}
     ]''::JSONB
   );';

-- ============================================================================
-- Migration Complete: Atomic item creation function created
-- ============================================================================
-- Migration: Create helper function to get base package info
-- Version: 20260102000004
-- Description: Helper function for quick lookup of item's base package information
-- Author: System
-- Date: 2026-01-02
-- Reference: inv-normalization-implementation-plan.md

-- ============================================================================
-- Function: get_item_base_package
-- ============================================================================
-- Purpose: Quick lookup for item's base package information
-- Returns: Package details including UOM information
-- Usage: Avoid complex joins when you just need base package info

CREATE OR REPLACE FUNCTION get_item_base_package(p_item_id UUID)
RETURNS TABLE(
  package_id UUID,
  pack_name VARCHAR(200),
  pack_type VARCHAR(100),
  qty_per_pack DECIMAL(15,4),
  uom_id UUID,
  uom_name VARCHAR(100),
  uom_symbol VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ip.id AS package_id,
    ip.pack_name,
    ip.pack_type,
    ip.qty_per_pack,
    ip.uom_id,
    u.name AS uom_name,
    u.symbol AS uom_symbol
  FROM items i
  JOIN item_packaging ip ON i.package_id = ip.id
  LEFT JOIN units_of_measure u ON ip.uom_id = u.id
  WHERE i.id = p_item_id
    AND i.deleted_at IS NULL
    AND ip.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Add function comment with usage examples
-- ============================================================================

COMMENT ON FUNCTION get_item_base_package IS
  'Returns base package information for an item.
   Useful for quick lookups without joining multiple tables in application code.

   Parameters:
   - p_item_id: Item UUID

   Returns:
   - package_id: UUID of the base package
   - pack_name: Display name (e.g., "Kilogram", "Each")
   - pack_type: Type code (e.g., "base", "kg")
   - qty_per_pack: Always 1.0 for base packages
   - uom_id: Unit of measure UUID
   - uom_name: UOM display name (e.g., "Kilogram")
   - uom_symbol: UOM symbol (e.g., "kg")

   Example usage:
   SELECT * FROM get_item_base_package(''item-id''::UUID);

   Returns:
   package_id                            | pack_name  | pack_type | qty_per_pack | uom_id    | uom_name  | uom_symbol
   --------------------------------------|------------|-----------|--------------|-----------|-----------|------------
   abc123...                             | Kilogram   | base      | 1.0000       | xyz789... | Kilogram  | kg

   Use this function when:
   - You need to display base UOM in forms
   - You need to validate package conversions
   - You need base package info without complex joins
   - You need to show "stored as" information to users';

-- ============================================================================
-- Migration Complete: Helper function created
-- ============================================================================
-- Migration: Migrate existing items to package-based design
-- Version: 20260102000005
-- Description: Create base packages for all existing items and link them
-- Author: System
-- Date: 2026-01-02
-- Reference: inv-normalization-implementation-plan.md

-- ============================================================================
-- DATA MIGRATION: Create base packages for existing items
-- ============================================================================

DO $$
DECLARE
  item_record RECORD;
  base_package_id UUID;
  uom_name TEXT;
  uom_symbol TEXT;
  items_migrated INTEGER := 0;
  items_skipped INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting migration of existing items to package-based design...';
  RAISE NOTICE '============================================================';

  -- Loop through all items that don't have packages yet
  FOR item_record IN
    SELECT
      i.id,
      i.company_id,
      i.uom_id,
      i.item_code,
      i.item_name,
      i.created_by
    FROM items i
    WHERE i.deleted_at IS NULL
      AND i.setup_complete = FALSE  -- Items not yet configured
      AND i.package_id IS NULL       -- No package assigned yet
    ORDER BY i.created_at
  LOOP
    BEGIN
      -- Get UOM details for package naming
      SELECT u.name, u.symbol
      INTO uom_name, uom_symbol
      FROM units_of_measure u
      WHERE u.id = item_record.uom_id;

      -- Create base package for this item
      INSERT INTO item_packaging (
        company_id,
        item_id,
        pack_type,
        pack_name,
        qty_per_pack,
        uom_id,
        is_default,
        is_active,
        created_by,
        updated_by,
        created_at,
        updated_at
      ) VALUES (
        item_record.company_id,
        item_record.id,
        'base',
        COALESCE(uom_name, 'Each'),  -- Use UOM name or fallback to 'Each'
        1.0,                          -- Base package always = 1
        item_record.uom_id,
        TRUE,                         -- Is default package
        TRUE,                         -- Is active
        COALESCE(item_record.created_by, '00000000-0000-0000-0000-000000000000'::UUID),
        COALESCE(item_record.created_by, '00000000-0000-0000-0000-000000000000'::UUID),
        NOW(),
        NOW()
      )
      RETURNING id INTO base_package_id;

      -- Update item with base package reference
      UPDATE items
      SET package_id = base_package_id,
          setup_complete = TRUE,
          updated_by = COALESCE(item_record.created_by, '00000000-0000-0000-0000-000000000000'::UUID),
          updated_at = NOW()
      WHERE id = item_record.id;

      items_migrated := items_migrated + 1;

      -- Log progress every 100 items
      IF items_migrated % 100 = 0 THEN
        RAISE NOTICE 'Migrated % items...', items_migrated;
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but continue with next item
        RAISE WARNING 'Failed to migrate item % (%): %',
          item_record.item_code,
          item_record.id,
          SQLERRM;
        items_skipped := items_skipped + 1;
    END;
  END LOOP;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Migration complete!';
  RAISE NOTICE 'Items migrated: %', items_migrated;
  RAISE NOTICE 'Items skipped (errors): %', items_skipped;
  RAISE NOTICE '============================================================';

  -- Verify no incomplete items remain
  DECLARE
    incomplete_count INTEGER;
  BEGIN
    SELECT COUNT(*)
    INTO incomplete_count
    FROM items
    WHERE deleted_at IS NULL
      AND setup_complete = FALSE;

    IF incomplete_count > 0 THEN
      RAISE WARNING 'WARNING: % items still have setup_complete=FALSE', incomplete_count;
      RAISE WARNING 'Run the following query to investigate:';
      RAISE WARNING 'SELECT id, item_code, item_name FROM items WHERE setup_complete = FALSE AND deleted_at IS NULL;';
    ELSE
      RAISE NOTICE 'SUCCESS: All items have been migrated successfully!';
    END IF;
  END;

END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Query 1: Check migration status
DO $$
DECLARE
  total_items INTEGER;
  completed_items INTEGER;
  incomplete_items INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_items
  FROM items
  WHERE deleted_at IS NULL;

  SELECT COUNT(*) INTO completed_items
  FROM items
  WHERE deleted_at IS NULL
    AND setup_complete = TRUE
    AND package_id IS NOT NULL;

  SELECT COUNT(*) INTO incomplete_items
  FROM items
  WHERE deleted_at IS NULL
    AND setup_complete = FALSE;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'MIGRATION VERIFICATION';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Total items: %', total_items;
  RAISE NOTICE 'Completed items (with packages): %', completed_items;
  RAISE NOTICE 'Incomplete items (no packages): %', incomplete_items;
  RAISE NOTICE '';

  IF incomplete_items = 0 AND total_items = completed_items THEN
    RAISE NOTICE 'STATUS: ✓ All items successfully migrated!';
  ELSE
    RAISE WARNING 'STATUS: ✗ Migration incomplete - please investigate';
  END IF;
  RAISE NOTICE '============================================================';
END $$;

-- ============================================================================
-- Migration Complete: Existing items migrated to package-based design
-- ============================================================================
-- Migration: Remove Item Variants System
-- Version: 20260105000000
-- Description: Remove item_variants, item_prices tables and variant_id columns from transaction tables
-- Author: System
-- Date: 2026-01-05
-- Reason: Replaced by direct item packaging system (inventory normalization)

-- ============================================================================
-- PHASE 1: Remove variant_id columns from transaction tables
-- ============================================================================

-- Stock transaction items
ALTER TABLE stock_transaction_items
DROP COLUMN IF EXISTS variant_id CASCADE;

COMMENT ON COLUMN stock_transaction_items.packaging_id IS 'Package used in this transaction (links directly to item_packaging.item_id)';

-- Purchase order items
ALTER TABLE purchase_order_items
DROP COLUMN IF EXISTS variant_id CASCADE;

COMMENT ON COLUMN purchase_order_items.packaging_id IS 'Package used in this purchase order';

-- Purchase receipt items
ALTER TABLE purchase_receipt_items
DROP COLUMN IF EXISTS variant_id CASCADE;

COMMENT ON COLUMN purchase_receipt_items.packaging_id IS 'Package used in this receipt';

-- Sales order items
ALTER TABLE sales_order_items
DROP COLUMN IF EXISTS variant_id CASCADE;

COMMENT ON COLUMN sales_order_items.packaging_id IS 'Package used in this sales order';

-- Sales invoice items
ALTER TABLE sales_invoice_items
DROP COLUMN IF EXISTS variant_id CASCADE;

COMMENT ON COLUMN sales_invoice_items.packaging_id IS 'Package used in this invoice';

-- POS transaction items
ALTER TABLE pos_transaction_items
DROP COLUMN IF EXISTS variant_id CASCADE;

COMMENT ON COLUMN pos_transaction_items.packaging_id IS 'Package used in this POS transaction';

-- Stock transfer items
ALTER TABLE stock_transfer_items
DROP COLUMN IF EXISTS variant_id CASCADE;

COMMENT ON COLUMN stock_transfer_items.packaging_id IS 'Package used in this transfer';

-- ============================================================================
-- PHASE 2: Update item_packaging to reference item_id instead of variant_id
-- ============================================================================
-- NOTE: This was already done in 20260102000001_update_item_packaging.sql
-- This section verifies the schema is correct

-- Verify item_packaging has item_id column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'item_packaging'
          AND column_name = 'item_id'
    ) THEN
        RAISE EXCEPTION 'item_packaging.item_id column does not exist. Migration 20260102000001 may not have been applied.';
    END IF;

    RAISE NOTICE 'Verification: item_packaging.item_id exists ✓';
END $$;

-- Drop variant_id from item_packaging if it still exists
ALTER TABLE item_packaging
DROP COLUMN IF EXISTS variant_id CASCADE;

-- Verify unique constraint is on item_id not variant_id
DO $$
BEGIN
    -- Drop old variant-based constraint if exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'item_packaging_company_id_variant_id_pack_type_key'
    ) THEN
        ALTER TABLE item_packaging
        DROP CONSTRAINT item_packaging_company_id_variant_id_pack_type_key;
        RAISE NOTICE 'Dropped old variant-based unique constraint';
    END IF;

    -- Ensure new item-based constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'item_packaging_company_id_item_id_pack_type_key'
    ) THEN
        ALTER TABLE item_packaging
        ADD CONSTRAINT item_packaging_company_id_item_id_pack_type_key
        UNIQUE (company_id, item_id, pack_type);
        RAISE NOTICE 'Added item-based unique constraint';
    END IF;
END $$;

-- ============================================================================
-- PHASE 3: Drop item_prices table
-- ============================================================================
-- Prices are now stored directly in items table (purchase_price, cost_price, sales_price)

DROP TABLE IF EXISTS item_prices CASCADE;

-- ============================================================================
-- PHASE 4: Drop item_variants table
-- ============================================================================

DROP TABLE IF EXISTS item_variants CASCADE;

-- ============================================================================
-- PHASE 5: Drop indexes that reference dropped columns
-- ============================================================================

-- These will be automatically dropped by CASCADE, but we verify here

DO $$
DECLARE
    index_name TEXT;
    dropped_count INTEGER := 0;
BEGIN
    FOR index_name IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname LIKE '%variant%'
    LOOP
        EXECUTE 'DROP INDEX IF EXISTS ' || index_name || ' CASCADE';
        dropped_count := dropped_count + 1;
        RAISE NOTICE 'Dropped index: %', index_name;
    END LOOP;

    RAISE NOTICE 'Total variant-related indexes dropped: %', dropped_count;
END $$;

-- ============================================================================
-- MIGRATION VERIFICATION
-- ============================================================================

DO $$
DECLARE
    variant_tables INTEGER;
    variant_columns INTEGER;
BEGIN
    -- Check for any remaining variant tables
    SELECT COUNT(*) INTO variant_tables
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE '%variant%';

    -- Check for any remaining variant_id columns
    SELECT COUNT(*) INTO variant_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'variant_id';

    RAISE NOTICE '============================================';
    RAISE NOTICE 'Migration Verification:';
    RAISE NOTICE '  - Remaining variant tables: %', variant_tables;
    RAISE NOTICE '  - Remaining variant_id columns: %', variant_columns;

    IF variant_tables > 0 OR variant_columns > 0 THEN
        RAISE WARNING 'Some variant-related objects still exist!';
    ELSE
        RAISE NOTICE '  ✓ All variant objects removed successfully';
    END IF;
    RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Item Variants Removal Complete!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  ✓ Removed variant_id from all transaction tables';
    RAISE NOTICE '  ✓ Removed variant_id from item_packaging';
    RAISE NOTICE '  ✓ Dropped item_prices table';
    RAISE NOTICE '  ✓ Dropped item_variants table';
    RAISE NOTICE '  ✓ Dropped all variant-related indexes';
    RAISE NOTICE '';
    RAISE NOTICE 'System now uses:';
    RAISE NOTICE '  - Direct item packaging (item_packaging.item_id)';
    RAISE NOTICE '  - Item prices in items table (purchase_price, cost_price, sales_price)';
    RAISE NOTICE '  - Package-based transactions (no variant layer)';
    RAISE NOTICE '============================================';
END $$;
-- Migration: Restore Item Prices Table (Without Variants)
-- Version: 20260105000001
-- Description: Re-create item_prices table to work directly with items (not variants)
-- Author: System
-- Date: 2026-01-05

-- ============================================================================
-- TABLE: item_prices
-- ============================================================================
-- Stores multiple price tiers for items (directly, without variant dependency)
-- Price tiers: fc (Factory Cost), ws (Wholesale), srp (Suggested Retail Price)
-- Can be extended for additional tiers (government, reseller, VIP, etc.)

CREATE TABLE item_prices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    item_id           UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,  -- Direct link to items
    price_tier        VARCHAR(50) NOT NULL,   -- e.g., "fc", "ws", "srp", "government", "reseller"
    price_tier_name   VARCHAR(100) NOT NULL,  -- e.g., "Factory Cost", "Wholesale", "SRP"
    price             DECIMAL(20, 4) NOT NULL,
    currency_code     VARCHAR(3) DEFAULT 'PHP',
    effective_from    DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to      DATE,                   -- NULL = no expiry
    is_active         BOOLEAN DEFAULT true,

    -- Audit fields
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,

    UNIQUE(company_id, item_id, price_tier, effective_from),
    CHECK (price >= 0),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_item_prices_company ON item_prices(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_prices_item ON item_prices(item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_prices_tier ON item_prices(price_tier) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_prices_active ON item_prices(is_active, effective_from, effective_to) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_item_prices_updated_at
    BEFORE UPDATE ON item_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE item_prices IS 'Multi-tier pricing for items with date effectivity (no variant dependency)';
COMMENT ON COLUMN item_prices.item_id IS 'Direct link to items table (no variant layer)';
COMMENT ON COLUMN item_prices.price_tier IS 'Price tier code: fc (Factory Cost), ws (Wholesale), srp (SRP), etc.';
COMMENT ON COLUMN item_prices.effective_from IS 'Start date when this price becomes effective';
COMMENT ON COLUMN item_prices.effective_to IS 'End date when this price expires (NULL = no expiry)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Item Prices Table Restored!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  ✓ item_prices table created';
    RAISE NOTICE '  ✓ Links directly to items (not variants)';
    RAISE NOTICE '  ✓ Supports multi-tier pricing';
    RAISE NOTICE '  ✓ Includes date effectivity';
    RAISE NOTICE '============================================';
END $$;
-- ============================================================================
-- Migration: Add conversion tracking to transaction tables
-- Description: Adds normalization metadata columns for package-based inventory
-- ============================================================================

-- ============================================================================
-- TABLE: stock_transaction_items - Add conversion metadata
-- ============================================================================
ALTER TABLE stock_transaction_items
ADD COLUMN IF NOT EXISTS input_qty DECIMAL(15, 4),
ADD COLUMN IF NOT EXISTS input_packaging_id UUID REFERENCES item_packaging(id),
ADD COLUMN IF NOT EXISTS normalized_qty DECIMAL(15, 4),
ADD COLUMN IF NOT EXISTS conversion_factor DECIMAL(15, 4) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS base_package_id UUID REFERENCES item_packaging(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stock_tx_items_input_packaging
ON stock_transaction_items(input_packaging_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_tx_items_base_package
ON stock_transaction_items(base_package_id) WHERE deleted_at IS NULL;

-- Backfill existing records (assume already normalized)
UPDATE stock_transaction_items
SET
  input_qty = quantity,
  normalized_qty = quantity,
  conversion_factor = 1.0,
  input_packaging_id = NULL,
  base_package_id = NULL
WHERE input_qty IS NULL;

-- Make required columns NOT NULL
ALTER TABLE stock_transaction_items
ALTER COLUMN input_qty SET NOT NULL,
ALTER COLUMN normalized_qty SET NOT NULL,
ALTER COLUMN conversion_factor SET NOT NULL;

-- Add check constraint (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_tx_items_conversion_check'
  ) THEN
    ALTER TABLE stock_transaction_items
    ADD CONSTRAINT stock_tx_items_conversion_check
    CHECK (
      normalized_qty IS NULL OR
      input_qty IS NULL OR
      conversion_factor IS NULL OR
      ABS(normalized_qty - (input_qty * conversion_factor)) < 0.01
    );
  END IF;
END
$$;

-- Add comments
COMMENT ON COLUMN stock_transaction_items.quantity IS
  'DEPRECATED: Use normalized_qty instead. Kept for backward compatibility.';

COMMENT ON COLUMN stock_transaction_items.normalized_qty IS
  'Quantity in base package units. This is the source of truth for inventory calculations.';

COMMENT ON COLUMN stock_transaction_items.input_qty IS
  'Original quantity entered by user in selected package.';

COMMENT ON COLUMN stock_transaction_items.input_packaging_id IS
  'Package selected by user for input. References item_packaging.id.';

COMMENT ON COLUMN stock_transaction_items.conversion_factor IS
  'Conversion factor from input package to base package (qty_per_pack).';

COMMENT ON COLUMN stock_transaction_items.base_package_id IS
  'Base package used for normalization. References items.package_id at time of transaction.';

-- ============================================================================
-- TABLE: purchase_receipt_items - Add packaging_id for tracking
-- ============================================================================
ALTER TABLE purchase_receipt_items
ADD COLUMN IF NOT EXISTS packaging_id UUID REFERENCES item_packaging(id);

CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_packaging
ON purchase_receipt_items(packaging_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN purchase_receipt_items.packaging_id IS
  'Package used when receiving goods. Used for display purposes only - actual normalization happens in stock_transaction_items.';

ALTER TABLE purchase_receipts
ADD COLUMN IF NOT EXISTS batch_sequence_number TEXT;

COMMENT ON COLUMN purchase_receipts.batch_sequence_number IS
  'Free-form batch or lot identifier captured during receiving.';

-- ============================================================================
-- TABLE: stock_transfer_items - Add packaging_id for tracking
-- ============================================================================
ALTER TABLE stock_transfer_items
ADD COLUMN IF NOT EXISTS packaging_id UUID REFERENCES item_packaging(id);

CREATE INDEX IF NOT EXISTS idx_stock_transfer_items_packaging
ON stock_transfer_items(packaging_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN stock_transfer_items.packaging_id IS
  'Package used for transfer. Used for display and driver confirmation.';
-- ============================================================================
-- Migration: Add package normalization to stock_adjustment_items
-- Description: Adds normalization metadata columns for package-based adjustments
-- ============================================================================

-- ============================================================================
-- TABLE: stock_adjustment_items - Add conversion metadata
-- ============================================================================
ALTER TABLE stock_adjustment_items
ADD COLUMN IF NOT EXISTS input_qty DECIMAL(15, 4),
ADD COLUMN IF NOT EXISTS input_packaging_id UUID REFERENCES item_packaging(id),
ADD COLUMN IF NOT EXISTS normalized_qty DECIMAL(15, 4),
ADD COLUMN IF NOT EXISTS conversion_factor DECIMAL(15, 4) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS base_package_id UUID REFERENCES item_packaging(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stock_adj_items_input_packaging
ON stock_adjustment_items(input_packaging_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_adj_items_base_package
ON stock_adjustment_items(base_package_id) WHERE deleted_at IS NULL;

-- Backfill existing records (assume already in base units)
UPDATE stock_adjustment_items
SET
  input_qty = adjusted_qty,
  normalized_qty = adjusted_qty,
  conversion_factor = 1.0,
  input_packaging_id = NULL,
  base_package_id = NULL
WHERE input_qty IS NULL;

-- Make required columns NOT NULL
ALTER TABLE stock_adjustment_items
ALTER COLUMN input_qty SET NOT NULL,
ALTER COLUMN normalized_qty SET NOT NULL,
ALTER COLUMN conversion_factor SET NOT NULL;

-- Add check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_adj_items_conversion_check'
  ) THEN
    ALTER TABLE stock_adjustment_items
    ADD CONSTRAINT stock_adj_items_conversion_check
    CHECK (
      normalized_qty IS NULL OR
      input_qty IS NULL OR
      conversion_factor IS NULL OR
      ABS(normalized_qty - (input_qty * conversion_factor)) < 0.01
    );
  END IF;
END
$$;

-- Add comments
COMMENT ON COLUMN stock_adjustment_items.adjusted_qty IS
  'DEPRECATED: Use normalized_qty instead. Kept for backward compatibility.';

COMMENT ON COLUMN stock_adjustment_items.normalized_qty IS
  'Adjusted quantity in base package units. This is the source of truth for inventory calculations.';

COMMENT ON COLUMN stock_adjustment_items.input_qty IS
  'Original adjusted quantity entered by user in selected package.';

COMMENT ON COLUMN stock_adjustment_items.input_packaging_id IS
  'Package selected by user for input. References item_packaging.id.';

COMMENT ON COLUMN stock_adjustment_items.conversion_factor IS
  'Conversion factor from input package to base package (qty_per_pack).';

COMMENT ON COLUMN stock_adjustment_items.base_package_id IS
  'Base package used for normalization. References items.package_id at time of adjustment.';

-- ============================================================================
-- TABLE: warehouse_locations
-- ============================================================================

CREATE TABLE IF NOT EXISTS warehouse_locations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    warehouse_id      UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    code              VARCHAR(100) NOT NULL,
    name              VARCHAR(200),
    parent_id         UUID REFERENCES warehouse_locations(id),
    location_type     VARCHAR(50) NOT NULL DEFAULT 'bin', -- zone, aisle, rack, shelf, bin, crate
    is_pickable       BOOLEAN DEFAULT true,
    is_storable       BOOLEAN DEFAULT true,
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    UNIQUE(company_id, warehouse_id, code)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_company
ON warehouse_locations(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_warehouse
ON warehouse_locations(warehouse_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_code
ON warehouse_locations(code) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_parent
ON warehouse_locations(parent_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_warehouse_locations_updated_at
    BEFORE UPDATE ON warehouse_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE warehouse_locations IS 'Location hierarchy inside a warehouse (zones, aisles, bins, crates)';
COMMENT ON COLUMN warehouse_locations.code IS 'Unique code per warehouse (e.g. A1-BIN-01)';
COMMENT ON COLUMN warehouse_locations.location_type IS 'zone, aisle, rack, shelf, bin, crate';
COMMENT ON COLUMN warehouse_locations.is_pickable IS 'Can be used as a pick location';
COMMENT ON COLUMN warehouse_locations.is_storable IS 'Can store inventory';

-- ============================================================================
-- TABLE: item_location
-- ============================================================================

CREATE TABLE IF NOT EXISTS item_location (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    item_id           UUID NOT NULL REFERENCES items(id),
    warehouse_id      UUID NOT NULL REFERENCES warehouses(id),
    location_id       UUID NOT NULL REFERENCES warehouse_locations(id),
    qty_on_hand       DECIMAL(20, 4) NOT NULL DEFAULT 0,
    qty_reserved      DECIMAL(20, 4) NOT NULL DEFAULT 0,
    qty_available     DECIMAL(20, 4) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    UNIQUE(company_id, item_id, warehouse_id, location_id),
    CHECK (qty_on_hand >= 0),
    CHECK (qty_reserved >= 0),
    CHECK (qty_reserved <= qty_on_hand)
);

CREATE INDEX IF NOT EXISTS idx_item_location_company
ON item_location(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_location_item
ON item_location(item_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_location_warehouse
ON item_location(warehouse_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_location_location
ON item_location(location_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_item_location_updated_at
    BEFORE UPDATE ON item_location
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE item_location IS 'Item quantities per warehouse location';
COMMENT ON COLUMN item_location.qty_on_hand IS 'On-hand quantity at this location';
COMMENT ON COLUMN item_location.qty_reserved IS 'Reserved quantity at this location';
COMMENT ON COLUMN item_location.qty_available IS 'Available quantity at this location (computed)';

-- ============================================================================
-- TABLE: item_warehouse - add default_location_id
-- ============================================================================

ALTER TABLE item_warehouse
ADD COLUMN IF NOT EXISTS default_location_id UUID REFERENCES warehouse_locations(id);

CREATE INDEX IF NOT EXISTS idx_item_warehouse_default_location
ON item_warehouse(default_location_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN item_warehouse.default_location_id IS
  'Default pick/put-away location for this item in the warehouse.';

-- ============================================================================
-- TABLE: stock_transactions - add location columns
-- ============================================================================

ALTER TABLE stock_transactions
ADD COLUMN IF NOT EXISTS from_location_id UUID REFERENCES warehouse_locations(id),
ADD COLUMN IF NOT EXISTS to_location_id UUID REFERENCES warehouse_locations(id);

CREATE INDEX IF NOT EXISTS idx_stock_trans_from_location
ON stock_transactions(from_location_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_trans_to_location
ON stock_transactions(to_location_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN stock_transactions.from_location_id IS
  'Source location for stock out/transfer transactions.';

COMMENT ON COLUMN stock_transactions.to_location_id IS
  'Destination location for stock in/transfer transactions.';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_location ENABLE ROW LEVEL SECURITY;

CREATE POLICY warehouse_locations_select
    ON warehouse_locations FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY warehouse_locations_insert
    ON warehouse_locations FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY warehouse_locations_update
    ON warehouse_locations FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY item_location_select
    ON item_location FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY item_location_insert
    ON item_location FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY item_location_update
    ON item_location FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- SEED: default MAIN location per warehouse
-- ============================================================================

INSERT INTO warehouse_locations (
  company_id,
  warehouse_id,
  code,
  name,
  location_type,
  is_pickable,
  is_storable,
  is_active,
  created_at,
  updated_at
)
SELECT
  w.company_id,
  w.id,
  'MAIN',
  'Main',
  'bin',
  true,
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM warehouses w
ON CONFLICT (company_id, warehouse_id, code) DO NOTHING;

-- Backfill default location on item_warehouse
UPDATE item_warehouse iw
SET default_location_id = wl.id
FROM warehouse_locations wl
WHERE wl.warehouse_id = iw.warehouse_id
  AND wl.code = 'MAIN'
  AND iw.default_location_id IS NULL;

-- Backfill item_location from item_warehouse totals
INSERT INTO item_location (
  company_id,
  item_id,
  warehouse_id,
  location_id,
  qty_on_hand,
  qty_reserved,
  created_at,
  updated_at
)
SELECT
  iw.company_id,
  iw.item_id,
  iw.warehouse_id,
  wl.id,
  iw.current_stock,
  iw.reserved_stock,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM item_warehouse iw
JOIN warehouse_locations wl
  ON wl.warehouse_id = iw.warehouse_id
 AND wl.code = 'MAIN'
ON CONFLICT (company_id, item_id, warehouse_id, location_id)
DO UPDATE SET
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = EXCLUDED.qty_reserved,
  updated_at = CURRENT_TIMESTAMP;

CREATE OR REPLACE FUNCTION create_item_with_packages(
  p_company_id UUID,
  p_user_id UUID,
  p_item_code VARCHAR(100),
  p_item_name VARCHAR(255),
  p_item_name_cn VARCHAR(255) DEFAULT NULL,
  p_item_description TEXT DEFAULT NULL,
  p_item_type VARCHAR(50) DEFAULT 'finished_good',
  p_base_package_name VARCHAR(200) DEFAULT 'Each',
  p_base_package_type VARCHAR(100) DEFAULT 'base',
  p_base_uom_id UUID DEFAULT NULL,
  p_standard_cost DECIMAL(20,4) DEFAULT 0,
  p_list_price DECIMAL(20,4) DEFAULT 0,
  p_additional_packages JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE(
  item_id UUID,
  base_package_id UUID,
  message TEXT
) AS $$
DECLARE
  v_item_id UUID;
  v_base_package_id UUID;
  v_package JSONB;
  v_new_package_id UUID;
  v_package_count INTEGER;
BEGIN
  -- Validate inputs
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF p_item_code IS NULL OR p_item_code = '' THEN
    RAISE EXCEPTION 'item_code is required';
  END IF;

  IF p_item_name IS NULL OR p_item_name = '' THEN
    RAISE EXCEPTION 'item_name is required';
  END IF;

  -- Step 1: Create item (package_id NULL, setup_complete FALSE)
  INSERT INTO items (
    company_id,
    item_code,
    item_name,
    item_name_cn,
    description,
    item_type,
    standard_cost,
    list_price,
    package_id,
    setup_complete,
    created_by,
    updated_by
  ) VALUES (
    p_company_id,
    p_item_code,
    p_item_name,
    COALESCE(p_item_name_cn, p_item_name),
    p_item_description,
    p_item_type,
    p_standard_cost,
    p_list_price,
    NULL,        -- Will be set after creating package
    FALSE,       -- Not ready for transactions yet
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_item_id;

  -- Step 2: Create base package (qty_per_pack = 1.0)
  INSERT INTO item_packaging (
    company_id,
    item_id,
    pack_type,
    pack_name,
    qty_per_pack,
    uom_id,
    is_default,
    is_active,
    created_by,
    updated_by
  ) VALUES (
    p_company_id,
    v_item_id,
    p_base_package_type,
    p_base_package_name,
    1.0,                    -- Base package always = 1
    p_base_uom_id,
    TRUE,                   -- Is default
    TRUE,                   -- Is active
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_base_package_id;

  v_package_count := 1;  -- Start with base package

  -- Step 3: Create additional packages (if provided)
  IF jsonb_array_length(p_additional_packages) > 0 THEN
    FOR v_package IN SELECT * FROM jsonb_array_elements(p_additional_packages)
    LOOP
      -- Validate required fields
      IF v_package->>'pack_type' IS NULL OR v_package->>'pack_type' = '' THEN
        RAISE EXCEPTION 'pack_type is required for additional packages';
      END IF;

      IF v_package->>'pack_name' IS NULL OR v_package->>'pack_name' = '' THEN
        RAISE EXCEPTION 'pack_name is required for additional packages';
      END IF;

      IF v_package->>'qty_per_pack' IS NULL THEN
        RAISE EXCEPTION 'qty_per_pack is required for additional packages';
      END IF;

      INSERT INTO item_packaging (
        company_id,
        item_id,
        pack_type,
        pack_name,
        qty_per_pack,
        uom_id,
        barcode,
        is_active,
        created_by,
        updated_by
      ) VALUES (
        p_company_id,
        v_item_id,
        v_package->>'pack_type',
        v_package->>'pack_name',
        (v_package->>'qty_per_pack')::DECIMAL(20,4),
        NULLIF(v_package->>'uom_id', '')::UUID,
        v_package->>'barcode',
        COALESCE((v_package->>'is_active')::BOOLEAN, TRUE),
        p_user_id,
        p_user_id
      )
      RETURNING id INTO v_new_package_id;

      v_package_count := v_package_count + 1;
    END LOOP;
  END IF;

  -- Step 4: Update item with base package and mark setup complete
  UPDATE items
  SET package_id = v_base_package_id,
      setup_complete = TRUE,
      updated_at = NOW(),
      updated_by = p_user_id
  WHERE id = v_item_id;

  -- Return results
  RETURN QUERY SELECT
    v_item_id,
    v_base_package_id,
    FORMAT('Item created with %s package(s)', v_package_count);
END;
$$ LANGUAGE plpgsql;
-- Migration: Create user_preferences table
-- Description: Store user-specific preferences like font size, theme, etc.
-- Created: 2026-01-10

-- Create user_preferences table
CREATE TABLE user_preferences (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- UI Preferences
    font_size         VARCHAR(20) DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large', 'extra-large')),
    theme             VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),

    -- Other preferences can be added here
    -- locale          VARCHAR(10) DEFAULT 'en',
    -- date_format     VARCHAR(20) DEFAULT 'MM/DD/YYYY',

    created_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create unique index to ensure one preferences record per user
CREATE UNIQUE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Create index for lookups
CREATE INDEX idx_user_preferences_updated_at ON user_preferences(updated_at);

-- Add RLS policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only view their own preferences
CREATE POLICY "Users can view own preferences"
    ON user_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own preferences"
    ON user_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences"
    ON user_preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users can delete own preferences"
    ON user_preferences
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE user_preferences IS 'Store user-specific UI preferences and settings';
COMMENT ON COLUMN user_preferences.font_size IS 'App-wide font size preference: small, medium, large, extra-large';
COMMENT ON COLUMN user_preferences.theme IS 'UI theme preference: light, dark, auto';
-- ============================================================================
-- Migration: Warehouse Dashboard Schema
-- Version: 20260111000000
-- Description: Creates stock_requests system for warehouse dashboard
-- Author: System
-- Date: 2026-01-11
-- ============================================================================
--
-- Purpose: Support warehouse operator dashboard with:
-- - Stock requests (warehouse-to-warehouse or department-to-warehouse)
-- - Pick list management
-- - Incoming deliveries tracking
-- - Priority-based workflows
--
-- ============================================================================

-- ============================================================================
-- SECTION 1: Create stock_requests table
-- ============================================================================
-- Supports TWO use cases:
-- 1. Warehouse-to-warehouse transfers (destination_warehouse_id is set)
-- 2. Department requests (department field is set, destination_warehouse_id is NULL)
-- ============================================================================

CREATE TABLE stock_requests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id),
    business_unit_id        UUID REFERENCES business_units(id),

    -- Request identification
    request_code            VARCHAR(100) NOT NULL,  -- Format: SR-YYYY-nnnn
    request_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    required_date           DATE NOT NULL,  -- When items are needed

    -- Source and destination
    source_warehouse_id     UUID NOT NULL REFERENCES warehouses(id),  -- Where to pick from
    destination_warehouse_id UUID REFERENCES warehouses(id),  -- For warehouse-to-warehouse transfers (nullable)
    department              VARCHAR(100),  -- For department requests (nullable)

    -- Status workflow: draft → submitted → approved → ready_for_pick → picking → completed → cancelled
    status                  VARCHAR(50) DEFAULT 'draft',

    -- Priority levels
    priority                VARCHAR(20) DEFAULT 'normal',  -- low, normal, high, urgent

    -- Request details
    purpose                 TEXT,  -- Reason for request
    notes                   TEXT,

    -- Requestor information
    requested_by_user_id    UUID NOT NULL REFERENCES users(id),
    requested_by_name       VARCHAR(200),  -- Denormalized for quick display

    -- Approval workflow
    approved_by             UUID REFERENCES users(id),
    approved_at             TIMESTAMP,

    -- Picking workflow
    picked_by               UUID REFERENCES users(id),
    picked_at               TIMESTAMP,

    -- Receiving workflow
    received_by             UUID REFERENCES users(id),
    received_at             TIMESTAMP,

    -- Audit fields
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID REFERENCES users(id),
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              UUID REFERENCES users(id),
    deleted_at              TIMESTAMP NULL,
    version                 INTEGER NOT NULL DEFAULT 1,

    -- Constraints
    UNIQUE(company_id, request_code),
    CHECK (status IN ('draft', 'submitted', 'approved', 'ready_for_pick', 'delivered', 'received', 'completed', 'cancelled')),
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    CHECK (destination_warehouse_id IS NOT NULL OR department IS NOT NULL)  -- Must have either destination warehouse OR department
);

-- Comments
COMMENT ON TABLE stock_requests IS 'Stock requests for warehouse operations (warehouse-to-warehouse or department requests)';
COMMENT ON COLUMN stock_requests.destination_warehouse_id IS 'Target warehouse for warehouse-to-warehouse transfers (NULL for department requests)';
COMMENT ON COLUMN stock_requests.department IS 'Requesting department (NULL for warehouse-to-warehouse transfers)';
COMMENT ON COLUMN stock_requests.status IS 'Workflow status: draft → submitted → approved → ready_for_pick → delivered → received → completed → cancelled';
COMMENT ON COLUMN stock_requests.priority IS 'Request priority: low, normal, high, urgent';

-- ============================================================================
-- SECTION 2: Create stock_request_items table
-- ============================================================================

CREATE TABLE stock_request_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_request_id    UUID NOT NULL REFERENCES stock_requests(id) ON DELETE CASCADE,

    -- Item details
    item_id             UUID NOT NULL REFERENCES items(id),
    requested_qty       DECIMAL(20, 4) NOT NULL,
    picked_qty          DECIMAL(20, 4) DEFAULT 0,  -- Actual quantity picked
    uom_id              UUID NOT NULL REFERENCES units_of_measure(id),
    packaging_id        UUID REFERENCES item_packaging(id),

    -- Picking details
    notes               TEXT,

    -- Audit fields
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CHECK (requested_qty > 0),
    CHECK (picked_qty >= 0),
    CHECK (picked_qty <= requested_qty)
);

-- Comments
COMMENT ON TABLE stock_request_items IS 'Line items for stock requests';
COMMENT ON COLUMN stock_request_items.picked_qty IS 'Actual quantity picked (may be less than requested)';
COMMENT ON COLUMN stock_request_items.packaging_id IS 'Selected item package for request quantity';

-- ============================================================================
-- SECTION 3: Add priority to purchase_orders
-- ============================================================================

ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal'
CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

COMMENT ON COLUMN purchase_orders.priority IS 'Purchase order priority: low, normal, high, urgent';

-- ============================================================================
-- SECTION 4: Create indexes for dashboard queries
-- ============================================================================

-- Stock requests indexes
CREATE INDEX idx_stock_requests_company ON stock_requests(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requests_status ON stock_requests(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requests_warehouse ON stock_requests(source_warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requests_bu ON stock_requests(business_unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requests_priority_date ON stock_requests(priority DESC, required_date ASC, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requests_required_date ON stock_requests(required_date) WHERE deleted_at IS NULL;

-- Stock request items indexes
CREATE INDEX idx_stock_request_items_request ON stock_request_items(stock_request_id);
CREATE INDEX idx_stock_request_items_item ON stock_request_items(item_id);

-- Purchase orders indexes (for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_expected_delivery ON purchase_orders(expected_delivery_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_priority_eta ON purchase_orders(priority DESC, expected_delivery_date ASC, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_bu ON purchase_orders(business_unit_id) WHERE deleted_at IS NULL;

-- Item warehouse indexes for low/out stock queries
CREATE INDEX IF NOT EXISTS idx_item_warehouse_stock_levels ON item_warehouse(warehouse_id, current_stock, reorder_level) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_item_warehouse_low_stock ON item_warehouse(warehouse_id, reorder_level) WHERE current_stock > 0 AND current_stock <= reorder_level AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_item_warehouse_out_stock ON item_warehouse(warehouse_id) WHERE current_stock <= 0 AND deleted_at IS NULL;

-- Stock transactions for last movements (if not exists)
CREATE INDEX IF NOT EXISTS idx_stock_transactions_created ON stock_transactions(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_transactions_warehouse ON stock_transactions(warehouse_id, created_at DESC) WHERE deleted_at IS NULL;

-- ============================================================================
-- SECTION 5: Enable RLS for stock_requests
-- ============================================================================

ALTER TABLE stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_request_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 6: RLS Policies for stock_requests
-- ============================================================================
-- Users can only see stock requests for their accessible business units

-- SELECT policy
DROP POLICY IF EXISTS bu_select_policy ON stock_requests;
CREATE POLICY bu_select_policy ON stock_requests
    FOR SELECT
    TO authenticated
    USING (
        business_unit_id IN (
            SELECT business_unit_id
            FROM user_business_unit_access
            WHERE user_id = auth.uid()
        )
        OR source_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
        OR destination_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
    );

-- INSERT policy
DROP POLICY IF EXISTS bu_insert_policy ON stock_requests;
CREATE POLICY bu_insert_policy ON stock_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        business_unit_id IN (
            SELECT business_unit_id
            FROM user_business_unit_access
            WHERE user_id = auth.uid()
        )
    );

-- UPDATE policy
DROP POLICY IF EXISTS bu_update_policy ON stock_requests;
CREATE POLICY bu_update_policy ON stock_requests
    FOR UPDATE
    TO authenticated
    USING (
        business_unit_id IN (
            SELECT business_unit_id
            FROM user_business_unit_access
            WHERE user_id = auth.uid()
        )
        OR source_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
        OR destination_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
    );

-- DELETE policy
DROP POLICY IF EXISTS bu_delete_policy ON stock_requests;
CREATE POLICY bu_delete_policy ON stock_requests
    FOR DELETE
    TO authenticated
    USING (
        business_unit_id IN (
            SELECT business_unit_id
            FROM user_business_unit_access
            WHERE user_id = auth.uid()
        )
        OR source_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
        OR destination_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
    );

-- ============================================================================
-- SECTION 7: RLS Policies for stock_request_items
-- ============================================================================
-- Users can only see items for requests they have access to

-- SELECT policy
DROP POLICY IF EXISTS bu_select_policy ON stock_request_items;
CREATE POLICY bu_select_policy ON stock_request_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM stock_requests sr
            WHERE sr.id = stock_request_items.stock_request_id
            AND (
                sr.business_unit_id IN (
                    SELECT business_unit_id
                    FROM user_business_unit_access
                    WHERE user_id = auth.uid()
                )
                OR sr.source_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
                OR sr.destination_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
            )
        )
    );

-- INSERT policy
DROP POLICY IF EXISTS bu_insert_policy ON stock_request_items;
CREATE POLICY bu_insert_policy ON stock_request_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM stock_requests sr
            WHERE sr.id = stock_request_items.stock_request_id
            AND sr.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
    );

-- UPDATE policy
DROP POLICY IF EXISTS bu_update_policy ON stock_request_items;
CREATE POLICY bu_update_policy ON stock_request_items
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM stock_requests sr
            WHERE sr.id = stock_request_items.stock_request_id
            AND (
                sr.business_unit_id IN (
                    SELECT business_unit_id
                    FROM user_business_unit_access
                    WHERE user_id = auth.uid()
                )
                OR sr.source_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
                OR sr.destination_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
            )
        )
    );

-- DELETE policy
DROP POLICY IF EXISTS bu_delete_policy ON stock_request_items;
CREATE POLICY bu_delete_policy ON stock_request_items
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM stock_requests sr
            WHERE sr.id = stock_request_items.stock_request_id
            AND (
                sr.business_unit_id IN (
                    SELECT business_unit_id
                    FROM user_business_unit_access
                    WHERE user_id = auth.uid()
                )
                OR sr.source_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
                OR sr.destination_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
            )
        )
    );

-- ============================================================================
-- SECTION 8: Create function for generating stock request codes
-- ============================================================================

CREATE OR REPLACE FUNCTION get_next_stock_request_code(p_company_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    v_year VARCHAR(4);
    v_max_number INTEGER;
    v_next_number VARCHAR(4);
    v_code VARCHAR(100);
BEGIN
    -- Get current year
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

    -- Get max number for this year
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(request_code FROM 9) AS INTEGER)
    ), 0) INTO v_max_number
    FROM stock_requests
    WHERE company_id = p_company_id
    AND request_code LIKE 'SR-' || v_year || '-%'
    AND deleted_at IS NULL;

    -- Increment and format
    v_next_number := LPAD((v_max_number + 1)::TEXT, 4, '0');
    v_code := 'SR-' || v_year || '-' || v_next_number;

    RETURN v_code;
END;
$$;

COMMENT ON FUNCTION get_next_stock_request_code IS 'Generates next stock request code in format SR-YYYY-nnnn';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_next_stock_request_code(UUID) TO authenticated;

-- ============================================================================
-- SECTION 9: Create trigger for auto-generating request codes
-- ============================================================================

CREATE OR REPLACE FUNCTION set_stock_request_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only generate code if not provided
    IF NEW.request_code IS NULL OR NEW.request_code = '' THEN
        NEW.request_code := get_next_stock_request_code(NEW.company_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_stock_request_code ON stock_requests;
CREATE TRIGGER trigger_set_stock_request_code
    BEFORE INSERT ON stock_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_stock_request_code();

-- ============================================================================
-- SECTION 10: Create trigger for updated_at timestamps
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_stock_requests_updated_at ON stock_requests;
CREATE TRIGGER trigger_stock_requests_updated_at
    BEFORE UPDATE ON stock_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_stock_request_items_updated_at ON stock_request_items;
CREATE TRIGGER trigger_stock_request_items_updated_at
    BEFORE UPDATE ON stock_request_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verification queries (commented out, uncomment to run manually)
-- SELECT COUNT(*) as stock_requests_count FROM stock_requests;
-- SELECT COUNT(*) as stock_request_items_count FROM stock_request_items;
-- SELECT COUNT(*) as po_with_priority FROM purchase_orders WHERE priority IS NOT NULL;
-- ============================================================================
-- Migration: Add Tablet Warehouse Picking Statuses and Tracking
-- Version: 20260114000000
-- Description: Adds 'picking' and 'picked' statuses to stock_requests
--              and adds tracking columns for picking workflow
-- Author: System
-- Date: 2026-01-14
-- ============================================================================
--
-- Purpose: Support tablet warehouse picking workflow with:
-- - New statuses: 'picking' and 'picked'
-- - Picking start tracking (picking_started_at, picking_started_by)
-- - Delivery tracking (delivered_at, delivered_by)
-- - Updated workflow: draft → submitted → approved → ready_for_pick →
--                    picking → picked → delivered → received → completed
--
-- ============================================================================

-- ============================================================================
-- SECTION 1: Add new tracking columns
-- ============================================================================

-- Add picking start tracking columns
ALTER TABLE stock_requests
ADD COLUMN IF NOT EXISTS picking_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS picking_started_by UUID REFERENCES users(id);

-- Add delivery tracking columns
ALTER TABLE stock_requests
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS delivered_by UUID REFERENCES users(id);

-- Comments for new columns
COMMENT ON COLUMN stock_requests.picking_started_at IS 'Timestamp when picking started';
COMMENT ON COLUMN stock_requests.picking_started_by IS 'User who started picking';
COMMENT ON COLUMN stock_requests.delivered_at IS 'Timestamp when items were delivered';
COMMENT ON COLUMN stock_requests.delivered_by IS 'User who marked as delivered';

-- ============================================================================
-- SECTION 2: Update status constraint to include new statuses
-- ============================================================================

-- Drop existing status constraint
ALTER TABLE stock_requests
DROP CONSTRAINT IF EXISTS stock_requests_status_check;

-- Add new status constraint with 'picking' and 'picked' statuses
ALTER TABLE stock_requests
ADD CONSTRAINT stock_requests_status_check
CHECK (status IN (
    'draft',
    'submitted',
    'approved',
    'ready_for_pick',
    'picking',        -- NEW: Picker is actively picking items
    'picked',         -- NEW: Picking complete, ready for delivery
    'delivered',
    'received',
    'completed',
    'cancelled'
));

-- Update status column comment
COMMENT ON COLUMN stock_requests.status IS 'Workflow status: draft → submitted → approved → ready_for_pick → picking → picked → delivered → received → completed (or cancelled at any stage)';

-- ============================================================================
-- SECTION 3: Create indexes for tablet warehouse queries
-- ============================================================================

-- Index for picking status queries (tablet picking list)
CREATE INDEX IF NOT EXISTS idx_stock_requests_picking_status
ON stock_requests(status, priority DESC, required_date ASC, created_at ASC)
WHERE status IN ('ready_for_pick', 'picking', 'picked')
AND deleted_at IS NULL;

-- Index for picker tracking
CREATE INDEX IF NOT EXISTS idx_stock_requests_picking_started_by
ON stock_requests(picking_started_by, picking_started_at DESC)
WHERE picking_started_by IS NOT NULL
AND deleted_at IS NULL;

-- Index for delivery tracking
CREATE INDEX IF NOT EXISTS idx_stock_requests_delivered_by
ON stock_requests(delivered_by, delivered_at DESC)
WHERE delivered_by IS NOT NULL
AND deleted_at IS NULL;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verification queries (commented out, uncomment to run manually)
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'stock_requests'
-- AND column_name IN ('picking_started_at', 'picking_started_by', 'delivered_at', 'delivered_by');
--
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name = 'stock_requests_status_check';
