BEGIN;

DO $$
DECLARE
  v_definition TEXT;
  v_updated_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.create_pick_list_with_allocation(UUID, UUID, UUID, UUID[], TEXT, UUID, TEXT)'::REGPROCEDURE
  )
  INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'create_pick_list_with_allocation function is missing';
  END IF;

  IF v_definition LIKE '%ELSIF v_mode IS NULL OR v_mode = ''split'' THEN%' THEN
    RETURN;
  END IF;

  IF v_definition NOT LIKE '%ELSIF v_mode = ''split'' THEN%' THEN
    RAISE EXCEPTION 'create_pick_list_with_allocation FIFO allocation branch was not found';
  END IF;

  v_updated_definition := replace(
    v_definition,
    'ELSIF v_mode = ''split'' THEN',
    'ELSIF v_mode IS NULL OR v_mode = ''split'' THEN'
  );

  EXECUTE v_updated_definition;

  SELECT pg_get_functiondef(
    'public.create_pick_list_with_allocation(UUID, UUID, UUID, UUID[], TEXT, UUID, TEXT)'::REGPROCEDURE
  )
  INTO v_definition;

  IF v_definition NOT LIKE '%ELSIF v_mode IS NULL OR v_mode = ''split'' THEN%' THEN
    RAISE EXCEPTION 'Failed to restore null pick allocation FIFO behavior';
  END IF;
END $$;

COMMENT ON FUNCTION public.create_pick_list_with_allocation(
  UUID,
  UUID,
  UUID,
  UUID[],
  TEXT,
  UUID,
  TEXT
) IS
  'Creates a pick list transactionally. A selected stock-request batch is authoritative; otherwise null allocation mode uses whole-unit FIFO allocation.';

DROP FUNCTION IF EXISTS public.get_delivery_note_allocation_availability(UUID, UUID[]);
DROP FUNCTION IF EXISTS public.create_delivery_note_transactionally(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB
);
DROP FUNCTION IF EXISTS public.get_delivery_note_allocation_availability(
  UUID, UUID, UUID, UUID[]
);

