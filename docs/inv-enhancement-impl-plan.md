This plan ensures ZERO downtime and minimal disruption.

Phase 1 — Preparation (Low risk)
1.1 Add new tables

item_variants

item_packaging

item_prices

No changes to existing code yet.

1.2 Add columns (nullable) to existing tables
ALTER TABLE inventory_transactions ADD COLUMN variant_id uuid NULL;
ALTER TABLE inventory_transactions ADD COLUMN packaging_id uuid NULL;


This does not break anything.

1.3 API Backward Compatibility

Variant_id and packaging_id optional.

If not supplied → default.

Phase 2 — Migration (non-breaking)
2.1 Create DEFAULT variant for all items
variant_code = 'default'
attributes = {}

2.2 Create DEFAULT packaging for all items
pack_type = 'each'
qty_per_pack = 1

2.3 Optional: auto-generate price tiers

Migrate purchase_price → fc

Migrate sales_price → srp

wholesale price = null (user sets later)

Phase 3 — UI/UX Integration
3.1 Update Item Screen

Tabs:

General

Variants

Packaging

Price List

3.2 Transaction forms (Purchase, Sales)

Add 2 fields:

Variant (dropdown)

Packaging (dropdown)

Default = auto-selected if only one.

3.3 Computation Logic

When user selects packaging:

base_qty = qty_input * qty_per_pack


When user selects variant:

pull price tiers from item_prices where variant_id = {selected}

Phase 4 — Inventory Logic Enhancement
4.1 Stock-in Transaction

Store:

variant_id

packaging_id

qty_in_base_uom

cost price

reference

4.2 Stock-out Transaction

Store:

variant_id

packaging_id

qty_out_base_uom

unit price tier selected

4.3 Update stock calculation functions

Include:

GROUP BY item_id + variant_id + warehouse_id

Phase 5 — Testing
5.1 Unit Tests

Add item with multiple variants, packaging.

Purchase using carton.

Sale using pcs.

Correct conversions.

5.2 Regression Tests

Existing flows must work unchanged:

Items without variants

Legacy APIs

Reports

5.3 UAT Test Cases

Create canvas item (8×12)

Set 100 pcs/carton

Input FC=24.50, WS=20, SRP=35

Receive 5 cartons

Sell 10 pcs

Expected:

Stock movement correct

Price correct

Reports correct

Phase 6 — Rollout
6.1 Release steps

Deploy DB migrations (safe)

Deploy backend code with backward compatibility

Enable UI features behind a feature flag

Smart rollout: enable per company or per user

6.2 Monitoring

Transaction logs

Error logs

Duplicate price entries

Stock discrepancies

Phase 7 — Post-launch
7.1 Gradually migrate existing items to variants

Not required immediately. You can convert items slowly.

7.2 Add advanced features (phase 2)

Barcode per packaging

Auto-convert prices based on pack sizes

Variant-level reorder levels

Variant-level warehouse stock