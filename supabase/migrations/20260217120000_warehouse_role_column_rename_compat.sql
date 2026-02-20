-- Migration: Introduce canonical warehouse role columns for SR and DN
-- Date: 2026-02-17
-- Notes:
-- 1) Adds requesting_warehouse_id / fulfilling_warehouse_id columns
-- 2) Backfills from existing columns
-- 3) Keeps backward compatibility by syncing legacy columns via triggers

BEGIN;

-- ============================================================================
-- STOCK REQUESTS
-- ============================================================================

ALTER TABLE stock_requests
  ADD COLUMN IF NOT EXISTS requesting_warehouse_id UUID,
  ADD COLUMN IF NOT EXISTS fulfilling_warehouse_id UUID;

UPDATE stock_requests
SET
  requesting_warehouse_id = COALESCE(requesting_warehouse_id, source_warehouse_id),
  fulfilling_warehouse_id = COALESCE(fulfilling_warehouse_id, destination_warehouse_id)
WHERE requesting_warehouse_id IS NULL
   OR fulfilling_warehouse_id IS NULL;

ALTER TABLE stock_requests
  ALTER COLUMN requesting_warehouse_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_requests_requesting_warehouse_id_fkey'
  ) THEN
    ALTER TABLE stock_requests
      ADD CONSTRAINT stock_requests_requesting_warehouse_id_fkey
      FOREIGN KEY (requesting_warehouse_id) REFERENCES warehouses(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stock_requests_fulfilling_warehouse_id_fkey'
  ) THEN
    ALTER TABLE stock_requests
      ADD CONSTRAINT stock_requests_fulfilling_warehouse_id_fkey
      FOREIGN KEY (fulfilling_warehouse_id) REFERENCES warehouses(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_stock_requests_requesting_fulfilling_not_same'
  ) THEN
    ALTER TABLE stock_requests
      ADD CONSTRAINT chk_stock_requests_requesting_fulfilling_not_same
      CHECK (
        fulfilling_warehouse_id IS NULL
        OR requesting_warehouse_id <> fulfilling_warehouse_id
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_requests_requesting_warehouse
  ON stock_requests(requesting_warehouse_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_requests_fulfilling_warehouse
  ON stock_requests(fulfilling_warehouse_id)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN stock_requests.requesting_warehouse_id IS
  'Warehouse that requested stock (canonical replacement for source_warehouse_id).';
COMMENT ON COLUMN stock_requests.fulfilling_warehouse_id IS
  'Warehouse fulfilling the request (canonical replacement for destination_warehouse_id).';

CREATE OR REPLACE FUNCTION sync_stock_requests_warehouse_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.requesting_warehouse_id := COALESCE(NEW.requesting_warehouse_id, NEW.source_warehouse_id);
  NEW.fulfilling_warehouse_id := COALESCE(NEW.fulfilling_warehouse_id, NEW.destination_warehouse_id);

  NEW.source_warehouse_id := NEW.requesting_warehouse_id;
  NEW.destination_warehouse_id := NEW.fulfilling_warehouse_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_stock_requests_warehouse_columns ON stock_requests;
CREATE TRIGGER trg_sync_stock_requests_warehouse_columns
BEFORE INSERT OR UPDATE ON stock_requests
FOR EACH ROW
EXECUTE FUNCTION sync_stock_requests_warehouse_columns();

-- ============================================================================
-- DELIVERY NOTES
-- ============================================================================

ALTER TABLE delivery_notes
  ADD COLUMN IF NOT EXISTS requesting_warehouse_id UUID,
  ADD COLUMN IF NOT EXISTS fulfilling_warehouse_id UUID;

UPDATE delivery_notes
SET
  requesting_warehouse_id = COALESCE(requesting_warehouse_id, source_entity_id),
  fulfilling_warehouse_id = COALESCE(fulfilling_warehouse_id, destination_entity_id)
WHERE requesting_warehouse_id IS NULL
   OR fulfilling_warehouse_id IS NULL;

ALTER TABLE delivery_notes
  ALTER COLUMN requesting_warehouse_id SET NOT NULL,
  ALTER COLUMN fulfilling_warehouse_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_notes_requesting_warehouse_id_fkey'
  ) THEN
    ALTER TABLE delivery_notes
      ADD CONSTRAINT delivery_notes_requesting_warehouse_id_fkey
      FOREIGN KEY (requesting_warehouse_id) REFERENCES warehouses(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_notes_fulfilling_warehouse_id_fkey'
  ) THEN
    ALTER TABLE delivery_notes
      ADD CONSTRAINT delivery_notes_fulfilling_warehouse_id_fkey
      FOREIGN KEY (fulfilling_warehouse_id) REFERENCES warehouses(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_delivery_notes_requesting_fulfilling_not_same'
  ) THEN
    ALTER TABLE delivery_notes
      ADD CONSTRAINT chk_delivery_notes_requesting_fulfilling_not_same
      CHECK (requesting_warehouse_id <> fulfilling_warehouse_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dn_requesting_fulfilling
  ON delivery_notes(requesting_warehouse_id, fulfilling_warehouse_id)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN delivery_notes.requesting_warehouse_id IS
  'Warehouse requesting stock movement (canonical replacement for source_entity_id).';
COMMENT ON COLUMN delivery_notes.fulfilling_warehouse_id IS
  'Warehouse fulfilling stock movement (canonical replacement for destination_entity_id).';

CREATE OR REPLACE FUNCTION sync_delivery_notes_warehouse_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.requesting_warehouse_id := COALESCE(NEW.requesting_warehouse_id, NEW.source_entity_id);
  NEW.fulfilling_warehouse_id := COALESCE(NEW.fulfilling_warehouse_id, NEW.destination_entity_id);

  NEW.source_entity_id := NEW.requesting_warehouse_id;
  NEW.destination_entity_id := NEW.fulfilling_warehouse_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_delivery_notes_warehouse_columns ON delivery_notes;
CREATE TRIGGER trg_sync_delivery_notes_warehouse_columns
BEFORE INSERT OR UPDATE ON delivery_notes
FOR EACH ROW
EXECUTE FUNCTION sync_delivery_notes_warehouse_columns();

-- ============================================================================
-- DELIVERY NOTE ITEMS
-- ============================================================================

ALTER TABLE delivery_note_items
  ADD COLUMN IF NOT EXISTS requesting_warehouse_id UUID,
  ADD COLUMN IF NOT EXISTS fulfilling_warehouse_id UUID;

UPDATE delivery_note_items
SET
  requesting_warehouse_id = COALESCE(requesting_warehouse_id, source_entity_id),
  fulfilling_warehouse_id = COALESCE(fulfilling_warehouse_id, destination_entity_id)
WHERE requesting_warehouse_id IS NULL
   OR fulfilling_warehouse_id IS NULL;

ALTER TABLE delivery_note_items
  ALTER COLUMN requesting_warehouse_id SET NOT NULL,
  ALTER COLUMN fulfilling_warehouse_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_note_items_requesting_warehouse_id_fkey'
  ) THEN
    ALTER TABLE delivery_note_items
      ADD CONSTRAINT delivery_note_items_requesting_warehouse_id_fkey
      FOREIGN KEY (requesting_warehouse_id) REFERENCES warehouses(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'delivery_note_items_fulfilling_warehouse_id_fkey'
  ) THEN
    ALTER TABLE delivery_note_items
      ADD CONSTRAINT delivery_note_items_fulfilling_warehouse_id_fkey
      FOREIGN KEY (fulfilling_warehouse_id) REFERENCES warehouses(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_delivery_note_items_requesting_fulfilling_not_same'
  ) THEN
    ALTER TABLE delivery_note_items
      ADD CONSTRAINT chk_delivery_note_items_requesting_fulfilling_not_same
      CHECK (requesting_warehouse_id <> fulfilling_warehouse_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_delivery_note_items_requesting_fulfilling
  ON delivery_note_items(company_id, requesting_warehouse_id, fulfilling_warehouse_id);

COMMENT ON COLUMN delivery_note_items.requesting_warehouse_id IS
  'Warehouse requesting the line movement (canonical replacement for source_entity_id).';
COMMENT ON COLUMN delivery_note_items.fulfilling_warehouse_id IS
  'Warehouse fulfilling the line movement (canonical replacement for destination_entity_id).';

CREATE OR REPLACE FUNCTION sync_delivery_note_items_warehouse_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.requesting_warehouse_id := COALESCE(NEW.requesting_warehouse_id, NEW.source_entity_id);
  NEW.fulfilling_warehouse_id := COALESCE(NEW.fulfilling_warehouse_id, NEW.destination_entity_id);

  NEW.source_entity_id := NEW.requesting_warehouse_id;
  NEW.destination_entity_id := NEW.fulfilling_warehouse_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_delivery_note_items_warehouse_columns ON delivery_note_items;
CREATE TRIGGER trg_sync_delivery_note_items_warehouse_columns
BEFORE INSERT OR UPDATE ON delivery_note_items
FOR EACH ROW
EXECUTE FUNCTION sync_delivery_note_items_warehouse_columns();

COMMIT;
