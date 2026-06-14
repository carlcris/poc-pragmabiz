# Point of Sale (POS) Module

## Overview

The Point of Sale module provides a complete retail transaction system for cash sales, integrated with inventory and accounting. It supports multiple payment methods, receipt generation, barcode scanning, and real-time inventory updates with automatic GL posting.

## Key Features

- **Cash sales** transactions (walk-in customers)
- **Multi-payment methods** (cash, card, check, transfer)
- **Receipt generation** (print and email)
- **Real-time inventory** integration (stock deduction)
- **Automatic accounting** integration (GL posting)
- **Customer lookup** and sales history
- **Barcode scanning** for quick product entry
- **Discount application** (line-item and total)
- **Transaction history** and reprints
- **Transaction voiding** with reversal
- **Multi-station** support

## POS Architecture

```
┌────────────────────────────────────────────────────────┐
│                    POS Interface                        │
│  Product Selection | Cart | Payment | Receipt          │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│                  Transaction Layer                      │
│  Validate Stock | Process Payment | Record Sale        │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│                Integration Layer                        │
│  Inventory Update | Accounting Posting | Receipt        │
└────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. POS Transaction

A **POS Transaction** represents a direct cash sale to a customer.

**Transaction Flow**:
1. **Product Selection**: Scan barcode or search products
2. **Cart Management**: Add/remove items, adjust quantities
3. **Apply Discounts**: Line-item or total discounts
4. **Calculate Tax**: Apply configured tax rate
5. **Payment**: Collect payment (cash, card, etc.)
6. **Receipt**: Print or email receipt
7. **Post Transaction**:
   - Reduce inventory (atomic operation)
   - Record sale
   - Post GL entries (DR Cash, CR Revenue, DR COGS, CR Inventory)

**Key Attributes**:
- **Transaction Number**: Unique identifier (auto-generated)
- **Transaction Date**: When sale occurred
- **POS Station**: Which terminal processed sale
- **Customer**: Optional customer reference
- **Items**: Products sold with quantities and prices
- **Subtotal**: Sum of line items before tax/discount
- **Discount**: Total discount applied
- **Tax**: Sales tax amount
- **Total**: Final amount charged
- **Payment Method**: How customer paid
- **Payment Reference**: Card last 4, check number, etc.
- **Status**: Draft, Completed, Voided

**Example Transaction**:
```
POS-2025-001
Date: 2025-06-14 14:30
Station: POS-MAIN-01
Customer: Walk-in

Items:
  Widget ABC × 2 @ $10.50 = $21.00
  Widget XYZ × 1 @ $15.00 = $15.00

Subtotal: $36.00
Discount: $0.00
Tax (9%): $3.24
Total: $39.24

Payment: Cash
Change: $0.76
```

### 2. POS Station

A **POS Station** represents a physical checkout terminal.

**Key Features**:
- Assigned to specific warehouse (for inventory)
- Configured payment methods
- Receipt printer setup
- Barcode scanner integration
- Cash drawer integration (optional)
- Default tax rate
- Session management (open/close)
- Unique station code

**Station Configuration**:
```typescript
{
  station_code: "POS-MAIN-01",
  name: "Main Store - Register 1",
  warehouse_id: "uuid",
  default_tax_rate: 9.0,  // 9%
  allowed_payment_methods: ["cash", "card", "check"],
  is_active: true
}
```

### 3. Payment Methods

**Supported Payment Methods**:
- **Cash**: Physical currency
- **Card**: Credit/debit card
- **Check**: Bank check
- **Transfer**: Bank transfer
- **Mixed** (future): Split payment across methods

**Payment Processing**:
- Cash: Simple cash in/out tracking
- Card: Integration with payment gateway (future)
- Check: Record check number
- Transfer: Record reference number

### 4. Receipt Generation

**Receipt Types**:
- **Printed Receipt**: Thermal printer output
- **Email Receipt**: PDF sent to customer
- **Reprint**: Duplicate for customer

**Receipt Contents**:
- Company/store information
- Transaction number and date
- Itemized list with prices
- Subtotal, tax, discount, total
- Payment method
- Change (if cash)
- Thank you message
- Terms and conditions (optional)

## Database Schema

### Core Tables

#### pos_stations
```sql
CREATE TABLE pos_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  station_code VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  warehouse_id UUID REFERENCES warehouses(id),
  default_tax_rate DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### pos_transactions
