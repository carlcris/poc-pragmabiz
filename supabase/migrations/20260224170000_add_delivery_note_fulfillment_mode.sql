-- ============================================================================
-- Migration: Add Delivery Note Fulfillment Mode
-- Version: 20260224170000
-- Description: Persists fulfillment mode on delivery notes so direct customer
--              pickup can be guarded from normal DN receive posting.
-- Date: 2026-02-24
-- ============================================================================

BEGIN;

ALTER TABLE delivery_notes
  ADD COLUMN IF NOT EXISTS fulfillment_mode VARCHAR(50) NOT NULL DEFAULT 'transfer_to_store';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_notes_fulfillment_mode_check'
  ) THEN
    ALTER TABLE delivery_notes
      ADD CONSTRAINT delivery_notes_fulfillment_mode_check
      CHECK (
        fulfillment_mode IN ('transfer_to_store', 'customer_pickup_from_warehouse')
      );
  END IF;
END $$;

COMMENT ON COLUMN delivery_notes.fulfillment_mode IS
  'Fulfillment path: transfer_to_store (normal dispatch+receive inventory) or customer_pickup_from_warehouse (dispatch only inventory, workflow receive completion only).';

CREATE INDEX IF NOT EXISTS idx_delivery_notes_company_fulfillment_mode
  ON delivery_notes(company_id, fulfillment_mode)
  WHERE deleted_at IS NULL;

COMMIT;
