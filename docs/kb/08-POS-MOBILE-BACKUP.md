# Point of Sale & Mobile App Module

## Overview

The POS & Mobile module provides a Point of Sale system for retail transactions and a React Native mobile app for warehouse operations including picking, receiving, and barcode scanning.

## Key Features

### Point of Sale (POS)
- **Cash sales** transactions
- **Multi-payment methods** (cash, card, check, transfer)
- **Receipt generation** (print and email)
- **Inventory integration** (real-time stock deduction)
- **Accounting integration** (automatic GL posting)
- **Customer lookup** and sales history
- **Barcode scanning** for quick product entry
- **Discount application**
- **Transaction history** and reprints

### Mobile App
- **React Native with Expo** for cross-platform (iOS and Android)
- **Warehouse picking** workflows
- **GRN receiving** on mobile devices
- **Barcode/QR code scanning**
- **Location-based** warehouse operations
- **Offline capability** (future enhancement)
- **Photo capture** for damaged items
- **Digital signatures** for deliveries

## Architecture

### POS Architecture
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

### Mobile App Architecture
```
┌────────────────────────────────────────────────────────┐
│               React Native App (Expo)                   │
│  Picking UI | Receiving UI | Scanning | Navigation     │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┘
│                    API Layer                            │
│  Mobile-specific Endpoints | Authentication            │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│                  Backend Services                       │
│  Stock Updates | Transaction Recording | Validation    │
└────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. POS Transaction

A **POS Transaction** represents a direct cash sale to a customer.

**Transaction Flow**:
1. **Product Selection**: Scan or search products
2. **Cart Management**: Add/remove items, adjust quantities
3. **Apply Discounts**: Line-item or total discounts
4. **Payment**: Collect payment (cash, card, etc.)
5. **Receipt**: Print or email receipt
6. **Post Transaction**:
   - Reduce inventory
   - Record sale
   - Post GL entries (DR Cash, CR Revenue, DR COGS, CR Inventory)

**Key Attributes**:
- **Transaction Number**: Unique identifier
- **Transaction Date**: When sale occurred
- **Customer**: Optional customer reference
- **Items**: Products sold with quantities and prices
- **Subtotal**: Sum of line items
- **Discount**: Total discount applied
- **Tax**: Sales tax amount
- **Total**: Final amount
- **Payment Method**: How customer paid
- **Status**: Draft, Completed, Voided

### 2. POS Station

A **POS Station** represents a physical checkout terminal.

**Key Features**:
- Assigned to specific warehouse
- Configured payment methods
- Receipt printer setup
- Barcode scanner integration
- Cash drawer integration (optional)
- Default tax rate
- Session management (open/close)

### 3. Mobile Picking Workflow

**Picking** is the warehouse process of collecting items for delivery.

**Workflow**:
```
1. View Assigned Picks
2. Select Delivery Note
3. Navigate to Item Location
4. Scan Item Barcode
5. Scan Location Barcode
6. Enter Quantity Picked
7. Confirm Pick
8. Repeat for All Items
9. Complete Delivery Note
```

**Mobile Features**:
- Item-by-item picking
- Location navigation
- Quantity validation
- Barcode verification
- Real-time progress tracking
- Exception handling (short picks)

### 4. Mobile GRN Receiving

**GRN Receiving** is the process of checking in goods from suppliers.

**Workflow**:
```
1. View Pending GRNs
2. Select GRN
3. For Each Box:
   - Scan Box Barcode
   - For Each Item in Box:
     - Scan Item Barcode
     - Enter Quantity Received
     - Enter Quantity Damaged (if any)
     - Take Photo of Damage (if any)
   - Confirm Box
4. Submit GRN for Approval
```

**Mobile Features**:
- Multi-box receiving
- Camera integration for photos
- Offline draft capability
- Damage documentation
- Real-time quantity tracking

## Database Schema

### POS Tables

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
  created_at TIMESTAMPTZ DEFAULT now()
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
  payment_reference VARCHAR,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  voided_at TIMESTAMPTZ,
  voided_by UUID REFERENCES users(id)
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

### Mobile-Specific Tables

Mobile app primarily uses existing tables (delivery_notes, grns, etc.) but with mobile-optimized endpoints.

## API Reference

### POS Endpoints

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
    }
  ],
  "payment_method": "cash",
  "payment_reference": "Cash payment",
  "notes": "Customer paid exact change"
}
```

**Effect**:
1. Creates transaction record
2. **Reduces inventory** for all items
3. Creates stock transactions
4. **Posts GL entries**:
   ```
   DR  Cash                     Total Amount
     CR  Sales Revenue                Subtotal - Discount
     CR  Sales Tax Payable            Tax Amount

   DR  Cost of Goods Sold      COGS Total
     CR  Inventory                    COGS Total
   ```
5. Generates receipt

#### GET /api/pos/transactions
List POS transactions.

**Permissions**: `view` on `pos_transactions`

