BEGIN;

ALTER TABLE public.delivery_note_item_picks
  ADD COLUMN IF NOT EXISTS batch_location_sku VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_delivery_note_item_picks_batch_location_sku
  ON public.delivery_note_item_picks(company_id, batch_location_sku)
  WHERE batch_location_sku IS NOT NULL
    AND deleted_at IS NULL;

COMMENT ON COLUMN public.delivery_note_item_picks.batch_location_sku IS
  'Persisted scan code for the picked or planned item batch location source.';

CREATE OR REPLACE FUNCTION public.create_pick_list_with_allocation(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_picker_user_ids UUID[],
  p_notes TEXT DEFAULT NULL,
  p_current_business_unit_id UUID DEFAULT NULL,
  p_batch_allocation_mode TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_dn public.delivery_notes%ROWTYPE;
  v_picker_user_ids UUID[];
  v_picker_count INTEGER;
  v_fulfilling_business_unit_id UUID;
  v_pick_list_business_unit_id UUID;
  v_existing_pick_list_id UUID;
  v_pick_list_id UUID;
  v_pick_list_no TEXT;
  v_now TIMESTAMP := NOW();
  v_mode TEXT := NULLIF(BTRIM(COALESCE(p_batch_allocation_mode, '')), '');
  v_pending_count INTEGER := 0;
  v_dni RECORD;
  v_outstanding_qty NUMERIC;
  v_qty_per_unit NUMERIC;
  v_required_base_qty NUMERIC;
  v_first_source RECORD;
  v_single_source RECORD;
  v_has_first_source BOOLEAN;
  v_has_single_source BOOLEAN;
  v_total_available_base NUMERIC;
  v_remaining_base_qty NUMERIC;
  v_take_base_qty NUMERIC;
  v_source RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'PICK_LIST_UNAUTHORIZED';
  END IF;

  IF v_mode IS NOT NULL AND v_mode NOT IN ('single_sufficient', 'split') THEN
    RAISE EXCEPTION 'PICK_ALLOCATION_INVALID_MODE';
  END IF;

  SELECT *
  INTO v_dn
  FROM public.delivery_notes
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PICK_LIST_DELIVERY_NOTE_NOT_FOUND';
  END IF;

  IF v_dn.status NOT IN ('confirmed', 'dispatched') THEN
    RAISE EXCEPTION 'PICK_LIST_INVALID_DELIVERY_NOTE_STATUS';
  END IF;

  SELECT id
  INTO v_existing_pick_list_id
  FROM public.pick_lists
  WHERE company_id = p_company_id
    AND dn_id = p_dn_id
    AND status IN ('pending', 'in_progress', 'paused')
    AND deleted_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_existing_pick_list_id IS NOT NULL THEN
    RAISE EXCEPTION 'PICK_LIST_ACTIVE_EXISTS';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT picker_id
    FROM unnest(COALESCE(p_picker_user_ids, ARRAY[]::UUID[])) AS picker_id
    WHERE picker_id IS NOT NULL
  )
  INTO v_picker_user_ids;

  IF COALESCE(array_length(v_picker_user_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'PICK_LIST_PICKER_REQUIRED';
  END IF;

  SELECT COUNT(*)
  INTO v_picker_count
  FROM public.users
  WHERE company_id = p_company_id
    AND id = ANY(v_picker_user_ids)
    AND is_active = TRUE
    AND deleted_at IS NULL;

  IF v_picker_count <> array_length(v_picker_user_ids, 1) THEN
    RAISE EXCEPTION 'PICK_LIST_INVALID_PICKER';
  END IF;

  SELECT business_unit_id
  INTO v_fulfilling_business_unit_id
  FROM public.warehouses
  WHERE id = v_dn.fulfilling_warehouse_id
    AND company_id = p_company_id
    AND deleted_at IS NULL;

  v_pick_list_business_unit_id :=
    COALESCE(v_fulfilling_business_unit_id, v_dn.business_unit_id, p_current_business_unit_id);

  INSERT INTO public.pick_lists (
    company_id,
    business_unit_id,
    dn_id,
    status,
    notes,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  VALUES (
    p_company_id,
    v_pick_list_business_unit_id,
    p_dn_id,
    'pending',
    NULLIF(BTRIM(COALESCE(p_notes, '')), ''),
    p_user_id,
    p_user_id,
    v_now,
    v_now
  )
  RETURNING id, pick_list_no INTO v_pick_list_id, v_pick_list_no;

  INSERT INTO public.pick_list_assignees (
    company_id,
    pick_list_id,
    user_id,
    assigned_at,
    assigned_by
  )
  SELECT
    p_company_id,
    v_pick_list_id,
    picker_id,
    v_now,
    p_user_id
  FROM unnest(v_picker_user_ids) AS picker_id;

  FOR v_dni IN
    SELECT
      dni.*,
      COALESCE(iuo.qty_per_unit, 1) AS qty_per_unit
    FROM public.delivery_note_items dni
    LEFT JOIN public.item_unit_options iuo
      ON iuo.id = dni.item_unit_option_id
     AND iuo.company_id = dni.company_id
     AND iuo.deleted_at IS NULL
    WHERE dni.company_id = p_company_id
      AND dni.dn_id = p_dn_id
      AND dni.is_voided = FALSE
      AND COALESCE(dni.allocated_qty, 0) > 0
    ORDER BY dni.created_at ASC, dni.id ASC
    FOR UPDATE OF dni
  LOOP
    v_outstanding_qty := GREATEST(0, COALESCE(v_dni.allocated_qty, 0) - COALESCE(v_dni.picked_qty, 0));
    IF v_outstanding_qty <= 0 THEN
      CONTINUE;
    END IF;

    v_pending_count := v_pending_count + 1;
    v_qty_per_unit := GREATEST(COALESCE(v_dni.qty_per_unit, 1), 1);
    v_required_base_qty := v_outstanding_qty * v_qty_per_unit;

    INSERT INTO public.pick_list_items (
      company_id,
      pick_list_id,
      dn_item_id,
      sr_id,
      sr_item_id,
      item_id,
      item_unit_option_id,
      uom_id,
      allocated_qty,
      picked_qty,
      short_qty,
      created_at,
      updated_at
    )
    VALUES (
      p_company_id,
      v_pick_list_id,
      v_dni.id,
      v_dni.sr_id,
      v_dni.sr_item_id,
      v_dni.item_id,
      v_dni.item_unit_option_id,
      v_dni.uom_id,
      v_outstanding_qty,
      0,
      v_outstanding_qty,
      v_now,
      v_now
    );

    SELECT
      ilb.id AS batch_location_id,
      ilb.location_id,
      ilb.batch_location_sku,
      ib.id AS item_batch_id,
      ib.batch_code,
      ib.received_at,
      GREATEST(
        0,
        LEAST(
          COALESCE(ilb.qty_on_hand, 0) - COALESCE(ilb.qty_reserved, 0),
          COALESCE(ib.qty_on_hand, 0) - COALESCE(ib.qty_reserved, 0)
        )
      ) AS available_base_qty
    INTO v_first_source
    FROM public.item_batch_locations ilb
    JOIN public.item_batches ib
      ON ib.id = ilb.item_batch_id
     AND ib.company_id = ilb.company_id
     AND ib.deleted_at IS NULL
    WHERE ilb.company_id = p_company_id
      AND ilb.item_id = v_dni.item_id
      AND ilb.warehouse_id = v_dni.fulfilling_warehouse_id
      AND ilb.deleted_at IS NULL
      AND GREATEST(
        0,
        LEAST(
          COALESCE(ilb.qty_on_hand, 0) - COALESCE(ilb.qty_reserved, 0),
          COALESCE(ib.qty_on_hand, 0) - COALESCE(ib.qty_reserved, 0)
        )
      ) > 0
    ORDER BY ib.received_at ASC, ilb.created_at ASC, ilb.id ASC
    LIMIT 1;

    v_has_first_source := FOUND;
    IF NOT v_has_first_source THEN
      RAISE EXCEPTION 'PICK_ALLOCATION_INSUFFICIENT_BATCH_QUANTITY';
    END IF;

    IF v_first_source.available_base_qty < v_required_base_qty THEN
      SELECT
        ilb.id AS batch_location_id,
        ilb.location_id,
        ilb.batch_location_sku,
        ib.id AS item_batch_id,
        ib.batch_code,
        ib.received_at,
        GREATEST(
          0,
          LEAST(
            COALESCE(ilb.qty_on_hand, 0) - COALESCE(ilb.qty_reserved, 0),
            COALESCE(ib.qty_on_hand, 0) - COALESCE(ib.qty_reserved, 0)
          )
        ) AS available_base_qty
      INTO v_single_source
      FROM public.item_batch_locations ilb
      JOIN public.item_batches ib
        ON ib.id = ilb.item_batch_id
       AND ib.company_id = ilb.company_id
       AND ib.deleted_at IS NULL
      WHERE ilb.company_id = p_company_id
        AND ilb.item_id = v_dni.item_id
        AND ilb.warehouse_id = v_dni.fulfilling_warehouse_id
        AND ilb.deleted_at IS NULL
        AND GREATEST(
          0,
          LEAST(
            COALESCE(ilb.qty_on_hand, 0) - COALESCE(ilb.qty_reserved, 0),
            COALESCE(ib.qty_on_hand, 0) - COALESCE(ib.qty_reserved, 0)
          )
        ) >= v_required_base_qty
      ORDER BY ib.received_at ASC, ilb.created_at ASC, ilb.id ASC
      LIMIT 1;

      v_has_single_source := FOUND;
      IF v_mode = 'single_sufficient' THEN
        IF NOT v_has_single_source THEN
          RAISE EXCEPTION 'PICK_ALLOCATION_SINGLE_SOURCE_UNAVAILABLE';
        END IF;

        UPDATE public.delivery_note_items
        SET suggested_pick_location_id = v_single_source.location_id,
            suggested_pick_batch_code = v_single_source.batch_code,
            suggested_pick_batch_received_at = v_single_source.received_at,
            suggested_batch_location_sku = v_single_source.batch_location_sku,
            updated_at = v_now
        WHERE id = v_dni.id
          AND company_id = p_company_id;
      ELSIF v_mode = 'split' THEN
        SELECT COALESCE(SUM(source_rows.available_base_qty), 0)
        INTO v_total_available_base
        FROM (
          SELECT GREATEST(
            0,
            LEAST(
              COALESCE(ilb.qty_on_hand, 0) - COALESCE(ilb.qty_reserved, 0),
              COALESCE(ib.qty_on_hand, 0) - COALESCE(ib.qty_reserved, 0)
            )
          ) AS available_base_qty
          FROM public.item_batch_locations ilb
          JOIN public.item_batches ib
            ON ib.id = ilb.item_batch_id
           AND ib.company_id = ilb.company_id
           AND ib.deleted_at IS NULL
          WHERE ilb.company_id = p_company_id
            AND ilb.item_id = v_dni.item_id
            AND ilb.warehouse_id = v_dni.fulfilling_warehouse_id
            AND ilb.deleted_at IS NULL
        ) source_rows;

        IF v_total_available_base < v_required_base_qty THEN
          RAISE EXCEPTION 'PICK_ALLOCATION_INSUFFICIENT_BATCH_QUANTITY';
        END IF;

        v_remaining_base_qty := v_required_base_qty;

        FOR v_source IN
          SELECT
            ilb.id AS batch_location_id,
            ilb.location_id,
            ilb.batch_location_sku,
            ib.id AS item_batch_id,
            ib.batch_code,
            ib.received_at,
            GREATEST(
              0,
              LEAST(
                COALESCE(ilb.qty_on_hand, 0) - COALESCE(ilb.qty_reserved, 0),
                COALESCE(ib.qty_on_hand, 0) - COALESCE(ib.qty_reserved, 0)
              )
            ) AS available_base_qty
          FROM public.item_batch_locations ilb
          JOIN public.item_batches ib
            ON ib.id = ilb.item_batch_id
           AND ib.company_id = ilb.company_id
           AND ib.deleted_at IS NULL
          WHERE ilb.company_id = p_company_id
            AND ilb.item_id = v_dni.item_id
            AND ilb.warehouse_id = v_dni.fulfilling_warehouse_id
            AND ilb.deleted_at IS NULL
            AND GREATEST(
              0,
              LEAST(
                COALESCE(ilb.qty_on_hand, 0) - COALESCE(ilb.qty_reserved, 0),
                COALESCE(ib.qty_on_hand, 0) - COALESCE(ib.qty_reserved, 0)
              )
            ) > 0
          ORDER BY ib.received_at ASC, ilb.created_at ASC, ilb.id ASC
        LOOP
          EXIT WHEN v_remaining_base_qty <= 0;

          v_take_base_qty := LEAST(v_remaining_base_qty, v_source.available_base_qty);
          IF v_take_base_qty <= 0 THEN
            CONTINUE;
          END IF;

          IF v_remaining_base_qty = v_required_base_qty THEN
            UPDATE public.delivery_note_items
            SET suggested_pick_location_id = v_source.location_id,
                suggested_pick_batch_code = v_source.batch_code,
                suggested_pick_batch_received_at = v_source.received_at,
                suggested_batch_location_sku = v_source.batch_location_sku,
                updated_at = v_now
            WHERE id = v_dni.id
              AND company_id = p_company_id;
          END IF;

          INSERT INTO public.delivery_note_item_picks (
            company_id,
            dn_id,
            delivery_note_item_id,
            pick_list_id,
            item_id,
            source_warehouse_id,
            picked_location_id,
            picked_batch_code,
            picked_batch_received_at,
            batch_location_sku,
            picked_qty,
            dispatched_qty,
            is_mismatch_warning_acknowledged,
            created_by,
            updated_by,
            created_at,
            updated_at
          )
          VALUES (
            p_company_id,
            p_dn_id,
            v_dni.id,
            v_pick_list_id,
            v_dni.item_id,
            v_dni.fulfilling_warehouse_id,
            v_source.location_id,
            v_source.batch_code,
            v_source.received_at,
            v_source.batch_location_sku,
            0,
            0,
            FALSE,
            p_user_id,
            p_user_id,
            v_now,
            v_now
          );

          v_remaining_base_qty := v_remaining_base_qty - v_take_base_qty;
        END LOOP;
      ELSE
        UPDATE public.delivery_note_items
        SET suggested_pick_location_id = v_first_source.location_id,
            suggested_pick_batch_code = v_first_source.batch_code,
            suggested_pick_batch_received_at = v_first_source.received_at,
            suggested_batch_location_sku = v_first_source.batch_location_sku,
            updated_at = v_now
        WHERE id = v_dni.id
          AND company_id = p_company_id;
      END IF;
    ELSE
      UPDATE public.delivery_note_items
      SET suggested_pick_location_id = v_first_source.location_id,
          suggested_pick_batch_code = v_first_source.batch_code,
          suggested_pick_batch_received_at = v_first_source.received_at,
          suggested_batch_location_sku = v_first_source.batch_location_sku,
          updated_at = v_now
      WHERE id = v_dni.id
        AND company_id = p_company_id;
    END IF;
  END LOOP;

  IF v_pending_count = 0 THEN
    RAISE EXCEPTION 'PICK_LIST_NO_PENDING_LINES';
  END IF;

  UPDATE public.delivery_notes
  SET status = 'queued_for_picking',
      updated_at = v_now,
      updated_by = p_user_id
  WHERE id = p_dn_id
    AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'pickListId', v_pick_list_id,
    'pickListNo', v_pick_list_no
  );
END;
$function$;

COMMENT ON FUNCTION public.create_pick_list_with_allocation(
  UUID,
  UUID,
  UUID,
  UUID[],
  TEXT,
  UUID,
  TEXT
) IS 'Atomically creates a pick list and applies single-source or split batch allocation guidance.';

COMMIT;
