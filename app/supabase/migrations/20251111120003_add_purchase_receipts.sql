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
