-- ============================================================================
-- Migration: Add Delivery Note Post-Dispatch Adjustment Foundations
-- Version: 20260308170000
-- Description: Adds audit and reversal foundation schema for post-dispatch
--              delivery note quantity reductions and voids.
-- Date: 2026-03-08
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS delivery_note_item_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  dn_id UUID NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  delivery_note_item_id UUID NOT NULL REFERENCES delivery_note_items(id) ON DELETE CASCADE,
  adjustment_type VARCHAR(50) NOT NULL,
  qty_delta DECIMAL(20, 4) NOT NULL,
  prior_dispatched_qty DECIMAL(20, 4) NOT NULL,
  new_dispatched_qty DECIMAL(20, 4) NOT NULL,
  reason TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NULL REFERENCES users(id),
  CHECK (adjustment_type IN ('reduce_qty', 'void_qty')),
  CHECK (qty_delta >= 0),
  CHECK (prior_dispatched_qty >= 0),
  CHECK (new_dispatched_qty >= 0),
  CHECK (new_dispatched_qty <= prior_dispatched_qty),
  CHECK (qty_delta = (prior_dispatched_qty - new_dispatched_qty))
);

CREATE INDEX IF NOT EXISTS idx_dnia_company_dn
  ON delivery_note_item_adjustments(company_id, dn_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dnia_company_dn_item
  ON delivery_note_item_adjustments(company_id, delivery_note_item_id, created_at DESC);

COMMENT ON TABLE delivery_note_item_adjustments IS
  'Immutable audit log for post-dispatch delivery note line reductions and voids.';
COMMENT ON COLUMN delivery_note_item_adjustments.adjustment_type IS
  'Supported values: reduce_qty, void_qty.';
COMMENT ON COLUMN delivery_note_item_adjustments.qty_delta IS
  'Quantity reversed from a previously dispatched delivery note line.';

ALTER TABLE delivery_note_item_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_select ON delivery_note_item_adjustments;
CREATE POLICY company_select ON delivery_note_item_adjustments
  FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_insert ON delivery_note_item_adjustments;
CREATE POLICY company_insert ON delivery_note_item_adjustments
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

ALTER TABLE delivery_note_items
  ADD COLUMN IF NOT EXISTS is_voided BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS voided_by UUID NULL REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS void_reason TEXT NULL;

COMMENT ON COLUMN delivery_note_items.is_voided IS
  'True when the delivery note line has been fully voided after or before dispatch.';
COMMENT ON COLUMN delivery_note_items.voided_at IS
  'Timestamp when the delivery note line was fully voided.';
COMMENT ON COLUMN delivery_note_items.voided_by IS
  'User who fully voided the delivery note line.';
COMMENT ON COLUMN delivery_note_items.void_reason IS
  'Reason provided for fully voiding the delivery note line.';

CREATE INDEX IF NOT EXISTS idx_dni_company_dn_void_state
  ON delivery_note_items(company_id, dn_id, is_voided);

ALTER TABLE delivery_note_item_picks
  ADD COLUMN IF NOT EXISTS reversed_qty DECIMAL(20, 4) NOT NULL DEFAULT 0;

ALTER TABLE delivery_note_item_picks
  DROP CONSTRAINT IF EXISTS delivery_note_item_picks_reversed_qty_check;

ALTER TABLE delivery_note_item_picks
  ADD CONSTRAINT delivery_note_item_picks_reversed_qty_check
  CHECK (
    reversed_qty >= 0
    AND reversed_qty <= dispatched_qty
  );

COMMENT ON COLUMN delivery_note_item_picks.reversed_qty IS
  'Quantity already reversed back into inventory from this dispatched pick row.';

COMMIT;
