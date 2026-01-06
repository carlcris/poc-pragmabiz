# Inventory UOM Normalization Implementation Plan (v2)

## Document Control
- **Created**: 2026-01-02
- **Status**: Draft for Review (Updated)
- **Version**: 2.0
- **Previous Version**: inv-normalization-implementation-plan.md
- **Based on**: inv-normalization-prompt.txt
- **Target**: Production ERP System

---

## Updates in Version 2.0

### Key Changes from v1.0
1. ✅ **Removed `items.uom_id`** - Replaced with `items.package_id`
2. ✅ **Simplified default package logic** - Base package IS the default package
3. ✅ **Atomic creation** - Database function handles item + package creation
4. ✅ **Enforced package consistency** - `package_id` must reference valid `item_packaging`

### Design Decision Summary
- **items.package_id**: References the base storage package (qty_per_pack = 1)
- **Base = Default**: Users always transact in base package by default
- **Additional packages**: Users can explicitly select other packages (bags, cartons, etc.)
- **Atomic creation**: Database function ensures referential integrity

---

## Executive Summary

This plan implements **inventory quantity normalization** to ensure all inventory quantities are stored in the item's base unit of measure (defined by `items.package_id`), while allowing users to transact using various packages (boxes, cartons, cases, etc.).

### Core Principles
1. **Single Source of Truth**: `items.package_id` defines how inventory is stored
2. **Package-First Design**: Base unit MUST be a valid package in `item_packaging`
3. **Simplified Defaults**: Base package is automatically the transaction default
4. **Atomic Operations**: Item creation includes package setup in one transaction
5. **Backward Compatible**: Existing data migrated seamlessly

---

## 1. Conceptual Explanation

### Target State Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ ITEM: Premium Flour                                         │
├─────────────────────────────────────────────────────────────┤
│ package_id → "pkg-flour-kg"                                 │
│   ↓                                                         │
│   Points to: item_packaging record                          │
│     - pack_name: "Kilogram"                                 │
│     - qty_per_pack: 1.0  (BASE UNIT)                        │
│     - This IS the default for transactions                  │
│                                                             │
│ Other packages (optional):                                  │
│   - "Bag (5kg)" → qty_per_pack: 5.0                        │
│   - "Carton (25kg)" → qty_per_pack: 25.0                   │
│                                                             │
│ Inventory Storage:                                          │
│   item_warehouse.current_stock = 500 kg                     │
│   (Always in base package units)                            │
└─────────────────────────────────────────────────────────────┘
```

### Example Flow

**Item Configuration:**
```sql
-- Base package (created first)
item_packaging:
  id: 'pkg-flour-kg'
  item_id: 'item-flour'
  pack_name: 'Kilogram'
  qty_per_pack: 1.0

-- Item references base package
items:
  id: 'item-flour'
  package_id: 'pkg-flour-kg'  ← Base storage unit
  setup_complete: TRUE

-- Additional packages
item_packaging:
  id: 'pkg-flour-bag'
  pack_name: 'Bag (5kg)'
  qty_per_pack: 5.0

  id: 'pkg-flour-carton'
  pack_name: 'Carton (25kg)'
  qty_per_pack: 25.0
```

**Transaction Flow:**
```
User Action: Receive 10 cartons of flour

Step 1: User selects package
  → Package: "Carton (25kg)"
  → Quantity: 10

Step 2: System normalizes
  → Get package.qty_per_pack: 25
  → Calculate: 10 × 25 = 250 kg

Step 3: System stores
  → Get item.package_id → base unit is "Kilogram"
  → Update item_warehouse.current_stock += 250 (in kg)
  → Record in stock_transaction_items:
      input_qty: 10
      input_packaging_id: 'pkg-flour-carton'
      conversion_factor: 25
      normalized_qty: 250
      base_package_id: 'pkg-flour-kg'
```

---

## 2. Schema Changes

### 2.1 Update items Table - Replace uom_id with package_id

**Migration**: `20260102000000_replace_uom_with_package_id.sql`

```sql
-- ============================================================================
-- Migration: Replace items.uom_id with items.package_id
-- ============================================================================
-- Purpose: Enforce that base storage unit is always a valid package
-- Approach: Nullable during creation, populated via atomic function

-- Step 1: Add new package_id column (nullable)
ALTER TABLE items
ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES item_packaging(id);

