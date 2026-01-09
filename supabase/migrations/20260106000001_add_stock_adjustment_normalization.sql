-- ============================================================================
-- Migration: Add package normalization to stock_adjustment_items
-- Description: Adds normalization metadata columns for package-based adjustments
-- ============================================================================

-- ============================================================================
-- TABLE: stock_adjustment_items - Add conversion metadata
-- ============================================================================
ALTER TABLE stock_adjustment_items
ADD COLUMN IF NOT EXISTS input_qty DECIMAL(15, 4),
ADD COLUMN IF NOT EXISTS input_packaging_id UUID REFERENCES item_packaging(id),
ADD COLUMN IF NOT EXISTS normalized_qty DECIMAL(15, 4),
ADD COLUMN IF NOT EXISTS conversion_factor DECIMAL(15, 4) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS base_package_id UUID REFERENCES item_packaging(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_stock_adj_items_input_packaging
ON stock_adjustment_items(input_packaging_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_adj_items_base_package
ON stock_adjustment_items(base_package_id) WHERE deleted_at IS NULL;

-- Backfill existing records (assume already in base units)
UPDATE stock_adjustment_items
SET
  input_qty = adjusted_qty,
  normalized_qty = adjusted_qty,
  conversion_factor = 1.0,
  input_packaging_id = NULL,
  base_package_id = NULL
WHERE input_qty IS NULL;

-- Make required columns NOT NULL
ALTER TABLE stock_adjustment_items
ALTER COLUMN input_qty SET NOT NULL,
ALTER COLUMN normalized_qty SET NOT NULL,
ALTER COLUMN conversion_factor SET NOT NULL;

-- Add check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_adj_items_conversion_check'
  ) THEN
    ALTER TABLE stock_adjustment_items
    ADD CONSTRAINT stock_adj_items_conversion_check
    CHECK (
      normalized_qty IS NULL OR
      input_qty IS NULL OR
      conversion_factor IS NULL OR
      ABS(normalized_qty - (input_qty * conversion_factor)) < 0.01
    );
  END IF;
END
$$;

-- Add comments
COMMENT ON COLUMN stock_adjustment_items.adjusted_qty IS
  'DEPRECATED: Use normalized_qty instead. Kept for backward compatibility.';

COMMENT ON COLUMN stock_adjustment_items.normalized_qty IS
  'Adjusted quantity in base package units. This is the source of truth for inventory calculations.';

COMMENT ON COLUMN stock_adjustment_items.input_qty IS
  'Original adjusted quantity entered by user in selected package.';

COMMENT ON COLUMN stock_adjustment_items.input_packaging_id IS
  'Package selected by user for input. References item_packaging.id.';

COMMENT ON COLUMN stock_adjustment_items.conversion_factor IS
  'Conversion factor from input package to base package (qty_per_pack).';

COMMENT ON COLUMN stock_adjustment_items.base_package_id IS
  'Base package used for normalization. References items.package_id at time of adjustment.';

-- ============================================================================
-- TABLE: warehouse_locations
-- ============================================================================

CREATE TABLE IF NOT EXISTS warehouse_locations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    warehouse_id      UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    code              VARCHAR(100) NOT NULL,
    name              VARCHAR(200),
    parent_id         UUID REFERENCES warehouse_locations(id),
    location_type     VARCHAR(50) NOT NULL DEFAULT 'bin', -- zone, aisle, rack, shelf, bin, crate
    is_pickable       BOOLEAN DEFAULT true,
    is_storable       BOOLEAN DEFAULT true,
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    UNIQUE(company_id, warehouse_id, code)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_company
ON warehouse_locations(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_warehouse
ON warehouse_locations(warehouse_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_code
ON warehouse_locations(code) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_warehouse_locations_parent
ON warehouse_locations(parent_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_warehouse_locations_updated_at
    BEFORE UPDATE ON warehouse_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE warehouse_locations IS 'Location hierarchy inside a warehouse (zones, aisles, bins, crates)';
COMMENT ON COLUMN warehouse_locations.code IS 'Unique code per warehouse (e.g. A1-BIN-01)';
COMMENT ON COLUMN warehouse_locations.location_type IS 'zone, aisle, rack, shelf, bin, crate';
COMMENT ON COLUMN warehouse_locations.is_pickable IS 'Can be used as a pick location';
COMMENT ON COLUMN warehouse_locations.is_storable IS 'Can store inventory';

-- ============================================================================
-- TABLE: item_location
-- ============================================================================

CREATE TABLE IF NOT EXISTS item_location (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    item_id           UUID NOT NULL REFERENCES items(id),
    warehouse_id      UUID NOT NULL REFERENCES warehouses(id),
    location_id       UUID NOT NULL REFERENCES warehouse_locations(id),
    qty_on_hand       DECIMAL(20, 4) NOT NULL DEFAULT 0,
    qty_reserved      DECIMAL(20, 4) NOT NULL DEFAULT 0,
    qty_available     DECIMAL(20, 4) GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    UNIQUE(company_id, item_id, warehouse_id, location_id),
    CHECK (qty_on_hand >= 0),
    CHECK (qty_reserved >= 0),
    CHECK (qty_reserved <= qty_on_hand)
);

CREATE INDEX IF NOT EXISTS idx_item_location_company
ON item_location(company_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_location_item
ON item_location(item_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_location_warehouse
ON item_location(warehouse_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_location_location
ON item_location(location_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_item_location_updated_at
    BEFORE UPDATE ON item_location
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE item_location IS 'Item quantities per warehouse location';
COMMENT ON COLUMN item_location.qty_on_hand IS 'On-hand quantity at this location';
COMMENT ON COLUMN item_location.qty_reserved IS 'Reserved quantity at this location';
COMMENT ON COLUMN item_location.qty_available IS 'Available quantity at this location (computed)';

-- ============================================================================
-- TABLE: item_warehouse - add default_location_id
-- ============================================================================

ALTER TABLE item_warehouse
ADD COLUMN IF NOT EXISTS default_location_id UUID REFERENCES warehouse_locations(id);

CREATE INDEX IF NOT EXISTS idx_item_warehouse_default_location
ON item_warehouse(default_location_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN item_warehouse.default_location_id IS
  'Default pick/put-away location for this item in the warehouse.';

-- ============================================================================
-- TABLE: stock_transactions - add location columns
-- ============================================================================

ALTER TABLE stock_transactions
ADD COLUMN IF NOT EXISTS from_location_id UUID REFERENCES warehouse_locations(id),
ADD COLUMN IF NOT EXISTS to_location_id UUID REFERENCES warehouse_locations(id);

CREATE INDEX IF NOT EXISTS idx_stock_trans_from_location
ON stock_transactions(from_location_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_trans_to_location
ON stock_transactions(to_location_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN stock_transactions.from_location_id IS
  'Source location for stock out/transfer transactions.';

COMMENT ON COLUMN stock_transactions.to_location_id IS
  'Destination location for stock in/transfer transactions.';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE warehouse_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_location ENABLE ROW LEVEL SECURITY;

CREATE POLICY warehouse_locations_select
    ON warehouse_locations FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY warehouse_locations_insert
    ON warehouse_locations FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY warehouse_locations_update
    ON warehouse_locations FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY item_location_select
    ON item_location FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY item_location_insert
    ON item_location FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY item_location_update
    ON item_location FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- SEED: default MAIN location per warehouse
-- ============================================================================

INSERT INTO warehouse_locations (
  company_id,
  warehouse_id,
  code,
  name,
  location_type,
  is_pickable,
  is_storable,
  is_active,
  created_at,
  updated_at
)
SELECT
  w.company_id,
  w.id,
  'MAIN',
  'Main',
  'bin',
  true,
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM warehouses w
ON CONFLICT (company_id, warehouse_id, code) DO NOTHING;

-- Backfill default location on item_warehouse
UPDATE item_warehouse iw
SET default_location_id = wl.id
FROM warehouse_locations wl
WHERE wl.warehouse_id = iw.warehouse_id
  AND wl.code = 'MAIN'
  AND iw.default_location_id IS NULL;

-- Backfill item_location from item_warehouse totals
INSERT INTO item_location (
  company_id,
  item_id,
  warehouse_id,
  location_id,
  qty_on_hand,
  qty_reserved,
  created_at,
  updated_at
)
SELECT
  iw.company_id,
  iw.item_id,
  iw.warehouse_id,
  wl.id,
  iw.current_stock,
  iw.reserved_stock,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM item_warehouse iw
JOIN warehouse_locations wl
  ON wl.warehouse_id = iw.warehouse_id
 AND wl.code = 'MAIN'
ON CONFLICT (company_id, item_id, warehouse_id, location_id)
DO UPDATE SET
  qty_on_hand = EXCLUDED.qty_on_hand,
  qty_reserved = EXCLUDED.qty_reserved,
  updated_at = CURRENT_TIMESTAMP;
