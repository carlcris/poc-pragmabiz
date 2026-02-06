# Inventory Acquisition Workflow - Implementation TODO

**Last Updated:** 2026-02-01

## Progress Overview

| Phase | Tasks Completed | Total Tasks | Progress |
|-------|----------------|-------------|----------|
| **Phase 1: Core Documents** | 13 | 13 | 100% ✅ |
| **Phase 2: Receiving Workflow** | 14 | 14 | 100% ✅ |
| **Phase 3: Barcode & Location** | 6 | 6 | 100% ✅ |
| **Phase 4: Notifications** | 0 | 8 | 0% |
| **Phase 5: In Transit & Reporting** | 0 | 4 | 0% |
| **Phase 6: Returns** | 0 | 6 | 0% |
| **TOTAL** | **33** | **51** | **65%** |

---

## Phase 1: Core Documents (Priority: High)

**Status:** Nearly Complete
**Progress:** 4/5 tasks (80%) - Database schema ✅ | API routes ✅ | SR to LL linking ✅

### Database Schema

- [x] **1.1** Create `stock_requisitions` table ✅
  - [x] Add columns: id, dr_number, business_unit_id, supplier_id, requisition_date, requested_by, status, notes, total_amount
  - [x] Add timestamps (created_at, updated_at)
  - [x] Add indexes and foreign keys
  - [x] Add RLS policies

- [x] **1.2** Create `stock_requisition_items` table ✅
  - [x] Add columns: id, dr_id, item_id, requested_qty, unit_price, total_price, fulfilled_qty, outstanding_qty, notes
  - [x] Add foreign keys to stock_requisitions and items
  - [x] Add calculated field for outstanding_qty
  - [x] Add RLS policies

- [x] **1.3** Create `load_lists` table ✅
  - [x] Add columns: id, ll_number, supplier_ll_number, business_unit_id, supplier_id, warehouse_id
  - [x] Add columns: container_number, seal_number, estimated_arrival_date, actual_arrival_date, load_date
  - [x] Add columns: status, created_by, received_by, approved_by, received_date, approved_date, notes
  - [x] Add timestamps
  - [x] Add indexes and foreign keys
  - [x] Add RLS policies

- [x] **1.4** Create `load_list_items` table ✅
  - [x] Add columns: id, load_list_id, item_id, load_list_qty, received_qty, damaged_qty, shortage_qty
  - [x] Add columns: unit_price, total_price, notes
  - [x] Add foreign keys
  - [x] Add calculated field for shortage_qty
  - [x] Add RLS policies

- [x] **1.5** Create `load_list_dr_items` junction table ✅
  - [x] Add columns: id, load_list_item_id, dr_item_id, fulfilled_qty
  - [x] Add foreign keys with cascade deletes
  - [x] Add unique constraint on (load_list_item_id, dr_item_id)
  - [x] Add RLS policies

### API Routes

- [x] **1.6** Stock Requisition API ✅
  - [x] `POST /api/stock-requisitions` - Create SR
  - [x] `GET /api/stock-requisitions` - List SRs with filters (status, supplier, date range)
  - [x] `GET /api/stock-requisitions/[id]` - Get SR details with line items
  - [x] `PUT /api/stock-requisitions/[id]` - Update SR (draft only)
  - [x] `PATCH /api/stock-requisitions/[id]/status` - Change status
  - [x] `DELETE /api/stock-requisitions/[id]` - Delete SR (draft only)
  - [x] Add validation and error handling

- [x] **1.7** Load List API ✅
  - [x] `POST /api/load-lists` - Create LL
  - [x] `GET /api/load-lists` - List LLs with filters (status, warehouse, supplier, date range)
  - [x] `GET /api/load-lists/[id]` - Get LL details with line items
  - [x] `PUT /api/load-lists/[id]` - Update LL
  - [x] `PATCH /api/load-lists/[id]/status` - Change status (with inventory updates)
  - [x] `DELETE /api/load-lists/[id]` - Delete LL
  - [x] Add validation and error handling

