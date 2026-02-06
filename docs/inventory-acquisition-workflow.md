# Inventory Acquisition Workflow Plan

## Executive Summary

This document outlines the complete workflow for inventory acquisition without a formal Purchase Order process. The system supports phone-based requisitions, supplier load lists, barcode-based receiving with storage location tracking, and approval-based inventory updates.

---

## 1. Document Flow Overview

```
Stock Requisition (SR)
    ↓ (1:N relationship)
Load List (LL) - Supplier's shipment document
    ↓ (1:1 relationship)
Goods Receipt Note (GRN) - Internal receiving document
    ↓ (After approval)
Stock Entry - Updates inventory
    ↓ (If needed)
Return to Supplier (RTS)
```

**Key Relationship:**
- N Stock Requisitions → N Load Lists (many-to-many)
- 1 Load List → 1 Goods Receipt Note
- 1 GRN → N Stock Entries (per item line)

---

## 2. Document Entities

### 2.1 Stock Requisition (SR)

**Purpose:** Formal document tracking items requested from supplier via phone/email

**Key Fields:**
- `dr_number` - Unique identifier (e.g., SR-2026-0001)
- `business_unit_id` - Which BU is requesting
- `supplier_id` - Supplier reference
- `requisition_date` - Date of request
- `requested_by` - User who created the requisition
- `status` - Draft, Submitted, Partially Fulfilled, Fulfilled, Cancelled
- `notes` - Additional information about the phone call/request
- `total_amount` - Total estimated value

**Line Items:** `stock_requisition_items`
- `item_id` - Product being requested
- `requested_qty` - Quantity requested
- `unit_price` - Agreed price with supplier
- `total_price` - requested_qty × unit_price
- `fulfilled_qty` - Running total of fulfilled quantity
- `outstanding_qty` - Calculated: requested_qty - fulfilled_qty
- `notes` - Item-specific notes

**Business Rules:**
- Users can manually close/fulfill a SR even if outstanding_qty > 0
- Track which load lists fulfilled which SR items (junction table)
- SR can be edited while in Draft status
- Once Submitted, only status changes and fulfillment updates allowed

---

### 2.2 Load List (LL)

**Purpose:** Supplier-provided document listing items in shipment (single source of truth)

**Key Fields:**
- `ll_number` - Unique identifier (e.g., LL-2026-0001)
- `supplier_ll_number` - Supplier's reference number
- `business_unit_id` - Destination BU
- `supplier_id` - Supplier reference
- `warehouse_id` - Destination warehouse
- `container_number` - Container/truck number
- `seal_number` - Seal number
- `estimated_arrival_date` - Expected arrival
- `actual_arrival_date` - When container arrived
- `load_date` - When supplier loaded the container
- `status` - Draft, Confirmed, In Transit, Arrived, Receiving, Pending Approval, Received, Cancelled
- `created_by` - User who entered the load list
- `received_by` - Receiving personnel user_id
- `approved_by` - Supervisor/manager user_id
- `received_date` - When receiving completed
- `approved_date` - When supervisor approved
- `notes` - General notes

**Line Items:** `load_list_items`
- `item_id` - Product in shipment
- `load_list_qty` - Quantity per load list
- `received_qty` - Actual received quantity (can be partial)
- `damaged_qty` - Damaged units
- `shortage_qty` - Calculated: load_list_qty - (received_qty + damaged_qty)
- `unit_price` - Price from linked SR
- `total_price` - load_list_qty × unit_price
- `notes` - Item-specific notes

**Linking Table:** `load_list_dr_items`
- `load_list_item_id`
- `dr_item_id`
- `fulfilled_qty` - How much of this SR item this LL fulfills

**Business Rules:**
- **Status → "In Transit"**: System updates `inventory.in_transit` field (increment by `load_list_qty`)
- **Status → "Received"**: System updates inventory (decrement `in_transit`, increment `on_hand`)
- **Status → "Cancelled"** (from In Transit): System rolls back `inventory.in_transit` (decrement by `load_list_qty`)
- In Transit items are NOT available for sale but ARE visible in inventory reports
- Only when status = "Received" and GRN approved do items get added to `on_hand` inventory

---

### 2.3 Goods Receipt Note (GRN)

