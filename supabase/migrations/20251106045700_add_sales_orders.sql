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
