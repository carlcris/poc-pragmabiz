-- Remove remaining manual UTC coercion from timestamptz write helpers.

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

  RETURN v_prefix || '-' || lpad(v_next_number::TEXT, p_digits, '0');
END;
$function$;
