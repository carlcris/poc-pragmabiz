-- ============================================================================
-- Migration: Inventory Acquisition Workflow Tables
-- Purpose: Creates tables for Stock Requisitions, Load Lists, and GRNs
-- Date: 2026-01-31
-- Reference: /docs/inventory-acquisition-workflow.md
-- ============================================================================

-- ============================================================================
-- SECTION 1: Stock Requisitions
-- ============================================================================

-- Table: stock_requisitions
-- Purpose: Formal stock requisition tracking for items requested from supplier via phone/email
CREATE TABLE stock_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sr_number VARCHAR(50) UNIQUE NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE RESTRICT,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,

    requisition_date DATE NOT NULL DEFAULT CURRENT_DATE,
    required_by_date DATE,
    requested_by UUID NOT NULL REFERENCES users(id),

    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    -- Status: draft, submitted, partially_fulfilled, fulfilled, cancelled

    notes TEXT,
    total_amount DECIMAL(20, 4) DEFAULT 0,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_sr_status CHECK (status IN ('draft', 'submitted', 'partially_fulfilled', 'fulfilled', 'cancelled'))
);

-- Indexes
CREATE INDEX idx_stock_requisitions_company ON stock_requisitions(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requisitions_business_unit ON stock_requisitions(business_unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requisitions_supplier ON stock_requisitions(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requisitions_status ON stock_requisitions(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requisitions_date ON stock_requisitions(requisition_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requisitions_required_by_date ON stock_requisitions(required_by_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requisitions_requested_by ON stock_requisitions(requested_by) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requisitions_sr_number ON stock_requisitions(sr_number) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE stock_requisitions IS 'Stock requisitions for supplier orders (no formal PO process)';
COMMENT ON COLUMN stock_requisitions.sr_number IS 'Unique stock requisition number (e.g., SR-2026-0001)';
COMMENT ON COLUMN stock_requisitions.status IS 'Status: draft, submitted, partially_fulfilled, fulfilled, cancelled';
COMMENT ON COLUMN stock_requisitions.required_by_date IS 'Requested date when items are needed';
COMMENT ON COLUMN stock_requisitions.total_amount IS 'Total estimated value of the requisition';

-- ============================================================================

-- Table: stock_requisition_items
-- Purpose: Line items for stock requisitions
CREATE TABLE stock_requisition_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sr_id UUID NOT NULL REFERENCES stock_requisitions(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,

    requested_qty DECIMAL(15, 4) NOT NULL CHECK (requested_qty > 0),
    unit_price DECIMAL(20, 4) NOT NULL DEFAULT 0,
    total_price DECIMAL(20, 4) GENERATED ALWAYS AS (requested_qty * unit_price) STORED,

    fulfilled_qty DECIMAL(15, 4) NOT NULL DEFAULT 0 CHECK (fulfilled_qty >= 0),
    outstanding_qty DECIMAL(15, 4) GENERATED ALWAYS AS (requested_qty - fulfilled_qty) STORED,

    notes TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_sr_item_fulfilled CHECK (fulfilled_qty <= requested_qty)
);

-- Indexes
CREATE INDEX idx_stock_requisition_items_sr ON stock_requisition_items(sr_id);
CREATE INDEX idx_stock_requisition_items_item ON stock_requisition_items(item_id);
CREATE INDEX idx_stock_requisition_items_outstanding ON stock_requisition_items((requested_qty - fulfilled_qty)) WHERE (requested_qty - fulfilled_qty) > 0;

-- Comments
COMMENT ON TABLE stock_requisition_items IS 'Line items for stock requisitions';
COMMENT ON COLUMN stock_requisition_items.fulfilled_qty IS 'Running total of fulfilled quantity from load lists';
COMMENT ON COLUMN stock_requisition_items.outstanding_qty IS 'Calculated: requested_qty - fulfilled_qty';

-- ============================================================================
-- SECTION 2: Load Lists
-- ============================================================================

-- Table: load_lists
-- Purpose: Supplier-provided document listing items in shipment (single source of truth)
CREATE TABLE load_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ll_number VARCHAR(50) UNIQUE NOT NULL,
    supplier_ll_number VARCHAR(100),

    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE RESTRICT,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,

    container_number VARCHAR(100),
    seal_number VARCHAR(100),
    batch_number TEXT,

    estimated_arrival_date DATE,
    actual_arrival_date DATE,
    load_date DATE,

    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    -- Status: draft, confirmed, in_transit, arrived, receiving, pending_approval, received, cancelled

    -- Workflow tracking
    created_by UUID NOT NULL REFERENCES users(id),
    received_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    received_date TIMESTAMPTZ,
    approved_date TIMESTAMPTZ,

    notes TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_ll_status CHECK (status IN ('draft', 'confirmed', 'in_transit', 'arrived', 'receiving', 'pending_approval', 'received', 'cancelled'))
);

-- Indexes
CREATE INDEX idx_load_lists_company ON load_lists(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_load_lists_business_unit ON load_lists(business_unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_load_lists_supplier ON load_lists(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_load_lists_warehouse ON load_lists(warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_load_lists_status ON load_lists(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_load_lists_arrival_date ON load_lists(estimated_arrival_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_load_lists_ll_number ON load_lists(ll_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_load_lists_container ON load_lists(container_number) WHERE deleted_at IS NULL AND container_number IS NOT NULL;

-- Comments
COMMENT ON TABLE load_lists IS 'Supplier load lists - single source of truth for shipments';
COMMENT ON COLUMN load_lists.ll_number IS 'Unique load list number (e.g., LL-2026-0001)';
COMMENT ON COLUMN load_lists.supplier_ll_number IS 'Supplier''s reference number for the load list';
COMMENT ON COLUMN load_lists.status IS 'Status: draft, confirmed, in_transit, arrived, receiving, pending_approval, received, cancelled';
COMMENT ON COLUMN load_lists.container_number IS 'Container or truck number';
COMMENT ON COLUMN load_lists.seal_number IS 'Seal number for the container';

-- ============================================================================

-- Table: load_list_items
-- Purpose: Line items for load lists
CREATE TABLE load_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_list_id UUID NOT NULL REFERENCES load_lists(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,

    load_list_qty DECIMAL(15, 4) NOT NULL CHECK (load_list_qty > 0),
    received_qty DECIMAL(15, 4) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
    damaged_qty DECIMAL(15, 4) NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),
    shortage_qty DECIMAL(15, 4) GENERATED ALWAYS AS (load_list_qty - (received_qty + damaged_qty)) STORED,

    unit_price DECIMAL(20, 4) NOT NULL DEFAULT 0,
    total_price DECIMAL(20, 4) GENERATED ALWAYS AS (load_list_qty * unit_price) STORED,

    notes TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_ll_item_received CHECK ((received_qty + damaged_qty) <= load_list_qty)
);

-- Indexes
CREATE INDEX idx_load_list_items_load_list ON load_list_items(load_list_id);
CREATE INDEX idx_load_list_items_item ON load_list_items(item_id);

-- Comments
COMMENT ON TABLE load_list_items IS 'Line items for load lists';
COMMENT ON COLUMN load_list_items.load_list_qty IS 'Quantity per load list (expected)';
COMMENT ON COLUMN load_list_items.received_qty IS 'Actual received quantity (can be partial)';
COMMENT ON COLUMN load_list_items.damaged_qty IS 'Damaged units during receiving';
COMMENT ON COLUMN load_list_items.shortage_qty IS 'Calculated: load_list_qty - (received_qty + damaged_qty)';

-- ============================================================================

-- Table: load_list_sr_items
-- Purpose: Junction table linking load list items to stock requisition items (N:N)
CREATE TABLE load_list_sr_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    load_list_item_id UUID NOT NULL REFERENCES load_list_items(id) ON DELETE CASCADE,
    sr_item_id UUID NOT NULL REFERENCES stock_requisition_items(id) ON DELETE CASCADE,

    fulfilled_qty DECIMAL(15, 4) NOT NULL CHECK (fulfilled_qty > 0),

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_ll_sr_item UNIQUE(load_list_item_id, sr_item_id)
);

-- Indexes
CREATE INDEX idx_load_list_sr_items_ll_item ON load_list_sr_items(load_list_item_id);
CREATE INDEX idx_load_list_sr_items_sr_item ON load_list_sr_items(sr_item_id);

-- Comments
COMMENT ON TABLE load_list_sr_items IS 'Junction table linking load list items to stock requisition items (N:N relationship)';
COMMENT ON COLUMN load_list_sr_items.fulfilled_qty IS 'How much of the SR item this LL item fulfills';

-- ============================================================================
-- SECTION 3: Goods Receipt Notes (GRN)
-- ============================================================================

-- Table: grns
-- Purpose: Internal receiving document generated from Load List
CREATE TABLE grns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number VARCHAR(50) UNIQUE NOT NULL,
    load_list_id UUID NOT NULL REFERENCES load_lists(id) ON DELETE RESTRICT,

    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,

    container_number VARCHAR(100),
    seal_number VARCHAR(100),
    batch_number TEXT,
    receiving_date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,

    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    -- Status: draft, receiving, pending_approval, approved, rejected

    -- Workflow tracking
    received_by UUID REFERENCES users(id),
    checked_by UUID REFERENCES users(id),

    notes TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_grn_status CHECK (status IN ('draft', 'receiving', 'pending_approval', 'approved', 'rejected')),
    CONSTRAINT uq_grn_load_list UNIQUE(load_list_id)
);

-- Indexes
CREATE INDEX idx_grns_company ON grns(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_grns_business_unit ON grns(business_unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_grns_warehouse ON grns(warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_grns_load_list ON grns(load_list_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_grns_status ON grns(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_grns_grn_number ON grns(grn_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_grns_receiving_date ON grns(receiving_date) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE grns IS 'Goods Receipt Notes - internal receiving documents';
COMMENT ON COLUMN grns.grn_number IS 'Unique GRN number (e.g., GRN-2026-0001)';
COMMENT ON COLUMN grns.delivery_date IS 'Date supplier delivered items (for LIFO tracking)';
COMMENT ON COLUMN grns.status IS 'Status: draft, receiving, pending_approval, approved, rejected';

-- ============================================================================

-- Table: grn_items
-- Purpose: Line items for GRNs
CREATE TABLE grn_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID NOT NULL REFERENCES grns(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,

    load_list_qty DECIMAL(15, 4) NOT NULL CHECK (load_list_qty >= 0),
    received_qty DECIMAL(15, 4) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
    damaged_qty DECIMAL(15, 4) NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),

    num_boxes INTEGER DEFAULT 0 CHECK (num_boxes >= 0),
    barcodes_printed BOOLEAN DEFAULT false,

    notes TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_grn_items_grn ON grn_items(grn_id);
CREATE INDEX idx_grn_items_item ON grn_items(item_id);

-- Comments
COMMENT ON TABLE grn_items IS 'Line items for Goods Receipt Notes';
COMMENT ON COLUMN grn_items.load_list_qty IS 'Expected quantity from load list';
COMMENT ON COLUMN grn_items.received_qty IS 'Actual received quantity';
COMMENT ON COLUMN grn_items.damaged_qty IS 'Damaged units';
COMMENT ON COLUMN grn_items.num_boxes IS 'Number of boxes/cartons received';
COMMENT ON COLUMN grn_items.barcodes_printed IS 'Whether barcodes have been printed for this item';

-- ============================================================================

-- Table: grn_boxes
-- Purpose: Box-level tracking for received items
CREATE TABLE grn_boxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_item_id UUID NOT NULL REFERENCES grn_items(id) ON DELETE CASCADE,

    box_number INTEGER NOT NULL CHECK (box_number > 0),
    barcode VARCHAR(200) UNIQUE NOT NULL,
    qty_per_box DECIMAL(15, 4) NOT NULL CHECK (qty_per_box > 0),

    warehouse_location_id UUID REFERENCES warehouse_locations(id),

    delivery_date DATE NOT NULL,
    container_number VARCHAR(100),
    seal_number VARCHAR(100),

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_grn_item_box_number UNIQUE(grn_item_id, box_number)
);

-- Indexes
CREATE INDEX idx_grn_boxes_grn_item ON grn_boxes(grn_item_id);
CREATE INDEX idx_grn_boxes_barcode ON grn_boxes(barcode);
CREATE INDEX idx_grn_boxes_location ON grn_boxes(warehouse_location_id) WHERE warehouse_location_id IS NOT NULL;
CREATE INDEX idx_grn_boxes_delivery_date ON grn_boxes(delivery_date);

-- Comments
COMMENT ON TABLE grn_boxes IS 'Box/carton level tracking for received items';
COMMENT ON COLUMN grn_boxes.box_number IS 'Sequential box number (1, 2, 3...)';
COMMENT ON COLUMN grn_boxes.barcode IS 'Generated barcode for this box';
COMMENT ON COLUMN grn_boxes.qty_per_box IS 'Items in this box';
COMMENT ON COLUMN grn_boxes.delivery_date IS 'For LIFO tracking';

-- ============================================================================
-- SECTION 4: Damaged Items & Returns
-- ============================================================================

-- Table: damaged_items
-- Purpose: Track damaged/defective items separately
CREATE TABLE damaged_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID NOT NULL REFERENCES grns(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,

    qty DECIMAL(15, 4) NOT NULL CHECK (qty > 0),
    damage_type VARCHAR(50) NOT NULL,
    -- Types: broken, defective, missing, wrong_item, expired, other
    description TEXT,

    reported_by UUID NOT NULL REFERENCES users(id),
    reported_date TIMESTAMPTZ NOT NULL DEFAULT now(),

    action_taken VARCHAR(100),
    -- Actions: return_to_supplier, write_off, under_investigation, resolved
    status VARCHAR(50) NOT NULL DEFAULT 'reported',
    -- Status: reported, processing, resolved

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_damaged_type CHECK (damage_type IN ('broken', 'defective', 'missing', 'wrong_item', 'expired', 'other')),
    CONSTRAINT chk_damaged_status CHECK (status IN ('reported', 'processing', 'resolved'))
);

-- Indexes
CREATE INDEX idx_damaged_items_grn ON damaged_items(grn_id);
CREATE INDEX idx_damaged_items_item ON damaged_items(item_id);
CREATE INDEX idx_damaged_items_status ON damaged_items(status);
CREATE INDEX idx_damaged_items_damage_type ON damaged_items(damage_type);
CREATE INDEX idx_damaged_items_reported_date ON damaged_items(reported_date);

-- Comments
COMMENT ON TABLE damaged_items IS 'Damaged or defective items log';
COMMENT ON COLUMN damaged_items.damage_type IS 'Type: broken, defective, missing, wrong_item, expired, other';
COMMENT ON COLUMN damaged_items.status IS 'Status: reported, processing, resolved';

-- ============================================================================

-- Table: return_to_suppliers
-- Purpose: Return damaged/defective items to supplier
CREATE TABLE return_to_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rts_number VARCHAR(50) UNIQUE NOT NULL,
    grn_id UUID REFERENCES grns(id) ON DELETE RESTRICT,

    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE RESTRICT,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,

    return_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT,

    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    -- Status: draft, pending, approved, shipped, completed, cancelled

    -- Workflow tracking
    created_by UUID NOT NULL REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_date TIMESTAMPTZ,

    notes TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES users(id),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT chk_rts_status CHECK (status IN ('draft', 'pending', 'approved', 'shipped', 'completed', 'cancelled'))
);

-- Indexes
CREATE INDEX idx_return_to_suppliers_company ON return_to_suppliers(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_return_to_suppliers_business_unit ON return_to_suppliers(business_unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_return_to_suppliers_supplier ON return_to_suppliers(supplier_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_return_to_suppliers_warehouse ON return_to_suppliers(warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_return_to_suppliers_grn ON return_to_suppliers(grn_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_return_to_suppliers_status ON return_to_suppliers(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_return_to_suppliers_rts_number ON return_to_suppliers(rts_number) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE return_to_suppliers IS 'Return to supplier documents for damaged/defective items';
COMMENT ON COLUMN return_to_suppliers.rts_number IS 'Unique RTS number (e.g., RTS-2026-0001)';
COMMENT ON COLUMN return_to_suppliers.status IS 'Status: draft, pending, approved, shipped, completed, cancelled';

-- ============================================================================

-- Table: rts_items
-- Purpose: Line items for return to supplier documents
CREATE TABLE rts_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rts_id UUID NOT NULL REFERENCES return_to_suppliers(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    grn_item_id UUID REFERENCES grn_items(id) ON DELETE SET NULL,

    return_qty DECIMAL(15, 4) NOT NULL CHECK (return_qty > 0),
    reason TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_rts_items_rts ON rts_items(rts_id);
CREATE INDEX idx_rts_items_item ON rts_items(item_id);
CREATE INDEX idx_rts_items_grn_item ON rts_items(grn_item_id) WHERE grn_item_id IS NOT NULL;

-- Comments
COMMENT ON TABLE rts_items IS 'Line items for return to supplier documents';
COMMENT ON COLUMN rts_items.grn_item_id IS 'Link back to original GRN item';

-- ============================================================================
-- SECTION 5: Add in_transit field to inventory
-- ============================================================================
-- Note: warehouse_locations table already exists from migration 20260106000001_add_stock_adjustment_normalization.sql

-- Add in_transit field to item_warehouse table for tracking items in shipment
ALTER TABLE item_warehouse ADD COLUMN IF NOT EXISTS in_transit DECIMAL(15, 4) DEFAULT 0 NOT NULL CHECK (in_transit >= 0);
ALTER TABLE item_warehouse ADD COLUMN IF NOT EXISTS estimated_arrival_date DATE;

-- Add index for in_transit items
CREATE INDEX idx_item_warehouse_in_transit ON item_warehouse(in_transit) WHERE in_transit > 0;

-- Comment
COMMENT ON COLUMN item_warehouse.in_transit IS 'Quantity currently in shipment (not yet received)';
COMMENT ON COLUMN item_warehouse.estimated_arrival_date IS 'Estimated arrival date for in-transit inventory';

-- ============================================================================
-- SECTION 6: Notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(100) NOT NULL,
    metadata JSONB,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id, created_at DESC);

COMMENT ON TABLE notifications IS 'In-app user notifications';

-- ============================================================================
-- SECTION 7: Triggers for updated_at
-- ============================================================================

CREATE TRIGGER trigger_stock_requisitions_updated_at
    BEFORE UPDATE ON stock_requisitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_stock_requisition_items_updated_at
    BEFORE UPDATE ON stock_requisition_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_load_lists_updated_at
    BEFORE UPDATE ON load_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_load_list_items_updated_at
    BEFORE UPDATE ON load_list_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_grns_updated_at
    BEFORE UPDATE ON grns
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_grn_items_updated_at
    BEFORE UPDATE ON grn_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_damaged_items_updated_at
    BEFORE UPDATE ON damaged_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_return_to_suppliers_updated_at
    BEFORE UPDATE ON return_to_suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_rts_items_updated_at
    BEFORE UPDATE ON rts_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SECTION 8: Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE stock_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE load_list_sr_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grns ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE damaged_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_to_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rts_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Stock Requisitions
CREATE POLICY stock_requisitions_company_isolation_select ON stock_requisitions
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY stock_requisitions_company_isolation_insert ON stock_requisitions
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY stock_requisitions_company_isolation_update ON stock_requisitions
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY stock_requisitions_company_isolation_delete ON stock_requisitions
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- RLS Policies: Stock Requisition Items
CREATE POLICY stock_requisition_items_company_isolation_select ON stock_requisition_items
    FOR SELECT
    USING (sr_id IN (SELECT id FROM stock_requisitions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY stock_requisition_items_company_isolation_insert ON stock_requisition_items
    FOR INSERT
    WITH CHECK (sr_id IN (SELECT id FROM stock_requisitions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY stock_requisition_items_company_isolation_update ON stock_requisition_items
    FOR UPDATE
    USING (sr_id IN (SELECT id FROM stock_requisitions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())))
    WITH CHECK (sr_id IN (SELECT id FROM stock_requisitions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY stock_requisition_items_company_isolation_delete ON stock_requisition_items
    FOR DELETE
    USING (sr_id IN (SELECT id FROM stock_requisitions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

-- RLS Policies: Load Lists
CREATE POLICY load_lists_company_isolation_select ON load_lists
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY load_lists_company_isolation_insert ON load_lists
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY load_lists_company_isolation_update ON load_lists
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY load_lists_company_isolation_delete ON load_lists
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- RLS Policies: Load List Items
CREATE POLICY load_list_items_company_isolation_select ON load_list_items
    FOR SELECT
    USING (load_list_id IN (SELECT id FROM load_lists WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY load_list_items_company_isolation_insert ON load_list_items
    FOR INSERT
    WITH CHECK (load_list_id IN (SELECT id FROM load_lists WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY load_list_items_company_isolation_update ON load_list_items
    FOR UPDATE
    USING (load_list_id IN (SELECT id FROM load_lists WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())))
    WITH CHECK (load_list_id IN (SELECT id FROM load_lists WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY load_list_items_company_isolation_delete ON load_list_items
    FOR DELETE
    USING (load_list_id IN (SELECT id FROM load_lists WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

-- RLS Policies: Load List SR Items (junction table)
CREATE POLICY load_list_sr_items_company_isolation_select ON load_list_sr_items
    FOR SELECT
    USING (load_list_item_id IN (
        SELECT lli.id FROM load_list_items lli
        JOIN load_lists ll ON ll.id = lli.load_list_id
        WHERE ll.company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    ));

CREATE POLICY load_list_sr_items_company_isolation_insert ON load_list_sr_items
    FOR INSERT
    WITH CHECK (load_list_item_id IN (
        SELECT lli.id FROM load_list_items lli
        JOIN load_lists ll ON ll.id = lli.load_list_id
        WHERE ll.company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    ));

CREATE POLICY load_list_sr_items_company_isolation_update ON load_list_sr_items
    FOR UPDATE
    USING (load_list_item_id IN (
        SELECT lli.id FROM load_list_items lli
        JOIN load_lists ll ON ll.id = lli.load_list_id
        WHERE ll.company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    ))
    WITH CHECK (load_list_item_id IN (
        SELECT lli.id FROM load_list_items lli
        JOIN load_lists ll ON ll.id = lli.load_list_id
        WHERE ll.company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    ));

CREATE POLICY load_list_sr_items_company_isolation_delete ON load_list_sr_items
    FOR DELETE
    USING (load_list_item_id IN (
        SELECT lli.id FROM load_list_items lli
        JOIN load_lists ll ON ll.id = lli.load_list_id
        WHERE ll.company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    ));

-- RLS Policies: Notifications
CREATE POLICY notifications_company_select ON notifications
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY notifications_company_insert ON notifications
    FOR INSERT
    WITH CHECK (
        company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
        AND user_id IN (
            SELECT id FROM users
            WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
              AND deleted_at IS NULL
        )
    );

CREATE POLICY notifications_company_update ON notifications
    FOR UPDATE
    USING (user_id = auth.uid());

-- RLS Policies: GRNs
CREATE POLICY grns_company_isolation_select ON grns
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY grns_company_isolation_insert ON grns
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY grns_company_isolation_update ON grns
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY grns_company_isolation_delete ON grns
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- RLS Policies: GRN Items
CREATE POLICY grn_items_company_isolation_select ON grn_items
    FOR SELECT
    USING (grn_id IN (SELECT id FROM grns WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY grn_items_company_isolation_insert ON grn_items
    FOR INSERT
    WITH CHECK (grn_id IN (SELECT id FROM grns WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY grn_items_company_isolation_update ON grn_items
    FOR UPDATE
    USING (grn_id IN (SELECT id FROM grns WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())))
    WITH CHECK (grn_id IN (SELECT id FROM grns WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY grn_items_company_isolation_delete ON grn_items
    FOR DELETE
    USING (grn_id IN (SELECT id FROM grns WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

-- RLS Policies: GRN Boxes
CREATE POLICY grn_boxes_company_isolation_select ON grn_boxes
    FOR SELECT
    USING (grn_item_id IN (
        SELECT gi.id FROM grn_items gi
        JOIN grns g ON g.id = gi.grn_id
        WHERE g.company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    ));

CREATE POLICY grn_boxes_company_isolation_insert ON grn_boxes
    FOR INSERT
    WITH CHECK (grn_item_id IN (
        SELECT gi.id FROM grn_items gi
        JOIN grns g ON g.id = gi.grn_id
        WHERE g.company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    ));

CREATE POLICY grn_boxes_company_isolation_update ON grn_boxes
    FOR UPDATE
    USING (grn_item_id IN (
        SELECT gi.id FROM grn_items gi
        JOIN grns g ON g.id = gi.grn_id
        WHERE g.company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    ))
    WITH CHECK (grn_item_id IN (
        SELECT gi.id FROM grn_items gi
        JOIN grns g ON g.id = gi.grn_id
        WHERE g.company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    ));

CREATE POLICY grn_boxes_company_isolation_delete ON grn_boxes
    FOR DELETE
    USING (grn_item_id IN (
        SELECT gi.id FROM grn_items gi
        JOIN grns g ON g.id = gi.grn_id
        WHERE g.company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    ));

-- RLS Policies: Damaged Items
CREATE POLICY damaged_items_company_isolation_select ON damaged_items
    FOR SELECT
    USING (grn_id IN (SELECT id FROM grns WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY damaged_items_company_isolation_insert ON damaged_items
    FOR INSERT
    WITH CHECK (grn_id IN (SELECT id FROM grns WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY damaged_items_company_isolation_update ON damaged_items
    FOR UPDATE
    USING (grn_id IN (SELECT id FROM grns WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())))
    WITH CHECK (grn_id IN (SELECT id FROM grns WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY damaged_items_company_isolation_delete ON damaged_items
    FOR DELETE
    USING (grn_id IN (SELECT id FROM grns WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

-- RLS Policies: Return to Suppliers
CREATE POLICY return_to_suppliers_company_isolation_select ON return_to_suppliers
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY return_to_suppliers_company_isolation_insert ON return_to_suppliers
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY return_to_suppliers_company_isolation_update ON return_to_suppliers
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY return_to_suppliers_company_isolation_delete ON return_to_suppliers
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- RLS Policies: RTS Items
CREATE POLICY rts_items_company_isolation_select ON rts_items
    FOR SELECT
    USING (rts_id IN (SELECT id FROM return_to_suppliers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY rts_items_company_isolation_insert ON rts_items
    FOR INSERT
    WITH CHECK (rts_id IN (SELECT id FROM return_to_suppliers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY rts_items_company_isolation_update ON rts_items
    FOR UPDATE
    USING (rts_id IN (SELECT id FROM return_to_suppliers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())))
    WITH CHECK (rts_id IN (SELECT id FROM return_to_suppliers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));

CREATE POLICY rts_items_company_isolation_delete ON rts_items
    FOR DELETE
    USING (rts_id IN (SELECT id FROM return_to_suppliers WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())));
