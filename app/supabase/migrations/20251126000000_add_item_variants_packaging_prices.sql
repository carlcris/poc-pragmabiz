-- Migration: Add Item Variants, Packaging, and Multi-Pricing Support
-- Version: 20251126000000
-- Description: Phase 1 - Add new tables (item_variants, item_packaging, item_prices) and nullable columns to transaction tables
-- Author: System
-- Date: 2025-11-26
-- Reference: inv-enhancement-impl-plan.md Phase 1

-- ============================================================================
-- TABLE: item_variants
-- ============================================================================
-- Stores variant information for items (e.g., size: 8x12, color: red)
-- Each item can have multiple variants
-- Default variant created for all existing items during migration

CREATE TABLE item_variants (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    item_id           UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    variant_code      VARCHAR(100) NOT NULL,  -- e.g., "DEFAULT", "8x12", "SMALL"
    variant_name      VARCHAR(200) NOT NULL,  -- e.g., "Default", "8 x 12 inches", "Small"
    description       TEXT,
    attributes        JSONB DEFAULT '{}',     -- e.g., {"size": "8x12", "color": "red"}
    is_active         BOOLEAN DEFAULT true,
    is_default        BOOLEAN DEFAULT false,  -- True for auto-created default variants

    -- Audit fields
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,

    UNIQUE(company_id, item_id, variant_code)
);

