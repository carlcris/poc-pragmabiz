BEGIN;

WITH granular_permissions AS (
  SELECT *
  FROM (
    VALUES
      (
        'items.card.pricing_details.view',
        'items',
        'card',
        'pricing_details',
        'view',
        'Pricing Details Card',
        'Item Details Cards',
        'Allows viewing the Pricing Details card on the Item Details page.'
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
  TRUE,
  FALSE,
  FALSE,
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
  can_view = TRUE,
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
  TRUE,
  FALSE,
  FALSE,
  FALSE
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.deleted_at IS NULL
  AND LOWER(r.name) IN ('super admin', 'admin')
  AND p.resource = 'items.card.pricing_details.view'
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = TRUE,
  can_create = FALSE,
  can_edit = FALSE,
  can_delete = FALSE;

COMMIT;
