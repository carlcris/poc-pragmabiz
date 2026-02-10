# Items UOM Refactor Plan (Remove Packaging)

## Goal
Refactor inventory and purchasing flows to use `uom_id` as the sole unit of measure for items. Remove packaging support from data model, API, UI, and seed data without breaking existing behavior.

## Scope
- Remove `item_packaging` table and all references.
- Remove `pack_type` and `pack_name` fields from `items`.
- Ensure all item quantities, pricing, and transactions use `uom_id`.
- Update API queries, UI forms, and seed data.
- Provide safe, non-breaking migration and backfill steps.

## Non-Breaking Strategy
1. Ship code changes that stop reading/writing packaging fields while still tolerating existing data.
2. Backfill `uom_id` for any items missing it.
3. Remove UI packaging options and default to item `uom_id`.
4. Drop packaging tables/columns only after code is deployed and verified.

## Work Plan (Checklist)
### 1. Inventory Audit
- [x] Identify all references to `item_packaging`, `packaging_id`, `pack_name`, `pack_type` in API and UI.
- [x] Identify all queries that join packaging or expose packaging fields.
- [x] Identify seed data entries that insert packaging records or set pack fields.

### 2. Schema Changes (Migration)
- [ ] Add/ensure `items.uom_id` is NOT NULL (if feasible), otherwise keep nullable and backfill.
- [x] Backfill `items.uom_id` for existing items.
- [x] Remove `pack_type` and `pack_name` columns from `items` (handled by dropping `item_packaging`).
- [x] Drop table `item_packaging`.
- [x] Remove foreign keys to `item_packaging` from dependent tables.

### 3. Backfill Plan
- [x] Choose a default UOM for items missing `uom_id`.
- [x] Update all items with null `uom_id` to the default.
- [x] If any transactional records reference packaging, migrate them to use `uom_id`.

### 4. API Refactor
- [x] Remove packaging joins from queries.
- [x] Remove `packaging_id` fields from request/response DTOs.
- [x] Replace packaging-based calculations with `uom_id` logic.
- [x] Ensure all endpoints return `uom` data via `uom_id`.

### 5. UI Refactor
- [x] Remove packaging selectors from item create/edit forms.
- [x] Remove packaging display fields in item views.
- [x] Default quantity unit labels to item `uom_id`.
- [x] Remove packaging-related validation and helper text.

### 6. Seed Data Updates
- [x] Remove seed inserts into `item_packaging`.
- [x] Remove `pack_type` and `pack_name` values from item seeds.
- [x] Ensure `uom_id` is set for all seeded items.

### 7. Test and Verification
- [ ] Run `npm run build` and validate type checks.
- [ ] Smoke test item create/edit, purchase order, and receipt flows.
- [x] Verify no packaging fields appear in responses or UI.

### 8. Rollback Plan
- [ ] Revert schema migration.
- [ ] Restore packaging code paths from git.
- [ ] Re-run seed data with packaging records.

## Deliverables
- Updated schema migration scripts.
- Updated API endpoints and UI components.
- Updated seeds.
- Build passes and key flows verified.
