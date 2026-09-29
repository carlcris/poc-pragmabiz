-- Restore Data API privileges that are required before RLS policies can run.
--
-- Fresh local resets create application tables as postgres. In this project the
-- postgres default ACL does not grant DML privileges to authenticated, leaving
-- the existing RLS policies unreachable and causing login profile reads to fail.

-- item_prices lost its RLS configuration when the table was dropped and
-- recreated in 20260105000001_restore_item_prices.sql.
ALTER TABLE public.item_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY item_prices_select_policy
  ON public.item_prices
  FOR SELECT
  TO authenticated
  USING (
    company_id = (
      SELECT users.company_id
      FROM public.users
      WHERE users.id = (SELECT auth.uid())
    )
  );

CREATE POLICY item_prices_insert_policy
  ON public.item_prices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = (
      SELECT users.company_id
      FROM public.users
      WHERE users.id = (SELECT auth.uid())
    )
  );

CREATE POLICY item_prices_update_policy
  ON public.item_prices
  FOR UPDATE
  TO authenticated
  USING (
    company_id = (
      SELECT users.company_id
      FROM public.users
      WHERE users.id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    company_id = (
      SELECT users.company_id
      FROM public.users
      WHERE users.id = (SELECT auth.uid())
    )
  );

DO $migration$
DECLARE
  v_table RECORD;
  v_privileges TEXT;
BEGIN
  FOR v_table IN
    SELECT
      tables.oid,
      namespaces.nspname AS schema_name,
      tables.relname AS table_name
    FROM pg_class AS tables
    JOIN pg_namespace AS namespaces
      ON namespaces.oid = tables.relnamespace
    WHERE namespaces.nspname = 'public'
      AND tables.relkind IN ('r', 'p')
      AND tables.relrowsecurity
      AND EXISTS (
        SELECT 1
        FROM pg_policy AS policies
        WHERE policies.polrelid = tables.oid
          AND (
            0 = ANY(policies.polroles)
            OR 'authenticated'::regrole::oid = ANY(policies.polroles)
          )
      )
  LOOP
    SELECT string_agg(policy_privileges.privilege, ', ' ORDER BY policy_privileges.privilege)
    INTO v_privileges
    FROM (
      SELECT DISTINCT unnest(
        CASE policies.polcmd
          WHEN '*' THEN ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE']
          WHEN 'r' THEN ARRAY['SELECT']
          WHEN 'a' THEN ARRAY['INSERT']
          WHEN 'w' THEN ARRAY['UPDATE']
          WHEN 'd' THEN ARRAY['DELETE']
        END
      ) AS privilege
      FROM pg_policy AS policies
      WHERE policies.polrelid = v_table.oid
        AND (
          0 = ANY(policies.polroles)
          OR 'authenticated'::regrole::oid = ANY(policies.polroles)
        )
    ) AS policy_privileges;

    EXECUTE format(
      'GRANT %s ON TABLE %I.%I TO authenticated',
      v_privileges,
      v_table.schema_name,
      v_table.table_name
    );
  END LOOP;
END;
$migration$;

-- These login lookups predate business-unit RLS and are read-only in the
-- authentication flow. Mutation remains RPC/server-owned.
GRANT SELECT ON TABLE
  public.business_units,
  public.user_business_unit_access
TO authenticated;

-- Direct inserts into batch/unit-option tables consume these sequences.
GRANT USAGE, SELECT ON SEQUENCE
  public.item_batch_location_sku_seq,
  public.item_unit_option_barcode_seq
TO authenticated;

-- The service role is an explicit RLS-bypass credential and still requires
-- PostgreSQL object privileges to perform server-owned operations.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
