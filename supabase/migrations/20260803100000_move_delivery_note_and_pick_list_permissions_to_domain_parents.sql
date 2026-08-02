BEGIN;

INSERT INTO public.permissions (
  resource,
  description,
  can_view,
  can_create,
  can_edit,
  can_delete,
  is_granular
)
VALUES
  (
    'delivery_notes',
    'Manage delivery notes and delivery-note receiving',
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    FALSE
  ),
  (
    'pick_lists',
    'Manage pick lists and warehouse picking',
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    FALSE
  )
ON CONFLICT (resource) DO UPDATE
SET description = EXCLUDED.description,
    parent_resource = NULL,
    surface = NULL,
    capability_key = NULL,
    capability_action = NULL,
    label = NULL,
    permission_group = NULL,
    is_granular = FALSE,
    can_view = EXCLUDED.can_view,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    deleted_at = NULL,
    updated_at = NOW();

-- Preserve each role's current workflow access while separating the modules.
INSERT INTO public.role_permissions (
  role_id,
  permission_id,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  role_permission.role_id,
  target_permission.id,
  role_permission.can_view,
  role_permission.can_create,
  role_permission.can_edit,
  role_permission.can_delete
FROM public.role_permissions role_permission
JOIN public.permissions source_permission
  ON source_permission.id = role_permission.permission_id
 AND source_permission.resource = 'stock_requests'
CROSS JOIN (
  VALUES ('delivery_notes'), ('pick_lists')
) AS target_resource(resource)
JOIN public.permissions target_permission
  ON target_permission.resource = target_resource.resource
ON CONFLICT (role_id, permission_id) DO UPDATE
SET can_view = EXCLUDED.can_view,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete;

UPDATE public.permissions
SET resource = 'delivery_notes.operation.receive_delivery_notes.edit',
    parent_resource = 'delivery_notes',
    surface = 'operation',
    capability_key = 'receive_delivery_notes',
    capability_action = 'edit',
    label = 'Receive Delivery Notes',
    permission_group = 'Delivery Note Receiving Operations',
    description = 'Allows starting, recording, reviewing, and submitting delivery note receiving.',
    is_granular = TRUE,
    can_view = FALSE,
    can_create = FALSE,
    can_edit = TRUE,
    can_delete = FALSE,
    updated_at = NOW()
WHERE resource = 'stock_requests.operation.receive_delivery_notes.edit';

UPDATE public.permissions
SET resource = 'pick_lists.operation.view_only_assigned_pick_lists.view',
    parent_resource = 'pick_lists',
    surface = 'operation',
    capability_key = 'view_only_assigned_pick_lists',
    capability_action = 'view',
    label = 'View Only Assigned Pick Lists',
    permission_group = 'Pick List Operations',
    description = 'When enabled, limits pick-list access to rows assigned to the current user. When disabled, the user can access all pick lists in the current business unit allowed by the Pick Lists permission.',
    is_granular = TRUE,
    can_view = TRUE,
    can_create = FALSE,
    can_edit = FALSE,
    can_delete = FALSE,
    updated_at = NOW()
WHERE resource = 'stock_requests.operation.view_only_assigned_pick_lists.view';

-- Granular permissions extend their parent action. Normalize existing role
-- grants so an enabled child never remains stored beneath a disabled parent.
INSERT INTO public.role_permissions AS existing_parent (
  role_id,
  permission_id,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  child_grant.role_id,
  parent_permission.id,
  TRUE,
  FALSE,
  TRUE,
  FALSE
FROM public.role_permissions child_grant
JOIN public.permissions child_permission
  ON child_permission.id = child_grant.permission_id
 AND child_permission.resource = 'delivery_notes.operation.receive_delivery_notes.edit'
JOIN public.permissions parent_permission
  ON parent_permission.resource = 'delivery_notes'
WHERE child_grant.can_edit IS TRUE
ON CONFLICT (role_id, permission_id) DO UPDATE
SET can_view = existing_parent.can_view OR EXCLUDED.can_view,
    can_create = existing_parent.can_create OR EXCLUDED.can_create,
    can_edit = existing_parent.can_edit OR EXCLUDED.can_edit,
    can_delete = existing_parent.can_delete OR EXCLUDED.can_delete;

INSERT INTO public.role_permissions AS existing_parent (
  role_id,
  permission_id,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  child_grant.role_id,
  parent_permission.id,
  TRUE,
  FALSE,
  FALSE,
  FALSE
FROM public.role_permissions child_grant
JOIN public.permissions child_permission
  ON child_permission.id = child_grant.permission_id
 AND child_permission.resource = 'pick_lists.operation.view_only_assigned_pick_lists.view'
JOIN public.permissions parent_permission
  ON parent_permission.resource = 'pick_lists'
WHERE child_grant.can_view IS TRUE
ON CONFLICT (role_id, permission_id) DO UPDATE
SET can_view = existing_parent.can_view OR EXCLUDED.can_view,
    can_create = existing_parent.can_create OR EXCLUDED.can_create,
    can_edit = existing_parent.can_edit OR EXCLUDED.can_edit,
    can_delete = existing_parent.can_delete OR EXCLUDED.can_delete;

-- Picker no longer needs Stock Requests or Delivery Notes access solely to
-- perform picking.
DELETE FROM public.role_permissions role_permission
USING public.roles role, public.permissions permission
WHERE role_permission.role_id = role.id
  AND role_permission.permission_id = permission.id
  AND LOWER(BTRIM(role.name)) = 'picker'
  AND permission.resource IN ('stock_requests', 'delivery_notes');

-- These functions contain authorization checks in their current definitions.
-- Recreate those definitions with the new domain parents without duplicating
-- hundreds of lines of otherwise unchanged transactional workflow SQL.
DO $migration$
DECLARE
  v_signature REGPROCEDURE;
  v_definition TEXT;
  v_updated_definition TEXT;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'create_pick_list_with_allocation(uuid,uuid,uuid,uuid[],text,uuid,text)'::REGPROCEDURE,
    'user_can_view_pick_list(uuid,uuid,uuid)'::REGPROCEDURE,
    'claim_pick_list_item(uuid,uuid,uuid,uuid)'::REGPROCEDURE,
    'record_pick_list_item_progress(uuid,uuid,uuid,uuid,uuid,numeric,text,uuid,text,timestamptz,boolean,text)'::REGPROCEDURE
  ] LOOP
    SELECT pg_get_functiondef(v_signature)
    INTO v_definition;

    v_updated_definition := REPLACE(
      REPLACE(
        v_definition,
        '''stock_requests.operation.view_only_assigned_pick_lists.view''',
        '''pick_lists.operation.view_only_assigned_pick_lists.view'''
      ),
      '''stock_requests''',
      '''pick_lists'''
    );

    IF v_updated_definition = v_definition
       OR POSITION('''stock_requests''' IN v_updated_definition) > 0
       OR POSITION('stock_requests.operation.view_only_assigned_pick_lists.view' IN v_updated_definition) > 0 THEN
      RAISE EXCEPTION 'Unable to migrate permission checks in function %', v_signature;
    END IF;

    EXECUTE v_updated_definition;
  END LOOP;

  FOREACH v_signature IN ARRAY ARRAY[
    'get_delivery_note_allocation_availability(uuid,uuid,uuid,uuid[])'::REGPROCEDURE,
    'create_delivery_notes_transactionally(uuid,uuid,uuid,text,text,text,jsonb)'::REGPROCEDURE,
    'add_delivery_note_items_transactionally(uuid,uuid,uuid,uuid,uuid[],text,jsonb)'::REGPROCEDURE,
    'start_delivery_note_receiving_transactionally(uuid,uuid,uuid,uuid,uuid)'::REGPROCEDURE
  ] LOOP
    SELECT pg_get_functiondef(v_signature)
    INTO v_definition;

    v_updated_definition := REPLACE(
      REPLACE(
        v_definition,
        '''stock_requests.operation.receive_delivery_notes.edit''',
        '''delivery_notes.operation.receive_delivery_notes.edit'''
      ),
      '''stock_requests''',
      '''delivery_notes'''
    );

    IF v_updated_definition = v_definition
       OR POSITION('''stock_requests''' IN v_updated_definition) > 0
       OR POSITION('stock_requests.operation.receive_delivery_notes.edit' IN v_updated_definition) > 0 THEN
      RAISE EXCEPTION 'Unable to migrate permission checks in function %', v_signature;
    END IF;

    EXECUTE v_updated_definition;
  END LOOP;
END;
$migration$;

COMMIT;
