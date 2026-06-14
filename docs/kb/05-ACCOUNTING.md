# Accounting Module

## Overview

The Accounting module provides comprehensive financial management with automatic General Ledger (GL) integration across all business transactions. It includes chart of accounts management, journal entries, automatic posting services for AR/AP/COGS/POS, and financial reporting.

## Key Features

- **Chart of Accounts** with hierarchical structure
- **Journal Entries** with validation and posting
- **General Ledger** transaction tracking
- **Trial Balance** reporting
- **Automatic GL Posting** for:
  - Accounts Receivable (AR) - Invoices and payments
  - Accounts Payable (AP) - Purchase invoices
  - Cost of Goods Sold (COGS) - Inventory consumption
  - Point of Sale (POS) - Cash transactions
- **Multi-level** account hierarchy
- **Debit/Credit** validation
- **Posting period** management
- **Audit trail** for all entries

## Accounting Architecture

```
┌────────────────────────────────────────────────────────┐
│                Transaction Layer                        │
│  Sales Invoice | Purchase | POS | Stock Movement       │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│             Automatic Posting Services                  │
│  AR Posting | AP Posting | COGS Posting | POS Posting  │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│                 Journal Entry Layer                     │
│  Validation → Entry Creation → Posting                 │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│                  General Ledger                         │
│  GL Postings → Account Balances → Reports              │
└────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Chart of Accounts

The **Chart of Accounts** is a hierarchical list of all GL accounts used for financial tracking.

**Account Types**:
- **Asset** - Resources owned (Cash, Inventory, AR)
- **Liability** - Obligations owed (AP, Loans)
- **Equity** - Owner's equity
- **Revenue** - Income from operations
- **Expense** - Costs of operations
- **COGS** - Cost of goods sold

**Account Structure**:
```
1000 - Assets
  1100 - Current Assets
    1110 - Cash
      1111 - Cash - Main Account
      1112 - Cash - Petty Cash
    1120 - Accounts Receivable
    1130 - Inventory
  1200 - Fixed Assets
    1210 - Equipment
    1220 - Vehicles
```

**Key Attributes**:
- **Code**: Unique account number
- **Name**: Account description
- **Type**: Asset, Liability, Equity, Revenue, Expense, COGS
- **Parent Account**: For hierarchical structure
- **Is Active**: Enable/disable account
- **Normal Balance**: Debit or Credit

### 2. Journal Entry

A **Journal Entry** records financial transactions with balanced debits and credits.

**Double-Entry Accounting**:
Every transaction has equal debits and credits:
```
DR  Cash                 1,000
  CR  Sales Revenue            1,000
```

**Key Attributes**:
- **Entry Number**: Unique identifier
- **Entry Date**: Transaction date
- **Description**: Transaction description
- **Total Debit**: Sum of all debit lines
- **Total Credit**: Sum of all credit lines
- **Status**: Draft or Posted
- **Source**: Manual, AR, AP, COGS, POS

**Validation Rules**:
1. Total debits must equal total credits
2. All accounts must be active
3. All accounts must be leaf nodes (no children)
4. Entry date within valid posting period

### 3. General Ledger

The **General Ledger** contains all posted journal entries organized by account.

**GL Posting**:
When a journal entry is posted:
1. Status changes to 'posted'
2. Lines copied to `gl_postings` table
3. Account balances updated
4. Cannot be edited or deleted

**Account Balance Calculation**:
```
Asset/Expense accounts (normal debit):
  Balance = Debits - Credits

Liability/Equity/Revenue accounts (normal credit):
  Balance = Credits - Debits
```

### 4. Automatic Posting Services

The system automatically creates journal entries for business transactions:

#### AR Posting (Accounts Receivable)

**Invoice Posting**:
```
DR  Accounts Receivable (Customer)    1,000
  CR  Sales Revenue                          1,000
```

**Payment Posting**:
```
DR  Cash/Bank                          500
  CR  Accounts Receivable (Customer)        500
```

#### AP Posting (Accounts Payable)

**Purchase Invoice**:
```
DR  Inventory / Expense                800
  CR  Accounts Payable (Supplier)           800
```

**Payment**:
```
DR  Accounts Payable (Supplier)        800
  CR  Cash/Bank                              800
