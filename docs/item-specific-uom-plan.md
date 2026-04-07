# Item-Specific UoM and Barcode Plan

## Goal
Add item-specific unit options with `qty_per_unit` and an individual scannable barcode for each item/unit-option row, without reintroducing the old packaging subsystem.

This keeps:
- `units_of_measure` as the global unit catalog
- item-level quantity meaning on a separate item/unit-option table
- barcode scanning tied to the exact item/unit-option row selected in operations

## Business Decision
`qty_per_unit` is item-specific, not global.

Examples:
- Bottled Water
  - `EA` = 1
  - `BOX` = 24
- Biscuits
  - `EA` = 1
  - `BOX` = 12

One item may also have multiple options using the same UoM label:
- Powdered Drink
  - `EA` = 1
  - `BOX` = 12
  - `BOX` = 24
  - `BOX` = 36

So `BOX` remains a shared label in `units_of_measure`, but the actual quantity and barcode are defined per item option row.

## Non-Goals
- Do not add `conversion_factor` to `units_of_measure`
- Do not restore `item_packaging`
- Do not implement a generic cross-item packaging model

## Barcode Direction Change
Current item records still carry legacy item-level SKU/QR fields in the app layer:
- `sku`
- `sku_qr_image`

This plan replaces that direction with item/unit-option barcodes.

Decision:
- auto-generate a unique 10-digit numeric barcode for every `item_unit_options` row
- barcode generation should happen at the database level, not in application code
- the base unit option barcode becomes the primary barcode for the item
- `items.sku` and `items.sku_qr_image` should be deprecated and then completely removed

This moves barcode identity from item-level SKU/QR into the item-specific unit-option model.

## Recommended Data Model

### 1. Keep `units_of_measure` as shared labels only
Existing table remains the global UoM catalog:
- `id`
- `code`
- `name`
- `symbol`
- `is_base_unit`
- `is_active`

This table should not store:
- `qty_per_unit`
- item-dependent barcode values

### 2. Add a new item-specific unit option table
Recommended table name:
- `item_unit_options`

