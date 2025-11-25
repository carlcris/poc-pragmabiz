# Test Plan: Debug POS Sale GL Posting Failure

## Issue Summary
The `postPOSSale()` function is failing silently when called from the POS API, while `postPOSCOGS()` works correctly using the same patterns.

## Evidence
- POS Transaction: `POS-1764075528967` (ID: `87267d67-0905-45e2-8f7a-3b0a9ac4d1bb`)
- Stock Transaction: ✅ Created successfully
- COGS Journal: ✅ Created successfully (`JE-00004`)
- **POS Sale Journal: ❌ NOT created**

## Next Steps to Debug

### Option 1: Create New POS Transaction with Enhanced Logging
1. Add temporary console.log statements in `postPOSSale()` to track:
   - Account resolution results
   - Journal code generation result
   - Journal entry creation result
   - Journal lines creation result

2. Create a new POS transaction through the mobile UI
3. Check server logs for the detailed error

### Option 2: Direct Database Test
Execute the posting logic manually via SQL to isolate the issue:

```sql
-- Test if we can create a POS sale journal entry manually
BEGIN;

-- Get account IDs
SELECT id as cash_id FROM accounts WHERE account_number = 'A-1000' AND company_id = '00000000-0000-0000-0000-000000000001' AND deleted_at IS NULL;
SELECT id as revenue_id FROM accounts WHERE account_number = 'R-4000' AND company_id = '00000000-0000-0000-0000-000000000001' AND deleted_at IS NULL;

-- Get next journal code
SELECT get_next_journal_code('00000000-0000-0000-0000-000000000001');

-- Try to insert journal entry
INSERT INTO journal_entries (
  company_id, journal_code, posting_date,
  reference_type, reference_id, reference_code,
  description, status, source_module,
  total_debit, total_credit,
  posted_at, posted_by, created_by, updated_by
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'JE-TEST-001',
  '2025-11-25',
  'pos_transaction',
  '87267d67-0905-45e2-8f7a-3b0a9ac4d1bb',
  'POS-TEST',
  'Test POS Sale',
  'posted',
  'POS',
  1530.00,
  1530.00,
  NOW(),
  '5745e13c-ab07-48b7-9db7-24372b16f5a9',
  '5745e13c-ab07-48b7-9db7-24372b16f5a9',
  '5745e13c-ab07-48b7-9db7-24372b16f5a9'
) RETURNING id;

-- If that works, try journal lines
-- INSERT INTO journal_lines ...

ROLLBACK;  -- Don't commit test data
```

### Option 3: Compare with Working AR Posting
Look at the `arPosting.ts` service to see if there are any differences in how it handles journal creation compared to `posPosting.ts`.

## Hypothesis
The most likely causes:
1. **Race condition**: Maybe both `postPOSSale()` and `postPOSCOGS()` tried to call `get_next_journal_code()` simultaneously, and one failed
2. **Missing RLS policy**: Maybe the POS source_module has different RLS rules than COGS
3. **Data type mismatch**: Some field is being passed with wrong type (though this seems unlikely since COGS works)
4. **Transaction isolation**: The POS sale posting happens first, and if it's in a transaction that fails partway through, it might roll back

## Recommended Action
Add comprehensive error logging to `postPOSSale()` and create a new test transaction to capture the actual error message.

