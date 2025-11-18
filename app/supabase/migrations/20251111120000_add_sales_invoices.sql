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
    CONSTRAINT chk_payment_method CHECK (payment_method IN ('cash', 'check', 'credit_card', 'bank_transfer', 'other'))
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
