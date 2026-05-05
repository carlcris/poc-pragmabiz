-- Convert accounting workflow operational timestamps to TIMESTAMPTZ.
-- Legacy timestamp values in this module are interpreted as UTC clock times.

DO $$
DECLARE
  target_columns CONSTANT text[][] := ARRAY[
    ARRAY['accounts', 'created_at'],
    ARRAY['accounts', 'updated_at'],
    ARRAY['accounts', 'deleted_at'],

    ARRAY['journal_entries', 'created_at'],
    ARRAY['journal_entries', 'updated_at'],
    ARRAY['journal_entries', 'deleted_at'],
    ARRAY['journal_entries', 'posted_at'],

    ARRAY['journal_lines', 'created_at']
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
