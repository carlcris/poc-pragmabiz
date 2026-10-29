-- Run against seeded local Supabase with a dispatched delivery note whose receiving has started.
-- docker exec -i supabase_db_backend psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/delivery-note-receiving-exception-void.sql
-- All exception rows, voids, and fault injection are rolled back.
BEGIN;

CREATE TEMP TABLE exception_void_test_context ON COMMIT DROP AS
SELECT note.id AS dn_id, note.company_id, note.requesting_business_unit_id AS business_unit_id,
  note.fulfilling_business_unit_id AS other_business_unit_id, actor.id AS actor_id,
  line.item_id, line.uom_id, NULL::UUID AS pending_id, NULL::UUID AS accepted_id
FROM public.delivery_notes note
JOIN public.delivery_note_items line ON line.dn_id = note.id AND line.is_voided IS NOT TRUE
JOIN public.users actor ON actor.id = note.receiving_started_by
JOIN public.user_business_unit_access access
  ON access.user_id = actor.id AND access.business_unit_id = note.requesting_business_unit_id
WHERE note.status = 'dispatched' AND note.deleted_at IS NULL
  AND note.receiving_started_at IS NOT NULL
ORDER BY note.id, line.id LIMIT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM exception_void_test_context) THEN
    RAISE EXCEPTION 'Test needs a dispatched delivery note with receiving started by a user with access';
  END IF;
END $$;

WITH inserted AS (
  INSERT INTO public.delivery_note_receiving_exceptions (
    company_id, business_unit_id, dn_id, item_id, uom_id, box_id, qr_code, qr_qty, accepted_qty,
    status, scanned_by
  )
  SELECT context.company_id, context.business_unit_id, context.dn_id, context.item_id,
    context.uom_id, box.box_id, 'TEST-QR', 1, 1, box.status, context.actor_id
  FROM exception_void_test_context context
  CROSS JOIN (VALUES ('TEST-VOID-PENDING', 'pending_review'), ('TEST-VOID-ACCEPTED', 'accepted'))
    AS box(box_id, status)
  RETURNING id, box_id
)
UPDATE exception_void_test_context
SET pending_id = (SELECT id FROM inserted WHERE box_id = 'TEST-VOID-PENDING'),
  accepted_id = (SELECT id FROM inserted WHERE box_id = 'TEST-VOID-ACCEPTED');

CREATE FUNCTION pg_temp.fail_exception_void_test() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.fail_exception_void', TRUE) = 'on' THEN
    RAISE EXCEPTION 'FORCED_EXCEPTION_VOID_FAILURE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER exception_void_test_fail AFTER UPDATE ON public.delivery_note_receiving_exceptions
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_exception_void_test();

GRANT SELECT ON exception_void_test_context TO authenticated, anon;
SELECT set_config('request.jwt.claim.sub', actor_id::TEXT, TRUE) FROM exception_void_test_context;
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  context RECORD;
  row_status TEXT;
  row_voided_by UUID;
  row_voided_at TIMESTAMPTZ;
  first_voided_at TIMESTAMPTZ;
BEGIN
  SELECT dn_id, company_id, business_unit_id, other_business_unit_id, actor_id, pending_id,
    accepted_id
  INTO context FROM exception_void_test_context;

  -- Another business unit cannot void, and the note is reported as missing.
  BEGIN
    PERFORM public.void_delivery_note_receiving_exception(context.company_id,
      context.other_business_unit_id, context.dn_id, context.pending_id, NULL);
    RAISE EXCEPTION 'Void from another business unit was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Delivery note not found' THEN RAISE; END IF;
  END;

  -- A failure after the update rolls the void back.
  PERFORM set_config('test.fail_exception_void', 'on', TRUE);
  BEGIN
    PERFORM public.void_delivery_note_receiving_exception(context.company_id,
      context.business_unit_id, context.dn_id, context.pending_id, NULL);
    RAISE EXCEPTION 'Forced void failure did not raise';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'FORCED_EXCEPTION_VOID_FAILURE' THEN RAISE; END IF;
  END;
  PERFORM set_config('test.fail_exception_void', 'off', TRUE);

  SELECT status, voided_by, voided_at INTO row_status, row_voided_by, row_voided_at
  FROM public.delivery_note_receiving_exceptions WHERE id = context.pending_id;
  IF row_status <> 'pending_review' OR row_voided_by IS NOT NULL OR row_voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Failed void left a partial change: %', row_status;
  END IF;

  -- The pending exception is voided by the caller.
  PERFORM public.void_delivery_note_receiving_exception(context.company_id,
    context.business_unit_id, context.dn_id, context.pending_id, '  mistaken scan  ');
  SELECT status, voided_by, voided_at INTO row_status, row_voided_by, first_voided_at
  FROM public.delivery_note_receiving_exceptions WHERE id = context.pending_id;
  IF row_status <> 'voided' OR row_voided_by <> context.actor_id OR first_voided_at IS NULL THEN
    RAISE EXCEPTION 'Pending exception was not voided by the caller';
  END IF;
  IF (SELECT void_reason FROM public.delivery_note_receiving_exceptions
      WHERE id = context.pending_id) <> 'mistaken scan' THEN
    RAISE EXCEPTION 'Void reason was not trimmed';
  END IF;

  -- Voiding again is a no-op.
  PERFORM public.void_delivery_note_receiving_exception(context.company_id,
    context.business_unit_id, context.dn_id, context.pending_id, NULL);
  SELECT voided_at INTO row_voided_at
  FROM public.delivery_note_receiving_exceptions WHERE id = context.pending_id;
  IF row_voided_at <> first_voided_at THEN
    RAISE EXCEPTION 'Repeated void changed the exception';
  END IF;

  -- A voided exception can no longer be reviewed.
  BEGIN
    PERFORM public.reject_delivery_note_receiving_exception(context.company_id,
      context.business_unit_id, context.actor_id, context.dn_id, context.pending_id, NULL);
    RAISE EXCEPTION 'Voided exception was rejected';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Only pending receiving exceptions can be reviewed' THEN RAISE; END IF;
  END;

  -- A reviewed exception cannot be voided.
  BEGIN
    PERFORM public.void_delivery_note_receiving_exception(context.company_id,
      context.business_unit_id, context.dn_id, context.accepted_id, NULL);
    RAISE EXCEPTION 'Accepted exception was voided';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Only pending receiving exceptions can be removed' THEN RAISE; END IF;
  END;

  -- An exception from another note is not found.
  BEGIN
    PERFORM public.void_delivery_note_receiving_exception(context.company_id,
      context.business_unit_id, context.dn_id, gen_random_uuid(), NULL);
    RAISE EXCEPTION 'Unknown exception was voided';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Receiving exception not found' THEN RAISE; END IF;
  END;
END $$;

-- Anonymous callers cannot execute the function.
RESET ROLE;
SET LOCAL ROLE anon;
DO $$
DECLARE
  context RECORD;
BEGIN
  SELECT dn_id, company_id, business_unit_id, accepted_id INTO context
  FROM exception_void_test_context;
  PERFORM public.void_delivery_note_receiving_exception(context.company_id,
    context.business_unit_id, context.dn_id, context.accepted_id, NULL);
  RAISE EXCEPTION 'Anonymous void was allowed';
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;

RESET ROLE;
SELECT 'delivery-note-receiving-exception-void: all checks passed' AS result;
ROLLBACK;
