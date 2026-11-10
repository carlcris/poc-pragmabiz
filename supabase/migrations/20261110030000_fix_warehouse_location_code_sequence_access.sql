BEGIN;

-- Preserve the complete allocated number when it exceeds the requested padding.
CREATE OR REPLACE FUNCTION public.generate_document_code(
  p_company_id UUID,
  p_code_prefix TEXT,
  p_digits INTEGER DEFAULT 9
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prefix TEXT := btrim(p_code_prefix);
  v_next_number BIGINT;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'generate_document_code requires company_id';
  END IF;

  IF v_prefix IS NULL OR v_prefix = '' THEN
    RAISE EXCEPTION 'generate_document_code requires a non-empty code_prefix';
  END IF;

  IF p_digits IS NULL OR p_digits < 1 OR p_digits > 18 THEN
    RAISE EXCEPTION 'generate_document_code requires digits between 1 and 18';
  END IF;

  INSERT INTO public.document_code_sequences (company_id, code_prefix, last_number)
  VALUES (p_company_id, v_prefix, 1)
  ON CONFLICT (company_id, code_prefix)
  DO UPDATE SET
    last_number = public.document_code_sequences.last_number + 1,
    updated_at = now()
  RETURNING last_number INTO v_next_number;

  RETURN v_prefix || '-' || lpad(v_next_number::TEXT, GREATEST(p_digits, length(v_next_number::TEXT)), '0');
END;
$function$;

-- Consume the allocator result without exposing its private sequence table.
CREATE OR REPLACE FUNCTION public.next_warehouse_location_code(
  p_company UUID, p_warehouse UUID, p_parent_code TEXT, p_type TEXT
) RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v_prefix TEXT; v_namespace TEXT; v_number BIGINT; v_code TEXT; v_allocated_code TEXT;
BEGIN
  v_prefix := concat_ws('-', NULLIF(p_parent_code, ''), public.warehouse_location_type_prefix(p_type));
  IF public.warehouse_location_type_prefix(p_type) IS NULL THEN RAISE EXCEPTION 'LOCATION_TYPE_INVALID'; END IF;
  IF length(v_prefix) > 98 THEN RAISE EXCEPTION 'LOCATION_CODE_TOO_LONG'; END IF;
  v_namespace := 'warehouse-location:' || p_warehouse::TEXT || ':' || v_prefix;
  LOOP
    -- Nine digit allocation, rendered compactly for warehouse labels. Never truncate overflow.
    v_allocated_code := public.generate_document_code(p_company, v_namespace, 9);
    v_number := substring(v_allocated_code FROM length(v_namespace) + 2)::BIGINT;
    v_code := v_prefix || lpad(v_number::TEXT, GREATEST(2, length(v_number::TEXT)), '0');
    IF length(v_code) > 100 THEN RAISE EXCEPTION 'LOCATION_CODE_TOO_LONG'; END IF;
    -- Existing/manual historical codes and soft-deleted codes remain reserved.
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.warehouse_locations l
      WHERE l.company_id = p_company AND l.warehouse_id = p_warehouse AND l.code = v_code);
  END LOOP;
  RETURN v_code;
END $$;

COMMIT;
