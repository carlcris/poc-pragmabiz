# Universal Inventory Reservation Sources Implementation Plan

Status: Implemented on 2026-08-12, with the direct Sales Order physical-allocation history gap and
the explicitly excluded workflows documented below.

Generalize **Inventory → Reservations** into a source-neutral ownership ledger, then integrate
Transformation Order inputs and Sales Order inventory demand through transactional reservation
lifecycles. Warehouse commitments will be created before execution, exact batch/rack allocations
will be recorded when supported operational work begins, and fulfillment will consume rather than
merely release the reserved inventory.

## Scope

- In: Delivery Notes, Sales Orders, Transformation Order inputs, Frame Job Orders, warehouse
  commitments, batch/rack allocations, consumption, release, ownership transfer, source filtering,
  projection synchronization, concurrency handling, and workflow documentation.
- Out: Sales Invoices as reservation owners, persisted Sales Order-to-invoice batch/rack allocation
  history until the deferred gap below is implemented, Transformation Order outputs awaiting putaway,
  duplicate reservations for Sales Orders already fulfilled through another inventory-owning
  workflow, historical backfills, backward-compatible payloads, deprecated van workflows, and
  Frame Job source-contract normalization.

## Reservation Lifecycle Rules

- Delivery Note: reserve at creation, allocate during Pick List creation, consume at dispatch, and
  release on cancellation, voiding, or an unpicked remainder.
- Sales Order: do not reserve while the order is a draft; reserve stock when the order becomes
  confirmed or approved, keep confirmed inventory demand immutable, transfer ownership without
  increasing total reserved stock when a fulfillment workflow takes over, and release on
  cancellation or deletion. Direct invoice conversion atomically creates the invoice, deducts FIFO
  location/batch and warehouse stock in base units, and consumes the warehouse commitment without
  recording a persisted exact allocation row; that audit-history gap is documented below.
- Transformation Order: create warehouse-level input commitments with the order, allocate FIFO
  batch/rack sources when the order enters `PREPARING`, consume actual input quantities on
  completion, release unused quantities, and release all remaining quantities on cancellation or
  deletion.
- Frame Job Order: retain ownership of its material/component reservations so the originating Sales
  Order does not reserve the same components a second time.
- Sales Invoice: remain an accounting document and never create another inventory reservation.
  A future direct-issue implementation must record the physical allocation against the originating
  Sales Order reservation rather than creating an invoice-owned reservation.

## Action Items

[x] Inventory the latest effective Sales Order, Transformation Order, Frame Job Order, Delivery
Note, reservation-ledger, and stock-projection writers before changing the schema. Identify every
mutation of `item_warehouse.reserved_stock`, `item_batches.qty_reserved`, and
`item_batch_locations.qty_reserved` that the new transactional ownership rules must replace.

[x] Add a new Supabase migration extending `inventory_reservations` with typed Sales Order and
Transformation Order ownership references, expanding `reservation_type`, requiring business-unit
ownership for the new source types, and adding type-specific constraints, partial unique indexes,
and source/page indexes. Do not edit already-applied migrations or add data backfills.

[x] Generalize `inventory_reservation_allocations` so an allocation is owned by either a Pick List
line or a Transformation Order input line. Make source-specific references nullable only where
required, enforce exactly one valid allocation owner through database constraints, retain stable
batch-location foreign keys, and preserve the invariant that active allocations cannot exceed the
parent warehouse commitment.

[x] Refactor `create_transformation_order_transaction` to lock warehouse inventory in deterministic
order, convert every input requirement to base units, validate bounded availability, create one
warehouse commitment per input line, and update `item_warehouse.reserved_stock` atomically with the
order and its lines.

[x] Replace Transformation Order DRAFT updates, PREPARING release, cancellation, and deletion with
DB-owned transactional RPCs. Quantity changes must recalculate template-derived lines and their
commitments; PREPARING must allocate exact FIFO batch/rack sources and update batch/location
projections; cancellation and deletion must release every remaining commitment and allocation.

[x] Refactor `complete_transformation_order_transaction` to consume its owned allocation rows
instead of searching generic unreserved stock. Consume actual quantities, release unused
quantities, atomically extend commitments and allocations for permitted overconsumption when stock
is available, and roll back the entire transformation when any source is insufficient.

[x] Add Sales Order reservation RPCs at confirmation and deletion, with status-owned consumption and
release for direct inventory issue and cancellation. Confirmed inventory demand is immutable, so
quantity or warehouse changes require cancellation/deletion and recreation. Keep Frame Job
component reservations separate from ordinary Sales Order item reservations.

[x] Replace direct Sales Order-to-invoice client mutation chains with one DB-owned transaction.
Preserve invoice-line quantities in their selected sales unit, convert stock-managed quantities to
base units for FIFO batch/location and warehouse deductions, and consume the source Sales Order
reservation atomically. Keep AR and COGS posting as non-critical post-commit side effects.

[x] Generalize `get_inventory_reservations_page` and its allocation-detail RPC to return
`sourceType`, `sourceReference`, and source-line information for every supported owner. Keep search,
source type, status, item, warehouse, sorting, counting, and pagination bounded and server-side;
aggregate child allocations only for the current parent page.

[x] Update **Inventory → Reservations** to replace the Delivery Note column with **Source**, render
references such as `Sales Order · SO-0000042` and `Transformation · TO-0000041`, add a source-type
filter, retain read-only expandable allocation details, and add matching English and Chinese
translations.

[x] Validate reservation creation, FIFO allocation, cancellation/deletion release, insufficient
stock rollback, source filtering, empty pages, and preserved totals. Apply migrations without
resetting the database, regenerate generated types, and run Supabase lint, TypeScript, ESLint,
activity-logging validation, and the production build.

[x] Update the Inventory, Manufacturing, Sales, QA, and reservation-ledger documentation with the
universal source model, lifecycle rules, projection invariants, ownership-transfer behavior, and
the distinction between consumed and released quantities.

## Deferred Gap: Direct Sales Order Invoice Allocation History

[ ] Persist the FIFO batch/rack sources used by direct Sales Order invoice conversion as Sales
Order-owned `inventory_reservation_allocations`. The conversion already deducts
`item_batch_locations`, `item_batches`, and warehouse projections and consumes the warehouse
commitment atomically; this remaining work is the physical source audit record only.

Until this is implemented, invoicing a confirmed Sales Order consumes its warehouse-level
reservation and physical stock but records no physical allocation row. **Inventory → Reservations** therefore displays
"No physical batch or rack allocations have been recorded yet" for that consumed reservation, and
the reservation page does not provide batch/rack source history. Do not fabricate or
backfill allocation history for already-invoiced orders because their exact historical source
cannot be reconstructed reliably.

## Explicitly Excluded Follow-ups

- Van-sales confirmation is not integrated with this reservation model because the van module is
  deprecated.
- Allocation detail remains intentionally bounded to the first 50 rows without a nested pager; 50
  physical sources per reservation is the accepted operational limit for now.
- Frame Job source-ID normalization is deferred; existing Frame Job reservation behavior remains
  unchanged.

## Open Questions

- None. Use warehouse commitments when demand becomes inventory-owning, exact FIFO allocation when
  operational work begins, base-unit quantities throughout the ledger, and transactional ownership
  transfer to prevent double reservation.
