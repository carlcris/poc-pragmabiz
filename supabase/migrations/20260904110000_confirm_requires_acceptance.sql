-- ============================================================================
-- Migration: Confirming a quotation requires the acceptance record
-- Description:
--   `confirm_sales_quotation_transaction` is the path the UI actually uses to
--   accept a quotation — it sets status = 'accepted' directly, bypassing the
--   /status route entirely. So the requirement has to live here, or it can be
--   walked around by using the endpoint the app already calls.
--
--   Doing it in the RPC also makes the whole thing atomic: the status change and
--   the waiver rows commit together. Recording them from the route left a window
--   where a quotation could end up accepted with no waiver attached.
--
--   The signature gains three parameters. The two-argument version is DROPPED
--   rather than left alongside: two functions of matching arity make PostgREST
--   report every call as ambiguous, which would break confirmation entirely.
-- Date: 2026-09-04
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.confirm_sales_quotation_transaction(uuid, uuid);

CREATE OR REPLACE FUNCTION public.confirm_sales_quotation_transaction(
  p_quotation_id uuid,
  p_warehouse_id uuid DEFAULT NULL::uuid,
  p_accepted_by_name text DEFAULT NULL,
  p_accepted_channel text DEFAULT NULL,
  p_waivers jsonb DEFAULT NULL
)
RETURNS TABLE(quotation_id uuid, status text)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_quotation RECORD;
  v_waiver JSONB;
  v_name TEXT := btrim(COALESCE(p_accepted_by_name, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT quotation.id, quotation.status
  INTO v_quotation
  FROM public.sales_quotations AS quotation
  WHERE quotation.id = p_quotation_id
    AND quotation.deleted_at IS NULL
  FOR UPDATE;

  IF v_quotation.id IS NULL THEN
    RAISE EXCEPTION 'Quotation not found';
  END IF;

  IF COALESCE(v_quotation.status, 'draft') NOT IN ('draft', 'sent', 'accepted') THEN
    RAISE EXCEPTION 'Only draft, sent, or accepted quotations can be confirmed';
  END IF;

  -- Acceptance carries its evidence or it does not happen. Enforced in the
  -- database, not only the dialog, because this is the record the shop relies
  -- on months later when a job is disputed.
  IF v_name = '' THEN
    RAISE EXCEPTION 'ACCEPTANCE_NAME_REQUIRED';
  END IF;

  IF p_accepted_channel IS NULL THEN
    RAISE EXCEPTION 'ACCEPTANCE_CHANNEL_REQUIRED';
  END IF;

  IF p_waivers IS NULL OR jsonb_array_length(p_waivers) = 0 THEN
    RAISE EXCEPTION 'ACCEPTANCE_WAIVER_REQUIRED';
  END IF;

  UPDATE public.sales_quotations
  SET
    status = 'accepted',
    accepted_by_name = v_name,
    accepted_channel = p_accepted_channel,
    accepted_at = NOW(),
    accepted_recorded_by = v_user_id,
    updated_by = v_user_id,
    updated_at = NOW()
  WHERE id = p_quotation_id;

  SELECT company_id INTO v_company_id FROM public.users WHERE id = v_user_id;

  -- Re-confirming replaces the waiver set rather than appending, so a corrected
  -- upload does not leave the superseded file attached as if it still applied.
  UPDATE public.sales_quotation_waivers AS waiver
  SET deleted_at = NOW()
  WHERE waiver.quotation_id = p_quotation_id
    AND waiver.deleted_at IS NULL;

  FOR v_waiver IN SELECT value FROM jsonb_array_elements(p_waivers)
  LOOP
    INSERT INTO public.sales_quotation_waivers (
      company_id,
      quotation_id,
      storage_path,
      file_name,
      mime_type,
      file_size_bytes,
      created_by
    )
    VALUES (
      v_company_id,
      p_quotation_id,
      v_waiver ->> 'storagePath',
      COALESCE(NULLIF(v_waiver ->> 'fileName', ''), 'waiver'),
      COALESCE(NULLIF(v_waiver ->> 'mimeType', ''), 'application/octet-stream'),
      COALESCE(NULLIF(v_waiver ->> 'fileSizeBytes', '')::BIGINT, 0),
      v_user_id
    );
  END LOOP;

  quotation_id := p_quotation_id;
  status := 'accepted';
  RETURN NEXT;
END;
$function$;

-- Manual status changes share the acceptance transaction, including callers of
-- /status. Lock before checking transitions so concurrent requests cannot accept
-- an already rejected/ordered quotation.
CREATE OR REPLACE FUNCTION public.change_sales_quotation_status_transaction(
  p_quotation_id uuid,
  p_status text,
  p_accepted_by_name text DEFAULT NULL,
  p_accepted_channel text DEFAULT NULL,
  p_waiver_paths jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_quotation RECORD;
  v_waivers jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT q.id, q.status INTO v_quotation
  FROM public.sales_quotations q
  WHERE q.id = p_quotation_id AND q.deleted_at IS NULL
    AND q.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid())
  FOR UPDATE;

  IF v_quotation.id IS NULL THEN
    RAISE EXCEPTION 'Quotation not found';
  END IF;
  IF NOT (
    (v_quotation.status = 'draft' AND p_status IN ('sent', 'accepted', 'rejected')) OR
    (v_quotation.status = 'sent' AND p_status IN ('accepted', 'rejected', 'expired'))
  ) OR p_status IS NULL THEN
    RAISE EXCEPTION 'QUOTATION_STATUS_TRANSITION_INVALID';
  END IF;

  IF p_status = 'accepted' THEN
    IF jsonb_typeof(p_waiver_paths) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'ACCEPTANCE_WAIVER_REQUIRED';
    END IF;
    SELECT jsonb_agg(jsonb_build_object(
      'storagePath', path,
      'fileName', regexp_replace(path, '^.*/', ''),
      'mimeType', CASE WHEN lower(path) LIKE '%.pdf' THEN 'application/pdf' ELSE 'image/jpeg' END,
      'fileSizeBytes', 0
    )) INTO v_waivers
    FROM jsonb_array_elements_text(p_waiver_paths) AS paths(path);

    PERFORM public.confirm_sales_quotation_transaction(
      p_quotation_id, NULL, p_accepted_by_name, p_accepted_channel, v_waivers
    );
  ELSE
    UPDATE public.sales_quotations
    SET status = p_status, updated_by = auth.uid(), updated_at = now()
    WHERE id = p_quotation_id;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.change_sales_quotation_status_transaction(uuid, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_sales_quotation_status_transaction(uuid, text, text, text, jsonb) TO authenticated;

COMMIT;
