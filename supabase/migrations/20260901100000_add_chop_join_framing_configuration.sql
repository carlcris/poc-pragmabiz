-- ============================================================================
-- Migration: Chop & join / framing line configuration
-- Description:
--   - Adds a billing_mode discriminator to quotation and sales-order line
--     configurations. Both modes share one geometry engine; the mode decides
--     which item_prices tier is read and whether components bill individually
--     (chop_join) or roll up into one finished-frame price (framing).
--   - Adds chop & join geometry (artwork size, size mode, overlap, mat source)
--     to the existing frame configuration tables.
--   - Adds mat layer child tables. Matting is a layer count with per-layer
--     geometry, never independent Single/Double/Triple booleans.
--   - Allows one job order per quotation PER billing mode (previously one per
--     quotation, total).
-- Date: 2026-09-01
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Billing mode + chop & join geometry on line configurations
-- ============================================================================

ALTER TABLE public.sales_quotation_item_configurations
  ADD COLUMN billing_mode TEXT NOT NULL DEFAULT 'framing',
  ADD COLUMN artwork_length_in NUMERIC(9, 4),
  ADD COLUMN artwork_width_in NUMERIC(9, 4),
  ADD COLUMN frame_width_in NUMERIC(9, 4),
  ADD COLUMN size_mode TEXT NOT NULL DEFAULT 'artwork',
  ADD COLUMN overlap_in NUMERIC(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN mat_source TEXT NOT NULL DEFAULT 'store',
  ADD COLUMN glazing_cut_to_mat_outer BOOLEAN NOT NULL DEFAULT TRUE,
  ADD CONSTRAINT chk_sq_config_billing_mode
    CHECK (billing_mode IN ('framing', 'chop_join')),
  ADD CONSTRAINT chk_sq_config_size_mode
    CHECK (size_mode IN ('artwork', 'outside')),
  ADD CONSTRAINT chk_sq_config_mat_source
    CHECK (mat_source IN ('store', 'customer')),
  ADD CONSTRAINT chk_sq_config_overlap
    CHECK (overlap_in >= 0),
  ADD CONSTRAINT chk_sq_config_artwork_dimensions
    CHECK (
      (artwork_length_in IS NULL OR artwork_length_in > 0)
      AND (artwork_width_in IS NULL OR artwork_width_in > 0)
      AND (frame_width_in IS NULL OR frame_width_in >= 0)
    );

ALTER TABLE public.sales_order_item_configurations
  ADD COLUMN billing_mode TEXT NOT NULL DEFAULT 'framing',
  ADD COLUMN artwork_length_in NUMERIC(9, 4),
  ADD COLUMN artwork_width_in NUMERIC(9, 4),
  ADD COLUMN frame_width_in NUMERIC(9, 4),
  ADD COLUMN size_mode TEXT NOT NULL DEFAULT 'artwork',
  ADD COLUMN overlap_in NUMERIC(9, 4) NOT NULL DEFAULT 0,
  ADD COLUMN mat_source TEXT NOT NULL DEFAULT 'store',
  ADD COLUMN glazing_cut_to_mat_outer BOOLEAN NOT NULL DEFAULT TRUE,
  ADD CONSTRAINT chk_so_config_billing_mode
    CHECK (billing_mode IN ('framing', 'chop_join')),
  ADD CONSTRAINT chk_so_config_size_mode
    CHECK (size_mode IN ('artwork', 'outside')),
  ADD CONSTRAINT chk_so_config_mat_source
    CHECK (mat_source IN ('store', 'customer')),
  ADD CONSTRAINT chk_so_config_overlap
    CHECK (overlap_in >= 0),
  ADD CONSTRAINT chk_so_config_artwork_dimensions
    CHECK (
      (artwork_length_in IS NULL OR artwork_length_in > 0)
      AND (artwork_width_in IS NULL OR artwork_width_in > 0)
      AND (frame_width_in IS NULL OR frame_width_in >= 0)
    );

COMMENT ON COLUMN public.sales_quotation_item_configurations.billing_mode IS
  'framing = customer billed one price per finished frame; chop_join = customer billed per part consumed. Selects the item_prices tier and the default invoice_display_mode.';
COMMENT ON COLUMN public.sales_quotation_item_configurations.size_mode IS
  'artwork = entered dimensions are the artwork; outside = entered dimensions are the finished frame outside, artwork is derived.';
COMMENT ON COLUMN public.sales_quotation_item_configurations.overlap_in IS
  'Rabbet overlap deducted from artwork on each edge when computing the bottom mat opening.';
COMMENT ON COLUMN public.sales_quotation_item_configurations.mat_source IS
  'store = shop supplies the board (area-priced); customer = customer supplies it (perimeter-priced).';

-- ============================================================================
-- 2. Mat layers
-- Layer 0 is the top mat: its border runs from the mat edge to its opening.
-- Each layer beneath shows a reveal below the layer above it.
-- ============================================================================

CREATE TABLE public.sales_quotation_item_mat_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  configuration_id UUID NOT NULL
    REFERENCES public.sales_quotation_item_configurations(id) ON DELETE CASCADE,
  layer_index INTEGER NOT NULL,
  mat_board_item_id UUID NOT NULL REFERENCES public.items(id),
  border_or_reveal_l_in NUMERIC(9, 4),
  border_or_reveal_w_in NUMERIC(9, 4),
  unit_rate NUMERIC(20, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_sq_mat_layer_index CHECK (layer_index BETWEEN 0 AND 2),
  CONSTRAINT chk_sq_mat_layer_geometry
    CHECK (border_or_reveal_l_in >= 0 AND border_or_reveal_w_in >= 0),
  CONSTRAINT chk_sq_mat_layer_rate CHECK (unit_rate >= 0),
  CONSTRAINT sales_quotation_item_mat_layers_config_index_key
    UNIQUE (configuration_id, layer_index)
);

CREATE TABLE public.sales_order_item_mat_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  configuration_id UUID NOT NULL
    REFERENCES public.sales_order_item_configurations(id) ON DELETE CASCADE,
  quotation_mat_layer_id UUID REFERENCES public.sales_quotation_item_mat_layers(id),
  layer_index INTEGER NOT NULL,
  mat_board_item_id UUID NOT NULL REFERENCES public.items(id),
  border_or_reveal_l_in NUMERIC(9, 4),
  border_or_reveal_w_in NUMERIC(9, 4),
  unit_rate NUMERIC(20, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES public.users(id),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT chk_so_mat_layer_index CHECK (layer_index BETWEEN 0 AND 2),
  CONSTRAINT chk_so_mat_layer_geometry
    CHECK (border_or_reveal_l_in >= 0 AND border_or_reveal_w_in >= 0),
  CONSTRAINT chk_so_mat_layer_rate CHECK (unit_rate >= 0),
  CONSTRAINT sales_order_item_mat_layers_config_index_key
    UNIQUE (configuration_id, layer_index)
);

CREATE INDEX idx_sq_mat_layers_company
  ON public.sales_quotation_item_mat_layers (company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sq_mat_layers_config
  ON public.sales_quotation_item_mat_layers (configuration_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_so_mat_layers_company
  ON public.sales_order_item_mat_layers (company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_so_mat_layers_config
  ON public.sales_order_item_mat_layers (configuration_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE public.sales_quotation_item_mat_layers IS
  'Mat layers for a configured framing/chop-join quotation line. layer_index 0 is the top mat; each layer beneath shows a reveal. Modelled as a layer count with per-layer geometry, never as independent single/double/triple flags.';
COMMENT ON COLUMN public.sales_quotation_item_mat_layers.border_or_reveal_l_in IS
  'Layer 0: border from mat edge to opening. Layers 1-2: reveal visible beneath the layer above.';
COMMENT ON COLUMN public.sales_quotation_item_mat_layers.unit_rate IS
  'Per-area rate entered by the user. Mat/glass/backing have no per-area rate in item_prices yet; only mouldings price automatically from a tier.';

DROP TRIGGER IF EXISTS update_sales_quotation_item_mat_layers_updated_at
  ON public.sales_quotation_item_mat_layers;
CREATE TRIGGER update_sales_quotation_item_mat_layers_updated_at
  BEFORE UPDATE ON public.sales_quotation_item_mat_layers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sales_order_item_mat_layers_updated_at
  ON public.sales_order_item_mat_layers;
CREATE TRIGGER update_sales_order_item_mat_layers_updated_at
  BEFORE UPDATE ON public.sales_order_item_mat_layers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 3. RLS — mirrors the existing configuration/component tables
-- ============================================================================

ALTER TABLE public.sales_quotation_item_mat_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_order_item_mat_layers ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_quotation_item_mat_layers_select
  ON public.sales_quotation_item_mat_layers
  FOR SELECT TO authenticated
  USING (company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid()));

CREATE POLICY sales_quotation_item_mat_layers_mutation
  ON public.sales_quotation_item_mat_layers
  FOR ALL TO authenticated
  USING (company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid()))
  WITH CHECK (company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid()));

CREATE POLICY sales_order_item_mat_layers_select
  ON public.sales_order_item_mat_layers
  FOR SELECT TO authenticated
  USING (company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid()));

CREATE POLICY sales_order_item_mat_layers_mutation
  ON public.sales_order_item_mat_layers
  FOR ALL TO authenticated
  USING (company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid()))
  WITH CHECK (company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid()));

