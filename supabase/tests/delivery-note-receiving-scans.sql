-- Run against seeded local Supabase with the standard identified-item receiving schema.
-- docker exec -i supabase_db_backend psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/delivery-note-receiving-scans.sql
-- All scan records, fault injection, and quantity changes are rolled back.
BEGIN;

CREATE TEMP TABLE receiving_scan_test_context ON COMMIT DROP AS
SELECT note.id AS dn_id, note.company_id, note.requesting_business_unit_id AS business_unit_id,
  actor.id AS actor_id, line.id AS line_id, line.item_id, line.item_unit_option_id,
  COALESCE(line.received_qty, 0) AS received_qty,
  (SELECT COUNT(*) FROM public.delivery_note_item_receiving_scans scan
    WHERE scan.dn_item_id = line.id AND scan.voided_at IS NULL) AS active_scan_count,
  (SELECT COUNT(*) FROM public.delivery_note_receiving_exceptions exception
    WHERE exception.dn_id = note.id) AS exception_count,
  (SELECT COUNT(*) FROM public.stock_transactions stock
    WHERE stock.company_id = note.company_id) AS stock_transaction_count
FROM public.delivery_notes note
JOIN public.delivery_note_items line ON line.dn_id = note.id AND line.is_voided IS NOT TRUE
JOIN public.users actor ON actor.id = note.receiving_started_by
WHERE note.status = 'dispatched' AND note.deleted_at IS NULL
  AND note.receiving_started_at IS NOT NULL AND note.requesting_warehouse_id IS NOT NULL
ORDER BY note.id, line.id LIMIT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM receiving_scan_test_context) THEN
    RAISE EXCEPTION 'Test needs a dispatched delivery note with receiving started and an item line';
  END IF;
END $$;

CREATE FUNCTION pg_temp.fail_receiving_scan_test() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.fail_receiving_scan', TRUE) = 'on' THEN
    RAISE EXCEPTION 'FORCED_RECEIVING_SCAN_FAILURE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER receiving_scan_test_fail_exception AFTER INSERT ON public.delivery_note_receiving_exceptions
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_receiving_scan_test();
CREATE TRIGGER receiving_scan_test_fail_quantity AFTER UPDATE ON public.delivery_note_items
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_receiving_scan_test();

GRANT SELECT ON receiving_scan_test_context TO authenticated;
SELECT set_config('request.jwt.claim.sub', actor_id::TEXT, TRUE) FROM receiving_scan_test_context;
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  context RECORD;
  result JSONB;
  known_unexpected_item UUID;
