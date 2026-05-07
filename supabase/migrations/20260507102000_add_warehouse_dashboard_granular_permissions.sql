BEGIN;

WITH granular_permissions AS (
  SELECT *
  FROM (
    VALUES
      (
        'dashboard.card.incoming_shipments.view',
        'dashboard',
        'card',
        'incoming_shipments',
        'view',
        'Incoming Shipments Card',
        'Warehouse Dashboard Cards',
        'Allows viewing the Incoming Shipments summary card on the dashboard.'
      ),
      (
        'dashboard.card.stock_requests.view',
        'dashboard',
        'card',
        'stock_requests',
        'view',
        'Stock Requests Card',
        'Warehouse Dashboard Cards',
        'Allows viewing the Stock Requests summary card on the dashboard.'
      ),
      (
        'dashboard.card.pick_list.view',
        'dashboard',
        'card',
        'pick_list',
        'view',
        'Pick List Card',
        'Warehouse Dashboard Cards',
        'Allows viewing the Pick List summary card on the dashboard.'
      ),
      (
        'dashboard.queue.pick_list.view',
        'dashboard',
        'queue',
        'pick_list',
        'view',
        'Pick List Queue',
        'Warehouse Dashboard Operational Queue',
        'Allows viewing the Pick List tab and items in the dashboard operational queue.'
      ),
      (
        'dashboard.queue.incoming_deliveries.view',
        'dashboard',
        'queue',
        'incoming_deliveries',
        'view',
        'Incoming Deliveries Queue',
        'Warehouse Dashboard Operational Queue',
        'Allows viewing the Incoming tab and items in the dashboard operational queue.'
      ),
      (
        'dashboard.queue.stock_requests.view',
        'dashboard',
        'queue',
        'stock_requests',
        'view',
        'Stock Requests Queue',
        'Warehouse Dashboard Operational Queue',
        'Allows viewing the Requests tab and items in the dashboard operational queue.'
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
    'dashboard.card.incoming_shipments.view',
    'dashboard.card.stock_requests.view',
    'dashboard.card.pick_list.view',
    'dashboard.queue.pick_list.view',
    'dashboard.queue.incoming_deliveries.view',
    'dashboard.queue.stock_requests.view'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = TRUE,
  can_create = FALSE,
  can_edit = FALSE,
  can_delete = FALSE;

COMMIT;
