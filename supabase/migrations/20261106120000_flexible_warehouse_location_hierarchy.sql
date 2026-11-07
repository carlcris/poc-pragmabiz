BEGIN;

-- Materialized addresses keep operational lookups independent of tree depth.
-- Only the edited subtree is rebuilt; stock remains on its original location ID.
ALTER TABLE public.warehouse_locations
  ADD COLUMN path_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN location_path TEXT NOT NULL DEFAULT '';

WITH RECURSIVE tree AS (
  SELECT l.id, ARRAY[l.id] AS ids,
    concat_ws(' - ', l.code, NULLIF(l.name, '')) AS address
  FROM public.warehouse_locations l WHERE l.parent_id IS NULL
  UNION ALL
  SELECT l.id, tree.ids || l.id,
    tree.address || ' / ' || concat_ws(' - ', l.code, NULLIF(l.name, ''))
  FROM public.warehouse_locations l JOIN tree ON l.parent_id = tree.id
  WHERE NOT l.id = ANY(tree.ids)
)
UPDATE public.warehouse_locations l
SET path_ids = tree.ids, location_path = tree.address FROM tree WHERE tree.id = l.id;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.warehouse_locations WHERE cardinality(path_ids) = 0)
     OR EXISTS (
       SELECT 1 FROM public.warehouse_locations child
       JOIN public.warehouse_locations parent ON parent.id = child.parent_id
       WHERE child.company_id <> parent.company_id OR child.warehouse_id <> parent.warehouse_id
     ) THEN RAISE EXCEPTION 'LOCATION_EXISTING_HIERARCHY_INVALID'; END IF;
END $$;

CREATE INDEX warehouse_locations_path_ids_idx ON public.warehouse_locations USING gin(path_ids);
CREATE INDEX warehouse_locations_path_search_idx
  ON public.warehouse_locations USING gin(location_path public.gin_trgm_ops)
  WHERE deleted_at IS NULL;
CREATE INDEX warehouse_locations_children_idx
  ON public.warehouse_locations(warehouse_id, parent_id, code, id) WHERE deleted_at IS NULL;

CREATE FUNCTION public.validate_warehouse_location_hierarchy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_parent public.warehouse_locations%ROWTYPE;
BEGIN
  -- Serialize structural edits within a warehouse, including competing reparent operations.
  PERFORM 1 FROM public.warehouses
  WHERE id = NEW.warehouse_id AND company_id = NEW.company_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_WAREHOUSE_INVALID'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.warehouse_id <> OLD.warehouse_id OR NEW.company_id <> OLD.company_id) THEN
    RAISE EXCEPTION 'LOCATION_OWNERSHIP_IMMUTABLE';
  END IF;
  IF NEW.location_type NOT IN ('zone', 'aisle', 'rack', 'shelf', 'bin', 'crate') THEN
    RAISE EXCEPTION 'LOCATION_TYPE_INVALID';
  END IF;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT l.id, l.company_id, l.warehouse_id, l.code, l.name, l.parent_id, l.location_type,
      l.is_pickable, l.is_storable, l.is_active, l.created_at, l.created_by, l.updated_at,
      l.updated_by, l.deleted_at, l.version, l.max_capacity, l.path_ids, l.location_path
    INTO v_parent FROM public.warehouse_locations l
    WHERE l.id = NEW.parent_id AND l.company_id = NEW.company_id
      AND l.warehouse_id = NEW.warehouse_id AND l.deleted_at IS NULL;
    IF NOT FOUND OR (NEW.is_active AND v_parent.is_active IS NOT TRUE) THEN
      RAISE EXCEPTION 'LOCATION_PARENT_INVALID';
    END IF;
    IF NEW.id = ANY(v_parent.path_ids) THEN RAISE EXCEPTION 'LOCATION_HIERARCHY_CYCLE'; END IF;
    NEW.path_ids := v_parent.path_ids || NEW.id;
    NEW.location_path := v_parent.location_path || ' / ' || concat_ws(' - ', NEW.code, NULLIF(NEW.name, ''));
  ELSE
    NEW.path_ids := ARRAY[NEW.id];
    NEW.location_path := concat_ws(' - ', NEW.code, NULLIF(NEW.name, ''));
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.is_active IS NOT TRUE OR NEW.deleted_at IS NOT NULL) AND EXISTS (
      SELECT 1 FROM public.warehouse_locations child WHERE child.parent_id = NEW.id
        AND child.deleted_at IS NULL AND (child.is_active OR NEW.deleted_at IS NOT NULL)
    ) THEN RAISE EXCEPTION 'LOCATION_HAS_CHILDREN'; END IF;
    IF NEW.parent_id IS DISTINCT FROM OLD.parent_id
       OR (OLD.is_active IS TRUE AND NEW.is_active IS NOT TRUE)
       OR (OLD.is_storable IS TRUE AND NEW.is_storable IS NOT TRUE)
       OR (OLD.is_pickable IS TRUE AND NEW.is_pickable IS NOT TRUE)
       OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
      PERFORM child.id FROM public.warehouse_locations child
      WHERE child.path_ids @> ARRAY[NEW.id] ORDER BY child.id FOR UPDATE;
      IF EXISTS (
        SELECT 1 FROM public.item_batch_locations stock
        JOIN public.warehouse_locations l ON l.id = stock.location_id
        WHERE l.path_ids @> ARRAY[NEW.id] AND stock.deleted_at IS NULL
          AND ((stock.qty_reserved > 0 AND (l.id = NEW.id
            OR NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.is_active IS NOT TRUE OR NEW.deleted_at IS NOT NULL)) OR (
            stock.qty_on_hand > 0 AND (NEW.parent_id IS DISTINCT FROM OLD.parent_id
              OR NEW.is_active IS NOT TRUE OR NEW.deleted_at IS NOT NULL
              OR (l.id = NEW.id AND NEW.is_storable IS NOT TRUE))
          ))
      ) OR EXISTS (
        SELECT 1 FROM public.putaway_tasks task
        JOIN public.warehouse_locations l ON l.id = task.suggested_location_id
        WHERE l.path_ids @> ARRAY[NEW.id] AND task.deleted_at IS NULL AND task.status = 'pending'
          AND (NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.is_active IS NOT TRUE
            OR NEW.deleted_at IS NOT NULL OR (l.id = NEW.id AND NEW.is_storable IS NOT TRUE))
      ) THEN RAISE EXCEPTION 'LOCATION_IN_USE'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validate_warehouse_location_hierarchy
BEFORE INSERT OR UPDATE OF parent_id, code, name, location_type, warehouse_id, company_id,
  is_active, is_storable, is_pickable, deleted_at ON public.warehouse_locations
FOR EACH ROW EXECUTE FUNCTION public.validate_warehouse_location_hierarchy();

CREATE FUNCTION public.refresh_warehouse_location_descendants()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  WITH RECURSIVE tree AS (
    SELECT NEW.id AS id, NEW.path_ids AS ids, NEW.location_path AS address
    UNION ALL
    SELECT child.id, tree.ids || child.id,
      tree.address || ' / ' || concat_ws(' - ', child.code, NULLIF(child.name, ''))
    FROM public.warehouse_locations child JOIN tree ON child.parent_id = tree.id
  )
  UPDATE public.warehouse_locations l SET path_ids = tree.ids, location_path = tree.address
  FROM tree WHERE l.id = tree.id AND l.id <> NEW.id;
  RETURN NULL;
END $$;
CREATE TRIGGER refresh_warehouse_location_descendants
AFTER UPDATE OF parent_id, code, name ON public.warehouse_locations FOR EACH ROW
WHEN (OLD.parent_id IS DISTINCT FROM NEW.parent_id OR OLD.code IS DISTINCT FROM NEW.code
  OR OLD.name IS DISTINCT FROM NEW.name)
EXECUTE FUNCTION public.refresh_warehouse_location_descendants();

-- Lock exact destinations against configuration changes while stock/reservations are written.
CREATE FUNCTION public.validate_batch_location_storage()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_location RECORD;
BEGIN
  SELECT l.is_active, l.is_storable, l.is_pickable, l.deleted_at INTO v_location
  FROM public.warehouse_locations l WHERE l.id = NEW.location_id
    AND l.company_id = NEW.company_id AND l.warehouse_id = NEW.warehouse_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LOCATION_PARENT_INVALID'; END IF;
  IF TG_OP = 'UPDATE' AND (NEW.location_id <> OLD.location_id OR NEW.warehouse_id <> OLD.warehouse_id
    OR NEW.item_id <> OLD.item_id OR NEW.item_batch_id <> OLD.item_batch_id) THEN
    RAISE EXCEPTION 'LOCATION_STOCK_IDENTITY_IMMUTABLE';
  END IF;
  IF TG_OP = 'INSERT' OR NEW.qty_on_hand > OLD.qty_on_hand OR NEW.qty_reserved > OLD.qty_reserved THEN
    IF v_location.is_active IS NOT TRUE OR v_location.is_storable IS NOT TRUE OR v_location.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'LOCATION_STORAGE_UNAVAILABLE';
    END IF;
    IF NEW.qty_reserved > COALESCE(OLD.qty_reserved, 0) AND v_location.is_pickable IS NOT TRUE THEN
      RAISE EXCEPTION 'LOCATION_PICKING_UNAVAILABLE';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validate_batch_location_storage BEFORE INSERT OR UPDATE ON public.item_batch_locations
FOR EACH ROW EXECUTE FUNCTION public.validate_batch_location_storage();