**Purpose:** Internal receiving document generated from Load List for physical verification

**Key Fields:**
- `grn_number` - Unique identifier (e.g., GRN-2026-0001)
- `load_list_id` - Reference to parent load list
- `business_unit_id`
- `warehouse_id`
- `container_number` - From load list
- `seal_number` - From load list
- `receiving_date` - Date of physical receiving
- `delivery_date` - Date supplier delivered (for LIFO tracking)
- `received_by` - Receiving personnel user_id
- `checked_by` - Supervisor/manager user_id
- `status` - Draft, Receiving, Pending Approval, Approved, Rejected
- `notes`

**Line Items:** `grn_items`
- `item_id`
- `load_list_qty` - Expected quantity from LL
- `received_qty` - Actual received
- `damaged_qty` - Damaged units
- `num_boxes` - Number of boxes/cartons
- `barcodes_printed` - Boolean flag
- `notes`

**Box/Carton Tracking:** `grn_boxes`
- `grn_item_id`
- `box_number` - Sequential number (1, 2, 3...)
- `barcode` - Generated barcode
- `qty_per_box` - Items in this box
- `warehouse_location_id` - Storage location (Aisle-Rack-Shelf)
- `delivery_date` - For LIFO tracking
- `container_number`
- `seal_number`

**Business Rules:**
- Auto-generated from Load List when status changes to "Arrived" or "Receiving"
- Receiver enters actual quantities
- System calculates variances
- On approval, creates stock entries

---

### 2.4 Stock Entry

**Purpose:** Update inventory quantities after GRN approval

**Key Fields:**
- Standard stock entry fields
- `grn_id` - Reference to GRN
- `transaction_type` - "Receipt from Supplier"
- `delivery_date` - For LIFO tracking
- `container_number`
- `seal_number`
- `warehouse_location_id`

---

### 2.5 Damaged Items Log

**Purpose:** Track damaged/defective items separately

**Key Fields:**
- `grn_id`
- `item_id`
- `qty`
- `damage_type` - Broken, Defective, Missing, etc.
- `description`
- `reported_by`
- `reported_date`
- `action_taken` - Return to supplier, Write-off, etc.
- `status` - Reported, Processing, Resolved

---

### 2.6 Return to Supplier (RTS)

**Purpose:** Handle returns of damaged/defective items

**Key Fields:**
- `rts_number` - Unique identifier (e.g., RTS-2026-0001)
- `grn_id` - Reference to original receipt
- `supplier_id`
- `business_unit_id`
- `warehouse_id`
- `return_date`
- `reason`
- `status` - Draft, Pending, Shipped, Completed
- `created_by`
- `approved_by`

**Line Items:** `rts_items`
- `item_id`
- `return_qty`
- `reason`
- `grn_item_id` - Link back to original receipt

---

## 3. Status Workflows

### 3.1 Stock Requisition Status Flow

```
Draft → Submitted → Partially Fulfilled → Fulfilled
                                      ↓
                                  Cancelled (from any status)
```

**Status Definitions:**
- **Draft** - Being created, not yet sent to supplier
- **Submitted** - Communicated to supplier (phone/email)
- **Partially Fulfilled** - Some items received via load lists
- **Fulfilled** - All items received OR manually closed
- **Cancelled** - Requisition cancelled

**Transitions:**
- Draft → Submitted: Manual by user
- Submitted → Partially Fulfilled: Auto when first LL items link to SR
- Partially Fulfilled → Fulfilled: Auto when all outstanding_qty = 0 OR manual close
- Any → Cancelled: Manual by authorized user

---

### 3.2 Load List Status Flow

```
Draft → Confirmed → In Transit → Arrived → Receiving → Pending Approval → Received
                                                                       ↓
                                                                  Cancelled
```

**Status Definitions:**
- **Draft** - Load list being entered into system
- **Confirmed** - Supplier confirmed the shipment details
- **In Transit** - Container shipped, items shown as "in transit" in reports
- **Arrived** - Container physically arrived at warehouse
- **Receiving** - Staff actively unloading and checking items
- **Pending Approval** - Receiving complete, awaiting supervisor approval
- **Received** - Approved, items added to inventory
- **Cancelled** - Shipment cancelled

