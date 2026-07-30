BEGIN;

-- Stock requests describe demand between business units. Warehouses are assigned
-- only when fulfillment and receiving are executed.
ALTER TABLE public.stock_requests
  ADD COLUMN fulfilling_business_unit_id UUID NOT NULL REFERENCES public.business_units(id),
  ALTER COLUMN business_unit_id SET NOT NULL;

ALTER TABLE public.stock_requests
  ADD CONSTRAINT stock_requests_business_units_differ
  CHECK (business_unit_id <> fulfilling_business_unit_id);

CREATE INDEX idx_stock_requests_fulfilling_business_unit
  ON public.stock_requests(company_id, fulfilling_business_unit_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS bu_select_policy ON public.stock_requests;
DROP POLICY IF EXISTS bu_insert_policy ON public.stock_requests;
DROP POLICY IF EXISTS bu_update_policy ON public.stock_requests;
DROP POLICY IF EXISTS bu_delete_policy ON public.stock_requests;
DROP POLICY IF EXISTS bu_select_policy ON public.stock_request_items;
DROP POLICY IF EXISTS bu_insert_policy ON public.stock_request_items;
DROP POLICY IF EXISTS bu_update_policy ON public.stock_request_items;
DROP POLICY IF EXISTS bu_delete_policy ON public.stock_request_items;

DROP TRIGGER IF EXISTS trigger_validate_stock_request_item_selected_batch
  ON public.stock_request_items;
DROP TRIGGER IF EXISTS trigger_stock_request_items_validate_selected_batch
  ON public.stock_request_items;
DROP FUNCTION IF EXISTS public.validate_stock_request_item_selected_batch();

DROP FUNCTION IF EXISTS public.create_stock_request_draft(
  UUID, DATE, DATE, UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB
);
DROP FUNCTION IF EXISTS public.update_stock_request_draft(
  UUID, DATE, DATE, TEXT, TEXT, TEXT, TEXT, JSONB
);
DROP FUNCTION IF EXISTS public.insert_stock_request_draft_items(UUID, UUID, UUID, JSONB);

ALTER TABLE public.stock_requests
  DROP COLUMN requesting_warehouse_id,
  DROP COLUMN fulfilling_warehouse_id;

CREATE OR REPLACE FUNCTION public.validate_stock_request_item_selected_batch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_fulfilling_business_unit_id UUID;
  v_batch_item_id UUID;
  v_batch_company_id UUID;
  v_batch_deleted_at TIMESTAMPTZ;
  v_batch_business_unit_id UUID;
  v_warehouse_active BOOLEAN;
  v_warehouse_deleted_at TIMESTAMPTZ;
BEGIN
  IF NEW.selected_item_batch_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    request_row.company_id,
    request_row.fulfilling_business_unit_id
  INTO
    v_company_id,
    v_fulfilling_business_unit_id
  FROM public.stock_requests request_row
  WHERE request_row.id = NEW.stock_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_REQUEST_NOT_FOUND';
  END IF;

  SELECT
    batch.item_id,
    batch.company_id,
    batch.deleted_at,
    warehouse.business_unit_id,
    warehouse.is_active,
    warehouse.deleted_at
  INTO
    v_batch_item_id,
    v_batch_company_id,
    v_batch_deleted_at,
    v_batch_business_unit_id,
    v_warehouse_active,
    v_warehouse_deleted_at
  FROM public.item_batches batch
  JOIN public.warehouses warehouse
    ON warehouse.id = batch.warehouse_id
  WHERE batch.id = NEW.selected_item_batch_id;

  IF NOT FOUND
     OR v_batch_company_id IS DISTINCT FROM v_company_id
     OR v_batch_deleted_at IS NOT NULL
     OR v_warehouse_deleted_at IS NOT NULL
     OR v_warehouse_active IS NOT TRUE THEN
    RAISE EXCEPTION 'STOCK_REQUEST_SELECTED_BATCH_UNAVAILABLE';
  END IF;

  IF v_batch_item_id IS DISTINCT FROM NEW.item_id THEN
    RAISE EXCEPTION 'STOCK_REQUEST_SELECTED_BATCH_ITEM_MISMATCH';
  END IF;

  IF v_batch_business_unit_id IS DISTINCT FROM v_fulfilling_business_unit_id THEN
    RAISE EXCEPTION 'STOCK_REQUEST_SELECTED_BATCH_BUSINESS_UNIT_MISMATCH';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_stock_request_items_validate_selected_batch
  BEFORE INSERT OR UPDATE OF
    stock_request_id,
    item_id,
    selected_item_batch_id
  ON public.stock_request_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_stock_request_item_selected_batch();

CREATE POLICY bu_select_policy ON public.stock_requests
  FOR SELECT TO authenticated
  USING (
    business_unit_id IN (
      SELECT access_row.business_unit_id
      FROM public.user_business_unit_access access_row
      WHERE access_row.user_id = auth.uid()
    )
    OR (
      status <> 'draft'
      AND fulfilling_business_unit_id IN (
        SELECT access_row.business_unit_id
        FROM public.user_business_unit_access access_row
        WHERE access_row.user_id = auth.uid()
      )
    )
  );

CREATE POLICY bu_insert_policy ON public.stock_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    business_unit_id IN (
      SELECT access_row.business_unit_id
      FROM public.user_business_unit_access access_row
      WHERE access_row.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.business_units business_unit
      WHERE business_unit.id = stock_requests.fulfilling_business_unit_id
        AND business_unit.company_id = stock_requests.company_id
        AND business_unit.is_active IS TRUE
    )
  );

