# POS-Accounting Integration - Task List

**Feature:** Integrate POS transactions with General Ledger
**Started:** 2025-11-25
**Status:** In Progress - Phase 4 Complete (Testing Phase)
**Plan Document:** `/docs/plans/pos-accounting-integration.md`

---

## Phase 1: Database Setup ✅ COMPLETED

### Chart of Accounts
- [x] 1.1 Create migration file for new GL accounts
- [x] 1.2 Add R-4010 (Sales Discounts) account
- [x] 1.3 Add L-2100 (Sales Tax Payable) account
- [x] 1.4 Update seed.sql with new accounts
- [x] 1.5 Run migration on database
- [x] 1.6 Verify accounts created successfully

---

## Phase 2: POS Posting Service ✅ COMPLETED

### Service Creation
- [x] 2.1 Create `/src/services/accounting/posPosting.ts` file
- [x] 2.2 Implement `postPOSSale()` function
  - [x] 2.2.1 Fetch POS transaction with items and payments
  - [x] 2.2.2 Resolve account IDs (A-1000, R-4000, R-4010, L-2100)
  - [x] 2.2.3 Build journal lines (DR Cash, CR Revenue/Discount/Tax)
  - [x] 2.2.4 Validate journal entry (balanced)
  - [x] 2.2.5 Create journal entry with status 'posted'
  - [x] 2.2.6 Handle errors gracefully (return null on failure)
- [x] 2.3 Implement `calculatePOSCOGS()` function
  - [x] 2.3.1 Query stock_ledger for each item
  - [x] 2.3.2 Calculate valuation rate (weighted average)
  - [x] 2.3.3 Fallback to item purchase_price if no ledger
  - [x] 2.3.4 Sum total COGS
- [x] 2.4 Implement `postPOSCOGS()` function
  - [x] 2.4.1 Call calculatePOSCOGS()
  - [x] 2.4.2 Resolve account IDs (C-5000, A-1200)
  - [x] 2.4.3 Build journal lines (DR COGS, CR Inventory)
  - [x] 2.4.4 Create journal entry with status 'posted'
  - [x] 2.4.5 Handle errors gracefully
- [x] 2.5 Implement `reversePOSTransaction()` function
  - [x] 2.5.1 Fetch original POS transaction
  - [x] 2.5.2 Create reversal sale journal (opposite signs)
  - [x] 2.5.3 Create reversal COGS journal (opposite signs)
  - [x] 2.5.4 Post both reversal journals

---

## Phase 3: Stock Transaction Service ✅ COMPLETED

### Service Creation
- [x] 3.1 Create `/src/services/inventory/posStockService.ts` file
- [x] 3.2 Implement `createPOSStockTransaction()` function
  - [x] 3.2.1 Generate stock transaction code (ST-POS-{code})
  - [x] 3.2.2 Create stock_transactions record (type: 'out')
  - [x] 3.2.3 Create stock_ledger entries for each item
  - [x] 3.2.4 Calculate valuation rate per item
  - [x] 3.2.5 Update item_warehouse quantities (reduce stock)
  - [x] 3.2.6 Handle errors gracefully
- [x] 3.3 Implement `reversePOSStockTransaction()` function
  - [x] 3.3.1 Create reversing stock_transactions record (type: 'in')
  - [x] 3.3.2 Create reversing stock_ledger entries (add back stock)
  - [x] 3.3.3 Update item_warehouse quantities (restore stock)

---

## Phase 4: API Integration ✅ COMPLETED

### POS Transaction Creation
- [x] 4.1 Update POST `/api/pos/transactions/route.ts`
  - [x] 4.1.1 Import posPosting and posStockService
  - [x] 4.1.2 After transaction created, call createPOSStockTransaction()
  - [x] 4.1.3 After stock transaction, call postPOSSale()
  - [x] 4.1.4 After sale posted, call postPOSCOGS()
  - [x] 4.1.5 Collect warnings from failures
  - [x] 4.1.6 Return success with warnings array
  - [x] 4.1.7 Log errors to console

### POS Transaction Void
- [x] 4.2 Update POST `/api/pos/transactions/[id]/void/route.ts`
  - [x] 4.2.1 Import posPosting and posStockService
  - [x] 4.2.2 After status updated to 'voided', call reversePOSStockTransaction()
  - [x] 4.2.3 After stock reversed, call reversePOSTransaction()
  - [x] 4.2.4 Collect warnings from failures
  - [x] 4.2.5 Return success with warnings array
  - [x] 4.2.6 Log errors to console

---

## Phase 5: Testing - Functional