```sql
CREATE TABLE pos_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  transaction_number VARCHAR UNIQUE NOT NULL,
  pos_station_id UUID REFERENCES pos_stations(id),
  customer_id UUID REFERENCES customers(id),  -- Optional
  transaction_date TIMESTAMPTZ DEFAULT now(),
  status VARCHAR DEFAULT 'completed',  -- 'draft', 'completed', 'voided'
  subtotal DECIMAL(12,2),
  discount_amount DECIMAL(12,2) DEFAULT 0,
  tax_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  payment_method VARCHAR,  -- 'cash', 'card', 'check', 'transfer'
  payment_reference VARCHAR,  -- Card last 4, check number, etc.
  cash_received DECIMAL(12,2),  -- For cash payments
  change_given DECIMAL(12,2),   -- For cash payments
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES users(id),
  void_reason TEXT
);
```

#### pos_transaction_items
```sql
CREATE TABLE pos_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES pos_transactions(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  description VARCHAR,
  quantity DECIMAL(12,3) NOT NULL,
  unit_id UUID REFERENCES units_of_measure(id),
  unit_price DECIMAL(12,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  line_total DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## API Reference

### POS Transaction Endpoints

#### POST /api/pos/transactions
Create POS transaction.

**Permissions**: `create` on `pos_transactions`

**Request**:
```json
{
  "pos_station_id": "uuid",
  "customer_id": "uuid",  // Optional
  "transaction_date": "2025-06-14T14:30:00Z",
  "items": [
    {
      "item_id": "uuid",
      "quantity": 2,
      "unit_id": "uuid",
      "unit_price": 10.50,
      "discount_percent": 0
    },
    {
      "item_id": "uuid",
      "quantity": 1,
      "unit_id": "uuid",
      "unit_price": 15.00,
      "discount_percent": 10
    }
  ],
  "discount_amount": 0,
  "tax_rate": 9.0,
  "payment_method": "cash",
  "cash_received": 40.00,
  "notes": "Customer paid exact change"
}
```

**Effect** (all in atomic transaction):
1. Creates transaction record
2. **Reduces inventory** for all items
3. Creates stock transactions (type: 'pos_sale')
4. Updates warehouse stock levels
5. **Posts GL entries**:
   ```
   DR  Cash                     $39.24
     CR  Sales Revenue                $36.00
     CR  Sales Tax Payable            $3.24

   DR  Cost of Goods Sold      $24.00
     CR  Inventory                    $24.00
   ```
6. Generates receipt

**Response**:
```json
{
  "id": "uuid",
  "transaction_number": "POS-2025-001",
  "total_amount": 39.24,
  "change_given": 0.76,
  "receipt_url": "https://...receipt.pdf"
}
```

#### GET /api/pos/transactions
List POS transactions.

**Permissions**: `view` on `pos_transactions`

**Query Parameters**:
- `start_date`, `end_date` - Date range
- `pos_station_id` - Filter by station
- `customer_id` - Filter by customer
- `payment_method` - Filter by payment type
- `status` - Filter by status
- `page`, `limit` - Pagination

**Response**:
```json
{
  "transactions": [
    {
      "id": "uuid",
      "transaction_number": "POS-2025-001",
      "transaction_date": "2025-06-14T14:30:00Z",
      "pos_station": "POS-MAIN-01",
      "customer": "Walk-in",
      "items_count": 3,
      "total_amount": 39.24,
      "payment_method": "cash",
      "status": "completed"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

#### GET /api/pos/transactions/[id]
Get transaction details.

**Permissions**: `view` on `pos_transactions`

**Response**:
```json
{
  "id": "uuid",
  "transaction_number": "POS-2025-001",
  "transaction_date": "2025-06-14T14:30:00Z",
  "pos_station": {
    "code": "POS-MAIN-01",
    "name": "Main Store - Register 1"
  },
  "customer": { "name": "John Doe" },
  "items": [
    {
      "item": { "code": "ITEM-001", "name": "Widget ABC" },
      "quantity": 2,
      "unit": "piece",
      "unit_price": 10.50,
      "discount_amount": 0,
      "line_total": 21.00
    }
  ],
  "subtotal": 36.00,
  "discount_amount": 0,
  "tax_amount": 3.24,
  "total_amount": 39.24,
  "payment_method": "cash",
  "cash_received": 40.00,
  "change_given": 0.76,
  "status": "completed"
}
```

#### POST /api/pos/transactions/[id]/void
Void POS transaction.

**Permissions**: `delete` on `pos_transactions`

**Request**:
```json
{
  "void_reason": "Customer returned all items immediately"
}
```

**Effect** (all in atomic transaction):
1. Status changes to 'voided'
2. **Reverses inventory** deduction (adds stock back)
3. Creates reversing stock transactions
4. **Reverses GL entries**:
   ```
   DR  Sales Revenue            $36.00
   DR  Sales Tax Payable        $3.24
     CR  Cash                          $39.24

   DR  Inventory                $24.00
     CR  Cost of Goods Sold            $24.00
   ```
5. Records who voided and when
6. Records void reason

**Important**: Voiding does NOT create a cash refund transaction. Handle refunds separately if cash was returned.

#### POST /api/pos/transactions/[id]/receipt
Generate receipt (PDF or print).

**Permissions**: `view` on `pos_transactions`

**Query Parameters**:
- `format` - 'pdf' or 'print' or 'email'
- `email` - Email address (if format=email)

**Response**:
```json
{
  "receipt_url": "https://...receipt.pdf",
  "receipt_html": "<html>...</html>",
  "sent_to": "customer@example.com"  // If emailed
}
```

### POS Station Endpoints

#### GET /api/pos/stations
List all POS stations.

**Permissions**: `view` on `pos_stations`

#### POST /api/pos/stations
Create new POS station.

**Permissions**: `create` on `pos_stations`

#### PUT /api/pos/stations/[id]
Update POS station configuration.

**Permissions**: `edit` on `pos_stations`

## Services

### POS Posting Service

```typescript
// Location: src/services/accounting/posPosting.ts

class POSPostingService {
  /**
   * Post POS transaction to accounting
   *
   * DR  Cash                Total Amount
   *   CR  Sales Revenue          Subtotal - Discount
   *   CR  Sales Tax Payable      Tax Amount
   *
   * DR  COGS                Total Cost
   *   CR  Inventory              Total Cost
   */
  async postPOSTransaction(transactionId: string): Promise<void> {
    const transaction = await getPOSTransaction(transactionId)

    // Calculate total COGS
    const totalCOGS = transaction.items.reduce((sum, item) => {
      return sum + (item.quantity * item.average_cost)
    }, 0)

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
          credit: transaction.subtotal - transaction.discount_amount
        },
        {
          account_id: SALES_TAX_PAYABLE_ACCOUNT_ID,
          description: 'Sales tax collected',
          debit: 0,
          credit: transaction.tax_amount
        },
        // COGS recognition
        {
          account_id: COGS_ACCOUNT_ID,
          description: 'Cost of goods sold',
          debit: totalCOGS,
          credit: 0
        },
        {
          account_id: INVENTORY_ACCOUNT_ID,
          description: 'Reduce inventory',
          debit: 0,
          credit: totalCOGS
        }
      ]
    }

    await createAndPostJournalEntry(journalEntry)
  }

  /**
   * Reverse POS transaction (void)
   */
  async reversePOSTransaction(transactionId: string): Promise<void> {
    // Create reversing journal entry with opposite DR/CR
  }
}
```

### POS Stock Service

```typescript
// Location: src/services/pos/posStockService.ts

class POSStockService {
  /**
   * Reduce inventory for POS transaction (atomic)
   */
  async reduceStock(transactionId: string): Promise<void> {
    const transaction = await getPOSTransaction(transactionId)

    for (const item of transaction.items) {
      // Convert to base unit
      const baseQuantity = convertToBaseUnit(item.quantity, item.unit_id)

      // Validate stock available
      const available = await getAvailableStock(
        item.item_id,
        transaction.pos_station.warehouse_id
      )

      if (available < baseQuantity) {
        throw new InsufficientStockError(
          `Insufficient stock for ${item.item.name}. Available: ${available}, Required: ${baseQuantity}`
        )
      }

      // Create stock transaction
      await createStockTransaction({
        item_id: item.item_id,
        warehouse_id: transaction.pos_station.warehouse_id,
        quantity: -baseQuantity,  // Negative = out
        transaction_type: 'pos_sale',
        reference_type: 'pos_transaction',
        reference_id: transactionId,
        cost: item.average_cost,
        transaction_date: transaction.transaction_date
      })

      // Update warehouse stock
      await updateWarehouseStock(
        item.item_id,
        transaction.pos_station.warehouse_id,
        -baseQuantity
      )
    }
  }

  /**
   * Restore inventory (void transaction)
   */
  async restoreStock(transactionId: string): Promise<void> {
    // Reverse all stock transactions
    // Add quantities back to warehouse
  }
}
```

## Workflows

### Workflow 1: Complete POS Sale

1. **Cashier opens POS interface**
   - Selects POS station
   - System loads station configuration

2. **Product selection**
   - Scan barcode OR
   - Search by code/name
   - Add to cart

3. **Cart management**
   - Adjust quantities
   - Remove items
   - Apply line-item discounts

4. **Calculate total**
   - System calculates subtotal
   - Applies tax rate from station
   - Shows final total

5. **Payment collection**
   - Select payment method
   - For cash: Enter amount received
   - For card: Process through terminal
   - For check: Enter check number

6. **Process transaction**
   - System validates stock availability
   - Creates transaction (atomic):
     - Reduces inventory
     - Creates stock transactions
     - Posts GL entries
     - Generates receipt
   - Prints/emails receipt

7. **Complete**
   - Show change (if cash)
   - Transaction complete
   - Ready for next customer

### Workflow 2: Void Transaction

1. **Customer requests void**
   - Same day only (policy)
   - Must have receipt

2. **Cashier finds transaction**
   - Search by transaction number
   - Verify customer and items

3. **Void transaction**
   - Enter void reason
   - System validates:
     - Transaction is today
     - Transaction not already voided
     - User has permission

4. **Process void** (atomic):
   - Mark transaction as voided
   - Restore inventory
   - Reverse GL entries
   - Record void details

5. **Handle cash refund** (separate process)
   - If cash paid, refund customer
   - Record cash out in cash drawer
   - Get customer signature

## UI Components

### Key Components

#### POSInterface
**Location**: `src/app/pos/page.tsx` or `src/app/(dashboard)/sales/pos/page.tsx`
- Full POS interface
- Product search and scanning
- Cart management
- Payment processing
- Receipt generation

#### POSCart
**Location**: `src/components/pos/POSCart.tsx`
- Display cart items
- Quantity adjustments
- Line-item discounts
- Remove items
- Show running total

#### POSProductSearch
**Location**: `src/components/pos/POSProductSearch.tsx`
- Barcode input field
- Text search
- Product autocomplete
- Quick add to cart

#### POSPayment
**Location**: `src/components/pos/POSPayment.tsx`
- Payment method selection
- Cash amount entry
- Change calculation
- Process payment button

#### POSReceipt
**Location**: `src/components/pos/POSReceipt.tsx`
- Receipt preview
- Print button
- Email button
- Reprint functionality

#### TransactionsList
**Location**: `src/components/pos/TransactionsList.tsx`
- List all transactions
- Filter by date, station, customer
- Search by transaction number
- View details, reprint receipt

## Reports

### Daily Sales Report
Shows all POS transactions for a day by station.

### Payment Method Report
Breakdown of sales by payment method.

### Cashier Performance
Sales by cashier/user.

### Sales Tax Report
Total tax collected for remittance.

## Troubleshooting

### Issue: Inventory not updating after POS sale
**Symptoms**: Stock levels don't decrease
**Solution**:
1. Check POS stock service is being called
2. Verify warehouse assigned to POS station
3. Check stock transaction created
4. Review error logs for failures

### Issue: GL entries not posting
**Symptoms**: POS sales don't show in accounting
**Solution**:
1. Verify POS posting service configured
2. Check account mappings (Cash, Revenue, Tax, COGS, Inventory)
3. Review journal entry validation errors
4. Check accounting integration enabled

### Issue: Barcode scanner not working
**Symptoms**: Scans not registering
**Solution**:
1. Check scanner connected properly
2. Verify scanner configured as keyboard input
3. Test scanner in text field
4. Check barcode format matches items in system

### Issue: Receipt won't print
**Symptoms**: Print button doesn't work
**Solution**:
1. Check printer connected and powered on
2. Verify printer driver installed
3. Test print from system settings
4. Check paper not jammed
5. Verify printer selected in browser print dialog

## Related Documentation

- **POS Accounting Integration**: `docs/plans/pos-accounting-integration.md`
- **POS Accounting Integration Status**: `docs/pos-accounting-integration-status.md`
- **Accounting Module**: `docs/kb/05-ACCOUNTING.md`
- **Inventory Module**: `docs/kb/02-INVENTORY-MANAGEMENT.md`
- **Sales Module**: `docs/kb/03-SALES-MANAGEMENT.md`

## Future Enhancements

- **Loyalty Program**: Customer rewards and points
- **Gift Cards**: Digital gift card support
- **Returns**: POS return processing with credit
- **Multi-tender Payments**: Split payment across methods
- **Employee Performance**: Track sales by cashier
- **Shift Management**: Cash drawer opening/closing with reconciliation
- **Card Reader Integration**: Direct payment gateway integration
- **Customer Display**: Separate screen showing items and total to customer
- **Offline Mode**: Continue selling when internet down, sync later