**Query Parameters**:
- `start_date`, `end_date`
- `pos_station_id`
- `customer_id`
- `payment_method`

#### GET /api/pos/transactions/[id]
Get transaction details.

**Permissions**: `view` on `pos_transactions`

**Response**:
```json
{
  "id": "uuid",
  "transaction_number": "POS-2025-001",
  "transaction_date": "2025-06-14T14:30:00Z",
  "customer": { "name": "John Doe" },
  "items": [
    {
      "item": "Widget ABC",
      "quantity": 2,
      "unit_price": 10.50,
      "line_total": 21.00
    }
  ],
  "subtotal": 21.00,
  "discount_amount": 0,
  "tax_amount": 1.89,
  "total_amount": 22.89,
  "payment_method": "cash"
}
```

#### POST /api/pos/transactions/[id]/void
Void POS transaction.

**Permissions**: `delete` on `pos_transactions`

**Effect**:
1. Status changes to 'voided'
2. **Reverses inventory** deduction
3. **Reverses GL entries**
4. Records who voided and when

#### POST /api/pos/transactions/[id]/receipt
Generate receipt (PDF or print).

**Permissions**: `view` on `pos_transactions`

**Response**:
```json
{
  "receipt_url": "https://...receipt.pdf",
  "receipt_html": "<html>...</html>"
}
```

### Mobile Endpoints

#### GET /api/mobile/delivery-notes/pending
Get delivery notes pending picking.

**Permissions**: `view` on `delivery_notes`

**Response**:
```json
{
  "delivery_notes": [
    {
      "id": "uuid",
      "delivery_number": "DN-001",
      "customer": "Acme Corp",
      "status": "picking",
      "items_count": 5,
      "items_picked": 2,
      "priority": "high"
    }
  ]
}
```

#### POST /api/mobile/delivery-notes/[id]/pick-item
Record item picked.

**Permissions**: `edit` on `delivery_notes`

**Request**:
```json
{
  "delivery_note_item_id": "uuid",
  "quantity_picked": 50,
  "location_barcode": "A-01-01",
  "item_barcode": "123456789"
}
```

**Validation**:
- Barcode matches expected item
- Location matches expected location
- Quantity doesn't exceed required

#### POST /api/mobile/grns/[id]/receive-box
Receive GRN box on mobile.

**Permissions**: `edit` on `grns`

**Request**:
```json
{
  "box_number": 1,
  "box_barcode": "BOX-001",
  "items": [
    {
      "item_id": "uuid",
      "item_barcode": "123456789",
      "quantity_received": 50,
      "quantity_damaged": 2,
      "damage_photos": ["data:image/jpeg;base64,..."],
      "notes": "Corner of box crushed"
    }
  ]
}
```

#### GET /api/mobile/items/search
Search items for mobile (autocomplete).

**Permissions**: `view` on `items`

**Query Parameters**:
- `q` - Search term (code or name)
- `limit` - Results limit

**Response**:
```json
{
  "items": [
    {
      "id": "uuid",
      "code": "ITEM-001",
      "name": "Widget ABC",
      "barcode": "123456789",
      "on_hand": 150,
      "location": "A-01-01"
    }
  ]
}
```

## Services

### POS Posting Service

```typescript
// Location: src/services/accounting/posPosting.ts

class POSPostingService {
  /**
   * Post POS transaction to accounting
   * DR  Cash
   * CR  Sales Revenue
   * DR  COGS
   * CR  Inventory
   */
  async postPOSTransaction(transactionId: string): Promise<void> {
    const transaction = await getPOSTransaction(transactionId)

    // Calculate COGS
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
}
```

### POS Stock Service

```typescript
// Location: src/services/pos/posStockService.ts

class POSStockService {
  /**
   * Reduce inventory for POS transaction
   */
  async reduceStock(transactionId: string): Promise<void> {
    const transaction = await getPOSTransaction(transactionId)

    for (const item of transaction.items) {
      // Convert to base unit
      const baseQuantity = convertToBaseUnit(item.quantity, item.unit_id)

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
}
```

## Mobile App Structure

### App Location
```
apps/mobile/                # React Native Expo app
  ├── app/                  # Expo Router app directory
  │   ├── (tabs)/           # Tab navigation
  │   │   ├── index.tsx     # Home/Dashboard
  │   │   ├── picking.tsx   # Picking list
  │   │   ├── receiving.tsx # GRN receiving list
  │   │   └── profile.tsx   # User profile
  │   ├── picking/
  │   │   └── [id].tsx      # Pick delivery note detail
  │   ├── receiving/
  │   │   └── [id].tsx      # Receive GRN detail
  │   └── _layout.tsx       # Root layout
  ├── components/           # Reusable mobile components
  ├── services/             # API service layer
  ├── hooks/                # Custom hooks
  └── assets/               # Images, fonts, etc.
```

### Key Mobile Features

