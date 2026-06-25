-- Restrict seasonal reorder configuration tables to the authenticated user's company.

BEGIN;

DROP POLICY IF EXISTS "Allow authenticated users to read reorder_seasons" ON public.reorder_seasons;
CREATE POLICY "Allow authenticated users to read reorder_seasons"
  ON public.reorder_seasons FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated users to write reorder_seasons" ON public.reorder_seasons;
CREATE POLICY "Allow authenticated users to write reorder_seasons"
  ON public.reorder_seasons FOR ALL
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated users to read reorder_season_item_policies" ON public.reorder_season_item_policies;
CREATE POLICY "Allow authenticated users to read reorder_season_item_policies"
  ON public.reorder_season_item_policies FOR SELECT
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated users to write reorder_season_item_policies" ON public.reorder_season_item_policies;
CREATE POLICY "Allow authenticated users to write reorder_season_item_policies"
  ON public.reorder_season_item_policies FOR ALL
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

COMMIT;
