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
