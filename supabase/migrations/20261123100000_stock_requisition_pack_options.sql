BEGIN;

-- Preserve per-line selected-unit fulfillment by requiring matching pack identities.

CREATE OR REPLACE FUNCTION public.link_load_list_stock_requisitions(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_load_list_id UUID,
  p_links JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_load_list_status TEXT;
  v_links_created INTEGER;
BEGIN
  IF v_auth_user_id IS NULL OR v_auth_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT u.company_id
  INTO v_user_company_id
  FROM public.users u
  WHERE u.id = v_auth_user_id
    AND u.deleted_at IS NULL
    AND u.is_active IS TRUE;

  IF v_user_company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT ll.status
  INTO v_load_list_status
  FROM public.load_lists ll
  WHERE ll.id = p_load_list_id
    AND ll.company_id = p_company_id
    AND ll.business_unit_id = p_business_unit_id
    AND ll.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Load list not found';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'load_lists',
    'view',
    p_business_unit_id
  ) OR NOT public.user_has_permission(
    v_auth_user_id,
    'load_lists.operation.link_stock_requisitions.edit',
    'edit',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_load_list_status NOT IN ('draft', 'confirmed', 'in_transit') THEN
    RAISE EXCEPTION 'Links can only be added to draft, confirmed, or in-transit load lists';
  END IF;

  IF p_links IS NULL
     OR JSONB_TYPEOF(p_links) <> 'array'
     OR JSONB_ARRAY_LENGTH(p_links) = 0
     OR JSONB_ARRAY_LENGTH(p_links) > 100 THEN
    RAISE EXCEPTION 'Invalid stock requisition links';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
    WHERE requested.load_list_item_id IS NULL
      OR requested.sr_item_id IS NULL
      OR requested.fulfilled_qty IS NULL
      OR requested.fulfilled_qty <= 0
      OR requested.fulfilled_qty <> ROUND(requested.fulfilled_qty, 4)
  ) THEN
    RAISE EXCEPTION 'Invalid stock requisition links';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
    GROUP BY requested.load_list_item_id, requested.sr_item_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate stock requisition links are not allowed';
  END IF;

  PERFORM lli.id
  FROM public.load_list_items lli
  WHERE lli.id IN (
    SELECT DISTINCT requested.load_list_item_id
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
  )
  ORDER BY lli.id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
    LEFT JOIN public.load_list_items lli
      ON lli.id = requested.load_list_item_id
     AND lli.load_list_id = p_load_list_id
    WHERE lli.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more load list items were not found in this load list';
  END IF;

  PERFORM sri.id
  FROM public.stock_requisition_items sri
  WHERE sri.id IN (
    SELECT DISTINCT requested.sr_item_id
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
  )
  ORDER BY sri.id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
    LEFT JOIN public.stock_requisition_items sri
      ON sri.id = requested.sr_item_id
    LEFT JOIN public.stock_requisitions sr
      ON sr.id = sri.sr_id
     AND sr.company_id = p_company_id
     AND sr.business_unit_id = p_business_unit_id
     AND sr.deleted_at IS NULL
    WHERE sri.id IS NULL OR sr.id IS NULL OR sr.status = 'cancelled'
  ) THEN
    RAISE EXCEPTION 'One or more stock requisition items are unavailable';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
    JOIN public.load_list_items lli
      ON lli.id = requested.load_list_item_id
    JOIN public.stock_requisition_items sri
      ON sri.id = requested.sr_item_id
    WHERE lli.item_id IS DISTINCT FROM sri.item_id
  ) THEN
    RAISE EXCEPTION 'Load list and stock requisition items must reference the same item';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
    JOIN public.load_list_items lli ON lli.id = requested.load_list_item_id
    JOIN public.stock_requisition_items sri ON sri.id = requested.sr_item_id
    LEFT JOIN public.item_unit_options iuo ON iuo.id = sri.item_unit_option_id
    WHERE lli.item_unit_option_id IS NULL
       OR sri.item_unit_option_id IS NULL
       OR lli.item_unit_option_id IS DISTINCT FROM sri.item_unit_option_id
       OR lli.uom_id IS DISTINCT FROM sri.uom_id
       OR iuo.uom_id IS DISTINCT FROM sri.uom_id
       OR lli.qty_per_unit IS DISTINCT FROM ROUND(iuo.qty_per_unit, 2)
  ) THEN
    RAISE EXCEPTION 'Load list and stock requisition items must reference the same pack option';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM JSONB_TO_RECORDSET(p_links) AS requested(
      load_list_item_id UUID,
      sr_item_id UUID,
      fulfilled_qty NUMERIC
    )
    JOIN public.load_list_sr_items existing_link
      ON existing_link.load_list_item_id = requested.load_list_item_id
     AND existing_link.sr_item_id = requested.sr_item_id
  ) THEN
    RAISE EXCEPTION 'One or more selected links already exist';
  END IF;

  IF EXISTS (
    WITH requested_totals AS (
      SELECT requested.load_list_item_id, SUM(requested.fulfilled_qty) AS fulfilled_qty
      FROM JSONB_TO_RECORDSET(p_links) AS requested(
        load_list_item_id UUID,
        sr_item_id UUID,
        fulfilled_qty NUMERIC
      )
      GROUP BY requested.load_list_item_id
    ),
    existing_totals AS (
      SELECT llsi.load_list_item_id, SUM(llsi.fulfilled_qty) AS fulfilled_qty
      FROM public.load_list_sr_items llsi
      WHERE llsi.load_list_item_id IN (SELECT load_list_item_id FROM requested_totals)
      GROUP BY llsi.load_list_item_id
    )
    SELECT 1
    FROM requested_totals requested_total
    JOIN public.load_list_items lli
      ON lli.id = requested_total.load_list_item_id
    LEFT JOIN existing_totals existing_total
      ON existing_total.load_list_item_id = requested_total.load_list_item_id
    WHERE requested_total.fulfilled_qty + COALESCE(existing_total.fulfilled_qty, 0)
      > lli.load_list_qty
  ) THEN
    RAISE EXCEPTION 'Linked quantity would exceed load list item quantity';
  END IF;

  IF EXISTS (
    WITH requested_totals AS (
      SELECT requested.sr_item_id, SUM(requested.fulfilled_qty) AS fulfilled_qty
      FROM JSONB_TO_RECORDSET(p_links) AS requested(
        load_list_item_id UUID,
        sr_item_id UUID,
        fulfilled_qty NUMERIC
      )
      GROUP BY requested.sr_item_id
    ),
    existing_totals AS (
      SELECT llsi.sr_item_id, SUM(llsi.fulfilled_qty) AS fulfilled_qty
      FROM public.load_list_sr_items llsi
      WHERE llsi.sr_item_id IN (SELECT sr_item_id FROM requested_totals)
      GROUP BY llsi.sr_item_id
    )
    SELECT 1
    FROM requested_totals requested_total
    JOIN public.stock_requisition_items sri
      ON sri.id = requested_total.sr_item_id
    LEFT JOIN existing_totals existing_total
      ON existing_total.sr_item_id = requested_total.sr_item_id
    WHERE requested_total.fulfilled_qty + COALESCE(existing_total.fulfilled_qty, 0)
      > sri.requested_qty
  ) THEN
    RAISE EXCEPTION 'Linked quantity would exceed stock requisition item quantity';
  END IF;

  INSERT INTO public.load_list_sr_items (
    load_list_item_id,
    sr_item_id,
    fulfilled_qty
  )
  SELECT
    requested.load_list_item_id,
    requested.sr_item_id,
    requested.fulfilled_qty
  FROM JSONB_TO_RECORDSET(p_links) AS requested(
    load_list_item_id UUID,
    sr_item_id UUID,
    fulfilled_qty NUMERIC
  );

  GET DIAGNOSTICS v_links_created = ROW_COUNT;

  PERFORM public.recalculate_stock_requisition_fulfillment_for_load_list(
    p_company_id,
    p_load_list_id
  );

  RETURN v_links_created;
