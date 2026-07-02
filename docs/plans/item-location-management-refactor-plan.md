# Item Location Management Refactor Plan

## Goal

Simplify item location management by removing the redundant item-location aggregate layer and deriving location-level stock from batch-location detail rows.

This plan reflects the agreed target model:

- Keep `warehouse_locations` as the warehouse location catalog.
- Rename `item_batch` to `item_batches`.
- Rename `item_location_batch` to `item_batch_locations`.
- Keep `item_batches` as batch-level stock per item and warehouse.
- Keep `item_batch_locations` as the only table that stores exact batch stock by warehouse location.
- Remove or retire `item_location`.
- Do not add `location_id` to `item_batches`.
- Do not remove `item_batch_locations`.
- Update reports and docs as part of the refactor.

## Current Schema Facts

The active local schema uses `item_location` singular. There is no active `item_locations` table.

Current location-related tables:

- `warehouse_locations`
- `item_location`
- `item_batch`
- `item_location_batch`

Target location-related tables:

- `warehouse_locations`
- `item_batches`
- `item_batch_locations`

Current redundant relationships:

- `item_location` stores aggregate stock per `company_id + item_id + warehouse_id + location_id`.
- `item_location_batch` stores exact stock per `company_id + item_id + warehouse_id + location_id + item_batch_id`.
- `item_batch` stores aggregate stock per `company_id + item_id + warehouse_id + batch_code`.

The refactor should remove `item_location` reads/writes, rename the batch tables, and derive location totals from grouped `item_batch_locations` rows.

## Target Invariants

- `item_warehouse.current_stock = SUM(item_batches.qty_on_hand)` for each item and warehouse.
- `item_batches.qty_on_hand = SUM(item_batch_locations.qty_on_hand)` for each batch.
- Location-level on-hand stock is derived from `SUM(item_batch_locations.qty_on_hand)` grouped by `company_id`, `item_id`, `warehouse_id`, and `location_id`.
- Location-level reserved stock is derived from `SUM(item_batch_locations.qty_reserved)` grouped by the same keys.
- `item_batch_locations.location_id` remains the exact location reference.
- `item_batch_locations.batch_location_sku` remains the scan identifier for exact batch-location rows.
- Batch splits across locations are represented by multiple `item_batch_locations` rows pointing to the same `item_batch_id`.
- Keep `item_batch_id` as the FK column name unless a separate naming cleanup is approved.

## Scope

In scope:

- Supabase migration to remove active `item_location` dependencies.
- Reconciliation views/functions.
- Inventory posting services and API routes.
- Item location tab API and UI.
- Item batch location reports and stock aging reports.
- Picking, scanning, receiving, stock adjustment, transfer, invoice, POS, and mobile scan flows.
- Seed data.
- Generated Supabase types.
- Documentation updates.

Out of scope:

- Removing `warehouse_locations`.
- Removing `item_batch_locations`.
- Moving `location_id` onto `item_batches`.
- Removing `item_batch_locations.batch_location_sku`.
- Removing `stock_transactions.from_location_id` or `stock_transactions.to_location_id`.
- Removing `item_warehouse.default_location_id`.
- Removing `grn_boxes.warehouse_location_id`.

## Affected File Audit

### Database Migrations And SQL Objects

Create a new migration under `supabase/migrations/` that supersedes existing behavior. Do not edit old applied migrations except for documentation-only comments if explicitly needed.

Existing migrations that define or later depend on the location model:

- `supabase/migrations/20260106000001_add_stock_adjustment_normalization.sql`
- `supabase/migrations/20260224100000_add_item_batch_tracking_tables.sql`
- `supabase/migrations/20260224180000_add_item_location_batch_sku.sql`
- `supabase/migrations/20260421100000_reconcile_item_location_from_item_warehouse.sql`
- `supabase/migrations/20260504110000_convert_inventory_workflow_timestamps_to_timestamptz.sql`
- `supabase/migrations/20260609031000_transactional_pick_list_completion.sql`

The new migration should rename active tables:

- `public.item_batch` to `public.item_batches`
- `public.item_location_batch` to `public.item_batch_locations`

It should also rename affected constraints, indexes, triggers, policies, views, and generated helper functions where practical. If a name is externally referenced by application code, update all references in the same change.

Active functions or RPCs to review and update where they reference `item_location` or location-batch stock:

