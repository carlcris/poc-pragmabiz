-- Atomic item custom-field mutations.
-- These functions lock the item row before changing custom_fields so concurrent edits
-- cannot overwrite unrelated keys.

CREATE OR REPLACE FUNCTION public.upsert_item_custom_field(
  p_item_id UUID,
  p_key TEXT,
  p_value TEXT,
  p_original_key TEXT DEFAULT NULL,
  p_updated_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_custom_fields JSONB;
  v_key TEXT;
  v_original_key TEXT;
BEGIN
  v_key := NULLIF(BTRIM(p_key), '');
  v_original_key := NULLIF(BTRIM(p_original_key), '');

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Custom field key is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(custom_fields, '{}'::JSONB)
  INTO v_custom_fields
  FROM public.items
  WHERE id = p_item_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_custom_fields ? v_key AND COALESCE(v_original_key, v_key) <> v_key THEN
    RAISE EXCEPTION 'Custom field key already exists'
      USING ERRCODE = '23505';
  END IF;

  IF v_original_key IS NOT NULL AND v_original_key <> v_key THEN
    v_custom_fields := v_custom_fields - v_original_key;
  END IF;

  v_custom_fields := jsonb_set(v_custom_fields, ARRAY[v_key], to_jsonb(COALESCE(p_value, '')), TRUE);

  UPDATE public.items
  SET
    custom_fields = v_custom_fields,
    updated_by = p_updated_by,
    updated_at = NOW()
  WHERE id = p_item_id;

  RETURN v_custom_fields;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_item_custom_field(
  p_item_id UUID,
  p_key TEXT,
  p_updated_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_custom_fields JSONB;
  v_key TEXT;
BEGIN
  v_key := NULLIF(BTRIM(p_key), '');

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Custom field key is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(custom_fields, '{}'::JSONB)
  INTO v_custom_fields
  FROM public.items
  WHERE id = p_item_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found'
      USING ERRCODE = 'P0002';
  END IF;

  v_custom_fields := v_custom_fields - v_key;

  UPDATE public.items
  SET
    custom_fields = v_custom_fields,
    updated_by = p_updated_by,
    updated_at = NOW()
  WHERE id = p_item_id;

  RETURN v_custom_fields;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_item_custom_field(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_item_custom_field(UUID, TEXT, UUID) TO authenticated;
