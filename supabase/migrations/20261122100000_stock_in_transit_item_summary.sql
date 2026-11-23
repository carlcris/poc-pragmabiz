BEGIN;

DROP FUNCTION public.get_stock_in_transit_page(UUID, UUID, TEXT, INTEGER, INTEGER);

CREATE FUNCTION public.get_stock_in_transit_item_summary_page(
  p_company_id UUID,
  p_as_of_date DATE,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  base_unit_name TEXT,
  total_base_quantity NUMERIC,
  ordered_unit_totals JSONB,
  shipment_count BIGINT,
  next_estimated_arrival_date DATE,
  next_days_until_arrival INTEGER,
  next_arrival_window TEXT,
  total_count BIGINT,
  load_list_count BIGINT,
  late_load_list_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
WITH active_lines AS (
  SELECT
    load_lists.id AS load_list_id,
    load_lists.estimated_arrival_date,
    items.id AS item_id,
    items.item_code::TEXT AS item_code,
    items.item_name::TEXT AS item_name,
    units_of_measure.name::TEXT AS base_unit_name,
    load_list_items.unit_name::TEXT AS ordered_unit_name,
    load_list_items.qty_per_unit,
    load_list_items.load_list_qty AS ordered_quantity,
    load_list_items.load_list_qty * load_list_items.qty_per_unit AS base_quantity,
    (
      p_search IS NULL
      OR p_search = ''
      OR load_lists.ll_number ILIKE ('%' || p_search || '%')
      OR suppliers.supplier_code ILIKE ('%' || p_search || '%')
      OR suppliers.supplier_name ILIKE ('%' || p_search || '%')
      OR items.item_code ILIKE ('%' || p_search || '%')
      OR items.item_name ILIKE ('%' || p_search || '%')
      OR destination_business_unit.code ILIKE ('%' || p_search || '%')
      OR destination_business_unit.name ILIKE ('%' || p_search || '%')
    ) IS TRUE AS matches_search
  FROM public.load_lists
  INNER JOIN public.load_list_items
    ON load_list_items.load_list_id = load_lists.id
  INNER JOIN public.items
    ON items.id = load_list_items.item_id
   AND items.company_id = load_lists.company_id
   AND items.deleted_at IS NULL
  INNER JOIN public.suppliers
    ON suppliers.id = load_lists.supplier_id
   AND suppliers.company_id = load_lists.company_id
   AND suppliers.deleted_at IS NULL
  INNER JOIN public.business_units AS source_business_unit
    ON source_business_unit.id = load_lists.business_unit_id
   AND source_business_unit.company_id = load_lists.company_id
   AND source_business_unit.is_active IS TRUE
  LEFT JOIN public.business_units AS destination_business_unit
    ON destination_business_unit.id = load_lists.destination_business_unit_id
   AND destination_business_unit.company_id = load_lists.company_id
  LEFT JOIN public.units_of_measure
    ON units_of_measure.id = items.uom_id
   AND units_of_measure.company_id = items.company_id
  WHERE load_lists.company_id = p_company_id
    AND load_lists.status = 'in_transit'
    AND load_lists.deleted_at IS NULL
),
matching_items AS (
  SELECT DISTINCT active_lines.item_id
  FROM active_lines
  WHERE active_lines.matches_search
),
scoped_lines AS (
  SELECT
    active_lines.load_list_id,
    active_lines.estimated_arrival_date,
    active_lines.item_id,
    active_lines.item_code,
    active_lines.item_name,
    active_lines.base_unit_name,
    active_lines.ordered_unit_name,
    active_lines.qty_per_unit,
    active_lines.ordered_quantity,
    active_lines.base_quantity
  FROM active_lines
  INNER JOIN matching_items
    ON matching_items.item_id = active_lines.item_id
),
item_totals AS (
  SELECT
    scoped_lines.item_id,
    scoped_lines.item_code,
    scoped_lines.item_name,
    scoped_lines.base_unit_name,
    SUM(scoped_lines.base_quantity) AS total_base_quantity,
    COUNT(DISTINCT scoped_lines.load_list_id) AS shipment_count,
    MIN(scoped_lines.estimated_arrival_date) AS next_estimated_arrival_date
  FROM scoped_lines
  GROUP BY
    scoped_lines.item_id,
    scoped_lines.item_code,
    scoped_lines.item_name,
    scoped_lines.base_unit_name
),
load_list_totals AS (
  SELECT
    COUNT(DISTINCT scoped_lines.load_list_id) AS load_list_count,
    COUNT(DISTINCT scoped_lines.load_list_id) FILTER (
      WHERE scoped_lines.estimated_arrival_date < p_as_of_date
    ) AS late_load_list_count
  FROM scoped_lines
),
paged_items AS (
  SELECT
    item_totals.item_id,
    item_totals.item_code,
    item_totals.item_name,
    item_totals.base_unit_name,
    item_totals.total_base_quantity,
    item_totals.shipment_count,
    item_totals.next_estimated_arrival_date,
    COUNT(*) OVER() AS total_count
  FROM item_totals
  ORDER BY item_totals.item_code ASC, item_totals.item_id ASC
  OFFSET (GREATEST(p_page, 1)::BIGINT - 1) * LEAST(GREATEST(p_limit, 1), 50)
  LIMIT LEAST(GREATEST(p_limit, 1), 50)
),
ordered_unit_quantities AS (
  SELECT
    scoped_lines.item_id,
    scoped_lines.ordered_unit_name,
    scoped_lines.qty_per_unit,
    SUM(scoped_lines.ordered_quantity) AS ordered_quantity,
    SUM(scoped_lines.base_quantity) AS base_quantity
  FROM scoped_lines
  INNER JOIN paged_items
    ON paged_items.item_id = scoped_lines.item_id
  GROUP BY
    scoped_lines.item_id,
    scoped_lines.ordered_unit_name,
    scoped_lines.qty_per_unit
),
item_ordered_units AS (
  SELECT
    ordered_unit_quantities.item_id,
    jsonb_agg(
      jsonb_build_object(
        'unit_name', ordered_unit_quantities.ordered_unit_name,
        'qty_per_unit', ordered_unit_quantities.qty_per_unit,
        'quantity', ordered_unit_quantities.ordered_quantity
      )
      ORDER BY
        ordered_unit_quantities.base_quantity DESC,
        ordered_unit_quantities.ordered_unit_name ASC,
        ordered_unit_quantities.qty_per_unit ASC
    ) AS ordered_unit_totals
  FROM ordered_unit_quantities
  GROUP BY ordered_unit_quantities.item_id
)
SELECT
  paged_items.item_id,
  paged_items.item_code,
  paged_items.item_name,
  paged_items.base_unit_name,
  paged_items.total_base_quantity,
  item_ordered_units.ordered_unit_totals,
  paged_items.shipment_count,
  paged_items.next_estimated_arrival_date,
  (paged_items.next_estimated_arrival_date - p_as_of_date)::INTEGER AS next_days_until_arrival,
  CASE
    WHEN paged_items.next_estimated_arrival_date IS NULL THEN 'no_eta'
    WHEN paged_items.next_estimated_arrival_date < p_as_of_date THEN 'late'
    WHEN paged_items.next_estimated_arrival_date <= p_as_of_date + 6 THEN 'next_7_days'
    WHEN paged_items.next_estimated_arrival_date <= p_as_of_date + 13 THEN 'days_8_to_14'
    ELSE 'later'
  END AS next_arrival_window,
  paged_items.total_count,
  load_list_totals.load_list_count,
  load_list_totals.late_load_list_count
FROM paged_items
INNER JOIN item_ordered_units
  ON item_ordered_units.item_id = paged_items.item_id
CROSS JOIN load_list_totals
ORDER BY paged_items.item_code ASC, paged_items.item_id ASC;
$$;

COMMENT ON FUNCTION public.get_stock_in_transit_item_summary_page(
  UUID, DATE, TEXT, INTEGER, INTEGER
) IS 'Returns a bounded page of items in transit across a company with ordered-unit and base-unit totals. Search can match the item, load list, supplier, or destination, while each returned item keeps its complete in-transit total.';

GRANT EXECUTE ON FUNCTION public.get_stock_in_transit_item_summary_page(
  UUID, DATE, TEXT, INTEGER, INTEGER
) TO authenticated;

CREATE FUNCTION public.get_stock_in_transit_item_arrivals_page(
  p_company_id UUID,
  p_item_id UUID,
  p_as_of_date DATE,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  load_list_id UUID,
  ll_number TEXT,
  supplier_name TEXT,
  source_business_unit_id UUID,
  destination_business_unit_id UUID,
  destination_business_unit_name TEXT,
  estimated_arrival_date DATE,
  days_until_arrival INTEGER,
  arrival_window TEXT,
  liner_name TEXT,
  container_number TEXT,
  base_quantity NUMERIC,
  ordered_unit_totals JSONB,
  arrival_base_quantity NUMERIC,
  arrival_ordered_unit_totals JSONB,
  arrival_shipment_count BIGINT,
  arrival_container_count BIGINT,
  arrival_destination_totals JSONB,
  late_base_quantity NUMERIC,
  next_7_days_base_quantity NUMERIC,
  days_8_to_14_base_quantity NUMERIC,
  later_base_quantity NUMERIC,
  no_eta_base_quantity NUMERIC,
  arrival_window_ordered_unit_totals JSONB,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
WITH shipment_lines AS (
  SELECT
    load_lists.id AS load_list_id,
    load_lists.ll_number::TEXT AS ll_number,
    suppliers.supplier_name::TEXT AS supplier_name,
    load_lists.business_unit_id AS source_business_unit_id,
    load_lists.destination_business_unit_id,
    destination_business_unit.name::TEXT AS destination_business_unit_name,
    load_lists.estimated_arrival_date,
    CASE
      WHEN load_lists.estimated_arrival_date IS NULL THEN 'no_eta'
      WHEN load_lists.estimated_arrival_date < p_as_of_date THEN 'late'
      WHEN load_lists.estimated_arrival_date <= p_as_of_date + 6 THEN 'next_7_days'
      WHEN load_lists.estimated_arrival_date <= p_as_of_date + 13 THEN 'days_8_to_14'
      ELSE 'later'
    END AS arrival_window,
    NULLIF(BTRIM(load_lists.liner_name), '')::TEXT AS liner_name,
    NULLIF(BTRIM(load_lists.container_number), '')::TEXT AS container_number,
    load_list_items.unit_name::TEXT AS ordered_unit_name,
    load_list_items.qty_per_unit,
    load_list_items.load_list_qty AS ordered_quantity,
    load_list_items.load_list_qty * load_list_items.qty_per_unit AS base_quantity
  FROM public.load_list_items
  INNER JOIN public.load_lists
    ON load_lists.id = load_list_items.load_list_id
  INNER JOIN public.items
    ON items.id = load_list_items.item_id
   AND items.company_id = load_lists.company_id
   AND items.deleted_at IS NULL
  INNER JOIN public.suppliers
    ON suppliers.id = load_lists.supplier_id
   AND suppliers.company_id = load_lists.company_id
   AND suppliers.deleted_at IS NULL
  INNER JOIN public.business_units AS source_business_unit
    ON source_business_unit.id = load_lists.business_unit_id
   AND source_business_unit.company_id = load_lists.company_id
   AND source_business_unit.is_active IS TRUE
  LEFT JOIN public.business_units AS destination_business_unit
    ON destination_business_unit.id = load_lists.destination_business_unit_id
   AND destination_business_unit.company_id = load_lists.company_id
  WHERE load_list_items.item_id = p_item_id
    AND load_lists.company_id = p_company_id
    AND load_lists.status = 'in_transit'
    AND load_lists.deleted_at IS NULL
),
shipments AS (
  SELECT
    shipment_lines.load_list_id,
    shipment_lines.ll_number,
    shipment_lines.supplier_name,
    shipment_lines.source_business_unit_id,
    shipment_lines.destination_business_unit_id,
    shipment_lines.destination_business_unit_name,
    shipment_lines.estimated_arrival_date,
    shipment_lines.arrival_window,
    shipment_lines.liner_name,
    shipment_lines.container_number,
    SUM(shipment_lines.base_quantity) AS base_quantity
  FROM shipment_lines
  GROUP BY
    shipment_lines.load_list_id,
    shipment_lines.ll_number,
    shipment_lines.supplier_name,
    shipment_lines.source_business_unit_id,
    shipment_lines.destination_business_unit_id,
    shipment_lines.destination_business_unit_name,
    shipment_lines.estimated_arrival_date,
    shipment_lines.arrival_window,
    shipment_lines.liner_name,
    shipment_lines.container_number
),
shipment_unit_quantities AS (
  SELECT
    shipment_lines.load_list_id,
    shipment_lines.ordered_unit_name,
    shipment_lines.qty_per_unit,
    SUM(shipment_lines.ordered_quantity) AS ordered_quantity,
    SUM(shipment_lines.base_quantity) AS base_quantity
  FROM shipment_lines
  GROUP BY
    shipment_lines.load_list_id,
    shipment_lines.ordered_unit_name,
    shipment_lines.qty_per_unit
),
shipment_units AS (
  SELECT
    shipment_unit_quantities.load_list_id,
    jsonb_agg(
      jsonb_build_object(
        'unit_name', shipment_unit_quantities.ordered_unit_name,
        'qty_per_unit', shipment_unit_quantities.qty_per_unit,
        'quantity', shipment_unit_quantities.ordered_quantity
      )
      ORDER BY
        shipment_unit_quantities.base_quantity DESC,
        shipment_unit_quantities.ordered_unit_name ASC,
        shipment_unit_quantities.qty_per_unit ASC
    ) AS ordered_unit_totals
  FROM shipment_unit_quantities
  GROUP BY shipment_unit_quantities.load_list_id
),
arrival_unit_quantities AS (
  SELECT
    shipment_lines.estimated_arrival_date,
    shipment_lines.ordered_unit_name,
    shipment_lines.qty_per_unit,
    SUM(shipment_lines.ordered_quantity) AS ordered_quantity,
    SUM(shipment_lines.base_quantity) AS base_quantity
  FROM shipment_lines
  GROUP BY
    shipment_lines.estimated_arrival_date,
    shipment_lines.ordered_unit_name,
    shipment_lines.qty_per_unit
),
arrival_units AS (
  SELECT
    arrival_unit_quantities.estimated_arrival_date,
    jsonb_agg(
      jsonb_build_object(
        'unit_name', arrival_unit_quantities.ordered_unit_name,
        'qty_per_unit', arrival_unit_quantities.qty_per_unit,
        'quantity', arrival_unit_quantities.ordered_quantity
      )
      ORDER BY
        arrival_unit_quantities.base_quantity DESC,
        arrival_unit_quantities.ordered_unit_name ASC,
        arrival_unit_quantities.qty_per_unit ASC
    ) AS ordered_unit_totals
  FROM arrival_unit_quantities
  GROUP BY arrival_unit_quantities.estimated_arrival_date
),
destination_unit_quantities AS (
  SELECT
    shipment_lines.estimated_arrival_date,
    shipment_lines.destination_business_unit_id,
    shipment_lines.destination_business_unit_name,
    shipment_lines.ordered_unit_name,
    shipment_lines.qty_per_unit,
    SUM(shipment_lines.ordered_quantity) AS ordered_quantity,
    SUM(shipment_lines.base_quantity) AS base_quantity
  FROM shipment_lines
  GROUP BY
    shipment_lines.estimated_arrival_date,
    shipment_lines.destination_business_unit_id,
    shipment_lines.destination_business_unit_name,
    shipment_lines.ordered_unit_name,
    shipment_lines.qty_per_unit
),
destination_quantities AS (
  SELECT
    destination_unit_quantities.estimated_arrival_date,
    destination_unit_quantities.destination_business_unit_id,
    destination_unit_quantities.destination_business_unit_name,
    SUM(destination_unit_quantities.base_quantity) AS base_quantity,
    jsonb_agg(
      jsonb_build_object(
        'unit_name', destination_unit_quantities.ordered_unit_name,
        'qty_per_unit', destination_unit_quantities.qty_per_unit,
        'quantity', destination_unit_quantities.ordered_quantity
      )
      ORDER BY
        destination_unit_quantities.base_quantity DESC,
        destination_unit_quantities.ordered_unit_name ASC,
        destination_unit_quantities.qty_per_unit ASC
    ) AS ordered_unit_totals
  FROM destination_unit_quantities
  GROUP BY
    destination_unit_quantities.estimated_arrival_date,
    destination_unit_quantities.destination_business_unit_id,
    destination_unit_quantities.destination_business_unit_name
),
arrival_destinations AS (
  SELECT
    destination_quantities.estimated_arrival_date,
    jsonb_agg(
      jsonb_build_object(
        'destination_business_unit_id', destination_quantities.destination_business_unit_id,
        'destination_business_unit_name', destination_quantities.destination_business_unit_name,
        'base_quantity', destination_quantities.base_quantity,
        'ordered_unit_totals', destination_quantities.ordered_unit_totals
      )
      ORDER BY
        destination_quantities.base_quantity DESC,
        destination_quantities.destination_business_unit_name ASC NULLS LAST,
        destination_quantities.destination_business_unit_id ASC
    ) AS destination_totals
  FROM destination_quantities
  GROUP BY destination_quantities.estimated_arrival_date
),
window_unit_quantities AS (
  SELECT
    shipment_lines.arrival_window,
    shipment_lines.ordered_unit_name,
    shipment_lines.qty_per_unit,
    SUM(shipment_lines.ordered_quantity) AS ordered_quantity,
    SUM(shipment_lines.base_quantity) AS base_quantity
  FROM shipment_lines
  GROUP BY
    shipment_lines.arrival_window,
    shipment_lines.ordered_unit_name,
    shipment_lines.qty_per_unit
),
window_units AS (
  SELECT
    window_unit_quantities.arrival_window,
    jsonb_agg(
      jsonb_build_object(
        'unit_name', window_unit_quantities.ordered_unit_name,
        'qty_per_unit', window_unit_quantities.qty_per_unit,
        'quantity', window_unit_quantities.ordered_quantity
      )
      ORDER BY
        window_unit_quantities.base_quantity DESC,
        window_unit_quantities.ordered_unit_name ASC,
        window_unit_quantities.qty_per_unit ASC
    ) AS ordered_unit_totals
  FROM window_unit_quantities
  GROUP BY window_unit_quantities.arrival_window
),
arrival_window_units AS (
  SELECT jsonb_object_agg(window_units.arrival_window, window_units.ordered_unit_totals) AS totals
  FROM window_units
)
SELECT
  shipments.load_list_id,
  shipments.ll_number,
  shipments.supplier_name,
  shipments.source_business_unit_id,
  shipments.destination_business_unit_id,
  shipments.destination_business_unit_name,
  shipments.estimated_arrival_date,
  (shipments.estimated_arrival_date - p_as_of_date)::INTEGER AS days_until_arrival,
  shipments.arrival_window,
  shipments.liner_name,
  shipments.container_number,
  shipments.base_quantity,
  shipment_units.ordered_unit_totals,
  SUM(shipments.base_quantity) OVER arrival_date AS arrival_base_quantity,
  arrival_units.ordered_unit_totals AS arrival_ordered_unit_totals,
  COUNT(*) OVER arrival_date AS arrival_shipment_count,
  COUNT(shipments.container_number) OVER arrival_date AS arrival_container_count,
  arrival_destinations.destination_totals AS arrival_destination_totals,
  COALESCE(SUM(shipments.base_quantity) FILTER (
    WHERE shipments.arrival_window = 'late'
  ) OVER (), 0) AS late_base_quantity,
  COALESCE(SUM(shipments.base_quantity) FILTER (
    WHERE shipments.arrival_window = 'next_7_days'
  ) OVER (), 0) AS next_7_days_base_quantity,
  COALESCE(SUM(shipments.base_quantity) FILTER (
    WHERE shipments.arrival_window = 'days_8_to_14'
  ) OVER (), 0) AS days_8_to_14_base_quantity,
  COALESCE(SUM(shipments.base_quantity) FILTER (
    WHERE shipments.arrival_window = 'later'
  ) OVER (), 0) AS later_base_quantity,
  COALESCE(SUM(shipments.base_quantity) FILTER (
    WHERE shipments.arrival_window = 'no_eta'
  ) OVER (), 0) AS no_eta_base_quantity,
  arrival_window_units.totals AS arrival_window_ordered_unit_totals,
  COUNT(*) OVER () AS total_count
FROM shipments
INNER JOIN shipment_units
  ON shipment_units.load_list_id = shipments.load_list_id
INNER JOIN arrival_units
  ON arrival_units.estimated_arrival_date IS NOT DISTINCT FROM shipments.estimated_arrival_date
INNER JOIN arrival_destinations
  ON arrival_destinations.estimated_arrival_date
    IS NOT DISTINCT FROM shipments.estimated_arrival_date
CROSS JOIN arrival_window_units
WINDOW arrival_date AS (PARTITION BY shipments.estimated_arrival_date)
ORDER BY
  shipments.estimated_arrival_date ASC NULLS LAST,
  shipments.base_quantity DESC,
  shipments.ll_number ASC,
  shipments.load_list_id ASC
OFFSET (GREATEST(p_page, 1)::BIGINT - 1) * LEAST(GREATEST(p_limit, 1), 50)
LIMIT LEAST(GREATEST(p_limit, 1), 50);
$$;

COMMENT ON FUNCTION public.get_stock_in_transit_item_arrivals_page(
  UUID, UUID, DATE, INTEGER, INTEGER
) IS 'Returns one item''s in-transit load lists in arrival order, with complete ordered-unit and base-unit totals by load list, arrival date, destination, and arrival window before pagination.';

GRANT EXECUTE ON FUNCTION public.get_stock_in_transit_item_arrivals_page(
  UUID, UUID, DATE, INTEGER, INTEGER
) TO authenticated;

COMMIT;
