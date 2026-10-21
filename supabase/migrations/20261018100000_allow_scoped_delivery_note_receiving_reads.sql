-- Receiving rows are read by the delivery-note detail API, but these tables
-- were created without Data API SELECT grants or row-level security.
BEGIN;

ALTER TABLE public.delivery_note_item_receiving_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_receiving_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY receiving_business_unit_select
  ON public.delivery_note_item_receiving_scans
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.delivery_notes AS note
      WHERE note.id = delivery_note_item_receiving_scans.dn_id
        AND note.company_id = delivery_note_item_receiving_scans.company_id
        AND note.deleted_at IS NULL
        AND note.requesting_business_unit_id = (SELECT public.get_current_business_unit_id())
        AND note.requesting_business_unit_id IN (
          SELECT access.business_unit_id
          FROM public.user_business_unit_access AS access
          WHERE access.user_id = (SELECT auth.uid())
        )
    )
  );

CREATE POLICY receiving_business_unit_select
  ON public.delivery_note_receiving_exceptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.delivery_notes AS note
      WHERE note.id = delivery_note_receiving_exceptions.dn_id
        AND note.company_id = delivery_note_receiving_exceptions.company_id
        AND note.deleted_at IS NULL
        AND note.requesting_business_unit_id = (SELECT public.get_current_business_unit_id())
        AND note.requesting_business_unit_id IN (
          SELECT access.business_unit_id
          FROM public.user_business_unit_access AS access
          WHERE access.user_id = (SELECT auth.uid())
        )
    )
  );

-- The detail API includes voided scans, which cannot use the existing partial
-- index limited to active scans.
CREATE INDEX idx_dn_receiving_scans_company_dn_all
  ON public.delivery_note_item_receiving_scans(company_id, dn_id);

GRANT SELECT ON TABLE
  public.delivery_note_item_receiving_scans,
  public.delivery_note_receiving_exceptions
TO authenticated;

COMMIT;
