-- Fix POS Transactions Business Unit RLS Policies
-- This migration:
-- 1. Backfills NULL business_unit_id with default BU for each company
-- 2. Drops old company-based policies
-- 3. Recreates strict BU-based policies without NULL loophole

-- Step 1: Backfill NULL business_unit_id in pos_transactions
UPDATE pos_transactions
SET business_unit_id = (
  SELECT bu.id
  FROM business_units bu
  WHERE bu.company_id = pos_transactions.company_id
    AND bu.is_active = true
  ORDER BY
    CASE WHEN EXISTS (
      SELECT 1 FROM user_business_unit_access ubua
      WHERE ubua.business_unit_id = bu.id
        AND ubua.is_default = true
        AND ubua.user_id = pos_transactions.created_by
    ) THEN 0 ELSE 1 END,
    bu.created_at ASC
  LIMIT 1
)
WHERE business_unit_id IS NULL;

-- Step 2: Drop old company-based policies
DROP POLICY IF EXISTS pos_transactions_select ON pos_transactions;
DROP POLICY IF EXISTS pos_transactions_insert ON pos_transactions;
DROP POLICY IF EXISTS pos_transactions_update ON pos_transactions;
DROP POLICY IF EXISTS pos_transactions_delete ON pos_transactions;

DROP POLICY IF EXISTS pos_transaction_items_select ON pos_transaction_items;
DROP POLICY IF EXISTS pos_transaction_items_insert ON pos_transaction_items;
DROP POLICY IF EXISTS pos_transaction_items_update ON pos_transaction_items;
DROP POLICY IF EXISTS pos_transaction_items_delete ON pos_transaction_items;

-- Step 3: Drop existing BU policies
DROP POLICY IF EXISTS bu_select_policy ON pos_transactions;
DROP POLICY IF EXISTS bu_insert_policy ON pos_transactions;
DROP POLICY IF EXISTS bu_update_policy ON pos_transactions;
DROP POLICY IF EXISTS bu_delete_policy ON pos_transactions;

-- Step 4: Create strict BU-based policies for pos_transactions (NO NULL loophole)
CREATE POLICY bu_select_policy ON pos_transactions
  FOR SELECT
  USING (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_insert_policy ON pos_transactions
  FOR INSERT
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_update_policy ON pos_transactions
  FOR UPDATE
  USING (business_unit_id = get_current_business_unit_id())
  WITH CHECK (business_unit_id = get_current_business_unit_id());

CREATE POLICY bu_delete_policy ON pos_transactions
  FOR DELETE
  USING (business_unit_id = get_current_business_unit_id());

-- Step 5: Create BU-based policies for pos_transaction_items
-- Items inherit BU context from parent transaction
CREATE POLICY bu_select_policy ON pos_transaction_items
  FOR SELECT
  USING (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_insert_policy ON pos_transaction_items
  FOR INSERT
  WITH CHECK (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_update_policy ON pos_transaction_items
  FOR UPDATE
  USING (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_delete_policy ON pos_transaction_items
  FOR DELETE
  USING (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

-- Step 6: Create BU-based policies for pos_transaction_payments
-- Payments also inherit BU context from parent transaction
DROP POLICY IF EXISTS pos_transaction_payments_select ON pos_transaction_payments;
DROP POLICY IF EXISTS pos_transaction_payments_insert ON pos_transaction_payments;
DROP POLICY IF EXISTS pos_transaction_payments_update ON pos_transaction_payments;
DROP POLICY IF EXISTS pos_transaction_payments_delete ON pos_transaction_payments;

CREATE POLICY bu_select_policy ON pos_transaction_payments
  FOR SELECT
  USING (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_insert_policy ON pos_transaction_payments
  FOR INSERT
  WITH CHECK (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_update_policy ON pos_transaction_payments
  FOR UPDATE
  USING (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );

CREATE POLICY bu_delete_policy ON pos_transaction_payments
  FOR DELETE
  USING (
    pos_transaction_id IN (
      SELECT id FROM pos_transactions
      WHERE business_unit_id = get_current_business_unit_id()
    )
  );
