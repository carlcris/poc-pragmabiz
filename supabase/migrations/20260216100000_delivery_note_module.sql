-- ============================================================================
-- Migration: Delivery Note Module (SR Pick-Dispatch-Receive)
-- Version: 20260216100000
-- Description: Adds delivery note entities and constraints aligned to
--              stock-request-delivery-note-srs.md.
-- Author: System
-- Date: 2026-02-16
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_note_status') THEN
    CREATE TYPE delivery_note_status AS ENUM (
      'draft',
      'confirmed',
      'picking_in_progress',
      'dispatch_ready',
      'dispatched',
      'received',
      'voided'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  business_unit_id UUID REFERENCES business_units(id),
  dn_no VARCHAR(100) NOT NULL UNIQUE,
  status delivery_note_status NOT NULL DEFAULT 'draft',
  source_entity_id UUID NOT NULL REFERENCES warehouses(id),
  destination_entity_id UUID NOT NULL REFERENCES warehouses(id),
  confirmed_at TIMESTAMP NULL,
  picking_started_at TIMESTAMP NULL,
  picking_started_by UUID NULL REFERENCES users(id),
  picking_completed_at TIMESTAMP NULL,
  picking_completed_by UUID NULL REFERENCES users(id),
  dispatched_at TIMESTAMP NULL,
  received_at TIMESTAMP NULL,
  voided_at TIMESTAMP NULL,
  void_reason TEXT NULL,
  driver_name VARCHAR(150) NULL,
  driver_signature TEXT NULL,
  notes TEXT NULL,
  created_by UUID NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID NULL REFERENCES users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CHECK (source_entity_id <> destination_entity_id)
);

CREATE TABLE IF NOT EXISTS delivery_note_sources (
  company_id UUID NOT NULL REFERENCES companies(id),
  dn_id UUID NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  sr_id UUID NOT NULL REFERENCES stock_requests(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (dn_id, sr_id)
);

CREATE TABLE IF NOT EXISTS delivery_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  dn_id UUID NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  sr_id UUID NOT NULL REFERENCES stock_requests(id),
  sr_item_id UUID NOT NULL REFERENCES stock_request_items(id),
  item_id UUID NOT NULL REFERENCES items(id),
  uom_id UUID NOT NULL REFERENCES units_of_measure(id),
  allocated_qty DECIMAL(20, 4) NOT NULL DEFAULT 0,
  picked_qty DECIMAL(20, 4) NOT NULL DEFAULT 0,
  short_qty DECIMAL(20, 4) NOT NULL DEFAULT 0,
  dispatched_qty DECIMAL(20, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (dn_id, sr_item_id),
  CHECK (allocated_qty >= 0 AND picked_qty >= 0 AND short_qty >= 0 AND dispatched_qty >= 0),
  CHECK (picked_qty <= allocated_qty),
  CHECK (dispatched_qty <= picked_qty),
  CHECK (short_qty = (allocated_qty - picked_qty))
);

CREATE INDEX IF NOT EXISTS idx_dn_company ON delivery_notes(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dn_status ON delivery_notes(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dn_source_dest ON delivery_notes(source_entity_id, destination_entity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dns_company_sr ON delivery_note_sources(company_id, sr_id);
CREATE INDEX IF NOT EXISTS idx_dni_company_dn ON delivery_note_items(company_id, dn_id);
CREATE INDEX IF NOT EXISTS idx_dni_company_sr ON delivery_note_items(company_id, sr_id, sr_item_id);

COMMENT ON TABLE delivery_notes IS 'Delivery note header for pick-dispatch-receive operations.';
COMMENT ON TABLE delivery_note_sources IS 'Maps delivery notes to stock request headers.';
COMMENT ON TABLE delivery_note_items IS 'Allocation, pick, short, and dispatch line quantities for a DN.';

ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_note_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_note_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_select ON delivery_notes;
CREATE POLICY company_select ON delivery_notes
  FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_insert ON delivery_notes;
CREATE POLICY company_insert ON delivery_notes
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_update ON delivery_notes;
CREATE POLICY company_update ON delivery_notes
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_select ON delivery_note_sources;
CREATE POLICY company_select ON delivery_note_sources
  FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_insert ON delivery_note_sources;
CREATE POLICY company_insert ON delivery_note_sources
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_update ON delivery_note_sources;
CREATE POLICY company_update ON delivery_note_sources
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_select ON delivery_note_items;
CREATE POLICY company_select ON delivery_note_items
  FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_insert ON delivery_note_items;
CREATE POLICY company_insert ON delivery_note_items
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS company_update ON delivery_note_items;
CREATE POLICY company_update ON delivery_note_items
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

DROP TRIGGER IF EXISTS trigger_delivery_notes_updated_at ON delivery_notes;
CREATE TRIGGER trigger_delivery_notes_updated_at
  BEFORE UPDATE ON delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_delivery_note_items_updated_at ON delivery_note_items;
CREATE TRIGGER trigger_delivery_note_items_updated_at
  BEFORE UPDATE ON delivery_note_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
