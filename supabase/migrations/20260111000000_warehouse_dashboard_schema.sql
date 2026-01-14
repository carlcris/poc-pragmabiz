-- ============================================================================
-- Migration: Warehouse Dashboard Schema
-- Version: 20260111000000
-- Description: Creates stock_requests system for warehouse dashboard
-- Author: System
-- Date: 2026-01-11
-- ============================================================================
--
-- Purpose: Support warehouse operator dashboard with:
-- - Stock requests (warehouse-to-warehouse or department-to-warehouse)
-- - Pick list management
-- - Incoming deliveries tracking
-- - Priority-based workflows
--
-- ============================================================================

-- ============================================================================
-- SECTION 1: Create stock_requests table
-- ============================================================================
-- Supports TWO use cases:
-- 1. Warehouse-to-warehouse transfers (destination_warehouse_id is set)
-- 2. Department requests (department field is set, destination_warehouse_id is NULL)
-- ============================================================================

CREATE TABLE stock_requests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id),
    business_unit_id        UUID REFERENCES business_units(id),

    -- Request identification
    request_code            VARCHAR(100) NOT NULL,  -- Format: SR-YYYY-nnnn
    request_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    required_date           DATE NOT NULL,  -- When items are needed

    -- Source and destination
    source_warehouse_id     UUID NOT NULL REFERENCES warehouses(id),  -- Where to pick from
    destination_warehouse_id UUID REFERENCES warehouses(id),  -- For warehouse-to-warehouse transfers (nullable)
    department              VARCHAR(100),  -- For department requests (nullable)

    -- Status workflow: draft → submitted → approved → ready_for_pick → picking → completed → cancelled
    status                  VARCHAR(50) DEFAULT 'draft',

    -- Priority levels
    priority                VARCHAR(20) DEFAULT 'normal',  -- low, normal, high, urgent

    -- Request details
    purpose                 TEXT,  -- Reason for request
    notes                   TEXT,

    -- Requestor information
    requested_by_user_id    UUID NOT NULL REFERENCES users(id),
    requested_by_name       VARCHAR(200),  -- Denormalized for quick display

    -- Approval workflow
    approved_by             UUID REFERENCES users(id),
    approved_at             TIMESTAMP,

    -- Picking workflow
    picked_by               UUID REFERENCES users(id),
    picked_at               TIMESTAMP,

    -- Receiving workflow
    received_by             UUID REFERENCES users(id),
    received_at             TIMESTAMP,

    -- Audit fields
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID REFERENCES users(id),
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              UUID REFERENCES users(id),
    deleted_at              TIMESTAMP NULL,
    version                 INTEGER NOT NULL DEFAULT 1,

    -- Constraints
    UNIQUE(company_id, request_code),
    CHECK (status IN ('draft', 'submitted', 'approved', 'ready_for_pick', 'delivered', 'received', 'completed', 'cancelled')),
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    CHECK (destination_warehouse_id IS NOT NULL OR department IS NOT NULL)  -- Must have either destination warehouse OR department
);

-- Comments
COMMENT ON TABLE stock_requests IS 'Stock requests for warehouse operations (warehouse-to-warehouse or department requests)';
COMMENT ON COLUMN stock_requests.destination_warehouse_id IS 'Target warehouse for warehouse-to-warehouse transfers (NULL for department requests)';
COMMENT ON COLUMN stock_requests.department IS 'Requesting department (NULL for warehouse-to-warehouse transfers)';
COMMENT ON COLUMN stock_requests.status IS 'Workflow status: draft → submitted → approved → ready_for_pick → delivered → received → completed → cancelled';
COMMENT ON COLUMN stock_requests.priority IS 'Request priority: low, normal, high, urgent';

-- ============================================================================
-- SECTION 2: Create stock_request_items table
-- ============================================================================

CREATE TABLE stock_request_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_request_id    UUID NOT NULL REFERENCES stock_requests(id) ON DELETE CASCADE,

    -- Item details
    item_id             UUID NOT NULL REFERENCES items(id),
    requested_qty       DECIMAL(20, 4) NOT NULL,
    picked_qty          DECIMAL(20, 4) DEFAULT 0,  -- Actual quantity picked
    uom_id              UUID NOT NULL REFERENCES units_of_measure(id),
    packaging_id        UUID REFERENCES item_packaging(id),

    -- Picking details
    notes               TEXT,

    -- Audit fields
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CHECK (requested_qty > 0),
    CHECK (picked_qty >= 0),
    CHECK (picked_qty <= requested_qty)
);

