-- Migration: Add SKU column to items
-- Description: Adds optional 8-digit numeric SKU for inventory items

ALTER TABLE items
ADD COLUMN IF NOT EXISTS sku VARCHAR(8);

ALTER TABLE items
DROP CONSTRAINT IF EXISTS items_sku_format_chk;

ALTER TABLE items
ADD CONSTRAINT items_sku_format_chk
CHECK (sku IS NULL OR sku ~ '^[0-9]{8}$');

DROP INDEX IF EXISTS idx_items_sku;

CREATE UNIQUE INDEX IF NOT EXISTS idx_items_company_sku_unique
ON items(company_id, sku)
WHERE deleted_at IS NULL AND sku IS NOT NULL;

COMMENT ON COLUMN items.sku IS '8-digit numeric stock keeping unit';

ALTER TABLE items
ADD COLUMN IF NOT EXISTS sku_qr_image TEXT;

COMMENT ON COLUMN items.sku_qr_image IS 'QR code image as data URL generated from 8-digit SKU';