**Transitions:**
- Draft → Confirmed: Manual by user after supplier confirmation
- Confirmed → In Transit: Manual when supplier notifies shipment
- In Transit → Arrived: Manual when container arrives
- Arrived → Receiving: Manual when receiving starts OR auto-creates GRN
- Receiving → Pending Approval: Manual when receiving personnel completes
- Pending Approval → Received: Approval by supervisor/warehouse manager
- Pending Approval → Receiving: Rejection sends back to receiving
- Any (except Received) → Cancelled: Manual by authorized user

**System Actions by Status:**
- **Confirmed → In Transit**:
  - **UPDATE inventory**: Increment `in_transit` field for each item in the load list
  - Send "In Transit" notification to warehouse staff
  - Items visible in "In Transit" report, NOT in available inventory
- **In Transit → Arrived**:
  - Auto-create GRN from load list
  - Send "Arrived" notification to receiving staff
- **Arrived → Receiving**:
  - GRN status → Receiving (if auto-created)
  - Send "Receiving Started" notification
- **Receiving → Pending Approval**:
  - Send notification to approvers (warehouse manager/supervisor)
- **Pending Approval → Received** (after GRN approval):
  - **UPDATE inventory**:
    - Decrement `in_transit` by `received_qty`
    - Increment `on_hand` by `received_qty`
  - Create stock entries for each item
  - Update SR item fulfillment quantities
  - Send "Received" notification to stakeholders
- **In Transit → Cancelled**:
  - **UPDATE inventory**: Decrement `in_transit` by `load_list_qty` (rollback)
  - Send cancellation notification

---

### 3.3 GRN Status Flow

```
Draft → Receiving → Pending Approval → Approved
                            ↓
                        Rejected (back to Receiving)
```

**Status Definitions:**
- **Draft** - Auto-created from load list
- **Receiving** - Active receiving in progress
- **Pending Approval** - Awaiting supervisor sign-off
- **Approved** - Inventory updated
- **Rejected** - Sent back for corrections

**Transitions:**
- Draft → Receiving: Auto when LL status = Arrived or manual start
- Receiving → Pending Approval: Receiving personnel submits
- Pending Approval → Approved: Supervisor approves
- Pending Approval → Rejected: Supervisor rejects with notes
- Rejected → Receiving: Receiver makes corrections

---

## 4. Barcode Implementation

### 4.1 Barcode Generation

**When:** During GRN receiving process, after quantities entered

**Format:** Code 128 or QR Code

**Barcode Data Structure (QR Code Recommended):**
```json
{
  "grn_box_id": "12345",
  "item_id": "678",
  "item_name": "Glass 10X5 (Box)",
  "qty": 50,
  "container_number": "CONT-2026-001",
  "seal_number": "SEAL-12345",
  "delivery_date": "2026-01-31",
  "warehouse_location_id": "789"
}
```

**Or Simple Format (Code 128):**
`GRN-BOX-{grn_box_id}`
Then lookup in database for details.

### 4.2 Barcode Printing

**Trigger:**
- During receiving, after receiver enters received_qty and num_boxes
- User clicks "Print Barcodes" button for that line item

**Print Layout:**
- Print one label per box
- Label includes:
  - Barcode (scannable)
  - Item Name
  - Quantity in box
  - Container/Seal Number
  - Delivery Date
  - Storage Location (if already assigned)

**Workflow:**
1. Receiver enters: received_qty = 100, num_boxes = 2
2. System creates 2 records in `grn_boxes`:
   - Box 1: qty_per_box = 50
   - Box 2: qty_per_box = 50
3. Generate barcodes for each box
4. Print labels (using browser print or dedicated label printer)
5. Physical staff sticks labels on boxes
6. Scan barcode to assign storage location

### 4.3 Storage Location Assignment

**Option 1: During Receiving**
- Receiver assigns location while entering data
- Barcode includes location

**Option 2: After Receiving (Recommended)**
- Print barcode without location
- Separate "putaway" process:
  - Scan box barcode
  - Scan or select storage location
  - System updates `grn_boxes.warehouse_location_id`
  - Reprint label with location (or use handheld device)

---

## 5. Approval Workflow

### 5.1 Two-Step Receiving

