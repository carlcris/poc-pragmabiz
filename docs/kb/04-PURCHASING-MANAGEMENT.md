# Purchasing Management Module

## Overview

The Purchasing Management module handles the complete procurement workflow from supplier management through goods receipt. It includes purchase orders, purchase receipts, stock requisitions, load lists, and Goods Receipt Notes (GRNs) with multi-box receiving and damaged item tracking.

## Key Features

- **Supplier** master data (company-scoped as of June 2025)
- **Purchase Orders** with approval workflow
- **Purchase Receipts** for tablet-optimized receiving
- **Goods Receipt Notes (GRN)** with multi-box receiving
- **Stock Requisitions** for internal requests
- **Load Lists** consolidating multiple requisitions
- **Damaged Item** tracking and reporting
- **Purchase price** tracking for inventory costing (runtime calculation)
- **Supplier analytics** (spend, outstanding orders, capacity)

## Purchasing Workflow

```
Stock Requisition (Internal Need)
    ↓
Load List (Consolidation)
    ↓
Purchase Order (To Supplier)
    ↓
GRN (Multi-Box Receiving)
    ↓
Purchase Receipt (Inventory Update)
```

## Core Concepts

### 1. Supplier

A **Supplier** (vendor) is an external party from whom the company purchases goods.

**Key Attributes**:
- **Code**: Unique supplier identifier
- **Name**: Supplier business name
- **Contact Information**: Email, phone, address
- **Payment Terms**: Default payment days
- **Company Scoping**: As of June 2025, suppliers are scoped to company_id
- **Is Active**: Enable/disable supplier

**Company Scoping** (June 2025):
Suppliers are now scoped to `company_id` to support multi-tenant scenarios where different companies need separate vendor lists.

### 2. Stock Requisition

A **Stock Requisition** is an internal request for items needed by a warehouse or department.

**Key Features**:
- Created by warehouse managers
- Status workflow: Draft → Submitted → Approved → In Load List
- Can be linked to a load list
- Tracks requested items with quantities
- Approval workflow before procurement

**Workflow**:
1. User creates requisition for needed items
2. Submits for approval
3. Manager reviews and approves/rejects
4. Approved requisitions added to load list

### 3. Load List

A **Load List** consolidates multiple stock requisitions into a single procurement document.

**Key Features**:
- Combines multiple requisitions
- Aggregates quantities for same items
- Status workflow: Draft → Confirmed → Ordered
- Used to create purchase orders
- Optimizes bulk ordering

**Example**:
```
Load List #001
  Requisition A: Widget ABC (50 units)
  Requisition B: Widget ABC (30 units)
  Requisition C: Widget XYZ (100 units)

Consolidated:
  Widget ABC: 80 units total
  Widget XYZ: 100 units total
```

### 4. Purchase Order

A **Purchase Order** is a formal request to a supplier to provide goods at agreed prices.

**Key Features**:
- Linked to load list (optional)
- Status workflow: Draft → Submitted → Approved → Ordered → Completed
- Approval workflow for large orders
- Line-item level tracking
- Expected delivery dates
- Total amount calculations

**Approval Workflow**:
- Orders above threshold require approval
- Approval capability: `approve_purchase_orders`
- Tracks approver and approval timestamp

### 5. Goods Receipt Note (GRN)

A **GRN** documents the receipt of goods from suppliers with multi-box receiving capability.

**Key Features**:
- **Multi-box receiving**: Track items across multiple boxes/containers
- Linked to purchase order
- Box-level item tracking
- Damage tracking per box
- Approval workflow before creating purchase receipt
- Barcode/QR scanning support
- Photo capture for damaged items

**Multi-Box Workflow**:
```
GRN #001 (PO #123)
  Box 1:
    - Widget ABC: 50 units (good)
    - Widget XYZ: 20 units (damaged: 2)
  Box 2:
    - Widget ABC: 50 units (good)
  Box 3:
    - Widget XYZ: 80 units (good)
```

### 6. Purchase Receipt

A **Purchase Receipt** updates inventory based on received goods from GRN.

**Key Features**:
- Created from approved GRN
- Updates warehouse inventory
- Records purchase price per item
- Creates stock transactions
- Updates item cost (moving average)
- Separates good vs damaged items

