BEGIN;

WITH granular_permissions AS (
  SELECT *
  FROM (
    VALUES
      (
        'stock_requisitions.field.total_amount.view',
        'stock_requisitions',
        'field',
        'total_amount',
        'view',
        'Stock Requisition Total Amount',
        'Sensitive Fields',
        'Allows viewing the Total Amount column and detail amount fields on stock requisitions.'
      ),
      (
        'stock_requisitions.field.unit_cost.view',
        'stock_requisitions',
        'field',
        'unit_cost',
        'view',
        'Stock Requisition Unit Cost',
        'Sensitive Fields',
        'Allows viewing and entering stock requisition line unit costs.'
      ),
      (
        'stock_requisitions.summary.supplier_cost_summary.view',
        'stock_requisitions',
        'summary',
        'supplier_cost_summary',
        'view',
        'Supplier Cost Summary',
        'Summaries',
        'Allows viewing supplier cost summaries derived from stock requisitions.'
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
  AND p.resource IN (
    'stock_requisitions.field.total_amount.view',
    'stock_requisitions.field.unit_cost.view',
    'stock_requisitions.summary.supplier_cost_summary.view'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = TRUE,
  can_create = FALSE,
  can_edit = FALSE,
  can_delete = FALSE;

COMMIT;
