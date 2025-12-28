-- Fix Stock Transactions Business Unit RLS Policies
-- This migration:
-- 1. Backfills NULL business_unit_id with default BU for each company
-- 2. Drops old company-based policies
-- 3. Recreates strict BU-based policies without NULL loophole

-- Step 1: Backfill NULL business_unit_id in stock_transactions
UPDATE stock_transactions
SET business_unit_id = (
  SELECT bu.id
  FROM business_units bu
  WHERE bu.company_id = stock_transactions.company_id
    AND bu.is_active = true
  ORDER BY
    CASE WHEN EXISTS (
      SELECT 1 FROM user_business_unit_access ubua
      WHERE ubua.business_unit_id = bu.id
        AND ubua.is_default = true
        AND ubua.user_id = stock_transactions.created_by
    ) THEN 0 ELSE 1 END,
    bu.created_at ASC
  LIMIT 1
)
WHERE business_unit_id IS NULL;

-- Step 2: Drop old company-based policies
DROP POLICY IF EXISTS "Allow authenticated users to read stock_transactions" ON stock_transactions;
DROP POLICY IF EXISTS "Allow authenticated users to write stock_transactions" ON stock_transactions;

-- Step 4: Drop existing BU policies
DROP POLICY IF EXISTS bu_select_policy ON stock_transactions;
DROP POLICY IF EXISTS bu_insert_policy ON stock_transactions;
DROP POLICY IF EXISTS bu_update_policy ON stock_transactions;
DROP POLICY IF EXISTS bu_delete_policy ON stock_transactions;

DROP POLICY IF EXISTS bu_select_policy ON stock_transaction_items;
DROP POLICY IF EXISTS bu_insert_policy ON stock_transaction_items;
DROP POLICY IF EXISTS bu_update_policy ON stock_transaction_items;
DROP POLICY IF EXISTS bu_delete_policy ON stock_transaction_items;

-- Step 5: Create strict BU-based policies for stock_transactions (NO NULL loophole)
CREATE POLICY bu_select_policy ON stock_transactions
  FOR SELECT
  USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON stock_transactions
  FOR INSERT
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON stock_transactions
  FOR UPDATE
  USING (business_unit_id = get_current_business_unit_id())
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON stock_transactions
  FOR DELETE
  USING (business_unit_id = get_current_business_unit_id());

-- Step 6: Create BU-based policies for stock_transaction_items
-- Items inherit BU context from parent transaction via transaction_id FK
CREATE POLICY bu_select_policy ON stock_transaction_items
  FOR SELECT
  USING (
    transaction_id IN (
      SELECT id FROM stock_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_insert_policy ON stock_transaction_items
  FOR INSERT
  WITH CHECK (
    transaction_id IN (
      SELECT id FROM stock_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_update_policy ON stock_transaction_items
  FOR UPDATE
  USING (
    transaction_id IN (
      SELECT id FROM stock_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_delete_policy ON stock_transaction_items
  FOR DELETE
  USING (
    transaction_id IN (
      SELECT id FROM stock_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );
