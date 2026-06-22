-- Rename retained batch inventory tables and retire item_location aggregate stock.
-- item_batches remains the batch-level warehouse stock table.
-- item_batch_locations is now the source of truth for stock by warehouse location.

BEGIN;

DO $$
DECLARE
  v_mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_mismatch_count
  FROM public.get_inventory_batch_reconciliation_mismatches(NULL, 0);

  IF v_mismatch_count > 0 THEN
    RAISE EXCEPTION 'Cannot retire item_location while inventory reconciliation has % mismatch rows', v_mismatch_count;
  END IF;
END $$;

DROP VIEW IF EXISTS public.v_inventory_recon_item_batch_vs_location_batch;
DROP VIEW IF EXISTS public.v_inventory_recon_item_location_vs_location_batch;
DROP VIEW IF EXISTS public.v_inventory_recon_item_warehouse_vs_batch_location;
DROP VIEW IF EXISTS public.v_inventory_recon_item_warehouse_vs_location;
DROP VIEW IF EXISTS public.v_inventory_recon_item_batch_vs_batch_location;
DROP VIEW IF EXISTS public.v_inventory_recon_item_warehouse_vs_batch;

DO $$
BEGIN
  IF to_regclass('public.item_batches') IS NULL AND to_regclass('public.item_batch') IS NOT NULL THEN
    ALTER TABLE public.item_batch RENAME TO item_batches;
  END IF;

  IF to_regclass('public.item_batch_locations') IS NULL AND to_regclass('public.item_location_batch') IS NOT NULL THEN
    ALTER TABLE public.item_location_batch RENAME TO item_batch_locations;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.item_location_batch_sku_seq') IS NOT NULL
     AND to_regclass('public.item_batch_location_sku_seq') IS NULL THEN
    ALTER SEQUENCE public.item_location_batch_sku_seq RENAME TO item_batch_location_sku_seq;
  ELSIF to_regclass('public.item_location_batch_sku_seq') IS NOT NULL
        AND to_regclass('public.item_batch_location_sku_seq') IS NOT NULL THEN
    DROP SEQUENCE public.item_location_batch_sku_seq;
  END IF;
END $$;

DO $$
DECLARE
  v_table TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  FOR v_table, v_old, v_new IN
    SELECT * FROM (VALUES
      ('item_batches', 'item_batch_pkey', 'item_batches_pkey'),
      ('item_batches', 'item_batch_company_id_item_id_warehouse_id_batch_code_key', 'item_batches_company_item_warehouse_batch_code_key'),
      ('item_batches', 'item_batch_batch_code_check', 'item_batches_batch_code_check'),
      ('item_batches', 'item_batch_check', 'item_batches_reserved_lte_on_hand_check'),
      ('item_batches', 'item_batch_qty_on_hand_check', 'item_batches_qty_on_hand_check'),
      ('item_batches', 'item_batch_qty_reserved_check', 'item_batches_qty_reserved_check'),
      ('item_batches', 'item_batch_company_id_fkey', 'item_batches_company_id_fkey'),
      ('item_batches', 'item_batch_item_id_fkey', 'item_batches_item_id_fkey'),
      ('item_batches', 'item_batch_warehouse_id_fkey', 'item_batches_warehouse_id_fkey'),
      ('item_batches', 'item_batch_created_by_fkey', 'item_batches_created_by_fkey'),
      ('item_batches', 'item_batch_updated_by_fkey', 'item_batches_updated_by_fkey'),
      ('item_batch_locations', 'item_location_batch_pkey', 'item_batch_locations_pkey'),
      ('item_batch_locations', 'item_location_batch_company_id_item_id_warehouse_id_locatio_key', 'item_batch_locations_company_item_warehouse_location_batch_key'),
      ('item_batch_locations', 'item_location_batch_batch_location_sku_format_check', 'item_batch_locations_batch_location_sku_format_check'),
      ('item_batch_locations', 'item_location_batch_check', 'item_batch_locations_reserved_lte_on_hand_check'),
      ('item_batch_locations', 'item_location_batch_qty_on_hand_check', 'item_batch_locations_qty_on_hand_check'),
      ('item_batch_locations', 'item_location_batch_qty_reserved_check', 'item_batch_locations_qty_reserved_check'),
      ('item_batch_locations', 'item_location_batch_company_id_fkey', 'item_batch_locations_company_id_fkey'),
      ('item_batch_locations', 'item_location_batch_item_id_fkey', 'item_batch_locations_item_id_fkey'),
      ('item_batch_locations', 'item_location_batch_warehouse_id_fkey', 'item_batch_locations_warehouse_id_fkey'),
      ('item_batch_locations', 'item_location_batch_location_id_fkey', 'item_batch_locations_location_id_fkey'),
      ('item_batch_locations', 'item_location_batch_item_batch_id_fkey', 'item_batch_locations_item_batch_id_fkey'),
      ('item_batch_locations', 'item_location_batch_created_by_fkey', 'item_batch_locations_created_by_fkey'),
      ('item_batch_locations', 'item_location_batch_updated_by_fkey', 'item_batch_locations_updated_by_fkey')
    ) AS names(table_name, old_name, new_name)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
      WHERE n.nspname = 'public'
        AND r.relname = v_table
        AND c.conname = v_old
    ) THEN
      EXECUTE format('ALTER TABLE public.%I RENAME CONSTRAINT %I TO %I', v_table, v_old, v_new);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v_old TEXT;
  v_new TEXT;
BEGIN
  FOR v_old, v_new IN
    SELECT * FROM (VALUES
      ('idx_item_batch_company', 'idx_item_batches_company'),
      ('idx_item_batch_item_wh', 'idx_item_batches_item_wh'),
      ('idx_item_batch_fifo', 'idx_item_batches_fifo'),
      ('idx_item_batch_code', 'idx_item_batches_code'),
      ('idx_item_location_batch_company', 'idx_item_batch_locations_company'),
      ('idx_item_location_batch_item_wh', 'idx_item_batch_locations_item_wh'),
      ('idx_item_location_batch_loc', 'idx_item_batch_locations_loc'),
      ('idx_item_location_batch_batch', 'idx_item_batch_locations_batch'),
      ('idx_item_location_batch_pick', 'idx_item_batch_locations_pick'),
      ('ux_item_location_batch_company_batch_location_sku', 'ux_item_batch_locations_company_batch_location_sku')
    ) AS names(old_name, new_name)
  LOOP
    IF to_regclass('public.' || v_old) IS NOT NULL AND to_regclass('public.' || v_new) IS NULL THEN
      EXECUTE format('ALTER INDEX public.%I RENAME TO %I', v_old, v_new);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_item_batch_updated_at') THEN
    ALTER TRIGGER trigger_item_batch_updated_at ON public.item_batches RENAME TO trigger_item_batches_updated_at;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_item_location_batch_updated_at') THEN
    ALTER TRIGGER trigger_item_location_batch_updated_at ON public.item_batch_locations RENAME TO trigger_item_batch_locations_updated_at;
  END IF;
END $$;

DO $$
DECLARE
  v_table TEXT;
  v_old TEXT;
  v_new TEXT;
BEGIN
  FOR v_table, v_old, v_new IN
    SELECT * FROM (VALUES
      ('item_batches', 'item_batch_select', 'item_batches_select'),
      ('item_batches', 'item_batch_insert', 'item_batches_insert'),
      ('item_batches', 'item_batch_update', 'item_batches_update'),
      ('item_batch_locations', 'item_location_batch_select', 'item_batch_locations_select'),
      ('item_batch_locations', 'item_location_batch_insert', 'item_batch_locations_insert'),
      ('item_batch_locations', 'item_location_batch_update', 'item_batch_locations_update')
    ) AS names(table_name, old_name, new_name)
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = v_table
        AND policyname = v_old
    ) THEN
      EXECUTE format('ALTER POLICY %I ON public.%I RENAME TO %I', v_old, v_table, v_new);
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.item_batches IS 'Batch-level item stock per warehouse.';
COMMENT ON TABLE public.item_batch_locations IS 'Exact item batch stock by warehouse location.';
COMMENT ON COLUMN public.item_batch_locations.batch_location_sku IS 'Database-generated 10-digit scan code for a specific item batch at a warehouse location.';

CREATE OR REPLACE FUNCTION public.increase_item_batch_location_stock(
  p_company_id UUID,
  p_item_id UUID,
  p_warehouse_id UUID,
  p_location_id UUID,
  p_batch_code TEXT,
  p_received_at TIMESTAMPTZ,
  p_quantity NUMERIC,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_item_batch public.item_batches%ROWTYPE;
  v_batch_code TEXT := COALESCE(NULLIF(BTRIM(p_batch_code), ''), 'UNTRACKED');
  v_received_at TIMESTAMPTZ := COALESCE(p_received_at, NOW());
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  IF p_location_id IS NULL THEN
    RAISE EXCEPTION 'Location is required';
  END IF;

  SELECT *
  INTO v_item_batch
  FROM public.item_batches
  WHERE company_id = p_company_id
    AND item_id = p_item_id
    AND warehouse_id = p_warehouse_id
    AND batch_code = v_batch_code
    AND deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.item_batches
    SET
      qty_on_hand = COALESCE(qty_on_hand, 0) + p_quantity,
      updated_by = p_user_id,
      updated_at = NOW()
    WHERE id = v_item_batch.id
    RETURNING * INTO v_item_batch;
  ELSE
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
      p_company_id,
      p_item_id,
      p_warehouse_id,
      v_batch_code,
      v_received_at,
      p_quantity,
      0,
      p_user_id,
      p_user_id
    )
    RETURNING * INTO v_item_batch;
  END IF;

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
    p_company_id,
    p_item_id,
    p_warehouse_id,
    p_location_id,
    v_item_batch.id,
    p_quantity,
    0,
    p_user_id,
    p_user_id
  )
  ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE
  SET
    qty_on_hand = public.item_batch_locations.qty_on_hand + EXCLUDED.qty_on_hand,
    deleted_at = NULL,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW();

  RETURN v_item_batch.id;
END;
$function$;

CREATE OR REPLACE VIEW public.v_inventory_recon_item_warehouse_vs_batch AS
WITH batch_totals AS (
  SELECT
    company_id,
    item_id,
    warehouse_id,
    SUM(COALESCE(qty_on_hand, 0))::NUMERIC AS batch_qty
  FROM public.item_batches
  WHERE deleted_at IS NULL
  GROUP BY company_id, item_id, warehouse_id
)
SELECT
  iw.company_id,
  iw.item_id,
  iw.warehouse_id,
  COALESCE(iw.current_stock, 0)::NUMERIC AS warehouse_qty,
  COALESCE(bt.batch_qty, 0)::NUMERIC AS batch_qty,
  (COALESCE(iw.current_stock, 0) - COALESCE(bt.batch_qty, 0))::NUMERIC AS qty_diff
FROM public.item_warehouse iw
LEFT JOIN batch_totals bt
  ON bt.company_id = iw.company_id
 AND bt.item_id = iw.item_id
 AND bt.warehouse_id = iw.warehouse_id
WHERE iw.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.v_inventory_recon_item_warehouse_vs_batch_location AS
WITH batch_location_totals AS (
  SELECT
    company_id,
    item_id,
    warehouse_id,
    SUM(COALESCE(qty_on_hand, 0))::NUMERIC AS batch_location_qty
  FROM public.item_batch_locations
  WHERE deleted_at IS NULL
  GROUP BY company_id, item_id, warehouse_id
)
SELECT
  iw.company_id,
  iw.item_id,
  iw.warehouse_id,
  NULL::UUID AS location_id,
  COALESCE(iw.current_stock, 0)::NUMERIC AS warehouse_qty,
  COALESCE(blt.batch_location_qty, 0)::NUMERIC AS batch_location_qty,
  (COALESCE(iw.current_stock, 0) - COALESCE(blt.batch_location_qty, 0))::NUMERIC AS qty_diff
FROM public.item_warehouse iw
LEFT JOIN batch_location_totals blt
  ON blt.company_id = iw.company_id
 AND blt.item_id = iw.item_id
 AND blt.warehouse_id = iw.warehouse_id
WHERE iw.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.v_inventory_recon_item_batch_vs_batch_location AS
WITH batch_location_totals AS (
  SELECT
    item_batch_id,
    SUM(COALESCE(qty_on_hand, 0))::NUMERIC AS batch_location_qty
  FROM public.item_batch_locations
  WHERE deleted_at IS NULL
  GROUP BY item_batch_id
)
SELECT
  ib.company_id,
  ib.item_id,
  ib.warehouse_id,
  ib.id AS item_batch_id,
  ib.batch_code,
  COALESCE(ib.qty_on_hand, 0)::NUMERIC AS batch_qty,
  COALESCE(blt.batch_location_qty, 0)::NUMERIC AS batch_location_qty,
  (COALESCE(ib.qty_on_hand, 0) - COALESCE(blt.batch_location_qty, 0))::NUMERIC AS qty_diff
FROM public.item_batches ib
LEFT JOIN batch_location_totals blt
  ON blt.item_batch_id = ib.id