-- ============================================================================
-- 4. One job order per quotation PER billing mode
-- Previously UNIQUE (quotation_id) allowed only one job order per quotation
-- in total, which blocks a quotation carrying both chop & join and framing
-- lines. The same relaxation is applied to the active-sales-order index.
-- ============================================================================

ALTER TABLE public.frame_job_orders
  ADD COLUMN billing_mode TEXT NOT NULL DEFAULT 'framing',
  ADD CONSTRAINT chk_frame_job_order_billing_mode
    CHECK (billing_mode IN ('framing', 'chop_join'));

ALTER TABLE public.frame_job_orders
  DROP CONSTRAINT frame_job_orders_quotation_id_key;

CREATE UNIQUE INDEX ux_frame_job_orders_quotation_mode
  ON public.frame_job_orders (quotation_id, billing_mode)
  WHERE quotation_id IS NOT NULL
    AND status <> 'cancelled'
    AND deleted_at IS NULL;

DROP INDEX IF EXISTS public.ux_frame_job_orders_active_sales_order;
CREATE UNIQUE INDEX ux_frame_job_orders_active_sales_order_mode
  ON public.frame_job_orders (sales_order_id, billing_mode)
  WHERE sales_order_id IS NOT NULL
    AND status <> 'cancelled'
    AND deleted_at IS NULL;