CREATE INDEX idx_item_variants_company ON item_variants(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_variants_item ON item_variants(item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_variants_code ON item_variants(variant_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_variants_default ON item_variants(is_default) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_item_variants_updated_at
    BEFORE UPDATE ON item_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE item_variants IS 'Item variant definitions (size, color, etc.)';
COMMENT ON COLUMN item_variants.variant_code IS 'Unique code for variant within item (e.g., DEFAULT, 8x12)';
COMMENT ON COLUMN item_variants.attributes IS 'JSON storage for flexible variant attributes';
COMMENT ON COLUMN item_variants.is_default IS 'True for auto-generated default variants during migration';

-- ============================================================================
-- TABLE: item_packaging
-- ============================================================================
-- Stores packaging options for item variants (e.g., carton = 100 pcs, box = 12 pcs)
-- Each variant can have multiple packaging options
-- Default packaging (qty=1) created for all variants during migration

CREATE TABLE item_packaging (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    variant_id        UUID NOT NULL REFERENCES item_variants(id) ON DELETE CASCADE,
    pack_type         VARCHAR(100) NOT NULL,  -- e.g., "each", "piece", "carton", "box", "dozen"
    pack_name         VARCHAR(200) NOT NULL,  -- e.g., "Each", "Carton", "Box of 12"
    qty_per_pack      DECIMAL(15, 4) NOT NULL DEFAULT 1,  -- Conversion to base UOM (e.g., 100 pcs per carton)
    barcode           VARCHAR(100),           -- Barcode specific to this packaging
    is_default        BOOLEAN DEFAULT false,  -- True for auto-created default packaging
    is_active         BOOLEAN DEFAULT true,

    -- Audit fields
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,

    UNIQUE(company_id, variant_id, pack_type),
    CHECK (qty_per_pack > 0)
);

CREATE INDEX idx_item_packaging_company ON item_packaging(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_packaging_variant ON item_packaging(variant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_packaging_barcode ON item_packaging(barcode) WHERE deleted_at IS NULL AND barcode IS NOT NULL;
CREATE INDEX idx_item_packaging_default ON item_packaging(is_default) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_item_packaging_updated_at
    BEFORE UPDATE ON item_packaging
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE item_packaging IS 'Packaging options for item variants with conversion factors';
COMMENT ON COLUMN item_packaging.pack_type IS 'Type of packaging (each, carton, box, dozen, etc.)';
COMMENT ON COLUMN item_packaging.qty_per_pack IS 'Quantity in base UOM per package (e.g., 100 pcs per carton)';
COMMENT ON COLUMN item_packaging.barcode IS 'Barcode specific to this packaging option';

-- ============================================================================
-- TABLE: item_prices
-- ============================================================================
-- Stores multiple price tiers for item variants
-- Price tiers: fc (Factory Cost), ws (Wholesale), srp (Suggested Retail Price)
-- Can be extended for additional tiers (government, reseller, VIP, etc.)

CREATE TABLE item_prices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    variant_id        UUID NOT NULL REFERENCES item_variants(id) ON DELETE CASCADE,
    price_tier        VARCHAR(50) NOT NULL,   -- e.g., "fc", "ws", "srp", "government", "reseller"
    price_tier_name   VARCHAR(100) NOT NULL,  -- e.g., "Factory Cost", "Wholesale", "SRP"
    price             DECIMAL(20, 4) NOT NULL,
    currency_code     VARCHAR(3) DEFAULT 'PHP',
    effective_from    DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to      DATE,                   -- NULL = no expiry
    is_active         BOOLEAN DEFAULT true,

    -- Audit fields
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,

    UNIQUE(company_id, variant_id, price_tier, effective_from),
    CHECK (price >= 0),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_item_prices_company ON item_prices(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_prices_variant ON item_prices(variant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_prices_tier ON item_prices(price_tier) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_prices_active ON item_prices(is_active, effective_from, effective_to) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_item_prices_updated_at
    BEFORE UPDATE ON item_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE item_prices IS 'Multi-tier pricing for item variants with date effectivity';
COMMENT ON COLUMN item_prices.price_tier IS 'Price tier code: fc (Factory Cost), ws (Wholesale), srp (SRP), etc.';
COMMENT ON COLUMN item_prices.effective_from IS 'Start date when this price becomes effective';
COMMENT ON COLUMN item_prices.effective_to IS 'End date when this price expires (NULL = no expiry)';

-- ============================================================================
-- PHASE 1.2: Add nullable columns to transaction tables
-- ============================================================================
-- These columns are NULLABLE to maintain backward compatibility
-- Old transactions work without these fields
-- New transactions can optionally specify variant and packaging

-- Stock transaction items
ALTER TABLE stock_transaction_items
ADD COLUMN variant_id UUID NULL REFERENCES item_variants(id),
ADD COLUMN packaging_id UUID NULL REFERENCES item_packaging(id);

CREATE INDEX idx_stock_transaction_items_variant ON stock_transaction_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_stock_transaction_items_packaging ON stock_transaction_items(packaging_id) WHERE packaging_id IS NOT NULL;

COMMENT ON COLUMN stock_transaction_items.variant_id IS 'Optional: Specific variant for this transaction (NULL = use default variant)';
COMMENT ON COLUMN stock_transaction_items.packaging_id IS 'Optional: Packaging used in transaction (NULL = use default packaging)';

-- Purchase order items
ALTER TABLE purchase_order_items
ADD COLUMN variant_id UUID NULL REFERENCES item_variants(id),
ADD COLUMN packaging_id UUID NULL REFERENCES item_packaging(id);

CREATE INDEX idx_purchase_order_items_variant ON purchase_order_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_purchase_order_items_packaging ON purchase_order_items(packaging_id) WHERE packaging_id IS NOT NULL;

COMMENT ON COLUMN purchase_order_items.variant_id IS 'Optional: Specific variant ordered';
COMMENT ON COLUMN purchase_order_items.packaging_id IS 'Optional: Packaging for this purchase';

-- Purchase receipt items
ALTER TABLE purchase_receipt_items
ADD COLUMN variant_id UUID NULL REFERENCES item_variants(id),
ADD COLUMN packaging_id UUID NULL REFERENCES item_packaging(id);

CREATE INDEX idx_purchase_receipt_items_variant ON purchase_receipt_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_purchase_receipt_items_packaging ON purchase_receipt_items(packaging_id) WHERE packaging_id IS NOT NULL;

COMMENT ON COLUMN purchase_receipt_items.variant_id IS 'Optional: Specific variant received';
COMMENT ON COLUMN purchase_receipt_items.packaging_id IS 'Optional: Packaging used in receipt';

-- Sales order items
ALTER TABLE sales_order_items
ADD COLUMN variant_id UUID NULL REFERENCES item_variants(id),
ADD COLUMN packaging_id UUID NULL REFERENCES item_packaging(id);

CREATE INDEX idx_sales_order_items_variant ON sales_order_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_sales_order_items_packaging ON sales_order_items(packaging_id) WHERE packaging_id IS NOT NULL;

COMMENT ON COLUMN sales_order_items.variant_id IS 'Optional: Specific variant ordered';
COMMENT ON COLUMN sales_order_items.packaging_id IS 'Optional: Packaging for this sale';

-- Sales invoice items
ALTER TABLE sales_invoice_items
ADD COLUMN variant_id UUID NULL REFERENCES item_variants(id),
ADD COLUMN packaging_id UUID NULL REFERENCES item_packaging(id);

CREATE INDEX idx_sales_invoice_items_variant ON sales_invoice_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_sales_invoice_items_packaging ON sales_invoice_items(packaging_id) WHERE packaging_id IS NOT NULL;

COMMENT ON COLUMN sales_invoice_items.variant_id IS 'Optional: Specific variant invoiced';
COMMENT ON COLUMN sales_invoice_items.packaging_id IS 'Optional: Packaging used in invoice';

-- POS transaction items
ALTER TABLE pos_transaction_items
ADD COLUMN variant_id UUID NULL REFERENCES item_variants(id),
ADD COLUMN packaging_id UUID NULL REFERENCES item_packaging(id);

CREATE INDEX idx_pos_transaction_items_variant ON pos_transaction_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_pos_transaction_items_packaging ON pos_transaction_items(packaging_id) WHERE packaging_id IS NOT NULL;

COMMENT ON COLUMN pos_transaction_items.variant_id IS 'Optional: Specific variant sold in POS';
COMMENT ON COLUMN pos_transaction_items.packaging_id IS 'Optional: Packaging used in POS';

-- Stock transfer items
ALTER TABLE stock_transfer_items
ADD COLUMN variant_id UUID NULL REFERENCES item_variants(id),
ADD COLUMN packaging_id UUID NULL REFERENCES item_packaging(id);

CREATE INDEX idx_stock_transfer_items_variant ON stock_transfer_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_stock_transfer_items_packaging ON stock_transfer_items(packaging_id) WHERE packaging_id IS NOT NULL;

COMMENT ON COLUMN stock_transfer_items.variant_id IS 'Optional: Specific variant transferred';
COMMENT ON COLUMN stock_transfer_items.packaging_id IS 'Optional: Packaging used in transfer';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Phase 1 Complete:
-- ✓ Created item_variants table
-- ✓ Created item_packaging table
-- ✓ Created item_prices table
-- ✓ Added variant_id and packaging_id to all transaction tables (nullable)
--
-- Next Phase: Create default variants, packaging, and migrate prices for existing items
-- ============================================================================
