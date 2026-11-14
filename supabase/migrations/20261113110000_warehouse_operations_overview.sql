-- Warehouse dashboard Operations Overview: one bounded, read-only aggregate per
-- request. Sections the caller may not see are skipped (returned as NULL).
-- SECURITY INVOKER so every table's RLS still applies to the caller.
-- "Today" and created-at ages use the viewer's IANA time zone; posting and expiry
-- dates are business dates and are compared as stored.

CREATE OR REPLACE FUNCTION public.get_warehouse_operations_overview(
  p_company_id UUID,
  p_business_unit_ids UUID[],
  p_time_zone TEXT,
  p_days INTEGER,
  p_include_stock BOOLEAN,
  p_include_reorder BOOLEAN,
  p_include_inbound BOOLEAN,
  p_include_pick_lists BOOLEAN,
  p_include_stock_requests BOOLEAN,
  p_include_incoming BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_as_of DATE;
  v_warehouse_ids UUID[];
  v_movements JSONB;
  v_stock_health JSONB;
  v_inbound JSONB;
  v_arrivals JSONB;
  v_open_work_age JSONB;
  v_expiring JSONB;
  v_expiring_counts JSONB;
  v_slow_moving JSONB;
BEGIN
  IF p_days IS NULL OR p_days NOT IN (7, 14, 30) THEN
    RAISE EXCEPTION 'Invalid overview range' USING ERRCODE = '22023';
  END IF;

  IF NULLIF(BTRIM(p_time_zone), '') IS NULL OR COALESCE(cardinality(p_business_unit_ids), 0) = 0 THEN
    RAISE EXCEPTION 'Missing overview scope' USING ERRCODE = '22023';
  END IF;

  v_as_of := (now() AT TIME ZONE p_time_zone)::DATE;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_user_id
      AND u.company_id = p_company_id
      AND u.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1
    FROM unnest(p_business_unit_ids) AS scope(business_unit_id)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_business_unit_access a
      WHERE a.user_id = v_user_id
        AND a.business_unit_id = scope.business_unit_id
    )
  ) THEN
    RAISE EXCEPTION 'Overview scope not permitted' USING ERRCODE = '42501';
  END IF;

  v_warehouse_ids := ARRAY(
    SELECT w.id
    FROM public.warehouses w
    WHERE w.company_id = p_company_id
      AND w.deleted_at IS NULL
      AND w.business_unit_id = ANY(p_business_unit_ids)
  );

  IF p_include_stock THEN
    -- Stock in vs stock out: transaction lines per posting date. Stock moves stay
    -- inside one business unit (out of one warehouse, into another), so they are
    -- internal to every scope and would otherwise count on both lines.
    WITH days AS (
      SELECT generate_series(v_as_of - (p_days - 1), v_as_of, INTERVAL '1 day')::DATE AS day
    ),
    lines AS (
      SELECT
        sti.posting_date AS day,
        COUNT(*) FILTER (WHERE st.transaction_type = 'in') AS in_lines,
        COUNT(*) FILTER (WHERE st.transaction_type = 'out') AS out_lines
      FROM public.stock_transaction_items sti
      JOIN public.stock_transactions st
        ON st.id = sti.transaction_id
       AND st.deleted_at IS NULL
      WHERE sti.company_id = p_company_id
        AND sti.deleted_at IS NULL
        AND sti.posting_date BETWEEN v_as_of - (p_days - 1) AND v_as_of
        AND st.business_unit_id = ANY(p_business_unit_ids)
        AND st.transaction_type IN ('in', 'out')
        AND st.reference_type IS DISTINCT FROM 'stock_move'
      GROUP BY sti.posting_date
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'date', days.day,
        'in', COALESCE(lines.in_lines, 0),
        'out', COALESCE(lines.out_lines, 0)
      )
      ORDER BY days.day
    )
    INTO v_movements
    FROM days
    LEFT JOIN lines ON lines.day = days.day;

    -- Counts of stocked batches already expired or expiring within 7 days.
    SELECT jsonb_build_object(
      'expired', COUNT(*) FILTER (WHERE b.expiration_date < v_as_of),
      'withinSevenDays', COUNT(*) FILTER (
        WHERE b.expiration_date BETWEEN v_as_of AND v_as_of + 7
      )
    )
    INTO v_expiring_counts
    FROM public.item_batches b
    WHERE b.company_id = p_company_id
      AND b.deleted_at IS NULL
      AND b.expiration_date IS NOT NULL
      AND b.qty_on_hand > 0
      AND b.warehouse_id = ANY(v_warehouse_ids)
      AND b.expiration_date <= v_as_of + 7;

    -- The list holds upcoming expiries only, so long-expired stock (reported by the
    -- expired count above) cannot crowd out batches that still need action.
    WITH soonest AS (
      SELECT b.id, b.item_id, b.warehouse_id, b.batch_code, b.expiration_date, b.qty_on_hand
      FROM public.item_batches b
      WHERE b.company_id = p_company_id
        AND b.deleted_at IS NULL
        AND b.expiration_date IS NOT NULL
        AND b.qty_on_hand > 0
        AND b.warehouse_id = ANY(v_warehouse_ids)
        AND b.expiration_date BETWEEN v_as_of AND v_as_of + 90
      ORDER BY b.expiration_date, b.id
      LIMIT 6
    )
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'batchId', soonest.id,
          'itemId', soonest.item_id,
          'itemName', i.item_name,
          'batchCode', soonest.batch_code,
          'warehouseCode', w.warehouse_code,
          'qtyOnHand', soonest.qty_on_hand,
          'uom', COALESCE(uom.symbol, uom.code),
          'expirationDate', soonest.expiration_date,
          'daysLeft', soonest.expiration_date - v_as_of
        )
        ORDER BY soonest.expiration_date, soonest.id
      ),
      '[]'::JSONB
    )
    INTO v_expiring
    FROM soonest
    JOIN public.items i ON i.id = soonest.item_id
    JOIN public.warehouses w ON w.id = soonest.warehouse_id
    LEFT JOIN public.units_of_measure uom ON uom.id = i.uom_id;

    -- Items with stock on hand and no movement in these warehouses for 90+ days.
    -- The last-movement lookup runs only for idle items, one index probe each.
    WITH stocked AS (
      SELECT iw.item_id, SUM(iw.current_stock) AS on_hand
      FROM public.item_warehouse iw
      WHERE iw.company_id = p_company_id
        AND iw.deleted_at IS NULL
        AND iw.warehouse_id = ANY(v_warehouse_ids)
        AND iw.current_stock > 0
      GROUP BY iw.item_id
    ),
    recent AS (
      SELECT DISTINCT sti.item_id
      FROM public.stock_transaction_items sti
      JOIN public.stock_transactions st
        ON st.id = sti.transaction_id
       AND st.deleted_at IS NULL
      WHERE sti.company_id = p_company_id
        AND sti.deleted_at IS NULL
        AND sti.posting_date > v_as_of - 90
        AND st.warehouse_id = ANY(v_warehouse_ids)
    ),
    idle AS MATERIALIZED (
      SELECT stocked.item_id, stocked.on_hand, last_move.posting_date AS last_moved_on
      FROM stocked
      LEFT JOIN LATERAL (
        SELECT sti.posting_date
        FROM public.stock_transaction_items sti
        JOIN public.stock_transactions st
          ON st.id = sti.transaction_id
         AND st.deleted_at IS NULL
        WHERE sti.item_id = stocked.item_id
          AND sti.company_id = p_company_id
          AND sti.deleted_at IS NULL
          AND st.warehouse_id = ANY(v_warehouse_ids)
        ORDER BY sti.posting_date DESC
        LIMIT 1
      ) last_move ON TRUE
      WHERE NOT EXISTS (SELECT 1 FROM recent WHERE recent.item_id = stocked.item_id)
    ),
    oldest AS (
      SELECT idle.item_id, idle.on_hand, idle.last_moved_on
      FROM idle
      ORDER BY idle.last_moved_on ASC NULLS FIRST, idle.item_id
      LIMIT 5
    )
    SELECT jsonb_build_object(
      'total', (SELECT COUNT(*) FROM idle),
      'items', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'itemId', oldest.item_id,
              'itemName', i.item_name,
              'onHand', oldest.on_hand,
              'uom', COALESCE(uom.symbol, uom.code),
              'lastMovedOn', oldest.last_moved_on,
              'daysIdle', CASE WHEN oldest.last_moved_on IS NULL THEN NULL ELSE v_as_of - oldest.last_moved_on END
            )
            ORDER BY oldest.last_moved_on ASC NULLS FIRST, oldest.item_id
          )
          FROM oldest
          JOIN public.items i ON i.id = oldest.item_id
          LEFT JOIN public.units_of_measure uom ON uom.id = i.uom_id
        ),
        '[]'::JSONB
      )
    )
    INTO v_slow_moving;
  END IF;

  IF p_include_stock AND p_include_reorder THEN
    -- Item-level health, matching the dashboard out-of-stock list (on hand <= 0)
    -- and the low-stock RPC (0 < available <= item reorder level). Items with stock
    -- on hand but none available are fully reserved, not in stock.
    WITH per_item AS (
      SELECT
        COALESCE(i.reorder_level, 0) AS reorder_level,
        SUM(COALESCE(iw.current_stock, 0)) AS on_hand,
        SUM(
          COALESCE(
            iw.available_stock,
            COALESCE(iw.current_stock, 0) - COALESCE(iw.reserved_stock, 0),
            0
          )
        ) AS available
      FROM public.item_warehouse iw
      JOIN public.items i
        ON i.id = iw.item_id
       AND i.company_id = p_company_id
       AND i.deleted_at IS NULL
       AND COALESCE(i.is_active, TRUE)
      WHERE iw.company_id = p_company_id
        AND iw.deleted_at IS NULL
        AND iw.warehouse_id = ANY(v_warehouse_ids)
      GROUP BY i.id, i.reorder_level
    )
    SELECT jsonb_build_object(
      'outOfStock', COUNT(*) FILTER (WHERE on_hand <= 0),
      'fullyReserved', COUNT(*) FILTER (WHERE on_hand > 0 AND available <= 0),
      'belowReorder', COUNT(*) FILTER (
        WHERE on_hand > 0 AND available > 0 AND reorder_level > 0 AND available <= reorder_level
      ),
      'inStock', COUNT(*) FILTER (
        WHERE on_hand > 0
          AND available > 0
          AND NOT (reorder_level > 0 AND available <= reorder_level)
      )
    )
    INTO v_stock_health
    FROM per_item;
  END IF;

  IF p_include_inbound THEN
    SELECT jsonb_build_object(
      'pipeline', jsonb_build_object(
        'confirmed', COUNT(*) FILTER (WHERE ll.status = 'confirmed'),
        'in_transit', COUNT(*) FILTER (WHERE ll.status = 'in_transit'),
        'arrived', COUNT(*) FILTER (WHERE ll.status = 'arrived'),
        'receiving', COUNT(*) FILTER (WHERE ll.status = 'receiving'),
        'pending_approval', COUNT(*) FILTER (WHERE ll.status = 'pending_approval')
      ),
      'overdue', COUNT(*) FILTER (
        WHERE ll.status IN ('confirmed', 'in_transit') AND ll.estimated_arrival_date < v_as_of
      )
    )
    INTO v_inbound
    FROM public.load_lists ll
    WHERE ll.company_id = p_company_id
      AND ll.deleted_at IS NULL
      AND ll.destination_business_unit_id = ANY(p_business_unit_ids)
      AND ll.status IN ('confirmed', 'in_transit', 'arrived', 'receiving', 'pending_approval');

    WITH days AS (
      SELECT generate_series(v_as_of, v_as_of + 13, INTERVAL '1 day')::DATE AS day
    ),
    due AS (
      SELECT ll.estimated_arrival_date AS day, COUNT(*) AS arrivals
      FROM public.load_lists ll
      WHERE ll.company_id = p_company_id
        AND ll.deleted_at IS NULL
        AND ll.destination_business_unit_id = ANY(p_business_unit_ids)
        AND ll.status IN ('confirmed', 'in_transit')
        AND ll.estimated_arrival_date BETWEEN v_as_of AND v_as_of + 13
      GROUP BY ll.estimated_arrival_date
    )
    SELECT jsonb_agg(
      jsonb_build_object('date', days.day, 'count', COALESCE(due.arrivals, 0))
      ORDER BY days.day
    )
    INTO v_arrivals
    FROM days
    LEFT JOIN due ON due.day = days.day;
  END IF;

  -- Open work by age in local days since created: [< 1, 1-3, 4-7, > 7]. Queues the
  -- caller may not see are absent from the object and return as NULL.
  WITH open_work AS (
    SELECT 'pickLists' AS queue, pl.created_at
    FROM public.pick_lists pl
    WHERE p_include_pick_lists
      AND pl.company_id = p_company_id
      AND pl.deleted_at IS NULL
      AND pl.business_unit_id = ANY(p_business_unit_ids)
      AND pl.status IN ('pending', 'in_progress', 'paused')
    UNION ALL
    SELECT 'stockRequests', sr.created_at
    FROM public.stock_requests sr
    WHERE p_include_stock_requests
      AND sr.company_id = p_company_id
      AND sr.deleted_at IS NULL
      AND sr.fulfilling_business_unit_id = ANY(p_business_unit_ids)
      AND sr.status IN ('submitted', 'approved')
    UNION ALL
    SELECT 'incoming', ll.created_at
    FROM public.load_lists ll
    WHERE p_include_incoming
      AND ll.company_id = p_company_id
      AND ll.deleted_at IS NULL
      AND ll.destination_business_unit_id = ANY(p_business_unit_ids)
      AND ll.status IN ('in_transit', 'receiving')
  ),
  aged AS (
    SELECT open_work.queue, v_as_of - (open_work.created_at AT TIME ZONE p_time_zone)::DATE AS age
    FROM open_work
  ),
  visible_queues AS (
    SELECT queues.queue
    FROM (
      VALUES
        ('pickLists', p_include_pick_lists),
        ('stockRequests', p_include_stock_requests),
        ('incoming', p_include_incoming)
    ) AS queues(queue, included)
    WHERE queues.included
  )
  SELECT jsonb_object_agg(visible_queues.queue, buckets.counts)
  INTO v_open_work_age
  FROM visible_queues
  CROSS JOIN LATERAL (
    SELECT jsonb_build_array(
      COUNT(*) FILTER (WHERE aged.age < 1),
      COUNT(*) FILTER (WHERE aged.age BETWEEN 1 AND 3),
      COUNT(*) FILTER (WHERE aged.age BETWEEN 4 AND 7),
      COUNT(*) FILTER (WHERE aged.age > 7)
    ) AS counts
    FROM aged
    WHERE aged.queue = visible_queues.queue
  ) buckets;

  RETURN jsonb_build_object(
    'asOf', v_as_of,
    'days', p_days,
    'stockMovements', v_movements,
    'stockHealth', v_stock_health,
    'inbound', CASE
      WHEN v_inbound IS NULL THEN NULL
      ELSE v_inbound || jsonb_build_object('arrivals', v_arrivals)
    END,
    'openWorkAge', jsonb_build_object(
      'pickLists', v_open_work_age -> 'pickLists',
      'stockRequests', v_open_work_age -> 'stockRequests',
      'incoming', v_open_work_age -> 'incoming'
    ),
    'expiringBatches', CASE
      WHEN v_expiring IS NULL THEN NULL
      ELSE v_expiring_counts || jsonb_build_object('batches', v_expiring)
    END,
    'slowMoving', v_slow_moving
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_warehouse_operations_overview(
  UUID, UUID[], TEXT, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_warehouse_operations_overview(
  UUID, UUID[], TEXT, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN
) TO authenticated;
