-- Migration: Add packaging_id to sales_quotation_items
-- Description: Adds packaging_id column and index after item_packaging exists

ALTER TABLE sales_quotation_items
ADD COLUMN IF NOT EXISTS packaging_id UUID REFERENCES item_packaging(id);

CREATE INDEX IF NOT EXISTS idx_quotation_items_packaging
ON sales_quotation_items(packaging_id)
WHERE deleted_at IS NULL AND packaging_id IS NOT NULL;

COMMENT ON COLUMN sales_quotation_items.packaging_id IS 'Package used in this quotation';