-- Comments
COMMENT ON TABLE stock_request_items IS 'Line items for stock requests';
COMMENT ON COLUMN stock_request_items.picked_qty IS 'Actual quantity picked (may be less than requested)';
COMMENT ON COLUMN stock_request_items.packaging_id IS 'Selected item package for request quantity';

-- ============================================================================
-- SECTION 3: Add priority to purchase_orders
-- ============================================================================

ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal'
CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

COMMENT ON COLUMN purchase_orders.priority IS 'Purchase order priority: low, normal, high, urgent';

-- ============================================================================
-- SECTION 4: Create indexes for dashboard queries
-- ============================================================================

-- Stock requests indexes
CREATE INDEX idx_stock_requests_company ON stock_requests(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requests_status ON stock_requests(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requests_warehouse ON stock_requests(source_warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requests_bu ON stock_requests(business_unit_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requests_priority_date ON stock_requests(priority DESC, required_date ASC, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_requests_required_date ON stock_requests(required_date) WHERE deleted_at IS NULL;

-- Stock request items indexes
CREATE INDEX idx_stock_request_items_request ON stock_request_items(stock_request_id);
CREATE INDEX idx_stock_request_items_item ON stock_request_items(item_id);

-- Purchase orders indexes (for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_expected_delivery ON purchase_orders(expected_delivery_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_priority_eta ON purchase_orders(priority DESC, expected_delivery_date ASC, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_orders_bu ON purchase_orders(business_unit_id) WHERE deleted_at IS NULL;

-- Item warehouse indexes for low/out stock queries
CREATE INDEX IF NOT EXISTS idx_item_warehouse_stock_levels ON item_warehouse(warehouse_id, current_stock, reorder_level) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_item_warehouse_low_stock ON item_warehouse(warehouse_id, reorder_level) WHERE current_stock > 0 AND current_stock <= reorder_level AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_item_warehouse_out_stock ON item_warehouse(warehouse_id) WHERE current_stock <= 0 AND deleted_at IS NULL;

-- Stock transactions for last movements (if not exists)
CREATE INDEX IF NOT EXISTS idx_stock_transactions_created ON stock_transactions(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stock_transactions_warehouse ON stock_transactions(warehouse_id, created_at DESC) WHERE deleted_at IS NULL;

-- ============================================================================
-- SECTION 5: Enable RLS for stock_requests
-- ============================================================================

ALTER TABLE stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_request_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SECTION 6: RLS Policies for stock_requests
-- ============================================================================
-- Users can only see stock requests for their accessible business units

-- SELECT policy
DROP POLICY IF EXISTS bu_select_policy ON stock_requests;
CREATE POLICY bu_select_policy ON stock_requests
    FOR SELECT
    TO authenticated
    USING (
        business_unit_id IN (
            SELECT business_unit_id
            FROM user_business_unit_access
            WHERE user_id = auth.uid()
        )
        OR source_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
        OR destination_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
    );

-- INSERT policy
DROP POLICY IF EXISTS bu_insert_policy ON stock_requests;
CREATE POLICY bu_insert_policy ON stock_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        business_unit_id IN (
            SELECT business_unit_id
            FROM user_business_unit_access
            WHERE user_id = auth.uid()
        )
    );

-- UPDATE policy
DROP POLICY IF EXISTS bu_update_policy ON stock_requests;
CREATE POLICY bu_update_policy ON stock_requests
    FOR UPDATE
    TO authenticated
    USING (
        business_unit_id IN (
            SELECT business_unit_id
            FROM user_business_unit_access
            WHERE user_id = auth.uid()
        )
        OR source_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
        OR destination_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
    );

-- DELETE policy
DROP POLICY IF EXISTS bu_delete_policy ON stock_requests;
CREATE POLICY bu_delete_policy ON stock_requests
    FOR DELETE
    TO authenticated
    USING (
        business_unit_id IN (
            SELECT business_unit_id
            FROM user_business_unit_access
            WHERE user_id = auth.uid()
        )
        OR source_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
        OR destination_warehouse_id IN (
            SELECT w.id
            FROM warehouses w
            WHERE w.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
    );

-- ============================================================================
-- SECTION 7: RLS Policies for stock_request_items
-- ============================================================================
-- Users can only see items for requests they have access to

-- SELECT policy
DROP POLICY IF EXISTS bu_select_policy ON stock_request_items;
CREATE POLICY bu_select_policy ON stock_request_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM stock_requests sr
            WHERE sr.id = stock_request_items.stock_request_id
            AND (
                sr.business_unit_id IN (
                    SELECT business_unit_id
                    FROM user_business_unit_access
                    WHERE user_id = auth.uid()
                )
                OR sr.source_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
                OR sr.destination_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
            )
        )
    );

-- INSERT policy
DROP POLICY IF EXISTS bu_insert_policy ON stock_request_items;
CREATE POLICY bu_insert_policy ON stock_request_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM stock_requests sr
            WHERE sr.id = stock_request_items.stock_request_id
            AND sr.business_unit_id IN (
                SELECT business_unit_id
                FROM user_business_unit_access
                WHERE user_id = auth.uid()
            )
        )
    );

-- UPDATE policy
DROP POLICY IF EXISTS bu_update_policy ON stock_request_items;
CREATE POLICY bu_update_policy ON stock_request_items
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM stock_requests sr
            WHERE sr.id = stock_request_items.stock_request_id
            AND (
                sr.business_unit_id IN (
                    SELECT business_unit_id
                    FROM user_business_unit_access
                    WHERE user_id = auth.uid()
                )
                OR sr.source_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
                OR sr.destination_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
            )
        )
    );

-- DELETE policy
DROP POLICY IF EXISTS bu_delete_policy ON stock_request_items;
CREATE POLICY bu_delete_policy ON stock_request_items
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM stock_requests sr
            WHERE sr.id = stock_request_items.stock_request_id
            AND (
                sr.business_unit_id IN (
                    SELECT business_unit_id
                    FROM user_business_unit_access
                    WHERE user_id = auth.uid()
                )
                OR sr.source_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
                OR sr.destination_warehouse_id IN (
                    SELECT w.id
                    FROM warehouses w
                    WHERE w.business_unit_id IN (
                        SELECT business_unit_id
                        FROM user_business_unit_access
                        WHERE user_id = auth.uid()
                    )
                )
            )
        )
    );

-- ============================================================================
-- SECTION 8: Create function for generating stock request codes
-- ============================================================================

CREATE OR REPLACE FUNCTION get_next_stock_request_code(p_company_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    v_year VARCHAR(4);
    v_max_number INTEGER;
    v_next_number VARCHAR(4);
    v_code VARCHAR(100);
BEGIN
    -- Get current year
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

    -- Get max number for this year
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(request_code FROM 9) AS INTEGER)
    ), 0) INTO v_max_number
    FROM stock_requests
    WHERE company_id = p_company_id
    AND request_code LIKE 'SR-' || v_year || '-%'
    AND deleted_at IS NULL;

    -- Increment and format
    v_next_number := LPAD((v_max_number + 1)::TEXT, 4, '0');
    v_code := 'SR-' || v_year || '-' || v_next_number;

    RETURN v_code;
