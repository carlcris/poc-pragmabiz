# Inventory Management Module

## Overview

The Inventory Management module is a comprehensive multi-warehouse inventory tracking system with location-level stock management, real-time transaction tracking, multiple units of measure, and automatic reorder management. It serves as the foundation for all stock-related operations across sales, purchasing, and manufacturing.

## Key Features

- **Multi-warehouse** inventory tracking
- **Location-level** stock management
- **Multiple units of measure** per item with conversions
- **Real-time** stock transactions
- **Reserved vs available** stock calculations
- **Stock aging** and valuation reports
- **Automatic reorder** alerts
- **Barcode/QR code** support
- **Batch tracking** for perishables
- **Stock adjustments** with approval workflow
- **Inter-warehouse transfers**
- **Stock requisitions** for internal requests

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Presentation Layer                     │
│  Item Master UI | Warehouse UI | Stock Transaction UI    │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                   Application Layer                       │
│  API Routes | Inventory Services | Stock Validation      │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                 Transaction Layer (RPC)                   │
│  Stock Adjustments | Transfers | Reservations            │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                      Data Layer                           │
│  Items | Warehouses | Stock Transactions | Ledger        │
└──────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Item Master

The **Item** is the central entity representing a product or material in the system.

**Key Attributes**:
- **Code**: Unique item identifier (SKU)
- **Name**: Product name
- **Description**: Detailed description
- **Category**: Product categorization
- **Unit Options**: Multiple units of measure (base + conversions)
- **Purchase Price**: Last/average purchase cost (runtime calculation)
- **Selling Price**: Standard selling price
- **Reorder Point**: Minimum stock threshold
- **Maximum Stock Level**: Maximum stock to maintain
- **Is Active**: Enable/disable item

**Unit Options**:
Each item can have multiple unit options (e.g., box, piece, dozen) with conversion factors to the base unit.

```typescript
// Example: Item with multiple units
Item: "Widget ABC"
  Base Unit: "piece"
  Unit Options:
    - Piece: 1 piece (base)
    - Box: 12 pieces
    - Carton: 144 pieces (12 boxes)
```

### 2. Warehouse

A **Warehouse** represents a physical storage location where inventory is held.

**Key Attributes**:
- **Code**: Unique warehouse identifier
- **Name**: Warehouse name
- **Locations**: Sub-locations within warehouse
- **Is Active**: Enable/disable warehouse

**Warehouse Locations**:
Each warehouse can have multiple storage locations (aisles, shelves, bins) for granular stock tracking.

```typescript
// Example: Warehouse structure
Warehouse: "Main Warehouse"
  Locations:
    - A-01-01 (Aisle A, Row 01, Bin 01)
    - A-01-02
    - B-01-01
    - Default (fallback location)
```

### 3. Stock Levels

Stock is tracked at multiple levels of granularity:

```
Company Level
  └─ Warehouse Level (item_warehouse table)
      └─ Batch Level (item_batches table)
          └─ Location Split Level (item_batch_locations table)
```

**Stock Metrics**:
- **On Hand**: Physical quantity in warehouse
- **Available**: On hand - reserved
- **Reserved**: Allocated to sales orders/delivery notes
- **In Transit**: Being transferred between warehouses
- **Reorder Quantity**: On hand below reorder point

### 4. Stock Transactions

Every stock movement is recorded as a **Stock Transaction** for full audit trail and stock ledger reporting.

**Transaction Types**:
- `purchase_receipt` - Goods received from suppliers
- `sales_delivery` - Goods shipped to customers
- `stock_adjustment` - Manual adjustments (count, damage, etc.)
- `stock_transfer` - Inter-warehouse movement
- `transformation` - Manufacturing consumption/production
- `initial_stock` - Opening balances
- `pos_sale` - POS transactions

**Transaction Fields**:
- **Item**: Item reference
- **Warehouse**: Warehouse reference
- **Location**: Location reference (optional)
- **Quantity**: Amount (positive = in, negative = out)
- **Unit**: Unit of measure used
- **Transaction Type**: Type from list above
- **Reference**: Document reference (PO, SO, adjustment ID, etc.)
- **Cost**: Unit cost (for valuation)
- **Transaction Date**: When it occurred
- **Created By**: User who created it

### 5. Stock Valuation

