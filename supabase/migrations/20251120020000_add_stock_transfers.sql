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
