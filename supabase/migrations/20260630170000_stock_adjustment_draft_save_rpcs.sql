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
RETURNS TABLE(adjustment_id UUID, adjustment_code TEXT, status TEXT)
LANGUAGE plpgsql
SET search_path = public
AS $create_draft_stock_adjustment$
DECLARE
  v_adjustment public.stock_adjustments%ROWTYPE;
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
  v_item_code TEXT;
  v_item_name TEXT;
  v_uom_name TEXT;
  v_current_qty NUMERIC;
  v_adjusted_qty NUMERIC;
  v_difference NUMERIC;
  v_unit_cost NUMERIC;
  v_total_cost NUMERIC;
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
    RETURNING * INTO v_adjustment;
  ELSE
    SELECT *
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
      v_existing_batch_location_id := NULLIF(v_row->>'itemBatchLocationId', '')::UUID;
      v_current_qty := COALESCE(NULLIF(v_row->>'currentQty', '')::NUMERIC, 0);
      v_adjusted_qty := NULLIF(v_row->>'adjustedQty', '')::NUMERIC;
      v_unit_cost := COALESCE(NULLIF(v_row->>'unitCost', '')::NUMERIC, 0);

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
        FOR UPDATE;

        IF v_batch_location_id IS NULL THEN
          RAISE EXCEPTION 'Selected batch location is not valid for the adjustment';
        END IF;
      ELSE
        v_batch_code := NULLIF(BTRIM(COALESCE(v_row->>'batchCode', '')), '');

        IF v_batch_code IS NULL THEN
          RAISE EXCEPTION 'Batch code is required';
        END IF;

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

        SELECT ib.id
        INTO v_item_batch_id
        FROM public.item_batches ib
        WHERE ib.company_id = p_company_id
          AND ib.item_id = v_item_id
          AND ib.warehouse_id = v_warehouse_id
          AND ib.batch_code = v_batch_code
          AND ib.deleted_at IS NULL
        FOR UPDATE;

        IF v_item_batch_id IS NULL THEN
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
            v_item_id,
            v_warehouse_id,
            v_batch_code,
            NOW(),
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
  RETURNING * INTO v_adjustment;

  RETURN QUERY
  SELECT v_adjustment.id, v_adjustment.adjustment_code::TEXT, v_adjustment.status::TEXT;
END;
$create_draft_stock_adjustment$;

CREATE OR REPLACE FUNCTION public.create_stock_adjustment(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_adjustment_type TEXT,
  p_adjustment_date DATE,
  p_warehouse_id UUID,
  p_location_id UUID,
  p_reason TEXT,
  p_notes TEXT,
  p_items JSONB
)
RETURNS TABLE(adjustment_id UUID, adjustment_code TEXT, status TEXT)
LANGUAGE sql
SET search_path = public
AS $create_stock_adjustment$
  SELECT *
  FROM public.create_draft_stock_adjustment(
    p_company_id,
    p_business_unit_id,
    p_user_id,
    NULL,
    p_adjustment_type,
    p_adjustment_date,
    p_warehouse_id,
    p_location_id,
    TRUE,
    p_reason,
    p_notes,
    FALSE,
    p_items
  );
$create_stock_adjustment$;

CREATE OR REPLACE FUNCTION public.update_stock_adjustment(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_adjustment_id UUID,
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
RETURNS TABLE(adjustment_id UUID, adjustment_code TEXT, status TEXT)
LANGUAGE sql
SET search_path = public
AS $update_stock_adjustment$
  SELECT *
  FROM public.create_draft_stock_adjustment(
    p_company_id,
    p_business_unit_id,
    p_user_id,
    p_adjustment_id,
    p_adjustment_type,
    p_adjustment_date,
    p_warehouse_id,
    p_location_id,
    p_location_id_provided,
    p_reason,
    p_notes,
    p_notes_provided,
    p_items
  );
$update_stock_adjustment$;

REVOKE ALL ON FUNCTION public.create_draft_stock_adjustment(UUID, UUID, UUID, UUID, TEXT, DATE, UUID, UUID, BOOLEAN, TEXT, TEXT, BOOLEAN, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_stock_adjustment(UUID, UUID, UUID, TEXT, DATE, UUID, UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_stock_adjustment(UUID, UUID, UUID, UUID, TEXT, DATE, UUID, UUID, BOOLEAN, TEXT, TEXT, BOOLEAN, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_draft_stock_adjustment(UUID, UUID, UUID, UUID, TEXT, DATE, UUID, UUID, BOOLEAN, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_stock_adjustment(UUID, UUID, UUID, TEXT, DATE, UUID, UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_stock_adjustment(UUID, UUID, UUID, UUID, TEXT, DATE, UUID, UUID, BOOLEAN, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;
