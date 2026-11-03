-- Run against local data with an approved, staged GRN. All test changes roll back.
-- docker exec -i supabase_db_backend psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/grn-confirmation.sql
BEGIN;

CREATE TEMP TABLE receipt_test_context ON COMMIT DROP AS
SELECT g.id AS grn_id, g.company_id, g.business_unit_id, g.load_list_id,
  g.checked_by AS actor_id
FROM public.grns g
WHERE g.status = 'approved' AND g.deleted_at IS NULL AND g.checked_by IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.grn_items gi WHERE gi.grn_id = g.id)
  AND NOT EXISTS (SELECT 1 FROM public.grn_items gi
    WHERE gi.grn_id = g.id AND gi.load_list_item_id IS NULL)
  AND NOT EXISTS (SELECT 1 FROM public.grns other
    WHERE other.load_list_id = g.load_list_id AND other.id <> g.id
      AND other.status = 'approved' AND other.deleted_at IS NULL)
  AND EXISTS (SELECT 1 FROM public.stock_transactions st
    WHERE st.reference_id = g.id AND st.reference_type = 'grn' AND st.deleted_at IS NULL)
ORDER BY g.id LIMIT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM receipt_test_context) THEN
    RAISE EXCEPTION 'Test requires an approved staged GRN with linked load-list items';
  END IF;
END $$;

GRANT SELECT ON receipt_test_context TO authenticated;
SELECT set_config('request.jwt.claim.sub', actor_id::TEXT, TRUE),
  set_config('request.jwt.claims', jsonb_build_object('sub', actor_id,
    'role', 'authenticated', 'current_business_unit_id', business_unit_id)::TEXT, TRUE)
FROM receipt_test_context;

CREATE FUNCTION pg_temp.prepare_receipt(p_received_ratio NUMERIC, p_damaged_ratio NUMERIC)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.grns SET status = 'pending_approval'
  WHERE id = (SELECT grn_id FROM receipt_test_context);
  UPDATE public.load_lists SET status = 'receiving'
  WHERE id = (SELECT load_list_id FROM receipt_test_context);
  UPDATE public.grn_items
  SET received_qty = load_list_qty * p_received_ratio,
      damaged_qty = load_list_qty * p_damaged_ratio
  WHERE grn_id = (SELECT grn_id FROM receipt_test_context);
END;
$$;

CREATE FUNCTION pg_temp.assert_receipt(p_received_ratio NUMERIC, p_damaged_ratio NUMERIC)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.grn_items gi
    WHERE gi.grn_id = (SELECT grn_id FROM receipt_test_context)
      AND (gi.received_qty <> ROUND(gi.load_list_qty * p_received_ratio, 4)
        OR gi.damaged_qty <> ROUND(gi.load_list_qty * p_damaged_ratio, 4))
  ) THEN
    RAISE EXCEPTION 'GRN receipt quantities do not match';
  END IF;
END;
$$;

-- Confirmation preserves GRN quantities in their snapshotted unit.
SELECT pg_temp.prepare_receipt(1, 0);
SET LOCAL ROLE authenticated;
SELECT public.confirm_grn_with_putaway(company_id, actor_id, grn_id, NULL)
FROM receipt_test_context;
RESET ROLE;
SELECT pg_temp.assert_receipt(1, 0);

-- Genuine shortage and damaged quantities remain visible.
SELECT pg_temp.prepare_receipt(0.6, 0.2);
SET LOCAL ROLE authenticated;
SELECT public.confirm_grn_with_putaway(company_id, actor_id, grn_id, NULL)
FROM receipt_test_context;
RESET ROLE;
SELECT pg_temp.assert_receipt(0.6, 0.2);

-- Fractional received quantities plus damage can also account for the full line.
SELECT pg_temp.prepare_receipt(0.75, 0.25);
SET LOCAL ROLE authenticated;
SELECT public.confirm_grn_with_putaway(company_id, actor_id, grn_id, NULL)
FROM receipt_test_context;
RESET ROLE;
SELECT pg_temp.assert_receipt(0.75, 0.25);

-- Over-receipts preserve actual quantities: 16.5 received against 15 expected.
SELECT pg_temp.prepare_receipt(1.1, 0);
SET LOCAL ROLE authenticated;
SELECT public.confirm_grn_with_putaway(company_id, actor_id, grn_id, NULL)
FROM receipt_test_context;
RESET ROLE;
SELECT pg_temp.assert_receipt(1.1, 0);

-- Confirmation preserves over-receipts that include damage.
SELECT pg_temp.prepare_receipt(1, 0.1);
SET LOCAL ROLE authenticated;
SELECT public.confirm_grn_with_putaway(company_id, actor_id, grn_id, NULL)
FROM receipt_test_context;
RESET ROLE;
SELECT pg_temp.assert_receipt(1, 0.1);

-- Fail at the load-list status transition to prove confirmation rollback.
SELECT pg_temp.prepare_receipt(1.1, 0);
CREATE FUNCTION pg_temp.fail_receipt_status() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'received' THEN
    RAISE EXCEPTION 'forced receipt rollback test';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER receipt_test_failure BEFORE UPDATE ON public.load_lists
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_receipt_status();

SET LOCAL ROLE authenticated;
DO $$
DECLARE context RECORD;
BEGIN
  SELECT company_id, actor_id, grn_id INTO context FROM receipt_test_context;
  BEGIN
    PERFORM public.confirm_grn_with_putaway(context.company_id, context.actor_id, context.grn_id, NULL);
    RAISE EXCEPTION 'Expected receipt failure did not occur';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'forced receipt rollback test' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
SELECT pg_temp.assert_receipt(1.1, 0);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.grns
      WHERE id = (SELECT grn_id FROM receipt_test_context) AND status <> 'pending_approval')
    OR EXISTS (SELECT 1 FROM public.load_lists
      WHERE id = (SELECT load_list_id FROM receipt_test_context) AND status <> 'receiving') THEN
    RAISE EXCEPTION 'Failed confirmation retained partial workflow writes';
  END IF;
END $$;

ROLLBACK;
