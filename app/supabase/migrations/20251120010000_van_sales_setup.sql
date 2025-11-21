-- Migration: Van Sales - Database Setup
-- Version: 20251120010000
-- Description: Add van warehouse support, user-van assignment, and EOD reconciliation
-- Author: System
-- Date: 2025-11-20

-- ============================================================================
-- WAREHOUSES: Add is_van flag
-- ============================================================================
ALTER TABLE warehouses
ADD COLUMN IF NOT EXISTS is_van BOOLEAN DEFAULT false;

COMMENT ON COLUMN warehouses.is_van IS 'Indicates if this warehouse represents a delivery van';

CREATE INDEX IF NOT EXISTS idx_warehouses_is_van ON warehouses(is_van) WHERE is_van = true;

-- ============================================================================
-- USERS: Add van_warehouse_id (optional assignment)
-- ============================================================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS van_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

COMMENT ON COLUMN users.van_warehouse_id IS 'Optional assignment of user/driver to a specific van warehouse';

CREATE INDEX IF NOT EXISTS idx_users_van_warehouse ON users(van_warehouse_id) WHERE van_warehouse_id IS NOT NULL;

-- ============================================================================
-- TABLE: van_eod_reconciliations
-- ============================================================================
-- Tracks end-of-day physical counts and variance reconciliation for van warehouses

CREATE TABLE IF NOT EXISTS van_eod_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  van_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reconciliation_date DATE NOT NULL,

  -- Physical counts by item (JSONB for flexibility)
  -- Format: [{"item_id": "uuid", "item_code": "ITEM-001", "item_name": "Product A", "physical_count": 10}]
  physical_counts JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Expected ending stock (calculated: opening + load - sales)
  -- Format: {"item_id_1": 50, "item_id_2": 30, ...}
  expected_ending JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Variances (calculated: physical - expected)
  -- Format: {"item_id_1": -2, "item_id_2": 0, "item_id_3": 5, ...}
  variances JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Driver notes explaining variances
  driver_notes TEXT,

  -- Approval workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Status values: 'pending', 'approved', 'rejected'

  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,

  -- Link to auto-generated stock adjustment (if approved)
  stock_adjustment_id UUID REFERENCES stock_adjustments(id) ON DELETE SET NULL,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT van_eod_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT van_eod_unique_date UNIQUE (van_warehouse_id, reconciliation_date)
);

COMMENT ON TABLE van_eod_reconciliations IS 'End-of-day physical count reconciliations for van warehouses';
COMMENT ON COLUMN van_eod_reconciliations.physical_counts IS 'Array of physical count records with item details';
COMMENT ON COLUMN van_eod_reconciliations.expected_ending IS 'Expected ending stock calculated from transactions';
COMMENT ON COLUMN van_eod_reconciliations.variances IS 'Variance per item (positive = overage, negative = shortage)';

-- ============================================================================
-- INDEXES for van_eod_reconciliations
-- ============================================================================
CREATE INDEX idx_van_eod_company ON van_eod_reconciliations(company_id);
CREATE INDEX idx_van_eod_van_warehouse ON van_eod_reconciliations(van_warehouse_id);
CREATE INDEX idx_van_eod_driver ON van_eod_reconciliations(driver_id);
CREATE INDEX idx_van_eod_date ON van_eod_reconciliations(reconciliation_date);
CREATE INDEX idx_van_eod_status ON van_eod_reconciliations(status);
CREATE INDEX idx_van_eod_stock_adjustment ON van_eod_reconciliations(stock_adjustment_id) WHERE stock_adjustment_id IS NOT NULL;

-- ============================================================================
-- TRIGGERS for van_eod_reconciliations
-- ============================================================================
CREATE TRIGGER update_van_eod_reconciliations_updated_at
  BEFORE UPDATE ON van_eod_reconciliations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY for van_eod_reconciliations
-- ============================================================================
ALTER TABLE van_eod_reconciliations ENABLE ROW LEVEL SECURITY;

