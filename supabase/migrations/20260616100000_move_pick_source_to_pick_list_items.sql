BEGIN;

ALTER TABLE public.pick_list_items
  ADD COLUMN IF NOT EXISTS suggested_pick_location_id UUID REFERENCES public.warehouse_locations(id),
  ADD COLUMN IF NOT EXISTS suggested_pick_batch_code VARCHAR(150),
  ADD COLUMN IF NOT EXISTS suggested_pick_batch_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suggested_batch_location_sku VARCHAR(10);

COMMENT ON COLUMN public.pick_list_items.suggested_pick_location_id IS
  'Planned pick location for this pick-list line.';
COMMENT ON COLUMN public.pick_list_items.suggested_pick_batch_code IS
  'Planned pick batch code for this pick-list line.';
COMMENT ON COLUMN public.pick_list_items.suggested_pick_batch_received_at IS
  'Planned pick batch receipt timestamp for this pick-list line.';
COMMENT ON COLUMN public.pick_list_items.suggested_batch_location_sku IS
  'Planned pick batch-location scan code for this pick-list line.';

ALTER TABLE public.delivery_note_item_picks
  ADD COLUMN IF NOT EXISTS pick_list_item_id UUID REFERENCES public.pick_list_items(id);

DROP INDEX IF EXISTS public.idx_pick_list_items_pick_list_source;
CREATE INDEX idx_pick_list_items_pick_list_source
  ON public.pick_list_items(
    company_id,
    pick_list_id,
    dn_item_id,
    suggested_pick_location_id,
    suggested_pick_batch_code,
    suggested_pick_batch_received_at
  );

DROP INDEX IF EXISTS public.idx_delivery_note_item_picks_pick_list_item;
CREATE INDEX idx_delivery_note_item_picks_pick_list_item
  ON public.delivery_note_item_picks(company_id, pick_list_item_id)
  WHERE deleted_at IS NULL;

UPDATE public.pick_list_items pli
SET
  suggested_pick_location_id = COALESCE(pli.suggested_pick_location_id, dni.suggested_pick_location_id),
  suggested_pick_batch_code = COALESCE(pli.suggested_pick_batch_code, dni.suggested_pick_batch_code),
  suggested_pick_batch_received_at = COALESCE(
    pli.suggested_pick_batch_received_at,
    dni.suggested_pick_batch_received_at
  ),
  suggested_batch_location_sku = COALESCE(
    pli.suggested_batch_location_sku,
    dni.suggested_batch_location_sku
  )
FROM public.delivery_note_items dni
WHERE dni.id = pli.dn_item_id
  AND dni.company_id = pli.company_id;

UPDATE public.delivery_note_item_picks dip
SET pick_list_item_id = pli.id
FROM public.pick_list_items pli
WHERE dip.pick_list_item_id IS NULL
  AND pli.company_id = dip.company_id
  AND pli.pick_list_id = dip.pick_list_id
  AND pli.dn_item_id = dip.delivery_note_item_id;

ALTER TABLE public.pick_list_items
  DROP CONSTRAINT IF EXISTS pick_list_items_pick_list_id_dn_item_id_key;

