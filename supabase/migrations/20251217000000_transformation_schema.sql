-- Migration: Material/Product Transformation Schema
-- Purpose: Create tables for transformation templates, orders, and lineage tracking
-- Date: 2025-12-17
-- Part of: Inventory Module - Transformation Feature (EPIC 2)
--
-- This migration adds:
-- - transformation_templates: Reusable transformation recipes
-- - transformation_template_inputs/outputs: Input/output items for templates
-- - transformation_orders: Actual transformation executions
-- - transformation_order_inputs/outputs: Consumed/produced items in orders
-- - transformation_lineage: N→M traceability between inputs and outputs

-- ============================================================================
-- TABLE: transformation_templates
-- Purpose: Define reusable transformation recipes (e.g., 10kg flour → 100 bread rolls)
-- ============================================================================

CREATE TABLE transformation_templates (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    template_code       VARCHAR(50) NOT NULL,
    template_name       VARCHAR(200) NOT NULL,
    description         TEXT,

    -- Immutability enforcement
    is_active           BOOLEAN DEFAULT true NOT NULL,
    usage_count         INTEGER DEFAULT 0 NOT NULL,

    -- Audit fields
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          UUID NOT NULL REFERENCES users(id),
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          UUID NOT NULL REFERENCES users(id),
    deleted_at          TIMESTAMP NULL,

    -- Constraints
    CONSTRAINT uq_template_code_company UNIQUE(company_id, template_code, deleted_at)
);

-- Indexes for performance
CREATE INDEX idx_trans_templates_company ON transformation_templates(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trans_templates_active ON transformation_templates(is_active) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE transformation_templates IS 'Reusable transformation recipes defining inputs → outputs';
COMMENT ON COLUMN transformation_templates.usage_count IS 'Number of orders using this template (enforces immutability when > 0)';
COMMENT ON COLUMN transformation_templates.is_active IS 'Active templates can be used for new orders';

-- ============================================================================
-- TABLE: transformation_template_inputs
-- Purpose: Define input items required for a transformation template
-- ============================================================================

CREATE TABLE transformation_template_inputs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         UUID NOT NULL REFERENCES transformation_templates(id) ON DELETE CASCADE,
    item_id             UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    quantity            DECIMAL(20, 4) NOT NULL CHECK (quantity > 0),
    uom_id              UUID NOT NULL REFERENCES units_of_measure(id),
    sequence            INTEGER NOT NULL DEFAULT 1,
    notes               TEXT,

    -- Audit fields
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          UUID NOT NULL REFERENCES users(id),
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          UUID NOT NULL REFERENCES users(id),

    -- Constraints
    CONSTRAINT uq_template_input_item UNIQUE(template_id, item_id)
);

-- Indexes
CREATE INDEX idx_trans_template_inputs_template ON transformation_template_inputs(template_id);
CREATE INDEX idx_trans_template_inputs_item ON transformation_template_inputs(item_id);

-- Comments
COMMENT ON TABLE transformation_template_inputs IS 'Input items required for transformation (N inputs per template)';
COMMENT ON COLUMN transformation_template_inputs.sequence IS 'Display order for inputs';

-- ============================================================================
-- TABLE: transformation_template_outputs
-- Purpose: Define output items produced by a transformation template
-- ============================================================================

CREATE TABLE transformation_template_outputs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         UUID NOT NULL REFERENCES transformation_templates(id) ON DELETE CASCADE,
    item_id             UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    quantity            DECIMAL(20, 4) NOT NULL CHECK (quantity > 0),
    uom_id              UUID NOT NULL REFERENCES units_of_measure(id),
    sequence            INTEGER NOT NULL DEFAULT 1,
    is_scrap            BOOLEAN DEFAULT false NOT NULL,
    notes               TEXT,

    -- Audit fields
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          UUID NOT NULL REFERENCES users(id),
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          UUID NOT NULL REFERENCES users(id),

    -- Constraints
    CONSTRAINT uq_template_output_item UNIQUE(template_id, item_id)
);

-- Indexes
CREATE INDEX idx_trans_template_outputs_template ON transformation_template_outputs(template_id);
CREATE INDEX idx_trans_template_outputs_item ON transformation_template_outputs(item_id);

-- Comments
COMMENT ON TABLE transformation_template_outputs IS 'Output items produced by transformation (N outputs per template)';
COMMENT ON COLUMN transformation_template_outputs.is_scrap IS 'Mark as scrap/waste output (minimal cost allocation)';

-- ============================================================================
-- TABLE: transformation_orders
-- Purpose: Actual transformation execution instances
-- ============================================================================

