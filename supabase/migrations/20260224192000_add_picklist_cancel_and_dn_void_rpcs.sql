-- ============================================================================
-- Migration: Transactional pick-list cancel reset + DN void cleanup RPCs
-- Version: 20260224192000
-- Description: Moves multi-step cancellation/void cleanup into transactional
--              SQL functions to avoid partial app-layer failures.
-- Date: 2026-02-24
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.cancel_pick_list_reset_progress(
  p_company_id UUID,
  p_user_id UUID,
  p_pick_list_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pick_list pick_lists%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_has_dispatched BOOLEAN := FALSE;
BEGIN
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

  SELECT EXISTS (
    SELECT 1
    FROM delivery_note_items dni
    WHERE dni.company_id = p_company_id
      AND dni.dn_id = v_pick_list.dn_id
      AND COALESCE(dni.dispatched_qty, 0) > 0
  )
  INTO v_has_dispatched;

  IF v_has_dispatched THEN
    RAISE EXCEPTION 'Cannot cancel pick list after dispatch has started';
  END IF;

  UPDATE pick_list_items
  SET
    picked_qty = 0,
    short_qty = 0,
    updated_at = v_now,
    updated_by = p_user_id
  WHERE company_id = p_company_id
    AND pick_list_id = p_pick_list_id;

  UPDATE delivery_note_item_picks
  SET
    deleted_at = v_now,
    updated_at = v_now,
    updated_by = p_user_id
  WHERE company_id = p_company_id
    AND pick_list_id = p_pick_list_id
    AND deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION public.cancel_pick_list_reset_progress(UUID, UUID, UUID) IS
  'Pre-dispatch pick-list cancel cleanup: resets pick_list_items and soft-deletes delivery_note_item_picks while retaining DN suggested overrides.';

CREATE OR REPLACE FUNCTION public.void_delivery_note_pre_dispatch(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dn delivery_notes%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_reason TEXT := NULLIF(BTRIM(p_reason), '');
  v_pick_cancel_reason TEXT;
  v_has_dispatched BOOLEAN := FALSE;
  v_rel RECORD;
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

  IF v_dn.status NOT IN ('draft', 'confirmed', 'queued_for_picking', 'picking_in_progress', 'dispatch_ready') THEN
    RAISE EXCEPTION 'Delivery note can only be voided before dispatch';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM delivery_note_items dni
    WHERE dni.company_id = p_company_id
      AND dni.dn_id = p_dn_id
      AND COALESCE(dni.dispatched_qty, 0) > 0
  )
  INTO v_has_dispatched;

  IF v_has_dispatched THEN
    RAISE EXCEPTION 'Delivery note can only be voided before dispatch';
  END IF;

  FOR v_rel IN
    SELECT
      dni.item_id,
      dni.fulfilling_warehouse_id AS warehouse_id,
      SUM(GREATEST(0, COALESCE(dni.allocated_qty, 0) - COALESCE(dni.dispatched_qty, 0)))::NUMERIC AS qty_to_release
    FROM delivery_note_items dni
    WHERE dni.company_id = p_company_id
      AND dni.dn_id = p_dn_id
      AND dni.fulfilling_warehouse_id IS NOT NULL
    GROUP BY dni.item_id, dni.fulfilling_warehouse_id
  LOOP
    IF COALESCE(v_rel.qty_to_release, 0) <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE item_warehouse iw
    SET
      reserved_stock = GREATEST(0, COALESCE(iw.reserved_stock, 0) - v_rel.qty_to_release),
      updated_at = v_now,
      updated_by = p_user_id
    WHERE iw.company_id = p_company_id
      AND iw.item_id = v_rel.item_id
      AND iw.warehouse_id = v_rel.warehouse_id
      AND iw.deleted_at IS NULL;
  END LOOP;

  v_pick_cancel_reason := 'Delivery note voided' || COALESCE(': ' || v_reason, '');

  UPDATE pick_list_items pli
  SET
    picked_qty = 0,
    short_qty = 0,
    updated_at = v_now,
    updated_by = p_user_id
  FROM pick_lists pl
  WHERE pl.id = pli.pick_list_id
    AND pl.company_id = p_company_id
    AND pl.dn_id = p_dn_id
    AND pl.deleted_at IS NULL
    AND pli.company_id = p_company_id;

  UPDATE pick_lists
  SET
    status = 'cancelled',
    cancel_reason = v_pick_cancel_reason,
    updated_at = v_now,
    updated_by = p_user_id
  WHERE company_id = p_company_id
    AND dn_id = p_dn_id
    AND deleted_at IS NULL
    AND status <> 'cancelled';

  UPDATE delivery_note_item_picks
  SET
    deleted_at = v_now,
    updated_at = v_now,
    updated_by = p_user_id
  WHERE company_id = p_company_id
    AND dn_id = p_dn_id
    AND deleted_at IS NULL;

  UPDATE delivery_note_items
  SET
    picked_qty = 0,
    short_qty = 0,
    updated_at = v_now
  WHERE company_id = p_company_id
    AND dn_id = p_dn_id;

  UPDATE delivery_notes
  SET
    status = 'voided',
    voided_at = v_now,
    void_reason = v_reason,
    updated_at = v_now,
    updated_by = p_user_id
  WHERE id = p_dn_id
    AND company_id = p_company_id;
END;
$$;

COMMENT ON FUNCTION public.void_delivery_note_pre_dispatch(UUID, UUID, UUID, TEXT) IS
  'Transactional pre-dispatch DN void: releases aggregate reserved stock, cancels pick lists, clears pick execution rows, resets DN pick quantities, and marks DN voided.';

COMMIT;
