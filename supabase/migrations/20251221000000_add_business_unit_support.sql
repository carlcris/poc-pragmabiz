-- ============================================================================
-- Migration: Multi-Business Unit Support - Phase 1
-- Purpose: Add business unit tables, extend operational tables, backfill data
-- Date: 2025-12-21
-- Compliance: Strictly follows multi-business-unit-prd.md
-- ============================================================================

-- ============================================================================
-- SECTION 1: Create business_units Table
-- ============================================================================

CREATE TABLE business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50), -- branch, outlet, warehouse, shop, office
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_by UUID REFERENCES users(id),

  CONSTRAINT uq_bu_code_per_company UNIQUE(company_id, code)
);

-- Indexes for performance
CREATE INDEX idx_business_units_company ON business_units(company_id);
CREATE INDEX idx_business_units_active ON business_units(is_active);
CREATE INDEX idx_business_units_code ON business_units(code);

-- Comments
COMMENT ON TABLE business_units IS 'Business units (branches, outlets, warehouses) under a company';
COMMENT ON COLUMN business_units.type IS 'Type: branch, outlet, warehouse, shop, office';
COMMENT ON COLUMN business_units.is_active IS 'Active business units are selectable by users';

-- ============================================================================
-- SECTION 2: Create user_business_unit_access Table
-- ============================================================================

CREATE TABLE user_business_unit_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
  role VARCHAR(50), -- admin, manager, staff
  is_default BOOLEAN DEFAULT false NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  granted_by UUID REFERENCES users(id),

  PRIMARY KEY (user_id, business_unit_id)
);

-- Indexes for performance
CREATE INDEX idx_user_bu_access_user ON user_business_unit_access(user_id);
CREATE INDEX idx_user_bu_access_bu ON user_business_unit_access(business_unit_id);
CREATE INDEX idx_user_bu_access_default ON user_business_unit_access(user_id, is_default) WHERE is_default = true;

-- Constraint: Only one default BU per user
CREATE UNIQUE INDEX uq_user_default_bu ON user_business_unit_access(user_id) WHERE is_default = true;

-- Comments
COMMENT ON TABLE user_business_unit_access IS 'Maps users to accessible business units with roles';
COMMENT ON COLUMN user_business_unit_access.role IS 'User role within this BU: admin, manager, staff';
COMMENT ON COLUMN user_business_unit_access.is_default IS 'Default BU auto-selected at login (one per user)';

-- ============================================================================
-- SECTION 3: Extend Operational Tables with business_unit_id
-- ============================================================================

-- Sales Module
ALTER TABLE sales_quotations ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE sales_orders ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE sales_invoices ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- Purchase Module
ALTER TABLE purchase_orders ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE purchase_receipts ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- Inventory Module
ALTER TABLE stock_transactions ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE stock_adjustments ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE stock_transfers ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- POS Module
ALTER TABLE pos_transactions ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- Transformation Module
ALTER TABLE transformation_orders ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE transformation_templates ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- Master Data
ALTER TABLE customers ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE suppliers ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE warehouses ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE employees ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- Van Sales Module
ALTER TABLE van_eod_reconciliations ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- Accounting Module
ALTER TABLE journal_entries ADD COLUMN business_unit_id UUID REFERENCES business_units(id);
ALTER TABLE invoice_payments ADD COLUMN business_unit_id UUID REFERENCES business_units(id);