CREATE TABLE transformation_orders (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    order_code              VARCHAR(50) NOT NULL,
    template_id             UUID NOT NULL REFERENCES transformation_templates(id) ON DELETE RESTRICT,

    -- Warehouse context
    source_warehouse_id     UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    dest_warehouse_id       UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,

    -- State machine: DRAFT → RELEASED → EXECUTING → COMPLETED → CLOSED
    status                  VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                            CHECK (status IN ('DRAFT', 'RELEASED', 'EXECUTING', 'COMPLETED', 'CLOSED', 'CANCELLED')),

    -- Quantities
    planned_quantity        DECIMAL(20, 4) NOT NULL CHECK (planned_quantity > 0),
    actual_quantity         DECIMAL(20, 4),

    -- Cost tracking
    total_input_cost        DECIMAL(20, 4) DEFAULT 0,
    total_output_cost       DECIMAL(20, 4) DEFAULT 0,
    cost_variance           DECIMAL(20, 4) DEFAULT 0,
    variance_notes          TEXT,

    -- Dates
    order_date              DATE NOT NULL DEFAULT CURRENT_DATE,
    planned_date            DATE,
    execution_date          DATE,
    completion_date         DATE,

    -- Additional context
    notes                   TEXT,
    reference_type          VARCHAR(50),
    reference_id            UUID,

    -- Audit fields
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL REFERENCES users(id),
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              UUID NOT NULL REFERENCES users(id),
    deleted_at              TIMESTAMP NULL,

    -- Constraints
    CONSTRAINT uq_order_code_company UNIQUE(company_id, order_code, deleted_at),
    CONSTRAINT chk_actual_qty_when_completed CHECK (
        (status IN ('COMPLETED', 'CLOSED') AND actual_quantity IS NOT NULL) OR
        (status NOT IN ('COMPLETED', 'CLOSED'))
    )
);