### POS Sale Tests
- [~] 5.1 Create POS transaction with single item (**IN PROGRESS - Issue Found**)
  - [ ] 5.1.1 Verify sale journal created (**FAILED - See Blocker**)
  - [x] 5.1.2 Verify COGS journal created
  - [x] 5.1.3 Verify stock transaction created
  - [x] 5.1.4 Verify inventory reduced
- [ ] 5.2 Create POS transaction with multiple items
  - [ ] 5.2.1 Verify COGS calculated for all items
  - [ ] 5.2.2 Verify stock ledger entries for all items
- [ ] 5.3 Create POS transaction with discount
  - [ ] 5.3.1 Verify Sales Discounts account credited
  - [ ] 5.3.2 Verify net revenue amount correct
- [ ] 5.4 Create POS transaction with tax
  - [ ] 5.4.1 Verify Sales Tax Payable account credited
  - [ ] 5.4.2 Verify tax amount correct
- [ ] 5.5 Create POS transaction with discount + tax
  - [ ] 5.5.1 Verify all accounts posted correctly
  - [ ] 5.5.2 Verify journal balanced

### POS Void Tests
- [ ] 5.6 Void a POS transaction
  - [ ] 5.6.1 Verify reversal sale journal created
  - [ ] 5.6.2 Verify reversal COGS journal created
  - [ ] 5.6.3 Verify stock restored
  - [ ] 5.6.4 Verify inventory added back

### COGS Calculation Tests
- [ ] 5.7 Item with stock ledger entries
  - [ ] 5.7.1 Verify weighted average rate used
  - [ ] 5.7.2 Verify COGS amount correct
- [ ] 5.8 Item without stock ledger entries
  - [ ] 5.8.1 Verify purchase_price used as fallback
  - [ ] 5.8.2 Verify COGS amount correct

---

## Phase 6: Testing - Error Handling

### Graceful Degradation
- [ ] 6.1 Simulate stock transaction failure
  - [ ] 6.1.1 Verify POS transaction still succeeds
  - [ ] 6.1.2 Verify warning logged
  - [ ] 6.1.3 Verify GL posting continues
- [ ] 6.2 Simulate GL sale posting failure
  - [ ] 6.2.1 Verify POS transaction still succeeds
  - [ ] 6.2.2 Verify warning logged
  - [ ] 6.2.3 Verify COGS posting continues
- [ ] 6.3 Simulate GL COGS posting failure
  - [ ] 6.3.1 Verify POS transaction still succeeds
  - [ ] 6.3.2 Verify warning logged

---

## Phase 7: Testing - Integration

### GL Verification
- [ ] 7.1 Check journal entries list
  - [ ] 7.1.1 Verify POS journals appear
  - [ ] 7.1.2 Verify source_module = 'POS' for sale
  - [ ] 7.1.3 Verify source_module = 'COGS' for COGS
  - [ ] 7.1.4 Verify reference links to POS transaction
- [ ] 7.2 Check general ledger
  - [ ] 7.2.1 Query A-1000 (Cash) - verify debits
  - [ ] 7.2.2 Query R-4000 (Revenue) - verify credits
  - [ ] 7.2.3 Query R-4010 (Discounts) - verify credits
  - [ ] 7.2.4 Query L-2100 (Tax) - verify credits
  - [ ] 7.2.5 Query C-5000 (COGS) - verify debits
  - [ ] 7.2.6 Query A-1200 (Inventory) - verify credits
- [ ] 7.3 Check trial balance
  - [ ] 7.3.1 Verify POS sales included
  - [ ] 7.3.2 Verify trial balance still balances
- [ ] 7.4 Check stock reports
  - [ ] 7.4.1 Verify stock levels updated
  - [ ] 7.4.2 Verify stock ledger shows POS movements
  - [ ] 7.4.3 Verify stock transaction history

---

## Phase 8: Edge Cases & Cleanup

### Edge Cases
- [ ] 8.1 Zero tax transaction
  - [ ] 8.1.1 Verify no tax line created
- [ ] 8.2 Zero discount transaction
  - [ ] 8.2.1 Verify no discount line created
- [ ] 8.3 Void already voided transaction
  - [ ] 8.3.1 Verify no duplicate reversal
  - [ ] 8.3.2 Verify appropriate error message

### Code Quality
- [ ] 8.4 Add TypeScript types for all functions
- [ ] 8.5 Add JSDoc comments
- [ ] 8.6 Handle all error cases
- [ ] 8.7 Remove console.logs (keep error logs)
- [ ] 8.8 Remove any unused imports

### Documentation
- [ ] 8.9 Update plan document with any changes
- [ ] 8.10 Add inline code comments for complex logic
- [ ] 8.11 Document any assumptions made