-- Comments
COMMENT ON COLUMN sales_quotations.business_unit_id IS 'Business unit that created this quotation';
COMMENT ON COLUMN sales_orders.business_unit_id IS 'Business unit that owns this order';
COMMENT ON COLUMN sales_invoices.business_unit_id IS 'Business unit that owns this invoice';
COMMENT ON COLUMN purchase_orders.business_unit_id IS 'Business unit that created this PO';
COMMENT ON COLUMN purchase_receipts.business_unit_id IS 'Business unit that received goods';
COMMENT ON COLUMN stock_transactions.business_unit_id IS 'Business unit for this stock movement';
COMMENT ON COLUMN stock_adjustments.business_unit_id IS 'Business unit performing adjustment';
COMMENT ON COLUMN stock_transfers.business_unit_id IS 'Business unit initiating transfer';
COMMENT ON COLUMN pos_transactions.business_unit_id IS 'POS outlet business unit';
COMMENT ON COLUMN transformation_orders.business_unit_id IS 'Business unit performing transformation';
COMMENT ON COLUMN transformation_templates.business_unit_id IS 'Business unit that owns template';
COMMENT ON COLUMN customers.business_unit_id IS 'Primary business unit for customer';
COMMENT ON COLUMN suppliers.business_unit_id IS 'Primary business unit for supplier';
COMMENT ON COLUMN warehouses.business_unit_id IS 'Business unit that owns warehouse';
COMMENT ON COLUMN employees.business_unit_id IS 'Primary business unit for employee';
COMMENT ON COLUMN van_eod_reconciliations.business_unit_id IS 'Business unit for van EOD reconciliation';
COMMENT ON COLUMN journal_entries.business_unit_id IS 'Business unit for journal entry';
COMMENT ON COLUMN invoice_payments.business_unit_id IS 'Business unit receiving payment';

-- ============================================================================
-- SECTION 4: Create Default Business Unit
-- ============================================================================

-- Insert default business unit for Demo Company (if company exists)
-- Note: Seed data runs after migrations, so this will be NULL during migration
-- The business unit will be created during seed data instead
DO $$
DECLARE
  v_company_id UUID;
BEGIN
  -- Check if demo company exists
  SELECT id INTO v_company_id FROM companies WHERE id = '00000000-0000-0000-0000-000000000001';

  IF v_company_id IS NOT NULL THEN
    -- Insert default business unit
    INSERT INTO business_units (id, company_id, code, name, type, is_active, created_at, updated_at)
    VALUES (
      '00000000-0000-0000-0000-000000000100',
      v_company_id,
      'MAIN',
      'Main Office',
      'primary',
      true,
      now(),
      now()
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Default business unit created for company %', v_company_id;
  ELSE
    RAISE NOTICE 'Demo company not found yet - will be created during seed data';
  END IF;
END $$;

-- ============================================================================
-- SECTION 5: Backfill Existing Data with Default Business Unit
-- ============================================================================

DO $$
DECLARE
  default_bu_id UUID := '00000000-0000-0000-0000-000000000100';
  updated_count INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Starting Business Unit Backfill Process';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Default BU ID: %', default_bu_id;

  -- Sales Module
  UPDATE sales_quotations SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled sales_quotations: % records', updated_count;

  UPDATE sales_orders SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled sales_orders: % records', updated_count;

  UPDATE sales_invoices SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled sales_invoices: % records', updated_count;

  -- Purchase Module
  UPDATE purchase_orders SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled purchase_orders: % records', updated_count;

  UPDATE purchase_receipts SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled purchase_receipts: % records', updated_count;

  -- Inventory Module
  UPDATE stock_transactions SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled stock_transactions: % records', updated_count;

  UPDATE stock_adjustments SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled stock_adjustments: % records', updated_count;

  UPDATE stock_transfers SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled stock_transfers: % records', updated_count;

  -- POS Module
  UPDATE pos_transactions SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled pos_transactions: % records', updated_count;

  -- Transformation Module
  UPDATE transformation_orders SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled transformation_orders: % records', updated_count;

  UPDATE transformation_templates SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled transformation_templates: % records', updated_count;

  -- Master Data
  UPDATE customers SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled customers: % records', updated_count;

  UPDATE suppliers SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled suppliers: % records', updated_count;

  UPDATE warehouses SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled warehouses: % records', updated_count;

  UPDATE employees SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled employees: % records', updated_count;

  -- Van Sales Module
  UPDATE van_eod_reconciliations SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled van_eod_reconciliations: % records', updated_count;

  -- Accounting Module
  UPDATE journal_entries SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled journal_entries: % records', updated_count;

  UPDATE invoice_payments SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled invoice_payments: % records', updated_count;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Backfill Process Completed Successfully';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- SECTION 6: Grant Default BU Access to All Existing Users
-- ============================================================================

-- Grant all existing users access to the default business unit
INSERT INTO user_business_unit_access (user_id, business_unit_id, role, is_default, granted_at)
SELECT
  u.id,
  '00000000-0000-0000-0000-000000000100', -- Default BU ID
  'admin', -- Grant admin role to existing users
  true, -- Set as default
  now()
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_business_unit_access
  WHERE user_id = u.id
  AND business_unit_id = '00000000-0000-0000-0000-000000000100'
);