```

#### COGS Posting

**Inventory Consumption** (when goods sold):
```
DR  Cost of Goods Sold                 600
  CR  Inventory                              600
```

#### POS Posting

**POS Transaction**:
```
DR  Cash                               1,000
  CR  Sales Revenue                          1,000

DR  Cost of Goods Sold                 600
  CR  Inventory                              600
```

## Database Schema

### Core Tables

#### accounts
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  code VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  account_type VARCHAR NOT NULL,  -- 'asset', 'liability', 'equity', 'revenue', 'expense', 'cogs'
  parent_id UUID REFERENCES accounts(id),  -- For hierarchical structure
  normal_balance VARCHAR DEFAULT 'debit',  -- 'debit' or 'credit'
  is_active BOOLEAN DEFAULT true,
  is_header BOOLEAN DEFAULT false,  -- Header accounts cannot have transactions
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### journal_entries
```sql
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  entry_number VARCHAR UNIQUE NOT NULL,
  entry_date TIMESTAMPTZ NOT NULL,
  description TEXT,
  total_debit DECIMAL(12,2),
  total_credit DECIMAL(12,2),
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'posted'
  source VARCHAR,  -- 'manual', 'ar_invoice', 'ar_payment', 'ap_invoice', 'cogs', 'pos'
  source_id UUID,  -- Reference to source document
  posted_by UUID REFERENCES users(id),
  posted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### journal_entry_lines
```sql
CREATE TABLE journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  account_id UUID REFERENCES accounts(id),
  description TEXT,
  debit DECIMAL(12,2) DEFAULT 0,
  credit DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_debit_or_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)
  )
);
```

#### gl_postings
```sql
CREATE TABLE gl_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  journal_entry_line_id UUID REFERENCES journal_entry_lines(id),
  account_id UUID REFERENCES accounts(id),
  posting_date TIMESTAMPTZ NOT NULL,
  description TEXT,
  debit DECIMAL(12,2) DEFAULT 0,
  credit DECIMAL(12,2) DEFAULT 0,
  source VARCHAR,
  source_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for performance
CREATE INDEX idx_gl_postings_account_date ON gl_postings(account_id, posting_date);
```

## API Reference

### Chart of Accounts

#### GET /api/accounting/accounts
List all accounts with hierarchy.

**Permissions**: `view` on `chart_of_accounts`

**Response**:
```json
{
  "accounts": [
    {
      "id": "uuid",
      "code": "1000",
      "name": "Assets",
      "account_type": "asset",
      "parent_id": null,
      "is_header": true,
      "children": [
        {
          "id": "uuid",
          "code": "1100",
          "name": "Current Assets",
          "parent_id": "uuid-of-1000",
          "is_header": true,
          "children": [...]
        }
      ]
    }
  ]
}
```

#### POST /api/accounting/accounts
Create new account.

**Permissions**: `create` on `chart_of_accounts`

**Request**:
```json
{
  "code": "1111",
  "name": "Cash - Main Account",
  "account_type": "asset",
  "parent_id": "uuid-of-1110",
  "normal_balance": "debit",
  "is_header": false
}
```

#### GET /api/accounting/accounts/[id]/balance
Get account balance.

**Permissions**: `view` on `chart_of_accounts`

**Response**:
```json
{
  "account": {
    "code": "1111",
    "name": "Cash - Main Account"
  },
  "balance": 15000.00,
  "debit_total": 50000.00,
  "credit_total": 35000.00,
  "as_of_date": "2025-06-14"
}
```

### Journal Entries

#### GET /api/accounting/journal-entries
List journal entries.

**Permissions**: `view` on `journal_entries`

**Query Parameters**:
- `start_date` - Filter by date range
- `end_date` - Filter by date range
- `status` - Filter by status (draft, posted)
- `source` - Filter by source

**Response**:
```json
{
  "entries": [
    {
      "id": "uuid",
      "entry_number": "JE-2025-001",
      "entry_date": "2025-06-14",
      "description": "Sales invoice INV-001",
      "total_debit": 1000.00,
      "total_credit": 1000.00,
      "status": "posted",
      "source": "ar_invoice",
      "lines": [
        {
          "account": { "code": "1120", "name": "Accounts Receivable" },
          "debit": 1000.00,
          "credit": 0
        },
        {
          "account": { "code": "4000", "name": "Sales Revenue" },
          "debit": 0,
          "credit": 1000.00
        }
      ]
    }
  ]
}
```

