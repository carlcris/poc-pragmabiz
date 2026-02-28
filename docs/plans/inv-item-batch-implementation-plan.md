# Inventory Item Batch Tracking Implementation Plan

## Clarified terminology (agreed)

- `location` means a warehouse storage location, e.g. a `shelf/rack/bin`.
- A single `location (shelf/rack)` can store multiple batches.
- Exact stock granularity must be tracked at:
  - `item + warehouse + location (shelf/rack) + batch`

## Naming convention (updated for consistency)

Use `item_*` table naming to match existing tables (`item_warehouse`, `item_location`):

- `item_batch` (batch-level stock for an item in a warehouse)
- `item_location_batch` (exact stock by item + location(shelf/rack) + batch)

Keep existing:

- `item_warehouse`
- `item_location`

## Current implementation summary (repo-aligned)

### Receiving (GRN)

- GRN already supports a header-level `batchNumber` in UI/types.
- GRN approval currently updates `item_warehouse.current_stock` in the API route and creates stock transactions.
- GRN approval does **not** currently update `item_location` or any batch-level stock records.

### Picking

- Picking lifecycle is managed through `pick_lists`.
- `pick_list_items` stores only aggregate quantities (`allocated_qty`, `picked_qty`, `short_qty`).
- Current pick flow does not store exact actual picked `location (shelf/rack)` + batch execution details.

### Dispatch / Receive (Delivery Notes)

- Dispatch and receive stock posting are already transactional SQL RPCs:
  - `post_delivery_note_dispatch`
  - `post_delivery_note_receive`
- Dispatch currently consumes stock using FIFO across `item_location` rows (location FIFO only).
- Receive currently increases `item_warehouse` and `item_location`.
- Neither flow tracks batches yet.

## Target inventory model

### Tables

1. `item_warehouse` (existing)
- Aggregate stock per item + warehouse

2. `item_location` (existing)
- Aggregate stock per item + warehouse + `location (shelf/rack)`

3. `item_batch` (new)
- Aggregate stock per item + warehouse + batch

4. `item_location_batch` (new)
- Exact stock per item + warehouse + `location (shelf/rack)` + batch

## Stock consistency rules

- `item_warehouse.current_stock = SUM(item_location.qty_on_hand)`
- `item_warehouse.current_stock = SUM(item_batch.qty_on_hand)`
- `item_location.qty_on_hand = SUM(item_location_batch.qty_on_hand)` for that item/location row
- `item_batch.qty_on_hand = SUM(item_location_batch.qty_on_hand)` for that item/batch row
- `qty_on_hand >= 0` everywhere
- `qty_reserved >= 0` everywhere reserved is tracked
- `qty_reserved <= qty_on_hand` everywhere reserved is tracked

## Implementation plan (using current working flows)

## Phase 1: Database schema + rollout safety

### 1. Add batch tables

Create a migration for:

- `item_batch`
  - batch identity fields (`batch_code`)
  - FIFO field (`received_at`)
  - `qty_on_hand`, `qty_reserved`
  - indexes for FIFO queries and lookups

- `item_location_batch`
  - references `item`, `warehouse`, `location (shelf/rack)`, `item_batch`
  - `qty_on_hand`, `qty_reserved`
  - unique key on exact stock grain
  - indexes for pick/dispatch queries and reconciliation

### 2. Add reconciliation helpers (SQL)

Add SQL helper functions/views to verify invariants:

- warehouse totals vs location totals
- warehouse totals vs batch totals
- location totals vs location-batch totals
- batch totals vs location-batch totals

Use these during rollout and testing before enforcing stricter constraints.

### 3. Backfill existing stock into batches (required)

Current stock already exists in `item_warehouse` / `item_location` without batches.

Create a one-time migration/script to:

- create an opening batch in `item_batch` per item+warehouse where stock exists
- populate `item_location_batch` from current `item_location` balances
- preserve totals exactly

This prevents existing stock from becoming unusable when FIFO-by-batch starts.

## Phase 2: Receiving (GRN) becomes batch-aware

### 4. Move GRN approval inventory posting to SQL RPC

Current GRN approval mutates inventory in application code. Replace that section with a single transactional DB RPC.

New RPC should:

- lock GRN header and GRN items
- create stock transaction header/items
- update `item_warehouse`
- update `item_location` (based on assigned `location (shelf/rack)` if available, otherwise default MAIN)
- create/update `item_batch`
- create/update `item_location_batch`

### 5. Batch assignment rules during GRN receiving