COMMENT ON TABLE public.frame_job_orders IS
  'Picture-framing job orders. Covers both billing modes: framing (billed per finished frame) and chop_join (billed per part consumed). At most one active job order per quotation per billing_mode.';
COMMENT ON COLUMN public.frame_job_orders.billing_mode IS
  'Which billing mode this job order collects. A quotation carrying both modes produces two job orders.';

-- Final configuration fields and dependent objects.
ALTER TABLE public.sales_quotation_item_configurations
  ADD COLUMN IF NOT EXISTS glazing_type TEXT
    CHECK (glazing_type IN ('clear', 'double', 'acrylic', 'non_glare', 'octagon')),
  ADD COLUMN IF NOT EXISTS glazing_included BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS glazing_unit_rate NUMERIC(20, 2),
  ADD COLUMN IF NOT EXISTS glazing_sheets INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS glazing_remarks TEXT,
  ADD COLUMN IF NOT EXISTS backing_type TEXT
    CHECK (backing_type IN ('mdf', 'plywood', 'sintra', 'foam')),
  ADD COLUMN IF NOT EXISTS backing_unit_rate NUMERIC(20, 2),
  ADD COLUMN IF NOT EXISTS mat_included BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.sales_order_item_configurations
  ADD COLUMN IF NOT EXISTS glazing_type TEXT
    CHECK (glazing_type IN ('clear', 'double', 'acrylic', 'non_glare', 'octagon')),
  ADD COLUMN IF NOT EXISTS glazing_included BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS glazing_unit_rate NUMERIC(20, 2),
  ADD COLUMN IF NOT EXISTS glazing_sheets INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS glazing_remarks TEXT,
  ADD COLUMN IF NOT EXISTS backing_type TEXT
    CHECK (backing_type IN ('mdf', 'plywood', 'sintra', 'foam')),
  ADD COLUMN IF NOT EXISTS backing_unit_rate NUMERIC(20, 2),
  ADD COLUMN IF NOT EXISTS mat_included BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.sales_quotation_item_configurations.glazing_type IS
  'Which of the offered glass types. A type, not a catalogue item: the glass items in inventory are pre-cut stock sizes while custom framing cuts to the frame''s own size.';
