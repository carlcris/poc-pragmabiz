# Multi-Business Unit Implementation Plan
## Strict Compliance with PRD Requirements

---

## Phase 1: Database Schema & Migration (Foundation)

### 1.1 Create New Tables
**File:** `supabase/migrations/YYYYMMDD_add_business_unit_support.sql`

#### Table: business_units
```sql
CREATE TABLE business_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50), -- branch, outlet, warehouse, shop, office
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_by UUID REFERENCES users(id),

  CONSTRAINT uq_bu_code_per_company UNIQUE(company_id, code)
);

CREATE INDEX idx_business_units_company ON business_units(company_id);
CREATE INDEX idx_business_units_active ON business_units(is_active);
```

#### Table: user_business_unit_access
```sql
CREATE TABLE user_business_unit_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_unit_id UUID NOT NULL REFERENCES business_units(id) ON DELETE CASCADE,
  role VARCHAR(50), -- admin, manager, staff
  is_default BOOLEAN DEFAULT false NOT NULL,
  granted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  granted_by UUID REFERENCES users(id),

  PRIMARY KEY (user_id, business_unit_id),
  CONSTRAINT chk_one_default_per_user UNIQUE(user_id, is_default) WHERE is_default = true
);

CREATE INDEX idx_user_bu_access_user ON user_business_unit_access(user_id);
CREATE INDEX idx_user_bu_access_bu ON user_business_unit_access(business_unit_id);
CREATE INDEX idx_user_bu_access_default ON user_business_unit_access(user_id, is_default) WHERE is_default = true;
```

### 1.2 Extend Operational Tables
**Add business_unit_id to ALL operational tables:**

```sql
-- Core Modules
ALTER TABLE sales_quotations ADD COLUMN business_unit_id UUID;
ALTER TABLE sales_orders ADD COLUMN business_unit_id UUID;
ALTER TABLE sales_invoices ADD COLUMN business_unit_id UUID;
ALTER TABLE purchase_orders ADD COLUMN business_unit_id UUID;
ALTER TABLE purchase_receipts ADD COLUMN business_unit_id UUID;
ALTER TABLE stock_transactions ADD COLUMN business_unit_id UUID;
ALTER TABLE stock_adjustments ADD COLUMN business_unit_id UUID;
ALTER TABLE stock_transfers ADD COLUMN business_unit_id UUID;
ALTER TABLE pos_transactions ADD COLUMN business_unit_id UUID;
ALTER TABLE transformation_orders ADD COLUMN business_unit_id UUID;
ALTER TABLE transformation_templates ADD COLUMN business_unit_id UUID;

-- Supporting Tables
ALTER TABLE customers ADD COLUMN business_unit_id UUID;
ALTER TABLE suppliers ADD COLUMN business_unit_id UUID;
ALTER TABLE warehouses ADD COLUMN business_unit_id UUID;
ALTER TABLE employees ADD COLUMN business_unit_id UUID;
ALTER TABLE van_sales_routes ADD COLUMN business_unit_id UUID;

-- Accounting
ALTER TABLE journal_entries ADD COLUMN business_unit_id UUID;
ALTER TABLE invoice_payments ADD COLUMN business_unit_id UUID;

-- Add foreign key constraints (nullable for now)
ALTER TABLE sales_quotations
  ADD CONSTRAINT fk_sales_quotations_bu
  FOREIGN KEY (business_unit_id) REFERENCES business_units(id);
-- Repeat for all tables above
```

### 1.3 Create Default Business Unit & Backfill
```sql
-- Insert default BU for existing company
INSERT INTO business_units (id, company_id, code, name, type, is_active)
SELECT
  gen_random_uuid(),
  id,
  'MAIN',
  'Main Office',
  'primary',
  true
FROM companies
WHERE id = '00000000-0000-0000-0000-000000000001'; -- Demo company

-- Store the default BU ID
DO $$
DECLARE
  default_bu_id UUID;
BEGIN
  SELECT id INTO default_bu_id
  FROM business_units
  WHERE code = 'MAIN'
  AND company_id = '00000000-0000-0000-0000-000000000001';

  -- Backfill all operational tables
  UPDATE sales_quotations SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE sales_orders SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE sales_invoices SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE purchase_orders SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE purchase_receipts SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE stock_transactions SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE stock_adjustments SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE stock_transfers SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE pos_transactions SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE transformation_orders SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE transformation_templates SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE customers SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE suppliers SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE warehouses SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE employees SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE van_sales_routes SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE journal_entries SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
  UPDATE invoice_payments SET business_unit_id = default_bu_id WHERE business_unit_id IS NULL;
END $$;
```

