BEGIN;

CREATE FUNCTION public.get_inventory_box_count_report(
  p_company_id UUID,
  p_category_id UUID,
  p_packing_unit_id UUID,
  p_business_unit_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := (SELECT auth.uid());
  v_business_unit_ids UUID[];
  v_category_name TEXT;
  v_business_unit_name TEXT;
  v_packing_unit_code TEXT;
  v_packing_unit_name TEXT;
  v_result JSONB;
BEGIN
  IF p_page IS NULL OR p_page < 1 OR p_page > 1000000
    OR p_limit IS NULL OR p_limit < 1 OR p_limit > 5000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_BOX_COUNT_FILTERS_INVALID';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users actor
    WHERE actor.id = v_actor_id AND actor.company_id = p_company_id
      AND actor.deleted_at IS NULL AND actor.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'INVENTORY_BOX_COUNT_FORBIDDEN';
  END IF;

  -- Resolve authorization once per business unit, before reading item balances.
  v_business_unit_ids := ARRAY(
    SELECT unit.id
    FROM public.user_business_unit_access access_row
    JOIN public.business_units unit ON unit.id = access_row.business_unit_id
    WHERE access_row.user_id = v_actor_id AND unit.company_id = p_company_id
      AND unit.is_active IS TRUE
      AND (p_business_unit_id IS NULL OR unit.id = p_business_unit_id)
      AND public.user_has_permission(v_actor_id, 'reports', 'view', unit.id)
  );

  IF cardinality(v_business_unit_ids) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'INVENTORY_BOX_COUNT_FORBIDDEN';
  END IF;

  SELECT unit.code, unit.name INTO v_packing_unit_code, v_packing_unit_name
  FROM public.units_of_measure unit
  WHERE unit.id = p_packing_unit_id AND unit.company_id = p_company_id
    AND unit.is_active IS TRUE AND unit.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_BOX_COUNT_PACKING_UNIT_NOT_FOUND';
  END IF;

  SELECT category.name INTO v_category_name
  FROM public.item_categories category
  WHERE category.id = p_category_id AND category.company_id = p_company_id
    AND category.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF p_business_unit_id IS NOT NULL THEN
    SELECT unit.name INTO v_business_unit_name
    FROM public.business_units unit
    WHERE unit.id = p_business_unit_id AND unit.company_id = p_company_id;
  END IF;

  WITH category_items AS MATERIALIZED (
    SELECT item.id, item.item_code, item.item_name, unit.code AS base_unit
    FROM public.items item
    LEFT JOIN public.units_of_measure unit
      ON unit.id = item.uom_id AND unit.company_id = p_company_id
      AND unit.deleted_at IS NULL
    WHERE item.company_id = p_company_id AND item.category_id = p_category_id
      AND item.deleted_at IS NULL
  ), largest_packing_unit AS MATERIALIZED (
    SELECT option.item_id, MAX(option.qty_per_unit) AS qty_per_packing_unit
    FROM category_items item
    JOIN public.item_unit_options option ON option.item_id = item.id
      AND option.company_id = p_company_id
      AND option.deleted_at IS NULL AND option.is_active IS TRUE
    WHERE option.uom_id = p_packing_unit_id
    GROUP BY option.item_id
  ), warehouse_scope AS MATERIALIZED (
    SELECT warehouse.id
    FROM public.warehouses warehouse
    WHERE warehouse.company_id = p_company_id AND warehouse.deleted_at IS NULL
      AND warehouse.business_unit_id = ANY(v_business_unit_ids)
  ), stock_by_item AS (
    SELECT balance.item_id, SUM(COALESCE(balance.current_stock, 0)) AS on_hand
    FROM largest_packing_unit packing
    JOIN public.item_warehouse balance ON balance.item_id = packing.item_id
      AND balance.company_id = p_company_id AND balance.deleted_at IS NULL
    JOIN warehouse_scope warehouse ON warehouse.id = balance.warehouse_id
    GROUP BY balance.item_id
  ), item_counts AS MATERIALIZED (
    SELECT item.id, item.item_code, item.item_name, item.base_unit,
      COALESCE(stock.on_hand, 0) AS on_hand, packing.qty_per_packing_unit,
      DIV(GREATEST(COALESCE(stock.on_hand, 0), 0), packing.qty_per_packing_unit) AS full_packing_units,
      MOD(GREATEST(COALESCE(stock.on_hand, 0), 0), packing.qty_per_packing_unit) AS loose_units
    FROM largest_packing_unit packing
    JOIN category_items item ON item.id = packing.item_id
    LEFT JOIN stock_by_item stock ON stock.item_id = item.id
  ), summary AS (
    SELECT COUNT(*) AS total_items, COALESCE(SUM(item.full_packing_units), 0) AS total_full_packing_units,
      (SELECT COUNT(*) FROM category_items) - COUNT(*) AS items_without_packing_unit_size
    FROM item_counts item
  ), page AS (
    SELECT item.id, item.item_code, item.item_name, item.base_unit,
      item.on_hand, item.qty_per_packing_unit, item.full_packing_units, item.loose_units
    FROM item_counts item
    ORDER BY item.item_name, item.item_code, item.id
    LIMIT p_limit OFFSET (p_page::BIGINT - 1) * p_limit
  )
  SELECT jsonb_build_object(
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'itemId', item.id, 'itemCode', item.item_code, 'itemName', item.item_name,
        'baseUnit', item.base_unit, 'onHand', item.on_hand, 'qtyPerPackingUnit', item.qty_per_packing_unit,
        'fullPackingUnits', item.full_packing_units, 'looseUnits', item.loose_units
      ) ORDER BY item.item_name, item.item_code, item.id)
      FROM page item
    ), '[]'::JSONB),
    'summary', jsonb_build_object(
      'totalItems', summary.total_items, 'totalFullPackingUnits', summary.total_full_packing_units,
      'itemsWithoutPackingUnitSize', summary.items_without_packing_unit_size
    ),
    'pagination', jsonb_build_object(
      'page', p_page, 'limit', p_limit,
      'totalPages', CEIL(summary.total_items::NUMERIC / p_limit)
    ),
    'category', jsonb_build_object('id', p_category_id, 'name', v_category_name),
    'packingUnit', jsonb_build_object(
      'id', p_packing_unit_id, 'code', v_packing_unit_code, 'name', v_packing_unit_name
    ),
    'businessUnit', CASE WHEN p_business_unit_id IS NOT NULL THEN
      jsonb_build_object('id', p_business_unit_id, 'name', v_business_unit_name)
      ELSE NULL END
  ) INTO v_result FROM summary;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_inventory_box_count_report(UUID, UUID, UUID, UUID, INTEGER, INTEGER) IS
  'One row per category item with an active conversion for the selected packing unit, using its largest matching size and complete eligible-item totals before pagination. The missing-size count records excluded category items. Business unit scope requires membership and reports view permission.';

REVOKE ALL ON FUNCTION public.get_inventory_box_count_report(UUID, UUID, UUID, UUID, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_box_count_report(UUID, UUID, UUID, UUID, INTEGER, INTEGER) TO authenticated;

COMMIT;
