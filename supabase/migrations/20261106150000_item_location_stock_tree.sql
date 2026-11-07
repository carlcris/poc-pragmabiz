BEGIN;

-- Per-warehouse stock for one item, with its max stock and preferred location.
-- Bounded by the caller's accessible warehouses and paginated.
CREATE FUNCTION public.get_item_warehouse_stock_summary(
  p_company_id UUID, p_item_id UUID, p_business_unit_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 1, p_limit INTEGER DEFAULT 20
) RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
WITH stock AS MATERIALIZED (
  SELECT s.warehouse_id, SUM(s.qty_on_hand) AS on_hand, SUM(s.qty_reserved) AS reserved,
    SUM(s.qty_available) AS available, COUNT(DISTINCT s.location_id) AS location_count
  FROM public.item_batch_locations s
  JOIN public.warehouses w ON w.id = s.warehouse_id AND w.deleted_at IS NULL
  JOIN public.warehouse_locations l ON l.id = s.location_id AND l.deleted_at IS NULL
  WHERE s.company_id = p_company_id AND s.item_id = p_item_id AND s.deleted_at IS NULL
    AND s.qty_on_hand > 0
    AND (p_business_unit_id IS NULL OR w.business_unit_id = p_business_unit_id)
    AND p_company_id = (SELECT u.company_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.user_business_unit_access a
      WHERE a.user_id = (SELECT auth.uid()) AND a.business_unit_id = w.business_unit_id)
  GROUP BY s.warehouse_id
), page AS MATERIALIZED (
  SELECT stock.warehouse_id, stock.on_hand, stock.reserved, stock.available, stock.location_count,
    w.warehouse_code, w.warehouse_name
  FROM stock JOIN public.warehouses w ON w.id = stock.warehouse_id
  ORDER BY w.warehouse_code, w.id
  LIMIT LEAST(GREATEST(p_limit, 1), 50)
  OFFSET (GREATEST(p_page, 1) - 1) * LEAST(GREATEST(p_limit, 1), 50)
)
SELECT jsonb_build_object('data', COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
    'warehouseId', page.warehouse_id, 'warehouseCode', page.warehouse_code,
    'warehouseName', page.warehouse_name, 'qtyOnHand', page.on_hand,
    'qtyReserved', page.reserved, 'qtyAvailable', page.available,
    'locationCount', page.location_count, 'maxQuantity', settings.max_quantity,
    'defaultLocationId', preferred.id,
    'defaultLocationName', COALESCE(NULLIF(btrim(preferred.name), ''), preferred.code),
    'defaultLocationNamePath', (
      SELECT string_agg(COALESCE(NULLIF(btrim(a.name), ''), a.code), ' / '
        ORDER BY array_position(preferred.path_ids, a.id))
      FROM public.warehouse_locations a
      WHERE a.id = ANY(preferred.path_ids) AND a.company_id = p_company_id
    )
  ) ORDER BY page.warehouse_code, page.warehouse_id)
  FROM page
  LEFT JOIN public.item_warehouse settings ON settings.item_id = p_item_id
    AND settings.warehouse_id = page.warehouse_id AND settings.company_id = p_company_id
    AND settings.deleted_at IS NULL
  LEFT JOIN public.warehouse_locations preferred ON preferred.id = settings.default_location_id
    AND preferred.deleted_at IS NULL
), '[]'::JSONB), 'pagination', jsonb_build_object(
  'page', GREATEST(p_page, 1), 'limit', LEAST(GREATEST(p_limit, 1), 50),
  'total', (SELECT COUNT(*) FROM stock),
  'totalPages', CEIL((SELECT COUNT(*) FROM stock)::NUMERIC / LEAST(GREATEST(p_limit, 1), 50))
));
$$;
REVOKE ALL ON FUNCTION public.get_item_warehouse_stock_summary(UUID, UUID, UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_item_warehouse_stock_summary(UUID, UUID, UUID, INTEGER, INTEGER) TO authenticated;

-- One level of an item's stock tree: the children of a parent (or the warehouse's top level) whose
-- branch holds the item, with branch totals and stock held directly on each child.
-- Rolled up from the item's stock rows in the warehouse and bounded to 50 children per page.
-- An exact p_location_id returns that branch alone, including a zero-stock selected location.
CREATE FUNCTION public.get_item_location_stock_tree(
  p_company_id UUID, p_item_id UUID, p_warehouse_id UUID, p_business_unit_id UUID DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL, p_page INTEGER DEFAULT 1, p_limit INTEGER DEFAULT 50,
  p_location_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
WITH selected_location AS MATERIALIZED (
  SELECT l.id, l.path_ids
  FROM public.warehouse_locations l
  JOIN public.warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
  WHERE l.id = p_location_id AND l.company_id = p_company_id
    AND l.warehouse_id = p_warehouse_id AND l.deleted_at IS NULL
    AND (p_business_unit_id IS NULL OR w.business_unit_id = p_business_unit_id)
    AND p_company_id = (SELECT u.company_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.user_business_unit_access a
      WHERE a.user_id = (SELECT auth.uid()) AND a.business_unit_id = w.business_unit_id)
    AND EXISTS (SELECT 1 FROM public.items i
      WHERE i.id = p_item_id AND i.company_id = p_company_id AND i.deleted_at IS NULL)
), scope AS MATERIALIZED (
  SELECT CASE WHEN p_location_id IS NOT NULL THEN (
    SELECT cardinality(path_ids) - 1 FROM selected_location
  ) WHEN p_parent_id IS NULL THEN 0 ELSE (
    SELECT cardinality(parent.path_ids) FROM public.warehouse_locations parent
    WHERE parent.id = p_parent_id AND parent.company_id = p_company_id
      AND parent.warehouse_id = p_warehouse_id AND parent.deleted_at IS NULL
  ) END AS parent_depth
), stock AS MATERIALIZED (
  SELECT l.path_ids, SUM(s.qty_on_hand) AS on_hand, SUM(s.qty_reserved) AS reserved,
    SUM(s.qty_available) AS available, COUNT(*) AS batch_count
  FROM public.item_batch_locations s
  JOIN public.warehouses w ON w.id = s.warehouse_id AND w.deleted_at IS NULL
  JOIN public.warehouse_locations l ON l.id = s.location_id AND l.deleted_at IS NULL
  CROSS JOIN scope
  WHERE s.company_id = p_company_id AND s.item_id = p_item_id AND s.warehouse_id = p_warehouse_id
    AND s.deleted_at IS NULL AND s.qty_on_hand > 0
    AND scope.parent_depth IS NOT NULL
    AND (p_parent_id IS NULL OR l.path_ids @> ARRAY[p_parent_id])
    AND (p_location_id IS NULL OR l.path_ids @> ARRAY[p_location_id])
    AND cardinality(l.path_ids) > scope.parent_depth
    AND (p_business_unit_id IS NULL OR w.business_unit_id = p_business_unit_id)
    AND p_company_id = (SELECT u.company_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.user_business_unit_access a
      WHERE a.user_id = (SELECT auth.uid()) AND a.business_unit_id = w.business_unit_id)
  GROUP BY s.location_id, l.path_ids
), stocked_children AS MATERIALIZED (
  SELECT stock.path_ids[scope.parent_depth + 1] AS location_id,
    SUM(stock.on_hand) AS subtree_on_hand, SUM(stock.reserved) AS subtree_reserved,
    SUM(stock.available) AS subtree_available,
    COALESCE(SUM(stock.on_hand) FILTER (WHERE cardinality(stock.path_ids) = scope.parent_depth + 1), 0) AS direct_on_hand,
    COALESCE(SUM(stock.reserved) FILTER (WHERE cardinality(stock.path_ids) = scope.parent_depth + 1), 0) AS direct_reserved,
    COALESCE(SUM(stock.available) FILTER (WHERE cardinality(stock.path_ids) = scope.parent_depth + 1), 0) AS direct_available,
    COALESCE(SUM(stock.batch_count) FILTER (WHERE cardinality(stock.path_ids) = scope.parent_depth + 1), 0) AS direct_batch_count,
    BOOL_OR(cardinality(stock.path_ids) > scope.parent_depth + 1) AS has_stocked_children
  FROM stock CROSS JOIN scope
  GROUP BY stock.path_ids[scope.parent_depth + 1]
), children AS MATERIALIZED (
  SELECT location_id, subtree_on_hand, subtree_reserved, subtree_available,
    direct_on_hand, direct_reserved, direct_available, direct_batch_count, has_stocked_children
  FROM stocked_children
  UNION ALL
  SELECT selected_location.id, 0, 0, 0, 0, 0, 0, 0, FALSE
  FROM selected_location
  WHERE NOT EXISTS (SELECT 1 FROM stocked_children)
), page AS MATERIALIZED (
  SELECT children.location_id, children.subtree_on_hand, children.subtree_reserved,
    children.subtree_available, children.direct_on_hand, children.direct_reserved,
    children.direct_available, children.direct_batch_count, children.has_stocked_children,
    l.code, l.name, l.location_type, l.is_storable, l.path_ids
  FROM children JOIN public.warehouse_locations l ON l.id = children.location_id
  ORDER BY l.code, l.id
  LIMIT LEAST(GREATEST(p_limit, 1), 50)
  OFFSET (GREATEST(p_page, 1) - 1) * LEAST(GREATEST(p_limit, 1), 50)
)
SELECT jsonb_build_object('data', COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
    'locationId', page.location_id, 'warehouseId', p_warehouse_id, 'code', page.code,
    'name', page.name, 'locationType', page.location_type, 'isStorable', page.is_storable,
    'namePath', (
      SELECT string_agg(COALESCE(NULLIF(btrim(a.name), ''), a.code), ' / '
        ORDER BY array_position(page.path_ids, a.id))
      FROM public.warehouse_locations a
      WHERE a.id = ANY(page.path_ids) AND a.company_id = p_company_id
    ),
    'isDefault', COALESCE(settings.default_location_id = page.location_id, FALSE),
    'subtreeOnHand', page.subtree_on_hand, 'subtreeReserved', page.subtree_reserved,
    'subtreeAvailable', page.subtree_available, 'directOnHand', page.direct_on_hand,
    'directReserved', page.direct_reserved, 'directAvailable', page.direct_available,
    'directBatchCount', page.direct_batch_count, 'hasStockedChildren', page.has_stocked_children
  ) ORDER BY page.code, page.location_id)
  FROM page
  LEFT JOIN public.item_warehouse settings ON settings.item_id = p_item_id
    AND settings.warehouse_id = p_warehouse_id AND settings.company_id = p_company_id
    AND settings.deleted_at IS NULL
), '[]'::JSONB), 'pagination', jsonb_build_object(
  'page', GREATEST(p_page, 1), 'limit', LEAST(GREATEST(p_limit, 1), 50),
  'total', (SELECT COUNT(*) FROM children),
  'totalPages', CEIL((SELECT COUNT(*) FROM children)::NUMERIC / LEAST(GREATEST(p_limit, 1), 50))
));
$$;
REVOKE ALL ON FUNCTION public.get_item_location_stock_tree(UUID, UUID, UUID, UUID, UUID, INTEGER, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_item_location_stock_tree(UUID, UUID, UUID, UUID, UUID, INTEGER, INTEGER, UUID) TO authenticated;

COMMIT;
