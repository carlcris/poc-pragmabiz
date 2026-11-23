-- Show batches with stock on hand in Item Locations, including fully reserved batches.
-- Retain depleted records and all existing location/warehouse quantity aggregates.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_item_location_stock_page(
  p_company_id UUID, p_item_id UUID, p_business_unit_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 1, p_limit INTEGER DEFAULT 20, p_search TEXT DEFAULT NULL,
  p_location_id UUID DEFAULT NULL, p_batch_page INTEGER DEFAULT 1
) RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
WITH stocks AS MATERIALIZED (
  SELECT stock.location_id, stock.warehouse_id, SUM(stock.qty_on_hand) AS on_hand,
    SUM(stock.qty_reserved) AS reserved, SUM(stock.qty_available) AS available
  FROM public.item_batch_locations stock
  JOIN public.warehouses w ON w.id = stock.warehouse_id AND w.deleted_at IS NULL
  JOIN public.warehouse_locations l ON l.id = stock.location_id AND l.deleted_at IS NULL
  WHERE stock.company_id = p_company_id AND stock.item_id = p_item_id AND stock.deleted_at IS NULL
    AND (p_business_unit_id IS NULL OR w.business_unit_id = p_business_unit_id)
    AND p_company_id = (SELECT u.company_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.user_business_unit_access a
      WHERE a.user_id = (SELECT auth.uid()) AND a.business_unit_id = w.business_unit_id)
  GROUP BY stock.location_id, stock.warehouse_id
), eligible AS MATERIALIZED (
  SELECT stocks.location_id, stocks.warehouse_id, stocks.on_hand, stocks.reserved, stocks.available,
    l.code, l.name, l.location_type, l.location_path, l.path_ids,
    w.warehouse_code, w.warehouse_name
  FROM stocks JOIN public.warehouse_locations l ON l.id = stocks.location_id
  JOIN public.warehouses w ON w.id = stocks.warehouse_id
  WHERE (p_location_id IS NULL OR l.id = p_location_id)
    AND (NULLIF(btrim(p_search), '') IS NULL OR l.location_path ILIKE '%' || p_search || '%')
), page AS MATERIALIZED (
  SELECT location_id, warehouse_id, on_hand, reserved, available, code, name,
    location_type, location_path, path_ids, warehouse_code, warehouse_name
  FROM eligible ORDER BY warehouse_code, location_path, location_id
  LIMIT LEAST(GREATEST(p_limit, 1), 50) OFFSET (GREATEST(p_page, 1)-1)*LEAST(GREATEST(p_limit, 1),50)
)
SELECT jsonb_build_object('data', COALESCE((
  SELECT jsonb_agg(jsonb_build_object(
    'id', page.warehouse_id::TEXT || ':' || page.location_id::TEXT, 'itemId', p_item_id,
    'warehouseId', page.warehouse_id, 'locationId', page.location_id,
    'warehouseCode', page.warehouse_code, 'warehouseName', page.warehouse_name,
    'locationCode', page.code, 'locationName', page.name, 'locationType', page.location_type,
    'locationPath', page.location_path, 'pathIds', page.path_ids,
    -- Display path by name (code only where a location has no name); bounded by page size and depth.
    'locationNamePath', (
      SELECT string_agg(COALESCE(NULLIF(btrim(a.name), ''), a.code), ' / '
        ORDER BY array_position(page.path_ids, a.id))
      FROM public.warehouse_locations a
      WHERE a.id = ANY(page.path_ids) AND a.company_id = p_company_id
    ),
    'qtyOnHand', page.on_hand, 'qtyReserved', page.reserved, 'qtyAvailable', page.available,
    'warehouseOnHand', (SELECT SUM(s.on_hand) FROM stocks s WHERE s.warehouse_id = page.warehouse_id),
    'maxQuantity', settings.max_quantity, 'defaultLocationId', settings.default_location_id,
    'isDefault', COALESCE(settings.default_location_id = page.location_id, false),
    'batchCount', batches.batch_count, 'batchPage', GREATEST(p_batch_page,1), 'batchPageSize', 20,
    'batches', COALESCE(batches.rows, '[]'::JSONB)
  ) ORDER BY page.warehouse_code, page.location_path, page.location_id)
  FROM page
  LEFT JOIN public.item_warehouse settings ON settings.item_id = p_item_id
    AND settings.warehouse_id = page.warehouse_id AND settings.company_id = p_company_id AND settings.deleted_at IS NULL
  CROSS JOIN LATERAL (
    -- Reuse the eligibility predicate for both the exact count and the ordered page.
    -- Inline it so counting needs no materialized batch payload and paging stays bounded.
    WITH eligible_batches AS NOT MATERIALIZED (
      SELECT bl.id, batch.batch_code, batch.received_at, batch.expiration_date,
        bl.qty_on_hand, bl.qty_reserved, bl.qty_available
      FROM public.item_batch_locations bl JOIN public.item_batches batch ON batch.id = bl.item_batch_id
      WHERE bl.item_id = p_item_id AND bl.location_id = page.location_id AND bl.company_id = p_company_id
        AND bl.deleted_at IS NULL AND batch.deleted_at IS NULL AND bl.qty_on_hand > 0
    )
    SELECT (SELECT COUNT(*) FROM eligible_batches) AS batch_count,
      (
        SELECT jsonb_agg(jsonb_build_object('id', b.id, 'batchCode', b.batch_code, 'receivedAt', b.received_at,
          'expirationDate', b.expiration_date,
          'qtyOnHand', b.qty_on_hand, 'qtyReserved', b.qty_reserved, 'qtyAvailable', b.qty_available)
          ORDER BY b.received_at, b.id)
        FROM (
          SELECT id, batch_code, received_at, expiration_date, qty_on_hand, qty_reserved, qty_available
          FROM eligible_batches
          ORDER BY received_at, id LIMIT 20 OFFSET (GREATEST(p_batch_page,1)-1)*20
        ) b
      ) AS rows
  ) batches
), '[]'::JSONB), 'pagination', jsonb_build_object(
  'page', GREATEST(p_page,1), 'limit', LEAST(GREATEST(p_limit,1),50),
  'total', (SELECT COUNT(*) FROM eligible),
  'totalPages', CEIL((SELECT COUNT(*) FROM eligible)::NUMERIC / LEAST(GREATEST(p_limit,1),50))
));
$$;
REVOKE ALL ON FUNCTION public.get_item_location_stock_page(UUID, UUID, UUID, INTEGER, INTEGER, TEXT, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_item_location_stock_page(UUID, UUID, UUID, INTEGER, INTEGER, TEXT, UUID, INTEGER) TO authenticated;

COMMIT;
