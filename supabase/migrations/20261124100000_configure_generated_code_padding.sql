BEGIN;

ALTER TABLE public.companies
  ADD COLUMN document_code_digits INTEGER NOT NULL DEFAULT 9
    CONSTRAINT companies_document_code_digits_range CHECK (document_code_digits BETWEEN 1 AND 18),
  ADD COLUMN warehouse_location_code_digits INTEGER NOT NULL DEFAULT 2
    CONSTRAINT companies_warehouse_location_code_digits_range CHECK (warehouse_location_code_digits BETWEEN 1 AND 6);

COMMENT ON COLUMN public.companies.document_code_digits IS
  'Minimum numeric suffix width for new document codes. Sequence values expand beyond this width.';
COMMENT ON COLUMN public.companies.warehouse_location_code_digits IS
  'Minimum numeric segment width for newly allocated warehouse location codes.';

-- Reserve historical codes even where the uniqueness constraint covers active rows only.
CREATE INDEX idx_sales_invoices_reserved_code
  ON public.sales_invoices (company_id, invoice_code);
CREATE INDEX idx_invoice_payments_reserved_code
  ON public.invoice_payments (company_id, payment_code);

CREATE OR REPLACE FUNCTION public.apply_generated_document_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_column TEXT := NULLIF(btrim(TG_ARGV[0]), '');
  v_code_prefix TEXT := NULLIF(btrim(TG_ARGV[1]), '');
  v_digits INTEGER;
  v_existing_code TEXT;
  v_generated_code TEXT;
  v_code_exists BOOLEAN;
  v_global_code BOOLEAN := TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME IN (
    'grns', 'load_lists', 'stock_requisitions', 'pick_lists', 'delivery_notes', 'pos_transactions'
  );
  v_code_lookup TEXT;
  v_gap_lookup TEXT;
  v_allocated_number BIGINT;
  v_next_number BIGINT;
  v_suffix_width INTEGER;
  v_range_end NUMERIC;
  v_gap_number NUMERIC;
BEGIN
  IF v_target_column IS NULL THEN
    RAISE EXCEPTION 'apply_generated_document_code requires target column name';
  END IF;

  v_existing_code := NULLIF(btrim(to_jsonb(NEW) ->> v_target_column), '');
  IF v_existing_code IS NOT NULL THEN
    RAISE EXCEPTION '% is generated automatically; do not supply a value', v_target_column;
  END IF;

  -- Existing trigger registrations retain their third argument to preserve their
  -- identity and ordering. The company's setting now owns their numeric width.
  SELECT company.document_code_digits INTO v_digits
  FROM public.companies company
  WHERE company.id = NEW.company_id;

  -- Match each table's code uniqueness scope. Full indexes include soft-deleted history.
  v_code_lookup := format(
    'SELECT EXISTS (SELECT 1 FROM %I.%I document WHERE document.%I = $1%s)',
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    v_target_column,
    CASE WHEN v_global_code THEN '' ELSE ' AND document.company_id = $2' END
  );
  v_gap_lookup := format(
    'WITH reserved_numbers AS (
      SELECT CASE
        WHEN length(document.%1$I) = $4 + $5 - 1
          AND left(document.%1$I, $4 - 1) = $8
          AND substring(document.%1$I FROM $4) ~ ''^[0-9]+$''
        THEN substring(document.%1$I FROM $4)::NUMERIC
      END AS number
      FROM %2$I.%3$I document
      WHERE document.%1$I >= $1 AND document.%1$I <= $2%4$s
    ), number_edges AS (
      SELECT number, lead(number) OVER (ORDER BY number) AS next_number
      FROM (
        SELECT number FROM reserved_numbers WHERE number BETWEEN $6 AND $7
        UNION SELECT $6 - 1
      ) occupied
    )
    SELECT min(number + 1) FROM number_edges
    WHERE number < $7 AND (next_number IS NULL OR next_number > number + 1)',
    v_target_column,
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    CASE WHEN v_global_code THEN '' ELSE ' AND document.company_id = $3' END
  );

  -- The allocator holds this company/prefix row lock until the insert transaction ends.
  v_generated_code := public.generate_document_code(NEW.company_id, v_code_prefix, v_digits);
  v_allocated_number := substring(v_generated_code FROM length(v_code_prefix) + 2)::BIGINT;
  v_next_number := v_allocated_number;
  LOOP
    EXECUTE v_code_lookup INTO v_code_exists USING v_generated_code, NEW.company_id;

    IF NOT v_code_exists AND v_global_code THEN
      -- Different companies have independent counters. Serialize their claim on the
      -- same free code, then check again after any competing transaction commits.
      PERFORM pg_advisory_xact_lock(hashtextextended(
        'document-code:' || TG_RELID::TEXT || ':' || v_generated_code, 0
      ));
      EXECUTE v_code_lookup INTO v_code_exists USING v_generated_code, NEW.company_id;
    END IF;

    EXIT WHEN NOT v_code_exists;
    -- Search a bounded block of this rendered width, including deleted history.
    -- A numeric gap preserves the first available code before later reservations.
    v_suffix_width := GREATEST(v_digits, length(v_next_number::TEXT));
    v_range_end := LEAST(
      v_next_number::NUMERIC + 4095,
      repeat('9', v_suffix_width)::NUMERIC,
      9223372036854775807::NUMERIC
    );
    EXECUTE v_gap_lookup INTO v_gap_number USING
      v_generated_code,
      v_code_prefix || '-' || lpad(v_range_end::TEXT, v_suffix_width, '0'),
      NEW.company_id,
      length(v_code_prefix) + 2,
      v_suffix_width,
      v_next_number::NUMERIC,
      v_range_end,
      v_code_prefix || '-';
    v_gap_number := COALESCE(v_gap_number, v_range_end + 1);
    IF v_gap_number > 9223372036854775807::NUMERIC THEN
      RAISE EXCEPTION 'bigint out of range' USING ERRCODE = '22003';
    END IF;
    v_next_number := v_gap_number::BIGINT;
    v_generated_code := v_code_prefix || '-' || lpad(
      v_next_number::TEXT, GREATEST(v_digits, length(v_next_number::TEXT)), '0'
    );
  END LOOP;

  -- Persist the final claim once, under the allocator's existing row lock.
  IF v_next_number <> v_allocated_number THEN
    UPDATE public.document_code_sequences
    SET last_number = v_next_number, updated_at = now()
    WHERE company_id = NEW.company_id AND code_prefix = v_code_prefix;
  END IF;

  NEW := jsonb_populate_record(NEW, jsonb_build_object(v_target_column, v_generated_code));

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.apply_generated_document_code() IS
  'Allocates a configured company-scoped sequence, skipping reserved document codes in the target table uniqueness scope.';

