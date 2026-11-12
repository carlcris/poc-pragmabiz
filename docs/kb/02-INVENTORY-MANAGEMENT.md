# Inventory Management Module

## Overview

The Inventory Management module is a comprehensive multi-warehouse inventory tracking system with location-level stock management, real-time transaction tracking, multiple units of measure, and automatic reorder management. It serves as the foundation for all stock-related operations across sales, purchasing, and manufacturing.

The Stock Transactions warehouse column shows the warehouse code with the full location name path beneath it (for example, `Zone 3 / Rack 1 / Bin 17`), without location codes. Transfers show both source and destination paths. The list and detail APIs supply `fromLocationPath` and `toLocationPath` using a shared batched ancestor lookup. The details dialog uses the same names-only paths, including the destination path for incoming stock.

## Key Features

- **Multi-warehouse** inventory tracking
- **Location-level** stock management
- **Multiple units of measure** per item with conversions
- **Real-time** stock transactions
- **Reserved vs available** stock calculations
- **Stock aging** and valuation reports
- **Automatic reorder** alerts
- **Barcode/QR code** support
- **Batch tracking** for perishables
- **Stock adjustments** with approval workflow
- **Business-unit stock fulfillment** across multiple warehouses
- **Stock requisitions** for internal requests

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Presentation Layer                     │
│  Item Master UI | Warehouse UI | Stock Transaction UI    │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                   Application Layer                       │
│  API Routes | Inventory Services | Stock Validation      │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                 Transaction Layer (RPC)                   │
│  Stock Adjustments | Transfers | Reservations            │
└──────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────┐
│                      Data Layer                           │
│  Items | Warehouses | Stock Transactions | Ledger        │
└──────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Item Master

The **Item** is the central entity representing a product or material in the system.

Item list/detail pricing and customer price resolution without an explicit `asOfDate` use the current business unit's timezone (`business_unit.timezone`, default `Asia/Manila`) to evaluate inclusive price effective dates. This includes chop-and-join and framing tiers: prices become available at local midnight, not UTC midnight. Explicit customer pricing dates remain unchanged.

**Key Attributes**:

- **Code**: Unique item identifier (SKU)
- **Name**: Product name
- **Description**: Detailed description
- **Category**: Product categorization
- **Unit Options**: Multiple units of measure (base + conversions)
- **Purchase Price**: Last/average purchase cost (runtime calculation)
- **Selling Price**: Standard selling price
- **Reorder Point**: Default company-wide minimum stock threshold in the base unit
- **Reorder Quantity**: Default company-wide suggested replenishment quantity in the base unit
- **Maximum Stock Level**: Maximum stock to maintain
- **Is Active**: Enable/disable item

**Unit Options**:
Each item can have multiple unit options (e.g., box, piece, dozen) with conversion factors to the base unit.
On the item's **Unit Options** tab, **Edit** stays on the row; **Set Default**, **Activate** or
**Deactivate**, and **Delete** are in the row's **More** menu.

**Item details on phones**:
Below 768px the stock cards sit in one row, the tab pills stay in one row that scrolls sideways on its own, and
the Prices and Unit Options tabs show stacked rows instead of tables; price Edit and Delete are in
each row's **More** menu. Location names in the Locations tab wrap instead of truncating.

**Locations tab batches**:
Each batch shows its code with Received Date and Expiration Date beneath, then On Hand, Reserved,
and Available. **Edit Expiration** and **Print QR** are in the batch row's **More** menu at every
width. Below 1024px batches render as stacked rows; the location tree sits beside the batch panel
only from 1280px and stacks above it on narrower screens.

**Barcode presentation**:
The item details and edit screens render the generated base-unit barcode as a linear Code 128
symbol. Batch-location and warehouse workflow labels continue to use their existing QR payloads.

**Exports**:
The Item Master export supports CSV, XLSX, and PDF formats. Each export uses the current search,
category, status, warehouse, and business-unit scope filters. Export requests are bounded to 5,000
filtered rows; users must narrow filters before exporting larger result sets. The Item Master list
and export show open putaway quantity separately from available stock. The warehouse selector calls
its business-unit-wide option **All Inventories**. That option aggregates warehouse inventory for the
selected business unit and includes open putaway tasks that do not have a final warehouse yet. A
specific warehouse filter includes only putaway tasks already assigned to that warehouse.

**Phone layout**:
Below 768px the Item Master list shows one stacked row per item instead of the table, keeping every
column: name, Chinese name, code, category, and status, with On Hand, Allocated, Putaway Qty, and
Available beneath. Tapping a row opens the item; **Edit** and **Delete** are in the row's **More**
menu and keep their permission checks. Search stays visible beside a **Filters** button whose
panel holds the category, warehouse, and status filters, an active-filter count, and **Clear All**.
The pager scrolls with the list and uses labelled Previous and Next buttons; this pager applies to
every list that uses the shared pagination bar. From 768px the table keeps a minimum height of
about four rows, so short screens scroll the page instead of hiding the table. Server-side
filtering and bounded pagination are unchanged.

```typescript
// Example: Item with multiple units
Item: "Widget ABC"
  Base Unit: "piece"
  Unit Options:
    - Piece: 1 piece (base)
    - Box: 12 pieces
    - Carton: 144 pieces (12 boxes)
```

### 2. Warehouse

A **Warehouse** represents a physical storage location where inventory is held.
The Warehouse Management list, detail, create, update, delete, locations, and floor-map paths are
scoped to the active business unit. A user who can access several business units must switch the
active business unit before managing one of its warehouses. Workflows that intentionally select a
warehouse outside the active unit use explicit cross-business-unit lookup endpoints instead.

**Key Attributes**:

- **Code**: Unique warehouse identifier
- **Name**: Warehouse name
- **Locations**: Sub-locations within warehouse
- **Is Active**: Enable/disable warehouse

**Warehouse Locations**:
Users with `manage_locations.delete` permission can choose **Delete location** in the row or
selected-location actions menu and confirm deletion. Only empty leaf locations may be deleted:
stock, reservations, pending or partially completed putaway, and any remaining child locations (including inactive children)
block the operation. `DELETE /api/warehouse-locations/[id]` calls the transactional
`delete_warehouse_location` RPC, which locks the warehouse and location and uses the existing
hierarchy guards. Deletion is soft: historical references and allocated codes remain preserved.
Deletion conflicts keep the dialog open and explicitly explain that stock, stock reservations, or
unfinished putaway must be cleared before retrying. Successful deletion refreshes location
lists, trees, selectors, item views, capacity and location reports; deleting the open location
returns to its parent. Existing server filtering and bounded pagination are unchanged.

The item's selected location loads current direct and subtree stock through
`GET /api/items/[id]/location-stock-tree?warehouseId=...&locationId=...&limit=1`.
This exact-location mode returns at most one node, including an empty selected location, and uses
existing company/business-unit access checks. Stock moves invalidate this query alongside the tree.
Search selection uses the same totals as tree selection. Batch pagination uses the batch response's
count and page size, including exhausted batches, so later stocked batches remain reachable.

Locations form a configurable hierarchy within one warehouse. Types (`zone`, `aisle`, `rack`,
`shelf`, `bin`, and `crate`) describe a location rather than prescribe its children. For example,
`Rack → Bin`, `Rack → Shelf → Bin`, and `Zone → Crate` are all valid, including mixed child types.
Manage Locations opens a bounded page of warehouse-level locations; **Open** browses direct
children. The open location is kept in the URL (`?location=<id>`), so refresh, browser Back, and
shared links restore it; the breadcrumb starts with the warehouse name and lists every ancestor. An
open location shows a summary with its type, use, status, address, stock stored directly there,
stock including sublocations, and sublocation count. A **Structure** tree loads one level at a time
(50 children per expanded location, with **View all in table** beyond that); it sits beside the
table on screens at least 1536 px wide and opens as a dialog from the **Structure** button on
smaller screens. Each tree row shows an icon for its location type (zone, aisle, rack, shelf,
bin, crate). The tree supports arrow keys, Home/End, and Enter. **Expand All** opens every
branch, loading the complete lightweight hierarchy in sequential pages of 500 locations.
Only visible rows are rendered, with no cap on how many locations can be expanded. The visible
rows refresh automatically when earlier warehouse sections expand, collapse, or are removed; no
scroll or page reload is needed. Loading progress
is shown; **Collapse All** cancels pending loading and closes every branch; the same buttons appear in the **Browse** picker. Address search inside an open
location defaults to **This Branch** (its descendants only); **Whole Warehouse** searches all
levels, and each search result offers **Show in Hierarchy** to open its parent. At warehouse level the header action is **Add
Location**; inside an opened location it becomes **Add Sublocation**, and each active row's actions
menu offers **Add Inside**. New locations default to the location being viewed (or the row chosen) as
their parent, shown as a read-only **Inside** value with **Change** to pick another parent. The type
is pre-selected from the most common type among the listed siblings (otherwise Bin) and remains only
a label. Location codes are generated by the database when saved: each child appends its type
letter and next available number to its parent's code, such as `Z01-R01-B01`. Prefixes are
`Z` (Zone), `A` (Aisle), `R` (Rack), `S` (Shelf), `B` (Bin), and `C` (Crate).
Numbers start at 01 and expand without truncation (`B99`, `B100`). Allocation uses the shared
company-scoped generator with a warehouse/parent-code/type namespace; warehouse locking and the
unique constraint prevent duplicate allocations. Existing and soft-deleted codes stay reserved.
Historical codes are not rewritten by migration; trusted database seed/import fixtures may retain
explicit codes, while application inserts and updates must omit code.

Code is read-only and shows an **Auto Generated** placeholder for new locations or type changes,
without a code template or explanatory paragraph. Existing saved codes remain visible when editing.
**Save & Add Another** keeps the parent and settings, increments the name's
trailing number, and lets the database allocate another code. Creating below an existing manual
parent code appends to that code once. Invalid parents and capacities show actionable errors.
Generated codes over 100 characters return `LOCATION_CODE_TOO_LONG`, with guidance to choose a
shallower parent; supplied codes are rejected by the strict API contract.

