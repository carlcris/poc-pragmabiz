-- Publish item warehouse balances so stock-aware item lists update after stock movements.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'item_warehouse'
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
      AND c.relname = 'item_warehouse'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.item_warehouse;
  END IF;
END
$$;
