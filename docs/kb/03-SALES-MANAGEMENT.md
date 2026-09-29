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
- Quotation details expose component drilldown only for Chop & Join lines. Framing lines are customer-facing finished items and display like ordinary lines; their stored components remain internal production details.
- Raw-material quotation entry only adds ordinary inventory lines with quantity, selling price, discount, and tax. Frame configurations are created and edited exclusively through the Chop & Join or Framing dialogs; raw-material entry has no job-order configuration, component editor, cut planner, or service-fee controls.
- Configured-frame line descriptions lead with the finished outside frame size. Artwork/opening dimensions remain part of the saved production geometry but are not presented as the quoted item's size.
- Draft and Sent quotations can be edited. Saving changes to a Sent quotation returns it to Draft so the revised version must be sent again; Accepted and later states are immutable through the edit workflow.

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
Confirming a Sales Order requires an active fulfillment warehouse in the current business unit.
Every ordinary stock-managed line creates a base-unit warehouse commitment and increments the
warehouse reserved-stock projection in the same transaction. Frame-configured lines remain owned by
their Frame Job Order material reservations and are not reserved twice by the Sales Order. A
confirmed order is inventory-owning and therefore read-only; cancel or delete it to release its
remaining commitments, or invoice it to consume them while the direct stock issue removes on-hand
inventory. Direct invoice conversion is one database transaction: invoice records retain the sales
unit and quantity, while warehouse, batch, location, stock-transaction, and reservation balances
are deducted in the item's base unit. Sales Invoices remain accounting documents and never create a
second reservation. The conversion dialog shows the warehouse reserved during confirmation as a
read-only value. Users may choose a location within that warehouse, but cannot switch the invoice
to another warehouse because its physical deduction must consume the existing commitment.

Customer-facing Sales Order and Sales Invoice views and PDFs expand Chop & Join lines into their
billable component rows (moulding, mat, glazing, backing, and hardware). The synthetic Chop & Join
parent is not printed as a separate line. Framing work and ordinary inventory remain single summary
lines. Linked invoices resolve the immutable component snapshot from their originating Sales Order,
so component quantities, rates, discounts, and amounts match the confirmed order without creating
duplicate invoice inventory rows.

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
- Component-level Chop & Join lines in the detail view and PDF

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

Sales line entry uses active item price tiers as the selling price source. Standard item price tiers are company-scoped by RLS: authenticated users can read, create, and update tiers only for their own company. A customer can override the price for a specific item and tier in the customer's **Special Prices** tab. At pricing time, an active customer-specific price whose effective date range includes today replaces only the matching standard item tier; tiers without an override continue to use the standard item price. Quotations, sales orders, invoices, and POS lines default to the configured inventory default pricing tier and allow users to select another available tier; the selected tier code/name and resolved selling price are persisted on the line as a price snapshot.

Special-price date ranges for the same customer, item, and tier cannot overlap. The special-price list is server-filtered and paginated. Viewing it requires `customers.tab.special_prices.view`; creating, editing, or deactivating a price additionally requires `customers.operation.special_prices.edit` and the corresponding customer edit permission. Admin and Super Admin roles receive both granular permissions by default.

Changing a customer does not rewrite prices already saved on quotation, sales-order, or invoice lines. Selecting an item or tier resolves pricing for the currently selected customer. POS additionally reprices its open cart when the selected customer changes and restores standard pricing for a walk-in customer.

When a sales-order line is added from an accepted quotation, the quotation's captured pricing tier, tier name, and unit price are copied unchanged into the sales order. The import does not reprice the line against current item or customer pricing.

Configured framing and chop-and-join work can only enter a Sales Order from an accepted quotation. The item, description, unit, price, discount, tax, geometry, mat layers, and components are read-only in the Sales Order; only the quantity to order may change. The quantity dialog identifies each configured line and size by its finished outside frame dimensions, not its artwork/opening dimensions, and omits sizes whose quoted quantity has already been fully allocated. For a multi-size line, the user enters a separate partial quantity for each quoted size and the line quantity is their sum. Every selected size is stored as its own Sales Order configuration and remains linked to the matching quotation configuration. Draft creation and replacement editing copy the selected quotation hierarchy and commercial values in one database transaction. The Sales Order no longer supports manually configuring an inventory line as a frame job.

Creating the Frame Job Order from a confirmed Sales Order copies production demand only; it does not
ask for a warehouse or check, reserve, or deduct inventory. Warehouse ownership begins in the job
order's Production Material Request: draft records demand, approval reserves all lines atomically,
and issue creates the outbound stock transaction. Production may start and finish without a request
or with partial issued quantities when residual materials are used. Completion preserves actual issued
quantities, closes unissued requests and releases unused reservations; it never fabricates consumption
or deducts inventory again. Each sales-order line reports its own job order's production status.

