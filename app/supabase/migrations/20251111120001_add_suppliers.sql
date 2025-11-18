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
