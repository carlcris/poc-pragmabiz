-- Add company_id/default_business_unit_id claims to JWT for server request context
-- This reduces repeated users/company lookups in API routes while keeping BU switching behavior.

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
BEGIN
  claims := event->'claims';
  v_user_id := (event->>'user_id')::UUID;

  -- Resolve company claim
  SELECT company_id INTO company_id_value
  FROM users
  WHERE id = v_user_id
  LIMIT 1;

  IF company_id_value IS NOT NULL THEN
    claims := jsonb_set(claims, '{company_id}', to_jsonb(company_id_value::text));
  END IF;

  -- Resolve selected/default BU
  SELECT business_unit_id INTO selected_bu_id
  FROM user_business_unit_access
  WHERE user_id = v_user_id
    AND is_current = true
  LIMIT 1;

  SELECT business_unit_id INTO default_bu_id
  FROM user_business_unit_access
  WHERE user_id = v_user_id
    AND is_default = true
  LIMIT 1;

  current_bu_id := COALESCE(
    selected_bu_id,
    (claims->>'current_business_unit_id')::UUID,
    default_bu_id
  );

  IF current_bu_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{current_business_unit_id}', to_jsonb(current_bu_id::text));
  END IF;

  IF default_bu_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{default_business_unit_id}', to_jsonb(default_bu_id::text));
  END IF;

  -- Add accessible BU list
  claims := jsonb_set(
    claims,
    '{accessible_business_units}',
    (
      SELECT COALESCE(jsonb_agg(business_unit_id), '[]'::jsonb)
      FROM user_business_unit_access
      WHERE user_id = v_user_id
    )
  );

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block auth token issuance
    RETURN event;
END;
$$;