Stock transaction costs are tracked independently from sales pricing. The stock valuation report values on-hand inventory using the configured inventory `default_pricing_tier` item price, falling back to the item sales price and then purchase price when no active default-tier price exists.

The costing model for stock receipts remains **moving average cost**:

```
New Average Cost = (
  (Current On Hand × Current Avg Cost) + (Received Qty × Purchase Cost)
) / (Current On Hand + Received Qty)
```

**Important**: As of June 2025, item cost is calculated at **runtime from purchase_receipts** rather than stored in the items table.

## Database Schema

### Core Tables

#### items
```sql
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  code VARCHAR UNIQUE NOT NULL,
  supplier_code VARCHAR(100),
  name VARCHAR NOT NULL,
  description TEXT,
  category_id UUID REFERENCES item_categories(id),
  base_unit_id UUID REFERENCES units_of_measure(id),
  selling_price DECIMAL(12,2),
  reorder_point DECIMAL(12,3),
  max_stock_level DECIMAL(12,3),
  is_active BOOLEAN DEFAULT true,
  barcode VARCHAR,
  qr_code VARCHAR,
  image_url VARCHAR,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Note: cost_price field was DROPPED in migration 20260610101000_drop_items_cost_price.sql
-- Cost is now calculated at runtime from purchase_receipts
-- supplier_code stores an optional supplier-provided item reference.
-- custom_fields stores editable key/value metadata displayed on the item detail page.
```

#### item_unit_options
```sql
CREATE TABLE item_unit_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units_of_measure(id),
  conversion_factor DECIMAL(12,4) NOT NULL,  -- To base unit
  is_base_unit BOOLEAN DEFAULT false,
  barcode VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, unit_id)
);
```

#### units_of_measure
```sql
CREATE TABLE units_of_measure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR UNIQUE NOT NULL,
  abbreviation VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### item_categories
```sql
CREATE TABLE item_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name VARCHAR NOT NULL,
  parent_id UUID REFERENCES item_categories(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### warehouses
```sql
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  code VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### warehouse_locations
```sql
CREATE TABLE warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  code VARCHAR NOT NULL,
  name VARCHAR,
  aisle VARCHAR,
  row VARCHAR,
  bin VARCHAR,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(warehouse_id, code)
);
```

#### item_warehouse
```sql
CREATE TABLE item_warehouse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  on_hand DECIMAL(12,3) DEFAULT 0,
  reserved DECIMAL(12,3) DEFAULT 0,
  available DECIMAL(12,3) GENERATED ALWAYS AS (on_hand - reserved) STORED,
  last_purchase_price DECIMAL(12,2),
  average_cost DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, warehouse_id)
);
```

#### item_batches
```sql
CREATE TABLE item_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  batch_code TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  on_hand DECIMAL(12,3) DEFAULT 0,
  reserved DECIMAL(12,3) DEFAULT 0,
  available DECIMAL(12,3) GENERATED ALWAYS AS (on_hand - reserved) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, warehouse_id, batch_code)
);
```

#### item_batch_locations
```sql
CREATE TABLE item_batch_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  location_id UUID REFERENCES warehouse_locations(id) ON DELETE CASCADE,
  item_batch_id UUID REFERENCES item_batches(id) ON DELETE CASCADE,
  batch_location_sku VARCHAR(10) UNIQUE,
  on_hand DECIMAL(12,3) DEFAULT 0,
  reserved DECIMAL(12,3) DEFAULT 0,
  available DECIMAL(12,3) GENERATED ALWAYS AS (on_hand - reserved) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, warehouse_id, location_id, item_batch_id)
);
```

#### stock_transactions
```sql
CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  item_id UUID REFERENCES items(id),
  warehouse_id UUID REFERENCES warehouses(id),
  location_id UUID REFERENCES warehouse_locations(id),
  quantity DECIMAL(12,3) NOT NULL,  -- Positive = in, Negative = out
  unit_id UUID REFERENCES units_of_measure(id),
  transaction_type VARCHAR NOT NULL,
  reference_type VARCHAR,  -- 'purchase_receipt', 'sales_order', etc.
  reference_id UUID,
  cost DECIMAL(12,2),
  transaction_date TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### stock_adjustments
