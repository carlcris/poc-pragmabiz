CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE SCHEMA IF NOT EXISTS activity_logging AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA activity_logging FROM PUBLIC, anon, authenticated;

CREATE TABLE public.user_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  request_id UUID NOT NULL,
  event_kind TEXT NOT NULL CHECK (event_kind IN ('request', 'business_operation')),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'anonymous')),
  user_id UUID,
  company_id UUID,
  business_unit_id UUID,
  source TEXT NOT NULL CHECK (source IN ('web', 'mobile', 'tablet', 'api', 'system')),
  http_method TEXT CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  route TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  entity_id TEXT,
  entity_ids JSONB,
  route_params JSONB,
  query_params JSONB,
  request_payload JSONB,
  outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'failed')),
  http_status INTEGER CHECK (http_status BETWEEN 100 AND 599),
  duration_ms INTEGER CHECK (duration_ms >= 0),
  error_code TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  PRIMARY KEY (occurred_at, id),
  CHECK (
    (actor_type = 'user' AND user_id IS NOT NULL)
    OR (actor_type IN ('system', 'anonymous'))
  ),
  CHECK (
    (event_kind = 'request' AND http_method IS NOT NULL AND route IS NOT NULL)
    OR event_kind = 'business_operation'
  )
) PARTITION BY RANGE (occurred_at);

COMMENT ON TABLE public.user_activity_logs IS
  'Append-only internal activity records retained for 90 days';
COMMENT ON COLUMN public.user_activity_logs.request_payload IS
  'Sanitized and size-bounded mutation payload; never contains response data';

CREATE INDEX user_activity_logs_company_occurred_idx
  ON public.user_activity_logs (company_id, occurred_at DESC);
CREATE INDEX user_activity_logs_user_occurred_idx
  ON public.user_activity_logs (user_id, occurred_at DESC);
CREATE INDEX user_activity_logs_resource_entity_occurred_idx
  ON public.user_activity_logs (resource_type, entity_id, occurred_at DESC);
CREATE INDEX user_activity_logs_action_occurred_idx
  ON public.user_activity_logs (action, occurred_at DESC);
CREATE INDEX user_activity_logs_failed_occurred_idx
  ON public.user_activity_logs (occurred_at DESC)
  WHERE outcome = 'failed';
