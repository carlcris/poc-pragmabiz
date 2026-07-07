# Shared Putaway Station Plan

Putaway is a shared warehouse staging workflow, not a normal stocked location. Any operation that creates stock before final warehouse placement should push that stock into a putaway task. The stock is counted at item/warehouse level, but it is not available for picking, consumption, sale, or transfer until the putaway task is posted into final batch/location records.

## Scope

- In: shared putaway task tracking, `item_warehouse.putaway_qty`, putaway station API/UI, inventory availability calculations, stock transaction records, activity logging, and integration points for workflows that produce location-pending stock.
- In producer workflows: stock receiving, transformation/production outputs, chop-and-join production, and future workflows that create stock before final location assignment.
- Out: historical data backfill, external warehouse automation, changing source consumption rules, and producer-specific redesigns beyond the minimum needed to push stock into putaway.

## Current Problem

- Some workflows create stock before a warehouse user has selected the final bin/location.
- Transformation output currently exposes this problem by posting output stock without a proper final placement flow, causing it to fall into `UNTRACKED` or another artificial batch/location path.
- The deeper issue is not only transformation output; it is the lack of a shared putaway task model for stock that is physically present but not finally placed.
- Stock pending putaway should count in item/warehouse on-hand stock, but should not be available for normal picking or consumption.
- Batch and batch-location records should represent final placed stock only, not the putaway staging queue.

## Design Decision

Create a shared putaway task model and putaway station.

Producer workflows should create putaway task records and increment `item_warehouse.current_stock` plus `item_warehouse.putaway_qty`. The putaway station owns the final warehouse placement step. Posting putaway creates or updates the final `item_batches` and `item_batch_locations`, decreases `item_warehouse.putaway_qty`, and leaves `item_warehouse.current_stock` unchanged because the stock was already counted when pushed to putaway.

The only inventory write allowed at producer handoff is the putaway staging write: create or update the putaway task, increment `item_warehouse.current_stock`, and increment `item_warehouse.putaway_qty`. Producer handoff must not create available final batch-location stock directly.

## Inventory Math

- `item_warehouse.current_stock`: total physical stock in the warehouse, including stock waiting in putaway.
- `item_warehouse.reserved_stock`: stock reserved for picking/orders.
- `item_warehouse.putaway_qty`: stock physically present but not yet placed into final batch/location records.
- `item_warehouse.available_stock`: generated as `current_stock - reserved_stock - putaway_qty`.
- Inventory reconciliation compares final placed stock, so item-warehouse versus batch and batch-location reconciliation views use `current_stock - putaway_qty` rather than raw `current_stock`.
- `item_batches` and `item_batch_locations`: final placed inventory only. They must not have putaway quantity fields.

## Putaway Sources

- GRN receiving: received goods submitted for approval that still need final bin/location assignment.
- Transformation outputs: produced output quantities from stock transformations.
- Production workflows: chop-and-join, assembly, or other production outputs that need final storage.
- Future stock-producing workflows: any operation that creates on-hand stock before final location assignment.

## GRN Receiving Integration

GRN receiving must use the same putaway station handoff as transformation output, with these source-specific rules:

- Create or update GRN putaway tasks when the receiving user submits the GRN for approval.
- A GRN can be operationally treated as received once its received quantities have been staged into putaway, even though the stock is not yet available for picking, consumption, sale, or transfer.
- Received quantities must not be written directly to final `item_batches` or `item_batch_locations` during GRN submission or approval.
- The GRN handoff updates `item_warehouse.current_stock` and `item_warehouse.putaway_qty` by the actual good received quantity, decreases `item_warehouse.in_transit` by the expected/to-be-received line quantity, and creates or updates putaway task rows for the actual good received quantity.
- Use the batch code from the GRN receiving data as the putaway task batch reference.
- Group GRN putaway tasks by GRN line plus batch code.
- Partial receiving is allowed. Each submitted received quantity creates or increases the matching putaway task for that GRN line and batch code.
- GRN receiving may still capture a suggested or default destination location, but putaway station users can override it when posting final placement.
- Putaway label printing is always tied to final putaway posting. GRN box/label printing should not be extended as part of this integration because it will be removed from the GRN workflow later.

## Action Items