**Step 1: Physical Receiving**
- Receiving personnel unload and count items
- Enter actual quantities in GRN
- Document damages
- Print and apply barcodes
- Submit for approval (status → Pending Approval)

**Step 2: Supervisor Approval**
- Warehouse manager/supervisor reviews GRN
- Checks for variances
- Reviews damaged items
- Either:
  - **Approves**: Inventory updated, LL status → Received
  - **Rejects**: GRN back to Receiving status with rejection notes

### 5.2 Approval Rules

**Who Can Approve:**
- Warehouse Manager
- Warehouse Supervisor
- Inventory Manager
- Configurable by role (RBAC)

**Approval Triggers:**
- All GRNs require approval
- Optional: Auto-approve if no variances (future enhancement)

---

## 6. Notification System

### 6.1 Notification Events

| Event | Status Change | Notification To | Message |
|-------|--------------|-----------------|---------|
| Container Arriving | LL: Confirmed → In Transit | Warehouse Manager, Receiving Staff | "Load List {ll_number} is in transit. Expected arrival: {date}" |
| Container Arrived | LL: In Transit → Arrived | Warehouse Manager, Receiving Staff | "Load List {ll_number} has arrived. Container: {container_number}" |
| Receiving Started | LL: Arrived → Receiving | Warehouse Manager | "Receiving started for Load List {ll_number}" |
| Pending Approval | LL: Receiving → Pending Approval, GRN: Receiving → Pending Approval | Warehouse Manager, Supervisor, Approvers | "GRN {grn_number} is pending your approval" |
| Approved | LL: Pending Approval → Received, GRN: Pending Approval → Approved | Requester, Procurement, Warehouse Manager | "GRN {grn_number} approved. Items added to inventory." |
| Rejected | GRN: Pending Approval → Rejected | Receiving Staff | "GRN {grn_number} was rejected. Reason: {notes}" |
| Damaged Items | Damaged items logged | Warehouse Manager, Procurement | "Damaged items reported in GRN {grn_number}: {qty} units of {item}" |

### 6.2 Notification Configuration

**Settings Table:** `notification_settings`
- `event_type` - Enum of events above
- `role_id` - Which role receives notification
- `user_id` - Specific user override
- `channel` - Email, In-app, SMS
- `enabled` - Boolean

**User Preferences:**
- Allow users to opt-in/out of specific notifications
- Default based on role

---

## 7. Returns Workflow

### 7.1 Return to Supplier Process

**Trigger:**
- Damaged items identified during receiving
- Defective items found later
- Wrong items shipped

**Workflow:**
1. Create Return to Supplier (RTS) document
2. Link to original GRN
3. Select items and quantities to return
4. Submit for approval
5. Upon approval:
   - Create negative stock entry
   - Update damaged items log
   - Notify supplier (outside system)
   - Track return shipment

**Inventory Impact:**
- If damaged items were already added to inventory: Create adjustment to reduce
- If damaged items were logged during receiving: No adjustment needed

---

## 8. Inventory Tracking

### 8.1 In Transit Inventory

**Inventory Table Fields:**
The `inventory` (or `item_warehouse`) table should have:
- `on_hand` - Physical quantity in warehouse
- `in_transit` - Quantity currently in shipment
- `reserved` - Quantity allocated to orders
- `available` - Calculated: `on_hand - reserved`

**In Transit Field Updates:**

When Load List status changes, update the `in_transit` field:

| Status Transition | Inventory Action |
|-------------------|------------------|
| Confirmed → **In Transit** | **INCREMENT** `in_transit` by `load_list_qty` for each item |
| In Transit → **Arrived** | No change (still in transit until received) |
| Arrived → **Received** (after approval) | **DECREMENT** `in_transit` by `received_qty`<br>**INCREMENT** `on_hand` by `received_qty` |
| In Transit → **Cancelled** | **DECREMENT** `in_transit` by `load_list_qty` |

**Example Flow:**
```sql
-- Initial state
item_id: 123, warehouse_id: 1, on_hand: 100, in_transit: 0, available: 80

-- Load List created with 50 units, status → In Transit
UPDATE inventory
SET in_transit = in_transit + 50  -- = 50
WHERE item_id = 123 AND warehouse_id = 1;

-- Load List received with 48 units (2 damaged), status → Received
UPDATE inventory
SET in_transit = in_transit - 48,  -- = 2 (if another LL still in transit)
    on_hand = on_hand + 48         -- = 148
WHERE item_id = 123 AND warehouse_id = 1;
```