**Move** changes the parent and regenerates the moved location and every descendant's code and
address in one transaction. Changing location type also regenerates the branch's codes; changing
only a name refreshes addresses without changing codes. IDs, stock links, and reservations stay
attached to the same records. Replace printed labels after a move or type change. Existing
stock/reservation/pending-putaway restrictions still block moves. The `update_warehouse_location`
RPC locks the warehouse and target row, and a set-based recursive trigger updates descendants;
any failure rolls back the hierarchy, codes, and sequence allocations together. Location lists,
trees, details, selectors, item-location views, relevant reports, floor maps, and stock-adjustment
views are invalidated after edits.

**Add Multiple** creates up to 100 siblings in one transaction. From/To and the optional name
prefix control names only (for example, Bin 1–20); codes are always allocated automatically.
The database preview shows code templates with `…`, names, and addresses; final numbers are
assigned at save time. Repeating a name range creates new locations with distinct codes.
`GET`/`POST /api/warehouses/[id]/locations/batch` use `preview_warehouse_locations_batch` and
`create_warehouse_locations_batch`. Requests include parent, type, name range and settings;
manual code-prefix, digit-width, and skip-existing fields are no longer accepted.

**Copy Structure** copies up to 200 locations under another parent or at warehouse level.
Every copied location receives a fresh generated code. Optional name replacement remains available.
Type, use, capacity, and active settings are copied; stock, reservations, and floor-map positions
are not. The destination excludes the source branch. Preview codes are templates, not reserved
numbers. `GET`/`POST /api/warehouse-locations/[id]/copy` use `plan_warehouse_location_copy` and
`copy_warehouse_location_structure`; the copy locks the warehouse and source, re-plans, and inserts
level by level in one transaction. Requests no longer accept code-find/code-replace fields.
Failed copies leave no copied rows or sequence changes. Known errors include
`LOCATION_COPY_INVALID`, `LOCATION_COPY_TOO_LARGE`, `LOCATION_HIERARCHY_CYCLE`, and
`LOCATION_PARENT_INVALID`.

Parent, Move, and Copy destination fields also offer **Browse**, which opens the structure tree in
a dialog so a location can be chosen level by level; the location being moved or copied is shown
but cannot be chosen.

Each location independently controls storage and picking eligibility. The UI presents this as one
**Use** choice: **Store & Pick** (storable and pickable), **Store Only** (storable, not pickable), or
**Organize Only** (neither). A pickable but non-storable combination is not offered because stock
cannot be placed there; saving such an existing location stores it as Organize Only. New zones and
aisles default to Organize Only and other types to Store & Pick until the user picks a use. A grouping location can be
non-storable while its descendants store stock. A parent may also hold direct stock: direct
capacity and subtree quantity are separate, and ancestor totals are never additional allocatable
inventory. Reparenting a stocked/reserved subtree or changing eligibility while incompatible stock
or pending putaway exists is rejected. Active children must be handled before deactivating a parent.
Cycle and cross-warehouse parenting are rejected in the database. Existing locations, stock IDs,
and batch-location SKUs are preserved; use Move Stock to place existing stock into new children.

Operational selectors search stored full addresses on the server and return five initial results.
Location management is paginated up to 100 rows. Floor-map stock is independently aggregated for
the selected floor, so paging does not hide stocked mapped racks.

The item **Locations** tab shows one section per warehouse holding the item (20 warehouses per
page). Each warehouse header shows on-hand, reserved, and max stock with **Set Max**, plus the
warehouse's preferred location by name with **Change** (a storable-location picker); the preferred
location can also be set from the selected storage location panel. Organize Only locations cannot
be preferred; the API rejects inactive or non-storable selections with `LOCATION_STORAGE_UNAVAILABLE`
and the UI asks the user to choose an active storage location. Below it, **Where It's Stored** is a tree of only
the locations whose branch holds the item, loaded one level at a time (50 per level, **Show more**
for the rest). Each line's on-hand and available quantities include everything inside that
location, so a rack's total equals stock on the rack itself plus its bins; when a container holds
stock directly and also has stocked sublocations, a first child line labelled "-" (announced as
"On … itself") shows the direct part. Each line shows its location-type icon, and **Expand All** /
**Collapse All** beside the location search open or close every warehouse's tree (Expand All also
reopens collapsed warehouse sections); both are disabled while search results are shown. Expand All
uses the same paginated, virtualized hierarchy loading as warehouse management, with server-computed
stock totals. Across warehouse sections only one hierarchy page request runs at a time. Batches and
action eligibility still load only when a location is selected. A failed batch shows Retry; partial
results are not presented as a complete hierarchy.
Posting stock adjustments or putaway invalidates warehouse location details and hierarchy queries,
so quantities and structural-edit restrictions refresh without waiting for cache expiry. Saving a
floor map invalidates item stock overlays for that map and business unit, refreshing rack highlights
and off-floor location counts.

Location edits invalidate cached item location names and descendant addresses, including preferred
location summaries and the Item Location Batch / Stock Aging reports. Open views refresh after the
edit; previously visited views reload current data when reopened instead of waiting for cache expiry.
Selecting a location opens a panel with its name path, totals (for a container: including
sublocations, reserved, available, and stored here), **Set as Preferred** for storable locations, **Move Stock From Here**
(opens Move Stock with that warehouse and location as the source), its stocked sublocations, and
the batches stored directly on it (20 per page, oldest first, with **Print QR**). Address search
lists matching locations; choosing one opens it in its warehouse. The tree and summary come from
`get_item_location_stock_tree` and `get_item_warehouse_stock_summary`
(`GET /api/items/[id]/location-stock-tree` and `/warehouse-stock`), which roll up the item's stock
rows over `path_ids` within the caller's business unit; batches still come from
`get_item_location_stock_page`. On narrow screens the panel appears below the tree.

Pick-list creation optionally limits allocation to a selected location and all its descendants.
An empty selection uses the fulfilling warehouse. FIFO, selected-batch restrictions, whole-unit
handling, and single-source/split allocation remain in effect across all eligible exact storage
sources. Allocation excludes inactive, non-storable, non-pickable, and deleted locations regardless
of depth or type. Reservations remain tied to the exact item/batch/location record, with warehouse
and batch balances reconciled by the existing transactional reservation ledger. Transformation
allocation uses the same location eligibility rules.

Picking shows the configured address. The strict picking policy displayed as **Batch, warehouse,
and exact location** compares the exact location ID at any depth (the stored setting key remains
`batch_and_rack`). Existing less-restrictive policies still require batch identity and transactional
reservation transfer for allowed source substitutions. Short picks, cancellation, and dispatch
continue releasing or consuming exact source allocations. A nested picking destination resolves
to its nearest mapped rack ancestor; its full destination address remains visible. A location
without a mapped rack ancestor can still be picked using its address and QR identity. Item maps
highlight mapped ancestors containing stock and count stocked locations outside the selected floor.
Item batch labels, putaway labels, batch-location reports, and stock-aging exports include addresses.

Before an edit, the location detail read (`GET /api/warehouse-locations/[id]`, backed by
`get_warehouse_location_detail`) returns the ancestors and the counts that gate structural changes,
so the UI disables blocked actions with the reason: Move and Disable when the branch is in use,
Disable when active sublocations exist, Enable when the parent is inactive, Organize Only when stock
or pending putaway is at that exact location, and Store Only when stock there is reserved. The
database trigger remains the enforcement point. Hierarchy edits return safe actionable codes (`LOCATION_PARENT_INVALID`, `LOCATION_HIERARCHY_CYCLE`,
`LOCATION_HAS_CHILDREN`, `LOCATION_IN_USE`, or `LOCATION_EDIT_CONFLICT`) with translated guidance.
Location mutations retain Manage Locations permissions; its view permission also permits the
warehouse lookups needed for parent selection, without granting warehouse-management mutations.

Each warehouse can have multiple storage locations (aisles, shelves, bins) for granular stock tracking.
Active, storable locations may also define a positive maximum capacity. Capacity utilization uses
the total on-hand quantity at the location divided by that maximum and classifies the location as
empty, partially occupied, full, or over capacity. Locations without a maximum are reported as not
configured and excluded from aggregate utilization. This simple model assumes stored quantities
are comparable.

Warehouses support multiple numbered building floors, each with its own private floor-plan image,
name, version, and rack rectangles. Existing maps become **Floor 1** without changing their map or
rack IDs. In **Floor Map**, select an existing floor or use **Add floor**, enter a positive whole
floor number, upload its image, map its racks, and save. Opening an already configured number loads
that floor for editing. A new floor is persisted only when its image and mappings are saved. Floor
numbers are stable identifiers; names and images can be edited. Switching floors asks before
discarding unsaved changes, and controls are disabled while a save is pending. Floor selectors show
only the floor name, load five initial options, and search floor numbers or names on the server.
The floor list API supports bounded pages up to 50 records ordered by floor number. The detail and save contracts require
`floorNumber`; saves also require `expectedVersion` (0 for a new map). Each active rack can be mapped
on only one floor. Move a rack mapping by removing and saving it on the old floor before drawing it
on the new floor. Stale saves return `FLOOR_MAP_VERSION_CONFLICT`; duplicate cross-floor mappings
return `RACK_ALREADY_MAPPED_ON_ANOTHER_FLOOR`, both as safe HTTP 409 errors with translated guidance.

