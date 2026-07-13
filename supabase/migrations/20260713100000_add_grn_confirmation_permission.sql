BEGIN;

INSERT INTO public.permissions (
  resource,
  parent_resource,
  surface,
  capability_key,
  capability_action,
  label,
  permission_group,
  description,
  is_granular,
  can_view,
  can_create,
  can_edit,
  can_delete
)
VALUES (
  'goods_receipt_notes.operation.confirm_receiving.edit',
  'goods_receipt_notes',
  'operation',
  'confirm_receiving',
  'edit',
  'Confirm GRN Receiving',
  'GRN Receiving Operations',
  'Allows confirming a submitted GRN and completing its linked load list receipt.',
  TRUE,
  FALSE,
  FALSE,
  TRUE,
  FALSE
)
ON CONFLICT (resource) DO UPDATE
SET
  parent_resource = EXCLUDED.parent_resource,
  surface = EXCLUDED.surface,
  capability_key = EXCLUDED.capability_key,
  capability_action = EXCLUDED.capability_action,
  label = EXCLUDED.label,
  permission_group = EXCLUDED.permission_group,
  description = EXCLUDED.description,
  is_granular = TRUE,
  can_view = FALSE,
  can_create = FALSE,
  can_edit = TRUE,
  can_delete = FALSE,
  updated_at = NOW();

-- Preserve confirmation access for roles that already had broad GRN edit access,
-- while keeping warehouse-only Picker and Stockman roles opt-in for this operation.
INSERT INTO public.role_permissions (
  role_id,
  permission_id,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  r.id,
  confirmation_permission.id,
  FALSE,
  FALSE,
  TRUE,
  FALSE
FROM public.roles r
CROSS JOIN public.permissions confirmation_permission
WHERE r.deleted_at IS NULL
  AND confirmation_permission.resource = 'goods_receipt_notes.operation.confirm_receiving.edit'
  AND LOWER(BTRIM(r.name)) NOT IN ('picker', 'stockman')
  AND (
    LOWER(BTRIM(r.name)) IN ('super admin', 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.role_permissions existing_role_permission
      JOIN public.permissions existing_permission
        ON existing_permission.id = existing_role_permission.permission_id
      WHERE existing_role_permission.role_id = r.id
        AND existing_permission.resource = 'goods_receipt_notes'
        AND existing_permission.deleted_at IS NULL
        AND existing_role_permission.can_edit IS TRUE
    )
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = FALSE,
  can_create = FALSE,
  can_edit = TRUE,
  can_delete = FALSE;

CREATE OR REPLACE FUNCTION public.confirm_grn_with_putaway(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_grn_id UUID;
  v_grn_business_unit_id UUID;
  v_grn_load_list_id UUID;
  v_grn_status TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_tx_code TEXT;
BEGIN
  IF v_auth_user_id IS NULL OR v_auth_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT u.company_id
  INTO v_user_company_id
  FROM public.users u
  WHERE u.id = v_auth_user_id
    AND u.deleted_at IS NULL
    AND u.is_active IS TRUE;

  IF v_user_company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT g.id, g.business_unit_id, g.load_list_id, g.status
  INTO v_grn_id, v_grn_business_unit_id, v_grn_load_list_id, v_grn_status
  FROM public.grns g
  WHERE g.id = p_grn_id
    AND g.company_id = p_company_id
    AND g.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;

  IF v_grn_status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only GRNs in pending confirmation can be confirmed';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes',
    'view',
    v_grn_business_unit_id
  ) OR NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes.operation.confirm_receiving.edit',
    'edit',
    v_grn_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT st.transaction_code
  INTO v_tx_code
  FROM public.stock_transactions st
  WHERE st.company_id = p_company_id
    AND st.reference_type = 'grn'
    AND st.reference_id = v_grn_id
    AND st.deleted_at IS NULL
  ORDER BY st.created_at ASC
  LIMIT 1;

  IF v_tx_code IS NULL THEN
    RAISE EXCEPTION 'GRN must be submitted before confirmation';
  END IF;

  UPDATE public.grns
  SET status = 'approved',
      checked_by = p_user_id,
      received_by = COALESCE(received_by, p_user_id),
      updated_by = p_user_id,
      updated_at = v_now
  WHERE id = v_grn_id;

  IF v_grn_load_list_id IS NOT NULL THEN
    PERFORM public.recalculate_stock_requisition_fulfillment_for_load_list(
      p_company_id,
      v_grn_load_list_id
    );

    UPDATE public.load_lists
    SET status = 'received',
        received_by = COALESCE(received_by, p_user_id),
        received_date = COALESCE(received_date, v_now),
        updated_by = p_user_id,
        updated_at = v_now
    WHERE id = v_grn_load_list_id
      AND company_id = p_company_id
      AND deleted_at IS NULL;
  END IF;

  RETURN v_tx_code;
END;
$$;

COMMENT ON FUNCTION public.confirm_grn_with_putaway(UUID, UUID, UUID, TEXT) IS
  'Confirms a submitted GRN and completes its linked load-list receipt for users with the granular confirmation capability.';

COMMIT;
