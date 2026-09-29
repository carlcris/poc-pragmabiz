-- ============================================================================
-- Migration: Record who accepted a quotation, through what channel, with waiver
-- Description:
--   Accepting a quotation stops being a bare status flip. The shop needs to be
--   able to show, months later, WHO on the customer's side approved the job and
--   through WHICH channel — and to produce the document proving it. That is a
--   liability record, which is why all three parts are required rather than
--   optional.
--
--   The waiver may be several files: a photograph of a signed printout AND a
--   screenshot of the Viber or Messenger message agreeing to it are both
--   evidence, so this is a child table rather than a single column.
--
--   Channel is a constrained list, not free text: "viber", "Viber" and "viber
--   msg" are the same channel and would stop any report finding them. The
--   accepting person's NAME is free text, because reality is "the owner's wife"
--   as often as it is a registered contact.
--
--   Existing quotations are unaffected — the columns are nullable and the
--   development database was reset, so nothing is retroactively invalid.
-- Date: 2026-09-04
-- ============================================================================

BEGIN;

ALTER TABLE public.sales_quotations
  ADD COLUMN IF NOT EXISTS accepted_by_name TEXT,
  ADD COLUMN IF NOT EXISTS accepted_channel TEXT,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_recorded_by UUID REFERENCES public.users(id);

-- A fixed vocabulary. "other" exists so an unforeseen channel does not force an
-- operator to mislabel one, and `accepted_by_name` carries the detail.
ALTER TABLE public.sales_quotations
  DROP CONSTRAINT IF EXISTS chk_sales_quotations_accepted_channel,
  ADD CONSTRAINT chk_sales_quotations_accepted_channel CHECK (
    accepted_channel IS NULL OR accepted_channel IN (
      'messenger', 'viber', 'sms', 'email', 'phone', 'in_person', 'other'
    )
  );

-- Acceptance is all-or-nothing: a row claiming a channel but no name, or a name
-- with no channel, is a half-written record that reads as though the detail was
-- captured when it was not.
ALTER TABLE public.sales_quotations
  DROP CONSTRAINT IF EXISTS chk_sales_quotations_acceptance_complete,
  ADD CONSTRAINT chk_sales_quotations_acceptance_complete CHECK (
    (accepted_by_name IS NULL AND accepted_channel IS NULL AND accepted_at IS NULL)
    OR (
      btrim(COALESCE(accepted_by_name, '')) <> ''
      AND accepted_channel IS NOT NULL
      AND accepted_at IS NOT NULL
    )
  );

-- --------------------------------------------------------------------------
-- Waiver files. Several per quotation: a signed printout and a screenshot of
-- the customer's message are both evidence of the same acceptance.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sales_quotation_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  quotation_id UUID NOT NULL REFERENCES public.sales_quotations(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sales_quotation_waivers_quotation
  ON public.sales_quotation_waivers (quotation_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sales_quotation_waivers_company
  ON public.sales_quotation_waivers (company_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.sales_quotation_waivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_quotation_waivers_select ON public.sales_quotation_waivers;
CREATE POLICY sales_quotation_waivers_select
  ON public.sales_quotation_waivers
  FOR SELECT
  USING (
    company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid())
  );

DROP POLICY IF EXISTS sales_quotation_waivers_mutation ON public.sales_quotation_waivers;
CREATE POLICY sales_quotation_waivers_mutation
  ON public.sales_quotation_waivers
  FOR ALL
  USING (
    company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid())
  )
  WITH CHECK (
    company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid())
  );

-- Private: a waiver carries a customer's signature and their private messages,
-- so objects are reachable only through a signed URL minted for a caller who
-- passed the RLS check above. Mirrors `frame-attachments`.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quotation-waivers',
  'quotation-waivers',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

COMMIT;