### 1.4 Grant Default Access to Existing Users
```sql
-- Grant all existing users access to default BU
INSERT INTO user_business_unit_access (user_id, business_unit_id, role, is_default)
SELECT
  u.id,
  bu.id,
  'admin',
  true
FROM users u
CROSS JOIN business_units bu
WHERE bu.code = 'MAIN'
AND NOT EXISTS (
  SELECT 1 FROM user_business_unit_access
  WHERE user_id = u.id AND business_unit_id = bu.id
);
```

---

## Phase 2: Row Level Security (RLS) Implementation

### 2.1 Enable RLS on All Tables
```sql
ALTER TABLE sales_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE van_sales_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
```

### 2.2 Create RLS Policies (Template)
**For EACH table, create 4 policies:**

```sql
-- SELECT Policy
CREATE POLICY bu_select_policy ON sales_quotations
FOR SELECT
USING (
  business_unit_id = current_setting('app.current_business_unit_id', true)::uuid
);

-- INSERT Policy
CREATE POLICY bu_insert_policy ON sales_quotations
FOR INSERT
WITH CHECK (
  business_unit_id = current_setting('app.current_business_unit_id', true)::uuid
);

-- UPDATE Policy
CREATE POLICY bu_update_policy ON sales_quotations
FOR UPDATE
USING (
  business_unit_id = current_setting('app.current_business_unit_id', true)::uuid
)
WITH CHECK (
  business_unit_id = current_setting('app.current_business_unit_id', true)::uuid
);

-- DELETE Policy
CREATE POLICY bu_delete_policy ON sales_quotations
FOR DELETE
USING (
  business_unit_id = current_setting('app.current_business_unit_id', true)::uuid
);
```

### 2.3 Create Indexes for RLS Performance
```sql
CREATE INDEX idx_sales_quotations_bu ON sales_quotations(business_unit_id);
CREATE INDEX idx_sales_orders_bu ON sales_orders(business_unit_id);
CREATE INDEX idx_sales_invoices_bu ON sales_invoices(business_unit_id);
CREATE INDEX idx_purchase_orders_bu ON purchase_orders(business_unit_id);
CREATE INDEX idx_purchase_receipts_bu ON purchase_receipts(business_unit_id);
CREATE INDEX idx_stock_transactions_bu ON stock_transactions(business_unit_id);
CREATE INDEX idx_stock_adjustments_bu ON stock_adjustments(business_unit_id);
CREATE INDEX idx_stock_transfers_bu ON stock_transfers(business_unit_id);
CREATE INDEX idx_pos_transactions_bu ON pos_transactions(business_unit_id);
CREATE INDEX idx_transformation_orders_bu ON transformation_orders(business_unit_id);
CREATE INDEX idx_transformation_templates_bu ON transformation_templates(business_unit_id);
CREATE INDEX idx_customers_bu ON customers(business_unit_id);
CREATE INDEX idx_suppliers_bu ON suppliers(business_unit_id);
CREATE INDEX idx_warehouses_bu ON warehouses(business_unit_id);
CREATE INDEX idx_employees_bu ON employees(business_unit_id);
CREATE INDEX idx_van_sales_routes_bu ON van_sales_routes(business_unit_id);
CREATE INDEX idx_journal_entries_bu ON journal_entries(business_unit_id);
CREATE INDEX idx_invoice_payments_bu ON invoice_payments(business_unit_id);
```

---

## Phase 3: Backend Middleware & Context Management

