BEGIN;

DROP INDEX IF EXISTS public.idx_item_warehouse_in_transit;

ALTER TABLE public.item_warehouse
  DROP COLUMN in_transit,
  DROP COLUMN estimated_arrival_date;

DROP FUNCTION IF EXISTS public.approve_grn_with_batch_inventory(
  UUID, UUID, UUID, TEXT
);
DROP FUNCTION IF EXISTS public.approve_grn_with_batch_inventory_apply_inventory(
  UUID, UUID, UUID, TEXT
);

ALTER TABLE public.load_lists
  ADD COLUMN destination_business_unit_id UUID NOT NULL
    REFERENCES public.business_units(id) ON DELETE RESTRICT;

CREATE INDEX idx_load_lists_destination_business_unit
  ON public.load_lists(destination_business_unit_id)
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS public.idx_load_lists_warehouse;

ALTER TABLE public.load_lists
  DROP COLUMN warehouse_id;

ALTER TABLE public.grns
  ALTER COLUMN warehouse_id DROP NOT NULL;

ALTER TABLE public.putaway_tasks
  ALTER COLUMN warehouse_id DROP NOT NULL;

ALTER TABLE public.stock_transactions
  ALTER COLUMN warehouse_id DROP NOT NULL;

COMMENT ON COLUMN public.load_lists.business_unit_id IS
  'Business unit that created and owns the supplier load list.';
COMMENT ON COLUMN public.load_lists.destination_business_unit_id IS
  'Business unit that will receive the shipment. Final warehouse placement is selected during putaway.';
COMMENT ON COLUMN public.grns.warehouse_id IS
  'Optional warehouse context for warehouse-bound receipts. Supplier load-list receipts remain business-unit scoped through receiving.';
COMMENT ON COLUMN public.putaway_tasks.warehouse_id IS
  'Preassigned warehouse for warehouse-bound tasks. NULL for business-unit-scoped GRN tasks until a final location is posted.';
COMMENT ON COLUMN public.stock_transactions.warehouse_id IS
  'Warehouse affected by the transaction. NULL only for business-unit receipt staging before putaway.';

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
    received_qty,
    damaged_qty,
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
    0,
    0,
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
      received_qty,
      damaged_qty,
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
      0,
      0,
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

CREATE OR REPLACE FUNCTION public.mark_load_list_in_transit(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_load_list_id UUID,
  p_estimated_arrival_date DATE DEFAULT NULL,
  p_liner_name TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_load_list_status TEXT;
  v_estimated_arrival_date DATE;
  v_liner_name TEXT;
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

  SELECT
    load_lists.status,
    load_lists.estimated_arrival_date,
    load_lists.liner_name
  INTO
    v_load_list_status,
    v_estimated_arrival_date,
    v_liner_name
  FROM public.load_lists
  WHERE load_lists.id = p_load_list_id
    AND load_lists.company_id = p_company_id
    AND load_lists.business_unit_id = p_business_unit_id
    AND load_lists.deleted_at IS NULL
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
    'load_lists.operation.mark_in_transit.edit',
    'edit',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_load_list_status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed load lists can be marked in transit';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.load_list_items
    WHERE load_list_items.load_list_id = p_load_list_id
  ) THEN
    RAISE EXCEPTION 'Load list has no items';
  END IF;

  UPDATE public.load_lists
  SET
    status = 'in_transit',
    estimated_arrival_date = COALESCE(
      p_estimated_arrival_date,
      v_estimated_arrival_date
    ),
    liner_name = COALESCE(NULLIF(BTRIM(p_liner_name), ''), v_liner_name),
    updated_by = p_user_id,
    updated_at = NOW()
  WHERE load_lists.id = p_load_list_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_load_list_arrived(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_load_list_id UUID,
  p_actual_arrival_date DATE DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_load_list_number TEXT;
  v_load_list_status TEXT;
  v_destination_business_unit_id UUID;
  v_container_number TEXT;
  v_seal_number TEXT;
  v_batch_number TEXT;
  v_estimated_arrival_date DATE;
  v_actual_arrival_date DATE;
  v_grn_id UUID;
  v_grn_number TEXT;
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

  SELECT
    load_lists.ll_number,
    load_lists.status,
    load_lists.destination_business_unit_id,
    load_lists.container_number,
    load_lists.seal_number,
    load_lists.batch_number,
    load_lists.estimated_arrival_date,
    load_lists.actual_arrival_date
  INTO
    v_load_list_number,
    v_load_list_status,
    v_destination_business_unit_id,
    v_container_number,
    v_seal_number,
    v_batch_number,
    v_estimated_arrival_date,
    v_actual_arrival_date
  FROM public.load_lists
  WHERE load_lists.id = p_load_list_id
    AND load_lists.company_id = p_company_id
    AND (
      load_lists.business_unit_id = p_business_unit_id
      OR load_lists.destination_business_unit_id = p_business_unit_id
    )
    AND load_lists.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Load list not found';
  END IF;

  IF p_business_unit_id <> v_destination_business_unit_id THEN
    RAISE EXCEPTION 'Only the destination business unit can mark the load list arrived';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'load_lists',
    'view',
    p_business_unit_id
  ) OR NOT public.user_has_permission(
    v_auth_user_id,
    'load_lists.operation.mark_arrived.edit',
    'edit',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_load_list_status <> 'in_transit' THEN
    RAISE EXCEPTION 'Only in-transit load lists can be marked arrived';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.load_list_items
    WHERE load_list_items.load_list_id = p_load_list_id
  ) THEN
    RAISE EXCEPTION 'Load list has no items';
  END IF;

  SELECT grns.id, grns.grn_number
  INTO v_grn_id, v_grn_number
  FROM public.grns
  WHERE grns.load_list_id = p_load_list_id
    AND grns.company_id = p_company_id
    AND grns.deleted_at IS NULL
  FOR UPDATE;

  v_actual_arrival_date := COALESCE(
    p_actual_arrival_date,
    v_actual_arrival_date,
    CURRENT_DATE
  );

  UPDATE public.load_lists
  SET
    status = 'arrived',
    actual_arrival_date = v_actual_arrival_date,
    updated_by = p_user_id,
    updated_at = NOW()
  WHERE load_lists.id = p_load_list_id;

  IF v_grn_id IS NULL THEN
    INSERT INTO public.grns (
      load_list_id,
      company_id,
      business_unit_id,
      warehouse_id,
      container_number,
      seal_number,
      batch_number,
      receiving_date,
      delivery_date,
      status,
      notes,
      received_by,
      created_by,
      updated_by
    )
    VALUES (
      p_load_list_id,
      p_company_id,
      v_destination_business_unit_id,
      NULL,
      v_container_number,
      v_seal_number,
      v_batch_number,
      CURRENT_DATE,
      COALESCE(v_actual_arrival_date, v_estimated_arrival_date, CURRENT_DATE),
      'draft',
      'Auto-created from Load List ' || v_load_list_number,
      NULL,
      p_user_id,
      p_user_id
    )
    RETURNING grns.id, grns.grn_number
    INTO v_grn_id, v_grn_number;

    INSERT INTO public.grn_items (
      grn_id,
      load_list_item_id,
      item_id,
      item_unit_option_id,
      unit_name,
      qty_per_unit,
      load_list_qty,
      received_qty,
      damaged_qty,
      num_boxes,
      barcodes_printed
    )
    SELECT
      v_grn_id,
      load_list_items.id,
      load_list_items.item_id,
      load_list_items.item_unit_option_id,
      load_list_items.unit_name,
      load_list_items.qty_per_unit,
      load_list_items.load_list_qty,
      0,
      0,
      0,
      FALSE
    FROM public.load_list_items
    WHERE load_list_items.load_list_id = p_load_list_id;
  END IF;

  RETURN v_grn_number;
