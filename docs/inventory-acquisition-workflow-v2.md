# Inventory Acquisition Workflow Plan (Revised v2)

## Executive Summary

This revision resolves inconsistencies in the original plan and strengthens the workflow for receiving, inventory updates, pricing, and traceability. The core change: **inventory movements are posted only on GRN approval**, with Load List (LL) states driving operational workflow but not directly updating on-hand stock.

---

## 1. Document Flow Overview

```
Stock Requisition (SR)
    ↓ (N:N relationship via fulfillment)
Load List (LL) - Supplier's shipment document
    ↓ (1:N relationship)
Goods Receipt Note(s) (GRN) - Receiving sessions
    ↓ (After GRN Approval)
Stock Ledger Entries (Inventory updates)
    ↓ (If needed)
Return to Supplier (RTS)
```

**Key Relationship Updates:**
- N Stock Requisitions → N Load Lists (many-to-many)
- **1 Load List → N GRNs** (supports partial or multi-day receiving)
- 1 GRN → N Stock Ledger Entries (per item line)

---

## 2. Document Entities (Revisions)

### 2.1 Stock Requisition (SR)

**Purpose:** Internal request to supplier via phone/email (no formal PO)

**Key Fields (unchanged):**
- `dr_number`, `business_unit_id`, `supplier_id`, `requisition_date`, `requested_by`
- `status`: Draft, Submitted, Partially Fulfilled, Fulfilled, Cancelled
- `notes`, `total_amount` (estimated)

**Line Items:** `stock_requisition_items`
- `item_id`, `requested_qty`, `unit_price`, `total_price`
- `fulfilled_qty`, `outstanding_qty`, `notes`

**Clarifications:**
- SR prices are **estimates** and may be overridden at GRN.
- Fulfillment is updated when GRN lines are approved, not when LLs are linked.

---

### 2.2 Load List (LL)

**Purpose:** Supplier’s shipment document used for operational tracking

**Key Fields (unchanged):**
- `ll_number`, `supplier_ll_number`, `business_unit_id`, `supplier_id`, `warehouse_id`
- `container_number`, `seal_number`, `estimated_arrival_date`, `actual_arrival_date`
- `load_date`, `status`, `created_by`, `received_by`, `approved_by`
- `received_date`, `approved_date`, `notes`

**Line Items:** `load_list_items`
- `item_id`, `load_list_qty`, `unit_price`, `total_price`, `notes`
- `received_qty`, `damaged_qty`, `shortage_qty` (computed)

**Linking Table:** `load_list_dr_items`
- `load_list_item_id`, `dr_item_id`, `fulfilled_qty`

**Clarifications:**
- LL is **operational source** for shipment quantities.
- **Inventory is NOT updated by LL status.**

---

### 2.3 Goods Receipt Note (GRN)

**Purpose:** Internal receiving document; **only GRN Approval posts inventory**

**Key Fields:**
- `grn_number`, `load_list_id`, `business_unit_id`, `warehouse_id`
- `container_number`, `seal_number`, `receiving_date`, `delivery_date`
- `received_by`, `checked_by`, `status`, `notes`

**Line Items:** `grn_items`
- `item_id`, `load_list_qty`, `received_qty`, `damaged_qty`
- `num_boxes`, `barcodes_printed`, `notes`
- **`unit_price`** (GRN-level actual price; can override SR/LL)

**Box/Carton Tracking:** `grn_boxes`
- `grn_item_id`, `box_number`, `barcode`, `qty_per_box`
- `warehouse_location_id`, `delivery_date`, `container_number`, `seal_number`

**Clarifications:**
- A single LL can generate **multiple GRNs** (partial receiving).
- Rejections return to Receiving on the same GRN.

---

### 2.4 Stock Ledger (Inventory Updates)

**Purpose:** Audit trail for all inventory quantity movements

**Key Fields (new/recommended):**
- `stock_ledger_id`, `item_id`, `warehouse_id`
- `qty_delta`, `transaction_type`, `source_doc_type`, `source_doc_id`
- `delivery_date`, `location_id`, `created_at`, `created_by`

**Inventory Table Fields:**
`on_hand`, `in_transit`, `reserved`, `available` (derived)

---

### 2.5 Damaged Items Log (unchanged)

**Enhancement:**
Add `resolution_status`: pending, confirmed, disputed, returned, written_off

---

### 2.6 Return to Supplier (RTS)

**Clarification:**
- If damage is confirmed **before** GRN approval, items are never added to on_hand.
- If discovered after approval, RTS creates a negative stock ledger entry.

---