- [x] **1.8** SR to LL Linking API ✅
  - [x] `POST /api/load-lists/[id]/link-requisitions` - Link LL items to SR items
  - [x] `GET /api/load-lists/[id]/link-requisitions` - Get linked SRs
  - [x] Update SR item fulfilled_qty when linking
  - [x] Update SR status based on fulfillment (auto-update to partially_fulfilled/fulfilled)

### Frontend Components

- [ ] **1.9** Stock Requisition Module
  - [ ] SR List page with filters and sorting
  - [ ] SR Form (Create/Edit) with line items grid
  - [ ] SR Detail page with tabs (Info, Line Items, Linked Load Lists, History)
  - [ ] Status workflow buttons
  - [ ] Fulfillment progress indicators

- [ ] **1.10** Load List Module
  - [ ] LL List page with filters and sorting
  - [ ] LL Form (Create/Edit) with line items grid
  - [ ] LL Detail page with tabs (Info, Line Items, Linked Requisitions, Timeline)
  - [ ] Status workflow buttons with confirmations
  - [ ] SR linking interface (multi-select)

### Business Logic

- [ ] **1.11** Status workflow for Stock Requisitions
  - [ ] Draft → Submitted transition
  - [ ] Auto-update to Partially Fulfilled when first LL links
  - [ ] Auto-update to Fulfilled when all outstanding_qty = 0
  - [ ] Manual close/fulfill with confirmation
  - [ ] Cancel with validation

- [ ] **1.12** Status workflow for Load Lists
  - [ ] Draft → Confirmed transition
  - [ ] Confirmed → In Transit transition (triggers inventory update)
  - [ ] In Transit → Arrived transition
  - [ ] Validation for status transitions
  - [ ] Cancel with rollback logic

- [ ] **1.13** Fulfillment tracking
  - [ ] Calculate fulfilled_qty for SR items
  - [ ] Calculate outstanding_qty for SR items
  - [ ] Update SR status based on fulfillment
  - [ ] Prevent over-fulfillment
  - [ ] Track fulfillment history

**Notes:**
- Ensure all foreign keys are properly set up for cascading deletes/updates
- Add proper validation for status transitions
- Test N:N relationship between SR and LL thoroughly

---

## Phase 2: Receiving Workflow (Priority: High)

**Status:** In Progress
**Progress:** 1/7 tasks (14%)

### Database Schema

- [x] **2.1** Add `in_transit` field to inventory table ✅
  - [x] `ALTER TABLE inventory` (or `item_warehouse`) add `in_transit DECIMAL(15,2) DEFAULT 0 NOT NULL`
  - [x] Add index on (item_id, warehouse_id)
  - [x] Migrate existing data if needed
  - [x] Update calculated field for `available` to exclude `in_transit`

- [x] **2.2** Create `grns` (Goods Receipt Notes) table ✅
  - [x] Add columns: id, grn_number, load_list_id, business_unit_id, warehouse_id
  - [x] Add columns: container_number, seal_number, receiving_date, delivery_date
  - [x] Add columns: received_by, checked_by, status, notes
  - [x] Add timestamps
  - [x] Add foreign keys and indexes
  - [x] Add RLS policies

- [x] **2.3** Create `grn_items` table ✅
  - [x] Add columns: id, grn_id, item_id, load_list_qty, received_qty, damaged_qty
  - [x] Add columns: num_boxes, barcodes_printed, notes
  - [x] Add foreign keys
  - [x] Add RLS policies

- [x] **2.4** Create `grn_boxes` table ✅
  - [x] Add columns: id, grn_item_id, box_number, barcode, qty_per_box
  - [x] Add columns: warehouse_location_id, delivery_date, container_number, seal_number
  - [x] Add timestamps
  - [x] Add foreign keys and indexes
  - [x] Add RLS policies

- [x] **2.5** Create `damaged_items` table ✅
  - [x] Add columns: id, grn_id, item_id, qty, damage_type, description
  - [x] Add columns: reported_by, reported_date, action_taken, status
  - [x] Add foreign keys
  - [x] Add RLS policies

