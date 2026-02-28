-- ============================================================================
-- Migration: Add Item Batch Tracking Tables
-- Version: 20260224100000
-- Description: Adds item_batch and item_location_batch stock layers plus
--              reconciliation helpers for warehouse/location/batch totals.
-- Date: 2026-02-24
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABLE: item_batch
-- Aggregate stock per item + warehouse + batch_code
-- ============================================================================

CREATE TABLE IF NOT EXISTS item_batch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  item_id UUID NOT NULL REFERENCES items(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  batch_code VARCHAR(150) NOT NULL,
  received_at TIMESTAMP NOT NULL,
  qty_on_hand DECIMAL(20, 4) NOT NULL DEFAULT 0,
  qty_reserved DECIMAL(20, 4) NOT NULL DEFAULT 0,
  qty_available DECIMAL(20, 4) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID NULL REFERENCES users(id),
  deleted_at TIMESTAMP NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (company_id, item_id, warehouse_id, batch_code),
  CHECK (BTRIM(batch_code) <> ''),
  CHECK (qty_on_hand >= 0),
  CHECK (qty_reserved >= 0),
  CHECK (qty_reserved <= qty_on_hand)
);

CREATE INDEX IF NOT EXISTS idx_item_batch_company
  ON item_batch(company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_batch_item_wh
  ON item_batch(company_id, item_id, warehouse_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_batch_fifo
  ON item_batch(company_id, item_id, warehouse_id, received_at, batch_code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_batch_batch_code
  ON item_batch(company_id, batch_code)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trigger_item_batch_updated_at ON item_batch;
CREATE TRIGGER trigger_item_batch_updated_at
  BEFORE UPDATE ON item_batch
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE item_batch IS
  'Batch-level stock balances for an item within a warehouse.';
COMMENT ON COLUMN item_batch.received_at IS
  'Batch receipt timestamp preserved across warehouse transfers for FIFO.';

-- ============================================================================
-- TABLE: item_location_batch
-- Exact stock per item + warehouse + location + batch
-- ============================================================================

CREATE TABLE IF NOT EXISTS item_location_batch (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  item_id UUID NOT NULL REFERENCES items(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  location_id UUID NOT NULL REFERENCES warehouse_locations(id),
  item_batch_id UUID NOT NULL REFERENCES item_batch(id),
  qty_on_hand DECIMAL(20, 4) NOT NULL DEFAULT 0,
  qty_reserved DECIMAL(20, 4) NOT NULL DEFAULT 0,
  qty_available DECIMAL(20, 4) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID NULL REFERENCES users(id),
  deleted_at TIMESTAMP NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (company_id, item_id, warehouse_id, location_id, item_batch_id),
  CHECK (qty_on_hand >= 0),
  CHECK (qty_reserved >= 0),
  CHECK (qty_reserved <= qty_on_hand)
);

CREATE INDEX IF NOT EXISTS idx_item_location_batch_company
  ON item_location_batch(company_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_location_batch_item_wh
  ON item_location_batch(company_id, item_id, warehouse_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_location_batch_loc
  ON item_location_batch(company_id, location_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_location_batch_batch
  ON item_location_batch(company_id, item_batch_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_location_batch_pick
  ON item_location_batch(company_id, item_id, warehouse_id, location_id, item_batch_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trigger_item_location_batch_updated_at ON item_location_batch;
CREATE TRIGGER trigger_item_location_batch_updated_at
  BEFORE UPDATE ON item_location_batch
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE item_location_batch IS
  'Exact stock balances per item, warehouse location, and batch.';

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE item_batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_location_batch ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS item_batch_select ON item_batch;
CREATE POLICY item_batch_select
  ON item_batch FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS item_batch_insert ON item_batch;
CREATE POLICY item_batch_insert
  ON item_batch FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS item_batch_update ON item_batch;
CREATE POLICY item_batch_update
  ON item_batch FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS item_location_batch_select ON item_location_batch;
CREATE POLICY item_location_batch_select
  ON item_location_batch FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS item_location_batch_insert ON item_location_batch;
CREATE POLICY item_location_batch_insert
  ON item_location_batch FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS item_location_batch_update ON item_location_batch;
CREATE POLICY item_location_batch_update
  ON item_location_batch FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- RECONCILIATION HELPERS
-- ============================================================================

CREATE OR REPLACE VIEW public.v_inventory_recon_item_warehouse_vs_location AS
SELECT
  iw.company_id,
  iw.item_id,
  iw.warehouse_id,
  COALESCE(iw.current_stock, 0)::DECIMAL(20, 4) AS warehouse_qty_on_hand,
  COALESCE(SUM(il.qty_on_hand), 0)::DECIMAL(20, 4) AS location_qty_on_hand_sum,
  (COALESCE(iw.current_stock, 0) - COALESCE(SUM(il.qty_on_hand), 0))::DECIMAL(20, 4) AS qty_diff
FROM item_warehouse iw
LEFT JOIN item_location il
  ON il.company_id = iw.company_id
 AND il.item_id = iw.item_id
 AND il.warehouse_id = iw.warehouse_id
 AND il.deleted_at IS NULL
WHERE iw.deleted_at IS NULL
GROUP BY iw.company_id, iw.item_id, iw.warehouse_id, iw.current_stock;

CREATE OR REPLACE VIEW public.v_inventory_recon_item_warehouse_vs_batch AS
SELECT
  iw.company_id,
  iw.item_id,
  iw.warehouse_id,
  COALESCE(iw.current_stock, 0)::DECIMAL(20, 4) AS warehouse_qty_on_hand,
  COALESCE(SUM(ib.qty_on_hand), 0)::DECIMAL(20, 4) AS batch_qty_on_hand_sum,
  (COALESCE(iw.current_stock, 0) - COALESCE(SUM(ib.qty_on_hand), 0))::DECIMAL(20, 4) AS qty_diff
FROM item_warehouse iw
LEFT JOIN item_batch ib
  ON ib.company_id = iw.company_id
 AND ib.item_id = iw.item_id
 AND ib.warehouse_id = iw.warehouse_id
 AND ib.deleted_at IS NULL
WHERE iw.deleted_at IS NULL
GROUP BY iw.company_id, iw.item_id, iw.warehouse_id, iw.current_stock;

CREATE OR REPLACE VIEW public.v_inventory_recon_item_location_vs_location_batch AS
SELECT
  il.company_id,
  il.item_id,
  il.warehouse_id,
  il.location_id,
  COALESCE(il.qty_on_hand, 0)::DECIMAL(20, 4) AS location_qty_on_hand,
  COALESCE(SUM(ilb.qty_on_hand), 0)::DECIMAL(20, 4) AS location_batch_qty_on_hand_sum,
  (COALESCE(il.qty_on_hand, 0) - COALESCE(SUM(ilb.qty_on_hand), 0))::DECIMAL(20, 4) AS qty_diff
FROM item_location il
LEFT JOIN item_location_batch ilb
  ON ilb.company_id = il.company_id
 AND ilb.item_id = il.item_id
 AND ilb.warehouse_id = il.warehouse_id
 AND ilb.location_id = il.location_id
 AND ilb.deleted_at IS NULL
WHERE il.deleted_at IS NULL
GROUP BY il.company_id, il.item_id, il.warehouse_id, il.location_id, il.qty_on_hand;

CREATE OR REPLACE VIEW public.v_inventory_recon_item_batch_vs_location_batch AS
SELECT
  ib.company_id,
  ib.id AS item_batch_id,
  ib.item_id,
  ib.warehouse_id,
  ib.batch_code,
  ib.received_at,
  COALESCE(ib.qty_on_hand, 0)::DECIMAL(20, 4) AS batch_qty_on_hand,
  COALESCE(SUM(ilb.qty_on_hand), 0)::DECIMAL(20, 4) AS location_batch_qty_on_hand_sum,
  (COALESCE(ib.qty_on_hand, 0) - COALESCE(SUM(ilb.qty_on_hand), 0))::DECIMAL(20, 4) AS qty_diff
FROM item_batch ib
LEFT JOIN item_location_batch ilb
  ON ilb.company_id = ib.company_id
 AND ilb.item_batch_id = ib.id
 AND ilb.deleted_at IS NULL
WHERE ib.deleted_at IS NULL
GROUP BY ib.company_id, ib.id, ib.item_id, ib.warehouse_id, ib.batch_code, ib.received_at, ib.qty_on_hand;

CREATE OR REPLACE FUNCTION public.get_inventory_batch_reconciliation_mismatches(
  p_company_id UUID DEFAULT NULL,
  p_tolerance NUMERIC DEFAULT 0
)
RETURNS TABLE (
  check_name TEXT,
  company_id UUID,
  item_id UUID,
  warehouse_id UUID,
  location_id UUID,
  item_batch_id UUID,
  batch_code TEXT,
  qty_diff NUMERIC
)
LANGUAGE sql
SECURITY INVOKER
AS $$
  SELECT
    'item_warehouse_vs_location'::TEXT AS check_name,
    r.company_id,
    r.item_id,
    r.warehouse_id,
    NULL::UUID AS location_id,
    NULL::UUID AS item_batch_id,
    NULL::TEXT AS batch_code,
    r.qty_diff::NUMERIC AS qty_diff
  FROM public.v_inventory_recon_item_warehouse_vs_location r
  WHERE (p_company_id IS NULL OR r.company_id = p_company_id)
    AND ABS(COALESCE(r.qty_diff, 0)) > COALESCE(p_tolerance, 0)

  UNION ALL

  SELECT
    'item_warehouse_vs_batch'::TEXT,
    r.company_id,
    r.item_id,
    r.warehouse_id,
    NULL::UUID,
    NULL::UUID,
    NULL::TEXT,
    r.qty_diff::NUMERIC
  FROM public.v_inventory_recon_item_warehouse_vs_batch r
  WHERE (p_company_id IS NULL OR r.company_id = p_company_id)
    AND ABS(COALESCE(r.qty_diff, 0)) > COALESCE(p_tolerance, 0)

  UNION ALL

  SELECT
    'item_location_vs_location_batch'::TEXT,
    r.company_id,
    r.item_id,
    r.warehouse_id,
    r.location_id,
    NULL::UUID,
    NULL::TEXT,
    r.qty_diff::NUMERIC
  FROM public.v_inventory_recon_item_location_vs_location_batch r
  WHERE (p_company_id IS NULL OR r.company_id = p_company_id)
    AND ABS(COALESCE(r.qty_diff, 0)) > COALESCE(p_tolerance, 0)

  UNION ALL

  SELECT
    'item_batch_vs_location_batch'::TEXT,
    r.company_id,
    r.item_id,
    r.warehouse_id,
    NULL::UUID,
    r.item_batch_id,
    r.batch_code::TEXT,
    r.qty_diff::NUMERIC
  FROM public.v_inventory_recon_item_batch_vs_location_batch r
  WHERE (p_company_id IS NULL OR r.company_id = p_company_id)
    AND ABS(COALESCE(r.qty_diff, 0)) > COALESCE(p_tolerance, 0);
$$;

COMMENT ON FUNCTION public.get_inventory_batch_reconciliation_mismatches(UUID, NUMERIC) IS
  'Returns inventory total mismatches across item_warehouse, item_location, item_batch, and item_location_batch.';

COMMIT;

