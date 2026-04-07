CREATE OR REPLACE FUNCTION public.reverse_load_list_arrival(
  p_company_id UUID,
  p_load_list_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_load_list RECORD;
  v_grn RECORD;
  v_activity_count INTEGER := 0;
BEGIN
  SELECT id, status
  INTO v_load_list
  FROM public.load_lists
  WHERE id = p_load_list_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Load list not found';
  END IF;

  IF v_load_list.status <> 'arrived' THEN
    RAISE EXCEPTION 'Only arrived load lists can be reversed to in transit';
  END IF;

  SELECT id, status
  INTO v_grn
  FROM public.grns
  WHERE load_list_id = p_load_list_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    IF v_grn.status <> 'draft' THEN
      RAISE EXCEPTION 'Cannot reverse arrival after receiving has started';
    END IF;

    SELECT COUNT(*)
    INTO v_activity_count
    FROM public.grn_items
    WHERE grn_id = v_grn.id
      AND (
        COALESCE(received_qty, 0) > 0
        OR COALESCE(damaged_qty, 0) > 0
        OR COALESCE(num_boxes, 0) > 0
        OR COALESCE(barcodes_printed, false) = true
      );

    IF v_activity_count > 0 THEN
      RAISE EXCEPTION 'Cannot reverse arrival after GRN receiving activity exists';
    END IF;

    -- Hard delete is intentional here: grns.load_list_id has a non-partial
    -- unique constraint, so a soft-deleted auto-GRN would block re-arrival.
    DELETE FROM public.grns
    WHERE id = v_grn.id
      AND company_id = p_company_id;
  END IF;

  UPDATE public.load_lists
  SET status = 'in_transit',
      actual_arrival_date = NULL,
      updated_by = p_user_id,
      updated_at = now()
  WHERE id = p_load_list_id
    AND company_id = p_company_id
    AND deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_load_list_arrival(UUID, UUID, UUID) TO authenticated;