WHERE ib.deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.accept_delivery_note_receiving_exception(p_company_id uuid, p_business_unit_id uuid, p_user_id uuid, p_dn_id uuid, p_exception_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_exception public.delivery_note_receiving_exceptions%ROWTYPE;
  v_dn public.delivery_notes%ROWTYPE;
  v_item public.items%ROWTYPE;
  v_warehouse_id UUID;
  v_location_id UUID;
  v_stock_tx_id UUID;
  v_now TIMESTAMPTZ := now();
  v_posting_date DATE := CURRENT_DATE;
  v_posting_time TIME := now()::TIME;
  v_qty NUMERIC;
  v_current_stock NUMERIC := 0;
  v_next_stock NUMERIC := 0;
  v_item_batch public.item_batches%ROWTYPE;
BEGIN
  SELECT *
  INTO v_dn
  FROM public.delivery_notes
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note not found';
  END IF;

  SELECT *
  INTO v_exception
  FROM public.delivery_note_receiving_exceptions
  WHERE id = p_exception_id
    AND company_id = p_company_id
    AND dn_id = p_dn_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receiving exception not found';
  END IF;

  IF v_exception.status <> 'pending_review' THEN
    RAISE EXCEPTION 'Only pending receiving exceptions can be reviewed';
  END IF;

  v_qty := COALESCE(v_exception.accepted_qty, 0);
  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'Accepted quantity must be greater than zero';
  END IF;

  SELECT *
  INTO v_item
  FROM public.items
  WHERE id = v_exception.item_id
    AND company_id = p_company_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  v_warehouse_id := v_dn.requesting_warehouse_id;
  IF v_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Delivery note receiving warehouse is missing';
  END IF;

  INSERT INTO public.warehouse_locations (
    company_id,
    warehouse_id,
    code,
    name,
    location_type,
    is_pickable,
    is_storable,
    is_active,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    v_warehouse_id,
    'MAIN',
    'Main',
    'bin',
    TRUE,
    TRUE,
    TRUE,
    p_user_id,
    p_user_id
  )
  ON CONFLICT (company_id, warehouse_id, code) DO UPDATE
  SET updated_by = EXCLUDED.updated_by
  RETURNING id INTO v_location_id;

  v_location_id := COALESCE(v_exception.location_id, v_location_id);

  SELECT COALESCE(current_stock, 0)
  INTO v_current_stock
  FROM public.item_warehouse
  WHERE company_id = p_company_id
    AND item_id = v_exception.item_id
    AND warehouse_id = v_warehouse_id
    AND deleted_at IS NULL
  FOR UPDATE;

  v_current_stock := COALESCE(v_current_stock, 0);
  v_next_stock := v_current_stock + v_qty;

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
    status,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    p_business_unit_id,
    'in',
    v_posting_date,
    v_warehouse_id,
    v_location_id,
    'delivery_note_receiving_exception',
    v_exception.id,
    v_dn.dn_no,
    'posted',
    COALESCE(NULLIF(BTRIM(p_notes), ''), 'Accepted unexpected item from delivery note ' || v_dn.dn_no),
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_stock_tx_id;

  INSERT INTO public.stock_transaction_items (
    company_id,
    transaction_id,
    item_id,
    quantity,
    uom_id,
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
    v_stock_tx_id,
    v_exception.item_id,
    v_qty,
    v_exception.uom_id,
    0,
    0,
    v_current_stock,
    v_next_stock,
    0,
    0,
    0,
    v_posting_date,
    v_posting_time,
    COALESCE(NULLIF(BTRIM(p_notes), ''), 'Accepted unexpected receiving exception'),
    p_user_id,
    p_user_id
  );

  INSERT INTO public.item_warehouse (
    company_id,
    item_id,
    warehouse_id,
    current_stock,
    default_location_id,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    v_exception.item_id,
    v_warehouse_id,
    v_qty,
    v_location_id,
    p_user_id,
    p_user_id
  )
  ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE
  SET
    current_stock = public.item_warehouse.current_stock + EXCLUDED.current_stock,
    default_location_id = COALESCE(public.item_warehouse.default_location_id, EXCLUDED.default_location_id),
    updated_by = EXCLUDED.updated_by,
    updated_at = v_now;

  PERFORM public.increase_item_batch_location_stock(
    p_company_id,
    v_exception.item_id,
    v_warehouse_id,
    v_location_id,
    COALESCE(NULLIF(BTRIM(v_exception.batch_number), ''), 'DN-EXCEPTION-' || SUBSTRING(REPLACE(v_exception.id::TEXT, '-', ''), 1, 12)),
    v_now,
    v_qty,
    p_user_id
  );

  UPDATE public.delivery_note_receiving_exceptions
  SET
    status = 'accepted',
    notes = CONCAT_WS(E'\n', NULLIF(BTRIM(notes), ''), NULLIF(BTRIM(p_notes), '')),
    reviewed_by = p_user_id,
    reviewed_at = v_now,
    updated_at = v_now
  WHERE id = p_exception_id
    AND company_id = p_company_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.accept_delivery_note_receiving_overage(p_company_id uuid, p_business_unit_id uuid, p_user_id uuid, p_dn_id uuid, p_dn_item_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_dn public.delivery_notes%ROWTYPE;
  v_dn_item public.delivery_note_items%ROWTYPE;
  v_warehouse_id UUID;
  v_location_id UUID;
  v_stock_tx_id UUID;
  v_now TIMESTAMPTZ := now();
  v_posting_date DATE := CURRENT_DATE;
  v_posting_time TIME := now()::TIME;
  v_overage_qty NUMERIC;
  v_overage_base_qty NUMERIC;
  v_qty_per_unit NUMERIC := 1;
  v_item_base_uom_id UUID;
  v_current_stock NUMERIC := 0;
  v_next_stock NUMERIC := 0;
BEGIN
  SELECT *
  INTO v_dn
  FROM public.delivery_notes
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note not found';
  END IF;

  SELECT *
  INTO v_dn_item
  FROM public.delivery_note_items
  WHERE id = p_dn_item_id
    AND company_id = p_company_id
    AND dn_id = p_dn_id
    AND COALESCE(is_voided, FALSE) = FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note item not found';
  END IF;

  IF v_dn_item.receiving_overage_review_status <> 'pending_review' THEN
    RAISE EXCEPTION 'Only pending receiving overages can be reviewed';
  END IF;

  v_overage_qty := GREATEST(
    0,
    COALESCE(v_dn_item.received_qty, 0)
      - COALESCE(v_dn_item.dispatched_qty, 0)
      - COALESCE(v_dn_item.receiving_overage_posted_qty, 0)
  );

  IF v_overage_qty <= 0 THEN
    RAISE EXCEPTION 'No receiving overage is available to post';
  END IF;

  SELECT
    COALESCE(iuo.qty_per_unit, 1),
    i.uom_id
  INTO
    v_qty_per_unit,
    v_item_base_uom_id
  FROM public.items i
  LEFT JOIN public.item_unit_options iuo
    ON iuo.id = v_dn_item.item_unit_option_id
   AND iuo.deleted_at IS NULL
  WHERE i.id = v_dn_item.item_id
    AND i.company_id = p_company_id
    AND i.deleted_at IS NULL;

  IF v_item_base_uom_id IS NULL THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  v_overage_base_qty := v_overage_qty * COALESCE(v_qty_per_unit, 1);

  v_warehouse_id := v_dn.requesting_warehouse_id;
  IF v_warehouse_id IS NULL THEN
    RAISE EXCEPTION 'Delivery note receiving warehouse is missing';
  END IF;

  INSERT INTO public.warehouse_locations (
    company_id,
    warehouse_id,
    code,
    name,
    location_type,
    is_pickable,
    is_storable,
    is_active,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    v_warehouse_id,
    'MAIN',
    'Main',
    'bin',
    TRUE,
    TRUE,
    TRUE,
    p_user_id,
    p_user_id
  )
  ON CONFLICT (company_id, warehouse_id, code) DO UPDATE
  SET updated_by = EXCLUDED.updated_by
  RETURNING id INTO v_location_id;

  SELECT COALESCE(current_stock, 0)
  INTO v_current_stock
  FROM public.item_warehouse
  WHERE company_id = p_company_id
    AND item_id = v_dn_item.item_id
    AND warehouse_id = v_warehouse_id
    AND deleted_at IS NULL
  FOR UPDATE;

  v_current_stock := COALESCE(v_current_stock, 0);
  v_next_stock := v_current_stock + v_overage_base_qty;

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
    status,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    p_business_unit_id,
    'in',
    v_posting_date,
    v_warehouse_id,
    v_location_id,
    'delivery_note_receiving_overage',
    v_dn_item.id,
    v_dn.dn_no,
    'posted',
    COALESCE(NULLIF(BTRIM(p_notes), ''), 'Accepted over-received quantity from delivery note ' || v_dn.dn_no),
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_stock_tx_id;

  INSERT INTO public.stock_transaction_items (
    company_id,
    transaction_id,
    item_id,
    quantity,
    uom_id,
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
    v_stock_tx_id,
    v_dn_item.item_id,
    v_overage_base_qty,
    v_item_base_uom_id,
    0,
    0,
    v_current_stock,
    v_next_stock,
    0,
    0,
    0,
    v_posting_date,
    v_posting_time,
    COALESCE(NULLIF(BTRIM(p_notes), ''), 'Accepted delivery note receiving overage'),
    p_user_id,
    p_user_id
  );

  INSERT INTO public.item_warehouse (
    company_id,
    item_id,
    warehouse_id,
    current_stock,
    default_location_id,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    v_dn_item.item_id,
    v_warehouse_id,
    v_overage_base_qty,
    v_location_id,
    p_user_id,
    p_user_id
  )
  ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE
  SET
    current_stock = public.item_warehouse.current_stock + EXCLUDED.current_stock,
    default_location_id = COALESCE(public.item_warehouse.default_location_id, EXCLUDED.default_location_id),
    updated_by = EXCLUDED.updated_by,
    updated_at = v_now;

  PERFORM public.increase_item_batch_location_stock(
    p_company_id,
    v_dn_item.item_id,
    v_warehouse_id,
    v_location_id,
    'DN-OVERAGE-' || SUBSTRING(REPLACE(v_dn_item.id::TEXT, '-', ''), 1, 12),
    v_now,
    v_overage_base_qty,
    p_user_id
  );

  UPDATE public.delivery_note_items
  SET
    receiving_overage_review_status = 'accepted',
    receiving_overage_posted_qty = COALESCE(receiving_overage_posted_qty, 0) + v_overage_qty,
    receiving_overage_review_notes = CONCAT_WS(E'\n', NULLIF(BTRIM(receiving_overage_review_notes), ''), NULLIF(BTRIM(p_notes), '')),
    receiving_overage_reviewed_by = p_user_id,
    receiving_overage_reviewed_at = v_now,
    updated_at = v_now
  WHERE id = p_dn_item_id
    AND company_id = p_company_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.adjust_dispatched_delivery_note_item(p_company_id uuid, p_user_id uuid, p_dn_id uuid, p_delivery_note_item_id uuid, p_new_dispatched_qty numeric, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_dn delivery_notes%ROWTYPE;
  v_dni delivery_note_items%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_reason TEXT := NULLIF(BTRIM(p_reason), '');
  v_current_dispatched NUMERIC;
  v_delta NUMERIC;
  v_delta_base_qty NUMERIC;
  v_pick_row RECORD;
  v_take_qty NUMERIC;
  v_take_base_qty NUMERIC;
  v_remaining_reversal NUMERIC;
  v_item_batch_row item_batches%ROWTYPE;
  v_item_batch_locations_row item_batch_locations%ROWTYPE;
  v_warehouse_stock item_warehouse%ROWTYPE;
  v_tx_id UUID;
  v_current_stock NUMERIC;
  v_next_stock NUMERIC;
  v_new_allocated NUMERIC;
  v_new_picked NUMERIC;
  v_new_short NUMERIC;
  v_qty_per_unit NUMERIC := 1;
  v_item_base_uom_id UUID;
BEGIN
  SELECT *
  INTO v_dn
  FROM delivery_notes
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note not found';
  END IF;

  IF v_dn.status <> 'dispatched' THEN
    RAISE EXCEPTION 'Only dispatched delivery notes can be adjusted';
  END IF;

  SELECT *
  INTO v_dni
  FROM delivery_note_items
  WHERE id = p_delivery_note_item_id
    AND company_id = p_company_id
    AND dn_id = p_dn_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note item not found';
  END IF;

  IF COALESCE(v_dni.is_voided, FALSE) THEN
    RAISE EXCEPTION 'Voided delivery note lines cannot be adjusted';
  END IF;

  SELECT
    COALESCE(iuo.qty_per_unit, 1),
    i.uom_id
  INTO
    v_qty_per_unit,
    v_item_base_uom_id
  FROM public.items i
  LEFT JOIN public.item_unit_options iuo
    ON iuo.id = v_dni.item_unit_option_id
   AND iuo.deleted_at IS NULL
  WHERE i.id = v_dni.item_id;

  IF p_new_dispatched_qty IS NULL THEN
    RAISE EXCEPTION 'New dispatched quantity is required';
  END IF;

  v_current_dispatched := COALESCE(v_dni.dispatched_qty, 0);
  IF p_new_dispatched_qty < 0 OR p_new_dispatched_qty > v_current_dispatched THEN
    RAISE EXCEPTION 'New dispatched quantity must be between 0 and %', v_current_dispatched;
  END IF;

  v_delta := v_current_dispatched - p_new_dispatched_qty;
  IF v_delta <= 0 THEN
    RAISE EXCEPTION 'Adjustment delta must be greater than zero';
  END IF;

  v_delta_base_qty := v_delta * COALESCE(v_qty_per_unit, 1);

  SELECT *
  INTO v_warehouse_stock
  FROM item_warehouse
  WHERE company_id = p_company_id
    AND item_id = v_dni.item_id
    AND warehouse_id = v_dni.fulfilling_warehouse_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Warehouse stock not found for item %', v_dni.item_id;
  END IF;

  v_current_stock := COALESCE(v_warehouse_stock.current_stock, 0);
  v_next_stock := v_current_stock + v_delta_base_qty;

  v_remaining_reversal := v_delta;

  FOR v_pick_row IN
    SELECT *
    FROM delivery_note_item_picks
    WHERE company_id = p_company_id
      AND dn_id = p_dn_id
      AND delivery_note_item_id = p_delivery_note_item_id
      AND deleted_at IS NULL
      AND COALESCE(dispatched_qty, 0) > COALESCE(reversed_qty, 0)
    ORDER BY created_at DESC, id DESC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_reversal <= 0;

    v_take_qty := LEAST(
      v_remaining_reversal,
      GREATEST(0, COALESCE(v_pick_row.dispatched_qty, 0) - COALESCE(v_pick_row.reversed_qty, 0))
    );

    IF v_take_qty <= 0 THEN
      CONTINUE;
    END IF;

    v_take_base_qty := v_take_qty * COALESCE(v_qty_per_unit, 1);

    SELECT *
    INTO v_item_batch_row
    FROM item_batches
    WHERE company_id = p_company_id
      AND item_id = v_dni.item_id
      AND warehouse_id = COALESCE(v_pick_row.source_warehouse_id, v_dni.fulfilling_warehouse_id)
      AND batch_code = v_pick_row.picked_batch_code
      AND received_at = v_pick_row.picked_batch_received_at
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item batch not found for reversal';
    END IF;

    SELECT *
    INTO v_item_batch_locations_row
    FROM item_batch_locations
    WHERE company_id = p_company_id
      AND item_id = v_dni.item_id
      AND warehouse_id = COALESCE(v_pick_row.source_warehouse_id, v_dni.fulfilling_warehouse_id)
      AND location_id = v_pick_row.picked_location_id
      AND item_batch_id = v_item_batch_row.id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item location batch not found for reversal';
    END IF;

    UPDATE item_batch_locations
    SET
      qty_on_hand = COALESCE(qty_on_hand, 0) + v_take_base_qty,
      updated_by = p_user_id,
      updated_at = v_now
    WHERE id = v_item_batch_locations_row.id;

    UPDATE item_batches
    SET
      qty_on_hand = COALESCE(qty_on_hand, 0) + v_take_base_qty,
      updated_by = p_user_id,
      updated_at = v_now
    WHERE id = v_item_batch_row.id;

    UPDATE delivery_note_item_picks
    SET
      reversed_qty = COALESCE(reversed_qty, 0) + v_take_qty,
      updated_by = p_user_id,
      updated_at = v_now
    WHERE id = v_pick_row.id;

    v_remaining_reversal := v_remaining_reversal - v_take_qty;
  END LOOP;

  IF v_remaining_reversal > 0 THEN
    RAISE EXCEPTION 'Insufficient dispatched pick rows to reverse delivery note item %', p_delivery_note_item_id;
  END IF;

  INSERT INTO stock_transactions (
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
    v_dn.business_unit_id,
    'adjustment',
    v_now::DATE,
    v_dni.fulfilling_warehouse_id,
    'delivery_note_adjustment',
    v_dn.id,
    v_dn.dn_no,
    'posted',
    COALESCE(v_reason, 'Delivery note line quantity reduced after dispatch'),
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_tx_id;

  UPDATE item_warehouse
  SET
    current_stock = v_next_stock,
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = v_warehouse_stock.id;

  INSERT INTO stock_transaction_items (
    company_id,
    transaction_id,
    item_id,
    quantity,
    uom_id,
    qty_before,
    qty_after,
    posting_date,
    posting_time,
    notes,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    v_tx_id,
    v_dni.item_id,
    v_delta_base_qty,
    v_item_base_uom_id,
    v_current_stock,
    v_next_stock,
    v_now::DATE,
    v_now::TIME,
    COALESCE(v_reason, 'Delivery note line quantity reduced after dispatch'),
    p_user_id,
    p_user_id
  );

  v_new_allocated := GREATEST(0, COALESCE(v_dni.allocated_qty, 0) - v_delta);
  v_new_picked := GREATEST(0, COALESCE(v_dni.picked_qty, 0) - v_delta);
  v_new_short := GREATEST(0, v_new_allocated - v_new_picked);

  UPDATE delivery_note_items
  SET
    allocated_qty = v_new_allocated,
    picked_qty = v_new_picked,
    short_qty = v_new_short,
    dispatched_qty = p_new_dispatched_qty,
    is_voided = (p_new_dispatched_qty = 0),
    voided_at = CASE WHEN p_new_dispatched_qty = 0 THEN v_now ELSE NULL END,
    voided_by = CASE WHEN p_new_dispatched_qty = 0 THEN p_user_id ELSE NULL END,
    void_reason = CASE WHEN p_new_dispatched_qty = 0 THEN v_reason ELSE NULL END,
    updated_at = v_now
  WHERE id = p_delivery_note_item_id
    AND company_id = p_company_id;

  UPDATE stock_request_items
  SET
    dispatch_qty = GREATEST(0, COALESCE(dispatch_qty, 0) - v_delta),
    updated_at = v_now
  WHERE id = v_dni.sr_item_id;

  INSERT INTO delivery_note_item_adjustments (
    company_id,
    dn_id,
    delivery_note_item_id,
    adjustment_type,
    qty_delta,
    prior_dispatched_qty,
    new_dispatched_qty,
    reason,
    created_at,
    created_by
  )
  VALUES (
    p_company_id,
    p_dn_id,
    p_delivery_note_item_id,
    CASE WHEN p_new_dispatched_qty = 0 THEN 'void_qty' ELSE 'reduce_qty' END,
    v_delta,
    v_current_dispatched,
    p_new_dispatched_qty,
    v_reason,
    v_now,
    p_user_id
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.approve_grn_with_batch_inventory(p_company_id uuid, p_user_id uuid, p_grn_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_tx_code TEXT;
  v_load_list_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT load_list_id
  INTO v_load_list_id
  FROM public.grns
  WHERE id = p_grn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;

  UPDATE public.grns
  SET
    received_by = COALESCE(received_by, p_user_id),
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = p_grn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
    AND received_by IS NULL;

  v_tx_code := public.approve_grn_with_batch_inventory_apply_inventory(
    p_company_id,
    p_user_id,
    p_grn_id,
    p_notes
  );

  IF v_load_list_id IS NOT NULL THEN
    UPDATE public.load_lists
    SET
      received_by = COALESCE(received_by, p_user_id),
      received_date = COALESCE(received_date, v_now),
      updated_by = p_user_id,
      updated_at = v_now
    WHERE id = v_load_list_id
      AND company_id = p_company_id
      AND deleted_at IS NULL;
  END IF;

  RETURN v_tx_code;
END;
$function$;


CREATE OR REPLACE FUNCTION public.complete_pick_list_transaction(p_company_id uuid, p_user_id uuid, p_pick_list_id uuid, p_pick_rows jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pick_list pick_lists%ROWTYPE;
  v_dn delivery_notes%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_row JSONB;
  v_delivery_note_item_id UUID;
  v_batch_location_sku TEXT;
  v_picked_location_id UUID;
  v_picked_batch_code TEXT;
  v_picked_batch_received_at TIMESTAMPTZ;
  v_pick_qty NUMERIC;
  v_acknowledged BOOLEAN;
  v_mismatch_reason TEXT;
  v_dn_line delivery_note_items%ROWTYPE;
  v_pick_list_item pick_list_items%ROWTYPE;
  v_qty_per_unit NUMERIC;
  v_current_line_picked NUMERIC;
  v_next_line_picked NUMERIC;
  v_resolved_batch_location_sku TEXT;
  v_source_item_batch_id UUID;
  v_source_location_qty NUMERIC;
  v_source_batch_qty NUMERIC;
  v_existing_pick delivery_note_item_picks%ROWTYPE;
  v_picked_total NUMERIC;
  v_has_picked BOOLEAN := FALSE;
BEGIN
  IF jsonb_typeof(COALESCE(p_pick_rows, '[]'::JSONB)) <> 'array' THEN
    RAISE EXCEPTION 'pickRows must be an array';
  END IF;

  SELECT *
  INTO v_pick_list
  FROM pick_lists
  WHERE id = p_pick_list_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pick list not found';
  END IF;

  IF v_pick_list.status = 'done' THEN
    RETURN v_pick_list.id;
  END IF;

  IF v_pick_list.status NOT IN ('in_progress', 'paused') THEN
    RAISE EXCEPTION 'Pick list must be in progress before completing';
  END IF;

  SELECT *
  INTO v_dn
  FROM delivery_notes
  WHERE id = v_pick_list.dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Linked delivery note not found';
  END IF;

  IF v_dn.status IN ('dispatched', 'received', 'voided') THEN
    RAISE EXCEPTION 'Cannot complete pick list after delivery note is %', v_dn.status;
  END IF;

  FOR v_row IN SELECT value FROM jsonb_array_elements(COALESCE(p_pick_rows, '[]'::JSONB))
  LOOP
    v_delivery_note_item_id := NULLIF(v_row->>'deliveryNoteItemId', '')::UUID;
    v_batch_location_sku := NULLIF(BTRIM(COALESCE(v_row->>'batchLocationSku', '')), '');
    v_picked_location_id := NULLIF(v_row->>'pickedLocationId', '')::UUID;
    v_picked_batch_code := NULLIF(BTRIM(COALESCE(v_row->>'pickedBatchCode', '')), '');
    v_picked_batch_received_at := NULLIF(v_row->>'pickedBatchReceivedAt', '')::TIMESTAMPTZ;
    v_pick_qty := COALESCE(NULLIF(v_row->>'pickedQty', '')::NUMERIC, 0);
    v_acknowledged := COALESCE((v_row->>'isMismatchWarningAcknowledged')::BOOLEAN, FALSE);
    v_mismatch_reason := NULLIF(BTRIM(COALESCE(v_row->>'mismatchReason', '')), '');
    v_resolved_batch_location_sku := v_batch_location_sku;

    IF v_delivery_note_item_id IS NULL THEN
      RAISE EXCEPTION 'deliveryNoteItemId is required';
    END IF;

    IF v_pick_qty <= 0 THEN
      RAISE EXCEPTION 'Picked quantity must be greater than zero';
    END IF;

    SELECT *
    INTO v_pick_list_item
    FROM pick_list_items
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
      AND dn_item_id = v_delivery_note_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid delivery note item for this pick list';
    END IF;

    SELECT *
    INTO v_dn_line
    FROM delivery_note_items
    WHERE id = v_delivery_note_item_id
      AND company_id = p_company_id
      AND dn_id = v_pick_list.dn_id
      AND is_voided = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Delivery note item not found';
    END IF;

    SELECT COALESCE(iuo.qty_per_unit, 1)
    INTO v_qty_per_unit
    FROM item_unit_options iuo
    WHERE iuo.id = v_dn_line.item_unit_option_id
      AND iuo.company_id = p_company_id;
    v_qty_per_unit := GREATEST(COALESCE(v_qty_per_unit, 1), 1);

    SELECT COALESCE(SUM(picked_qty), 0)
    INTO v_current_line_picked
    FROM delivery_note_item_picks
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
      AND delivery_note_item_id = v_delivery_note_item_id
      AND deleted_at IS NULL;

    IF v_current_line_picked >= v_pick_list_item.allocated_qty THEN
      CONTINUE;
    END IF;

    IF v_batch_location_sku IS NOT NULL THEN
      SELECT
        ilb.location_id,
        ilb.batch_location_sku,
        ib.id,
        ib.batch_code,
        ib.received_at,
        ilb.qty_on_hand,
        ib.qty_on_hand
      INTO
        v_picked_location_id,
        v_resolved_batch_location_sku,
        v_source_item_batch_id,
        v_picked_batch_code,
        v_picked_batch_received_at,
        v_source_location_qty,
        v_source_batch_qty
      FROM item_batch_locations ilb
      JOIN item_batches ib ON ib.id = ilb.item_batch_id
      WHERE ilb.company_id = p_company_id
        AND ilb.batch_location_sku = v_batch_location_sku
        AND ilb.item_id = v_dn_line.item_id
        AND ilb.warehouse_id = v_dn_line.fulfilling_warehouse_id
        AND ilb.deleted_at IS NULL
        AND ib.deleted_at IS NULL
      LIMIT 1;

      IF v_source_item_batch_id IS NULL THEN
        RAISE EXCEPTION 'Scanned batch location SKU not found for this item';
      END IF;
    END IF;

    IF v_picked_location_id IS NULL
       OR v_picked_batch_code IS NULL
       OR v_picked_batch_received_at IS NULL THEN
      RAISE EXCEPTION 'Pick source is required before completing';
    END IF;

    SELECT
      ib.id,
      ilb.qty_on_hand,
      ib.qty_on_hand,
      COALESCE(v_resolved_batch_location_sku, ilb.batch_location_sku)
    INTO
      v_source_item_batch_id,
      v_source_location_qty,
      v_source_batch_qty,
      v_resolved_batch_location_sku
    FROM item_batches ib
    JOIN item_batch_locations ilb ON ilb.item_batch_id = ib.id
    WHERE ib.company_id = p_company_id
      AND ib.item_id = v_dn_line.item_id
      AND ib.warehouse_id = v_dn_line.fulfilling_warehouse_id
      AND ib.batch_code = v_picked_batch_code
      AND ib.received_at = v_picked_batch_received_at
      AND ib.deleted_at IS NULL
      AND ilb.company_id = p_company_id
      AND ilb.item_id = v_dn_line.item_id
      AND ilb.warehouse_id = v_dn_line.fulfilling_warehouse_id
      AND ilb.location_id = v_picked_location_id
      AND ilb.deleted_at IS NULL
    LIMIT 1;

    IF v_source_item_batch_id IS NULL THEN
      RAISE EXCEPTION 'Selected source batch was not found';
    END IF;

    v_next_line_picked := v_current_line_picked + v_pick_qty;
    IF v_next_line_picked > v_pick_list_item.allocated_qty THEN
      RAISE EXCEPTION 'Picked quantity exceeds allocated quantity for this line';
    END IF;

    IF (v_pick_qty * v_qty_per_unit) > LEAST(v_source_location_qty, v_source_batch_qty) THEN
      RAISE EXCEPTION 'Selected source batch does not have enough available quantity';
    END IF;

    SELECT *
    INTO v_existing_pick
    FROM delivery_note_item_picks
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
      AND delivery_note_item_id = v_delivery_note_item_id
      AND picked_location_id = v_picked_location_id
      AND picked_batch_code = v_picked_batch_code
      AND picked_batch_received_at = v_picked_batch_received_at
      AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
      UPDATE delivery_note_item_picks
      SET picked_qty = v_existing_pick.picked_qty + v_pick_qty,
          picker_user_id = p_user_id,
          picked_at = v_now,
          is_mismatch_warning_acknowledged = v_acknowledged,
          mismatch_reason = v_mismatch_reason,
          updated_at = v_now,
          updated_by = p_user_id
      WHERE id = v_existing_pick.id;
    ELSE
      INSERT INTO delivery_note_item_picks (
        company_id,
        dn_id,
        delivery_note_item_id,
        pick_list_id,
        item_id,
        source_warehouse_id,
        picked_location_id,
        picked_batch_code,
        picked_batch_received_at,
        picked_qty,
        dispatched_qty,
        picker_user_id,
        picked_at,
        is_mismatch_warning_acknowledged,
        mismatch_reason,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_pick_list.dn_id,
        v_delivery_note_item_id,
        p_pick_list_id,
        v_dn_line.item_id,
        v_dn_line.fulfilling_warehouse_id,
        v_picked_location_id,
        v_picked_batch_code,
        v_picked_batch_received_at,
        v_pick_qty,
        0,
        p_user_id,
        v_now,
        v_acknowledged,
        v_mismatch_reason,
        p_user_id,
        p_user_id
      );
    END IF;

    UPDATE delivery_note_items
    SET suggested_pick_location_id = v_picked_location_id,
        suggested_pick_batch_code = v_picked_batch_code,
        suggested_pick_batch_received_at = v_picked_batch_received_at,
        suggested_batch_location_sku = v_resolved_batch_location_sku,
        has_pick_source_override =
          COALESCE(suggested_pick_location_id <> v_picked_location_id, FALSE)
          OR COALESCE(suggested_pick_batch_code <> v_picked_batch_code, FALSE)
          OR COALESCE(suggested_batch_location_sku <> v_resolved_batch_location_sku, FALSE),
        last_pick_source_override_at = CASE
          WHEN COALESCE(suggested_pick_location_id <> v_picked_location_id, FALSE)
            OR COALESCE(suggested_pick_batch_code <> v_picked_batch_code, FALSE)
            OR COALESCE(suggested_batch_location_sku <> v_resolved_batch_location_sku, FALSE)
          THEN v_now
          ELSE last_pick_source_override_at
        END,
        last_pick_source_override_by = CASE
          WHEN COALESCE(suggested_pick_location_id <> v_picked_location_id, FALSE)
            OR COALESCE(suggested_pick_batch_code <> v_picked_batch_code, FALSE)
            OR COALESCE(suggested_batch_location_sku <> v_resolved_batch_location_sku, FALSE)
          THEN p_user_id
          ELSE last_pick_source_override_by
        END,
        updated_at = v_now
    WHERE id = v_delivery_note_item_id
      AND company_id = p_company_id;
  END LOOP;

  FOR v_pick_list_item IN
    SELECT *
    FROM pick_list_items
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
    FOR UPDATE
  LOOP
    SELECT COALESCE(SUM(picked_qty), 0)
    INTO v_picked_total
    FROM delivery_note_item_picks
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
      AND delivery_note_item_id = v_pick_list_item.dn_item_id
      AND deleted_at IS NULL;

    v_picked_total := LEAST(v_pick_list_item.allocated_qty, COALESCE(v_picked_total, 0));
    IF v_picked_total > 0 THEN
      v_has_picked := TRUE;
    END IF;

    UPDATE pick_list_items
    SET picked_qty = v_picked_total,
        short_qty = GREATEST(0, v_pick_list_item.allocated_qty - v_picked_total),
        updated_at = v_now
    WHERE id = v_pick_list_item.id;

    UPDATE delivery_note_items
    SET picked_qty = v_picked_total,
        short_qty = GREATEST(0, v_pick_list_item.allocated_qty - v_picked_total),
        updated_at = v_now
    WHERE id = v_pick_list_item.dn_item_id
      AND company_id = p_company_id;
  END LOOP;

  IF NOT v_has_picked THEN
    RAISE EXCEPTION 'At least one pick list item must have picked quantity before completing';
  END IF;

  UPDATE pick_lists
  SET status = 'done',
      completed_at = v_now,
      updated_at = v_now,
      updated_by = p_user_id
  WHERE id = p_pick_list_id
    AND company_id = p_company_id;

  UPDATE delivery_notes
  SET status = 'dispatch_ready',
      picking_completed_at = v_now,
      picking_completed_by = p_user_id,
      updated_at = v_now,
      updated_by = p_user_id
  WHERE id = v_pick_list.dn_id
    AND company_id = p_company_id;

  RETURN p_pick_list_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.generate_item_batch_location_sku()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_seq NUMERIC;
  v_mod_base CONSTANT NUMERIC := 10000000000; -- 10^10
  v_val NUMERIC;
BEGIN
  -- Pseudo-randomized permutation from a monotonically increasing sequence.
  -- Multiplier is coprime with 10^10 (not divisible by 2 or 5), preserving uniqueness
  -- within the modulus cycle.
  v_seq := nextval('public.item_batch_location_sku_seq');
  v_val := mod((v_seq * 2454267029) + 518734127, v_mod_base);

  RETURN LPAD(TRUNC(v_val)::BIGINT::TEXT, 10, '0');
END;
$function$;


CREATE OR REPLACE FUNCTION public.get_inventory_batch_reconciliation_mismatches(p_company_id uuid DEFAULT NULL::uuid, p_tolerance numeric DEFAULT 0)
 RETURNS TABLE(check_name text, company_id uuid, item_id uuid, warehouse_id uuid, location_id uuid, item_batch_id uuid, batch_code text, qty_diff numeric)
 LANGUAGE sql
AS $function$
  SELECT
    'item_warehouse_vs_batch'::TEXT AS check_name,
    r.company_id,
    r.item_id,
    r.warehouse_id,
    NULL::UUID,
    NULL::UUID,
    NULL::TEXT,
    r.qty_diff::NUMERIC
  FROM public.v_inventory_recon_item_warehouse_vs_batch r
  WHERE (p_company_id IS NULL OR r.company_id = p_company_id)
    AND ABS(COALESCE(r.qty_diff, 0)) > COALESCE(p_tolerance, 0)

  UNION ALL

  SELECT
    'item_warehouse_vs_batch_location'::TEXT,
    r.company_id,
    r.item_id,
    r.warehouse_id,
    r.location_id,
    NULL::UUID,
    NULL::TEXT,
    r.qty_diff::NUMERIC
  FROM public.v_inventory_recon_item_warehouse_vs_batch_location r
  WHERE (p_company_id IS NULL OR r.company_id = p_company_id)
    AND ABS(COALESCE(r.qty_diff, 0)) > COALESCE(p_tolerance, 0)

  UNION ALL

  SELECT
    'item_batch_vs_batch_location'::TEXT,
    r.company_id,
    r.item_id,
    r.warehouse_id,
    NULL::UUID,
    r.item_batch_id,
    r.batch_code::TEXT,
    r.qty_diff::NUMERIC
  FROM public.v_inventory_recon_item_batch_vs_batch_location r
  WHERE (p_company_id IS NULL OR r.company_id = p_company_id)
    AND ABS(COALESCE(r.qty_diff, 0)) > COALESCE(p_tolerance, 0);
$function$;


CREATE OR REPLACE FUNCTION public.post_delivery_note_dispatch(p_company_id uuid, p_user_id uuid, p_dn_id uuid, p_business_unit_id uuid, p_dispatch_date date, p_notes text, p_driver_name text, p_driver_signature text, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_dn delivery_notes%ROWTYPE;
  v_dn_item delivery_note_items%ROWTYPE;
  v_warehouse_stock item_warehouse%ROWTYPE;
  v_tx_id UUID;
  v_now TIMESTAMPTZ;
  v_posting_date DATE;
  v_posting_time TIME;
  v_line JSONB;
  v_item_id UUID;
  v_dispatch_qty NUMERIC;
  v_dispatch_base_qty NUMERIC;
  v_remaining_pick_qty NUMERIC;
  v_remaining_dispatch_qty NUMERIC;
  v_take_qty NUMERIC;
  v_take_base_qty NUMERIC;
  v_current_stock NUMERIC;
  v_next_stock NUMERIC;
  v_has_dispatch_line BOOLEAN := FALSE;
  v_line_fulfilling_warehouse_id UUID;
  v_line_default_location_id UUID;
  v_reserved_stock NUMERIC;
  v_pick_row RECORD;
  v_item_batch_row item_batches%ROWTYPE;
  v_item_batch_locations_row item_batch_locations%ROWTYPE;
  v_qty_per_unit NUMERIC := 1;
  v_item_base_uom_id UUID;
BEGIN
  SELECT *
  INTO v_dn
  FROM delivery_notes
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note not found';
  END IF;

  IF v_dn.status <> 'dispatch_ready' THEN
    RAISE EXCEPTION 'Only dispatch_ready delivery notes can be dispatched';
  END IF;

  IF p_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required';
  END IF;

  v_now := NOW();
  v_posting_date := COALESCE(p_dispatch_date, v_now::DATE);
  v_posting_time := v_now::TIME;

  FOR v_line IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_item_id := NULLIF(v_line->>'deliveryNoteItemId', '')::UUID;
    IF v_item_id IS NULL THEN
      CONTINUE;
    END IF;

    v_dispatch_qty := COALESCE((v_line->>'dispatchQty')::NUMERIC, 0);

    SELECT *
    INTO v_dn_item
    FROM delivery_note_items
    WHERE id = v_item_id
      AND company_id = p_company_id
      AND dn_id = p_dn_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid delivery note item %', v_item_id;
    END IF;

    SELECT
      COALESCE(iuo.qty_per_unit, 1),
      i.uom_id
    INTO
      v_qty_per_unit,
      v_item_base_uom_id
    FROM public.items i
    LEFT JOIN public.item_unit_options iuo
      ON iuo.id = v_dn_item.item_unit_option_id
     AND iuo.deleted_at IS NULL
    WHERE i.id = v_dn_item.item_id;

    v_remaining_pick_qty := GREATEST(
      0,
      COALESCE(v_dn_item.picked_qty, 0) - COALESCE(v_dn_item.dispatched_qty, 0)
    );
    IF v_dispatch_qty < 0 OR v_dispatch_qty > v_remaining_pick_qty THEN
      RAISE EXCEPTION 'Invalid dispatch quantity for delivery note item %', v_item_id;
    END IF;

    IF v_dispatch_qty = 0 THEN
      CONTINUE;
    END IF;

    v_dispatch_base_qty := v_dispatch_qty * COALESCE(v_qty_per_unit, 1);

    v_line_fulfilling_warehouse_id := COALESCE(v_dn_item.fulfilling_warehouse_id, v_dn.fulfilling_warehouse_id);
    IF v_line_fulfilling_warehouse_id IS NULL THEN
      RAISE EXCEPTION 'Missing fulfilling warehouse for delivery note item %', v_item_id;
    END IF;

    INSERT INTO warehouse_locations (
      company_id,
      warehouse_id,
      code,
      name,
      location_type,
      is_pickable,
      is_storable,
      is_active,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_line_fulfilling_warehouse_id,
      'MAIN',
      'Main',
      'bin',
      TRUE,
      TRUE,
      TRUE,
      p_user_id,
      p_user_id
    )
    ON CONFLICT (company_id, warehouse_id, code) DO UPDATE
    SET updated_by = EXCLUDED.updated_by
    RETURNING id INTO v_line_default_location_id;

    INSERT INTO stock_transactions (
      company_id,
      business_unit_id,
      transaction_type,
      transaction_date,
      warehouse_id,
      from_location_id,
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
      p_business_unit_id,
      'out',
      v_posting_date,
      v_line_fulfilling_warehouse_id,
      v_line_default_location_id,
      'delivery_note',
      v_dn.id,
      v_dn.dn_no,
      'posted',
      COALESCE(NULLIF(BTRIM(p_notes), ''), 'Delivery note ' || v_dn.dn_no || ' dispatched'),
      p_user_id,
      p_user_id
    )
    RETURNING id INTO v_tx_id;

    v_has_dispatch_line := TRUE;

    SELECT *
    INTO v_warehouse_stock
    FROM item_warehouse
    WHERE company_id = p_company_id
      AND item_id = v_dn_item.item_id
      AND warehouse_id = v_line_fulfilling_warehouse_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for item %', v_dn_item.item_id;
    END IF;

    v_current_stock := COALESCE(v_warehouse_stock.current_stock, 0);
    IF v_current_stock < v_dispatch_base_qty THEN
      RAISE EXCEPTION 'Insufficient stock for item %', v_dn_item.item_id;
    END IF;

    v_reserved_stock := COALESCE(v_warehouse_stock.reserved_stock, 0);
    IF v_reserved_stock < v_dispatch_base_qty THEN
      RAISE EXCEPTION 'Insufficient reserved stock for item % on delivery note dispatch', v_dn_item.item_id;
    END IF;

    v_remaining_dispatch_qty := v_dispatch_qty;

    FOR v_pick_row IN
      SELECT *
      FROM delivery_note_item_picks
      WHERE company_id = p_company_id
        AND dn_id = p_dn_id
        AND delivery_note_item_id = v_dn_item.id
        AND deleted_at IS NULL
        AND COALESCE(picked_qty, 0) > COALESCE(dispatched_qty, 0)
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining_dispatch_qty <= 0;

      v_take_qty := LEAST(
        v_remaining_dispatch_qty,
        GREATEST(0, COALESCE(v_pick_row.picked_qty, 0) - COALESCE(v_pick_row.dispatched_qty, 0))
      );
      IF v_take_qty <= 0 THEN
        CONTINUE;
      END IF;

      v_take_base_qty := v_take_qty * COALESCE(v_qty_per_unit, 1);

      SELECT *
      INTO v_item_batch_row
      FROM item_batches
      WHERE company_id = p_company_id
        AND item_id = v_dn_item.item_id
        AND warehouse_id = COALESCE(v_pick_row.source_warehouse_id, v_line_fulfilling_warehouse_id)
        AND batch_code = v_pick_row.picked_batch_code
        AND received_at = v_pick_row.picked_batch_received_at
        AND deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Picked batch not found for delivery note item % (batch %, receipt %)',
          v_dn_item.id, v_pick_row.picked_batch_code, v_pick_row.picked_batch_received_at;
      END IF;

      IF COALESCE(v_item_batch_row.qty_on_hand, 0) < v_take_base_qty THEN
        RAISE EXCEPTION 'Insufficient item_batches stock for delivery note item %', v_dn_item.id;
      END IF;

      SELECT *
      INTO v_item_batch_locations_row
      FROM item_batch_locations
      WHERE company_id = p_company_id
        AND item_id = v_dn_item.item_id
        AND warehouse_id = COALESCE(v_pick_row.source_warehouse_id, v_line_fulfilling_warehouse_id)
        AND location_id = v_pick_row.picked_location_id
        AND item_batch_id = v_item_batch_row.id
        AND deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Picked item_batch_locations row not found for delivery note item %', v_dn_item.id;
      END IF;

      IF COALESCE(v_item_batch_locations_row.qty_on_hand, 0) < v_take_base_qty THEN
        RAISE EXCEPTION 'Insufficient item_batch_locations stock for delivery note item %', v_dn_item.id;
      END IF;

      UPDATE item_batch_locations
      SET
        qty_on_hand = qty_on_hand - v_take_base_qty,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_item_batch_locations_row.id;

      UPDATE item_batches
      SET
        qty_on_hand = qty_on_hand - v_take_base_qty,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_item_batch_row.id;

      UPDATE delivery_note_item_picks
      SET
        dispatched_qty = COALESCE(dispatched_qty, 0) + v_take_qty,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_pick_row.id;

      v_remaining_dispatch_qty := v_remaining_dispatch_qty - v_take_qty;
    END LOOP;

    IF v_remaining_dispatch_qty > 0 THEN
      RAISE EXCEPTION 'Insufficient picked rows to dispatch delivery note item %', v_dn_item.id;
    END IF;

    v_next_stock := v_current_stock - v_dispatch_base_qty;

    UPDATE item_warehouse
    SET
      current_stock = v_next_stock,
      reserved_stock = GREATEST(0, COALESCE(reserved_stock, 0) - v_dispatch_base_qty),
      updated_by = p_user_id,
      updated_at = v_now
    WHERE id = v_warehouse_stock.id;

    INSERT INTO stock_transaction_items (
      company_id,
      transaction_id,
      item_id,
      quantity,
      uom_id,
      qty_before,
      qty_after,
      posting_date,
      posting_time,
      notes,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_tx_id,
      v_dn_item.item_id,
      v_dispatch_base_qty,
      v_item_base_uom_id,
      v_current_stock,
      v_next_stock,
      v_posting_date,
      v_posting_time,
      COALESCE(NULLIF(BTRIM(p_notes), ''), 'Delivery note ' || v_dn.dn_no || ' dispatched'),
      p_user_id,
      p_user_id
    );

    UPDATE delivery_note_items
    SET
      dispatched_qty = COALESCE(dispatched_qty, 0) + v_dispatch_qty,
      updated_at = v_now
    WHERE id = v_dn_item.id;

    UPDATE stock_request_items
    SET
      dispatch_qty = COALESCE(dispatch_qty, 0) + v_dispatch_qty,
      updated_at = v_now
    WHERE id = v_dn_item.sr_item_id;
  END LOOP;

  IF NOT v_has_dispatch_line THEN
    RAISE EXCEPTION 'No picked quantities available for dispatch';
  END IF;

  UPDATE delivery_notes
  SET
    status = 'dispatched',
    dispatched_at = v_now,
    driver_name = COALESCE(NULLIF(BTRIM(p_driver_name), ''), driver_name),
    driver_signature = COALESCE(NULLIF(BTRIM(p_driver_signature), ''), driver_signature),
    notes = COALESCE(NULLIF(BTRIM(p_notes), ''), notes),
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = p_dn_id
    AND company_id = p_company_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.post_delivery_note_dispatch(p_company_id uuid, p_user_id uuid, p_dn_id uuid, p_business_unit_id uuid, p_dispatch_date date, p_notes text, p_driver_name text, p_driver_signature text, p_items jsonb, p_helper_name text, p_delivery_time time without time zone, p_plate_number text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM public.post_delivery_note_dispatch(
    p_company_id,
    p_user_id,
    p_dn_id,
    p_business_unit_id,
    p_dispatch_date,
    p_notes,
    p_driver_name,
    p_driver_signature,
    p_items
  );

  UPDATE public.delivery_notes
  SET
    helper_name = COALESCE(NULLIF(BTRIM(p_helper_name), ''), helper_name),
    delivery_time = COALESCE(p_delivery_time, delivery_time),
    plate_number = COALESCE(NULLIF(BTRIM(p_plate_number), ''), plate_number),
    updated_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL;
END;
$function$;


CREATE OR REPLACE FUNCTION public.post_delivery_note_receive(p_company_id uuid, p_user_id uuid, p_dn_id uuid, p_business_unit_id uuid, p_received_date date, p_notes text, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_dn delivery_notes%ROWTYPE;
  v_dn_item delivery_note_items%ROWTYPE;
  v_warehouse_stock item_warehouse%ROWTYPE;
  v_tx_id UUID;
  v_now TIMESTAMPTZ;
  v_posting_date DATE;
  v_posting_time TIME;
  v_line JSONB;
  v_item_id UUID;
  v_received_qty NUMERIC;
  v_received_base_qty NUMERIC;
  v_max_receivable_qty NUMERIC;
  v_current_stock NUMERIC;
  v_next_stock NUMERIC;
  v_has_receive_line BOOLEAN := FALSE;
  v_target_location_id UUID;
  v_line_requesting_warehouse_id UUID;
  v_line_default_location_id UUID;
  v_remaining_receive_qty NUMERIC;
  v_take_qty NUMERIC;
  v_take_base_qty NUMERIC;
  v_pick_row RECORD;
  v_dest_item_batch item_batches%ROWTYPE;
  v_qty_per_unit NUMERIC := 1;
  v_item_base_uom_id UUID;
BEGIN
  SELECT *
  INTO v_dn
  FROM delivery_notes
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note not found';
  END IF;

  IF v_dn.status <> 'dispatched' THEN
    RAISE EXCEPTION 'Only dispatched delivery notes can be received';
  END IF;

  IF p_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required';
  END IF;

  v_now := NOW();
  v_posting_date := COALESCE(p_received_date, v_now::DATE);
  v_posting_time := v_now::TIME;

  FOR v_line IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_item_id := NULLIF(v_line->>'deliveryNoteItemId', '')::UUID;
    IF v_item_id IS NULL THEN
      CONTINUE;
    END IF;

    v_received_qty := COALESCE((v_line->>'receivedQty')::NUMERIC, 0);

    SELECT *
    INTO v_dn_item
    FROM delivery_note_items
    WHERE id = v_item_id
      AND company_id = p_company_id
      AND dn_id = p_dn_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid delivery note item %', v_item_id;
    END IF;

    SELECT
      COALESCE(iuo.qty_per_unit, 1),
      i.uom_id
    INTO
      v_qty_per_unit,
      v_item_base_uom_id
    FROM public.items i
    LEFT JOIN public.item_unit_options iuo
      ON iuo.id = v_dn_item.item_unit_option_id
     AND iuo.deleted_at IS NULL
    WHERE i.id = v_dn_item.item_id;

    SELECT COALESCE(SUM(GREATEST(0, COALESCE(dispatched_qty, 0) - COALESCE(received_qty, 0))), 0)
    INTO v_max_receivable_qty
    FROM delivery_note_item_picks
    WHERE company_id = p_company_id
      AND dn_id = p_dn_id
      AND delivery_note_item_id = v_dn_item.id
      AND deleted_at IS NULL;

    IF v_max_receivable_qty = 0 THEN
      v_max_receivable_qty := COALESCE(v_dn_item.dispatched_qty, 0);
    END IF;

    IF v_received_qty < 0 OR v_received_qty > v_max_receivable_qty THEN
      RAISE EXCEPTION 'Received quantity must be between 0 and %', v_max_receivable_qty;
    END IF;

    IF v_received_qty = 0 THEN
      CONTINUE;
    END IF;

    v_received_base_qty := v_received_qty * COALESCE(v_qty_per_unit, 1);

    v_line_requesting_warehouse_id := COALESCE(
      v_dn_item.requesting_warehouse_id,
      v_dn.requesting_warehouse_id
    );
    IF v_line_requesting_warehouse_id IS NULL THEN
      RAISE EXCEPTION 'Missing requesting warehouse for delivery note item %', v_item_id;
    END IF;

    INSERT INTO warehouse_locations (
      company_id,
      warehouse_id,
      code,
      name,
      location_type,
      is_pickable,
      is_storable,
      is_active,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_line_requesting_warehouse_id,
      'MAIN',
      'Main',
      'bin',
      TRUE,
      TRUE,
      TRUE,
      p_user_id,
      p_user_id
    )
    ON CONFLICT (company_id, warehouse_id, code) DO UPDATE
    SET updated_by = EXCLUDED.updated_by
    RETURNING id INTO v_line_default_location_id;

    v_target_location_id := COALESCE(NULLIF(v_line->>'locationId', '')::UUID, v_line_default_location_id);

    INSERT INTO stock_transactions (
      company_id,
      business_unit_id,
      transaction_type,
      transaction_date,
      warehouse_id,
      to_location_id,
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
      p_business_unit_id,
      'in',
      v_posting_date,
      v_line_requesting_warehouse_id,
      v_target_location_id,
      'delivery_note',
      v_dn.id,
      v_dn.dn_no,
      'posted',
      COALESCE(NULLIF(BTRIM(p_notes), ''), 'Delivery note ' || v_dn.dn_no || ' received'),
      p_user_id,
      p_user_id
    )
    RETURNING id INTO v_tx_id;

    v_has_receive_line := TRUE;

    SELECT *
    INTO v_warehouse_stock
    FROM item_warehouse
    WHERE company_id = p_company_id
      AND item_id = v_dn_item.item_id
      AND warehouse_id = v_line_requesting_warehouse_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
      v_current_stock := COALESCE(v_warehouse_stock.current_stock, 0);
      v_next_stock := v_current_stock + v_received_base_qty;

      IF v_warehouse_stock.default_location_id IS NULL THEN
        UPDATE item_warehouse
        SET
          default_location_id = v_line_default_location_id,
          current_stock = v_next_stock,
          updated_by = p_user_id,
          updated_at = v_now
        WHERE id = v_warehouse_stock.id;
      ELSE
        UPDATE item_warehouse
        SET
          current_stock = v_next_stock,
          updated_by = p_user_id,
          updated_at = v_now
        WHERE id = v_warehouse_stock.id;
      END IF;
    ELSE
      v_current_stock := 0;
      v_next_stock := v_received_base_qty;

      INSERT INTO item_warehouse (
        company_id,
        item_id,
        warehouse_id,
        current_stock,
        default_location_id,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_dn_item.item_id,
        v_line_requesting_warehouse_id,
        v_next_stock,
        v_line_default_location_id,
        p_user_id,
        p_user_id
      );
    END IF;

    v_remaining_receive_qty := v_received_qty;

    FOR v_pick_row IN
      SELECT *
      FROM delivery_note_item_picks
      WHERE company_id = p_company_id
        AND dn_id = p_dn_id
        AND delivery_note_item_id = v_dn_item.id
        AND deleted_at IS NULL
        AND COALESCE(dispatched_qty, 0) > COALESCE(received_qty, 0)
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining_receive_qty <= 0;

      v_take_qty := LEAST(
        v_remaining_receive_qty,
        GREATEST(0, COALESCE(v_pick_row.dispatched_qty, 0) - COALESCE(v_pick_row.received_qty, 0))
      );
      IF v_take_qty <= 0 THEN
        CONTINUE;
      END IF;

      v_take_base_qty := v_take_qty * COALESCE(v_qty_per_unit, 1);

      SELECT *
      INTO v_dest_item_batch
      FROM item_batches
      WHERE company_id = p_company_id
        AND item_id = v_dn_item.item_id
        AND warehouse_id = v_line_requesting_warehouse_id
        AND batch_code = v_pick_row.picked_batch_code
        AND deleted_at IS NULL
      FOR UPDATE;

      IF FOUND THEN
        IF v_dest_item_batch.received_at <> v_pick_row.picked_batch_received_at THEN
          RAISE EXCEPTION 'Batch % receipt date mismatch on destination warehouse for item % (existing %, incoming %)',
            v_pick_row.picked_batch_code,
            v_dn_item.item_id,
            v_dest_item_batch.received_at,
            v_pick_row.picked_batch_received_at;
        END IF;

        UPDATE item_batches
        SET
          qty_on_hand = qty_on_hand + v_take_base_qty,
          updated_by = p_user_id,
          updated_at = v_now
        WHERE id = v_dest_item_batch.id;
      ELSE
        INSERT INTO item_batches (
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
          p_company_id,
          v_dn_item.item_id,
          v_line_requesting_warehouse_id,
          v_pick_row.picked_batch_code,
          v_pick_row.picked_batch_received_at,
          v_take_base_qty,
          0,
          p_user_id,
          p_user_id
        )
        RETURNING * INTO v_dest_item_batch;
      END IF;

      INSERT INTO item_batch_locations (
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
        p_company_id,
        v_dn_item.item_id,
        v_line_requesting_warehouse_id,
        v_target_location_id,
        v_dest_item_batch.id,
        v_take_base_qty,
        0,
        p_user_id,
        p_user_id
      )
      ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE
      SET
        qty_on_hand = item_batch_locations.qty_on_hand + EXCLUDED.qty_on_hand,
        updated_by = EXCLUDED.updated_by,
        updated_at = v_now;

      UPDATE delivery_note_item_picks
      SET
        received_qty = COALESCE(received_qty, 0) + v_take_qty,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_pick_row.id;

      v_remaining_receive_qty := v_remaining_receive_qty - v_take_qty;
    END LOOP;

    IF v_remaining_receive_qty > 0 THEN
      RAISE EXCEPTION 'Insufficient dispatched pick rows to receive delivery note item %', v_dn_item.id;
    END IF;

    INSERT INTO stock_transaction_items (
      company_id,
      transaction_id,
      item_id,
      quantity,
      uom_id,
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
      v_dn_item.item_id,
      v_received_base_qty,
      v_item_base_uom_id,
      0,
      0,
      v_current_stock,
      v_next_stock,
      0,
      0,
      0,
      v_posting_date,
      v_posting_time,
      COALESCE(NULLIF(BTRIM(p_notes), ''), 'Delivery note ' || v_dn.dn_no || ' received'),
      p_user_id,
      p_user_id
    );

    UPDATE stock_request_items
    SET
      received_qty = COALESCE(received_qty, 0) + v_received_qty,
      updated_at = v_now
    WHERE id = v_dn_item.sr_item_id;
  END LOOP;

  IF NOT v_has_receive_line THEN
    RAISE EXCEPTION 'No dispatched quantities available to receive';
  END IF;

  UPDATE delivery_notes
  SET
    status = 'received',
    received_at = v_now,
    notes = COALESCE(NULLIF(BTRIM(p_notes), ''), notes),
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = p_dn_id
    AND company_id = p_company_id;
END;
$function$;


CREATE OR REPLACE FUNCTION public.reserve_delivery_note_inventory(p_company_id uuid, p_user_id uuid, p_dn_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_dn delivery_notes%ROWTYPE;
  v_dni delivery_note_items%ROWTYPE;
  v_wh item_warehouse%ROWTYPE;
  v_available NUMERIC;
  v_suggested_pick_location_id UUID;
  v_suggested_pick_batch_code TEXT;
  v_suggested_pick_batch_received_at TIMESTAMP;
  v_suggested_batch_location_sku TEXT;
  v_total_allocated NUMERIC := 0;
  v_qty_per_unit NUMERIC := 1;
  v_allocated_base_qty NUMERIC := 0;
BEGIN
  SELECT *
  INTO v_dn
  FROM delivery_notes
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note not found';
  END IF;

  IF v_dn.status <> 'draft' THEN
    RAISE EXCEPTION 'Inventory reservation only allowed while delivery note is in draft status';
  END IF;

  FOR v_dni IN
    SELECT *
    FROM delivery_note_items
    WHERE company_id = p_company_id
      AND dn_id = p_dn_id
    ORDER BY created_at ASC, id ASC
    FOR UPDATE
  LOOP
    IF v_dni.item_unit_option_id IS NOT NULL THEN
      SELECT COALESCE(qty_per_unit, 1)
      INTO v_qty_per_unit
      FROM public.item_unit_options
      WHERE id = v_dni.item_unit_option_id
        AND deleted_at IS NULL;
    ELSE
      v_qty_per_unit := 1;
    END IF;

    v_allocated_base_qty := COALESCE(v_dni.allocated_qty, 0) * COALESCE(v_qty_per_unit, 1);
    v_total_allocated := v_total_allocated + v_allocated_base_qty;

    SELECT *
    INTO v_wh
    FROM item_warehouse
    WHERE company_id = p_company_id
      AND item_id = v_dni.item_id
      AND warehouse_id = v_dni.fulfilling_warehouse_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for item % in warehouse %',
        v_dni.item_id, v_dni.fulfilling_warehouse_id;
    END IF;

    v_available := GREATEST(0, COALESCE(v_wh.current_stock, 0) - COALESCE(v_wh.reserved_stock, 0));
    IF v_available < v_allocated_base_qty THEN
      RAISE EXCEPTION 'Insufficient available stock for item % in warehouse %. Available %, requested %',
        v_dni.item_id, v_dni.fulfilling_warehouse_id, v_available, v_allocated_base_qty;
    END IF;

    UPDATE item_warehouse
    SET
      reserved_stock = COALESCE(reserved_stock, 0) + v_allocated_base_qty,
      updated_by = p_user_id,
      updated_at = NOW()
    WHERE id = v_wh.id;

    v_suggested_pick_location_id := NULL;
    v_suggested_pick_batch_code := NULL;
    v_suggested_pick_batch_received_at := NULL;
    v_suggested_batch_location_sku := NULL;

    SELECT
      ilb.location_id,
      ib.batch_code,
      ib.received_at,
      ilb.batch_location_sku
    INTO
      v_suggested_pick_location_id,
      v_suggested_pick_batch_code,
      v_suggested_pick_batch_received_at,
      v_suggested_batch_location_sku
    FROM item_batch_locations ilb
    JOIN item_batches ib
      ON ib.id = ilb.item_batch_id
     AND ib.company_id = ilb.company_id
     AND ib.deleted_at IS NULL
    WHERE ilb.company_id = p_company_id
      AND ilb.item_id = v_dni.item_id
      AND ilb.warehouse_id = v_dni.fulfilling_warehouse_id
      AND ilb.deleted_at IS NULL
      AND GREATEST(0, COALESCE(ilb.qty_on_hand, 0) - COALESCE(ilb.qty_reserved, 0)) > 0
    ORDER BY ib.received_at ASC, ilb.created_at ASC, ilb.id ASC
    LIMIT 1;

    UPDATE delivery_note_items
    SET
      suggested_pick_location_id = COALESCE(v_suggested_pick_location_id, suggested_pick_location_id),
      suggested_pick_batch_code = COALESCE(v_suggested_pick_batch_code, suggested_pick_batch_code),
      suggested_pick_batch_received_at = COALESCE(v_suggested_pick_batch_received_at, suggested_pick_batch_received_at),
      suggested_batch_location_sku = COALESCE(v_suggested_batch_location_sku, suggested_batch_location_sku),
      updated_at = NOW()
    WHERE id = v_dni.id
      AND company_id = p_company_id;
  END LOOP;

  IF v_total_allocated <= 0 THEN
    RAISE EXCEPTION 'Delivery note has no allocatable line quantities';
  END IF;
END;
$function$;


CREATE OR REPLACE FUNCTION public.reserve_delivery_note_inventory_lines(p_company_id uuid, p_user_id uuid, p_dn_id uuid, p_line_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_dn delivery_notes%ROWTYPE;
  v_dni delivery_note_items%ROWTYPE;
  v_wh item_warehouse%ROWTYPE;
  v_available NUMERIC;
  v_suggested_pick_location_id UUID;
  v_suggested_pick_batch_code TEXT;
  v_suggested_pick_batch_received_at TIMESTAMP;
  v_suggested_batch_location_sku TEXT;
  v_qty_per_unit NUMERIC := 1;
  v_allocated_base_qty NUMERIC := 0;
BEGIN
  IF COALESCE(array_length(p_line_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one delivery note line id is required';
  END IF;

  SELECT *
  INTO v_dn
  FROM delivery_notes
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery note not found';
  END IF;

  IF v_dn.status IN ('received', 'voided') THEN
    RAISE EXCEPTION 'Cannot reserve delivery note lines for received or voided delivery notes';
  END IF;

  FOR v_dni IN
    SELECT *
    FROM delivery_note_items
    WHERE company_id = p_company_id
      AND dn_id = p_dn_id
      AND id = ANY(p_line_ids)
    ORDER BY created_at ASC, id ASC
    FOR UPDATE
  LOOP
    IF COALESCE(v_dni.is_voided, FALSE) THEN
      RAISE EXCEPTION 'Cannot reserve inventory for voided delivery note line %', v_dni.id;
    END IF;

    IF v_dni.item_unit_option_id IS NOT NULL THEN
      SELECT COALESCE(qty_per_unit, 1)
      INTO v_qty_per_unit
      FROM public.item_unit_options
      WHERE id = v_dni.item_unit_option_id
        AND deleted_at IS NULL;
    ELSE
      v_qty_per_unit := 1;
    END IF;

    v_allocated_base_qty := COALESCE(v_dni.allocated_qty, 0) * COALESCE(v_qty_per_unit, 1);

    SELECT *
    INTO v_wh
    FROM item_warehouse
    WHERE company_id = p_company_id
      AND item_id = v_dni.item_id
      AND warehouse_id = v_dni.fulfilling_warehouse_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for item % in warehouse %',
        v_dni.item_id, v_dni.fulfilling_warehouse_id;
    END IF;

    v_available := GREATEST(0, COALESCE(v_wh.current_stock, 0) - COALESCE(v_wh.reserved_stock, 0));
    IF v_available < v_allocated_base_qty THEN
      RAISE EXCEPTION 'Insufficient available stock for item % in warehouse %. Available %, requested %',
        v_dni.item_id, v_dni.fulfilling_warehouse_id, v_available, v_allocated_base_qty;
    END IF;

    UPDATE item_warehouse
    SET
      reserved_stock = COALESCE(reserved_stock, 0) + v_allocated_base_qty,
      updated_by = p_user_id,
      updated_at = NOW()
    WHERE id = v_wh.id;

    v_suggested_pick_location_id := NULL;
    v_suggested_pick_batch_code := NULL;
    v_suggested_pick_batch_received_at := NULL;
    v_suggested_batch_location_sku := NULL;

    SELECT
      ilb.location_id,
      ib.batch_code,
      ib.received_at,
      ilb.batch_location_sku
    INTO
      v_suggested_pick_location_id,
      v_suggested_pick_batch_code,
      v_suggested_pick_batch_received_at,
      v_suggested_batch_location_sku
    FROM item_batch_locations ilb
    JOIN item_batches ib
      ON ib.id = ilb.item_batch_id
     AND ib.company_id = ilb.company_id
     AND ib.deleted_at IS NULL
    WHERE ilb.company_id = p_company_id
      AND ilb.item_id = v_dni.item_id
      AND ilb.warehouse_id = v_dni.fulfilling_warehouse_id
      AND ilb.deleted_at IS NULL
      AND GREATEST(0, COALESCE(ilb.qty_on_hand, 0) - COALESCE(ilb.qty_reserved, 0)) > 0
    ORDER BY ib.received_at ASC, ilb.created_at ASC, ilb.id ASC
    LIMIT 1;

    UPDATE delivery_note_items
    SET
      suggested_pick_location_id = COALESCE(v_suggested_pick_location_id, suggested_pick_location_id),
      suggested_pick_batch_code = COALESCE(v_suggested_pick_batch_code, suggested_pick_batch_code),
      suggested_pick_batch_received_at = COALESCE(v_suggested_pick_batch_received_at, suggested_pick_batch_received_at),
      suggested_batch_location_sku = COALESCE(v_suggested_batch_location_sku, suggested_batch_location_sku),
      updated_at = NOW()
    WHERE id = v_dni.id
      AND company_id = p_company_id;
  END LOOP;
END;
$function$;


CREATE OR REPLACE FUNCTION public.set_item_batch_location_sku()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.batch_location_sku IS NULL OR BTRIM(NEW.batch_location_sku) = '' THEN
    NEW.batch_location_sku := public.generate_item_batch_location_sku();
  END IF;

  RETURN NEW;
END;
$function$;


CREATE OR REPLACE FUNCTION public.void_pos_transaction(p_transaction_id uuid, p_company_id uuid, p_user_id uuid, p_business_unit_id uuid DEFAULT NULL::uuid, p_void_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_transaction public.pos_transactions%ROWTYPE;
  v_invoice public.sales_invoices%ROWTYPE;
  v_original_stock public.stock_transactions%ROWTYPE;
  v_original_stock_item public.stock_transaction_items%ROWTYPE;
  v_reversal_stock_id UUID;
  v_reversal_location_id UUID;
  v_current_stock NUMERIC;
  v_new_stock NUMERIC;
  v_original_journal public.journal_entries%ROWTYPE;
  v_reversal_journal_id UUID;
  v_rows INTEGER;
  v_invoice_count INTEGER := 0;
  v_payment_void_count INTEGER := 0;
  v_stock_reversal_count INTEGER := 0;
  v_journal_reversal_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'POS_VOID_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'POS_VOID_UNAUTHORIZED';
  END IF;

  SELECT *
  INTO v_transaction
  FROM public.pos_transactions pt
  WHERE pt.id = p_transaction_id
    AND pt.company_id = p_company_id
    AND (p_business_unit_id IS NULL OR pt.business_unit_id = p_business_unit_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POS_VOID_TRANSACTION_NOT_FOUND';
  END IF;

  IF v_transaction.status = 'voided' THEN
    RAISE EXCEPTION 'POS_VOID_ALREADY_VOIDED';
  END IF;

  IF v_transaction.status <> 'completed' THEN
    RAISE EXCEPTION 'POS_VOID_UNSUPPORTED_STATUS';
  END IF;

  FOR v_invoice IN
    SELECT *
    FROM public.sales_invoices si
    WHERE si.company_id = p_company_id
      AND si.deleted_at IS NULL
      AND si.custom_fields ->> 'posTransactionId' = p_transaction_id::TEXT
    FOR UPDATE
  LOOP
    UPDATE public.invoice_payments ip
    SET
      deleted_at = NOW(),
      updated_at = NOW(),
      updated_by = p_user_id,
      notes = CONCAT_WS(
        E'\n',
        ip.notes,
        'Voided with POS transaction ' || v_transaction.transaction_code
      )
    WHERE ip.company_id = p_company_id
      AND ip.invoice_id = v_invoice.id
      AND ip.deleted_at IS NULL;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_payment_void_count := v_payment_void_count + v_rows;

    UPDATE public.sales_invoices si
    SET
      status = 'cancelled',
      amount_paid = 0,
      amount_due = 0,
      updated_at = NOW(),
      updated_by = p_user_id,
      notes = CONCAT_WS(
        E'\n',
        si.notes,
        'Cancelled by POS void ' || v_transaction.transaction_code
      ),
      custom_fields = COALESCE(si.custom_fields, '{}'::JSONB)
        || JSONB_BUILD_OBJECT(
          'posVoidedAt', NOW(),
          'posVoidedBy', p_user_id,
          'posVoidReason', NULLIF(BTRIM(COALESCE(p_void_reason, '')), '')
        )
    WHERE si.id = v_invoice.id;

    v_invoice_count := v_invoice_count + 1;
  END LOOP;

  FOR v_original_stock IN
    SELECT *
    FROM public.stock_transactions st
    WHERE st.company_id = p_company_id
      AND st.reference_type = 'pos_transaction'
      AND st.reference_id = p_transaction_id
      AND st.transaction_type = 'out'
      AND st.status = 'posted'
      AND st.deleted_at IS NULL
    FOR UPDATE
  LOOP
    INSERT INTO public.warehouse_locations (
      company_id,
      warehouse_id,
      code,
      name,
      location_type,
      is_pickable,
      is_storable,
      is_active,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_original_stock.warehouse_id,
      'MAIN',
      'Main Location',
      'bin',
      TRUE,
      TRUE,
      TRUE,
      p_user_id,
      p_user_id
    )
    ON CONFLICT (company_id, warehouse_id, code)
    DO UPDATE SET
      deleted_at = NULL,
      is_active = TRUE,
      is_storable = TRUE,
      updated_at = NOW(),
      updated_by = EXCLUDED.updated_by
    RETURNING id INTO v_reversal_location_id;

    v_reversal_location_id := COALESCE(v_original_stock.from_location_id, v_reversal_location_id);

    INSERT INTO public.stock_transactions (
      company_id,
      business_unit_id,
      transaction_date,
      transaction_type,
      reference_type,
      reference_id,
      reference_code,
      warehouse_id,
      to_location_id,
      status,
      notes,
      custom_fields,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_original_stock.business_unit_id,
      CURRENT_DATE,
      'in',
      'pos_transaction',
      p_transaction_id,
      v_transaction.transaction_code,
      v_original_stock.warehouse_id,
      v_reversal_location_id,
      'posted',
      'Void/Reversal - POS Sale ' || v_transaction.transaction_code,
      JSONB_BUILD_OBJECT(
        'voidedOriginalStockTransactionId', v_original_stock.id,
        'posTransactionId', p_transaction_id,
        'voidedAt', NOW(),
        'voidedBy', p_user_id
      ),
      p_user_id,
      p_user_id
    )
    RETURNING id INTO v_reversal_stock_id;

    FOR v_original_stock_item IN
      SELECT *
      FROM public.stock_transaction_items sti
      WHERE sti.transaction_id = v_original_stock.id
        AND sti.company_id = p_company_id
        AND sti.deleted_at IS NULL
      FOR UPDATE
    LOOP
      SELECT COALESCE(iw.current_stock, 0)
      INTO v_current_stock
      FROM public.item_warehouse iw
      WHERE iw.company_id = p_company_id
        AND iw.item_id = v_original_stock_item.item_id
        AND iw.warehouse_id = v_original_stock.warehouse_id
        AND iw.deleted_at IS NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        INSERT INTO public.item_warehouse (
          company_id,
          item_id,
          warehouse_id,
          current_stock,
          default_location_id,
          created_by,
          updated_by
        )
        VALUES (
          p_company_id,
          v_original_stock_item.item_id,
          v_original_stock.warehouse_id,
          0,
          v_reversal_location_id,
          p_user_id,
          p_user_id
        )
        ON CONFLICT (company_id, item_id, warehouse_id)
        DO UPDATE SET
          deleted_at = NULL,
          is_active = TRUE,
          default_location_id = COALESCE(
            public.item_warehouse.default_location_id,
            EXCLUDED.default_location_id
          ),
          updated_at = NOW(),
          updated_by = EXCLUDED.updated_by
        RETURNING COALESCE(public.item_warehouse.current_stock, 0) INTO v_current_stock;
      END IF;

      v_new_stock := v_current_stock + v_original_stock_item.quantity;

      INSERT INTO public.stock_transaction_items (
        company_id,
        transaction_id,
        item_id,
        quantity,
        uom_id,
        unit_cost,
        total_cost,
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
        p_company_id,
        v_reversal_stock_id,
        v_original_stock_item.item_id,
        v_original_stock_item.quantity,
        v_original_stock_item.uom_id,
        COALESCE(v_original_stock_item.unit_cost, v_original_stock_item.valuation_rate, 0),
        v_original_stock_item.quantity * COALESCE(v_original_stock_item.unit_cost, v_original_stock_item.valuation_rate, 0),
        v_current_stock,
        v_new_stock,
        COALESCE(v_original_stock_item.valuation_rate, v_original_stock_item.unit_cost, 0),
        v_current_stock * COALESCE(v_original_stock_item.unit_cost, v_original_stock_item.valuation_rate, 0),
        v_new_stock * COALESCE(v_original_stock_item.unit_cost, v_original_stock_item.valuation_rate, 0),
        CURRENT_DATE,
        CURRENT_TIME,
        p_user_id,
        p_user_id
      );

      UPDATE public.item_warehouse iw
      SET
        current_stock = v_new_stock,
        default_location_id = COALESCE(iw.default_location_id, v_reversal_location_id),
        updated_at = NOW(),
        updated_by = p_user_id
      WHERE iw.company_id = p_company_id
        AND iw.item_id = v_original_stock_item.item_id
        AND iw.warehouse_id = v_original_stock.warehouse_id
        AND iw.deleted_at IS NULL;

      PERFORM public.increase_item_batch_location_stock(
        p_company_id,
        v_original_stock_item.item_id,
        v_original_stock.warehouse_id,
        v_reversal_location_id,
        'POS-VOID-' || SUBSTRING(REPLACE(v_original_stock_item.id::TEXT, '-', ''), 1, 12),
        NOW(),
        v_original_stock_item.quantity,
        p_user_id
      );
    END LOOP;

    v_stock_reversal_count := v_stock_reversal_count + 1;
  END LOOP;

  FOR v_original_journal IN
    SELECT *
    FROM public.journal_entries je
    WHERE je.company_id = p_company_id
      AND je.reference_type = 'pos_transaction'
      AND je.reference_id = p_transaction_id
      AND je.status = 'posted'
      AND je.deleted_at IS NULL
      AND COALESCE(je.description, '') NOT ILIKE 'Void%'
    FOR UPDATE
  LOOP
    INSERT INTO public.journal_entries (
      company_id,
      business_unit_id,
      posting_date,
      reference_type,
      reference_id,
      reference_code,
      description,
      status,
      source_module,
      total_debit,
      total_credit,
      posted_at,
      posted_by,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      v_original_journal.business_unit_id,
      CURRENT_DATE,
      'pos_transaction',
      p_transaction_id,
      v_transaction.transaction_code,
      'Void/Reversal - ' || COALESCE(v_original_journal.description, v_transaction.transaction_code),
      'posted',
      v_original_journal.source_module,
      v_original_journal.total_credit,
      v_original_journal.total_debit,
      NOW(),
      p_user_id,
      p_user_id,
      p_user_id
    )
    RETURNING id INTO v_reversal_journal_id;

    INSERT INTO public.journal_lines (
      company_id,
      journal_entry_id,
      account_id,
      debit,
      credit,
      description,
      line_number,
      cost_center_id,
      project_id,
      created_by
    )
    SELECT
      jl.company_id,
      v_reversal_journal_id,
      jl.account_id,
      jl.credit,
      jl.debit,
      'Void/Reversal - ' || COALESCE(jl.description, v_transaction.transaction_code),
      jl.line_number,
      jl.cost_center_id,
      jl.project_id,
      p_user_id
    FROM public.journal_lines jl
    WHERE jl.journal_entry_id = v_original_journal.id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      RAISE EXCEPTION 'POS_VOID_ORIGINAL_JOURNAL_LINES_NOT_FOUND';
    END IF;

    v_journal_reversal_count := v_journal_reversal_count + 1;
  END LOOP;

  UPDATE public.pos_transactions pt
  SET
    status = 'voided',
    notes = CASE
      WHEN NULLIF(BTRIM(COALESCE(p_void_reason, '')), '') IS NULL THEN pt.notes
      ELSE CONCAT_WS(E'\n', pt.notes, 'Void reason: ' || BTRIM(p_void_reason))
    END,
    updated_at = NOW(),
    updated_by = p_user_id
  WHERE pt.id = p_transaction_id;

  RETURN JSONB_BUILD_OBJECT(
    'transactionId', p_transaction_id,
    'status', 'voided',
    'cancelledInvoices', v_invoice_count,
    'voidedInvoicePayments', v_payment_void_count,
    'stockReversals', v_stock_reversal_count,
    'journalReversals', v_journal_reversal_count
  );
END;
$function$;


CREATE OR REPLACE FUNCTION public.approve_grn_with_batch_inventory_apply_inventory(p_company_id uuid, p_user_id uuid, p_grn_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_grn grns%ROWTYPE;
  v_grn_item grn_items%ROWTYPE;
  v_item_uom_id UUID;
  v_unit_cost NUMERIC;
  v_now TIMESTAMPTZ := NOW();
  v_tx_id UUID;
  v_tx_code TEXT;
  v_posting_date DATE;
  v_posting_time TIME;
  v_default_location_id UUID;
  v_generated_batch_code TEXT;
  v_batch_code TEXT;
  v_item_wh item_warehouse%ROWTYPE;
  v_item_batch item_batches%ROWTYPE;
  v_item_loc_batch item_batch_locations%ROWTYPE;
  v_received_qty NUMERIC;
  v_received_base_qty NUMERIC;
  v_expected_base_qty NUMERIC;
  v_damaged_qty NUMERIC;
  v_qty_per_unit NUMERIC;
  v_batch_received_at TIMESTAMPTZ;
  v_boxes_total_qty NUMERIC;
  v_remainder_qty NUMERIC;
  v_has_items BOOLEAN := FALSE;
  v_line_location RECORD;
  v_item_wh_current_stock NUMERIC;
  v_item_wh_reserved_stock NUMERIC;
  v_item_wh_next_stock NUMERIC;
BEGIN
  SELECT *
  INTO v_grn
  FROM grns
  WHERE id = p_grn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GRN not found';
  END IF;

  IF v_grn.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Only GRNs in pending approval can be approved';
  END IF;

  v_posting_date := COALESCE(v_grn.receiving_date, CURRENT_DATE);
  v_posting_time := v_now::TIME;
  v_batch_received_at := (v_posting_date::TIMESTAMP + v_posting_time) AT TIME ZONE 'UTC';

  INSERT INTO warehouse_locations (
    company_id,
    warehouse_id,
    code,
    name,
    location_type,
    is_pickable,
    is_storable,
    is_active,
    created_by,
    updated_by
  )
  VALUES (
    p_company_id,
    v_grn.warehouse_id,
    'MAIN',
    'Main',
    'bin',
    TRUE,
    TRUE,
    TRUE,
    p_user_id,
    p_user_id
  )
  ON CONFLICT (company_id, warehouse_id, code) DO UPDATE
  SET updated_by = EXCLUDED.updated_by
  RETURNING id INTO v_default_location_id;

  INSERT INTO stock_transactions (
    company_id,
    business_unit_id,
    transaction_type,
    transaction_date,
    warehouse_id,
    to_location_id,
    reference_type,
    reference_id,
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
    v_grn.warehouse_id,
    v_default_location_id,
    'grn',
    v_grn.id,
    'posted',
    COALESCE(NULLIF(BTRIM(p_notes), ''), 'Auto-created from GRN ' || v_grn.grn_number),
    p_user_id,
    p_user_id
  )
  RETURNING id, transaction_code INTO v_tx_id, v_tx_code;

  FOR v_grn_item IN
    SELECT gi.*
    FROM grn_items gi
    WHERE gi.grn_id = v_grn.id
    ORDER BY gi.created_at ASC, gi.id ASC
    FOR UPDATE
  LOOP
    v_has_items := TRUE;
    v_received_qty := COALESCE(v_grn_item.received_qty, 0);
    v_damaged_qty := COALESCE(v_grn_item.damaged_qty, 0);

    SELECT COALESCE(iuo.qty_per_unit, 1)
    INTO v_qty_per_unit
    FROM item_unit_options iuo
    WHERE iuo.id = v_grn_item.item_unit_option_id;

    v_qty_per_unit := COALESCE(v_qty_per_unit, 1);
    v_expected_base_qty := COALESCE(v_grn_item.load_list_qty, 0) * v_qty_per_unit;
    v_received_base_qty := v_received_qty * v_qty_per_unit;

    IF v_received_qty <= 0 THEN
      UPDATE item_warehouse
      SET
        in_transit = GREATEST(0, COALESCE(in_transit, 0) - v_expected_base_qty),
        estimated_arrival_date = CASE
          WHEN GREATEST(0, COALESCE(in_transit, 0) - v_expected_base_qty) > 0 THEN estimated_arrival_date
          ELSE NULL
        END,
        updated_by = p_user_id,
        updated_at = v_now
      WHERE company_id = p_company_id
        AND item_id = v_grn_item.item_id
        AND warehouse_id = v_grn.warehouse_id
        AND deleted_at IS NULL;

      CONTINUE;
    END IF;

    SELECT
      i.uom_id,
      COALESCE(NULLIF(lli.unit_price, 0), NULLIF(i.purchase_price, 0), 0)
    INTO v_item_uom_id, v_unit_cost
    FROM items i
    LEFT JOIN load_list_items lli
      ON lli.id = v_grn_item.load_list_item_id
    WHERE i.id = v_grn_item.item_id;

    IF v_item_uom_id IS NULL THEN
      RAISE EXCEPTION 'Item UOM not found for item %', v_grn_item.item_id;
    END IF;

    v_unit_cost := COALESCE(v_unit_cost, 0);
    v_generated_batch_code := COALESCE(
      NULLIF(BTRIM(v_grn.batch_number), ''),
      'GRN-' || v_grn.grn_number || '-' || SUBSTRING(REPLACE(v_grn_item.id::TEXT, '-', ''), 1, 8)
    );
    v_batch_code := v_generated_batch_code;

    PERFORM 1
    FROM item_batches ib_dup
    WHERE ib_dup.company_id = p_company_id
      AND ib_dup.item_id = v_grn_item.item_id
      AND ib_dup.warehouse_id = v_grn.warehouse_id
      AND ib_dup.batch_code = v_batch_code
      AND ib_dup.deleted_at IS NULL;

    IF FOUND THEN
      RAISE EXCEPTION 'Duplicate batch code % for item % in warehouse %',
        v_batch_code, v_grn_item.item_id, v_grn.warehouse_id;
    END IF;

    SELECT *
    INTO v_item_wh
    FROM item_warehouse
    WHERE company_id = p_company_id
      AND item_id = v_grn_item.item_id
      AND warehouse_id = v_grn.warehouse_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
      v_item_wh_current_stock := COALESCE(v_item_wh.current_stock, 0);
      v_item_wh_reserved_stock := COALESCE(v_item_wh.reserved_stock, 0);
      v_item_wh_next_stock := v_item_wh_current_stock + v_received_base_qty;

      UPDATE item_warehouse
      SET
        current_stock = v_item_wh_next_stock,
        in_transit = GREATEST(0, COALESCE(in_transit, 0) - v_expected_base_qty),
        estimated_arrival_date = CASE
          WHEN GREATEST(0, COALESCE(in_transit, 0) - v_expected_base_qty) > 0 THEN estimated_arrival_date
          ELSE NULL
        END,
        default_location_id = COALESCE(default_location_id, v_default_location_id),
        updated_by = p_user_id,
        updated_at = v_now
      WHERE id = v_item_wh.id;
    ELSE
      v_item_wh_current_stock := 0;
      v_item_wh_reserved_stock := 0;
      v_item_wh_next_stock := v_received_base_qty;

      INSERT INTO item_warehouse (
        company_id,
        item_id,
        warehouse_id,
        current_stock,
        reserved_stock,
        in_transit,
        estimated_arrival_date,
        default_location_id,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_grn_item.item_id,
        v_grn.warehouse_id,
        v_item_wh_next_stock,
        0,
        0,
        NULL,
        v_default_location_id,
        p_user_id,
        p_user_id
      );
    END IF;

    INSERT INTO item_batches (
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
      p_company_id,
      v_grn_item.item_id,
      v_grn.warehouse_id,
      v_batch_code,
      v_batch_received_at,
      v_received_base_qty,
      0,
      p_user_id,
      p_user_id
    )
    RETURNING * INTO v_item_batch;

    v_boxes_total_qty := 0;

    FOR v_line_location IN
      SELECT
        gb.warehouse_location_id AS location_id,
        MIN(NULLIF(BTRIM(gb.batch_location_sku), '')) AS batch_location_sku,
        SUM(COALESCE(gb.qty_per_box, 0))::NUMERIC AS qty
      FROM grn_boxes gb
      WHERE gb.grn_item_id = v_grn_item.id
        AND gb.warehouse_location_id IS NOT NULL
      GROUP BY gb.warehouse_location_id
      ORDER BY gb.warehouse_location_id
    LOOP
      EXIT WHEN v_line_location.qty IS NULL OR v_line_location.qty <= 0;
      v_boxes_total_qty := v_boxes_total_qty + COALESCE(v_line_location.qty, 0);

      INSERT INTO item_batch_locations (
        company_id,
        item_id,
        warehouse_id,
        location_id,
        item_batch_id,
        batch_location_sku,
        qty_on_hand,
        qty_reserved,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_grn_item.item_id,
        v_grn.warehouse_id,
        v_line_location.location_id,
        v_item_batch.id,
        NULLIF(BTRIM(v_line_location.batch_location_sku::TEXT), ''),
        v_line_location.qty,
        0,
        p_user_id,
        p_user_id
      )
      ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE
      SET
        qty_on_hand = item_batch_locations.qty_on_hand + EXCLUDED.qty_on_hand,
        batch_location_sku = COALESCE(item_batch_locations.batch_location_sku, EXCLUDED.batch_location_sku),
        updated_by = EXCLUDED.updated_by,
        updated_at = v_now
      RETURNING * INTO v_item_loc_batch;

      UPDATE grn_boxes
      SET
        batch_location_sku = v_item_loc_batch.batch_location_sku
      WHERE grn_item_id = v_grn_item.id
        AND warehouse_location_id = v_line_location.location_id;
    END LOOP;

    v_remainder_qty := GREATEST(0, v_received_base_qty - COALESCE(v_boxes_total_qty, 0));
    IF v_remainder_qty > 0 THEN
      INSERT INTO item_batch_locations (
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
        p_company_id,
        v_grn_item.item_id,
        v_grn.warehouse_id,
        COALESCE(v_item_wh.default_location_id, v_default_location_id),
        v_item_batch.id,
        v_remainder_qty,
        0,
        p_user_id,
        p_user_id
      )
      ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE
      SET
        qty_on_hand = item_batch_locations.qty_on_hand + EXCLUDED.qty_on_hand,
        updated_by = EXCLUDED.updated_by,
        updated_at = v_now;
    END IF;

    INSERT INTO stock_transaction_items (
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
      v_unit_cost,
      ABS(v_received_base_qty) * v_unit_cost,
      v_item_wh_current_stock,
      v_item_wh_next_stock,
      v_unit_cost,
      v_item_wh_current_stock * v_unit_cost,
      v_item_wh_next_stock * v_unit_cost,
      v_posting_date,
      v_posting_time,
      CASE
        WHEN v_damaged_qty > 0 THEN 'GRN ' || v_grn.grn_number || ' (Damaged: ' || v_damaged_qty || ')'
        ELSE 'GRN ' || v_grn.grn_number
      END,
      p_user_id,
      p_user_id
    );
  END LOOP;

  IF NOT v_has_items THEN
    RAISE EXCEPTION 'GRN has no items';
  END IF;

  UPDATE grns
  SET
    status = 'approved',
    checked_by = p_user_id,
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = v_grn.id;

  IF v_grn.load_list_id IS NOT NULL THEN
    PERFORM public.recalculate_stock_requisition_fulfillment_for_load_list(
      p_company_id,
      v_grn.load_list_id
    );
  END IF;

  UPDATE load_lists
  SET
    status = 'received',
    updated_by = p_user_id,
    updated_at = v_now
  WHERE id = v_grn.load_list_id;

  RETURN v_tx_code;
END;
$function$;



DROP TRIGGER IF EXISTS trigger_item_location_batch_set_sku ON public.item_batch_locations;
DROP TRIGGER IF EXISTS trigger_item_batch_locations_set_sku ON public.item_batch_locations;
CREATE TRIGGER trigger_item_batch_locations_set_sku
  BEFORE INSERT ON public.item_batch_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_item_batch_location_sku();

DROP FUNCTION IF EXISTS public.set_item_location_batch_sku();
DROP FUNCTION IF EXISTS public.generate_item_location_batch_sku();

DROP TABLE IF EXISTS public.item_location;

COMMIT;
