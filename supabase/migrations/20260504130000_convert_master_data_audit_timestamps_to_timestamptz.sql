-- Convert remaining master-data audit and login timestamps to TIMESTAMPTZ.
-- Legacy timestamp values in these tables are interpreted as UTC clock times.

DROP VIEW IF EXISTS public.vw_employee_commission_summary;
DROP VIEW IF EXISTS public.vw_sales_by_employee;

DROP POLICY IF EXISTS notifications_company_insert ON public.notifications;

DO $$
DECLARE
  target_columns CONSTANT text[][] := ARRAY[
    ARRAY['companies', 'created_at'],
    ARRAY['companies', 'updated_at'],
    ARRAY['companies', 'deleted_at'],

    ARRAY['users', 'created_at'],
    ARRAY['users', 'updated_at'],
    ARRAY['users', 'deleted_at'],
    ARRAY['users', 'last_login_at'],

    ARRAY['employees', 'created_at'],
    ARRAY['employees', 'updated_at'],
    ARRAY['employees', 'deleted_at'],

    ARRAY['employee_distribution_locations', 'created_at'],
    ARRAY['employee_distribution_locations', 'updated_at'],
    ARRAY['employee_distribution_locations', 'deleted_at'],

    ARRAY['units_of_measure', 'created_at'],
    ARRAY['units_of_measure', 'updated_at'],
    ARRAY['units_of_measure', 'deleted_at']
  ];
  target_column text[];
BEGIN
  FOREACH target_column SLICE 1 IN ARRAY target_columns LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target_column[1]
        AND column_name = target_column[2]
        AND data_type = 'timestamp without time zone'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE %L',
        target_column[1],
        target_column[2],
        target_column[2],
        'UTC'
      );
    END IF;
  END LOOP;
END $$;

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

CREATE POLICY notifications_company_insert ON public.notifications
  FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND user_id IN (
      SELECT id
      FROM public.users
      WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        AND deleted_at IS NULL
    )
    AND (
      business_unit_id IS NULL
      OR business_unit_id IN (
        SELECT bu.id
        FROM public.business_units bu
        WHERE bu.company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
      )
    )
  );