Quotation headers aggregate saved exact line totals, discounts and taxes rather than multiplying
rounded display rates. Header subtotal and discount include component-level discounts, while parent
line discounts remain separate so conversion cannot subtract component discounts twice.
Sales-order edits preserve fixed quotation discounts; partial multi-size
orders use the selected sizes' saved commercial amounts, not the parent line's average rate.
Component discount amounts and percentages are copied into each order-size snapshot. Full
conversion and draft edits include those component deductions in both the header subtotal and
discount without subtracting them from the payable amount again. Partial sizes prorate the saved
component amounts and discounts to cents. Setting a size quantity to zero excludes that size from
the request; at least one positive whole-frame quantity is required. Opening an ordinary line with
no frame sizes retains its saved quantity.

Printed quotation, order, and invoice discount amounts and effective percentages use the pre-tax
base. For example, two units at 100 with a 10% discount and 12% tax show a 20 discount (10%),
not 22.40; a fully discounted ordinary line retains its full gross discount amount.
New configuration rates (frame, mat, glazing, and backing), mat-layer rates, component discount
amounts, and frame quantities are stored with two decimal places. Frame counts remain whole-number
selections; geometric dimensions retain their separate precision.

Quotation and Sales Order Details share the same compact line table. Each configured line shows
one parent row with an em dash for selling price, its saved discount amount and effective pre-tax
percentage, and its exact pre-discount, pre-tax total. Component discounts are included in both
the parent gross amount and its displayed discount, so the row amounts reconcile to the document
subtotal. Expanded component rows also show amounts before their own discounts. Saved payable
line totals are unchanged; the summary subtracts discounts and adds tax once.

The editable Sales Order form and its quantity dialog also retain fixed and component discounts.
Their Discount cells show the amount and effective pre-tax percentage, configured selling prices
are shown as an em dash, and the editable table's row totals are before discount and tax. Quantity
previews use read-only original quotation pricing, including per-component cent rounding and
value-based allocation of whole-line discounts, rather than multiplying a rounded average rate.
The availability endpoint loads saved discount/tax amounts for its bounded page instead of
substituting zero. Order responses include `quotationPricing` from existing source relationships;
this preview metadata is never sent in mutation payloads. The database RPC still owns final pricing.
If source pricing cannot be read, the quantity dialog asks the user to reload rather than guessing.

Chop & Join components expand beneath the parent; Framing stays a summary row.
Ordinary inventory lines retain their selling price. Sales Orders retain
per-line production context, while quotations retain fulfilled quantities. Both sales-order list
and detail responses include each line's saved `discountAmount`, including fixed discounts with
a zero stored percentage. Print/PDF layouts are separate from this on-screen table.

Both quotation confirmation and acceptance through the status endpoint save acceptance metadata and
waivers in one database transaction. A waiver failure leaves the prior status and evidence unchanged.
New moulding selections without a price tier for the selected billing mode cannot be applied; reopening
a saved configuration preserves its captured rates without requiring a catalogue reprice.

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
      "balance": 12500.0,
      "is_active": true
    }
  ]
}
```

#### POST /api/customers

Create new customer.

**Permissions**: `create` on `customers`

#### GET /api/customers/[id]/special-prices

List a customer's special item-tier prices with bounded server-side search, status filtering, tier filtering, sorting, and pagination.

**Permissions**: `view` on `customers` and `customers.tab.special_prices.view`

#### POST /api/customers/[id]/special-prices

Create a customer-specific price for one item and one configured price tier. Effective date ranges cannot overlap another active record for the same customer, item, and tier.

**Permissions**: `edit` on `customers` and `customers.operation.special_prices.edit`

#### PATCH /api/customers/[id]/special-prices/[priceId]

Update the price, currency, effective dates, active state, or notes. Customer, item, and tier identity are immutable after creation.

**Permissions**: `edit` on `customers` and `customers.operation.special_prices.edit`

#### DELETE /api/customers/[id]/special-prices/[priceId]

Soft-delete a customer-specific price.

**Permissions**: `edit` on `customers` and `customers.operation.special_prices.edit`

#### POST /api/pricing/resolve

Resolve effective tier prices for one customer and up to 50 item IDs. Customer-specific prices replace matching standard tiers; the response identifies whether each resolved tier came from the standard item price or a customer override. The Special Prices tab permission controls access to the configuration screen, not whether an authorized sales user receives the customer's effective selling price.

**Permissions**: `view` on `customers` and `view` on `items`

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
      "debit": 1000.0,
      "credit": 0,
      "balance": 1000.0
    },
    {
      "date": "2025-06-10",
      "type": "payment",
      "reference": "PAY-001",
      "debit": 0,
      "credit": 500.0,
      "balance": 500.0
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
      "unit_price": 10.5,
      "discount_percent": 5
    }
  ],
  "notes": "Special pricing for bulk order"
}
```

