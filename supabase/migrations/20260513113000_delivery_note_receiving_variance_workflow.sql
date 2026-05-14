-- ============================================================================
-- Migration: Delivery note receiving variance workflow
-- Description:
--   - Stores exact/short/over receiving variance on delivery note lines.
--   - Requires discrepancy acknowledgement before final receiving submit.
--   - Posts stock only for the approved receivable quantity while keeping scan
--     count and variance visible for audit.
-- ============================================================================

BEGIN;

ALTER TABLE public.delivery_notes
  ADD COLUMN IF NOT EXISTS receiving_has_discrepancy BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS receiving_discrepancy_notes TEXT;

ALTER TABLE public.delivery_note_items
  ADD COLUMN IF NOT EXISTS receiving_variance_qty NUMERIC(20, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receiving_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.delivery_note_items
  DROP CONSTRAINT IF EXISTS chk_delivery_note_items_receiving_status,
  ADD CONSTRAINT chk_delivery_note_items_receiving_status
    CHECK (receiving_status IN ('pending', 'exact', 'short', 'over'));

CREATE OR REPLACE FUNCTION public.refresh_delivery_note_item_received_qty(
  p_company_id UUID,
  p_dn_item_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_received_qty NUMERIC;
  v_dispatched_qty NUMERIC;
  v_variance_qty NUMERIC;
  v_receiving_status TEXT;
BEGIN
  SELECT COALESCE(COUNT(*), 0)::NUMERIC
  INTO v_received_qty
  FROM public.delivery_note_item_receiving_scans
  WHERE company_id = p_company_id
    AND dn_item_id = p_dn_item_id
    AND voided_at IS NULL;

  SELECT COALESCE(dispatched_qty, 0)
  INTO v_dispatched_qty
  FROM public.delivery_note_items
  WHERE company_id = p_company_id
    AND id = p_dn_item_id;

  v_variance_qty := v_received_qty - COALESCE(v_dispatched_qty, 0);
  v_receiving_status := CASE
    WHEN v_received_qty = 0 THEN 'pending'
    WHEN v_variance_qty = 0 THEN 'exact'
    WHEN v_variance_qty < 0 THEN 'short'
    ELSE 'over'
  END;

  UPDATE public.delivery_note_items
  SET
    received_qty = v_received_qty,
    receiving_variance_qty = v_variance_qty,
    receiving_status = v_receiving_status,
    receiving_discrepancy_flag = v_variance_qty <> 0,
    updated_at = now()
  WHERE company_id = p_company_id
    AND id = p_dn_item_id;

  RETURN v_received_qty;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_delivery_note_receiving(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_received_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_acknowledge_discrepancy BOOLEAN DEFAULT FALSE,
  p_discrepancy_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dn public.delivery_notes%ROWTYPE;
  v_item RECORD;
  v_items JSONB := '[]'::jsonb;
  v_has_postable_received_qty BOOLEAN := FALSE;
  v_has_any_scan BOOLEAN := FALSE;
  v_has_discrepancy BOOLEAN := FALSE;
  v_discrepancy_notes TEXT := NULLIF(BTRIM(p_discrepancy_notes), '');
  v_line_note TEXT;
  v_line_status TEXT;
  v_line_variance NUMERIC;
BEGIN
  SELECT *
  INTO v_dn
  FROM public.delivery_notes
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note not found';
  END IF;

  IF v_dn.status <> 'dispatched' THEN
    RAISE EXCEPTION 'Only dispatched delivery notes can be submitted for receiving';
  END IF;

  IF v_dn.receiving_started_at IS NULL THEN
    RAISE EXCEPTION 'Receiving has not been started';
  END IF;

  FOR v_item IN
    SELECT
      dni.id,
      COALESCE(dni.dispatched_qty, 0) AS dispatched_qty,
      COALESCE(COUNT(scans.id) FILTER (WHERE scans.voided_at IS NULL), 0)::NUMERIC AS received_scan_count,
      LEAST(
        COALESCE(COUNT(scans.id) FILTER (WHERE scans.voided_at IS NULL), 0)::NUMERIC,
        COALESCE(dni.dispatched_qty, 0)
      ) AS post_received_qty
    FROM public.delivery_note_items dni
    LEFT JOIN public.delivery_note_item_receiving_scans scans
      ON scans.company_id = dni.company_id
     AND scans.dn_item_id = dni.id
    WHERE dni.company_id = p_company_id
      AND dni.dn_id = p_dn_id
      AND COALESCE(dni.is_voided, FALSE) = FALSE
    GROUP BY dni.id, dni.dispatched_qty
    ORDER BY dni.id
  LOOP
    v_line_variance := v_item.received_scan_count - v_item.dispatched_qty;
    v_line_status := CASE
      WHEN v_line_variance = 0 THEN 'exact'
      WHEN v_line_variance < 0 THEN 'short'
      ELSE 'over'
    END;
    v_line_note := CASE
      WHEN v_line_variance = 0 THEN
        FORMAT('Exact receive: scanned %s of %s.', v_item.received_scan_count, v_item.dispatched_qty)
      WHEN v_line_variance < 0 THEN
        FORMAT(
          'Short receive: scanned %s of %s. Short %s.',
          v_item.received_scan_count,
          v_item.dispatched_qty,
          ABS(v_line_variance)
        )
      ELSE
        FORMAT(
          'Over receive: scanned %s of %s. Over %s.',
          v_item.received_scan_count,
          v_item.dispatched_qty,
          v_line_variance
        )
    END;

    v_has_any_scan := v_has_any_scan OR v_item.received_scan_count > 0;
    v_has_discrepancy := v_has_discrepancy OR v_line_variance <> 0;

    UPDATE public.delivery_note_items
    SET
      received_qty = v_item.received_scan_count,
      receiving_variance_qty = v_line_variance,
      receiving_status = v_line_status,
      receiving_discrepancy_flag = v_line_variance <> 0,
      receiving_notes = CONCAT_WS(E'\n', v_line_note, v_discrepancy_notes),
      updated_at = now()
    WHERE company_id = p_company_id
      AND id = v_item.id;

    IF v_item.post_received_qty > 0 THEN
      v_has_postable_received_qty := TRUE;
      v_items := v_items || jsonb_build_array(
        jsonb_build_object(
          'deliveryNoteItemId', v_item.id,
          'receivedQty', v_item.post_received_qty,
          'locationId', NULL
        )
      );
    END IF;
  END LOOP;

  IF NOT v_has_any_scan THEN
    RAISE EXCEPTION 'No receiving scans have been recorded';
  END IF;

  IF v_has_discrepancy AND NOT COALESCE(p_acknowledge_discrepancy, FALSE) THEN
    RAISE EXCEPTION 'Receiving discrepancy acknowledgement is required';
  END IF;

  IF v_has_discrepancy AND v_discrepancy_notes IS NULL THEN
    RAISE EXCEPTION 'Receiving discrepancy notes are required';
  END IF;

  IF NOT v_has_postable_received_qty THEN
    RAISE EXCEPTION 'No receiving scans have been recorded';
  END IF;

  PERFORM public.post_delivery_note_receive(
    p_company_id,
    p_user_id,
    p_dn_id,
    p_business_unit_id,
    COALESCE(p_received_date, now()::DATE),
    p_notes,
    v_items
  );

  UPDATE public.delivery_notes
  SET
    receiving_completed_at = now(),
    receiving_completed_by = p_user_id,
    received_by = p_user_id,
    receiving_notes = COALESCE(NULLIF(BTRIM(p_notes), ''), receiving_notes),
    receiving_has_discrepancy = v_has_discrepancy,
    receiving_discrepancy_notes = CASE
      WHEN v_has_discrepancy THEN v_discrepancy_notes
      ELSE receiving_discrepancy_notes
    END,
    updated_by = p_user_id,
    updated_at = now()
  WHERE id = p_dn_id
    AND company_id = p_company_id;
END;
$$;

COMMIT;
