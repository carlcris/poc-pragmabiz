ALTER TABLE load_lists
ADD COLUMN IF NOT EXISTS liner_name VARCHAR(150);

COMMENT ON COLUMN load_lists.liner_name IS 'Shipping liner or line associated with the load list';
