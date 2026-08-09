BEGIN;

CREATE INDEX idx_delivery_notes_delivery_performance
  ON public.delivery_notes(company_id, dispatched_at DESC)
  INCLUDE (
    fulfilling_business_unit_id,
    requesting_business_unit_id,
    receiving_completed_at,
    received_at
  )
  WHERE deleted_at IS NULL
    AND dispatched_at IS NOT NULL
    AND status <> 'voided';

CREATE FUNCTION public.get_delivery_performance_report(
  p_company_id UUID,
  p_user_id UUID,
  p_business_unit_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_direction TEXT DEFAULT 'all',
  p_performance_status TEXT DEFAULT 'all',
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_offset INTEGER;
  v_result JSONB;
  v_business_timezone TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'DELIVERY_PERFORMANCE_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE users.id = p_user_id
      AND users.company_id = p_company_id
      AND users.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'DELIVERY_PERFORMANCE_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_business_unit_access
    WHERE user_business_unit_access.user_id = p_user_id
      AND user_business_unit_access.business_unit_id = p_business_unit_id
  ) OR NOT public.user_has_permission(
    p_user_id,
    'reports',
    'view',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'DELIVERY_PERFORMANCE_PERMISSION_DENIED';
  END IF;

  IF p_start_date IS NULL
     OR p_end_date IS NULL
     OR p_end_date < p_start_date
     OR p_end_date - p_start_date > 366 THEN
    RAISE EXCEPTION 'DELIVERY_PERFORMANCE_INVALID_DATE_RANGE';
  END IF;

  IF p_direction NOT IN ('all', 'outbound', 'inbound', 'internal') THEN
    RAISE EXCEPTION 'DELIVERY_PERFORMANCE_INVALID_DIRECTION';
  END IF;

  IF p_performance_status NOT IN ('all', 'on_time', 'late', 'in_transit', 'discrepancy') THEN
    RAISE EXCEPTION 'DELIVERY_PERFORMANCE_INVALID_STATUS';
  END IF;

  IF p_page < 1 OR p_limit < 1 OR p_limit > 500 THEN
    RAISE EXCEPTION 'DELIVERY_PERFORMANCE_INVALID_PAGINATION';
  END IF;

  IF length(COALESCE(p_search, '')) > 100 THEN
    RAISE EXCEPTION 'DELIVERY_PERFORMANCE_SEARCH_TOO_LONG';
  END IF;

  SELECT COALESCE(
    (
      SELECT NULLIF(BTRIM(settings.value #>> '{}'), '')
      FROM public.settings
      WHERE settings.company_id = p_company_id
        AND settings.business_unit_id = p_business_unit_id
        AND settings.group_key = 'business_unit'
        AND settings.setting_key = 'timezone'
      LIMIT 1
    ),
    'Asia/Manila'
  )
  INTO v_business_timezone;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_timezone_names
    WHERE pg_timezone_names.name = v_business_timezone
  ) THEN
    RAISE EXCEPTION 'DELIVERY_PERFORMANCE_INVALID_TIMEZONE';
  END IF;

  v_offset := (p_page - 1) * p_limit;

  WITH scoped_delivery_notes AS MATERIALIZED (
    SELECT
      delivery_notes.id,
      delivery_notes.dn_no,
      delivery_notes.fulfilling_business_unit_id,
      delivery_notes.requesting_business_unit_id,
      source_business_units.name AS source_business_unit_name,
      destination_business_units.name AS destination_business_unit_name,
      warehouses.warehouse_code AS source_warehouse_code,
      warehouses.warehouse_name AS source_warehouse_name,
      delivery_notes.driver_name,
      delivery_notes.plate_number,
      delivery_notes.status::TEXT AS delivery_note_status,
      delivery_notes.dispatched_at,
      COALESCE(delivery_notes.receiving_completed_at, delivery_notes.received_at) AS received_at,
      delivery_notes.receiving_has_discrepancy,
      CASE
        WHEN delivery_notes.fulfilling_business_unit_id = p_business_unit_id
         AND delivery_notes.requesting_business_unit_id = p_business_unit_id THEN 'internal'
        WHEN delivery_notes.fulfilling_business_unit_id = p_business_unit_id THEN 'outbound'
        ELSE 'inbound'
      END AS delivery_direction
    FROM public.delivery_notes
    JOIN public.business_units AS source_business_units
      ON source_business_units.id = delivery_notes.fulfilling_business_unit_id
    JOIN public.business_units AS destination_business_units
      ON destination_business_units.id = delivery_notes.requesting_business_unit_id
    JOIN public.warehouses
      ON warehouses.id = delivery_notes.fulfilling_warehouse_id
    WHERE delivery_notes.company_id = p_company_id
      AND delivery_notes.deleted_at IS NULL
      AND delivery_notes.status <> 'voided'
      AND delivery_notes.dispatched_at IS NOT NULL
      AND delivery_notes.dispatched_at >= (
        p_start_date::TIMESTAMP AT TIME ZONE v_business_timezone
      )
      AND delivery_notes.dispatched_at < (
        (p_end_date + 1)::TIMESTAMP AT TIME ZONE v_business_timezone
      )
      AND (
        delivery_notes.fulfilling_business_unit_id = p_business_unit_id
        OR delivery_notes.requesting_business_unit_id = p_business_unit_id
      )
      AND (
        p_direction = 'all'
        OR CASE
          WHEN delivery_notes.fulfilling_business_unit_id = p_business_unit_id
           AND delivery_notes.requesting_business_unit_id = p_business_unit_id THEN 'internal'
          WHEN delivery_notes.fulfilling_business_unit_id = p_business_unit_id THEN 'outbound'
          ELSE 'inbound'
        END = p_direction
      )
      AND (
        NULLIF(BTRIM(COALESCE(p_search, '')), '') IS NULL
        OR delivery_notes.dn_no ILIKE '%' || BTRIM(p_search) || '%'
        OR source_business_units.name ILIKE '%' || BTRIM(p_search) || '%'
        OR destination_business_units.name ILIKE '%' || BTRIM(p_search) || '%'
        OR warehouses.warehouse_code ILIKE '%' || BTRIM(p_search) || '%'
        OR warehouses.warehouse_name ILIKE '%' || BTRIM(p_search) || '%'
        OR COALESCE(delivery_notes.driver_name, '') ILIKE '%' || BTRIM(p_search) || '%'
        OR COALESCE(delivery_notes.plate_number, '') ILIKE '%' || BTRIM(p_search) || '%'
      )
  ),
  source_commitments AS (
    SELECT
      delivery_note_sources.dn_id,
      MIN(stock_requests.required_date) AS required_date
    FROM scoped_delivery_notes
    JOIN public.delivery_note_sources
      ON delivery_note_sources.dn_id = scoped_delivery_notes.id
     AND delivery_note_sources.company_id = p_company_id
    JOIN public.stock_requests
      ON stock_requests.id = delivery_note_sources.sr_id
     AND stock_requests.company_id = p_company_id
     AND stock_requests.deleted_at IS NULL
    GROUP BY delivery_note_sources.dn_id
  ),
  item_totals AS (
    SELECT
      delivery_note_items.dn_id,
      COALESCE(SUM(delivery_note_items.dispatched_qty), 0)::NUMERIC(20, 2) AS dispatched_qty,
      COALESCE(SUM(delivery_note_items.received_qty), 0)::NUMERIC(20, 2) AS received_qty,
      COALESCE(SUM(delivery_note_items.receiving_variance_qty), 0)::NUMERIC(20, 2) AS variance_qty,
      COALESCE(BOOL_OR(delivery_note_items.receiving_discrepancy_flag), FALSE) AS has_line_discrepancy
    FROM scoped_delivery_notes
    JOIN public.delivery_note_items
      ON delivery_note_items.dn_id = scoped_delivery_notes.id
     AND delivery_note_items.company_id = p_company_id
     AND delivery_note_items.is_voided IS FALSE
    GROUP BY delivery_note_items.dn_id
  ),
  base_deliveries AS (
    SELECT
      scoped_delivery_notes.id,
      scoped_delivery_notes.dn_no,
      scoped_delivery_notes.source_business_unit_name,
      scoped_delivery_notes.destination_business_unit_name,
      scoped_delivery_notes.source_warehouse_code,
      scoped_delivery_notes.source_warehouse_name,
      scoped_delivery_notes.driver_name,
      scoped_delivery_notes.plate_number,
      scoped_delivery_notes.delivery_note_status,
      scoped_delivery_notes.dispatched_at,
      source_commitments.required_date,
      scoped_delivery_notes.received_at,
      scoped_delivery_notes.delivery_direction,
      COALESCE(item_totals.dispatched_qty, 0)::NUMERIC(20, 2) AS dispatched_qty,
      COALESCE(item_totals.received_qty, 0)::NUMERIC(20, 2) AS received_qty,
      COALESCE(item_totals.variance_qty, 0)::NUMERIC(20, 2) AS variance_qty,
      (
        scoped_delivery_notes.receiving_has_discrepancy
        OR COALESCE(item_totals.has_line_discrepancy, FALSE)
        OR COALESCE(item_totals.variance_qty, 0) <> 0
      ) AS has_discrepancy
    FROM scoped_delivery_notes
    LEFT JOIN source_commitments
      ON source_commitments.dn_id = scoped_delivery_notes.id
    LEFT JOIN item_totals
      ON item_totals.dn_id = scoped_delivery_notes.id
  ),
  classified_deliveries AS (
    SELECT
      base_deliveries.id,
      base_deliveries.dn_no,
      base_deliveries.source_business_unit_name,
      base_deliveries.destination_business_unit_name,
      base_deliveries.source_warehouse_code,
      base_deliveries.source_warehouse_name,
      base_deliveries.driver_name,
      base_deliveries.plate_number,
      base_deliveries.delivery_note_status,
      base_deliveries.dispatched_at,
      base_deliveries.required_date,
      base_deliveries.received_at,
      base_deliveries.delivery_direction,
      base_deliveries.dispatched_qty,
      base_deliveries.received_qty,
      base_deliveries.variance_qty,
      base_deliveries.has_discrepancy,
      CASE
        WHEN base_deliveries.received_at IS NOT NULL
         AND base_deliveries.required_date IS NOT NULL
         AND (base_deliveries.received_at AT TIME ZONE v_business_timezone)::DATE
           <= base_deliveries.required_date THEN 'on_time'
        WHEN base_deliveries.received_at IS NOT NULL THEN 'late'
        WHEN base_deliveries.required_date IS NOT NULL
         AND (CURRENT_TIMESTAMP AT TIME ZONE v_business_timezone)::DATE
           > base_deliveries.required_date THEN 'late'
        ELSE 'in_transit'
      END AS performance_status,
      CASE
        WHEN base_deliveries.received_at IS NOT NULL
         AND base_deliveries.received_at > base_deliveries.dispatched_at
          THEN ROUND(
            EXTRACT(EPOCH FROM (base_deliveries.received_at - base_deliveries.dispatched_at))
            / 3600,
            2
          )
        ELSE NULL
      END AS transit_hours
    FROM base_deliveries
  ),
  filtered_deliveries AS (
    SELECT
      classified_deliveries.id,
      classified_deliveries.dn_no,
      classified_deliveries.source_business_unit_name,
      classified_deliveries.destination_business_unit_name,
      classified_deliveries.source_warehouse_code,
      classified_deliveries.source_warehouse_name,
      classified_deliveries.driver_name,
      classified_deliveries.plate_number,
      classified_deliveries.delivery_note_status,
      classified_deliveries.dispatched_at,
      classified_deliveries.required_date,
      classified_deliveries.received_at,
      classified_deliveries.delivery_direction,
      classified_deliveries.dispatched_qty,
      classified_deliveries.received_qty,
      classified_deliveries.variance_qty,
      classified_deliveries.has_discrepancy,
      classified_deliveries.performance_status,
      classified_deliveries.transit_hours
    FROM classified_deliveries
    WHERE (
        p_performance_status = 'all'
        OR classified_deliveries.performance_status = p_performance_status
        OR (p_performance_status = 'discrepancy' AND classified_deliveries.has_discrepancy)
      )
  ),
  summary AS (
    SELECT
      COUNT(*)::BIGINT AS total_deliveries,
      COUNT(*) FILTER (WHERE filtered_deliveries.received_at IS NOT NULL)::BIGINT AS completed_deliveries,
      COUNT(*) FILTER (WHERE filtered_deliveries.performance_status = 'on_time')::BIGINT AS on_time_deliveries,
      COUNT(*) FILTER (WHERE filtered_deliveries.performance_status = 'late')::BIGINT AS late_deliveries,
      COUNT(*) FILTER (WHERE filtered_deliveries.performance_status = 'in_transit')::BIGINT AS in_transit_deliveries,
      COUNT(*) FILTER (WHERE filtered_deliveries.has_discrepancy)::BIGINT AS discrepancy_deliveries,
      COUNT(*) FILTER (
        WHERE filtered_deliveries.performance_status = 'on_time'
          AND filtered_deliveries.has_discrepancy IS FALSE
      )::BIGINT AS perfect_deliveries,
      COALESCE(AVG(filtered_deliveries.transit_hours), 0)::NUMERIC(20, 2) AS average_transit_hours,
      COALESCE(SUM(filtered_deliveries.dispatched_qty), 0)::NUMERIC(20, 2) AS total_dispatched_qty,
      COALESCE(SUM(filtered_deliveries.received_qty), 0)::NUMERIC(20, 2) AS total_received_qty
    FROM filtered_deliveries
  ),
  paged_deliveries AS (
    SELECT
      filtered_deliveries.id,
      filtered_deliveries.dn_no,
      filtered_deliveries.source_business_unit_name,
      filtered_deliveries.destination_business_unit_name,
      filtered_deliveries.source_warehouse_code,
      filtered_deliveries.source_warehouse_name,
      filtered_deliveries.driver_name,
      filtered_deliveries.plate_number,
      filtered_deliveries.delivery_note_status,
      filtered_deliveries.dispatched_at,
      filtered_deliveries.required_date,
      filtered_deliveries.received_at,
      filtered_deliveries.delivery_direction,
      filtered_deliveries.dispatched_qty,
      filtered_deliveries.received_qty,
      filtered_deliveries.variance_qty,
      filtered_deliveries.has_discrepancy,
      filtered_deliveries.performance_status,
      filtered_deliveries.transit_hours
    FROM filtered_deliveries
    ORDER BY filtered_deliveries.dispatched_at DESC, filtered_deliveries.dn_no DESC
    LIMIT p_limit
    OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'data', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', paged_deliveries.id,
            'dnNumber', paged_deliveries.dn_no,
            'sourceBusinessUnitName', paged_deliveries.source_business_unit_name,
            'destinationBusinessUnitName', paged_deliveries.destination_business_unit_name,
            'sourceWarehouseCode', paged_deliveries.source_warehouse_code,
            'sourceWarehouseName', paged_deliveries.source_warehouse_name,
            'driverName', paged_deliveries.driver_name,
            'plateNumber', paged_deliveries.plate_number,
            'deliveryNoteStatus', paged_deliveries.delivery_note_status,
            'dispatchedAt', paged_deliveries.dispatched_at,
            'requiredDate', paged_deliveries.required_date,
            'receivedAt', paged_deliveries.received_at,
            'direction', paged_deliveries.delivery_direction,
            'performanceStatus', paged_deliveries.performance_status,
            'transitHours', paged_deliveries.transit_hours,
            'dispatchedQty', paged_deliveries.dispatched_qty,
            'receivedQty', paged_deliveries.received_qty,
            'varianceQty', paged_deliveries.variance_qty,
            'hasDiscrepancy', paged_deliveries.has_discrepancy
          )
          ORDER BY paged_deliveries.dispatched_at DESC, paged_deliveries.dn_no DESC
        )
        FROM paged_deliveries
      ),
      '[]'::JSONB
    ),
    'summary', jsonb_build_object(
      'totalDeliveries', summary.total_deliveries,
      'completedDeliveries', summary.completed_deliveries,
      'onTimeDeliveries', summary.on_time_deliveries,
      'lateDeliveries', summary.late_deliveries,
      'inTransitDeliveries', summary.in_transit_deliveries,
      'discrepancyDeliveries', summary.discrepancy_deliveries,
      'perfectDeliveries', summary.perfect_deliveries,
      'averageTransitHours', summary.average_transit_hours,
      'onTimeRatePct', CASE
        WHEN summary.completed_deliveries = 0 THEN 0
        ELSE ROUND(summary.on_time_deliveries::NUMERIC * 100 / summary.completed_deliveries, 2)
      END,
      'completionRatePct', CASE
        WHEN summary.total_deliveries = 0 THEN 0
        ELSE ROUND(summary.completed_deliveries::NUMERIC * 100 / summary.total_deliveries, 2)
      END,
      'perfectDeliveryRatePct', CASE
        WHEN summary.completed_deliveries = 0 THEN 0
        ELSE ROUND(summary.perfect_deliveries::NUMERIC * 100 / summary.completed_deliveries, 2)
      END,
      'totalDispatchedQty', summary.total_dispatched_qty,
      'totalReceivedQty', summary.total_received_qty
    ),
    'pagination', jsonb_build_object(
      'page', p_page,
      'limit', p_limit,
      'total', summary.total_deliveries,
      'totalPages', GREATEST(1, CEIL(summary.total_deliveries::NUMERIC / p_limit)::INTEGER)
    )
  )
  INTO v_result
  FROM summary;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_delivery_performance_report(
  UUID, UUID, UUID, DATE, DATE, TEXT, TEXT, TEXT, INTEGER, INTEGER
) IS
  'Returns a paginated BU-scoped delivery reliability report using the earliest linked stock-request required date as the delivery commitment.';

REVOKE ALL ON FUNCTION public.get_delivery_performance_report(
  UUID, UUID, UUID, DATE, DATE, TEXT, TEXT, TEXT, INTEGER, INTEGER
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_performance_report(
  UUID, UUID, UUID, DATE, DATE, TEXT, TEXT, TEXT, INTEGER, INTEGER
) TO authenticated;

COMMIT;