#### POST /api/quotations/[id]/confirm

Confirm quotation.

**Permissions**: `edit` on `sales_quotations`

**Effect**: Records customer acceptance and changes status to `accepted`, allowing the quotation to spawn sales orders.

#### POST /api/quotations/[id]/convert-to-sales-order

Convert every line of a fully accepted, unfulfilled quotation into one draft sales order.

**Permissions**: `create` on `sales_orders`

**Effect**:

- Copies every quotation line and preserves each framing or chop-and-join size as a distinct configuration.
- Preserves the accepted quotation's exact prices, discounts, taxes, and totals.
- Links each sales-order line to its source quotation line and updates quotation fulfillment to `ordered`.
- Rejects quotations that are not accepted or already have an active sales-order allocation. Partially ordered quotations continue through the quantity-selecting Sales Order flow.
- Creates the sales order and all dependent line/configuration records in one database transaction.

#### PUT /api/quotations/[id]

Update an editable quotation and its line items in one transaction.

**Permissions**: `edit` on `sales_quotations`

**Status rule**: Draft and Sent quotations may be updated. A successful update always leaves the quotation in Draft; all other statuses return `QUOTATION_NOT_EDITABLE` without changing quotation data.

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
  "customerId": "uuid",
  "orderDate": "2025-06-14",
  "expectedDeliveryDate": "2025-06-21",
  "lineItems": [
    {
      "quotationId": "uuid",
      "quotationItemId": "uuid",
      "itemId": "uuid",
      "description": "Quoted frame",
      "quantity": 5,
      "uomId": "uuid",
      "unitPrice": 648.67,
      "discount": 0,
      "taxRate": 0,
      "frameSizeSelections": [
        { "quotationConfigurationId": "uuid", "quantity": 3 },
        { "quotationConfigurationId": "uuid", "quantity": 2 }
      ]
    }
  ],
  "shippingAddress": "",
  "shippingCity": "",
  "shippingState": "",
  "shippingPostalCode": "",
  "shippingCountry": "",
  "paymentTerms": "Cash",
  "notes": ""
}
```

**Validation** (if from quotation):

- The quotation must be accepted and belong to the selected customer.
- The line quantity cannot exceed the quotation line's remaining quantity.
- Frame-size selections must reference configurations on that quotation line, cannot exceed each size's remaining quantity, and must sum to the line quantity.
- The database ignores client-provided commercial values for linked lines and copies the accepted quotation values.
- Direct inventory lines cannot submit frame configuration data.
- Active draft Sales Orders count toward quotation fulfillment; cancellation or deletion releases the quantity.

#### POST /api/sales-orders/[id]/confirm

Confirm sales order.

**Permissions**: `edit` on `sales_orders`

**Effect**:

1. Changes status to 'confirmed'
2. Stores the selected fulfillment warehouse
3. Creates one source-owned warehouse reservation for each stock-managed line
4. Increments `item_warehouse.reserved_stock` atomically
5. Rejects the full confirmation when any line has insufficient available stock

Confirmed orders cannot be edited. Cancellation and deletion release all active Sales Order
commitments transactionally. Direct conversion to an invoice consumes those commitments rather
than adding another reservation. The conversion locks the order and stock projections, creates the
invoice and its lines, deducts the selected location and FIFO batches in base units, updates
warehouse on-hand, and marks the Sales Order reservation consumed in one transaction. Accounting
posting remains a post-commit side effect.

#### GET /api/sales-orders/[id]/payment-summary

Get payment summary for sales order.

**Permissions**: `view` on `sales_orders`

**Response**:

```json
{
  "order_total": 1000.0,
  "invoiced_amount": 800.0,
  "paid_amount": 500.0,
  "balance": 300.0,
  "invoices": [
    {
      "invoice_number": "INV-001",
      "amount": 800.0,
      "paid": 500.0,
      "balance": 300.0,
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
      "received_quantity": 48, // Scanned quantity
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
  "sales_order_id": "uuid", // Optional
  "customer_id": "uuid",
  "invoice_date": "2025-06-14",
  "due_date": "2025-07-14",
  "items": [
    {
      "item_id": "uuid",
      "quantity": 50,
      "unit_id": "uuid",
      "unit_price": 10.0
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
  "amount": 500.0,
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
2. Confirm customer acceptance (status: accepted)
3. Review the accepted quotation
4. Convert the complete accepted quotation into one draft Sales Order, or use Create Sales Order to select partial quantities
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
