BEGIN;

WITH granular_permissions AS (
  SELECT *
  FROM (
    VALUES
      (
        'purchasing_dashboard.widget.outstanding_requisitions.view',
        'dashboard',
        'widget',
        'outstanding_requisitions',
        'view',
        'Outstanding Requisitions Widget',
        'Purchasing Overview Widgets',
        'Allows viewing the outstanding stock requisitions widget on Purchasing Overview.'
      ),
      (
        'purchasing_dashboard.widget.damaged_items.view',
        'dashboard',
        'widget',
        'damaged_items',
        'view',
        'Damaged Items Widget',
        'Purchasing Overview Widgets',
        'Allows viewing the damaged items widget on Purchasing Overview.'
      ),
      (
        'purchasing_dashboard.widget.expected_arrivals.view',
        'dashboard',
        'widget',
        'expected_arrivals',
        'view',
        'Expected Arrivals Widget',
        'Purchasing Overview Widgets',
        'Allows viewing the expected arrivals widget on Purchasing Overview.'
      ),
      (
        'purchasing_dashboard.widget.delayed_shipments.view',
        'dashboard',
        'widget',
        'delayed_shipments',
        'view',
        'Delayed Shipments Widget',
        'Purchasing Overview Widgets',
        'Allows viewing the delayed shipments widget on Purchasing Overview.'
      ),
      (
        'purchasing_dashboard.widget.todays_receiving_queue.view',
        'dashboard',
        'widget',
        'todays_receiving_queue',
        'view',
        'Today''s Receiving Queue',
        'Purchasing Overview Widgets',
        'Allows viewing the receiving queue widget on Purchasing Overview.'
      ),
      (
        'purchasing_dashboard.widget.pending_approvals.view',
        'dashboard',
        'widget',
        'pending_approvals',
        'view',
        'Pending Approvals Widget',
        'Purchasing Overview Widgets',
        'Allows viewing the pending approvals widget on Purchasing Overview.'
      ),
      (
        'purchasing_dashboard.widget.box_assignment_queue.view',
        'dashboard',
        'widget',
        'box_assignment_queue',
        'view',
        'Box Assignment Queue',
        'Purchasing Overview Widgets',
        'Allows viewing the box assignment queue widget on Purchasing Overview.'
      ),
      (
        'purchasing_dashboard.widget.warehouse_capacity.view',
        'dashboard',
        'widget',
        'warehouse_capacity',
        'view',
        'Warehouse Capacity Widget',
        'Purchasing Overview Widgets',
        'Allows viewing the warehouse capacity widget on Purchasing Overview.'
      ),
      (
        'purchasing_dashboard.widget.active_requisitions.view',
        'dashboard',
        'widget',
        'active_requisitions',
        'view',
        'Active Requisitions Widget',
        'Purchasing Overview Widgets',
        'Allows viewing the active requisitions status widget on Purchasing Overview.'
      ),
      (
        'purchasing_dashboard.widget.incoming_deliveries.view',
        'dashboard',
        'widget',
        'incoming_deliveries',
        'view',
        'Incoming Deliveries Widget',
        'Purchasing Overview Widgets',
        'Allows viewing incoming deliveries linked to stock requisitions on Purchasing Overview.'
      ),
      (
        'purchasing_dashboard.widget.active_containers.view',
        'dashboard',
        'widget',
        'active_containers',
        'view',
        'Active Containers Widget',
        'Purchasing Overview Widgets',
        'Allows viewing the active containers widget on Purchasing Overview.'
      ),
      (
        'purchasing_dashboard.widget.location_assignment.view',
        'dashboard',
        'widget',
        'location_assignment',
        'view',
        'Location Assignment Widget',
        'Purchasing Overview Widgets',
        'Allows viewing the location assignment widget on Purchasing Overview.'
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
    'purchasing_dashboard.widget.outstanding_requisitions.view',
    'purchasing_dashboard.widget.damaged_items.view',
    'purchasing_dashboard.widget.expected_arrivals.view',
    'purchasing_dashboard.widget.delayed_shipments.view',
    'purchasing_dashboard.widget.todays_receiving_queue.view',
    'purchasing_dashboard.widget.pending_approvals.view',
    'purchasing_dashboard.widget.box_assignment_queue.view',
    'purchasing_dashboard.widget.warehouse_capacity.view',
    'purchasing_dashboard.widget.active_requisitions.view',
    'purchasing_dashboard.widget.incoming_deliveries.view',
    'purchasing_dashboard.widget.active_containers.view',
    'purchasing_dashboard.widget.location_assignment.view'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = TRUE,
  can_create = FALSE,
  can_edit = FALSE,
  can_delete = FALSE;

COMMIT;
