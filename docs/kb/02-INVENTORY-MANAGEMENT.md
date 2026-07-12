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
- **Reorder Point**: Default company-wide minimum stock threshold in the base unit
- **Reorder Quantity**: Default company-wide suggested replenishment quantity in the base unit
- **Maximum Stock Level**: Maximum stock to maintain
- **Is Active**: Enable/disable item

**Unit Options**:
Each item can have multiple unit options (e.g., box, piece, dozen) with conversion factors to the base unit.

**Exports**:
The Item Master export supports CSV, XLSX, and PDF formats. Each export uses the current search,
category, status, warehouse, and business-unit scope filters. Export requests are bounded to 5,000
filtered rows; users must narrow filters before exporting larger result sets. The Item Master list
and export show pending putaway quantity separately from in-transit and available stock.

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

Users with Items view access and the `items.operation.print_batch_qr.view` capability can expand a warehouse location on an item's **Locations** tab and print 1–100 80 mm QR labels for each batch. The user selects an active item unit option, and every label's quantity is that option's `qtyPerUnit`; current batch on-hand is informational and is never divided or changed by printing. Each label and QR payload uses the same item, batch-location SKU, batch, warehouse, and location contract as completed putaway labels.

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
- **Available**: On hand - reserved - pending putaway
- **Reserved**: Allocated to sales orders/delivery notes
- **Putaway**: Physically received or produced stock awaiting final batch/location placement
- **In Transit**: Expected inbound quantity not yet submitted into receiving/putaway
- **Reorder Alert Basis**: Total available stock across all company warehouses compared to the effective item reorder point

Stock-aware item lists subscribe to `item_warehouse` realtime changes. Stock movement screens also subscribe to `stock_transactions` and `stock_transaction_items` realtime changes. Posted stock adjustments, GRN receiving submissions, putaway postings, and other stock movements invalidate the loaded items, item statistics, stock transaction, stock balance, dashboard, and reorder queries so on-hand, reserved, putaway, available, and movement history refresh without leaving the page.

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
  sop NUMERIC(8,2),
  name VARCHAR NOT NULL,
  description TEXT,
  category_id UUID REFERENCES item_categories(id),
  base_unit_id UUID REFERENCES units_of_measure(id),
  sales_price DECIMAL(12,2),
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
-- sop stores an optional item-level numeric value reserved for future use.
-- custom_fields stores editable key/value metadata displayed on the item detail page.
```

The item-level SOP field is nullable, non-negative, and protected by granular permissions. `items.field.sop.view` controls whether item detail/list responses can expose the value. `items.field.sop.edit` controls whether create or update requests may submit the field. SOP currently has no downstream stock, pricing, report, or allocation behavior.

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

#### reorder_seasons
```sql
CREATE TABLE reorder_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Active reorder seasons are selected automatically by the current date. Active seasons with the same priority cannot overlap for the same company.
RLS restricts season rows to the authenticated user's company.

#### reorder_season_item_policies
```sql
CREATE TABLE reorder_season_item_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  season_id UUID REFERENCES reorder_seasons(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  item_unit_option_id UUID REFERENCES item_unit_options(id) ON DELETE SET NULL,
  uom_id UUID REFERENCES units_of_measure(id) NOT NULL,
  qty_per_unit DECIMAL(20,2) NOT NULL,
  reorder_level DECIMAL(20,2) NOT NULL,
  reorder_quantity DECIMAL(20,2) NOT NULL,
  base_reorder_level DECIMAL(20,2) GENERATED ALWAYS AS (reorder_level * qty_per_unit) STORED,
  base_reorder_quantity DECIMAL(20,2) GENERATED ALWAYS AS (reorder_quantity * qty_per_unit) STORED,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season_id, item_id)
);
```

Item defaults live on `items.reorder_level` and `items.reorder_quantity`. If an active season has an active policy for the item, that policy overrides the item defaults. If the seasonal policy is inactive, the system falls back to the item defaults even while the season is active.
Seasonal policies persist the selected item unit option, `uom_id`, and `qty_per_unit` snapshot for display and editing. `reorder_level` and `reorder_quantity` store the user-entered selected-unit quantities. `base_reorder_level` and `base_reorder_quantity` are generated stored columns and are used by alerts, statistics, and requisition defaults.
Reorder reports and dashboard analytics read reorder defaults from `items`, not from `item_warehouse`. Company-wide reorder analytics aggregate stock across all company warehouses and compare the total to the item-level effective reorder point; business-unit context does not narrow these reorder calculations.
The warehouse dashboard low-stock reorder card uses a bounded SQL RPC (`get_warehouse_dashboard_low_stocks`) scoped to the selected business unit. It matches the item list's available-stock low-stock definition and returns only the top low-stock rows needed by the card.
Active reorder alerts create realtime company-level notifications across all warehouses. Acknowledged and resolved reorder alerts do not create notifications, and stale reorder notification rows are removed by the alert sync.
Seasonal policy list responses include the selected unit context and active item units for display: selected unit option, unit label, quantity per unit, generated base quantities, base unit label, and available unit options.
RLS restricts seasonal item policy rows to the authenticated user's company.

