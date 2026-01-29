# Warehouse Tablet Companion App (Browser-Based)

## 1. Product Goal and Constraints

### Goal
Build a tablet-first browser application for warehouse staff to:
- Receive incoming stocks from Purchase Receipts
- View and act on Stock Requests
- Pick and prepare items that are ready for picking
- Provide a fast, simple UX optimized for touch and scanning

### Constraints
- Runs in a browser (no native app yet)
- Tablet view is the primary target (not phone)
- Must follow the same interaction and architectural pattern as the existing Mobile Van Sales app

---

## 2. Primary User Roles

### Warehouse Receiver
- Views incoming purchase receipts
- Receives and confirms quantities
- Handles partial receipts, damaged or short items, and notes

### Picker
- Views stock requests that are ready for picking
- Executes pick lists
- Confirms picked quantities (partial picks allowed)
- Progresses request status

### Warehouse Clerk / Stock Controller (Optional)
- Can perform both receiving and picking
- Handles exceptions and adjustments if permitted

Role-based navigation is required.  
Receivers default to Receiving views, Pickers default to Picking views.

---

## 3. Core Modules and Workflows

## A. Receiving from Purchase Receipts (Inbound)

### Receipt Status Model
- Open
- In Progress
- Received (Complete)
- Received (Partial)
- Cancelled (optional)

### Receiving Workflow

#### 1. Receiving List
- Displays purchase receipts filtered by:
  - Date (Today / Last 7 Days)
  - Supplier
  - Status (Open, In Progress)
- Receipt card shows:
  - Supplier name
  - Receipt number
  - Expected item count
  - Created date
  - Status

#### 2. Receipt Detail
- Header information:
  - Supplier
  - Document number
  - Date
  - Warehouse
  - Notes
- Line items:
  - Item name and SKU
  - Expected quantity
  - Received quantity (editable)
  - Unit of Measure / Packaging
- Actions:
  - Start Receiving (marks receipt In Progress)
  - Receive All (auto-fill expected quantities)
  - Save Draft
  - Post Receipt (finalize)

#### 3. Receive Line Item
- Tablet-optimized input:
  - Large quantity stepper (+ / -)
  - Barcode scan to jump to item
  - Mark damaged or short quantity with reason

#### 4. Posting Receipt
- On post:
  - Create stock_transactions records
  - Update item_warehouse balances
  - Lock receipt from further editing

### Required Behaviors
- Support partial receiving
- Prevent double posting
- Maintain audit trail (user, timestamp, changes)

---

## B. Stock Requests and Picking (Outbound)

### Stock Request Status Model
- Submitted
- Approved
- Ready for Picking
- Picking
- Picked
- Released / Transferred

(Statuses may be simplified if needed.)

### Picking Workflow

#### 1. Requests List
- Tabs:
  - Submitted / Approved
  - Ready for Picking
  - Picking (In Progress)
  - Picked (Completed)
- Request card displays:
  - Request number
  - Source and destination
  - Priority or needed date
  - Item count
  - Status

#### 2. Request Detail
- Header:
  - Request information
  - Status
  - Created by
- Line items:
  - Requested quantity
  - Available quantity (from item_warehouse)
  - Picked quantity (editable)
  - Short pick reason if applicable
- Actions:
  - Start Picking (assigns picker and locks request)
  - Generate Pick List
  - Mark Pick Complete

#### 3. Pick List Execution
- One-item-at-a-time picking mode
- Prominent item name and SKU
- Quantity stepper
- Confirm Pick action
- Optional barcode scan confirmation
- Display location (bin/crate) if available

### Required Behaviors
- Only one picker may pick a request at a time
- Partial picking allowed
- Stock handling strategy:
  - Soft reserve on Start Picking, or
  - Deduct stock only on Pick Complete

---

## 4. Tablet-First UI Structure

### Navigation
- Receiving
- Picking
- Requests (optional if combined with Picking)
- Inventory Lookup (optional)
- Profile / Sync

### UI Pattern
- Mirrors existing Mobile Van Sales app:
  - List view (cards)
  - Detail view
  - Fixed bottom primary action
- Status colors and chips
- Touch-friendly spacing and controls

### Required UI Components
- Status indicators (chips or badges)
- Search and barcode scan input
- Draft handling for interrupted workflows

---

## 5. Data and Integration Assumptions

### Inventory Model
- item_warehouse is the single source of truth for stock balances
- stock_transactions records all inventory movements

### Transaction Mapping
- Receiving posts create stock_transactions of type PURCHASE_RECEIPT_IN
- Picking posts create stock_transactions of type PICK / ISSUE / TRANSFER_OUT
- Purchase Receipts and Stock Requests act as source documents

### Conceptual Tables
- purchase_receipts
- purchase_receipt_lines
- stock_requests
- stock_request_lines
- pick_sessions (optional but recommended)
- stock_transactions (existing)
- item_warehouse (existing)

---

## 6. Permissions Model

### Receiving
- can_view_receipts
- can_receive_receipts

### Picking
- can_view_requests
- can_pick_requests

### Administrative
- can_unpost_or_reverse (prefer reversal transactions over deletion)

---

## 7. MVP Scope

### MVP Features
- Receiving list and receipt detail
- Receive and post purchase receipts
- Requests list filtered to Ready for Picking
- Pick request and mark complete
- Basic audit fields (created_by, received_by, picked_by, timestamps)
- Search and basic filters

### Post-MVP Enhancements
- Barcode scanning optimization
- Location-guided picking (bin/crate)
- Offline draft queue and sync retries
- Notifications for new receipts or requests
- Native mobile companion app

---

## 8. Initial Page Routes

- /receiving
- /receiving/:receiptId
- /picking
- /picking/:requestId
- /pick-session/:sessionId (optional)

All pages must follow the same interaction model as the Mobile Van Sales app:
List → Detail → Fixed CTA → Confirmation → Success Feedback
