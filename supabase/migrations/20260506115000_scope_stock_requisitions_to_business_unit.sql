DROP POLICY IF EXISTS stock_requisitions_company_isolation_select ON public.stock_requisitions;
DROP POLICY IF EXISTS stock_requisitions_company_isolation_insert ON public.stock_requisitions;
DROP POLICY IF EXISTS stock_requisitions_company_isolation_update ON public.stock_requisitions;
DROP POLICY IF EXISTS stock_requisitions_company_isolation_delete ON public.stock_requisitions;

CREATE POLICY stock_requisitions_company_isolation_select ON public.stock_requisitions
  FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND business_unit_id = public.get_current_business_unit_id()
  );

CREATE POLICY stock_requisitions_company_isolation_insert ON public.stock_requisitions
  FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND business_unit_id = public.get_current_business_unit_id()
  );

CREATE POLICY stock_requisitions_company_isolation_update ON public.stock_requisitions
  FOR UPDATE
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND business_unit_id = public.get_current_business_unit_id()
  )
  WITH CHECK (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND business_unit_id = public.get_current_business_unit_id()
  );

CREATE POLICY stock_requisitions_company_isolation_delete ON public.stock_requisitions
  FOR DELETE
  USING (
    company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
    AND business_unit_id = public.get_current_business_unit_id()
  );

DROP POLICY IF EXISTS stock_requisition_items_company_isolation_select ON public.stock_requisition_items;
DROP POLICY IF EXISTS stock_requisition_items_company_isolation_insert ON public.stock_requisition_items;
DROP POLICY IF EXISTS stock_requisition_items_company_isolation_update ON public.stock_requisition_items;
DROP POLICY IF EXISTS stock_requisition_items_company_isolation_delete ON public.stock_requisition_items;

CREATE POLICY stock_requisition_items_company_isolation_select ON public.stock_requisition_items
  FOR SELECT
  USING (
    sr_id IN (
      SELECT id
      FROM public.stock_requisitions
      WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        AND business_unit_id = public.get_current_business_unit_id()
    )
  );

CREATE POLICY stock_requisition_items_company_isolation_insert ON public.stock_requisition_items
  FOR INSERT
  WITH CHECK (
    sr_id IN (
      SELECT id
      FROM public.stock_requisitions
      WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        AND business_unit_id = public.get_current_business_unit_id()
    )
  );

CREATE POLICY stock_requisition_items_company_isolation_update ON public.stock_requisition_items
  FOR UPDATE
  USING (
    sr_id IN (
      SELECT id
      FROM public.stock_requisitions
      WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        AND business_unit_id = public.get_current_business_unit_id()
    )
  )
  WITH CHECK (
    sr_id IN (
      SELECT id
      FROM public.stock_requisitions
      WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        AND business_unit_id = public.get_current_business_unit_id()
    )
  );

CREATE POLICY stock_requisition_items_company_isolation_delete ON public.stock_requisition_items
  FOR DELETE
  USING (
    sr_id IN (
      SELECT id
      FROM public.stock_requisitions
      WHERE company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid())
        AND business_unit_id = public.get_current_business_unit_id()
    )
  );
