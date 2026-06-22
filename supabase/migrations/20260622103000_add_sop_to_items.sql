BEGIN;

ALTER TABLE public.item_warehouse
  DROP CONSTRAINT IF EXISTS item_warehouse_sop_non_negative;

ALTER TABLE public.item_warehouse
  DROP COLUMN IF EXISTS sop;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS sop NUMERIC(8, 2);

ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_sop_non_negative;

ALTER TABLE public.items
  ADD CONSTRAINT items_sop_non_negative
  CHECK (sop IS NULL OR sop >= 0);

COMMENT ON COLUMN public.items.sop IS
  'Optional item-level SOP value reserved for future use.';

WITH granular_permissions AS (
  SELECT *
  FROM (
    VALUES
      (
        'items.field.sop.view',
        'items',
        'field',
        'sop',
        'view',
        'View Item SOP',
        'Item Fields',
        'Allows viewing the item SOP field.'
      ),
      (
        'items.field.sop.edit',
        'items',
        'field',
        'sop',
        'edit',
        'Edit Item SOP',
        'Item Fields',
        'Allows editing the item SOP field.'
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
  capability_action = 'view',
  FALSE,
  capability_action = 'edit',
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
  can_view = EXCLUDED.can_view,
  can_edit = EXCLUDED.can_edit,
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
  p.resource = 'items.field.sop.view',
  FALSE,
  p.resource = 'items.field.sop.edit',
  FALSE
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.deleted_at IS NULL
  AND LOWER(r.name) IN ('super admin', 'admin')
  AND p.resource IN ('items.field.sop.view', 'items.field.sop.edit')
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = EXCLUDED.can_view,
  can_create = FALSE,
  can_edit = EXCLUDED.can_edit,
  can_delete = FALSE;

COMMIT;
