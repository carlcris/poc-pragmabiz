-- Add image field to items table
-- This allows storing item images (product photos, etc.)

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN items.image_url IS 'URL or path to the item image';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_items_with_images
  ON items(id)
  WHERE image_url IS NOT NULL AND deleted_at IS NULL;
