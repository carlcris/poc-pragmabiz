-- Ensure core delivery/picking tables are published to Supabase realtime.
-- Extend the list below for additional modules that need realtime updates.
DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOR v_table IN
    SELECT unnest(ARRAY[
      'delivery_notes',
      'delivery_note_items',
      'pick_lists',
      'pick_list_items'
    ])
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = v_table
        AND c.relkind = 'r'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_publication p
      JOIN pg_publication_rel pr ON pr.prpubid = p.oid
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE p.pubname = 'supabase_realtime'
        AND n.nspname = 'public'
        AND c.relname = v_table
    ) THEN
      EXECUTE format(
        'ALTER PUBLICATION supabase_realtime ADD TABLE %I.%I',
        'public',
        v_table
      );
    END IF;
  END LOOP;
END
$$;
