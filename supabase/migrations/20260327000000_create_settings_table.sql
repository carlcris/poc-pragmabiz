-- Create settings table for app-wide configurations
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_unit_id UUID REFERENCES public.business_units(id) ON DELETE CASCADE,
  group_key TEXT NOT NULL,
  setting_key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Ensure unique settings per company/bu/group/key combination
  -- Note: We'll use a unique index instead of constraint to handle NULLs properly

  -- Validate group_key values
  CONSTRAINT valid_group_key CHECK (group_key IN ('company', 'financial', 'inventory', 'pos', 'workflow', 'integration', 'business_unit', 'security'))
);

-- Add indexes for efficient queries
CREATE INDEX idx_settings_company_group ON public.settings(company_id, group_key);
CREATE INDEX idx_settings_bu_group ON public.settings(business_unit_id, group_key) WHERE business_unit_id IS NOT NULL;
CREATE INDEX idx_settings_lookup ON public.settings(company_id, group_key, setting_key);

-- Create unique index to handle company-wide settings (NULL business_unit_id)
CREATE UNIQUE INDEX idx_settings_unique_company_wide
  ON public.settings(company_id, group_key, setting_key)
  WHERE business_unit_id IS NULL;

-- Create unique index for business unit specific settings
CREATE UNIQUE INDEX idx_settings_unique_bu_specific
  ON public.settings(company_id, business_unit_id, group_key, setting_key)
  WHERE business_unit_id IS NOT NULL;

-- Add updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see settings from their company
CREATE POLICY "Users can view settings from their company"
  ON public.settings
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id
      FROM public.users
      WHERE id = auth.uid()
    )
  );

-- Users can insert settings if they have company_settings permission
CREATE POLICY "Users can insert settings with permission"
  ON public.settings
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.users
      WHERE id = auth.uid()
    )
    AND
    user_has_permission(auth.uid(), 'company_settings', 'create', business_unit_id)
  );

-- Users can update settings if they have company_settings permission
CREATE POLICY "Users can update settings with permission"
  ON public.settings
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id
      FROM public.users
      WHERE id = auth.uid()
    )
    AND
    user_has_permission(auth.uid(), 'company_settings', 'edit', business_unit_id)
  );

-- Users can delete settings if they have company_settings permission
CREATE POLICY "Users can delete settings with permission"
  ON public.settings
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id
      FROM public.users
      WHERE id = auth.uid()
    )
    AND
    user_has_permission(auth.uid(), 'company_settings', 'delete', business_unit_id)
  );

-- Add comment
COMMENT ON TABLE public.settings IS 'Stores app-wide settings organized by group_key and setting_key. Settings are scoped to company_id with optional business_unit_id override.';

ALTER TABLE public.companies
RENAME COLUMN settings TO custom_fields;

DROP POLICY IF EXISTS "Users can insert settings with permission" ON public.settings;

CREATE POLICY "Users can insert settings with edit permission"
  ON public.settings
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM public.users
      WHERE id = auth.uid()
    )
    AND
    user_has_permission(auth.uid(), 'company_settings', 'edit', business_unit_id)
  );

CREATE POLICY "Users can update their company with company settings edit permission"
  ON public.companies
  FOR UPDATE
  USING (
    id IN (
      SELECT company_id
      FROM public.users
      WHERE id = auth.uid()
    )
    AND user_has_permission(auth.uid(), 'company_settings', 'edit', NULL)
  )
  WITH CHECK (
    id IN (
      SELECT company_id
      FROM public.users
      WHERE id = auth.uid()
    )
    AND user_has_permission(auth.uid(), 'company_settings', 'edit', NULL)
  );