**Business Rules:**
- In Transit items are NOT available for sale (not in `available` calculation)
- In Transit items ARE visible in inventory reports for planning
- If Load List is partially received, only decrement `in_transit` by `received_qty`, not `load_list_qty`
- Damaged items reduce `in_transit` but do NOT increase `on_hand`

**Report Features:**
- Show in_transit quantity in inventory list views
- Dedicated "In Transit" report grouped by: Supplier, Expected Arrival Date, Warehouse
- Alert when in_transit items are overdue (expected arrival date passed)

### 8.2 LIFO Sequencing

**Requirement:** Track delivery_date for LIFO sales

**Implementation:**
- Store `delivery_date` in `grn_boxes` table
- When picking for sales, query by:
  ```sql
  ORDER BY delivery_date DESC -- Most recent first (LIFO)
  ```
- Optionally track at stock_entry level with `delivery_date`

### 8.3 Storage Location Tracking

**Hierarchy:**
- Warehouse → Location (Aisle-Rack-Shelf format)

**Tracking Level:**
- Box/carton level via `grn_boxes.warehouse_location_id`
- Aggregate to item level for reporting

**Use Cases:**
- Picking: Show location of item
- Replenishment: Track which locations need restocking
- Physical count: Organize by location

---

## 9. Data Model Summary

### New Tables Required

```sql
-- Stock Requisitions
stock_requisitions (
  id, dr_number, business_unit_id, supplier_id,
  requisition_date, requested_by, status, notes,
  total_amount, created_at, updated_at
)

stock_requisition_items (
  id, dr_id, item_id, requested_qty, unit_price,
  total_price, fulfilled_qty, outstanding_qty, notes
)

-- Load Lists
load_lists (
  id, ll_number, supplier_ll_number, business_unit_id,
  supplier_id, warehouse_id, container_number, seal_number,
  estimated_arrival_date, actual_arrival_date, load_date,
  status, created_by, received_by, approved_by,
  received_date, approved_date, notes, created_at, updated_at
)

load_list_items (
  id, load_list_id, item_id, load_list_qty, received_qty,
  damaged_qty, shortage_qty, unit_price, total_price, notes
)

-- Junction table for N:N relationship
load_list_dr_items (
  id, load_list_item_id, dr_item_id, fulfilled_qty
)

-- Goods Receipt Notes
grns (
  id, grn_number, load_list_id, business_unit_id, warehouse_id,
  container_number, seal_number, receiving_date, delivery_date,
  received_by, checked_by, status, notes, created_at, updated_at
)

grn_items (
  id, grn_id, item_id, load_list_qty, received_qty, damaged_qty,
  num_boxes, barcodes_printed, notes
)

grn_boxes (
  id, grn_item_id, box_number, barcode, qty_per_box,
  warehouse_location_id, delivery_date, container_number,
  seal_number, created_at
)

-- Damaged Items
damaged_items (
  id, grn_id, item_id, qty, damage_type, description,
  reported_by, reported_date, action_taken, status
)

-- Return to Supplier
return_to_suppliers (
  id, rts_number, grn_id, supplier_id, business_unit_id,
  warehouse_id, return_date, reason, status, created_by,
  approved_by, created_at, updated_at
)

rts_items (
  id, rts_id, item_id, return_qty, reason, grn_item_id
)

-- Notifications
notification_settings (
  id, event_type, role_id, user_id, channel, enabled
)

notifications (
  id, user_id, event_type, title, message, data_json,
  read, created_at
)

-- Inventory Updates (modify existing table)
-- Add to existing inventory or item_warehouse table:
ALTER TABLE inventory (or item_warehouse) ADD COLUMN:
  in_transit DECIMAL(15,2) DEFAULT 0 NOT NULL
  -- Tracks quantity currently in shipment
```

---

## 10. UI/UX Workflow

### 10.1 Stock Requisition Module

**List View:**
- Filters: Status, Supplier, Date Range, Requested By
- Columns: SR Number, Date, Supplier, Total Items, Total Amount, Status
- Actions: Create New, View, Edit (if Draft), Cancel

