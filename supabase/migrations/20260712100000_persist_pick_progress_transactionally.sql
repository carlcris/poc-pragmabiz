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
  'stock_requests.operation.view_only_assigned_pick_lists.view',
  'stock_requests',
  'operation',
  'view_only_assigned_pick_lists',
  'view',
  'View Only Assigned Pick Lists',
  'Pick List Operations',
  'When enabled, limits pick-list access to rows assigned to the current user. When disabled, the user can access all pick lists in the current business unit allowed by the parent permission.',
  TRUE,
  TRUE,
  FALSE,
  FALSE,
  FALSE
)
ON CONFLICT (resource) DO UPDATE
SET parent_resource = EXCLUDED.parent_resource,
    surface = EXCLUDED.surface,
    capability_key = EXCLUDED.capability_key,
    capability_action = EXCLUDED.capability_action,
    label = EXCLUDED.label,
    permission_group = EXCLUDED.permission_group,
    description = EXCLUDED.description,
    is_granular = TRUE,
    can_view = TRUE,
    can_create = FALSE,
    can_edit = FALSE,
    can_delete = FALSE,
    updated_at = NOW();

INSERT INTO public.role_permissions (
  role_id,
  permission_id,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  role.id,
  permission.id,
  LOWER(BTRIM(role.name)) IN ('picker', 'stockman'),
  FALSE,
  FALSE,
  FALSE
FROM public.roles role
JOIN public.permissions permission
  ON permission.resource = 'stock_requests.operation.view_only_assigned_pick_lists.view'
WHERE role.deleted_at IS NULL
ON CONFLICT (role_id, permission_id) DO UPDATE
SET can_view = EXCLUDED.can_view,
    can_create = FALSE,
    can_edit = FALSE,
    can_delete = FALSE;

CREATE OR REPLACE FUNCTION public.user_can_view_pick_list(
  p_user_id UUID,
  p_company_id UUID,
  p_pick_list_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.pick_lists pick_list
    JOIN public.users actor
      ON actor.id = p_user_id
     AND actor.company_id = pick_list.company_id
     AND actor.deleted_at IS NULL
    WHERE pick_list.id = p_pick_list_id
      AND pick_list.company_id = p_company_id
      AND pick_list.deleted_at IS NULL
      AND pick_list.business_unit_id = public.get_current_business_unit_id()
      AND public.user_has_permission(
        p_user_id,
        'stock_requests',
        'view',
        pick_list.business_unit_id
      )
      AND (
        NOT public.user_has_permission(
          p_user_id,
          'stock_requests.operation.view_only_assigned_pick_lists.view',
          'view',
          pick_list.business_unit_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.pick_list_assignees assignee
          WHERE assignee.company_id = pick_list.company_id
            AND assignee.pick_list_id = pick_list.id
            AND assignee.user_id = p_user_id
        )
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.user_can_view_pick_list(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_view_pick_list(UUID, UUID, UUID) TO authenticated;

CREATE INDEX idx_pick_lists_company_business_unit_created
  ON public.pick_lists(company_id, business_unit_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS company_select ON public.pick_lists;
CREATE POLICY company_select ON public.pick_lists
  FOR SELECT TO authenticated
  USING (public.user_can_view_pick_list(auth.uid(), company_id, id));

DROP POLICY IF EXISTS company_select ON public.pick_list_assignees;
CREATE POLICY company_select ON public.pick_list_assignees
  FOR SELECT TO authenticated
  USING (public.user_can_view_pick_list(auth.uid(), company_id, pick_list_id));

DROP POLICY IF EXISTS company_select ON public.pick_list_items;
CREATE POLICY company_select ON public.pick_list_items
  FOR SELECT TO authenticated
  USING (public.user_can_view_pick_list(auth.uid(), company_id, pick_list_id));

CREATE TABLE public.pick_list_item_claims (
  pick_list_item_id UUID PRIMARY KEY REFERENCES public.pick_list_items(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  pick_list_id UUID NOT NULL REFERENCES public.pick_lists(id) ON DELETE CASCADE,
  claimed_by UUID NOT NULL REFERENCES public.users(id),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pick_list_item_claims_expiry_check CHECK (expires_at > claimed_at)
);

CREATE INDEX idx_pick_list_item_claims_pick_list
  ON public.pick_list_item_claims(company_id, pick_list_id, expires_at);

COMMENT ON TABLE public.pick_list_item_claims IS
  'Short renewable leases that prevent multiple assignees from picking the same pick-list line.';

ALTER TABLE public.pick_list_item_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pick_list_item_claims REPLICA IDENTITY FULL;

CREATE POLICY pick_list_item_claims_select ON public.pick_list_item_claims
  FOR SELECT TO authenticated
  USING (public.user_can_view_pick_list(auth.uid(), company_id, pick_list_id));

CREATE TABLE public.pick_list_item_pick_operations (
  operation_id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  pick_list_id UUID NOT NULL REFERENCES public.pick_lists(id) ON DELETE RESTRICT,
  pick_list_item_id UUID NOT NULL REFERENCES public.pick_list_items(id) ON DELETE RESTRICT,
  picker_user_id UUID NOT NULL REFERENCES public.users(id),
  picked_qty NUMERIC(20,2) NOT NULL CHECK (picked_qty > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pick_list_item_pick_operations_line
  ON public.pick_list_item_pick_operations(company_id, pick_list_item_id, created_at);

COMMENT ON TABLE public.pick_list_item_pick_operations IS
  'Idempotency ledger for incremental mobile pick confirmations.';

ALTER TABLE public.pick_list_item_pick_operations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_pick_list_item(
  p_company_id UUID,
  p_user_id UUID,
  p_pick_list_id UUID,
  p_pick_list_item_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_business_unit_id UUID;
  v_status public.pick_lists.status%TYPE;
  v_expires_at TIMESTAMPTZ := NOW() + INTERVAL '2 minutes';
  v_claimed BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'PICK_CLAIM_UNAUTHORIZED';
  END IF;

  SELECT business_unit_id, status
  INTO v_business_unit_id, v_status
  FROM public.pick_lists
  WHERE id = p_pick_list_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PICK_CLAIM_NOT_FOUND';
  END IF;

  IF v_status <> 'in_progress' THEN
    RAISE EXCEPTION 'PICK_CLAIM_NOT_ACTIVE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users users
    WHERE users.id = p_user_id
      AND users.company_id = p_company_id
      AND users.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'PICK_CLAIM_UNAUTHORIZED';
  END IF;

  IF (
    (auth.uid() IS NOT NULL AND v_business_unit_id IS DISTINCT FROM public.get_current_business_unit_id())
    OR
    NOT public.user_has_permission(
      p_user_id,
      'stock_requests',
      'edit',
      v_business_unit_id
    )
    OR (
      public.user_has_permission(
        p_user_id,
        'stock_requests.operation.view_only_assigned_pick_lists.view',
        'view',
        v_business_unit_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.pick_list_assignees assignee
        WHERE assignee.company_id = p_company_id
          AND assignee.pick_list_id = p_pick_list_id
          AND assignee.user_id = p_user_id
      )
    )
  ) THEN
    RAISE EXCEPTION 'PICK_CLAIM_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pick_list_items item
    WHERE item.id = p_pick_list_item_id
      AND item.company_id = p_company_id
      AND item.pick_list_id = p_pick_list_id
      AND item.picked_qty < item.allocated_qty
  ) THEN
    RAISE EXCEPTION 'PICK_CLAIM_LINE_NOT_AVAILABLE';
  END IF;

  INSERT INTO public.pick_list_item_claims (
    pick_list_item_id,
    company_id,
    pick_list_id,
    claimed_by,
    claimed_at,
    expires_at,
    updated_at
  )
  VALUES (
    p_pick_list_item_id,
    p_company_id,
    p_pick_list_id,
    p_user_id,
    NOW(),
    v_expires_at,
    NOW()
  )
  ON CONFLICT (pick_list_item_id) DO UPDATE
  SET claimed_by = EXCLUDED.claimed_by,
      claimed_at = EXCLUDED.claimed_at,
      expires_at = EXCLUDED.expires_at,
      released_at = NULL,
      updated_at = EXCLUDED.updated_at
  WHERE pick_list_item_claims.claimed_by = EXCLUDED.claimed_by
     OR pick_list_item_claims.released_at IS NOT NULL
     OR pick_list_item_claims.expires_at <= NOW()
  RETURNING TRUE INTO v_claimed;

  IF NOT COALESCE(v_claimed, FALSE) THEN
    RAISE EXCEPTION 'PICK_CLAIM_HELD_BY_OTHER';
  END IF;

  RETURN v_expires_at;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_pick_list_item_claim(
  p_company_id UUID,
  p_user_id UUID,
  p_pick_list_id UUID,
  p_pick_list_item_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_released BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'PICK_CLAIM_UNAUTHORIZED';
  END IF;

  UPDATE public.pick_list_item_claims
  SET released_at = NOW(),
      updated_at = NOW()
  WHERE company_id = p_company_id
    AND pick_list_id = p_pick_list_id
    AND pick_list_item_id = p_pick_list_item_id
    AND claimed_by = p_user_id
    AND released_at IS NULL
  RETURNING TRUE INTO v_released;

  RETURN COALESCE(v_released, FALSE);
END;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_pick_list_completion_with_active_claims()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status = 'done'
     AND OLD.status IS DISTINCT FROM 'done'
     AND EXISTS (
       SELECT 1
       FROM public.pick_list_item_claims claim
       WHERE claim.pick_list_id = NEW.id
         AND claim.company_id = NEW.company_id
         AND claim.released_at IS NULL
         AND claim.expires_at > NOW()
     ) THEN
    RAISE EXCEPTION 'PICK_LIST_ACTIVE_CLAIMS';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_pick_lists_prevent_completion_with_active_claims
  BEFORE UPDATE OF status ON public.pick_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_pick_list_completion_with_active_claims();

DROP FUNCTION IF EXISTS public.record_pick_list_item_progress(
  UUID,
  UUID,
  UUID,
  UUID,
  NUMERIC,
  TEXT,
  UUID,
  TEXT,
  TIMESTAMPTZ,
  BOOLEAN,
  TEXT
);

CREATE OR REPLACE FUNCTION public.record_pick_list_item_progress(
  p_company_id UUID,
  p_user_id UUID,
  p_pick_list_id UUID,
  p_pick_list_item_id UUID,
  p_operation_id UUID,
  p_picked_qty NUMERIC,
  p_batch_location_sku TEXT DEFAULT NULL,
  p_picked_location_id UUID DEFAULT NULL,
  p_picked_batch_code TEXT DEFAULT NULL,
  p_picked_batch_received_at TIMESTAMPTZ DEFAULT NULL,
  p_mismatch_acknowledged BOOLEAN DEFAULT FALSE,
  p_mismatch_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pick_list_status public.pick_lists.status%TYPE;
  v_pick_list_business_unit_id UUID;
  v_pick_list_dn_id UUID;
  v_line_allocated_qty NUMERIC;
  v_line_picked_qty NUMERIC;
  v_line_dn_item_id UUID;
  v_suggested_location_id UUID;
  v_suggested_batch_code TEXT;
  v_suggested_batch_location_sku TEXT;
  v_dn_line_id UUID;
  v_dn_line_item_id UUID;
  v_dn_line_warehouse_id UUID;
  v_dn_line_item_unit_option_id UUID;
  v_dn_line_allocated_qty NUMERIC;
  v_qty_per_unit NUMERIC;
  v_current_picked_qty NUMERIC;
  v_location_id UUID := p_picked_location_id;
  v_batch_code TEXT := NULLIF(BTRIM(COALESCE(p_picked_batch_code, '')), '');
  v_batch_received_at TIMESTAMPTZ := p_picked_batch_received_at;
  v_resolved_batch_location_sku TEXT := NULLIF(BTRIM(COALESCE(p_batch_location_sku, '')), '');
  v_location_available_qty NUMERIC;
  v_batch_available_qty NUMERIC;
  v_existing_source_picked_qty NUMERIC;
  v_existing_pick_id UUID;
  v_is_mismatch BOOLEAN;
  v_dn_picked_qty NUMERIC;
  v_operation_inserted BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'PICK_PROGRESS_UNAUTHORIZED';
  END IF;

  IF p_operation_id IS NULL
     OR p_picked_qty IS NULL
     OR p_picked_qty <= 0 THEN
    RAISE EXCEPTION 'PICK_PROGRESS_INVALID_QUANTITY';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users users
    WHERE users.id = p_user_id
      AND users.company_id = p_company_id
      AND users.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'PICK_PROGRESS_UNAUTHORIZED';
  END IF;

  SELECT status, business_unit_id, dn_id
  INTO v_pick_list_status, v_pick_list_business_unit_id, v_pick_list_dn_id
  FROM public.pick_lists
  WHERE id = p_pick_list_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PICK_PROGRESS_NOT_FOUND';
  END IF;

  IF (
    (
      auth.uid() IS NOT NULL
      AND v_pick_list_business_unit_id IS DISTINCT FROM public.get_current_business_unit_id()
    )
    OR
    NOT public.user_has_permission(
      p_user_id,
      'stock_requests',
      'edit',
      v_pick_list_business_unit_id
    )
    OR (
      public.user_has_permission(
        p_user_id,
        'stock_requests.operation.view_only_assigned_pick_lists.view',
        'view',
        v_pick_list_business_unit_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.pick_list_assignees assignee
        WHERE assignee.company_id = p_company_id
          AND assignee.pick_list_id = p_pick_list_id
          AND assignee.user_id = p_user_id
      )
    )
  ) THEN
    RAISE EXCEPTION 'PICK_PROGRESS_UNAUTHORIZED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pick_list_item_pick_operations operation
    WHERE operation.operation_id = p_operation_id
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.pick_list_item_pick_operations operation
      WHERE operation.operation_id = p_operation_id
        AND operation.company_id = p_company_id
        AND operation.pick_list_id = p_pick_list_id
        AND operation.pick_list_item_id = p_pick_list_item_id
        AND operation.picker_user_id = p_user_id
        AND operation.picked_qty = p_picked_qty
    ) THEN
      RAISE EXCEPTION 'PICK_PROGRESS_OPERATION_CONFLICT';
    END IF;
    RETURN p_pick_list_item_id;
  END IF;

  IF v_pick_list_status <> 'in_progress' THEN
    RAISE EXCEPTION 'PICK_PROGRESS_NOT_ACTIVE';
  END IF;

  SELECT
    allocated_qty,
    picked_qty,
    dn_item_id,
    suggested_pick_location_id,
    suggested_pick_batch_code,
    suggested_batch_location_sku
  INTO
    v_line_allocated_qty,
    v_line_picked_qty,
    v_line_dn_item_id,
    v_suggested_location_id,
    v_suggested_batch_code,
    v_suggested_batch_location_sku
  FROM public.pick_list_items
  WHERE id = p_pick_list_item_id
    AND company_id = p_company_id
    AND pick_list_id = p_pick_list_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PICK_PROGRESS_LINE_NOT_FOUND';
  END IF;

  SELECT
    id,
    item_id,
    fulfilling_warehouse_id,
    item_unit_option_id,
    allocated_qty
  INTO
    v_dn_line_id,
    v_dn_line_item_id,
    v_dn_line_warehouse_id,
    v_dn_line_item_unit_option_id,
    v_dn_line_allocated_qty
  FROM public.delivery_note_items
  WHERE id = v_line_dn_item_id
    AND company_id = p_company_id
    AND dn_id = v_pick_list_dn_id
    AND is_voided = FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PICK_PROGRESS_LINE_NOT_FOUND';
  END IF;

  SELECT COALESCE(iuo.qty_per_unit, 1)
  INTO v_qty_per_unit
  FROM public.item_unit_options iuo
  WHERE iuo.id = v_dn_line_item_unit_option_id
    AND iuo.company_id = p_company_id;
  v_qty_per_unit := GREATEST(COALESCE(v_qty_per_unit, 1), 1);

  INSERT INTO public.pick_list_item_pick_operations (
    operation_id,
    company_id,
    pick_list_id,
    pick_list_item_id,
    picker_user_id,
    picked_qty
  )
  VALUES (
    p_operation_id,
    p_company_id,
    p_pick_list_id,
    p_pick_list_item_id,
    p_user_id,
    p_picked_qty
  )
  ON CONFLICT (operation_id) DO NOTHING
  RETURNING TRUE INTO v_operation_inserted;

  IF NOT v_operation_inserted THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.pick_list_item_pick_operations operation
      WHERE operation.operation_id = p_operation_id
        AND operation.company_id = p_company_id
        AND operation.pick_list_id = p_pick_list_id
        AND operation.pick_list_item_id = p_pick_list_item_id
        AND operation.picker_user_id = p_user_id
        AND operation.picked_qty = p_picked_qty
    ) THEN
      RAISE EXCEPTION 'PICK_PROGRESS_OPERATION_CONFLICT';
    END IF;
    RETURN p_pick_list_item_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pick_list_item_claims claim
    WHERE claim.company_id = p_company_id
      AND claim.pick_list_id = p_pick_list_id
      AND claim.pick_list_item_id = p_pick_list_item_id
      AND claim.claimed_by = p_user_id
      AND claim.released_at IS NULL
      AND claim.expires_at > NOW()
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'PICK_PROGRESS_CLAIM_REQUIRED';
  END IF;

  v_current_picked_qty := COALESCE(v_line_picked_qty, 0);

  IF v_current_picked_qty + p_picked_qty > v_line_allocated_qty THEN
    RAISE EXCEPTION 'PICK_PROGRESS_INVALID_QUANTITY';
  END IF;

  IF v_resolved_batch_location_sku IS NOT NULL THEN
    SELECT
      ilb.location_id,
      ilb.batch_location_sku,
      ib.batch_code,
      ib.received_at,
      GREATEST(0, COALESCE(ilb.qty_on_hand, 0)),
      GREATEST(0, COALESCE(ib.qty_on_hand, 0))
    INTO
      v_location_id,
      v_resolved_batch_location_sku,
      v_batch_code,
      v_batch_received_at,
      v_location_available_qty,
      v_batch_available_qty
    FROM public.item_batch_locations ilb
    JOIN public.item_batches ib
      ON ib.id = ilb.item_batch_id
     AND ib.company_id = ilb.company_id
     AND ib.deleted_at IS NULL
    WHERE ilb.company_id = p_company_id
      AND ilb.batch_location_sku = v_resolved_batch_location_sku
      AND ilb.item_id = v_dn_line_item_id
      AND ilb.warehouse_id = v_dn_line_warehouse_id
      AND ilb.deleted_at IS NULL
    LIMIT 1;
  ELSE
    IF v_location_id IS NULL OR v_batch_code IS NULL OR v_batch_received_at IS NULL THEN
      RAISE EXCEPTION 'PICK_PROGRESS_SOURCE_REQUIRED';
    END IF;

    SELECT
      ilb.batch_location_sku,
      GREATEST(0, COALESCE(ilb.qty_on_hand, 0)),
      GREATEST(0, COALESCE(ib.qty_on_hand, 0))
    INTO
      v_resolved_batch_location_sku,
      v_location_available_qty,
      v_batch_available_qty
    FROM public.item_batch_locations ilb
    JOIN public.item_batches ib
      ON ib.id = ilb.item_batch_id
     AND ib.company_id = ilb.company_id
     AND ib.deleted_at IS NULL
    WHERE ilb.company_id = p_company_id
      AND ilb.item_id = v_dn_line_item_id
      AND ilb.warehouse_id = v_dn_line_warehouse_id
      AND ilb.location_id = v_location_id
      AND ilb.deleted_at IS NULL
      AND ib.batch_code = v_batch_code
      AND ib.received_at = v_batch_received_at
    LIMIT 1;
  END IF;

  IF v_location_available_qty IS NULL OR v_batch_available_qty IS NULL THEN
    RAISE EXCEPTION 'PICK_PROGRESS_SOURCE_NOT_FOUND';
  END IF;

  SELECT COALESCE(SUM(picked_qty), 0)
  INTO v_existing_source_picked_qty
  FROM public.delivery_note_item_picks
  WHERE company_id = p_company_id
    AND pick_list_id = p_pick_list_id
    AND pick_list_item_id = p_pick_list_item_id
    AND picked_location_id = v_location_id
    AND picked_batch_code = v_batch_code
    AND picked_batch_received_at = v_batch_received_at
    AND deleted_at IS NULL;

  IF ((v_existing_source_picked_qty + p_picked_qty) * v_qty_per_unit) > LEAST(
    v_location_available_qty,
    v_batch_available_qty
  ) THEN
    RAISE EXCEPTION 'PICK_PROGRESS_INSUFFICIENT_QUANTITY';
  END IF;

  v_is_mismatch :=
    COALESCE(v_suggested_location_id <> v_location_id, FALSE)
    OR COALESCE(v_suggested_batch_code <> v_batch_code, FALSE)
    OR COALESCE(
      v_suggested_batch_location_sku <> v_resolved_batch_location_sku,
      FALSE
    );

  IF v_is_mismatch AND NOT p_mismatch_acknowledged THEN
    RAISE EXCEPTION 'PICK_PROGRESS_MISMATCH_ACKNOWLEDGEMENT_REQUIRED';
  END IF;

  SELECT id
  INTO v_existing_pick_id
  FROM public.delivery_note_item_picks
  WHERE company_id = p_company_id
    AND pick_list_id = p_pick_list_id
    AND pick_list_item_id = p_pick_list_item_id
    AND picked_location_id = v_location_id
    AND picked_batch_code = v_batch_code
    AND picked_batch_received_at = v_batch_received_at
    AND deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.delivery_note_item_picks
    SET picked_qty = picked_qty + p_picked_qty,
        batch_location_sku = v_resolved_batch_location_sku,
        picker_user_id = p_user_id,
        picked_at = v_now,
        is_mismatch_warning_acknowledged = CASE WHEN v_is_mismatch THEN TRUE ELSE FALSE END,
        mismatch_reason = CASE
          WHEN v_is_mismatch THEN NULLIF(BTRIM(COALESCE(p_mismatch_reason, '')), '')
          ELSE NULL
        END,
        updated_at = v_now,
        updated_by = p_user_id
    WHERE id = v_existing_pick_id;
  ELSE
    INSERT INTO public.delivery_note_item_picks (
      company_id,
      dn_id,
      delivery_note_item_id,
      pick_list_item_id,
      pick_list_id,
      item_id,
      source_warehouse_id,
      picked_location_id,
      picked_batch_code,
      picked_batch_received_at,
      batch_location_sku,
      picked_qty,
      dispatched_qty,
      picker_user_id,
      picked_at,
      is_mismatch_warning_acknowledged,
      mismatch_reason,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_pick_list_dn_id,
      v_dn_line_id,
      p_pick_list_item_id,
      p_pick_list_id,
      v_dn_line_item_id,
      v_dn_line_warehouse_id,
      v_location_id,
      v_batch_code,
      v_batch_received_at,
      v_resolved_batch_location_sku,
      p_picked_qty,
      0,
      p_user_id,
      v_now,
      CASE WHEN v_is_mismatch THEN TRUE ELSE FALSE END,
      CASE
        WHEN v_is_mismatch THEN NULLIF(BTRIM(COALESCE(p_mismatch_reason, '')), '')
        ELSE NULL
      END,
      p_user_id,
      p_user_id
    );
  END IF;

  UPDATE public.pick_list_items
  SET picked_qty = picked_qty + p_picked_qty,
      short_qty = GREATEST(0, allocated_qty - (picked_qty + p_picked_qty)),
      updated_at = v_now
  WHERE id = p_pick_list_item_id;

  SELECT LEAST(
    COALESCE(v_dn_line_allocated_qty, 0),
    COALESCE(SUM(pick.picked_qty), 0)
  )
  INTO v_dn_picked_qty
  FROM public.delivery_note_item_picks pick
  WHERE pick.company_id = p_company_id
    AND pick.delivery_note_item_id = v_dn_line_id
    AND pick.deleted_at IS NULL;

  UPDATE public.delivery_note_items
  SET picked_qty = v_dn_picked_qty,
      short_qty = GREATEST(0, COALESCE(allocated_qty, 0) - v_dn_picked_qty),
      updated_at = v_now
  WHERE id = v_dn_line_id
    AND company_id = p_company_id;

  UPDATE public.pick_lists
  SET updated_at = v_now,
      updated_by = p_user_id
  WHERE id = p_pick_list_id
    AND company_id = p_company_id;

  UPDATE public.pick_list_item_claims
  SET released_at = v_now,
      updated_at = v_now
  WHERE pick_list_item_id = p_pick_list_item_id
    AND claimed_by = p_user_id
    AND released_at IS NULL;

  RETURN p_pick_list_item_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_pick_list_item_progress(
  UUID,
  UUID,
  UUID,
  UUID,
  UUID,
  NUMERIC,
  TEXT,
  UUID,
  TEXT,
  TIMESTAMPTZ,
  BOOLEAN,
  TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_pick_list_item_progress(
  UUID,
  UUID,
  UUID,
  UUID,
  UUID,
  NUMERIC,
  TEXT,
  UUID,
  TEXT,
  TIMESTAMPTZ,
  BOOLEAN,
  TEXT
) TO authenticated;

COMMENT ON FUNCTION public.record_pick_list_item_progress(
  UUID,
  UUID,
  UUID,
  UUID,
  UUID,
  NUMERIC,
  TEXT,
  UUID,
  TEXT,
  TIMESTAMPTZ,
  BOOLEAN,
  TEXT
) IS
  'Persists an idempotent pick-list line quantity increment and source atomically without completing the pick list.';

COMMENT ON FUNCTION public.user_can_view_pick_list(UUID, UUID, UUID) IS
  'Enforces current-business-unit pick-list visibility and applies assignment filtering only when the assigned-only capability is enabled.';

REVOKE ALL ON FUNCTION public.claim_pick_list_item(UUID, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pick_list_item(UUID, UUID, UUID, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.release_pick_list_item_claim(UUID, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_pick_list_item_claim(UUID, UUID, UUID, UUID) TO authenticated;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication p
    JOIN pg_publication_rel pr ON pr.prpubid = p.oid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'pick_list_item_claims'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pick_list_item_claims;
  END IF;
END
$do$;

COMMIT;
