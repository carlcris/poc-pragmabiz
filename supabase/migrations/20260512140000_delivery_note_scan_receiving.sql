-- ============================================================================
-- Migration: Delivery Note Scan Receiving
-- Description: Adds scan-audited receiving for internal delivery notes.
-- ============================================================================

BEGIN;

ALTER TABLE public.delivery_notes
  ADD COLUMN IF NOT EXISTS receiving_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receiving_started_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS receiving_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receiving_completed_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS received_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS receiving_notes TEXT;

ALTER TABLE public.delivery_note_items
  ADD COLUMN IF NOT EXISTS received_qty NUMERIC(20, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receiving_discrepancy_flag BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS receiving_notes TEXT;

CREATE TABLE IF NOT EXISTS public.delivery_note_item_receiving_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_unit_id UUID REFERENCES public.business_units(id),
  dn_id UUID NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  dn_item_id UUID NOT NULL REFERENCES public.delivery_note_items(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id),
  item_unit_option_id UUID REFERENCES public.item_unit_options(id),
  uom_id UUID NOT NULL REFERENCES public.units_of_measure(id),
  box_id TEXT NOT NULL,
  qr_code TEXT NOT NULL,
  qr_qty NUMERIC(20, 4) NOT NULL,
  accepted_qty NUMERIC(20, 4) NOT NULL,
  adjustment_reason TEXT,
  notes TEXT,
  scanned_by UUID NOT NULL REFERENCES public.users(id),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES public.users(id),
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT delivery_note_item_receiving_scans_qty_chk
    CHECK (qr_qty > 0 AND accepted_qty > 0),
  CONSTRAINT delivery_note_item_receiving_scans_adjustment_reason_chk
    CHECK (accepted_qty = qr_qty OR NULLIF(BTRIM(adjustment_reason), '') IS NOT NULL),
  CONSTRAINT delivery_note_item_receiving_scans_box_unique
    UNIQUE (company_id, dn_id, box_id)
);

CREATE TABLE IF NOT EXISTS public.delivery_note_receiving_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  business_unit_id UUID REFERENCES public.business_units(id),
  dn_id UUID NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.items(id),
  item_unit_option_id UUID REFERENCES public.item_unit_options(id),
  uom_id UUID NOT NULL REFERENCES public.units_of_measure(id),
  box_id TEXT NOT NULL,
  qr_code TEXT NOT NULL,
  qr_qty NUMERIC(20, 4) NOT NULL,
  accepted_qty NUMERIC(20, 4) NOT NULL,
  batch_number TEXT,
  location_id UUID REFERENCES public.warehouse_locations(id),
  reason TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'accepted', 'rejected', 'resolved')),
  scanned_by UUID NOT NULL REFERENCES public.users(id),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT delivery_note_receiving_exceptions_qty_chk
    CHECK (qr_qty > 0 AND accepted_qty > 0),
  CONSTRAINT delivery_note_receiving_exceptions_box_unique
    UNIQUE (company_id, dn_id, box_id)
);

CREATE INDEX IF NOT EXISTS idx_dn_receiving_status
  ON public.delivery_notes(status, requesting_warehouse_id, receiving_started_at)
  WHERE deleted_at IS NULL AND status IN ('dispatched', 'received');

CREATE INDEX IF NOT EXISTS idx_dn_receiving_scans_dn
  ON public.delivery_note_item_receiving_scans(company_id, dn_id, dn_item_id)
  WHERE voided_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_dn_receiving_exceptions_dn
  ON public.delivery_note_receiving_exceptions(company_id, dn_id, status);