-- ============================================================================
-- SECTION 7: Verification Queries (for logging)
-- ============================================================================

DO $$
DECLARE
  bu_count INTEGER;
  access_count INTEGER;
  null_bu_count INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Verification';
  RAISE NOTICE '========================================';

  -- Count business units
  SELECT COUNT(*) INTO bu_count FROM business_units;
  RAISE NOTICE 'Total business units created: %', bu_count;

  -- Count user access grants
  SELECT COUNT(*) INTO access_count FROM user_business_unit_access;
  RAISE NOTICE 'Total user BU access grants: %', access_count;

  -- Check for NULL business_unit_id in operational tables
  SELECT COUNT(*) INTO null_bu_count FROM sales_quotations WHERE business_unit_id IS NULL;
  IF null_bu_count > 0 THEN
    RAISE WARNING 'sales_quotations has % records with NULL business_unit_id', null_bu_count;
  ELSE
    RAISE NOTICE '✓ sales_quotations: All records have business_unit_id';
  END IF;

  SELECT COUNT(*) INTO null_bu_count FROM sales_orders WHERE business_unit_id IS NULL;
  IF null_bu_count > 0 THEN
    RAISE WARNING 'sales_orders has % records with NULL business_unit_id', null_bu_count;
  ELSE
    RAISE NOTICE '✓ sales_orders: All records have business_unit_id';
  END IF;

  SELECT COUNT(*) INTO null_bu_count FROM sales_invoices WHERE business_unit_id IS NULL;
  IF null_bu_count > 0 THEN
    RAISE WARNING 'sales_invoices has % records with NULL business_unit_id', null_bu_count;
  ELSE
    RAISE NOTICE '✓ sales_invoices: All records have business_unit_id';
  END IF;

  SELECT COUNT(*) INTO null_bu_count FROM stock_transactions WHERE business_unit_id IS NULL;
  IF null_bu_count > 0 THEN
    RAISE WARNING 'stock_transactions has % records with NULL business_unit_id', null_bu_count;
  ELSE
    RAISE NOTICE '✓ stock_transactions: All records have business_unit_id';
  END IF;

  SELECT COUNT(*) INTO null_bu_count FROM customers WHERE business_unit_id IS NULL;
  IF null_bu_count > 0 THEN
    RAISE WARNING 'customers has % records with NULL business_unit_id', null_bu_count;
  ELSE
    RAISE NOTICE '✓ customers: All records have business_unit_id';
  END IF;

  SELECT COUNT(*) INTO null_bu_count FROM warehouses WHERE business_unit_id IS NULL;
  IF null_bu_count > 0 THEN
    RAISE WARNING 'warehouses has % records with NULL business_unit_id', null_bu_count;
  ELSE
    RAISE NOTICE '✓ warehouses: All records have business_unit_id';
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Phase 1 Migration Completed Successfully';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Review migration output above';
  RAISE NOTICE '2. Verify all tables have business_unit_id';
  RAISE NOTICE '3. Proceed to Phase 2: RLS Implementation';
  RAISE NOTICE '';
END $$;
