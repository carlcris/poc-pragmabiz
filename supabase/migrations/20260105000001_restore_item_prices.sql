-- Migration: Restore Item Prices Table (Without Variants)
-- Version: 20260105000001
-- Description: Re-create item_prices table to work directly with items (not variants)
-- Author: System
-- Date: 2026-01-05

-- ============================================================================
-- TABLE: item_prices
-- ============================================================================
-- Stores multiple price tiers for items (directly, without variant dependency)
-- Price tiers: fc (Factory Cost), ws (Wholesale), srp (Suggested Retail Price)
-- Can be extended for additional tiers (government, reseller, VIP, etc.)

CREATE TABLE item_prices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    item_id           UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,  -- Direct link to items
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

    UNIQUE(company_id, item_id, price_tier, effective_from),
    CHECK (price >= 0),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_item_prices_company ON item_prices(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_prices_item ON item_prices(item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_prices_tier ON item_prices(price_tier) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_prices_active ON item_prices(is_active, effective_from, effective_to) WHERE deleted_at IS NULL;

CREATE TRIGGER trigger_item_prices_updated_at
    BEFORE UPDATE ON item_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE item_prices IS 'Multi-tier pricing for items with date effectivity (no variant dependency)';
COMMENT ON COLUMN item_prices.item_id IS 'Direct link to items table (no variant layer)';
COMMENT ON COLUMN item_prices.price_tier IS 'Price tier code: fc (Factory Cost), ws (Wholesale), srp (SRP), etc.';
COMMENT ON COLUMN item_prices.effective_from IS 'Start date when this price becomes effective';
COMMENT ON COLUMN item_prices.effective_to IS 'End date when this price expires (NULL = no expiry)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Item Prices Table Restored!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  ✓ item_prices table created';
    RAISE NOTICE '  ✓ Links directly to items (not variants)';
    RAISE NOTICE '  ✓ Supports multi-tier pricing';
    RAISE NOTICE '  ✓ Includes date effectivity';
    RAISE NOTICE '============================================';
END $$;