#### reorder_alert_acknowledgments
```sql
CREATE TABLE reorder_alert_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  policy_source TEXT NOT NULL,
  season_id UUID REFERENCES reorder_seasons(id) ON DELETE SET NULL,
  reorder_point DECIMAL(20,2) NOT NULL,
  reorder_quantity DECIMAL(20,2) NOT NULL,
  minimum_level DECIMAL(20,2) NOT NULL,
  severity TEXT NOT NULL,
  acknowledged_available_stock DECIMAL(20,2) NOT NULL,
  acknowledged_at TIMESTAMPTZ DEFAULT now(),
  acknowledged_by UUID REFERENCES users(id)
);
```

Reorder alerts are generated from live stock levels, not stored as alert rows. Acknowledgments persist the item, active policy/season, threshold snapshot, severity, and available stock at the time the user acknowledged the alert. Acknowledge and restore RPCs require the caller's authenticated user and company to match the requested write scope.

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
      "sales_price": 10.50,
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
  "sales_price": 15.00,
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
Create stock adjustment (draft) for the current business unit. The UI shows the current business unit's warehouse as read-only context; users do not select a warehouse. The API submits that current-BU warehouse ID to the transactional RPC, and the RPC validates that it belongs to the current business unit before writing the draft.

**Permissions**: `create` on `stock_adjustments`