END;
$$;

DROP FUNCTION IF EXISTS public.start_grn_receiving(UUID, UUID, UUID);
DROP FUNCTION IF EXISTS public.start_grn_receiving(UUID, UUID, UUID, UUID);

CREATE FUNCTION public.start_grn_receiving(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_current_business_unit_id UUID := public.get_current_business_unit_id();
  v_grn_business_unit_id UUID;
  v_grn_load_list_id UUID;
  v_grn_status TEXT;
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

  IF v_user_company_id IS DISTINCT FROM p_company_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT
    grns.business_unit_id,
    grns.load_list_id,
    grns.status
  INTO
    v_grn_business_unit_id,
    v_grn_load_list_id,
    v_grn_status
  FROM public.grns
  WHERE grns.id = p_grn_id
    AND grns.company_id = p_company_id
    AND grns.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;

  IF v_current_business_unit_id IS DISTINCT FROM v_grn_business_unit_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes',
    'view',
    v_grn_business_unit_id
  ) OR NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes.operation.start_receiving.edit',
    'edit',
    v_grn_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_grn_status NOT IN ('draft', 'receiving', 'paused') THEN
    RAISE EXCEPTION 'Only draft or paused GRNs can start receiving';
  END IF;

  IF v_grn_load_list_id IS NOT NULL THEN
    SELECT load_lists.status
    INTO v_load_list_status
    FROM public.load_lists
    WHERE load_lists.id = v_grn_load_list_id
      AND load_lists.company_id = p_company_id
      AND load_lists.destination_business_unit_id = v_grn_business_unit_id
      AND load_lists.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Load list not found';
    END IF;

    IF v_load_list_status NOT IN ('arrived', 'receiving') THEN
      RAISE EXCEPTION 'Only arrived or receiving load lists can start receiving';
    END IF;
  END IF;

  IF v_grn_load_list_id IS NOT NULL AND v_load_list_status = 'arrived' THEN
    UPDATE public.load_lists
    SET
      status = 'receiving',
      updated_by = p_user_id,
      updated_at = NOW()
    WHERE load_lists.id = v_grn_load_list_id;
  END IF;

  UPDATE public.grns
  SET
    status = 'receiving',
    received_by = COALESCE(grns.received_by, p_user_id),
    receiving_date = COALESCE(grns.receiving_date, CURRENT_DATE),
    updated_by = p_user_id,
    updated_at = NOW()
  WHERE grns.id = p_grn_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_grn_to_putaway(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_grn public.grns%ROWTYPE;
  v_grn_item public.grn_items%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_posting_date DATE;
  v_posting_time TIME;
  v_tx_id UUID;
  v_tx_code TEXT;
  v_item_uom_id UUID;
  v_unit_cost NUMERIC;
  v_received_qty NUMERIC;
  v_received_base_qty NUMERIC;
  v_batch_code TEXT;
  v_has_items BOOLEAN := FALSE;
  v_has_received BOOLEAN := FALSE;
  v_existing_tx_code TEXT;
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

  SELECT grns.*
  INTO v_grn
  FROM public.grns
  WHERE grns.id = p_grn_id
    AND grns.company_id = p_company_id
    AND grns.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;

  IF v_grn.status NOT IN ('draft', 'receiving', 'pending_approval') THEN
    RAISE EXCEPTION 'Only draft, receiving, or pending confirmation GRNs can be staged';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes',
    'view',
    v_grn.business_unit_id
  ) OR NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes.operation.submit_receiving.edit',
    'edit',
    v_grn.business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT stock_transactions.transaction_code
  INTO v_existing_tx_code
  FROM public.stock_transactions
  WHERE stock_transactions.company_id = p_company_id
    AND stock_transactions.reference_type = 'grn'
    AND stock_transactions.reference_id = v_grn.id
    AND stock_transactions.deleted_at IS NULL
  ORDER BY stock_transactions.created_at ASC
  LIMIT 1;

  IF v_existing_tx_code IS NOT NULL THEN
    RETURN v_existing_tx_code;
  END IF;

  v_batch_code := COALESCE(
    NULLIF(BTRIM(v_grn.batch_number), ''),
    'GRN-' || v_grn.grn_number
  );
  v_posting_date := COALESCE(v_grn.receiving_date, CURRENT_DATE);
  v_posting_time := v_now::TIME;

  INSERT INTO public.stock_transactions (
    company_id,
    business_unit_id,
    transaction_type,
    transaction_date,
    warehouse_id,
    reference_type,
    reference_id,
    reference_code,
    status,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    v_grn.business_unit_id,
    'in',
    v_posting_date,
    NULL,
    'grn',
    v_grn.id,
    v_grn.grn_number,
    'posted',
    COALESCE(NULLIF(BTRIM(p_notes), ''), 'GRN received pending putaway - ' || v_grn.grn_number),
    p_user_id,
    p_user_id
  )
  RETURNING stock_transactions.id, stock_transactions.transaction_code
  INTO v_tx_id, v_tx_code;

  FOR v_grn_item IN
    SELECT grn_items.*
    FROM public.grn_items
    WHERE grn_items.grn_id = v_grn.id
    ORDER BY grn_items.created_at ASC, grn_items.id ASC
    FOR UPDATE
  LOOP
    v_has_items := TRUE;
    v_received_qty := COALESCE(v_grn_item.received_qty, 0);

    IF v_received_qty <= 0 THEN
      CONTINUE;
    END IF;

    v_has_received := TRUE;
    v_received_base_qty := v_received_qty * v_grn_item.qty_per_unit;

    SELECT
      items.uom_id,
      COALESCE(NULLIF(load_list_items.unit_price, 0), NULLIF(items.purchase_price, 0), 0)
    INTO v_item_uom_id, v_unit_cost
    FROM public.items
    LEFT JOIN public.load_list_items
      ON load_list_items.id = v_grn_item.load_list_item_id
    WHERE items.id = v_grn_item.item_id;

    IF v_item_uom_id IS NULL THEN
      RAISE EXCEPTION 'Item UOM not found for item %', v_grn_item.item_id;
    END IF;

    INSERT INTO public.putaway_tasks (
      company_id,
      business_unit_id,
      warehouse_id,
      item_id,
      uom_id,
      source_unit_name,
      source_qty_per_unit,
      source_type,
      source_id,
      source_line_id,
      source_reference,
      source_batch_code,
      suggested_location_id,
      quantity,
      pending_quantity,
      posted_quantity,
      unit_cost,
      status,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_grn.business_unit_id,
      NULL,
      v_grn_item.item_id,
      v_item_uom_id,
      v_grn_item.unit_name,
      v_grn_item.qty_per_unit,
      'grn',
      v_grn.id,
      v_grn_item.id,
      v_grn.grn_number,
      v_batch_code,
      NULL,
      v_received_base_qty,
      v_received_base_qty,
      0,
      COALESCE(v_unit_cost, 0),
      'pending',
      'GRN received pending putaway - ' || v_grn.grn_number,
      p_user_id,
      p_user_id
    );

    INSERT INTO public.stock_transaction_items (
      company_id,
      transaction_id,
      item_id,
      quantity,
      uom_id,
      batch_no,
      unit_cost,
      total_cost,
      qty_before,
      qty_after,
      valuation_rate,
      stock_value_before,
      stock_value_after,
      posting_date,
      posting_time,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_tx_id,
      v_grn_item.item_id,
      v_received_base_qty,
      v_item_uom_id,
      v_batch_code,
      COALESCE(v_unit_cost, 0),
      ABS(v_received_base_qty) * COALESCE(v_unit_cost, 0),
      0,
      0,
      COALESCE(v_unit_cost, 0),
      0,
      0,
      v_posting_date,
      v_posting_time,
      'Received into business-unit staging pending putaway - ' || v_grn.grn_number,
      p_user_id,
      p_user_id
    );
  END LOOP;

  IF NOT v_has_items THEN
    RAISE EXCEPTION 'GRN has no items';
  END IF;

  IF NOT v_has_received THEN
    RAISE EXCEPTION 'At least one GRN item must have a received quantity';
  END IF;

  UPDATE public.grns
  SET
    status = 'pending_approval',
    received_by = COALESCE(grns.received_by, p_user_id),
    updated_by = p_user_id,
    updated_at = v_now
  WHERE grns.id = v_grn.id
    AND grns.status <> 'pending_approval';

  RETURN v_tx_code;
