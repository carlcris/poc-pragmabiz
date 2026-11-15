BEGIN;

ALTER TABLE public.stock_adjustment_items
  ADD COLUMN item_batch_id UUID REFERENCES public.item_batches(id);

-- Retain exact batch locations for saved adjustments and expose the batch independently of the bin.
UPDATE public.stock_adjustment_items sai
SET item_batch_id = bl.item_batch_id
FROM public.item_batch_locations bl
WHERE bl.id = sai.item_batch_location_id AND bl.company_id = sai.company_id;

CREATE INDEX idx_stock_adjustment_items_item_batch_id
  ON public.stock_adjustment_items (item_batch_id) WHERE item_batch_id IS NOT NULL;

COMMENT ON COLUMN public.stock_adjustment_items.item_batch_id IS
  'Selected batch. A draft can target a new bin before its exact batch location exists.';

CREATE OR REPLACE FUNCTION public.create_draft_stock_adjustment(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_adjustment_id UUID DEFAULT NULL,
  p_adjustment_type TEXT DEFAULT NULL,
  p_adjustment_date DATE DEFAULT NULL,
  p_warehouse_id UUID DEFAULT NULL,
  p_location_id UUID DEFAULT NULL,
  p_location_id_provided BOOLEAN DEFAULT FALSE,
  p_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_notes_provided BOOLEAN DEFAULT FALSE,
  p_items JSONB DEFAULT NULL
)
RETURNS TABLE(adjustment_id uuid, adjustment_code text, status text)
LANGUAGE plpgsql
SET search_path = public, pg_temp
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
  v_destination_qty public.item_batch_locations.qty_on_hand%TYPE;
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

    IF p_warehouse_id IS NOT NULL AND p_warehouse_id IS DISTINCT FROM v_adjustment.warehouse_id THEN
      RAISE EXCEPTION 'The warehouse cannot be changed after an adjustment is created';
    END IF;
    v_warehouse_id := v_adjustment.warehouse_id;

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

  IF v_location_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.warehouse_locations wl
    WHERE wl.id = v_location_id
      AND wl.company_id = p_company_id
      AND wl.warehouse_id = v_warehouse_id
      AND wl.is_active IS TRUE
      AND wl.is_storable IS TRUE
      AND wl.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Selected location is not valid for the warehouse';
  END IF;

  -- Header-only edits must also preserve the destination rules for saved lines.
  IF NOT v_is_create AND p_location_id_provided AND p_items IS NULL THEN
    IF v_location_id IS NULL AND EXISTS (
      SELECT 1 FROM public.stock_adjustment_items sai
      WHERE sai.adjustment_id = v_adjustment.id AND sai.company_id = p_company_id
        AND sai.deleted_at IS NULL AND sai.item_batch_location_id IS NULL
    ) THEN
      RAISE EXCEPTION 'Location is required for a new batch';
    END IF;
    IF v_location_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.stock_adjustment_items sai
      JOIN public.item_batch_locations bl ON bl.id = sai.item_batch_location_id
      WHERE sai.adjustment_id = v_adjustment.id AND sai.company_id = p_company_id
        AND sai.deleted_at IS NULL
        AND (bl.location_id IS DISTINCT FROM v_location_id OR bl.deleted_at IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'Selected batch location is not valid for the adjustment';
    END IF;
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

      v_difference := v_adjusted_qty - v_current_qty;
      IF v_existing_batch_location_id IS NOT NULL THEN
        SELECT ilb.id, ilb.item_batch_id
        INTO v_batch_location_id, v_item_batch_id
        FROM public.item_batch_locations ilb
        JOIN public.item_batches ib ON ib.id = ilb.item_batch_id
          AND ib.company_id = ilb.company_id AND ib.warehouse_id = ilb.warehouse_id
          AND ib.item_id = ilb.item_id AND ib.deleted_at IS NULL
        WHERE ilb.id = v_existing_batch_location_id
          AND ilb.company_id = p_company_id
          AND ilb.item_id = v_item_id
          AND ilb.warehouse_id = v_warehouse_id
          AND (v_location_id IS NULL OR ilb.location_id = v_location_id)
          AND ilb.deleted_at IS NULL
          AND (v_selected_item_batch_id IS NULL OR ilb.item_batch_id = v_selected_item_batch_id);

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

        SELECT ilb.id, ilb.qty_on_hand
        INTO v_batch_location_id, v_destination_qty
        FROM public.item_batch_locations ilb
        WHERE ilb.company_id = p_company_id
          AND ilb.item_id = v_item_id
          AND ilb.warehouse_id = v_warehouse_id
          AND ilb.location_id = v_location_id
          AND ilb.item_batch_id = v_item_batch_id
          AND ilb.deleted_at IS NULL;

        IF v_batch_location_id IS NULL THEN
          IF v_current_qty <> 0 OR v_difference <= 0 THEN
            RAISE EXCEPTION 'A new batch location requires a positive stock increase from zero';
          END IF;
        ELSIF v_current_qty = 0 AND v_difference > 0 THEN
          -- A destination can gain stock before the draft is saved. Preserve the entered delta.
          v_current_qty := v_destination_qty;
          v_adjusted_qty := v_destination_qty + v_difference;
        END IF;
      END IF;

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
        item_batch_id,
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
        v_item_batch_id,
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

CREATE OR REPLACE FUNCTION public.post_stock_adjustment(
  p_adjustment_id UUID,
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  adjustment_id UUID,
  stock_transaction_id UUID,
  stock_transaction_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_adjustment RECORD;
  v_line RECORD;
  v_batch_location RECORD;
  v_item_batch RECORD;
  v_item_batch_id UUID;
  v_batch_location_id UUID;
  v_stock_transaction_id UUID;
  v_stock_transaction_code TEXT;
  v_transaction_type TEXT;
  v_total_difference NUMERIC;
  v_difference NUMERIC;
  v_unit_cost NUMERIC;
  v_batch_qty_after NUMERIC;
  v_location_id UUID;
  v_current_warehouse_qty NUMERIC;
  v_new_warehouse_qty NUMERIC;
  v_posting_time TIME;
BEGIN
  IF p_business_unit_id IS NULL THEN
    RAISE EXCEPTION 'Business unit context required';
  END IF;

  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id
    OR p_business_unit_id IS DISTINCT FROM public.get_current_business_unit_id()
    OR NOT EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.user_business_unit_access access ON access.user_id = u.id
      JOIN public.business_units bu ON bu.id = access.business_unit_id
      WHERE u.id = p_user_id AND u.company_id = p_company_id
        AND u.is_active IS TRUE AND u.deleted_at IS NULL
        AND bu.id = p_business_unit_id AND bu.company_id = p_company_id AND bu.is_active IS TRUE
    )
    OR NOT public.user_has_permission(p_user_id, 'stock_adjustments', 'edit', p_business_unit_id)
  THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'User cannot post stock adjustment';
  END IF;

  SELECT sa.id, sa.adjustment_code, sa.status, sa.adjustment_date, sa.warehouse_id,
    sa.reason, sa.custom_fields
  INTO v_adjustment
  FROM public.stock_adjustments sa
  WHERE sa.id = p_adjustment_id AND sa.company_id = p_company_id
    AND sa.business_unit_id = p_business_unit_id AND sa.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock adjustment not found';
  END IF;

  IF v_adjustment.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Only draft adjustments can be posted';
  END IF;

  SELECT COALESCE(SUM(difference), 0)
  INTO v_total_difference
  FROM public.stock_adjustment_items
  WHERE public.stock_adjustment_items.adjustment_id = p_adjustment_id
    AND company_id = p_company_id
    AND deleted_at IS NULL;

  IF v_total_difference = 0 THEN
    RAISE EXCEPTION 'No net adjustment';
  END IF;

  v_transaction_type := CASE WHEN v_total_difference > 0 THEN 'in' ELSE 'out' END;
  v_location_id := NULLIF(v_adjustment.custom_fields->>'locationId', '')::UUID;
  IF NOT EXISTS (
    SELECT 1 FROM public.warehouses w
    WHERE w.id = v_adjustment.warehouse_id AND w.company_id = p_company_id
      AND w.business_unit_id = p_business_unit_id AND w.is_active IS TRUE AND w.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Selected warehouse is not valid for the current business unit';
  END IF;

  v_posting_time := CURRENT_TIME;

  INSERT INTO public.stock_transactions (
    company_id,
    business_unit_id,
    transaction_type,
    transaction_date,
    warehouse_id,
    from_location_id,
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
    v_transaction_type,
    v_adjustment.adjustment_date,
    v_adjustment.warehouse_id,
    CASE WHEN v_transaction_type = 'out' THEN v_location_id ELSE NULL END,
    CASE WHEN v_transaction_type = 'in' THEN v_location_id ELSE NULL END,
    'stock_adjustment',
    v_adjustment.id,
    v_adjustment.adjustment_code,
    'posted',
    'Stock adjustment: ' || v_adjustment.adjustment_code || ' - ' || v_adjustment.reason,
    p_user_id,
    p_user_id
  )
  RETURNING id, transaction_code
  INTO v_stock_transaction_id, v_stock_transaction_code;

  FOR v_line IN
    SELECT sai.id, sai.item_id, sai.item_batch_id, sai.item_batch_location_id,
      sai.difference, sai.uom_id, sai.unit_cost, sai.reason
    FROM public.stock_adjustment_items sai
    WHERE sai.adjustment_id = p_adjustment_id AND sai.company_id = p_company_id
      AND sai.deleted_at IS NULL
    ORDER BY sai.item_id, sai.created_at, sai.id
  LOOP
    v_difference := COALESCE(v_line.difference, 0);
    IF v_difference = 0 THEN
      CONTINUE;
    END IF;

    v_batch_location_id := v_line.item_batch_location_id;
    v_item_batch_id := v_line.item_batch_id;
    IF v_batch_location_id IS NULL THEN
      IF v_item_batch_id IS NULL THEN
        RAISE EXCEPTION 'Batch selection or batch code is required for every adjustment item';
      END IF;
      IF v_location_id IS NULL THEN
        RAISE EXCEPTION 'Location is required for a new batch';
      END IF;
    END IF;

    -- Require the saved bin to be usable at posting, including for existing batch locations.
    PERFORM wl.id
    FROM public.warehouse_locations wl
    WHERE wl.id = COALESCE(v_location_id, (
      SELECT bl.location_id FROM public.item_batch_locations bl
      WHERE bl.id = v_batch_location_id AND bl.company_id = p_company_id
        AND bl.item_id = v_line.item_id AND bl.warehouse_id = v_adjustment.warehouse_id
        AND bl.deleted_at IS NULL
    ))
      AND wl.company_id = p_company_id AND wl.warehouse_id = v_adjustment.warehouse_id
      AND wl.is_active IS TRUE AND wl.is_storable IS TRUE AND wl.deleted_at IS NULL
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected location is not valid for the warehouse';
    END IF;

    IF v_batch_location_id IS NULL THEN
      -- Reuse stock materialized by another operation since draft save.
      SELECT bl.id INTO v_batch_location_id
      FROM public.item_batch_locations bl
      WHERE bl.company_id = p_company_id AND bl.item_id = v_line.item_id
        AND bl.warehouse_id = v_adjustment.warehouse_id AND bl.location_id = v_location_id
        AND bl.item_batch_id = v_item_batch_id AND bl.deleted_at IS NULL;

      IF v_batch_location_id IS NULL THEN
        IF v_difference <= 0 THEN
          RAISE EXCEPTION 'A new batch location requires a positive stock increase from zero';
        END IF;

        INSERT INTO public.item_batch_locations (
          company_id, item_id, warehouse_id, location_id, item_batch_id,
          qty_on_hand, qty_reserved, created_by, updated_by
        )
        SELECT p_company_id, v_line.item_id, v_adjustment.warehouse_id, v_location_id, ib.id,
          0, 0, p_user_id, p_user_id
        FROM public.item_batches ib
        WHERE ib.id = v_item_batch_id AND ib.company_id = p_company_id
          AND ib.item_id = v_line.item_id AND ib.warehouse_id = v_adjustment.warehouse_id
          AND ib.deleted_at IS NULL
        ON CONFLICT (company_id, item_id, warehouse_id, location_id, item_batch_id) DO NOTHING
        RETURNING id INTO v_batch_location_id;

        IF v_batch_location_id IS NULL THEN
          SELECT bl.id INTO v_batch_location_id
          FROM public.item_batch_locations bl
          WHERE bl.company_id = p_company_id AND bl.item_id = v_line.item_id
            AND bl.warehouse_id = v_adjustment.warehouse_id AND bl.location_id = v_location_id
            AND bl.item_batch_id = v_item_batch_id AND bl.deleted_at IS NULL;
        END IF;
      END IF;
    END IF;

    SELECT bl.id, bl.item_batch_id, bl.location_id, bl.qty_on_hand, bl.qty_reserved
    INTO v_batch_location
    FROM public.item_batch_locations bl
    WHERE bl.id = v_batch_location_id AND bl.company_id = p_company_id
      AND bl.item_id = v_line.item_id AND bl.warehouse_id = v_adjustment.warehouse_id
      AND (v_location_id IS NULL OR bl.location_id = v_location_id)
      AND (v_item_batch_id IS NULL OR bl.item_batch_id = v_item_batch_id)
      AND bl.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected batch location is not valid for the adjustment';
    END IF;

    SELECT ib.id, ib.batch_code
    INTO v_item_batch
    FROM public.item_batches ib
    WHERE ib.id = v_batch_location.item_batch_id AND ib.company_id = p_company_id
      AND ib.item_id = v_line.item_id AND ib.warehouse_id = v_adjustment.warehouse_id
      AND ib.deleted_at IS NULL
    FOR NO KEY UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected batch location is not valid for the adjustment';
    END IF;

    v_batch_qty_after := v_batch_location.qty_on_hand + v_difference;
    IF v_batch_qty_after < v_batch_location.qty_reserved THEN
      RAISE EXCEPTION USING ERRCODE = 'SA006', MESSAGE = 'Insufficient unreserved stock for the adjustment';
    END IF;

    v_unit_cost := COALESCE(v_line.unit_cost, 0);

    INSERT INTO public.item_warehouse AS iw (
      company_id, item_id, warehouse_id, current_stock, default_location_id, created_by, updated_by
    ) VALUES (
      p_company_id, v_line.item_id, v_adjustment.warehouse_id, v_difference,
      v_batch_location.location_id, p_user_id, p_user_id
    )
    ON CONFLICT (company_id, item_id, warehouse_id) DO UPDATE
      SET current_stock = COALESCE(iw.current_stock, 0) + EXCLUDED.current_stock,
        default_location_id = COALESCE(iw.default_location_id, EXCLUDED.default_location_id),
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      WHERE iw.deleted_at IS NULL
    RETURNING iw.current_stock - v_difference, iw.current_stock
    INTO v_current_warehouse_qty, v_new_warehouse_qty;

    IF NOT FOUND OR v_new_warehouse_qty < 0 THEN
      RAISE EXCEPTION USING ERRCODE = 'SA006', MESSAGE = 'Insufficient unreserved stock for the adjustment';
    END IF;

    INSERT INTO public.stock_transaction_items (
      company_id,
      transaction_id,
      item_id,
      quantity,
      uom_id,
      unit_cost,
      total_cost,
      batch_no,
      notes,
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
      v_stock_transaction_id,
      v_line.item_id,
      ABS(v_difference),
      v_line.uom_id,
      v_unit_cost,
      ABS(v_difference) * v_unit_cost,
      v_item_batch.batch_code,
      COALESCE(v_line.reason, 'Adjustment: ' || v_adjustment.adjustment_code),
      v_current_warehouse_qty,
      v_new_warehouse_qty,
      v_unit_cost,
      v_current_warehouse_qty * v_unit_cost,
      v_new_warehouse_qty * v_unit_cost,
      v_adjustment.adjustment_date,
      v_posting_time,
      p_user_id,
      p_user_id
    );

    UPDATE public.item_batch_locations
    SET qty_on_hand = v_batch_qty_after,
        updated_by = p_user_id,
        updated_at = NOW()
    WHERE id = v_batch_location.id;

    UPDATE public.item_batches
    SET qty_on_hand = COALESCE(qty_on_hand, 0) + v_difference,
        updated_by = p_user_id,
        updated_at = NOW()
    WHERE id = v_item_batch.id;

    IF v_line.item_batch_location_id IS NULL THEN
      UPDATE public.stock_adjustment_items
      SET item_batch_location_id = v_batch_location.id, updated_by = p_user_id
      WHERE id = v_line.id;
    END IF;
  END LOOP;

  UPDATE public.stock_adjustments
  SET status = 'posted',
      stock_transaction_id = v_stock_transaction_id,
      approved_by = p_user_id,
      approved_at = NOW(),
      posted_by = p_user_id,
      posted_at = NOW(),
      updated_by = p_user_id,
      updated_at = NOW()
  WHERE id = v_adjustment.id;

  RETURN QUERY SELECT v_adjustment.id, v_stock_transaction_id, v_stock_transaction_code::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.post_stock_adjustment(UUID, UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_stock_adjustment(UUID, UUID, UUID, UUID) TO authenticated;

COMMIT;
