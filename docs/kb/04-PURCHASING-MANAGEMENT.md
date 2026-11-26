# Purchasing Management Module

## Overview

The Purchasing Management module handles procurement from supplier management through goods receipt. It includes purchase orders, purchase receipts, stock requisitions, load lists, and Goods Receipt Notes (GRNs) with line-level receiving and damage tracking.

## Key Features

- **Supplier** master data (company-scoped as of June 2025)
- **Purchase Orders** with approval workflow
- **Purchase Receipts** for tablet-optimized receiving
- **Goods Receipt Notes (GRN)** with received quantities, damaged quantities, and carton counts
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
GRN (Receiving)
    ↓
Putaway Station (Warehouse Placement and Labels)
```

### Warehouse Capacity Widget

The Purchasing Overview warehouse-capacity widget measures quantity-based utilization within the
current business unit. Each active, storable location may define a positive `max_capacity`; its used
capacity is the sum of non-deleted on-hand batch-location quantities. The widget totals only
configured locations, classifies them as empty, partially occupied, full, or over capacity, and
reports unconfigured storable locations separately. Selecting a warehouse narrows all totals to
that warehouse. This intentionally assumes stored item quantities use a comparable capacity basis.

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

A **GRN** documents a supplier shipment's received and damaged quantities by load-list line. Receivers can record carton counts and notes during receiving.

**Key Features**:

- Created automatically when the linked load list is marked arrived
- Records received quantities, damaged quantities, and carton counts per line
- Submit-for-confirmation stages received stock into the shared Putaway Station
- Confirmation closes the GRN and marks its load list received
- Putaway Station handles warehouse placement and label printing

### 6. Purchase Receipt

A **Purchase Receipt** updates inventory based on received goods from GRN.

**Key Features**:

- Created from confirmed GRN
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

The header stores the receipt number, linked `load_list_id`, destination `business_unit_id`, workflow status, and receipt audit fields.

#### grn_items

Each line links to the GRN, load-list item, and catalog item. It stores the receiving unit snapshot, `received_qty`, `damaged_qty`, carton count (`num_boxes`), and notes. Putaway tasks and their postings provide the item and batch data for labels.

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

Submitting a stock requisition emails the supplier when application email delivery is enabled and
the supplier has an email address. Set the server environment variable `EMAIL_ENABLED=false` to
disable all application email, including supplier requisitions and test emails. Submission still
succeeds without preparing or sending an email. Delivery is enabled when the variable is `true` or
unset; restart or redeploy the server after changing it. The workflow setting **Send Email
Notifications** does not control this delivery path.

Stock requisition cost fields are protected by granular permissions. The API returns `null` for unit cost and total amount fields when the user does not have the matching stock requisition cost capability. Printed and downloaded stock requisition PDFs also require both the document display setting and the user's cost-view permission before showing Unit Price, line Total, or Total Amount.

The Purchasing > On Order page shows item-level stock requisition quantities still pending from suppliers. It includes submitted and partially fulfilled stock requisition lines in the current business unit where requested quantity is greater than fulfilled quantity. Ordered is the requisition requested quantity, Received is the fulfilled quantity reconciled from approved GRN/accounted receiving, and Outstanding is the remaining supplier quantity. Users can filter by a searchable supplier selector or expected delivery date, and search by supplier, stock requisition number, or item. The supplier selector loads the first 10 suppliers ordered by name and searches suppliers remotely.

The status panel shows counts for **Awaiting Delivery** and **Partially Received**. Each count includes all matching stock requisition lines across pages and reflects the current search, supplier, and delivery date filters. **Awaiting Delivery** is selected when the page opens. Selecting a status opens its first page in the list panel, with lines from the most recently created stock requisitions first. On a narrow screen, the status panel sits above the list.

`GET /api/purchasing/on-order` returns the selected status page and both counts in `statusCounts`. It defaults to `awaiting_delivery` when `status` is omitted and also accepts `partially_received`. The `get_purchase_on_order_status_page` RPC handles filtering, counts, sorting, bounded pagination, and last-page clamping in one call.

#### POST /api/stock-requisitions

Create stock requisition.

**Permissions**: `create` on `stock_requisitions`

**Request**:

```json
{
  "supplierId": "uuid",
  "requisitionDate": "2025-06-14",
  "items": [
    {
      "itemId": "uuid",
      "itemUnitOptionId": "uuid",
      "requestedQty": 100,
      "notes": "Urgent - low stock"
    }
  ]
}
```

Create and draft edit save the header and lines together. Each item and pack option may appear once per requisition. Separate pack options can share a unit of measure. Send the selected `itemUnitOptionId` to distinguish them. A repeated option returns HTTP 400 with `STOCK_REQUISITION_DUPLICATE_PACK`.

#### PATCH /api/stock-requisitions/[id]/status

Sending a requisition uses `{ "status": "submitted" }` and requires `edit` on `stock_requisitions`. Submitted and partially fulfilled lines with outstanding quantities are eligible for load-list linking.

### Load List Management

Load lists are created, edited, and viewed on one full-page layout with three modes: `/purchasing/load-lists/new` (create), `/purchasing/load-lists/[id]` (view), and `/purchasing/load-lists/[id]/edit` (edit). The page shows Shipment, Container, Items, and Notes sections beside a summary panel that holds the total and the page actions. Edit is available to the source business unit while the load list is `draft` or `confirmed` and the user can view unit prices; the destination business unit is locked once the load list exists.

Mark In Transit captures the shipping liner and estimated arrival date. The detail page shows both values in the Transit section. While the load list is In Transit, authorized users in the source business unit can choose **Edit Transit Details** in that section to change or clear either value. Saving keeps the shipment in transit and refreshes the updated transit details and arrival views.

Load Date is optional, but a partially entered date blocks saving with an inline message and focuses the field. Complete the date or clear every part of it before retrying. Quantity precision is checked directly from the entered text, so values with more than two decimal places cannot be added.

Load list unit price and total amount fields are display-controlled by granular permissions. Create and edit forms hide item costs, unit price inputs, line totals, and total amount when the user lacks `load_lists.field.unit_price.view`, while mutation payloads still preserve the stored prices.

Lines are entered in a New item row above the items table whose fields align with the table columns (Item, Unit with its quantity per unit beneath, Qty, Total Qty, Unit Cost, Line Total). Unit cost is per base unit, so Line Total = Total Qty × Unit Cost. Pressing Enter in Qty or Unit Cost adds the line and returns focus to Item; Escape clears the row. Item and supplier pickers search on the server with bounded results.

Create and edit validation focuses the first invalid field. Validation messages remain inline, with an invalid-field indicator, until the relevant value changes or validation is retried. Field messages appear beside the affected control; New item messages use a full-width row below the inputs. Saving without line items shows the message under the New item row and focuses the item picker. New item validation checks the item, active unit, positive quantity with up to two decimal places, and visible nonnegative unit cost. If a unit selector is disabled because no units are available, focus returns to the item selector so another item can be chosen. Save failures remain visible in the summary panel above the save button; retrying or editing clears stale errors. In edit mode the summary shows "Unsaved changes" and lines added since the last save are marked "Not saved".

In the Load List detail view, an item row shows **Linked** whenever it has at least one saved stock requisition link, including a partial allocation. The status clears when the last saved link is removed. The standard `GET /api/load-lists/[id]` response exposes this status as the boolean `items[].isLinkedToStockRequisition`.

The Link Stock Requisitions dialog requires `load_lists.view` plus `load_lists.operation.link_stock_requisitions.edit` and shows existing load-list item to stock-requisition item links before new links are added. Authorized users can add links in the source business unit while the load list is `draft`, `confirmed`, or `in_transit`. Saved links can only be removed while it is `draft` or `confirmed`. Each mutation and fulfillment reconciliation runs in one database transaction. Arrived, receiving, pending-approval, received, and cancelled load lists are read-only for linking.

Eligible submitted and partially fulfilled requisition lines support server-side search by requisition number, item code, or item name. When a shipment line is selected, the server filters outstanding lines by the same item and exact pack option before pagination. For example, `BOX (50)` links to `BOX (50)`. The API rejects a cross-pack link with `LOAD_LIST_LINK_PACK_MISMATCH`. Existing link pairs are marked and disabled. The load-list item dropdown shows the remaining quantity after existing and pending links, hides fully allocated lines, and restores them when removed links free up quantity. Use **Create Links** to save pending links. Each shipment line can be split among multiple matching requisition lines within the quantity limits on both sides. When another edit removes a shipment line before submission, the dialog refreshes so the user can select an available line.

On GRN confirmation, fulfilled and outstanding quantities are reconciled against each linked requisition line in its ordered pack size. Receiving stages the received stock in base units by multiplying each GRN line's quantity by its pack conversion. Putaway posts those base units to inventory under the same item.

Mark In Transit requires `load_lists.view` plus `load_lists.operation.mark_in_transit.edit`. The transition locks the confirmed load list and changes the supplier shipment status atomically. It does not assign a warehouse or write warehouse-level in-transit stock because the physical receiving location is not known yet.

The inventory **Stock In Transit** page covers active in-transit load lists headed to any business
unit in the company. It is one split view. The item list shows each item's ordered-unit totals, its
combined base-unit total, and its next arrival, and search can match an item, load list, supplier, or destination. A search
keeps the matching item's complete in-transit total. Selecting an item shows its arrival mix (Late,
Next 7 Days, 8-14 Days, Later, and No ETA) and an arrival timeline.

Ordered units are the primary quantity and base units are shown underneath. The base quantity is
hidden when it would repeat the ordered quantity, such as `10 STICK` for an item whose base unit is
Stick. Different ordered units are listed separately, such as `100 BOX (144) + 10 STICK`, because
they cannot be added together. The saved conversion also distinguishes packs with the same label.
For example, two boxes of 144 sticks and five boxes of 72 sticks labeled `BOX` appear as
`5 BOX (72) + 2 BOX (144)`, with a base total of 648 sticks.
Load lists with the same estimated arrival date share one timeline stop with the date's ordered-unit
totals, base total, and destination split. Each load list then shows its quantities, supplier,
destination, container, and liner. Base quantities use the conversions saved on the load-list lines,
and the arrival mix bar is proportioned by base quantity. Arrival timing uses the current
business unit's timezone and defaults to Asia/Manila. Transit quantities and estimated arrivals stay
on the load lists.

`GET /api/stock-in-transit?view=items` returns one row per item with ordered-unit and base totals, company load-list counts for the
current search, and pagination by item. `view=arrivals&itemId=<uuid>` returns that item's load lists
in arrival order, with complete ordered-unit and base totals by load list, date, destination, and arrival window, and pagination by load list. Page size is
capped at 50. Both views require Items view access and use the authenticated user's company. Opening
a load list requires Load Lists view access in its source or destination business unit.
Each ordered-unit total includes `unitName`, `quantity`, and the saved `quantityPerUnit` conversion.

Mark Arrived requires `load_lists.view` plus `load_lists.operation.mark_arrived.edit`; Stockman receives this capability by default. The transition locks the in-transit load list, records its arrival date, and creates the target-business-unit GRN and all GRN lines in one transaction. A failure at any point leaves the load list in transit without a partial GRN.

Load lists describe shipments and expected quantities. Received and damaged quantities belong exclusively to GRN lines; load-list lines do not store or display received, damaged, or shortage quantities. The load-list detail API and shipments report omit these receipt fields. GRN confirmation still reconciles stock requisition fulfillment from approved GRNs and marks the linked load list received in one transaction, preserving partial receipts, damage, and over-receipts on the GRN. Header lifecycle fields and status remain unchanged. Mobile receiving and its inbox continue to use GRN data. The obsolete tablet card displays total item count only; its received-item count and progress bar were removed with the load-list receipt fields.

Load lists keep `business_unit_id` as the creator/source business unit and store a separate required `destination_business_unit_id`. Create forms select the destination business unit, never a specific warehouse. Users in either the source or destination business unit can read the load list. The destination business unit controls Mark Arrived and arrival reversal, while editing, linking, cancellation, deletion, and Mark In Transit remain source-business-unit operations. Arrival creates a draft GRN for the destination business unit with no warehouse assigned. Starting GRN receiving authorizes against that destination business unit and moves both records into receiving without selecting or assigning a warehouse.

Each load-list line snapshots its unit display name and quantity-per-unit conversion when the line is created. The generated GRN line copies those values, and the putaway task takes its own copy when the GRN is submitted. In-transit, receiving, putaway, and stock-transaction calculations use these transaction-owned snapshots. Later edits, deactivation, or soft deletion of a referenced unit option—and later changes to an upstream transaction snapshot—therefore do not change quantities or labels on an already-created putaway task.

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

#### PATCH /api/load-lists/[id]/transit-details

Updates the shipping liner or estimated arrival date for an in-transit load list. Requires `load_lists.view` and `load_lists.operation.mark_in_transit.edit` in the source business unit.

Send at least one of `linerName` (up to 150 characters) or `estimatedArrivalDate` (`YYYY-MM-DD`). Send `null` to clear a field and omit fields whose values should be kept. The response contains `id` and `llNumber`. The API returns `409` if the load list is unavailable for transit edits, including when it has already arrived.

### Purchase Order Management

#### POST /api/purchase-orders

Create purchase order.

**Permissions**: `create` on `purchase_orders`

**Request**:

```json
{
  "supplier_id": "uuid",
  "load_list_id": "uuid", // Optional
  "order_date": "2025-06-14",
  "expected_delivery_date": "2025-06-21",
  "lines": [
    {
      "item_id": "uuid",
      "quantity": 100,
      "unit_id": "uuid",
      "unit_price": 8.5
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

GRNs for supplier shipments are created automatically and transactionally when the destination business unit marks a load list arrived. There is no manual GRN creation endpoint in the active workflow.

#### POST /api/grns/[id]/start-receiving

Transition a draft or paused GRN plus its linked arrived load list into `receiving` before quantities can be edited. The operation is scoped to the GRN's destination business unit and does not accept or assign a warehouse.

**Permissions**: `view` on Goods Receipt Notes plus `goods_receipt_notes.operation.start_receiving.edit`

**Request**: No request body.

#### PUT /api/grns/[id]

Save bounded GRN header and receiving-line changes. The GRN must already be in `receiving`; dashboard, tablet, and mobile clients expose editing only after Start Receiving succeeds. Save does not submit the GRN and returns the authoritative updated receiving detail.

**Permissions**: `view` on Goods Receipt Notes plus `goods_receipt_notes.operation.save_receiving.edit`

#### POST /api/grns/[id]/submit

Submit a receiving GRN for confirmation and stage its received stock for putaway. Mobile callers may include a bounded receiving patch so unsaved lines are saved and submitted in the same database transaction; any submit failure rolls back both the save and all staging writes.

**Permissions**: `view` on Goods Receipt Notes plus `goods_receipt_notes.operation.submit_receiving.edit`

#### POST /api/grns/[id]/confirm

Confirm GRN.

**Permissions**: `view` on Goods Receipt Notes plus `goods_receipt_notes.operation.confirm_receiving.edit`

**Effect**:

1. Status changes to 'approved'
2. Linked load list changes to 'received'
3. Records confirming user and timestamp

GRN inventory handoff begins when the receiving user submits the GRN for confirmation. The submit action creates business-unit-level putaway tasks by GRN line and batch code, copies each line's source unit and quantity-per-unit conversion, and records the staged receipt. Confirmation completes the GRN and atomically marks the linked load list received. At the Putaway Station, the operator selects an active warehouse in the destination business unit and a storable rack in that warehouse. Posting atomically creates or increments warehouse stock and batch/location inventory. The Putaway Station displays quantities from the task's unit snapshot, including **Total Qty** in base units. Operators can print labels when posting and reprint them from completed putaway.

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
      "unit_cost": 8.5
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

### Workflow 3: GRN Receiving

1. The destination business unit marks the load list arrived, creating its draft GRN.
2. The receiver starts receiving on the GRN and records received quantities, damaged quantities, carton counts, and notes by line.
3. The receiver submits the GRN for confirmation and stages the good quantities in Putaway Station.
4. The supervisor confirms the GRN.
5. The Putaway Station operator selects the warehouse and rack, posts the staged stock, and prints the item-batch labels.

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
      (currentOnHand * currentAvgCost + receivedQty * purchasePrice) / (currentOnHand + receivedQty)
    );
  }
}
```

## UI Components

### Key Components

#### SupplierList

**Location**: `src/components/purchasing/SupplierList.tsx`

#### Stock requisition pages

**Location**: `src/components/stock-requisitions/StockRequisitionEditor.tsx` (create at `/purchasing/stock-requisitions/new`, edit at `/purchasing/stock-requisitions/[id]/edit`) and `src/components/stock-requisitions/StockRequisitionDetails.tsx` (view at `/purchasing/stock-requisitions/[id]`)

- Create, edit, and view are full pages that share the load list page layout: a Request section (supplier, requisition date, required-by date), the Items section, Notes, and a sticky Summary panel with the item count, total, and actions
- The New item row (item, unit, qty, total qty, unit cost, line total) sits above the Items table and aligns with its columns; the unit's quantity per unit shows under the unit. Unit cost is per base unit and one currency is allowed per requisition. Enter adds the line and Esc clears the row
- An item can appear once per pack option. Add `BOX (50)` and `BOX (144)` as separate lines. Repeating a pack shows an inline error. Remove an existing line to replace its pack, quantity, or cost
- Stock requisition granular permissions control unit cost and amount visibility. Users with restricted cost access save without sending prices. Draft edits preserve the stored cost for an existing pack, and new packs use the item's default cost
- Only draft requisitions can be edited, and only with stock requisition edit permission; other requisitions show a message linking back to the view page
- The view page shows Fulfilled and Outstanding quantities once the requisition has been sent, and offers Send and Edit (draft only, with edit permission), Print, and Download PDF
- Reorder alerts open the new requisition page with prefilled line items; the hand-off lasts for that navigation only and is not kept after a reload
- Shared building blocks live in `src/components/document-page/` and are also used by the load list pages
- On phones (below 768px) the Items section shows one stacked row per line, with the item on top, the other columns as labelled values below, and the total underneath; from 768px it is the table, which scrolls sideways when the columns do not fit. The same shared lines table drives the load list and stock request pages, so they switch the same way

#### Stock requisitions list

**Location**: `src/app/(dashboard)/purchasing/stock-requisitions/page.tsx` with `src/components/stock-requisitions/StockRequisitionMobileList.tsx`

- From 768px: search, Status, and Supplier filters in one row, and the table, whose height follows the viewport but never drops below about four rows
- On phones: search with a Filters button that opens a Status and Supplier panel (with an active-filter count and Clear All Filters), and one stacked row per requisition showing the SR number with its status, supplier, requisition date, required-by date, and total amount when the user may see amounts
- Phone rows put every action in the row's More Actions menu: Send and Edit (drafts), Print, Cancel, and Delete. Phone controls are at least 44px tall

#### LoadListForm

**Location**: `src/components/purchasing/LoadListForm.tsx`

- Select approved requisitions
- Preview consolidated items
- Create load list

#### PurchaseOrderForm

**Location**: `src/components/purchasing/PurchaseOrderForm.tsx`

#### GRN receiving detail

**Location**: `src/app/(dashboard)/purchasing/grns/[id]/page.tsx`

- GRN line quantities, carton counts, and receiving notes
- Damaged item reporting
- Receiving, submission, and confirmation controls

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