-- Drivers can select their own van's EOD records
CREATE POLICY van_eod_select
  ON van_eod_reconciliations FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Drivers can insert EOD records for their assigned van only
CREATE POLICY van_eod_insert
  ON van_eod_reconciliations FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
    AND driver_id = auth.uid()
    AND van_warehouse_id IN (SELECT van_warehouse_id FROM users WHERE id = auth.uid())
  );

-- Only supervisors/admins can update (approve/reject)
-- For now, allow same company access - refine with role checks later
CREATE POLICY van_eod_update
  ON van_eod_reconciliations FOR UPDATE
  USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Prevent deletion (audit trail)
CREATE POLICY van_eod_delete
  ON van_eod_reconciliations FOR DELETE
  USING (false);

-- ============================================================================
-- HELPER FUNCTION: Get Van's Expected Ending Stock
-- ============================================================================
-- Calculates expected ending stock for a van on a specific date
-- Formula: Opening Stock + Stock Transfers IN - Sales OUT

CREATE OR REPLACE FUNCTION get_van_expected_ending_stock(
  p_van_warehouse_id UUID,
  p_date DATE
)
RETURNS JSONB AS $$
DECLARE
  v_expected JSONB := '{}'::jsonb;
  v_item RECORD;
BEGIN
  -- Calculate expected ending stock per item
  -- This is a simplified version - adjust based on your actual stock movement tables

  FOR v_item IN
    SELECT
      item_id,
      SUM(
        CASE
          -- Stock transfers IN (to van)
          WHEN destination_warehouse_id = p_van_warehouse_id
            AND DATE(transfer_date) <= p_date
            THEN quantity
          -- Stock transfers OUT (from van) - should be rare
          WHEN source_warehouse_id = p_van_warehouse_id
            AND DATE(transfer_date) <= p_date
            THEN -quantity
          ELSE 0
        END
      ) AS net_transfers,
      SUM(
        CASE
          -- Sales from van (deductions)
          WHEN warehouse_id = p_van_warehouse_id
            AND DATE(order_date) <= p_date
            THEN -quantity
          ELSE 0
        END
      ) AS net_sales
    FROM (
      -- Get stock transfers
      SELECT
        st.item_id,
        st.source_warehouse_id,
        st.destination_warehouse_id,
        st.quantity,
        st.transfer_date,
        NULL::UUID AS warehouse_id,
        NULL::DATE AS order_date
      FROM stock_transfer_items st
      JOIN stock_transfers t ON st.stock_transfer_id = t.id
      WHERE (t.source_warehouse_id = p_van_warehouse_id
        OR t.destination_warehouse_id = p_van_warehouse_id)
        AND t.status = 'completed'

      UNION ALL

      -- Get sales order items
      SELECT
        soi.item_id,
        NULL::UUID AS source_warehouse_id,
        NULL::UUID AS destination_warehouse_id,
        soi.quantity,
        NULL::TIMESTAMP AS transfer_date,
        so.warehouse_id,
        so.order_date::DATE
      FROM sales_order_items soi
      JOIN sales_orders so ON soi.sales_order_id = so.id
      WHERE so.warehouse_id = p_van_warehouse_id
        AND so.status NOT IN ('draft', 'cancelled')
    ) movements
    GROUP BY item_id
    HAVING SUM(
      CASE
        WHEN destination_warehouse_id = p_van_warehouse_id THEN quantity
        WHEN source_warehouse_id = p_van_warehouse_id THEN -quantity
        WHEN warehouse_id = p_van_warehouse_id THEN -quantity
        ELSE 0
      END
    ) <> 0
  LOOP
    v_expected := jsonb_set(
      v_expected,
      ARRAY[v_item.item_id::text],
      to_jsonb(COALESCE(v_item.net_transfers, 0) + COALESCE(v_item.net_sales, 0))
    );
  END LOOP;

  RETURN v_expected;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_van_expected_ending_stock IS 'Calculates expected ending stock for a van warehouse on a given date';
