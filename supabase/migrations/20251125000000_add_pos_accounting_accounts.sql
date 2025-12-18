-- Migration: Add POS Accounting GL Accounts
-- Version: 20251125000000
-- Description: Adds Sales Discounts and Sales Tax Payable accounts for POS integration
-- Author: System
-- Date: 2025-11-25

-- ============================================================================
-- Add Sales Discounts Account (Contra-Revenue)
-- ============================================================================

INSERT INTO accounts (
  company_id,
  account_number,
  account_name,
  account_type,
  parent_account_id,
  level,
  description,
  is_system_account,
  is_active,
  sort_order
)
SELECT
  c.id,
  'R-4010',
  'Sales Discounts',
  'revenue',
  (SELECT id FROM accounts WHERE account_number = 'R-4000' AND company_id = c.id LIMIT 1),
  2,
  'Contra-revenue account for sales discounts and price reductions',
  true,
  true,
  4010
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM accounts
  WHERE account_number = 'R-4010' AND company_id = c.id
);

-- ============================================================================
-- Add Sales Tax Payable Account (Liability)
-- ============================================================================

INSERT INTO accounts (
  company_id,
  account_number,
  account_name,
  account_type,
  parent_account_id,
  level,
  description,
  is_system_account,
  is_active,
  sort_order
)
SELECT
  c.id,
  'L-2100',
  'Sales Tax Payable',
  'liability',
  NULL, -- Top-level liability account
  1,
  'Output VAT/sales tax collected from customers',
  true,
  true,
  2100
FROM companies c
WHERE NOT EXISTS (
  SELECT 1 FROM accounts
  WHERE account_number = 'L-2100' AND company_id = c.id
);

-- ============================================================================
-- Verify Accounts Created
-- ============================================================================

-- Show count of new accounts created per company
DO $$
DECLARE
  discount_count INTEGER;
  tax_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO discount_count FROM accounts WHERE account_number = 'R-4010';
  SELECT COUNT(*) INTO tax_count FROM accounts WHERE account_number = 'L-2100';

  RAISE NOTICE 'Migration completed:';
  RAISE NOTICE '  - Sales Discounts accounts created: %', discount_count;
  RAISE NOTICE '  - Sales Tax Payable accounts created: %', tax_count;
END $$;