**Request**:
```json
{
  "adjustmentType": "physical_count",
  "adjustmentDate": "2025-06-14",
  "warehouseId": "uuid",
  "locationId": "uuid",
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

Each adjustment line normally selects an `item_batch_locations` row. The selector is server-filtered by item, the current business unit warehouse, optional location, and batch/QR search text. The selected batch-location row supplies the current quantity and QR label metadata. If no batch-location row exists for the selected item/location, the user can enter a new batch code; saving the draft creates a zero-quantity `item_batches` and `item_batch_locations` record for the current business unit warehouse/location inside the same database transaction as the adjustment header and lines. If any part of the save fails, no manual batch, batch-location, header, or line write remains committed.

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

### Stock Transfers

#### POST /api/stock-requests
Create stock replenishment transfer request.

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

`selected_item_batch_id` is optional. When provided, the API validates that the batch belongs to the requested item and fulfilling warehouse and has enough available base quantity for the line. Downstream pick-list allocation treats the selected batch as authoritative: it allocates from that batch instead of FIFO, and insufficient selected-batch quantity fails the operation.

When the field is null, delivery-note availability and pick-list creation use automatic whole-unit FIFO allocation. Capacity is calculated independently for each FIFO batch-location source as `floor(available base quantity / qty_per_unit)`, so an incomplete remainder is never combined with another source to form one requested unit. A source with 96 base units contributes zero `BOX (144)` units; a source with 150 contributes one box and leaves six base units. Allocation continues through later FIFO sources until the requested unit quantity is covered. Insufficient inventory is reported only when the summed complete-unit capacity, after warehouse reservations and putaway exclusions, is below the requested quantity.

`POST /api/delivery-notes/allocation-availability` accepts a bounded list of up to 100 stock-request item IDs and returns availability in each line's requested unit. `POST /api/delivery-notes` revalidates the same whole-unit capacity while locking the stock-request and inventory rows, then creates the header, sources, lines, and warehouse reservation in one transaction.

The delivery-note creation table displays availability in the stock-request line's unit, for example `100 BOX (144)`. `Qty / Unit` shows the conversion factor, while `Total Qty` shows the current allocated quantity converted to base units. Availability requests are sent in bounded groups of up to 100 stock-request lines; every group must load successfully before allocation controls and delivery-note creation are enabled.

#### POST /api/stock-requests/[id]/approve
Approve stock transfer.

**Permissions**: `approve_stock_requests` capability

#### POST /api/stock-requests/[id]/reject
Reject stock transfer.

**Permissions**: `approve_stock_requests` capability

#### POST /api/stock-requests/[id]/fulfill
Fulfill stock transfer.

**Permissions**: `edit` on `stock_requests`

### Reorder Management

#### GET /api/reorder/alerts
Get items whose total available stock across all company warehouses is below the effective reorder point.

**Permissions**: `view` on `reorder_management`

By default, acknowledged alert conditions are hidden. Passing `acknowledged=true` includes both active and acknowledged conditions. Passing `acknowledged=only` returns acknowledged conditions only.
The `warehouseBreakdown` includes all company warehouses; warehouses without item stock rows are returned with zero stock values.

**Response**:
```json
{
  "data": [
    {
      "itemId": "uuid",
      "itemCode": "ITEM-001",
      "itemName": "Widget ABC",
      "totalAvailableStock": 45,
      "reorderPoint": 100,
      "reorderQuantity": 55,
      "policySource": "season_override",
      "seasonName": "Peak Season",
      "requisitionUomId": "uuid",
      "requisitionUomLabel": "PCS",
      "requisitionItemUnitOptionId": "uuid",
      "requisitionQtyPerUnit": 1,
      "requisitionUnitPrice": 10.5,
      "requisitionUnitPriceCurrency": null,
      "warehouseBreakdown": [
        { "warehouseName": "Main Warehouse", "availableStock": 45 }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 1, "totalPages": 1 }
}
```

#### POST /api/reorder/seasons
Create a date-effective reorder season.

**Permissions**: `create` on `reorder_management`

#### POST /api/reorder/alerts/acknowledge
Persist acknowledgment for selected generated reorder alert IDs.

**Permissions**: `edit` on `reorder_management`

Acknowledgment suppresses the same item/policy/season/severity/stock snapshot from the active alerts list. If the stock level changes, the severity changes, or the effective reorder policy changes, the alert is generated again. Direct RPC calls are bound to the authenticated user and company.

#### POST /api/reorder/alerts/unacknowledge
Restore selected acknowledged reorder alert IDs to the active alerts list.

**Permissions**: `edit` on `reorder_management`

Restoring an alert soft-deletes the matching acknowledgment row for the current generated alert condition, so the alert returns to the active alerts list.

#### POST /api/reorder/season-policies
Create a per-item seasonal reorder override.

**Permissions**: `create` on `reorder_management`

Seasonal policy requests must include `itemUnitOptionId`. Requests store `reorderLevel` and `reorderQuantity` as selected-unit quantities. The API resolves and snapshots `uomId` and `qtyPerUnit`; PostgreSQL generated columns compute `baseReorderLevel` and `baseReorderQuantity`. Responses include `itemUnitOptionId`, `uomId`, `unitOptions`, `reorderUnitLevel`, `reorderUnitQuantity`, `baseReorderLevel`, `baseReorderQuantity`, `unitLabel`, `qtyPerUnit`, `totalQuantity`, and `baseUnitLabel` so the dialog can edit the selected unit while alerts and statistics compare base quantities.

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
2. Creates a new adjustment in the current business unit; the assigned warehouse is shown but cannot be changed
3. Adds lines by selecting an item and the exact batch-location row being counted, or enters a new batch code when no initial batch-location exists
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

1. System selects the active reorder season by effective date and priority
2. System resolves each item's effective reorder level from active seasonal policy or item defaults
3. System compares total available stock across all company warehouses to the effective reorder level
4. Purchasing manager reviews alerts
5. Creates a stock requisition with selected alert items prefilled. Seasonal-policy alerts use the policy unit and selected-unit reorder quantity; item-default alerts use the default item unit.
6. User selects the supplier and submits the stock requisition through the purchasing workflow
7. User may acknowledge an alert to hide the current generated alert condition without changing stock
8. User may review acknowledged alerts and restore them to active alerts
9. Requisition fulfillment is tracked through linked purchasing/load-list workflows
10. Stock levels updated
11. Reorder alert clears when stock reaches the effective reorder level, or reappears when the acknowledged condition changes

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
- Display items below effective reorder point using company-wide available stock
- Display active and acknowledged reorder alerts separately
- Create stock requisition from selected alerts
- Acknowledge and restore generated alert conditions
- Configure reorder seasons and seasonal item overrides

## Reports

### Stock Valuation Report
**Location**: `/api/reports/stock-valuation`

Shows total inventory value by warehouse using the configured default pricing tier for item valuation, with sales price and purchase price fallback.

Requests that would aggregate more than 5,000 source rows are rejected so the report does not perform unbounded database and application work. Narrow the warehouse, item, or category filters before regenerating the report.

### Stock Aging Report
**Location**: `/api/reports/stock-aging`

Shows how long inventory has been in stock, categorized by age buckets (0-30, 31-60, 61-90, 90+ days).

The report applies business-unit scope and rejects requests that would aggregate more than 5,000 source rows. Narrow age bucket, category, or search filters before regenerating the report.

### Stock Movement Report
**Location**: `/api/reports/stock-movement`

Shows all stock transactions for a date range, grouped by item/warehouse.

The report rejects current or comparison periods above 5,000 source transaction rows. Narrow the date range, warehouse, or item filters before regenerating the report.

### Inventory Report
**Location**: `/api/reports/inventory`

Current stock levels across all warehouses with location details.

Normal list calls are capped at 50 rows per page. PDF preview uses `exportMode=pdf` and can include up to 500 matching rows in one preview request.

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
