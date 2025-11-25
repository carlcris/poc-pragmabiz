# Accounting Domain — MVP PRD (Non–Event-Driven Version)

**Version:** 1.0

**Scope:**
- 2.1 Chart of Accounts (CoA)
- 2.2 General Ledger (GL)
- 2.3 Accounts Receivable (AR)
- 2.4 Accounts Payable (AP)
- 2.6 Inventory Accounting & COGS

**Goal:**
Deliver a minimal, stable accounting foundation using synchronous API-based integrations, with the structure ready to scale to full accounting modules in the future.

---

## 1. Objectives

### Primary Objectives

- Provide a working double-entry general ledger.
- Support basic AR: invoicing and payments.
- Support basic AP: supplier bills and payments.
- Post Inventory valuation and COGS through direct API calls.
- Maintain auditability, accuracy, and clear financial traceability.

### Design Principles

- Every transaction must follow double-entry bookkeeping.
- APIs only (no events) for cross-module operations.
- CoA must be flexible and editable.
- All postings must be auditable, with source references.
- Architecture must allow future expansion (Tax, FX, FA, Close, Reporting).

---

## 2. Modules & Features (MVP)

### 2.1 Chart of Accounts (CoA)

#### MVP Features

- Create, edit, archive accounts.
- **Fields:**
  - Account number
  - Account name
  - Type (Asset, Liability, Equity, Revenue, Expense, COGS)
  - Parent account
- **Default system accounts:**
  - Accounts Receivable
  - Accounts Payable
  - Inventory
  - COGS
  - Revenue
  - Cash/Bank
- Prevent deletion if account has posted transactions.

#### Future Expansion

- Tax code mapping
- Multi-currency accounts
- COA templates per industry
- Intercompany accounts

---

### 2.2 General Ledger (GL)

#### MVP Features

- Manual journal creation via API.
- Automatic postings triggered by AR/AP/Inventory API calls.
- **Journal structure:**
  - Header (date, reference, description, status)
  - Lines (account, debit, credit, description)
- **Validation:**
  - Balanced journal check
  - Valid account check
- **Status workflow:**
  - Draft → Posted
- **Basic audit metadata:**
  - source module
  - source reference

#### Future Expansion

- Reversals
- Recurring journals
- Approval workflows
- Period lock and close
- Multi-currency and FX impact

---

### 2.3 Accounts Receivable (AR)

#### MVP Features

- Create AR invoice via API or UI.
- **Fields:**
  - Customer
  - Invoice date
  - Due date
  - Total amount
  - Balance
  - Items/lines
- **Automatic GL posting:**
  - Debit Accounts Receivable
  - Credit Revenue
- **Record payments:**
  - Full or partial
- **Apply payment:**
  - Debit Cash/Bank
  - Credit AR
- Basic AR Aging report.

#### Future Expansion

- Credit memos
- Dunning / reminders
- Customer statements
- Credit limit control
- Recurring billing
- Tax on invoices

---

### 2.4 Accounts Payable (AP)

#### MVP Features

- Enter supplier bills manually.
- **Fields:**
  - Vendor
  - Invoice number
  - Amount
  - Terms
- **Automatic GL posting:**
  - Debit Expense/Inventory
  - Credit Accounts Payable
- **Record supplier payments:**
  - Debit AP
  - Credit Cash/Bank
- Basic AP Aging.

#### Future Expansion

- 3-way matching (PO → GRN → Invoice)
- Batch payment processing
- Payment file export
- Supplier credit memos
- Withholding taxes

---

### 2.6 Inventory Accounting & COGS

#### MVP Features

- Inventory module will directly call Accounting API to post:

**COGS Posting**
- Debit COGS
- Credit Inventory

**Stock Adjustment Posting**
- Increase or decrease Inventory based on adjustment
- **Account used:**
  - Inventory
  - Inventory Adjustment / Gain or Loss