Users with `warehouses:view` access can open an active warehouse's **Floor Map** in read-only mode.
Uploading or replacing the private PNG/JPEG/WebP floor-plan image, changing rack mappings, and
saving require both `warehouses:edit` and the child capability
`warehouses.operation.manage_floor_map.edit`. The child capability is configured under Warehouse
Operations in the role-permission editor. `manage_locations` remains responsible for maintaining
warehouse locations and does not grant floor-map editing. Inactive warehouses cannot open or change
floor maps. Switching business units while a floor-map detail page is open returns the user to the
warehouse list without requesting the previous unit's warehouse under the new scope. An editor
drags a rectangle across the complete footprint of each active rack; the editor shows the rectangle
while drawing, labels the rack by name along its long axis, and rejects click-sized marker mappings. Overlay
coordinates are stored as normalized basis points, so the same full-rack highlights remain aligned
across desktop and mobile screen sizes. The mobile picking viewer automatically opens the floor containing the suggested rack and displays
its floor number and map name. It labels all mapped racks on that floor by rack
name along their long axis and scales each label to its rectangle. Replacement-image dimensions are
cleared until the browser successfully decodes the new file; malformed images cannot be saved with
dimensions from the prior map. Saving the map and replacing all rack mappings is one transactional
database operation; replacing the image removes the previous storage object only after the database
save succeeds.

Operational warehouse-location selectors use a bounded lookup contract: they show the first five
eligible locations, with previous/next controls to reach every matching page. Results are ordered
by full stored address and ID, and search runs on the server by code, name, or slash-separated
names-only address (for example, `Rack 01 / Bin 10`). Stored codes between address segments do not
prevent names-only searches. Changing the search or eligibility scope resets paging. Each request
reads at most one extra result to detect the next page, without counting all matches. The warehouse
location management page remains independently paginated and does not supply selector data.

The item **Locations** tab groups rack rows by warehouse. Each warehouse section shows its aggregate
on-hand quantity, warehouse-level maximum stock, and maximum-stock action, while preferred-rack
selection and batch expansion remain available on individual rack rows. Supplier shipment transit
and estimated-arrival information is intentionally not attached to a warehouse before putaway.
Users with Warehouse view access can open **Location Map** beside **Move Stock**, filter the viewer
by warehouses holding the item and by floor, and see mapped racks with positive on-hand stock
highlighted on the selected floor plan. The viewer reports missing floor maps and item racks not shown on the selected floor
(including racks on other floors) without blocking the rest of the item detail workflow.

**Move Stock** on the item's **Locations** tab moves available stock between racks in one warehouse
or between two warehouses in the current business unit. Users select the source warehouse/rack,
destination warehouse/rack, quantity, and unit. The base unit is selected initially; active item unit
options show their conversion factor. The dialog previews the total in base units (for example,
2 boxes of 144 transfers 288 base units) and sends only that converted quantity. Both entered and
converted quantities must be positive with at most two decimal places; the base total cannot exceed
1,000,000,000. Conversion does not silently round fractional base stock. The dialog shows the selected
source rack’s available base quantity and blocks a converted total above it (1 box of 144 cannot
move from a source with 58). Reserved stock is excluded. Submission is blocked if location stock
cannot be loaded; the database rechecks availability transactionally to handle concurrent changes. The
warehouse and rack selectors search the server and initially return at most five options.
**From Location** lists only locations holding positive on-hand stock of the selected item in the
source warehouse; this filter also applies to search, later pages, and selected-location lookup. The
destination warehouse need not already hold the item. Both warehouses must be active and belong
to the current business unit, and both racks must be active storage locations. Submission posts
immediately; it does not create a Stock Request, Delivery Note, or in-transit receipt workflow.
Warehouse moves preserve each source batch's received date and nullable expiration date. An existing
same-code destination batch can merge only when both dates match, including unset expiration on
both sides. A different date, or a date on only one side, returns `409 STOCK_MOVE_BATCH_CONFLICT`;
the whole move rolls back without rewriting either batch's dates. Same-warehouse rack moves keep
the existing batch identity and expiration.

The UI, API, and `move_stock_transactionally` RPC require `create` access to both
`stock_transactions` and `transfer_between_locations`. The existing Location Transfers permission
therefore covers same-business-unit warehouse moves as well as rack moves. Cross-business-unit
fulfillment continues through Stock Transfers and Delivery Notes.
Both move permissions also grant read-only warehouse/rack lookup access in an active business-unit
context, so a stock mover does not need warehouse-management view access to choose the source and
destination. Warehouse administration remains separately authorized.

The Move Stock request uses `POST /api/stock-transactions` with `transactionType: "transfer"`,
`warehouseId`, `toWarehouseId`, `fromLocationId`, `toLocationId`, `transactionDate`, and exactly one
`items` entry containing `itemId` and `quantity`. The transfer contract rejects other fields,
including client-supplied costs and business-unit identities; the database resolves the base UOM,
valuation cost, actor, and company. Its successful response keeps `id`, `transactionCode`, and
`message`. Quantities must be positive, at most 1,000,000,000, and have at most two decimal places.

One database transaction locks the affected item/warehouse balances, consumes only unreserved
source-rack batches in FIFO order, preserves each batch's code and original receipt timestamp,
updates destination batches/racks and warehouse totals, and posts the stock movement. A rack move
within one warehouse leaves warehouse and batch totals unchanged. Reserved and pending-putaway
quantities remain at their original sources. A warehouse move posts linked `out` and `in` stock
transactions, each with one line per consumed batch and its own warehouse's running balance. Both
use `reference_type = stock_move` and the source transaction ID as `reference_id`; the destination
also uses the source transaction code as `reference_code`. Warehouse movement reports and ledgers
therefore include the move on both sides. A rack move posts one `transfer` transaction with no
warehouse balance change. The response identifies the source transaction.

Stock transaction batch codes support the same 150-character limit as the inventory batch record.
The destination batch-location SKU is database generated for a new placement, or reused when the
placement already exists.

Known failures return safe `STOCK_MOVE_*` codes and translated inline recovery guidance. An
insufficient source, inactive/deleted destination stock record, or destination batch with a
conflicting receipt timestamp returns `409`; invalid warehouse/rack choices return `400`, and
authorization failures return `401`/`403`. Any failure rolls back all stock, batch, and movement
records. The dialog stays open for correction, blocks duplicate submission and closing while
pending, and refreshes affected inventory, allocation, selector, dashboard, and report queries
after success. Unknown errors stay generic and internal details are logged server-side.

Users with Items view access and the `items.operation.print_batch_qr.view` capability can expand a warehouse location on an item's **Locations** tab and print 1–100 landscape 4 × 2-inch (101.6 × 50.8 mm) QR labels for each batch. The user selects an active item unit option, and every label's quantity is that option's `qtyPerUnit`; current batch on-hand is informational and is never divided or changed by printing. Each label and QR payload uses the same item, batch-location SKU, batch, warehouse, and location contract as completed putaway labels. The shared label PDF also serves GRN boxes, putaway, and stock adjustments, with one borderless label per page. The QR starts near the top edge, with the batch, item, and larger Qty text grouped to its right; Qty sits directly below the item name, and the SKU sits beneath the QR. Warehouse and location text are omitted from the printed label; the QR payload retains its location identity for scanning.

For 4 × 2-inch die-cut stock, set the printer media width across the print head to 4 inches (101.6 mm) and the length in the feed direction to 2 inches (50.8 mm), with a 3 mm gap. In Chrome, use the matching 4 × 2-inch landscape paper size, one PDF page per label, and actual size (100% scaling). In the printer driver, select the rotation setting that prints the artwork at 0° relative to the physical label; label printer drivers can use portrait/landscape names differently from PDF viewers. A 2 × 4-inch portrait media setting treats the feed direction as 4 inches and can rotate the artwork and advance into the next label. The 3 mm gap is a media/sensor setting outside the PDF page.

If Chrome's PDF preview places the QR near the top but the physical label has a large blank band above it, check the selected Deli printer's scaling and vertical position adjustment. The PDF itself starts the QR about 1 mm from the page top; adjusting its layout cannot correct an offset applied after preview by the driver.

On a Deli S351, pressing FEED with no print job should stop at the front of the next label. In the Seagull driver, set **Stock → Media Settings → Type** explicitly to **Labels With Gaps** (or the equivalent gap/transmissive option), rather than inheriting **Use Current Printer Setting**, and enter the 3 mm gap where the driver exposes it. If a change made from Chrome's print dialog does not persist, set it in Windows under **Printer Properties → Advanced → Printing Defaults** and verify by reopening that dialog; per-job print preferences and printer defaults have different scopes. If FEED still skips, reload the roll with the printable side up and the paper passing under the guide and upper sensor, close the print head fully, and inspect the label sensor for dust or adhesive. The driver may expose **Printer Properties → Tools → Actions → Run Calibration**; use that option if present before troubleshooting the app PDF. The [Deli S351/ES351 manual](https://www.delioa.com/uploads/file/20250606/es351-user-manual.pdf) documents the feed behavior, paper path, and sensor-related paper-skipping causes.

```typescript
// Example: Warehouse structure
Warehouse: "Main Warehouse"
  Locations:
    - A-01-01 (Aisle A, Row 01, Bin 01)
    - A-01-02
    - B-01-01
    - Default (fallback location)
```

### 3. Stock Levels

Stock is tracked at multiple levels of granularity:

```
Company Level
  └─ Warehouse Level (item_warehouse table)
      └─ Batch Level (item_batches table)
          └─ Location Split Level (item_batch_locations table)
```

**Stock Metrics**:

- **On Hand**: Physical quantity assigned to a warehouse
- **Available**: On hand - reserved - warehouse-bound pending putaway
- **Reserved**: Allocated to sales orders/delivery notes
- **Putaway**: The sum of `pending_quantity` on open putaway tasks in the selected BU or warehouse
- **In Transit**: Supplier load-list quantities moving to a business unit, shown on the separate Stock In Transit page
- **Reorder Alert Basis**: Total available stock across all company warehouses compared to the effective item reorder point

Stock-aware item lists subscribe to `item_warehouse` realtime changes and invalidate when putaway tasks change. Stock movement screens also subscribe to `stock_transactions` and `stock_transaction_items` realtime changes. Stock adjustment draft saves invalidate item Locations so newly created batches appear when returning to the tab. Posting also invalidates the separate item-stock and Locations caches, so quantities refresh without a full page reload. Posted stock adjustments, GRN receiving submissions, putaway postings, and other stock movements invalidate the loaded items, item statistics, stock transaction, stock balance, dashboard, and reorder queries so on-hand, reserved, putaway, available, and movement history refresh without leaving the page. Putaway posting also invalidates item-location and batch selectors, delivery-note allocation availability, stock requests, reorder notifications, and inventory, batch-location, aging, stock-movement, product-movement, and ledger reports because final placement makes staged stock available at a specific batch and location.