CREATE OR REPLACE FUNCTION public.get_delivery_note_allocation_availability(
  p_company_id UUID,
  p_user_id UUID,
  p_business_unit_id UUID,
  p_sr_item_ids UUID[]
)
RETURNS TABLE (
  sr_item_id UUID,
  available_qty NUMERIC,
  available_base_qty NUMERIC,
  qty_per_unit NUMERIC,
  selected_item_batch_id UUID,
  base_unit_label TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.users users
    WHERE users.id = p_user_id
      AND users.company_id = p_company_id
      AND users.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_UNAUTHORIZED';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.user_has_permission(
    p_user_id,
    'stock_requests',
    'edit',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_UNAUTHORIZED';
  END IF;

  SELECT COUNT(*)
  INTO v_found_count
  FROM public.stock_request_items sri
  JOIN public.stock_requests sr
    ON sr.id = sri.stock_request_id
   AND sr.company_id = p_company_id
   AND sr.deleted_at IS NULL
  JOIN public.warehouses fulfilling_warehouse
    ON fulfilling_warehouse.id = sr.fulfilling_warehouse_id
   AND fulfilling_warehouse.company_id = p_company_id
   AND fulfilling_warehouse.business_unit_id = p_business_unit_id
   AND fulfilling_warehouse.deleted_at IS NULL
  WHERE sri.id = ANY(p_sr_item_ids);

  IF v_found_count <> v_requested_count THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_INVALID_STOCK_REQUEST_ITEM';
  END IF;

  RETURN QUERY
  WITH line_context AS (
    SELECT
      sri.id AS sr_item_id,
      sri.item_id,
      sr.fulfilling_warehouse_id AS warehouse_id,
      sri.selected_item_batch_id,
      GREATEST(COALESCE(iuo.qty_per_unit, 1), 1)::NUMERIC AS qty_per_unit,
      GREATEST(COALESCE(iw.available_stock, 0), 0)::NUMERIC AS warehouse_available_base,
      COALESCE(base_uom.symbol, base_uom.code, base_uom.name, '')::TEXT AS base_unit_label
    FROM public.stock_request_items sri
    JOIN public.stock_requests sr
      ON sr.id = sri.stock_request_id
     AND sr.company_id = p_company_id
     AND sr.deleted_at IS NULL
    LEFT JOIN public.item_unit_options iuo
      ON iuo.id = sri.item_unit_option_id
     AND iuo.company_id = p_company_id
     AND iuo.deleted_at IS NULL
    LEFT JOIN public.item_warehouse iw
      ON iw.company_id = p_company_id
     AND iw.item_id = sri.item_id
     AND iw.warehouse_id = sr.fulfilling_warehouse_id
     AND iw.deleted_at IS NULL
    JOIN public.items base_item
      ON base_item.id = sri.item_id
     AND base_item.company_id = p_company_id
     AND base_item.deleted_at IS NULL
    LEFT JOIN public.units_of_measure base_uom
      ON base_uom.id = base_item.uom_id
    WHERE sri.id = ANY(p_sr_item_ids)
  )
  SELECT
    line_context.sr_item_id,
    LEAST(
      FLOOR(line_context.warehouse_available_base / line_context.qty_per_unit),
      source_capacity.available_qty
    )::NUMERIC AS available_qty,
    LEAST(
      line_context.warehouse_available_base,
      source_capacity.available_base_qty
    )::NUMERIC AS available_base_qty,
    line_context.qty_per_unit,
    line_context.selected_item_batch_id,
    line_context.base_unit_label
  FROM line_context
  CROSS JOIN LATERAL (
    WITH raw_sources AS (
      SELECT
        ilb.id AS batch_location_id,
        ilb.item_batch_id,
        ib.received_at,
        ilb.created_at,
        GREATEST(
          COALESCE(ilb.qty_on_hand, 0) - COALESCE(ilb.qty_reserved, 0),
          0
        )::NUMERIC AS location_available_base,
        GREATEST(
          COALESCE(ib.qty_on_hand, 0) - COALESCE(ib.qty_reserved, 0),
          0
        )::NUMERIC AS batch_available_base
      FROM public.item_batch_locations ilb
      JOIN public.item_batches ib
        ON ib.id = ilb.item_batch_id
       AND ib.company_id = ilb.company_id
       AND ib.deleted_at IS NULL
      WHERE ilb.company_id = p_company_id
        AND ilb.item_id = line_context.item_id
        AND ilb.warehouse_id = line_context.warehouse_id
        AND ilb.deleted_at IS NULL
        AND (
          line_context.selected_item_batch_id IS NULL
          OR ib.id = line_context.selected_item_batch_id
        )
    ),
    capped_sources AS (
      SELECT
        raw_sources.*,
        GREATEST(
          LEAST(
            raw_sources.location_available_base,
            raw_sources.batch_available_base - COALESCE(
              SUM(raw_sources.location_available_base) OVER (
                PARTITION BY raw_sources.item_batch_id
                ORDER BY raw_sources.received_at ASC, raw_sources.created_at ASC, raw_sources.batch_location_id ASC
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
      COALESCE(
        SUM(FLOOR(capped_sources.source_available_base / line_context.qty_per_unit)),
        0
      )::NUMERIC AS available_qty,
      COALESCE(SUM(capped_sources.source_available_base), 0)::NUMERIC AS available_base_qty
    FROM capped_sources
  ) source_capacity
  ORDER BY line_context.sr_item_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_delivery_note_transactionally(
  p_company_id UUID,
  p_user_id UUID,
  p_business_unit_id UUID,
  p_requesting_warehouse_id UUID,
  p_fulfilling_warehouse_id UUID,
  p_fulfillment_mode TEXT,
  p_notes TEXT,
  p_driver_name TEXT,
  p_lines JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_line_count INTEGER;
  v_distinct_line_count INTEGER;
  v_input RECORD;
  v_line RECORD;
  v_item_warehouse public.item_warehouse%ROWTYPE;
  v_existing_allocated_qty NUMERIC;
  v_max_allocatable_qty NUMERIC;
  v_available_qty NUMERIC;
  v_allocated_base_qty NUMERIC;
  v_dn_id UUID;
  v_dn_no TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_UNAUTHORIZED';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users users
    WHERE users.id = p_user_id
      AND users.company_id = p_company_id
      AND users.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_UNAUTHORIZED';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.user_has_permission(
    p_user_id,
    'stock_requests',
    'edit',
    p_business_unit_id
  ) THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_UNAUTHORIZED';
  END IF;

  IF p_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_BUSINESS_UNIT_REQUIRED';
  END IF;

  IF p_requesting_warehouse_id IS NULL
     OR p_fulfilling_warehouse_id IS NULL
     OR p_requesting_warehouse_id = p_fulfilling_warehouse_id THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_INVALID_WAREHOUSE_MAPPING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.warehouses fulfilling_warehouse
    WHERE fulfilling_warehouse.id = p_fulfilling_warehouse_id
      AND fulfilling_warehouse.company_id = p_company_id
      AND fulfilling_warehouse.business_unit_id = p_business_unit_id
      AND fulfilling_warehouse.deleted_at IS NULL
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.warehouses requesting_warehouse
    WHERE requesting_warehouse.id = p_requesting_warehouse_id
      AND requesting_warehouse.company_id = p_company_id
      AND requesting_warehouse.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'DELIVERY_NOTE_INVALID_WAREHOUSE_MAPPING';
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

  INSERT INTO public.delivery_notes (
    company_id,
    business_unit_id,
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
    'draft',
    p_requesting_warehouse_id,
    p_fulfilling_warehouse_id,
    p_fulfillment_mode,
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    NULLIF(BTRIM(COALESCE(p_driver_name, '')), ''),
    p_user_id,
    p_user_id,
    v_now,
    v_now
  )
  RETURNING id, dn_no INTO v_dn_id, v_dn_no;

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
      sri.id AS sr_item_id,
      sri.stock_request_id AS sr_id,
      sri.item_id,
      sri.item_unit_option_id,
      sri.uom_id,
      sri.requested_qty,
      COALESCE(sri.dispatch_qty, 0) AS dispatch_qty,
      sri.selected_item_batch_id,
      sr.status::TEXT AS request_status,
      sr.requesting_warehouse_id,
      sr.fulfilling_warehouse_id,
      GREATEST(COALESCE(iuo.qty_per_unit, 1), 1)::NUMERIC AS qty_per_unit
    INTO v_line
    FROM public.stock_request_items sri
    JOIN public.stock_requests sr
      ON sr.id = sri.stock_request_id
     AND sr.company_id = p_company_id
     AND sr.deleted_at IS NULL
    LEFT JOIN public.item_unit_options iuo
      ON iuo.id = sri.item_unit_option_id
     AND iuo.company_id = p_company_id
     AND iuo.deleted_at IS NULL
    WHERE sri.id = v_input.sr_item_id
    FOR UPDATE OF sri, sr;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_INVALID_STOCK_REQUEST_ITEM';
    END IF;

    IF v_line.requesting_warehouse_id <> p_requesting_warehouse_id
       OR v_line.fulfilling_warehouse_id <> p_fulfilling_warehouse_id THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_INVALID_WAREHOUSE_MAPPING';
    END IF;

    IF v_line.request_status IN ('draft', 'cancelled', 'completed', 'fulfilled') THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_INELIGIBLE_STOCK_REQUEST';
    END IF;

    PERFORM dni.id
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn
      ON dn.id = dni.dn_id
     AND dn.company_id = p_company_id
    WHERE dni.company_id = p_company_id
      AND dni.sr_item_id = v_line.sr_item_id
      AND dni.is_voided = FALSE
      AND dn.status NOT IN ('voided', 'dispatched', 'received')
    ORDER BY dni.id
    FOR UPDATE OF dni, dn;

    SELECT COALESCE(SUM(dni.allocated_qty), 0)
    INTO v_existing_allocated_qty
    FROM public.delivery_note_items dni
    JOIN public.delivery_notes dn
      ON dn.id = dni.dn_id
     AND dn.company_id = p_company_id
    WHERE dni.company_id = p_company_id
      AND dni.sr_item_id = v_line.sr_item_id
      AND dni.is_voided = FALSE
      AND dn.status NOT IN ('voided', 'dispatched', 'received');

    v_max_allocatable_qty := GREATEST(
      COALESCE(v_line.requested_qty, 0)
        - COALESCE(v_line.dispatch_qty, 0)
        - v_existing_allocated_qty,
      0
    );

    IF v_input.allocated_qty > v_max_allocatable_qty THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_REQUEST_QUANTITY_EXCEEDED';
    END IF;

    SELECT *
    INTO v_item_warehouse
    FROM public.item_warehouse iw
    WHERE iw.company_id = p_company_id
      AND iw.item_id = v_line.item_id
      AND iw.warehouse_id = p_fulfilling_warehouse_id
      AND iw.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_INSUFFICIENT_INVENTORY';
    END IF;

    PERFORM ib.id
    FROM public.item_batches ib
    WHERE ib.company_id = p_company_id
      AND ib.item_id = v_line.item_id
      AND ib.warehouse_id = p_fulfilling_warehouse_id
      AND ib.deleted_at IS NULL
    ORDER BY ib.id
    FOR UPDATE;

    PERFORM ilb.id
    FROM public.item_batch_locations ilb
    WHERE ilb.company_id = p_company_id
      AND ilb.item_id = v_line.item_id
      AND ilb.warehouse_id = p_fulfilling_warehouse_id
      AND ilb.deleted_at IS NULL
    ORDER BY ilb.id
    FOR UPDATE;

    SELECT availability.available_qty
    INTO v_available_qty
    FROM public.get_delivery_note_allocation_availability(
      p_company_id,
      p_user_id,
      p_business_unit_id,
      ARRAY[v_line.sr_item_id]
    ) availability;

    IF COALESCE(v_available_qty, 0) < v_input.allocated_qty THEN
      RAISE EXCEPTION 'DELIVERY_NOTE_INSUFFICIENT_INVENTORY';
    END IF;

    v_allocated_base_qty := v_input.allocated_qty * v_line.qty_per_unit;

    UPDATE public.item_warehouse
    SET reserved_stock = COALESCE(reserved_stock, 0) + v_allocated_base_qty,
        updated_by = p_user_id,
        updated_at = v_now
    WHERE id = v_item_warehouse.id;

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
      p_requesting_warehouse_id,
      p_fulfilling_warehouse_id,
      v_input.allocated_qty,
      0,
      v_input.allocated_qty,
      0,
      v_now,
      v_now
    );
  END LOOP;

  RETURN jsonb_build_object('deliveryNoteId', v_dn_id, 'deliveryNoteNo', v_dn_no);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_delivery_note_allocation_availability(UUID, UUID, UUID, UUID[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_note_allocation_availability(UUID, UUID, UUID, UUID[])
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_delivery_note_transactionally(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_delivery_note_transactionally(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB
) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_delivery_note_allocation_availability(UUID, UUID, UUID, UUID[]) IS
  'Returns bounded stock-request-line availability in complete requested units, using a selected batch when present or whole-unit FIFO sources otherwise.';

COMMENT ON FUNCTION public.create_delivery_note_transactionally(
  UUID, UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, JSONB
) IS
  'Creates and reserves a delivery note atomically after locking and validating stock-request lines and whole-unit FIFO inventory availability.';

COMMIT;
