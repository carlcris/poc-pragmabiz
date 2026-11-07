BEGIN;

-- Expand-all uses warehouse-wide pages, not one stock/capacity query per parent.
-- Invoker access and the existing company/BU membership truth set are preserved.
CREATE FUNCTION public.get_warehouse_location_tree_page(
  p_company_id UUID, p_warehouse_id UUID, p_business_unit_id UUID,
  p_item_id UUID DEFAULT NULL, p_page INTEGER DEFAULT 1, p_limit INTEGER DEFAULT 500
) RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
WITH warehouse_scope AS MATERIALIZED (
  SELECT w.id FROM public.warehouses w
  WHERE w.id = p_warehouse_id AND w.company_id = p_company_id
    AND w.business_unit_id = p_business_unit_id AND w.deleted_at IS NULL
    AND p_company_id = (SELECT u.company_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
    AND w.business_unit_id IN (SELECT a.business_unit_id FROM public.user_business_unit_access a
      WHERE a.user_id = (SELECT auth.uid()))
), stock AS MATERIALIZED (
  SELECT l.id, l.path_ids, SUM(s.qty_on_hand) AS on_hand, SUM(s.qty_available) AS available
  FROM public.item_batch_locations s
  JOIN public.warehouse_locations l ON l.id = s.location_id AND l.deleted_at IS NULL
  WHERE p_item_id IS NOT NULL AND s.item_id = p_item_id AND s.company_id = p_company_id
    AND s.warehouse_id IN (SELECT id FROM warehouse_scope)
    AND s.deleted_at IS NULL AND s.qty_on_hand > 0
  GROUP BY l.id, l.path_ids
), totals AS MATERIALIZED (
  SELECT ancestor.id,
    SUM(stock.on_hand) AS on_hand, SUM(stock.available) AS available,
    COALESCE(SUM(stock.on_hand) FILTER (WHERE stock.id = ancestor.id), 0) AS direct_on_hand,
    COALESCE(SUM(stock.available) FILTER (WHERE stock.id = ancestor.id), 0) AS direct_available,
    BOOL_OR(stock.id <> ancestor.id) AS has_children
  FROM stock CROSS JOIN LATERAL unnest(stock.path_ids) AS ancestor(id)
  GROUP BY ancestor.id
), locations AS MATERIALIZED (
  SELECT l.id, l.parent_id, l.code, l.name, l.location_type, l.is_active,
    totals.on_hand, totals.available, totals.direct_on_hand, totals.direct_available,
    totals.has_children,
    EXISTS (SELECT 1 FROM public.item_warehouse settings WHERE settings.company_id = p_company_id
      AND settings.item_id = p_item_id AND settings.warehouse_id = p_warehouse_id
      AND settings.default_location_id = l.id AND settings.deleted_at IS NULL) AS is_default
  FROM public.warehouse_locations l LEFT JOIN totals ON totals.id = l.id
  WHERE l.company_id = p_company_id AND l.warehouse_id IN (SELECT id FROM warehouse_scope)
    AND l.deleted_at IS NULL AND (p_item_id IS NULL OR totals.id IS NOT NULL)
), page AS (
  SELECT id, parent_id, code, name, location_type, is_active, on_hand, available,
    direct_on_hand, direct_available, has_children, is_default FROM locations
  ORDER BY code, id
  LIMIT LEAST(GREATEST(p_limit, 1), 500)
  OFFSET (GREATEST(p_page, 1) - 1) * LEAST(GREATEST(p_limit, 1), 500)
)
SELECT jsonb_build_object('data', COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'parentId', parent_id, 'code', code, 'name', name,
    'locationType', location_type, 'isActive', is_active, 'isDefault', is_default,
    'hasChildren', CASE WHEN p_item_id IS NULL THEN EXISTS (
      SELECT 1 FROM public.warehouse_locations child WHERE child.parent_id = page.id
        AND child.warehouse_id = p_warehouse_id AND child.company_id = p_company_id
        AND child.deleted_at IS NULL
    ) ELSE has_children END,
    'onHand', on_hand, 'available', available,
    'directOnHand', direct_on_hand, 'directAvailable', direct_available
  ) ORDER BY code, id) FROM page
), '[]'::jsonb), 'pagination', jsonb_build_object(
  'page', GREATEST(p_page, 1), 'limit', LEAST(GREATEST(p_limit, 1), 500),
  'total', (SELECT COUNT(*) FROM locations),
  'totalPages', CEIL((SELECT COUNT(*) FROM locations)::numeric / LEAST(GREATEST(p_limit, 1), 500))
));
$$;
REVOKE ALL ON FUNCTION public.get_warehouse_location_tree_page(UUID, UUID, UUID, UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_warehouse_location_tree_page(UUID, UUID, UUID, UUID, INTEGER, INTEGER) TO authenticated;
COMMIT;