Putaway tasks store their own source-unit name and quantity-per-unit conversion when they are created. Supplier GRN tasks remain scoped only to their destination business unit until posting; the operator selects the warehouse and then a storable rack at the Putaway Station, where the warehouse stock and final batch/location quantities are written atomically. Warehouse-bound production tasks retain their assigned warehouse. The Putaway Station derives source quantities and every printed label's quantity from the immutable task snapshot rather than re-reading a live item unit option or upstream GRN line. Users enter the posting quantity in the task's source unit, and the Putaway Station converts it to base units before submission. Label copies default to that source-unit posting quantity, update when it changes, remain independently editable, and are applied directly to every applicable posted batch/location label without redistribution based on source count or posted quantity.

### 4. Stock Transactions

Every stock movement is recorded as a **Stock Transaction** for full audit trail and stock ledger reporting.

Stock Ledger rows separate the quantity handled by a transaction from its effect on warehouse
inventory. The transaction quantity remains visible for receipts, issues, and internal movements.
Stock effect is derived from the recorded `qty_after - qty_before` balance delta: positive deltas are
inbound, negative deltas are outbound, and zero-delta putaway movements are internal transfers. Only
inbound and outbound effects contribute to the filtered Total In and Total Out summaries.

**Transaction Types**:

- `purchase_receipt` - Goods received from suppliers
- `sales_delivery` - Goods shipped to customers
- `stock_adjustment` - Manual adjustments (count, damage, etc.)
- `stock_transfer` - Inter-warehouse movement
- `transformation` - Manufacturing consumption/production
- `initial_stock` - Opening balances
- `pos_sale` - POS transactions

**Transaction Fields**:

- **Item**: Item reference
- **Warehouse**: Warehouse reference
- **Location**: Location reference (optional)
- **Quantity**: Amount (positive = in, negative = out)
- **Unit**: Unit of measure used
- **Transaction Type**: Type from list above
- **Reference**: Document reference (PO, SO, adjustment ID, etc.)
- **Cost**: Unit cost (for valuation)
- **Transaction Date**: When it occurred
- **Created By**: User who created it

### 5. Stock Valuation

Stock transaction costs are tracked independently from sales pricing. The stock valuation report values on-hand inventory using the configured inventory `default_pricing_tier` item price, falling back to the item sales price and then purchase price when no active default-tier price exists.

The costing model for stock receipts remains **moving average cost**:

```
New Average Cost = (
  (Current On Hand × Current Avg Cost) + (Received Qty × Purchase Cost)
) / (Current On Hand + Received Qty)
```

**Important**: As of June 2025, item cost is calculated at **runtime from purchase_receipts** rather than stored in the items table.

## Database Schema

### Core Tables

#### items

```sql
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  code VARCHAR UNIQUE NOT NULL,
  supplier_code VARCHAR(100),
  sop NUMERIC(8,2),
  name VARCHAR NOT NULL,
  description TEXT,
  category_id UUID REFERENCES item_categories(id),
  base_unit_id UUID REFERENCES units_of_measure(id),
  sales_price DECIMAL(12,2),
  reorder_point DECIMAL(12,3),
  max_stock_level DECIMAL(12,3),
  is_active BOOLEAN DEFAULT true,
  barcode VARCHAR,
  qr_code VARCHAR,
  image_url VARCHAR,
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Note: cost_price field was DROPPED in migration 20260610101000_drop_items_cost_price.sql
-- Cost is now calculated at runtime from purchase_receipts
-- supplier_code stores an optional supplier-provided item reference.
-- sop stores an optional item-level numeric value reserved for future use.
-- custom_fields stores editable key/value metadata displayed on the item detail page.
```

The item-level SOP field is nullable, non-negative, and protected by granular permissions. `items.field.sop.view` controls whether item detail/list responses can expose the value. `items.field.sop.edit` controls whether create or update requests may submit the field. SOP currently has no downstream stock, pricing, report, or allocation behavior.

#### item_unit_options

```sql
CREATE TABLE item_unit_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units_of_measure(id),
  conversion_factor DECIMAL(12,4) NOT NULL,  -- To base unit
  is_base_unit BOOLEAN DEFAULT false,
  barcode VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, unit_id)
);
```

#### units_of_measure

```sql
CREATE TABLE units_of_measure (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR UNIQUE NOT NULL,
  abbreviation VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### item_categories

```sql
CREATE TABLE item_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name VARCHAR NOT NULL,
  parent_id UUID REFERENCES item_categories(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### warehouses

```sql
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  code VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### warehouse_locations

```sql
CREATE TABLE warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  code VARCHAR NOT NULL,
  name VARCHAR,
  location_type VARCHAR NOT NULL DEFAULT 'bin',
  is_pickable BOOLEAN DEFAULT true,
  is_storable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  max_capacity NUMERIC(20, 2),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(warehouse_id, code)
);
```

#### item_warehouse

```sql
CREATE TABLE item_warehouse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  current_stock NUMERIC DEFAULT 0,
  reserved_stock NUMERIC DEFAULT 0,
  putaway_qty NUMERIC DEFAULT 0,
  available_stock NUMERIC GENERATED ALWAYS AS
    (current_stock - reserved_stock - putaway_qty) STORED,
  max_quantity NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, item_id, warehouse_id)
);
```

`item_warehouse` does not store supplier `in_transit` or estimated-arrival values. Those remain on
the business-unit-scoped load-list workflow until receiving and final warehouse placement.

#### item_batches

```sql
CREATE TABLE item_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  batch_code TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  on_hand DECIMAL(12,3) DEFAULT 0,
  reserved DECIMAL(12,3) DEFAULT 0,
  available DECIMAL(12,3) GENERATED ALWAYS AS (on_hand - reserved) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, warehouse_id, batch_code)
);
```

#### item_batch_locations

```sql
CREATE TABLE item_batch_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
  location_id UUID REFERENCES warehouse_locations(id) ON DELETE CASCADE,
  item_batch_id UUID REFERENCES item_batches(id) ON DELETE CASCADE,
  batch_location_sku VARCHAR(10) UNIQUE,
  on_hand DECIMAL(12,3) DEFAULT 0,
  reserved DECIMAL(12,3) DEFAULT 0,
  available DECIMAL(12,3) GENERATED ALWAYS AS (on_hand - reserved) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, warehouse_id, location_id, item_batch_id)
);
```

#### stock_transactions

```sql
CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  item_id UUID REFERENCES items(id),
  warehouse_id UUID REFERENCES warehouses(id),
  location_id UUID REFERENCES warehouse_locations(id),
  quantity DECIMAL(12,3) NOT NULL,  -- Positive = in, Negative = out
  unit_id UUID REFERENCES units_of_measure(id),
  transaction_type VARCHAR NOT NULL,
  reference_type VARCHAR,  -- 'purchase_receipt', 'sales_order', etc.
  reference_id UUID,
  cost DECIMAL(12,2),
  transaction_date TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### stock_adjustments

The stock adjustment list shows the location name with its full hierarchical address beneath it in the Location column. The address uses location names only, omitting codes and unnamed levels.

