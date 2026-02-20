# Stock Request → Delivery Note → Pick–Dispatch–Receive

**Software Requirements Specification (SRS)**

---

## 1. Purpose

This document defines the system design, data model, business rules, and state transitions for handling Stock Requests (SR) and Delivery Notes (DN) in a warehouse inventory system.

The goal is to support:

- Multiple Stock Requests sourcing a single Delivery Note
- Partial and full allocation
- Controlled picking by assigned warehouse personnel
- Accurate dispatch and receipt inventory posting
- Deterministic SR status computation
- Full auditability and traceability

---

## 2. Scope

### In Scope

- Stock Request allocation via Delivery Notes
- Picking, dispatch, and receipt lifecycle
- Partial allocation and partial fulfillment
- Inventory allocation, deduction, and posting
- DN cancellation / voiding (pre-dispatch only)

### Out of Scope

- Packing workflows (items assumed pre-packed)
- Carrier routing, freight costing
- Financial invoicing
- Inventory valuation (FIFO/LIFO/etc.)

---

## 3. Terminology

| Term | Definition |
|------|------------|
| **Stock Request (SR)** | A request to move stock from a source entity to a destination entity |
| **Delivery Note (DN)** | Operational document used to pick, dispatch, and receive stock |
| **Allocation** | Reservation of inventory for a future dispatch |
| **Picking** | Physical warehouse operation of gathering allocated items |
| **Dispatch** | Posting of inventory out of the source entity |
| **Receipt** | Posting of inventory into the destination entity |
| **Short Pick** | Difference between allocated quantity and picked quantity |

---

## 4. Global Design Rules

### 4.1 Status Philosophy

- **Delivery Note status** is authoritative and user-driven
- **Stock Request status** is derived, never manually set
- SR status reflects aggregated reality, not workflow intent

---

## 5. Status Enums

### 5.1 Delivery Note Status (`delivery_note_status`)

```
DRAFT
CONFIRMED
PICKING_IN_PROGRESS
DISPATCH_READY
DISPATCHED
RECEIVED
VOIDED
```

- **Terminal state:** `RECEIVED`
- **`VOIDED`** allowed only pre-dispatch

### 5.2 Stock Request Status (`stock_request_status`) — Derived

```
DRAFT
SUBMITTED
ALLOCATING
PARTIALLY_ALLOCATED
ALLOCATED
DISPATCHED
PARTIALLY_FULFILLED
FULFILLED
```

- No `CLOSED` status
- Computed dynamically (see §8)

---

## 6. Data Model

### 6.1 Existing Tables (Altered Only)

#### `stock_requests`

- Header table (unchanged structurally)
- `status` MAY exist but is derived/cached only

#### `stock_request_items`

**Purpose:** Requested and fulfilled quantities per item

**Fields:**
- `id` (PK)
- `sr_id` (FK)
- `item_id`
- `uom_id`
- `requested_qty`
- `dispatched_qty`
- `received_qty` **(NEW)**
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Constraints:**
- `0 <= received_qty <= requested_qty`

**Removed:**
- `picked_qty`
- `short_qty`

### 6.2 New Tables (Delivery Note)

#### `delivery_notes`

**Purpose:** Operational document for pick–dispatch–receive

**Fields:**
- `id` (PK)
- `dn_no` (unique)
- `status` (enum)
- `source_entity_id`
- `destination_entity_id`
- `confirmed_at` (timestamp)
- `picking_started_at` (timestamp)
- `picking_started_by`
- `picking_completed_at` (timestamp)
- `picking_completed_by`
- `dispatched_at` (timestamp)
- `received_at` (timestamp)
- `voided_at` (timestamp)
- `void_reason`
- `driver_name`
- `driver_signature`
- `created_by`
- `created_at` (timestamp)
- `updated_at` (timestamp)

#### `delivery_note_sources`

**Purpose:** DN ↔ SR header mapping

**Fields:**
- `dn_id` (FK)
- `sr_id` (FK)
- **PK:** `(dn_id, sr_id)`

#### `delivery_note_items`

**Purpose:** Allocation, picking, and dispatch quantities

**Fields:**
- `id` (PK)
- `dn_id` (FK)
- `sr_id` (FK)
- `sr_item_id` (FK)
- `item_id`
- `uom_id`
- `allocated_qty`
- `picked_qty`
- `short_qty`
- `dispatched_qty`
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Invariants:**
- `picked_qty <= allocated_qty`
- `dispatched_qty <= picked_qty`
- `short_qty = allocated_qty - picked_qty`

#### `delivery_note_pickers`

**Purpose:** Authorization for picking

**Fields:**
- `dn_id`
- `user_id`
- `assigned_at` (timestamp)
- `assigned_by`

---

## 7. Business Rules

### 7.1 Allocation Rules

- Allocation occurs at DN creation
- Allocation locks at DN confirmation
- Allocation may not be edited after confirmation
- Undispatched allocation is released at dispatch

### 7.2 Picking Rules

**Picking can only start if:**
- DN is `CONFIRMED`
- Picker is assigned

**Only assigned pickers may:**
- Start picking
- Mark DN as dispatch-ready

### 7.3 Dispatch Rules

- DN must be `DISPATCH_READY`
- Driver signature is mandatory

**Dispatch:**
- Deducts inventory
- Reduces allocation
- Releases surplus allocation

### 7.4 Receipt Rules

- DN must be `DISPATCHED`

**Receipt:**
- Increases destination inventory
- Updates `stock_request_items.received_qty`
- DN terminal state = `RECEIVED`

### 7.5 DN Void Rules

