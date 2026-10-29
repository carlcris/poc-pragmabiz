-- Run against seeded local Supabase after the receiving inbox migration.
-- docker exec -i supabase_db_backend psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/receiving-inbox-progress.sql
-- All delivery-note and quantity changes are rolled back.
BEGIN;

CREATE TEMP TABLE receiving_inbox_progress_test_context ON COMMIT DROP AS
SELECT note.id AS dn_id, note.dn_no, note.company_id,
  note.requesting_business_unit_id AS business_unit_id, actor.id AS actor_id,
  (SELECT COUNT(*) FROM public.delivery_note_items AS line WHERE line.dn_id = note.id) AS line_count,
  (SELECT COALESCE(SUM(exception.accepted_qty), 0)
    FROM public.delivery_note_receiving_exceptions AS exception
    WHERE exception.dn_id = note.id AND exception.company_id = note.company_id
      AND exception.status IN ('pending_review', 'accepted', 'resolved')) AS unexpected_qty
FROM public.delivery_notes AS note
JOIN public.user_business_unit_access AS access
  ON access.business_unit_id = note.requesting_business_unit_id
JOIN public.users AS actor ON actor.id = access.user_id AND actor.company_id = note.company_id
WHERE note.deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM public.delivery_note_items AS line WHERE line.dn_id = note.id)
ORDER BY note.id, actor.id
LIMIT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM receiving_inbox_progress_test_context) THEN
    RAISE EXCEPTION 'Test needs a delivery note with item lines and a user with destination access';
  END IF;
END $$;

UPDATE public.delivery_notes AS note
SET status = 'dispatched', receiving_started_at = NOW()
FROM receiving_inbox_progress_test_context AS context
WHERE note.id = context.dn_id;

CREATE FUNCTION pg_temp.assert_receiving_inbox_progress(p_expected_per_line NUMERIC)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  context RECORD;
  inbox JSONB;
  inbox_row JSONB;
BEGIN
  SELECT dn_id, dn_no, company_id, business_unit_id, line_count, unexpected_qty
  INTO context FROM receiving_inbox_progress_test_context;

  inbox := public.list_receiving_inbox(context.company_id, context.business_unit_id,
    FALSE, TRUE, 'in_progress', 'delivery_note', context.dn_no, 20, 0);
  SELECT row.value INTO inbox_row
  FROM jsonb_array_elements(inbox->'rows') AS row(value)
  WHERE row.value->>'id' = context.dn_id::TEXT;

  IF inbox_row IS NULL THEN
    RAISE EXCEPTION 'Authenticated receiving inbox did not return the fixture delivery note';
  END IF;
  IF (inbox_row->>'totalQty')::NUMERIC IS DISTINCT FROM p_expected_per_line * context.line_count THEN
    RAISE EXCEPTION 'Inbox total must equal dispatched quantities: expected %, got %',
      p_expected_per_line * context.line_count, inbox_row->>'totalQty';
  END IF;
  IF (inbox_row->>'doneQty')::NUMERIC IS DISTINCT FROM
    p_expected_per_line * context.line_count + context.unexpected_qty THEN
    RAISE EXCEPTION 'Inbox scanned quantity changed unexpectedly';
  END IF;
  IF (inbox_row->>'lineCount')::BIGINT IS DISTINCT FROM context.line_count THEN
    RAISE EXCEPTION 'Inbox line count changed unexpectedly';
  END IF;
END $$;

GRANT SELECT ON receiving_inbox_progress_test_context TO authenticated;
DO $$
DECLARE
  context RECORD;
BEGIN
  SELECT actor_id, business_unit_id INTO context FROM receiving_inbox_progress_test_context;
  PERFORM set_config('request.jwt.claim.sub', context.actor_id::TEXT, TRUE);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', TRUE);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', context.actor_id,
    'role', 'authenticated', 'current_business_unit_id', context.business_unit_id)::TEXT, TRUE);
END $$;

-- Allocating ten but dispatching and scanning six must report 6 / 6 per line.
UPDATE public.delivery_note_items AS line
SET allocated_qty = 10, picked_qty = 6, short_qty = 4, dispatched_qty = 6, received_qty = 6
FROM receiving_inbox_progress_test_context AS context
WHERE line.dn_id = context.dn_id;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_receiving_inbox_progress(6);
RESET ROLE;

-- Full dispatch keeps the same total as the allocation.
UPDATE public.delivery_note_items AS line
SET picked_qty = 10, short_qty = 0, dispatched_qty = 10, received_qty = 10
FROM receiving_inbox_progress_test_context AS context
WHERE line.dn_id = context.dn_id;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_receiving_inbox_progress(10);
RESET ROLE;

-- Fractional quantities retain their precision.
UPDATE public.delivery_note_items AS line
SET picked_qty = 6.25, short_qty = 3.75, dispatched_qty = 6.25, received_qty = 6.25
FROM receiving_inbox_progress_test_context AS context
WHERE line.dn_id = context.dn_id;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_receiving_inbox_progress(6.25);
RESET ROLE;

-- Allocated units that were never dispatched must not inflate the total.
UPDATE public.delivery_note_items AS line
SET picked_qty = 0, short_qty = 10, dispatched_qty = 0, received_qty = 0
FROM receiving_inbox_progress_test_context AS context
WHERE line.dn_id = context.dn_id;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_receiving_inbox_progress(0);
RESET ROLE;

ROLLBACK;
