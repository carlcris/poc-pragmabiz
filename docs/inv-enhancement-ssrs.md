1.1 Purpose

Extend the existing ERP inventory module to support:

Item variants (e.g., size: 8×12)

Item packaging options (e.g., carton = 100 pcs)

Multiple price tiers (Factory Cost, Wholesale, SRP, etc.)

Without breaking existing API workflows, UI flows, or DB integrity.

The system must:

Seamlessly integrate with existing inventory transactions.

Maintain backwards compatibility for existing items.

Allow gradual migration of products into variant/packaging structures.

1.2 Scope

The enhancements will enable:

Variant attribute handling

Packaging structures (qty per pack)

Tier pricing

Transaction handling using variants + packaging

Minimal DB changes

UI/UX with backward compatibility

1.3 Functional Requirements
FR-1: Variant Management

System must support optional variants per item.

Existing items default to a single implicit variant.

Users may add multiple variants (e.g., size, color).

FR-2: Packaging Management

Each variant may have 1..N packaging options.

Packaging includes:

Pack Type (e.g., “carton”, “piece”)

Qty per pack (e.g., 100 pcs per carton)

Selling, purchasing, and transfers must allow selecting packaging.

FR-3: Price Tier Management

Each item or variant may have multiple price entries:

Factory Cost (fc)

Wholesale (ws)

SRP (retail)

Can be extended for future tiers (government, resellers, VIP).

FR-4: Inventory Transaction Mapping

Existing inventory_transaction table remains.

Add optional fields:

variant_id

packaging_id

If not provided → default variant & packaging auto-selected.

FR-5: Stock Calculation

Stock always stored in base UOM (e.g., pieces).

Packaging conversions must be applied when:

Receiving (carton → pcs)

Selling (pcs or cartons)

Adjustments

FR-6: Backward Compatibility

Items without variants work exactly as before.

Existing inventory balances remain valid.

Existing APIs remain as-is.

1.4 Non-Functional Requirements

No downtime during migration.

Backward compatible.

Low performance overhead.

New tables indexed for large data.