-- Resolve the closest mapped ancestor without one database call per hierarchy level.
CREATE FUNCTION public.get_location_mapped_ancestor(p_company_id UUID, p_location_id UUID)
RETURNS TABLE (warehouse_location_id UUID, floor_map_id UUID)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT mapping.warehouse_location_id, mapping.floor_map_id
  FROM public.warehouse_locations location
  JOIN public.warehouse_floor_map_racks mapping ON mapping.warehouse_location_id = ANY(location.path_ids)
    AND mapping.company_id = location.company_id
  WHERE location.id = p_location_id AND location.company_id = p_company_id AND location.deleted_at IS NULL
  ORDER BY array_position(location.path_ids, mapping.warehouse_location_id) DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_location_mapped_ancestor(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_location_mapped_ancestor(UUID, UUID) TO authenticated, service_role;

DROP FUNCTION public.get_warehouse_location_capacities(UUID, UUID, INTEGER, INTEGER);
CREATE FUNCTION public.get_warehouse_location_capacities(
  p_business_unit_id UUID, p_warehouse_id UUID, p_page INTEGER DEFAULT 1, p_limit INTEGER DEFAULT 20,
  p_parent_id UUID DEFAULT NULL, p_roots_only BOOLEAN DEFAULT FALSE, p_search TEXT DEFAULT NULL,
  p_scope_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID, company_id UUID, warehouse_id UUID, code VARCHAR, name VARCHAR, parent_id UUID,
  location_type VARCHAR, is_pickable BOOLEAN, is_storable BOOLEAN, is_active BOOLEAN,
  max_capacity NUMERIC, used_capacity NUMERIC, utilization_percent NUMERIC, capacity_status TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, total_count BIGINT,
  location_path TEXT, child_count BIGINT, subtree_quantity NUMERIC
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
WITH page AS MATERIALIZED (
  SELECT l.id, l.company_id, l.warehouse_id, l.code, l.name, l.parent_id, l.location_type,
    l.is_pickable, l.is_storable, l.is_active, l.max_capacity, l.created_at, l.updated_at,
    l.location_path, COUNT(*) OVER() AS total_count
  FROM public.warehouse_locations l
  JOIN public.warehouses w ON w.id = l.warehouse_id AND w.company_id = l.company_id
  WHERE w.id = p_warehouse_id AND w.business_unit_id = p_business_unit_id AND w.deleted_at IS NULL
    AND l.deleted_at IS NULL
    AND l.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.user_business_unit_access a
      WHERE a.user_id = (SELECT auth.uid()) AND a.business_unit_id = p_business_unit_id)
    AND (p_parent_id IS NULL OR l.parent_id = p_parent_id)
    AND (NOT p_roots_only OR l.parent_id IS NULL)
    AND (p_scope_id IS NULL OR (l.path_ids @> ARRAY[p_scope_id] AND l.id <> p_scope_id))
    AND (NULLIF(btrim(p_search), '') IS NULL OR l.location_path ILIKE '%' || p_search || '%')
  ORDER BY l.code, l.id LIMIT LEAST(GREATEST(p_limit, 1), 100)
  OFFSET (GREATEST(p_page, 1) - 1) * LEAST(GREATEST(p_limit, 1), 100)
)
SELECT page.id, page.company_id, page.warehouse_id, page.code, page.name, page.parent_id,
  page.location_type, page.is_pickable, page.is_storable, page.is_active, page.max_capacity,
  usage.direct_quantity,
  CASE WHEN page.max_capacity IS NULL THEN 0 ELSE ROUND(usage.direct_quantity * 100 / page.max_capacity, 2) END,
  CASE WHEN page.is_storable IS NOT TRUE THEN 'not_storable'
    WHEN page.max_capacity IS NULL THEN 'not_configured'
    WHEN usage.direct_quantity = 0 THEN 'empty'
    WHEN usage.direct_quantity < page.max_capacity THEN 'partial'
    WHEN usage.direct_quantity = page.max_capacity THEN 'full' ELSE 'over_capacity' END,
  page.created_at::TIMESTAMPTZ, page.updated_at::TIMESTAMPTZ, page.total_count,
  page.location_path, children.quantity, usage.subtree_quantity
FROM page
CROSS JOIN LATERAL (
  SELECT COALESCE(SUM(stock.qty_on_hand) FILTER (WHERE child.id = page.id), 0) AS direct_quantity,
    COALESCE(SUM(stock.qty_on_hand), 0) AS subtree_quantity
  FROM public.warehouse_locations child
  LEFT JOIN public.item_batch_locations stock ON stock.location_id = child.id AND stock.deleted_at IS NULL
  WHERE child.path_ids @> ARRAY[page.id] AND child.deleted_at IS NULL
) usage
CROSS JOIN LATERAL (
  SELECT COUNT(*) AS quantity FROM public.warehouse_locations child
  WHERE child.parent_id = page.id AND child.deleted_at IS NULL
) children
ORDER BY page.code, page.id;
$$;
REVOKE ALL ON FUNCTION public.get_warehouse_location_capacities(UUID, UUID, INTEGER, INTEGER, UUID, BOOLEAN, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_warehouse_location_capacities(UUID, UUID, INTEGER, INTEGER, UUID, BOOLEAN, TEXT, UUID) TO authenticated;

-- One bounded read for the location panel: identity, ancestors, and the counts that gate
-- structural edits. Conditions mirror validate_warehouse_location_hierarchy, which stays authoritative.
CREATE FUNCTION public.get_warehouse_location_detail(p_business_unit_id UUID, p_location_id UUID)
RETURNS TABLE (
  id UUID, warehouse_id UUID, code VARCHAR, name VARCHAR, parent_id UUID, location_type VARCHAR,
  is_pickable BOOLEAN, is_storable BOOLEAN, is_active BOOLEAN, max_capacity NUMERIC,
  location_path TEXT, ancestors JSONB, child_count BIGINT, active_child_count BIGINT,
  descendant_count BIGINT, direct_on_hand NUMERIC, direct_reserved NUMERIC,
  subtree_on_hand NUMERIC, subtree_reserved NUMERIC, stocked_location_count BIGINT,
  direct_pending_putaway BIGINT, subtree_pending_putaway BIGINT
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
WITH target AS MATERIALIZED (
  SELECT l.id, l.company_id, l.warehouse_id, l.code, l.name, l.parent_id, l.location_type,
    l.is_pickable, l.is_storable, l.is_active, l.max_capacity, l.location_path, l.path_ids
  FROM public.warehouse_locations l
  JOIN public.warehouses w ON w.id = l.warehouse_id AND w.company_id = l.company_id
  WHERE l.id = p_location_id AND l.deleted_at IS NULL
    AND w.business_unit_id = p_business_unit_id AND w.deleted_at IS NULL
    AND l.company_id = (SELECT u.company_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
    AND EXISTS (SELECT 1 FROM public.user_business_unit_access a
      WHERE a.user_id = (SELECT auth.uid()) AND a.business_unit_id = p_business_unit_id)
),
subtree AS MATERIALIZED (
  SELECT child.id, child.parent_id, child.is_active
  FROM target
  JOIN public.warehouse_locations child ON child.company_id = target.company_id
    AND child.path_ids @> ARRAY[target.id] AND child.deleted_at IS NULL
)
SELECT target.id, target.warehouse_id, target.code, target.name, target.parent_id,
  target.location_type, target.is_pickable, target.is_storable, target.is_active,
  target.max_capacity, target.location_path,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', a.id, 'code', a.code, 'name', a.name,
      'locationPath', a.location_path, 'isActive', a.is_active)
      ORDER BY array_position(target.path_ids, a.id)), '[]'::jsonb)
    FROM public.warehouse_locations a
    WHERE a.id = ANY(target.path_ids) AND a.id <> target.id AND a.company_id = target.company_id),
  (SELECT COUNT(*) FROM subtree WHERE subtree.parent_id = target.id),
  (SELECT COUNT(*) FROM subtree WHERE subtree.parent_id = target.id AND subtree.is_active),
  (SELECT COUNT(*) FROM subtree WHERE subtree.id <> target.id),
  stock.direct_on_hand, stock.direct_reserved, stock.subtree_on_hand, stock.subtree_reserved,
  stock.stocked_location_count, putaway.direct_count, putaway.subtree_count