CREATE OR REPLACE FUNCTION public.next_warehouse_location_code(
  p_company UUID,
  p_warehouse UUID,
  p_parent_code TEXT,
  p_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prefix TEXT;
  v_namespace TEXT;
  v_number BIGINT;
  v_digits INTEGER;
  v_code TEXT;
  v_allocated_code TEXT;
BEGIN
  v_prefix := concat_ws('-', NULLIF(p_parent_code, ''), public.warehouse_location_type_prefix(p_type));
  IF public.warehouse_location_type_prefix(p_type) IS NULL THEN
    RAISE EXCEPTION 'LOCATION_TYPE_INVALID';
  END IF;

  SELECT company.warehouse_location_code_digits INTO v_digits
  FROM public.companies company
  WHERE company.id = p_company;
  IF v_digits IS NULL THEN
    RAISE EXCEPTION 'LOCATION_WAREHOUSE_INVALID';
  END IF;

  IF length(v_prefix) + v_digits > 100 THEN
    RAISE EXCEPTION 'LOCATION_CODE_TOO_LONG';
  END IF;
  v_namespace := 'warehouse-location:' || p_warehouse::TEXT || ':' || v_prefix;

  LOOP
    -- Allocation stays company-scoped and independent of the rendered width.
    v_allocated_code := public.generate_document_code(p_company, v_namespace, 9);
    v_number := substring(v_allocated_code FROM length(v_namespace) + 2)::BIGINT;
    v_code := v_prefix || lpad(v_number::TEXT, GREATEST(v_digits, length(v_number::TEXT)), '0');
    IF length(v_code) > 100 THEN
      RAISE EXCEPTION 'LOCATION_CODE_TOO_LONG';
    END IF;
    -- Historical and soft-deleted codes remain reserved after a width change.
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.warehouse_locations location
      WHERE location.company_id = p_company
        AND location.warehouse_id = p_warehouse
        AND location.code = v_code
    );
  END LOOP;

  RETURN v_code;
END;
$$;

COMMENT ON FUNCTION public.next_warehouse_location_code(UUID, UUID, TEXT, TEXT) IS
  'Allocates hierarchical location codes using the company warehouse_location_code_digits setting.';

COMMIT;
