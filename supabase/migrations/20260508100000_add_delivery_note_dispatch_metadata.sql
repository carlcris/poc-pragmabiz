BEGIN;

ALTER TABLE public.delivery_notes
  ADD COLUMN IF NOT EXISTS helper_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS delivery_time TIME NULL,
  ADD COLUMN IF NOT EXISTS plate_number TEXT NULL;

CREATE OR REPLACE FUNCTION public.post_delivery_note_dispatch(
  p_company_id UUID,
  p_user_id UUID,
  p_dn_id UUID,
  p_business_unit_id UUID,
  p_dispatch_date DATE,
  p_notes TEXT,
  p_driver_name TEXT,
  p_driver_signature TEXT,
  p_items JSONB,
  p_helper_name TEXT,
  p_delivery_time TIME,
  p_plate_number TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  PERFORM public.post_delivery_note_dispatch(
    p_company_id,
    p_user_id,
    p_dn_id,
    p_business_unit_id,
    p_dispatch_date,
    p_notes,
    p_driver_name,
    p_driver_signature,
    p_items
  );

  UPDATE public.delivery_notes
  SET
    helper_name = COALESCE(NULLIF(BTRIM(p_helper_name), ''), helper_name),
    delivery_time = COALESCE(p_delivery_time, delivery_time),
    plate_number = COALESCE(NULLIF(BTRIM(p_plate_number), ''), plate_number),
    updated_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_dn_id
    AND company_id = p_company_id
    AND deleted_at IS NULL;
END;
$$;

COMMIT;