-- Step 2: Add setup status tracking
ALTER TABLE items
ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_items_package_id
ON items(package_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_items_setup_complete
ON items(setup_complete) WHERE setup_complete = FALSE;

-- Step 4: Add constraint - package_id required when setup_complete
ALTER TABLE items
ADD CONSTRAINT items_package_id_required_when_complete
CHECK (
  (setup_complete = FALSE AND package_id IS NULL) OR
  (setup_complete = TRUE AND package_id IS NOT NULL)
);

-- Step 5: Add validation trigger
CREATE OR REPLACE FUNCTION validate_item_package_belongs_to_item()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip if package_id is NULL (incomplete setup)
  IF NEW.package_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Validate package belongs to this item
  IF NOT EXISTS (
    SELECT 1 FROM item_packaging
    WHERE id = NEW.package_id
      AND item_id = NEW.id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'package_id must reference a valid package for this item';
  END IF;

  -- Validate base package has qty_per_pack = 1
  IF NOT EXISTS (
    SELECT 1 FROM item_packaging
    WHERE id = NEW.package_id
      AND qty_per_pack = 1.0
  ) THEN
    RAISE EXCEPTION 'Base package must have qty_per_pack = 1.0';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_item_package
BEFORE INSERT OR UPDATE ON items
FOR EACH ROW
EXECUTE FUNCTION validate_item_package_belongs_to_item();

-- Step 6: Add comments
COMMENT ON COLUMN items.package_id IS
  'Base storage package - defines how inventory is stored in item_warehouse.current_stock.
   Must reference item_packaging with qty_per_pack=1.0. This package is also the default
   for transactions. Required when setup_complete=TRUE.';

COMMENT ON COLUMN items.setup_complete IS
  'Indicates if item has completed setup with base package. Items with FALSE cannot be
   used in transactions. Set to TRUE after package_id is configured.';

-- Step 7: Prevent transactions on incomplete items
CREATE OR REPLACE FUNCTION validate_item_ready_for_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_item_complete BOOLEAN;
BEGIN
  -- Check if item is ready for transactions
  SELECT setup_complete INTO v_item_complete
  FROM items
  WHERE id = NEW.item_id
    AND deleted_at IS NULL;

  IF v_item_complete IS NULL THEN
    RAISE EXCEPTION 'Item not found: %', NEW.item_id;
  END IF;

  IF v_item_complete = FALSE THEN
    RAISE EXCEPTION 'Item is not fully configured. Please complete package setup before creating transactions.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all transaction tables
CREATE TRIGGER trigger_stock_tx_items_validate_item
BEFORE INSERT ON stock_transaction_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_po_items_validate_item
BEFORE INSERT ON purchase_order_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_pr_items_validate_item
BEFORE INSERT ON purchase_receipt_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_so_items_validate_item
BEFORE INSERT ON sales_order_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_si_items_validate_item
BEFORE INSERT ON sales_invoice_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_pos_items_validate_item
BEFORE INSERT ON pos_transaction_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

CREATE TRIGGER trigger_transfer_items_validate_item
BEFORE INSERT ON stock_transfer_items
FOR EACH ROW
EXECUTE FUNCTION validate_item_ready_for_transaction();

-- Step 8: Mark old uom_id as deprecated (keep for reference during transition)
COMMENT ON COLUMN items.uom_id IS
  'DEPRECATED: Replaced by package_id. Use items.package_id → item_packaging.uom_id instead.
   Will be removed in future version after migration complete.';
```

### 2.2 Update item_packaging - Add item_id and uom_id

**Migration**: `20260102000001_update_item_packaging.sql`

```sql
-- ============================================================================
-- Migration: Update item_packaging for package-first design
-- ============================================================================

-- Step 1: Add item_id column (if using variants, migrate from variant_id)
ALTER TABLE item_packaging
ADD COLUMN IF NOT EXISTS item_id UUID REFERENCES items(id) ON DELETE CASCADE;

-- Step 2: Add uom_id to store unit of measure info
ALTER TABLE item_packaging
ADD COLUMN IF NOT EXISTS uom_id UUID REFERENCES units_of_measure(id);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_item_packaging_item_id
ON item_packaging(item_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_item_packaging_uom_id
ON item_packaging(uom_id) WHERE deleted_at IS NULL;

-- Step 4: If migrating from variants, copy item_id from variant
UPDATE item_packaging ip
SET item_id = iv.item_id
FROM item_variants iv
WHERE ip.variant_id = iv.id
  AND ip.item_id IS NULL;

-- Step 5: Make item_id required
ALTER TABLE item_packaging
ALTER COLUMN item_id SET NOT NULL;

-- Step 6: Make variant_id nullable (deprecate variants)
ALTER TABLE item_packaging
ALTER COLUMN variant_id DROP NOT NULL;

-- Step 7: Update unique constraint
ALTER TABLE item_packaging
DROP CONSTRAINT IF EXISTS item_packaging_variant_pack_type_unique;

ALTER TABLE item_packaging
ADD CONSTRAINT item_packaging_item_pack_type_unique
UNIQUE (company_id, item_id, pack_type, deleted_at);

-- Step 8: Add comments
COMMENT ON COLUMN item_packaging.item_id IS
  'Item this package belongs to. Required.';

COMMENT ON COLUMN item_packaging.uom_id IS
  'Unit of measure for this package. For base package (qty_per_pack=1),
   this defines the base UOM for inventory storage.';

COMMENT ON COLUMN item_packaging.variant_id IS
  'DEPRECATED: Variants removed from design. Use item_id instead.
   Kept for backward compatibility during transition.';
```

### 2.3 Add Conversion Metadata to stock_transaction_items

**Migration**: `20260102000002_add_conversion_metadata.sql`

```sql
-- ============================================================================
-- Migration: Add conversion tracking to stock_transaction_items
-- ============================================================================

-- Step 1: Add conversion metadata columns
ALTER TABLE stock_transaction_items
ADD COLUMN IF NOT EXISTS input_qty DECIMAL(15, 4),
ADD COLUMN IF NOT EXISTS input_packaging_id UUID REFERENCES item_packaging(id),
ADD COLUMN IF NOT EXISTS normalized_qty DECIMAL(15, 4),
ADD COLUMN IF NOT EXISTS conversion_factor DECIMAL(15, 4) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS base_package_id UUID REFERENCES item_packaging(id);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_stock_tx_items_input_packaging
ON stock_transaction_items(input_packaging_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_stock_tx_items_base_package
ON stock_transaction_items(base_package_id) WHERE deleted_at IS NULL;

-- Step 3: Add check constraint
ALTER TABLE stock_transaction_items
ADD CONSTRAINT stock_tx_items_conversion_check
CHECK (
  normalized_qty IS NULL OR
  input_qty IS NULL OR
  conversion_factor IS NULL OR
  ABS(normalized_qty - (input_qty * conversion_factor)) < 0.01
);

-- Step 4: Backfill existing records (assume already normalized)
UPDATE stock_transaction_items
SET
  input_qty = quantity,
  normalized_qty = quantity,
  conversion_factor = 1.0,
  input_packaging_id = NULL,  -- Unknown for historical data
  base_package_id = NULL       -- Unknown for historical data
WHERE input_qty IS NULL;

-- Step 5: Make required columns NOT NULL
ALTER TABLE stock_transaction_items
ALTER COLUMN input_qty SET NOT NULL,
ALTER COLUMN normalized_qty SET NOT NULL,
ALTER COLUMN conversion_factor SET NOT NULL;

-- Step 6: Add comments
COMMENT ON COLUMN stock_transaction_items.quantity IS
  'DEPRECATED: Use normalized_qty instead. Kept for backward compatibility.';

COMMENT ON COLUMN stock_transaction_items.normalized_qty IS
  'Quantity in base package units. This is the source of truth for inventory calculations.';

COMMENT ON COLUMN stock_transaction_items.input_qty IS
  'Original quantity entered by user in selected package.';

COMMENT ON COLUMN stock_transaction_items.input_packaging_id IS
  'Package selected by user for input. References item_packaging.id.';

COMMENT ON COLUMN stock_transaction_items.conversion_factor IS
  'Conversion factor from input package to base package (qty_per_pack).';

COMMENT ON COLUMN stock_transaction_items.base_package_id IS
  'Base package used for normalization. References items.package_id at time of transaction.';
```

### 2.4 Atomic Item Creation Function

**Migration**: `20260102000003_create_item_with_packages_function.sql`

```sql
-- ============================================================================
-- Function: create_item_with_packages
-- ============================================================================
-- Purpose: Atomically create item with base package (and optional additional packages)
-- Solves: Chicken-egg problem of foreign key dependencies

CREATE OR REPLACE FUNCTION create_item_with_packages(
  p_company_id UUID,
  p_user_id UUID,
  p_item_code VARCHAR(100),
  p_item_name VARCHAR(255),
  p_item_description TEXT DEFAULT NULL,
  p_item_type VARCHAR(50) DEFAULT 'finished_good',
  p_base_package_name VARCHAR(200) DEFAULT 'Each',
  p_base_package_type VARCHAR(100) DEFAULT 'base',
  p_base_uom_id UUID DEFAULT NULL,
  p_standard_cost DECIMAL(20,4) DEFAULT 0,
  p_list_price DECIMAL(20,4) DEFAULT 0,
  p_additional_packages JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE(
  item_id UUID,
  base_package_id UUID,
  message TEXT
) AS $$
DECLARE
  v_item_id UUID;
  v_base_package_id UUID;
  v_package JSONB;
  v_new_package_id UUID;
BEGIN
  -- Step 1: Create item (package_id NULL, setup_complete FALSE)
  INSERT INTO items (
    company_id,
    item_code,
    item_name,
    description,
    item_type,
    standard_cost,
    list_price,
    package_id,
    setup_complete,
    created_by,
    updated_by
  ) VALUES (
    p_company_id,
    p_item_code,
    p_item_name,
    p_item_description,
    p_item_type,
    p_standard_cost,
    p_list_price,
    NULL,        -- Will be set after creating package
    FALSE,       -- Not ready for transactions yet
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_item_id;

  -- Step 2: Create base package (qty_per_pack = 1.0)
  INSERT INTO item_packaging (
    company_id,
    item_id,
    pack_type,
    pack_name,
    qty_per_pack,
    uom_id,
    is_default,
    is_active,
    created_by,
    updated_by
  ) VALUES (
    p_company_id,
    v_item_id,
    p_base_package_type,
    p_base_package_name,
    1.0,                    -- Base package always = 1
    p_base_uom_id,
    TRUE,                   -- Is default
    TRUE,                   -- Is active
    p_user_id,
    p_user_id
  )
  RETURNING id INTO v_base_package_id;

  -- Step 3: Create additional packages (if provided)
  IF jsonb_array_length(p_additional_packages) > 0 THEN
    FOR v_package IN SELECT * FROM jsonb_array_elements(p_additional_packages)
    LOOP
      INSERT INTO item_packaging (
        company_id,
        item_id,
        pack_type,
        pack_name,
        qty_per_pack,
        uom_id,
        barcode,
        is_default,
        is_active,
        created_by,
        updated_by
      ) VALUES (
        p_company_id,
        v_item_id,
        (v_package->>'pack_type')::VARCHAR,
        (v_package->>'pack_name')::VARCHAR,
        (v_package->>'qty_per_pack')::DECIMAL,
        COALESCE((v_package->>'uom_id')::UUID, p_base_uom_id),
        (v_package->>'barcode')::VARCHAR,
        FALSE,                   -- Not default
        COALESCE((v_package->>'is_active')::BOOLEAN, TRUE),
        p_user_id,
        p_user_id
      )
      RETURNING id INTO v_new_package_id;
    END LOOP;
  END IF;

  -- Step 4: Link base package to item and mark setup complete
  UPDATE items
  SET package_id = v_base_package_id,
      setup_complete = TRUE,
      updated_by = p_user_id,
      updated_at = NOW()
  WHERE id = v_item_id;

  -- Step 5: Return results
  RETURN QUERY
  SELECT
    v_item_id,
    v_base_package_id,
    'Item created successfully with ' ||
    (1 + jsonb_array_length(p_additional_packages))::TEXT ||
    ' package(s)' AS message;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_item_with_packages IS
  'Atomically creates an item with base package (qty_per_pack=1) and optional additional packages.
   Handles foreign key dependencies correctly by creating item first (incomplete), then packages,
   then linking them. Base package becomes the default for transactions.

   Parameters:
   - p_additional_packages: JSON array of objects with fields:
     {pack_type, pack_name, qty_per_pack, uom_id?, barcode?, is_active?}

   Example:
   SELECT * FROM create_item_with_packages(
     ''company-id'',
     ''user-id'',
     ''FLOUR-001'',
     ''Premium Flour'',
     ''High-quality wheat flour'',
     ''raw_material'',
     ''Kilogram'',
     ''base'',
     ''uom-kg-id'',
     100.00,
     150.00,
     ''[
       {"pack_type": "bag", "pack_name": "Bag (5kg)", "qty_per_pack": 5.0},
       {"pack_type": "carton", "pack_name": "Carton (25kg)", "qty_per_pack": 25.0}
     ]''::JSONB
   );';
```

### 2.5 Helper Function: Get Base Package Info

**Migration**: `20260102000004_get_base_package_function.sql`

```sql
-- ============================================================================
-- Function: get_item_base_package
-- ============================================================================
-- Purpose: Quick lookup for item's base package information

CREATE OR REPLACE FUNCTION get_item_base_package(p_item_id UUID)
RETURNS TABLE(
  package_id UUID,
  pack_name VARCHAR(200),
  qty_per_pack DECIMAL(15,4),
  uom_id UUID,
  uom_name VARCHAR(100)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ip.id AS package_id,
    ip.pack_name,
    ip.qty_per_pack,
    ip.uom_id,
    u.name AS uom_name
  FROM items i
  JOIN item_packaging ip ON i.package_id = ip.id
  LEFT JOIN units_of_measure u ON ip.uom_id = u.id
  WHERE i.id = p_item_id
    AND i.deleted_at IS NULL
    AND ip.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_item_base_package IS
  'Returns base package information for an item.
   Useful for quick lookups without joining multiple tables.';
```

---

## 3. Inventory Normalization Algorithm

### 3.1 Core Conversion Logic (Updated)

```typescript
/**
 * Inventory Normalization Algorithm (v2)
 * Converts user input quantity to base package quantity
 */

interface PackageConversionInput {
  itemId: string;
  packagingId: string | null; // null = use base package (items.package_id)
  inputQty: number;
}

interface PackageConversionResult {
  normalizedQty: number;
  conversionFactor: number;
  inputPackagingId: string;
  basePackageId: string;
  inputQty: number;
  metadata: {
    inputPackageName: string;
    inputPackageType: string;
    basePackageName: string;
    baseUomId: string;
    baseUomName: string;
  };
}

async function normalizeQuantity(
  companyId: string,
  input: PackageConversionInput,
  supabase: SupabaseClient
): Promise<PackageConversionResult> {

  // STEP 1: Get item's base package
  const { data: item, error: itemError } = await supabase
    .from('items')
    .select(`
      package_id,
      base_package:item_packaging!package_id(
        id,
        pack_name,
        pack_type,
        qty_per_pack,
        uom_id,
        units_of_measure(name)
      )
    `)
    .eq('id', input.itemId)
    .eq('company_id', companyId)
    .eq('setup_complete', true)
    .is('deleted_at', null)
    .single();

  if (itemError || !item) {
    throw new Error(`Item not found or not ready for transactions: ${input.itemId}`);
  }

  const basePackage = item.base_package as any;
  if (!basePackage) {
    throw new Error('Item base package not found');
  }

  // STEP 2: Determine input package
  let inputPackageId = input.packagingId;

  if (!inputPackageId) {
    // Use base package as default
    inputPackageId = item.package_id;
  }

  // STEP 3: Get input package details (if different from base)
  let inputPackage: any;

  if (inputPackageId === item.package_id) {
    // Using base package
    inputPackage = basePackage;
  } else {
    // Using different package - fetch it
    const { data: pkg, error: pkgError } = await supabase
      .from('item_packaging')
      .select('id, pack_name, pack_type, qty_per_pack')
      .eq('id', inputPackageId)
      .eq('company_id', companyId)
      .eq('item_id', input.itemId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single();

    if (pkgError || !pkg) {
      throw new Error('Input package not found or does not belong to item');
    }

    inputPackage = pkg;
  }

  // STEP 4: Validate conversion factor
  const conversionFactor = parseFloat(String(inputPackage.qty_per_pack));

  if (conversionFactor <= 0 || !isFinite(conversionFactor)) {
    throw new Error(`Invalid conversion factor: ${conversionFactor}`);
  }

  // STEP 5: Validate input quantity
  if (input.inputQty < 0 || !isFinite(input.inputQty)) {
    throw new Error(`Invalid input quantity: ${input.inputQty}`);
  }

  // STEP 6: Calculate normalized quantity
  const normalizedQty = input.inputQty * conversionFactor;

  // STEP 7: Return conversion result
  return {
    normalizedQty,
    conversionFactor,
    inputPackagingId: inputPackage.id,
    basePackageId: item.package_id,
    inputQty: input.inputQty,
    metadata: {
      inputPackageName: inputPackage.pack_name,
      inputPackageType: inputPackage.pack_type,
      basePackageName: basePackage.pack_name,
      baseUomId: basePackage.uom_id,
      baseUomName: basePackage.units_of_measure?.name || 'unit',
    },
  };
}
```

---

## 4. Updated Transaction Flows

### 4.1 Stock IN Flow (Simplified)

```
┌─────────────────────────────────────────────────────────────┐
│ USER INPUT                                                  │
├─────────────────────────────────────────────────────────────┤
│ Item: Premium Flour                                         │
│ Package: (not specified - uses base package)               │
│ Quantity: 250                                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: GET BASE PACKAGE                                    │
├─────────────────────────────────────────────────────────────┤
│ → Get items.package_id → 'pkg-flour-kg'                    │
│ → Get package details:                                      │
│     pack_name: "Kilogram"                                   │
│     qty_per_pack: 1.0                                       │
│     uom_id: 'uom-kg'                                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: NORMALIZE (Base package, so 1:1)                   │
├─────────────────────────────────────────────────────────────┤
│ → input_qty: 250                                            │
│ → input_packaging_id: 'pkg-flour-kg' (base)                │
│ → conversion_factor: 1.0                                    │
│ → normalized_qty: 250 × 1.0 = 250 kg                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: UPDATE INVENTORY                                    │
├─────────────────────────────────────────────────────────────┤
│ → item_warehouse.current_stock += 250                       │
│ → stock_transaction_items:                                  │
│     input_qty: 250                                          │
│     normalized_qty: 250                                     │
│     base_package_id: 'pkg-flour-kg'                         │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Stock IN with Non-Base Package

```
┌─────────────────────────────────────────────────────────────┐
│ USER INPUT                                                  │
├─────────────────────────────────────────────────────────────┤
│ Item: Premium Flour                                         │
│ Package: "Carton (25kg)" (user selected)                   │
│ Quantity: 10 cartons                                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: GET PACKAGES                                        │
├─────────────────────────────────────────────────────────────┤
│ → Base: items.package_id → 'pkg-flour-kg' (Kilogram)      │
│ → Input: user selected → 'pkg-flour-carton'                │
│     pack_name: "Carton (25kg)"                              │
│     qty_per_pack: 25.0                                      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: NORMALIZE                                           │
├─────────────────────────────────────────────────────────────┤
│ → input_qty: 10                                             │
│ → input_packaging_id: 'pkg-flour-carton'                    │
│ → conversion_factor: 25.0                                   │
│ → normalized_qty: 10 × 25 = 250 kg                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: UPDATE INVENTORY                                    │
├─────────────────────────────────────────────────────────────┤
│ → item_warehouse.current_stock += 250                       │
│ → stock_transaction_items:                                  │
│     input_qty: 10                                           │
│     input_packaging_id: 'pkg-flour-carton'                  │
│     conversion_factor: 25.0                                 │
│     normalized_qty: 250                                     │
│     base_package_id: 'pkg-flour-kg'                         │
└─────────────────────────────────────────────────────────────┘

RESULT: Same inventory increase (250 kg), different audit trail
```

---

## 5. Implementation Examples

### 5.1 Creating an Item with Packages

```typescript
// Example 1: Simple item with base package only
const result = await supabase.rpc('create_item_with_packages', {
  p_company_id: companyId,
  p_user_id: userId,
  p_item_code: 'FLOUR-001',
  p_item_name: 'Premium Flour',
  p_item_description: 'High-quality wheat flour',
  p_item_type: 'raw_material',
  p_base_package_name: 'Kilogram',
  p_base_package_type: 'base',
  p_base_uom_id: uomKgId,
  p_standard_cost: 100.00,
  p_list_price: 150.00,
  p_additional_packages: null, // No additional packages
});

// Result: Item with single base package "Kilogram" (qty_per_pack=1)

// Example 2: Item with multiple packages
const result = await supabase.rpc('create_item_with_packages', {
  p_company_id: companyId,
  p_user_id: userId,
  p_item_code: 'FLOUR-001',
  p_item_name: 'Premium Flour',
  p_base_package_name: 'Kilogram',
  p_base_uom_id: uomKgId,
  p_additional_packages: [
    {
      pack_type: 'bag',
      pack_name: 'Bag (5kg)',
      qty_per_pack: 5.0,
      barcode: '1234567890123',
    },
    {
      pack_type: 'carton',
      pack_name: 'Carton (25kg)',
      qty_per_pack: 25.0,
      barcode: '1234567890124',
    },
  ],
});

// Result: Item with 3 packages total
//   - Kilogram (base, qty_per_pack=1) ← Default
//   - Bag (5kg) (qty_per_pack=5)
//   - Carton (25kg) (qty_per_pack=25)
```

### 5.2 Updated POS Stock Service

```typescript
import { normalizeTransactionItems } from './normalizationService';

export async function createPOSStockTransaction(
  companyId: string,
  businessUnitId: string,
  userId: string,
  data: POSStockTransactionData
): Promise<{ success: boolean; stockTransactionId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // STEP 1: Normalize all item quantities
    const itemInputs: StockTransactionItemInput[] = data.items.map((item) => ({
      itemId: item.itemId,
      packagingId: item.packagingId || null, // null = use base package
      inputQty: item.quantity,
      unitCost: item.rate,
    }));

    const normalizedItems = await normalizeTransactionItems(companyId, itemInputs);

    // STEP 2: Validate stock availability
    for (const item of normalizedItems) {
      const { data: warehouseStock } = await supabase
        .from('item_warehouse')
        .select('current_stock')
        .eq('item_id', item.itemId)
        .eq('warehouse_id', data.warehouseId)
        .single();

      const currentBalance = warehouseStock?.current_stock || 0;

      if (currentBalance < item.normalizedQty) {
        return {
          success: false,
          error: `Insufficient stock. Available: ${currentBalance} (base units), Requested: ${item.normalizedQty}`,
        };
      }
    }

    // STEP 3: Create stock transaction header
    const { data: stockTransaction, error: transactionError } = await supabase
      .from('stock_transactions')
      .insert({
        company_id: companyId,
        business_unit_id: businessUnitId,
        transaction_code: `ST-POS-${data.transactionCode}`,
        transaction_type: 'out',
        transaction_date: data.transactionDate.split('T')[0],
        warehouse_id: data.warehouseId,
        reference_type: 'pos_transaction',
        reference_id: data.transactionId,
        status: 'posted',
        created_by: userId,
      })
      .select()
      .single();

    if (transactionError) {
      return { success: false, error: 'Failed to create stock transaction' };
    }

    // STEP 4: Create stock transaction items with normalization
    for (const item of normalizedItems) {
      const { data: warehouseStock } = await supabase
        .from('item_warehouse')
        .select('current_stock')
        .eq('item_id', item.itemId)
        .eq('warehouse_id', data.warehouseId)
        .single();

      const currentBalance = warehouseStock?.current_stock || 0;
      const newBalance = currentBalance - item.normalizedQty;

      // Create transaction item with full normalization metadata
      await supabase.from('stock_transaction_items').insert({
        company_id: companyId,
        transaction_id: stockTransaction.id,
        item_id: item.itemId,
        // Normalization fields
        input_qty: item.inputQty,
        input_packaging_id: item.inputPackagingId,
        conversion_factor: item.conversionFactor,
        normalized_qty: item.normalizedQty,
        base_package_id: item.basePackageId,
        // Standard fields
        quantity: item.normalizedQty, // Backward compat
        uom_id: item.uomId,
        unit_cost: item.unitCost,
        total_cost: item.totalCost,
        // Audit fields
        qty_before: currentBalance,
        qty_after: newBalance,
        posting_date: new Date().toISOString().split('T')[0],
        created_by: userId,
      });

      // Update warehouse stock
      await supabase
        .from('item_warehouse')
        .update({ current_stock: newBalance })
        .eq('item_id', item.itemId)
        .eq('warehouse_id', data.warehouseId);
    }

    return { success: true, stockTransactionId: stockTransaction.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

---

## 6. Migration Strategy

### 6.1 Data Migration Steps

```sql
-- Step 1: Create base packages for all existing items
DO $$
DECLARE
  item_record RECORD;
  base_package_id UUID;
  uom_name TEXT;
BEGIN
  FOR item_record IN
    SELECT id, company_id, uom_id, item_code
    FROM items
    WHERE deleted_at IS NULL
      AND setup_complete = FALSE
  LOOP
    -- Get UOM name
    SELECT name INTO uom_name
    FROM units_of_measure
    WHERE id = item_record.uom_id;

    -- Create base package
    INSERT INTO item_packaging (
      company_id,
      item_id,
      pack_type,
      pack_name,
      qty_per_pack,
      uom_id,
      is_default,
      is_active,
      created_by
    ) VALUES (
      item_record.company_id,
      item_record.id,
      'base',
      COALESCE(uom_name, 'Each'),
      1.0,
      item_record.uom_id,
      TRUE,
      TRUE,
      '00000000-0000-0000-0000-000000000000'::UUID
    )
    RETURNING id INTO base_package_id;

    -- Update item with package_id
    UPDATE items
    SET package_id = base_package_id,
        setup_complete = TRUE
    WHERE id = item_record.id;

    RAISE NOTICE 'Created base package % for item %', base_package_id, item_record.item_code;
  END LOOP;
END $$;

-- Step 2: Verify all items have packages
SELECT COUNT(*) FROM items WHERE setup_complete = FALSE;
-- Should return 0
```

---

## 7. Backward Compatibility

### 7.1 Transition Plan

**Phase 1: Coexistence (Month 1-2)**
- Keep `items.uom_id` (deprecated)
- New code uses `package_id`
- Old code continues working

**Phase 2: Migration (Month 3)**
- All items migrated to `package_id`
- All new items use atomic function
- Reports updated

**Phase 3: Cleanup (Month 4+)**
- Drop `items.uom_id` column
- Remove deprecated comments
- Archive old migration scripts

---

## 8. Testing Strategy

### 8.1 Critical Test Cases

```typescript
describe('Package-based Normalization', () => {
  test('Create item with base package only', async () => {
    const result = await createItemWithPackages({
      itemCode: 'TEST-001',
      itemName: 'Test Item',
      basePackageName: 'Piece',
    });

    expect(result.item_id).toBeDefined();
    expect(result.base_package_id).toBeDefined();

    // Verify package is base unit
    const pkg = await getPackage(result.base_package_id);
    expect(pkg.qty_per_pack).toBe(1.0);
  });

  test('Transaction with base package (default)', async () => {
    // User doesn't specify package - uses base
    const tx = await createStockTransaction({
      itemId: 'item-1',
      packagingId: null, // Use base
      inputQty: 100,
    });

    const txItem = await getTransactionItem(tx.id);
    expect(txItem.input_qty).toBe(100);
    expect(txItem.normalized_qty).toBe(100);
    expect(txItem.conversion_factor).toBe(1.0);
  });

  test('Transaction with non-base package', async () => {
    // User selects carton (qty_per_pack=25)
    const tx = await createStockTransaction({
      itemId: 'item-1',
      packagingId: 'pkg-carton',
      inputQty: 10,
    });

    const txItem = await getTransactionItem(tx.id);
    expect(txItem.input_qty).toBe(10);
    expect(txItem.normalized_qty).toBe(250); // 10 × 25
    expect(txItem.conversion_factor).toBe(25);
  });

  test('Prevent transaction on incomplete item', async () => {
    // Create item without completing setup
    const item = await createIncompleteItem();

    await expect(
      createStockTransaction({ itemId: item.id })
    ).rejects.toThrow('not fully configured');
  });
});
```

---

## 9. Success Criteria

✅ **Schema Updated**
- `items.package_id` replaces `uom_id`
- Base package = default package
- Atomic creation function works

✅ **Normalization Working**
- All transactions normalize correctly
- Conversion metadata recorded
- Inventory always in base units

✅ **Data Integrity**
- No incomplete items in production
- All packages belong to correct items
- Foreign keys enforced

✅ **User Experience**
- Base package auto-selected by default
- Additional packages selectable
- Clear error messages

---

## 10. Implementation Checklist

### Phase 1: Database (Week 1)
- [ ] Run migration `20260102000000_replace_uom_with_package_id.sql`
- [ ] Run migration `20260102000001_update_item_packaging.sql`
- [ ] Run migration `20260102000002_add_conversion_metadata.sql`
- [ ] Run migration `20260102000003_create_item_with_packages_function.sql`
- [ ] Run migration `20260102000004_get_base_package_function.sql`
- [ ] Migrate existing items to package_id
- [ ] Validate data integrity

### Phase 2: Application Code (Week 2)
- [ ] Update normalizationService.ts
- [ ] Update posStockService.ts
- [ ] Update purchase receipt handler
- [ ] Update stock adjustment handler
- [ ] Update all transaction handlers

### Phase 3: Testing (Week 3)
- [ ] Unit tests for normalization
- [ ] Integration tests for transactions
- [ ] Test atomic item creation
- [ ] Test incomplete item prevention

### Phase 4: Deployment (Week 4)
- [ ] Staging deployment
- [ ] UAT testing
- [ ] Production deployment
- [ ] Monitor and validate

---

## Appendix: SQL Quick Reference

```sql
-- Create item with packages
SELECT * FROM create_item_with_packages(
  'company-id',
  'user-id',
  'ITEM-001',
  'Item Name',
  NULL,
  'finished_good',
  'Piece',
  'base',
  'uom-id',
  100.00,
  150.00,
  '[{"pack_type": "box", "pack_name": "Box of 12", "qty_per_pack": 12.0}]'::JSONB
);

-- Get item's base package
SELECT * FROM get_item_base_package('item-id');

-- Check incomplete items
SELECT id, item_code, item_name
FROM items
WHERE setup_complete = FALSE;

-- Audit: See conversion trail
SELECT
  st.transaction_code,
  i.item_name,
  sti.input_qty,
  ip_input.pack_name AS input_package,
  sti.conversion_factor,
  sti.normalized_qty,
  ip_base.pack_name AS base_package
FROM stock_transaction_items sti
JOIN stock_transactions st ON sti.transaction_id = st.id
JOIN items i ON sti.item_id = i.id
LEFT JOIN item_packaging ip_input ON sti.input_packaging_id = ip_input.id
LEFT JOIN item_packaging ip_base ON sti.base_package_id = ip_base.id
WHERE st.transaction_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY st.transaction_date DESC;
```

---

**Document Status**: Ready for Review
**Next Steps**: Review and approve to begin implementation