- `accept_delivery_note_receiving_exception`
- `accept_delivery_note_receiving_overage`
- `adjust_dispatched_delivery_note_item`
- `approve_grn_with_batch_inventory_apply_inventory`
- `complete_pick_list_transaction`
- `get_inventory_batch_reconciliation_mismatches`
- `post_delivery_note_dispatch`
- `post_delivery_note_receive`
- `reserve_delivery_note_inventory`
- `reserve_delivery_note_inventory_lines`
- `void_pos_transaction`
- `generate_item_location_batch_sku`
- `set_item_location_batch_sku`

Target function naming:

- Rename `generate_item_location_batch_sku` to `generate_item_batch_location_sku`.
- Rename `set_item_location_batch_sku` to `set_item_batch_location_sku`.

Views to replace or remove:

- `v_inventory_recon_item_warehouse_vs_location`
- `v_inventory_recon_item_location_vs_location_batch`
- Keep or update `v_inventory_recon_item_warehouse_vs_batch`
- Keep or update `v_inventory_recon_item_batch_vs_location_batch`
- Add a replacement view for `item_warehouse` versus grouped `item_batch_locations` if useful.
- Rename retained reconciliation views to match the plural table names where practical.

### Seed Data

Update `supabase/seed.sql`:

- Stop inserting or updating `item_location`.
- Keep seeding `warehouse_locations`.
- Keep setting `item_warehouse.default_location_id`.
- Keep seeding `item_batches`.
- Keep seeding `item_batch_locations`.
- Ensure seeded `item_batches.qty_on_hand` matches grouped `item_batch_locations.qty_on_hand`.

### Generated Types

Regenerate after the migration is applied locally:

- `src/types/database.types.ts`
- `src/types/supabase.ts`

Expected type result:

- `Database["public"]["Tables"]["item_location"]` is removed.
- `item_batch_locations` exists.
- `item_batches` exists without `location_id`.
- `item_batch` and `item_location_batch` are removed from generated table contracts after the rename.

### Central Inventory Services

Primary refactor target:

- `src/services/inventory/locationService.ts`

Current responsibilities to split or rewrite:

- Keep default location resolution via `warehouse_locations` and `item_warehouse.default_location_id`.
- Remove `item_location` writes from `adjustItemLocation`.
- Replace FIFO-by-location behavior with grouped `item_batch_locations` reads where location-level consumption is needed.
- Avoid leaving multi-table stock writes in route handlers when the operation should be transactional.

Callers to review after changing the helper:

- `src/services/inventory/stockRequestDispatchService.ts`
- `src/services/inventory/transformationService.ts`
- `src/services/inventory/posStockService.ts`
- `src/app/api/stock-transfers/[id]/confirm/route.ts`
- `src/app/api/stock-transactions/route.ts`
- `src/app/api/van-sales/process-payment/route.ts`
- `src/app/api/invoices/[id]/send/route.ts`
- `src/app/api/invoices/[id]/post/route.ts`
- `src/app/api/tablet/purchase-receipts/[id]/post/route.ts`
- `src/app/api/purchase-orders/[id]/receive/route.ts`
- `src/app/api/sales-orders/[id]/convert-to-invoice/route.ts`
- `src/app/api/purchase-receipts/[id]/route.ts`

### API Routes

Routes with direct `item_location` usage that must be rewritten:

- `src/app/api/items/[id]/locations/route.ts`
- `src/app/api/stock-adjustments/[id]/post/route.ts`
- `src/app/api/sales-orders/[id]/convert-to-invoice/route.ts`
- `src/app/(dashboard)/inventory/adjustments/page.tsx`
- `src/services/inventory/stockRequestDispatchService.ts`
- `src/services/inventory/locationService.ts`

Routes using `item_location_batch` or `item_batch` today that must be renamed to `item_batch_locations` or `item_batches`:

- `src/app/api/reports/item-location-batch/route.ts`
- `src/app/api/reports/stock-aging/route.ts`
- `src/app/api/stock-adjustments/[id]/post/route.ts`
- `src/app/api/pick-lists/[id]/items/route.ts`
- `src/app/api/pick-lists/[id]/scan-source/route.ts`
- `src/app/api/grns/[id]/boxes/route.ts`
- `src/app/api/mobile/items/scan/route.ts`
- `src/app/api/sales-orders/[id]/convert-to-invoice/route.ts`