CREATE INDEX user_activity_logs_request_idx
  ON public.user_activity_logs (request_id);

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_activity_logs FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_user_activity_log_partitions(
  p_months_before INTEGER DEFAULT 3,
  p_months_ahead INTEGER DEFAULT 4
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month DATE;
  v_end_month DATE;
  v_partition_name TEXT;
BEGIN
  IF p_months_before < 0 OR p_months_before > 12
     OR p_months_ahead < 1 OR p_months_ahead > 24 THEN
    RAISE EXCEPTION 'Invalid activity-log partition window';
  END IF;

  v_month := (date_trunc('month', CURRENT_DATE) - make_interval(months => p_months_before))::DATE;
  v_end_month := (date_trunc('month', CURRENT_DATE) + make_interval(months => p_months_ahead))::DATE;

  WHILE v_month <= v_end_month LOOP
    v_partition_name := 'user_activity_logs_' || to_char(v_month, 'YYYYMM');

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS activity_logging.%I PARTITION OF public.user_activity_logs
       FOR VALUES FROM (%L) TO (%L)',
      v_partition_name,
      v_month::TIMESTAMPTZ,
      (v_month + INTERVAL '1 month')::TIMESTAMPTZ
    );

    v_month := (v_month + INTERVAL '1 month')::DATE;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.maintain_user_activity_logs(
  p_retention_days INTEGER DEFAULT 90,
  p_delete_batch_size INTEGER DEFAULT 10000
)
RETURNS TABLE (dropped_partitions INTEGER, deleted_rows INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partition RECORD;
  v_partition_month DATE;
  v_cutoff TIMESTAMPTZ;
  v_deleted INTEGER := 0;
  v_dropped INTEGER := 0;
BEGIN
  IF p_retention_days < 1 OR p_retention_days > 3650 THEN
    RAISE EXCEPTION 'Invalid activity-log retention period';
  END IF;

  IF p_delete_batch_size < 1 OR p_delete_batch_size > 100000 THEN
    RAISE EXCEPTION 'Invalid activity-log deletion batch size';
  END IF;

  PERFORM public.ensure_user_activity_log_partitions();
  v_cutoff := clock_timestamp() - make_interval(days => p_retention_days);

  FOR v_partition IN
    SELECT
      child.relname AS partition_name,
      child_namespace.nspname AS partition_schema
    FROM pg_inherits inheritance
    JOIN pg_class parent ON parent.oid = inheritance.inhparent
    JOIN pg_namespace parent_namespace ON parent_namespace.oid = parent.relnamespace
    JOIN pg_class child ON child.oid = inheritance.inhrelid
    JOIN pg_namespace child_namespace ON child_namespace.oid = child.relnamespace
    WHERE parent_namespace.nspname = 'public'
      AND parent.relname = 'user_activity_logs'
      AND child.relname ~ '^user_activity_logs_[0-9]{6}$'
  LOOP
    v_partition_month := to_date(right(v_partition.partition_name, 6), 'YYYYMM');

    IF v_partition_month + INTERVAL '1 month' <= v_cutoff THEN
      EXECUTE format(
        'DROP TABLE %I.%I',
        v_partition.partition_schema,
        v_partition.partition_name
      );
      v_dropped := v_dropped + 1;
    END IF;
  END LOOP;

  WITH expired AS (
    SELECT tableoid, ctid
    FROM public.user_activity_logs
    WHERE occurred_at < v_cutoff
    ORDER BY occurred_at
    LIMIT p_delete_batch_size
  )
  DELETE FROM public.user_activity_logs logs
  USING expired
  WHERE logs.tableoid = expired.tableoid
    AND logs.ctid = expired.ctid;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN QUERY SELECT v_dropped, v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.append_user_activity_log(p_event JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_occurred_at TIMESTAMPTZ := COALESCE(
    NULLIF(p_event->>'occurred_at', '')::TIMESTAMPTZ,
    clock_timestamp()
  );
BEGIN
  IF p_event IS NULL OR jsonb_typeof(p_event) <> 'object' THEN
    RAISE EXCEPTION 'Activity event must be a JSON object';
  END IF;

  INSERT INTO public.user_activity_logs (
    occurred_at,
    request_id,
    event_kind,
    actor_type,
    user_id,
    company_id,
    business_unit_id,
    source,
    http_method,
    route,
    action,
    resource_type,
    entity_id,
    entity_ids,
    route_params,
    query_params,
    request_payload,
    outcome,
    http_status,
    duration_ms,
    error_code,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    v_occurred_at,
    (p_event->>'request_id')::UUID,
    p_event->>'event_kind',
    p_event->>'actor_type',
    NULLIF(p_event->>'user_id', '')::UUID,
    NULLIF(p_event->>'company_id', '')::UUID,
    NULLIF(p_event->>'business_unit_id', '')::UUID,
    p_event->>'source',
    NULLIF(p_event->>'http_method', ''),
    NULLIF(p_event->>'route', ''),
    p_event->>'action',
    p_event->>'resource_type',
    NULLIF(p_event->>'entity_id', ''),
    p_event->'entity_ids',
    p_event->'route_params',
    p_event->'query_params',
    p_event->'request_payload',
    p_event->>'outcome',
    NULLIF(p_event->>'http_status', '')::INTEGER,
    NULLIF(p_event->>'duration_ms', '')::INTEGER,
    NULLIF(p_event->>'error_code', ''),
    left(NULLIF(p_event->>'ip_address', ''), 128),
    left(NULLIF(p_event->>'user_agent', ''), 512),
    COALESCE(p_event->'metadata', '{}'::JSONB)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_activity_log_partitions(INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.maintain_user_activity_logs(INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.append_user_activity_log(JSONB)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_user_activity_log_partitions(INTEGER, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.maintain_user_activity_logs(INTEGER, INTEGER)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.append_user_activity_log(JSONB)
  TO service_role;

SELECT public.ensure_user_activity_log_partitions();

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'user-activity-log-maintenance';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'user-activity-log-maintenance',
    '15 3 * * *',
    'SELECT public.maintain_user_activity_logs(90, 10000);'
  );
END;
$$;
