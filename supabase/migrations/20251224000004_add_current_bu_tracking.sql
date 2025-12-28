-- Add current_business_unit_id to user_business_unit_access to track selected BU
-- This allows the auth hook to know which BU the user last selected

ALTER TABLE user_business_unit_access
ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT FALSE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_bu_access_current
ON user_business_unit_access(user_id, is_current)
WHERE is_current = true;

-- Ensure only one current BU per user
CREATE OR REPLACE FUNCTION ensure_single_current_bu()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    -- Set all other BUs for this user to not current
    UPDATE user_business_unit_access
    SET is_current = false
    WHERE user_id = NEW.user_id
      AND business_unit_id != NEW.business_unit_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_current_bu ON user_business_unit_access;
CREATE TRIGGER trigger_ensure_single_current_bu
  BEFORE INSERT OR UPDATE ON user_business_unit_access
  FOR EACH ROW
  WHEN (NEW.is_current = true)
  EXECUTE FUNCTION ensure_single_current_bu();

-- Update existing records: set default BU as current for each user
UPDATE user_business_unit_access
SET is_current = is_default
WHERE is_default = true;

-- Update the auth hook to read from is_current
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
BEGIN
  claims := event->'claims';
  v_user_id := (event->>'user_id')::UUID;

  -- Try to get current BU from user's selected BU (is_current = true)
  SELECT business_unit_id INTO selected_bu_id
  FROM user_business_unit_access
  WHERE user_id = v_user_id
    AND is_current = true
  LIMIT 1;

  -- Use selected BU if found, otherwise try existing claim, otherwise use default
  current_bu_id := COALESCE(
    selected_bu_id,
    (claims->>'current_business_unit_id')::UUID,
    (SELECT business_unit_id FROM user_business_unit_access
     WHERE user_id = v_user_id AND is_default = true LIMIT 1)
  );

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

-- Update update_current_business_unit to set is_current flag
CREATE OR REPLACE FUNCTION update_current_business_unit(p_business_unit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_business_unit RECORD;
  v_has_access BOOLEAN;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Check if user has access to this business unit
  SELECT EXISTS (
    SELECT 1 FROM user_business_unit_access
    WHERE user_id = v_user_id
      AND business_unit_id = p_business_unit_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'User does not have access to business unit %', p_business_unit_id;
  END IF;

  -- Get business unit details
  SELECT * INTO v_business_unit
  FROM business_units
  WHERE id = p_business_unit_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business unit not found: %', p_business_unit_id;
  END IF;

  -- Update is_current flag (trigger will handle unsetting others)
  UPDATE user_business_unit_access
  SET is_current = true
  WHERE user_id = v_user_id
    AND business_unit_id = p_business_unit_id;

  -- Return success with BU details
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Business unit context updated',
    'requires_refresh', true,
    'business_unit', jsonb_build_object(
      'id', v_business_unit.id,
      'code', v_business_unit.code,
      'name', v_business_unit.name,
      'type', v_business_unit.type
    )
  );
END;
$$;

COMMENT ON FUNCTION update_current_business_unit IS 'Updates the current business unit for a user and signals that session refresh is required';
