# Sales Management Module

## Overview

The Sales Management module handles the complete sales workflow from quotations through invoicing and delivery. It includes customer master data, sales orders, quotations, invoices, delivery notes, and commission calculations with full accounting integration.

## Key Features

- **Quotation** management with partial fulfillment tracking
- **Sales Orders** linked to quotations
- **Invoicing** with automatic GL posting
- **Delivery Notes** with picking and receiving workflows
- **Customer** master data with ledger
- **Commission** calculations for sales staff
- **Multi-currency** support
- **Payment** tracking
- **Credit management**
- **Sales analytics** by employee, territory, time period

## Sales Workflow

```
Quotation (Draft)
    ↓
Quotation (Confirmed)
    ↓ (can have partial fulfillment)
Sales Order(s) ─────→ Delivery Note ─────→ Invoice ─────→ Payment
                         (Picking)          (GL Posting)
```

## Core Concepts

### 1. Quotation

A **Quotation** is a sales proposal sent to customers with pricing and terms.

**Key Features**:
- Draft and confirmed status
- **Partial fulfillment tracking** - Quotations can spawn multiple sales orders
- Line-item level fulfillment quantities
- Validity period
- Terms and conditions
- PDF generation for customer

**Fulfillment Tracking**:
```typescript
// Each quotation line tracks:
{
  quantity: 100,              // Original quoted quantity
  fulfilled_quantity: 60,     // Quantity already in sales orders
  remaining_quantity: 40      // Available for new sales orders
}
```

### 2. Sales Order

A **Sales Order** is a confirmed order from a customer to supply goods.

**Key Features**:
- Linked to quotation (optional)
- Can be created independently
- Status workflow: Draft → Confirmed → In Delivery → Completed
- Inventory reservation on confirmation
- Linked delivery notes
- Payment summary

**Inventory Reservation**:
When a sales order is confirmed, inventory is **reserved** (not removed). Stock is only removed when delivery note is dispatched.

### 3. Delivery Note

A **Delivery Note** documents the shipment of goods to customers.

**Key Features**:
- Picking workflow (mobile app optimized)
- **Scan receiving with variance** workflow
- Exception handling (shortages, overages, damages)
- Batch/serial number tracking
- Signature capture
- GPS location recording
- Multiple delivery notes per sales order

**Delivery Workflow**:
```
Draft → Start Picking → Queue Picking → Dispatch → Received
```

**Scan Receiving (June 2025)**:
- Scan each item at receiving
- Compare scanned vs expected quantities
- Handle variances (short, over, damaged)
- Create variance transactions
- Atomic transaction processing

### 4. Invoice

An **Invoice** is a bill sent to customers for payment.

**Key Features**:
- Linked to sales order or created standalone
- Automatic GL posting (AR)
- Payment recording
- Credit note support
- PDF generation
- Email delivery

**GL Posting** (automatic):
```
DR  Accounts Receivable (Customer)    1,000
  CR  Sales Revenue                          1,000
```

### 5. Customer

A **Customer** represents a buyer in the system.

**Key Features**:
- Contact information
- Credit limit management
- Payment terms
- Pricing tier
- Ledger view (all transactions)
- AR aging report

## Database Schema

### Core Tables

#### customers
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  code VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  contact_person VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  address TEXT,
  credit_limit DECIMAL(12,2),
  payment_terms_days INTEGER DEFAULT 30,
  pricing_tier VARCHAR,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Sales line entry uses active item price tiers as the selling price source. Quotations, sales orders, invoices, and POS lines default to the configured inventory default pricing tier and allow users to select another available tier; the selected tier code/name and resolved selling price are persisted on the line.

