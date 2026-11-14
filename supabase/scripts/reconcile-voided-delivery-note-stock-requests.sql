-- Run as a database administrator while the voided delivery note still exists.
-- The existing reconciliation function derives each request's status from all of its deliveries and receipts.
-- Review the previous and recalculated statuses, then change the final ROLLBACK to COMMIT to save.
BEGIN;

SET LOCAL row_security = off;
SET LOCAL lock_timeout = '5s';

DO $reconcile_stock_requests$
DECLARE
  v_delivery_note_id CONSTANT UUID := 'b3bb987f-044d-41f8-96d8-17d2ad8597d6';
  v_company_id UUID;
  v_request_ids UUID[];
BEGIN
  SELECT note.company_id INTO v_company_id
  FROM public.delivery_notes AS note
  WHERE note.id = v_delivery_note_id AND note.status = 'voided'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected an existing voided delivery note with ID %', v_delivery_note_id;
  END IF;

  CREATE TEMP TABLE linked_stock_request_statuses ON COMMIT DROP AS
  WITH linked_requests AS (
    SELECT source.sr_id FROM public.delivery_note_sources AS source
    WHERE source.dn_id = v_delivery_note_id AND source.company_id = v_company_id
    UNION
    SELECT line.sr_id FROM public.delivery_note_items AS line
    WHERE line.dn_id = v_delivery_note_id AND line.company_id = v_company_id
  )
  SELECT request.id, request.request_code, request.status AS previous_status
  FROM public.stock_requests AS request
  JOIN linked_requests AS linked ON linked.sr_id = request.id
  WHERE request.company_id = v_company_id AND request.deleted_at IS NULL
  ORDER BY request.id
  FOR UPDATE OF request;

  IF NOT EXISTS (SELECT 1 FROM linked_stock_request_statuses) THEN
    RAISE EXCEPTION 'No stock requests are linked to voided delivery note %', v_delivery_note_id;
  END IF;

  SELECT ARRAY_AGG(id ORDER BY id) INTO v_request_ids
  FROM linked_stock_request_statuses
  WHERE previous_status IS DISTINCT FROM 'cancelled';

  PERFORM public.reconcile_stock_request_statuses(v_request_ids);
END;
$reconcile_stock_requests$;

SELECT previous.request_code, previous.previous_status, request.status AS recalculated_status
FROM linked_stock_request_statuses AS previous
JOIN public.stock_requests AS request ON request.id = previous.id
ORDER BY previous.request_code;

ROLLBACK; -- Change to COMMIT after reviewing the dry run.