Warehouse location routes should generally remain, but still need regression checks:

- `src/app/api/lookups/route.ts`
- `src/app/api/lookups/warehouses/[id]/locations/route.ts`
- `src/app/api/warehouses/[id]/locations/route.ts`
- `src/app/api/warehouse-locations/[id]/route.ts`
- `src/app/api/items/[id]/default-location/route.ts`
- `src/app/api/warehouse-dashboard/route.ts`
- `src/app/api/dashboard/purchasing/route.ts`

### UI, Hooks, And Shared Types

Update item location display contracts:

- `src/types/inventory-location.ts`
- `src/components/items/locations/LocationsTab.tsx`

Report and preview consumers:

- `src/hooks/useItemLocationBatchReport.ts`
- `src/hooks/useStockAgingReport.ts`
- `src/components/reports/ReportPreviewDialog.tsx`
- `src/components/reports/ItemLocationBatchReportPDF.tsx`
- `src/components/reports/StockAgingReportPDF.tsx`
- `src/app/(dashboard)/reports/page.tsx`
- `src/components/layout/Breadcrumb.tsx`

These report files currently use item-location-batch naming. During implementation, either rename the files/routes/hooks to item-batch-location naming or keep the public route stable and update the internal table references. The choice should be made deliberately because route renames affect saved links and report consumers.

Location selection and warehouse operation UI to regression check:

- `src/components/stock-adjustments/StockAdjustmentFormDialog.tsx`
- `src/components/stock-adjustments/StockAdjustmentLineItemDialog.tsx`
- `src/components/purchase-receipts/ReceiveGoodsDialog.tsx`
- `src/components/stock-requests/ReceiveStockRequestDialog.tsx`
- `src/components/grns/BoxManagementSection.tsx`
- `src/app/(dashboard)/purchasing/grns/putaway/page.tsx`
- `src/app/tablet/picking/[id]/page.tsx`
- `src/app/tablet/receiving/delivery-notes/[id]/page.tsx`

Lookup hook to keep compatible:

- `src/hooks/useLookups.ts`

### Documentation To Update

Update docs that still describe `item_location` as an active aggregate table or use the old `item_batch` / `item_location_batch` table names:

- `docs/kb/02-INVENTORY-MANAGEMENT.md`
- `docs/kb/03-SALES-MANAGEMENT.md`
- `docs/kb/04-PURCHASING-MANAGEMENT.md`
- `docs/kb/06-MANUFACTURING.md`
- `docs/plans/inv-location-plan.md`
- `docs/plans/inv-location-todo.md`
- `docs/plans/inv-item-batch-implementation-plan.md`
- `docs/plans/TABLET_WAREHOUSE_IMPLEMENTATION_PLAN.md`
- `docs/plans/TABLET_WAREHOUSE_TODO.md`
- `docs/plans/delivery-note-receiving-implementation-plan.md`
- `docs/item-specific-uom-plan.md`
- `docs/inventory-acquisition-workflow.md`
- `docs/inventory-acquisition-workflow-v2.md`
- `docs/inventory-acquisition-todo.md`

## Implementation Steps

1. Verify live schema and data before editing.
   - Confirm `item_location` exists and `item_locations` does not.
   - Confirm all active `item_batch` rows reconcile against `item_location_batch`.
   - Confirm all active `item_warehouse` rows reconcile against `item_batch`.

2. Add a migration that renames the batch tables and updates reconciliation views/functions.
   - Rename `item_batch` to `item_batches`.
   - Rename `item_location_batch` to `item_batch_locations`.
   - Replace `item_location` reconciliation with grouped `item_batch_locations`.
   - Keep batch and location-batch reconciliation.
   - Add validation queries that fail loudly if totals do not reconcile.

3. Refactor reads from `item_location`.
   - Rewrite `src/app/api/items/[id]/locations/route.ts` to group `item_batch_locations` by location.
   - Preserve the current response shape where possible so `LocationsTab` stays stable.
   - Remove direct `.from("item_location")` calls from runtime code.

4. Refactor writes currently updating `item_location`.
   - Replace helper writes in `locationService.ts`.
   - Make stock-posting flows update `item_warehouse`, `item_batches`, and `item_batch_locations` consistently.
   - Move multi-row workflow mutations into transactional RPCs where the operation crosses tables or changes workflow state.

