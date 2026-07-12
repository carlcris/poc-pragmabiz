BEGIN;

DELETE FROM public.permissions
WHERE resource = 'items.operation.print_location_qr.view';

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
  'items.operation.print_batch_qr.view',
  'items',
  'operation',
  'print_batch_qr',
  'view',
  'Print Item Batch QR Codes',
  'Item Operations',
  'Allows printing item batch-location QR labels from an item''s Locations tab.',
  TRUE,
  TRUE,
  FALSE,
  FALSE,
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
  TRUE,
  FALSE,
  FALSE,
  FALSE
FROM public.roles AS role
CROSS JOIN public.permissions AS permission
WHERE role.deleted_at IS NULL
  AND LOWER(role.name) IN ('super admin', 'admin')
  AND permission.resource = 'items.operation.print_batch_qr.view'
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = TRUE,
  can_create = FALSE,
  can_edit = FALSE,
  can_delete = FALSE;

COMMIT;
