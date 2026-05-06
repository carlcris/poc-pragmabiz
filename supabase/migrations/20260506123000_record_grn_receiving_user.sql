BEGIN;

ALTER FUNCTION public.approve_grn_with_batch_inventory(UUID, UUID, UUID, TEXT)
  RENAME TO approve_grn_with_batch_inventory_apply_inventory;

CREATE OR REPLACE FUNCTION public.approve_grn_with_batch_inventory(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_tx_code TEXT;
  v_load_list_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT load_list_id
  INTO v_load_list_id
  FROM public.grns
  WHERE id = p_grn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;

  UPDATE public.grns
  SET
    received_by = COALESCE(received_by, p_user_id),
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = p_grn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
    AND received_by IS NULL;

  v_tx_code := public.approve_grn_with_batch_inventory_apply_inventory(
    p_company_id,
    p_user_id,
    p_grn_id,
    p_notes
  );

  IF v_load_list_id IS NOT NULL THEN
    UPDATE public.load_lists
    SET
      received_by = COALESCE(received_by, p_user_id),
      received_date = COALESCE(received_date, v_now),
      updated_by = p_user_id,
      updated_at = v_now
    WHERE id = v_load_list_id
      AND company_id = p_company_id
      AND deleted_at IS NULL;
  END IF;

  RETURN v_tx_code;
END;
$$;

COMMENT ON FUNCTION public.approve_grn_with_batch_inventory(UUID, UUID, UUID, TEXT) IS
  'Approves a GRN, records receiving user metadata, posts batch inventory, and marks the linked load list received.';

COMMIT;
