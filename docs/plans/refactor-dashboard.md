You are a senior full-stack engineer working on an ERP web app. Implement a **Warehouse Operator Dashboard** exactly as specified below. Follow the constraints strictly. Do not add extra modules or analytics beyond what is listed.

---

## 0) Goal

Build a **Warehouse Operator Dashboard** that shows:
1) **Incoming Deliveries**
2) **Stock Requests / Withdrawals**
3) **Pick List**
4) **Last 5 Stock Movements**
5) **Low Stocks**
6) **Out of Stocks**

The dashboard must be operational (action-first) and role-appropriate for warehouse staff.

---

## 1) Non-Functional Requirements

- **Fast**: initial load under 2 seconds for typical warehouse dataset.
- **Mobile-friendly**: works on tablet; large tap targets.
- **Minimal scrolling**: critical items above the fold.
- **No charts**. Use cards + lists only.
- **Clickable counts**: each summary card navigates to its respective list view.
- **Secure**: apply existing RLS / permission checks; user can only see allowed warehouse/business unit data.
- **Deterministic**: stable ordering; consistent statuses.

---

## 2) Role & Access

- Must show data only for:
  - the user's allowed Business Unit(s) / Warehouse(s) (use existing permission/RLS logic)
  - the user's default selected BU if your app supports BU switching

---

## 3) UI Layout Specification (Exact)

### 3.1 Top Summary Row (3 cards)
At the top, show 3 cards with:
- **📦 Incoming Deliveries (Today)**: count
- **📤 Stock Requests / Withdrawals (Pending)**: count
- **🧾 Pick List (To Pick)**: count

Card behavior:
- Entire card clickable.
- Navigates to:
  - Incoming Deliveries list view
  - Stock Requests/Withdrawals list view
  - Pick List view

Card content:
- Title
- Count (large)
- Subtext (small): e.g., "Today", "Pending", "To Pick"

### 3.2 Inventory Health (2 columns)
Below summary row:
- Left panel: **Low Stocks** (list, max 8 items)
- Right panel: **Out of Stocks** (list, max 8 items)

Each row shows:
- Item name (primary)
- On-hand qty + UOM (secondary)
- Optional: primary location code (if available)
Row click => item detail page (or item stock/location page).

### 3.3 Operational Queue (Tabbed)
Below inventory health:
Tabs:
- Default tab: **Pick List**
- Tab 2: **Incoming Deliveries**
- Tab 3: **Stock Requests / Withdrawals**

Each tab is a compact queue list (max 12 rows) with:
- Identifier (SO/PO/REQ number)
- Counter fields (item lines, qty summary)
- Priority badge (if supported) or status badge
- CTA button on each row:
  - Pick List: **Start Picking**
  - Incoming Deliveries: **Start Receiving**
  - Requests: **Process Request**

Row click opens details; CTA starts the workflow screen.

### 3.4 Last 5 Stock Movements
Bottom section:
- Title: "Last 5 Stock Movements"
- List exactly 5 most recent movements (filtered to allowed warehouse/BU)
Each row:
- Movement type badge: IN/OUT/ADJ/TRANSFER (based on your system)
- Item name
- Qty + UOM
- Timestamp (local)
- Performed by (user name if available)

Ordering:
- Most recent first
- Stable tie-breaker: created_at DESC, id DESC

---

## 4) Data Requirements & Logic

You must implement server endpoints (or service functions) that return exactly what the UI needs.

### 4.1 Definitions

#### Incoming Deliveries (Today)
- Deliveries scheduled for today OR created today with status in:
  - `PENDING`, `ARRIVING`, `RECEIVING` (adapt to your enums)
- Count shown in top card uses these rules.
- Tab list shows up to 12, sorted by ETA ASC then created_at ASC.

#### Stock Requests / Withdrawals (Pending)
- Requests with status:
  - `PENDING`, `APPROVED` (if warehouse still needs to fulfill), `FOR_PICK` (adapt)
