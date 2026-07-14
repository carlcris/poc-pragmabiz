BEGIN;

ALTER TABLE public.grns
DROP CONSTRAINT chk_grn_status;

ALTER TABLE public.grns
ADD CONSTRAINT chk_grn_status
CHECK (status IN ('draft', 'receiving', 'paused', 'pending_approval', 'approved', 'rejected'));

COMMENT ON COLUMN public.grns.status IS
  'Status: draft, receiving, paused, pending_approval, approved, rejected';

CREATE OR REPLACE FUNCTION public.start_grn_receiving(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_grn_business_unit_id UUID;
  v_grn_load_list_id UUID;
  v_grn_status VARCHAR;
  v_load_list_id UUID;
  v_load_list_status VARCHAR;
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

  SELECT g.business_unit_id, g.load_list_id, g.status
  INTO v_grn_business_unit_id, v_grn_load_list_id, v_grn_status
  FROM public.grns g
  WHERE g.id = p_grn_id
    AND g.company_id = p_company_id
    AND g.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes',
    'view',
    v_grn_business_unit_id
  ) OR NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes.operation.start_receiving.edit',
    'edit',
    v_grn_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_grn_status NOT IN ('draft', 'receiving', 'paused') THEN
    RAISE EXCEPTION 'Only draft or paused GRNs can start receiving';
  END IF;

  IF v_grn_load_list_id IS NOT NULL THEN
    SELECT ll.id, ll.status
    INTO v_load_list_id, v_load_list_status
    FROM public.load_lists ll
    WHERE ll.id = v_grn_load_list_id
      AND ll.company_id = p_company_id
      AND ll.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Load list not found';
    END IF;

    IF v_load_list_status NOT IN ('arrived', 'receiving') THEN
      RAISE EXCEPTION 'Only arrived or receiving load lists can start receiving';
    END IF;

    IF v_load_list_status = 'arrived' THEN
      UPDATE public.load_lists
      SET
        status = 'receiving',
        updated_by = p_user_id,
        updated_at = NOW()
      WHERE id = v_load_list_id
        AND company_id = p_company_id;
    END IF;
  END IF;

  IF v_grn_status <> 'receiving' THEN
    UPDATE public.grns
    SET
      status = 'receiving',
      received_by = COALESCE(received_by, p_user_id),
      receiving_date = COALESCE(receiving_date, CURRENT_DATE),
      updated_by = p_user_id,
      updated_at = NOW()
    WHERE id = p_grn_id
      AND company_id = p_company_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.start_grn_receiving(UUID, UUID, UUID) IS
  'Atomically starts or resumes GRN receiving while preserving a linked load list that is already receiving.';

CREATE OR REPLACE FUNCTION public.pause_grn_receiving(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_grn_business_unit_id UUID;
  v_grn_status VARCHAR;
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

  SELECT g.business_unit_id, g.status
  INTO v_grn_business_unit_id, v_grn_status
  FROM public.grns g
  WHERE g.id = p_grn_id
    AND g.company_id = p_company_id
    AND g.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes',
    'view',
    v_grn_business_unit_id
  ) OR NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes.operation.start_receiving.edit',
    'edit',
    v_grn_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_grn_status <> 'receiving' THEN
    RAISE EXCEPTION 'Only receiving GRNs can be paused';
  END IF;

  UPDATE public.grns
  SET
    status = 'paused',
    updated_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_grn_id
    AND company_id = p_company_id;
END;
$$;

COMMENT ON FUNCTION public.pause_grn_receiving(UUID, UUID, UUID) IS
  'Atomically pauses a receiving GRN without changing the linked load-list receiving status.';

COMMIT;
