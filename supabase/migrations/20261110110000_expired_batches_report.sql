BEGIN;
CREATE INDEX idx_item_batches_expiration_report ON public.item_batches(company_id, expiration_date, id)
  WHERE deleted_at IS NULL AND expiration_date IS NOT NULL AND qty_on_hand > 0;

CREATE FUNCTION public.get_expired_batches_report(
  p_company_id UUID, p_as_of DATE, p_business_unit_id UUID DEFAULT NULL,
  p_warehouse_id UUID DEFAULT NULL, p_category_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_group_by TEXT DEFAULT 'item', p_page INTEGER DEFAULT 1, p_limit INTEGER DEFAULT 20
) RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
WITH filtered AS MATERIALIZED (
  SELECT b.id, b.expiration_date,
    CASE WHEN p_group_by = 'batch' THEN b.batch_code ELSE i.id::TEXT END AS group_key,
    CASE WHEN p_group_by = 'batch' THEN b.batch_code ELSE i.item_code || ' - ' || i.item_name END AS group_label
  FROM public.item_batches b
  JOIN public.items i ON i.id = b.item_id AND i.company_id = b.company_id AND i.deleted_at IS NULL
  JOIN public.warehouses w ON w.id = b.warehouse_id AND w.company_id = b.company_id AND w.deleted_at IS NULL
  WHERE b.company_id = p_company_id AND b.deleted_at IS NULL AND b.expiration_date < p_as_of
    AND b.qty_on_hand > 0
    AND (p_business_unit_id IS NULL OR w.business_unit_id = p_business_unit_id)
    AND (p_warehouse_id IS NULL OR b.warehouse_id = p_warehouse_id)
    AND (p_category_id IS NULL OR i.category_id = p_category_id)
    AND (NULLIF(BTRIM(p_search), '') IS NULL OR b.batch_code ILIKE '%' || p_search || '%'
      OR i.item_code ILIKE '%' || p_search || '%' OR i.item_name ILIKE '%' || p_search || '%')
    AND p_company_id = (SELECT u.company_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
    AND w.business_unit_id IN (SELECT a.business_unit_id FROM public.user_business_unit_access a WHERE a.user_id = (SELECT auth.uid()))
), groups AS MATERIALIZED (
  SELECT group_key, group_label, COUNT(*) AS row_count FROM filtered GROUP BY group_key, group_label
), paged_groups AS (
  SELECT group_key, group_label, row_count FROM groups ORDER BY group_label, group_key
  LIMIT LEAST(GREATEST(p_limit, 1), 501) OFFSET (GREATEST(p_page, 1)-1)*LEAST(GREATEST(p_limit, 1),501)
), page AS (
  SELECT f.id, f.expiration_date, f.group_key, f.group_label FROM filtered f
  JOIN paged_groups g ON g.group_key = f.group_key
  ORDER BY f.group_label, f.group_key, f.expiration_date, f.id LIMIT 501
)
SELECT jsonb_build_object(
  'data', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', b.id, 'itemId', b.item_id, 'itemCode', i.item_code, 'itemName', i.item_name,
    'warehouseId', b.warehouse_id, 'warehouse', w.warehouse_code || ' - ' || w.warehouse_name,
    'batchCode', b.batch_code, 'expirationDate', b.expiration_date,
    'daysExpired', p_as_of - b.expiration_date, 'qtyOnHand', b.qty_on_hand,
    'qtyReserved', b.qty_reserved, 'qtyAvailable', b.qty_available, 'unit', u.code,
    'groupKey', page.group_key, 'groupLabel', page.group_label
  ) ORDER BY page.group_label, page.group_key, page.expiration_date, page.id)
  FROM page JOIN public.item_batches b ON b.id = page.id
  JOIN public.items i ON i.id = b.item_id JOIN public.warehouses w ON w.id = b.warehouse_id
  LEFT JOIN public.units_of_measure u ON u.id = i.uom_id), '[]'::JSONB),
  'totalRows', (SELECT COUNT(*) FROM filtered),
  'pageRows', COALESCE((SELECT SUM(row_count) FROM paged_groups),0),
  'pagination', jsonb_build_object('page', GREATEST(p_page,1), 'limit', LEAST(GREATEST(p_limit,1),501),
    'total', (SELECT COUNT(*) FROM groups), 'totalPages', CEIL((SELECT COUNT(*) FROM groups)::NUMERIC / LEAST(GREATEST(p_limit,1),501)))
);
$$;
REVOKE ALL ON FUNCTION public.get_expired_batches_report(UUID, DATE, UUID, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_expired_batches_report(UUID, DATE, UUID, UUID, UUID, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
COMMIT;