#### quotations
```sql
CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  quotation_number VARCHAR UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  quotation_date TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'confirmed', 'expired', 'cancelled'
  subtotal DECIMAL(12,2),
  tax_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  notes TEXT,
  terms_conditions TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### quotation_lines
```sql
CREATE TABLE quotation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID REFERENCES quotations(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  description VARCHAR,
  quantity DECIMAL(12,3) NOT NULL,
  fulfilled_quantity DECIMAL(12,3) DEFAULT 0,  -- Qty in sales orders
  unit_id UUID REFERENCES units_of_measure(id),
  unit_price DECIMAL(12,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### sales_orders
```sql
CREATE TABLE sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  order_number VARCHAR UNIQUE NOT NULL,
  quotation_id UUID REFERENCES quotations(id),  -- Optional link
  customer_id UUID REFERENCES customers(id),
  order_date TIMESTAMPTZ DEFAULT now(),
  delivery_date TIMESTAMPTZ,
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'confirmed', 'in_delivery', 'completed', 'cancelled'
  subtotal DECIMAL(12,2),
  tax_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### sales_order_lines
```sql
CREATE TABLE sales_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID REFERENCES sales_orders(id) ON DELETE CASCADE,
  quotation_line_id UUID REFERENCES quotation_lines(id),  -- Track source
  item_id UUID REFERENCES items(id),
  description VARCHAR,
  quantity DECIMAL(12,3) NOT NULL,
  delivered_quantity DECIMAL(12,3) DEFAULT 0,
  unit_id UUID REFERENCES units_of_measure(id),
  unit_price DECIMAL(12,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### delivery_notes
```sql
CREATE TABLE delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  delivery_number VARCHAR UNIQUE NOT NULL,
  sales_order_id UUID REFERENCES sales_orders(id),
  customer_id UUID REFERENCES customers(id),
  warehouse_id UUID REFERENCES warehouses(id),
  delivery_date TIMESTAMPTZ DEFAULT now(),
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'picking', 'queued', 'dispatched', 'received'
  notes TEXT,
  signature_url VARCHAR,  -- Customer signature
  gps_location VARCHAR,   -- Delivery location
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  dispatched_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ
);
```

#### delivery_note_items
```sql
CREATE TABLE delivery_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_note_id UUID REFERENCES delivery_notes(id) ON DELETE CASCADE,
  sales_order_line_id UUID REFERENCES sales_order_lines(id),
  item_id UUID REFERENCES items(id),
  location_id UUID REFERENCES warehouse_locations(id),
  quantity DECIMAL(12,3) NOT NULL,
  picked_quantity DECIMAL(12,3) DEFAULT 0,
  received_quantity DECIMAL(12,3) DEFAULT 0,  -- Scanned at delivery
  variance_quantity DECIMAL(12,3) DEFAULT 0,  -- Difference
  unit_id UUID REFERENCES units_of_measure(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### invoices
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  invoice_number VARCHAR UNIQUE NOT NULL,
  sales_order_id UUID REFERENCES sales_orders(id),
  customer_id UUID REFERENCES customers(id),
  invoice_date TIMESTAMPTZ DEFAULT now(),
  due_date TIMESTAMPTZ,
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'posted', 'paid', 'cancelled'
  subtotal DECIMAL(12,2),
  tax_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  paid_amount DECIMAL(12,2) DEFAULT 0,
  balance DECIMAL(12,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  notes TEXT,
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### invoice_items
```sql
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  description VARCHAR,
  quantity DECIMAL(12,3) NOT NULL,
  unit_id UUID REFERENCES units_of_measure(id),
  unit_price DECIMAL(12,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  line_total DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### invoice_payments
```sql
CREATE TABLE invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  payment_date TIMESTAMPTZ DEFAULT now(),
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR,  -- 'cash', 'check', 'transfer', 'card'
  reference VARCHAR,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### employees
```sql
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  employee_number VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  email VARCHAR,
  phone VARCHAR,
  position VARCHAR,
  is_salesperson BOOLEAN DEFAULT false,
  commission_rate DECIMAL(5,2),  -- Percentage
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### commissions
```sql
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES employees(id),
  invoice_id UUID REFERENCES invoices(id),
  sale_amount DECIMAL(12,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(12,2),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  is_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## API Reference

### Customer Management

#### GET /api/customers
List all customers.

**Permissions**: `view` on `customers`

**Response**:
```json
{
  "customers": [
    {
      "id": "uuid",
      "code": "CUST-001",
      "name": "Acme Corp",
      "email": "contact@acme.com",
      "phone": "555-1234",
      "credit_limit": 50000,
      "payment_terms_days": 30,
      "balance": 12500.00,
      "is_active": true
    }
  ]
}
```

#### POST /api/customers
Create new customer.

**Permissions**: `create` on `customers`

#### GET /api/customers/[id]/ledger
Get customer ledger (all transactions).

**Permissions**: `view_customer_ledger` capability

**Response**:
```json
{
  "customer": { "id": "uuid", "name": "Acme Corp" },
  "transactions": [
    {
      "date": "2025-06-01",
      "type": "invoice",
      "reference": "INV-001",
      "debit": 1000.00,
      "credit": 0,
      "balance": 1000.00
    },
    {
      "date": "2025-06-10",
      "type": "payment",
      "reference": "PAY-001",
      "debit": 0,
      "credit": 500.00,
      "balance": 500.00
    }
  ]
}
```

### Quotation Management

#### GET /api/quotations
List quotations.

**Permissions**: `view` on `sales_quotations`

#### POST /api/quotations
Create new quotation.

**Permissions**: `create` on `sales_quotations`

**Request**:
```json
{
  "customer_id": "uuid",
  "quotation_date": "2025-06-14",
  "valid_until": "2025-07-14",
  "lines": [
    {
      "item_id": "uuid",
      "quantity": 100,
      "unit_id": "uuid",
      "unit_price": 10.50,
      "discount_percent": 5
    }
  ],
  "notes": "Special pricing for bulk order"
}
```

#### POST /api/quotations/[id]/confirm
Confirm quotation.

**Permissions**: `edit` on `sales_quotations`

**Effect**: Changes status to 'confirmed', quotation can now spawn sales orders

#### GET /api/quotations/[id]/fulfillment
Get fulfillment status.

**Permissions**: `view` on `sales_quotations`

**Response**:
```json
{
  "quotation_id": "uuid",
  "total_quoted": 1000,
  "total_fulfilled": 600,
  "total_remaining": 400,
  "lines": [
    {
      "item": "Widget ABC",
      "quoted_quantity": 100,
      "fulfilled_quantity": 60,
      "remaining_quantity": 40,
      "sales_orders": ["SO-001", "SO-002"]
    }
  ]
}
```

### Sales Order Management

#### POST /api/sales-orders
Create sales order.

**Permissions**: `create` on `sales_orders`

**Request**:
```json
{
  "quotation_id": "uuid",  // Optional
  "customer_id": "uuid",
  "order_date": "2025-06-14",
  "delivery_date": "2025-06-21",
  "lines": [
    {
      "quotation_line_id": "uuid",  // If from quotation
      "item_id": "uuid",
      "quantity": 50,  // Cannot exceed quotation remaining
      "unit_id": "uuid",
      "unit_price": 10.00
    }
  ]
}
```

**Validation** (if from quotation):
- Line quantities cannot exceed remaining quotation quantities
- Updates quotation line `fulfilled_quantity`

#### POST /api/sales-orders/[id]/confirm
Confirm sales order.

**Permissions**: `edit` on `sales_orders`

**Effect**:
1. Changes status to 'confirmed'
2. **Reserves inventory** in warehouse
3. Creates inventory reservations
4. Cannot be cancelled without releasing reservations

#### GET /api/sales-orders/[id]/payment-summary
Get payment summary for sales order.

**Permissions**: `view` on `sales_orders`

**Response**:
```json
{
  "order_total": 1000.00,
  "invoiced_amount": 800.00,
  "paid_amount": 500.00,
  "balance": 300.00,
  "invoices": [
    {
      "invoice_number": "INV-001",
      "amount": 800.00,
      "paid": 500.00,
      "balance": 300.00,
      "status": "posted"
    }
  ]
}
```

### Delivery Note Management

#### POST /api/delivery-notes
Create delivery note.

**Permissions**: `create` on `delivery_notes`

**Request**:
```json
{
  "sales_order_id": "uuid",
  "warehouse_id": "uuid",
  "delivery_date": "2025-06-14",
  "items": [
    {
      "sales_order_line_id": "uuid",
      "item_id": "uuid",
      "location_id": "uuid",
      "quantity": 50,
      "unit_id": "uuid"
    }
  ]
}
```

#### POST /api/delivery-notes/[id]/start-picking
Start picking process.

**Permissions**: `edit` on `delivery_notes`

**Effect**: Status changes to 'picking', mobile app can scan items

#### POST /api/delivery-notes/[id]/queue-picking
Queue for picking.

**Permissions**: `edit` on `delivery_notes`

**Effect**: Status changes to 'queued', ready for warehouse team

#### POST /api/delivery-notes/[id]/dispatch
Dispatch delivery note.

**Permissions**: `edit` on `delivery_notes`

**Effect**:
1. Status changes to 'dispatched'
2. **Removes inventory** from warehouse
3. Creates stock transactions
4. Updates sales order delivered quantities
5. Releases reservations
6. Records dispatch timestamp

**Atomic Transaction** (June 2025 refactor):
All inventory updates happen in a single database transaction for data integrity.

#### POST /api/delivery-notes/[id]/receive
Record delivery receipt with scanned quantities.

**Permissions**: `edit` on `delivery_notes`

**Request**:
```json
{
  "received_at": "2025-06-14T14:30:00Z",
  "gps_location": "40.7128,-74.0060",
  "signature_url": "https://...",
  "items": [
    {
      "delivery_note_item_id": "uuid",
      "received_quantity": 48,  // Scanned quantity
      "notes": "2 units damaged in transit"
    }
  ]
}
```

**Variance Handling**:
- If received_quantity < quantity: Create variance transaction (shortage)
- If received_quantity > quantity: Create variance transaction (overage)
- Records variance in delivery_note_items.variance_quantity

### Invoice Management

#### POST /api/invoices
Create invoice.

**Permissions**: `create` on `invoices`

**Request**:
```json
{
  "sales_order_id": "uuid",  // Optional
  "customer_id": "uuid",
  "invoice_date": "2025-06-14",
  "due_date": "2025-07-14",
  "items": [
    {
      "item_id": "uuid",
      "quantity": 50,
      "unit_id": "uuid",
      "unit_price": 10.00
    }
  ]
}
```

#### POST /api/invoices/[id]/post
Post invoice (finalize and create GL entries).

**Permissions**: `edit` on `invoices`

**Effect**:
1. Status changes to 'posted'
2. **Creates GL entries** (AR posting):
   ```
   DR  Accounts Receivable    1,000
     CR  Sales Revenue              1,000
   ```
3. Records posting timestamp and user
4. Invoice cannot be edited after posting (unless capability granted)

**See**: `src/services/accounting/arPosting.ts`

#### POST /api/invoices/[id]/payments
Record payment.

**Permissions**: `create` on `invoice_payments`

**Request**:
```json
{
  "payment_date": "2025-06-20",
  "amount": 500.00,
  "payment_method": "check",
  "reference": "CHK-12345"
}
```

**Effect**:
1. Creates payment record
2. Updates invoice `paid_amount`
3. **Creates GL entries** (AR payment):
   ```
   DR  Cash/Bank              500
     CR  Accounts Receivable      500
   ```

#### POST /api/invoices/[id]/cancel
Cancel invoice.

**Permissions**: `delete` on `invoices`

**Effect**:
1. Status changes to 'cancelled'
2. **Reverses GL entries** if posted

## Workflows

### Workflow 1: Quotation to Sales Order

1. Create quotation with line items
2. Confirm quotation (status: confirmed)
3. Customer accepts quotation
4. Create sales order from quotation
5. Link sales order lines to quotation lines
6. System validates quantities don't exceed remaining
7. System updates quotation fulfillment tracking
8. Confirm sales order (reserves inventory)

### Workflow 2: Sales Order to Delivery

1. Sales order confirmed (inventory reserved)
2. Create delivery note from sales order
3. Start picking workflow
4. Warehouse team picks items (mobile app)
5. Queue delivery note for dispatch
6. Dispatch delivery note:
   - Removes inventory (atomic transaction)
   - Creates stock transactions
   - Updates sales order delivered quantities
7. Driver delivers to customer
8. Customer receives and scans items
9. System records variances (if any)
10. Delivery note marked as received

### Workflow 3: Invoicing and Payment

1. Sales order completed (or partial)
2. Create invoice from sales order
3. Review invoice items and totals
4. Post invoice:
   - Finalizes invoice
   - Creates AR GL entry
   - Sends PDF to customer
5. Customer makes payment
6. Record payment in system:
   - Creates payment record
   - Updates paid amount
   - Creates payment GL entry
7. If fully paid, invoice status: 'paid'

## Services

### AR Posting Service

```typescript
// Location: src/services/accounting/arPosting.ts

class ARPostingService {
  // Post invoice (create GL entries)
  async postInvoice(invoiceId: string): Promise<void> {
    // DR  Accounts Receivable
    // CR  Sales Revenue
  }

  // Record payment (create GL entries)
  async recordPayment(paymentId: string): Promise<void> {
    // DR  Cash/Bank
    // CR  Accounts Receivable
  }

  // Reverse invoice (cancel GL entries)
  async reverseInvoice(invoiceId: string): Promise<void> {
    // Reverse both invoice and payment entries
  }
}
```

## UI Components

### Key Components

#### CustomerList
**Location**: `src/components/sales/CustomerList.tsx`

#### QuotationForm
**Location**: `src/components/sales/QuotationForm.tsx`

#### SalesOrderForm
**Location**: `src/components/sales/SalesOrderForm.tsx`

#### DeliveryNotePickingUI
**Location**: `src/components/sales/DeliveryNotePickingUI.tsx`
- Mobile-optimized picking interface
- Barcode scanning
- Location-based picking

#### InvoiceForm
**Location**: `src/components/sales/InvoiceForm.tsx`

#### PaymentDialog
**Location**: `src/components/sales/PaymentDialog.tsx`

## Related Documentation

- **Quotation Partial Fulfillment Plan**: `docs/plans/quotation-partial-fulfillment-refactor-plan.md`
- **Delivery Note Scan Receiving Plan**: `docs/plans/delivery-note-receiving-implementation-plan.md`
- **AR Posting Service**: `src/services/accounting/arPosting.ts`
- **Accounting Integration**: `docs/kb/05-ACCOUNTING.md`

## Migration History

Key sales-related migrations:

- `20260611000000_quotation_partial_fulfillment.sql` - Quotation fulfillment tracking
- `20260605000000_delivery_note_scan_receiving.sql` - Scan receiving with variance
- Earlier migrations for customers, quotations, sales orders, delivery notes, invoices