```sql
CREATE TABLE stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  warehouse_id UUID REFERENCES warehouses(id),
  adjustment_date TIMESTAMPTZ DEFAULT now(),
  reason VARCHAR NOT NULL,  -- 'count', 'damage', 'theft', 'other'
  notes TEXT,
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'posted'
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### stock_adjustment_items

```sql
CREATE TABLE stock_adjustment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  item_batch_location_id UUID REFERENCES item_batch_locations(id),
  current_qty DECIMAL(20,4),
  adjusted_qty DECIMAL(20,4),
  difference DECIMAL(20,4),
  uom_id UUID REFERENCES units_of_measure(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### stock_requests

```sql
CREATE TABLE stock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  business_unit_id UUID NOT NULL REFERENCES business_units(id),
  fulfilling_business_unit_id UUID NOT NULL REFERENCES business_units(id),
  request_date TIMESTAMPTZ DEFAULT now(),
  status VARCHAR DEFAULT 'draft',
  requested_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### stock_request_items

```sql
CREATE TABLE stock_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_request_id UUID REFERENCES stock_requests(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  requested_qty DECIMAL(20,4) NOT NULL,
  item_unit_option_id UUID REFERENCES item_unit_options(id),
  uom_id UUID REFERENCES units_of_measure(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### stock_requisitions

```sql
CREATE TABLE stock_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  warehouse_id UUID REFERENCES warehouses(id),
  requisition_date TIMESTAMPTZ DEFAULT now(),
  status VARCHAR DEFAULT 'draft',  -- 'draft', 'submitted', 'approved', 'in_load_list'
  notes TEXT,
  load_list_id UUID REFERENCES load_lists(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### reorder_seasons

```sql
CREATE TABLE reorder_seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

Active reorder seasons are selected automatically by the current date. Active seasons with the same priority cannot overlap for the same company.
RLS restricts season rows to the authenticated user's company.

#### reorder_season_item_policies

```sql
CREATE TABLE reorder_season_item_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  season_id UUID REFERENCES reorder_seasons(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  item_unit_option_id UUID REFERENCES item_unit_options(id) ON DELETE SET NULL,
  uom_id UUID REFERENCES units_of_measure(id) NOT NULL,
  qty_per_unit DECIMAL(20,2) NOT NULL,
  reorder_level DECIMAL(20,2) NOT NULL,
  reorder_quantity DECIMAL(20,2) NOT NULL,
  base_reorder_level DECIMAL(20,2) GENERATED ALWAYS AS (reorder_level * qty_per_unit) STORED,
  base_reorder_quantity DECIMAL(20,2) GENERATED ALWAYS AS (reorder_quantity * qty_per_unit) STORED,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season_id, item_id)
);
```

Item defaults live on `items.reorder_level` and `items.reorder_quantity`. If an active season has an active policy for the item, that policy overrides the item defaults. If the seasonal policy is inactive, the system falls back to the item defaults even while the season is active.
Seasonal policies persist the selected item unit option, `uom_id`, and `qty_per_unit` snapshot for display and editing. `reorder_level` and `reorder_quantity` store the user-entered selected-unit quantities. `base_reorder_level` and `base_reorder_quantity` are generated stored columns and are used by alerts, statistics, and requisition defaults.
Reorder reports and dashboard analytics read reorder defaults from `items`, not from `item_warehouse`. Company-wide reorder analytics aggregate stock across all company warehouses and compare the total to the item-level effective reorder point; business-unit context does not narrow these reorder calculations.
The warehouse dashboard low-stock reorder card uses a bounded SQL RPC (`get_warehouse_dashboard_low_stocks`) scoped to the selected business unit. It matches the item list's available-stock low-stock definition and returns only the top low-stock rows needed by the card.
Active reorder alerts create realtime company-level notifications across all warehouses. Acknowledged and resolved reorder alerts do not create notifications, and stale reorder notification rows are removed by the alert sync.
Seasonal policy list responses include the selected unit context and active item units for display: selected unit option, unit label, quantity per unit, generated base quantities, base unit label, and available unit options.
RLS restricts seasonal item policy rows to the authenticated user's company.

#### reorder_alert_acknowledgments

```sql
CREATE TABLE reorder_alert_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  policy_source TEXT NOT NULL,
  season_id UUID REFERENCES reorder_seasons(id) ON DELETE SET NULL,
  reorder_point DECIMAL(20,2) NOT NULL,
  reorder_quantity DECIMAL(20,2) NOT NULL,
  minimum_level DECIMAL(20,2) NOT NULL,
  severity TEXT NOT NULL,
  acknowledged_available_stock DECIMAL(20,2) NOT NULL,
  acknowledged_at TIMESTAMPTZ DEFAULT now(),
  acknowledged_by UUID REFERENCES users(id)
);
```

Reorder alerts are generated from live stock levels, not stored as alert rows. Acknowledgments persist the item, active policy/season, threshold snapshot, severity, and available stock at the time the user acknowledged the alert. Acknowledge and restore RPCs require the caller's authenticated user and company to match the requested write scope.

## API Reference

### Item Management

#### GET /api/items

List items with server-side filtering and bounded pagination. The page renders its shell immediately,
loads rows and statistics independently, and retains existing rows with a translated refresh indicator
while fetching the next result within the same business unit. Switching business units clears the
previous unit's rows and shows the table loading state until the selected unit's query resolves.

**Query parameters**:

- `page`: default 1; `limit`: default 10, maximum 100 for ordinary API requests.
- `search`: item/supplier code, name, Chinese name, or barcode for stock-aware lists.
- `category`: category UUID for stock-aware lists; `warehouseId`: optional warehouse UUID.
- `status`: `normal`, `low_stock`, `out_of_stock`, `overstock`, or `discontinued`.
- `itemType`: optional item type. `isActive` applies to the non-stock item list.
- `view=inventory`: lightweight stock-aware table response. Omits pricing, custom fields,
  unit options, and barcode enrichment; cannot be combined with exports, statistics,
  or `includeStock=false`.
- Without `view`, existing full item-list consumers retain their pricing and barcode enrichment.
- `includeStock=false`: non-stock item list.
- `includeStats=true&statsOnly=true`: separate inventory statistics. The returned
  `capabilities.canViewTotalAvailableValue` controls the value card, and the server returns
  `totalAvailableValue: null` when access is denied. This request does not load pricing settings.
- `exportMode=csv|xlsx|pdf`: full enriched export data, capped at 5,000 items. Larger exports
  require narrower filters and return 413.

Rows remain scoped to the authenticated company and selected business unit/warehouse. The
lightweight view uses the same stock RPC, filter semantics, and stock quantities as the full view.
Its cache remains under the `items` query family so existing item/stock mutations and realtime
invalidation refresh it.

**Inventory view response**:

```json
{
  "data": [
    {
      "id": "uuid",
      "code": "ITEM-001",
      "supplierCode": null,
      "name": "Widget ABC",
      "category": "Widgets",
      "onHand": 12,
      "allocated": 2,
      "available": 10,
      "putawayQty": 0,
      "reorderPoint": 5,
      "status": "normal"
    }
  ],
  "pagination": { "page": 1, "limit": 10, "total": 150, "totalPages": 15 }
}
```

#### GET /api/item-categories

Category selectors in inventory, item create/edit, and the inventory/aging/product-movement report
previews use server search. Requests accept `search` (up to 100 characters), `page` (default 1),
and `limit` (default 5, maximum 50). Invalid bounds return 400. Results use company scope,
exclude deleted categories, and order by name then ID. The response contains `data: [{ id, name }]`
and `pagination: { page, limit, total, totalPages }`.

The first five results are shown initially; users search for other categories. Selected labels
remain visible when the selection is outside the current search results. Item forms retain category
names in their existing mutation contracts; ID-based filters still submit IDs. Lookup authorization
preserves direct category-view access and dependent-feature access, reusing one verified request
context for all permission and company-scope checks.

#### POST /api/items

Create a new item.

**Permissions**: `create` on `items`

**Request**:

```json
{
  "code": "ITEM-002",
  "name": "New Widget",
  "description": "Description here",
  "category_id": "uuid",
  "base_unit_id": "uuid",
  "sales_price": 15.0,
  "reorder_point": 50,
  "max_stock_level": 300,
  "unit_options": [
    { "unit_id": "uuid-piece", "conversion_factor": 1, "is_base_unit": true },
    { "unit_id": "uuid-box", "conversion_factor": 12 }
  ]
}
```

#### GET /api/items/[id]

Get item details.

**Permissions**: `view` on `items`

**Response**:

```json
{
  "id": "uuid",
  "code": "ITEM-001",
  "name": "Widget ABC",
  "customFields": {
    "color": "Black",
    "frame_size": "8x10"
  },
  "stock_levels": [
    {
      "warehouse": { "id": "uuid", "name": "Main Warehouse" },
      "on_hand": 150,
      "reserved": 25,
      "available": 125,
      "locations": [
        { "location": "A-01-01", "on_hand": 75 },
        { "location": "A-01-02", "on_hand": 75 }
      ]
    }
  ],
  "recent_transactions": [...]
}
```

The item detail page displays `customFields` as editable key/value rows for users with `edit` permission on `items`.

#### PUT /api/items/[id]/custom-fields

Add or update one custom field for an item. This endpoint owns item custom-field mutations rather than the general item update endpoint.
Custom-field writes are handled by DB RPCs that lock the item row before changing `custom_fields`, so concurrent edits do not replace unrelated fields.

**Permissions**: `edit` on `items`

**Request**:

```json
{
  "key": "color",
  "value": "Black",
  "originalKey": "old_color"
}
```

`originalKey` is optional and is used when renaming an existing field.

#### DELETE /api/items/[id]/custom-fields

Delete one custom field from an item.

**Permissions**: `edit` on `items`

**Query Parameters**:

- `key` - Custom field key to delete

#### PUT /api/items/[id]

Update item details.

**Permissions**: `edit` on `items`

#### DELETE /api/items/[id]

Delete (deactivate) item.

**Permissions**: `delete` on `items`

### Warehouse Management

A business unit may own multiple active warehouses. The selected business unit remains the
application, permission, and data-access context; a warehouse is an inventory location within that
context, not a replacement context. Inventory list and report screens aggregate all warehouses in
the current business unit by default unless a warehouse filter is selected. Warehouse-specific
operations such as stock ledger review, POS checkout, stock adjustments, and transformation item
selection require an explicit warehouse.

#### GET /api/warehouses

List warehouses owned by the active business unit. Search, status filtering, sorting, and bounded
pagination are applied on the server.

**Permissions**: `view` on `warehouses`

**Response**:

```json
{
  "warehouses": [
    {
      "id": "uuid",
      "code": "WH-001",
      "name": "Main Warehouse",
      "address": "123 Main St",
      "is_active": true,
      "locations": [{ "id": "uuid", "code": "A-01-01", "name": "Aisle A, Row 1, Bin 1" }]
    }
  ]
}
```

#### POST /api/warehouses

Create new warehouse.

**Permissions**: `create` on `warehouses`

#### GET /api/warehouses/[id]/inventory

Get all inventory in a warehouse.

**Permissions**: `view` on `warehouses`

**Response**:

```json
{
  "inventory": [
    {
      "item": { "id": "uuid", "code": "ITEM-001", "name": "Widget ABC" },
      "on_hand": 150,
      "reserved": 25,
      "available": 125,
      "average_cost": 8.5,
      "value": 1275.0
    }
  ],
  "total_value": 125000.0
}
```

### Stock Adjustments

The adjustment details dialog uses the same frame and layout as the create/edit dialog, read-only: the status sits beside the title as colored text, the general-information panel shows warehouse, location, type, date, reason, notes, and stock transaction, and the footer repeats the form's lines, increases, decreases, and total adjustment value summary. Missing notes, locations, and not-yet-posted stock transactions show as "No notes", "No location", and "Created when posted" instead of a dash. Draft adjustments offer **Edit Adjustment**, which closes the view and opens the edit dialog; other statuses only offer **Close**. On phone widths each line renders as a card instead of a table row. The location shows the full location name path without location codes, using the same `locationPath` supplied for the list.

Phase 1 keeps batches warehouse-scoped. With a destination location selected, **Existing Batch**
searches batch codes across all items in that warehouse, including codes not yet associated with
the selected item or destination location. Each code appears once. Exact batch-location QR searches are restricted to the same warehouse. The displayed
quantity belongs to the destination (zero if absent), and the original batch received date is retained.

The client sends `itemBatchId` as the selected code/date source. The stock-adjustment save function
validates company and warehouse, creates or reuses a separate batch record for the requested item,
and creates its missing batch-location in the same transaction as the draft. It copies the exact
original received timestamp, ignoring any client-supplied replacement date. Existing records with
the same warehouse batch code but conflicting timestamps reject the save without changing dates.
Stock and reservations remain separate per item; another item's quantities and QR identity are never
returned as the selected item's stock.
A missing destination requires a positive increase from zero. Repeated saves reuse the location
record. Posting increases only that location and its batch/warehouse balances; it does not transfer
stock from another location. New batches and existing-location decreases retain their current rules.

`GET /api/inventory/batches` uses server-side warehouse/item/search filters and a bounded limit
(default 5, maximum 50). Draft saves refresh destination selectors and item Locations; posting also
refreshes stock and warehouse views. This phase replaces the save function and adds a bounded lookup function: no table changes,
existing-data backfill, or cross-warehouse batch merging. See
`docs/plans/cross-warehouse-batches-phase-2-handover.md` for the deferred work.

Draft save failures preserve safe, actionable guidance for invalid items, units, batches, locations,
warehouse selection, lost access, and drafts that are no longer editable. Create and update use
shared stable error codes and translated recovery messages. The form stays open after failure;
unknown backend errors remain generic.

#### POST /api/stock-adjustments

Create a stock adjustment draft for an explicitly selected active warehouse in the current business
unit. The warehouse must be selected before lines are added and cannot be changed on an existing
draft. The transactional RPC validates that the warehouse belongs to the current business unit
before writing the draft.

The Add Item and Edit Item dialogs accept quantities in active item unit options, using their
configured display labels (for example, BOX (144)). New lines initially select the base unit.
Saved lines retain the entered quantity and selected unit when reopened; difference columns show
that entry, with a secondary base-unit equivalent only when an alternate unit was selected. Entering 2 boxes of 144 adjusts 288 base units.
Current quantity, new stock level, posting, and value impact continue to use base units; unit cost
remains per base unit. Create/update lines send `enteredQty` (the unsigned adjustment delta) and
`enteredUnitOptionId` (null for base). The transactional save validates the conversion and stores
`entered_qty`, `entered_unit_option_id`, `entered_unit_label`, and `entered_qty_per_unit` snapshots.
Existing rows are backfilled from their recorded base-unit delta; the original selection is unknown.
If an option is changed or deactivated, historical display remains intact, while resaving an
incompatible entry returns `STOCK_ADJUSTMENT_ENTERED_UNIT_INVALID` with translated guidance.
Decreases cannot exceed the selected batch’s current on-hand quantity. Converted adjustments
must have at most two decimal places and cannot exceed 1,000,000,000.

**Permissions**: `create` on `stock_adjustments`

**Request**:

```json
{
  "adjustmentType": "physical_count",
  "adjustmentDate": "2025-06-14",
  "warehouseId": "uuid",
  "locationId": "uuid",
  "reason": "count",
  "notes": "Monthly physical count",
  "items": [
    {
      "itemId": "uuid",
      "itemBatchLocationId": "uuid",
      "currentQty": 100,
      "adjustedQty": 95,
      "uomId": "uuid",
      "unitCost": 12.5
    }
  ]
}
```

The create/edit adjustment dialog keeps warehouse, location, adjustment type, date, reason, and notes in one compact block above the line table. The warehouse is locked once any line exists; the location determines displayed batch quantities and where stock is adjusted. Each line has an **Edit** action plus a menu with **Print Labels** and **Remove Line**. A footer bar always shows the line count, increase and decrease counts, and the total value impact, and **Create Adjustment** stays disabled until at least one line exists.

Each adjustment line explicitly chooses **Existing Batch** or **New Batch**. The existing-batch selector is server-filtered by warehouse and batch-code search text, with item-specific QR matching and quantities from the selected item/destination location. The selected batch-location row supplies the current quantity and QR label metadata, and the selector shows that batch's location, received date, and on-hand quantity.

The line dialog keeps a **Stock Preview** panel beside the form once a batch is chosen: new stock level, before/after bars, current/change/new totals, and value impact, all recalculated as the user edits. The direction is chosen with **Increase Stock** / **Decrease Stock** buttons, and the unit selector sits on the quantity field. A decrease larger than the on-hand quantity is flagged in the preview and blocks saving the line.

The item detail **Locations** tab shows **Expiration Date** beside Received Date in each location’s paginated batch table. Unset dates display a dash; date-only values are displayed without timezone shifts. Expiration dates before the viewer’s current local date appear in red; today and future dates retain the normal text color. The existing location-stock API includes nullable `expirationDate` for each batch, with unchanged permissions and pagination.

New Batch in stock adjustments also accepts an optional, manually entered **Expiration Date**. Create and draft-update requests send `batchExpirationDate` as `YYYY-MM-DD` or `null` only for a new batch. The same transactional save stores it in nullable `item_batches.expiration_date`; blank or omitted values remain unset. For items in the Glass category with JIS in the description, New Batch defaults expiration to three calendar months after receipt (clamped to month end). Acrylic and IMPORTED/LOCAL items are excluded. Received-date changes update the default until the user edits or clears expiration; that override survives reopening an unsaved line. This is a form default, not a server rule or historical backfill. Past dates are allowed for historical stock. Existing-batch adjustments preserve the saved expiration and do not accept this creation field. Invalid input returns HTTP 400 with `STOCK_ADJUSTMENT_EXPIRATION_DATE_INVALID` and translated recovery guidance. The SQL regression script `supabase/tests/stock-adjustment-expiration-date.sql` verifies persistence, blank values, draft additions, preservation, and rollback after a later invalid line.

Creating a new batch requires an adjustment location, a batch code, a valid Received Date, and a positive stock increase. Received Date defaults to today and accepts past dates for initial inventory. New-batch API lines send `batchReceivedDate` as `YYYY-MM-DD` (also when adding a new batch to an existing draft); existing-batch lines omit it. The date is stored at midnight in `item_batches.received_at`, which drives batch age and oldest-first allocation, independently of the adjustment date and record creation time. New Batch rejects a code already present anywhere in the selected warehouse, regardless of item, location, or received date. Reuse must go through Existing Batch, which retains the original received date. Invalid dates return HTTP 400 with `STOCK_ADJUSTMENT_RECEIVED_DATE_INVALID`; conflicting dates return HTTP 409 with `STOCK_ADJUSTMENT_RECEIVED_DATE_CONFLICT`. New batches start at zero, so stock removal is unavailable in this mode. The form checks exact batch-code existence across the selected warehouse using a bounded lookup. The database repeats the check under the same warehouse/code transaction lock used by Existing Batch; duplicate creation returns HTTP 409 with `STOCK_ADJUSTMENT_BATCH_ALREADY_EXISTS` and translated guidance to use Existing Batch. Saving the draft creates a new `item_batches` row in New Batch mode, or reuses the selected code in Existing Batch mode, and creates its missing `item_batch_locations` row for the selected warehouse/location inside the same database transaction as the adjustment header and lines. If any part of the save fails, no manual batch, batch-location, header, or line write remains committed.

#### POST /api/stock-adjustments/[id]/post

Post stock adjustment (apply to inventory).

**Permissions**: `edit` on `stock_adjustments`

**Process**:

1. Validates all lines
2. Calls the transactional `post_stock_adjustment` RPC
3. Creates stock transactions for adjustments
4. Updates item_warehouse, item_batches, and item_batch_locations balances for the selected batch-location rows
5. Marks adjustment as posted
6. Records posting user and timestamp

Stock adjustment lines can reprint 1–100 batch QR labels using the same QR payload and PDF label generator as GRN box labels. The user selects an active item unit option, and each printed copy uses that option's `qtyPerUnit` together with the selected batch code, batch-location SKU, item details, warehouse, and location metadata. The adjusted quantity is informational and is not divided across the labels.

### Stock Requests

#### POST /api/stock-requests

Create a stock request from the current business unit to a fulfilling business unit.

**Permissions**: `create` on `stock_requests`

**Request**:

```json
{
  "fulfilling_business_unit_id": "uuid",
  "items": [
    {
      "item_id": "uuid",
      "requested_qty": 100,
      "item_unit_option_id": "uuid",
      "selected_item_batch_id": "uuid-or-null",
      "uom_id": "uuid"
    }
  ]
}
```

The current business unit is the requesting side. The user selects only the fulfilling business
unit and never selects a source warehouse. Each line defaults to automatic FIFO allocation, but the
user may optionally require a specific eligible batch. The searchable batch picker queries the
server using the item and fulfilling business unit and returns at most five results at a time,
independent of the selected request unit. Each option identifies its warehouse and shows the
batch's available base-unit quantity; batch, warehouse, and rack text are searchable. After a batch
is selected, the form compares its base-unit availability with the requested quantity converted
through the selected unit and blocks an insufficient selection. The two business units must differ,
and both identities are fixed after creation. Draft create and update operations call one
database-owned transaction that validates the header, units, items, quantities, and optional batch
constraint before saving the header and all lines. A failure leaves no partial header or line
changes.

Delivery-note availability and creation aggregate stock across all active warehouses in the
fulfilling business unit. The database allocates whole requested units by FIFO batch/location source,
splits the request into one delivery note per source warehouse, reserves each source atomically, and
creates warehouse-specific pick lists. Capacity is calculated independently for each source as
`floor(available base quantity / qty_per_unit)`, so an incomplete remainder is never combined with
another source to form one requested unit. Insufficient total capacity rolls the operation back
without delivery notes or partial reservations.

The delivery-note detail API reads receiving scans and unexpected-item exceptions through the
authenticated Data API. Those tables grant read access only; row-level security limits their rows
to the note's requesting (receiving) business unit when the user belongs to that unit and company.
The fulfilling unit can still open the note, but receives no scan or exception rows. Recording and
reviewing receiving results remains owned by the transactional database functions.

When a request line specifies a batch, availability, delivery-note creation, and pick-list source
suggestions are restricted to that batch and its warehouse/racks. If that batch can no longer supply
the complete requested quantity, the transaction fails with actionable guidance; it never falls
back to another batch. Lines without a selected batch retain business-unit-wide FIFO allocation.

Inventory settings define one picking-validation policy per business unit. Every mode requires the
scanned `batch_location_sku` to resolve to the allocated item and the same batch identity
(`item_id + batch_code + received_at`) inside the fulfilling business unit. `batch_only` permits a
different rack or warehouse in that business unit, `batch_and_warehouse` additionally requires the
allocated warehouse, and `batch_and_rack` requires both the allocated warehouse and rack. An exact
suggested SKU proceeds normally. A different SKU that satisfies every mandatory rule is presented
as an alternative-source warning and requires explicit confirmation; a wrong item, batch, business
unit, policy location, inactive/non-pickable rack, or unavailable source is never overrideable.

The web Pick List detail dialog loads its scoped detail record separately from the bounded list and
shows the pick location on every line: warehouse code, rack code, batch code, and location SKU.
Picking quantities and workflow transitions are read-only on the web because picking is performed
in the mobile app; only the reason and action for cancelling an open pick list remain available.

Creating a pick list reserves every line's exact base-unit quantity at its suggested batch and rack,
in addition to the delivery note's aggregate warehouse reservation. Picker claims only assign work
and do not reserve inventory again. When a permitted alternative source is confirmed, the database
atomically moves the batch/rack reservation to the scanned location and, for another warehouse,
moves the corresponding aggregate reservation as well. Pick-list cancellation releases its exact
source reservations and restores any moved aggregate reservation to the planned warehouse. Delivery
Note voiding releases both levels, while dispatch consumes on-hand and reserved quantity from the
recorded warehouse, batch, rack, and batch-location SKU.

Reservation ownership is source-neutral. Delivery Note lines, confirmed Sales Order lines,
Transformation Order inputs, and approved Production Material Request lines own warehouse-level
commitments in `inventory_reservations`. Creating a Frame Job Order or a draft Production Material
Request does not reserve stock. Approving the request creates the commitment; issuing it consumes the
commitment and deducts on-hand stock. Frame production may proceed with residual materials without
a request or full issue; completion releases unused request reservations without recording extra
consumption. Pick-list lines and preparing
Transformation Order inputs additionally own
their exact FIFO batch/rack sources in `inventory_reservation_allocations`. An active allocation
total cannot exceed its parent commitment. `item_warehouse.reserved_stock`,
`item_batches.qty_reserved`, and `item_batch_locations.qty_reserved` remain cached balance
projections for bounded availability queries, not ownership records. The owning workflow updates
the ledger and its projections atomically so a failed operation leaves neither side partially
changed.

Users with Inventory Reservations view permission can inspect this ownership under **Inventory →
Reservations**. The page is read-only and scoped to the selected business unit. It uses bounded,
server-side search across source references and item codes or names, together with dedicated source
type, status, and warehouse filters, sorting, and pagination. The warehouse selector remains separate
so warehouse criteria do not overlap with free-text search. Each row identifies
its source, such as a Delivery Note, Sales Order, Transformation Order, or Frame Job Order, and shows
its committed, allocated, consumed, and released base-unit quantities. The effective active balance
remains part of the reservation contract and status calculation but is not displayed as a separate
column because it is derived from the other lifecycle quantities. Expanding a row loads a bounded
list of up to 50 owning Pick List or Transformation Order allocations without a nested pager, with
their batch, rack, location SKU, quantities, status, and update time. Roles that already had Stock
Transactions view access receive this new view-only permission when the page is introduced; it can
subsequently be managed independently in role permissions.

When a pick list is completed short, the unpicked quantity is released from its suggested batch and
rack immediately. The Delivery Note's warehouse-level commitment remains available for an
incremental pick list, while cancellation or voiding releases only the source quantity that is still
reserved and does not decrement the completed short quantity a second time.

Because this is an active-development cutover, the reservation ledger starts with newly created
owning workflows. Reset environments do not migrate or synthesize ownership for older records.
Operational recovery should cancel, void, or delete the owner through its normal transactional
action; reservation balance columns must not be edited directly to repair ownership.

Reservation lifecycle mutations invalidate both the reservation list and expanded allocation query
family so audit data refetches after commitments are created, transferred, consumed, or released.
The audit query retains Sales Order and Transformation Order codes after those owners are
soft-deleted, preserving historical search and source identification without restoring the owner to
its operational list.

`POST /api/delivery-notes/allocation-availability` accepts a bounded list of up to 100 stock-request item IDs and returns availability in each line's requested unit. `POST /api/delivery-notes` revalidates the same whole-unit capacity while locking the stock-request and inventory rows, then creates the header, sources, lines, and warehouse reservation in one transaction.

The delivery-note creation table displays business-unit-wide availability in the stock-request
line's unit, for example `100 BOX (144)`. `Qty / Unit` shows the conversion factor, while `Total Qty`
shows the current allocated quantity converted to base units. `Allocatable` is the smaller of the
line's remaining unallocated request quantity and its current usable inventory. Fully allocated
requests and fully allocated lines are omitted so existing delivery-note allocations cannot be
mistaken for an inventory shortage. Availability requests are sent in bounded groups of up to 100
stock-request lines; every group must load successfully before allocation controls and delivery-note
creation are enabled.

#### POST /api/stock-requests/[id]/approve

Approve a submitted stock request from the fulfilling business unit.

**Permissions**: `edit` on `stock_requests`

#### POST /api/stock-requests/[id]/reject

Reject a submitted stock request from the fulfilling business unit.

**Permissions**: `edit` on `stock_requests`

### Reorder Management

#### GET /api/reorder/alerts

Get items whose total available stock across all company warehouses is below the effective reorder point.

**Permissions**: `view` on `reorder_management`

By default, acknowledged alert conditions are hidden. Passing `acknowledged=true` includes both active and acknowledged conditions. Passing `acknowledged=only` returns acknowledged conditions only.
The `warehouseBreakdown` includes all company warehouses; warehouses without item stock rows are returned with zero stock values.

**Response**:

```json
{
  "data": [
    {
      "itemId": "uuid",
      "itemCode": "ITEM-001",
      "itemName": "Widget ABC",
      "totalAvailableStock": 45,
      "reorderPoint": 100,
      "reorderQuantity": 55,
      "policySource": "season_override",
      "seasonName": "Peak Season",
      "requisitionUomId": "uuid",
      "requisitionUomLabel": "PCS",
      "requisitionItemUnitOptionId": "uuid",
      "requisitionQtyPerUnit": 1,
      "requisitionUnitPrice": 10.5,
      "requisitionUnitPriceCurrency": null,
      "warehouseBreakdown": [{ "warehouseName": "Main Warehouse", "availableStock": 45 }]
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 1, "totalPages": 1 }
}
```

#### POST /api/reorder/seasons

Create a date-effective reorder season.

**Permissions**: `create` on `reorder_management`

#### POST /api/reorder/alerts/acknowledge

Persist acknowledgment for selected generated reorder alert IDs.

**Permissions**: `edit` on `reorder_management`

Acknowledgment suppresses the same item/policy/season/severity/stock snapshot from the active alerts list. If the stock level changes, the severity changes, or the effective reorder policy changes, the alert is generated again. Direct RPC calls are bound to the authenticated user and company.

#### POST /api/reorder/alerts/unacknowledge

Restore selected acknowledged reorder alert IDs to the active alerts list.

**Permissions**: `edit` on `reorder_management`

Restoring an alert soft-deletes the matching acknowledgment row for the current generated alert condition, so the alert returns to the active alerts list.

#### POST /api/reorder/season-policies

Create a per-item seasonal reorder override.

**Permissions**: `create` on `reorder_management`

Seasonal policy requests must include `itemUnitOptionId`. Requests store `reorderLevel` and `reorderQuantity` as selected-unit quantities. The API resolves and snapshots `uomId` and `qtyPerUnit`; PostgreSQL generated columns compute `baseReorderLevel` and `baseReorderQuantity`. Responses include `itemUnitOptionId`, `uomId`, `unitOptions`, `reorderUnitLevel`, `reorderUnitQuantity`, `baseReorderLevel`, `baseReorderQuantity`, `unitLabel`, `qtyPerUnit`, `totalQuantity`, and `baseUnitLabel` so the dialog can edit the selected unit while alerts and statistics compare base quantities.

## Services

### Stock Transaction Service

```typescript
// Location: src/services/inventory/stockTransactionService.ts

class StockTransactionService {
  // Record stock transaction
  async createTransaction(data: {
    itemId: string;
    warehouseId: string;
    locationId?: string;
    quantity: number; // Positive = in, Negative = out
    unitId: string;
    transactionType: string;
    referenceType?: string;
    referenceId?: string;
    cost?: number;
    transactionDate?: Date;
    notes?: string;
  }): Promise<StockTransaction>;

  // Get stock ledger for item
  async getItemLedger(
    itemId: string,
    warehouseId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<StockTransaction[]>;

  // Get stock value
  async getStockValuation(warehouseId?: string): Promise<{
    items: Array<{ item: Item; quantity: number; value: number }>;
    total: number;
  }>;
}
```

### Location Service

```typescript
// Location: src/services/inventory/locationService.ts

class LocationService {
  // Adjust stock at location
  async adjustLocationStock(
    itemId: string,
    locationId: string,
    quantity: number,
    reason: string
  ): Promise<void>;

  // Get default location for warehouse
  async getDefaultLocation(warehouseId: string): Promise<WarehouseLocation>;

  // Move stock between locations
  async moveStock(
    itemId: string,
    fromLocationId: string,
    toLocationId: string,
    quantity: number
  ): Promise<void>;
}
```

## Common Workflows

### Workflow 1: Create New Item

1. User navigates to Items page
2. Clicks "Create Item"
3. Fills form with item details
4. Adds unit options (base + conversions)
5. Sets reorder point and max level
6. Submits form
7. API creates item record
8. API creates unit option records
9. User redirected to item detail page

### Workflow 2: Stock Adjustment (Physical Count)

1. User navigates to Stock Adjustments
2. Selects an active warehouse in the current business unit before adding lines
3. Adds lines by selecting an item and the exact batch-location row being counted, or enters a new batch code when no initial batch-location exists
4. Enters the adjustment quantity
5. System calculates the new batch quantity and variance
6. User can choose an active item unit option and a whole-number copy count from 1–100, then reprint QR labels for the selected batch-location row
7. User reviews variances
8. Posts adjustment
9. System creates stock transactions
10. Updates item_warehouse, item_batches, and item_batch_locations balances
11. Adjustment marked as posted

### Workflow 3: Business-Unit Stock Fulfillment

1. A user creates a stock request from the current business unit and selects a different fulfilling
   business unit.
2. The user adds items and quantities, optionally constrains a line to one eligible batch, then
   submits the request for approval.
3. A user on the fulfilling side approves the request.
4. The system checks inventory across all active warehouses in the fulfilling business unit.
5. The system allocates unconstrained lines by FIFO and routes batch-constrained lines only through
   the selected batch's warehouse and racks, creating one delivery note and pick list per source
   warehouse.
6. Each source warehouse picks and dispatches its delivery note.
7. The delivery-note detail identifies the source and destination business units. At receiving
   start, the receiver selects an active destination warehouse in the destination business unit.
8. Receiving posts inventory to the selected destination warehouse.
9. The stock-request status is reconciled atomically from its linked delivery notes.

### Workflow 4: Reorder Alert Response

1. System selects the active reorder season by effective date and priority
2. System resolves each item's effective reorder level from active seasonal policy or item defaults
3. System compares total available stock across all company warehouses to the effective reorder level
4. Purchasing manager reviews alerts
5. Creates a stock requisition with selected alert items prefilled. Seasonal-policy alerts use the policy unit and selected-unit reorder quantity; item-default alerts use the default item unit.
6. User selects the supplier and submits the stock requisition through the purchasing workflow
7. User may acknowledge an alert to hide the current generated alert condition without changing stock
8. User may review acknowledged alerts and restore them to active alerts
9. Requisition fulfillment is tracked through linked purchasing/load-list workflows
10. Stock levels updated
11. Reorder alert clears when stock reaches the effective reorder level, or reappears when the acknowledged condition changes

## UI Components

### Key Components

#### ItemList

**Location**: `src/components/inventory/ItemList.tsx`

- Displays paginated item table
- Search and filter by category
- Actions: Create, Edit, View, Delete

#### ItemForm

**Location**: `src/components/inventory/ItemForm.tsx`

- Create/edit item form
- Unit options management
- Image upload
- Validation via Zod schema

#### WarehouseInventory

**Location**: `src/components/inventory/WarehouseInventory.tsx`

- Shows all items in warehouse
- Displays on hand, reserved, available
- Location-level drill-down
- Stock valuation summary

#### StockAdjustmentForm

**Location**: `src/components/stock-adjustments/StockAdjustmentFormDialog.tsx`

- Create stock adjustment
- Add adjustment lines using an existing batch-location or a new batch code at the selected location
- View adjustment header and line-item details from the stock adjustments list in `StockAdjustmentDetailsDialog.tsx`, which mirrors the form's layout read-only
- Reprint 1–100 selected batch QR labels from editable lines or the read-only details view
- Show variance calculations
- Post adjustment workflow

#### Stock transfer pages

**Location**: `src/components/stock-requests/StockRequestEditor.tsx` (create at `/inventory/stock-requests/new`, edit at `/inventory/stock-requests/[id]/edit`) and `src/components/stock-requests/StockRequestDetails.tsx` (view at `/inventory/stock-requests/[id]`)

- Stock transfers (stock requests) are created, edited, and viewed on full pages that share the load list and stock requisition layout: a Transfer section (requesting warehouse, Requested To, request and required dates, priority), the Items section, Purpose and Notes, and a sticky Summary panel
- The New Item row (item, unit, qty, total qty, batch) sits above the Items table; Enter adds the line and Esc clears it. Batch defaults to Auto (FIFO); a specific batch can be pinned once Requested To is chosen, and the row rejects a batch whose availability is below the requested base quantity
- Requested To is fixed after creation and stays locked while any line pins a batch, because pinned batches belong to that warehouse
- Only drafts from the requesting business unit can be edited, and only with stock request edit permission; other transfers show a message linking back to the view page
- The view page shows each line's batch, delivered quantity once fulfillment starts, and linked delivery notes. The requesting side can Submit, Edit, Cancel, or Delete a draft; the fulfilling side can Approve or Reject a submitted transfer. Reject and Cancel require a reason
- Save errors for unavailable or insufficient batches show their own messages instead of the generic save failure

#### Delivery-note list and detail

**Location**: `src/app/(dashboard)/inventory/delivery-notes/page.tsx` and `src/app/(dashboard)/inventory/delivery-notes/[id]/page.tsx`

The **Business Unit** column shows only the transfer's other party relative to the currently
selected BU: **Fulfilled By** for requesting BUs and **Requested By** for fulfilling BUs. Each row
shows that party's name and code; incoming and outgoing notes can share the same list. The detail
summary likewise shows only Fulfilling Business Unit for a requesting BU or Requesting Business Unit
for a fulfilling BU, alongside Status and Linked Pick List. The selected BU's own label is omitted,
even when the user has membership in both BUs.

`GET /api/delivery-notes` includes both summaries (`id`, `code`, `name`) in each paginated record,
using the same relationships as the detail endpoint. Labels therefore remain available when the
user belongs to only one side of a transfer or the business-unit switcher list has not loaded.
Document access stays scoped to the company and selected business unit; receiving details remain
restricted to the requesting side.

#### ReorderAlerts

**Location**: `src/components/inventory/ReorderAlerts.tsx`

- Display items below effective reorder point using company-wide available stock
- Display active and acknowledged reorder alerts separately
- Create stock requisition from selected alerts
- Acknowledge and restore generated alert conditions
- Configure reorder seasons and seasonal item overrides

## Reports

### Stock Valuation Report

**Location**: `/api/reports/stock-valuation`

Shows total inventory value by warehouse using the configured default pricing tier for item valuation, with sales price and purchase price fallback.

Requests that would aggregate more than 5,000 source rows are rejected so the report does not perform unbounded database and application work. Narrow the warehouse, item, or category filters before regenerating the report.

### Stock Aging Report

**Location**: `/api/reports/stock-aging`

Shows how long inventory has been in stock, categorized by age buckets (0-30, 31-60, 61-90, 90+ days).

The report includes positive location-batch stock in the current business unit and defaults to stock strictly older than 90 days; choose All Ages to include younger stock. Choose Group By → Item (default) or Batch in report settings. Batch mode groups the same batch code across matching items/warehouses and displays item details with batch subtotals. PDF preview/download includes all matching rows, not just the first 50. Source rows are retrieved in ordered batches to avoid Supabase response truncation. Requests above 5,000 source rows are rejected with a visible error rather than a partial report. Narrow category or business-unit scope to reduce this count; search and age filters apply after the source limit. See the Stock Aging section in [Reporting & Analytics](07-REPORTING-ANALYTICS.md) for API details.

### Stock Movement Report

**Location**: `/api/reports/stock-movement`

Shows all stock transactions for a date range, grouped by item/warehouse.

The report rejects current or comparison periods above 5,000 source transaction rows. Narrow the date range, warehouse, or item filters before regenerating the report.

### Inventory Report

**Location**: `/api/reports/inventory`

Current stock levels across all active warehouses in the current business unit by default, with an
optional warehouse filter and location details.

Normal list calls are capped at 50 rows per page. PDF preview uses `exportMode=pdf` and can include up to 500 matching rows in one preview request.

## Troubleshooting

### Issue: Stock Discrepancies

**Symptoms**: Stock levels don't match physical count
**Solution**:

1. Run inventory report for warehouse
2. Compare with physical count
3. Create stock adjustment with reason "count"
4. Post adjustment to reconcile

### Issue: Negative Stock

**Symptoms**: Available stock shows negative
**Solution**:

1. Check for excessive reservations
2. Review recent transactions
3. Verify sales orders aren't over-allocated
4. Adjust stock if needed

### Issue: Unit Conversion Errors

**Symptoms**: Quantities don't calculate correctly
**Solution**:

1. Verify conversion factors in item_unit_options
2. Ensure base unit is correctly marked
3. Check that transactions use correct unit_id

## Related Documentation

- **Inventory Module Plan**: `docs/inventory-module-plan.md`
- **Item-Specific UOM Plan**: `docs/item-specific-uom-plan.md`
- **Location Plan**: `docs/plans/inv-location-plan.md`
- **Batch Implementation**: `docs/plans/inv-item-batch-implementation-plan.md`
- **Scalable API Design**: `docs/rules/scalable-api-design-rule.md`

## Migration History

Key inventory-related migrations:

- `20260610100000_use_purchase_price_for_item_cost_runtime.sql` - Purchase price calculation
- `20260610101000_drop_items_cost_price.sql` - Remove stored cost price
- `20260619100000_add_supplier_code_to_items.sql` - Optional supplier item code and item list search/display support
- Earlier migrations for items, warehouses, locations, transactions, adjustments, transfers


Batch expiration editing: In **Inventory Items → Locations → Batches**, users with Items edit permission can choose **Edit Expiration**, enter a date or **Clear Date**, and **Save**. Cancel discards changes. The date belongs to the batch and applies to all its locations. The PATCH endpoint `/api/items/[id]/batch-locations/[batchLocationId]/expiration` accepts only `{ expirationDate: "YYYY-MM-DD" | null }`, validates company and business-unit access, and performs one batch update. Invalid dates, unavailable batches, and denied access return safe errors. Successful saves refresh active item location views and mark cached location pages and stock adjustments stale. Verify edits and clearing without reloading, permission denial, and that failed saves leave the dialog open for retry.

An empty warehouse location cannot be deleted while it is an item's preferred location.
Clear or reassign the preference in the item's warehouse settings, then retry deletion.
Preferred-location assignment and deletion are serialized in the database so concurrent
requests cannot leave an item pointing to a deleted location.
