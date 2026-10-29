-- ============================================================================
-- Migration: Void delivery note receiving exceptions
-- Description:
--   Lets the receiving business unit undo a mistaken unexpected-item scan while
--   receiving is in progress. The exception row is kept for audit with status
--   'voided', mirroring how voided receiving scans are kept.
--
--   SECURITY DEFINER keeps the exceptions table read-only through the Data API:
--   an invoker function would need a table-wide UPDATE grant and policy. The
--   function derives the caller from auth.uid() and enforces the same business
--   unit access as the exceptions SELECT policy.
-- ============================================================================

BEGIN;

ALTER TABLE public.delivery_note_receiving_exceptions
  ADD COLUMN voided_at TIMESTAMPTZ,
  ADD COLUMN voided_by UUID REFERENCES public.users(id),
  ADD COLUMN void_reason TEXT;

ALTER TABLE public.delivery_note_receiving_exceptions
  DROP CONSTRAINT delivery_note_receiving_exceptions_status_check,
  ADD CONSTRAINT delivery_note_receiving_exceptions_status_check
    CHECK (status IN ('pending_review', 'accepted', 'rejected', 'resolved', 'voided')),
  ADD CONSTRAINT delivery_note_receiving_exceptions_voided_chk
    CHECK ((status = 'voided') = (voided_at IS NOT NULL AND voided_by IS NOT NULL));

CREATE OR REPLACE FUNCTION public.void_delivery_note_receiving_exception(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_dn_id UUID,
  p_exception_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_dn_status TEXT;
  v_requesting_business_unit_id UUID;
  v_receiving_started_at TIMESTAMPTZ;
  v_exception_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT note.status, note.requesting_business_unit_id, note.receiving_started_at
  INTO v_dn_status, v_requesting_business_unit_id, v_receiving_started_at
  FROM public.delivery_notes AS note
  WHERE note.id = p_dn_id
    AND note.company_id = p_company_id
    AND note.deleted_at IS NULL
  FOR UPDATE;

  -- A note outside the caller's receiving business unit is reported as missing.
  IF NOT FOUND
    OR v_requesting_business_unit_id IS DISTINCT FROM p_business_unit_id
    OR NOT EXISTS (
      SELECT 1
      FROM public.user_business_unit_access AS access
      WHERE access.user_id = v_user_id
        AND access.business_unit_id = p_business_unit_id
    )
  THEN
    RAISE EXCEPTION 'Delivery note not found';
  END IF;

  IF v_dn_status <> 'dispatched' OR v_receiving_started_at IS NULL THEN
    RAISE EXCEPTION 'Only in-progress receiving can have unexpected items removed';
  END IF;

  SELECT receiving_exception.status
  INTO v_exception_status
  FROM public.delivery_note_receiving_exceptions AS receiving_exception
  WHERE receiving_exception.id = p_exception_id
    AND receiving_exception.company_id = p_company_id
    AND receiving_exception.dn_id = p_dn_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receiving exception not found';
  END IF;

  IF v_exception_status = 'voided' THEN
    RETURN;
  END IF;

  IF v_exception_status <> 'pending_review' THEN
    RAISE EXCEPTION 'Only pending receiving exceptions can be removed';
  END IF;

  UPDATE public.delivery_note_receiving_exceptions
  SET
    status = 'voided',
    voided_at = now(),
    voided_by = v_user_id,
    void_reason = NULLIF(BTRIM(p_reason), ''),
    updated_at = now()
  WHERE id = p_exception_id
    AND company_id = p_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.void_delivery_note_receiving_exception(UUID, UUID, UUID, UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_delivery_note_receiving_exception(UUID, UUID, UUID, UUID, TEXT)
  TO authenticated;

COMMIT;
