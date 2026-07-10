BEGIN;

WITH granular_permissions AS (
  SELECT *
  FROM (
    VALUES
      (
        'goods_receipt_notes.operation.save_receiving.edit',
        'goods_receipt_notes',
        'operation',
        'save_receiving',
        'edit',
        'Save GRN Receiving',
        'GRN Receiving Operations',
        'Allows saving received and damaged quantities during GRN receiving.'
      ),
      (
        'goods_receipt_notes.operation.submit_receiving.edit',
        'goods_receipt_notes',
        'operation',
        'submit_receiving',
        'edit',
        'Submit GRN Receiving',
        'GRN Receiving Operations',
        'Allows submitting GRN receiving quantities for confirmation and putaway staging.'
      )
  ) AS gp(resource, parent_resource, surface, capability_key, capability_action, label, permission_group, description)
)
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
SELECT
  resource,
  parent_resource,
  surface,
  capability_key,
  capability_action,
  label,
  permission_group,
  description,
  TRUE,
  FALSE,
  FALSE,
  TRUE,
  FALSE
FROM granular_permissions
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
  p.id,
  FALSE,
  FALSE,
  TRUE,
  FALSE
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.deleted_at IS NULL
  AND LOWER(r.name) IN ('super admin', 'admin')
  AND p.resource IN (
    'goods_receipt_notes.operation.save_receiving.edit',
    'goods_receipt_notes.operation.submit_receiving.edit'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = FALSE,
  can_create = FALSE,
  can_edit = TRUE,
  can_delete = FALSE;

COMMIT;
