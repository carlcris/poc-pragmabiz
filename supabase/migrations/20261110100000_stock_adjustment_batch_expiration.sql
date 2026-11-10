BEGIN;
ALTER TABLE public.item_batches ADD COLUMN expiration_date DATE;
COMMENT ON COLUMN public.item_batches.expiration_date IS
  'Optional manually entered batch expiration date. No automatic origin-based calculation.';

CREATE OR REPLACE FUNCTION public.create_draft_stock_adjustment(p_company_id uuid, p_business_unit_id uuid, p_user_id uuid, p_adjustment_id uuid DEFAULT NULL::uuid, p_adjustment_type text DEFAULT NULL::text, p_adjustment_date date DEFAULT NULL::date, p_warehouse_id uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_location_id_provided boolean DEFAULT false, p_reason text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_notes_provided boolean DEFAULT false, p_items jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(adjustment_id uuid, adjustment_code text, status text)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_adjustment RECORD;
  v_received_date DATE;
  v_expiration_date DATE;
  v_existing_received_at public.item_batches.received_at%TYPE;
  v_source_received_at public.item_batches.received_at%TYPE;
  v_is_create BOOLEAN := p_adjustment_id IS NULL;
  v_custom_fields JSONB := '{}'::JSONB;
  v_warehouse_id UUID;
  v_location_id UUID;
  v_total_value NUMERIC := 0;
  v_row JSONB;
  v_item_id UUID;
  v_uom_id UUID;
  v_batch_code TEXT;
  v_item_batch_id UUID;
  v_batch_location_id UUID;
  v_existing_batch_location_id UUID;
  v_selected_item_batch_id UUID;
  v_item_code TEXT;
  v_item_name TEXT;
  v_uom_name TEXT;
  v_current_qty NUMERIC;
  v_adjusted_qty NUMERIC;
  v_difference NUMERIC;
  v_unit_cost NUMERIC;
  v_total_cost NUMERIC;
  v_entered_qty NUMERIC;
  v_entered_unit_option_id UUID;
  v_entered_unit_label TEXT;
  v_entered_qty_per_unit NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'User context mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = p_user_id
      AND u.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'User is not valid for the company';
  END IF;

  IF p_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_business_unit_access uba
    JOIN public.business_units bu
      ON bu.id = uba.business_unit_id
    WHERE uba.user_id = p_user_id
      AND uba.business_unit_id = p_business_unit_id
      AND bu.company_id = p_company_id
      AND bu.is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'User does not have access to the business unit';
  END IF;

  IF v_is_create THEN
    IF p_warehouse_id IS NULL
       OR NULLIF(BTRIM(COALESCE(p_adjustment_type, '')), '') IS NULL
       OR p_adjustment_date IS NULL
       OR NULLIF(BTRIM(COALESCE(p_reason, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Missing required stock adjustment fields';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'At least one item is required';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.warehouses w
      WHERE w.id = p_warehouse_id
        AND w.company_id = p_company_id
        AND w.business_unit_id = p_business_unit_id
        AND w.is_active IS TRUE
        AND w.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Selected warehouse is not valid for the current business unit';
    END IF;

    v_warehouse_id := p_warehouse_id;

    INSERT INTO public.stock_adjustments (
      company_id,
      business_unit_id,
      adjustment_type,
      adjustment_date,
      warehouse_id,
      status,
      reason,
      notes,
      total_value,
      custom_fields,
      created_by,
      updated_by
    )
    VALUES (
      p_company_id,
      p_business_unit_id,
      p_adjustment_type,
      p_adjustment_date,
      v_warehouse_id,
      'draft',
      p_reason,
      NULLIF(p_notes, ''),
      0,
      CASE WHEN p_location_id IS NULL THEN NULL ELSE jsonb_build_object('locationId', p_location_id) END,
      p_user_id,
      p_user_id
    )
    RETURNING stock_adjustments.id, stock_adjustments.adjustment_code, stock_adjustments.status, stock_adjustments.business_unit_id, stock_adjustments.warehouse_id, stock_adjustments.custom_fields, stock_adjustments.total_value INTO v_adjustment;
  ELSE
    SELECT sa.id, sa.adjustment_code, sa.status, sa.business_unit_id, sa.warehouse_id, sa.custom_fields, sa.total_value
    INTO v_adjustment
    FROM public.stock_adjustments sa
    WHERE sa.id = p_adjustment_id
      AND sa.company_id = p_company_id
      AND sa.deleted_at IS NULL
    FOR UPDATE;

    IF v_adjustment.id IS NULL THEN
      RAISE EXCEPTION 'Stock adjustment not found';
    END IF;

    IF v_adjustment.status <> 'draft' THEN
      RAISE EXCEPTION 'Only draft adjustments can be updated';
    END IF;

    IF p_business_unit_id IS NULL OR v_adjustment.business_unit_id <> p_business_unit_id THEN
      RAISE EXCEPTION 'Stock adjustment is not valid for the current business unit';
    END IF;

    v_warehouse_id := COALESCE(p_warehouse_id, v_adjustment.warehouse_id);

    IF NOT EXISTS (
      SELECT 1
      FROM public.warehouses w
      WHERE w.id = v_warehouse_id
        AND w.company_id = p_company_id
        AND w.business_unit_id = p_business_unit_id
        AND w.is_active IS TRUE
        AND w.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Selected warehouse is not valid for the current business unit';
    END IF;
  END IF;

  v_custom_fields := COALESCE(v_adjustment.custom_fields, '{}'::JSONB);

  IF v_is_create THEN
    v_location_id := p_location_id;
  ELSIF p_location_id_provided THEN
    v_custom_fields := jsonb_set(
      v_custom_fields,
      '{locationId}',
      CASE WHEN p_location_id IS NULL THEN 'null'::JSONB ELSE to_jsonb(p_location_id) END,
      TRUE
    );
    v_location_id := p_location_id;
  ELSE
    v_location_id := NULLIF(v_custom_fields->>'locationId', '')::UUID;
  END IF;

  IF p_items IS NOT NULL THEN
    IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'At least one item is required';
    END IF;

    IF NOT v_is_create THEN
      DELETE FROM public.stock_adjustment_items sai
      WHERE sai.adjustment_id = v_adjustment.id
        AND sai.company_id = p_company_id;
    END IF;

    FOR v_row IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
      v_item_id := NULLIF(v_row->>'itemId', '')::UUID;
      v_uom_id := NULLIF(v_row->>'uomId', '')::UUID;
      v_selected_item_batch_id := NULLIF(v_row->>'itemBatchId', '')::UUID;
      v_existing_batch_location_id := NULLIF(v_row->>'itemBatchLocationId', '')::UUID;
      v_current_qty := COALESCE(NULLIF(v_row->>'currentQty', '')::NUMERIC, 0);
      v_adjusted_qty := NULLIF(v_row->>'adjustedQty', '')::NUMERIC;
      v_unit_cost := COALESCE(NULLIF(v_row->>'unitCost', '')::NUMERIC, 0);
      v_expiration_date := NULL;
      IF v_row ? 'batchExpirationDate' THEN
        IF v_selected_item_batch_id IS NOT NULL OR v_existing_batch_location_id IS NOT NULL THEN
          RAISE EXCEPTION USING ERRCODE = 'SA005', MESSAGE = 'Expiration date is only accepted for new batches';
        END IF;
        IF v_row->>'batchExpirationDate' IS NOT NULL THEN
          BEGIN
            IF v_row->>'batchExpirationDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
              RAISE EXCEPTION USING ERRCODE = 'SA005', MESSAGE = 'Invalid batch expiration date';
            END IF;
            v_expiration_date := (v_row->>'batchExpirationDate')::DATE;
          EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
            RAISE EXCEPTION USING ERRCODE = 'SA005', MESSAGE = 'Invalid batch expiration date';
          END;
        END IF;
      END IF;


      IF v_item_id IS NULL OR v_uom_id IS NULL OR v_adjusted_qty IS NULL THEN
        RAISE EXCEPTION 'Invalid stock adjustment item';
      END IF;

      SELECT i.item_code, i.item_name
      INTO v_item_code, v_item_name
      FROM public.items i
      WHERE i.id = v_item_id
        AND i.company_id = p_company_id
        AND i.deleted_at IS NULL;

      IF v_item_code IS NULL THEN
        RAISE EXCEPTION 'Stock adjustment item does not exist';
      END IF;

      SELECT uom.code
      INTO v_uom_name
      FROM public.units_of_measure uom
      WHERE uom.id = v_uom_id;

      IF v_uom_name IS NULL THEN
        RAISE EXCEPTION 'Stock adjustment unit of measure does not exist';
      END IF;

      IF v_existing_batch_location_id IS NOT NULL THEN
        SELECT ilb.id
        INTO v_batch_location_id
        FROM public.item_batch_locations ilb
        WHERE ilb.id = v_existing_batch_location_id
          AND ilb.company_id = p_company_id
          AND ilb.item_id = v_item_id
          AND ilb.warehouse_id = v_warehouse_id
          AND (v_location_id IS NULL OR ilb.location_id = v_location_id)
          AND ilb.deleted_at IS NULL
          AND (v_selected_item_batch_id IS NULL OR ilb.item_batch_id = v_selected_item_batch_id)
        FOR UPDATE;

        IF v_batch_location_id IS NULL THEN
          RAISE EXCEPTION 'Selected batch location is not valid for the adjustment';
        END IF;
        IF EXISTS (
          SELECT 1 FROM public.item_batch_locations bl
          JOIN public.item_batches b ON b.id=bl.item_batch_id
          JOIN public.item_batches other ON other.company_id=b.company_id AND other.warehouse_id=b.warehouse_id
            AND other.batch_code=b.batch_code AND other.deleted_at IS NULL
          WHERE bl.id=v_batch_location_id AND other.received_at IS DISTINCT FROM b.received_at
        ) THEN
          RAISE EXCEPTION USING ERRCODE = 'SA002', MESSAGE = 'Batch received date conflict';
        END IF;
      ELSE
        IF v_location_id IS NULL THEN
          RAISE EXCEPTION 'Location is required for a new batch';
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM public.warehouse_locations wl
          WHERE wl.id = v_location_id
            AND wl.company_id = p_company_id
            AND wl.warehouse_id = v_warehouse_id
            AND wl.is_active IS TRUE
            AND wl.deleted_at IS NULL
        ) THEN
          RAISE EXCEPTION 'Selected location is not valid for the warehouse';
        END IF;

        IF v_selected_item_batch_id IS NOT NULL THEN
          SELECT ib.batch_code, ib.received_at
          INTO v_batch_code, v_source_received_at
          FROM public.item_batches ib
          WHERE ib.id = v_selected_item_batch_id
            AND ib.company_id = p_company_id
            AND ib.warehouse_id = v_warehouse_id
            AND ib.deleted_at IS NULL;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Selected batch location is not valid for the adjustment';
          END IF;
          -- Serialize creation/reuse by warehouse batch code without changing the table model.
          PERFORM pg_advisory_xact_lock(hashtextextended(p_company_id::TEXT || ':' || v_warehouse_id::TEXT || ':' || v_batch_code, 0));
          PERFORM ib.id FROM public.item_batches ib
          WHERE ib.company_id = p_company_id AND ib.warehouse_id = v_warehouse_id
            AND ib.batch_code = v_batch_code AND ib.deleted_at IS NULL
          ORDER BY ib.id FOR UPDATE;
          IF EXISTS (
            SELECT 1 FROM public.item_batches ib
            WHERE ib.company_id = p_company_id AND ib.warehouse_id = v_warehouse_id
              AND ib.batch_code = v_batch_code AND ib.deleted_at IS NULL
              AND ib.received_at IS DISTINCT FROM v_source_received_at
          ) THEN
            RAISE EXCEPTION USING ERRCODE = 'SA002', MESSAGE = 'Batch received date conflict';
          END IF;
          INSERT INTO public.item_batches (
            company_id,item_id,warehouse_id,batch_code,received_at,qty_on_hand,qty_reserved,created_by,updated_by
          ) VALUES (
            p_company_id,v_item_id,v_warehouse_id,v_batch_code,v_source_received_at,0,0,p_user_id,p_user_id
          ) ON CONFLICT (company_id,item_id,warehouse_id,batch_code) DO NOTHING;
          SELECT ib.id, ib.received_at INTO v_item_batch_id, v_existing_received_at
          FROM public.item_batches ib
          WHERE ib.company_id = p_company_id AND ib.item_id = v_item_id
            AND ib.warehouse_id = v_warehouse_id AND ib.batch_code = v_batch_code
            AND ib.deleted_at IS NULL FOR UPDATE;
          IF v_item_batch_id IS NULL THEN
            RAISE EXCEPTION 'Selected batch location is not valid for the adjustment';
          END IF;
          IF v_existing_received_at IS DISTINCT FROM v_source_received_at THEN
            RAISE EXCEPTION USING ERRCODE = 'SA002', MESSAGE = 'Batch received date conflict';
          END IF;
        ELSE
        BEGIN
          IF COALESCE(v_row->>'batchReceivedDate', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
            RAISE EXCEPTION USING ERRCODE = 'SA001', MESSAGE = 'Invalid batch received date';
          END IF;
          v_received_date := (v_row->>'batchReceivedDate')::DATE;
        EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
          RAISE EXCEPTION USING ERRCODE = 'SA001', MESSAGE = 'Invalid batch received date';
        END;

        v_batch_code := NULLIF(BTRIM(COALESCE(v_row->>'batchCode', '')), '');

        IF v_batch_code IS NULL THEN
          RAISE EXCEPTION 'Batch code is required';
        END IF;

        -- New Batch creates a warehouse code, never reuses another item/location's code.
        -- Share the lock with Existing Batch so concurrent saves see the committed winner.
        PERFORM pg_advisory_xact_lock(hashtextextended(p_company_id::TEXT || ':' || v_warehouse_id::TEXT || ':' || v_batch_code, 0));
        IF EXISTS (
          SELECT 1 FROM public.item_batches ib
          WHERE ib.company_id = p_company_id
            AND ib.warehouse_id = v_warehouse_id
            AND ib.batch_code = v_batch_code
            AND ib.deleted_at IS NULL
        ) THEN
          RAISE EXCEPTION USING ERRCODE = 'SA003', MESSAGE = 'Batch code already exists in warehouse';
        END IF;

          INSERT INTO public.item_batches (
            company_id,
            item_id,
            warehouse_id,
            batch_code,
            received_at,
            expiration_date,
            qty_on_hand,
            qty_reserved,
            created_by,
            updated_by
          )
          VALUES (
            p_company_id,
            v_item_id,
            v_warehouse_id,
            v_batch_code,
            v_received_date::TIMESTAMP,
            v_expiration_date,
            0,
            0,
            p_user_id,
            p_user_id
          )
          RETURNING id INTO v_item_batch_id;

        END IF;

        SELECT ilb.id
        INTO v_batch_location_id
        FROM public.item_batch_locations ilb
        WHERE ilb.company_id = p_company_id
          AND ilb.item_id = v_item_id
          AND ilb.warehouse_id = v_warehouse_id
          AND ilb.location_id = v_location_id
          AND ilb.item_batch_id = v_item_batch_id
          AND ilb.deleted_at IS NULL
        FOR UPDATE;

        IF v_batch_location_id IS NULL THEN
          IF v_current_qty <> 0 OR v_adjusted_qty <= 0 THEN
            RAISE EXCEPTION 'A new batch location requires a positive stock increase from zero';
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
            v_item_id,
            v_warehouse_id,
            v_location_id,
            v_item_batch_id,
            0,
            0,
            p_user_id,
            p_user_id
          )
          RETURNING id INTO v_batch_location_id;
        END IF;
      END IF;

      v_difference := v_adjusted_qty - v_current_qty;
      v_entered_qty := (v_row->>'enteredQty')::NUMERIC;
      v_entered_unit_option_id := NULLIF(v_row->>'enteredUnitOptionId', '')::UUID;
      v_entered_qty_per_unit := 1;
      v_entered_unit_label := v_uom_name;
      IF v_entered_unit_option_id IS NOT NULL THEN
        SELECT opt.qty_per_unit,
          COALESCE(NULLIF(btrim(opt.option_label), ''),
            unit.code || ' (' || trim(trailing '.' FROM trim(trailing '0' FROM opt.qty_per_unit::TEXT)) || ' ' || v_uom_name || ')')
        INTO v_entered_qty_per_unit, v_entered_unit_label
        FROM public.item_unit_options opt
        JOIN public.units_of_measure unit ON unit.id = opt.uom_id
        WHERE opt.id = v_entered_unit_option_id AND opt.item_id = v_item_id
          AND opt.company_id = p_company_id AND opt.is_active AND opt.deleted_at IS NULL;
      END IF;
      IF v_entered_qty IS NULL OR v_entered_qty < 0 OR v_entered_qty > 1000000000
        OR v_entered_qty <> round(v_entered_qty, 2)
        OR v_entered_qty_per_unit IS NULL OR v_entered_qty_per_unit <= 0
        OR v_entered_qty_per_unit <> round(v_entered_qty_per_unit, 2)
        OR round(v_entered_qty * v_entered_qty_per_unit, 2) <> abs(v_difference) THEN
        RAISE EXCEPTION 'Invalid stock adjustment entered quantity or unit';
      END IF;
      v_total_cost := v_difference * v_unit_cost;
      v_total_value := v_total_value + v_total_cost;

      INSERT INTO public.stock_adjustment_items (
        company_id,
        adjustment_id,
        item_id,
        item_batch_location_id,
        item_code,
        item_name,
        current_qty,
        adjusted_qty,
        difference,
        entered_qty, entered_unit_option_id, entered_unit_label, entered_qty_per_unit,
        unit_cost,
        total_cost,
        uom_id,
        uom_name,
        reason,
        created_by,
        updated_by
      )
      VALUES (
        p_company_id,
        v_adjustment.id,
        v_item_id,
        v_batch_location_id,
        v_item_code,
        v_item_name,
        v_current_qty,
        v_adjusted_qty,
        v_difference,
        v_entered_qty, v_entered_unit_option_id, v_entered_unit_label, v_entered_qty_per_unit,
        v_unit_cost,
        v_total_cost,
        v_uom_id,
        v_uom_name,
        NULLIF(v_row->>'reason', ''),
        p_user_id,
        p_user_id
      );
    END LOOP;
  ELSE
    v_total_value := COALESCE(v_adjustment.total_value, 0);
  END IF;

  UPDATE public.stock_adjustments sa
  SET adjustment_type = COALESCE(p_adjustment_type, sa.adjustment_type),
      adjustment_date = COALESCE(p_adjustment_date, sa.adjustment_date),
      warehouse_id = v_warehouse_id,
      reason = COALESCE(p_reason, sa.reason),
      notes = CASE WHEN p_notes_provided THEN NULLIF(p_notes, '') ELSE sa.notes END,
      custom_fields = NULLIF(v_custom_fields, '{}'::JSONB),
      total_value = v_total_value,
      updated_by = p_user_id,
      updated_at = NOW()
  WHERE sa.id = v_adjustment.id
  RETURNING sa.id, sa.adjustment_code, sa.status, sa.business_unit_id, sa.warehouse_id, sa.custom_fields, sa.total_value INTO v_adjustment;

  RETURN QUERY
  SELECT v_adjustment.id, v_adjustment.adjustment_code::TEXT, v_adjustment.status::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_item_location_stock_page(
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
      'expirationDate', b.expiration_date,
      'qtyOnHand', b.qty_on_hand, 'qtyReserved', b.qty_reserved, 'qtyAvailable', b.qty_available)
      ORDER BY b.received_at, b.id) AS rows
    FROM (
      SELECT bl.id, batch.batch_code, batch.received_at, batch.expiration_date, bl.qty_on_hand, bl.qty_reserved, bl.qty_available
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

-- Keep expiration as part of batch identity across warehouse moves.
CREATE OR REPLACE FUNCTION public.move_stock_transactionally(
  p_business_unit_id UUID,
  p_item_id UUID,
  p_source_warehouse_id UUID,
  p_destination_warehouse_id UUID,
  p_from_location_id UUID,
  p_to_location_id UUID,
  p_quantity NUMERIC,
  p_transaction_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_company_id UUID;
  v_uom_id UUID;
  v_unit_cost NUMERIC;
  v_source_stock RECORD;
  v_destination_stock_id UUID;
  v_destination_balance NUMERIC;
  v_destination_batch_id UUID;
  v_destination_batch_location_id UUID;
  v_source RECORD;
  v_remaining NUMERIC := p_quantity;
  v_take NUMERIC;
  v_balance NUMERIC;
  v_next_balance NUMERIC;
  v_transaction_id UUID := gen_random_uuid();
  v_destination_transaction_id UUID;
  v_transaction_code TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'STOCK_MOVE_UNAUTHORIZED';
  END IF;

  SELECT actor.company_id INTO v_company_id
  FROM public.users actor
  WHERE actor.id = v_user_id AND actor.is_active IS TRUE AND actor.deleted_at IS NULL;

  IF v_company_id IS NULL OR p_business_unit_id IS NULL
     OR p_business_unit_id IS DISTINCT FROM public.get_current_business_unit_id() THEN
    RAISE EXCEPTION 'STOCK_MOVE_CONTEXT_INVALID';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_business_unit_access access_row
    JOIN public.business_units business_unit ON business_unit.id = access_row.business_unit_id
    WHERE access_row.user_id = v_user_id
      AND access_row.business_unit_id = p_business_unit_id
      AND business_unit.company_id = v_company_id
      AND business_unit.is_active IS TRUE
  ) OR NOT public.user_has_permission(v_user_id, 'stock_transactions', 'create', p_business_unit_id)
    OR NOT public.user_has_permission(v_user_id, 'transfer_between_locations', 'create', p_business_unit_id) THEN
    RAISE EXCEPTION 'STOCK_MOVE_FORBIDDEN';
  END IF;

  IF p_item_id IS NULL OR p_source_warehouse_id IS NULL OR p_destination_warehouse_id IS NULL
     OR p_from_location_id IS NULL OR p_to_location_id IS NULL
     OR p_from_location_id = p_to_location_id OR p_transaction_date IS NULL
     OR p_quantity IS NULL OR p_quantity::TEXT IN ('NaN', 'Infinity', '-Infinity')
     OR p_quantity <= 0 OR p_quantity > 1000000000 OR p_quantity <> ROUND(p_quantity, 2) THEN
    RAISE EXCEPTION 'STOCK_MOVE_DETAILS_INVALID';
  END IF;

  PERFORM warehouse.id FROM public.warehouses warehouse
  WHERE warehouse.id = p_source_warehouse_id AND warehouse.company_id = v_company_id
    AND warehouse.business_unit_id = p_business_unit_id
    AND warehouse.is_active IS TRUE AND warehouse.deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MOVE_WAREHOUSE_INVALID'; END IF;

  PERFORM warehouse.id FROM public.warehouses warehouse
  WHERE warehouse.id = p_destination_warehouse_id AND warehouse.company_id = v_company_id
    AND warehouse.business_unit_id = p_business_unit_id
    AND warehouse.is_active IS TRUE AND warehouse.deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MOVE_WAREHOUSE_INVALID'; END IF;

  PERFORM location.id FROM public.warehouse_locations location
  WHERE location.id = p_from_location_id AND location.company_id = v_company_id
    AND location.warehouse_id = p_source_warehouse_id
    AND location.is_active IS TRUE AND location.is_storable IS TRUE AND location.deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MOVE_LOCATION_INVALID'; END IF;

  PERFORM location.id FROM public.warehouse_locations location
  WHERE location.id = p_to_location_id AND location.company_id = v_company_id
    AND location.warehouse_id = p_destination_warehouse_id
    AND location.is_active IS TRUE AND location.is_storable IS TRUE AND location.deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MOVE_LOCATION_INVALID'; END IF;

  SELECT item.uom_id, COALESCE(item.purchase_price, 0) INTO v_uom_id, v_unit_cost
  FROM public.items item
  WHERE item.id = p_item_id AND item.company_id = v_company_id
    AND item.is_stock_item IS TRUE AND item.is_active IS TRUE AND item.deleted_at IS NULL
  FOR SHARE;
  IF NOT FOUND OR v_uom_id IS NULL THEN RAISE EXCEPTION 'STOCK_MOVE_ITEM_UNAVAILABLE'; END IF;

  -- Lock the stock rows in warehouse order so opposite-direction moves serialize.
  PERFORM stock.id FROM public.item_warehouse stock
  WHERE stock.company_id = v_company_id AND stock.item_id = p_item_id
    AND stock.warehouse_id IN (p_source_warehouse_id, p_destination_warehouse_id)
  ORDER BY stock.warehouse_id
  FOR UPDATE;

  SELECT stock.id, stock.current_stock, stock.available_stock INTO v_source_stock
  FROM public.item_warehouse stock
  WHERE stock.company_id = v_company_id AND stock.item_id = p_item_id
    AND stock.warehouse_id = p_source_warehouse_id
    AND stock.is_active IS TRUE AND stock.deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR COALESCE(v_source_stock.available_stock, 0) < p_quantity THEN
    RAISE EXCEPTION 'STOCK_MOVE_INSUFFICIENT_STOCK';
  END IF;
  v_balance := v_source_stock.current_stock;

  IF p_source_warehouse_id <> p_destination_warehouse_id THEN
    INSERT INTO public.item_warehouse (
      company_id, item_id, warehouse_id, current_stock, reserved_stock, putaway_qty,
      default_location_id, created_by, updated_by
    ) VALUES (
      v_company_id, p_item_id, p_destination_warehouse_id, 0, 0, 0,
      p_to_location_id, v_user_id, v_user_id
    ) ON CONFLICT (company_id, item_id, warehouse_id) DO NOTHING;

    SELECT stock.id, COALESCE(stock.current_stock, 0) INTO v_destination_stock_id, v_destination_balance
    FROM public.item_warehouse stock
    WHERE stock.company_id = v_company_id AND stock.item_id = p_item_id
      AND stock.warehouse_id = p_destination_warehouse_id
      AND stock.is_active IS TRUE AND stock.deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MOVE_DESTINATION_UNAVAILABLE'; END IF;
  END IF;

  INSERT INTO public.stock_transactions (
    id, company_id, business_unit_id, transaction_type, transaction_date,
    warehouse_id, to_warehouse_id, from_location_id, to_location_id,
    reference_type, reference_id,
    status, created_by, updated_by
  ) VALUES (
    v_transaction_id, v_company_id, p_business_unit_id,
    CASE WHEN p_source_warehouse_id = p_destination_warehouse_id THEN 'transfer' ELSE 'out' END,
    p_transaction_date,
    p_source_warehouse_id, p_destination_warehouse_id, p_from_location_id, p_to_location_id,
    'stock_move', v_transaction_id,
    'draft', v_user_id, v_user_id
  ) RETURNING id, transaction_code INTO v_transaction_id, v_transaction_code;

  -- Warehouse reports consume one warehouse per stock transaction. A paired
  -- receipt gives the destination its own audit and ledger balance, linked to
  -- the same move. Rack moves need only the unchanged-warehouse transfer entry.
  IF p_source_warehouse_id <> p_destination_warehouse_id THEN
    INSERT INTO public.stock_transactions (
      company_id, business_unit_id, transaction_type, transaction_date,
      warehouse_id, to_location_id, reference_type, reference_id, reference_code,
      status, created_by, updated_by
    ) VALUES (
      v_company_id, p_business_unit_id, 'in', p_transaction_date,
      p_destination_warehouse_id, p_to_location_id, 'stock_move', v_transaction_id, v_transaction_code,
      'draft', v_user_id, v_user_id
    ) RETURNING id INTO v_destination_transaction_id;
  END IF;

  FOR v_source IN
    SELECT stock.id AS location_stock_id, stock.item_batch_id,
      stock.qty_available, batch.qty_available AS batch_available,
      batch.batch_code, batch.received_at, batch.expiration_date
    FROM public.item_batch_locations stock
    JOIN public.item_batches batch ON batch.id = stock.item_batch_id
      AND batch.company_id = stock.company_id AND batch.item_id = stock.item_id
      AND batch.warehouse_id = stock.warehouse_id AND batch.deleted_at IS NULL
    WHERE stock.company_id = v_company_id AND stock.item_id = p_item_id
      AND stock.warehouse_id = p_source_warehouse_id AND stock.location_id = p_from_location_id
      AND stock.deleted_at IS NULL AND stock.qty_available > 0
    ORDER BY batch.received_at, batch.id, stock.id
    FOR UPDATE OF stock, batch
  LOOP
    v_take := LEAST(v_remaining, v_source.qty_available);
    IF v_source.batch_available < v_take THEN RAISE EXCEPTION 'STOCK_MOVE_INSUFFICIENT_STOCK'; END IF;

    UPDATE public.item_batch_locations SET qty_on_hand = qty_on_hand - v_take, updated_by = v_user_id
    WHERE id = v_source.location_stock_id;

    IF p_source_warehouse_id = p_destination_warehouse_id THEN
      v_destination_batch_id := v_source.item_batch_id;
      v_next_balance := v_balance;
    ELSE
      UPDATE public.item_batches SET qty_on_hand = qty_on_hand - v_take, updated_by = v_user_id
      WHERE id = v_source.item_batch_id;

      INSERT INTO public.item_batches AS destination (
        company_id, item_id, warehouse_id, batch_code, received_at, expiration_date,
        qty_on_hand, qty_reserved, created_by, updated_by
      ) VALUES (
        v_company_id, p_item_id, p_destination_warehouse_id, v_source.batch_code, v_source.received_at, v_source.expiration_date,
        v_take, 0, v_user_id, v_user_id
      ) ON CONFLICT (company_id, item_id, warehouse_id, batch_code) DO UPDATE
      SET qty_on_hand = destination.qty_on_hand + EXCLUDED.qty_on_hand, updated_by = v_user_id
      WHERE destination.deleted_at IS NULL AND destination.received_at = EXCLUDED.received_at
        AND destination.expiration_date IS NOT DISTINCT FROM EXCLUDED.expiration_date
      RETURNING id INTO v_destination_batch_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MOVE_BATCH_CONFLICT'; END IF;
      v_next_balance := v_balance - v_take;
    END IF;

    INSERT INTO public.item_batch_locations AS destination (
      company_id, item_id, warehouse_id, location_id, item_batch_id,
      qty_on_hand, qty_reserved, created_by, updated_by
    ) VALUES (
      v_company_id, p_item_id, p_destination_warehouse_id, p_to_location_id, v_destination_batch_id,
      v_take, 0, v_user_id, v_user_id
    ) ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO UPDATE
    SET qty_on_hand = destination.qty_on_hand + EXCLUDED.qty_on_hand, updated_by = v_user_id
    WHERE destination.deleted_at IS NULL
    RETURNING id INTO v_destination_batch_location_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'STOCK_MOVE_DESTINATION_UNAVAILABLE'; END IF;

    -- Each consumed batch remains identifiable in the movement history.
    INSERT INTO public.stock_transaction_items (
      company_id, transaction_id, item_id, quantity, uom_id, unit_cost, total_cost, batch_no,
      qty_before, qty_after, valuation_rate, stock_value_before, stock_value_after,
      posting_date, posting_time, created_by, updated_by
    ) VALUES (
      v_company_id, v_transaction_id, p_item_id, v_take, v_uom_id, v_unit_cost, v_take * v_unit_cost,
      v_source.batch_code, v_balance, v_next_balance, v_unit_cost,
      v_balance * v_unit_cost, v_next_balance * v_unit_cost,
      p_transaction_date, clock_timestamp()::TIME, v_user_id, v_user_id
    );
    IF v_destination_transaction_id IS NOT NULL THEN
      INSERT INTO public.stock_transaction_items (
        company_id, transaction_id, item_id, quantity, uom_id, unit_cost, total_cost, batch_no,
        qty_before, qty_after, valuation_rate, stock_value_before, stock_value_after,
        posting_date, posting_time, created_by, updated_by
      ) VALUES (
        v_company_id, v_destination_transaction_id, p_item_id, v_take, v_uom_id, v_unit_cost, v_take * v_unit_cost,
        v_source.batch_code, v_destination_balance, v_destination_balance + v_take, v_unit_cost,
        v_destination_balance * v_unit_cost, (v_destination_balance + v_take) * v_unit_cost,
        p_transaction_date, clock_timestamp()::TIME, v_user_id, v_user_id
      );
      v_destination_balance := v_destination_balance + v_take;
    END IF;
    v_balance := v_next_balance;
    v_remaining := v_remaining - v_take;
    EXIT WHEN v_remaining = 0;
  END LOOP;

  IF v_remaining > 0 THEN RAISE EXCEPTION 'STOCK_MOVE_INSUFFICIENT_STOCK'; END IF;

  IF p_source_warehouse_id <> p_destination_warehouse_id THEN
    UPDATE public.item_warehouse SET
      current_stock = current_stock + CASE WHEN id = v_source_stock.id THEN -p_quantity ELSE p_quantity END,
      updated_by = v_user_id
    WHERE id IN (v_source_stock.id, v_destination_stock_id);
  END IF;

  UPDATE public.stock_transactions SET status = 'posted', updated_by = v_user_id
  WHERE id IN (v_transaction_id, v_destination_transaction_id);
  RETURN jsonb_build_object('id', v_transaction_id, 'transactionCode', v_transaction_code,
    'message', 'Stock transaction created successfully');
END;
$$;

REVOKE ALL ON FUNCTION public.move_stock_transactionally(UUID, UUID, UUID, UUID, UUID, UUID, NUMERIC, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_stock_transactionally(UUID, UUID, UUID, UUID, UUID, UUID, NUMERIC, DATE) TO authenticated;

COMMIT;
