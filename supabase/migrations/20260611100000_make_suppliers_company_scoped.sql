-- Migration: Make suppliers company scoped
-- Description: Removes business unit ownership from supplier master data so supplier
-- lookups and document joins resolve across the company.

DROP POLICY IF EXISTS bu_select_policy ON public.suppliers;
DROP POLICY IF EXISTS bu_insert_policy ON public.suppliers;
DROP POLICY IF EXISTS bu_update_policy ON public.suppliers;
DROP POLICY IF EXISTS bu_delete_policy ON public.suppliers;

DROP POLICY IF EXISTS suppliers_company_isolation_select ON public.suppliers;
DROP POLICY IF EXISTS suppliers_company_isolation_insert ON public.suppliers;
DROP POLICY IF EXISTS suppliers_company_isolation_update ON public.suppliers;
DROP POLICY IF EXISTS suppliers_company_isolation_delete ON public.suppliers;

CREATE POLICY suppliers_company_isolation_select ON public.suppliers
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY suppliers_company_isolation_insert ON public.suppliers
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY suppliers_company_isolation_update ON public.suppliers
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY suppliers_company_isolation_delete ON public.suppliers
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP INDEX IF EXISTS public.idx_suppliers_bu;

ALTER TABLE public.suppliers
  DROP COLUMN IF EXISTS business_unit_id;
