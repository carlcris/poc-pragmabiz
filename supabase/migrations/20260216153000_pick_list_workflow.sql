-- Migration: Pick List Workflow for Delivery Notes
-- Date: 2026-02-16

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_note_status')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'delivery_note_status'
         AND e.enumlabel = 'queued_for_picking'
     ) THEN
    ALTER TYPE delivery_note_status ADD VALUE 'queued_for_picking' AFTER 'confirmed';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pick_list_status') THEN
    CREATE TYPE pick_list_status AS ENUM (
      'pending',
      'in_progress',
      'paused',
      'cancelled',
      'done'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS pick_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  business_unit_id UUID REFERENCES business_units(id),
  dn_id UUID NOT NULL REFERENCES delivery_notes(id),
  pick_list_no VARCHAR(100) NOT NULL UNIQUE,
  status pick_list_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  cancel_reason TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pick_list_assignees (
  company_id UUID NOT NULL REFERENCES companies(id),
  pick_list_id UUID NOT NULL REFERENCES pick_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  assigned_by UUID REFERENCES users(id),
  PRIMARY KEY (pick_list_id, user_id)
);

CREATE TABLE IF NOT EXISTS pick_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  pick_list_id UUID NOT NULL REFERENCES pick_lists(id) ON DELETE CASCADE,
  dn_item_id UUID NOT NULL REFERENCES delivery_note_items(id),
  sr_id UUID NOT NULL REFERENCES stock_requests(id),
  sr_item_id UUID NOT NULL REFERENCES stock_request_items(id),
  item_id UUID NOT NULL REFERENCES items(id),
  uom_id UUID NOT NULL REFERENCES units_of_measure(id),
  allocated_qty DECIMAL(20, 4) NOT NULL DEFAULT 0,
  picked_qty DECIMAL(20, 4) NOT NULL DEFAULT 0,
  short_qty DECIMAL(20, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (pick_list_id, dn_item_id),
  CHECK (allocated_qty >= 0 AND picked_qty >= 0 AND short_qty >= 0),
  CHECK (picked_qty <= allocated_qty),
  CHECK (short_qty = (allocated_qty - picked_qty))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pick_lists_active_per_dn
  ON pick_lists(dn_id)
  WHERE status <> 'cancelled' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pick_lists_company_status ON pick_lists(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pick_lists_dn_id ON pick_lists(dn_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pick_list_assignees_user ON pick_list_assignees(company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_pick_list_items_pick_list ON pick_list_items(company_id, pick_list_id);

COMMENT ON TABLE pick_lists IS 'Pick list header generated from delivery notes.';
COMMENT ON TABLE pick_list_assignees IS 'Picker assignment for pick lists (many-to-many).';
COMMENT ON TABLE pick_list_items IS 'Pick list line items copied from delivery note items.';

ALTER TABLE pick_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_list_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE pick_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_select ON pick_lists;
CREATE POLICY company_select ON pick_lists
  FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_insert ON pick_lists;
CREATE POLICY company_insert ON pick_lists
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_update ON pick_lists;
CREATE POLICY company_update ON pick_lists
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_select ON pick_list_assignees;
CREATE POLICY company_select ON pick_list_assignees
  FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_insert ON pick_list_assignees;
CREATE POLICY company_insert ON pick_list_assignees
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_update ON pick_list_assignees;
CREATE POLICY company_update ON pick_list_assignees
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_select ON pick_list_items;
CREATE POLICY company_select ON pick_list_items
  FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_insert ON pick_list_items;
CREATE POLICY company_insert ON pick_list_items
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_update ON pick_list_items;
CREATE POLICY company_update ON pick_list_items
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS trigger_pick_lists_updated_at ON pick_lists;
CREATE TRIGGER trigger_pick_lists_updated_at
  BEFORE UPDATE ON pick_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_pick_list_items_updated_at ON pick_list_items;
CREATE TRIGGER trigger_pick_list_items_updated_at
  BEFORE UPDATE ON pick_list_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