**Form View:**
- Header: SR Number (auto), Supplier, Requisition Date, Requested By
- Line Items Grid:
  - Item, Requested Qty, Unit Price, Total, Fulfilled Qty, Outstanding Qty
  - Add/Remove lines
- Footer: Total Amount, Notes
- Actions: Save as Draft, Submit

**Detail View:**
- Show all SR info
- Tab: "Linked Load Lists" - Show which LLs fulfilled this SR
- Tab: "Fulfillment History" - Timeline of fulfillment

---

### 10.2 Load List Module

**List View:**
- Filters: Status, Supplier, Warehouse, Date Range
- Columns: LL Number, Supplier, Container, Status, Arrival Date, Total Items
- Actions: Create New, View, Edit, Change Status

**Form View:**
- Header: LL Number (auto), Supplier LL Number, Supplier, Warehouse, Container Number, Seal Number, Dates
- Status workflow buttons (Confirm, Mark In Transit, Mark Arrived, etc.)
- Line Items Grid:
  - Item, LL Qty, Received Qty, Damaged Qty, Shortage Qty, Unit Price, Total
  - Link to SR items (multi-select)
- Footer: Total Amount, Notes
- Actions: Save, Submit

**Detail View:**
- All LL info
- Tab: "Linked Requisitions" - Show which SRs this LL fulfills
- Tab: "Receiving Details" - Link to GRN
- Tab: "Timeline" - Status change history

---

### 10.3 Goods Receipt Note (Receiving) Module

**List View:**
- Filters: Status, Warehouse, Date Range, Received By
- Columns: GRN Number, LL Number, Container, Status, Receiving Date, Received By
- Actions: View, Process (if status allows)

**Receiving Form:**
- Header: GRN Number (auto), LL Number, Container, Seal, Delivery Date
- Line Items Grid:
  - Item, Expected Qty (from LL), Received Qty (editable), Damaged Qty (editable), Num Boxes (editable)
  - "Print Barcodes" button per line
  - Notes field
- Variance indicators (highlight if received ≠ expected)
- Damaged Items Section: Add damaged item logs
- Actions: Save Progress, Submit for Approval

**Barcode Printing:**
- Modal/dialog with barcode preview
- Option to assign locations before printing
- Print button (triggers browser print or label printer)

**Approval View:**
- Same as receiving form but read-only
- Show variances clearly
- Approval notes field
- Actions: Approve, Reject (with reason)

---

### 10.4 Receiving Dashboard

**Widgets:**
- Pending Approvals count
- In Transit Items (by arrival date)
- Today's Scheduled Arrivals
- Receiving in Progress
- Recent Damaged Items

**Reports:**
- In Transit Inventory Report
- Receiving Performance (time from arrival to approved)
- Variance Analysis
- Damaged Items Summary

---

## 11. Key Business Rules Recap

1. **SR to LL Relationship:**
   - Many-to-many: Track fulfillment in `load_list_dr_items`
   - Update `dr_items.fulfilled_qty` when LL items are linked
   - Calculate `outstanding_qty` automatically

2. **In Transit Inventory Updates:**
   - When LL status → "In Transit": **INCREMENT** `inventory.in_transit` by `load_list_qty`
   - When LL status → "Received": **DECREMENT** `inventory.in_transit` by `received_qty`, **INCREMENT** `inventory.on_hand` by `received_qty`
   - When LL status → "Cancelled" (from In Transit): **DECREMENT** `inventory.in_transit` by `load_list_qty` (rollback)
   - In transit items are NOT available for sale (not in `available` calculation)
   - In transit items ARE shown in inventory reports for planning/forecasting

3. **Receiving Validation:**
   - Allow partial receiving (received_qty < load_list_qty)
   - Track shortages and damages separately
   - Require approval before inventory update

4. **Barcode Workflow:**
   - Generate during receiving
   - Print one label per box
   - Include delivery_date for LIFO tracking
   - Allow location assignment post-printing

5. **Approval Requirements:**
   - All GRNs require supervisor approval
   - Only "Approved" GRNs update inventory
   - Rejections send back to receiver with notes

