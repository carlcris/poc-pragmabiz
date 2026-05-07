BEGIN;

ALTER TABLE public.permissions
  ADD COLUMN IF NOT EXISTS parent_resource VARCHAR(100),
  ADD COLUMN IF NOT EXISTS surface VARCHAR(50),
  ADD COLUMN IF NOT EXISTS capability_key VARCHAR(100),
  ADD COLUMN IF NOT EXISTS capability_action VARCHAR(50),
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS permission_group TEXT,
  ADD COLUMN IF NOT EXISTS is_granular BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_permissions_parent_resource
  ON public.permissions(parent_resource)
  WHERE deleted_at IS NULL AND is_granular = TRUE;

CREATE INDEX IF NOT EXISTS idx_permissions_surface
  ON public.permissions(surface)
  WHERE deleted_at IS NULL AND is_granular = TRUE;

WITH granular_permissions AS (
  SELECT *
  FROM (
    VALUES
      (
        'dashboard.widget.total_sales.view',
        'dashboard',
        'widget',
        'total_sales',
        'view',
        'Total Sales Widget',
        'Dashboard Widgets',
        'Allows viewing total sales values on dashboard widgets.'
      ),
      (
        'dashboard.widget.top_agent_sales.view',
        'dashboard',
        'widget',
        'top_agent_sales',
        'view',
        'Top Agent Sales',
        'Dashboard Widgets',
        'Allows viewing sales amount for the top agent widget.'
      ),
      (
        'dashboard.widget.recent_activity_amount.view',
        'dashboard',
        'widget',
        'recent_activity_amount',
        'view',
        'Recent Activity Amounts',
        'Dashboard Widgets',
        'Allows viewing transaction amounts in recent activity widgets.'
      ),
      (
        'dashboard.widget.stock_value.view',
        'dashboard',
        'widget',
        'stock_value',
        'view',
        'Stock Value Widgets',
        'Dashboard Widgets',
        'Allows viewing stock value and cost-derived dashboard widgets.'
      ),
      (
        'dashboard.widget.reorder_value.view',
        'dashboard',
        'widget',
        'reorder_value',
        'view',
        'Reorder Value Widgets',
        'Dashboard Widgets',
        'Allows viewing reorder value and projected purchasing value widgets.'
      ),
      (
        'purchasing_dashboard.widget.stock_requisition_value.view',
        'dashboard',
        'widget',
        'stock_requisition_value',
        'view',
        'Stock Requisition Value',
        'Purchasing Dashboard Widgets',
        'Allows viewing stock requisition total value on purchasing dashboard widgets.'
      ),
      (
        'purchasing_dashboard.widget.damaged_items_value.view',
        'dashboard',
        'widget',
        'damaged_items_value',
        'view',
        'Damaged Items Value',
        'Purchasing Dashboard Widgets',
        'Allows viewing damaged item value on purchasing dashboard widgets.'
      ),
      (
        'purchasing_dashboard.widget.supplier_spend.view',
        'dashboard',
        'widget',
        'supplier_spend',
        'view',
        'Supplier Spend Widgets',
        'Purchasing Dashboard Widgets',
        'Allows viewing supplier spend and supplier value widgets.'
      ),
      (
        'sales_analytics.widget.total_sales.view',
        'analytics',
        'widget',
        'total_sales',
        'view',
        'Sales Analytics Total Sales',
        'Sales Analytics Widgets',
        'Allows viewing total sales values in sales analytics widgets.'
      ),
      (
        'sales_analytics.widget.commissions.view',
        'analytics',
        'widget',
        'commissions',
        'view',
        'Sales Analytics Commissions',
        'Sales Analytics Widgets',
        'Allows viewing commission values in sales analytics widgets.'
      ),
      (
        'sales_analytics.widget.average_order_value.view',
        'analytics',
        'widget',
        'average_order_value',
        'view',
        'Average Order Value',
        'Sales Analytics Widgets',
        'Allows viewing average order value in sales analytics widgets.'
      ),
      (
        'reports.card.financial_reports.view',
        'reports',
        'card',
        'financial_reports',
        'view',
        'Financial Report Cards',
        'Reports Cards',
        'Allows viewing financial report cards and shortcuts.'
      ),
      (
        'reports.card.revenue_reports.view',
        'reports',
        'card',
        'revenue_reports',
        'view',
        'Revenue Report Cards',
        'Reports Cards',
        'Allows viewing revenue and profitability report cards.'
      ),
      (
        'reports.card.valuation_reports.view',
        'reports',
        'card',
        'valuation_reports',
        'view',
        'Valuation Report Cards',
        'Reports Cards',
        'Allows viewing stock valuation and cost-derived report cards.'
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
  AND p.is_granular = TRUE
  AND p.resource IN (
    'dashboard.widget.total_sales.view',
    'dashboard.widget.top_agent_sales.view',
    'dashboard.widget.recent_activity_amount.view',
    'dashboard.widget.stock_value.view',
    'dashboard.widget.reorder_value.view',
    'purchasing_dashboard.widget.stock_requisition_value.view',
    'purchasing_dashboard.widget.damaged_items_value.view',
    'purchasing_dashboard.widget.supplier_spend.view',
    'sales_analytics.widget.total_sales.view',
    'sales_analytics.widget.commissions.view',
    'sales_analytics.widget.average_order_value.view',
    'reports.card.financial_reports.view',
    'reports.card.revenue_reports.view',
    'reports.card.valuation_reports.view'
  )
ON CONFLICT (role_id, permission_id) DO UPDATE
SET
  can_view = TRUE,
  can_create = FALSE,
  can_edit = FALSE,
  can_delete = FALSE;

COMMIT;
