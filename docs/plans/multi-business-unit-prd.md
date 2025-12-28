# Product Requirements Document (PRD)
## Multi–Business Unit Support

---

## 1. Overview

### Feature Name
Multi–Business Unit Support

### Product
Existing ERP System

### Company Model
Single Company operating multiple Business Units (BU)

### Business Unit Examples
- Branch
- Outlet
- Warehouse
- Shop
- Office

### Purpose
Enable a single company to operate multiple business units with strict data isolation, controlled user access, and seamless context switching, without breaking existing system behavior.

---

## 2. Problem Statement

The current ERP assumes a single operational unit. As companies grow, they operate multiple branches, outlets, and warehouses that require:

- Isolated operational data
- User access control per business unit
- Ability to switch operational context without re-authentication
- Zero data leakage between units
- Preservation of existing workflows and reports

---

## 3. Goals & Objectives

### Goals
- Introduce business unit abstraction
- Enforce strict data isolation per business unit
- Allow users to access only authorized business units
- Maintain backward compatibility

### Objectives
- Implement BU isolation at database level using RLS
- Provide UI mechanism to switch active BU
- Support multiple BUs under a single company
- Avoid breaking existing APIs and reports

---

## 4. Non-Goals

- Multi-company support
- Multi-tenant architecture
- Cross-company data sharing
- Hierarchical BU relationships (phase 1)

---

## 5. Stakeholders

- Business Owners
- Operations Managers
- ERP Administrators
- Developers
- End Users

---

## 6. Functional Requirements

### 6.1 Business Unit Management
- System must support multiple business units under one company
- Each business unit has:
  - Code
  - Name
  - Type (branch, outlet, warehouse, etc.)
  - Active status

### 6.2 User Access Control
- Users may be assigned to one or more business units
- Users can only see business units they are assigned to
- Each user has exactly one default business unit

### 6.3 Data Isolation
- All transactional and operational data must be scoped to a business unit
- Business units must not see each other’s data

### 6.4 Business Unit Switching
- Users can switch business units without logging out
- Switching updates the data context globally

---

## 7. Security Requirements

- Row Level Security (RLS) must enforce BU isolation
- No application logic may bypass RLS
- Unauthorized BU access attempts must be blocked and logged

---

## 8. User Experience Requirements

- Global Business Unit selector
- Only authorized BUs are shown
- Default BU auto-selected at login
- Switching BU refreshes visible data

---

## 9. Success Metrics

- Zero cross-BU data leaks
- No regressions in existing functionality
- Users can operate multiple BUs seamlessly

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|----|----|
| Data leakage | Enforce RLS |
| Breaking changes | Default BU + backfill |
| User confusion | Clear BU switcher |

---

## 11. Assumptions

- Single company context already exists
- RLS is supported by the database
- Existing data belongs to one default business unit

# Database Migration Specification
## Multi–Business Unit Support

---

## 1. Objectives

- Introduce Business Unit (BU) as a first-class entity
- Preserve existing system behavior
- Enable strict data isolation using RLS
- Avoid breaking existing APIs and workflows

---

## 2. New Tables

### 2.1 business_units

```sql
CREATE TABLE business_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  code varchar NOT NULL,
  name varchar NOT NULL,
  type varchar,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
```
### 2.2 user_business_unit_access
```sql
CREATE TABLE user_business_unit_access (
  user_id uuid NOT NULL,
  business_unit_id uuid NOT NULL,
  role varchar,
  is_default boolean DEFAULT false,
  PRIMARY KEY (user_id, business_unit_id)
);
```
## 3. Existing Table Extension
### 3.1 Operational Tables
```sql
ALTER TABLE sales ADD COLUMN business_unit_id uuid;
ALTER TABLE inventory ADD COLUMN business_unit_id uuid;
ALTER TABLE purchases ADD COLUMN business_unit_id uuid;
ALTER TABLE stock_transactions ADD COLUMN business_unit_id uuid;
```
NOTE: Columns must be nullable during phase 1.

