-- Fix ensure_single_current_bu trigger function to use correct column reference
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

COMMENT ON FUNCTION ensure_single_current_bu IS 'Ensures only one business unit is marked as current for each user. Fixed to use business_unit_id instead of id.';
