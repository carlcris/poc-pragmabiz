# Testing POS-Accounting Integration via Mobile UI

Since API authentication requires proper cookie handling, the easiest way to test is through the actual mobile UI.

## Test Steps:

### 1. Login to Mobile POS
- Navigate to: http://localhost:3000/mobile/login
- Email: demo@pragmatica.com
- Password: demo1234

### 2. Create a Test POS Sale
- Add items to cart (e.g., Chicken Backs: 2.5 kg @ ₱75/kg)
- Apply discount: ₱5
- Tax rate should be 12%
- Complete payment with cash: ₱200

### 3. Verify Results in Database

#### Check POS Transaction Created:
```sql
SELECT id, transaction_code, total_amount, status
FROM pos_transactions
ORDER BY created_at DESC
LIMIT 1;
```

#### Check Stock Transaction Created:
```sql
SELECT st.transaction_code, st.transaction_type, st.status,
       sti.item_id, sti.quantity
FROM stock_transactions st
LEFT JOIN stock_transaction_items sti ON st.id = sti.transaction_id
WHERE st.reference_type = 'pos_transaction'
ORDER BY st.created_at DESC
LIMIT 5;
```

#### Check Stock Ledger Entries:
```sql
SELECT transaction_type, item_id, actual_qty, qty_after_trans,
       valuation_rate, stock_value
FROM stock_ledger
WHERE transaction_type = 'pos_sale'
ORDER BY posting_date DESC, posting_time DESC
LIMIT 5;
```

#### Check Journal Entries Created:
```sql
SELECT je.entry_number, je.source_module, je.total_debit, je.total_credit, je.status,
       jl.account_id, a.account_number, a.account_name, jl.debit_amount, jl.credit_amount
FROM journal_entries je
LEFT JOIN journal_lines jl ON je.id = jl.entry_id
LEFT JOIN accounts a ON jl.account_id = a.id
WHERE je.source_module IN ('POS', 'COGS')
ORDER BY je.entry_date DESC, je.created_at DESC
LIMIT 20;
```

Expected results:
- **Sale Journal (POS module)**:
  - DR A-1000 (Cash) = Total paid
  - CR R-4000 (Sales Revenue) = Subtotal - Discount
  - CR R-4010 (Sales Discounts) = Discount amount (if any)
  - CR L-2100 (Sales Tax Payable) = Tax amount

- **COGS Journal (COGS module)**:
  - DR C-5000 (Cost of Goods Sold) = Calculated COGS
  - CR A-1200 (Inventory) = Calculated COGS

### 4. Verify Stock Reduced
```sql
SELECT iw.current_stock, i.item_name
FROM item_warehouse iw
JOIN items i ON iw.item_id = i.id
WHERE iw.warehouse_id = '00000000-0000-0000-0000-000000000021' -- Van warehouse
  AND i.item_code = 'CHK-BACK';
```

Stock should be reduced by the quantity sold.

### 5. Test Void/Reversal
- From the POS transactions list, void the transaction
- Verify:
  - Reversal stock transaction created (type = 'in')
  - Reversal journal entries created (opposite signs)
  - Stock restored to original level

