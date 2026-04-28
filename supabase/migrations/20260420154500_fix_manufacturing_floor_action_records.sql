-- ============================================================================
-- Migration: Fix manufacturing floor action record checks
-- Description:
--   - Avoids reading PL/pgSQL RECORD fields before a SELECT INTO assigns them.
--   - Stores the event operation id explicitly for floor action event logging.
-- Date: 2026-04-20
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_manufacturing_floor_action_transaction(
  p_manufacturing_order_id UUID,
  p_action TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_order RECORD;
  v_current_operation RECORD;
  v_next_operation RECORD;
  v_event_operation_id UUID;
  v_from_status TEXT;
  v_to_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_order
  FROM public.manufacturing_orders
  WHERE id = p_manufacturing_order_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'Manufacturing order not found';
  END IF;

  IF v_order.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Completed or cancelled manufacturing orders cannot be changed';
  END IF;

  v_from_status := v_order.status;

  IF p_action = 'hold' THEN
    UPDATE public.manufacturing_orders
    SET status = 'on_hold', updated_by = v_user_id
    WHERE id = p_manufacturing_order_id;
    v_to_status := 'on_hold';
  ELSIF p_action = 'resume' THEN
    SELECT *
    INTO v_current_operation
    FROM public.manufacturing_operations
    WHERE manufacturing_order_id = p_manufacturing_order_id
      AND status = 'in_progress'
      AND deleted_at IS NULL
    ORDER BY sequence_no ASC
    LIMIT 1;

    IF FOUND THEN
      v_to_status := 'in_progress';
      v_event_operation_id := v_current_operation.id;
    ELSE
      v_to_status := 'ready';
    END IF;

    UPDATE public.manufacturing_orders
    SET status = v_to_status, updated_by = v_user_id
    WHERE id = p_manufacturing_order_id;
  ELSIF p_action = 'start' THEN
    SELECT *
    INTO v_current_operation
    FROM public.manufacturing_operations
    WHERE manufacturing_order_id = p_manufacturing_order_id
      AND status IN ('pending', 'blocked')
      AND deleted_at IS NULL
    ORDER BY sequence_no ASC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No pending operation found';
    END IF;

    v_event_operation_id := v_current_operation.id;

    UPDATE public.manufacturing_operations
    SET status = 'in_progress',
        started_at = COALESCE(started_at, now()),
        updated_by = v_user_id
    WHERE id = v_current_operation.id;

    UPDATE public.manufacturing_orders
    SET status = CASE WHEN v_current_operation.operation_type = 'quality_check' THEN 'quality_check' ELSE 'in_progress' END,
        started_at = COALESCE(started_at, now()),
        current_workstation_id = v_current_operation.workstation_id,
        updated_by = v_user_id
    WHERE id = p_manufacturing_order_id;

    v_to_status := CASE WHEN v_current_operation.operation_type = 'quality_check' THEN 'quality_check' ELSE 'in_progress' END;
  ELSIF p_action = 'complete_step' THEN
    SELECT *
    INTO v_current_operation
    FROM public.manufacturing_operations
    WHERE manufacturing_order_id = p_manufacturing_order_id
      AND status = 'in_progress'
      AND deleted_at IS NULL
    ORDER BY sequence_no ASC
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No in-progress operation found';
    END IF;

    v_event_operation_id := v_current_operation.id;

    UPDATE public.manufacturing_operations
    SET status = 'completed',
        completed_at = now(),
        updated_by = v_user_id
    WHERE id = v_current_operation.id;

    SELECT *
    INTO v_next_operation
    FROM public.manufacturing_operations
    WHERE manufacturing_order_id = p_manufacturing_order_id
      AND status = 'pending'
      AND deleted_at IS NULL
    ORDER BY sequence_no ASC
    LIMIT 1;

    IF NOT FOUND THEN
      UPDATE public.manufacturing_orders
      SET status = 'completed',
          completed_at = now(),
          updated_by = v_user_id
      WHERE id = p_manufacturing_order_id;
      v_to_status := 'completed';
    ELSE
      v_event_operation_id := v_next_operation.id;

      UPDATE public.manufacturing_operations
      SET status = 'in_progress',
          started_at = COALESCE(started_at, now()),
          updated_by = v_user_id
      WHERE id = v_next_operation.id;

      v_to_status := CASE WHEN v_next_operation.operation_type = 'quality_check' THEN 'quality_check' ELSE 'in_progress' END;

      UPDATE public.manufacturing_orders
      SET status = v_to_status,
          current_workstation_id = v_next_operation.workstation_id,
          updated_by = v_user_id
      WHERE id = p_manufacturing_order_id;
    END IF;
  ELSIF p_action = 'complete' THEN
    UPDATE public.manufacturing_operations
    SET status = 'completed',
        completed_at = COALESCE(completed_at, now()),
        updated_by = v_user_id
    WHERE manufacturing_order_id = p_manufacturing_order_id
      AND status <> 'completed'
      AND deleted_at IS NULL;

    UPDATE public.manufacturing_orders
    SET status = 'completed',
        completed_at = now(),
        updated_by = v_user_id
    WHERE id = p_manufacturing_order_id;
    v_to_status := 'completed';
  ELSE
    RAISE EXCEPTION 'Unsupported manufacturing floor action';
  END IF;

  INSERT INTO public.manufacturing_order_events (
    company_id,
    manufacturing_order_id,
    manufacturing_operation_id,
    event_type,
    event_note,
    from_status,
    to_status,
    created_by
  )
  VALUES (
    v_order.company_id,
    p_manufacturing_order_id,
    v_event_operation_id,
    p_action,
    p_note,
    v_from_status,
    v_to_status,
    v_user_id
  );

  RETURN p_manufacturing_order_id;
END;
$$;