**Allowed only if DN status is:**
- `DRAFT`
- `CONFIRMED`
- `PICKING_IN_PROGRESS`
- `DISPATCH_READY`

**Voiding:**
- Releases allocations
- Excludes DN from SR computations

---

## 8. Stock Request Status Derivation (Option A)

SR status is computed using precedence logic:

```
If total_received == total_requested → FULFILLED
Else if total_received > 0 → PARTIALLY_FULFILLED
Else if total_dispatched > 0 → DISPATCHED
Else if total_allocated == total_requested → ALLOCATED
Else if total_allocated > 0 → PARTIALLY_ALLOCATED
Else if exists non-voided DN → ALLOCATING
Else → SUBMITTED or DRAFT
```

### Totals

- `total_requested` = Σ `requested_qty`
- `total_allocated` = Σ `dn_items.allocated_qty` (non-voided)
- `total_dispatched` = Σ `dn_items.dispatched_qty`
- `total_received` = Σ `received_qty`

---

## 9. Lifecycle State Diagram

### Stock Request

```
DRAFT → SUBMITTED → ALLOCATING
                 → PARTIALLY_ALLOCATED / ALLOCATED
                 → DISPATCHED
                 → PARTIALLY_FULFILLED / FULFILLED
```

### Delivery Note

```
DRAFT → CONFIRMED → PICKING_IN_PROGRESS
       → DISPATCH_READY → DISPATCHED → RECEIVED
       → VOIDED (pre-dispatch only)
```

---

## 10. Transition Matrix (Implementable)

### 10.1 Delivery Note Transitions

| From | To | Role | Preconditions | Postconditions |
|------|-----|------|---------------|----------------|
| `DRAFT` | `CONFIRMED` | Dispatcher | Valid allocations | Allocations locked |
| `CONFIRMED` | `PICKING_IN_PROGRESS` | Assigned Picker | Picker assigned | Picking start audit |
| `PICKING_IN_PROGRESS` | `DISPATCH_READY` | Assigned Picker | Picks recorded | Ready to dispatch |
| `DISPATCH_READY` | `DISPATCHED` | Dispatcher | Signature present | Inventory out |
| `DISPATCHED` | `RECEIVED` | Receiver | Authorized | Inventory in |
| `*` | `VOIDED` | Supervisor | Pre-dispatch only | Allocation released |

---

## 11. Migration Strategy

1. Add `received_qty` to `stock_request_items`
2. Create DN tables
3. Update application logic
4. Remove `picked_qty` / `short_qty` from SR items

> **Important:** No existing migration scripts are modified.

---

## 12. Non-Functional Requirements

- All inventory operations must be transactional
- Status transitions must be auditable
- No negative inventory allowed
- Partial fulfillment must be deterministic

---

## 13. Implementation Guarantees

### No Double Deduction

Inventory is deducted exactly once at dispatch, never at allocation or picking.

### No Orphaned Allocations

All allocations are tracked and released properly:
- Released when DN is dispatched
- Released when DN is voided

### Clear Responsibility Separation

- **SR** = demand & fulfillment state
- **DN** = operational execution

---

## 14. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| DN status is authoritative | User-driven, reflects warehouse reality |
| SR status is derived | Computed from DN aggregates, always consistent |
| Allocation locked at confirmation | Prevents mid-pick allocation changes |
| Inventory deducted at dispatch | Reflects legal transfer of ownership |
| `received_qty` on SR items | Enables partial fulfillment tracking |
| No `picked_qty` on SR items | Belongs to DN execution, not SR demand |

---

## 15. Implementation Checklist

### Database

- [ ] Create enum `delivery_note_status`
- [ ] Create enum `stock_request_status` (if not using dynamic derivation)
- [ ] Alter `stock_request_items` - add `received_qty`
- [ ] Create `delivery_notes` table
- [ ] Create `delivery_note_sources` table
- [ ] Create `delivery_note_items` table
- [ ] Create `delivery_note_pickers` table
- [ ] Add indexes on FK columns
- [ ] Add CHECK constraints for quantity invariants

### Service Layer

- [ ] Implement `DN.create()`
- [ ] Implement `DN.confirm()`
- [ ] Implement `DN.startPicking()`
- [ ] Implement `DN.markDispatchReady()`
- [ ] Implement `DN.dispatch()`
- [ ] Implement `DN.receive()`
- [ ] Implement `DN.void()`
- [ ] Implement `SR.computeStatus()`
- [ ] Implement allocation release logic
- [ ] Implement inventory posting integration

### API Layer

- [ ] POST `/api/delivery-notes` - Create DN
- [ ] POST `/api/delivery-notes/:id/confirm` - Confirm DN
- [ ] POST `/api/delivery-notes/:id/start-picking` - Start picking
- [ ] POST `/api/delivery-notes/:id/dispatch-ready` - Mark ready
- [ ] POST `/api/delivery-notes/:id/dispatch` - Dispatch
- [ ] POST `/api/delivery-notes/:id/receive` - Receive
- [ ] POST `/api/delivery-notes/:id/void` - Void DN
- [ ] GET `/api/stock-requests/:id/status` - Get computed status

### UI Layer

- [ ] DN creation form
- [ ] DN list page with filters
- [ ] DN detail page with status timeline
- [ ] Picking interface (tablet-optimized)
- [ ] Dispatch confirmation dialog
- [ ] Receipt confirmation page
- [ ] SR status badge component

---

**Document Version:** 1.0
**Last Updated:** 2026-02-15
**Related Documents:**
- `pick-dispatch-module-prd.md` - Functional requirements
- `delivery-note-schema-srs.md` - Database schema details