FROM target
CROSS JOIN LATERAL (
  SELECT COALESCE(SUM(s.qty_on_hand) FILTER (WHERE s.location_id = target.id), 0) AS direct_on_hand,
    COALESCE(SUM(s.qty_reserved) FILTER (WHERE s.location_id = target.id), 0) AS direct_reserved,
    COALESCE(SUM(s.qty_on_hand), 0) AS subtree_on_hand,
    COALESCE(SUM(s.qty_reserved), 0) AS subtree_reserved,
    COUNT(DISTINCT s.location_id) FILTER (WHERE s.qty_on_hand > 0) AS stocked_location_count
  FROM subtree
  JOIN public.item_batch_locations s ON s.company_id = target.company_id
    AND s.location_id = subtree.id AND s.deleted_at IS NULL
) stock
CROSS JOIN LATERAL (
  SELECT COUNT(*) FILTER (WHERE task.suggested_location_id = target.id) AS direct_count,
    COUNT(*) AS subtree_count
  FROM public.putaway_tasks task
  JOIN subtree ON subtree.id = task.suggested_location_id
  WHERE task.company_id = target.company_id AND task.status = 'pending' AND task.deleted_at IS NULL
) putaway;
$$;
REVOKE ALL ON FUNCTION public.get_warehouse_location_detail(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_warehouse_location_detail(UUID, UUID) TO authenticated;

-- Exact eligible storage sources at every configured hierarchy depth.
CREATE OR REPLACE FUNCTION public.search_stock_request_fulfillment_batches(
  p_company_id UUID,
  p_fulfilling_business_unit_id UUID,
  p_item_id UUID,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  batch_id UUID,
  batch_code TEXT,
  warehouse_id UUID,
  warehouse_code TEXT,
  warehouse_name TEXT,
  rack_summary TEXT,
  received_at TIMESTAMPTZ,
  available_base_qty NUMERIC,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_search TEXT := NULLIF(btrim(COALESCE(p_search, '')), '');
BEGIN
  IF p_company_id IS NULL
     OR p_fulfilling_business_unit_id IS NULL
     OR p_item_id IS NULL
     OR p_page < 1
     OR p_limit < 1
     OR p_limit > 5
     OR char_length(COALESCE(p_search, '')) > 100 THEN
    RAISE EXCEPTION 'STOCK_REQUEST_BATCH_LOOKUP_INVALID';
  END IF;

  RETURN QUERY
  WITH candidate_batches AS (
    SELECT
      batch.id AS batch_id,
      batch.batch_code::TEXT AS batch_code,
      batch.warehouse_id,
      warehouse.warehouse_code::TEXT AS warehouse_code,
      warehouse.warehouse_name::TEXT AS warehouse_name,
      batch.received_at,
      racks.rack_summary,
      LEAST(
        GREATEST(COALESCE(item_stock.available_stock, 0), 0),
        COALESCE(capacity.available_base_qty, 0)
      )::NUMERIC AS available_base_qty
    FROM public.item_batches batch
    JOIN public.warehouses warehouse
      ON warehouse.id = batch.warehouse_id
     AND warehouse.company_id = p_company_id
     AND warehouse.business_unit_id = p_fulfilling_business_unit_id
     AND warehouse.is_active IS TRUE
     AND warehouse.deleted_at IS NULL
    JOIN public.item_warehouse item_stock
      ON item_stock.company_id = p_company_id
     AND item_stock.item_id = batch.item_id
     AND item_stock.warehouse_id = warehouse.id
     AND item_stock.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT STRING_AGG(
        location_row.location_path,
        ', '
        ORDER BY location_row.code, location_row.id
      )::TEXT AS rack_summary
      FROM public.item_batch_locations batch_location
      JOIN public.warehouse_locations allocation_location
        ON allocation_location.id = batch_location.location_id
       AND allocation_location.company_id = batch_location.company_id
       AND allocation_location.warehouse_id = batch_location.warehouse_id
       AND allocation_location.is_active IS TRUE
       AND allocation_location.is_storable IS TRUE
       AND allocation_location.is_pickable IS TRUE
       AND allocation_location.deleted_at IS NULL
      JOIN public.warehouse_locations location_row
        ON location_row.id = batch_location.location_id
       AND location_row.company_id = p_company_id
       AND location_row.is_active IS TRUE
       AND location_row.deleted_at IS NULL
      WHERE batch_location.company_id = p_company_id
        AND batch_location.item_batch_id = batch.id
        AND batch_location.deleted_at IS NULL
        AND GREATEST(
          COALESCE(batch_location.qty_on_hand, 0)
            - COALESCE(batch_location.qty_reserved, 0),
          0
        ) > 0
    ) racks ON TRUE
    LEFT JOIN LATERAL (
      WITH raw_sources AS (
        SELECT
          batch_location.id AS batch_location_id,
          batch_location.created_at,
          GREATEST(
            COALESCE(batch_location.qty_on_hand, 0)
              - COALESCE(batch_location.qty_reserved, 0),
            0
          )::NUMERIC AS location_available_base,
          GREATEST(
            COALESCE(batch.qty_on_hand, 0) - COALESCE(batch.qty_reserved, 0),
            0
          )::NUMERIC AS batch_available_base
        FROM public.item_batch_locations batch_location
      JOIN public.warehouse_locations allocation_location
        ON allocation_location.id = batch_location.location_id
       AND allocation_location.company_id = batch_location.company_id
       AND allocation_location.warehouse_id = batch_location.warehouse_id
       AND allocation_location.is_active IS TRUE
       AND allocation_location.is_storable IS TRUE
       AND allocation_location.is_pickable IS TRUE
       AND allocation_location.deleted_at IS NULL
        WHERE batch_location.company_id = p_company_id
          AND batch_location.item_batch_id = batch.id
          AND batch_location.deleted_at IS NULL
      ),
      capped_sources AS (
        SELECT GREATEST(
          LEAST(
            raw_sources.location_available_base,
            raw_sources.batch_available_base - COALESCE(
              SUM(raw_sources.location_available_base) OVER (
                ORDER BY
                  batch.received_at,
                  raw_sources.created_at,
                  raw_sources.batch_location_id
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            )
          ),
          0
        )::NUMERIC AS source_available_base
        FROM raw_sources
      )
      SELECT COALESCE(
        SUM(capped_sources.source_available_base),
        0
      )::NUMERIC AS available_base_qty
      FROM capped_sources
    ) capacity ON TRUE
    WHERE batch.company_id = p_company_id
      AND batch.item_id = p_item_id
      AND batch.deleted_at IS NULL
      AND (
        v_search IS NULL
        OR batch.batch_code ILIKE '%' || v_search || '%'
        OR warehouse.warehouse_code ILIKE '%' || v_search || '%'
        OR warehouse.warehouse_name ILIKE '%' || v_search || '%'
        OR EXISTS (
          SELECT 1
          FROM public.item_batch_locations search_batch_location
          JOIN public.warehouse_locations search_location
            ON search_location.id = search_batch_location.location_id
           AND search_location.company_id = p_company_id
           AND search_location.deleted_at IS NULL
          WHERE search_batch_location.company_id = p_company_id
            AND search_batch_location.item_batch_id = batch.id
            AND search_batch_location.deleted_at IS NULL
            AND (
              search_location.code ILIKE '%' || v_search || '%'
              OR search_location.name ILIKE '%' || v_search || '%'
            )
        )
      )
  ),
  eligible_batches AS (
    SELECT
      candidate.batch_id,
      candidate.batch_code,
      candidate.warehouse_id,
      candidate.warehouse_code,
      candidate.warehouse_name,
      candidate.received_at,
      candidate.rack_summary,
      candidate.available_base_qty
    FROM candidate_batches candidate
    WHERE candidate.available_base_qty > 0
  )
  SELECT
    eligible.batch_id,
    eligible.batch_code,
    eligible.warehouse_id,
    eligible.warehouse_code,
    eligible.warehouse_name,
    COALESCE(eligible.rack_summary, '')::TEXT,
    eligible.received_at,
    eligible.available_base_qty,
    COUNT(*) OVER() AS total_count
  FROM eligible_batches eligible
  ORDER BY
    eligible.received_at,
    eligible.batch_code,
    eligible.batch_id
  OFFSET (p_page - 1) * p_limit
  LIMIT p_limit;
END;
$$;

-- Exact eligible storage sources at every configured hierarchy depth.
CREATE OR REPLACE FUNCTION public.get_delivery_note_allocation_availability(
  p_company_id UUID,
  p_user_id UUID,
  p_business_unit_id UUID,
  p_sr_item_ids UUID[]
)
RETURNS TABLE (
  sr_item_id UUID,
  remaining_request_qty NUMERIC,
  available_qty NUMERIC,
  available_base_qty NUMERIC,
  qty_per_unit NUMERIC,
  base_unit_label TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requested_count INTEGER := COALESCE(cardinality(p_sr_item_ids), 0);
  v_found_count INTEGER;
BEGIN
  IF v_requested_count < 1 OR v_requested_count > 100 THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_AVAILABILITY_LINE_LIMIT';
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_UNAUTHORIZED';
  END IF;

  IF NOT public.user_has_permission(
    p_user_id,
    'stock_requests',
    'edit',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_UNAUTHORIZED';
  END IF;

  SELECT COUNT(*)
  INTO v_found_count
  FROM public.stock_request_items request_item
  JOIN public.stock_requests request_row
    ON request_row.id = request_item.stock_request_id
   AND request_row.company_id = p_company_id
   AND request_row.deleted_at IS NULL
  WHERE request_item.id = ANY(p_sr_item_ids)
    AND request_row.fulfilling_business_unit_id = p_business_unit_id;

  IF v_found_count <> v_requested_count THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_INVALID_STOCK_REQUEST_ITEM';
  END IF;

  RETURN QUERY
  WITH line_context AS (
    SELECT
      request_item.id AS sr_item_id,
      request_item.item_id,
      request_item.selected_item_batch_id,
      request_row.fulfilling_business_unit_id,
      GREATEST(
        COALESCE(request_item.requested_qty, 0)
          - COALESCE(request_item.dispatch_qty, 0)
          - COALESCE((
              SELECT SUM(delivery_item.allocated_qty)
              FROM public.delivery_note_items delivery_item
              JOIN public.delivery_notes delivery_note
                ON delivery_note.id = delivery_item.dn_id
               AND delivery_note.company_id = p_company_id
              WHERE delivery_item.company_id = p_company_id
                AND delivery_item.sr_item_id = request_item.id
                AND delivery_item.is_voided = FALSE
                AND delivery_note.status NOT IN ('voided', 'dispatched', 'received')
            ), 0),
        0
      )::NUMERIC AS remaining_request_qty,
      GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1)::NUMERIC AS qty_per_unit,
      COALESCE(base_uom.symbol, base_uom.code, base_uom.name, '')::TEXT AS base_unit_label
    FROM public.stock_request_items request_item
    JOIN public.stock_requests request_row
      ON request_row.id = request_item.stock_request_id
     AND request_row.company_id = p_company_id
     AND request_row.deleted_at IS NULL
    LEFT JOIN public.item_unit_options unit_option
      ON unit_option.id = request_item.item_unit_option_id
     AND unit_option.company_id = p_company_id
     AND unit_option.deleted_at IS NULL
    JOIN public.items item_row
      ON item_row.id = request_item.item_id
     AND item_row.company_id = p_company_id
     AND item_row.deleted_at IS NULL
    LEFT JOIN public.units_of_measure base_uom
      ON base_uom.id = item_row.uom_id
    WHERE request_item.id = ANY(p_sr_item_ids)
  )
  SELECT
    line_context.sr_item_id,
    line_context.remaining_request_qty,
    COALESCE(capacity.available_qty, 0)::NUMERIC,
    COALESCE(capacity.available_base_qty, 0)::NUMERIC,
    line_context.qty_per_unit,
    line_context.base_unit_label
  FROM line_context
  CROSS JOIN LATERAL (
    WITH warehouse_capacity AS (
      SELECT
        warehouse.id AS warehouse_id,
        LEAST(
          FLOOR(GREATEST(COALESCE(item_stock.available_stock, 0), 0) / line_context.qty_per_unit),
          COALESCE(source_capacity.available_qty, 0)
        )::NUMERIC AS available_qty
      FROM public.warehouses warehouse
      JOIN public.item_warehouse item_stock
        ON item_stock.company_id = p_company_id
       AND item_stock.warehouse_id = warehouse.id
       AND item_stock.item_id = line_context.item_id
       AND item_stock.deleted_at IS NULL
      LEFT JOIN LATERAL (
        WITH raw_sources AS (
          SELECT
            batch_location.id AS batch_location_id,
            batch_location.item_batch_id,
            batch.received_at,
            batch_location.created_at,
            GREATEST(
              COALESCE(batch_location.qty_on_hand, 0)
                - COALESCE(batch_location.qty_reserved, 0),
              0
            )::NUMERIC AS location_available_base,
            GREATEST(
              COALESCE(batch.qty_on_hand, 0) - COALESCE(batch.qty_reserved, 0),
              0
            )::NUMERIC AS batch_available_base
          FROM public.item_batch_locations batch_location
      JOIN public.warehouse_locations allocation_location
        ON allocation_location.id = batch_location.location_id
       AND allocation_location.company_id = batch_location.company_id
       AND allocation_location.warehouse_id = batch_location.warehouse_id
       AND allocation_location.is_active IS TRUE
       AND allocation_location.is_storable IS TRUE
       AND allocation_location.is_pickable IS TRUE
       AND allocation_location.deleted_at IS NULL
          JOIN public.item_batches batch
            ON batch.id = batch_location.item_batch_id
           AND batch.company_id = batch_location.company_id
           AND batch.deleted_at IS NULL
          WHERE batch_location.company_id = p_company_id
            AND batch_location.item_id = line_context.item_id
            AND batch_location.warehouse_id = warehouse.id
            AND batch_location.deleted_at IS NULL
            AND (
              line_context.selected_item_batch_id IS NULL
              OR batch.id = line_context.selected_item_batch_id
            )
        ),
        capped_sources AS (
          SELECT
            GREATEST(
              LEAST(
                raw_sources.location_available_base,
                raw_sources.batch_available_base - COALESCE(
                  SUM(raw_sources.location_available_base) OVER (
                    PARTITION BY raw_sources.item_batch_id
                    ORDER BY
                      raw_sources.received_at,
                      raw_sources.created_at,
                      raw_sources.batch_location_id
                    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                  ),
                  0
                )
              ),
              0
            )::NUMERIC AS source_available_base
          FROM raw_sources
        )
        SELECT COALESCE(
          SUM(FLOOR(capped_sources.source_available_base / line_context.qty_per_unit)),
          0
        )::NUMERIC AS available_qty
        FROM capped_sources
      ) source_capacity ON TRUE
      WHERE warehouse.company_id = p_company_id
        AND warehouse.business_unit_id = line_context.fulfilling_business_unit_id
        AND warehouse.is_active IS TRUE
        AND warehouse.deleted_at IS NULL
    )
    SELECT
      COALESCE(SUM(warehouse_capacity.available_qty), 0)::NUMERIC AS available_qty,
      COALESCE(
        SUM(warehouse_capacity.available_qty) * line_context.qty_per_unit,
        0
      )::NUMERIC AS available_base_qty
    FROM warehouse_capacity
  ) capacity
  ORDER BY line_context.sr_item_id;
END;
$$;

-- Exact eligible storage sources at every configured hierarchy depth.
CREATE OR REPLACE FUNCTION public.create_delivery_notes_transactionally(
  p_company_id UUID,
  p_user_id UUID,
  p_business_unit_id UUID,
  p_fulfillment_mode TEXT,
  p_notes TEXT,
  p_driver_name TEXT,
  p_lines JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_line_count INTEGER;
  v_distinct_line_count INTEGER;
  v_input RECORD;
  v_line RECORD;
  v_source RECORD;
  v_existing_allocated_qty NUMERIC;
  v_max_allocatable_qty NUMERIC;
  v_remaining_qty NUMERIC;
  v_take_qty NUMERIC;
  v_take_base_qty NUMERIC;
  v_dn_id UUID;
  v_dn_no TEXT;
  v_dn_map JSONB := '{}'::JSONB;
  v_dn_ids JSONB := '[]'::JSONB;
  v_dn_key TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_UNAUTHORIZED';
  END IF;

  IF p_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_BUSINESS_UNIT_REQUIRED';
  END IF;

  IF NOT public.user_has_permission(
    p_user_id,
    'stock_requests',
    'edit',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_UNAUTHORIZED';
  END IF;

  IF p_fulfillment_mode NOT IN ('transfer_to_store', 'customer_pickup_from_warehouse') THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_INVALID_FULFILLMENT_MODE';
  END IF;

  IF jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_INVALID_LINES';
  END IF;

  SELECT COUNT(*), COUNT(DISTINCT parsed.sr_item_id)
  INTO v_line_count, v_distinct_line_count
  FROM jsonb_to_recordset(p_lines) AS parsed(sr_item_id UUID, allocated_qty NUMERIC);

  IF v_line_count < 1 OR v_line_count > 100 OR v_distinct_line_count <> v_line_count THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_INVALID_LINES';
  END IF;

  FOR v_input IN
    SELECT parsed.sr_item_id, parsed.allocated_qty
    FROM jsonb_to_recordset(p_lines) AS parsed(sr_item_id UUID, allocated_qty NUMERIC)
    ORDER BY parsed.sr_item_id
  LOOP
    IF v_input.sr_item_id IS NULL
       OR v_input.allocated_qty IS NULL
       OR v_input.allocated_qty <= 0 THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_INVALID_LINE_QUANTITY';
    END IF;

    SELECT
      request_item.id AS sr_item_id,
      request_item.stock_request_id AS sr_id,
      request_item.item_id,
      request_item.item_unit_option_id,
      request_item.selected_item_batch_id,
      request_item.uom_id,
      request_item.requested_qty,
      COALESCE(request_item.dispatch_qty, 0) AS dispatch_qty,
      request_row.status::TEXT AS request_status,
      request_row.business_unit_id AS requesting_business_unit_id,
      request_row.fulfilling_business_unit_id,
      GREATEST(COALESCE(unit_option.qty_per_unit, 1), 1)::NUMERIC AS qty_per_unit
    INTO v_line
    FROM public.stock_request_items request_item
    JOIN public.stock_requests request_row
      ON request_row.id = request_item.stock_request_id
     AND request_row.company_id = p_company_id
     AND request_row.deleted_at IS NULL
    LEFT JOIN public.item_unit_options unit_option
      ON unit_option.id = request_item.item_unit_option_id
     AND unit_option.company_id = p_company_id
     AND unit_option.deleted_at IS NULL
    WHERE request_item.id = v_input.sr_item_id
    FOR UPDATE OF request_item, request_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_INVALID_STOCK_REQUEST_ITEM';
    END IF;

    IF v_line.fulfilling_business_unit_id <> p_business_unit_id THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_BUSINESS_UNIT_MISMATCH';
    END IF;

    IF v_line.request_status NOT IN ('approved', 'partially_allocated', 'allocated') THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_INELIGIBLE_STOCK_REQUEST';
    END IF;

    PERFORM delivery_item.id
    FROM public.delivery_note_items delivery_item
    JOIN public.delivery_notes delivery_note
      ON delivery_note.id = delivery_item.dn_id
     AND delivery_note.company_id = p_company_id
    WHERE delivery_item.company_id = p_company_id
      AND delivery_item.sr_item_id = v_line.sr_item_id
      AND delivery_item.is_voided = FALSE
      AND delivery_note.status NOT IN ('voided', 'dispatched', 'received')
    ORDER BY delivery_item.id
    FOR UPDATE OF delivery_item, delivery_note;

    SELECT COALESCE(SUM(delivery_item.allocated_qty), 0)
    INTO v_existing_allocated_qty
    FROM public.delivery_note_items delivery_item
    JOIN public.delivery_notes delivery_note
      ON delivery_note.id = delivery_item.dn_id
     AND delivery_note.company_id = p_company_id
    WHERE delivery_item.company_id = p_company_id
      AND delivery_item.sr_item_id = v_line.sr_item_id
      AND delivery_item.is_voided = FALSE
      AND delivery_note.status NOT IN ('voided', 'dispatched', 'received');

    v_max_allocatable_qty := GREATEST(
      COALESCE(v_line.requested_qty, 0)
        - COALESCE(v_line.dispatch_qty, 0)
        - v_existing_allocated_qty,
      0
    );

    IF v_input.allocated_qty > v_max_allocatable_qty THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_REQUEST_QUANTITY_EXCEEDED';
    END IF;

    PERFORM item_stock.id
    FROM public.item_warehouse item_stock
    JOIN public.warehouses warehouse
      ON warehouse.id = item_stock.warehouse_id
     AND warehouse.company_id = p_company_id
     AND warehouse.business_unit_id = p_business_unit_id
     AND warehouse.is_active IS TRUE
     AND warehouse.deleted_at IS NULL
    WHERE item_stock.company_id = p_company_id
      AND item_stock.item_id = v_line.item_id
      AND item_stock.deleted_at IS NULL
    ORDER BY item_stock.id
    FOR UPDATE OF item_stock;

    v_remaining_qty := v_input.allocated_qty;

    FOR v_source IN
      WITH candidate_warehouses AS (
        SELECT
          warehouse.id AS warehouse_id,
          warehouse.warehouse_code,
          MIN(batch.received_at) AS oldest_received_at,
          LEAST(
            FLOOR(GREATEST(COALESCE(item_stock.available_stock, 0), 0) / v_line.qty_per_unit),
            COALESCE(SUM(FLOOR(source_rows.source_available_base / v_line.qty_per_unit)), 0)
          )::NUMERIC AS available_qty
        FROM public.warehouses warehouse
        JOIN public.item_warehouse item_stock
          ON item_stock.company_id = p_company_id
         AND item_stock.warehouse_id = warehouse.id
         AND item_stock.item_id = v_line.item_id
         AND item_stock.deleted_at IS NULL
        JOIN (
          SELECT
            batch_location.warehouse_id,
            batch_location.item_batch_id,
            batch_location.id AS batch_location_id,
            batch_location.created_at,
            GREATEST(
              LEAST(
                GREATEST(
                  COALESCE(batch_location.qty_on_hand, 0)
                    - COALESCE(batch_location.qty_reserved, 0),
                  0
                ),
                GREATEST(COALESCE(batch.qty_on_hand, 0) - COALESCE(batch.qty_reserved, 0), 0)
                  - COALESCE(
                    SUM(
                      GREATEST(
                        COALESCE(batch_location.qty_on_hand, 0)
                          - COALESCE(batch_location.qty_reserved, 0),
                        0
                      )
                    ) OVER (
                      PARTITION BY batch_location.item_batch_id
                      ORDER BY
                        batch.received_at,
                        batch_location.created_at,
                        batch_location.id
                      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                    ),
                    0
                  )
              ),
              0
            )::NUMERIC AS source_available_base
          FROM public.item_batch_locations batch_location
      JOIN public.warehouse_locations allocation_location
        ON allocation_location.id = batch_location.location_id
       AND allocation_location.company_id = batch_location.company_id
       AND allocation_location.warehouse_id = batch_location.warehouse_id
       AND allocation_location.is_active IS TRUE
       AND allocation_location.is_storable IS TRUE
       AND allocation_location.is_pickable IS TRUE
       AND allocation_location.deleted_at IS NULL
          JOIN public.item_batches batch
            ON batch.id = batch_location.item_batch_id
           AND batch.company_id = batch_location.company_id
           AND batch.deleted_at IS NULL
          WHERE batch_location.company_id = p_company_id
            AND batch_location.item_id = v_line.item_id
            AND batch_location.deleted_at IS NULL
            AND (
              v_line.selected_item_batch_id IS NULL
              OR batch.id = v_line.selected_item_batch_id
            )
        ) source_rows
          ON source_rows.warehouse_id = warehouse.id
        JOIN public.item_batches batch
          ON batch.id = source_rows.item_batch_id
        WHERE warehouse.company_id = p_company_id
          AND warehouse.business_unit_id = p_business_unit_id
          AND warehouse.is_active IS TRUE
          AND warehouse.deleted_at IS NULL
        GROUP BY
          warehouse.id,
          warehouse.warehouse_code,
          item_stock.available_stock
        HAVING LEAST(
          FLOOR(GREATEST(COALESCE(item_stock.available_stock, 0), 0) / v_line.qty_per_unit),
          COALESCE(SUM(FLOOR(source_rows.source_available_base / v_line.qty_per_unit)), 0)
        ) > 0
      )
      SELECT
        candidate_warehouses.warehouse_id,
        candidate_warehouses.warehouse_code,
        candidate_warehouses.oldest_received_at,
        candidate_warehouses.available_qty
      FROM candidate_warehouses
      ORDER BY oldest_received_at, warehouse_code, warehouse_id
    LOOP
      EXIT WHEN v_remaining_qty <= 0;

      v_take_qty := LEAST(v_remaining_qty, v_source.available_qty);
      IF v_take_qty <= 0 THEN
        CONTINUE;
      END IF;

      v_dn_key :=
        v_line.requesting_business_unit_id::TEXT || ':' || v_source.warehouse_id::TEXT;
      v_dn_id := NULLIF(v_dn_map ->> v_dn_key, '')::UUID;

      IF v_dn_id IS NULL THEN
        INSERT INTO public.delivery_notes (
          company_id,
          business_unit_id,
          requesting_business_unit_id,
          fulfilling_business_unit_id,
          status,
          requesting_warehouse_id,
          fulfilling_warehouse_id,
          fulfillment_mode,
          notes,
          driver_name,
          created_by,
          updated_by,
          created_at,
          updated_at
        )
        VALUES (
          p_company_id,
          p_business_unit_id,
          v_line.requesting_business_unit_id,
          p_business_unit_id,
          'draft',
          NULL,
          v_source.warehouse_id,
          p_fulfillment_mode,
          NULLIF(btrim(COALESCE(p_notes, '')), ''),
          NULLIF(btrim(COALESCE(p_driver_name, '')), ''),
          p_user_id,
          p_user_id,
          v_now,
          v_now
        )
        RETURNING id, dn_no INTO v_dn_id, v_dn_no;

        v_dn_map := jsonb_set(v_dn_map, ARRAY[v_dn_key], to_jsonb(v_dn_id::TEXT), TRUE);
        v_dn_ids := v_dn_ids || jsonb_build_array(
          jsonb_build_object(
            'deliveryNoteId', v_dn_id,
            'deliveryNoteNo', v_dn_no,
            'sourceWarehouseId', v_source.warehouse_id
          )
        );
      END IF;

      INSERT INTO public.delivery_note_sources (
        company_id,
        dn_id,
        sr_id,
        created_at
      )
      VALUES (
        p_company_id,
        v_dn_id,
        v_line.sr_id,
        v_now
      )
      ON CONFLICT (dn_id, sr_id) DO NOTHING;

      INSERT INTO public.delivery_note_items (
        company_id,
        dn_id,
        sr_id,
        sr_item_id,
        item_id,
        item_unit_option_id,
        uom_id,
        requesting_warehouse_id,
        fulfilling_warehouse_id,
        allocated_qty,
        picked_qty,
        short_qty,
        dispatched_qty,
        created_at,
        updated_at
      )
      VALUES (
        p_company_id,
        v_dn_id,
        v_line.sr_id,
        v_line.sr_item_id,
        v_line.item_id,
        v_line.item_unit_option_id,
        v_line.uom_id,
        NULL,
        v_source.warehouse_id,
        v_take_qty,
        0,
        v_take_qty,
        0,
        v_now,
        v_now
      );

      v_take_base_qty := v_take_qty * v_line.qty_per_unit;
      UPDATE public.item_warehouse
      SET
        reserved_stock = COALESCE(reserved_stock, 0) + v_take_base_qty,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE company_id = p_company_id
        AND item_id = v_line.item_id
        AND warehouse_id = v_source.warehouse_id
        AND deleted_at IS NULL;

      v_remaining_qty := v_remaining_qty - v_take_qty;
    END LOOP;

    IF v_remaining_qty > 0 THEN
      IF v_line.selected_item_batch_id IS NOT NULL THEN
        RAISE EXCEPTION 'DELIVERY_NOTE_SELECTED_BATCH_INSUFFICIENT';
      END IF;
      RAISE EXCEPTION 'DELIVERY_NOTE_INSUFFICIENT_INVENTORY';
    END IF;
  END LOOP;

  UPDATE public.stock_requests request_row
  SET
    status = CASE
      WHEN allocation.total_allocated >= allocation.total_requested THEN 'allocated'
      ELSE 'partially_allocated'
    END,
    updated_by = p_user_id,
    updated_at = v_now
  FROM (
    SELECT
      request_item.stock_request_id,
      SUM(request_item.requested_qty) AS total_requested,
      COALESCE(SUM(active_allocations.allocated_qty), 0) AS total_allocated
    FROM public.stock_request_items request_item
    LEFT JOIN (
      SELECT
        delivery_item.sr_item_id,
        SUM(delivery_item.allocated_qty) AS allocated_qty
      FROM public.delivery_note_items delivery_item
      JOIN public.delivery_notes delivery_note
        ON delivery_note.id = delivery_item.dn_id
       AND delivery_note.status <> 'voided'
      WHERE delivery_item.company_id = p_company_id
        AND delivery_item.is_voided = FALSE
      GROUP BY delivery_item.sr_item_id
    ) active_allocations
      ON active_allocations.sr_item_id = request_item.id
    WHERE request_item.stock_request_id IN (
      SELECT DISTINCT selected_item.stock_request_id
      FROM public.stock_request_items selected_item
      JOIN jsonb_to_recordset(p_lines) AS parsed(sr_item_id UUID, allocated_qty NUMERIC)
        ON parsed.sr_item_id = selected_item.id
    )
    GROUP BY request_item.stock_request_id
  ) allocation
  WHERE request_row.id = allocation.stock_request_id;

  RETURN jsonb_build_object('deliveryNotes', v_dn_ids);
END;
$$;

-- Exact eligible storage sources at every configured hierarchy depth.
DROP FUNCTION public.create_pick_list_with_allocation(UUID, UUID, UUID, UUID[], TEXT, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.create_pick_list_with_allocation(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_picker_user_ids UUID[],
  p_notes TEXT DEFAULT NULL,
  p_current_business_unit_id UUID DEFAULT NULL,
  p_batch_allocation_mode TEXT DEFAULT NULL,
  p_location_scope_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delivery_note_status TEXT;
  v_fulfilling_business_unit_id UUID;
  v_fulfilling_warehouse_id UUID;
  v_picker_user_ids UUID[];
  v_picker_count INTEGER;
  v_existing_pick_list_id UUID;
  v_pick_list_id UUID;
  v_pick_list_no TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_mode TEXT := NULLIF(btrim(COALESCE(p_batch_allocation_mode, '')), '');
  v_pending_count INTEGER := 0;
  v_delivery_item RECORD;
  v_outstanding_qty NUMERIC;
  v_qty_per_unit NUMERIC;
  v_required_base_qty NUMERIC;
  v_first_source RECORD;
  v_single_source RECORD;
  v_total_available_qty NUMERIC;
  v_remaining_qty NUMERIC;
  v_take_qty NUMERIC;
  v_source RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'PICK_LIST_UNAUTHORIZED';
  END IF;

  IF v_mode IS NOT NULL AND v_mode NOT IN ('single_sufficient', 'split') THEN
    RAISE EXCEPTION 'PICK_ALLOCATION_INVALID_MODE';
  END IF;

  SELECT
    delivery_note.status,
    delivery_note.fulfilling_business_unit_id,
    delivery_note.fulfilling_warehouse_id
  INTO
    v_delivery_note_status,
    v_fulfilling_business_unit_id,
    v_fulfilling_warehouse_id
  FROM public.delivery_notes delivery_note
  WHERE delivery_note.id = p_dn_id
    AND delivery_note.company_id = p_company_id
    AND delivery_note.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PICK_LIST_DELIVERY_NOTE_NOT_FOUND';
  END IF;

  IF v_delivery_note_status NOT IN ('confirmed', 'dispatched') THEN
    RAISE EXCEPTION 'PICK_LIST_INVALID_DELIVERY_NOTE_STATUS';
  END IF;

  IF p_current_business_unit_id IS NULL
     OR p_current_business_unit_id <> v_fulfilling_business_unit_id
     OR NOT public.user_has_permission(
       p_user_id,
       'stock_requests',
       'edit',
       p_current_business_unit_id
     ) THEN
    RAISE EXCEPTION 'PICK_LIST_UNAUTHORIZED';
  END IF;

  IF p_location_scope_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.warehouse_locations scope
    WHERE scope.id = p_location_scope_id AND scope.company_id = p_company_id
      AND scope.warehouse_id = v_fulfilling_warehouse_id AND scope.is_active IS TRUE
      AND scope.deleted_at IS NULL
  ) THEN RAISE EXCEPTION 'PICK_ALLOCATION_SCOPE_INVALID'; END IF;

  SELECT pick_list.id
  INTO v_existing_pick_list_id
  FROM public.pick_lists pick_list
  WHERE pick_list.company_id = p_company_id
    AND pick_list.dn_id = p_dn_id
    AND pick_list.status IN ('pending', 'in_progress', 'paused')
    AND pick_list.deleted_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_existing_pick_list_id IS NOT NULL THEN
    RAISE EXCEPTION 'PICK_LIST_ACTIVE_EXISTS';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT picker_id
    FROM unnest(COALESCE(p_picker_user_ids, ARRAY[]::UUID[])) picker_id
    WHERE picker_id IS NOT NULL
  )
  INTO v_picker_user_ids;

  IF COALESCE(cardinality(v_picker_user_ids), 0) < 1
     OR cardinality(v_picker_user_ids) > 50 THEN
    RAISE EXCEPTION 'PICK_LIST_PICKER_REQUIRED';
  END IF;

  SELECT COUNT(*)
  INTO v_picker_count
  FROM public.users user_row
  WHERE user_row.company_id = p_company_id
    AND user_row.id = ANY(v_picker_user_ids)
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF v_picker_count <> cardinality(v_picker_user_ids) THEN
    RAISE EXCEPTION 'PICK_LIST_INVALID_PICKER';
  END IF;

  INSERT INTO public.pick_lists (
    company_id,
    business_unit_id,
    dn_id,
    status,
    notes,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  VALUES (
    p_company_id,
    v_fulfilling_business_unit_id,
    p_dn_id,
    'pending',
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    p_user_id,
    p_user_id,
    v_now,
    v_now
  )
  RETURNING id, pick_list_no INTO v_pick_list_id, v_pick_list_no;

  INSERT INTO public.pick_list_assignees (
    company_id,
    pick_list_id,
    user_id,
    assigned_at,
    assigned_by
  )
  SELECT
    p_company_id,
    v_pick_list_id,
    picker_id,
    v_now,
    p_user_id
  FROM unnest(v_picker_user_ids) picker_id;

  FOR v_delivery_item IN
    SELECT
      delivery_item.id,
      delivery_item.sr_id,
      delivery_item.sr_item_id,
      delivery_item.item_id,
      delivery_item.item_unit_option_id,
      delivery_item.uom_id,
      request_item.selected_item_batch_id,
      delivery_item.allocated_qty,
      delivery_item.picked_qty,
      COALESCE(unit_option.qty_per_unit, 1) AS qty_per_unit
    FROM public.delivery_note_items delivery_item
    JOIN public.stock_request_items request_item
      ON request_item.id = delivery_item.sr_item_id
    LEFT JOIN public.item_unit_options unit_option
      ON unit_option.id = delivery_item.item_unit_option_id
     AND unit_option.company_id = delivery_item.company_id
     AND unit_option.deleted_at IS NULL
    WHERE delivery_item.company_id = p_company_id
      AND delivery_item.dn_id = p_dn_id
      AND delivery_item.is_voided IS FALSE
      AND COALESCE(delivery_item.allocated_qty, 0) > 0
    ORDER BY delivery_item.created_at, delivery_item.id
    FOR UPDATE OF delivery_item
  LOOP
    v_outstanding_qty := GREATEST(
      0,
      COALESCE(v_delivery_item.allocated_qty, 0)
        - COALESCE(v_delivery_item.picked_qty, 0)
    );
    IF v_outstanding_qty <= 0 THEN
      CONTINUE;
    END IF;

    v_pending_count := v_pending_count + 1;
    v_qty_per_unit := GREATEST(COALESCE(v_delivery_item.qty_per_unit, 1), 1);
    v_required_base_qty := v_outstanding_qty * v_qty_per_unit;

    WITH raw_sources AS (
      SELECT
        batch_location.id AS batch_location_id,
        batch_location.location_id,
        batch_location.batch_location_sku,
        batch_location.created_at,
        batch.id AS item_batch_id,
        batch.batch_code,
        batch.received_at,
        GREATEST(
          COALESCE(batch_location.qty_on_hand, 0)
            - COALESCE(batch_location.qty_reserved, 0),
          0
        )::NUMERIC AS location_available_base,
        GREATEST(
          COALESCE(batch.qty_on_hand, 0) - COALESCE(batch.qty_reserved, 0),
          0
        )::NUMERIC AS batch_available_base
      FROM public.item_batch_locations batch_location
      JOIN public.warehouse_locations allocation_location
        ON allocation_location.id = batch_location.location_id
       AND allocation_location.company_id = batch_location.company_id
       AND allocation_location.warehouse_id = batch_location.warehouse_id
       AND allocation_location.is_active IS TRUE
       AND allocation_location.is_storable IS TRUE
       AND allocation_location.is_pickable IS TRUE
       AND allocation_location.deleted_at IS NULL
       AND (p_location_scope_id IS NULL OR allocation_location.path_ids @> ARRAY[p_location_scope_id])
      JOIN public.item_batches batch
        ON batch.id = batch_location.item_batch_id
       AND batch.company_id = batch_location.company_id
       AND batch.deleted_at IS NULL
      WHERE batch_location.company_id = p_company_id
        AND batch_location.item_id = v_delivery_item.item_id
        AND batch_location.warehouse_id = v_fulfilling_warehouse_id
        AND batch_location.deleted_at IS NULL
        AND (
          v_delivery_item.selected_item_batch_id IS NULL
          OR batch.id = v_delivery_item.selected_item_batch_id
        )
    ),
    capped_sources AS (
      SELECT
        raw_sources.batch_location_id,
        raw_sources.location_id,
        raw_sources.batch_location_sku,
        raw_sources.item_batch_id,
        raw_sources.batch_code,
        raw_sources.received_at,
        GREATEST(
          LEAST(
            raw_sources.location_available_base,
            raw_sources.batch_available_base - COALESCE(
              SUM(raw_sources.location_available_base) OVER (
                PARTITION BY raw_sources.item_batch_id
                ORDER BY
                  raw_sources.received_at,
                  raw_sources.created_at,
                  raw_sources.batch_location_id
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            )
          ),
          0
        )::NUMERIC AS available_base_qty
      FROM raw_sources
    )
    SELECT
      capped_sources.batch_location_id,
      capped_sources.location_id,
      capped_sources.batch_location_sku,
      capped_sources.item_batch_id,
      capped_sources.batch_code,
      capped_sources.received_at,
      capped_sources.available_base_qty
    INTO v_first_source
    FROM capped_sources
    WHERE capped_sources.available_base_qty > 0
    ORDER BY
      capped_sources.received_at,
      capped_sources.batch_location_id
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PICK_ALLOCATION_INSUFFICIENT_BATCH_QUANTITY';
    END IF;

    IF v_first_source.available_base_qty >= v_required_base_qty THEN
      INSERT INTO public.pick_list_items (
        company_id,
        pick_list_id,
        dn_item_id,
        sr_id,
        sr_item_id,
        item_id,
        item_unit_option_id,
        uom_id,
        allocated_qty,
        picked_qty,
        short_qty,
        suggested_pick_location_id,
        suggested_pick_batch_code,
        suggested_pick_batch_received_at,
        suggested_batch_location_sku,
        created_at,
        updated_at
      )
      VALUES (
        p_company_id,
        v_pick_list_id,
        v_delivery_item.id,
        v_delivery_item.sr_id,
        v_delivery_item.sr_item_id,
        v_delivery_item.item_id,
        v_delivery_item.item_unit_option_id,
        v_delivery_item.uom_id,
        v_outstanding_qty,
        0,
        v_outstanding_qty,
        v_first_source.location_id,
        v_first_source.batch_code,
        v_first_source.received_at,
        v_first_source.batch_location_sku,
        v_now,
        v_now
      );
      CONTINUE;
    END IF;

    WITH raw_sources AS (
      SELECT
        batch_location.id AS batch_location_id,
        batch_location.location_id,
        batch_location.batch_location_sku,
        batch_location.created_at,
        batch.id AS item_batch_id,
        batch.batch_code,
        batch.received_at,
        GREATEST(
          COALESCE(batch_location.qty_on_hand, 0)
            - COALESCE(batch_location.qty_reserved, 0),
          0
        )::NUMERIC AS location_available_base,
        GREATEST(
          COALESCE(batch.qty_on_hand, 0) - COALESCE(batch.qty_reserved, 0),
          0
        )::NUMERIC AS batch_available_base
      FROM public.item_batch_locations batch_location
      JOIN public.warehouse_locations allocation_location
        ON allocation_location.id = batch_location.location_id
       AND allocation_location.company_id = batch_location.company_id
       AND allocation_location.warehouse_id = batch_location.warehouse_id
       AND allocation_location.is_active IS TRUE
       AND allocation_location.is_storable IS TRUE
       AND allocation_location.is_pickable IS TRUE
       AND allocation_location.deleted_at IS NULL
       AND (p_location_scope_id IS NULL OR allocation_location.path_ids @> ARRAY[p_location_scope_id])
      JOIN public.item_batches batch
        ON batch.id = batch_location.item_batch_id
       AND batch.company_id = batch_location.company_id
       AND batch.deleted_at IS NULL
      WHERE batch_location.company_id = p_company_id
        AND batch_location.item_id = v_delivery_item.item_id
        AND batch_location.warehouse_id = v_fulfilling_warehouse_id
        AND batch_location.deleted_at IS NULL
        AND (
          v_delivery_item.selected_item_batch_id IS NULL
          OR batch.id = v_delivery_item.selected_item_batch_id
        )
    ),
    capped_sources AS (
      SELECT
        raw_sources.batch_location_id,
        raw_sources.location_id,
        raw_sources.batch_location_sku,
        raw_sources.item_batch_id,
        raw_sources.batch_code,
        raw_sources.received_at,
        GREATEST(
          LEAST(
            raw_sources.location_available_base,
            raw_sources.batch_available_base - COALESCE(
              SUM(raw_sources.location_available_base) OVER (
                PARTITION BY raw_sources.item_batch_id
                ORDER BY
                  raw_sources.received_at,
                  raw_sources.created_at,
                  raw_sources.batch_location_id
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            )
          ),
          0
        )::NUMERIC AS available_base_qty
      FROM raw_sources
    )
    SELECT
      capped_sources.batch_location_id,
      capped_sources.location_id,
      capped_sources.batch_location_sku,
      capped_sources.item_batch_id,
      capped_sources.batch_code,
      capped_sources.received_at,
      capped_sources.available_base_qty
    INTO v_single_source
    FROM capped_sources
    WHERE capped_sources.available_base_qty >= v_required_base_qty
    ORDER BY
      capped_sources.received_at,
      capped_sources.batch_location_id
    LIMIT 1;

    IF v_mode = 'single_sufficient' THEN
      IF NOT FOUND THEN
        RAISE EXCEPTION 'PICK_ALLOCATION_SINGLE_SOURCE_UNAVAILABLE';
      END IF;

      INSERT INTO public.pick_list_items (
        company_id,
        pick_list_id,
        dn_item_id,
        sr_id,
        sr_item_id,
        item_id,
        item_unit_option_id,
        uom_id,
        allocated_qty,
        picked_qty,
        short_qty,
        suggested_pick_location_id,
        suggested_pick_batch_code,
        suggested_pick_batch_received_at,
        suggested_batch_location_sku,
        created_at,
        updated_at
      )
      VALUES (
        p_company_id,
        v_pick_list_id,
        v_delivery_item.id,
        v_delivery_item.sr_id,
        v_delivery_item.sr_item_id,
        v_delivery_item.item_id,
        v_delivery_item.item_unit_option_id,
        v_delivery_item.uom_id,
        v_outstanding_qty,
        0,
        v_outstanding_qty,
        v_single_source.location_id,
        v_single_source.batch_code,
        v_single_source.received_at,
        v_single_source.batch_location_sku,
        v_now,
        v_now
      );
      CONTINUE;
    END IF;

    IF v_mode IS DISTINCT FROM 'split' THEN
      RAISE EXCEPTION 'PICK_ALLOCATION_CHOICE_REQUIRED';
    END IF;

    WITH raw_sources AS (
      SELECT
        batch_location.id AS batch_location_id,
        batch_location.item_batch_id,
        batch_location.created_at,
        batch.received_at,
        GREATEST(
          COALESCE(batch_location.qty_on_hand, 0)
            - COALESCE(batch_location.qty_reserved, 0),
          0
        )::NUMERIC AS location_available_base,
        GREATEST(
          COALESCE(batch.qty_on_hand, 0) - COALESCE(batch.qty_reserved, 0),
          0
        )::NUMERIC AS batch_available_base
      FROM public.item_batch_locations batch_location
      JOIN public.warehouse_locations allocation_location
        ON allocation_location.id = batch_location.location_id
       AND allocation_location.company_id = batch_location.company_id
       AND allocation_location.warehouse_id = batch_location.warehouse_id
       AND allocation_location.is_active IS TRUE
       AND allocation_location.is_storable IS TRUE
       AND allocation_location.is_pickable IS TRUE
       AND allocation_location.deleted_at IS NULL
       AND (p_location_scope_id IS NULL OR allocation_location.path_ids @> ARRAY[p_location_scope_id])
      JOIN public.item_batches batch
        ON batch.id = batch_location.item_batch_id
       AND batch.company_id = batch_location.company_id
       AND batch.deleted_at IS NULL
      WHERE batch_location.company_id = p_company_id
        AND batch_location.item_id = v_delivery_item.item_id
        AND batch_location.warehouse_id = v_fulfilling_warehouse_id
        AND batch_location.deleted_at IS NULL
        AND (
          v_delivery_item.selected_item_batch_id IS NULL
          OR batch.id = v_delivery_item.selected_item_batch_id
        )
    ),
    capped_sources AS (
      SELECT GREATEST(
        LEAST(
          raw_sources.location_available_base,
          raw_sources.batch_available_base - COALESCE(
            SUM(raw_sources.location_available_base) OVER (
              PARTITION BY raw_sources.item_batch_id
              ORDER BY
                raw_sources.received_at,
                raw_sources.created_at,
                raw_sources.batch_location_id
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ),
            0
          )
        ),
        0
      )::NUMERIC AS available_base_qty
      FROM raw_sources
    )
    SELECT COALESCE(SUM(FLOOR(capped_sources.available_base_qty / v_qty_per_unit)), 0)
    INTO v_total_available_qty
    FROM capped_sources;

    IF v_total_available_qty < v_outstanding_qty THEN
      RAISE EXCEPTION 'PICK_ALLOCATION_INSUFFICIENT_BATCH_QUANTITY';
    END IF;

    v_remaining_qty := v_outstanding_qty;
    FOR v_source IN
      WITH raw_sources AS (
        SELECT
          batch_location.id AS batch_location_id,
          batch_location.location_id,
          batch_location.batch_location_sku,
          batch_location.created_at,
          batch.id AS item_batch_id,
          batch.batch_code,
          batch.received_at,
          GREATEST(
            COALESCE(batch_location.qty_on_hand, 0)
              - COALESCE(batch_location.qty_reserved, 0),
            0
          )::NUMERIC AS location_available_base,
          GREATEST(
            COALESCE(batch.qty_on_hand, 0) - COALESCE(batch.qty_reserved, 0),
            0
          )::NUMERIC AS batch_available_base
        FROM public.item_batch_locations batch_location
      JOIN public.warehouse_locations allocation_location
        ON allocation_location.id = batch_location.location_id
       AND allocation_location.company_id = batch_location.company_id
       AND allocation_location.warehouse_id = batch_location.warehouse_id
       AND allocation_location.is_active IS TRUE
       AND allocation_location.is_storable IS TRUE
       AND allocation_location.is_pickable IS TRUE
       AND allocation_location.deleted_at IS NULL
       AND (p_location_scope_id IS NULL OR allocation_location.path_ids @> ARRAY[p_location_scope_id])
        JOIN public.item_batches batch
          ON batch.id = batch_location.item_batch_id
         AND batch.company_id = batch_location.company_id
         AND batch.deleted_at IS NULL
        WHERE batch_location.company_id = p_company_id
          AND batch_location.item_id = v_delivery_item.item_id
          AND batch_location.warehouse_id = v_fulfilling_warehouse_id
          AND batch_location.deleted_at IS NULL
          AND (
            v_delivery_item.selected_item_batch_id IS NULL
            OR batch.id = v_delivery_item.selected_item_batch_id
          )
      ),
      capped_sources AS (
        SELECT
          raw_sources.batch_location_id,
          raw_sources.location_id,
          raw_sources.batch_location_sku,
          raw_sources.item_batch_id,
          raw_sources.batch_code,
          raw_sources.received_at,
          FLOOR(
            GREATEST(
              LEAST(
                raw_sources.location_available_base,
                raw_sources.batch_available_base - COALESCE(
                  SUM(raw_sources.location_available_base) OVER (
                    PARTITION BY raw_sources.item_batch_id
                    ORDER BY
                      raw_sources.received_at,
                      raw_sources.created_at,
                      raw_sources.batch_location_id
                    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                  ),
                  0
                )
              ),
              0
            ) / v_qty_per_unit
          )::NUMERIC AS available_qty
        FROM raw_sources
      )
      SELECT
        capped_sources.batch_location_id,
        capped_sources.location_id,
        capped_sources.batch_location_sku,
        capped_sources.item_batch_id,
        capped_sources.batch_code,
        capped_sources.received_at,
        capped_sources.available_qty
      FROM capped_sources
      WHERE capped_sources.available_qty > 0
      ORDER BY
        capped_sources.received_at,
        capped_sources.batch_location_id
    LOOP
      EXIT WHEN v_remaining_qty <= 0;
      v_take_qty := LEAST(v_remaining_qty, v_source.available_qty);

      INSERT INTO public.pick_list_items (
        company_id,
        pick_list_id,
        dn_item_id,
        sr_id,
        sr_item_id,
        item_id,
        item_unit_option_id,
        uom_id,
        allocated_qty,
        picked_qty,
        short_qty,
        suggested_pick_location_id,
        suggested_pick_batch_code,
        suggested_pick_batch_received_at,
        suggested_batch_location_sku,
        created_at,
        updated_at
      )
      VALUES (
        p_company_id,
        v_pick_list_id,
        v_delivery_item.id,
        v_delivery_item.sr_id,
        v_delivery_item.sr_item_id,
        v_delivery_item.item_id,
        v_delivery_item.item_unit_option_id,
        v_delivery_item.uom_id,
        v_take_qty,
        0,
        v_take_qty,
        v_source.location_id,
        v_source.batch_code,
        v_source.received_at,
        v_source.batch_location_sku,
        v_now,
        v_now
      );

      v_remaining_qty := v_remaining_qty - v_take_qty;
    END LOOP;

    IF v_remaining_qty > 0 THEN
      RAISE EXCEPTION 'PICK_ALLOCATION_INSUFFICIENT_BATCH_QUANTITY';
    END IF;
  END LOOP;

  IF v_pending_count = 0 THEN
    RAISE EXCEPTION 'PICK_LIST_NO_PENDING_LINES';
  END IF;

  UPDATE public.delivery_notes
  SET
    status = 'queued_for_picking',
    updated_at = v_now,
    updated_by = p_user_id
  WHERE id = p_dn_id
    AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'pickListId', v_pick_list_id,
    'pickListNo', v_pick_list_no
  );
END;
$$;
REVOKE ALL ON FUNCTION public.create_pick_list_with_allocation(UUID, UUID, UUID, UUID[], TEXT, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pick_list_with_allocation(UUID, UUID, UUID, UUID[], TEXT, UUID, TEXT, UUID) TO authenticated, service_role;


-- Exact eligible storage sources at every configured hierarchy depth.
CREATE OR REPLACE FUNCTION public.allocate_transformation_reservations(
  p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_company_id UUID;
  v_business_unit_id UUID := public.get_current_business_unit_id();
  v_order RECORD;
  v_reservation RECORD;
  v_source RECORD;
  v_remaining NUMERIC;
  v_available NUMERIC;
  v_take NUMERIC;
BEGIN
  SELECT user_row.company_id
  INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_actor_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF v_actor_id IS NULL OR v_company_id IS NULL OR v_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'TRANSFORMATION_CONTEXT_INVALID';
  END IF;

  IF NOT public.user_has_permission(
    v_actor_id,
    'stock_transformations',
    'edit',
    v_business_unit_id
  ) THEN
    RAISE EXCEPTION 'TRANSFORMATION_PERMISSION_DENIED';
  END IF;

  SELECT transformation_order.id,
         transformation_order.status,
         transformation_order.template_id
  INTO v_order
  FROM public.transformation_orders transformation_order
  WHERE transformation_order.id = p_order_id
    AND transformation_order.company_id = v_company_id
    AND transformation_order.business_unit_id = v_business_unit_id
    AND transformation_order.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSFORMATION_ORDER_NOT_FOUND';
  END IF;

  IF v_order.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'TRANSFORMATION_ORDER_STATUS_CHANGED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.transformation_templates template
    WHERE template.id = v_order.template_id
      AND template.company_id = v_company_id
      AND template.business_unit_id = v_business_unit_id
      AND template.is_active IS TRUE
      AND template.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'TRANSFORMATION_TEMPLATE_UNAVAILABLE';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inventory_reservations reservation
    LEFT JOIN public.items item
      ON item.id = reservation.item_id
     AND item.company_id = v_company_id
     AND item.is_active IS TRUE
     AND item.deleted_at IS NULL
    WHERE reservation.transformation_order_id = p_order_id
      AND reservation.reservation_type = 'transformation_order'
      AND reservation.deleted_at IS NULL
      AND item.id IS NULL
  ) THEN
    RAISE EXCEPTION 'TRANSFORMATION_INPUT_ITEM_UNAVAILABLE';
  END IF;

  FOR v_reservation IN
    SELECT
      reservation.id,
      reservation.transformation_order_input_id,
      reservation.item_id,
      reservation.warehouse_id,
      reservation.active_quantity_base
    FROM public.inventory_reservations reservation
    WHERE reservation.transformation_order_id = p_order_id
      AND reservation.reservation_type = 'transformation_order'
      AND reservation.deleted_at IS NULL
      AND reservation.active_quantity_base > 0
    ORDER BY reservation.item_id, reservation.id
    FOR UPDATE
  LOOP
    v_remaining := v_reservation.active_quantity_base;

    FOR v_source IN
      SELECT
        batch_location.id AS item_batch_location_id,
        batch_location.item_batch_id,
        batch_location.qty_on_hand,
        batch_location.qty_reserved
      FROM public.item_batch_locations batch_location
      JOIN public.warehouse_locations allocation_location
        ON allocation_location.id = batch_location.location_id
       AND allocation_location.company_id = batch_location.company_id
       AND allocation_location.warehouse_id = batch_location.warehouse_id
       AND allocation_location.is_active IS TRUE
       AND allocation_location.is_storable IS TRUE
       AND allocation_location.is_pickable IS TRUE
       AND allocation_location.deleted_at IS NULL
      JOIN public.item_batches item_batch
        ON item_batch.id = batch_location.item_batch_id
       AND item_batch.company_id = v_company_id
       AND item_batch.deleted_at IS NULL
      WHERE batch_location.company_id = v_company_id
        AND batch_location.item_id = v_reservation.item_id
        AND batch_location.warehouse_id = v_reservation.warehouse_id
        AND batch_location.deleted_at IS NULL
      ORDER BY item_batch.received_at, batch_location.created_at, batch_location.id
      FOR UPDATE OF batch_location, item_batch
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_available := GREATEST(
        0,
        COALESCE(v_source.qty_on_hand, 0) - COALESCE(v_source.qty_reserved, 0)
      );
      CONTINUE WHEN v_available <= 0;
      v_take := LEAST(v_available, v_remaining);

      UPDATE public.item_batch_locations
      SET qty_reserved = COALESCE(qty_reserved, 0) + v_take,
          updated_by = v_actor_id,
          updated_at = NOW()
      WHERE id = v_source.item_batch_location_id;

      UPDATE public.item_batches
      SET qty_reserved = COALESCE(qty_reserved, 0) + v_take,
          updated_by = v_actor_id,
          updated_at = NOW()
      WHERE id = v_source.item_batch_id;

      INSERT INTO public.inventory_reservation_allocations (
        company_id,
        business_unit_id,
        reservation_id,
        transformation_order_id,
        transformation_order_input_id,
        item_id,
        warehouse_id,
        item_batch_id,
        item_batch_location_id,
        quantity_base,
        status,
        created_by,
        updated_by
      ) VALUES (
        v_company_id,
        v_business_unit_id,
        v_reservation.id,
        p_order_id,
        v_reservation.transformation_order_input_id,
        v_reservation.item_id,
        v_reservation.warehouse_id,
        v_source.item_batch_id,
        v_source.item_batch_location_id,
        v_take,
        'active',
        v_actor_id,
        v_actor_id
      );

      v_remaining := v_remaining - v_take;
    END LOOP;

    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'TRANSFORMATION_INPUT_BATCH_STOCK_INSUFFICIENT';
    END IF;
  END LOOP;

  UPDATE public.transformation_orders
  SET status = 'PREPARING',
      updated_by = v_actor_id,
      updated_at = NOW()
  WHERE id = p_order_id;
END;
$$;

CREATE FUNCTION public.get_item_location_stock_page(
  p_company_id UUID, p_item_id UUID, p_business_unit_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 1, p_limit INTEGER DEFAULT 20, p_search TEXT DEFAULT NULL,
  p_location_id UUID DEFAULT NULL, p_batch_page INTEGER DEFAULT 1
) RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
WITH stocks AS MATERIALIZED (
  SELECT stock.location_id, stock.warehouse_id, SUM(stock.qty_on_hand) AS on_hand,
    SUM(stock.qty_reserved) AS reserved, SUM(stock.qty_available) AS available, COUNT(*) AS batch_count
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
    stocks.batch_count, l.code, l.name, l.location_type, l.location_path, l.path_ids,
    w.warehouse_code, w.warehouse_name
  FROM stocks JOIN public.warehouse_locations l ON l.id = stocks.location_id
  JOIN public.warehouses w ON w.id = stocks.warehouse_id
  WHERE (p_location_id IS NULL OR l.id = p_location_id)
    AND (NULLIF(btrim(p_search), '') IS NULL OR l.location_path ILIKE '%' || p_search || '%')
), page AS MATERIALIZED (
  SELECT location_id, warehouse_id, on_hand, reserved, available, batch_count, code, name,
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
    'batchCount', page.batch_count, 'batchPage', GREATEST(p_batch_page,1), 'batchPageSize', 20,
    'batches', COALESCE(batches.rows, '[]'::JSONB)
  ) ORDER BY page.warehouse_code, page.location_path, page.location_id)
  FROM page
  LEFT JOIN public.item_warehouse settings ON settings.item_id = p_item_id
    AND settings.warehouse_id = page.warehouse_id AND settings.company_id = p_company_id AND settings.deleted_at IS NULL
  CROSS JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('id', b.id, 'batchCode', b.batch_code, 'receivedAt', b.received_at,
      'qtyOnHand', b.qty_on_hand, 'qtyReserved', b.qty_reserved, 'qtyAvailable', b.qty_available)
      ORDER BY b.received_at, b.id) AS rows
    FROM (
      SELECT bl.id, batch.batch_code, batch.received_at, bl.qty_on_hand, bl.qty_reserved, bl.qty_available
      FROM public.item_batch_locations bl JOIN public.item_batches batch ON batch.id = bl.item_batch_id
      WHERE bl.item_id = p_item_id AND bl.location_id = page.location_id AND bl.company_id = p_company_id
        AND bl.deleted_at IS NULL AND batch.deleted_at IS NULL
      ORDER BY batch.received_at, bl.id LIMIT 20 OFFSET (GREATEST(p_batch_page,1)-1)*20
    ) b
  ) batches
), '[]'::JSONB), 'pagination', jsonb_build_object(
  'page', GREATEST(p_page,1), 'limit', LEAST(GREATEST(p_limit,1),50),
  'total', (SELECT COUNT(*) FROM eligible),
  'totalPages', CEIL((SELECT COUNT(*) FROM eligible)::NUMERIC / LEAST(GREATEST(p_limit,1),50))
));
$$;
REVOKE ALL ON FUNCTION public.get_item_location_stock_page(UUID, UUID, UUID, INTEGER, INTEGER, TEXT, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_item_location_stock_page(UUID, UUID, UUID, INTEGER, INTEGER, TEXT, UUID, INTEGER) TO authenticated;

CREATE FUNCTION public.get_item_floor_stock(p_company_id UUID, p_item_id UUID, p_floor_map_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
WITH stock AS MATERIALIZED (
 SELECT l.path_ids, SUM(bl.qty_on_hand) AS quantity
 FROM public.warehouse_floor_maps floor
 JOIN public.warehouses w ON w.id = floor.warehouse_id AND w.deleted_at IS NULL
 JOIN public.warehouse_locations l ON l.warehouse_id = w.id AND l.deleted_at IS NULL
 JOIN public.item_batch_locations bl ON bl.location_id = l.id AND bl.item_id = p_item_id
   AND bl.company_id = p_company_id AND bl.deleted_at IS NULL
 WHERE floor.id = p_floor_map_id AND floor.company_id = p_company_id
   AND p_company_id = (SELECT u.company_id FROM public.users u WHERE u.id = (SELECT auth.uid()))
   AND EXISTS (SELECT 1 FROM public.user_business_unit_access a
     WHERE a.user_id = (SELECT auth.uid()) AND a.business_unit_id = w.business_unit_id)
 GROUP BY l.id, l.path_ids HAVING SUM(bl.qty_on_hand) > 0
), mapped AS (
 SELECT rack.warehouse_location_id, SUM(stock.quantity) AS quantity
 FROM public.warehouse_floor_map_racks rack JOIN stock ON stock.path_ids @> ARRAY[rack.warehouse_location_id]
 WHERE rack.floor_map_id = p_floor_map_id AND rack.company_id = p_company_id
 GROUP BY rack.warehouse_location_id
)
SELECT jsonb_build_object('rackIds', COALESCE((SELECT jsonb_agg(warehouse_location_id) FROM mapped),'[]'::JSONB),
 'offFloorLocationCount', (SELECT COUNT(*) FROM stock WHERE NOT EXISTS (
   SELECT 1 FROM public.warehouse_floor_map_racks rack
   WHERE rack.floor_map_id = p_floor_map_id AND rack.company_id = p_company_id
     AND stock.path_ids @> ARRAY[rack.warehouse_location_id]
 )));
$$;
REVOKE ALL ON FUNCTION public.get_item_floor_stock(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_item_floor_stock(UUID, UUID, UUID) TO authenticated;

CREATE FUNCTION public.lock_putaway_suggested_location()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.suggested_location_id IS NOT NULL AND NEW.status = 'pending' AND NEW.deleted_at IS NULL THEN
    PERFORM l.id FROM public.warehouse_locations l WHERE l.id = NEW.suggested_location_id
      AND l.company_id = NEW.company_id AND l.warehouse_id = NEW.warehouse_id
      AND l.deleted_at IS NULL AND l.is_active IS TRUE AND l.is_storable IS TRUE FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Suggested putaway location is not valid'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lock_putaway_suggested_location
BEFORE INSERT OR UPDATE OF suggested_location_id, warehouse_id, status ON public.putaway_tasks
FOR EACH ROW EXECUTE FUNCTION public.lock_putaway_suggested_location();

-- Address columns are derived state. Direct writes must not bypass ancestry validation.
CREATE FUNCTION public.protect_warehouse_location_address()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF pg_trigger_depth() = 1 AND (NEW.path_ids IS DISTINCT FROM OLD.path_ids
    OR NEW.location_path IS DISTINCT FROM OLD.location_path) THEN
    RAISE EXCEPTION 'LOCATION_ADDRESS_READ_ONLY';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_warehouse_location_address
BEFORE UPDATE OF path_ids, location_path ON public.warehouse_locations
FOR EACH ROW EXECUTE FUNCTION public.protect_warehouse_location_address();

COMMIT;