BEGIN
  SELECT dn_id, company_id, business_unit_id, actor_id, line_id, item_id, item_unit_option_id,
    received_qty, active_scan_count, exception_count, stock_transaction_count
  INTO context FROM receiving_scan_test_context;

  BEGIN
    PERFORM public.record_delivery_note_receiving_scan(context.company_id, context.business_unit_id,
      context.actor_id, context.dn_id, 'UNKNOWN-LABEL', 'TEST-UNKNOWN', NULL, 12);
    RAISE EXCEPTION 'Unidentified scan was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Item not found' THEN RAISE; END IF;
  END;

  IF (SELECT COUNT(*) FROM public.delivery_note_receiving_exceptions WHERE dn_id = context.dn_id)
    <> context.exception_count OR (SELECT received_qty FROM public.delivery_note_items
    WHERE id = context.line_id) <> context.received_qty THEN
    RAISE EXCEPTION 'Unidentified input left an exception or quantity change';
  END IF;

  SELECT item.id INTO known_unexpected_item FROM public.items item
  WHERE item.company_id = context.company_id AND item.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.delivery_note_items line
      WHERE line.dn_id = context.dn_id AND line.item_id = item.id AND line.is_voided IS NOT TRUE)
  ORDER BY item.id LIMIT 1;
  IF known_unexpected_item IS NULL THEN
    RAISE EXCEPTION 'Test needs a catalog item absent from the delivery note';
  END IF;
  result := public.record_delivery_note_receiving_scan(context.company_id, context.business_unit_id,
    context.actor_id, context.dn_id, 'KNOWN-UNEXPECTED', 'TEST-KNOWN-UNEXPECTED',
    known_unexpected_item, 1);
  IF result->>'type' <> 'exception' OR (SELECT item_id
    FROM public.delivery_note_receiving_exceptions WHERE id = (result->>'exceptionId')::UUID)
    IS DISTINCT FROM known_unexpected_item THEN
    RAISE EXCEPTION 'Known unexpected items must retain their existing review contract';
  END IF;

  PERFORM public.reject_delivery_note_receiving_exception(context.company_id,
    context.business_unit_id, context.actor_id, context.dn_id, (result->>'exceptionId')::UUID);
  IF (SELECT status FROM public.delivery_note_receiving_exceptions
    WHERE id = (result->>'exceptionId')::UUID) <> 'rejected' THEN
    RAISE EXCEPTION 'Identified unexpected items must retain their review path';
  END IF;

  -- Raise after the exception INSERT, proving no partial exception remains.
  PERFORM set_config('test.fail_receiving_scan', 'on', TRUE);
  BEGIN
    PERFORM public.record_delivery_note_receiving_scan(context.company_id, context.business_unit_id,
      context.actor_id, context.dn_id, 'KNOWN-UNEXPECTED', 'TEST-EXCEPTION-ROLLBACK',
      known_unexpected_item, 1);
    RAISE EXCEPTION 'Injected exception insert failure did not occur';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'FORCED_RECEIVING_SCAN_FAILURE' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.delivery_note_receiving_exceptions
    WHERE dn_id = context.dn_id AND box_id = 'TEST-EXCEPTION-ROLLBACK') THEN
    RAISE EXCEPTION 'Failed exception left a partial record';
  END IF;

  -- Raise during quantity reconciliation after the expected scan INSERT.
  BEGIN
    PERFORM public.record_delivery_note_receiving_scan(context.company_id, context.business_unit_id,
      context.actor_id, context.dn_id, 'EXPECTED-LABEL', 'TEST-EXPECTED-ROLLBACK', context.item_id, 12,
      p_item_unit_option_id => context.item_unit_option_id);
    RAISE EXCEPTION 'Injected quantity reconciliation failure did not occur';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'FORCED_RECEIVING_SCAN_FAILURE' THEN RAISE; END IF;
  END;
  PERFORM set_config('test.fail_receiving_scan', 'off', TRUE);
  IF EXISTS (SELECT 1 FROM public.delivery_note_item_receiving_scans
    WHERE dn_id = context.dn_id AND box_id = 'TEST-EXPECTED-ROLLBACK')
    OR (SELECT received_qty FROM public.delivery_note_items WHERE id = context.line_id)
      <> context.received_qty THEN
    RAISE EXCEPTION 'Failed reconciliation left a scan or quantity change';
  END IF;

  result := public.record_delivery_note_receiving_scan(context.company_id, context.business_unit_id,
    context.actor_id, context.dn_id, 'EXPECTED-LABEL', 'TEST-EXPECTED', context.item_id, 12,
    p_item_unit_option_id => context.item_unit_option_id);
  IF result->>'type' <> 'scan' OR (SELECT received_qty FROM public.delivery_note_items
    WHERE id = context.line_id) <> context.active_scan_count + 1 THEN
    RAISE EXCEPTION 'Expected scan must still add one, regardless of QR quantity';
  END IF;

  RAISE NOTICE 'Unidentified rejection, known unexpected, expected, review and rollback checks passed';
END $$;

RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM receiving_scan_test_context context WHERE context.stock_transaction_count
    <> (SELECT COUNT(*) FROM public.stock_transactions stock WHERE stock.company_id = context.company_id)) THEN
    RAISE EXCEPTION 'Recording or rejecting an exception must not post inventory';
  END IF;
END $$;
ROLLBACK;