#### POST /api/accounting/journal-entries
Create manual journal entry.

**Permissions**: `create` on `journal_entries`

**Request**:
```json
{
  "entry_date": "2025-06-14",
  "description": "Adjusting entry",
  "lines": [
    {
      "line_number": 1,
      "account_id": "uuid",
      "description": "Debit account",
      "debit": 500.00,
      "credit": 0
    },
    {
      "line_number": 2,
      "account_id": "uuid",
      "description": "Credit account",
      "debit": 0,
      "credit": 500.00
    }
  ]
}
```

**Validation**:
1. Total debits = total credits
2. All accounts exist and are active
3. Accounts are leaf nodes (not headers)
4. Date within valid period

#### POST /api/accounting/journal-entries/[id]/post
Post journal entry to GL.

**Permissions**: `edit` on `journal_entries`

**Effect**:
1. Validates entry (debits = credits)
2. Status changes to 'posted'
3. Creates GL postings
4. Records posting user and timestamp
5. Entry becomes immutable

### General Ledger

#### GET /api/accounting/general-ledger
Query general ledger.

**Permissions**: `view` on `general_ledger`

**Query Parameters**:
- `account_id` - Filter by account
- `start_date` - Date range start
- `end_date` - Date range end

**Response**:
```json
{
  "account": {
    "code": "1120",
    "name": "Accounts Receivable"
  },
  "opening_balance": 5000.00,
  "postings": [
    {
      "date": "2025-06-01",
      "description": "Invoice INV-001",
      "debit": 1000.00,
      "credit": 0,
      "balance": 6000.00
    },
    {
      "date": "2025-06-10",
      "description": "Payment received",
      "debit": 0,
      "credit": 500.00,
      "balance": 5500.00
    }
  ],
  "closing_balance": 5500.00
}
```

### Trial Balance

#### GET /api/accounting/trial-balance
Get trial balance report.

**Permissions**: `view` on `trial_balance`

**Query Parameters**:
- `as_of_date` - Balance as of date

**Response**:
```json
{
  "as_of_date": "2025-06-14",
  "accounts": [
    {
      "code": "1111",
      "name": "Cash - Main Account",
      "debit": 15000.00,
      "credit": 0
    },
    {
      "code": "1120",
      "name": "Accounts Receivable",
      "debit": 5500.00,
      "credit": 0
    },
    {
      "code": "4000",
      "name": "Sales Revenue",
      "debit": 0,
      "credit": 20000.00
    }
  ],
  "total_debit": 50000.00,
  "total_credit": 50000.00,
  "in_balance": true
}
```

## Services

### AR Posting Service

```typescript
// Location: src/services/accounting/arPosting.ts

class ARPostingService {
  /**
   * Post sales invoice to GL
   * DR  Accounts Receivable
   * CR  Sales Revenue
   */
  async postInvoice(invoiceId: string): Promise<void> {
    const invoice = await getInvoice(invoiceId)

    const journalEntry = {
      entry_date: invoice.invoice_date,
      description: `Sales invoice ${invoice.invoice_number}`,
      source: 'ar_invoice',
      source_id: invoiceId,
      lines: [
        {
          account_id: AR_ACCOUNT_ID,
          description: `Invoice to ${invoice.customer.name}`,
          debit: invoice.total_amount,
          credit: 0
        },
        {
          account_id: SALES_REVENUE_ACCOUNT_ID,
          description: 'Sales revenue',
          debit: 0,
          credit: invoice.total_amount
        }
      ]
    }

    await createAndPostJournalEntry(journalEntry)
  }

  /**
   * Post payment to GL
   * DR  Cash/Bank
   * CR  Accounts Receivable
   */
  async postPayment(paymentId: string): Promise<void> {
    const payment = await getPayment(paymentId)

    const journalEntry = {
      entry_date: payment.payment_date,
      description: `Payment for invoice ${payment.invoice.invoice_number}`,
      source: 'ar_payment',
      source_id: paymentId,
      lines: [
        {
          account_id: CASH_ACCOUNT_ID,
          description: `Payment from ${payment.customer.name}`,
          debit: payment.amount,
          credit: 0
        },
        {
          account_id: AR_ACCOUNT_ID,
          description: 'Reduce AR',
          debit: 0,
          credit: payment.amount
        }
      ]
    }

    await createAndPostJournalEntry(journalEntry)
  }
}
```