CREATE POLICY bu_update_policy ON public.stock_requests
  FOR UPDATE TO authenticated
  USING (
    business_unit_id IN (
      SELECT access_row.business_unit_id
      FROM public.user_business_unit_access access_row
      WHERE access_row.user_id = auth.uid()
    )
    OR (
      status <> 'draft'
      AND fulfilling_business_unit_id IN (
        SELECT access_row.business_unit_id
        FROM public.user_business_unit_access access_row
        WHERE access_row.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    business_unit_id IN (
      SELECT access_row.business_unit_id
      FROM public.user_business_unit_access access_row
      WHERE access_row.user_id = auth.uid()
    )
    OR (
      status <> 'draft'
      AND fulfilling_business_unit_id IN (
        SELECT access_row.business_unit_id
        FROM public.user_business_unit_access access_row
        WHERE access_row.user_id = auth.uid()
      )
    )
  );

CREATE POLICY bu_delete_policy ON public.stock_requests
  FOR DELETE TO authenticated
  USING (
    business_unit_id IN (
      SELECT access_row.business_unit_id
      FROM public.user_business_unit_access access_row
      WHERE access_row.user_id = auth.uid()
    )
  );

CREATE POLICY bu_select_policy ON public.stock_request_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stock_requests request_row
      WHERE request_row.id = stock_request_items.stock_request_id
        AND (
          request_row.business_unit_id IN (
            SELECT access_row.business_unit_id
            FROM public.user_business_unit_access access_row
            WHERE access_row.user_id = auth.uid()
          )
          OR (
            request_row.status <> 'draft'
            AND request_row.fulfilling_business_unit_id IN (
              SELECT access_row.business_unit_id
              FROM public.user_business_unit_access access_row
              WHERE access_row.user_id = auth.uid()
            )
          )
        )
    )
  );

CREATE POLICY bu_insert_policy ON public.stock_request_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.stock_requests request_row
      WHERE request_row.id = stock_request_items.stock_request_id
        AND request_row.business_unit_id IN (
          SELECT access_row.business_unit_id
          FROM public.user_business_unit_access access_row
          WHERE access_row.user_id = auth.uid()
        )
    )
  );

CREATE POLICY bu_update_policy ON public.stock_request_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stock_requests request_row
      WHERE request_row.id = stock_request_items.stock_request_id
        AND request_row.business_unit_id IN (
          SELECT access_row.business_unit_id
          FROM public.user_business_unit_access access_row
          WHERE access_row.user_id = auth.uid()
        )
    )
  );

CREATE POLICY bu_delete_policy ON public.stock_request_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.stock_requests request_row
      WHERE request_row.id = stock_request_items.stock_request_id
        AND request_row.business_unit_id IN (
          SELECT access_row.business_unit_id
          FROM public.user_business_unit_access access_row
          WHERE access_row.user_id = auth.uid()
        )
    )
  );