```sql
CREATE TABLE stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  warehouse_id UUID REFERENCES warehouses(id),
  adjustment_date TIMESTAMPTZ DEFAULT now(),
  reason VARCHAR NOT NULL,  -- 'count', 'damage', 'theft', 'other'
  notes TEXT,
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'posted'
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### stock_adjustment_items
```sql
CREATE TABLE stock_adjustment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  item_batch_location_id UUID REFERENCES item_batch_locations(id),
  current_qty DECIMAL(20,4),
  adjusted_qty DECIMAL(20,4),
  difference DECIMAL(20,4),
  uom_id UUID REFERENCES units_of_measure(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### stock_transfers
```sql
CREATE TABLE stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  from_warehouse_id UUID REFERENCES warehouses(id),
  to_warehouse_id UUID REFERENCES warehouses(id),
  transfer_date TIMESTAMPTZ DEFAULT now(),
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'in_transit', 'completed'
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### stock_transfer_lines
```sql
CREATE TABLE stock_transfer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID REFERENCES stock_transfers(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  from_location_id UUID REFERENCES warehouse_locations(id),
  to_location_id UUID REFERENCES warehouse_locations(id),
  quantity DECIMAL(12,3) NOT NULL,
  unit_id UUID REFERENCES units_of_measure(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### stock_requests
```sql
CREATE TABLE stock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  requesting_warehouse_id UUID REFERENCES warehouses(id),
  supplying_warehouse_id UUID REFERENCES warehouses(id),
  request_date TIMESTAMPTZ DEFAULT now(),
  status VARCHAR DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'fulfilled'
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### stock_request_items
```sql
CREATE TABLE stock_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_request_id UUID REFERENCES stock_requests(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  requested_qty DECIMAL(20,4) NOT NULL,
  item_unit_option_id UUID REFERENCES item_unit_options(id),
  selected_item_batch_id UUID REFERENCES item_batches(id), -- optional source batch preference
  uom_id UUID REFERENCES units_of_measure(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### stock_requisitions
```sql
CREATE TABLE stock_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  warehouse_id UUID REFERENCES warehouses(id),
  requisition_date TIMESTAMPTZ DEFAULT now(),
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'submitted', 'approved', 'in_load_list'
  notes TEXT,
  load_list_id UUID REFERENCES load_lists(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### reorder_rules
```sql
CREATE TABLE reorder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  reorder_point DECIMAL(12,3) NOT NULL,
  max_stock_level DECIMAL(12,3),
  reorder_quantity DECIMAL(12,3),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, warehouse_id)
);
```

## API Reference

### Item Management

#### GET /api/items
List all items with pagination and filtering.

**Permissions**: `view` on `items`

**Cost Contract**: Item API request and response payloads use `purchasePrice`.

**Query Parameters**:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `search` - Search by code/name
- `category_id` - Filter by category
- `is_active` - Filter active/inactive

**Response**:
```json
{
  "items": [
    {
      "id": "uuid",
      "code": "ITEM-001",
      "name": "Widget ABC",
      "description": "High-quality widget",
      "category": { "id": "uuid", "name": "Widgets" },
      "base_unit": { "id": "uuid", "name": "piece" },
      "selling_price": 10.50,
      "reorder_point": 100,
      "max_stock_level": 500,
      "is_active": true,
      "unit_options": [
        { "unit": "piece", "conversion_factor": 1, "is_base_unit": true },
        { "unit": "box", "conversion_factor": 12, "is_base_unit": false }
      ]
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

#### POST /api/items
Create a new item.

**Permissions**: `create` on `items`

**Request**:
```json
{
  "code": "ITEM-002",
  "name": "New Widget",
  "description": "Description here",
  "category_id": "uuid",
  "base_unit_id": "uuid",
  "selling_price": 15.00,
  "reorder_point": 50,
  "max_stock_level": 300,
  "unit_options": [
    { "unit_id": "uuid-piece", "conversion_factor": 1, "is_base_unit": true },
    { "unit_id": "uuid-box", "conversion_factor": 12 }
  ]
}
```

#### GET /api/items/[id]
Get item details.

**Permissions**: `view` on `items`

**Response**:
```json
{
  "id": "uuid",
  "code": "ITEM-001",
  "name": "Widget ABC",
  "customFields": {
    "color": "Black",
    "frame_size": "8x10"
  },
  "stock_levels": [
    {
      "warehouse": { "id": "uuid", "name": "Main Warehouse" },
      "on_hand": 150,
      "reserved": 25,
      "available": 125,
      "locations": [
        { "location": "A-01-01", "on_hand": 75 },
        { "location": "A-01-02", "on_hand": 75 }
      ]
    }
  ],
  "recent_transactions": [...]
}
```

The item detail page displays `customFields` as editable key/value rows for users with `edit` permission on `items`.

#### PUT /api/items/[id]/custom-fields
Add or update one custom field for an item. This endpoint owns item custom-field mutations rather than the general item update endpoint.
Custom-field writes are handled by DB RPCs that lock the item row before changing `custom_fields`, so concurrent edits do not replace unrelated fields.

**Permissions**: `edit` on `items`

**Request**:
```json
{
  "key": "color",
  "value": "Black",
  "originalKey": "old_color"
}
```

`originalKey` is optional and is used when renaming an existing field.

#### DELETE /api/items/[id]/custom-fields
Delete one custom field from an item.

**Permissions**: `edit` on `items`

**Query Parameters**:
- `key` - Custom field key to delete

#### PUT /api/items/[id]
Update item details.

**Permissions**: `edit` on `items`

#### DELETE /api/items/[id]
Delete (deactivate) item.

**Permissions**: `delete` on `items`

### Warehouse Management

#### GET /api/warehouses
List all warehouses.

**Permissions**: `view` on `warehouses`

**Response**:
```json
{
  "warehouses": [
    {
      "id": "uuid",
      "code": "WH-001",
      "name": "Main Warehouse",
      "address": "123 Main St",
      "is_active": true,
      "locations": [
        { "id": "uuid", "code": "A-01-01", "name": "Aisle A, Row 1, Bin 1" }
      ]
    }
  ]
}
```

#### POST /api/warehouses
Create new warehouse.

**Permissions**: `create` on `warehouses`

#### GET /api/warehouses/[id]/inventory
Get all inventory in a warehouse.

**Permissions**: `view` on `warehouses`

**Response**:
```json
{
  "inventory": [
    {
      "item": { "id": "uuid", "code": "ITEM-001", "name": "Widget ABC" },
      "on_hand": 150,
      "reserved": 25,
      "available": 125,
      "average_cost": 8.50,
      "value": 1275.00
    }
  ],
  "total_value": 125000.00
}
```

### Stock Adjustments

#### POST /api/stock-adjustments
Create stock adjustment (draft).

**Permissions**: `create` on `stock_adjustments`

**Request**:
```json
{
  "warehouse_id": "uuid",
  "adjustment_date": "2025-06-14",
  "reason": "count",
  "notes": "Monthly physical count",
  "items": [
    {
      "itemId": "uuid",
      "itemBatchLocationId": "uuid",
      "currentQty": 100,
      "adjustedQty": 95,
      "uomId": "uuid",
      "unitCost": 12.5
    }
  ]
}
```

Each adjustment line must select an `item_batch_locations` row. The selector is server-filtered by item, warehouse, optional location, and batch/QR search text. The selected batch-location row supplies the current quantity and QR label metadata.

#### POST /api/stock-adjustments/[id]/post
Post stock adjustment (apply to inventory).

**Permissions**: `edit` on `stock_adjustments`

**Process**:
1. Validates all lines
2. Calls the transactional `post_stock_adjustment` RPC
3. Creates stock transactions for adjustments
4. Updates item_warehouse, item_batches, and item_batch_locations balances for the selected batch-location rows
5. Marks adjustment as posted
6. Records posting user and timestamp

Stock adjustment lines can reprint a batch QR label using the same QR payload and PDF label generator as GRN box labels. The printed label uses the selected batch code, batch-location SKU, item details, adjusted quantity, warehouse, and location metadata.

### Stock Transfers

#### POST /api/stock-transfers
Create stock transfer.

**Permissions**: `create` on `stock_transfers`

**Request**:
```json
{
  "from_warehouse_id": "uuid",
  "to_warehouse_id": "uuid",
  "transfer_date": "2025-06-14",
  "lines": [
    {
      "item_id": "uuid",
      "from_location_id": "uuid",
      "to_location_id": "uuid",
      "quantity": 50,
      "unit_id": "uuid"
    }
  ]
}
```

#### POST /api/stock-transfers/[id]/complete
Complete transfer (update inventory).

**Permissions**: `edit` on `stock_transfers`

### Stock Requests

#### POST /api/stock-requests
Create stock replenishment request.

**Permissions**: `create` on `stock_requests`

**Request**:
```json
{
  "requesting_warehouse_id": "uuid",
  "fulfilling_warehouse_id": "uuid",
  "items": [
    {
      "item_id": "uuid",
      "requested_qty": 100,
      "item_unit_option_id": "uuid",
      "selected_item_batch_id": "uuid-or-null",
      "uom_id": "uuid"
    }
  ]
}
```

`selected_item_batch_id` is optional. When provided, the API validates that the batch belongs to the requested item and fulfilling warehouse and has enough available base quantity for the line. Downstream pick-list allocation treats the selected batch as authoritative: it allocates from that batch instead of FIFO, and insufficient selected-batch quantity fails the operation rather than opening the FIFO batch-allocation choice.

#### POST /api/stock-requests/[id]/approve
Approve stock request.

**Permissions**: `approve_stock_requests` capability

#### POST /api/stock-requests/[id]/reject
Reject stock request.

**Permissions**: `approve_stock_requests` capability

#### POST /api/stock-requests/[id]/fulfill
Fulfill stock request (create transfer).

**Permissions**: `edit` on `stock_requests`

### Reorder Management

#### GET /api/reorder/alerts
Get items below reorder point.

**Permissions**: `view` on `reorder_management`

**Response**:
```json
{
  "alerts": [
    {
      "item": { "id": "uuid", "code": "ITEM-001", "name": "Widget ABC" },
      "warehouse": { "id": "uuid", "name": "Main Warehouse" },
      "on_hand": 45,
      "reorder_point": 100,
      "reorder_quantity": 55,
      "max_stock_level": 300
    }
  ]
}
```

#### POST /api/reorder/rules
Create/update reorder rule.

**Permissions**: `create` on `reorder_management`

## Services

### Stock Transaction Service

```typescript
// Location: src/services/inventory/stockTransactionService.ts

class StockTransactionService {
  // Record stock transaction
  async createTransaction(data: {
    itemId: string
    warehouseId: string
    locationId?: string
    quantity: number  // Positive = in, Negative = out
    unitId: string
    transactionType: string
    referenceType?: string
    referenceId?: string
    cost?: number
    transactionDate?: Date
    notes?: string
  }): Promise<StockTransaction>

  // Get stock ledger for item
  async getItemLedger(
    itemId: string,
    warehouseId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<StockTransaction[]>

  // Get stock value
  async getStockValuation(warehouseId?: string): Promise<{
    items: Array<{ item: Item; quantity: number; value: number }>
    total: number
  }>
}
```

### Location Service

```typescript
// Location: src/services/inventory/locationService.ts

class LocationService {
  // Adjust stock at location
  async adjustLocationStock(
    itemId: string,
    locationId: string,
    quantity: number,
    reason: string
  ): Promise<void>

  // Get default location for warehouse
  async getDefaultLocation(warehouseId: string): Promise<WarehouseLocation>

  // Move stock between locations
  async moveStock(
    itemId: string,
    fromLocationId: string,
    toLocationId: string,
    quantity: number
  ): Promise<void>
}
```

## Common Workflows

### Workflow 1: Create New Item

1. User navigates to Items page
2. Clicks "Create Item"
3. Fills form with item details
4. Adds unit options (base + conversions)
5. Sets reorder point and max level
6. Submits form
7. API creates item record
8. API creates unit option records
9. User redirected to item detail page

### Workflow 2: Stock Adjustment (Physical Count)

1. User navigates to Stock Adjustments
2. Creates new adjustment for warehouse
3. Adds lines by selecting an item and the exact batch-location row being counted
4. Enters the adjustment quantity
5. System calculates the new batch quantity and variance
6. User can reprint a QR label for the selected batch-location row
7. User reviews variances
8. Posts adjustment
9. System creates stock transactions
10. Updates item_warehouse, item_batches, and item_batch_locations balances
11. Adjustment marked as posted

### Workflow 3: Inter-Warehouse Transfer

1. User creates stock transfer
2. Selects from/to warehouses
3. Adds items with quantities
4. Submits transfer (status: draft)
5. Transfer dispatched (status: in_transit)
6. Receiving warehouse confirms receipt
7. System creates stock transactions:
   - Negative transaction at from_warehouse
   - Positive transaction at to_warehouse
8. Stock levels updated at both warehouses
9. Transfer marked as completed

### Workflow 4: Reorder Alert Response

1. System checks reorder rules daily
2. Identifies items below reorder point
3. Generates reorder alerts
4. Purchasing manager reviews alerts
5. Creates purchase orders for items
6. Purchase orders approved and sent to suppliers
7. Goods received via purchase receipt
8. Stock levels updated
9. Reorder alert cleared

## UI Components

### Key Components

#### ItemList
**Location**: `src/components/inventory/ItemList.tsx`
- Displays paginated item table
- Search and filter by category
- Actions: Create, Edit, View, Delete

#### ItemForm
**Location**: `src/components/inventory/ItemForm.tsx`
- Create/edit item form
- Unit options management
- Image upload
- Validation via Zod schema

#### WarehouseInventory
**Location**: `src/components/inventory/WarehouseInventory.tsx`
- Shows all items in warehouse
- Displays on hand, reserved, available
- Location-level drill-down
- Stock valuation summary

#### StockAdjustmentForm
**Location**: `src/components/inventory/StockAdjustmentForm.tsx`
- Create stock adjustment
- Add adjustment lines with required batch-location selection
- View adjustment header and line-item details from the stock adjustments list
- Reprint selected batch QR labels from editable lines or the read-only details view
- Show variance calculations
- Post adjustment workflow

#### StockTransferForm
**Location**: `src/components/inventory/StockTransferForm.tsx`
- Create transfer between warehouses
- Select from/to locations
- Validate available stock
- Submit and track transfer

#### ReorderAlerts
**Location**: `src/components/inventory/ReorderAlerts.tsx`
- Display items below reorder point
- Create purchase order from alert
- Update reorder rules

## Reports

### Stock Valuation Report
**Location**: `/api/reports/stock-valuation`

Shows total inventory value by warehouse using the configured default pricing tier for item valuation, with sales price and purchase price fallback.

### Stock Aging Report
**Location**: `/api/reports/stock-aging`

Shows how long inventory has been in stock, categorized by age buckets (0-30, 31-60, 61-90, 90+ days).

### Stock Movement Report
**Location**: `/api/reports/stock-movement`

Shows all stock transactions for a date range, grouped by item/warehouse.

### Inventory Report
**Location**: `/api/reports/inventory`

Current stock levels across all warehouses with location details.

## Troubleshooting

### Issue: Stock Discrepancies
**Symptoms**: Stock levels don't match physical count
**Solution**:
1. Run inventory report for warehouse
2. Compare with physical count
3. Create stock adjustment with reason "count"
4. Post adjustment to reconcile

### Issue: Negative Stock
**Symptoms**: Available stock shows negative
**Solution**:
1. Check for excessive reservations
2. Review recent transactions
3. Verify sales orders aren't over-allocated
4. Adjust stock if needed

### Issue: Unit Conversion Errors
**Symptoms**: Quantities don't calculate correctly
**Solution**:
1. Verify conversion factors in item_unit_options
2. Ensure base unit is correctly marked
3. Check that transactions use correct unit_id

## Related Documentation

- **Inventory Module Plan**: `docs/inventory-module-plan.md`
- **Item-Specific UOM Plan**: `docs/item-specific-uom-plan.md`
- **Location Plan**: `docs/plans/inv-location-plan.md`
- **Batch Implementation**: `docs/plans/inv-item-batch-implementation-plan.md`
- **Scalable API Design**: `docs/rules/scalable-api-design-rule.md`

## Migration History

Key inventory-related migrations:

- `20260610100000_use_purchase_price_for_item_cost_runtime.sql` - Purchase price calculation
- `20260610101000_drop_items_cost_price.sql` - Remove stored cost price
- `20260619100000_add_supplier_code_to_items.sql` - Optional supplier item code and item list search/display support
- Earlier migrations for items, warehouses, locations, transactions, adjustments, transfers