END;
$$;

COMMENT ON FUNCTION public.submit_grn_to_putaway(UUID, UUID, UUID, TEXT) IS
  'Stages received GRN quantities at business-unit level and creates warehouse-unassigned putaway tasks.';

CREATE OR REPLACE FUNCTION public.post_putaway_task(
  p_task_id UUID,
  p_location_id UUID,
  p_quantity NUMERIC,
  p_batch_code TEXT,
  p_user_id UUID
)
RETURNS TABLE (
  transaction_id UUID,
  batch_location_id UUID,
  batch_location_sku TEXT,
  batch_code TEXT,
  posted_quantity NUMERIC,
  posted_date DATE,
  location_id UUID
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_task public.putaway_tasks%ROWTYPE;
  v_destination_warehouse_id UUID;
  v_batch_id UUID;
  v_transaction_id UUID;
  v_batch_location_id UUID;
  v_batch_location_sku TEXT;
  v_batch_code TEXT;
  v_current_stock NUMERIC;
  v_next_stock NUMERIC;
  v_next_pending NUMERIC;
  v_next_posted NUMERIC;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT putaway_tasks.*
  INTO v_task
  FROM public.putaway_tasks
  WHERE putaway_tasks.id = p_task_id
    AND putaway_tasks.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Putaway task not found';
  END IF;

  IF v_task.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Putaway task is not open';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Putaway quantity must be greater than zero';
  END IF;

  IF p_quantity > v_task.pending_quantity THEN
    RAISE EXCEPTION 'Putaway quantity exceeds pending quantity';
  END IF;

  SELECT warehouse_locations.warehouse_id
  INTO v_destination_warehouse_id
  FROM public.warehouse_locations
  JOIN public.warehouses
    ON warehouses.id = warehouse_locations.warehouse_id
   AND warehouses.company_id = v_task.company_id
   AND warehouses.is_active IS TRUE
   AND warehouses.deleted_at IS NULL
  WHERE warehouse_locations.id = p_location_id
    AND warehouse_locations.company_id = v_task.company_id
    AND warehouse_locations.is_active IS TRUE
    AND warehouse_locations.is_storable IS TRUE
    AND warehouse_locations.deleted_at IS NULL
    AND (
      v_task.business_unit_id IS NULL
      OR warehouses.business_unit_id = v_task.business_unit_id
    )
    AND (
      v_task.warehouse_id IS NULL
      OR warehouse_locations.warehouse_id = v_task.warehouse_id
    );

  IF v_destination_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Selected location is not valid for putaway';
  END IF;

  v_batch_code := COALESCE(NULLIF(BTRIM(p_batch_code), ''), v_task.source_batch_code);

  IF v_batch_code IS NULL OR BTRIM(v_batch_code) = '' THEN
    RAISE EXCEPTION 'Batch code is required';
  END IF;

  IF v_task.source_type = 'grn' THEN
    INSERT INTO public.item_warehouse (
      company_id,
      item_id,
      warehouse_id,
      current_stock,
      reserved_stock,
      putaway_qty,
      default_location_id,
      is_active,
      created_by,
      updated_by,
      deleted_at
    )
    VALUES (
      v_task.company_id,
      v_task.item_id,
      v_destination_warehouse_id,
      p_quantity,
      0,
      0,
      p_location_id,
      TRUE,
      p_user_id,
      p_user_id,
      NULL
    )
    ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE
    SET
      current_stock = COALESCE(public.item_warehouse.current_stock, 0) + EXCLUDED.current_stock,
      default_location_id = COALESCE(public.item_warehouse.default_location_id, p_location_id),
      is_active = TRUE,
      deleted_at = NULL,
      updated_by = p_user_id,
      updated_at = NOW()
    RETURNING
      public.item_warehouse.current_stock - p_quantity,
      public.item_warehouse.current_stock
    INTO v_current_stock, v_next_stock;
  ELSE
    SELECT COALESCE(item_warehouse.current_stock, 0)
    INTO v_current_stock
    FROM public.item_warehouse
    WHERE item_warehouse.company_id = v_task.company_id
      AND item_warehouse.item_id = v_task.item_id
      AND item_warehouse.warehouse_id = v_destination_warehouse_id
      AND item_warehouse.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item warehouse stock not found';
    END IF;

    v_next_stock := v_current_stock;
  END IF;

  INSERT INTO public.item_batches (
    company_id,
    item_id,
    warehouse_id,
    batch_code,
    received_at,
    qty_on_hand,
    qty_reserved,
    created_by,
    updated_by
  )
  VALUES (
    v_task.company_id,
    v_task.item_id,
    v_destination_warehouse_id,
    v_batch_code,
    NOW(),
    p_quantity,
    0,
    p_user_id,
    p_user_id
  )
  ON CONFLICT ON CONSTRAINT item_batches_company_item_warehouse_batch_code_key
  DO UPDATE SET
    qty_on_hand = COALESCE(public.item_batches.qty_on_hand, 0) + EXCLUDED.qty_on_hand,
    deleted_at = NULL,
    updated_by = p_user_id,
    updated_at = NOW()
  RETURNING item_batches.id INTO v_batch_id;

  INSERT INTO public.item_batch_locations (
    company_id,
    item_id,
    warehouse_id,
    location_id,
    item_batch_id,
    qty_on_hand,
    qty_reserved,
    created_by,
    updated_by
  )
  VALUES (
    v_task.company_id,
    v_task.item_id,
    v_destination_warehouse_id,
    p_location_id,
    v_batch_id,
    p_quantity,
    0,
    p_user_id,
    p_user_id
  )
  ON CONFLICT ON CONSTRAINT item_batch_locations_company_item_warehouse_location_batch_key
  DO UPDATE SET
    qty_on_hand = public.item_batch_locations.qty_on_hand + EXCLUDED.qty_on_hand,
    deleted_at = NULL,
    updated_by = p_user_id,
    updated_at = NOW()
  RETURNING
    item_batch_locations.id,
    item_batch_locations.batch_location_sku
  INTO v_batch_location_id, v_batch_location_sku;

  IF v_task.source_type <> 'grn' THEN
    UPDATE public.item_warehouse
    SET
      putaway_qty = COALESCE(item_warehouse.putaway_qty, 0) - p_quantity,
      default_location_id = COALESCE(item_warehouse.default_location_id, p_location_id),
      updated_by = p_user_id,
      updated_at = NOW()
    WHERE item_warehouse.company_id = v_task.company_id
      AND item_warehouse.item_id = v_task.item_id
      AND item_warehouse.warehouse_id = v_destination_warehouse_id
      AND item_warehouse.deleted_at IS NULL;
  END IF;

  INSERT INTO public.stock_transactions (
    company_id,
    business_unit_id,
    transaction_type,
    transaction_date,
    warehouse_id,
    to_location_id,
    reference_type,
    reference_id,
    reference_code,
    notes,
    status,
    created_by,
    updated_by
  )
  VALUES (
    v_task.company_id,
    v_task.business_unit_id,
    'transfer',
    CURRENT_DATE,
    v_destination_warehouse_id,
    p_location_id,
    'putaway_task',
    v_task.id,
    v_task.source_reference,
    'Putaway posted',
    'posted',
    p_user_id,
    p_user_id
  )
  RETURNING stock_transactions.id INTO v_transaction_id;

  INSERT INTO public.stock_transaction_items (
    company_id,
    transaction_id,
    item_id,
    quantity,
    uom_id,
    unit_cost,
    total_cost,
    batch_no,
    qty_before,
    qty_after,
    valuation_rate,
    stock_value_before,
    stock_value_after,
    posting_date,
    posting_time,
    created_by,
    updated_by
  )
  VALUES (
    v_task.company_id,
    v_transaction_id,
    v_task.item_id,
    p_quantity,
    v_task.uom_id,
    v_task.unit_cost,
    v_task.unit_cost * p_quantity,
    v_batch_code,
    v_current_stock,
    v_next_stock,
    v_task.unit_cost,
    v_current_stock * v_task.unit_cost,
    v_next_stock * v_task.unit_cost,
    CURRENT_DATE,
    CURRENT_TIME,
    p_user_id,
    p_user_id
  );

  v_next_pending := v_task.pending_quantity - p_quantity;
  v_next_posted := v_task.posted_quantity + p_quantity;

  UPDATE public.putaway_tasks
  SET
    warehouse_id = COALESCE(putaway_tasks.warehouse_id, v_destination_warehouse_id),
    pending_quantity = v_next_pending,
    posted_quantity = v_next_posted,
    status = CASE WHEN v_next_pending = 0 THEN 'completed' ELSE 'partial' END,
    updated_by = p_user_id,
    updated_at = NOW()
  WHERE putaway_tasks.id = v_task.id;

  RETURN QUERY
  SELECT
    v_transaction_id,
    v_batch_location_id,
    v_batch_location_sku,
    v_batch_code,
    p_quantity,
    CURRENT_DATE,
    p_location_id;
END;
$$;

COMMENT ON FUNCTION public.post_putaway_task(UUID, UUID, NUMERIC, TEXT, UUID) IS
  'Posts a putaway quantity to the warehouse implied by the selected final location.';

DROP FUNCTION IF EXISTS public.regenerate_grn_boxes(UUID, UUID, UUID, UUID, INTEGER, UUID);

CREATE FUNCTION public.regenerate_grn_boxes(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID,
  p_grn_item_id UUID,
  p_num_boxes INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_user_company_id UUID;
  v_business_unit_id UUID;
  v_grn_number TEXT;
  v_delivery_date DATE;
  v_container_number TEXT;
  v_seal_number TEXT;
  v_received_qty NUMERIC;
  v_qty_per_unit NUMERIC;
  v_qty_per_box NUMERIC;
  v_created_count INTEGER;
BEGIN
  IF v_auth_user_id IS NULL OR v_auth_user_id <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_num_boxes IS NULL OR p_num_boxes < 1 OR p_num_boxes > 1000000 THEN
    RAISE EXCEPTION 'Invalid number of boxes';
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

  SELECT
    grns.business_unit_id,
    grns.grn_number,
    grns.delivery_date,
    grns.container_number,
    grns.seal_number,
    grn_items.received_qty,
    grn_items.qty_per_unit
  INTO
    v_business_unit_id,
    v_grn_number,
    v_delivery_date,
    v_container_number,
    v_seal_number,
    v_received_qty,
    v_qty_per_unit
  FROM public.grns
  JOIN public.grn_items
    ON grn_items.grn_id = grns.id
   AND grn_items.id = p_grn_item_id
  WHERE grns.id = p_grn_id
    AND grns.company_id = p_company_id
    AND grns.deleted_at IS NULL
  FOR UPDATE OF grns, grn_items;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN item not found';
  END IF;

  IF NOT public.user_has_permission(
    v_auth_user_id,
    'goods_receipt_notes',
    'create',
    v_business_unit_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF COALESCE(v_received_qty, 0) <= 0 THEN
    RAISE EXCEPTION 'Cannot generate boxes with zero received quantity';
  END IF;

  IF COALESCE(v_qty_per_unit, 0) <= 0 THEN
    RAISE EXCEPTION 'GRN item unit snapshot is invalid';
  END IF;

  v_qty_per_box := (v_received_qty * v_qty_per_unit) / p_num_boxes;

  IF v_qty_per_box <= 0 THEN
    RAISE EXCEPTION 'Calculated quantity per box must be greater than zero';
  END IF;

  DELETE FROM public.grn_boxes
  WHERE grn_boxes.grn_item_id = p_grn_item_id;

  INSERT INTO public.grn_boxes (
    grn_item_id,
    box_number,
    barcode,
    qty_per_box,
    delivery_date,
    container_number,
    seal_number
  )
  SELECT
    p_grn_item_id,
    generated_boxes.box_number,
    v_grn_number || '-' || LEFT(p_grn_item_id::TEXT, 8) || '-' ||
      LPAD(generated_boxes.box_number::TEXT, 3, '0'),
    v_qty_per_box,
    v_delivery_date,
    v_container_number,
    v_seal_number
  FROM generate_series(1, p_num_boxes) AS generated_boxes(box_number);

  GET DIAGNOSTICS v_created_count = ROW_COUNT;

  UPDATE public.grn_items
  SET barcodes_printed = TRUE
  WHERE grn_items.id = p_grn_item_id
    AND grn_items.grn_id = p_grn_id;

  RETURN v_created_count;
END;
$$;

COMMENT ON FUNCTION public.regenerate_grn_boxes(UUID, UUID, UUID, UUID, INTEGER) IS
  'Atomically regenerates GRN boxes without assigning a final warehouse location.';

REVOKE ALL ON FUNCTION public.regenerate_grn_boxes(UUID, UUID, UUID, UUID, INTEGER)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerate_grn_boxes(UUID, UUID, UUID, UUID, INTEGER)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.create_putaway_task(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_warehouse_id UUID,
  p_item_id UUID,
  p_uom_id UUID,
  p_source_type TEXT,
  p_source_id UUID,
  p_source_line_id UUID,
  p_source_reference TEXT,
  p_quantity NUMERIC,
  p_unit_cost NUMERIC,
  p_user_id UUID,
  p_suggested_location_id UUID,
  p_in_transit_decrease NUMERIC,
  p_source_batch_code TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_task_id UUID;
  v_source_unit_name TEXT;
  v_source_qty_per_unit NUMERIC;
BEGIN
  IF p_source_line_id IS NULL THEN
    RAISE EXCEPTION 'Putaway source line is required';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Putaway quantity must be greater than zero';
  END IF;

  IF p_source_type = 'grn' THEN
    SELECT
      grn_items.unit_name,
      grn_items.qty_per_unit
    INTO
      v_source_unit_name,
      v_source_qty_per_unit
    FROM public.grn_items
    INNER JOIN public.grns
      ON grns.id = grn_items.grn_id
     AND grns.company_id = p_company_id
     AND grns.deleted_at IS NULL
    WHERE grn_items.id = p_source_line_id
      AND grn_items.grn_id = p_source_id
      AND grn_items.item_id = p_item_id;
  ELSE
    SELECT
      COALESCE(NULLIF(BTRIM(units_of_measure.name), ''), units_of_measure.code::TEXT)
    INTO v_source_unit_name
    FROM public.units_of_measure
    WHERE units_of_measure.id = p_uom_id
      AND units_of_measure.company_id = p_company_id
      AND units_of_measure.is_active IS TRUE
      AND units_of_measure.deleted_at IS NULL;

    v_source_qty_per_unit := 1;
  END IF;

  IF NULLIF(BTRIM(COALESCE(v_source_unit_name, '')), '') IS NULL
     OR COALESCE(v_source_qty_per_unit, 0) <= 0 THEN
    RAISE EXCEPTION 'Putaway source unit snapshot is required';
  END IF;

  IF p_suggested_location_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.warehouse_locations
       WHERE warehouse_locations.id = p_suggested_location_id
         AND warehouse_locations.company_id = p_company_id
         AND warehouse_locations.warehouse_id = p_warehouse_id
         AND warehouse_locations.is_active IS TRUE
         AND warehouse_locations.is_storable IS TRUE
         AND warehouse_locations.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'Suggested putaway location is not valid';
  END IF;

  INSERT INTO public.item_warehouse (
    company_id,
    item_id,
    warehouse_id,
    current_stock,
    reserved_stock,
    putaway_qty,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    p_item_id,
    p_warehouse_id,
    p_quantity,
    0,
    p_quantity,
    p_user_id,
    p_user_id
  )
  ON CONFLICT (company_id, item_id, warehouse_id)
  DO UPDATE SET
    current_stock = COALESCE(public.item_warehouse.current_stock, 0)
      + EXCLUDED.current_stock,
    putaway_qty = COALESCE(public.item_warehouse.putaway_qty, 0)
      + EXCLUDED.putaway_qty,
    deleted_at = NULL,
    updated_by = p_user_id,
    updated_at = NOW();

  INSERT INTO public.putaway_tasks (
    company_id,
    business_unit_id,
    warehouse_id,
    item_id,
    uom_id,
    source_unit_name,
    source_qty_per_unit,
    source_type,
    source_id,
    source_line_id,
    source_reference,
    source_batch_code,
    suggested_location_id,
    quantity,
    pending_quantity,
    unit_cost,
    status,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    p_business_unit_id,
    p_warehouse_id,
    p_item_id,
    p_uom_id,
    v_source_unit_name,
    v_source_qty_per_unit,
    p_source_type,
    p_source_id,
    p_source_line_id,
    p_source_reference,
    NULLIF(BTRIM(COALESCE(p_source_batch_code, '')), ''),
    p_suggested_location_id,
    p_quantity,
    p_quantity,
    COALESCE(p_unit_cost, 0),
    'pending',
    p_notes,
    p_user_id,
    p_user_id
  )
  ON CONFLICT DO NOTHING
  RETURNING putaway_tasks.id INTO v_task_id;

  IF v_task_id IS NULL THEN
    UPDATE public.putaway_tasks
    SET
      quantity = putaway_tasks.quantity + p_quantity,
      pending_quantity = putaway_tasks.pending_quantity + p_quantity,
      unit_cost = COALESCE(p_unit_cost, 0),
      suggested_location_id = COALESCE(
        putaway_tasks.suggested_location_id,
        p_suggested_location_id
      ),
      status = CASE
        WHEN putaway_tasks.posted_quantity > 0 THEN 'partial'
        ELSE 'pending'
      END,
      updated_by = p_user_id,
      updated_at = NOW()
    WHERE putaway_tasks.company_id = p_company_id
      AND putaway_tasks.source_type = p_source_type
      AND putaway_tasks.source_line_id = p_source_line_id
      AND COALESCE(putaway_tasks.source_batch_code, '') = COALESCE(
        NULLIF(BTRIM(COALESCE(p_source_batch_code, '')),
        ''),
        ''
      )
      AND putaway_tasks.source_unit_name = v_source_unit_name
      AND putaway_tasks.source_qty_per_unit = v_source_qty_per_unit
      AND putaway_tasks.deleted_at IS NULL
    RETURNING putaway_tasks.id INTO v_task_id;
  END IF;

  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create putaway task';
  END IF;

  RETURN v_task_id;
END;
$$;

COMMENT ON FUNCTION public.create_putaway_task(
  UUID, UUID, UUID, UUID, UUID, TEXT, UUID, UUID, TEXT, NUMERIC, NUMERIC, UUID,
  UUID, NUMERIC, TEXT, TEXT
) IS
  'Creates or extends a warehouse-bound putaway task without maintaining supplier in-transit inventory on item_warehouse.';

DROP FUNCTION IF EXISTS public.get_items_enhanced_page(
  UUID,
  TEXT,
  UUID,
  UUID,
  TEXT,
  TEXT,
  UUID,
  INTEGER,
  INTEGER
);

CREATE FUNCTION public.get_items_enhanced_page(
  p_company_id UUID,
  p_search TEXT DEFAULT NULL,
  p_category_id UUID DEFAULT NULL,
  p_warehouse_id UUID DEFAULT NULL,
  p_item_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_business_unit_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  item_code TEXT,
  supplier_code TEXT,
  item_name TEXT,
  item_name_cn TEXT,
  category_id UUID,
  category_name TEXT,
  uom_id UUID,
  uom_code TEXT,
  purchase_price NUMERIC,
  import_cost NUMERIC,
  import_currency TEXT,
  sales_price NUMERIC,
  item_type TEXT,
  custom_fields JSONB,
  is_active BOOLEAN,
  image_url TEXT,
  on_hand NUMERIC,
  allocated NUMERIC,
  available NUMERIC,
  putaway_qty NUMERIC,
  reorder_point NUMERIC,
  max_stock_level NUMERIC,
  status TEXT,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
WITH filtered_items AS (
  SELECT
    items.id,
    items.item_code,
    items.supplier_code,
    items.item_name,
    items.item_name_cn,
    items.category_id,
    item_categories.name AS category_name,
    items.uom_id,
    units_of_measure.code AS uom_code,
    items.purchase_price,
    items.import_cost,
    items.import_currency,
    items.sales_price,
    items.item_type,
    items.custom_fields,
    COALESCE(items.is_active, TRUE) AS is_active,
    items.image_url,
    COALESCE(items.reorder_level, 0) AS reorder_point
  FROM public.items
  LEFT JOIN public.item_categories
    ON item_categories.id = items.category_id
  LEFT JOIN public.units_of_measure
    ON units_of_measure.id = items.uom_id
  WHERE items.company_id = p_company_id
    AND items.deleted_at IS NULL
    AND (
      p_search IS NULL
      OR p_search = ''
      OR items.item_code ILIKE ('%' || p_search || '%')
      OR COALESCE(items.supplier_code, '') ILIKE ('%' || p_search || '%')
      OR items.item_name ILIKE ('%' || p_search || '%')
      OR COALESCE(items.item_name_cn, '') ILIKE ('%' || p_search || '%')
      OR EXISTS (
        SELECT 1
        FROM public.item_unit_options
        WHERE item_unit_options.company_id = items.company_id
          AND item_unit_options.item_id = items.id
          AND item_unit_options.deleted_at IS NULL
          AND COALESCE(item_unit_options.barcode, '') ILIKE ('%' || p_search || '%')
      )
    )
    AND (p_category_id IS NULL OR items.category_id = p_category_id)
    AND (p_item_type IS NULL OR items.item_type = p_item_type)
),
warehouse_scope AS (
  SELECT
    item_warehouse.item_id,
    item_warehouse.current_stock,
    item_warehouse.reserved_stock,
    item_warehouse.available_stock AS available,
    item_warehouse.max_quantity
  FROM public.item_warehouse
  INNER JOIN public.warehouses
    ON warehouses.id = item_warehouse.warehouse_id
  WHERE item_warehouse.company_id = p_company_id
    AND item_warehouse.deleted_at IS NULL
    AND warehouses.deleted_at IS NULL
    AND (p_warehouse_id IS NULL OR item_warehouse.warehouse_id = p_warehouse_id)
    AND (
      p_business_unit_id IS NULL
      OR warehouses.business_unit_id = p_business_unit_id
    )
),
stock_agg AS (
  SELECT
    warehouse_scope.item_id,
    SUM(COALESCE(warehouse_scope.current_stock, 0)) AS on_hand,
    SUM(COALESCE(warehouse_scope.reserved_stock, 0)) AS allocated,
    SUM(COALESCE(warehouse_scope.available, 0)) AS available,
    SUM(COALESCE(warehouse_scope.max_quantity, 0)) AS max_stock_level
  FROM warehouse_scope
  GROUP BY warehouse_scope.item_id
),
putaway_agg AS (
  SELECT
    putaway_tasks.item_id,
    SUM(COALESCE(putaway_tasks.pending_quantity, 0)) AS putaway_qty
  FROM public.putaway_tasks
  LEFT JOIN public.warehouses
    ON warehouses.id = putaway_tasks.warehouse_id
  WHERE putaway_tasks.company_id = p_company_id
    AND putaway_tasks.deleted_at IS NULL
    AND putaway_tasks.status IN ('pending', 'partial')
    AND COALESCE(putaway_tasks.pending_quantity, 0) > 0
    AND (
      (
        p_warehouse_id IS NULL
        AND (
          p_business_unit_id IS NULL
          OR putaway_tasks.business_unit_id = p_business_unit_id
        )
      )
      OR (
        p_warehouse_id IS NOT NULL
        AND putaway_tasks.warehouse_id = p_warehouse_id
        AND (
          p_business_unit_id IS NULL
          OR warehouses.business_unit_id = p_business_unit_id
        )
      )
    )
  GROUP BY putaway_tasks.item_id
),
enriched AS (
  SELECT
    filtered_items.id,
    filtered_items.item_code,
    filtered_items.supplier_code,
    filtered_items.item_name,
    filtered_items.item_name_cn,
    filtered_items.category_id,
    filtered_items.category_name,
    filtered_items.uom_id,
    filtered_items.uom_code,
    filtered_items.purchase_price,
    filtered_items.import_cost,
    filtered_items.import_currency,
    filtered_items.sales_price,
    filtered_items.item_type,
    filtered_items.custom_fields,
    filtered_items.is_active,
    filtered_items.image_url,
    COALESCE(stock_agg.on_hand, 0) AS on_hand,
    COALESCE(stock_agg.allocated, 0) AS allocated,
    COALESCE(stock_agg.available, 0) AS available,
    COALESCE(putaway_agg.putaway_qty, 0) AS putaway_qty,
    COALESCE(filtered_items.reorder_point, 0) AS reorder_point,
    COALESCE(stock_agg.max_stock_level, 0) AS max_stock_level,
    CASE
      WHEN NOT filtered_items.is_active THEN 'discontinued'
      WHEN COALESCE(stock_agg.available, 0) <= 0 THEN 'out_of_stock'
      WHEN COALESCE(filtered_items.reorder_point, 0) > 0
        AND COALESCE(stock_agg.available, 0) <= COALESCE(filtered_items.reorder_point, 0)
        THEN 'low_stock'
      WHEN COALESCE(stock_agg.max_stock_level, 0) > 0
        AND COALESCE(stock_agg.available, 0) > COALESCE(stock_agg.max_stock_level, 0)
        THEN 'overstock'
      ELSE 'normal'
    END AS status
  FROM filtered_items
  LEFT JOIN stock_agg
    ON stock_agg.item_id = filtered_items.id
  LEFT JOIN putaway_agg
    ON putaway_agg.item_id = filtered_items.id
),
status_filtered AS (
  SELECT
    enriched.id,
    enriched.item_code,
    enriched.supplier_code,
    enriched.item_name,
    enriched.item_name_cn,
    enriched.category_id,
    enriched.category_name,
    enriched.uom_id,
    enriched.uom_code,
    enriched.purchase_price,
    enriched.import_cost,
    enriched.import_currency,
    enriched.sales_price,
    enriched.item_type,
    enriched.custom_fields,
    enriched.is_active,
    enriched.image_url,
    enriched.on_hand,
    enriched.allocated,
    enriched.available,
    enriched.putaway_qty,
    enriched.reorder_point,
    enriched.max_stock_level,
    enriched.status
  FROM enriched
  WHERE p_status IS NULL
    OR p_status = ''
    OR p_status = 'all'
    OR enriched.status = p_status
)
SELECT
  status_filtered.id,
  status_filtered.item_code,
  status_filtered.supplier_code,
  status_filtered.item_name,
  status_filtered.item_name_cn,
  status_filtered.category_id,
  status_filtered.category_name,
  status_filtered.uom_id,
  status_filtered.uom_code,
  status_filtered.purchase_price,
  status_filtered.import_cost,
  status_filtered.import_currency,
  status_filtered.sales_price,
  status_filtered.item_type,
  status_filtered.custom_fields,
  status_filtered.is_active,
  status_filtered.image_url,
  status_filtered.on_hand,
  status_filtered.allocated,
  status_filtered.available,
  status_filtered.putaway_qty,
  status_filtered.reorder_point,
  status_filtered.max_stock_level,
  status_filtered.status,
  COUNT(*) OVER() AS total_count
FROM status_filtered
ORDER BY status_filtered.item_name ASC, status_filtered.id ASC
OFFSET (GREATEST(p_page, 1) - 1) * LEAST(GREATEST(p_limit, 1), 500)
LIMIT LEAST(GREATEST(p_limit, 1), 500);
$$;

COMMENT ON FUNCTION public.get_items_enhanced_page(
  UUID, TEXT, UUID, UUID, TEXT, TEXT, UUID, INTEGER, INTEGER
) IS
  'Returns warehouse inventory and open putaway pipeline quantities. BU-wide scope includes assigned and unassigned putaway tasks; a warehouse scope includes only tasks assigned to that warehouse.';

CREATE INDEX idx_load_lists_stock_in_transit_page
  ON public.load_lists (
    company_id,
    destination_business_unit_id,
    status,
    estimated_arrival_date,
    id
  )
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_stock_in_transit_page(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  load_list_id UUID,
  ll_number TEXT,
  supplier_code TEXT,
  supplier_name TEXT,
  source_business_unit_code TEXT,
  source_business_unit_name TEXT,
  item_id UUID,
  item_code TEXT,
  item_name TEXT,
  unit_name TEXT,
  load_list_qty NUMERIC,
  qty_per_unit NUMERIC,
  base_quantity NUMERIC,
  estimated_arrival_date DATE,
  liner_name TEXT,
  container_number TEXT,
  total_count BIGINT,
  total_base_quantity NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
WITH filtered_rows AS (
  SELECT
    load_list_items.id,
    load_lists.id AS load_list_id,
    load_lists.ll_number,
    suppliers.supplier_code,
    suppliers.supplier_name,
    business_units.code AS source_business_unit_code,
    business_units.name AS source_business_unit_name,
    items.id AS item_id,
    items.item_code,
    items.item_name,
    load_list_items.unit_name,
    load_list_items.load_list_qty,
    load_list_items.qty_per_unit,
    load_list_items.load_list_qty * load_list_items.qty_per_unit AS base_quantity,
    load_lists.estimated_arrival_date,
    load_lists.liner_name,
    load_lists.container_number
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
  INNER JOIN public.business_units
    ON business_units.id = load_lists.business_unit_id
   AND business_units.company_id = load_lists.company_id
   AND business_units.is_active IS TRUE
  WHERE load_lists.company_id = p_company_id
    AND load_lists.destination_business_unit_id = p_business_unit_id
    AND load_lists.status = 'in_transit'
    AND load_lists.deleted_at IS NULL
    AND (
      p_search IS NULL
      OR p_search = ''
      OR load_lists.ll_number ILIKE ('%' || p_search || '%')
      OR suppliers.supplier_code ILIKE ('%' || p_search || '%')
      OR suppliers.supplier_name ILIKE ('%' || p_search || '%')
      OR items.item_code ILIKE ('%' || p_search || '%')
      OR items.item_name ILIKE ('%' || p_search || '%')
    )
)
SELECT
  filtered_rows.id,
  filtered_rows.load_list_id,
  filtered_rows.ll_number,
  filtered_rows.supplier_code,
  filtered_rows.supplier_name,
  filtered_rows.source_business_unit_code,
  filtered_rows.source_business_unit_name,
  filtered_rows.item_id,
  filtered_rows.item_code,
  filtered_rows.item_name,
  filtered_rows.unit_name,
  filtered_rows.load_list_qty,
  filtered_rows.qty_per_unit,
  filtered_rows.base_quantity,
  filtered_rows.estimated_arrival_date,
  filtered_rows.liner_name,
  filtered_rows.container_number,
  COUNT(*) OVER() AS total_count,
  SUM(filtered_rows.base_quantity) OVER() AS total_base_quantity
FROM filtered_rows
ORDER BY
  filtered_rows.estimated_arrival_date ASC NULLS LAST,
  filtered_rows.ll_number ASC,
  filtered_rows.item_code ASC,
  filtered_rows.id ASC
OFFSET (GREATEST(p_page, 1) - 1) * LEAST(GREATEST(p_limit, 1), 50)
LIMIT LEAST(GREATEST(p_limit, 1), 50);
$$;

COMMENT ON FUNCTION public.get_stock_in_transit_page(UUID, UUID, TEXT, INTEGER, INTEGER) IS
  'Returns a bounded, searchable page of supplier load-list lines currently in transit to a business unit.';

GRANT EXECUTE ON FUNCTION public.create_load_list(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, TEXT, TEXT, JSONB
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_load_list(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, DATE, TEXT, TEXT, JSONB
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_load_list_in_transit(
  UUID, UUID, UUID, UUID, DATE, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_load_list_arrived(
  UUID, UUID, UUID, UUID, DATE
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_grn_receiving(
  UUID, UUID, UUID
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_items_enhanced_page(
  UUID, TEXT, UUID, UUID, TEXT, TEXT, UUID, INTEGER, INTEGER
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stock_in_transit_page(
  UUID, UUID, TEXT, INTEGER, INTEGER
) TO authenticated;

COMMIT;
