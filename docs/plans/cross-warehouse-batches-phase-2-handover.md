# Cross-warehouse batches — Phase 2 handover

## Status and Phase 1 boundary

Phase 2 is deferred. Production has not been migrated. Phase 1 retains warehouse-owned batches
and permits stock adjustments to reuse their code across items and locations within that warehouse.
Each item retains its own batch/stock record; selecting another item's code copies the original
received timestamp exactly. Conflicting timestamps reject the save. The DB changes are function-only:
replacement of `create_draft_stock_adjustment` and addition of `search_stock_adjustment_batches`.
There are no table changes or backfills.
The abandoned cross-warehouse implementation is removed from the active code and migration chain.
Do not assume its former local test results establish production readiness.

`Z001237` owned by WH-BU01 is not a selectable existing batch in WH-BU02 under Phase 1. A separate
warehouse-owned batch may have the same code; it is a distinct identity until an approved migration.

## Objective and decisions required

Confirm the future shared batch-header identity, including multi-item membership and cross-warehouse
scope, before designing tables or a merge. The Phase 1 batch code already spans items in a warehouse,
but underlying item stock records are separate. Stock, reservations,
location SKUs, picking restrictions, and warehouse ledgers remain tied to physical locations.

Before implementation, obtain explicit decisions on:

- Whether matching batch codes always identify the same physical lot, including imported and
  generic codes such as `OPENING-BAL` and `UNTRACKED`.
- How to resolve different original received dates, active/archived duplicates, and inconsistent
  batch/location/reservation totals. Never silently select a date or discard a balance.
- Whether existing external integrations or documents retain batch IDs and need an approved
  mapping/archive strategy when duplicate identities are merged.
- The permitted maintenance window and recovery objectives for a production cutover.

## Ordered implementation and rollout plan

1. **Audit production read-only.** Verify its migration chain against the repository. Count batch
   records and duplicate company/item/code groups; identify conflicting dates, archived nonzero
   balances, missing locations, orphan references, and reconciliation discrepancies. Inspect every
   FK, trigger, RPC, view, policy, integration, and current caller using batch warehouse ownership.
   Deliver counts and conflicts without changing data.
2. **Design migration and recovery.** Retain a durable old-to-new batch ID/warehouse mapping if
   merging is approved. Preserve location IDs/SKUs and reassign request/reservation references.
   Specify how on-hand/reserved balances are aggregated and reconciled, with abort conditions.
   Account for historical and in-flight documents. Decide transactional cutover versus an explicitly
   approved staged migration; do not add compatibility layers without approval.
3. **Prepare a production-copy rehearsal.** Take a recoverable backup, restore to isolated staging,
   apply the candidate migration, measure lock duration and execution time, and compare pre/post
   totals and references. Rehearse restoration before accepting the maintenance window. Never run
   development seed scripts or reset production.
4. **Update all current contracts together.** Batch identity loses warehouse ownership; physical
   queries must filter `item_batch_locations.warehouse_id`. Update transactional functions, API
   projections, typed responses, selectors, reports, services, and generated DB types. Keep list
   queries bounded and avoid batch-by-warehouse scans without measured plans/indexes.
5. **Preserve access semantics.** Keep company boundaries and operation/BU/location checks.
   The stock-request fulfillment lookup is server-only: its SECURITY DEFINER RPC remains executable
   by `service_role`, not `authenticated` or `anon`. Compare old/new access truth sets for any RLS
   change and measure representative authenticated queries. Do not infer permissions from UI alone.
6. **Test workflows and cache refresh.** Add successful and late-failure rollback tests, concurrent
   reservations, date preservation, identity merging, and primed-cache tests. Verify active views
   refresh and inactive caches become stale without affecting unrelated queries. Run the focused
   matrix below, application tests, TypeScript/lint, activity logging, migration/seed checks in a
   disposable database, and production build outside unrelated worktrees.
7. **Coordinate deployment.** Approve the production audit/rehearsal and concrete release artifact.
   Pause inventory writes/workers and old application instances before incompatible schema changes.
   Back up, migrate, deploy matching application code, verify totals/access/in-flight documents,
   then resume traffic. Define abort thresholds and owners before starting. A column-dropping,
   identity-merging migration must not be deployed alongside old application instances.
8. **Handover and monitor.** Update inventory KB, QA guide, API contracts, and operational runbook.
   Monitor stock reconciliation, reservations, lookup failures, and mutation errors after cutover.
   Once new transactions exist, rollback needs reconciliation or coordinated backup recovery;
   simply recreating the warehouse column cannot recover merged IDs and ownership.

## Affected surfaces and acceptance matrix

| Surface                       | Required acceptance checks                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Stock adjustments             | Cross-warehouse selection; destination creation/reuse; original date; local decreases; rollback                                     |
| Stock requests and allocation | One batch option across eligible warehouses; correct summed capacity; selected-batch enforcement; warehouse splits                  |
| Reservations                  | Exact source allocations; global/local totals; competing allocations; cancellation and release                                      |
| Picking                       | Correct/wrong batch scans; rack/warehouse policies; substitution; partial completion and cancellation                               |
| Delivery dispatch/receiving   | Source consumption and destination receipt using the shared identity; partial receipt; reversal; late-failure rollback              |
| Stock moves                   | Same/cross-warehouse moves preserve global totals and date; local ledgers and reserved-stock protection                             |
| GRN/putaway                   | Existing/new batch placement; repeated posting; original date; generated location/SKU codes                                         |
| Sales/POS/manufacturing       | Reservation, FIFO consumption, cancellation, and finished-goods placement remain source-scoped                                      |
| Views/reports/caches          | Warehouse-local quantities; global batch totals; aging; location trees/details; active and inactive cache refresh                   |
| Migration and permissions     | Pre/post stock/reservation equality; stable QR SKUs; historical/in-flight references; company/BU boundaries; server-only RPC grants |

## Code map and lessons from the discarded prototype

Start with `supabase/migrations`, `src/app/api/inventory`, `src/app/api/stock-adjustments`,
`src/app/api/stock-requests`, `src/app/api/lookups/stock-request-batches`,
`src/app/api/items/[id]/batches`, `src/services/inventory/locationService.ts`, related hooks,
`src/types/database.types.ts`, and `src/types/supabase.ts`.

Inspect the latest definitions of adjustment save/post, stock-move, delivery dispatch/receive,
putaway, picking completion/substitution, stock-request insertion/validation/search, and stock
increase/FIFO helpers. Reconciliation views also currently depend on warehouse-owned batches.

The prototype exposed two adjacent issues to assess separately: receiving/default-location paths
still use a hardcoded `MAIN` code despite generated-code rules; seed relocation can mutate protected
location identity fields. These fixes are not included in Phase 1 and must not be assumed resolved.
The prototype also showed why RPC recreation must explicitly preserve original grants.

## Local rollback note

The local database was backed up before undoing the prototype. Original warehouse-scoped batches,
references, functions, and indexes were restored while preserving newer local work. A newer unposted
local draft, `ADJ-000000008`, had a zero-stock BU02 location for `Z001237`; it was preserved with a
separate BU02-owned batch instead of retaining a link to the BU01 batch. This local recovery is not
part of the Phase 1 production migration and must not be copied into a production backfill.