### AP Posting Service

```typescript
// Location: src/services/accounting/apPosting.ts

class APPostingService {
  /**
   * Post purchase invoice to GL
   * DR  Inventory / Expense
   * CR  Accounts Payable
   */
  async postPurchaseInvoice(receiptId: string): Promise<void> {
    const receipt = await getPurchaseReceipt(receiptId)

    const journalEntry = {
      entry_date: receipt.receipt_date,
      description: `Purchase from ${receipt.supplier.name}`,
      source: 'ap_invoice',
      source_id: receiptId,
      lines: [
        {
          account_id: INVENTORY_ACCOUNT_ID,
          description: 'Inventory purchase',
          debit: receipt.total_cost,
          credit: 0
        },
        {
          account_id: AP_ACCOUNT_ID,
          description: `Payable to ${receipt.supplier.name}`,
          debit: 0,
          credit: receipt.total_cost
        }
      ]
    }

    await createAndPostJournalEntry(journalEntry)
  }
}
```

### COGS Posting Service

```typescript
// Location: src/services/accounting/cogsPosting.ts

class COGSPostingService {
  /**
   * Post cost of goods sold when inventory consumed
   * DR  Cost of Goods Sold
   * CR  Inventory
   */
  async postCOGS(deliveryNoteId: string): Promise<void> {
    const deliveryNote = await getDeliveryNote(deliveryNoteId)

    // Calculate total cost of items delivered
    const totalCost = deliveryNote.items.reduce((sum, item) => {
      return sum + (item.quantity * item.average_cost)
    }, 0)

    const journalEntry = {
      entry_date: deliveryNote.delivery_date,
      description: `COGS for delivery note ${deliveryNote.delivery_number}`,
      source: 'cogs',
      source_id: deliveryNoteId,
      lines: [
        {
          account_id: COGS_ACCOUNT_ID,
          description: 'Cost of goods sold',
          debit: totalCost,
          credit: 0
        },
        {
          account_id: INVENTORY_ACCOUNT_ID,
          description: 'Reduce inventory',
          debit: 0,
          credit: totalCost
        }
      ]
    }

    await createAndPostJournalEntry(journalEntry)
  }
}
```

### POS Posting Service

```typescript
// Location: src/services/accounting/posPosting.ts

class POSPostingService {
  /**
   * Post POS transaction
   * DR  Cash
   * CR  Sales Revenue
   * DR  Cost of Goods Sold
   * CR  Inventory
   */
  async postPOSTransaction(transactionId: string): Promise<void> {
    const transaction = await getPOSTransaction(transactionId)

    const totalCost = calculateTotalCost(transaction.items)

    const journalEntry = {
      entry_date: transaction.transaction_date,
      description: `POS transaction ${transaction.transaction_number}`,
      source: 'pos',
      source_id: transactionId,
      lines: [
        // Revenue recognition
        {
          account_id: CASH_ACCOUNT_ID,
          description: 'POS cash sale',
          debit: transaction.total_amount,
          credit: 0
        },
        {
          account_id: SALES_REVENUE_ACCOUNT_ID,
          description: 'Sales revenue',
          debit: 0,
          credit: transaction.total_amount
        },
        // COGS recognition
        {
          account_id: COGS_ACCOUNT_ID,
          description: 'Cost of goods sold',
          debit: totalCost,
          credit: 0
        },
        {
          account_id: INVENTORY_ACCOUNT_ID,
          description: 'Reduce inventory',
          debit: 0,
          credit: totalCost
        }
      ]
    }

    await createAndPostJournalEntry(journalEntry)
  }
}
```

### Journal Validation Service