### 3.1 Create Business Unit Context Store
**File:** `src/stores/businessUnitStore.ts`

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BusinessUnit {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface BusinessUnitStore {
  currentBusinessUnit: BusinessUnit | null;
  availableBusinessUnits: BusinessUnit[];
  setCurrentBusinessUnit: (bu: BusinessUnit) => void;
  setAvailableBusinessUnits: (units: BusinessUnit[]) => void;
  clearBusinessUnit: () => void;
}

export const useBusinessUnitStore = create<BusinessUnitStore>()(
  persist(
    (set) => ({
      currentBusinessUnit: null,
      availableBusinessUnits: [],
      setCurrentBusinessUnit: (bu) => set({ currentBusinessUnit: bu }),
      setAvailableBusinessUnits: (units) => set({ availableBusinessUnits: units }),
      clearBusinessUnit: () => set({ currentBusinessUnit: null, availableBusinessUnits: [] }),
    }),
    {
      name: 'business-unit-storage',
    }
  )
);
```

### 3.2 Create Supabase Client Wrapper with BU Context
**File:** `src/lib/supabase/client-with-bu.ts`

```typescript
import { createClient } from '@/lib/supabase/client';
import { useBusinessUnitStore } from '@/stores/businessUnitStore';

export function createClientWithBU() {
  const supabase = createClient();
  const { currentBusinessUnit } = useBusinessUnitStore.getState();

  // Set business unit context for all queries
  if (currentBusinessUnit) {
    supabase.rpc('set_business_unit_context', {
      bu_id: currentBusinessUnit.id
    });
  }

  return supabase;
}
```

### 3.3 Create Database Function for Setting Context
**File:** `supabase/migrations/YYYYMMDD_add_bu_context_function.sql`

```sql
CREATE OR REPLACE FUNCTION set_business_unit_context(bu_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify user has access to this BU
  IF NOT EXISTS (
    SELECT 1 FROM user_business_unit_access
    WHERE user_id = auth.uid()
    AND business_unit_id = bu_id
  ) THEN
    RAISE EXCEPTION 'User does not have access to business unit %', bu_id;
  END IF;

  -- Set the context
  PERFORM set_config('app.current_business_unit_id', bu_id::text, false);
END;
$$;
```

### 3.4 Create API Route for BU Operations
**File:** `src/app/api/business-units/route.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/business-units - Get user's accessible business units
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get business units user has access to
  const { data, error } = await supabase
    .from('user_business_unit_access')
    .select(`
      business_unit_id,
      role,
      is_default,
      business_units (
        id,
        code,
        name,
        type,
        is_active
      )
    `)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
```

---

## Phase 4: Frontend Components

### 4.1 Business Unit Switcher Component
**File:** `src/components/business-unit/BusinessUnitSwitcher.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useBusinessUnitStore } from '@/stores/businessUnitStore';
import { cn } from '@/lib/utils';

export function BusinessUnitSwitcher() {
  const [open, setOpen] = useState(false);
  const { currentBusinessUnit, availableBusinessUnits, setCurrentBusinessUnit } =
    useBusinessUnitStore();

  const handleSelect = async (unitId: string) => {
    const selected = availableBusinessUnits.find(bu => bu.id === unitId);
    if (selected) {
      setCurrentBusinessUnit(selected);
      setOpen(false);
      // Trigger page reload to refresh data
      window.location.reload();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          {currentBusinessUnit?.name || "Select business unit"}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandEmpty>No business unit found.</CommandEmpty>
          <CommandGroup>
            {availableBusinessUnits.map((unit) => (
              <CommandItem
                key={unit.id}
                value={unit.id}
                onSelect={handleSelect}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    currentBusinessUnit?.id === unit.id ? "opacity-100" : "opacity-0"
                  )}
                />
                {unit.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

### 4.2 Business Unit Provider
**File:** `src/components/business-unit/BusinessUnitProvider.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useBusinessUnitStore } from '@/stores/businessUnitStore';
import { createClient } from '@/lib/supabase/client';

export function BusinessUnitProvider({ children }: { children: React.ReactNode }) {
  const { setCurrentBusinessUnit, setAvailableBusinessUnits, currentBusinessUnit } =
    useBusinessUnitStore();

  useEffect(() => {
    async function loadBusinessUnits() {
      const supabase = createClient();

      // Fetch user's accessible business units
      const { data } = await supabase
        .from('user_business_unit_access')
        .select(`
          is_default,
          business_units (
            id,
            code,
            name,
            type,
            is_active
          )
        `)
        .eq('is_active', true);

      if (data && data.length > 0) {
        const units = data.map(d => d.business_units).filter(Boolean);
        setAvailableBusinessUnits(units);

        // Auto-select default BU if not already set
        if (!currentBusinessUnit) {
          const defaultUnit = data.find(d => d.is_default)?.business_units;
          if (defaultUnit) {
            setCurrentBusinessUnit(defaultUnit);
          }
        }
      }
    }

    loadBusinessUnits();
  }, []);

  return <>{children}</>;
}
```

### 4.3 Update Layout to Include BU Switcher
**File:** `src/components/layout/Sidebar.tsx`

Add Business Unit Switcher to the sidebar header:

```typescript
import { BusinessUnitSwitcher } from '@/components/business-unit/BusinessUnitSwitcher';

// Inside Sidebar component
<div className="px-3 py-2">
  <BusinessUnitSwitcher />
</div>
```

---

## Phase 5: Update Existing APIs

### 5.1 Update All API Routes to Include BU Context
**Pattern for all routes:**

```typescript
// Before
const { data } = await supabase
  .from('sales_orders')
  .select('*')
  .eq('company_id', companyId);

// After
const { currentBusinessUnit } = useBusinessUnitStore.getState();
if (!currentBusinessUnit) {
  return NextResponse.json({ error: 'No business unit selected' }, { status: 400 });
}

// Set BU context
await supabase.rpc('set_business_unit_context', {
  bu_id: currentBusinessUnit.id
});

// RLS will automatically filter by BU
const { data } = await supabase
  .from('sales_orders')
  .select('*')
  .eq('company_id', companyId);
```

### 5.2 Update All Forms to Include business_unit_id
**Pattern for all create/update operations:**

```typescript
// Add business_unit_id to insert/update data
const { currentBusinessUnit } = useBusinessUnitStore.getState();

await supabase.from('sales_orders').insert({
  ...formData,
  business_unit_id: currentBusinessUnit.id,
  company_id: companyId,
});
```

---

## Phase 6: Testing & Validation

### 6.1 RLS Validation Queries
```sql
-- Test 1: Verify BU context isolation
SET app.current_business_unit_id = '<bu-1-id>';
SELECT count(*) FROM sales_orders; -- Should show BU1 data only

SET app.current_business_unit_id = '<bu-2-id>';
SELECT count(*) FROM sales_orders; -- Should show BU2 data only

-- Test 2: Verify no data leakage
RESET app.current_business_unit_id;
SELECT count(*) FROM sales_orders; -- Should return 0 rows

-- Test 3: Verify cross-BU write protection
SET app.current_business_unit_id = '<bu-1-id>';
INSERT INTO sales_orders (business_unit_id, ...)
VALUES ('<bu-2-id>', ...); -- Should FAIL
```

### 6.2 Integration Tests
- User can only see assigned BUs
- Default BU auto-selected on login
- Switching BU refreshes data
- No cross-BU data access
- Existing workflows still work

---

## Success Criteria (Per PRD)

✅ Zero cross-BU data leaks
✅ No regressions in existing functionality
✅ Users can operate multiple BUs seamlessly
✅ RLS enforces isolation
✅ No application logic bypasses RLS
✅ Backward compatibility maintained

---

## Rollback Plan

```sql
-- Disable RLS
ALTER TABLE sales_quotations DISABLE ROW LEVEL SECURITY;
-- Repeat for all tables

-- Drop policies
DROP POLICY IF EXISTS bu_select_policy ON sales_quotations;
-- Repeat for all policies

-- Remove columns
ALTER TABLE sales_quotations DROP COLUMN business_unit_id;
-- Repeat for all tables

-- Drop tables
DROP TABLE user_business_unit_access;
DROP TABLE business_units;
```