-- Indexes for performance
CREATE INDEX idx_trans_orders_company ON transformation_orders(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trans_orders_status ON transformation_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_trans_orders_template ON transformation_orders(template_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trans_orders_source_wh ON transformation_orders(source_warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trans_orders_dest_wh ON transformation_orders(dest_warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_trans_orders_dates ON transformation_orders(order_date DESC) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE transformation_orders IS 'Transformation execution instances with state machine';
COMMENT ON COLUMN transformation_orders.status IS 'State: DRAFT → RELEASED → EXECUTING → COMPLETED → CLOSED';
COMMENT ON COLUMN transformation_orders.planned_quantity IS 'Planned multiplier for template quantities';
COMMENT ON COLUMN transformation_orders.actual_quantity IS 'Actual multiplier used during execution';
COMMENT ON COLUMN transformation_orders.cost_variance IS 'Difference between planned and actual costs';

-- ============================================================================
-- TABLE: transformation_order_inputs
-- Purpose: Actual input items consumed in a transformation order
-- ============================================================================

CREATE TABLE transformation_order_inputs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                UUID NOT NULL REFERENCES transformation_orders(id) ON DELETE CASCADE,
    item_id                 UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    warehouse_id            UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,

    -- Quantities
    planned_quantity        DECIMAL(20, 4) NOT NULL CHECK (planned_quantity > 0),
    consumed_quantity       DECIMAL(20, 4),
    uom_id                  UUID NOT NULL REFERENCES units_of_measure(id),

    -- Cost tracking (from item_warehouse at time of consumption)
    unit_cost               DECIMAL(20, 4) DEFAULT 0,
    total_cost              DECIMAL(20, 4) DEFAULT 0,

    -- Stock transaction reference
    stock_transaction_id    UUID REFERENCES stock_transactions(id),

    -- Audit fields
    sequence                INTEGER NOT NULL DEFAULT 1,
    notes                   TEXT,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL REFERENCES users(id),
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              UUID NOT NULL REFERENCES users(id),

    -- Constraints
    CONSTRAINT uq_order_input_item UNIQUE(order_id, item_id),
    CONSTRAINT chk_consumed_qty_when_executing CHECK (
        (consumed_quantity IS NULL) OR (consumed_quantity > 0)
    )
);

-- Indexes
CREATE INDEX idx_trans_order_inputs_order ON transformation_order_inputs(order_id);
CREATE INDEX idx_trans_order_inputs_item ON transformation_order_inputs(item_id);
CREATE INDEX idx_trans_order_inputs_warehouse ON transformation_order_inputs(warehouse_id);

-- Comments
COMMENT ON TABLE transformation_order_inputs IS 'Actual input items consumed during transformation';
COMMENT ON COLUMN transformation_order_inputs.consumed_quantity IS 'Actual quantity consumed (may differ from planned)';
COMMENT ON COLUMN transformation_order_inputs.stock_transaction_id IS 'Reference to stock_transactions (type=out) for audit';

-- ============================================================================
-- TABLE: transformation_order_outputs
-- Purpose: Actual output items produced in a transformation order
-- ============================================================================

CREATE TABLE transformation_order_outputs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                UUID NOT NULL REFERENCES transformation_orders(id) ON DELETE CASCADE,
    item_id                 UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    warehouse_id            UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,

    -- Quantities
    planned_quantity        DECIMAL(20, 4) NOT NULL CHECK (planned_quantity > 0),
    produced_quantity       DECIMAL(20, 4),
    uom_id                  UUID NOT NULL REFERENCES units_of_measure(id),

    -- Cost tracking (allocated from inputs)
    allocated_cost_per_unit DECIMAL(20, 4) DEFAULT 0,
    total_allocated_cost    DECIMAL(20, 4) DEFAULT 0,

    -- Stock transaction reference
    stock_transaction_id    UUID REFERENCES stock_transactions(id),

    -- Output classification
    is_scrap                BOOLEAN DEFAULT false NOT NULL,

    -- Audit fields
    sequence                INTEGER NOT NULL DEFAULT 1,
    notes                   TEXT,
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by              UUID NOT NULL REFERENCES users(id),
    updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              UUID NOT NULL REFERENCES users(id),

    -- Constraints
    CONSTRAINT uq_order_output_item UNIQUE(order_id, item_id),
    CONSTRAINT chk_produced_qty_when_executing CHECK (
        (produced_quantity IS NULL) OR (produced_quantity > 0)
    )
);

-- Indexes
CREATE INDEX idx_trans_order_outputs_order ON transformation_order_outputs(order_id);
CREATE INDEX idx_trans_order_outputs_item ON transformation_order_outputs(item_id);
CREATE INDEX idx_trans_order_outputs_warehouse ON transformation_order_outputs(warehouse_id);

-- Comments
COMMENT ON TABLE transformation_order_outputs IS 'Actual output items produced during transformation';
COMMENT ON COLUMN transformation_order_outputs.produced_quantity IS 'Actual quantity produced (may differ from planned)';
COMMENT ON COLUMN transformation_order_outputs.allocated_cost_per_unit IS 'Cost per unit allocated from inputs';
COMMENT ON COLUMN transformation_order_outputs.stock_transaction_id IS 'Reference to stock_transactions (type=in) for audit';

-- ============================================================================
-- TABLE: transformation_lineage
-- Purpose: N→M traceability between input and output items
-- ============================================================================

CREATE TABLE transformation_lineage (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                UUID NOT NULL REFERENCES transformation_orders(id) ON DELETE CASCADE,

    -- Lineage relationship
    input_line_id           UUID NOT NULL REFERENCES transformation_order_inputs(id) ON DELETE CASCADE,
    output_line_id          UUID NOT NULL REFERENCES transformation_order_outputs(id) ON DELETE CASCADE,

    -- Proportional tracking (for N→M relationships)
    input_quantity_used     DECIMAL(20, 4) NOT NULL CHECK (input_quantity_used > 0),
    output_quantity_from    DECIMAL(20, 4) NOT NULL CHECK (output_quantity_from > 0),
    cost_attributed         DECIMAL(20, 4) DEFAULT 0,

    -- Audit fields
    created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT uq_lineage_input_output UNIQUE(input_line_id, output_line_id)
);

-- Indexes for lineage queries
CREATE INDEX idx_trans_lineage_order ON transformation_lineage(order_id);
CREATE INDEX idx_trans_lineage_input ON transformation_lineage(input_line_id);
CREATE INDEX idx_trans_lineage_output ON transformation_lineage(output_line_id);

-- Comments
COMMENT ON TABLE transformation_lineage IS 'N→M traceability: which inputs produced which outputs';
COMMENT ON COLUMN transformation_lineage.input_quantity_used IS 'Quantity of input used for this output';
COMMENT ON COLUMN transformation_lineage.output_quantity_from IS 'Quantity of output from this input';
COMMENT ON COLUMN transformation_lineage.cost_attributed IS 'Cost attributed from input to output';

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_transformation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trans_templates_updated
    BEFORE UPDATE ON transformation_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_transformation_timestamp();

CREATE TRIGGER trg_trans_template_inputs_updated
    BEFORE UPDATE ON transformation_template_inputs
    FOR EACH ROW
    EXECUTE FUNCTION update_transformation_timestamp();

CREATE TRIGGER trg_trans_template_outputs_updated
    BEFORE UPDATE ON transformation_template_outputs
    FOR EACH ROW
    EXECUTE FUNCTION update_transformation_timestamp();

CREATE TRIGGER trg_trans_orders_updated
    BEFORE UPDATE ON transformation_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_transformation_timestamp();

CREATE TRIGGER trg_trans_order_inputs_updated
    BEFORE UPDATE ON transformation_order_inputs
    FOR EACH ROW
    EXECUTE FUNCTION update_transformation_timestamp();

CREATE TRIGGER trg_trans_order_outputs_updated
    BEFORE UPDATE ON transformation_order_outputs
    FOR EACH ROW
    EXECUTE FUNCTION update_transformation_timestamp();

-- ============================================================================
-- FUNCTION: Increment template usage count
-- Purpose: Increment usage_count when a new order references a template
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- Only increment on INSERT, and only if not already CANCELLED/DELETED
    IF TG_OP = 'INSERT' AND NEW.deleted_at IS NULL AND NEW.status != 'CANCELLED' THEN
        UPDATE transformation_templates
        SET usage_count = usage_count + 1
        WHERE id = NEW.template_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_increment_template_usage
    AFTER INSERT ON transformation_orders
    FOR EACH ROW
    EXECUTE FUNCTION increment_template_usage();

-- ============================================================================
-- FUNCTION: Prevent template modification when in use
-- Purpose: Block updates to templates that have usage_count > 0
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_template_modification()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow status changes (deactivation) but block structural changes
    IF OLD.usage_count > 0 AND (
        OLD.template_code != NEW.template_code OR
        OLD.template_name != NEW.template_name OR
        OLD.description IS DISTINCT FROM NEW.description
    ) THEN
        RAISE EXCEPTION 'Cannot modify template % because it is used by % order(s). Template is locked.',
            OLD.template_code, OLD.usage_count
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_template_modification
    BEFORE UPDATE ON transformation_templates
    FOR EACH ROW
    EXECUTE FUNCTION prevent_template_modification();

-- ============================================================================
-- FUNCTION: Prevent input/output modification when template is in use
-- Purpose: Block changes to template inputs/outputs when usage_count > 0
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_template_detail_modification()
RETURNS TRIGGER AS $$
DECLARE
    v_usage_count INTEGER;
BEGIN
    -- Get the template's usage count
    SELECT usage_count INTO v_usage_count
    FROM transformation_templates
    WHERE id = OLD.template_id;

    IF v_usage_count > 0 THEN
        RAISE EXCEPTION 'Cannot modify template inputs/outputs because template is used by % order(s). Template is locked.',
            v_usage_count
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_template_input_modification
    BEFORE UPDATE OR DELETE ON transformation_template_inputs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_template_detail_modification();

CREATE TRIGGER trg_prevent_template_output_modification
    BEFORE UPDATE OR DELETE ON transformation_template_outputs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_template_detail_modification();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Purpose: Multi-tenant isolation - users see only their company's data
-- ============================================================================

-- Enable RLS
ALTER TABLE transformation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_template_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_template_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_order_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_order_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_lineage ENABLE ROW LEVEL SECURITY;

-- Templates RLS
CREATE POLICY "Allow authenticated users to manage transformation templates"
    ON transformation_templates
    FOR ALL
    TO authenticated
    USING (true);

-- Template inputs/outputs RLS
CREATE POLICY "Allow authenticated users to manage template inputs"
    ON transformation_template_inputs
    FOR ALL
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to manage template outputs"
    ON transformation_template_outputs
    FOR ALL
    TO authenticated
    USING (true);

-- Orders RLS
CREATE POLICY "Allow authenticated users to manage transformation orders"
    ON transformation_orders
    FOR ALL
    TO authenticated
    USING (true);

-- Order inputs/outputs RLS
CREATE POLICY "Allow authenticated users to manage order inputs"
    ON transformation_order_inputs
    FOR ALL
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to manage order outputs"
    ON transformation_order_outputs
    FOR ALL
    TO authenticated
    USING (true);

-- Lineage RLS
CREATE POLICY "Allow authenticated users to view lineage"
    ON transformation_lineage
    FOR ALL
    TO authenticated
    USING (true);

-- ============================================================================
-- GRANTS: Ensure authenticated users can access tables
-- ============================================================================

GRANT ALL ON transformation_templates TO authenticated;
GRANT ALL ON transformation_template_inputs TO authenticated;
GRANT ALL ON transformation_template_outputs TO authenticated;
GRANT ALL ON transformation_orders TO authenticated;
GRANT ALL ON transformation_order_inputs TO authenticated;
GRANT ALL ON transformation_order_outputs TO authenticated;
GRANT ALL ON transformation_lineage TO authenticated;