Recommended columns:
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id UUID NOT NULL REFERENCES companies(id)`
- `item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE`
- `uom_id UUID NOT NULL REFERENCES units_of_measure(id)`
- `option_label VARCHAR(120) NULL`
- `qty_per_unit NUMERIC(15,4) NOT NULL`
- `barcode VARCHAR(10) NOT NULL`
- `is_base BOOLEAN NOT NULL DEFAULT false`
- `is_default BOOLEAN NOT NULL DEFAULT false`
- `is_active BOOLEAN NOT NULL DEFAULT true`
- `sort_order INTEGER NOT NULL DEFAULT 0`
- `created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `created_by UUID NOT NULL REFERENCES users(id)`
- `updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
- `updated_by UUID NOT NULL REFERENCES users(id)`
- `deleted_at TIMESTAMP NULL`
- `version INTEGER NOT NULL DEFAULT 1`

### 3. Constraints
- `qty_per_unit > 0`
- multiple rows with the same `uom_id` for one item are allowed
- at most one non-deleted base row per item is enforced in the database
- base row must have `qty_per_unit = 1`
- default row must belong to the same item
- barcode must be unique within company for active rows
- barcode must be exactly 10 numeric digits
- base and default rows cannot be inactive
- base row must use the same `uom_id` as `items.uom_id` in phase 1
- item, unit, and item-unit-option company ownership must match

Recommended indexes:
- `idx_item_unit_options_item_id`
- `idx_item_unit_options_uom_id`
- `idx_item_unit_options_barcode`
- partial unique index on active barcode

Recommended uniqueness rules:
- unique active combination on `(company_id, item_id, uom_id, qty_per_unit)`
- optional unique active `(company_id, item_id, option_label)` when `option_label` is used

## Relationship to Existing Item Model
Current item model still uses `items.uom_id` directly.

Phase 1 recommendation:
- keep `items.uom_id` as the item’s base UoM pointer for compatibility
- require the base `item_unit_options` row to use the same `uom_id`

This avoids a large immediate refactor across:
- item APIs
- purchasing APIs
- sales APIs
- stock request APIs
- stock transaction APIs

Later, `item_unit_options` can become the richer operational source while `items.uom_id` remains a compatibility field or is eventually deprecated.

## Barcode Model

### Requirement
Each item/unit-option row must have its own barcode.

Examples:
- Bottled Water / EA -> barcode A
- Bottled Water / BOX (24 EA) -> barcode B
- Biscuits / EA -> barcode C
- Biscuits / BOX (12 EA) -> barcode D
- Powdered Drink / BOX (12 EA) -> barcode E
- Powdered Drink / BOX (24 EA) -> barcode F
- Powdered Drink / BOX (36 EA) -> barcode G

### Why
Scanning must resolve both:
- the item
- the selected unit option

Otherwise a scanned barcode only identifies the item and the user still has to choose the unit manually.

### Barcode behavior
Barcode scan should resolve to one `item_unit_options` row.

That row gives:
- `item_id`
- `uom_id`
- `option_label`
- `qty_per_unit`
- whether it is base/default

### Barcode rules
- barcode is required
- barcode must be unique per company
- barcode must be exactly 10 digits
- barcode is auto-generated by the system in normal flows
- if barcode is reused, save must fail

### Barcode generation
Recommended rule:
- generate a unique random 10-digit numeric barcode for each `item_unit_options` row

Validation:
- regex: `^[0-9]{10}$`
- unique active barcode per company

Recommended ownership:
- generate in the database using a trigger/function pattern
- use a sequence-backed pseudo-randomized 10-digit generator to avoid app-side races
- enforce format and uniqueness in the database
- application inserts should omit `barcode` in normal create flows and let the database assign it
- manual override or regeneration, if allowed later, should still pass through database validation

### Base-unit barcode as item primary barcode
The base unit option barcode becomes the item's primary barcode.

Example:
- Bottled Water / `EA` base option -> item primary barcode
- Bottled Water / `BOX (24 EA)` -> alternate unit barcode

### Legacy SKU deprecation
Current item-level fields:
- `items.sku`
- `items.sku_qr_image`

Planned direction:
1. stop generating new `sku` values
2. stop generating new `sku_qr_image` values
3. use the base unit option barcode as the primary barcode shown in item screens
4. migrate item scanning, labels, and barcode lookup to `item_unit_options.barcode`
5. remove `sku` and `sku_qr_image` from schema, APIs, generated types, and UI after transition

## Operational Model

### Base quantity storage
Store inventory internally in base item quantity.

Example:
- Bottled Water base UoM = `EA`
- `BOX` row has `qty_per_unit = 24`
- receiving `3 BOX` becomes `72 EA`

### UI display rule
Never show bare `BOX` in critical workflows when ambiguity matters.

Prefer:
- `BOX (24 EA)`
- `CASE (48 EA)`
- `PACK (6 EA)`

### Conversion rule
Whenever a transaction uses a non-base item/unit-option row:
- `base_quantity = entered_quantity * qty_per_unit`

This conversion is item-specific and does not depend on global UoM metadata.

## API Plan

### 1. Keep current `/api/units-of-measure`
No qty fields added there.

Purpose stays:
- load global unit labels for dropdowns

### 2. Add item-specific unit option endpoints
Recommended endpoints:

- `GET /api/items/:id/unit-options`
- `POST /api/items/:id/unit-options`
- `PUT /api/items/:id/unit-options/:unitOptionId`
- `DELETE /api/items/:id/unit-options/:unitOptionId`
- `GET /api/item-unit-options/by-barcode?barcode=...`

### 3. Response shape
Recommended response per row:
- `id`
- `itemId`
- `uomId`
- `uomCode`
- `uomName`
- `uomSymbol`
- `optionLabel`
- `displayLabel`
- `qtyPerUnit`
- `barcode`
- `isBase`
- `isDefault`
- `isActive`
- `sortOrder`

### 4. Validation rules
- one base row only
- base row must be `qtyPerUnit = 1`
- cannot delete the only active base row
- cannot set two defaults
- barcode uniqueness enforced
- same item may reuse the same `uom_id` only when the option remains distinguishable by `qty_per_unit`

## Screen-Level Plan

### 1. Item Create Page
File area:
- `src/app/(dashboard)/inventory/items/create/page.tsx`

Recommended phase 1 behavior:
- keep current single-UoM create flow
- selected item UoM becomes the base row automatically after item creation
- auto-create one `item_unit_options` row:
  - same as item base UoM
  - `qty_per_unit = 1`
  - `is_base = true`
  - `is_default = true`
  - auto-generated 10-digit barcode

Why:
- avoids overloading the create form
- reduces migration complexity

### 2. Item Edit Page
File area:
- `src/app/(dashboard)/inventory/items/[id]/edit/page.tsx`

Add a new section:
- `Units for This Item`

Recommended table columns:
- Unit
- Display Label
- Qty per Unit
- Barcode
- Base
- Default
- Active
- Actions

Actions:
- add row
- edit display label if needed
- edit qty per unit
- regenerate barcode only through an explicit admin action if needed
- set as default
- activate/deactivate

Rules:
- base row not deletable
- base row qty locked to `1`
- barcode shown as system-generated
- barcode uniqueness validated on save

### 3. Item Detail Page
File area:
- `src/app/(dashboard)/inventory/items/[id]/page.tsx`

Add a `Unit Options` card.

Display example:
- `EA (base)`
- `BOX (24 EA)`
- `CASE (48 EA)`
- repeated same-UoM options must always show quantity:
  - `BOX (12 EA)`
  - `BOX (24 EA)`
  - `BOX (36 EA)`
- show barcode beside each row
- include a print/download barcode action later if needed

Primary barcode treatment:
- highlight the base-unit barcode as the item's primary barcode
- show alternate unit-option barcodes as secondary scan codes

### 4. Transaction Screens
Later phase, update transaction entry flows to use item/unit-option rows.

Priority order:
1. Purchase orders
2. Stock requests
3. Sales orders
4. Stock adjustments
5. POS and scanner-driven screens

Recommended UX:
- user selects item
- unit dropdown filters to that item’s `item_unit_options`
- quantity hint shows normalized base amount
- barcode scan can prefill both item and unit

Example helper text:
- `2 BOX = 48 EA`

Preferred selector display:
- `EA`
- `BOX (12 EA)`
- `BOX (24 EA)`
- `BOX (36 EA)`

Stock-adjustment rule:
- stock adjustments operate in base quantity
- when they affect batch-tracked stock, they must keep `item_warehouse`, `item_location`, `item_batch`, and `item_location_batch` in sync
- positive adjustments should create or append to an explicit adjustment batch
- negative adjustments should consume existing location-batch rows in FIFO order unless and until the UI supports explicit batch selection

### 5. Scanning Flows
When scanning a barcode:
- lookup `item_unit_options` by barcode
- resolve exact item and unit
- prefill quantity unit automatically

This is the main reason barcode belongs on the item/unit-option row rather than on `items` or `units_of_measure`.

## Migration Plan

### Phase 1: Schema only
- add `item_unit_options` table
- add triggers/indexes/constraints
- add a database barcode generator/trigger for 10-digit numeric values
- add a validation trigger to enforce company consistency and base-UoM consistency
- mark legacy `items.sku` and `items.sku_qr_image` as deprecated in app contracts

### Phase 2: Backfill
For every existing item:
- create one base `item_unit_options` row from `items.uom_id`
- `qty_per_unit = 1`
- `is_base = true`
- `is_default = true`
- auto-generate a unique 10-digit barcode
- copy operational barcode ownership to the new base row instead of item-level SKU/QR
- only backfill items that do not already have an active `item_unit_options` row
- inherit `created_at`, `updated_at`, `created_by`, and `updated_by` from the source item where available
- leave `option_label` null for the base row in phase 2
- keep the backfilled base row active even when the item itself is inactive

### Phase 3: UI management
- item detail + edit page support for item/unit-option rows
- item APIs return `primaryBarcode`, `primaryBarcodeUnitOptionId`, and `unitOptions`
- new item creation creates the base `item_unit_options` row immediately after the item insert
- new item creation no longer generates fresh `sku` or `sku_qr_image` values
- item detail/edit screens switch from SKU QR display to base-unit barcode display
- nested item-unit-option APIs exist for list/create/update/delete
- edit screen can add, edit, activate/deactivate, and set default for non-base unit options
- base unit option remains protected from delete/deactivate through API rules

### Phase 4: Barcode support
- auto-generated barcode support
- barcode lookup endpoint
- scanner integration in one transactional flow first
- switch item label/print/display logic to the base unit barcode
- implemented lookup endpoint: `GET /api/item-unit-options/by-barcode?barcode=...`
- item barcode lookup is available, but picking/location scan flows remain unchanged for now because they use a different SKU model

### Phase 5: Operational rollout
- transactional modules accept `item_unit_option_id` or resolve from barcode
- base quantity normalization applied consistently
- implemented first transactional module: stock requests
- `stock_request_items` now stores `item_unit_option_id` alongside legacy `uom_id`
- stock request create/edit UI now selects item-specific unit options such as `BOX (24 EA)`
- stock request read views now display the selected item-unit-option label instead of only the bare UoM code
- keep downstream fulfillment flows compatible for now by retaining `uom_id`
- implemented next transactional module segment: delivery notes
- `delivery_note_items` now stores `item_unit_option_id` for new rows
- delivery note create and add-items flows derive `item_unit_option_id` from the source stock-request line on the server
- delivery note detail view, queue-picking dialog, create dialog, add-items dialog, and PDF print prefer the override unit label
- historical `delivery_note_items` rows are intentionally not backfilled in this phase
- implemented next transactional module segment: pick lists
- `pick_list_items` now stores `item_unit_option_id` for new rows
- pick list creation derives `item_unit_option_id` from the source delivery-note line on the server
- pick list detail and tablet picking screens now prefer the selected item-unit-option label instead of only the bare UoM
- historical `pick_list_items` rows are intentionally not backfilled in this phase
- implemented next transactional module segment: purchasing stock requisitions
- `stock_requisition_items` now stores `item_unit_option_id` and `uom_id`
- stock requisition create and edit APIs resolve and validate the selected item-unit-option server-side
- stock requisition create/edit UI now lets users choose item-specific unit options and shows `Qty/Unit`
- stock requisition detail view now shows the selected unit label and `Qty/Unit`
- implemented next transactional module segment: GRN receiving sourced from load-list unit options
- `grn_items` now stores `load_list_item_id` and `item_unit_option_id`
- GRN creation derives line identity from the source load-list item instead of trusting client-sent `item_id` and quantity
- GRN detail and tablet receiving screens now show expected quantity in base units using `load_list_qty * qty_per_unit`
- load-list arrival reversal now supports `arrived -> in_transit` through `reverse_load_list_arrival(...)` only when the auto-created GRN is still an untouched draft; the draft GRN is hard-deleted inside the RPC because `grns.load_list_id` is globally unique and a soft-deleted GRN would block re-arrival from creating a replacement GRN
- load-list cancellation is blocked once a load list is `arrived`, `receiving`, `pending_approval`, or `received`; users must reverse an untouched arrived load list back to `in_transit` before cancellation
- delivery-note reservation, dispatch, receive, and post-dispatch adjustment RPCs now convert selected-unit qty into base inventory qty
- stock-adjustment posting now updates batch layers, not just warehouse/location layers
- add reconciliation repair migration to rebuild `item_batch` totals from `item_location_batch` when historical mismatches already exist

### Phase 6: Legacy field removal
- remove `items.sku`
- remove `items.sku_qr_image`
- remove item-level SKU/QR generation code paths
- remove SKU-based search and display paths that conflict with barcode-first behavior
- implemented:
  - application item contracts no longer expose `sku` / `sku_qr_image`
  - item list/detail APIs no longer return item SKU
  - item lookups, stock-aging, and item-location-batch reports no longer search or display item SKU
  - tablet pick-list fallback scanning now uses item-unit-option barcode instead of item SKU
  - schema migration removes `items.sku` and `items.sku_qr_image`

## Compatibility Strategy

### Short term
Keep existing transaction tables on current `uom_id` contracts while introducing `item_unit_options`.

This lets us:
- ship schema first
- ship item management UI next
- avoid a big-bang transaction rewrite

During this phase:
- treat the base unit option barcode as the authoritative item barcode for all new work
- rely on DB constraints for "at most one active base/default"; app flows and backfill complete the "must exist" rule

### Medium term
For transaction line items, consider adding:
- `item_unit_option_id`
- or equivalent item-specific barcode/unit reference

This is the cleanest way to preserve the exact selected unit option at transaction time.

Without that, `uom_id` alone is not enough to recover item-specific `qty_per_unit` when one item can have multiple `BOX` options.

Implemented first:
- `stock_request_items.item_unit_option_id`
- fallback resolution from `item_id + uom_id` is kept in the API for compatibility during transition
- `stock_requisition_items.item_unit_option_id`
- `stock_requisition_items.uom_id`
- `grn_items.load_list_item_id`
- `grn_items.item_unit_option_id`
- `delivery_note_items.item_unit_option_id` for new writes only
- no historical backfill for delivery note lines in this phase
- `pick_list_items.item_unit_option_id` for new writes only
- no historical backfill for pick list lines in this phase

## Open Design Choices

### 1. Base UoM mutability
Recommended:
- do not allow changing base UoM once transactions exist

### 2. Barcode requirement
Recommended:
- barcode required for every item-unit-option row
- barcode auto-generated as 10 numeric digits

### 3. Default UoM
Recommended:
- base row can also be default initially
- allow users to choose a different default sales/purchase unit later

## Risks
- If bare unit labels are shown without `qty_per_unit`, users will misread them
- If the same item can have multiple `BOX` options, the UI must always render quantity in the label
- If transaction tables keep only `uom_id`, item-specific quantity context is incomplete
- If barcode uniqueness is not enforced, scan results become ambiguous
- If legacy `sku` and new base-unit barcode coexist too long as competing scan identities, users may scan the wrong code
- If base UoM can be changed freely after transactions, historical quantity interpretation becomes risky

## Recommended Delivery Order
1. Add `item_unit_options` schema
2. Backfill base rows
3. Add item detail/edit UI
4. Add barcode per item/unit-option row
5. Add barcode lookup API
6. Switch item screens from SKU QR display to base-unit barcode display
7. Update stock requests first
8. Update purchasing stock requisitions
9. Update delivery note persistence and displays
10. Update pick list persistence and displays
11. Expand to the rest of inventory/purchasing/sales flows
12. Remove legacy SKU/QR code paths and fields

## Expected Outcome
After this change:
- `units_of_measure` remains a shared unit label catalog
- each item defines its own allowed unit options
- one item may have multiple options for the same UoM
- each item/unit-option row defines its own `qty_per_unit`
- each item/unit-option row has its own auto-generated 10-digit barcode
- the base unit barcode becomes the item's primary barcode
- legacy `sku` and `sku_qr_image` are removed after transition
- scanning can identify both item and unit directly
