-- Fix get_next_journal_code function to handle non-numeric journal codes
-- This fixes an issue where custom journal codes like "JE-OPENING-INV" would break the function

CREATE OR REPLACE FUNCTION public.get_next_journal_code(p_company_id uuid)
RETURNS character varying
LANGUAGE plpgsql
AS $function$
DECLARE
    last_code VARCHAR;
    last_number INTEGER;
    next_number INTEGER;
    next_code VARCHAR;
BEGIN
    -- Get last numeric journal code for company (JE-XXXXX format)
    -- This filters out non-numeric codes like "JE-OPENING-INV"
    SELECT journal_code INTO last_code
    FROM journal_entries
    WHERE company_id = p_company_id
      AND journal_code ~ '^JE-[0-9]{5}$'
    ORDER BY created_at DESC
    LIMIT 1;

    IF last_code IS NULL THEN
        RETURN 'JE-00001';
    END IF;

    -- Extract number from code (JE-00001 -> 1)
    last_number := CAST(SUBSTRING(last_code FROM '[0-9]+') AS INTEGER);
    next_number := last_number + 1;
    next_code := 'JE-' || LPAD(next_number::TEXT, 5, '0');

    RETURN next_code;
END;
$function$;