- Count in top card = all statuses that require warehouse action.
- Tab list up to 12, sorted by priority DESC then created_at ASC.

#### Pick List (To Pick)
- Pick tasks/orders with status:
  - `READY_TO_PICK` / `PICKING` (if assigned to current user) (adapt)
- Count in top card = READY_TO_PICK (not completed)
- Tab list up to 12, sorted by priority DESC then requested_ship_date ASC then created_at ASC.

#### Low Stocks
- Source of truth: `item_warehouse.on_hand_qty` (or equivalent)
- Low stock criteria:
  - `on_hand_qty > 0` AND `on_hand_qty <= reorder_level`
- List sorted by (on_hand_qty / reorder_level) ASC then on_hand_qty ASC.
- Limit 8 items.

#### Out of Stocks
- Criteria:
  - `on_hand_qty <= 0`
- Sort by most recently moved items first:
  - join with stock_transactions for last movement date, order last_moved_at DESC.
- Limit 8 items.

#### Last 5 Stock Movements
- Source: `stock_transactions` (or equivalent)
- Show last 5 by created_at DESC
- Filter by allowed warehouse/BU
- Include actor name if available.

---

## 5) API Contract (Example)

Implement an endpoint (or equivalent) that returns all dashboard data in one call to reduce round trips:
Response shape:

```json
{
  "summary": {
    "incoming_deliveries_today": 3,
    "pending_stock_requests": 5,
    "pick_list_to_pick": 7
  },
  "low_stocks": [
    {"item_id":"...", "item_name":"...", "qty":8, "uom":"pcs", "location_code":"A1-01"}
  ],
  "out_of_stocks": [
    {"item_id":"...", "item_name":"...", "qty":0, "uom":"pcs", "location_code":"B2-03"}
  ],
  "queues": {
    "pick_list": [
      {"id":"SO-1001", "lines":5, "priority":"HIGH", "status":"READY_TO_PICK"}
    ],
    "incoming_deliveries": [
      {"id":"PO-2002", "supplier":"...", "eta":"2026-01-11T14:00:00+08:00", "status":"ARRIVING"}
    ],
    "stock_requests": [
      {"id":"REQ-3003", "requested_by":"...", "lines":3, "status":"APPROVED", "priority":"NORMAL"}
    ]
  },
  "last_stock_movements": [
    {"type":"OUT", "item_name":"Cement 40kg", "qty":5, "uom":"pcs", "at":"2026-01-11T10:18:00+08:00", "by":"Juan"}
  ]
}
Notes:

Adjust identifiers and fields to match the existing schema.

Keep it stable and consistent.

6) Frontend Implementation Notes
Dashboard route: /dashboard

Use a responsive grid:

Summary row: 3 cards across desktop, stacked on mobile

Inventory health: 2 columns desktop, stacked on mobile

Lists should be compact but readable.

Every card count and row must be clickable:

Cards: route to list pages

Rows: open detail

CTA buttons: open workflow start screen

7) Backend Implementation Notes
Use existing auth context to determine:

user_id

allowed warehouses/BUs

Apply RLS / filters in every query.

Optimize:

Prefer one aggregated query per section

Add indexes if needed on:

stock_transactions(created_at)

item_warehouse(warehouse_id, on_hand_qty)

request/order status fields

Ensure time zone correctness (Asia/Manila +08:00). "Today" uses local date.

8) Acceptance Criteria (Must Pass)
Dashboard shows all six sections exactly as specified.

Counts match the list data filters.

Low/Out of stock lists show correct items and are limited.

Tabs load quickly and show <= 12 rows each.

Last 5 stock movements always shows exactly 5 rows if available.

All navigation and CTA actions work.

User sees only permitted warehouse/BU data.

No charts are present.

9) Deliverables
Provide:

Database query/service layer code

API endpoint/controller

Frontend page + components

Routing links for card clicks and row clicks

Basic tests for:

summary counts

low/out-of-stock logic

last 5 movements ordering

permission filtering

Implement now.