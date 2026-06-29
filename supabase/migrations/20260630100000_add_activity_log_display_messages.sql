ALTER TABLE public.user_activity_logs
  ADD COLUMN actor_label TEXT,
  ADD COLUMN entity_code TEXT,
  ADD COLUMN entity_label TEXT,
  ADD COLUMN message_key TEXT NOT NULL DEFAULT 'activity.unknown',
  ADD COLUMN display_message TEXT NOT NULL DEFAULT 'Activity recorded.',
  ADD CONSTRAINT user_activity_logs_actor_label_length
    CHECK (actor_label IS NULL OR char_length(actor_label) <= 255),
  ADD CONSTRAINT user_activity_logs_entity_code_length
    CHECK (entity_code IS NULL OR char_length(entity_code) <= 100),
  ADD CONSTRAINT user_activity_logs_entity_label_length
    CHECK (entity_label IS NULL OR char_length(entity_label) <= 255),
  ADD CONSTRAINT user_activity_logs_message_key_length
    CHECK (char_length(message_key) BETWEEN 1 AND 160),
  ADD CONSTRAINT user_activity_logs_display_message_length
    CHECK (char_length(display_message) BETWEEN 1 AND 1000);

COMMENT ON COLUMN public.user_activity_logs.actor_label IS
  'Historical display snapshot of the actor; does not replace user_id';
COMMENT ON COLUMN public.user_activity_logs.entity_code IS
  'Historical business code snapshot for the affected entity';
COMMENT ON COLUMN public.user_activity_logs.entity_label IS
  'Historical display-name snapshot for the affected entity';
COMMENT ON COLUMN public.user_activity_logs.message_key IS
  'Stable presentation key for future report or UI rendering';
COMMENT ON COLUMN public.user_activity_logs.display_message IS
  'Safe human-readable activity summary generated from allowlisted context';

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
    actor_label,
    company_id,
    business_unit_id,
    source,
    http_method,
    route,
    action,
    resource_type,
    entity_id,
    entity_ids,
    entity_code,
    entity_label,
    message_key,
    display_message,
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
    left(NULLIF(p_event->>'actor_label', ''), 255),
    NULLIF(p_event->>'company_id', '')::UUID,
    NULLIF(p_event->>'business_unit_id', '')::UUID,
    p_event->>'source',
    NULLIF(p_event->>'http_method', ''),
    NULLIF(p_event->>'route', ''),
    p_event->>'action',
    p_event->>'resource_type',
    NULLIF(p_event->>'entity_id', ''),
    p_event->'entity_ids',
    left(NULLIF(p_event->>'entity_code', ''), 100),
    left(NULLIF(p_event->>'entity_label', ''), 255),
    left(COALESCE(NULLIF(p_event->>'message_key', ''), 'activity.unknown'), 160),
    left(COALESCE(NULLIF(p_event->>'display_message', ''), 'Activity recorded.'), 1000),
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

REVOKE ALL ON FUNCTION public.append_user_activity_log(JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_user_activity_log(JSONB)
  TO service_role;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims JSONB;
  v_user_id UUID;
  current_bu_id UUID;
  selected_bu_id UUID;
  default_bu_id UUID;
  company_id_value UUID;
  first_name_value TEXT;
  last_name_value TEXT;
  username_value TEXT;
  email_value TEXT;
  actor_label_value TEXT;
BEGIN
  claims := event->'claims';
  v_user_id := (event->>'user_id')::UUID;

  -- Reuse the existing profile lookup to add both tenant and display context.
  SELECT
    company_id,
    first_name,
    last_name,
    username,
    email
  INTO
    company_id_value,
    first_name_value,
    last_name_value,
    username_value,
    email_value
  FROM public.users
  WHERE id = v_user_id
  LIMIT 1;

  IF company_id_value IS NOT NULL THEN
    claims := jsonb_set(claims, '{company_id}', to_jsonb(company_id_value::TEXT));
  END IF;

  actor_label_value := COALESCE(
    NULLIF(btrim(concat_ws(' ', first_name_value, last_name_value)), ''),
    NULLIF(btrim(username_value), ''),
    NULLIF(btrim(email_value), '')
  );

  IF actor_label_value IS NOT NULL THEN
    claims := jsonb_set(claims, '{actor_label}', to_jsonb(actor_label_value));
  END IF;

  SELECT business_unit_id
  INTO selected_bu_id
  FROM public.user_business_unit_access
  WHERE user_id = v_user_id
    AND is_current = true
  LIMIT 1;

  SELECT business_unit_id
  INTO default_bu_id
  FROM public.user_business_unit_access
  WHERE user_id = v_user_id
    AND is_default = true
  LIMIT 1;

  current_bu_id := COALESCE(
    selected_bu_id,
    (claims->>'current_business_unit_id')::UUID,
    default_bu_id
  );

  IF current_bu_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{current_business_unit_id}', to_jsonb(current_bu_id::TEXT));
  END IF;

  IF default_bu_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{default_business_unit_id}', to_jsonb(default_bu_id::TEXT));
  END IF;

  claims := jsonb_set(
    claims,
    '{accessible_business_units}',
    (
      SELECT COALESCE(jsonb_agg(business_unit_id), '[]'::JSONB)
      FROM public.user_business_unit_access
      WHERE user_id = v_user_id
    )
  );

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
EXCEPTION
  WHEN OTHERS THEN
    -- Authentication must continue if optional claim enrichment fails.
    RETURN event;
END;
$$;

COMMENT ON FUNCTION public.custom_access_token_hook(JSONB) IS
  'Injects tenant, business-unit, and actor display context into signed JWT claims';