6. **LIFO Tracking:**
   - Store `delivery_date` at box level
   - Use for picking sequence in sales
   - Report on inventory age

7. **Multi-Warehouse:**
   - Each LL specifies destination warehouse
   - Storage locations are warehouse-specific
   - Barcodes include warehouse location

8. **Returns:**
   - Create RTS document linked to GRN
   - Adjust inventory when approved
   - Track return status

---

## 12. Implementation Phases

### Phase 1: Core Documents (Priority: High)
- [ ] Stock Requisition CRUD
- [ ] Load List CRUD
- [ ] Basic status workflow for LL
- [ ] SR to LL linking (N:N)
- [ ] Fulfillment tracking

### Phase 2: Receiving Workflow (Priority: High)
- [ ] Add `in_transit` field to inventory table
- [ ] Implement inventory updates on LL status changes
- [ ] GRN auto-creation from LL
- [ ] Receiving form with variance tracking
- [ ] Damaged items logging
- [ ] Approval workflow
- [ ] Stock entry creation on approval

### Phase 3: Barcode & Location (Priority: High)
- [ ] Barcode generation logic
- [ ] Barcode printing functionality
- [ ] Storage location assignment
- [ ] Box-level tracking

### Phase 4: Notifications (Priority: Medium)
- [ ] Notification settings configuration
- [ ] Event triggers for status changes
- [ ] In-app notification display
- [ ] Email notifications (optional)

### Phase 5: In Transit & Reporting (Priority: Medium)
- [ ] In transit inventory report
- [ ] LIFO tracking implementation
- [ ] Receiving dashboard
- [ ] Variance analysis reports

### Phase 6: Returns (Priority: Low)
- [ ] Return to Supplier document
- [ ] RTS workflow
- [ ] Inventory adjustments for returns

---

## 13. Recommendations & Enhancements

### Immediate Recommendations:

1. **Auto-GRN Creation:**
   - When LL status changes to "Arrived", auto-create GRN
   - Saves manual data entry
   - Ensures consistency

2. **Variance Thresholds:**
   - Configure acceptable variance % (e.g., 5%)
   - Auto-approve GRNs within threshold
   - Flag for review if exceeded

3. **Barcode Scanner Integration:**
   - Use mobile app or handheld scanner for receiving
   - Scan items to verify and count
   - Faster and more accurate

4. **Location Suggestions:**
   - Suggest storage locations based on item type
   - Show available locations
   - Track location capacity

5. **Receiving Checklist:**
   - Print GRN as physical checklist
   - Receivers check off items as they unload
   - Enter data into system afterward

### Future Enhancements:

1. **Predictive Arrival:**
   - Track historical transit times
   - Predict arrival dates
   - Alert if delayed

2. **Automatic SR Creation:**
   - Based on reorder points
   - Suggested requisitions for buyers to review

3. **Supplier Performance:**
   - On-time delivery rate
   - Accuracy rate (variance %)
   - Damage rate

4. **Mobile Receiving App:**
   - Dedicated mobile app for receiving
   - Offline capability
   - Photo capture for damages

5. **Integration with Supplier:**
   - API to receive load lists automatically
   - Tracking updates
   - Electronic confirmation

---

## 14. Open Questions & Decisions Needed

1. **User Roles:**
   - What roles can create/edit SR?
   - Who can create/edit LL?
   - Approval hierarchy?

2. **Document Numbering:**
   - Format preferences for SR, LL, GRN, RTS numbers?
   - Sequence per BU or global?

3. **Barcode Printer:**
   - Do they have label printers?
   - Desktop or mobile?
   - Label size preferences?

4. **Storage Location Structure:**
   - Current naming convention for locations?
   - Need to maintain existing locations or redesign?

5. **Historical Data:**
   - Migrate existing requisitions/receipts?
   - Start fresh?

---

## Conclusion

This workflow provides a comprehensive, flexible system for inventory acquisition without traditional POs. It maintains traceability from requisition through receiving and approval, supports partial fulfillment, tracks damages, and provides LIFO sequencing for sales.

The barcode-based receiving with storage location tracking ensures accurate inventory positioning, while the approval workflow maintains control over inventory updates.

Next steps: Review this plan, answer open questions, and proceed to database schema design and implementation.