END;
$$;

COMMENT ON FUNCTION get_next_stock_request_code IS 'Generates next stock request code in format SR-YYYY-nnnn';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_next_stock_request_code(UUID) TO authenticated;

-- ============================================================================
-- SECTION 9: Create trigger for auto-generating request codes
-- ============================================================================

CREATE OR REPLACE FUNCTION set_stock_request_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only generate code if not provided
    IF NEW.request_code IS NULL OR NEW.request_code = '' THEN
        NEW.request_code := get_next_stock_request_code(NEW.company_id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_stock_request_code ON stock_requests;
CREATE TRIGGER trigger_set_stock_request_code
    BEFORE INSERT ON stock_requests
    FOR EACH ROW
    EXECUTE FUNCTION set_stock_request_code();

-- ============================================================================
-- SECTION 10: Create trigger for updated_at timestamps
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_stock_requests_updated_at ON stock_requests;
CREATE TRIGGER trigger_stock_requests_updated_at
    BEFORE UPDATE ON stock_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_stock_request_items_updated_at ON stock_request_items;
CREATE TRIGGER trigger_stock_request_items_updated_at
    BEFORE UPDATE ON stock_request_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Verification queries (commented out, uncomment to run manually)
-- SELECT COUNT(*) as stock_requests_count FROM stock_requests;
-- SELECT COUNT(*) as stock_request_items_count FROM stock_request_items;
-- SELECT COUNT(*) as po_with_priority FROM purchase_orders WHERE priority IS NOT NULL;