COMMENT ON COLUMN public.sales_quotation_item_configurations.backing_type IS
  'Which backing board. A type rather than a catalogue item, for the same reason as glazing_type.';
COMMENT ON COLUMN public.sales_quotation_item_configurations.glazing_sheets IS
  'Panes per frame. Fixed at 1 for every type except double glass.';

-- Existing rows predate the type-based picker. Their component rows still carry
-- what was chosen, so mark matting/glazing present where a component says so
-- rather than leaving every saved line looking like it had none.
UPDATE public.sales_quotation_item_configurations cfg
SET mat_included = TRUE
WHERE cfg.deleted_at IS NULL
  AND cfg.mat_included = FALSE
  AND EXISTS (
    SELECT 1 FROM public.sales_quotation_item_mat_layers l
    WHERE l.configuration_id = cfg.id AND l.deleted_at IS NULL
  );

ALTER TABLE public.sales_quotation_item_configurations
  ADD COLUMN IF NOT EXISTS moulding_material TEXT
    CHECK (moulding_material IS NULL OR moulding_material IN ('polystyrene', 'wood'));

ALTER TABLE public.sales_order_item_configurations
  ADD COLUMN IF NOT EXISTS moulding_material TEXT
    CHECK (moulding_material IS NULL OR moulding_material IN ('polystyrene', 'wood'));

COMMENT ON COLUMN public.sales_quotation_item_configurations.moulding_material IS
  'The moulding material this line was quoted under. Stored rather than re-read from the item, so reclassifying an item never reprices an existing quotation.';

ALTER TABLE public.sales_quotation_item_configurations
  ADD COLUMN IF NOT EXISTS size_index INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.sales_order_item_configurations
  ADD COLUMN IF NOT EXISTS size_index INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.sales_quotation_item_configurations
  DROP CONSTRAINT IF EXISTS sales_quotation_item_configurations_quotation_item_id_key;

ALTER TABLE public.sales_order_item_configurations
  DROP CONSTRAINT IF EXISTS sales_order_item_configurations_order_item_id_key;

-- One configuration per (line, position). Replaces the one-per-line rule while
-- still rejecting a duplicated position, the way the mat-layer table does.
-- Partial on deleted_at so a soft-deleted size does not block its replacement —
-- the update path soft-deletes and re-saves.
CREATE UNIQUE INDEX IF NOT EXISTS ux_quotation_item_configuration_size
  ON public.sales_quotation_item_configurations (quotation_item_id, size_index)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_order_item_configuration_size
  ON public.sales_order_item_configurations (order_item_id, size_index)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.sales_quotation_item_configurations.size_index IS
  'Position of this size within its quotation line, 0-based. A line may carry several sizes, each with its own moulding, mat, glass and backing; they share a billing mode and bill as one line.';