Batch for a received line should come from:

- GRN header `batchNumber`, or
- generated batch code if not provided

Important rule from requirement:

- GRN receiving must always use a new `batch_code`
- app must validate batch uniqueness and raise an error if duplicate exists for the same `item + warehouse + batch_code`
- `item_batch` uniqueness scope is `item + warehouse + batch_code` (with company scoping in the actual constraint)

### 6. Keep box/putaway compatibility

Existing GRN box + putaway screens already capture `warehouseLocationId` and print labels including batch number.

Use this to improve GRN posting:

- if box-level `location (shelf/rack)` assignments exist, aggregate received qty by location and post into `item_location` + `item_location_batch`
- otherwise fallback to default MAIN location

## Phase 3: Aggregate reservation + actual pick execution details

### 7. Keep aggregate reservation on `delivery_note_items`, add actual pick child rows

Reservation timing is during DN creation, but you do not want to reserve per `location (shelf/rack)` + batch.

Keep `delivery_note_items.allocated_qty` as the aggregate reserved quantity on the DN line.

Add a DN-owned child table for actual pick execution rows (example: `delivery_note_item_picks`) to store:

- `delivery_note_item_id`
- `item_id`
- source `warehouse_id`
- `picked_location_id` (`location (shelf/rack)`)
- `picked_batch_code` (or `item_batch_id`)
- `picked_batch_received_at` (preserved original receipt date)
- `picked_qty`
- `picker_user_id`
- `picked_at`
- `is_mismatch_warning_acknowledged` (or equivalent)
- optional mismatch reason / metadata

This is the missing bridge between aggregate DN quantities and exact stock depletion.

### 8. Implement aggregate reservation + optional suggested pick source at DN creation

Add SQL RPC/function called during **DN creation** (current workflow) so reservation timing stays aligned with the existing implementation.

Reservation/suggestion logic:

1. validate aggregate stock availability for the item in the source warehouse
2. reserve aggregate quantity on `item_warehouse.reserved_stock` (and only add lower-level reservation if you later choose stricter enforcement)
3. set `delivery_note_items.allocated_qty`
4. optionally compute/store a suggested pick `location (shelf/rack)` + batch for operator guidance (advisory only)

Notes:

- Reservation timing remains at **DN creation** (not pick-list creation).
- Pick list creation/picking will capture actual picked source (`location + batch`) later.
- Suggested source is advisory only; picker can override after warning.

### 9. Keep current pick-list APIs working while adding detail

Current `pick_list_items` aggregate updates should remain supported initially.

Plan:

- keep `pick_list_items.picked_qty` as summary for UI compatibility
- add actual pick rows (`delivery_note_item_picks`) to pick-list/DN detail responses
- progressively update tablet picking to scan/confirm actual batch + shelf/rack
- on mismatch vs suggested source, warn and allow operator override
- if operator continues, store actual picked batch/location and update retained suggestion/override fields on the DN line
- add duplicate-scan guard: if line `allocated_qty` is already fully picked, show "item already picked"
- allow additional pick rows for the same DN line with different location/batch (override case), as long as total picked qty does not exceed `allocated_qty`
- allow pick qty edits only before DN reaches `dispatched` status
- do not re-allocate at pick-list creation

## Phase 4: Dispatch consumes exact picked rows

### 10. Refactor `post_delivery_note_dispatch`

Current dispatch SQL consumes stock directly from `item_location` FIFO and updates `item_warehouse`.

Refactor to consume from actual DN pick rows (`delivery_note_item_picks`) instead:

- validate dispatch qty against actual picked rows and DN line aggregate quantities
- use `delivery_note_item_picks` as the source of truth for actual picked qty + location + batch
- decrement `qty_on_hand` in:
  - `item_location_batch`
  - `item_batch`
  - `item_location`
  - `item_warehouse`
- decrement `qty_reserved` on `item_warehouse` (aggregate reservation layer)
- only decrement lower-layer `qty_reserved` where lower-layer reservation was actually created
- record dispatched quantities on pick rows (or derive if full-dispatch-only behavior is enforced)
- continue updating `delivery_note_items.dispatched_qty` and stock transaction records

This preserves exact depletion by `location (shelf/rack)` + batch.

## Phase 5: Receipt of dispatched stock preserves batches

### 11. Refactor `post_delivery_note_receive`

Current DN receive adds stock to destination `item_warehouse` and `item_location` only.

Refactor so receipt reconstructs destination stock by the dispatched batch breakdown:

- source batch identity must be preserved during transfer
- source batch `batch_code` must be reused
- source batch `receipt_date` must also be preserved across warehouses (do not reset to DN receive date)
- received quantities are written to:
  - `item_warehouse`
  - `item_location`
  - `item_batch`
  - `item_location_batch`

If the UI only provides one destination `location (shelf/rack)` per DN line, distribute all received picked-batch rows into that location for now.

DN receive should follow the same stock update pattern as GRN receive, but using transferred batch identity:

- update `item_warehouse`
- upsert `item_location` (allow user-assigned location)
- upsert `item_location_batch`
- upsert `item_batch` using the transferred `batch_code` and preserved original `receipt_date`

Validation rule:

- `batch_code` + preserved `receipt_date` must remain consistent across transfers
- if destination already has the same `item + warehouse + batch_code` with a different `receipt_date`, raise an error (do not overwrite)

## Phase 6: Cancellation / reversal / void flows

### 12. Add batch-safe reversal functions

Implement SQL functions for:

- cancel pick/reservation (unreserve only)
- void dispatch (reverse dispatch before receipt if business rules allow)
- DN cancellation releases aggregate reservations and clears `delivery_note_item_picks`
- pick list cancellation does **not** cancel the DN and does **not** release DN aggregate reservation automatically
- pick list cancellation resets/clears `delivery_note_item_picks` but retains latest override suggestion values on `delivery_note_items`
- pick list cancellation reset/clear is allowed only before any dispatch has occurred (all DN line `dispatched_qty = 0`)

All reversals must update the same 4 inventory layers consistently.

## Edge case: Store sale fulfilled by direct customer pickup at warehouse

### Scenario

- Customer buys through a store
- Store does not have enough inventory
- Store creates a stock request to the warehouse
- Items are picked at the warehouse
- Customer picks up directly from the warehouse (stock never physically enters the store)

### Required behavior

- Use normal warehouse aggregate reservation + actual pick execution logic
- Pick and dispatch stock from the warehouse
- **Do not** post a DN receive into store inventory
- Mark the request/order as fulfilled via direct warehouse pickup
- Workflow status can still end in `received` for compatibility, but without store inventory receipt posting

### Inventory and sales consistency rule

To avoid discrepancies between store sales and inventory:

- Sales attribution can remain with the store (store is the selling channel)
- Inventory deduction / stock issue must be posted against the **warehouse** (actual fulfillment source)
- Store inventory must not be decremented for this flow

### Modeling recommendation

Add a fulfillment mode on stock request / delivery note / sale fulfillment (implementation can choose exact entity):

- `transfer_to_store` (default/current transfer flow)
  - warehouse dispatch + store receive
- `customer_pickup_from_warehouse` (edge case)
  - warehouse dispatch only
  - no store inventory receipt posting
  - workflow can still mark `received` after customer handover via a dedicated completion transition path

### Batch tracking behavior in this edge case

- Aggregate reservation occurs during DN creation on the DN line
- Pick confirms actual picked batch + `location (shelf/rack)` rows
- Dispatch decrements exact warehouse:
  - `item_warehouse`
  - `item_location`
  - `item_batch`
  - `item_location_batch`
- No destination warehouse/store batch upsert because there is no receiving leg

## API and type changes (incremental)

### Backend

- GRN approve route calls new RPC instead of looping inventory updates in TS
- DN creation calls reservation/suggestion RPC (reservation timing stays at DN creation)
- pick-list create/start reads existing DN suggestion/override fields and actual pick rows (no re-allocation)
- DN dispatch RPC reads actual DN pick rows
- DN receive RPC preserves batch rows
- Add support for direct warehouse pickup fulfillment mode (dispatch without receive, with inventory source = warehouse)
- Add separate completion transition path for direct pickup mode (marks `received` without calling DN inventory receive posting)

### Frontend types

Extend types to include batch-aware details without breaking current screens:

- `GRN` / `GRNBox` (optional batch instance metadata if needed)
- `PickList` / `PickListItem` (add actual pick rows + suggestion/override fields as needed)
- `DeliveryNote` line detail (optional dispatched batch breakdown for audit)

## Query examples to support UI/reporting

### Available stock by item grouped by batch (FIFO order)

- Use `item_batch`
- order by `received_at ASC`, then batch code / id for deterministic results

### Available stock by item grouped by `location (shelf/rack)` + batch

- Use `item_location_batch`
- join `warehouse_locations` for shelf/rack/bin labels
- sort by batch FIFO then location code