END;
$$;

DROP FUNCTION public.list_eligible_load_list_requisition_items(UUID, UUID, UUID, UUID, TEXT, INTEGER, INTEGER);

CREATE FUNCTION public.list_eligible_load_list_requisition_items(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_load_list_id UUID,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 20,
  p_load_list_item_id UUID DEFAULT NULL
)
RETURNS TABLE (
  sr_item_id UUID,
  sr_id UUID,
  sr_number TEXT,
  sr_status TEXT,
  requisition_date DATE,
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  item_unit_option_id UUID,
  unit_name TEXT,
  qty_per_unit NUMERIC,
  requested_qty NUMERIC,
  fulfilled_qty NUMERIC,
  outstanding_qty NUMERIC,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_supplier_id UUID;
  v_selected_item_id UUID;
  v_selected_option_id UUID;
  v_selected_uom_id UUID;
  v_selected_qty_per_unit NUMERIC;
  v_search TEXT := NULLIF(BTRIM(p_search), '');
  v_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
BEGIN
  IF v_auth_user_id IS NULL OR v_auth_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT u.company_id
  INTO v_user_company_id
  FROM public.users u
  WHERE u.id = v_auth_user_id
    AND u.deleted_at IS NULL
    AND u.is_active IS TRUE;

  IF v_user_company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT ll.supplier_id
  INTO v_supplier_id
  FROM public.load_lists ll
  WHERE ll.id = p_load_list_id
    AND ll.company_id = p_company_id
    AND ll.business_unit_id = p_business_unit_id
    AND ll.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Load list not found';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'load_lists',
    'view',
    p_business_unit_id
  ) OR NOT public.user_has_permission(
    v_auth_user_id,
    'load_lists.operation.link_stock_requisitions.edit',
    'edit',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_load_list_item_id IS NOT NULL THEN
    SELECT lli.item_id, lli.item_unit_option_id, lli.uom_id, lli.qty_per_unit
    INTO v_selected_item_id, v_selected_option_id, v_selected_uom_id, v_selected_qty_per_unit
    FROM public.load_list_items lli
    WHERE lli.id = p_load_list_item_id AND lli.load_list_id = p_load_list_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Load list item not found';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    sri.id,
    sr.id,
    sr.sr_number::TEXT,
    sr.status::TEXT,
    sr.requisition_date,
    sri.item_id,
    i.item_code::TEXT,
    i.item_name::TEXT,
    sri.item_unit_option_id,
    COALESCE(NULLIF(BTRIM(iuo.option_label), ''), uom.name)::TEXT,
    iuo.qty_per_unit,
    sri.requested_qty,
    sri.fulfilled_qty,
    sri.outstanding_qty,
    COUNT(*) OVER() AS total_count
  FROM public.stock_requisition_items sri
  JOIN public.stock_requisitions sr
    ON sr.id = sri.sr_id
   AND sr.company_id = p_company_id
   AND sr.business_unit_id = p_business_unit_id
   AND sr.supplier_id = v_supplier_id
   AND sr.status IN ('submitted', 'partially_fulfilled')
   AND sr.deleted_at IS NULL
  JOIN public.items i
    ON i.id = sri.item_id
   AND i.company_id = p_company_id
   AND i.deleted_at IS NULL
  LEFT JOIN public.item_unit_options iuo ON iuo.id = sri.item_unit_option_id
  LEFT JOIN public.units_of_measure uom ON uom.id = sri.uom_id
  WHERE sri.outstanding_qty > 0
    AND (p_load_list_item_id IS NULL OR (
      sri.item_id = v_selected_item_id
      AND sri.item_unit_option_id = v_selected_option_id
      AND sri.uom_id = v_selected_uom_id
      AND iuo.uom_id = v_selected_uom_id
      AND ROUND(iuo.qty_per_unit, 2) = v_selected_qty_per_unit
    ))
    AND (
      v_search IS NULL
      OR sr.sr_number ILIKE '%' || v_search || '%'
      OR i.item_code ILIKE '%' || v_search || '%'
      OR i.item_name ILIKE '%' || v_search || '%'
    )
  ORDER BY sr.requisition_date DESC, sr.id DESC, sri.id ASC
  LIMIT v_limit
  OFFSET (v_page - 1) * v_limit;
END;
$$;

COMMENT ON FUNCTION public.list_eligible_load_list_requisition_items(
  UUID, UUID, UUID, UUID, TEXT, INTEGER, INTEGER, UUID
) IS
  'Returns a bounded supplier requisition page, optionally filtered by the exact item and pack option of a load-list line.';

-- Save header, pack-distinct lines, prices, and total as one authenticated operation.
CREATE FUNCTION public.save_stock_requisition(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_header JSONB,
  p_lines JSONB DEFAULT NULL,
  p_requisition_id UUID DEFAULT NULL
)
RETURNS TABLE (id UUID, sr_number TEXT, status TEXT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_company_id UUID;
  v_requisition_id UUID := p_requisition_id;
  v_status TEXT;
  v_currency TEXT := 'PHP';
  v_supplier_id UUID;
  v_can_view_cost BOOLEAN;
  v_preserved_costs JSONB := '{}'::JSONB;
  v_resolved_lines JSONB;
  v_currencies TEXT[];
  v_total NUMERIC;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR (SELECT auth.uid()) <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT u.company_id INTO v_user_company_id
  FROM public.users u
  WHERE u.id = p_user_id AND u.is_active IS TRUE AND u.deleted_at IS NULL;

  IF v_user_company_id IS DISTINCT FROM p_company_id
    OR p_business_unit_id IS DISTINCT FROM public.get_current_business_unit_id()
    OR NOT public.user_has_permission(p_user_id, 'stock_requisitions',
      CASE WHEN p_requisition_id IS NULL THEN 'create' ELSE 'edit' END,
      p_business_unit_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_header IS NULL OR JSONB_TYPEOF(p_header) <> 'object'
    OR p_header - ARRAY['supplier_id', 'requisition_date', 'required_by_date', 'notes', 'currency'] <> '{}'::JSONB
    OR LENGTH(COALESCE(p_header ->> 'notes', '')) > 10000 THEN
    RAISE EXCEPTION 'Invalid stock requisition';
  END IF;

  IF p_requisition_id IS NOT NULL THEN
    SELECT sr.status, sr.currency, sr.supplier_id
    INTO v_status, v_currency, v_supplier_id
    FROM public.stock_requisitions sr
    WHERE sr.id = p_requisition_id AND sr.company_id = p_company_id
      AND sr.business_unit_id = p_business_unit_id AND sr.deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Stock requisition not found';
    END IF;
    IF v_status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft requisitions can be edited';
    END IF;
    SELECT COALESCE(JSONB_OBJECT_AGG(sri.item_unit_option_id::TEXT, sri.unit_price), '{}'::JSONB)
    INTO v_preserved_costs
    FROM public.stock_requisition_items sri
    WHERE sri.sr_id = p_requisition_id AND sri.item_unit_option_id IS NOT NULL;
  ELSIF p_lines IS NULL THEN
    RAISE EXCEPTION 'Invalid stock requisition lines';
  END IF;

  IF p_header ? 'supplier_id' THEN
    v_supplier_id := (p_header ->> 'supplier_id')::UUID;
  END IF;
  IF v_supplier_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = v_supplier_id AND s.company_id = p_company_id AND s.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Supplier not found';
  END IF;

  IF p_lines IS NOT NULL AND JSONB_TYPEOF(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'Invalid stock requisition lines';
  END IF;

  v_can_view_cost := public.user_has_permission(p_user_id,
    'stock_requisitions.field.unit_cost.view', 'view', p_business_unit_id);

  IF NOT v_can_view_cost AND ((p_header ->> 'currency') IS NOT NULL OR EXISTS (
    SELECT 1 FROM JSONB_ARRAY_ELEMENTS(COALESCE(p_lines, '[]'::JSONB)) entry
    WHERE entry ? 'unit_price'
  )) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_lines IS NOT NULL THEN
    IF JSONB_TYPEOF(p_lines) <> 'array' OR JSONB_ARRAY_LENGTH(p_lines) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'Invalid stock requisition lines';
    END IF;
    IF EXISTS (
      SELECT 1 FROM JSONB_ARRAY_ELEMENTS(p_lines) entry
      WHERE JSONB_TYPEOF(entry) <> 'object'
        OR entry - ARRAY['item_id', 'item_unit_option_id', 'uom_id', 'requested_qty', 'unit_price', 'notes'] <> '{}'::JSONB
    ) OR EXISTS (
      SELECT 1 FROM JSONB_TO_RECORDSET(p_lines) line(
        item_id UUID, item_unit_option_id UUID, uom_id UUID,
        requested_qty NUMERIC, unit_price NUMERIC, notes TEXT)
      WHERE line.item_id IS NULL OR line.item_unit_option_id IS NULL OR line.uom_id IS NULL
        OR line.requested_qty IS NULL OR ROUND(line.requested_qty, 4) <= 0
        OR ROUND(line.requested_qty, 4) > 99999999999.9999
        OR (line.unit_price IS NOT NULL AND (line.unit_price < 0
          OR ROUND(line.unit_price, 4) > 9999999999999999.9999))
        OR LENGTH(COALESCE(line.notes, '')) > 10000
    ) THEN
      RAISE EXCEPTION 'Invalid stock requisition lines';
    END IF;

    IF EXISTS (
      SELECT 1 FROM JSONB_TO_RECORDSET(p_lines) line(item_unit_option_id UUID)
      GROUP BY line.item_unit_option_id HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION 'Duplicate stock requisition pack option';
    END IF;

    -- Protect the conversion and item defaults used for this save from concurrent edits.
    PERFORM i.id FROM public.items i
    WHERE i.id IN (SELECT line.item_id FROM JSONB_TO_RECORDSET(p_lines) line(item_id UUID))
    ORDER BY i.id FOR SHARE;
    PERFORM iuo.id FROM public.item_unit_options iuo
    WHERE iuo.id IN (
      SELECT line.item_unit_option_id FROM JSONB_TO_RECORDSET(p_lines) line(item_unit_option_id UUID)
    ) ORDER BY iuo.id FOR SHARE;

    IF EXISTS (
      SELECT 1 FROM JSONB_TO_RECORDSET(p_lines) line(item_id UUID, item_unit_option_id UUID, uom_id UUID)
      LEFT JOIN public.item_unit_options iuo ON iuo.id = line.item_unit_option_id
        AND iuo.item_id = line.item_id AND iuo.uom_id = line.uom_id AND iuo.company_id = p_company_id
        AND iuo.is_active IS TRUE AND iuo.deleted_at IS NULL AND iuo.qty_per_unit > 0
      LEFT JOIN public.items i ON i.id = line.item_id AND i.company_id = p_company_id AND i.deleted_at IS NULL
      WHERE iuo.id IS NULL OR i.id IS NULL
    ) THEN
      RAISE EXCEPTION 'Selected unit option is unavailable';
    END IF;

    WITH resolved AS (
      SELECT line.item_id, line.item_unit_option_id, line.uom_id,
        ROUND(line.requested_qty, 4) AS requested_qty, line.notes, iuo.qty_per_unit,
        ROUND(CASE WHEN v_can_view_cost THEN COALESCE(line.unit_price, 0)
          WHEN v_preserved_costs ? line.item_unit_option_id::TEXT
            THEN (v_preserved_costs ->> line.item_unit_option_id::TEXT)::NUMERIC
          ELSE COALESCE(i.import_cost, i.purchase_price, i.sales_price, 0) END, 4) AS unit_price,
        CASE WHEN v_can_view_cost THEN COALESCE(NULLIF(UPPER(BTRIM(p_header ->> 'currency')), ''), 'PHP')
          WHEN v_preserved_costs ? line.item_unit_option_id::TEXT THEN v_currency
          WHEN i.import_cost IS NOT NULL THEN COALESCE(NULLIF(UPPER(BTRIM(i.import_currency)), ''), 'PHP')
          ELSE 'PHP' END AS currency
      FROM JSONB_TO_RECORDSET(p_lines) line(item_id UUID, item_unit_option_id UUID,
        uom_id UUID, requested_qty NUMERIC, unit_price NUMERIC, notes TEXT)
      JOIN public.item_unit_options iuo ON iuo.id = line.item_unit_option_id
      JOIN public.items i ON i.id = line.item_id
    )
    SELECT JSONB_AGG(JSONB_BUILD_OBJECT('item_id', r.item_id,
        'item_unit_option_id', r.item_unit_option_id, 'uom_id', r.uom_id,
        'requested_qty', r.requested_qty, 'unit_price', r.unit_price, 'notes', r.notes)),
      ARRAY_AGG(DISTINCT r.currency), SUM(r.requested_qty * r.qty_per_unit * r.unit_price)
    INTO v_resolved_lines, v_currencies, v_total FROM resolved r;

    IF CARDINALITY(v_currencies) <> 1 THEN
      RAISE EXCEPTION 'Selected items resolve to different cost currencies';
    END IF;
    v_currency := v_currencies[1];
    IF v_currency !~ '^[A-Z]{3}$' THEN
      RAISE EXCEPTION 'Invalid stock requisition';
    END IF;
  END IF;

  IF p_requisition_id IS NULL THEN
    INSERT INTO public.stock_requisitions(company_id, business_unit_id, supplier_id,
      requisition_date, required_by_date, requested_by, status, notes, total_amount,
      currency, created_by, updated_by)
    VALUES (p_company_id, p_business_unit_id, v_supplier_id,
      COALESCE((p_header ->> 'requisition_date')::DATE, CURRENT_DATE),
      NULLIF(p_header ->> 'required_by_date', '')::DATE, p_user_id, 'draft',
      p_header ->> 'notes', v_total, v_currency, p_user_id, p_user_id)
    RETURNING stock_requisitions.id INTO v_requisition_id;
  ELSE
    UPDATE public.stock_requisitions sr SET supplier_id = v_supplier_id,
      requisition_date = CASE WHEN p_header ? 'requisition_date'
        THEN (p_header ->> 'requisition_date')::DATE ELSE sr.requisition_date END,
      required_by_date = CASE WHEN p_header ? 'required_by_date'
        THEN NULLIF(p_header ->> 'required_by_date', '')::DATE ELSE sr.required_by_date END,
      notes = CASE WHEN p_header ? 'notes' THEN p_header ->> 'notes' ELSE sr.notes END,
      total_amount = CASE WHEN p_lines IS NOT NULL THEN v_total ELSE sr.total_amount END,
      currency = CASE WHEN p_lines IS NOT NULL THEN v_currency ELSE sr.currency END,
      updated_by = p_user_id
    WHERE sr.id = v_requisition_id;
  END IF;

  IF p_lines IS NOT NULL THEN
    DELETE FROM public.stock_requisition_items sri WHERE sri.sr_id = v_requisition_id;
    INSERT INTO public.stock_requisition_items(sr_id, item_id, item_unit_option_id,
      uom_id, requested_qty, unit_price, notes)
    SELECT v_requisition_id, line.item_id, line.item_unit_option_id, line.uom_id,
      line.requested_qty, line.unit_price, line.notes
    FROM JSONB_TO_RECORDSET(v_resolved_lines) line(item_id UUID, item_unit_option_id UUID,
      uom_id UUID, requested_qty NUMERIC, unit_price NUMERIC, notes TEXT);
  END IF;

  RETURN QUERY SELECT sr.id, sr.sr_number::TEXT, sr.status::TEXT
  FROM public.stock_requisitions sr WHERE sr.id = v_requisition_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_stock_requisition(UUID, UUID, UUID, JSONB, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_stock_requisition(UUID, UUID, UUID, JSONB, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_eligible_load_list_requisition_items(UUID, UUID, UUID, UUID, TEXT, INTEGER, INTEGER, UUID) TO authenticated;

COMMENT ON FUNCTION public.save_stock_requisition(UUID, UUID, UUID, JSONB, JSONB, UUID) IS
  'Atomically creates or edits a draft requisition with one line per exact item pack option and server-owned hidden pricing.';

COMMIT;
