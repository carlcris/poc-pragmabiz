-- Fix auth hook scoping issue
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
  default_bu_id UUID;
BEGIN
  claims := event->'claims';
  v_user_id := (event->>'user_id')::UUID;

  -- Try to get current BU from existing claims
  current_bu_id := (claims->>'current_business_unit_id')::UUID;

  -- If no current BU in claims, get user's default
  IF current_bu_id IS NULL THEN
    SELECT business_unit_id INTO default_bu_id
    FROM user_business_unit_access
    WHERE user_id = v_user_id
      AND is_default = true
    LIMIT 1;

    current_bu_id := default_bu_id;
  END IF;

  -- Add the current_business_unit_id to JWT claims
  IF current_bu_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{current_business_unit_id}', to_jsonb(current_bu_id::text));
  END IF;

  -- Add accessible business units list
  claims := jsonb_set(
    claims,
    '{accessible_business_units}',
    (
      SELECT COALESCE(jsonb_agg(business_unit_id), '[]'::jsonb)
      FROM user_business_unit_access
      WHERE user_id = v_user_id
    )
  );

  -- Return modified event
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;

EXCEPTION
  WHEN OTHERS THEN
    -- Return original event to prevent auth failure
    RETURN event;
END;
$$;

COMMENT ON FUNCTION public.custom_access_token_hook IS 'Custom access token hook that injects business unit context into JWT claims with fixed scoping.';