5. Move reports to `item_batch_locations`.
   - Review and validate `item-location-batch` and `stock-aging` report APIs.
   - Decide whether route/report names stay user-facing as `item-location-batch` or are renamed to `item-batch-locations`.
   - Ensure search, sorting, pagination, and stock status filters still use server-side filtering.
   - Update report labels only if the user-facing wording changes.

6. Update seed data.
   - Remove `item_location` seed inserts/updates.
   - Seed exact stock into `item_batch_locations`.
   - Keep `item_batches` totals aligned with `item_batch_locations`.

7. Drop or retire `item_location`.
   - Drop dependent views/functions first.
   - Drop table only after runtime code has no active references.
   - Regenerate DB types.

8. Update docs.
   - Replace the old `item_location` aggregate model with the grouped `item_batch_locations` model.
   - Document the remaining role of `warehouse_locations`, `item_batches`, and `item_batch_locations`.

9. Validate end to end.
   - Run `rg "item_location\\b|item_batch\\b|item_location_batch\\b" src supabase/seed.sql supabase/migrations` and classify only historical migration/doc references as allowed.
   - Run reconciliation SQL for `item_warehouse` versus `item_batches`.
   - Run reconciliation SQL for `item_batches` versus `item_batch_locations`.
   - Run `supabase gen types typescript --local` for both generated type files.
   - Run `npm run build`.
   - Run a local seed/reset validation when safe to do so.

## Validation Queries

Use these as implementation checks after the rename migration.

```sql
-- item_warehouse versus item_batches
SELECT
  iw.company_id,
  iw.item_id,
  iw.warehouse_id,
  COALESCE(iw.current_stock, 0) AS warehouse_qty,
  COALESCE(SUM(ib.qty_on_hand), 0) AS batch_qty
FROM public.item_warehouse iw
LEFT JOIN public.item_batches ib
  ON ib.company_id = iw.company_id
 AND ib.item_id = iw.item_id
 AND ib.warehouse_id = iw.warehouse_id
 AND ib.deleted_at IS NULL
WHERE iw.deleted_at IS NULL
GROUP BY iw.company_id, iw.item_id, iw.warehouse_id, iw.current_stock
HAVING COALESCE(iw.current_stock, 0) <> COALESCE(SUM(ib.qty_on_hand), 0);
```

```sql
-- item_batches versus item_batch_locations
SELECT
  ib.company_id,
  ib.id AS item_batch_id,
  ib.item_id,
  ib.warehouse_id,
  ib.batch_code,
  COALESCE(ib.qty_on_hand, 0) AS batch_qty,
  COALESCE(SUM(ilb.qty_on_hand), 0) AS location_batch_qty
FROM public.item_batches ib
LEFT JOIN public.item_batch_locations ilb
  ON ilb.company_id = ib.company_id
 AND ilb.item_batch_id = ib.id
 AND ilb.deleted_at IS NULL
WHERE ib.deleted_at IS NULL
GROUP BY ib.company_id, ib.id, ib.item_id, ib.warehouse_id, ib.batch_code, ib.qty_on_hand
HAVING COALESCE(ib.qty_on_hand, 0) <> COALESCE(SUM(ilb.qty_on_hand), 0);
```

```sql
-- derived location totals from item_batch_locations
SELECT
  ilb.company_id,
  ilb.item_id,
  ilb.warehouse_id,
  ilb.location_id,
  SUM(ilb.qty_on_hand) AS qty_on_hand,
  SUM(ilb.qty_reserved) AS qty_reserved,
  SUM(ilb.qty_available) AS qty_available
FROM public.item_batch_locations ilb
WHERE ilb.deleted_at IS NULL
GROUP BY ilb.company_id, ilb.item_id, ilb.warehouse_id, ilb.location_id;
```

## Risks

- Some current stock posting paths are non-transactional and update multiple inventory tables from API routes. Extending those paths should be avoided; touched workflow operations should move to DB-owned RPCs.
- Removing `item_location` before all API routes and helper callers are updated will break item detail stock display, stock adjustment posting, and some sales/picking flows.
- The reports should continue to use bounded server-side pagination and filtering.
- Generated types must be refreshed after local migration application or stale `item_location`, `item_batch`, or `item_location_batch` table types will hide missed references.
