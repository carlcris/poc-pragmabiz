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
