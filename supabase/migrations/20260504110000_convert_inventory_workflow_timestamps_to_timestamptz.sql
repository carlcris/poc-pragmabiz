-- Convert Inventory workflow operational timestamps to TIMESTAMPTZ.
-- Existing timestamp values are interpreted as UTC instants.

DROP VIEW IF EXISTS public.v_inventory_recon_item_batch_vs_location_batch;
DROP VIEW IF EXISTS public.v_inventory_recon_item_location_vs_location_batch;
DROP VIEW IF EXISTS public.v_inventory_recon_item_warehouse_vs_batch;
DROP VIEW IF EXISTS public.v_inventory_recon_item_warehouse_vs_location;

DO $$
DECLARE
  v_table_name TEXT;
  v_columns TEXT[];
  v_alter_clauses TEXT;
BEGIN
  FOR v_table_name, v_columns IN
    SELECT *
    FROM (
      VALUES
        ('item_categories', ARRAY['created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('items', ARRAY['created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('item_prices', ARRAY['created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('item_unit_options', ARRAY['created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('warehouses', ARRAY['created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('warehouse_locations', ARRAY['created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('item_warehouse', ARRAY['created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('item_location', ARRAY['created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('item_batch', ARRAY['received_at', 'created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('item_location_batch', ARRAY['created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('stock_transactions', ARRAY['created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('stock_transaction_items', ARRAY['created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('stock_adjustments', ARRAY['approved_at', 'posted_at', 'created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('stock_adjustment_items', ARRAY['created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('stock_transfers', ARRAY['requested_at', 'confirmed_at', 'created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('stock_transfer_items', ARRAY['created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('stock_requests', ARRAY[
          'approved_at',
          'picking_started_at',
          'picked_at',
          'delivered_at',
          'received_at',
          'created_at',
          'updated_at',
          'deleted_at'
        ]::TEXT[]),
        ('stock_request_items', ARRAY['created_at', 'updated_at']::TEXT[]),
        ('inventory_reservations', ARRAY[
          'reserved_at',
          'consumed_at',
          'released_at',
          'created_at',
          'updated_at',
          'deleted_at'
        ]::TEXT[]),
        ('delivery_notes', ARRAY[
          'confirmed_at',
          'picking_started_at',
          'picking_completed_at',
          'dispatched_at',
          'received_at',
          'voided_at',
          'created_at',
          'updated_at',
          'deleted_at'
        ]::TEXT[]),
        ('delivery_note_sources', ARRAY['created_at']::TEXT[]),
        ('delivery_note_items', ARRAY[
          'suggested_pick_batch_received_at',
          'last_pick_source_override_at',
          'voided_at',
          'created_at',
          'updated_at'
        ]::TEXT[]),
        ('delivery_note_item_picks', ARRAY[
          'picked_batch_received_at',
          'picked_at',
          'created_at',
          'updated_at',
          'deleted_at'
        ]::TEXT[]),
        ('delivery_note_item_adjustments', ARRAY['created_at']::TEXT[]),
        ('pick_lists', ARRAY['started_at', 'completed_at', 'created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('pick_list_items', ARRAY['created_at', 'updated_at']::TEXT[]),
        ('pick_list_assignees', ARRAY['assigned_at']::TEXT[]),
        ('transformation_templates', ARRAY['created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('transformation_template_inputs', ARRAY['created_at', 'updated_at']::TEXT[]),
        ('transformation_template_outputs', ARRAY['created_at', 'updated_at']::TEXT[]),
        ('transformation_orders', ARRAY['created_at', 'updated_at', 'deleted_at']::TEXT[]),
        ('transformation_order_inputs', ARRAY['created_at', 'updated_at']::TEXT[]),
        ('transformation_order_outputs', ARRAY['created_at', 'updated_at']::TEXT[])
    ) AS target_columns(table_name, columns)
  LOOP
    SELECT string_agg(
      format('ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC''', c.column_name, c.column_name),
      ', '
      ORDER BY array_position(v_columns, c.column_name)
    )
    INTO v_alter_clauses
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = v_table_name
      AND c.column_name = ANY(v_columns)
      AND c.data_type = 'timestamp without time zone';

    IF v_alter_clauses IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I %s', v_table_name, v_alter_clauses);
    END IF;
  END LOOP;
END
$$;

CREATE OR REPLACE VIEW public.v_inventory_recon_item_warehouse_vs_location AS
SELECT
  iw.company_id,
  iw.item_id,
  iw.warehouse_id,
  COALESCE(iw.current_stock, 0)::NUMERIC(20, 4) AS warehouse_qty_on_hand,
  COALESCE(SUM(il.qty_on_hand), 0)::NUMERIC(20, 4) AS location_qty_on_hand_sum,
  (COALESCE(iw.current_stock, 0) - COALESCE(SUM(il.qty_on_hand), 0))::NUMERIC(20, 4) AS qty_diff
FROM public.item_warehouse iw
LEFT JOIN public.item_location il
  ON il.company_id = iw.company_id
 AND il.item_id = iw.item_id
 AND il.warehouse_id = iw.warehouse_id
 AND il.deleted_at IS NULL
WHERE iw.deleted_at IS NULL
GROUP BY iw.company_id, iw.item_id, iw.warehouse_id, iw.current_stock;

CREATE OR REPLACE VIEW public.v_inventory_recon_item_warehouse_vs_batch AS
SELECT
  iw.company_id,
  iw.item_id,
  iw.warehouse_id,
  COALESCE(iw.current_stock, 0)::NUMERIC(20, 4) AS warehouse_qty_on_hand,
  COALESCE(SUM(ib.qty_on_hand), 0)::NUMERIC(20, 4) AS batch_qty_on_hand_sum,
  (COALESCE(iw.current_stock, 0) - COALESCE(SUM(ib.qty_on_hand), 0))::NUMERIC(20, 4) AS qty_diff
FROM public.item_warehouse iw
LEFT JOIN public.item_batch ib
  ON ib.company_id = iw.company_id
 AND ib.item_id = iw.item_id
 AND ib.warehouse_id = iw.warehouse_id
 AND ib.deleted_at IS NULL
WHERE iw.deleted_at IS NULL
GROUP BY iw.company_id, iw.item_id, iw.warehouse_id, iw.current_stock;

CREATE OR REPLACE VIEW public.v_inventory_recon_item_location_vs_location_batch AS
SELECT
  il.company_id,
  il.item_id,
  il.warehouse_id,
  il.location_id,
  COALESCE(il.qty_on_hand, 0)::NUMERIC(20, 4) AS location_qty_on_hand,
  COALESCE(SUM(ilb.qty_on_hand), 0)::NUMERIC(20, 4) AS location_batch_qty_on_hand_sum,
  (COALESCE(il.qty_on_hand, 0) - COALESCE(SUM(ilb.qty_on_hand), 0))::NUMERIC(20, 4) AS qty_diff
FROM public.item_location il
LEFT JOIN public.item_location_batch ilb
  ON ilb.company_id = il.company_id
 AND ilb.item_id = il.item_id
 AND ilb.warehouse_id = il.warehouse_id
 AND ilb.location_id = il.location_id
 AND ilb.deleted_at IS NULL
WHERE il.deleted_at IS NULL
GROUP BY il.company_id, il.item_id, il.warehouse_id, il.location_id, il.qty_on_hand;

CREATE OR REPLACE VIEW public.v_inventory_recon_item_batch_vs_location_batch AS
SELECT
  ib.company_id,
  ib.id AS item_batch_id,
  ib.item_id,
  ib.warehouse_id,
  ib.batch_code,
  ib.received_at,
  COALESCE(ib.qty_on_hand, 0)::NUMERIC(20, 4) AS batch_qty_on_hand,
  COALESCE(SUM(ilb.qty_on_hand), 0)::NUMERIC(20, 4) AS location_batch_qty_on_hand_sum,
  (COALESCE(ib.qty_on_hand, 0) - COALESCE(SUM(ilb.qty_on_hand), 0))::NUMERIC(20, 4) AS qty_diff
FROM public.item_batch ib
LEFT JOIN public.item_location_batch ilb
  ON ilb.company_id = ib.company_id
 AND ilb.item_batch_id = ib.id
 AND ilb.deleted_at IS NULL
WHERE ib.deleted_at IS NULL
GROUP BY ib.company_id, ib.id, ib.item_id, ib.warehouse_id, ib.batch_code, ib.received_at, ib.qty_on_hand;

DO $$
DECLARE
  v_definition TEXT;
BEGIN
  SELECT pg_get_functiondef('public.approve_grn_with_batch_inventory(uuid, uuid, uuid, text)'::REGPROCEDURE)
  INTO v_definition;
  v_definition := replace(v_definition, 'v_now TIMESTAMP := NOW();', 'v_now TIMESTAMPTZ := NOW();');
  v_definition := replace(v_definition, 'v_batch_received_at TIMESTAMP;', 'v_batch_received_at TIMESTAMPTZ;');
  v_definition := replace(
    v_definition,
    'v_batch_received_at := v_posting_date::TIMESTAMP + v_posting_time;',
    'v_batch_received_at := (v_posting_date::TIMESTAMP + v_posting_time) AT TIME ZONE ''UTC'';'
  );
  EXECUTE v_definition;

  SELECT pg_get_functiondef('public.post_delivery_note_dispatch(uuid, uuid, uuid, uuid, date, text, text, text, jsonb)'::REGPROCEDURE)
  INTO v_definition;
  v_definition := replace(v_definition, 'v_now TIMESTAMP;', 'v_now TIMESTAMPTZ;');
  EXECUTE v_definition;

  SELECT pg_get_functiondef('public.post_delivery_note_receive(uuid, uuid, uuid, uuid, date, text, jsonb)'::REGPROCEDURE)
  INTO v_definition;
  v_definition := replace(v_definition, 'v_now TIMESTAMP;', 'v_now TIMESTAMPTZ;');
  EXECUTE v_definition;

  SELECT pg_get_functiondef('public.complete_delivery_note_direct_customer_pickup(uuid, uuid, uuid, date, text, jsonb)'::REGPROCEDURE)
  INTO v_definition;
  v_definition := replace(v_definition, 'v_now TIMESTAMP;', 'v_now TIMESTAMPTZ;');
  v_definition := replace(
    v_definition,
    'received_at = COALESCE(p_received_date::timestamp, v_now),',
    'received_at = COALESCE((p_received_date::TIMESTAMP AT TIME ZONE ''UTC''), v_now),'
  );
  EXECUTE v_definition;

  SELECT pg_get_functiondef('public.reserve_delivery_note_inventory(uuid, uuid, uuid)'::REGPROCEDURE)
  INTO v_definition;
  v_definition := replace(v_definition, 'v_suggested_pick_batch_received_at TIMESTAMP;', 'v_suggested_pick_batch_received_at TIMESTAMPTZ;');
  EXECUTE v_definition;

  SELECT pg_get_functiondef('public.reserve_delivery_note_inventory_lines(uuid, uuid, uuid, uuid[])'::REGPROCEDURE)
  INTO v_definition;
  v_definition := replace(v_definition, 'v_suggested_pick_batch_received_at TIMESTAMP;', 'v_suggested_pick_batch_received_at TIMESTAMPTZ;');
  EXECUTE v_definition;

  SELECT pg_get_functiondef('public.validate_delivery_note_item_unit_option()'::REGPROCEDURE)
  INTO v_definition;
  v_definition := replace(v_definition, 'v_option_deleted_at TIMESTAMP;', 'v_option_deleted_at TIMESTAMPTZ;');
  EXECUTE v_definition;

  SELECT pg_get_functiondef('public.validate_pick_list_item_unit_option()'::REGPROCEDURE)
  INTO v_definition;
  v_definition := replace(v_definition, 'v_option_deleted_at TIMESTAMP;', 'v_option_deleted_at TIMESTAMPTZ;');
  EXECUTE v_definition;

  SELECT pg_get_functiondef('public.validate_stock_request_item_unit_option()'::REGPROCEDURE)
  INTO v_definition;
  v_definition := replace(v_definition, 'v_option_deleted_at TIMESTAMP;', 'v_option_deleted_at TIMESTAMPTZ;');
  EXECUTE v_definition;
END
$$;
