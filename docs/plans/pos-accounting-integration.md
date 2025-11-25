# POS Transaction → Accounting Integration Plan

**Date Created:** 2025-11-25
**Status:** Planned
**Priority:** High

---

## Overview

Integrate POS transactions with the General Ledger to automatically create accounting entries when sales are completed or voided.

### Current State
- ✅ Sales Invoices → AR & COGS posting
- ✅ Invoice Payments → Cash/AR posting
- ✅ Purchase Receipts → AP posting
- ❌ **POS Transactions → Not posting to GL** (THIS INTEGRATION)

---

## Business Requirements

### Answers to Key Questions:

1. **Payment Method Mapping:** Consolidate all payment methods to Cash/Bank (A-1000)
2. **Tax Handling:** Yes, POS transactions are subject to sales tax. Create Sales Tax Payable account
3. **Change Amount:** Do NOT track change as liability (it's just returned cash)
4. **Discounts:** Yes, track discounts in separate GL account (Sales Discounts)
5. **Stock Impact:** Yes, POS transactions MUST create stock transactions and update inventory quantities

---

## GL Entry Design

### A. POS Sale Entry (Revenue Recognition)

**When:** POS transaction completed (status = 'completed')

**Journal Entry:**
```
DR  Cash/Bank (A-1000)              | Amount Paid
CR  Sales Revenue (R-4000)          | Subtotal - Total Discount
CR  Sales Discounts (R-4010)        | Total Discount (contra-revenue)
CR  Sales Tax Payable (L-2100)      | Total Tax
```

**Note:**
- All payment methods (cash, card, e-wallet) consolidated to A-1000
- Discounts recorded as contra-revenue (reduces sales)
- Change is not tracked (customer takes it)

### B. COGS Entry

**When:** Same time as revenue recognition

**Journal Entry:**
```
DR  Cost of Goods Sold (C-5000)     | COGS Amount
CR  Inventory (A-1200)              | COGS Amount
```

**COGS Calculation:**
- Query `stock_ledger` for item valuation rates (weighted average)
- Per item: `quantity × valuation_rate`
- Fallback to `purchase_price` if no ledger entry
- Sum total COGS for all items in transaction

### C. Transaction Void Entry

**When:** POS transaction voided (status = 'voided')

**Journal Entry:**
```
DR  Sales Revenue (R-4000)          | Subtotal - Total Discount
DR  Sales Discounts (R-4010)        | Total Discount
DR  Sales Tax Payable (L-2100)      | Total Tax
CR  Cash/Bank (A-1000)              | Amount Paid

DR  Inventory (A-1200)              | COGS Amount
CR  Cost of Goods Sold (C-5000)     | COGS Amount
```

**Note:** Reverses both the sale and COGS entries

---

## Data Flow

```
POS Transaction Created
    ↓
Transaction Saved (status = 'completed')
    ↓
├─→ createStockTransaction() [NEW]
│   ├─→ Create stock_transactions record (type: 'out')
│   ├─→ Create stock_ledger entries for each item
│   └─→ Reduce inventory quantities
│
├─→ postPOSSale()
│   ├─→ Calculate: subtotal, discount, tax
│   ├─→ Create journal entry:
│   │   - DR Cash/Bank
│   │   - CR Sales Revenue (net of discount)
│   │   - CR Sales Discounts (if any)
│   │   - CR Sales Tax Payable (if tax > 0)
│   └─→ Auto-post journal
│
└─→ postPOSCOGS()
    ├─→ Calculate COGS from stock_ledger
    ├─→ Create journal entry:
    │   - DR COGS
    │   - CR Inventory
    └─→ Auto-post journal

---

Transaction Voided
    ↓
├─→ reverseStockTransaction() [NEW]
│   └─→ Create reversing stock entries (add back inventory)
│
└─→ reversePOSTransaction()
    └─→ Create reversal journal entries (opposite of original)
```

---

## Technical Implementation

### New Chart of Accounts

Add to seed.sql and migration:

| Account Number | Account Name | Type | Parent | Notes |
|----------------|--------------|------|--------|-------|
| R-4010 | Sales Discounts | revenue | R-4000 | Contra-revenue account |
| L-2100 | Sales Tax Payable | liability | - | For output VAT/sales tax |

**Note:**
- A-1000 (Cash/Bank) already exists
- R-4000 (Sales Revenue) already exists
- C-5000 (Cost of Goods Sold) already exists
- A-1200 (Inventory) already exists

### File Structure

**New Files:**
```
/src/services/accounting/posPosting.ts
  - postPOSSale(transactionId, supabase)
  - postPOSCOGS(transactionId, supabase)
  - reversePOSTransaction(transactionId, supabase)
  - calculatePOSCOGS(transactionId, supabase)

/src/services/inventory/posStockService.ts
  - createPOSStockTransaction(transactionId, supabase)
  - reversePOSStockTransaction(transactionId, supabase)

/supabase/migrations/XXXXX_add_pos_accounting_accounts.sql
  - Add Sales Discounts account
  - Add Sales Tax Payable account
```

**Modified Files:**
```
/src/app/api/pos/transactions/route.ts (POST)
  - Add stock transaction creation
  - Add POS GL posting after transaction creation
  - Handle errors gracefully (log warnings)

/src/app/api/pos/transactions/[id]/void/route.ts (POST)
  - Add stock reversal
  - Add GL reversal posting when voiding

/supabase/seed.sql
  - Add new GL accounts to seed data
```

### Journal Entry Format

**POS Sale Journal:**
```typescript
{
  journal_code: "JE-00XXX", // auto-generated
  posting_date: transaction_date,
  source_module: "POS",
  reference_type: "pos_transaction",
  reference_id: transaction.id,
  reference_number: transaction.transaction_code,
  description: "POS Sale - {transaction_code}",
  status: "posted",
  total_debit: amount_paid,
  total_credit: amount_paid
}
```

**Journal Lines:**
```typescript
[
  {
    line_number: 1,
    account_number: "A-1000",
    debit: amount_paid,
    credit: 0,
    description: "Cash received"
  },
  {
    line_number: 2,
    account_number: "R-4000",
    debit: 0,
    credit: subtotal - total_discount,
    description: "Sales revenue"
  },
  {
    line_number: 3, // only if discount > 0
    account_number: "R-4010",
    debit: 0,
    credit: total_discount,
    description: "Sales discount"
  },
  {
    line_number: 4, // only if tax > 0
    account_number: "L-2100",
    debit: 0,
    credit: total_tax,
    description: "Sales tax collected"
  }
]
```

**POS COGS Journal:**
```typescript
{
  journal_code: "JE-00XXX", // auto-generated
  posting_date: transaction_date,
  source_module: "COGS",
  reference_type: "pos_transaction",
  reference_id: transaction.id,
  reference_number: transaction.transaction_code,
  description: "COGS - POS Sale {transaction_code}",
  status: "posted",
  total_debit: cogs_amount,
  total_credit: cogs_amount
}
```

### Stock Transaction Format

**Stock Transaction:**
```typescript
{
  transaction_code: "ST-POS-{transaction_code}",
  transaction_type: "out", // or "in" for void reversal
  transaction_date: transaction_date,
  reference_type: "pos_transaction",
  reference_id: transaction.id,
  reference_number: transaction.transaction_code,
  notes: "POS Sale - {transaction_code}"
}
```

**Stock Ledger Entries (per item):**
```typescript
{
  item_id: item.itemId,
  warehouse_id: null, // POS doesn't specify warehouse
  transaction_type: "out",
  quantity: -item.quantity, // negative for outbound
  valuation_rate: calculated_rate,
  amount: -(item.quantity * calculated_rate),
  reference_type: "pos_transaction",
  reference_id: transaction.id
}
```

---

## Error Handling Strategy

Following the same pattern as invoice posting:

1. **Stock Transaction Failure:**
   - Log error as warning
   - Continue with GL posting
   - POS transaction still succeeds

2. **GL Posting Failure:**
   - Log error as warning
   - Don't block POS transaction
   - Can be manually posted later

3. **Partial Failure:**
   - If sale journal posts but COGS fails, that's OK
   - Operator can manually post missing COGS entry

4. **Error Response:**
   ```typescript
   // Success even if GL fails
   return NextResponse.json({
     data: transaction,
     warnings: [
       "Stock transaction creation failed",
       "GL posting failed"
     ]
   }, { status: 201 })
   ```

---

## Testing Checklist

### Functional Tests
- [ ] POS transaction creates sale journal
- [ ] POS transaction creates COGS journal
- [ ] POS transaction creates stock transaction
- [ ] POS transaction reduces inventory quantities
- [ ] Discounts recorded correctly in GL
- [ ] Tax amounts posted to correct account
- [ ] Voiding creates reversal entries
- [ ] Voiding reverses stock transaction
- [ ] COGS calculated from stock ledger
- [ ] Fallback to purchase_price if no ledger entry

### Error Handling Tests
- [ ] GL failure doesn't block POS transaction
- [ ] Stock failure doesn't block POS transaction
- [ ] Partial failures logged as warnings
- [ ] Transaction still succeeds with warnings

### Integration Tests
- [ ] Journal entries visible in GL
- [ ] Trial balance includes POS sales
- [ ] Ledger query shows POS transactions
- [ ] Stock levels updated correctly
- [ ] Stock ledger shows POS movements

### Edge Cases
- [ ] Zero tax transaction
- [ ] Zero discount transaction
- [ ] Multiple items with different COGS
- [ ] Item with no stock ledger (uses purchase_price)
- [ ] Voiding already voided transaction

---

## Dependencies

### Database Tables Used
- `pos_transactions` (read)
- `pos_transaction_items` (read)
- `accounts` (read - resolve account numbers)
- `journal_entries` (create)
- `journal_lines` (create)
- `stock_transactions` (create)
- `stock_ledger` (create/read)
- `item_warehouse` (update quantities)

### Services Used
- `journalValidation.ts` (validation)
- Existing COGS calculation logic (reference from `cogsPosting.ts`)
- Stock ledger query logic (reference from invoice posting)

### API Endpoints Modified
- POST `/api/pos/transactions` (add posting calls)
- POST `/api/pos/transactions/[id]/void` (add reversal calls)

---

## Future Enhancements

1. **Payment Method Breakdown:**
   - Track cash vs card vs e-wallet separately
   - Would require separate GL accounts (A-1050, A-1060)

2. **Customer Tracking:**
   - Link walk-in customers to a default customer account
   - Enable AR posting for POS transactions

3. **Batch Posting:**
   - Option to batch post POS transactions at end of day
   - Reduces number of journal entries

4. **Void Approval Workflow:**
   - Require manager approval for voids
   - Track who approved the void

5. **Sales by Category:**
   - Post to different revenue accounts based on item category
   - Would require category-to-account mapping

---

## References

- Original exploration report: Agent output from 2025-11-25
- Existing AR posting: `/src/services/accounting/arPosting.ts`
- Existing COGS posting: `/src/services/accounting/cogsPosting.ts`
- Existing AP posting: `/src/services/accounting/apPosting.ts`
- Journal validation: `/src/services/accounting/journalValidation.ts`
- Accounting migration: `/supabase/migrations/20251122000000_add_accounting_tables.sql`

---

## Implementation Timeline

**Estimated Effort:** 2-3 days

- **Day 1:** Chart of accounts setup + POS posting service
- **Day 2:** Stock transaction service + API integration
- **Day 3:** Testing + bug fixes

---

**Last Updated:** 2025-11-25
**Version:** 1.0