```typescript
// Location: src/services/accounting/journalValidation.ts

class JournalValidationService {
  validateEntry(entry: JournalEntry): ValidationResult {
    const errors: string[] = []

    // 1. Check debits = credits
    if (entry.total_debit !== entry.total_credit) {
      errors.push('Debits must equal credits')
    }

    // 2. Check all accounts exist and are active
    for (const line of entry.lines) {
      const account = getAccount(line.account_id)
      if (!account) {
        errors.push(`Account ${line.account_id} not found`)
      } else if (!account.is_active) {
        errors.push(`Account ${account.code} is not active`)
      } else if (account.is_header) {
        errors.push(`Account ${account.code} is a header account`)
      }
    }

    // 3. Check date is valid
    if (!isValidPostingPeriod(entry.entry_date)) {
      errors.push('Entry date is outside valid posting period')
    }

    // 4. Check each line has either debit or credit (not both)
    for (const line of entry.lines) {
      if ((line.debit > 0 && line.credit > 0) ||
          (line.debit === 0 && line.credit === 0)) {
        errors.push('Each line must have either debit or credit')
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}
```

## Workflows

### Workflow 1: Manual Journal Entry

1. User creates journal entry (draft)
2. Adds entry date and description
3. Adds line items:
   - Selects account
   - Enters debit or credit amount
4. System validates:
   - Debits = Credits
   - Accounts are valid and active
   - No header accounts
5. User reviews entry
6. Posts entry to GL
7. System creates GL postings
8. Entry marked as posted (immutable)

### Workflow 2: Automatic Invoice Posting

1. Sales invoice created and finalized
2. User clicks "Post Invoice"
3. System calls AR posting service
4. Service creates journal entry:
   - DR A/R
   - CR Sales Revenue
5. Entry validated
6. Entry posted to GL
7. Invoice marked as posted
8. GL updated

### Workflow 3: Trial Balance Report

1. User selects "Trial Balance" report
2. Selects as-of date
3. System queries all GL postings up to date
4. Calculates balance for each account
5. Groups by account type
6. Displays debits and credits
7. Verifies total debits = total credits
8. Shows out-of-balance accounts (if any)

## UI Components

### Key Components

#### ChartOfAccountsTree
**Location**: `src/components/accounting/ChartOfAccountsTree.tsx`
- Hierarchical account display
- Expand/collapse sections
- Add child accounts

#### JournalEntryForm
**Location**: `src/components/accounting/JournalEntryForm.tsx`
- Create/edit journal entries
- Add/remove lines
- Real-time debit/credit validation

#### GeneralLedgerView
**Location**: `src/components/accounting/GeneralLedgerView.tsx`
- Account ledger display
- Running balance
- Date range filtering

#### TrialBalanceReport
**Location**: `src/components/accounting/TrialBalanceReport.tsx`
- Trial balance display
- Export to Excel/PDF

## Reports

### Account Balance Report
Shows balance for each account as of a date.

### General Ledger Report
Detailed transaction listing for an account.

### Trial Balance
All accounts with debit/credit balances.

### Income Statement (P&L)
Revenue and expenses for a period.

### Balance Sheet
Assets, liabilities, and equity as of a date.

## Troubleshooting

### Issue: Journal entry won't post
**Symptoms**: Error when posting entry
**Solution**:
1. Check debits = credits
2. Verify all accounts are active leaf nodes
3. Check date is in valid posting period
4. Review validation errors

### Issue: Trial balance out of balance
**Symptoms**: Total debits ≠ total credits
**Solution**:
1. Check for unposted entries
2. Verify all postings have balanced entries
3. Check for data corruption
4. Re-run posting for suspect entries

### Issue: Missing GL postings
**Symptoms**: Transactions not showing in GL
**Solution**:
1. Check if source entry is posted
2. Verify posting service was called
3. Check for errors in posting service
4. Manually post if needed

## Related Documentation

- **Accounting Product Requirements**: `docs/accounting-product-requirements.md`
- **POS Accounting Integration**: `docs/plans/pos-accounting-integration.md`
- **Accounting Implementation Progress**: `docs/accounting-implementation-progress.md`
- **AR Posting Service**: `src/services/accounting/arPosting.ts`
- **AP Posting Service**: `src/services/accounting/apPosting.ts`
- **COGS Posting Service**: `src/services/accounting/cogsPosting.ts`
- **POS Posting Service**: `src/services/accounting/posPosting.ts`

## Migration History

Key accounting-related migrations:

- Accounting module setup with chart of accounts
- Journal entries and GL postings
- AR/AP/COGS/POS posting integration
- Trial balance and financial reporting
