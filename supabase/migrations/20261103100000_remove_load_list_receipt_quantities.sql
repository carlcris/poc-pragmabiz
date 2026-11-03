BEGIN;

CREATE OR REPLACE FUNCTION public.create_load_list(
  p_company_id UUID,
  p_source_business_unit_id UUID,
  p_destination_business_unit_id UUID,
  p_user_id UUID,
  p_supplier_id UUID,
  p_supplier_ll_number TEXT,
  p_container_number TEXT,
  p_seal_number TEXT,
  p_batch_number TEXT,
  p_liner_name TEXT,
  p_estimated_arrival_date DATE,
  p_load_date DATE,
  p_currency TEXT,
  p_notes TEXT,
  p_items JSONB
)
RETURNS TABLE (
  id UUID,
  ll_number TEXT,
  status TEXT,
  currency TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_load_list_id UUID;
BEGIN
  IF v_auth_user_id IS NULL OR v_auth_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT users.company_id
  INTO v_user_company_id
  FROM public.users
  WHERE users.id = v_auth_user_id
    AND users.deleted_at IS NULL
    AND users.is_active IS TRUE;

  IF v_user_company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'load_lists',
    'create',
    p_source_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.business_units
    WHERE business_units.id = p_source_business_unit_id
      AND business_units.company_id = p_company_id
      AND business_units.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Source business unit not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.business_units
    WHERE business_units.id = p_destination_business_unit_id
      AND business_units.company_id = p_company_id
      AND business_units.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Destination business unit not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.suppliers
    WHERE suppliers.id = p_supplier_id
      AND suppliers.company_id = p_company_id
      AND suppliers.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Supplier not found';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_items) < 1
    OR jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'Load list items must contain between 1 and 500 lines';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS line(
      item_id UUID,
      item_unit_option_id UUID,
      load_list_qty NUMERIC,
      unit_price NUMERIC,
      notes TEXT
    )
    LEFT JOIN public.items
      ON items.id = line.item_id
     AND items.company_id = p_company_id
     AND items.deleted_at IS NULL
    LEFT JOIN public.item_unit_options
      ON item_unit_options.id = line.item_unit_option_id
     AND item_unit_options.company_id = p_company_id
     AND item_unit_options.item_id = line.item_id
     AND item_unit_options.is_active IS TRUE
     AND item_unit_options.deleted_at IS NULL
    LEFT JOIN public.units_of_measure
      ON units_of_measure.id = item_unit_options.uom_id
    WHERE line.item_id IS NULL
      OR line.item_unit_option_id IS NULL
      OR items.id IS NULL
      OR item_unit_options.id IS NULL
      OR units_of_measure.id IS NULL
      OR line.load_list_qty IS NULL
      OR line.load_list_qty <= 0
      OR line.unit_price IS NULL
      OR line.unit_price < 0
  ) THEN
    RAISE EXCEPTION 'Load list contains an invalid line';
  END IF;

  INSERT INTO public.load_lists (
    company_id,
    business_unit_id,
    destination_business_unit_id,
    supplier_ll_number,
    supplier_id,
    container_number,
    seal_number,
    batch_number,
    liner_name,
    estimated_arrival_date,
    load_date,
    status,
    currency,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    p_source_business_unit_id,
    p_destination_business_unit_id,
    NULLIF(BTRIM(p_supplier_ll_number), ''),
    p_supplier_id,
    NULLIF(BTRIM(p_container_number), ''),
    NULLIF(BTRIM(p_seal_number), ''),
    NULLIF(BTRIM(p_batch_number), ''),
    NULLIF(BTRIM(p_liner_name), ''),
    p_estimated_arrival_date,
    p_load_date,
    'draft',
    p_currency,
    NULLIF(BTRIM(p_notes), ''),
    p_user_id,
    p_user_id
  )
  RETURNING load_lists.id INTO v_load_list_id;

  INSERT INTO public.load_list_items (
    load_list_id,
    item_id,
    item_unit_option_id,
    uom_id,
    unit_name,
    qty_per_unit,
    load_list_qty,
    unit_price,
    notes
  )
  SELECT
    v_load_list_id,
    line.item_id,
    line.item_unit_option_id,
    item_unit_options.uom_id,
    COALESCE(
      NULLIF(BTRIM(item_unit_options.option_label), ''),
      units_of_measure.name
    ),
    item_unit_options.qty_per_unit,
    line.load_list_qty,
    line.unit_price,
    NULLIF(BTRIM(line.notes), '')
  FROM jsonb_to_recordset(p_items) AS line(
    item_id UUID,
    item_unit_option_id UUID,
    load_list_qty NUMERIC,
    unit_price NUMERIC,
    notes TEXT
  )
  JOIN public.item_unit_options
    ON item_unit_options.id = line.item_unit_option_id
   AND item_unit_options.company_id = p_company_id
   AND item_unit_options.item_id = line.item_id
   AND item_unit_options.is_active IS TRUE
   AND item_unit_options.deleted_at IS NULL
  JOIN public.units_of_measure
    ON units_of_measure.id = item_unit_options.uom_id;

  RETURN QUERY
  SELECT
    load_lists.id,
    load_lists.ll_number::TEXT,
    load_lists.status::TEXT,
    load_lists.currency::TEXT
  FROM public.load_lists
  WHERE load_lists.id = v_load_list_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_load_list(
  p_company_id UUID,
  p_source_business_unit_id UUID,
  p_user_id UUID,
  p_load_list_id UUID,
  p_supplier_id UUID,
  p_supplier_ll_number TEXT,
  p_container_number TEXT,
  p_seal_number TEXT,
  p_batch_number TEXT,
  p_liner_name TEXT,
  p_estimated_arrival_date DATE,
  p_load_date DATE,
  p_currency TEXT,
  p_notes TEXT,
  p_items JSONB
)
RETURNS TABLE (
  id UUID,
  ll_number TEXT,
  status TEXT,
  currency TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_load_list_status TEXT;
BEGIN
  IF v_auth_user_id IS NULL OR v_auth_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT users.company_id
  INTO v_user_company_id
  FROM public.users
  WHERE users.id = v_auth_user_id
    AND users.deleted_at IS NULL
    AND users.is_active IS TRUE;

  IF v_user_company_id IS DISTINCT FROM p_company_id
    OR NOT public.user_has_permission(
      v_auth_user_id,
      'load_lists',
      'edit',
      p_source_business_unit_id
    ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT load_lists.status
  INTO v_load_list_status
  FROM public.load_lists
  WHERE load_lists.id = p_load_list_id
    AND load_lists.company_id = p_company_id
    AND load_lists.business_unit_id = p_source_business_unit_id
    AND load_lists.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Load list not found';
  END IF;

  IF v_load_list_status NOT IN ('draft', 'confirmed') THEN
    RAISE EXCEPTION 'Only draft or confirmed load lists can be edited';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.suppliers
    WHERE suppliers.id = p_supplier_id
      AND suppliers.company_id = p_company_id
      AND suppliers.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Supplier not found';
  END IF;

  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_items) < 1
    OR jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'Load list items must contain between 1 and 500 lines';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items) AS line(
      item_id UUID,
      item_unit_option_id UUID,
      load_list_qty NUMERIC,
      unit_price NUMERIC,
      notes TEXT
    )
    LEFT JOIN public.items
      ON items.id = line.item_id
     AND items.company_id = p_company_id
     AND items.deleted_at IS NULL
    LEFT JOIN public.item_unit_options
      ON item_unit_options.id = line.item_unit_option_id
     AND item_unit_options.company_id = p_company_id
     AND item_unit_options.item_id = line.item_id
     AND item_unit_options.is_active IS TRUE
     AND item_unit_options.deleted_at IS NULL
    LEFT JOIN public.units_of_measure
      ON units_of_measure.id = item_unit_options.uom_id
    WHERE line.item_id IS NULL
      OR line.item_unit_option_id IS NULL
      OR items.id IS NULL
      OR item_unit_options.id IS NULL
      OR units_of_measure.id IS NULL
      OR line.load_list_qty IS NULL
      OR line.load_list_qty <= 0
      OR line.unit_price IS NULL
      OR line.unit_price < 0
  ) THEN
    RAISE EXCEPTION 'Load list contains an invalid line';
  END IF;

  UPDATE public.load_lists
  SET
    supplier_ll_number = NULLIF(BTRIM(p_supplier_ll_number), ''),
    supplier_id = p_supplier_id,
    container_number = NULLIF(BTRIM(p_container_number), ''),
    seal_number = NULLIF(BTRIM(p_seal_number), ''),
    batch_number = NULLIF(BTRIM(p_batch_number), ''),
    liner_name = NULLIF(BTRIM(p_liner_name), ''),
    estimated_arrival_date = p_estimated_arrival_date,
    load_date = p_load_date,
    currency = p_currency,
    notes = NULLIF(BTRIM(p_notes), ''),
    updated_by = p_user_id,
    updated_at = NOW()
  WHERE load_lists.id = p_load_list_id;

  IF v_load_list_status = 'draft' THEN
    DELETE FROM public.load_list_items
    WHERE load_list_items.load_list_id = p_load_list_id;

    INSERT INTO public.load_list_items (
      load_list_id,
      item_id,
      item_unit_option_id,
      uom_id,
      unit_name,
      qty_per_unit,
      load_list_qty,
      unit_price,
      notes
    )
    SELECT
      p_load_list_id,
      line.item_id,
      line.item_unit_option_id,
      item_unit_options.uom_id,
      COALESCE(
        NULLIF(BTRIM(item_unit_options.option_label), ''),
        units_of_measure.name
      ),
      item_unit_options.qty_per_unit,
      line.load_list_qty,
      line.unit_price,
      NULLIF(BTRIM(line.notes), '')
    FROM jsonb_to_recordset(p_items) AS line(
      item_id UUID,
      item_unit_option_id UUID,
      load_list_qty NUMERIC,
      unit_price NUMERIC,
      notes TEXT
    )
    JOIN public.item_unit_options
      ON item_unit_options.id = line.item_unit_option_id
     AND item_unit_options.company_id = p_company_id
     AND item_unit_options.item_id = line.item_id
     AND item_unit_options.is_active IS TRUE
     AND item_unit_options.deleted_at IS NULL
    JOIN public.units_of_measure
      ON units_of_measure.id = item_unit_options.uom_id;
  END IF;

  RETURN QUERY
  SELECT
    load_lists.id,
    load_lists.ll_number::TEXT,
    load_lists.status::TEXT,
    load_lists.currency::TEXT
  FROM public.load_lists
  WHERE load_lists.id = p_load_list_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_grn_with_putaway(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_grn_id UUID;
  v_grn_business_unit_id UUID;
  v_grn_load_list_id UUID;
  v_grn_status TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_tx_code TEXT;
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

  SELECT g.id, g.business_unit_id, g.load_list_id, g.status
  INTO v_grn_id, v_grn_business_unit_id, v_grn_load_list_id, v_grn_status
  FROM public.grns g
  WHERE g.id = p_grn_id
    AND g.company_id = p_company_id
    AND g.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;

  IF v_grn_status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only GRNs in pending confirmation can be confirmed';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes',
    'view',
    v_grn_business_unit_id
  ) OR NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes.operation.confirm_receiving.edit',
    'edit',
    v_grn_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT st.transaction_code
  INTO v_tx_code
  FROM public.stock_transactions st
  WHERE st.company_id = p_company_id
    AND st.reference_type = 'grn'
    AND st.reference_id = v_grn_id
    AND st.deleted_at IS NULL
  ORDER BY st.created_at ASC
  LIMIT 1;

  IF v_tx_code IS NULL THEN
    RAISE EXCEPTION 'GRN must be submitted before confirmation';
  END IF;

  UPDATE public.grns
  SET status = 'approved',
      checked_by = p_user_id,
      received_by = COALESCE(received_by, p_user_id),
      updated_by = p_user_id,
      updated_at = v_now
  WHERE id = v_grn_id;

  IF v_grn_load_list_id IS NOT NULL THEN
    PERFORM public.recalculate_stock_requisition_fulfillment_for_load_list(
      p_company_id,
      v_grn_load_list_id
    );

    UPDATE public.load_lists
    SET status = 'received',
        received_by = COALESCE(received_by, p_user_id),
        received_date = COALESCE(received_date, v_now),
        updated_by = p_user_id,
        updated_at = v_now
    WHERE id = v_grn_load_list_id
      AND company_id = p_company_id
      AND deleted_at IS NULL;
  END IF;

  RETURN v_tx_code;
END;
$$;

ALTER TABLE public.load_list_items
  DROP COLUMN shortage_qty,
  DROP COLUMN received_qty,
  DROP COLUMN damaged_qty;

COMMIT;
