-- Bind SECURITY DEFINER reorder acknowledgment RPCs to the authenticated user.

BEGIN;

CREATE OR REPLACE FUNCTION public.acknowledge_reorder_alerts(
  p_company_id UUID,
  p_alert_ids UUID[],
  p_acknowledged_by UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  acknowledged_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acknowledged_count INTEGER := 0;
  v_auth_user_id UUID := auth.uid();
  v_auth_company_id UUID;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company id is required';
  END IF;

  IF p_acknowledged_by IS NULL THEN
    RAISE EXCEPTION 'acknowledged by is required';
  END IF;

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user is required';
  END IF;

  IF p_acknowledged_by IS DISTINCT FROM v_auth_user_id THEN
    RAISE EXCEPTION 'acknowledged by must match authenticated user';
  END IF;

  SELECT users.company_id
  INTO v_auth_company_id
  FROM public.users
  WHERE users.id = v_auth_user_id
    AND users.deleted_at IS NULL
  LIMIT 1;

  IF v_auth_company_id IS NULL OR v_auth_company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'company scope mismatch';
  END IF;

  IF p_alert_ids IS NULL OR array_length(p_alert_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  CREATE TEMP TABLE tmp_reorder_alert_acknowledgments ON COMMIT DROP AS
  SELECT *
  FROM public.get_effective_reorder_alerts(
    p_company_id,
    p_as_of_date,
    NULL,
    NULL,
    1,
    100,
    'all'
  ) alerts
  WHERE alerts.id = ANY(p_alert_ids);

  UPDATE public.reorder_alert_acknowledgments raa
  SET
    deleted_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = p_acknowledged_by
  WHERE raa.company_id = p_company_id
    AND raa.deleted_at IS NULL
    AND raa.item_id IN (
      SELECT current_alerts.item_id
      FROM tmp_reorder_alert_acknowledgments current_alerts
    );

  INSERT INTO public.reorder_alert_acknowledgments (
    company_id,
    item_id,
    policy_source,
    season_id,
    reorder_point,
    reorder_quantity,
    minimum_level,
    severity,
    acknowledged_available_stock,
    acknowledged_by,
    updated_by
  )
  SELECT
    p_company_id,
    current_alerts.item_id,
    current_alerts.policy_source,
    current_alerts.season_id,
    current_alerts.reorder_point,
    current_alerts.reorder_quantity,
    current_alerts.minimum_level,
    current_alerts.severity,
    current_alerts.total_available_stock,
    p_acknowledged_by,
    p_acknowledged_by
  FROM tmp_reorder_alert_acknowledgments current_alerts;

  GET DIAGNOSTICS v_acknowledged_count = ROW_COUNT;

  RETURN QUERY SELECT v_acknowledged_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.unacknowledge_reorder_alerts(
  p_company_id UUID,
  p_alert_ids UUID[],
  p_unacknowledged_by UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  unacknowledged_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unacknowledged_count INTEGER := 0;
  v_auth_user_id UUID := auth.uid();
  v_auth_company_id UUID;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company id is required';
  END IF;

  IF p_unacknowledged_by IS NULL THEN
    RAISE EXCEPTION 'restored by is required';
  END IF;

  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user is required';
  END IF;

  IF p_unacknowledged_by IS DISTINCT FROM v_auth_user_id THEN
    RAISE EXCEPTION 'restored by must match authenticated user';
  END IF;

  SELECT users.company_id
  INTO v_auth_company_id
  FROM public.users
  WHERE users.id = v_auth_user_id
    AND users.deleted_at IS NULL
  LIMIT 1;

  IF v_auth_company_id IS NULL OR v_auth_company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'company scope mismatch';
  END IF;

  IF p_alert_ids IS NULL OR array_length(p_alert_ids, 1) IS NULL THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  CREATE TEMP TABLE tmp_reorder_alert_unacknowledgments ON COMMIT DROP AS
  SELECT *
  FROM public.get_effective_reorder_alerts(
    p_company_id,
    p_as_of_date,
    NULL,
    NULL,
    1,
    100,
    'acknowledged'
  ) alerts
  WHERE alerts.id = ANY(p_alert_ids);

  UPDATE public.reorder_alert_acknowledgments raa
  SET
    deleted_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = p_unacknowledged_by
  FROM tmp_reorder_alert_unacknowledgments current_alerts
  WHERE raa.id = current_alerts.acknowledgment_id
    AND raa.company_id = p_company_id
    AND raa.deleted_at IS NULL;

  GET DIAGNOSTICS v_unacknowledged_count = ROW_COUNT;

  RETURN QUERY SELECT v_unacknowledged_count;
END;
$$;

REVOKE ALL ON FUNCTION public.acknowledge_reorder_alerts(UUID, UUID[], UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unacknowledge_reorder_alerts(UUID, UUID[], UUID, DATE) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.acknowledge_reorder_alerts(UUID, UUID[], UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unacknowledge_reorder_alerts(UUID, UUID[], UUID, DATE) TO authenticated;

COMMIT;
