BEGIN;

CREATE OR REPLACE FUNCTION public.insert_stock_request_draft_items(
  p_stock_request_id UUID,
  p_company_id UUID,
  p_fulfilling_warehouse_id UUID,
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
  v_batch_available_qty NUMERIC(20, 2);
  v_batch_requested_base_qty NUMERIC(20, 2);
  v_selected_batch_quantities JSONB := '{}'::JSONB;
BEGIN
  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
     OR jsonb_array_length(p_items) > 200 THEN
    RAISE EXCEPTION 'STOCK_REQUEST_ITEMS_INVALID';
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
      FROM public.items item
      WHERE item.id = v_item_id
        AND item.company_id = p_company_id
        AND item.is_active IS TRUE
        AND item.deleted_at IS NULL
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
      SELECT batch.qty_available
      INTO v_batch_available_qty
      FROM public.item_batches batch
      WHERE batch.id = v_selected_item_batch_id
        AND batch.company_id = p_company_id
        AND batch.item_id = v_item_id
        AND batch.warehouse_id = p_fulfilling_warehouse_id
        AND batch.deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'STOCK_REQUEST_BATCH_UNAVAILABLE';
      END IF;

      v_batch_requested_base_qty :=
        COALESCE(
          (v_selected_batch_quantities ->> v_selected_item_batch_id::TEXT)::NUMERIC(20, 2),
          0
        )
        + (v_requested_qty * v_qty_per_unit);

      IF COALESCE(v_batch_available_qty, 0) < v_batch_requested_base_qty THEN
        RAISE EXCEPTION 'STOCK_REQUEST_BATCH_QUANTITY_UNAVAILABLE';
      END IF;

      v_selected_batch_quantities := jsonb_set(
        v_selected_batch_quantities,
        ARRAY[v_selected_item_batch_id::TEXT],
        to_jsonb(v_batch_requested_base_qty),
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

REVOKE ALL ON FUNCTION public.insert_stock_request_draft_items(UUID, UUID, UUID, JSONB)
FROM PUBLIC, authenticated, anon;

CREATE OR REPLACE FUNCTION public.create_stock_request_draft(
  p_business_unit_id UUID,
  p_request_date DATE,
  p_required_date DATE,
  p_requesting_warehouse_id UUID,
  p_fulfilling_warehouse_id UUID,
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
  v_requesting_business_unit_id UUID;
  v_fulfilling_business_unit_id UUID;
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

  IF v_company_id IS NULL OR p_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'STOCK_REQUEST_CONTEXT_INVALID';
  END IF;

  IF NOT public.user_has_permission(
    v_user_id,
    'stock_requests',
    'create',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'STOCK_REQUEST_FORBIDDEN';
  END IF;

  IF p_request_date IS NULL
     OR p_required_date IS NULL
     OR p_requesting_warehouse_id IS NULL
     OR p_fulfilling_warehouse_id IS NULL
     OR p_priority IS NULL
     OR p_priority NOT IN ('low', 'normal', 'high', 'urgent') THEN
    RAISE EXCEPTION 'STOCK_REQUEST_HEADER_INVALID';
  END IF;

  IF p_requesting_warehouse_id = p_fulfilling_warehouse_id THEN
    RAISE EXCEPTION 'STOCK_REQUEST_WAREHOUSES_MUST_DIFFER';
  END IF;

  SELECT warehouse.business_unit_id
  INTO v_requesting_business_unit_id
  FROM public.warehouses warehouse
  WHERE warehouse.id = p_requesting_warehouse_id
    AND warehouse.company_id = v_company_id
    AND warehouse.business_unit_id = p_business_unit_id
    AND warehouse.is_active IS TRUE
    AND warehouse.deleted_at IS NULL;

  IF v_requesting_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'STOCK_REQUEST_REQUESTING_WAREHOUSE_INVALID';
  END IF;

  SELECT warehouse.business_unit_id
  INTO v_fulfilling_business_unit_id
  FROM public.warehouses warehouse
  WHERE warehouse.id = p_fulfilling_warehouse_id
    AND warehouse.company_id = v_company_id
    AND warehouse.is_active IS TRUE
    AND warehouse.deleted_at IS NULL;

  IF v_fulfilling_business_unit_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.user_business_unit_access access_row
       WHERE access_row.user_id = v_user_id
         AND access_row.business_unit_id = v_fulfilling_business_unit_id
     ) THEN
    RAISE EXCEPTION 'STOCK_REQUEST_FULFILLING_WAREHOUSE_INVALID';
  END IF;

  INSERT INTO public.stock_requests (
    company_id,
    business_unit_id,
    request_date,
    required_date,
    requesting_warehouse_id,
    fulfilling_warehouse_id,
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
    p_request_date,
    p_required_date,
    p_requesting_warehouse_id,
    p_fulfilling_warehouse_id,
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
    p_fulfilling_warehouse_id,
    p_items
  );

  RETURN v_stock_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_stock_request_draft(
  UUID,
  DATE,
  DATE,
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_stock_request_draft(
  UUID,
  DATE,
  DATE,
  UUID,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
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
  v_requesting_warehouse_id UUID;
  v_fulfilling_warehouse_id UUID;
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

  IF v_company_id IS NULL OR p_stock_request_id IS NULL THEN
    RAISE EXCEPTION 'STOCK_REQUEST_UNAUTHORIZED';
  END IF;

  SELECT
    request_row.business_unit_id,
    request_row.requesting_warehouse_id,
    request_row.fulfilling_warehouse_id,
    request_row.status
  INTO
    v_business_unit_id,
    v_requesting_warehouse_id,
    v_fulfilling_warehouse_id,
    v_status
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.warehouses warehouse
    WHERE warehouse.id = v_requesting_warehouse_id
      AND warehouse.company_id = v_company_id
      AND warehouse.business_unit_id = v_business_unit_id
      AND warehouse.is_active IS TRUE
      AND warehouse.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'STOCK_REQUEST_REQUESTING_WAREHOUSE_INVALID';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.warehouses warehouse
    INNER JOIN public.user_business_unit_access access_row
      ON access_row.business_unit_id = warehouse.business_unit_id
     AND access_row.user_id = v_user_id
    WHERE warehouse.id = v_fulfilling_warehouse_id
      AND warehouse.company_id = v_company_id
      AND warehouse.is_active IS TRUE
      AND warehouse.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'STOCK_REQUEST_FULFILLING_WAREHOUSE_INVALID';
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
    v_fulfilling_warehouse_id,
    p_items
  );

  RETURN p_stock_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_stock_request_draft(
  UUID,
  DATE,
  DATE,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_stock_request_draft(
  UUID,
  DATE,
  DATE,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  JSONB
) TO authenticated;

COMMIT;
