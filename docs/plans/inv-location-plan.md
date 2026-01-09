# Implementation Plan: Warehouse Locations + Item Location (Simple Phase)

## Scope
Add **warehouse locations** and **item-location inventory** while keeping the existing model intact.

**Existing tables**
- `items`
- `item_warehouse`

**New tables**
- `warehouse_locations`
- `item_location`

**Out of scope (future)**
- Lot / batch
- Serial numbers
- FIFO / FEFO
- Put-away rules

---

## 1. Data Model Design

### 1.1 warehouse_locations
Defines the physical storage structure inside a warehouse.

**Fields**
- id (PK)
- warehouse_id (FK)
- code (unique per warehouse, e.g. `A1-BIN-01`, `CRATE-01`)
- name
- parent_id (nullable, for hierarchy)
- location_type (enum)
  - zone
  - aisle
  - rack
  - shelf
  - bin
  - crate
- is_pickable (boolean)
- is_storable (boolean)
- is_active (boolean)
- created_at
- updated_at

**Constraints**
- Unique: `(warehouse_id, code)`

**Notes**
- No quantity fields
- Locations are reusable by many items
- `crate` is treated like a movable bin

---

### 1.2 item_location
Stores item quantity per specific location.

**Fields**
- id (PK)
- item_id (FK to items)
- warehouse_id (FK)
- location_id (FK to warehouse_locations)
- qty_on_hand
- qty_reserved
- qty_available
- updated_at

**Constraints**
- Unique: `(item_id, warehouse_id, location_id)`
- qty_on_hand >= 0
- qty_reserved >= 0
- qty_available >= 0
- qty_reserved <= qty_on_hand

---

### 1.3 Optional: default location
Add to `item_warehouse` for simplicity.

**Field**
- default_location_id (FK to warehouse_locations, nullable)

Used when users do not explicitly choose a location.

---

## 2. Migration Plan

### 2.1 Schema changes
- Create `warehouse_locations`
- Create `item_location`
- Add indexes:
  - warehouse_locations(warehouse_id, code)
  - item_location(item_id, warehouse_id)
  - item_location(warehouse_id, location_id)

---

### 2.2 Seed default locations
For each warehouse:
- Create a default location:
  - code: `MAIN`
  - location_type: `bin` (or `zone`)
  - is_pickable = true
  - is_storable = true

---

### 2.3 Backfill item_location
For each row in `item_warehouse`:
- Insert into `item_location`
  - item_id
  - warehouse_id
  - location_id = MAIN
  - qty values copied from `item_warehouse`
- Set `item_warehouse.default_location_id = MAIN` (if column exists)

Result:
- No functional change
- All existing stock lives in MAIN bin

---

## 3. Inventory Consistency Rule

**Rule**
SUM(item_location.qty_on_hand)

item_warehouse.qty_on_hand

**Enforcement**
- Phase 1: application-level transactional updates
- Phase 2 (optional): database triggers

---

## 4. Inventory Transaction Flows

### 4.1 Receiving (Stock In / GRN)
1. Determine target location
   - User-selected or default_location_id
2. Upsert into `item_location` and increase qty
3. Update `item_warehouse` totals
4. Record in `stock_transactions` with `to_location_id`

---

### 4.2 Stock Out / Sale
1. Select source location (default or chosen)
2. Validate `qty_available`
3. Deduct from `item_location`
4. Update `item_warehouse`
5. Record `from_location_id`

---

### 4.3 Internal Transfer (Same Warehouse)
1. Validate source location quantity
2. Deduct from source `item_location`
3. Add to destination `item_location`
4. Do NOT change `item_warehouse` totals
5. Record both `from_location_id` and `to_location_id`

---

### 4.4 Transfer Between Warehouses
Handled as:
- Stock out from WH-A + location
- Stock in to WH-B + location
- Update both `item_warehouse` records

---

## 5. stock_transactions (Minimal Additions)

Add:
- from_location_id (nullable)
- to_location_id (nullable)

Used for:
- Traceability
- Bin movements
- Crate transfers

---

## 6. UI Changes (Minimal)

### 6.1 Location Management
- Warehouse → Locations
- Create/edit/deactivate locations
- location_type dropdown includes `crate`

---

### 6.2 Inventory View
- Item → Warehouse stock (existing)
- New tab: Locations
  - List locations + quantities

---

### 6.3 Transaction Forms
- Stock In: To Location (default = MAIN)
- Stock Out: From Location (default = MAIN)
- Internal Transfer: From Location → To Location

Location selection:
- Phase 1: optional (fallback to default)
- Phase 2: required per warehouse config

---

## 7. Permissions

- manage_locations
- view_location_stock
- transfer_between_locations

---

## 8. Testing Checklist

- Backfill totals match item_warehouse
- Stock in updates both tables correctly
- Stock out prevents negative location stock
- Bin-to-bin transfer keeps warehouse total unchanged
- Deactivating a location with stock is blocked or warned

---

## 9. Rollout Strategy

1. Deploy schema changes
2. Seed MAIN locations
3. Backfill item_location
4. Deploy application changes with defaults
5. Enable bin-level operations per warehouse

---

## Notes on `crate` Location Type

- Treated as a movable container
- Can hold stock like a bin
- Movement tracked via internal transfers
- Future extension: crate-to-crate or crate-in-transit handling