## Test plan (minimum cases)

1. Partial pick across multiple batches
- Item demand exceeds oldest batch but not total
- Allocation should split across batches FIFO

2. Partial pick across multiple `location (shelf/rack)` rows within same batch
- Same batch stored on multiple shelves/racks
- Allocation should split deterministically across locations

3. Concurrent DN reservations / picks for same item
- Two DNs or pick operations overlap for the same item
- No overselling; aggregate reservation validation and dispatch locking should prevent negative stock

3a. Concurrent pick confirm vs dispatch
- Prevent dispatch from consuming partially-written pick rows (transaction + row locking + status checks)

3b. Concurrent pick-list cancel vs dispatch
- Pick-list cancellation reset must be rejected once any `dispatched_qty > 0`

4. GRN receive into new batch vs explicit batch code
- Ensure correct batch records and exact totals

5. DN dispatch + DN receive preserves batch identity
- Source dispatch by batch(s)
- Destination receive reproduces same batch balances

6. Store sale fulfilled by direct warehouse pickup (no store receipt)
- Stock request created by store demand
- Warehouse reserves aggregate qty, then picks/dispatches using actual batch + `location (shelf/rack)` scans
- Store inventory remains unchanged
- Warehouse inventory decreases correctly
- Sale/order is fulfilled without inventory/sales discrepancy

## Recommended delivery order (low risk)

1. Batch schema + indexes + reconciliation helpers
2. Backfill existing stock into opening batches
3. GRN approve RPC (batch-aware inbound posting)
4. DN reservation/suggestion RPC + `delivery_note_item_picks` child table
5. Dispatch RPC refactor to consume actual pick rows
6. Receive RPC refactor to preserve batches
7. UI enhancements for actual pick execution (batch + shelf/rack)

## Final design decisions (confirmed)

1. Batch uniqueness scope
- `item + warehouse + batch_code` (with company scoping in implementation)

2. GRN batch behavior
- GRN always creates a new `batch_code`
- App validates duplicate existence for the same `item + warehouse + batch_code` and raises an error if duplicated

3. DN / transfer receiving batch behavior
- Reuse `batch_code` from source actual pick rows
- Reuse/preserve the original batch `receipt_date` across warehouses
- Same `batch_code` must not appear with a different preserved `receipt_date`; raise error on mismatch
- Upsert destination `item_batch`, `item_location_batch`, `item_location`, and update `item_warehouse`

4. Cross-warehouse reuse policy
- Reuse batch code in any transfer / stock request regardless of warehouse
- Preserve original batch `receipt_date` across warehouses for FIFO

5. Reservation timing
- Aggregate reservation occurs during DN creation (current workflow)
- Pick lists capture/confirm actual picked source rows rather than creating reservations

6. Cancellation behavior
- DN cancellation releases aggregate reservations and clears `delivery_note_item_picks`
- Pick list cancellation does not cancel the DN and does not release DN aggregate reservation automatically
- Pick list cancellation resets/clears `delivery_note_item_picks` but retains override suggestion values on the DN line
- Pick list cancellation reset is allowed only before any dispatch has occurred

7. Direct warehouse pickup status handling
- `customer_pickup_from_warehouse` can still use `received` status for workflow compatibility
- No store inventory receipt posting occurs in that flow
- Use a dedicated completion transition path for that mode (do not call standard DN receive inventory posting)

## Concurrency recommendations (implementation guidance)

1. Locking
- On pick confirm/edit: lock the target DN line (`delivery_note_items`) and validate DN status before writing `delivery_note_item_picks`
- On dispatch: lock DN header, relevant DN lines, and affected inventory rows (`item_warehouse`, `item_batch`, `item_location`, `item_location_batch`)
- On pick-list cancellation reset: lock DN lines and reject reset if any `dispatched_qty > 0`

2. Pick row integrity
- Enforce server-side cap: `SUM(delivery_note_item_picks.picked_qty)` per DN line must not exceed `delivery_note_items.allocated_qty`
- Merge or validate duplicate scans deterministically:
  - merge when same `delivery_note_item_id` + same `picked_location_id` + same batch identity (`picked_batch_code` or `item_batch_id`) + same preserved `picked_batch_received_at`
  - append a new row when location or batch differs (override case)
- Allow edits only while DN is pre-dispatch

3. Dispatch integrity
- Before dispatch commit, verify pick-row totals reconcile with requested dispatch quantities
- Dispatch should consume exactly from persisted pick rows, not recalculate source batch/location