- Valuation method (FIFO or Weighted Average) is computed by Inventory module.
- Accounting only posts amounts received from Inventory.

#### Future Expansion

- Standard cost
- Revaluation entries
- Landed cost allocations
- Capitalization for fixed assets

---

## 3. Data Model (Simplified)

### Account

| Field | Description |
|-------|-------------|
| `account_id` | Primary key |
| `number` | Account code |
| `name` | Account title |
| `type` | Asset/Liability/Equity/Revenue/Expense/COGS |
| `parent_account` | Hierarchical grouping |
| `is_active` | bool |

### Journal

| Field | Description |
|-------|-------------|
| `journal_id` | Primary key |
| `date` | Posting date |
| `reference` | Source reference ID |
| `description` | Notes |
| `status` | Draft or Posted |
| `source_module` | AR/AP/Inventory/Manual |

### JournalLine

| Field | Description |
|-------|-------------|
| `line_id` | Primary key |
| `journal_id` | FK |
| `account_id` | FK |
| `debit` | amount |
| `credit` | amount |
| `description` | optional |

### ARInvoice

| Field |
|-------|
| `invoice_id` |
| `customer_id` |
| `total_amount` |
| `balance` |
| `due_date` |
| `reference` |
| `status` |

### ARPayment

| Field |
|-------|
| `payment_id` |
| `amount` |
| `method` |
| `reference` |
| `applied_invoice_id` |

### APInvoice / APPayment

Mirrors AR with vendor fields.

---

## 4. Workflows (API-Based)

### 4.1 Sales Invoice → AR Posting

1. Sales module calls:
   `POST /accounting/ar/invoices`

2. Accounting creates AR invoice.

3. System posts GL journal:
   - Debit AR
   - Credit Revenue

4. Sales module calls:
   `POST /accounting/inventory/cogs` (if applicable)

5. Accounting posts:
   - Debit COGS
   - Credit Inventory

---

### 4.2 Customer Payment Posting

1. Payment received in Sales or Payments module.

2. The module calls:
   `POST /accounting/ar/payments`

3. Accounting posts journal:
   - Debit Cash/Bank
   - Credit AR

---

### 4.3 Supplier Invoice → AP Posting

1. User enters supplier invoice via Accounting or Procurement UI.

2. Post GL:
   - Debit Expense or Inventory
   - Credit AP

---

### 4.4 Supplier Payment Posting

1. Payment recorded.

2. Accounting posts:
   - Debit AP
   - Credit Cash/Bank

---

## 5. APIs (MVP)

### Journals
```
POST /api/v1/journals
GET  /api/v1/ledgers/{account_id}
```

### Accounts Receivable
```
POST /api/v1/receivables/invoices
POST /api/v1/receivables/payments
```

### Accounts Payable
```
POST /api/v1/payables/invoices
POST /api/v1/payables/payments
```

### Inventory Posting
```
POST /api/v1/inventory/cogs
POST /api/v1/inventory/adjustments
```

---

## 6. Non-Functional Requirements (MVP)

- All journals must be balanced before posting.
- GL posting latency: < 2 seconds.
- Support up to 20,000 journal lines/month.
- 99% availability for core accounting.
- Audit logs stored for all postings.
- Database-level referential integrity.

---

## 7. Acceptance Criteria (MVP)

| ID | Criteria |
|----|----------|
| **AC-01** | Creating an AR invoice posts a balanced AR/Revenue journal. |
| **AC-02** | COGS posting from Inventory correctly posts COGS and Inventory accounts. |
| **AC-03** | AP invoices appear in AP Aging after posting. |
| **AC-04** | Customer and supplier payments adjust balances correctly. |
| **AC-05** | System rejects unbalanced journals with validation error. |

---

## 8. Optional Deliverables

If you want, I can now generate:

- API JSON Schemas
- Table structure (SQL create scripts)
- UI Wireframes (Journal, AR, AP)
- Data migration templates (opening balances)
- ERD Diagram (ASCII or diagram tool format)