## 4. Default Business Unit
```sql
INSERT INTO business_units (id, company_id, code, name, type)
VALUES (
  gen_random_uuid(),
  '<company_id>',
  'DEFAULT',
  'Main Business Unit',
  'primary'
);
```
## 5. Backfill Existing Data
```sql
UPDATE sales
SET business_unit_id = '<default_bu_id>'
WHERE business_unit_id IS NULL;

UPDATE inventory
SET business_unit_id = '<default_bu_id>'
WHERE business_unit_id IS NULL;

UPDATE purchases
SET business_unit_id = '<default_bu_id>'
WHERE business_unit_id IS NULL;

UPDATE stock_transactions
SET business_unit_id = '<default_bu_id>'
WHERE business_unit_id IS NULL;
```

## 6. Enforce NOT NULL (Phase 2)
```sql
ALTER TABLE sales ALTER COLUMN business_unit_id SET NOT NULL;
ALTER TABLE inventory ALTER COLUMN business_unit_id SET NOT NULL;
ALTER TABLE purchases ALTER COLUMN business_unit_id SET NOT NULL;
ALTER TABLE stock_transactions ALTER COLUMN business_unit_id SET NOT NULL;

```
## 7. Indexing (Required for RLS Performance)
```sql
CREATE INDEX idx_sales_bu ON sales(business_unit_id);
CREATE INDEX idx_inventory_bu ON inventory(business_unit_id);
CREATE INDEX idx_purchases_bu ON purchases(business_unit_id);
CREATE INDEX idx_stock_tx_bu ON stock_transactions(business_unit_id);

```
## Rollback Strategy
```sql
ALTER TABLE sales DROP COLUMN business_unit_id;
ALTER TABLE inventory DROP COLUMN business_unit_id;
ALTER TABLE purchases DROP COLUMN business_unit_id;
ALTER TABLE stock_transactions DROP COLUMN business_unit_id;

DROP TABLE user_business_unit_access;
DROP TABLE business_units;

```


---

# 📄 Row Level Security (RLS) Policies – All Modules

```md
# Row Level Security (RLS) Policies
## Multi–Business Unit Isolation

---

## 1. Principles

- Business Unit is the isolation boundary
- RLS is the only enforcement mechanism
- No application-layer filtering allowed
- All data access must respect active BU context

---

## 2. Session Context Requirement

The application MUST set the active business unit per request:

```sql
SET app.current_business_unit_id = '<business_unit_uuid>';
```
If not set, all queries must return zero rows.
## 3.Enable RLS
```sql
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;

```
## 4. Select Policy (Read Isolation)
```sql
CREATE POLICY bu_select_policy
ON sales
FOR SELECT
USING (
  business_unit_id = current_setting('app.current_business_unit_id', true)::uuid
);
```
## 5. Insert Policy (Write Protection)
```sql
CREATE POLICY bu_insert_policy
ON sales
FOR INSERT
WITH CHECK (
  business_unit_id = current_setting('app.current_business_unit_id', true)::uuid
);
```
## 6. Update Policy
```sql
CREATE POLICY bu_update_policy
ON sales
FOR UPDATE
USING (
  business_unit_id = current_setting('app.current_business_unit_id', true)::uuid
)
WITH CHECK (
  business_unit_id = current_setting('app.current_business_unit_id', true)::uuid
);
```
## 7. Delete Policy
```sql
CREATE POLICY bu_delete_policy
ON sales
FOR DELETE
USING (
  business_unit_id = current_setting('app.current_business_unit_id', true)::uuid
);
```
## 8. Apply Policies to All Modules

Repeat Sections 4–7 for:
- inventory
- purchases
- stock_transactions
- sales_returns (if exists)
- adjustments (if exists)
- transfers (if exists)

## 9. Prevent Cross-BU Updates

Explicitly block moving records across BUs:
```sql
ALTER TABLE sales
ADD CONSTRAINT prevent_bu_change
CHECK (
  business_unit_id = current_setting('app.current_business_unit_id', true)::uuid
);
```
## 10. Validation Queries
```sql
-- Should return rows
SET app.current_business_unit_id = '<valid_bu>';

SELECT * FROM sales;

-- Should return zero rows
SET app.current_business_unit_id = '<unauthorized_bu>';

SELECT * FROM sales;
```
## 11. Failure Modes
Scenario	Result
Missing BU context	Zero rows
Wrong BU	Access denied
Cross-BU write	Rejected
| Scenario | Result |
|----------|----------|
| Missing BU context  | Zero rows  |
| Wrong BU  | Access denied  | 
| Cross-BU  | Rejected |

## 12. Notes

- RLS must be tested per role
- RLS policies must exist before enabling NOT NULL constraints
- All future tables must include business_unit_id
