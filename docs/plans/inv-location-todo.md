# Inventory Location Plan TODO

Source: `docs/plans/inv-location-plan.md`

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Done

## Phase 1: Schema + Backfill
- [x] Create migration for `warehouse_locations` table (fields, constraints, indexes).
- [x] Create migration for `item_location` table (fields, constraints, indexes).
- [x] Add `default_location_id` to `item_warehouse` (nullable) + FK.
- [x] Add `from_location_id` and `to_location_id` to `stock_transactions` (nullable) + FK.
- [x] Seed MAIN location per warehouse (`code=MAIN`, pickable+storable).
- [x] Backfill `item_location` from `item_warehouse` with MAIN location.
- [x] Set `item_warehouse.default_location_id` to MAIN.
- [x] Add consistency check query (manual SQL) for SUM(item_location.qty_on_hand) vs item_warehouse.qty_on_hand.

```sql
SELECT
  iw.item_id,
  iw.warehouse_id,
  iw.current_stock AS warehouse_on_hand,
  COALESCE(SUM(il.qty_on_hand), 0) AS locations_on_hand
FROM item_warehouse iw
LEFT JOIN item_location il
  ON il.item_id = iw.item_id
  AND il.warehouse_id = iw.warehouse_id
  AND il.deleted_at IS NULL
WHERE iw.deleted_at IS NULL
GROUP BY iw.item_id, iw.warehouse_id, iw.current_stock
HAVING COALESCE(SUM(il.qty_on_hand), 0) <> iw.current_stock;
```

## Phase 1: API + Services
- [x] CRUD for `warehouse_locations` (list/create/update/deactivate) with permissions.
- [x] Read `item_location` by item + warehouse (for UI tabs).
- [x] Update stock-in flows to upsert `item_location` and write `to_location_id`.
- [x] Update stock-out flows to deduct `item_location` and write `from_location_id`.
- [x] Update internal transfer flow: move between locations, keep `item_warehouse` totals unchanged.
- [x] Update warehouse transfer flow: OUT with `from_location_id`, IN with `to_location_id`.

## Phase 1: UI
- [x] Warehouse → Locations screen (create/edit/deactivate).
- [x] Item → Warehouse stock tab: add Locations tab with per-location quantities.
- [x] Stock In form: optional To Location (default MAIN).
- [x] Stock Out form: optional From Location (default MAIN).
- [x] Internal Transfer form: From → To Location.

## Phase 1: Permissions
- [x] Add `manage_locations` permission.
- [x] Add `view_location_stock` permission.
- [x] Add `transfer_between_locations` permission.
- [x] Wire permissions into routes/UI.

## Phase 1: Validation + QA
- [x] Guard against negative qty and reserved > on_hand in API.
- [ ] Verify migration/backfill on staging data.
- [ ] End-to-end test: receive → move → sell → reconcile totals.

## Phase 2 (Optional)
- [ ] DB triggers for item_location ↔ item_warehouse consistency.
- [ ] Make location selection required per warehouse config.