---

## Progress Tracker

**Total Tasks**: 108
**Completed**: 42 (Phases 1-4)
**In Progress**: 0
**Remaining**: 66 (Testing Phases 5-8)
**Completion**: 39% (Implementation Complete, Testing Pending)

### Phase Status:
- ✅ **Phase 1**: Database Setup - 6/6 tasks (100%)
- ✅ **Phase 2**: POS Posting Service - 18/18 tasks (100%)
- ✅ **Phase 3**: Stock Transaction Service - 10/10 tasks (100%)
- ✅ **Phase 4**: API Integration - 14/14 tasks (100%)
- ⏳ **Phase 5**: Testing - Functional - 0/27 tasks (0%)
- ⏳ **Phase 6**: Testing - Error Handling - 0/6 tasks (0%)
- ⏳ **Phase 7**: Testing - Integration - 0/15 tasks (0%)
- ⏳ **Phase 8**: Edge Cases & Cleanup - 0/11 tasks (0%)

---

## Blockers & Issues

### 🔴 CRITICAL: POS Sale GL Posting Failure (Phase 5.1.1)
**Status**: Under Investigation
**Severity**: HIGH
**Date Found**: 2025-11-25

**Problem**:
The `postPOSSale()` function is failing to create sale journal entries, although `postPOSCOGS()` works correctly using identical implementation patterns.

**Evidence**:
- Test Transaction: `POS-1764075528967` (ID: `87267d67-0905-45e2-8f7a-3b0a9ac4d1bb`)
- ✅ Stock transaction created: `ST-POS-POS-1764075528967`
- ✅ COGS journal created: `JE-00004` with correct DR/CR
- ❌ **POS Sale journal NOT created** - No entry with `source_module = 'POS'`

**Impact**:
- POS transactions complete successfully
- Stock and COGS are recorded correctly
- BUT: Cash and Revenue journal entries are missing
- Result: Incomplete accounting records

**Investigation**:
- All required GL accounts exist (A-1000, R-4000, R-4010, L-2100)
- The `get_next_journal_code()` RPC works
- The COGS posting (identical pattern) works perfectly
- Error is caught by graceful degradation and logged as warning only

**Next Steps**:
1. Add enhanced error logging to `postPOSSale()` function
2. Create new test POS transaction to capture real-time error logs
3. Fix identified issue
4. Verify with end-to-end testing

**Detailed Report**: See `/docs/pos-accounting-integration-status.md`

---

## Implementation Summary

### ✅ Completed Work:

**Phase 1: Database Setup**
- Created migration file: `20251125000000_add_pos_accounting_accounts.sql`
- Added R-4010 (Sales Discounts) and L-2100 (Sales Tax Payable) accounts
- Updated seed.sql with new accounts
- Migration run successfully, accounts verified in database

**Phase 2: POS Posting Service**
- Created `/src/services/accounting/posPosting.ts`
- Implemented all 4 functions: `postPOSSale()`, `calculatePOSCOGS()`, `postPOSCOGS()`, `reversePOSTransaction()`
- Follows exact patterns from existing AR and COGS posting services
- Graceful error handling with warnings (never blocks POS transactions)

**Phase 3: Stock Transaction Service**
- Created `/src/services/inventory/posStockService.ts`
- Implemented `createPOSStockTransaction()` and `reversePOSStockTransaction()`
- Creates stock_transactions, stock_ledger entries, and updates item_warehouse quantities
- Handles both outbound (sales) and inbound (voids) transactions

**Phase 4: API Integration**
- Updated `POST /api/pos/transactions` to integrate all services
- Updated `POST /api/pos/transactions/[id]/void` for reversal logic
- Added warehouse-aware logic using user's `van_warehouse_id`
- Returns warnings array if any integration fails (graceful degradation)
- Complete audit trail via `reference_type` and `reference_id` linking

### 🔍 Ready for Testing:
All implementation complete. Testing phases (5-8) can now begin to verify:
- Functional correctness (sale posting, COGS calculation, stock updates)
- Error handling (graceful failures, warnings logged)
- Integration verification (GL journals, trial balance, stock ledger)
- Edge cases (zero tax, zero discount, voids, etc.)

---

## Notes

- ✅ Followed existing patterns from `arPosting.ts` and `cogsPosting.ts`
- ✅ Used same error handling strategy (log warnings, don't block)
- ⏳ Test with real POS transactions from frontend
- ⏳ Verify with accounting team that GL entries are correct

---

**Last Updated:** 2025-11-25 (Phase 4 Complete)
