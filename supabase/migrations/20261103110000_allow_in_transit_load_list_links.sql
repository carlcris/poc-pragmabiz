BEGIN;

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

COMMIT;
