# Remove Quantity Normalization Plan

Goal: Remove inventory quantity normalization entirely so all quantities are already in base UOM. This removes `input_qty`, `normalized_qty`, and `conversion_factor` fields and deletes all normalization logic.

## Scope (Explicit)
- Database: drop `input_qty`, `normalized_qty`, `conversion_factor` from `stock_transaction_items` and `stock_adjustment_items`.
- Services: remove normalization service and related types.
- APIs: remove normalization usage and write/read only `quantity` (and existing cost fields).
- UI: no normalization UI changes required (UOM already set on item).
- Data: no backfill needed because quantity is already base UOM; existing data fields will be dropped.

## Checklist
1. Database
- [x] Create migration to drop normalization columns and constraints.
- [x] Verify migration against current schema files in `supabase/migrations/`.

2. Code Removal (Normalization)
- [x] Delete normalization service and types (`normalizationService.ts`, `inventory-normalization.ts`).
- [x] Update all service logic to use raw `quantity` with item UOM.
- [x] Update all API routes to stop calling normalization helpers and stop inserting normalization fields.

3. Types
- [ ] Regenerate Supabase types after migration.
- [ ] Remove remaining references to normalization fields in local types (generated types will update).

4. Validation
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.

## Progress Notes
- 2026-02-09: Migration created to remove normalization fields.
- 2026-02-09: Removed normalization service/types and package conversion report surface area.