COMMENT ON COLUMN public.sales_order_item_configurations.size_index IS
  'Position of this size within its sales order line, 0-based. Mirrors sales_quotation_item_configurations.size_index.';

ALTER TABLE public.sales_quotation_item_configurations
  ADD COLUMN IF NOT EXISTS frame_quantity NUMERIC(12, 2) NOT NULL DEFAULT 1
    CHECK (frame_quantity > 0);

ALTER TABLE public.sales_order_item_configurations
  ADD COLUMN IF NOT EXISTS frame_quantity NUMERIC(12, 2) NOT NULL DEFAULT 1
    CHECK (frame_quantity > 0);

COMMENT ON COLUMN public.sales_quotation_item_configurations.frame_quantity IS
  'How many identical frames this size covers. The line''s quantity is the sum across its sizes.';

CREATE TABLE IF NOT EXISTS public.sales_quotation_item_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies (id),
  configuration_id UUID NOT NULL
    REFERENCES public.sales_quotation_item_configurations (id) ON DELETE CASCADE,
  -- Path within the storage bucket, never a URL: signed URLs expire, so the
  -- durable reference is the path and the URL is minted per read.
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  -- Orders the strip in the preview dialog; ties broken by created_at.
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT sales_quotation_item_attachments_name_not_blank
    CHECK (length(btrim(file_name)) > 0),
  CONSTRAINT sales_quotation_item_attachments_size_positive
    CHECK (file_size_bytes > 0)
);

CREATE INDEX IF NOT EXISTS idx_sales_quotation_item_attachments_configuration
  ON public.sales_quotation_item_attachments (configuration_id, sort_order)
  WHERE deleted_at IS NULL;

-- Deliberately NOT unique on storage_path. Saving a quotation soft-deletes the
-- old configurations and inserts new ones, so an unchanged file legitimately
-- gains a fresh row against a fresh configuration id on every save. Uniqueness
-- here would reject the second save of an unedited line.
CREATE INDEX IF NOT EXISTS idx_sales_quotation_item_attachments_path
  ON public.sales_quotation_item_attachments (storage_path)
  WHERE deleted_at IS NULL;

ALTER TABLE public.sales_quotation_item_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_quotation_item_attachments_select
  ON public.sales_quotation_item_attachments;
CREATE POLICY sales_quotation_item_attachments_select
  ON public.sales_quotation_item_attachments
  FOR SELECT
  USING (
    company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid())
  );

DROP POLICY IF EXISTS sales_quotation_item_attachments_mutation
  ON public.sales_quotation_item_attachments;
CREATE POLICY sales_quotation_item_attachments_mutation
  ON public.sales_quotation_item_attachments
  FOR ALL
  USING (
    company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid())
  )
  WITH CHECK (
    company_id = (SELECT users.company_id FROM public.users WHERE users.id = auth.uid())
  );

-- Private: a customer's artwork is their property, so objects are reachable only
-- through a signed URL minted for a caller who passed the RLS check above.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'frame-attachments',
  'frame-attachments',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Soft-deleting a configuration must take its attachments with it, or a
-- re-saved line would keep returning files that belong to a dead configuration.
-- Mirrors `soft_delete_quotation_mat_layers`.
CREATE OR REPLACE FUNCTION public.soft_delete_quotation_attachments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.sales_quotation_item_attachments
    SET deleted_at = NEW.deleted_at,
        updated_by = NEW.updated_by,
        updated_at = NOW()
    WHERE configuration_id = NEW.id
      AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_soft_delete_quotation_attachments
  ON public.sales_quotation_item_configurations;
CREATE TRIGGER trg_soft_delete_quotation_attachments
  AFTER UPDATE ON public.sales_quotation_item_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.soft_delete_quotation_attachments();

COMMENT ON TABLE public.sales_quotation_item_attachments IS
  'Reference files (artwork photos, frame sketches) attached to one configured frame size.';