CREATE OR REPLACE FUNCTION public.refresh_delivery_note_item_received_qty(
  p_company_id UUID,
  p_dn_item_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_received_qty NUMERIC;
  v_dispatched_qty NUMERIC;
BEGIN
  SELECT COALESCE(SUM(accepted_qty), 0)
  INTO v_received_qty
  FROM public.delivery_note_item_receiving_scans
  WHERE company_id = p_company_id
    AND dn_item_id = p_dn_item_id
    AND voided_at IS NULL;

  SELECT COALESCE(dispatched_qty, 0)
  INTO v_dispatched_qty
  FROM public.delivery_note_items
  WHERE company_id = p_company_id
    AND id = p_dn_item_id;

  UPDATE public.delivery_note_items
  SET
    received_qty = v_received_qty,
    receiving_discrepancy_flag = v_received_qty <> COALESCE(v_dispatched_qty, 0),
    updated_at = now()
  WHERE company_id = p_company_id
    AND id = p_dn_item_id;

  RETURN v_received_qty;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_delivery_note_receiving_scan(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_qr_code TEXT,
  p_box_id TEXT,
  p_item_id UUID,
  p_qr_qty NUMERIC,
  p_accepted_qty NUMERIC DEFAULT NULL,
  p_item_unit_option_id UUID DEFAULT NULL,
  p_adjustment_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_batch_number TEXT DEFAULT NULL,
  p_location_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dn public.delivery_notes%ROWTYPE;
  v_dn_item public.delivery_note_items%ROWTYPE;
  v_item public.items%ROWTYPE;
  v_item_unit_option_id UUID;
  v_uom_id UUID;
  v_match_count INTEGER;
  v_existing_received NUMERIC;
  v_next_received NUMERIC;
  v_accepted_qty NUMERIC;
  v_scan_id UUID;
  v_exception_id UUID;
BEGIN
  IF NULLIF(BTRIM(p_box_id), '') IS NULL THEN
    RAISE EXCEPTION 'Box ID is required';
  END IF;

  IF p_qr_qty IS NULL OR p_qr_qty <= 0 THEN
    RAISE EXCEPTION 'Scanned quantity must be greater than zero';
  END IF;

  v_accepted_qty := COALESCE(p_accepted_qty, p_qr_qty);
  IF v_accepted_qty <= 0 THEN
    RAISE EXCEPTION 'Accepted quantity must be greater than zero';
  END IF;

  IF v_accepted_qty <> p_qr_qty AND NULLIF(BTRIM(p_adjustment_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Manual quantity adjustment requires a reason';
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

  IF v_dn.status <> 'dispatched' THEN
    RAISE EXCEPTION 'Only dispatched delivery notes can be received';
  END IF;

  SELECT *
  INTO v_item
  FROM public.items
  WHERE id = p_item_id
    AND company_id = p_company_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found';
  END IF;

  SELECT iuo.id, iuo.uom_id
  INTO v_item_unit_option_id, v_uom_id
  FROM public.item_unit_options iuo
  WHERE iuo.company_id = p_company_id
    AND iuo.item_id = p_item_id
    AND iuo.deleted_at IS NULL
    AND (
      (p_item_unit_option_id IS NOT NULL AND iuo.id = p_item_unit_option_id)
      OR (p_item_unit_option_id IS NULL AND iuo.is_default)
      OR (p_item_unit_option_id IS NULL AND iuo.is_base)
    )
  ORDER BY
    CASE
      WHEN p_item_unit_option_id IS NOT NULL AND iuo.id = p_item_unit_option_id THEN 0
      WHEN iuo.is_default THEN 1
      WHEN iuo.is_base THEN 2
      ELSE 3
    END,
    iuo.sort_order,
    iuo.created_at
  LIMIT 1;

  v_item_unit_option_id := COALESCE(v_item_unit_option_id, p_item_unit_option_id);
  v_uom_id := COALESCE(v_uom_id, v_item.uom_id);

  SELECT COUNT(*)
  INTO v_match_count
  FROM public.delivery_note_items dni
  WHERE dni.company_id = p_company_id
    AND dni.dn_id = p_dn_id
    AND dni.item_id = p_item_id
    AND COALESCE(dni.is_voided, FALSE) = FALSE
    AND (
      p_item_unit_option_id IS NULL
      OR dni.item_unit_option_id = p_item_unit_option_id
      OR dni.item_unit_option_id IS NULL
    );

  IF v_match_count > 1 AND p_item_unit_option_id IS NULL THEN
    RAISE EXCEPTION 'Multiple delivery note lines match this item. Scan a unit-specific barcode.';
  END IF;

  IF v_match_count > 0 THEN
    SELECT *
    INTO v_dn_item
    FROM public.delivery_note_items dni
    WHERE dni.company_id = p_company_id
      AND dni.dn_id = p_dn_id
      AND dni.item_id = p_item_id
      AND COALESCE(dni.is_voided, FALSE) = FALSE
      AND (
        p_item_unit_option_id IS NULL
        OR dni.item_unit_option_id = p_item_unit_option_id
        OR dni.item_unit_option_id IS NULL
      )
    ORDER BY dni.created_at, dni.id
    LIMIT 1
    FOR UPDATE;

    SELECT COALESCE(SUM(accepted_qty), 0)
    INTO v_existing_received
    FROM public.delivery_note_item_receiving_scans
    WHERE company_id = p_company_id
      AND dn_item_id = v_dn_item.id
      AND voided_at IS NULL;

    v_next_received := v_existing_received + v_accepted_qty;
    IF v_next_received > COALESCE(v_dn_item.dispatched_qty, 0) THEN
      RAISE EXCEPTION 'Expected item quantity would exceed dispatched quantity';
    END IF;

    IF v_dn.receiving_started_at IS NULL THEN
      UPDATE public.delivery_notes
      SET
        receiving_started_at = now(),
        receiving_started_by = p_user_id,
        updated_by = p_user_id,
        updated_at = now()
      WHERE id = p_dn_id
        AND company_id = p_company_id;
    END IF;

    INSERT INTO public.delivery_note_item_receiving_scans (
      company_id,
      business_unit_id,
      dn_id,
      dn_item_id,
      item_id,
      item_unit_option_id,
      uom_id,
      box_id,
      qr_code,
      qr_qty,
      accepted_qty,
      adjustment_reason,
      notes,
      scanned_by
    )
    VALUES (
      p_company_id,
      p_business_unit_id,
      p_dn_id,
      v_dn_item.id,
      p_item_id,
      COALESCE(v_dn_item.item_unit_option_id, v_item_unit_option_id),
      COALESCE(v_dn_item.uom_id, v_uom_id),
      BTRIM(p_box_id),
      COALESCE(p_qr_code, ''),
      p_qr_qty,
      v_accepted_qty,
      NULLIF(BTRIM(p_adjustment_reason), ''),
      NULLIF(BTRIM(p_notes), ''),
      p_user_id
    )
    RETURNING id INTO v_scan_id;

    PERFORM public.refresh_delivery_note_item_received_qty(p_company_id, v_dn_item.id);

    RETURN jsonb_build_object(
      'type', 'scan',
      'scanId', v_scan_id,
      'deliveryNoteItemId', v_dn_item.id,
      'isUnexpected', FALSE
    );
  END IF;

  IF v_dn.receiving_started_at IS NULL THEN
    UPDATE public.delivery_notes
    SET
      receiving_started_at = now(),
      receiving_started_by = p_user_id,
      updated_by = p_user_id,
      updated_at = now()
    WHERE id = p_dn_id
      AND company_id = p_company_id;
  END IF;

  INSERT INTO public.delivery_note_receiving_exceptions (
    company_id,
    business_unit_id,
    dn_id,
    item_id,
    item_unit_option_id,
    uom_id,
    box_id,
    qr_code,
    qr_qty,
    accepted_qty,
    batch_number,
    location_id,
    reason,
    notes,
    scanned_by
  )
  VALUES (
    p_company_id,
    p_business_unit_id,
    p_dn_id,
    p_item_id,
    v_item_unit_option_id,
    v_uom_id,
    BTRIM(p_box_id),
    COALESCE(p_qr_code, ''),
    p_qr_qty,
    v_accepted_qty,
    NULLIF(BTRIM(p_batch_number), ''),
    p_location_id,
    'Item scanned during receiving but not found in the delivery note',
    NULLIF(BTRIM(p_notes), ''),
    p_user_id
  )
  RETURNING id INTO v_exception_id;

  RETURN jsonb_build_object(
    'type', 'exception',
    'exceptionId', v_exception_id,
    'isUnexpected', TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.void_delivery_note_receiving_scan(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_scan_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scan public.delivery_note_item_receiving_scans%ROWTYPE;
  v_dn public.delivery_notes%ROWTYPE;
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

  IF v_dn.status <> 'dispatched' THEN
    RAISE EXCEPTION 'Only in-progress dispatched delivery notes can have scans voided';
  END IF;

  SELECT *
  INTO v_scan
  FROM public.delivery_note_item_receiving_scans
  WHERE id = p_scan_id
    AND company_id = p_company_id
    AND dn_id = p_dn_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receiving scan not found';
  END IF;

  IF v_scan.voided_at IS NOT NULL THEN
    RETURN;
  END IF;

  UPDATE public.delivery_note_item_receiving_scans
  SET
    voided_at = now(),
    voided_by = p_user_id,
    void_reason = NULLIF(BTRIM(p_reason), ''),
    updated_at = now()
  WHERE id = p_scan_id;

  PERFORM public.refresh_delivery_note_item_received_qty(p_company_id, v_scan.dn_item_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_delivery_note_receiving(
  p_company_id UUID,
  p_business_unit_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_received_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dn public.delivery_notes%ROWTYPE;
  v_item RECORD;
  v_items JSONB := '[]'::jsonb;
  v_has_received BOOLEAN := FALSE;
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

  IF v_dn.status <> 'dispatched' THEN
    RAISE EXCEPTION 'Only dispatched delivery notes can be submitted for receiving';
  END IF;

  IF v_dn.receiving_started_at IS NULL THEN
    RAISE EXCEPTION 'Receiving has not been started';
  END IF;

  FOR v_item IN
    SELECT
      dni.id,
      COALESCE(SUM(scans.accepted_qty) FILTER (WHERE scans.voided_at IS NULL), 0) AS received_qty
    FROM public.delivery_note_items dni
    LEFT JOIN public.delivery_note_item_receiving_scans scans
      ON scans.company_id = dni.company_id
     AND scans.dn_item_id = dni.id
    WHERE dni.company_id = p_company_id
      AND dni.dn_id = p_dn_id
      AND COALESCE(dni.is_voided, FALSE) = FALSE
    GROUP BY dni.id
    ORDER BY dni.id
  LOOP
    PERFORM public.refresh_delivery_note_item_received_qty(p_company_id, v_item.id);

    IF v_item.received_qty > 0 THEN
      v_has_received := TRUE;
      v_items := v_items || jsonb_build_array(
        jsonb_build_object(
          'deliveryNoteItemId', v_item.id,
          'receivedQty', v_item.received_qty,
          'locationId', NULL
        )
      );
    END IF;
  END LOOP;

  IF NOT v_has_received THEN
    RAISE EXCEPTION 'No receiving scans have been recorded';
  END IF;

  PERFORM public.post_delivery_note_receive(
    p_company_id,
    p_user_id,
    p_dn_id,
    p_business_unit_id,
    COALESCE(p_received_date, now()::DATE),
    p_notes,
    v_items
  );

  UPDATE public.delivery_notes
  SET
    receiving_completed_at = now(),
    receiving_completed_by = p_user_id,
    received_by = p_user_id,
    receiving_notes = COALESCE(NULLIF(BTRIM(p_notes), ''), receiving_notes),
    updated_by = p_user_id,
    updated_at = now()
  WHERE id = p_dn_id
    AND company_id = p_company_id;
END;
$$;

COMMIT;