CREATE OR REPLACE FUNCTION public.insert_stock_request_draft_items(
  p_stock_request_id UUID,
  p_company_id UUID,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item JSONB;
  v_item_id UUID;
  v_item_unit_option_id UUID;
  v_selected_item_batch_id UUID;
  v_requested_qty NUMERIC(20, 2);
  v_uom_id UUID;
  v_option_uom_id UUID;
  v_qty_per_unit NUMERIC(20, 2);
  v_fulfilling_business_unit_id UUID;
  v_selected_batch_item_id UUID;
  v_selected_batch_business_unit_id UUID;
  v_selected_batch_available_qty NUMERIC(20, 2);
  v_selected_batch_available_base_qty NUMERIC(20, 2);
  v_selected_batch_quantities JSONB := '{}'::JSONB;
  v_selected_batch_requested_base_qty NUMERIC(20, 2);
BEGIN
  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
     OR jsonb_array_length(p_items) > 200 THEN
    RAISE EXCEPTION 'STOCK_REQUEST_ITEMS_INVALID';
  END IF;

  SELECT request_row.fulfilling_business_unit_id
  INTO v_fulfilling_business_unit_id
  FROM public.stock_requests request_row
  WHERE request_row.id = p_stock_request_id
    AND request_row.company_id = p_company_id
    AND request_row.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_REQUEST_NOT_FOUND';
  END IF;

  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_item_id := NULLIF(v_item ->> 'item_id', '')::UUID;
      v_item_unit_option_id := NULLIF(v_item ->> 'item_unit_option_id', '')::UUID;
      v_selected_item_batch_id := NULLIF(v_item ->> 'selected_item_batch_id', '')::UUID;
      v_requested_qty := NULLIF(v_item ->> 'requested_qty', '')::NUMERIC(20, 2);
      v_uom_id := NULLIF(v_item ->> 'uom_id', '')::UUID;
    EXCEPTION
      WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'STOCK_REQUEST_LINE_INVALID';
    END;

    IF v_item_id IS NULL
       OR v_item_unit_option_id IS NULL
       OR v_requested_qty IS NULL
       OR v_requested_qty <= 0 THEN
      RAISE EXCEPTION 'STOCK_REQUEST_LINE_INVALID';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.items item_row
      WHERE item_row.id = v_item_id
        AND item_row.company_id = p_company_id
        AND item_row.is_active IS TRUE
        AND item_row.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'STOCK_REQUEST_ITEM_UNAVAILABLE';
    END IF;

    SELECT option_row.uom_id, option_row.qty_per_unit
    INTO v_option_uom_id, v_qty_per_unit
    FROM public.item_unit_options option_row
    WHERE option_row.id = v_item_unit_option_id
      AND option_row.company_id = p_company_id
      AND option_row.item_id = v_item_id
      AND option_row.is_active IS TRUE
      AND option_row.deleted_at IS NULL;

    IF NOT FOUND OR v_qty_per_unit IS NULL OR v_qty_per_unit <= 0 THEN
      RAISE EXCEPTION 'STOCK_REQUEST_UNIT_OPTION_UNAVAILABLE';
    END IF;

    IF v_uom_id IS NOT NULL AND v_uom_id IS DISTINCT FROM v_option_uom_id THEN
      RAISE EXCEPTION 'STOCK_REQUEST_UNIT_OPTION_MISMATCH';
    END IF;

    IF v_selected_item_batch_id IS NOT NULL THEN
      WITH raw_sources AS (
        SELECT
          batch_location.id AS batch_location_id,
          batch_location.created_at,
          batch.received_at,
          batch.item_id,
          warehouse.business_unit_id,
          GREATEST(
            COALESCE(batch_location.qty_on_hand, 0)
              - COALESCE(batch_location.qty_reserved, 0),
            0
          )::NUMERIC AS location_available_base,
          GREATEST(
            COALESCE(batch.qty_on_hand, 0) - COALESCE(batch.qty_reserved, 0),
            0
          )::NUMERIC AS batch_available_base
        FROM public.item_batches batch
        JOIN public.warehouses warehouse
          ON warehouse.id = batch.warehouse_id
         AND warehouse.company_id = p_company_id
         AND warehouse.is_active IS TRUE
         AND warehouse.deleted_at IS NULL
        LEFT JOIN public.item_batch_locations batch_location
          ON batch_location.item_batch_id = batch.id
         AND batch_location.company_id = p_company_id
         AND batch_location.deleted_at IS NULL
        WHERE batch.id = v_selected_item_batch_id
          AND batch.company_id = p_company_id
          AND batch.deleted_at IS NULL
      ),
      capped_sources AS (
        SELECT
          raw_sources.item_id,
          raw_sources.business_unit_id,
          GREATEST(
            LEAST(
              raw_sources.location_available_base,
              raw_sources.batch_available_base - COALESCE(
                SUM(raw_sources.location_available_base) OVER (
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
      SELECT
        (ARRAY_AGG(capped_sources.item_id))[1],
        (ARRAY_AGG(capped_sources.business_unit_id))[1],
        COALESCE(
          SUM(FLOOR(capped_sources.source_available_base / v_qty_per_unit)),
          0
        )::NUMERIC,
        COALESCE(SUM(capped_sources.source_available_base), 0)::NUMERIC
      INTO
        v_selected_batch_item_id,
        v_selected_batch_business_unit_id,
        v_selected_batch_available_qty,
        v_selected_batch_available_base_qty
      FROM capped_sources;

      IF v_selected_batch_item_id IS NULL THEN
        RAISE EXCEPTION 'STOCK_REQUEST_SELECTED_BATCH_UNAVAILABLE';
      END IF;

      IF v_selected_batch_item_id IS DISTINCT FROM v_item_id THEN
        RAISE EXCEPTION 'STOCK_REQUEST_SELECTED_BATCH_ITEM_MISMATCH';
      END IF;

      IF v_selected_batch_business_unit_id IS DISTINCT FROM v_fulfilling_business_unit_id THEN
        RAISE EXCEPTION 'STOCK_REQUEST_SELECTED_BATCH_BUSINESS_UNIT_MISMATCH';
      END IF;

      v_selected_batch_requested_base_qty :=
        COALESCE(
          (v_selected_batch_quantities ->> v_selected_item_batch_id::TEXT)::NUMERIC(20, 2),
          0
        ) + (v_requested_qty * v_qty_per_unit);

      IF v_requested_qty > v_selected_batch_available_qty
         OR v_selected_batch_requested_base_qty > v_selected_batch_available_base_qty THEN
        RAISE EXCEPTION 'STOCK_REQUEST_SELECTED_BATCH_INSUFFICIENT';
      END IF;

      v_selected_batch_quantities := jsonb_set(
        v_selected_batch_quantities,
        ARRAY[v_selected_item_batch_id::TEXT],
        to_jsonb(v_selected_batch_requested_base_qty),
        TRUE
      );
    END IF;

    INSERT INTO public.stock_request_items (
      stock_request_id,
      item_id,
      requested_qty,
      picked_qty,
      item_unit_option_id,
      selected_item_batch_id,
      uom_id,
      notes
    )
    VALUES (
      p_stock_request_id,
      v_item_id,
      v_requested_qty,
      0,
      v_item_unit_option_id,
      v_selected_item_batch_id,
      v_option_uom_id,
      NULLIF(btrim(v_item ->> 'notes'), '')
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_stock_request_draft_items(UUID, UUID, JSONB)
  FROM PUBLIC, authenticated, anon;

CREATE OR REPLACE FUNCTION public.create_stock_request_draft(
  p_business_unit_id UUID,
  p_fulfilling_business_unit_id UUID,
  p_request_date DATE,
  p_required_date DATE,
  p_department TEXT,
  p_priority TEXT,
  p_purpose TEXT,
  p_notes TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_requested_by_name TEXT;
  v_stock_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'STOCK_REQUEST_UNAUTHORIZED';
  END IF;

  SELECT
    user_row.company_id,
    COALESCE(
      NULLIF(btrim(concat_ws(' ', user_row.first_name, user_row.last_name)), ''),
      user_row.email,
      user_row.id::TEXT
    )
  INTO v_company_id, v_requested_by_name
  FROM public.users user_row
  WHERE user_row.id = v_user_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  IF v_company_id IS NULL
     OR p_business_unit_id IS NULL
     OR p_fulfilling_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'STOCK_REQUEST_CONTEXT_INVALID';
  END IF;

  IF p_business_unit_id = p_fulfilling_business_unit_id THEN
    RAISE EXCEPTION 'STOCK_REQUEST_BUSINESS_UNITS_MUST_DIFFER';
  END IF;

  IF NOT public.user_has_permission(
    v_user_id,
    'stock_requests',
    'create',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'STOCK_REQUEST_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.business_units business_unit
    WHERE business_unit.id = p_fulfilling_business_unit_id
      AND business_unit.company_id = v_company_id
      AND business_unit.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'STOCK_REQUEST_FULFILLING_BUSINESS_UNIT_INVALID';
  END IF;

  IF p_request_date IS NULL
     OR p_required_date IS NULL
     OR p_priority IS NULL
     OR p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'STOCK_REQUEST_HEADER_INVALID';
  END IF;

  INSERT INTO public.stock_requests (
    company_id,
    business_unit_id,
    fulfilling_business_unit_id,
    request_date,
    required_date,
    department,
    status,
    priority,
    purpose,
    notes,
    requested_by_user_id,
    requested_by_name,
    created_by,
    updated_by
  )
  VALUES (
    v_company_id,
    p_business_unit_id,
    p_fulfilling_business_unit_id,
    p_request_date,
    p_required_date,
    NULLIF(btrim(p_department), ''),
    'draft',
    p_priority,
    NULLIF(btrim(p_purpose), ''),
    NULLIF(btrim(p_notes), ''),
    v_user_id,
    v_requested_by_name,
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_stock_request_id;

  PERFORM public.insert_stock_request_draft_items(
    v_stock_request_id,
    v_company_id,
    p_items
  );

  RETURN v_stock_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_stock_request_draft(
  UUID, UUID, DATE, DATE, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_stock_request_draft(
  UUID, UUID, DATE, DATE, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_stock_request_draft(
  p_stock_request_id UUID,
  p_request_date DATE,
  p_required_date DATE,
  p_department TEXT,
  p_priority TEXT,
  p_purpose TEXT,
  p_notes TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_business_unit_id UUID;
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'STOCK_REQUEST_UNAUTHORIZED';
  END IF;

  SELECT user_row.company_id
  INTO v_company_id
  FROM public.users user_row
  WHERE user_row.id = v_user_id
    AND user_row.is_active IS TRUE
    AND user_row.deleted_at IS NULL;

  SELECT request_row.business_unit_id, request_row.status
  INTO v_business_unit_id, v_status
  FROM public.stock_requests request_row
  WHERE request_row.id = p_stock_request_id
    AND request_row.company_id = v_company_id
    AND request_row.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'STOCK_REQUEST_NOT_FOUND';
  END IF;

  IF NOT public.user_has_permission(
    v_user_id,
    'stock_requests',
    'edit',
    v_business_unit_id
  ) THEN
    RAISE EXCEPTION 'STOCK_REQUEST_FORBIDDEN';
  END IF;

  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'STOCK_REQUEST_NOT_DRAFT';
  END IF;

  IF p_request_date IS NULL
     OR p_required_date IS NULL
     OR p_priority IS NULL
     OR p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'STOCK_REQUEST_HEADER_INVALID';
  END IF;

  UPDATE public.stock_requests
  SET
    request_date = p_request_date,
    required_date = p_required_date,
    department = NULLIF(btrim(p_department), ''),
    priority = p_priority,
    purpose = NULLIF(btrim(p_purpose), ''),
    notes = NULLIF(btrim(p_notes), ''),
    updated_by = v_user_id,
    updated_at = timezone('utc', now()),
    version = version + 1
  WHERE id = p_stock_request_id;

  DELETE FROM public.stock_request_items
  WHERE stock_request_id = p_stock_request_id;

  PERFORM public.insert_stock_request_draft_items(
    p_stock_request_id,
    v_company_id,
    p_items
  );

  RETURN p_stock_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_stock_request_draft(
  UUID, DATE, DATE, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_stock_request_draft(
  UUID, DATE, DATE, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated;

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
        location_row.code || ' - ' || location_row.name,
        ', '
        ORDER BY location_row.code, location_row.id
      )::TEXT AS rack_summary
      FROM public.item_batch_locations batch_location
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

REVOKE ALL ON FUNCTION public.search_stock_request_fulfillment_batches(
  UUID, UUID, UUID, TEXT, INTEGER, INTEGER
) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.search_stock_request_fulfillment_batches(
  UUID, UUID, UUID, TEXT, INTEGER, INTEGER
) TO service_role;

-- Delivery notes stay warehouse-specific on the fulfillment side. The receiving
-- warehouse is selected once the shipment reaches the requesting BU.
ALTER TABLE public.delivery_notes
  ADD COLUMN requesting_business_unit_id UUID NOT NULL REFERENCES public.business_units(id),
  ADD COLUMN fulfilling_business_unit_id UUID NOT NULL REFERENCES public.business_units(id),
  ALTER COLUMN business_unit_id SET NOT NULL,
  ALTER COLUMN requesting_warehouse_id DROP NOT NULL;

ALTER TABLE public.delivery_note_items
  ALTER COLUMN requesting_warehouse_id DROP NOT NULL;

CREATE INDEX idx_delivery_notes_requesting_business_unit
  ON public.delivery_notes(company_id, requesting_business_unit_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_delivery_notes_fulfilling_business_unit
  ON public.delivery_notes(company_id, fulfilling_business_unit_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

DROP FUNCTION IF EXISTS public.get_delivery_note_allocation_availability(
  UUID, UUID, UUID, UUID[]
);
DROP FUNCTION IF EXISTS public.create_delivery_note_transactionally(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB
);

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

REVOKE ALL ON FUNCTION public.get_delivery_note_allocation_availability(
  UUID, UUID, UUID, UUID[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_note_allocation_availability(
  UUID, UUID, UUID, UUID[]
) TO authenticated, service_role;

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

REVOKE ALL ON FUNCTION public.create_delivery_notes_transactionally(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_delivery_notes_transactionally(
  UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_pick_list_with_allocation(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_picker_user_ids UUID[],
  p_notes TEXT DEFAULT NULL,
  p_current_business_unit_id UUID DEFAULT NULL,
  p_batch_allocation_mode TEXT DEFAULT NULL
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

REVOKE ALL ON FUNCTION public.create_pick_list_with_allocation(
  UUID, UUID, UUID, UUID[], TEXT, UUID, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pick_list_with_allocation(
  UUID, UUID, UUID, UUID[], TEXT, UUID, TEXT
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.add_delivery_note_items_transactionally(
  p_company_id UUID,
  p_user_id UUID,
  p_business_unit_id UUID,
  p_delivery_note_id UUID,
  p_picker_user_ids UUID[],
  p_notes TEXT,
  p_lines JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requesting_business_unit_id UUID;
  v_fulfilling_business_unit_id UUID;
  v_requesting_warehouse_id UUID;
  v_fulfilling_warehouse_id UUID;
  v_status TEXT;
  v_line_count INTEGER;
  v_distinct_line_count INTEGER;
  v_line RECORD;
  v_request_line RECORD;
  v_existing_allocated_qty NUMERIC;
  v_max_allocatable_qty NUMERIC;
  v_delivery_note_item_id UUID;
  v_delivery_note_item_ids UUID[] := ARRAY[]::UUID[];
  v_pick_list JSONB;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_UNAUTHORIZED';
  END IF;

  IF p_business_unit_id IS NULL
     OR NOT public.user_has_permission(
       p_user_id,
       'stock_requests',
       'edit',
       p_business_unit_id
     ) THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_UNAUTHORIZED';
  END IF;

  IF COALESCE(cardinality(p_picker_user_ids), 0) < 1
     OR cardinality(p_picker_user_ids) > 50
     OR cardinality(p_picker_user_ids)
       <> cardinality(ARRAY(SELECT DISTINCT picker_id FROM unnest(p_picker_user_ids) picker_id)) THEN
    RAISE EXCEPTION 'PICK_LIST_PICKER_REQUIRED';
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

  SELECT
    delivery_note.requesting_business_unit_id,
    delivery_note.fulfilling_business_unit_id,
    delivery_note.requesting_warehouse_id,
    delivery_note.fulfilling_warehouse_id,
    delivery_note.status
  INTO
    v_requesting_business_unit_id,
    v_fulfilling_business_unit_id,
    v_requesting_warehouse_id,
    v_fulfilling_warehouse_id,
    v_status
  FROM public.delivery_notes delivery_note
  WHERE delivery_note.id = p_delivery_note_id
    AND delivery_note.company_id = p_company_id
    AND delivery_note.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_NOT_FOUND';
  END IF;

  IF v_status <> 'dispatched' THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_NOT_DISPATCHED';
  END IF;

  IF v_fulfilling_business_unit_id <> p_business_unit_id THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_BUSINESS_UNIT_MISMATCH';
  END IF;

  FOR v_line IN
    SELECT parsed.sr_item_id, parsed.allocated_qty
    FROM jsonb_to_recordset(p_lines) AS parsed(sr_item_id UUID, allocated_qty NUMERIC)
    ORDER BY parsed.sr_item_id
  LOOP
    IF v_line.sr_item_id IS NULL
       OR v_line.allocated_qty IS NULL
       OR v_line.allocated_qty <= 0 THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_INVALID_LINE_QUANTITY';
    END IF;

    SELECT
      request_item.stock_request_id AS sr_id,
      request_item.item_id,
      request_item.item_unit_option_id,
      request_item.uom_id,
      request_item.requested_qty,
      COALESCE(request_item.dispatch_qty, 0) AS dispatch_qty,
      request_row.status::TEXT AS request_status,
      request_row.business_unit_id AS requesting_business_unit_id,
      request_row.fulfilling_business_unit_id
    INTO v_request_line
    FROM public.stock_request_items request_item
    JOIN public.stock_requests request_row
      ON request_row.id = request_item.stock_request_id
     AND request_row.company_id = p_company_id
     AND request_row.deleted_at IS NULL
    WHERE request_item.id = v_line.sr_item_id
    FOR UPDATE OF request_item, request_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_INVALID_STOCK_REQUEST_ITEM';
    END IF;

    IF v_request_line.requesting_business_unit_id <> v_requesting_business_unit_id
       OR v_request_line.fulfilling_business_unit_id <> v_fulfilling_business_unit_id THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_BUSINESS_UNIT_MISMATCH';
    END IF;

    IF v_request_line.request_status IN ('draft', 'cancelled', 'completed', 'fulfilled') THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_INELIGIBLE_STOCK_REQUEST';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.delivery_note_items delivery_item
      WHERE delivery_item.company_id = p_company_id
        AND delivery_item.dn_id = p_delivery_note_id
        AND delivery_item.sr_item_id = v_line.sr_item_id
        AND delivery_item.is_voided IS FALSE
    ) THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_DUPLICATE_STOCK_REQUEST_ITEM';
    END IF;

    SELECT COALESCE(SUM(delivery_item.allocated_qty), 0)
    INTO v_existing_allocated_qty
    FROM public.delivery_note_items delivery_item
    JOIN public.delivery_notes delivery_note
      ON delivery_note.id = delivery_item.dn_id
     AND delivery_note.company_id = p_company_id
    WHERE delivery_item.company_id = p_company_id
      AND delivery_item.sr_item_id = v_line.sr_item_id
      AND delivery_item.is_voided IS FALSE
      AND delivery_note.status NOT IN ('voided', 'dispatched', 'received');

    v_max_allocatable_qty := GREATEST(
      COALESCE(v_request_line.requested_qty, 0)
        - v_request_line.dispatch_qty
        - v_existing_allocated_qty,
      0
    );

    IF v_line.allocated_qty > v_max_allocatable_qty THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_REQUEST_QUANTITY_EXCEEDED';
    END IF;

    INSERT INTO public.delivery_note_sources (
      company_id,
      dn_id,
      sr_id,
      created_at
    )
    VALUES (
      p_company_id,
      p_delivery_note_id,
      v_request_line.sr_id,
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
      p_delivery_note_id,
      v_request_line.sr_id,
      v_line.sr_item_id,
      v_request_line.item_id,
      v_request_line.item_unit_option_id,
      v_request_line.uom_id,
      v_requesting_warehouse_id,
      v_fulfilling_warehouse_id,
      v_line.allocated_qty,
      0,
      v_line.allocated_qty,
      0,
      v_now,
      v_now
    )
    RETURNING id INTO v_delivery_note_item_id;

    v_delivery_note_item_ids :=
      array_append(v_delivery_note_item_ids, v_delivery_note_item_id);
  END LOOP;

  PERFORM public.reserve_delivery_note_inventory_lines(
    p_company_id,
    p_user_id,
    p_delivery_note_id,
    v_delivery_note_item_ids
  );

  v_pick_list := public.create_pick_list_with_allocation(
    p_company_id,
    p_user_id,
    p_delivery_note_id,
    p_picker_user_ids,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    p_business_unit_id,
    'split'
  );

  RETURN jsonb_build_object(
    'deliveryNoteItemIds',
    to_jsonb(v_delivery_note_item_ids),
    'pickList',
    v_pick_list
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_delivery_note_items_transactionally(
  UUID, UUID, UUID, UUID, UUID[], TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_delivery_note_items_transactionally(
  UUID, UUID, UUID, UUID, UUID[], TEXT, JSONB
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.start_delivery_note_receiving_transactionally(
  p_company_id UUID,
  p_user_id UUID,
  p_business_unit_id UUID,
  p_delivery_note_id UUID,
  p_receiving_warehouse_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
  v_requesting_business_unit_id UUID;
  v_requesting_warehouse_id UUID;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_RECEIVING_UNAUTHORIZED';
  END IF;

  SELECT
    delivery_note.status,
    delivery_note.requesting_business_unit_id,
    delivery_note.requesting_warehouse_id
  INTO
    v_status,
    v_requesting_business_unit_id,
    v_requesting_warehouse_id
  FROM public.delivery_notes delivery_note
  WHERE delivery_note.id = p_delivery_note_id
    AND delivery_note.company_id = p_company_id
    AND delivery_note.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_NOT_FOUND';
  END IF;

  IF v_status <> 'dispatched' THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_NOT_DISPATCHED';
  END IF;

  IF v_requesting_business_unit_id <> p_business_unit_id THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_RECEIVING_FORBIDDEN';
  END IF;

  IF NOT public.user_has_permission(
    p_user_id,
    'stock_requests',
    'view',
    p_business_unit_id
  ) OR NOT public.user_has_permission(
    p_user_id,
    'stock_requests.operation.receive_delivery_notes.edit',
    'edit',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_RECEIVING_FORBIDDEN';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.warehouses warehouse
    WHERE warehouse.id = p_receiving_warehouse_id
      AND warehouse.company_id = p_company_id
      AND warehouse.business_unit_id = p_business_unit_id
      AND warehouse.is_active IS TRUE
      AND warehouse.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_RECEIVING_WAREHOUSE_INVALID';
  END IF;

  IF v_requesting_warehouse_id IS NOT NULL
     AND v_requesting_warehouse_id <> p_receiving_warehouse_id THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_RECEIVING_WAREHOUSE_IMMUTABLE';
  END IF;

  UPDATE public.delivery_notes
  SET
    requesting_warehouse_id = p_receiving_warehouse_id,
    receiving_started_at = COALESCE(receiving_started_at, NOW()),
    receiving_started_by = COALESCE(receiving_started_by, p_user_id),
    updated_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_delivery_note_id;

  UPDATE public.delivery_note_items
  SET
    requesting_warehouse_id = p_receiving_warehouse_id,
    updated_at = NOW()
  WHERE company_id = p_company_id
    AND dn_id = p_delivery_note_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_delivery_note_receiving_transactionally(
  UUID, UUID, UUID, UUID, UUID
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_delivery_note_receiving_transactionally(
  UUID, UUID, UUID, UUID, UUID
) TO authenticated, service_role;

-- Keep the stock request lifecycle cache consistent in the same transaction as
-- delivery-note allocation, voiding, dispatch, and receiving changes.
CREATE OR REPLACE FUNCTION public.reconcile_stock_request_statuses(
  p_stock_request_ids UUID[],
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF COALESCE(cardinality(p_stock_request_ids), 0) = 0 THEN
    RETURN;
  END IF;

  PERFORM request_row.id
  FROM public.stock_requests request_row
  WHERE request_row.id = ANY(p_stock_request_ids)
    AND request_row.deleted_at IS NULL
  ORDER BY request_row.id
  FOR UPDATE;

  WITH request_totals AS (
    SELECT
      request_item.stock_request_id,
      COALESCE(SUM(request_item.requested_qty), 0) AS total_requested,
      COALESCE(SUM(request_item.received_qty), 0) AS total_received
    FROM public.stock_request_items request_item
    WHERE request_item.stock_request_id = ANY(p_stock_request_ids)
    GROUP BY request_item.stock_request_id
  ),
  delivery_totals AS (
    SELECT
      delivery_item.sr_id AS stock_request_id,
      COALESCE(SUM(delivery_item.allocated_qty), 0) AS total_allocated,
      COALESCE(SUM(delivery_item.dispatched_qty), 0) AS total_dispatched,
      COUNT(*) > 0 AS has_active_delivery
    FROM public.delivery_note_items delivery_item
    JOIN public.delivery_notes delivery_note
      ON delivery_note.id = delivery_item.dn_id
     AND delivery_note.company_id = delivery_item.company_id
     AND delivery_note.deleted_at IS NULL
     AND delivery_note.status <> 'voided'
    WHERE delivery_item.sr_id = ANY(p_stock_request_ids)
      AND delivery_item.is_voided IS FALSE
    GROUP BY delivery_item.sr_id
  ),
  next_status AS (
    SELECT
      request_row.id,
      CASE
        WHEN totals.total_requested > 0
         AND totals.total_received >= totals.total_requested
          THEN 'fulfilled'
        WHEN totals.total_received > 0
          THEN 'partially_fulfilled'
        WHEN COALESCE(delivery.total_dispatched, 0) > 0
          THEN 'dispatched'
        WHEN totals.total_requested > 0
         AND COALESCE(delivery.total_allocated, 0) >= totals.total_requested
          THEN 'allocated'
        WHEN COALESCE(delivery.total_allocated, 0) > 0
          THEN 'partially_allocated'
        WHEN COALESCE(delivery.has_active_delivery, FALSE)
          THEN 'allocating'
        WHEN request_row.status IN (
          'allocating',
          'partially_allocated',
          'allocated',
          'ready_for_pick',
          'picking',
          'picked',
          'dispatched',
          'partially_fulfilled',
          'fulfilled',
          'delivered',
          'received',
          'completed'
        )
          THEN 'approved'
        ELSE request_row.status
      END AS status
    FROM public.stock_requests request_row
    JOIN request_totals totals
      ON totals.stock_request_id = request_row.id
    LEFT JOIN delivery_totals delivery
      ON delivery.stock_request_id = request_row.id
    WHERE request_row.id = ANY(p_stock_request_ids)
      AND request_row.deleted_at IS NULL
  )
  UPDATE public.stock_requests request_row
  SET
    status = next_status.status,
    received_at = CASE
      WHEN next_status.status IN ('partially_fulfilled', 'fulfilled')
        THEN COALESCE(request_row.received_at, v_now)
      ELSE request_row.received_at
    END,
    received_by = CASE
      WHEN next_status.status IN ('partially_fulfilled', 'fulfilled')
        THEN COALESCE(request_row.received_by, p_user_id, auth.uid())
      ELSE request_row.received_by
    END,
    updated_by = COALESCE(p_user_id, auth.uid(), request_row.updated_by),
    updated_at = v_now
  FROM next_status
  WHERE request_row.id = next_status.id;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_stock_request_statuses(UUID[], UUID)
  FROM PUBLIC, authenticated, anon;

CREATE OR REPLACE FUNCTION public.reconcile_stock_request_status_from_delivery_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stock_request_id UUID;
BEGIN
  v_stock_request_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.sr_id ELSE NEW.sr_id END;
  PERFORM public.reconcile_stock_request_statuses(ARRAY[v_stock_request_id], auth.uid());
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_stock_request_status_from_delivery_note()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stock_request_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT delivery_item.sr_id)
  INTO v_stock_request_ids
  FROM public.delivery_note_items delivery_item
  WHERE delivery_item.dn_id = NEW.id;

  PERFORM public.reconcile_stock_request_statuses(
    v_stock_request_ids,
    COALESCE(NEW.updated_by, auth.uid())
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_stock_request_status_from_request_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.reconcile_stock_request_statuses(
    ARRAY[NEW.stock_request_id],
    auth.uid()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_delivery_note_item_reconcile_stock_request
  AFTER INSERT OR UPDATE OF allocated_qty, dispatched_qty, is_voided OR DELETE
  ON public.delivery_note_items
  FOR EACH ROW
  EXECUTE FUNCTION public.reconcile_stock_request_status_from_delivery_item();

CREATE TRIGGER trigger_delivery_note_reconcile_stock_request
  AFTER UPDATE OF status
  ON public.delivery_notes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.reconcile_stock_request_status_from_delivery_note();

CREATE TRIGGER trigger_stock_request_item_receipt_reconcile_status
  AFTER UPDATE OF received_qty
  ON public.stock_request_items
  FOR EACH ROW
  WHEN (OLD.received_qty IS DISTINCT FROM NEW.received_qty)
  EXECUTE FUNCTION public.reconcile_stock_request_status_from_request_item();

-- The legacy van-loading stock transfer document is retired. Van EOD and other
-- inventory summaries must use posted stock_transactions instead.
DROP FUNCTION IF EXISTS public.get_van_expected_ending_stock(UUID, DATE);

DELETE FROM public.role_permissions role_permission
USING public.permissions permission
WHERE role_permission.permission_id = permission.id
  AND permission.resource = 'stock_transfers';

DELETE FROM public.permissions
WHERE resource = 'stock_transfers';

DROP TABLE public.stock_transfer_items;
DROP TABLE public.stock_transfers;

COMMIT;
