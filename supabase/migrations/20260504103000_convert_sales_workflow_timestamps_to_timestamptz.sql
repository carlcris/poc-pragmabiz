-- Convert Sales workflow operational timestamps to TIMESTAMPTZ.
-- Existing timestamp values are interpreted as UTC instants.

DROP VIEW IF EXISTS public.vw_employee_commission_summary;
DROP VIEW IF EXISTS public.vw_sales_by_employee;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customers'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.customers
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
      ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_quotations'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.sales_quotations
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
      ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_quotation_items'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.sales_quotation_items
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
      ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_quotation_item_configurations'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.sales_quotation_item_configurations
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
      ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_quotation_item_components'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.sales_quotation_item_components
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
      ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_orders'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.sales_orders
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
      ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_order_items'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.sales_order_items
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
      ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_order_item_configurations'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.sales_order_item_configurations
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
      ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_order_item_components'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.sales_order_item_components
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
      ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_invoices'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.sales_invoices
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
      ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_invoice_items'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.sales_invoice_items
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
      ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoice_payments'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.invoice_payments
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
      ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoice_employees'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.invoice_employees
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoice_employee_commissions'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.invoice_employee_commissions
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
      ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_distribution'
      AND column_name = 'created_at'
      AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.sales_distribution
      ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
      ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.delete_sales_quotation_transaction(p_quotation_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing RECORD;
  v_deleted_at TIMESTAMPTZ := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id, status
  INTO v_existing
  FROM public.sales_quotations
  WHERE id = p_quotation_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'Quotation not found';
  END IF;

  IF v_existing.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft quotations can be deleted';
  END IF;

  UPDATE public.sales_quotations
  SET
    deleted_at = v_deleted_at,
    updated_by = v_user_id
  WHERE id = p_quotation_id;

  UPDATE public.sales_quotation_items
  SET
    deleted_at = v_deleted_at,
    updated_by = v_user_id
  WHERE quotation_id = p_quotation_id
    AND deleted_at IS NULL;

  RETURN p_quotation_id;
END;
$function$;

CREATE OR REPLACE VIEW public.vw_sales_by_employee AS
SELECT
  e.id AS employee_id,
  e.company_id,
  e.employee_code,
  CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
  e.role,
  e.commission_rate,
  DATE_TRUNC('day', si.invoice_date::TIMESTAMPTZ) AS sales_date,
  COUNT(DISTINCT si.id) AS transaction_count,
  SUM(si.total_amount) AS total_sales,
  SUM(ie.commission_amount) AS total_commission,
  AVG(si.total_amount) AS average_order_value
FROM public.employees e
JOIN public.invoice_employees ie ON e.id = ie.employee_id
JOIN public.sales_invoices si ON ie.invoice_id = si.id
WHERE e.deleted_at IS NULL
  AND si.deleted_at IS NULL
  AND si.status NOT IN ('draft', 'cancelled')
GROUP BY
  e.id,
  e.company_id,
  e.employee_code,
  e.first_name,
  e.last_name,
  e.role,
  e.commission_rate,
  DATE_TRUNC('day', si.invoice_date::TIMESTAMPTZ);

CREATE OR REPLACE VIEW public.vw_employee_commission_summary AS
SELECT
  e.id AS employee_id,
  e.company_id,
  e.employee_code,
  CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
  DATE_TRUNC('month', si.invoice_date::TIMESTAMPTZ) AS month,
  COUNT(DISTINCT si.id) AS invoice_count,
  SUM(si.total_amount) AS total_sales,
  SUM(ie.commission_amount) AS total_commission,
  SUM(
    CASE WHEN si.status = 'paid'
      THEN ie.commission_amount
      ELSE 0
    END
  ) AS paid_commission,
  SUM(
    CASE WHEN si.status <> 'paid'
      THEN ie.commission_amount
      ELSE 0
    END
  ) AS pending_commission
FROM public.employees e
JOIN public.invoice_employees ie ON e.id = ie.employee_id
JOIN public.sales_invoices si ON ie.invoice_id = si.id
WHERE e.deleted_at IS NULL
  AND si.deleted_at IS NULL
  AND si.status NOT IN ('draft', 'cancelled')
GROUP BY
  e.id,
  e.company_id,
  e.employee_code,
  e.first_name,
  e.last_name,
  DATE_TRUNC('month', si.invoice_date::TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.update_sales_quotation_transaction(
  p_quotation_id UUID,
  p_quotation_date DATE,
  p_valid_until DATE,
  p_terms_conditions TEXT,
  p_notes TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing RECORD;
  v_item JSONB;
  v_ordinality INTEGER;
  v_calculated RECORD;
  v_quotation_item_id UUID;
  v_subtotal NUMERIC := 0;
  v_discount_amount NUMERIC := 0;
  v_tax_amount NUMERIC := 0;
  v_deleted_at TIMESTAMPTZ := now();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT id, company_id, status
  INTO v_existing
  FROM public.sales_quotations
  WHERE id = p_quotation_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_existing.id IS NULL THEN
    RAISE EXCEPTION 'Quotation not found';
  END IF;

  IF v_existing.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft quotations can be edited';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Quotation must have at least one item';
  END IF;

  UPDATE public.sales_quotation_item_components c
  SET deleted_at = v_deleted_at, updated_by = v_user_id
  FROM public.sales_quotation_items qi
  WHERE c.quotation_item_id = qi.id
    AND qi.quotation_id = p_quotation_id
    AND c.deleted_at IS NULL;

  UPDATE public.sales_quotation_item_configurations cfg
  SET deleted_at = v_deleted_at, updated_by = v_user_id
  FROM public.sales_quotation_items qi
  WHERE cfg.quotation_item_id = qi.id
    AND qi.quotation_id = p_quotation_id
    AND cfg.deleted_at IS NULL;

  UPDATE public.sales_quotation_items
  SET deleted_at = v_deleted_at, updated_by = v_user_id
  WHERE quotation_id = p_quotation_id
    AND deleted_at IS NULL;

  FOR v_item, v_ordinality IN
    SELECT value, ordinality::INTEGER - 1
    FROM jsonb_array_elements(p_items) WITH ORDINALITY
  LOOP
    v_item := jsonb_set(v_item, '{sortOrder}', to_jsonb(v_ordinality), true);
    SELECT * INTO v_calculated FROM public.calculate_sales_quotation_item(v_item);

    v_subtotal := v_subtotal + (v_calculated.quantity * v_calculated.rate);
    v_discount_amount := v_discount_amount + v_calculated.discount_amount;
    v_tax_amount := v_tax_amount + v_calculated.tax_amount;

    INSERT INTO public.sales_quotation_items (
      company_id, quotation_id, item_id, item_description, quantity, uom_id, rate,
      discount_percent, discount_amount, tax_percent, tax_amount, line_total,
      sort_order, notes, created_by, updated_by
    )
    VALUES (
      v_existing.company_id, p_quotation_id, v_calculated.item_id, v_calculated.item_description,
      v_calculated.quantity, v_calculated.uom_id, v_calculated.rate,
      v_calculated.discount_percent, v_calculated.discount_amount, v_calculated.tax_percent,
      v_calculated.tax_amount, v_calculated.line_total, v_calculated.sort_order,
      v_calculated.notes, v_user_id, v_user_id
    )
    RETURNING id INTO v_quotation_item_id;

    PERFORM public.save_sales_quotation_item_frame_details(
      v_existing.company_id,
      v_quotation_item_id,
      v_item,
      v_user_id
    );
  END LOOP;

  UPDATE public.sales_quotations
  SET
    quotation_date = p_quotation_date,
    valid_until = p_valid_until,
    terms_conditions = p_terms_conditions,
    notes = p_notes,
    subtotal = v_subtotal,
    discount_amount = v_discount_amount,
    tax_amount = v_tax_amount,
    total_amount = v_subtotal - v_discount_amount + v_tax_amount,
    updated_by = v_user_id
  WHERE id = p_quotation_id;

  RETURN p_quotation_id;
END;
$function$;
