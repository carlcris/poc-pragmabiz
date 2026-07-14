BEGIN;

CREATE OR REPLACE FUNCTION public.submit_grn_receiving_transaction(
  p_company_id UUID,
  p_user_id UUID,
  p_grn_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_receiving_patch JSONB DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stock_transaction_code TEXT;
BEGIN
  IF p_receiving_patch IS NOT NULL THEN
    PERFORM public.save_grn_receiving(
      p_company_id,
      p_user_id,
      p_grn_id,
      p_receiving_patch
    );
  END IF;

  v_stock_transaction_code := public.submit_grn_to_putaway(
    p_company_id,
    p_user_id,
    p_grn_id,
    p_notes
  );

  RETURN v_stock_transaction_code;
END;
$$;

COMMENT ON FUNCTION public.submit_grn_receiving_transaction(UUID, UUID, UUID, TEXT, JSONB) IS
  'Atomically saves an optional bounded GRN receiving patch and submits the GRN to putaway. A submit failure rolls back the optional save.';

REVOKE ALL ON FUNCTION public.submit_grn_receiving_transaction(UUID, UUID, UUID, TEXT, JSONB)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_grn_receiving_transaction(UUID, UUID, UUID, TEXT, JSONB)
  TO authenticated, service_role;

COMMIT;
