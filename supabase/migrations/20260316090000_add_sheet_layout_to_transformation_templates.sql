ALTER TABLE public.transformation_templates
ADD COLUMN IF NOT EXISTS template_kind TEXT NOT NULL DEFAULT 'recipe',
ADD COLUMN IF NOT EXISTS sheet_width NUMERIC(12, 4),
ADD COLUMN IF NOT EXISTS sheet_height NUMERIC(12, 4),
ADD COLUMN IF NOT EXISTS sheet_unit VARCHAR(16),
ADD COLUMN IF NOT EXISTS layout_json JSONB;

ALTER TABLE public.transformation_templates
DROP CONSTRAINT IF EXISTS transformation_templates_template_kind_check;

ALTER TABLE public.transformation_templates
ADD CONSTRAINT transformation_templates_template_kind_check
CHECK (template_kind IN ('recipe', 'sheet_layout'));

COMMENT ON COLUMN public.transformation_templates.template_kind IS
'Template type. recipe = item input/output recipe, sheet_layout = visual sheet cutting template.';

COMMENT ON COLUMN public.transformation_templates.sheet_width IS
'Parent sheet width for visual sheet layout templates.';

COMMENT ON COLUMN public.transformation_templates.sheet_height IS
'Parent sheet height for visual sheet layout templates.';

COMMENT ON COLUMN public.transformation_templates.sheet_unit IS
'Measurement unit for sheet layout templates, for example in, cm, or mm.';

COMMENT ON COLUMN public.transformation_templates.layout_json IS
'Resolution-independent sheet layout definition containing rectangular sections and metadata.';
