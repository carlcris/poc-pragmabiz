---
name: item-seed-xlsx-migration
description: Use when migrating cleaned item price-list Excel workbooks into this repo's Supabase seed data, especially files like MATBOARD PRICE_copy.xlsx, POLYSTYRENE MOULDING PRICE_copy.xlsx, BACKING PRICE_copy.xlsx, or GLASS PRICE_copy.xlsx that must become DO import blocks in supabase/seed.sql with item rows, unit options, price tiers, dimensions, custom_fields, and opening stock.
---

# Item Seed XLSX Migration

## Overview

Migrate cleaned item price-list `.xlsx` files into `supabase/seed.sql` as seed-only import blocks. Follow the existing import blocks as the source of truth for SQL style and idempotent upserts.

## Workflow

1. Inspect repo context before editing.
   - Read the existing import blocks in `supabase/seed.sql`.
   - Confirm the target category code exists in the seeded `item_categories`.
   - Confirm required UOM codes exist in seeded `units_of_measure`.
   - Do not put seed data in migrations.

2. Inspect the workbook.
   - Prefer `python3 scripts/inspect_xlsx.py <file.xlsx>` from this skill when `openpyxl` is unavailable.
   - Identify the real header row and item-code column. Some sheets use column A for dimensions and column B for item codes.
   - Count usable rows, missing item codes/names, duplicate item codes, and optional metadata columns.
   - Stop and report duplicates or unclear columns instead of guessing.

3. Map workbook columns deliberately.
   - Insert `public.items` with category, UOM, item type, `purchase_price`, `sales_price`, `dimensions`, `custom_fields`, and stock flags.
   - Store workbook source filenames nowhere in `custom_fields`.
   - Store only useful metadata in `custom_fields`; do not add labels like unit labels unless the user explicitly requests them.
   - Keep dimensions in `dimensions` JSON, using fields the app reads: `width`, `height`, `length`, and `unit`.
   - For Matboard dimensions, use `{ "width": ..., "height": ..., "unit": "IN" }`.
   - For Glass, use `SHEET` as the base/default UOM unless the user explicitly overrides it.

4. Add the SQL block.
   - Create a `DO $<domain>_import$` block before later product import blocks.
   - Use a temp import table under `public`, insert workbook values, validate prerequisites, upsert `items`, upsert `item_unit_options`, upsert `item_prices`, and seed warehouse opening balances.
   - Drop the temp import table at the end.
   - Use deterministic opening quantities matching existing blocks:
     `10 + (get_byte(decode(md5(imported.item_code || ':' || warehouse_id::TEXT), 'hex'), 0) % 91)`.
   - Keep imports idempotent with `ON CONFLICT ... DO UPDATE`.

5. Price tiers.
   - Insert selling tiers such as `default`, `fc`, `ws`, `srp`, `above_50_sheets`, `chop_join`, or `framing` when present.
   - Do not create a `purchase` item price tier. Preserve purchase costs only in `items.purchase_price`.

6. Validate.
   - Run `git diff --check -- supabase/seed.sql`.
   - Verify generated row count equals parsed workbook row count.
   - Verify duplicate item-code count is zero.
   - Verify import order and prerequisite category/UOM checks.
   - Verify no workbook filename or `source` field appears in the import block.
   - Do not run `supabase db reset` unless the user asks, because it rebuilds and reseeds the local DB.

7. Documentation check.
   - Use `project-docs-sync` after implementation.
   - Usually no docs update is needed for seed-only price-list imports; still search `docs/kb` and `docs/guides` for affected terms.

## Workbook Notes

- Polystyrene moulding: category `POLY`, base UOM `STICK`, optional `BOX`, custom specification metadata, no source filename.
- Matboard: category `MAT`, base UOM `SHEET`, optional `BOX`, dimensions from workbook width/height with `unit: IN`, optional production metadata.
- Backing: category `BACK`, base UOM `PCS`, store `stand` in `custom_fields` when present.
- Glass: category `GLASS`, base UOM `SHEET`, optional `BOX`, dimensions width/height with `unit: IN`, store thickness and crate quantity in `custom_fields` when present.

When user instructions conflict with these notes, follow the newest explicit user instruction and preserve the repo's existing SQL patterns.