ALTER TABLE public.sales_quotation_item_configurations
  ADD COLUMN IF NOT EXISTS framing_instructions TEXT;

ALTER TABLE public.sales_quotations
  ADD COLUMN IF NOT EXISTS items_received TEXT;

COMMENT ON COLUMN public.sales_quotation_item_configurations.framing_instructions IS
  'Free-text bench direction for this frame; prints on its requisition row.';
COMMENT ON COLUMN public.sales_quotations.items_received IS
  'Free-text record of what the customer handed over for the whole job.';

ALTER TABLE public.sales_quotation_item_configurations
  ADD COLUMN IF NOT EXISTS backing_thickness_in NUMERIC(9,4);

COMMENT ON COLUMN public.sales_quotation_item_configurations.backing_thickness_in IS
  'Plywood board thickness in inches; unpriced, printed so the workshop pulls the right sheet.';

ALTER TABLE public.sales_quotation_item_components
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(20,2) NOT NULL DEFAULT 0;

-- Preserve the commercial discount independently of the net component amount
-- when a quotation size becomes an order-size snapshot.
ALTER TABLE public.sales_order_item_components
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(20,2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT chk_order_component_discount_percent
    CHECK (discount_percent >= 0 AND discount_percent <= 100);

-- A discount outside 0–100 is a data-entry slip, not a pricing decision.
ALTER TABLE public.sales_quotation_item_components
  DROP CONSTRAINT IF EXISTS chk_component_discount_percent;
ALTER TABLE public.sales_quotation_item_components
  ADD CONSTRAINT chk_component_discount_percent
  CHECK (discount_percent >= 0 AND discount_percent <= 100);

COMMENT ON COLUMN public.sales_quotation_item_components.discount_percent IS
  'Discount rate for this part alone; the shop discounts parts, not whole lines.';
COMMENT ON COLUMN public.sales_quotation_item_components.discount_amount IS
  'Money taken off by discount_percent. total_amount is already net of it.';

ALTER TABLE public.sales_quotation_item_configurations
  ADD COLUMN IF NOT EXISTS component_discounts JSONB;

COMMENT ON COLUMN public.sales_quotation_item_configurations.component_discounts IS
  'Discount rate per component key, so a reopened line restores what was quoted.';

ALTER TABLE public.sales_quotation_item_configurations
  ADD COLUMN IF NOT EXISTS flexipoints_numerator   INTEGER,
  ADD COLUMN IF NOT EXISTS flexipoints_denominator INTEGER,
  ADD COLUMN IF NOT EXISTS multipoints_numerator   INTEGER,
  ADD COLUMN IF NOT EXISTS multipoints_denominator INTEGER;

ALTER TABLE public.sales_order_item_configurations
  ADD COLUMN IF NOT EXISTS flexipoints_numerator   INTEGER,
  ADD COLUMN IF NOT EXISTS flexipoints_denominator INTEGER,
  ADD COLUMN IF NOT EXISTS multipoints_numerator   INTEGER,
  ADD COLUMN IF NOT EXISTS multipoints_denominator INTEGER;

-- A zero denominator is not a fraction. A zero numerator prices as the
-- denominator alone, which the shop does bill, so it stays allowed.
ALTER TABLE public.sales_quotation_item_configurations
  DROP CONSTRAINT IF EXISTS chk_sq_config_point_fractions,
  ADD CONSTRAINT chk_sq_config_point_fractions CHECK (
    (flexipoints_numerator   IS NULL OR flexipoints_numerator   >= 0) AND
    (flexipoints_denominator IS NULL OR flexipoints_denominator >  0) AND
    (multipoints_numerator   IS NULL OR multipoints_numerator   >= 0) AND
    (multipoints_denominator IS NULL OR multipoints_denominator >  0)
  );

ALTER TABLE public.sales_order_item_configurations
  DROP CONSTRAINT IF EXISTS chk_so_config_point_fractions,
  ADD CONSTRAINT chk_so_config_point_fractions CHECK (
    (flexipoints_numerator   IS NULL OR flexipoints_numerator   >= 0) AND
    (flexipoints_denominator IS NULL OR flexipoints_denominator >  0) AND
    (multipoints_numerator   IS NULL OR multipoints_numerator   >= 0) AND
    (multipoints_denominator IS NULL OR multipoints_denominator >  0)
  );

ALTER TABLE public.sales_quotation_item_configurations
  ADD COLUMN IF NOT EXISTS mat_border_l_in NUMERIC(9,4),
  ADD COLUMN IF NOT EXISTS mat_border_w_in NUMERIC(9,4);

ALTER TABLE public.sales_order_item_configurations
  ADD COLUMN IF NOT EXISTS mat_border_l_in NUMERIC(9,4),
  ADD COLUMN IF NOT EXISTS mat_border_w_in NUMERIC(9,4);

-- A border of zero is not a mat; NULL means "no matting on this line".
ALTER TABLE public.sales_quotation_item_configurations
  DROP CONSTRAINT IF EXISTS chk_sq_config_mat_border,
  ADD CONSTRAINT chk_sq_config_mat_border CHECK (
    (mat_border_l_in IS NULL OR mat_border_l_in > 0) AND
    (mat_border_w_in IS NULL OR mat_border_w_in > 0)
  );

ALTER TABLE public.sales_order_item_configurations
  DROP CONSTRAINT IF EXISTS chk_so_config_mat_border,
  ADD CONSTRAINT chk_so_config_mat_border CHECK (
    (mat_border_l_in IS NULL OR mat_border_l_in > 0) AND
    (mat_border_w_in IS NULL OR mat_border_w_in > 0)
  );

COMMENT ON COLUMN public.sales_quotation_item_mat_layers.border_or_reveal_l_in IS
  'Deprecated 2026-09-03: the border moved to sales_quotation_item_configurations.mat_border_l_in and reveals are a fixed constant. No longer written.';
COMMENT ON COLUMN public.sales_quotation_item_mat_layers.border_or_reveal_w_in IS
  'Deprecated 2026-09-03: see border_or_reveal_l_in.';

ALTER TABLE public.sales_quotation_item_configurations
  ADD COLUMN IF NOT EXISTS frame_rate NUMERIC(20,2);

ALTER TABLE public.sales_order_item_configurations
  ADD COLUMN IF NOT EXISTS frame_rate NUMERIC(20,2);

-- A negative rate would credit the customer for taking a frame away.
ALTER TABLE public.sales_quotation_item_configurations
  DROP CONSTRAINT IF EXISTS chk_sq_config_frame_rate,
  ADD CONSTRAINT chk_sq_config_frame_rate CHECK (frame_rate IS NULL OR frame_rate >= 0);

ALTER TABLE public.sales_order_item_configurations
  DROP CONSTRAINT IF EXISTS chk_so_config_frame_rate,
  ADD CONSTRAINT chk_so_config_frame_rate CHECK (frame_rate IS NULL OR frame_rate >= 0);

ALTER TABLE public.sales_quotation_item_configurations
  ADD COLUMN IF NOT EXISTS mat_unit_rate NUMERIC(20,2);

ALTER TABLE public.sales_order_item_configurations
  ADD COLUMN IF NOT EXISTS mat_unit_rate NUMERIC(20,2);

ALTER TABLE public.sales_quotation_item_configurations
  DROP CONSTRAINT IF EXISTS chk_sq_config_mat_unit_rate,
  ADD CONSTRAINT chk_sq_config_mat_unit_rate CHECK (mat_unit_rate IS NULL OR mat_unit_rate >= 0);

ALTER TABLE public.sales_order_item_configurations
  DROP CONSTRAINT IF EXISTS chk_so_config_mat_unit_rate,
  ADD CONSTRAINT chk_so_config_mat_unit_rate CHECK (mat_unit_rate IS NULL OR mat_unit_rate >= 0);

COMMIT;
