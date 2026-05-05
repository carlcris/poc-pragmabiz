-- Convert purchasing workflow operational timestamps to TIMESTAMPTZ.
-- Legacy timestamp values in this module are interpreted as UTC clock times.

DO $$
DECLARE
  target_columns CONSTANT text[][] := ARRAY[
    ARRAY['suppliers', 'created_at'],
    ARRAY['suppliers', 'updated_at'],
    ARRAY['suppliers', 'deleted_at'],

    ARRAY['purchase_orders', 'approved_at'],
    ARRAY['purchase_orders', 'created_at'],
    ARRAY['purchase_orders', 'updated_at'],
    ARRAY['purchase_orders', 'deleted_at'],

    ARRAY['purchase_order_items', 'created_at'],
    ARRAY['purchase_order_items', 'updated_at'],
    ARRAY['purchase_order_items', 'deleted_at'],

    ARRAY['purchase_receipts', 'created_at'],
    ARRAY['purchase_receipts', 'updated_at'],
    ARRAY['purchase_receipts', 'deleted_at'],

    ARRAY['purchase_receipt_items', 'created_at'],
    ARRAY['purchase_receipt_items', 'updated_at'],
    ARRAY['purchase_receipt_items', 'deleted_at']
  ];
  target_column text[];
BEGIN
  FOREACH target_column SLICE 1 IN ARRAY target_columns LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target_column[1]
        AND column_name = target_column[2]
        AND data_type = 'timestamp without time zone'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE %L',
        target_column[1],
        target_column[2],
        target_column[2],
        'UTC'
      );
    END IF;
  END LOOP;
END $$;