#### Barcode Scanning
```typescript
import { Camera } from 'expo-camera'

function BarcodeScannerScreen() {
  const [hasPermission, setHasPermission] = useState(null)

  const handleBarCodeScanned = ({ type, data }) => {
    // Process scanned barcode
    console.log(`Bar code ${data} has been scanned!`)
    // Look up item by barcode
    // Add to pick list / receive list
  }

  return (
    <Camera
      onBarCodeScanned={handleBarCodeScanned}
      style={StyleSheet.absoluteFillObject}
    />
  )
}
```

#### Camera for Damage Photos
```typescript
import { Camera } from 'expo-camera'

function DamagePhotoCapture() {
  const [camera, setCamera] = useState(null)

  const takePicture = async () => {
    if (camera) {
      const photo = await camera.takePictureAsync({
        quality: 0.8,
        base64: true
      })
      // Upload photo or store locally
      return photo.base64
    }
  }

  return <Camera ref={setCamera} />
}
```

## Workflows

### Workflow 1: POS Sale

1. Cashier opens POS interface
2. Scans or searches for items
3. Adds items to cart
4. Applies discounts if applicable
5. Reviews cart total
6. Selects payment method
7. Collects payment from customer
8. System:
   - Reduces inventory
   - Records transaction
   - Posts GL entries
   - Generates receipt
9. Prints/emails receipt to customer

### Workflow 2: Mobile Picking

1. Warehouse worker opens mobile app
2. Views list of delivery notes pending picking
3. Selects delivery note to pick
4. For each item:
   - Navigates to item location
   - Scans location barcode (validates correct location)
   - Scans item barcode (validates correct item)
   - Enters quantity picked
   - Confirms pick
5. Repeats for all items
6. Reviews pick summary
7. Completes delivery note
8. System marks delivery note as ready for dispatch

### Workflow 3: Mobile GRN Receiving

1. Warehouse worker opens mobile app
2. Views list of pending GRNs
3. Selects GRN to receive
4. For each box:
   - Scans box barcode
   - For each item in box:
     - Scans item barcode
     - Enters quantity received
     - If damaged:
       - Enters quantity damaged
       - Takes photo of damage
       - Adds notes
   - Confirms box
5. Reviews total received quantities
6. Submits GRN for approval
7. Supervisor approves GRN on desktop
8. Purchase receipt created and posted

## UI Components

### POS Components

#### POSInterface
**Location**: `src/app/pos/page.tsx`
- Product search and scanning
- Cart management
- Payment processing
- Receipt generation

#### POSCart
**Location**: `src/components/pos/POSCart.tsx`
- Display cart items
- Quantity adjustments
- Remove items
- Apply discounts

#### POSPayment
**Location**: `src/components/pos/POSPayment.tsx`
- Payment method selection
- Amount entry
- Change calculation
- Process payment

### Mobile Components

#### PickingList
**Location**: `apps/mobile/app/(tabs)/picking.tsx`
- List delivery notes
- Filter by status
- Navigate to detail

#### PickingDetail
**Location**: `apps/mobile/app/picking/[id].tsx`
- Show items to pick
- Barcode scanning
- Quantity entry
- Progress tracking

#### GRNReceivingDetail
**Location**: `apps/mobile/app/receiving/[id].tsx`
- Multi-box receiving
- Item scanning
- Photo capture
- Submit for approval

## Troubleshooting

### Issue: POS inventory not updating
**Symptoms**: Stock levels don't decrease after POS sale
**Solution**:
1. Check POS stock service called
2. Verify warehouse assigned to POS station
3. Check stock transaction created
4. Review error logs

### Issue: Mobile barcode scanner not working
**Symptoms**: Camera not opening or barcodes not scanned
**Solution**:
1. Check camera permissions granted
2. Verify device camera works
3. Test barcode format (QR, EAN, UPC, etc.)
4. Check lighting conditions
5. Update Expo Camera library

### Issue: Mobile app offline mode issues
**Symptoms**: App crashes when offline
**Solution**:
1. Implement proper offline detection
2. Queue operations for when online
3. Show offline indicator
4. Cache necessary data locally

## Related Documentation

- **POS Accounting Integration**: `docs/plans/pos-accounting-integration.md`
- **Mobile Van Sales**: `docs/mobile-van-sales.md`
- **Mobile Expo Migration**: `docs/plans/mobile-expo-migration-plan.md`
- **Tablet Warehouse Implementation**: `docs/plans/TABLET_WAREHOUSE_IMPLEMENTATION_PLAN.md`

## Future Enhancements

- **Offline Mode**: Full offline capability with sync
- **Loyalty Program**: Customer rewards and points
- **Multi-tender Payments**: Split payments across methods
- **Gift Cards**: Digital gift card support
- **Returns**: POS return processing
- **Employee Performance**: Track sales by cashier
- **Shift Management**: Cash drawer opening/closing
- **Mobile Inventory Counts**: Cycle counting on mobile
- **Mobile Stock Adjustments**: Field adjustments
- **Push Notifications**: Alert workers of new picks
