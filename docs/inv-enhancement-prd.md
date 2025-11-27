2.1 Product Goal

Introduce Variants + Multi-Packaging + Multi-Pricing so inventory can model real-life products like your Stretch Canvas example:

Size: 8x12
Qty/Carton: 100
Factory Cost: 24.50
Wholesale: 20.00
SRP: 35.00

2.2 New Product Features
Feature 1 — Variants

UI: Variants tab inside Item screen

Data model: new table item_variants

API:

GET /items/{id}/variants

POST /items/{id}/variants

Feature 2 — Packaging

UI: Packaging table per variant

Data model: item_packaging

API:

GET /items/{id}/packaging

POST /items/{id}/packaging

Feature 3 — Price Tiers

UI: Price matrix per item/variant

Data model: item_prices

API:

GET /items/{id}/prices

POST /items/{id}/prices

Feature 4 — Transaction Pricing

During sales/purchase:

When selecting variant + packaging:
→ compute base qty (pcs)
→ pick appropriate price

Feature 5 — Stock Availability

Stock shown per:

Item

Variant

Warehouse

UI Example:

Stretch Canvas
  Variant: 8x12
      Packaging: Carton (100)
      Stock: 256 pcs (2.56 cartons)

2.3 New Tables (minimal breaking)
Table A. item_variants

Keeps variant attributes (size, color).

Table B. item_packaging

Keeps pack_type + qty_per_pack.

Table C. item_prices

Keeps multiple pricing tiers (fc, ws, srp).

Modify inventory_transactions (minimal change)

Add nullable:

variant_id (optional)

packaging_id (optional)

No other changes → back-compatible.

2.4 Migration Requirements

Every existing item gets:

default variant

default packaging (qty=1)

No conversion of existing stock.

2.5 Acceptance Criteria

Can create item variant + packaging.

Can see price tiers.

Can make a purchase using packaging or pieces.

Can make a sale using packaging or pieces.

Stock is correctly updated.

Old items still behave the same.