**Inventory Impact**:
- Increases `on_hand` quantity in warehouse
- Creates positive stock transactions
- Updates item `average_cost` based on purchase price
- Damaged items tracked separately

### 7. Damaged Items

**Damaged Items** tracks defective goods received from suppliers.

**Key Features**:
- Linked to GRN and purchase receipt
- Photo documentation
- Damage reason/description
- Quantity tracking
- Supplier claim processing
- Reporting for supplier quality

## Database Schema

### Core Tables

#### suppliers
```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),  -- Added June 2025
  code VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  contact_person VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  address TEXT,
  payment_terms_days INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Company scoping enforced via RLS policies
```

#### stock_requisitions
```sql
CREATE TABLE stock_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  warehouse_id UUID REFERENCES warehouses(id),
  requisition_number VARCHAR UNIQUE NOT NULL,
  requisition_date TIMESTAMPTZ DEFAULT now(),
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'submitted', 'approved', 'rejected', 'in_load_list'
  notes TEXT,
  load_list_id UUID REFERENCES load_lists(id),  -- Link to load list
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### stock_requisition_lines
```sql
CREATE TABLE stock_requisition_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id UUID REFERENCES stock_requisitions(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  quantity DECIMAL(12,3) NOT NULL,
  unit_id UUID REFERENCES units_of_measure(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### load_lists
```sql
CREATE TABLE load_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  load_list_number VARCHAR UNIQUE NOT NULL,
  load_list_date TIMESTAMPTZ DEFAULT now(),
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'confirmed', 'ordered'
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### load_list_items
```sql
CREATE TABLE load_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_list_id UUID REFERENCES load_lists(id) ON DELETE CASCADE,
  requisition_id UUID REFERENCES stock_requisitions(id),  -- Source requisition
  item_id UUID REFERENCES items(id),
  quantity DECIMAL(12,3) NOT NULL,  -- Aggregated quantity
  unit_id UUID REFERENCES units_of_measure(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### purchase_orders
```sql
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  po_number VARCHAR UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  load_list_id UUID REFERENCES load_lists(id),  -- Optional link
  order_date TIMESTAMPTZ DEFAULT now(),
  expected_delivery_date TIMESTAMPTZ,
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'submitted', 'approved', 'ordered', 'completed', 'cancelled'
  subtotal DECIMAL(12,2),
  tax_amount DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  notes TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### purchase_order_lines
```sql
CREATE TABLE purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  description VARCHAR,
  quantity DECIMAL(12,3) NOT NULL,
  received_quantity DECIMAL(12,3) DEFAULT 0,
  unit_id UUID REFERENCES units_of_measure(id),
  unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### grns (Goods Receipt Notes)
```sql
CREATE TABLE grns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  grn_number VARCHAR UNIQUE NOT NULL,
  purchase_order_id UUID REFERENCES purchase_orders(id),
  supplier_id UUID REFERENCES suppliers(id),
  warehouse_id UUID REFERENCES warehouses(id),
  receipt_date TIMESTAMPTZ DEFAULT now(),
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'approved', 'completed'
  total_boxes INTEGER DEFAULT 0,
  notes TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### grn_boxes
```sql
CREATE TABLE grn_boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID REFERENCES grns(id) ON DELETE CASCADE,
  box_number INTEGER NOT NULL,  -- Box 1, 2, 3, etc.
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(grn_id, box_number)
);
```

#### grn_items
```sql
CREATE TABLE grn_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID REFERENCES grns(id) ON DELETE CASCADE,
  grn_box_id UUID REFERENCES grn_boxes(id) ON DELETE CASCADE,
  po_line_id UUID REFERENCES purchase_order_lines(id),
  item_id UUID REFERENCES items(id),
  quantity_received DECIMAL(12,3) NOT NULL,
  quantity_damaged DECIMAL(12,3) DEFAULT 0,
  unit_id UUID REFERENCES units_of_measure(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### purchase_receipts
```sql
CREATE TABLE purchase_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  receipt_number VARCHAR UNIQUE NOT NULL,
  grn_id UUID REFERENCES grns(id),
  purchase_order_id UUID REFERENCES purchase_orders(id),
  warehouse_id UUID REFERENCES warehouses(id),
  receipt_date TIMESTAMPTZ DEFAULT now(),
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'posted'
  notes TEXT,
  posted_by UUID REFERENCES users(id),
  posted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### purchase_receipt_items
```sql
CREATE TABLE purchase_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_receipt_id UUID REFERENCES purchase_receipts(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  location_id UUID REFERENCES warehouse_locations(id),
  quantity DECIMAL(12,3) NOT NULL,
  unit_id UUID REFERENCES units_of_measure(id),
  unit_cost DECIMAL(12,2) NOT NULL,  -- Purchase price
  total_cost DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### damaged_items
```sql
CREATE TABLE damaged_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID REFERENCES grns(id),
  purchase_receipt_id UUID REFERENCES purchase_receipts(id),
  item_id UUID REFERENCES items(id),
  quantity DECIMAL(12,3) NOT NULL,
  unit_id UUID REFERENCES units_of_measure(id),
  damage_reason VARCHAR,
  description TEXT,
  photo_url VARCHAR,  -- Documentation photo
  supplier_claim_status VARCHAR,  -- 'pending', 'submitted', 'approved', 'rejected'
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## API Reference

### Supplier Management

#### GET /api/suppliers
List all suppliers (company-scoped).

**Permissions**: `view` on `suppliers`

**Response**:
```json
{
  "suppliers": [
    {
      "id": "uuid",
      "code": "SUPP-001",
      "name": "ABC Supplies Inc",
      "email": "contact@abcsupplies.com",
      "phone": "555-1234",
      "payment_terms_days": 30,
      "is_active": true
    }
  ]
}
```

#### POST /api/suppliers
Create new supplier.

**Permissions**: `create` on `suppliers`

**Request**:
```json
{
  "code": "SUPP-002",
  "name": "XYZ Trading Co",
  "contact_person": "John Doe",
  "email": "john@xyztrading.com",
  "phone": "555-5678",
  "address": "123 Main St, City",
  "payment_terms_days": 45
}
```

#### GET /api/suppliers/[id]
Get supplier details with analytics.

**Permissions**: `view` on `suppliers`

**Response**:
```json
{
  "supplier": { "id": "uuid", "name": "ABC Supplies Inc", ... },
  "analytics": {
    "total_spend_ytd": 125000.00,
    "outstanding_pos": 3,
    "outstanding_amount": 15000.00,
    "average_delivery_days": 5
  },
  "recent_orders": [...]
}
```

### Stock Requisition Management

#### POST /api/stock-requisitions
Create stock requisition.

**Permissions**: `create` on `stock_requisitions`

**Request**:
```json
{
  "warehouse_id": "uuid",
  "requisition_date": "2025-06-14",
  "lines": [
    {
      "item_id": "uuid",
      "quantity": 100,
      "unit_id": "uuid",
      "notes": "Urgent - low stock"
    }
  ]
}
```

#### POST /api/stock-requisitions/[id]/submit
Submit requisition for approval.

**Permissions**: `edit` on `stock_requisitions`

**Effect**: Status changes to 'submitted'

#### POST /api/stock-requisitions/[id]/approve
Approve requisition.

**Permissions**: `approve_stock_requisitions` capability

**Effect**: Status changes to 'approved', can be added to load list

#### POST /api/stock-requisitions/[id]/reject
Reject requisition.

**Permissions**: `approve_stock_requisitions` capability

### Load List Management

#### POST /api/load-lists
Create load list from requisitions.

**Permissions**: `create` on `load_lists`

**Request**:
```json
{
  "load_list_date": "2025-06-14",
  "requisition_ids": ["uuid1", "uuid2", "uuid3"],
  "notes": "Weekly procurement"
}
```

**Process**:
1. Validates all requisitions are approved
2. Aggregates items from all requisitions
3. Creates load list with consolidated items
4. Links requisitions to load list

#### POST /api/load-lists/[id]/confirm
Confirm load list.

**Permissions**: `edit` on `load_lists`

**Effect**: Status changes to 'confirmed', ready to create PO

### Purchase Order Management

#### POST /api/purchase-orders
Create purchase order.

**Permissions**: `create` on `purchase_orders`

**Request**:
```json
{
  "supplier_id": "uuid",
  "load_list_id": "uuid",  // Optional
  "order_date": "2025-06-14",
  "expected_delivery_date": "2025-06-21",
  "lines": [
    {
      "item_id": "uuid",
      "quantity": 100,
      "unit_id": "uuid",
      "unit_price": 8.50
    }
  ]
}
```

#### POST /api/purchase-orders/[id]/submit
Submit PO for approval.

**Permissions**: `edit` on `purchase_orders`

**Effect**: Status changes to 'submitted'

#### POST /api/purchase-orders/[id]/approve
Approve purchase order.

**Permissions**: `approve_purchase_orders` capability

**Effect**:
1. Status changes to 'approved'
2. Records approver and timestamp
3. Can be sent to supplier

#### POST /api/purchase-orders/[id]/complete
Mark PO as completed.

**Permissions**: `edit` on `purchase_orders`

**Effect**: Status changes to 'completed' when all items received

### GRN Management

#### POST /api/grns
Create GRN for received goods.

**Permissions**: `create` on `grns`

**Request**:
```json
{
  "purchase_order_id": "uuid",
  "warehouse_id": "uuid",
  "receipt_date": "2025-06-14",
  "total_boxes": 3,
  "boxes": [
    {
      "box_number": 1,
      "items": [
        {
          "po_line_id": "uuid",
          "item_id": "uuid",
          "quantity_received": 50,
          "quantity_damaged": 2,
          "unit_id": "uuid",
          "notes": "Box slightly dented"
        }
      ]
    },
    {
      "box_number": 2,
      "items": [...]
    }
  ]
}
```

#### POST /api/grns/[id]/approve
Approve GRN.

**Permissions**: `approve_grns` capability

**Effect**:
1. Status changes to 'approved'
2. Ready to create purchase receipt
3. Records approver and timestamp

### Purchase Receipt Management

#### POST /api/purchase-receipts
Create purchase receipt from GRN.

**Permissions**: `create` on `purchase_receipts`

**Request**:
```json
{
  "grn_id": "uuid",
  "warehouse_id": "uuid",
  "receipt_date": "2025-06-14",
  "items": [
    {
      "item_id": "uuid",
      "location_id": "uuid",
      "quantity": 100,
      "unit_id": "uuid",
      "unit_cost": 8.50
    }
  ]
}
```

#### POST /api/purchase-receipts/[id]/post
Post purchase receipt (update inventory).

**Permissions**: `edit` on `purchase_receipts`

**Effect**:
1. Status changes to 'posted'
2. **Updates warehouse inventory** (increases on_hand)
3. **Creates stock transactions**
4. **Updates item average cost** (moving average)
5. Updates PO received quantities
6. Records damaged items separately
7. Cannot be edited after posting

**Inventory Update Process**:
```
For each receipt item:
  1. Convert quantity to base unit
  2. Create stock transaction (type: purchase_receipt)
  3. Update item_warehouse.on_hand += quantity
  4. Calculate new average cost:
     new_avg = (current_on_hand * current_avg + received_qty * purchase_price)
               / (current_on_hand + received_qty)
  5. Update item_warehouse.average_cost
```

## Workflows

### Workflow 1: Stock Requisition to Load List

1. Warehouse manager identifies low stock
2. Creates stock requisition with needed items
3. Submits requisition for approval
4. Purchasing manager reviews and approves
5. Requisition marked as 'approved'
6. Multiple approved requisitions accumulated
7. Purchasing creates load list consolidating requisitions
8. Load list aggregates quantities for same items
9. Load list confirmed, ready for PO creation

### Workflow 2: Purchase Order Approval

1. Create PO from load list or manually
2. Add supplier and line items with prices
3. Submit PO for approval
4. If total > threshold, requires approval
5. Approver reviews PO details
6. Approves or rejects with reason
7. If approved, PO sent to supplier
8. System tracks PO status: Ordered → Completed

### Workflow 3: Multi-Box GRN Receiving

1. Goods arrive from supplier (multiple boxes)
2. Warehouse creates GRN linked to PO
3. For each box:
   - Scan/enter box number
   - Scan/enter items in box
   - Record quantities (good + damaged)
   - Take photos of damaged items
   - Add notes
4. Complete GRN with all boxes
5. Submit GRN for approval
6. Supervisor approves GRN
7. Create purchase receipt from approved GRN
8. Post receipt:
   - Inventory updated
   - Costs calculated
   - Damaged items tracked
9. PO updated with received quantities

### Workflow 4: Damaged Item Processing

1. Damaged items identified during GRN
2. Quantity and photos recorded
3. Damage reason documented
4. Purchase receipt separates good vs damaged
5. Good items added to inventory
6. Damaged items tracked in damaged_items table
7. Supplier claim initiated
8. Claim status tracked through resolution

## Services

### Purchase Receipt Service

```typescript
// Location: src/services/purchasing/purchaseReceiptService.ts

class PurchaseReceiptService {
  // Post receipt and update inventory
  async postReceipt(receiptId: string): Promise<void> {
    // 1. Validate receipt
    // 2. For each item:
    //    - Convert to base unit
    //    - Create stock transaction
    //    - Update warehouse stock
    //    - Recalculate average cost
    // 3. Update PO received quantities
    // 4. Handle damaged items
    // 5. Mark receipt as posted
  }

  // Calculate moving average cost
  calculateAverageCost(
    currentOnHand: number,
    currentAvgCost: number,
    receivedQty: number,
    purchasePrice: number
  ): number {
    return (
      (currentOnHand * currentAvgCost + receivedQty * purchasePrice) /
      (currentOnHand + receivedQty)
    )
  }
}
```

## UI Components

### Key Components

#### SupplierList
**Location**: `src/components/purchasing/SupplierList.tsx`

#### StockRequisitionForm
**Location**: `src/components/purchasing/StockRequisitionForm.tsx`

#### LoadListForm
**Location**: `src/components/purchasing/LoadListForm.tsx`
- Select approved requisitions
- Preview consolidated items
- Create load list

#### PurchaseOrderForm
**Location**: `src/components/purchasing/PurchaseOrderForm.tsx`

#### GRNReceivingUI
**Location**: `src/components/purchasing/GRNReceivingUI.tsx`
- Tablet-optimized interface
- Multi-box receiving workflow
- Barcode scanning
- Photo capture for damages

#### PurchaseReceiptForm
**Location**: `src/components/purchasing/PurchaseReceiptForm.tsx`

## Reports

### Supplier Spend Report
**Location**: `/api/analytics/purchasing`

Shows total spending per supplier for a period.

### Outstanding Purchase Orders
**Location**: `/api/reports/purchasing/outstanding-pos`

Lists all POs not yet completed with amounts.

### Damaged Items Report
**Location**: `/api/reports/purchasing/damaged-items`

Shows all damaged items with claim status.

### Purchasing Capacity
**Location**: `/api/analytics/purchasing/capacity`

Shows warehouse receiving capacity and workload.

## Troubleshooting

### Issue: Supplier not found after June 2025
**Symptoms**: Supplier list empty or missing suppliers
**Solution**:
1. Check company_id scoping
2. Verify user's company context
3. Ensure suppliers migrated to new schema
4. Check RLS policies

### Issue: Cannot approve requisition
**Symptoms**: Approval button disabled or permission error
**Solution**:
1. Check user has `approve_stock_requisitions` capability
2. Verify requisition status is 'submitted'
3. Check business unit access

### Issue: GRN quantities don't match PO
**Symptoms**: Validation error on GRN creation
**Solution**:
1. Verify item matching between GRN and PO
2. Check unit conversions
3. Allow over/under receiving if policy permits
4. Document variance in notes

### Issue: Average cost calculation incorrect
**Symptoms**: Item cost doesn't update properly
**Solution**:
1. Check purchase receipt posting logic
2. Verify quantity conversions to base unit
3. Review moving average formula
4. Check for negative stock scenarios

## Related Documentation

- **Purchasing Module Implementation**: `docs/purchasing-module-implementation.md`
- **Inventory Acquisition Workflow**: `docs/inventory-acquisition-workflow-v2.md`
- **Tablet Warehouse Implementation**: `docs/plans/TABLET_WAREHOUSE_IMPLEMENTATION_PLAN.md`
- **Purchase Price Runtime Calculation**: Migration `20260610100000_use_purchase_price_for_item_cost_runtime.sql`
- **Supplier Company Scoping**: Migration `20260611100000_make_suppliers_company_scoped.sql`

## Migration History

Key purchasing-related migrations:

- `20260611100000_make_suppliers_company_scoped.sql` - Company scoping for suppliers
- `20260610100000_use_purchase_price_for_item_cost_runtime.sql` - Runtime cost calculation
- Earlier migrations for suppliers, purchase orders, GRNs, receipts, requisitions, load lists
