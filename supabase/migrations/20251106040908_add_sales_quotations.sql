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