## 3. Status Workflows (Revised)

### 3.1 SR Status Flow (same)

```
Draft → Submitted → Partially Fulfilled → Fulfilled
                                      ↓
                                  Cancelled
```

**Update Rule:** Fulfillment updates only after GRN Approval.

---

### 3.2 Load List Status Flow (Operational Only)

```
Draft → Confirmed → In Transit → Arrived → Receiving → Pending Approval → Received
                                                                       ↓
                                                                  Cancelled
```

**System Actions (Revised):**
- **Confirmed → In Transit**
  - Increment `inventory.in_transit` by `load_list_qty`
  - Notify warehouse
- **In Transit → Arrived**
  - Auto-create first GRN
- **Receiving / Pending Approval**
  - Operational only (no stock updates)
- **Pending Approval → Received**
  - Set to Received when **all GRNs are Approved**
- **Cancelled (from In Transit)**
  - Decrement `in_transit` by `load_list_qty`

---

### 3.3 GRN Status Flow (Inventory Authority)

```
Draft → Receiving → Pending Approval → Approved
                            ↓
                        Rejected (back to Receiving)
```

**Inventory Updates (only on GRN Approved):**
- Decrement `in_transit` by:
  - `received_qty` + confirmed `damaged_qty` + confirmed `shortage_qty`
- Increment `on_hand` by:
  - `received_qty` - confirmed `damaged_qty`
- Post stock ledger entries
- Update SR fulfilled quantities

---

## 4. Receiving Variance Rules (New)

### 4.1 Shortage Handling

- Shortages are tracked with `resolution_status`:
  - `pending` → `confirmed` → `resolved`
- Only **confirmed** shortages reduce `in_transit`.

### 4.2 Over-Receipt Handling

- If `received_qty > load_list_qty`:
  - Require supervisor approval
  - Log variance record
  - Optionally create a supplemental LL item entry

---

## 5. Pricing & Valuation Rules (New)

- SR price = estimate
- LL price = supplier-stated price (may be used for reference)
- **GRN price = actual receiving price**
- Stock valuation uses GRN price
- Store a `price_source` field on GRN items (SR/LL/override)

---

## 6. Putaway & Location (Clarified)

Introduce a post-receipt state:
- `received_unputaway` vs `on_hand_putaway`
- Items can be available but flagged as **unlocated**
- Putaway process:
  - Scan box barcode
  - Assign location
  - Update `grn_boxes.warehouse_location_id`

---

## 7. Inventory Tracking (Revised)

**In Transit Updates:**
- Confirmed → In Transit: increment by `load_list_qty`
- Cancelled (from In Transit): decrement by `load_list_qty`
- GRN Approved: decrement by confirmed `received_qty + damaged + shortage`

**Availability:**
- `available = on_hand - reserved`
- In-transit is visible but not available

---

## 8. LIFO/FIFO Configuration (Revised)

Because LIFO has compliance implications:
- Configure **inventory valuation method per BU**:
  - FIFO / LIFO / Weighted Avg
- Keep `delivery_date` on GRN/boxes for sequencing where LIFO is required

---

## 9. Data Model Summary (Updated)

**Additions/Changes:**
- `grn_items.unit_price`, `grn_items.price_source`
- `damaged_items.resolution_status`
- Optional `stock_ledger` table for audit
- Allow multiple GRNs per LL

---

## 10. Implementation Phases (Updated)

### Phase 1: Core Documents
- SR, LL CRUD
- SR ↔ LL linking
- Fulfillment tracking (post-GRN approval only)

### Phase 2: Receiving Workflow
- GRN auto-creation
- Variance handling
- Approval workflow
- Stock ledger entries on GRN approval

### Phase 3: Barcode & Putaway
- Box-level barcode
- Location assignment
- Putaway completion

### Phase 4: Notifications
- Status-based alerts
- Role-based settings

### Phase 5: Reporting
- In-transit report
- Variance analysis
- Receiving performance

### Phase 6: Returns
- RTS workflow
- Stock adjustments

---

## 11. Open Decisions (Updated)

1. **Can a Load List have multiple GRNs?** (recommended: yes)
2. **Over‑receipt policy?** (allow with approval vs reject)
3. **Inventory valuation method per BU?** (FIFO/LIFO/WA)
4. **Putaway required before availability?** (yes/no)

---

## Conclusion

This revision enforces a single source of truth for inventory updates (GRN approval), removes timing inconsistencies, and adds missing controls for variance, pricing, and auditability. It’s now aligned with real-world warehouse receiving, multi-day partial receipts, and strict inventory traceability.