DROP INDEX IF EXISTS public.ux_dn_item_picks_merge_key;
CREATE UNIQUE INDEX ux_dn_item_picks_merge_key
  ON public.delivery_note_item_picks(
    pick_list_item_id,
    picked_location_id,
    picked_batch_code,
    picked_batch_received_at
  )
  WHERE deleted_at IS NULL
    AND pick_list_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reserve_delivery_note_inventory(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_dn public.delivery_notes%ROWTYPE;
  v_dni public.delivery_note_items%ROWTYPE;
  v_wh public.item_warehouse%ROWTYPE;
  v_available NUMERIC;
  v_total_allocated NUMERIC := 0;
  v_qty_per_unit NUMERIC := 1;
  v_allocated_base_qty NUMERIC := 0;
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

  IF v_dn.status <> 'draft' THEN
    RAISE EXCEPTION 'Inventory reservation only allowed while delivery note is in draft status';
  END IF;

  FOR v_dni IN
    SELECT *
    FROM public.delivery_note_items
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
    FROM public.item_warehouse
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

    UPDATE public.item_warehouse
    SET
      reserved_stock = COALESCE(reserved_stock, 0) + v_allocated_base_qty,
      updated_by = p_user_id,
      updated_at = NOW()
    WHERE id = v_wh.id;
  END LOOP;

  IF v_total_allocated <= 0 THEN
    RAISE EXCEPTION 'Delivery note has no allocatable line quantities';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reserve_delivery_note_inventory_lines(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_line_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_dn public.delivery_notes%ROWTYPE;
  v_dni public.delivery_note_items%ROWTYPE;
  v_wh public.item_warehouse%ROWTYPE;
  v_available NUMERIC;
  v_qty_per_unit NUMERIC := 1;
  v_allocated_base_qty NUMERIC := 0;
BEGIN
  IF COALESCE(array_length(p_line_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one delivery note line id is required';
  END IF;

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

  IF v_dn.status IN ('received', 'voided') THEN
    RAISE EXCEPTION 'Cannot reserve delivery note lines for received or voided delivery notes';
  END IF;

  FOR v_dni IN
    SELECT *
    FROM public.delivery_note_items
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
    FROM public.item_warehouse
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

    UPDATE public.item_warehouse
    SET
      reserved_stock = COALESCE(reserved_stock, 0) + v_allocated_base_qty,
      updated_by = p_user_id,
      updated_at = NOW()
    WHERE id = v_wh.id;
  END LOOP;
END;
$function$;

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

    IF v_first_source.available_base_qty >= v_required_base_qty THEN
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
        suggested_pick_location_id,
        suggested_pick_batch_code,
        suggested_pick_batch_received_at,
        suggested_batch_location_sku,
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
        v_first_source.location_id,
        v_first_source.batch_code,
        v_first_source.received_at,
        v_first_source.batch_location_sku,
        v_now,
        v_now
      );
      CONTINUE;
    END IF;

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
        suggested_pick_location_id,
        suggested_pick_batch_code,
        suggested_pick_batch_received_at,
        suggested_batch_location_sku,
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
        v_single_source.location_id,
        v_single_source.batch_code,
        v_single_source.received_at,
        v_single_source.batch_location_sku,
        v_now,
        v_now
      );
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
          suggested_pick_location_id,
          suggested_pick_batch_code,
          suggested_pick_batch_received_at,
          suggested_batch_location_sku,
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
          v_take_base_qty / v_qty_per_unit,
          0,
          v_take_base_qty / v_qty_per_unit,
          v_source.location_id,
          v_source.batch_code,
          v_source.received_at,
          v_source.batch_location_sku,
          v_now,
          v_now
        );

        v_remaining_base_qty := v_remaining_base_qty - v_take_base_qty;
      END LOOP;
    ELSE
      RAISE EXCEPTION 'PICK_ALLOCATION_CHOICE_REQUIRED';
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

CREATE OR REPLACE FUNCTION public.complete_pick_list_transaction(
  p_company_id UUID,
  p_user_id UUID,
  p_pick_list_id UUID,
  p_pick_rows JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pick_list public.pick_lists%ROWTYPE;
  v_dn public.delivery_notes%ROWTYPE;
  v_row JSONB;
  v_delivery_note_item_id UUID;
  v_pick_list_item_id UUID;
  v_batch_location_sku TEXT;
  v_picked_location_id UUID;
  v_picked_batch_code TEXT;
  v_picked_batch_received_at TIMESTAMPTZ;
  v_pick_qty NUMERIC;
  v_acknowledged BOOLEAN;
  v_mismatch_reason TEXT;
  v_dn_line public.delivery_note_items%ROWTYPE;
  v_pick_list_item public.pick_list_items%ROWTYPE;
  v_pick_list_item_count INTEGER;
  v_qty_per_unit NUMERIC;
  v_current_line_picked NUMERIC;
  v_next_line_picked NUMERIC;
  v_resolved_batch_location_sku TEXT;
  v_source_item_batch_id UUID;
  v_source_location_qty NUMERIC;
  v_source_batch_qty NUMERIC;
  v_existing_pick public.delivery_note_item_picks%ROWTYPE;
  v_picked_total NUMERIC;
  v_dn_picked_total NUMERIC;
  v_has_picked BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
  v_is_mismatch BOOLEAN;
BEGIN
  IF jsonb_typeof(COALESCE(p_pick_rows, '[]'::JSONB)) <> 'array' THEN
    RAISE EXCEPTION 'pickRows must be an array';
  END IF;

  SELECT *
  INTO v_pick_list
  FROM public.pick_lists
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
  FROM public.delivery_notes
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
    v_pick_list_item_id := NULLIF(v_row->>'pickListItemId', '')::UUID;
    v_delivery_note_item_id := NULLIF(v_row->>'deliveryNoteItemId', '')::UUID;
    v_batch_location_sku := NULLIF(BTRIM(COALESCE(v_row->>'batchLocationSku', '')), '');
    v_picked_location_id := NULLIF(v_row->>'pickedLocationId', '')::UUID;
    v_picked_batch_code := NULLIF(BTRIM(COALESCE(v_row->>'pickedBatchCode', '')), '');
    v_picked_batch_received_at := NULLIF(v_row->>'pickedBatchReceivedAt', '')::TIMESTAMPTZ;
    v_pick_qty := COALESCE(NULLIF(v_row->>'pickedQty', '')::NUMERIC, 0);
    v_acknowledged := COALESCE((v_row->>'isMismatchWarningAcknowledged')::BOOLEAN, FALSE);
    v_mismatch_reason := NULLIF(BTRIM(COALESCE(v_row->>'mismatchReason', '')), '');
    v_resolved_batch_location_sku := v_batch_location_sku;

    IF v_pick_qty <= 0 THEN
      RAISE EXCEPTION 'Picked quantity must be greater than zero';
    END IF;

    IF v_pick_list_item_id IS NOT NULL THEN
      SELECT *
      INTO v_pick_list_item
      FROM public.pick_list_items
      WHERE id = v_pick_list_item_id
        AND company_id = p_company_id
        AND pick_list_id = p_pick_list_id
      FOR UPDATE;
    ELSE
      IF v_delivery_note_item_id IS NULL THEN
        RAISE EXCEPTION 'pickListItemId is required';
      END IF;

      SELECT COUNT(*)
      INTO v_pick_list_item_count
      FROM public.pick_list_items
      WHERE company_id = p_company_id
        AND pick_list_id = p_pick_list_id
        AND dn_item_id = v_delivery_note_item_id;

      IF v_pick_list_item_count <> 1 THEN
        RAISE EXCEPTION 'pickListItemId is required for split pick-list lines';
      END IF;

      SELECT *
      INTO v_pick_list_item
      FROM public.pick_list_items
      WHERE company_id = p_company_id
        AND pick_list_id = p_pick_list_id
        AND dn_item_id = v_delivery_note_item_id
      FOR UPDATE;
    END IF;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid pick list item for this pick list';
    END IF;

    v_delivery_note_item_id := v_pick_list_item.dn_item_id;

    SELECT *
    INTO v_dn_line
    FROM public.delivery_note_items
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
    FROM public.item_unit_options iuo
    WHERE iuo.id = v_dn_line.item_unit_option_id
      AND iuo.company_id = p_company_id;
    v_qty_per_unit := GREATEST(COALESCE(v_qty_per_unit, 1), 1);

    SELECT COALESCE(SUM(picked_qty), 0)
    INTO v_current_line_picked
    FROM public.delivery_note_item_picks
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
      AND pick_list_item_id = v_pick_list_item.id
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
      FROM public.item_batch_locations ilb
      JOIN public.item_batches ib ON ib.id = ilb.item_batch_id
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
    FROM public.item_batches ib
    JOIN public.item_batch_locations ilb ON ilb.item_batch_id = ib.id
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

    v_is_mismatch :=
      COALESCE(v_pick_list_item.suggested_pick_location_id <> v_picked_location_id, FALSE)
      OR COALESCE(v_pick_list_item.suggested_pick_batch_code <> v_picked_batch_code, FALSE)
      OR COALESCE(v_pick_list_item.suggested_batch_location_sku <> v_resolved_batch_location_sku, FALSE);

    SELECT *
    INTO v_existing_pick
    FROM public.delivery_note_item_picks
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
      AND pick_list_item_id = v_pick_list_item.id
      AND picked_location_id = v_picked_location_id
      AND picked_batch_code = v_picked_batch_code
      AND picked_batch_received_at = v_picked_batch_received_at
      AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.delivery_note_item_picks
      SET picked_qty = v_existing_pick.picked_qty + v_pick_qty,
          batch_location_sku = v_resolved_batch_location_sku,
          picker_user_id = p_user_id,
          picked_at = v_now,
          is_mismatch_warning_acknowledged = CASE WHEN v_is_mismatch THEN v_acknowledged ELSE FALSE END,
          mismatch_reason = CASE WHEN v_is_mismatch THEN v_mismatch_reason ELSE NULL END,
          updated_at = v_now,
          updated_by = p_user_id
      WHERE id = v_existing_pick.id;
    ELSE
      INSERT INTO public.delivery_note_item_picks (
        company_id,
        dn_id,
        delivery_note_item_id,
        pick_list_item_id,
        pick_list_id,
        item_id,
        source_warehouse_id,
        picked_location_id,
        picked_batch_code,
        picked_batch_received_at,
        batch_location_sku,
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
        v_pick_list_item.id,
        p_pick_list_id,
        v_dn_line.item_id,
        v_dn_line.fulfilling_warehouse_id,
        v_picked_location_id,
        v_picked_batch_code,
        v_picked_batch_received_at,
        v_resolved_batch_location_sku,
        v_pick_qty,
        0,
        p_user_id,
        v_now,
        CASE WHEN v_is_mismatch THEN v_acknowledged ELSE FALSE END,
        CASE WHEN v_is_mismatch THEN v_mismatch_reason ELSE NULL END,
        p_user_id,
        p_user_id
      );
    END IF;
  END LOOP;

  FOR v_pick_list_item IN
    SELECT *
    FROM public.pick_list_items
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
    FOR UPDATE
  LOOP
    SELECT COALESCE(SUM(picked_qty), 0)
    INTO v_picked_total
    FROM public.delivery_note_item_picks
    WHERE company_id = p_company_id
      AND pick_list_id = p_pick_list_id
      AND pick_list_item_id = v_pick_list_item.id
      AND deleted_at IS NULL;

    v_picked_total := LEAST(v_pick_list_item.allocated_qty, COALESCE(v_picked_total, 0));
    IF v_picked_total > 0 THEN
      v_has_picked := TRUE;
    END IF;

    UPDATE public.pick_list_items
    SET picked_qty = v_picked_total,
        short_qty = GREATEST(0, v_pick_list_item.allocated_qty - v_picked_total),
        updated_at = v_now
    WHERE id = v_pick_list_item.id;
  END LOOP;

  FOR v_dn_line IN
    SELECT DISTINCT dni.*
    FROM public.delivery_note_items dni
    JOIN public.pick_list_items pli
      ON pli.dn_item_id = dni.id
     AND pli.company_id = dni.company_id
    WHERE pli.company_id = p_company_id
      AND pli.pick_list_id = p_pick_list_id
      AND dni.dn_id = v_pick_list.dn_id
    FOR UPDATE OF dni
  LOOP
    SELECT COALESCE(SUM(pli.picked_qty), 0)
    INTO v_dn_picked_total
    FROM public.pick_list_items pli
    WHERE pli.company_id = p_company_id
      AND pli.pick_list_id = p_pick_list_id
      AND pli.dn_item_id = v_dn_line.id;

    v_dn_picked_total := LEAST(COALESCE(v_dn_line.allocated_qty, 0), COALESCE(v_dn_picked_total, 0));

    UPDATE public.delivery_note_items
    SET picked_qty = v_dn_picked_total,
        short_qty = GREATEST(0, COALESCE(allocated_qty, 0) - v_dn_picked_total),
        updated_at = v_now
    WHERE id = v_dn_line.id
      AND company_id = p_company_id;
  END LOOP;

  IF NOT v_has_picked THEN
    RAISE EXCEPTION 'At least one pick list item must have picked quantity before completing';
  END IF;

  UPDATE public.pick_lists
  SET status = 'done',
      completed_at = v_now,
      updated_at = v_now,
      updated_by = p_user_id
  WHERE id = p_pick_list_id
    AND company_id = p_company_id;

  UPDATE public.delivery_notes
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

DROP INDEX IF EXISTS public.idx_delivery_note_items_suggested_batch_location_sku;

ALTER TABLE public.delivery_note_items
  DROP COLUMN IF EXISTS suggested_pick_location_id,
  DROP COLUMN IF EXISTS suggested_pick_batch_code,
  DROP COLUMN IF EXISTS suggested_pick_batch_received_at,
  DROP COLUMN IF EXISTS suggested_batch_location_sku,
  DROP COLUMN IF EXISTS has_pick_source_override,
  DROP COLUMN IF EXISTS last_pick_source_override_at,
  DROP COLUMN IF EXISTS last_pick_source_override_by;

COMMIT;
