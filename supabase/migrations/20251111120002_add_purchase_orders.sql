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
