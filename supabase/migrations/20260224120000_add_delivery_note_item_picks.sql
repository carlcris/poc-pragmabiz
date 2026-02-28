-- ============================================================================
-- Migration: Add Delivery Note Item Pick Execution Rows
-- Version: 20260224120000
-- Description: Adds actual pick execution rows (delivery_note_item_picks) and
--              DN line suggested/override pick source fields.
-- Date: 2026-02-24
-- ============================================================================

BEGIN;

-- Advisory pick source fields on DN line (non-binding suggestion + retained override).
ALTER TABLE delivery_note_items
  ADD COLUMN IF NOT EXISTS suggested_pick_location_id UUID REFERENCES warehouse_locations(id),
  ADD COLUMN IF NOT EXISTS suggested_pick_batch_code VARCHAR(150),
  ADD COLUMN IF NOT EXISTS suggested_pick_batch_received_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS has_pick_source_override BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_pick_source_override_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_pick_source_override_by UUID REFERENCES users(id);

COMMENT ON COLUMN delivery_note_items.suggested_pick_location_id IS
  'Advisory suggested pick location (shelf/rack/bin) for the DN line. Non-binding.';
COMMENT ON COLUMN delivery_note_items.suggested_pick_batch_code IS
  'Advisory suggested batch code for the DN line. Non-binding.';
COMMENT ON COLUMN delivery_note_items.suggested_pick_batch_received_at IS
  'Advisory suggested batch receipt timestamp for FIFO guidance. Non-binding.';
COMMENT ON COLUMN delivery_note_items.has_pick_source_override IS
  'True when picker confirms actual pick source different from suggested source.';

-- Actual pick execution rows (source of truth for dispatch depletion by location+batch).
CREATE TABLE IF NOT EXISTS delivery_note_item_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  dn_id UUID NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  delivery_note_item_id UUID NOT NULL REFERENCES delivery_note_items(id) ON DELETE CASCADE,
  pick_list_id UUID NOT NULL REFERENCES pick_lists(id) ON DELETE RESTRICT,
  item_id UUID NOT NULL REFERENCES items(id),
  source_warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  picked_location_id UUID NOT NULL REFERENCES warehouse_locations(id),
  picked_batch_code VARCHAR(150) NOT NULL,
  picked_batch_received_at TIMESTAMP NOT NULL,
  picked_qty DECIMAL(20, 4) NOT NULL DEFAULT 0,
  dispatched_qty DECIMAL(20, 4) NOT NULL DEFAULT 0,
  picker_user_id UUID REFERENCES users(id),
  picked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_mismatch_warning_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  mismatch_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id),
  deleted_at TIMESTAMP NULL,
  version INTEGER NOT NULL DEFAULT 1,
  CHECK (BTRIM(picked_batch_code) <> ''),
  CHECK (picked_qty >= 0),
  CHECK (dispatched_qty >= 0),
  CHECK (dispatched_qty <= picked_qty)
);

-- Merge key rule:
-- merge when same DN line + same location + same batch identity + same preserved receipt date;
-- otherwise append a new row.
CREATE UNIQUE INDEX IF NOT EXISTS ux_dn_item_picks_merge_key
  ON delivery_note_item_picks(
    delivery_note_item_id,
    pick_list_id,
    picked_location_id,
    picked_batch_code,
    picked_batch_received_at
  )
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dn_item_picks_company_dn
  ON delivery_note_item_picks(company_id, dn_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dn_item_picks_dn_item
  ON delivery_note_item_picks(company_id, delivery_note_item_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dn_item_picks_pick_list
  ON delivery_note_item_picks(company_id, pick_list_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dn_item_picks_item_source_wh
  ON delivery_note_item_picks(company_id, item_id, source_warehouse_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dn_item_picks_batch_lookup
  ON delivery_note_item_picks(company_id, picked_batch_code, picked_batch_received_at)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trigger_delivery_note_item_picks_updated_at ON delivery_note_item_picks;
CREATE TRIGGER trigger_delivery_note_item_picks_updated_at
  BEFORE UPDATE ON delivery_note_item_picks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE delivery_note_item_picks IS
  'Actual picked source rows per delivery note line (location + batch), used for dispatch depletion and transfer receipt batch preservation.';
COMMENT ON COLUMN delivery_note_item_picks.is_mismatch_warning_acknowledged IS
  'True when picker continues after mismatch warning against suggested pick source.';

ALTER TABLE delivery_note_item_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_select ON delivery_note_item_picks;
CREATE POLICY company_select ON delivery_note_item_picks
  FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_insert ON delivery_note_item_picks;
CREATE POLICY company_insert ON delivery_note_item_picks
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_update ON delivery_note_item_picks;
CREATE POLICY company_update ON delivery_note_item_picks
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_delete ON delivery_note_item_picks;
CREATE POLICY company_delete ON delivery_note_item_picks
  FOR DELETE TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

COMMIT;

