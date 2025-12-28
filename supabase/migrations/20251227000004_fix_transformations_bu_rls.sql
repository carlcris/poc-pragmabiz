-- Fix Transformation Templates and Orders Business Unit RLS Policies
-- This migration:
-- 1. Backfills NULL business_unit_id with default BU for each company
-- 2. Drops old company-based policies
-- 3. Recreates strict BU-based policies without NULL loophole

-- ============================================================================
-- TRANSFORMATION TEMPLATES
-- ============================================================================

-- Step 1: Backfill NULL business_unit_id in transformation_templates
UPDATE transformation_templates
SET business_unit_id = (
  SELECT bu.id
  FROM business_units bu
  WHERE bu.company_id = transformation_templates.company_id
    AND bu.is_active = true
  ORDER BY
    CASE WHEN EXISTS (
      SELECT 1 FROM user_business_unit_access ubua
      WHERE ubua.business_unit_id = bu.id
        AND ubua.is_default = true
        AND ubua.user_id = transformation_templates.created_by
    ) THEN 0 ELSE 1 END,
    bu.created_at ASC
  LIMIT 1
)
WHERE business_unit_id IS NULL;

-- Step 2: Drop old company-based policies for transformation_templates
DROP POLICY IF EXISTS "Allow authenticated users to manage transformation templates" ON transformation_templates;

-- Step 3: Drop existing BU policies for transformation_templates
DROP POLICY IF EXISTS bu_select_policy ON transformation_templates;
DROP POLICY IF EXISTS bu_insert_policy ON transformation_templates;
DROP POLICY IF EXISTS bu_update_policy ON transformation_templates;
DROP POLICY IF EXISTS bu_delete_policy ON transformation_templates;

-- Step 4: Create strict BU-based policies for transformation_templates
CREATE POLICY bu_select_policy ON transformation_templates
  FOR SELECT
  USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON transformation_templates
  FOR INSERT
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON transformation_templates
  FOR UPDATE
  USING (business_unit_id = get_current_business_unit_id())
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON transformation_templates
  FOR DELETE
  USING (business_unit_id = get_current_business_unit_id());

-- Step 5: Create BU-based policies for transformation_template_inputs
-- Inputs inherit BU context from parent template via template_id FK
DROP POLICY IF EXISTS bu_select_policy ON transformation_template_inputs;
DROP POLICY IF EXISTS bu_insert_policy ON transformation_template_inputs;
DROP POLICY IF EXISTS bu_update_policy ON transformation_template_inputs;
DROP POLICY IF EXISTS bu_delete_policy ON transformation_template_inputs;

CREATE POLICY bu_select_policy ON transformation_template_inputs
  FOR SELECT
  USING (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_insert_policy ON transformation_template_inputs
  FOR INSERT
  WITH CHECK (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_update_policy ON transformation_template_inputs
  FOR UPDATE
  USING (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_delete_policy ON transformation_template_inputs
  FOR DELETE
  USING (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

-- Step 6: Create BU-based policies for transformation_template_outputs
-- Outputs inherit BU context from parent template via template_id FK
DROP POLICY IF EXISTS bu_select_policy ON transformation_template_outputs;
DROP POLICY IF EXISTS bu_insert_policy ON transformation_template_outputs;
DROP POLICY IF EXISTS bu_update_policy ON transformation_template_outputs;
DROP POLICY IF EXISTS bu_delete_policy ON transformation_template_outputs;

CREATE POLICY bu_select_policy ON transformation_template_outputs
  FOR SELECT
  USING (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_insert_policy ON transformation_template_outputs
  FOR INSERT
  WITH CHECK (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_update_policy ON transformation_template_outputs
  FOR UPDATE
  USING (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_delete_policy ON transformation_template_outputs
  FOR DELETE
  USING (
    template_id IN (
      SELECT id FROM transformation_templates
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

-- ============================================================================
-- TRANSFORMATION ORDERS
-- ============================================================================

-- Step 7: Backfill NULL business_unit_id in transformation_orders
UPDATE transformation_orders
SET business_unit_id = (
  SELECT bu.id
  FROM business_units bu
  WHERE bu.company_id = transformation_orders.company_id
    AND bu.is_active = true
  ORDER BY
    CASE WHEN EXISTS (
      SELECT 1 FROM user_business_unit_access ubua
      WHERE ubua.business_unit_id = bu.id
        AND ubua.is_default = true
        AND ubua.user_id = transformation_orders.created_by
    ) THEN 0 ELSE 1 END,
    bu.created_at ASC
  LIMIT 1
)
WHERE business_unit_id IS NULL;

-- Step 8: Drop old company-based policies for transformation_orders
DROP POLICY IF EXISTS "Allow authenticated users to manage transformation orders" ON transformation_orders;

-- Step 9: Drop existing BU policies for transformation_orders
DROP POLICY IF EXISTS bu_select_policy ON transformation_orders;
DROP POLICY IF EXISTS bu_insert_policy ON transformation_orders;
DROP POLICY IF EXISTS bu_update_policy ON transformation_orders;
DROP POLICY IF EXISTS bu_delete_policy ON transformation_orders;

-- Step 10: Create strict BU-based policies for transformation_orders
CREATE POLICY bu_select_policy ON transformation_orders
  FOR SELECT
  USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON transformation_orders
  FOR INSERT
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON transformation_orders
  FOR UPDATE
  USING (business_unit_id = get_current_business_unit_id())
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON transformation_orders
  FOR DELETE
  USING (business_unit_id = get_current_business_unit_id());

-- Step 11: Create BU-based policies for transformation_order_inputs
-- Inputs inherit BU context from parent order via order_id FK
DROP POLICY IF EXISTS bu_select_policy ON transformation_order_inputs;
DROP POLICY IF EXISTS bu_insert_policy ON transformation_order_inputs;
DROP POLICY IF EXISTS bu_update_policy ON transformation_order_inputs;
DROP POLICY IF EXISTS bu_delete_policy ON transformation_order_inputs;

CREATE POLICY bu_select_policy ON transformation_order_inputs
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_insert_policy ON transformation_order_inputs
  FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_update_policy ON transformation_order_inputs
  FOR UPDATE
  USING (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_delete_policy ON transformation_order_inputs
  FOR DELETE
  USING (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

-- Step 12: Create BU-based policies for transformation_order_outputs
-- Outputs inherit BU context from parent order via order_id FK
DROP POLICY IF EXISTS bu_select_policy ON transformation_order_outputs;
DROP POLICY IF EXISTS bu_insert_policy ON transformation_order_outputs;
DROP POLICY IF EXISTS bu_update_policy ON transformation_order_outputs;
DROP POLICY IF EXISTS bu_delete_policy ON transformation_order_outputs;

CREATE POLICY bu_select_policy ON transformation_order_outputs
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_insert_policy ON transformation_order_outputs
  FOR INSERT
  WITH CHECK (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_update_policy ON transformation_order_outputs
  FOR UPDATE
  USING (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_delete_policy ON transformation_order_outputs
  FOR DELETE
  USING (
    order_id IN (
      SELECT id FROM transformation_orders
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );
