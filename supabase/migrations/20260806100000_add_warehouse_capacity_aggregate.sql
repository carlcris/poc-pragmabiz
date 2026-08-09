BEGIN;

ALTER TABLE public.warehouse_locations
  ADD COLUMN max_capacity NUMERIC(20, 2);

ALTER TABLE public.warehouse_locations
  ADD CONSTRAINT warehouse_locations_max_capacity_check
  CHECK (
    max_capacity IS NULL
    OR (is_storable IS TRUE AND max_capacity > 0)
  );

COMMENT ON COLUMN public.warehouse_locations.max_capacity IS
  'Maximum quantity that can be stored at this location. Quantities are assumed to use a common capacity basis.';

CREATE FUNCTION public.get_warehouse_capacity(
  p_business_unit_id UUID,
  p_warehouse_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_locations BIGINT,
  configured_locations BIGINT,
  unconfigured_locations BIGINT,
  empty_locations BIGINT,
  partially_occupied_locations BIGINT,
  full_locations BIGINT,
  over_capacity_locations BIGINT,
  total_capacity NUMERIC(20, 2),
  used_capacity NUMERIC(20, 2),
  available_capacity NUMERIC(20, 2),
  utilization_percent NUMERIC(12, 2)
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH requester_scope AS (
  SELECT users.company_id
  FROM public.users
  JOIN public.user_business_unit_access
    ON user_business_unit_access.user_id = users.id
   AND user_business_unit_access.business_unit_id = p_business_unit_id
  WHERE users.id = auth.uid()
),
scoped_locations AS (
  SELECT
    warehouse_locations.id,
    warehouse_locations.max_capacity
  FROM public.warehouse_locations
  JOIN public.warehouses
    ON warehouses.id = warehouse_locations.warehouse_id
  JOIN requester_scope
    ON requester_scope.company_id = warehouses.company_id
  WHERE warehouses.business_unit_id = p_business_unit_id
    AND (p_warehouse_id IS NULL OR warehouses.id = p_warehouse_id)
    AND warehouses.deleted_at IS NULL
    AND warehouses.is_active IS TRUE
    AND warehouse_locations.deleted_at IS NULL
    AND warehouse_locations.is_active IS TRUE
    AND warehouse_locations.is_storable IS TRUE
),
location_usage AS (
  SELECT
    scoped_locations.id,
    scoped_locations.max_capacity,
    COALESCE(SUM(item_batch_locations.qty_on_hand), 0)::NUMERIC(20, 2) AS used_capacity
  FROM scoped_locations
  LEFT JOIN public.item_batch_locations
    ON item_batch_locations.location_id = scoped_locations.id
   AND item_batch_locations.deleted_at IS NULL
  GROUP BY scoped_locations.id, scoped_locations.max_capacity
),
capacity_totals AS (
  SELECT
    COUNT(*)::BIGINT AS total_locations,
    COUNT(*) FILTER (WHERE max_capacity IS NOT NULL)::BIGINT AS configured_locations,
    COUNT(*) FILTER (WHERE max_capacity IS NULL)::BIGINT AS unconfigured_locations,
    COUNT(*) FILTER (
      WHERE max_capacity IS NOT NULL AND used_capacity = 0
    )::BIGINT AS empty_locations,
    COUNT(*) FILTER (
      WHERE max_capacity IS NOT NULL
        AND used_capacity > 0
        AND used_capacity < max_capacity
    )::BIGINT AS partially_occupied_locations,
    COUNT(*) FILTER (
      WHERE max_capacity IS NOT NULL AND used_capacity = max_capacity
    )::BIGINT AS full_locations,
    COUNT(*) FILTER (
      WHERE max_capacity IS NOT NULL AND used_capacity > max_capacity
    )::BIGINT AS over_capacity_locations,
    COALESCE(SUM(max_capacity), 0)::NUMERIC(20, 2) AS total_capacity,
    COALESCE(SUM(used_capacity) FILTER (WHERE max_capacity IS NOT NULL), 0)::NUMERIC(20, 2)
      AS used_capacity,
    COALESCE(
      SUM(GREATEST(max_capacity - used_capacity, 0)) FILTER (WHERE max_capacity IS NOT NULL),
      0
    )::NUMERIC(20, 2) AS available_capacity
  FROM location_usage
)
SELECT
  capacity_totals.total_locations,
  capacity_totals.configured_locations,
  capacity_totals.unconfigured_locations,
  capacity_totals.empty_locations,
  capacity_totals.partially_occupied_locations,
  capacity_totals.full_locations,
  capacity_totals.over_capacity_locations,
  capacity_totals.total_capacity,
  capacity_totals.used_capacity,
  capacity_totals.available_capacity,
  CASE
    WHEN capacity_totals.total_capacity = 0 THEN 0::NUMERIC(12, 2)
    ELSE ROUND(
      capacity_totals.used_capacity * 100 / capacity_totals.total_capacity,
      2
    )::NUMERIC(12, 2)
  END AS utilization_percent
FROM capacity_totals;
$$;

COMMENT ON FUNCTION public.get_warehouse_capacity(UUID, UUID) IS
  'Returns BU-scoped warehouse capacity based on on-hand quantity and configured location maximums.';

REVOKE ALL ON FUNCTION public.get_warehouse_capacity(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_warehouse_capacity(UUID, UUID) TO authenticated;

CREATE FUNCTION public.get_warehouse_location_capacities(
  p_business_unit_id UUID,
  p_warehouse_id UUID,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  warehouse_id UUID,
  code VARCHAR,
  name VARCHAR,
  parent_id UUID,
  location_type VARCHAR,
  is_pickable BOOLEAN,
  is_storable BOOLEAN,
  is_active BOOLEAN,
  max_capacity NUMERIC(20, 2),
  used_capacity NUMERIC(20, 2),
  utilization_percent NUMERIC(12, 2),
  capacity_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH requester_scope AS (
  SELECT users.company_id
  FROM public.users
  JOIN public.user_business_unit_access
    ON user_business_unit_access.user_id = users.id
   AND user_business_unit_access.business_unit_id = p_business_unit_id
  WHERE users.id = auth.uid()
),
scoped_locations AS (
  SELECT
    warehouse_locations.id,
    warehouse_locations.company_id,
    warehouse_locations.warehouse_id,
    warehouse_locations.code,
    warehouse_locations.name,
    warehouse_locations.parent_id,
    warehouse_locations.location_type,
    warehouse_locations.is_pickable,
    warehouse_locations.is_storable,
    warehouse_locations.is_active,
    warehouse_locations.max_capacity,
    warehouse_locations.created_at,
    warehouse_locations.updated_at
  FROM public.warehouse_locations
  JOIN public.warehouses
    ON warehouses.id = warehouse_locations.warehouse_id
  JOIN requester_scope
    ON requester_scope.company_id = warehouses.company_id
  WHERE warehouses.id = p_warehouse_id
    AND warehouses.business_unit_id = p_business_unit_id
    AND warehouses.deleted_at IS NULL
    AND warehouse_locations.deleted_at IS NULL
),
location_usage AS (
  SELECT
    scoped_locations.id,
    COALESCE(SUM(item_batch_locations.qty_on_hand), 0)::NUMERIC(20, 2) AS used_capacity
  FROM scoped_locations
  LEFT JOIN public.item_batch_locations
    ON item_batch_locations.location_id = scoped_locations.id
   AND item_batch_locations.deleted_at IS NULL
  GROUP BY scoped_locations.id
),
enriched_locations AS (
  SELECT
    scoped_locations.id,
    scoped_locations.company_id,
    scoped_locations.warehouse_id,
    scoped_locations.code,
    scoped_locations.name,
    scoped_locations.parent_id,
    scoped_locations.location_type,
    scoped_locations.is_pickable,
    scoped_locations.is_storable,
    scoped_locations.is_active,
    scoped_locations.max_capacity,
    location_usage.used_capacity,
    CASE
      WHEN scoped_locations.max_capacity IS NULL THEN 0::NUMERIC(12, 2)
      ELSE ROUND(
        location_usage.used_capacity * 100 / scoped_locations.max_capacity,
        2
      )::NUMERIC(12, 2)
    END AS utilization_percent,
    CASE
      WHEN scoped_locations.is_storable IS NOT TRUE THEN 'not_storable'
      WHEN scoped_locations.max_capacity IS NULL THEN 'not_configured'
      WHEN location_usage.used_capacity = 0 THEN 'empty'
      WHEN location_usage.used_capacity < scoped_locations.max_capacity THEN 'partial'
      WHEN location_usage.used_capacity = scoped_locations.max_capacity THEN 'full'
      ELSE 'over_capacity'
    END AS capacity_status,
    scoped_locations.created_at,
    scoped_locations.updated_at,
    COUNT(*) OVER ()::BIGINT AS total_count
  FROM scoped_locations
  JOIN location_usage
    ON location_usage.id = scoped_locations.id
)
SELECT
  enriched_locations.id,
  enriched_locations.company_id,
  enriched_locations.warehouse_id,
  enriched_locations.code,
  enriched_locations.name,
  enriched_locations.parent_id,
  enriched_locations.location_type,
  enriched_locations.is_pickable,
  enriched_locations.is_storable,
  enriched_locations.is_active,
  enriched_locations.max_capacity,
  enriched_locations.used_capacity,
  enriched_locations.utilization_percent,
  enriched_locations.capacity_status,
  enriched_locations.created_at,
  enriched_locations.updated_at,
  enriched_locations.total_count
FROM enriched_locations
ORDER BY enriched_locations.code, enriched_locations.id
LIMIT LEAST(GREATEST(p_limit, 1), 100)
OFFSET (GREATEST(p_page, 1) - 1) * LEAST(GREATEST(p_limit, 1), 100);
$$;

COMMENT ON FUNCTION public.get_warehouse_location_capacities(UUID, UUID, INTEGER, INTEGER) IS
  'Returns a bounded page of BU-scoped warehouse locations with quantity-based capacity utilization.';

REVOKE ALL ON FUNCTION public.get_warehouse_location_capacities(UUID, UUID, INTEGER, INTEGER)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_warehouse_location_capacities(UUID, UUID, INTEGER, INTEGER)
  TO authenticated;

COMMIT;
