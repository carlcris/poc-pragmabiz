# Inventory Reservation Ledger Implementation Plan

Status: Planned. Begin only after the current picking source-reservation implementation is
finalized as an independent baseline.

Introduce an inventory-owned reservation ledger that gives every warehouse commitment and physical
batch/rack allocation explicit ownership. Existing reserved-quantity columns will remain
transactionally maintained balance projections for efficient availability queries.

## Scope

- In: Delivery Note commitments, pick-list source allocations, overrides, cancellation, voiding,
  dispatch, ownership records, transactional balance synchronization, concurrency handling,
  generated types, and workflow documentation.
- Out: Changes to the current picking implementation before wrap-up, reservation-history UI,
  deprecated van-loading transfers, backward compatibility, and data backfills.

## Action Items

[ ] Finalize and validate the current
`20260810100000_add_picking_source_validation_policy.sql` implementation as an independent baseline;
once finalized, do not fold the ledger into that migration.

[ ] Inventory every current writer and reader of `item_warehouse.reserved_stock`,
`item_batches.qty_reserved`, and `item_batch_locations.qty_reserved` so the ledger cutover updates
all active workflows without leaving direct uncontrolled mutations.

[ ] Add a new Supabase migration defining `inventory_reservations` for warehouse-level commitments
and `inventory_reservation_allocations` for batch-location allocations, including company and
business-unit ownership, base-unit quantities, lifecycle statuses, versioning, timestamps,
constraints, indexes, RLS, and a parent-allocation quantity invariant.

[ ] Keep `item_warehouse.reserved_stock`, `item_batches.qty_reserved`, and
`item_batch_locations.qty_reserved` as cached balance projections, but permit changes only through
transactional reservation RPCs that update ownership records and projections atomically.

[ ] Refactor `create_delivery_notes_transactionally` to create one warehouse commitment per
Delivery Note item and increment the warehouse projection without selecting a rack or
batch-location source.

[ ] Refactor `create_pick_list_with_allocation` to create physical allocation rows against the
existing Delivery Note reservation, enforce that total active allocations never exceed the
commitment, and increment the selected batch and rack projections without increasing the warehouse
commitment again.

[ ] Refactor `record_pick_list_item_progress` so an acknowledged alternative source moves the
allocation between batch locations; move the warehouse commitment only when the confirmed source
warehouse differs.

[ ] Refactor cancellation, Delivery Note voiding, and dispatch RPCs so cancellation releases the
correct allocation or commitment, voiding closes all remaining ownership records, and dispatch
consumes on-hand while closing the corresponding committed and physically allocated quantities.

[ ] Update availability and audit queries to distinguish warehouse committed quantity from
physically allocated picking quantity while keeping all list queries bounded and explicitly
projected.

[ ] Validate exact-source allocation, partial overrides, split allocations, cancellation before
and after picking, voiding, dispatch, idempotent retries, insufficient stock, concurrent allocation,
and forced rollback. Regenerate database types and run Supabase lint, activity-logging validation,
TypeScript checks, lint, and the production build.

[ ] Update Inventory, Mobile Picking, and QA documentation with the two-stage lifecycle, ownership
rules, projection invariants, reset-only development cutover, and operational recovery behavior.

## Open Questions

- None. Use base-unit quantities, keep balance columns as projections, exclude backfills and legacy
  compatibility, and begin only after the current reservation implementation is finalized.