- [x] Remove the incorrect putaway implementation from the current worktree before continuing: no `qty_putaway` on `item_batches` or `item_batch_locations`, and no normal `PUTAWAY_STAGING` location as the source of final inventory.
- [x] Verify the current inventory quantity contract in `item_warehouse`, item/batch rollups, availability views/functions, stock transaction tables, and existing receiving/production flows before editing schema.
- [x] Add `item_warehouse.putaway_qty` as the only stock-layer putaway counter.
- [x] Update the `item_warehouse.available_stock` generated calculation to exclude both reserved and putaway quantities: `available_stock = current_stock - reserved_stock - putaway_qty`.
- [x] Add a shared putaway task table so producer workflows can create putaway entries with source type, source ID, required source line ID, item, warehouse, quantity, pending quantity, optional source batch/reference, status, and audit fields.
- [ ] Refactor stock-producing workflows that need final placement so they create putaway tasks, increase `item_warehouse.current_stock`, and increase `item_warehouse.putaway_qty` instead of creating final batch-location stock immediately.
- [x] Refactor GRN receiving submission so each received GRN line plus batch code stages stock into the shared putaway station instead of writing directly to final batch-location inventory.
- [x] Preserve any suggested/default GRN destination location as a putaway suggestion only; final location assignment remains owned by putaway posting and can be overridden.
- [x] Ensure GRN approval/status semantics still allow the GRN to be considered received after staging into putaway, while availability remains excluded until putaway posting.
- [x] For transformation execution specifically, ensure completion creates a putaway task and never relies on a missing batch/location that defaults to `UNTRACKED`.
- [x] Keep transformation output stock transaction creation, stock transaction item creation, putaway task creation, and output-line update in one DB-owned transaction.
- [x] Treat zero-produced, waste-only transformation outputs as waste records only; they must not create output stock transactions or putaway tasks.
- [x] Add a transactional putaway posting operation that creates or updates final `item_batches` and `item_batch_locations`, decreases task pending quantity, decreases `item_warehouse.putaway_qty`, and leaves `item_warehouse.current_stock` unchanged.
- [x] Add a shared putaway station UI under inventory/warehouse operations, showing pending putaway by source, item, warehouse, pending quantity, destination location, optional final batch code, quantity to put away, partial putaway support, optional box-label printing, completed-putaway label reprinting, and validation that pending quantity cannot go below zero.
- [ ] Update affected inventory reads, dashboard widgets, stock transactions, stock aging, item batch/location displays, exports, and reports so putaway quantity is visible at item/warehouse level but excluded from available stock.
- [x] Log stock receiving-to-putaway, production-to-putaway, transformation-to-putaway, and final putaway as user actions through the current activity logging path; do not re-enable noisy API GET logging.
- [ ] Validate success and rollback paths with executable tests: producers create no `UNTRACKED` final stock, putaway supports partial and full movement, forced failures leave no partial writes, and downstream inventory availability remains correct.

## Efficiency Notes

- Storing `putaway_qty` only on `item_warehouse` keeps summary availability efficient without polluting final batch/location inventory records.
- Putaway task rows hold the operational detail for the station; `item_warehouse.putaway_qty` is the fast item/warehouse summary.
- The tradeoff is that reports needing source-level putaway detail must read the putaway task table instead of item batch-location records.
- A shared putaway station avoids duplicating putaway logic in receiving, transformations, and production workflows.
- Keeping each producer handoff and each putaway movement as DB-owned transactions avoids partial writes and keeps the API/client simple.
- Transformation output handoff uses one RPC so a putaway creation failure cannot leave a posted output stock transaction without its matching putaway task.
- GRN receiving handoff should be transactional for the same reason: submitting received quantities for approval must not leave `item_warehouse.current_stock` or `putaway_qty` changed without matching putaway task rows.
- GRN putaway tasks carry the receiving batch code because the batch is already determined before putaway. The putaway station still owns the final batch-location placement.
- Waste-only transformation outputs skip putaway because there is no physical produced stock to place.
- Putaway posting creates or increments final batch rows with one atomic upsert so concurrent first postings for the same batch do not fail on the batch uniqueness constraint.
- Reconciliation excludes `putaway_qty` from item-warehouse quantities because pending putaway stock is physical stock but not final placed batch/location stock.
- Putaway label printing reuses the existing client-side barcode PDF generator and is dynamically loaded only when labels are printed, keeping normal station navigation lightweight.
- Putaway labels include the generated batch-location SKU for exact scanner resolution after final placement.
- Completed putaway label reprinting reconstructs labels from posted putaway stock transactions so missed prints preserve each actual posted batch/location, item, warehouse, generated batch-location SKU, and quantity while still allowing the user to choose how many labels to print.

## Open Questions

- Should putaway movement use a dedicated stock transaction type, or reuse the existing internal movement/transfer transaction type if one already exists?
- Should final batch numbering be owned by the producer workflow, the putaway posting workflow, or configurable per source type?