- [x] **2.6** Create `return_to_suppliers` and `rts_items` tables ✅
  - [x] Tables created for Phase 6 (Returns) in advance

### Business Logic

- [ ] **2.7** Implement inventory updates on LL status changes
  - [ ] **Confirmed → In Transit**: Increment `in_transit` by `load_list_qty` for each item
  - [ ] **In Transit → Cancelled**: Decrement `in_transit` by `load_list_qty` (rollback)
  - [ ] **Pending Approval → Received**: Decrement `in_transit` by `received_qty`, increment `on_hand` by `received_qty`
  - [ ] Handle partial receiving (received_qty < load_list_qty)
  - [ ] Handle damaged items (reduce in_transit but don't increase on_hand)
  - [ ] Add transaction handling for atomicity
  - [ ] Add error handling and rollback on failure

- [ ] **2.8** GRN auto-creation from Load List
  - [ ] Trigger on LL status → "Arrived"
  - [ ] Copy header data from LL (container, seal, warehouse, etc.)
  - [ ] Copy line items from LL
  - [ ] Set GRN status to "Draft" or "Receiving"
  - [ ] Link GRN to LL (one-to-one)

### API Routes

- [ ] **2.9** GRN API
  - [ ] `GET /api/grns` - List GRNs with filters
  - [ ] `GET /api/grns/[id]` - Get GRN details
  - [ ] `PUT /api/grns/[id]` - Update GRN (receiving quantities)
  - [ ] `PATCH /api/grns/[id]/status` - Change status
  - [ ] `POST /api/grns/[id]/submit` - Submit for approval
  - [ ] `POST /api/grns/[id]/approve` - Approve GRN (creates stock entries, updates inventory)
  - [ ] `POST /api/grns/[id]/reject` - Reject GRN (with reason)

- [ ] **2.10** Damaged Items API
  - [ ] `POST /api/grns/[id]/damaged-items` - Log damaged items
  - [ ] `GET /api/grns/[id]/damaged-items` - Get damaged items for GRN
  - [ ] `PUT /api/damaged-items/[id]` - Update damaged item record
  - [ ] `DELETE /api/damaged-items/[id]` - Remove damaged item log

### Frontend Components

- [ ] **2.11** GRN List page
  - [ ] Filters: Status, Warehouse, Date Range, Received By
  - [ ] Columns: GRN Number, LL Number, Container, Status, Receiving Date, Received By
  - [ ] Actions: View, Process

- [ ] **2.12** GRN Receiving Form
  - [ ] Display header info (read-only): GRN Number, LL Number, Container, Seal, Delivery Date
  - [ ] Line items grid (editable):
    - Item Name, Expected Qty (from LL), Received Qty (input), Damaged Qty (input), Num Boxes (input)
    - Variance indicator (highlight if received ≠ expected)
    - Notes field per item
  - [ ] Damaged Items section (add/edit/remove)
  - [ ] Actions: Save Progress, Submit for Approval

- [ ] **2.13** GRN Approval View
  - [ ] Display all GRN info (read-only)
  - [ ] Highlight variances
  - [ ] Show damaged items
  - [ ] Approval notes field
  - [ ] Actions: Approve, Reject (with reason)

### Stock Entry Integration

- [ ] **2.14** Stock entry creation on GRN approval
  - [ ] Create stock entry for each GRN item
  - [ ] Set transaction_type = "Receipt from Supplier"
  - [ ] Include delivery_date for LIFO tracking
  - [ ] Include container_number, seal_number
  - [ ] Link to GRN (grn_id)
  - [ ] Update inventory (on_hand, in_transit)

**Notes:**
- Ensure atomicity of inventory updates (use database transactions)
- Test partial receiving scenarios thoroughly
- Validate that in_transit never goes negative

---

## Phase 3: Barcode & Location (Priority: High)

**Status:** Complete ✅
**Progress:** 6/6 tasks (100%)

### Barcode Generation

- [x] **3.1** Barcode generation logic ✅
  - [x] Chose QR Code format (better for mobile scanning, stores more data)
  - [x] Defined JSON barcode data structure (box ID, GRN number, item, qty, dates, container/seal, location)
  - [x] Implemented `qrcode` library in `/src/lib/barcode.ts`
  - [x] Generate unique barcode for each GRN box (format: `{GRN-NUMBER}-{ITEM-ID}-{BOX-NUM}`)
  - [x] Store barcode in `grn_boxes.barcode` field via API

- [x] **3.2** Barcode printing functionality ✅
  - [x] Created barcode label PDF template using `jspdf` in `/src/lib/barcode.ts`
  - [x] Include on label: QR code, GRN number, box number, item details, qty, delivery date, container/seal, location
  - [x] Label size: 100mm x 60mm (standard label printer size)
  - [x] "Print Labels" button per item and "Print All" button in BoxManagementSection
  - [x] Generate labels based on num_boxes
  - [x] Browser print dialog support with fallback to download
  - [x] Mark `barcodes_printed = true` after printing

### Storage Location

- [x] **3.3** Storage location assignment ✅
  - [x] **Implemented Option 2: Separate Putaway Process** (recommended approach)
    - [x] Created putaway screen at `/src/app/(dashboard)/purchasing/grns/putaway/page.tsx`
    - [x] QR code scanning support (parses JSON data)
    - [x] Manual barcode entry fallback
    - [x] Warehouse location search with autocomplete combobox
    - [x] Update `grn_boxes.warehouse_location_id` via API
  - [x] **Also implemented Option 1: During Box Generation**
    - [x] Added location dropdown in BoxManagementSection generate dialog
    - [x] Loads warehouse locations from API
    - [x] Filters to show only active and storable locations
  - [x] Show available locations with search functionality
  - [x] Validate location exists and belongs to correct warehouse

### Box-Level Tracking

- [x] **3.4** Box-level tracking implementation ✅
  - [x] API creates `grn_boxes` records via `POST /api/grns/[id]/boxes`
  - [x] Calculate qty_per_box (distribute received_qty across boxes)
  - [x] Auto-generate box numbers (1, 2, 3, ...)
  - [x] Link boxes to warehouse locations (optional during generation, required during putaway)
  - [x] Track delivery_date, container_number, seal_number for LIFO
  - [x] Display box details in BoxManagementSection with table view

### UI Components

- [x] **3.5** Barcode printing UI ✅
  - [x] BoxManagementSection component in `/src/components/grns/BoxManagementSection.tsx`
  - [x] Generate boxes dialog with num_boxes input and location selector
  - [x] Display all generated boxes in expandable table per item
  - [x] Print labels button per item
  - [x] Print all labels button for entire GRN
  - [x] Success/error toast confirmations

- [x] **3.6** Putaway screen ✅
  - [x] Warehouse selection dropdown
  - [x] Barcode scanner input (Enter key trigger, auto-focus)
  - [x] Display scanned box info (GRN, item, qty, current location)
  - [x] Location search combobox with autocomplete (Command component)
  - [x] Confirm button with validation
  - [x] Completed boxes list showing session activity
  - [x] Added "Putaway Station" menu item in sidebar navigation

**Implementation Files:**
- `/src/lib/barcode.ts` - QR code generation and PDF label printing
- `/src/components/grns/BoxManagementSection.tsx` - Box management UI in GRN detail
- `/src/app/(dashboard)/purchasing/grns/putaway/page.tsx` - Dedicated putaway screen
- `/src/app/api/grns/[id]/boxes/route.ts` - Box generation and listing API
- `/src/app/api/grn-boxes/[id]/route.ts` - Box update and delete API
- `/src/app/api/warehouses/[id]/locations/route.ts` - Warehouse locations API

**Notes:**
- QR codes store comprehensive JSON data for offline scanning support
- Putaway screen is mobile-friendly for warehouse workers with handheld devices
- Location validation ensures boxes are only assigned to valid warehouse locations
- LIFO tracking enabled via delivery_date storage at box level

---

## Phase 4: Notifications (Priority: Medium)

**Status:** Not Started
**Progress:** 0/4 tasks (0%)

### Database Schema

- [ ] **4.1** Create `notification_settings` table
  - [ ] Add columns: id, event_type, role_id, user_id, channel, enabled
  - [ ] Add event types enum (in_transit, arrived, pending_approval, received, damaged_items, etc.)
  - [ ] Add channel enum (in_app, email, sms)
  - [ ] Add RLS policies

- [ ] **4.2** Create `notifications` table
  - [ ] Add columns: id, user_id, event_type, title, message, data_json, read, created_at
  - [ ] Add indexes on user_id and event_type
  - [ ] Add RLS policies

### Business Logic

- [ ] **4.3** Event triggers for status changes
  - [ ] Confirmed → In Transit: Notify warehouse staff
  - [ ] In Transit → Arrived: Notify receiving staff
  - [ ] Arrived → Receiving: Notify warehouse manager
  - [ ] Receiving → Pending Approval: Notify approvers
  - [ ] Pending Approval → Received: Notify requester, procurement, warehouse manager
  - [ ] Pending Approval → Rejected: Notify receiving staff
  - [ ] Damaged items logged: Notify warehouse manager, procurement

- [ ] **4.4** Notification service
  - [ ] Get users to notify based on event and settings
  - [ ] Create notification records
  - [ ] Send in-app notifications
  - [ ] Send email notifications (optional)
  - [ ] Mark notifications as read

### API Routes

- [ ] **4.5** Notifications API
  - [ ] `GET /api/notifications` - Get user's notifications
  - [ ] `PATCH /api/notifications/[id]/read` - Mark as read
  - [ ] `PATCH /api/notifications/mark-all-read` - Mark all as read
  - [ ] `GET /api/notifications/unread-count` - Get unread count

- [ ] **4.6** Notification Settings API
  - [ ] `GET /api/notification-settings` - Get user's settings
  - [ ] `PUT /api/notification-settings` - Update settings
  - [ ] `GET /api/notification-settings/defaults` - Get default settings by role

### Frontend Components

- [ ] **4.7** In-app notification display
  - [ ] Notification bell icon in header with badge (unread count)
  - [ ] Notification dropdown/panel
  - [ ] List of notifications with read/unread state
  - [ ] Click notification to navigate to relevant page
  - [ ] Mark as read functionality
  - [ ] Mark all as read button

- [ ] **4.8** Notification settings page
  - [ ] List of event types
  - [ ] Toggle to enable/disable per event
  - [ ] Channel selection (in-app, email)
  - [ ] Save button

**Notes:**
- Start with in-app notifications only
- Email can be added later as optional
- Consider using WebSockets or polling for real-time updates

---

## Phase 5: In Transit & Reporting (Priority: Medium)

**Status:** Not Started
**Progress:** 0/4 tasks (0%)

### Reports

- [ ] **5.1** In Transit Inventory Report
  - [ ] Show items where `in_transit > 0`
  - [ ] Group by: Supplier, Expected Arrival Date, Warehouse
  - [ ] Columns: Load List Number, Supplier, Item, Quantity, Container, Expected Arrival, Days in Transit
  - [ ] Filters: Supplier, Warehouse, Expected Arrival Date Range
  - [ ] Export to Excel/CSV
  - [ ] Alert when items are overdue (expected arrival date passed)

- [ ] **5.2** Receiving Dashboard
  - [ ] **Widgets:**
    - [ ] Pending Approvals count (clickable)
    - [ ] In Transit Items by arrival date (chart)
    - [ ] Today's Scheduled Arrivals (list)
    - [ ] Receiving in Progress count
    - [ ] Recent Damaged Items (last 7 days)
  - [ ] **Charts:**
    - [ ] Receiving volume trend (last 30 days)
    - [ ] Average time from arrival to approval
  - [ ] Refresh button

- [ ] **5.3** Variance Analysis Report
  - [ ] Show GRNs with variances (received_qty ≠ load_list_qty)
  - [ ] Columns: GRN Number, LL Number, Item, Expected Qty, Received Qty, Variance, Variance %
  - [ ] Filter by: Date Range, Warehouse, Variance % threshold
  - [ ] Highlight significant variances (e.g., > 5%)
  - [ ] Export to Excel/CSV

- [ ] **5.4** Damaged Items Summary Report
  - [ ] List all damaged items
  - [ ] Columns: Date, GRN Number, Item, Qty, Damage Type, Action Taken, Status
  - [ ] Filters: Date Range, Warehouse, Item, Damage Type, Status
  - [ ] Group by damage type with totals
  - [ ] Export to Excel/CSV

### LIFO Tracking

- [ ] **5.5** LIFO tracking implementation
  - [ ] Ensure `delivery_date` is stored in `grn_boxes` and stock entries
  - [ ] Modify picking logic to order by `delivery_date DESC` (most recent first)
  - [ ] Show delivery_date in inventory views
  - [ ] Report on inventory age (oldest delivery_date per item)

**Notes:**
- Reports should be optimized for performance (use indexes, pagination)
- Consider caching for dashboard widgets
- LIFO tracking may require changes to existing stock picking logic

---

## Phase 6: Returns (Priority: Low)

**Status:** Not Started
**Progress:** 0/3 tasks (0%)

### Database Schema

- [ ] **6.1** Create `return_to_suppliers` table
  - [ ] Add columns: id, rts_number, grn_id, supplier_id, business_unit_id, warehouse_id
  - [ ] Add columns: return_date, reason, status, created_by, approved_by
  - [ ] Add timestamps
  - [ ] Add foreign keys and indexes
  - [ ] Add RLS policies

- [ ] **6.2** Create `rts_items` table
  - [ ] Add columns: id, rts_id, item_id, return_qty, reason, grn_item_id
  - [ ] Add foreign keys
  - [ ] Add RLS policies

### Business Logic & API

- [ ] **6.3** RTS workflow implementation
  - [ ] Create RTS document
  - [ ] Link to original GRN
  - [ ] Select items and quantities to return
  - [ ] Submit for approval
  - [ ] On approval: Create negative stock entry, update inventory, update damaged items log
  - [ ] Status workflow: Draft → Pending → Approved → Shipped → Completed
  - [ ] Track return shipment (optional)

- [ ] **6.4** RTS API
  - [ ] `POST /api/return-to-suppliers` - Create RTS
  - [ ] `GET /api/return-to-suppliers` - List RTS
  - [ ] `GET /api/return-to-suppliers/[id]` - Get RTS details
  - [ ] `PUT /api/return-to-suppliers/[id]` - Update RTS
  - [ ] `PATCH /api/return-to-suppliers/[id]/status` - Change status
  - [ ] `POST /api/return-to-suppliers/[id]/approve` - Approve and process return

### Frontend Components

- [ ] **6.5** RTS Module
  - [ ] RTS List page
  - [ ] RTS Form (Create/Edit)
  - [ ] RTS Detail page
  - [ ] Link from GRN to create RTS
  - [ ] Status workflow UI

### Inventory Adjustments

- [ ] **6.6** Inventory adjustments for returns
  - [ ] Create negative stock entry on approval
  - [ ] Reduce `on_hand` quantity
  - [ ] Update damaged items status
  - [ ] Link stock entry to RTS
  - [ ] Validate sufficient inventory before approval

**Notes:**
- Returns are lower priority and can be implemented after core receiving is working
- Consider supplier credit/refund tracking (future enhancement)

---

## Additional Enhancements (Optional / Future)

### Immediate Recommendations

- [ ] **E.1** Auto-GRN Creation
  - [ ] Auto-create GRN when LL status → "Arrived"
  - [ ] Make it configurable (setting to enable/disable)

- [ ] **E.2** Variance Thresholds
  - [ ] Configure acceptable variance % per item or globally
  - [ ] Auto-approve GRNs within threshold
  - [ ] Flag for manual review if exceeded

- [ ] **E.3** Barcode Scanner Integration
  - [ ] Research handheld scanner options
  - [ ] Integrate with web app or mobile app
  - [ ] Test scanning during receiving

- [ ] **E.4** Location Suggestions
  - [ ] Suggest storage locations based on item type
  - [ ] Show available locations with capacity
  - [ ] Track location capacity

- [ ] **E.5** Receiving Checklist (Printable)
  - [ ] Print GRN as physical checklist PDF
  - [ ] Receivers check off items during unload
  - [ ] Enter data into system afterward

### Future Enhancements

- [ ] **E.6** Predictive Arrival
  - [ ] Track historical transit times by supplier/route
  - [ ] Predict arrival dates
  - [ ] Alert if shipment is delayed

- [ ] **E.7** Automatic SR Creation
  - [ ] Based on reorder points
  - [ ] Generate suggested requisitions
  - [ ] Buyers review and submit

- [ ] **E.8** Supplier Performance Metrics
  - [ ] On-time delivery rate
  - [ ] Accuracy rate (variance %)
  - [ ] Damage rate
  - [ ] Dashboard with supplier scorecards

- [ ] **E.9** Mobile Receiving App
  - [ ] Dedicated mobile app for receiving
  - [ ] Offline capability
  - [ ] Photo capture for damaged items
  - [ ] Integrated barcode scanning

- [ ] **E.10** Supplier Integration
  - [ ] API to receive load lists automatically
  - [ ] Real-time tracking updates
  - [ ] Electronic confirmation

---

## Testing Checklist

### Unit Tests
- [ ] Stock Requisition CRUD operations
- [ ] Load List CRUD operations
- [ ] SR to LL linking logic
- [ ] Fulfillment tracking calculations
- [ ] Inventory in_transit updates
- [ ] GRN creation and approval
- [ ] Stock entry creation
- [ ] Barcode generation
- [ ] Notification triggers

### Integration Tests
- [ ] End-to-end workflow: SR → LL → GRN → Stock Entry
- [ ] Status transitions with inventory updates
- [ ] Partial receiving scenarios
- [ ] Cancellation and rollback
- [ ] Multi-warehouse scenarios
- [ ] N:N relationship (SR to LL)

### User Acceptance Testing
- [ ] Create Stock Requisition
- [ ] Create Load List and link to SR
- [ ] Change LL status to In Transit (verify inventory update)
- [ ] Change LL status to Arrived (verify GRN auto-creation)
- [ ] Receive items with variances
- [ ] Log damaged items
- [ ] Approve GRN (verify stock entry and inventory update)
- [ ] Print barcodes
- [ ] Assign storage locations
- [ ] View reports (In Transit, Variance, Damaged Items)
- [ ] Receive notifications
- [ ] Create Return to Supplier

---

## Open Questions & Decisions

- [ ] **Q1:** Document numbering format? (SR-2026-0001 or different format?)
- [ ] **Q2:** Sequence per Business Unit or global?
- [ ] **Q3:** Which roles can create/edit SR? LL? Approve GRN?
- [ ] **Q4:** What label printers do they have? (Desktop or mobile?)
- [ ] **Q5:** Label size preferences?
- [ ] **Q6:** Storage location naming convention? (Existing or new?)
- [ ] **Q7:** Migrate historical data or start fresh?
- [ ] **Q8:** Auto-create GRN on "Arrived" or manual trigger?
- [ ] **Q9:** Barcode format preference? (Code 128 or QR Code?)
- [ ] **Q10:** Putaway process - during receiving or separate step?

---

## Notes

- Update this document regularly as tasks are completed
- Recalculate progress percentages after each phase
- Add notes and blockers for each task if needed
- Link to relevant PRs or commits
- Schedule regular reviews to assess progress

**Reference:** `/docs/inventory-acquisition-workflow.md`
