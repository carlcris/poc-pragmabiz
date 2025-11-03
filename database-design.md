# DATABASE DESIGN

**System:** Sales & Inventory System (ERP-Ready)<br>
**Version:** v1.0<br>
**Database Type:** PostgreSQL (required for RLS support)<br>
**Design Pattern:** Domain-Driven Design with CQRS-ready structure<br>
**Security Model:** Row Level Security (RLS) enabled

## 1. DESIGN PRINCIPLES

### Core Principles

- **Multi-tenancy Ready:** All business entities include `company_id` for future multi-company support
- **Row Level Security (RLS):** Database-level security policies enforce data isolation by company and role
- **Audit Trail:** All tables include standard audit fields (created_at, created_by, updated_at, updated_by, deleted_at)
- **Soft Deletes:** Use `deleted_at` timestamp for soft deletion pattern
- **UUID Primary Keys:** Use UUIDs for distributed system compatibility
- **Normalized Design:** 3NF normalization with selective denormalization for performance
- **Extensibility:** Support for custom fields via JSONB columns

### Standard Fields (All Tables)

```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
company_id        UUID NOT NULL REFERENCES companies(id)
created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
created_by        UUID NOT NULL REFERENCES users(id)
updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
updated_by        UUID NOT NULL REFERENCES users(id)
deleted_at        TIMESTAMP NULL
version           INTEGER NOT NULL DEFAULT 1  -- Optimistic locking
custom_fields     JSONB NULL                 -- Extensibility
```

## 2. ROW LEVEL SECURITY (RLS) IMPLEMENTATION

### 2.1 RLS Overview

Row Level Security (RLS) provides database-level security that ensures:
- **Multi-tenant Data Isolation:** Users can only access data from their own company
- **Role-Based Access Control:** Fine-grained permissions based on user roles
- **Defense in Depth:** Security at the database layer, independent of application code
- **Audit Compliance:** Guaranteed data separation for compliance requirements

### 2.2 Session Context Functions

These functions set and retrieve the current user and company context.

```sql
-- Create schema for security functions
CREATE SCHEMA IF NOT EXISTS security;

-- Function to set current user context
CREATE OR REPLACE FUNCTION security.set_current_user(user_uuid UUID, company_uuid UUID)
RETURNS void AS $$
BEGIN
    -- Set session variables for RLS policies
    PERFORM set_config('app.current_user_id', user_uuid::text, false);
    PERFORM set_config('app.current_company_id', company_uuid::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current user ID
CREATE OR REPLACE FUNCTION security.current_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get current company ID
CREATE OR REPLACE FUNCTION security.current_company_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_company_id', true), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if user has specific role
CREATE OR REPLACE FUNCTION security.has_role(role_code VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = security.current_user_id()
          AND r.code = role_code
          AND r.deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION security.has_permission(module VARCHAR, permission VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = security.current_user_id()
          AND r.permissions->module ? permission
          AND r.deleted_at IS NULL
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION security.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN security.has_role('admin');
END;
$$ LANGUAGE plpgsql STABLE;
```

### 2.3 RLS Policy Templates

#### Company Isolation Policy (applies to all business tables)

```sql
-- Template for SELECT policy (company isolation)
CREATE POLICY company_isolation_select ON {table_name}
    FOR SELECT
    USING (
        company_id = security.current_company_id()
    );

-- Template for INSERT policy
CREATE POLICY company_isolation_insert ON {table_name}
    FOR INSERT
    WITH CHECK (
        company_id = security.current_company_id()
    );

-- Template for UPDATE policy
CREATE POLICY company_isolation_update ON {table_name}
    FOR UPDATE
    USING (
        company_id = security.current_company_id()
    )
    WITH CHECK (
        company_id = security.current_company_id()
    );

-- Template for DELETE policy
CREATE POLICY company_isolation_delete ON {table_name}
    FOR DELETE
    USING (
        company_id = security.current_company_id()
    );
```

#### Role-Based Policy Examples

```sql
-- Example: Only inventory officers can modify stock transactions
CREATE POLICY inventory_officer_only ON stock_transactions
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('inventory', 'write')
        )
    );

-- Example: Sales officers can only see their own quotations
CREATE POLICY sales_officer_own_quotations ON sales_quotations
    FOR SELECT
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR created_by = security.current_user_id()
            OR security.has_permission('sales', 'read_all')
        )
    );
```

### 2.4 Enable RLS on All Tables

```sql
-- Master Data Tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Inventory Domain Tables
ALTER TABLE item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_warehouse ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_of_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE bom_items ENABLE ROW LEVEL SECURITY;

-- Sales Domain Tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_return_items ENABLE ROW LEVEL SECURITY;

-- Cross-Cutting Tables
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE number_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_attachments ENABLE ROW LEVEL SECURITY;
```

### 2.5 Complete RLS Policies

#### Companies Table

```sql
-- Companies: Users can only see their own company
CREATE POLICY companies_select ON companies
    FOR SELECT
    USING (id = security.current_company_id());

-- Only system admin can modify companies (handled at application level)
CREATE POLICY companies_admin_only ON companies
    FOR ALL
    USING (false)  -- No direct DB modifications allowed
    WITH CHECK (false);
```

#### Users Table

```sql
-- Users can see users from their company
CREATE POLICY users_company_select ON users
    FOR SELECT
    USING (company_id = security.current_company_id());

-- Only admins can insert/update/delete users
CREATE POLICY users_admin_only ON users
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND security.is_admin()
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND security.is_admin()
    );
```

#### Roles Table

```sql
-- All users can see roles in their company
CREATE POLICY roles_company_select ON roles
    FOR SELECT
    USING (company_id = security.current_company_id());

-- Only admins can modify non-system roles
CREATE POLICY roles_admin_only ON roles
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND security.is_admin()
        AND is_system = false
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND security.is_admin()
        AND is_system = false
    );
```

#### Inventory Domain Policies

```sql
-- Items: Read access for all, write for inventory officers and admins
CREATE POLICY items_select ON items
    FOR SELECT
    USING (company_id = security.current_company_id());

CREATE POLICY items_modify ON items
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('inventory', 'write')
        )
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('inventory', 'write')
        )
    );

-- Item Categories: Same as items
CREATE POLICY item_categories_select ON item_categories
    FOR SELECT
    USING (company_id = security.current_company_id());

CREATE POLICY item_categories_modify ON item_categories
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('inventory', 'write')
        )
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('inventory', 'write')
        )
    );

-- Warehouses: Read all, modify for inventory officers
CREATE POLICY warehouses_select ON warehouses
    FOR SELECT
    USING (company_id = security.current_company_id());

CREATE POLICY warehouses_modify ON warehouses
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('inventory', 'write')
        )
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('inventory', 'write')
        )
    );

-- Stock Transactions: Read all, write for inventory officers
CREATE POLICY stock_transactions_select ON stock_transactions
    FOR SELECT
    USING (company_id = security.current_company_id());

CREATE POLICY stock_transactions_modify ON stock_transactions
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('inventory', 'write')
        )
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('inventory', 'write')
        )
    );

-- Stock Ledger: Read-only for all, no modifications (immutable)
CREATE POLICY stock_ledger_select ON stock_ledger
    FOR SELECT
    USING (company_id = security.current_company_id());

CREATE POLICY stock_ledger_insert_only ON stock_ledger
    FOR INSERT
    WITH CHECK (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('inventory', 'write')
        )
    );

-- Prevent updates and deletes on stock ledger (immutable audit trail)
CREATE POLICY stock_ledger_no_modify ON stock_ledger
    FOR UPDATE
    USING (false);

CREATE POLICY stock_ledger_no_delete ON stock_ledger
    FOR DELETE
    USING (false);
```

#### Sales Domain Policies

```sql
-- Customers: Read all, write for sales officers
CREATE POLICY customers_select ON customers
    FOR SELECT
    USING (company_id = security.current_company_id());

CREATE POLICY customers_modify ON customers
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('sales', 'write')
        )
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('sales', 'write')
        )
    );

-- Sales Quotations: Read all or own, write for sales officers
CREATE POLICY sales_quotations_select ON sales_quotations
    FOR SELECT
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('sales', 'read_all')
            OR created_by = security.current_user_id()
        )
    );

CREATE POLICY sales_quotations_modify ON sales_quotations
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('sales', 'write')
        )
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('sales', 'write')
        )
    );

-- Sales Orders: Read all, write for sales officers
CREATE POLICY sales_orders_select ON sales_orders
    FOR SELECT
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('sales', 'read')
            OR security.has_permission('inventory', 'read')
        )
    );

CREATE POLICY sales_orders_modify ON sales_orders
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('sales', 'write')
        )
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('sales', 'write')
        )
    );

-- Sales Invoices: Read for sales and accounting, write for sales officers
CREATE POLICY sales_invoices_select ON sales_invoices
    FOR SELECT
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('sales', 'read')
            OR security.has_permission('accounting', 'read')
        )
    );

CREATE POLICY sales_invoices_modify ON sales_invoices
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('sales', 'write')
        )
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('sales', 'write')
        )
    );

-- Payment Collections: Read for sales/accounting, write for sales officers
CREATE POLICY payment_collections_select ON payment_collections
    FOR SELECT
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('sales', 'read')
            OR security.has_permission('accounting', 'read')
        )
    );

CREATE POLICY payment_collections_modify ON payment_collections
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('sales', 'write')
            OR security.has_permission('accounting', 'write')
        )
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_permission('sales', 'write')
            OR security.has_permission('accounting', 'write')
        )
    );
```

#### Cross-Cutting Tables Policies

```sql
-- Audit Logs: Read-only for admins and auditors
CREATE POLICY audit_logs_select ON audit_logs
    FOR SELECT
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_role('auditor')
        )
    );

-- Audit logs are insert-only (no updates or deletes)
CREATE POLICY audit_logs_insert_only ON audit_logs
    FOR INSERT
    WITH CHECK (company_id = security.current_company_id());

CREATE POLICY audit_logs_no_modify ON audit_logs
    FOR UPDATE
    USING (false);

CREATE POLICY audit_logs_no_delete ON audit_logs
    FOR DELETE
    USING (false);

-- Notifications: Users can only see their own notifications
CREATE POLICY notifications_select ON notifications
    FOR SELECT
    USING (
        company_id = security.current_company_id()
        AND (
            user_id = security.current_user_id()
            OR user_id IS NULL  -- System-wide notifications
        )
    );

CREATE POLICY notifications_update_own ON notifications
    FOR UPDATE
    USING (
        company_id = security.current_company_id()
        AND user_id = security.current_user_id()
    );

-- Number Series: Read all, modify for admins only
CREATE POLICY number_series_select ON number_series
    FOR SELECT
    USING (company_id = security.current_company_id());

CREATE POLICY number_series_admin_only ON number_series
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND security.is_admin()
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND security.is_admin()
    );
```

### 2.6 Application Database User Setup

```sql
-- Create application database user (used by the application)
CREATE USER erp_app WITH PASSWORD 'secure_password_here';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE erp_db TO erp_app;
GRANT USAGE ON SCHEMA public TO erp_app;
GRANT USAGE ON SCHEMA security TO erp_app;

-- Grant table permissions (RLS will further restrict access)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO erp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO erp_app;

-- Grant execute on security functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA security TO erp_app;

-- Ensure RLS is enforced even for table owners
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
-- ... apply FORCE to all other tables
```

### 2.7 Usage Example in Application

```go
// Example in Go application
func (s *Service) SetUserContext(ctx context.Context, userID, companyID uuid.UUID) error {
    query := `SELECT security.set_current_user($1, $2)`
    _, err := s.db.ExecContext(ctx, query, userID, companyID)
    return err
}

// Every database connection should set context after authentication
func (s *Service) authenticateAndSetContext(ctx context.Context, username, password string) error {
    // Authenticate user
    user, err := s.authenticateUser(username, password)
    if err != nil {
        return err
    }

    // Set RLS context for this session/transaction
    if err := s.SetUserContext(ctx, user.ID, user.CompanyID); err != nil {
        return err
    }

    return nil
}
```

### 2.8 Testing RLS Policies

```sql
-- Test script to verify RLS is working
DO $$
DECLARE
    test_company_id UUID;
    test_user_id UUID;
    other_company_id UUID;
BEGIN
    -- Setup test data
    INSERT INTO companies (id, code, name)
    VALUES (gen_random_uuid(), 'TEST1', 'Test Company 1')
    RETURNING id INTO test_company_id;

    INSERT INTO companies (id, code, name)
    VALUES (gen_random_uuid(), 'TEST2', 'Test Company 2')
    RETURNING id INTO other_company_id;

    INSERT INTO users (id, company_id, username, email, password_hash)
    VALUES (gen_random_uuid(), test_company_id, 'testuser', 'test@example.com', 'hash')
    RETURNING id INTO test_user_id;

    -- Set context
    PERFORM security.set_current_user(test_user_id, test_company_id);

    -- Test: Should see only test_company_id data
    ASSERT (SELECT COUNT(*) FROM companies) = 1, 'RLS failed: Should see only own company';

    -- Test: Cannot access other company data
    ASSERT (SELECT COUNT(*) FROM companies WHERE id = other_company_id) = 0,
           'RLS failed: Should not see other company data';

    RAISE NOTICE 'All RLS tests passed!';

    -- Cleanup
    ROLLBACK;
END $$;
```

### 2.9 RLS Performance Considerations

- **Index on company_id:** Ensure all tables with `company_id` have indexes for efficient RLS filtering
- **Policy Complexity:** Keep RLS policies simple; complex permission logic should be in application layer
- **Connection Pooling:** Set user context at transaction start when using connection pools
- **Monitoring:** Log RLS policy execution time and optimize slow policies
- **Bypass for Backups:** Use dedicated superuser for backups to bypass RLS

### 2.10 Security Best Practices

1. **Always set context:** Application must call `security.set_current_user()` after authentication
2. **Use prepared statements:** Prevent SQL injection alongside RLS
3. **Audit RLS changes:** Track all RLS policy modifications
4. **Regular reviews:** Periodically review and test RLS policies
5. **Least privilege:** Grant minimal permissions; rely on RLS for fine-grained control
6. **Force RLS:** Use `FORCE ROW LEVEL SECURITY` to ensure policies apply even to table owners
7. **Test coverage:** Include RLS tests in integration test suite

## 3. MASTER DATA TABLES

### 3.1 Companies

Multi-company support for future ERP expansion.

```sql
CREATE TABLE companies (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code              VARCHAR(20) UNIQUE NOT NULL,
    name              VARCHAR(200) NOT NULL,
    legal_name        VARCHAR(200),
    tax_id            VARCHAR(50),
    email             VARCHAR(100),
    phone             VARCHAR(50),
    address_line1     VARCHAR(200),
    address_line2     VARCHAR(200),
    city              VARCHAR(100),
    state             VARCHAR(100),
    country           VARCHAR(100),
    postal_code       VARCHAR(20),
    currency_code     VARCHAR(3) DEFAULT 'USD',
    is_active         BOOLEAN DEFAULT true,
    settings          JSONB,  -- Company-specific settings
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_companies_code ON companies(code) WHERE deleted_at IS NULL;
CREATE INDEX idx_companies_active ON companies(is_active) WHERE deleted_at IS NULL;
```

### 3.2 Users

User authentication and authorization.

```sql
CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    username          VARCHAR(50) UNIQUE NOT NULL,
    email             VARCHAR(100) UNIQUE NOT NULL,
    password_hash     VARCHAR(255) NOT NULL,
    first_name        VARCHAR(100),
    last_name         VARCHAR(100),
    phone             VARCHAR(50),
    is_active         BOOLEAN DEFAULT true,
    last_login_at     TIMESTAMP,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_users_company ON users(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_username ON users(username) WHERE deleted_at IS NULL;
```

### 3.3 Roles

Role-based access control.

```sql
CREATE TABLE roles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    code              VARCHAR(50) NOT NULL,
    name              VARCHAR(100) NOT NULL,
    description       TEXT,
    is_system         BOOLEAN DEFAULT false,  -- System roles cannot be deleted
    permissions       JSONB NOT NULL,         -- {"inventory": ["read", "write"], "sales": ["read"]}
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMP NULL,
    UNIQUE(company_id, code)
);

CREATE INDEX idx_roles_company ON roles(company_id) WHERE deleted_at IS NULL;
```

### 3.4 User Roles

Many-to-many relationship between users and roles.

```sql
CREATE TABLE user_roles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id),
    role_id           UUID NOT NULL REFERENCES roles(id),
    assigned_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by       UUID NOT NULL REFERENCES users(id),
    UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
```

## 4. INVENTORY DOMAIN

### 4.1 Item Categories

Hierarchical categorization of items.

```sql
CREATE TABLE item_categories (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    parent_id         UUID REFERENCES item_categories(id),
    code              VARCHAR(50) NOT NULL,
    name              VARCHAR(200) NOT NULL,
    description       TEXT,
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, code)
);

CREATE INDEX idx_item_categories_company ON item_categories(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_categories_parent ON item_categories(parent_id) WHERE deleted_at IS NULL;
```

### 4.2 Units of Measure

Standard and custom units of measure.

```sql
CREATE TABLE units_of_measure (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    code              VARCHAR(20) NOT NULL,
    name              VARCHAR(100) NOT NULL,
    symbol            VARCHAR(10),
    unit_type         VARCHAR(50),  -- 'weight', 'volume', 'length', 'quantity', etc.
    is_base_unit      BOOLEAN DEFAULT false,
    base_unit_id      UUID REFERENCES units_of_measure(id),
    conversion_factor DECIMAL(20, 6),  -- Factor to convert to base unit
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at        TIMESTAMP NULL,
    UNIQUE(company_id, code)
);

CREATE INDEX idx_uom_company ON units_of_measure(company_id) WHERE deleted_at IS NULL;
```

### 3.3 Items (Item Master)

Central repository for all items/products.

```sql
CREATE TABLE items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    item_code         VARCHAR(100) NOT NULL,
    item_name         VARCHAR(200) NOT NULL,
    description       TEXT,
    category_id       UUID REFERENCES item_categories(id),
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    item_type         VARCHAR(50) NOT NULL,  -- 'raw_material', 'finished_good', 'service', 'asset'

    -- Pricing
    purchase_price    DECIMAL(20, 4),
    sales_price       DECIMAL(20, 4),
    cost_price        DECIMAL(20, 4),

    -- Inventory control
    is_stock_item     BOOLEAN DEFAULT true,
    allow_negative    BOOLEAN DEFAULT false,

    -- Tracking
    track_batch       BOOLEAN DEFAULT false,
    track_serial      BOOLEAN DEFAULT false,
    has_expiry        BOOLEAN DEFAULT false,

    -- Status
    is_active         BOOLEAN DEFAULT true,
    is_purchasable    BOOLEAN DEFAULT true,
    is_saleable       BOOLEAN DEFAULT true,

    -- Dimensions (optional)
    weight            DECIMAL(10, 4),
    length            DECIMAL(10, 4),
    width             DECIMAL(10, 4),
    height            DECIMAL(10, 4),

    -- Images and attachments
    image_url         VARCHAR(500),

    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, item_code)
);

CREATE INDEX idx_items_company ON items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_items_category ON items(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_items_code ON items(item_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_items_name ON items(item_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_items_type ON items(item_type) WHERE deleted_at IS NULL;
```

### 3.4 Warehouses

Physical or logical storage locations.

```sql
CREATE TABLE warehouses (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    warehouse_code    VARCHAR(50) NOT NULL,
    warehouse_name    VARCHAR(200) NOT NULL,
    warehouse_type    VARCHAR(50),  -- 'main', 'transit', 'retail', 'virtual'
    address_line1     VARCHAR(200),
    address_line2     VARCHAR(200),
    city              VARCHAR(100),
    state             VARCHAR(100),
    country           VARCHAR(100),
    postal_code       VARCHAR(20),
    contact_person    VARCHAR(100),
    phone             VARCHAR(50),
    email             VARCHAR(100),
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, warehouse_code)
);

CREATE INDEX idx_warehouses_company ON warehouses(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_warehouses_code ON warehouses(warehouse_code) WHERE deleted_at IS NULL;
```

### 3.5 Item Warehouse

Link items to warehouses with reorder levels.

```sql
CREATE TABLE item_warehouse (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    item_id           UUID NOT NULL REFERENCES items(id),
    warehouse_id      UUID NOT NULL REFERENCES warehouses(id),
    reorder_level     DECIMAL(20, 4) DEFAULT 0,
    reorder_quantity  DECIMAL(20, 4) DEFAULT 0,
    max_quantity      DECIMAL(20, 4),
    current_stock     DECIMAL(20, 4) DEFAULT 0,  -- Denormalized for performance
    reserved_stock    DECIMAL(20, 4) DEFAULT 0,  -- Reserved for orders
    available_stock   DECIMAL(20, 4) GENERATED ALWAYS AS (current_stock - reserved_stock) STORED,
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    UNIQUE(company_id, item_id, warehouse_id)
);

CREATE INDEX idx_item_warehouse_company ON item_warehouse(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_warehouse_item ON item_warehouse(item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_warehouse_warehouse ON item_warehouse(warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_item_warehouse_reorder ON item_warehouse(item_id, warehouse_id)
    WHERE current_stock <= reorder_level AND deleted_at IS NULL;
```

### 3.6 Stock Transactions

All stock movements (in, out, transfer, adjustment).

```sql
CREATE TABLE stock_transactions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    transaction_code  VARCHAR(100) NOT NULL,
    transaction_date  DATE NOT NULL,
    transaction_type  VARCHAR(50) NOT NULL,  -- 'in', 'out', 'transfer', 'adjustment'
    reference_type    VARCHAR(50),  -- 'purchase', 'sales', 'adjustment', 'return'
    reference_id      UUID,  -- ID of related document (PO, SO, etc.)
    warehouse_id      UUID NOT NULL REFERENCES warehouses(id),
    to_warehouse_id   UUID REFERENCES warehouses(id),  -- For transfers
    status            VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'posted', 'cancelled'
    notes             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, transaction_code)
);

CREATE INDEX idx_stock_trans_company ON stock_transactions(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_trans_code ON stock_transactions(transaction_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_trans_date ON stock_transactions(transaction_date);
CREATE INDEX idx_stock_trans_warehouse ON stock_transactions(warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_trans_type ON stock_transactions(transaction_type);
CREATE INDEX idx_stock_trans_reference ON stock_transactions(reference_type, reference_id);
```

### 3.7 Stock Transaction Items

Line items for stock transactions.

```sql
CREATE TABLE stock_transaction_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    transaction_id    UUID NOT NULL REFERENCES stock_transactions(id),
    item_id           UUID NOT NULL REFERENCES items(id),
    quantity          DECIMAL(20, 4) NOT NULL,
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    unit_cost         DECIMAL(20, 4),
    total_cost        DECIMAL(20, 4),
    batch_no          VARCHAR(100),
    serial_no         VARCHAR(100),
    expiry_date       DATE,
    notes             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_stock_trans_items_company ON stock_transaction_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_trans_items_trans ON stock_transaction_items(transaction_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_trans_items_item ON stock_transaction_items(item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_trans_items_batch ON stock_transaction_items(batch_no) WHERE deleted_at IS NULL;
CREATE INDEX idx_stock_trans_items_serial ON stock_transaction_items(serial_no) WHERE deleted_at IS NULL;
```

### 3.8 Stock Ledger

Immutable ledger for all stock movements (event sourcing pattern).

```sql
CREATE TABLE stock_ledger (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    item_id           UUID NOT NULL REFERENCES items(id),
    warehouse_id      UUID NOT NULL REFERENCES warehouses(id),
    transaction_id    UUID NOT NULL REFERENCES stock_transactions(id),
    transaction_item_id UUID NOT NULL REFERENCES stock_transaction_items(id),
    posting_date      DATE NOT NULL,
    posting_time      TIME NOT NULL,
    voucher_type      VARCHAR(50) NOT NULL,
    voucher_no        VARCHAR(100) NOT NULL,
    actual_qty        DECIMAL(20, 4) NOT NULL,  -- +ve for in, -ve for out
    qty_after_trans   DECIMAL(20, 4) NOT NULL,  -- Running balance
    incoming_rate     DECIMAL(20, 4),
    valuation_rate    DECIMAL(20, 4),
    stock_value       DECIMAL(20, 4),
    stock_value_diff  DECIMAL(20, 4),
    batch_no          VARCHAR(100),
    serial_no         VARCHAR(100),
    is_cancelled      BOOLEAN DEFAULT false,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_ledger_company ON stock_ledger(company_id);
CREATE INDEX idx_stock_ledger_item_warehouse ON stock_ledger(item_id, warehouse_id);
CREATE INDEX idx_stock_ledger_posting_date ON stock_ledger(posting_date);
CREATE INDEX idx_stock_ledger_voucher ON stock_ledger(voucher_type, voucher_no);
CREATE INDEX idx_stock_ledger_batch ON stock_ledger(batch_no) WHERE batch_no IS NOT NULL;
CREATE INDEX idx_stock_ledger_serial ON stock_ledger(serial_no) WHERE serial_no IS NOT NULL;
```

### 3.9 Bill of Materials (BOM)

Recipe or assembly structure for items.

```sql
CREATE TABLE bill_of_materials (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    bom_code          VARCHAR(100) NOT NULL,
    item_id           UUID NOT NULL REFERENCES items(id),  -- Finished product
    quantity          DECIMAL(20, 4) DEFAULT 1,  -- Output quantity
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    is_active         BOOLEAN DEFAULT true,
    is_default        BOOLEAN DEFAULT false,
    description       TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, bom_code)
);

CREATE INDEX idx_bom_company ON bill_of_materials(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bom_item ON bill_of_materials(item_id) WHERE deleted_at IS NULL;
```

### 3.10 BOM Items

Components required for a BOM.

```sql
CREATE TABLE bom_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    bom_id            UUID NOT NULL REFERENCES bill_of_materials(id),
    item_id           UUID NOT NULL REFERENCES items(id),  -- Component
    quantity          DECIMAL(20, 4) NOT NULL,
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    scrap_percentage  DECIMAL(5, 2) DEFAULT 0,
    sort_order        INTEGER DEFAULT 0,
    notes             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_bom_items_company ON bom_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bom_items_bom ON bom_items(bom_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bom_items_item ON bom_items(item_id) WHERE deleted_at IS NULL;
```

## 5. SALES DOMAIN

### 5.1 Customers

Customer master data.

```sql
CREATE TABLE customers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    customer_code     VARCHAR(100) NOT NULL,
    customer_name     VARCHAR(200) NOT NULL,
    customer_type     VARCHAR(50),  -- 'individual', 'company', 'government'
    tax_id            VARCHAR(50),
    email             VARCHAR(100),
    phone             VARCHAR(50),
    website           VARCHAR(200),

    -- Billing address
    billing_address_line1  VARCHAR(200),
    billing_address_line2  VARCHAR(200),
    billing_city           VARCHAR(100),
    billing_state          VARCHAR(100),
    billing_country        VARCHAR(100),
    billing_postal_code    VARCHAR(20),

    -- Shipping address
    shipping_address_line1 VARCHAR(200),
    shipping_address_line2 VARCHAR(200),
    shipping_city          VARCHAR(100),
    shipping_state         VARCHAR(100),
    shipping_country       VARCHAR(100),
    shipping_postal_code   VARCHAR(20),

    -- Payment terms
    payment_terms     VARCHAR(50),  -- 'cash', 'net_30', 'net_60', etc.
    credit_limit      DECIMAL(20, 4) DEFAULT 0,
    credit_days       INTEGER DEFAULT 0,

    -- Contact person
    contact_person    VARCHAR(100),
    contact_phone     VARCHAR(50),
    contact_email     VARCHAR(100),

    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, customer_code)
);

CREATE INDEX idx_customers_company ON customers(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_code ON customers(customer_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_name ON customers(customer_name) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_email ON customers(email) WHERE deleted_at IS NULL;
```

### 4.2 Price Lists

Pricing strategies for different customer segments.

```sql
CREATE TABLE price_lists (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    price_list_code   VARCHAR(100) NOT NULL,
    price_list_name   VARCHAR(200) NOT NULL,
    currency_code     VARCHAR(3) DEFAULT 'USD',
    is_default        BOOLEAN DEFAULT false,
    valid_from        DATE,
    valid_to          DATE,
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, price_list_code)
);

CREATE INDEX idx_price_lists_company ON price_lists(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_price_lists_validity ON price_lists(valid_from, valid_to) WHERE deleted_at IS NULL;
```

### 4.3 Price List Items

Item-specific pricing.

```sql
CREATE TABLE price_list_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    price_list_id     UUID NOT NULL REFERENCES price_lists(id),
    item_id           UUID NOT NULL REFERENCES items(id),
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    rate              DECIMAL(20, 4) NOT NULL,
    valid_from        DATE,
    valid_to          DATE,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    UNIQUE(price_list_id, item_id, uom_id)
);

CREATE INDEX idx_price_list_items_company ON price_list_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_price_list_items_list ON price_list_items(price_list_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_price_list_items_item ON price_list_items(item_id) WHERE deleted_at IS NULL;
```

### 4.4 Customer Price Lists

Assign price lists to customers.

```sql
CREATE TABLE customer_price_lists (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id       UUID NOT NULL REFERENCES customers(id),
    price_list_id     UUID NOT NULL REFERENCES price_lists(id),
    is_default        BOOLEAN DEFAULT true,
    valid_from        DATE,
    valid_to          DATE,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    UNIQUE(customer_id, price_list_id)
);

CREATE INDEX idx_customer_price_lists_customer ON customer_price_lists(customer_id);
CREATE INDEX idx_customer_price_lists_price_list ON customer_price_lists(price_list_id);
```

### 4.5 Sales Quotations

Pre-sale offers to customers.

```sql
CREATE TABLE sales_quotations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    quotation_code    VARCHAR(100) NOT NULL,
    quotation_date    DATE NOT NULL,
    customer_id       UUID NOT NULL REFERENCES customers(id),
    valid_until       DATE,
    price_list_id     UUID REFERENCES price_lists(id),

    -- Amounts
    subtotal          DECIMAL(20, 4) DEFAULT 0,
    discount_amount   DECIMAL(20, 4) DEFAULT 0,
    tax_amount        DECIMAL(20, 4) DEFAULT 0,
    total_amount      DECIMAL(20, 4) DEFAULT 0,

    -- Status workflow
    status            VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'sent', 'accepted', 'rejected', 'expired'

    notes             TEXT,
    terms_conditions  TEXT,

    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, quotation_code)
);

CREATE INDEX idx_quotations_company ON sales_quotations(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotations_code ON sales_quotations(quotation_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotations_customer ON sales_quotations(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotations_date ON sales_quotations(quotation_date);
CREATE INDEX idx_quotations_status ON sales_quotations(status) WHERE deleted_at IS NULL;
```

### 4.6 Sales Quotation Items

Line items for quotations.

```sql
CREATE TABLE sales_quotation_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    quotation_id      UUID NOT NULL REFERENCES sales_quotations(id),
    item_id           UUID NOT NULL REFERENCES items(id),
    item_description  TEXT,
    quantity          DECIMAL(20, 4) NOT NULL,
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    rate              DECIMAL(20, 4) NOT NULL,
    discount_percent  DECIMAL(5, 2) DEFAULT 0,
    discount_amount   DECIMAL(20, 4) DEFAULT 0,
    tax_percent       DECIMAL(5, 2) DEFAULT 0,
    tax_amount        DECIMAL(20, 4) DEFAULT 0,
    line_total        DECIMAL(20, 4) NOT NULL,
    sort_order        INTEGER DEFAULT 0,
    notes             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_quotation_items_company ON sales_quotation_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotation_items_quotation ON sales_quotation_items(quotation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_quotation_items_item ON sales_quotation_items(item_id) WHERE deleted_at IS NULL;
```

### 4.7 Sales Orders

Confirmed customer orders.

```sql
CREATE TABLE sales_orders (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    order_code        VARCHAR(100) NOT NULL,
    order_date        DATE NOT NULL,
    customer_id       UUID NOT NULL REFERENCES customers(id),
    quotation_id      UUID REFERENCES sales_quotations(id),
    price_list_id     UUID REFERENCES price_lists(id),

    delivery_date     DATE,
    warehouse_id      UUID REFERENCES warehouses(id),

    -- Amounts
    subtotal          DECIMAL(20, 4) DEFAULT 0,
    discount_amount   DECIMAL(20, 4) DEFAULT 0,
    tax_amount        DECIMAL(20, 4) DEFAULT 0,
    shipping_amount   DECIMAL(20, 4) DEFAULT 0,
    total_amount      DECIMAL(20, 4) DEFAULT 0,

    -- Status workflow
    status            VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'confirmed', 'partially_delivered', 'delivered', 'partially_invoiced', 'invoiced', 'closed', 'cancelled'

    -- Fulfillment tracking
    reserved_stock    BOOLEAN DEFAULT false,

    notes             TEXT,
    terms_conditions  TEXT,

    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, order_code)
);

CREATE INDEX idx_sales_orders_company ON sales_orders(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_code ON sales_orders(order_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_date ON sales_orders(order_date);
CREATE INDEX idx_sales_orders_status ON sales_orders(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_sales_orders_delivery_date ON sales_orders(delivery_date);
```

### 4.8 Sales Order Items

Line items for sales orders.

```sql
CREATE TABLE sales_order_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    order_id          UUID NOT NULL REFERENCES sales_orders(id),
    quotation_item_id UUID REFERENCES sales_quotation_items(id),
    item_id           UUID NOT NULL REFERENCES items(id),
    item_description  TEXT,
    quantity          DECIMAL(20, 4) NOT NULL,
    delivered_qty     DECIMAL(20, 4) DEFAULT 0,
    invoiced_qty      DECIMAL(20, 4) DEFAULT 0,
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    rate              DECIMAL(20, 4) NOT NULL,
    discount_percent  DECIMAL(5, 2) DEFAULT 0,
    discount_amount   DECIMAL(20, 4) DEFAULT 0,
    tax_percent       DECIMAL(5, 2) DEFAULT 0,
    tax_amount        DECIMAL(20, 4) DEFAULT 0,
    line_total        DECIMAL(20, 4) NOT NULL,
    sort_order        INTEGER DEFAULT 0,
    notes             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_order_items_company ON sales_order_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_order_items_order ON sales_order_items(order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_order_items_item ON sales_order_items(item_id) WHERE deleted_at IS NULL;
```

### 4.9 Delivery Notes

Physical delivery of goods to customers.

```sql
CREATE TABLE delivery_notes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    delivery_code     VARCHAR(100) NOT NULL,
    delivery_date     DATE NOT NULL,
    customer_id       UUID NOT NULL REFERENCES customers(id),
    order_id          UUID REFERENCES sales_orders(id),
    warehouse_id      UUID NOT NULL REFERENCES warehouses(id),

    -- Delivery details
    delivery_address  TEXT,
    shipped_via       VARCHAR(100),
    tracking_number   VARCHAR(100),

    -- Status workflow
    status            VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'delivered', 'verified', 'cancelled'

    notes             TEXT,

    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, delivery_code)
);

CREATE INDEX idx_deliveries_company ON delivery_notes(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deliveries_code ON delivery_notes(delivery_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_deliveries_customer ON delivery_notes(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deliveries_order ON delivery_notes(order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_deliveries_date ON delivery_notes(delivery_date);
CREATE INDEX idx_deliveries_status ON delivery_notes(status) WHERE deleted_at IS NULL;
```

### 4.10 Delivery Note Items

Items delivered in a delivery note.

```sql
CREATE TABLE delivery_note_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    delivery_id       UUID NOT NULL REFERENCES delivery_notes(id),
    order_item_id     UUID REFERENCES sales_order_items(id),
    item_id           UUID NOT NULL REFERENCES items(id),
    item_description  TEXT,
    quantity          DECIMAL(20, 4) NOT NULL,
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    batch_no          VARCHAR(100),
    serial_no         VARCHAR(100),
    sort_order        INTEGER DEFAULT 0,
    notes             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_delivery_items_company ON delivery_note_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_delivery_items_delivery ON delivery_note_items(delivery_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_delivery_items_order_item ON delivery_note_items(order_item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_delivery_items_item ON delivery_note_items(item_id) WHERE deleted_at IS NULL;
```

### 4.11 Sales Invoices

Billing documents for sales.

```sql
CREATE TABLE sales_invoices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    invoice_code      VARCHAR(100) NOT NULL,
    invoice_date      DATE NOT NULL,
    due_date          DATE,
    customer_id       UUID NOT NULL REFERENCES customers(id),
    order_id          UUID REFERENCES sales_orders(id),
    delivery_id       UUID REFERENCES delivery_notes(id),
    price_list_id     UUID REFERENCES price_lists(id),

    -- Amounts
    subtotal          DECIMAL(20, 4) DEFAULT 0,
    discount_amount   DECIMAL(20, 4) DEFAULT 0,
    tax_amount        DECIMAL(20, 4) DEFAULT 0,
    shipping_amount   DECIMAL(20, 4) DEFAULT 0,
    total_amount      DECIMAL(20, 4) DEFAULT 0,
    paid_amount       DECIMAL(20, 4) DEFAULT 0,
    outstanding_amount DECIMAL(20, 4) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,

    -- Status workflow
    status            VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'submitted', 'partially_paid', 'paid', 'overdue', 'cancelled'
    payment_status    VARCHAR(50) DEFAULT 'unpaid',  -- 'unpaid', 'partially_paid', 'paid'

    notes             TEXT,
    terms_conditions  TEXT,

    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, invoice_code)
);

CREATE INDEX idx_invoices_company ON sales_invoices(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_code ON sales_invoices(invoice_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_customer ON sales_invoices(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_order ON sales_invoices(order_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_date ON sales_invoices(invoice_date);
CREATE INDEX idx_invoices_due_date ON sales_invoices(due_date);
CREATE INDEX idx_invoices_status ON sales_invoices(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_payment_status ON sales_invoices(payment_status) WHERE deleted_at IS NULL;
```

### 4.12 Sales Invoice Items

Line items for invoices.

```sql
CREATE TABLE sales_invoice_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    invoice_id        UUID NOT NULL REFERENCES sales_invoices(id),
    order_item_id     UUID REFERENCES sales_order_items(id),
    delivery_item_id  UUID REFERENCES delivery_note_items(id),
    item_id           UUID NOT NULL REFERENCES items(id),
    item_description  TEXT,
    quantity          DECIMAL(20, 4) NOT NULL,
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    rate              DECIMAL(20, 4) NOT NULL,
    discount_percent  DECIMAL(5, 2) DEFAULT 0,
    discount_amount   DECIMAL(20, 4) DEFAULT 0,
    tax_percent       DECIMAL(5, 2) DEFAULT 0,
    tax_amount        DECIMAL(20, 4) DEFAULT 0,
    line_total        DECIMAL(20, 4) NOT NULL,
    sort_order        INTEGER DEFAULT 0,
    notes             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_invoice_items_company ON sales_invoice_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_items_invoice ON sales_invoice_items(invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_items_item ON sales_invoice_items(item_id) WHERE deleted_at IS NULL;
```

### 4.13 Payment Collections

Customer payment receipts.

```sql
CREATE TABLE payment_collections (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    payment_code      VARCHAR(100) NOT NULL,
    payment_date      DATE NOT NULL,
    customer_id       UUID NOT NULL REFERENCES customers(id),
    payment_mode      VARCHAR(50) NOT NULL,  -- 'cash', 'bank_transfer', 'check', 'credit_card', 'online'

    -- Payment details
    reference_number  VARCHAR(100),
    bank_name         VARCHAR(100),
    check_number      VARCHAR(50),

    total_amount      DECIMAL(20, 4) NOT NULL,
    allocated_amount  DECIMAL(20, 4) DEFAULT 0,
    unallocated_amount DECIMAL(20, 4) GENERATED ALWAYS AS (total_amount - allocated_amount) STORED,

    status            VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'submitted', 'cleared', 'cancelled'

    notes             TEXT,

    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, payment_code)
);

CREATE INDEX idx_payments_company ON payment_collections(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_code ON payment_collections(payment_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_customer ON payment_collections(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_date ON payment_collections(payment_date);
CREATE INDEX idx_payments_status ON payment_collections(status) WHERE deleted_at IS NULL;
```

### 4.14 Payment Allocations

Allocation of payments to invoices.

```sql
CREATE TABLE payment_allocations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    payment_id        UUID NOT NULL REFERENCES payment_collections(id),
    invoice_id        UUID NOT NULL REFERENCES sales_invoices(id),
    allocated_amount  DECIMAL(20, 4) NOT NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    UNIQUE(payment_id, invoice_id)
);

CREATE INDEX idx_payment_allocs_company ON payment_allocations(company_id);
CREATE INDEX idx_payment_allocs_payment ON payment_allocations(payment_id);
CREATE INDEX idx_payment_allocs_invoice ON payment_allocations(invoice_id);
```

### 4.15 Sales Returns

Customer returns and credit notes.

```sql
CREATE TABLE sales_returns (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    return_code       VARCHAR(100) NOT NULL,
    return_date       DATE NOT NULL,
    customer_id       UUID NOT NULL REFERENCES customers(id),
    invoice_id        UUID REFERENCES sales_invoices(id),
    delivery_id       UUID REFERENCES delivery_notes(id),
    warehouse_id      UUID NOT NULL REFERENCES warehouses(id),

    return_reason     VARCHAR(200),

    -- Amounts
    subtotal          DECIMAL(20, 4) DEFAULT 0,
    tax_amount        DECIMAL(20, 4) DEFAULT 0,
    total_amount      DECIMAL(20, 4) DEFAULT 0,

    -- Status workflow
    status            VARCHAR(50) DEFAULT 'draft',  -- 'draft', 'approved', 'rejected', 'completed', 'cancelled'

    notes             TEXT,

    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, return_code)
);

CREATE INDEX idx_returns_company ON sales_returns(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_returns_code ON sales_returns(return_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_returns_customer ON sales_returns(customer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_returns_invoice ON sales_returns(invoice_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_returns_date ON sales_returns(return_date);
CREATE INDEX idx_returns_status ON sales_returns(status) WHERE deleted_at IS NULL;
```

### 4.16 Sales Return Items

Items being returned.

```sql
CREATE TABLE sales_return_items (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    return_id         UUID NOT NULL REFERENCES sales_returns(id),
    invoice_item_id   UUID REFERENCES sales_invoice_items(id),
    item_id           UUID NOT NULL REFERENCES items(id),
    item_description  TEXT,
    quantity          DECIMAL(20, 4) NOT NULL,
    uom_id            UUID NOT NULL REFERENCES units_of_measure(id),
    rate              DECIMAL(20, 4) NOT NULL,
    tax_percent       DECIMAL(5, 2) DEFAULT 0,
    tax_amount        DECIMAL(20, 4) DEFAULT 0,
    line_total        DECIMAL(20, 4) NOT NULL,
    batch_no          VARCHAR(100),
    serial_no         VARCHAR(100),
    sort_order        INTEGER DEFAULT 0,
    notes             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_return_items_company ON sales_return_items(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_return_items_return ON sales_return_items(return_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_return_items_item ON sales_return_items(item_id) WHERE deleted_at IS NULL;
```

## 6. CROSS-CUTTING TABLES

### 6.1 Audit Logs

System-wide audit trail.

```sql
CREATE TABLE audit_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID REFERENCES companies(id),
    user_id           UUID REFERENCES users(id),
    entity_type       VARCHAR(100) NOT NULL,  -- Table name
    entity_id         UUID NOT NULL,
    action            VARCHAR(50) NOT NULL,  -- 'create', 'update', 'delete', 'approve', etc.
    old_values        JSONB,
    new_values        JSONB,
    ip_address        VARCHAR(50),
    user_agent        VARCHAR(500),
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
```

### 5.2 Number Series

Configurable document numbering.

```sql
CREATE TABLE number_series (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    series_name       VARCHAR(100) NOT NULL,
    prefix            VARCHAR(20),
    current_value     INTEGER DEFAULT 0,
    padding           INTEGER DEFAULT 5,  -- Number of digits (e.g., 5 = 00001)
    suffix            VARCHAR(20),
    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, series_name)
);

CREATE INDEX idx_number_series_company ON number_series(company_id);
```

### 5.3 Notifications

System notifications and alerts.

```sql
CREATE TABLE notifications (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    user_id           UUID REFERENCES users(id),  -- NULL for system-wide
    notification_type VARCHAR(50) NOT NULL,  -- 'low_stock', 'overdue_payment', 'approval_required'
    title             VARCHAR(200) NOT NULL,
    message           TEXT NOT NULL,
    entity_type       VARCHAR(100),
    entity_id         UUID,
    is_read           BOOLEAN DEFAULT false,
    read_at           TIMESTAMP,
    priority          VARCHAR(20) DEFAULT 'normal',  -- 'low', 'normal', 'high', 'urgent'
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_company ON notifications(company_id);
CREATE INDEX idx_notifications_user ON notifications(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read, created_at) WHERE is_read = false;
CREATE INDEX idx_notifications_type ON notifications(notification_type);
```

### 5.4 Document Attachments

File attachments for any entity.

```sql
CREATE TABLE document_attachments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    entity_type       VARCHAR(100) NOT NULL,
    entity_id         UUID NOT NULL,
    file_name         VARCHAR(255) NOT NULL,
    file_path         VARCHAR(500) NOT NULL,
    file_type         VARCHAR(100),
    file_size         BIGINT,
    description       TEXT,
    uploaded_by       UUID NOT NULL REFERENCES users(id),
    uploaded_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attachments_company ON document_attachments(company_id);
CREATE INDEX idx_attachments_entity ON document_attachments(entity_type, entity_id);
```

## 7. VIEWS FOR REPORTING

### 7.1 Current Stock View

Real-time stock levels across warehouses.

```sql
CREATE VIEW vw_current_stock AS
SELECT
    iw.company_id,
    i.id as item_id,
    i.item_code,
    i.item_name,
    ic.name as category_name,
    w.id as warehouse_id,
    w.warehouse_code,
    w.warehouse_name,
    iw.current_stock,
    iw.reserved_stock,
    iw.available_stock,
    iw.reorder_level,
    CASE
        WHEN iw.current_stock <= iw.reorder_level THEN true
        ELSE false
    END as needs_reorder,
    u.symbol as uom_symbol,
    i.cost_price,
    (iw.current_stock * i.cost_price) as stock_value
FROM item_warehouse iw
JOIN items i ON iw.item_id = i.id
LEFT JOIN item_categories ic ON i.category_id = ic.id
JOIN warehouses w ON iw.warehouse_id = w.id
JOIN units_of_measure u ON i.uom_id = u.id
WHERE iw.deleted_at IS NULL
    AND i.deleted_at IS NULL
    AND w.deleted_at IS NULL;
```

### 6.2 Sales Order Status View

Sales order fulfillment tracking.

```sql
CREATE VIEW vw_sales_order_status AS
SELECT
    so.id,
    so.company_id,
    so.order_code,
    so.order_date,
    c.customer_code,
    c.customer_name,
    so.total_amount,
    so.status,
    COUNT(DISTINCT soi.id) as total_items,
    SUM(soi.quantity) as total_quantity,
    SUM(soi.delivered_qty) as total_delivered,
    SUM(soi.invoiced_qty) as total_invoiced,
    CASE
        WHEN SUM(soi.quantity) = SUM(soi.delivered_qty) THEN 'fully_delivered'
        WHEN SUM(soi.delivered_qty) > 0 THEN 'partially_delivered'
        ELSE 'pending'
    END as delivery_status,
    CASE
        WHEN SUM(soi.quantity) = SUM(soi.invoiced_qty) THEN 'fully_invoiced'
        WHEN SUM(soi.invoiced_qty) > 0 THEN 'partially_invoiced'
        ELSE 'pending'
    END as invoice_status
FROM sales_orders so
JOIN customers c ON so.customer_id = c.id
LEFT JOIN sales_order_items soi ON so.id = soi.order_id AND soi.deleted_at IS NULL
WHERE so.deleted_at IS NULL
GROUP BY so.id, so.company_id, so.order_code, so.order_date,
         c.customer_code, c.customer_name, so.total_amount, so.status;
```

### 6.3 Customer Outstanding View

Customer account receivables summary.

```sql
CREATE VIEW vw_customer_outstanding AS
SELECT
    c.id as customer_id,
    c.company_id,
    c.customer_code,
    c.customer_name,
    c.credit_limit,
    COUNT(si.id) as invoice_count,
    SUM(si.total_amount) as total_invoiced,
    SUM(si.paid_amount) as total_paid,
    SUM(si.outstanding_amount) as total_outstanding,
    SUM(CASE WHEN si.due_date < CURRENT_DATE THEN si.outstanding_amount ELSE 0 END) as overdue_amount,
    MAX(si.due_date) as latest_due_date
FROM customers c
LEFT JOIN sales_invoices si ON c.id = si.customer_id
    AND si.deleted_at IS NULL
    AND si.payment_status != 'paid'
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.company_id, c.customer_code, c.customer_name, c.credit_limit;
```

## 8. INDEXES SUMMARY

- All foreign keys have indexes
- Soft delete queries use filtered indexes (WHERE deleted_at IS NULL)
- Composite indexes for common query patterns
- Text search indexes on code and name fields
- Date range indexes for reporting queries

## 9. DATA MIGRATION & SEEDING

### Initial Seed Data Required

1. **System Roles:** Admin, Sales Officer, Inventory Officer, Approver, Viewer
2. **Base Units of Measure:** Each, Kg, Liter, Meter, etc.
3. **Default Number Series:** SO-, QT-, INV-, DN-, etc.
4. **System User:** Initial admin user

## 10. SCALABILITY CONSIDERATIONS

### Partitioning Strategy (Future)

- **Stock Ledger:** Partition by posting_date (monthly/yearly)
- **Audit Logs:** Partition by created_at (monthly)
- **Invoices/Orders:** Partition by company_id and date

### Archival Strategy

- Move completed transactions older than 2 years to archive tables
- Maintain aggregated summaries for historical reporting

## 11. PERFORMANCE OPTIMIZATION

### Recommended Database Settings (PostgreSQL)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- For full-text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create GIN indexes for JSONB fields
CREATE INDEX idx_items_custom_fields ON items USING GIN (custom_fields);
CREATE INDEX idx_companies_settings ON companies USING GIN (settings);
```

### Materialized Views for Heavy Queries

```sql
-- Refresh daily/hourly based on requirements
CREATE MATERIALIZED VIEW mv_stock_valuation AS
SELECT
    company_id,
    item_id,
    warehouse_id,
    SUM(actual_qty) as total_qty,
    AVG(valuation_rate) as avg_rate,
    SUM(stock_value) as total_value
FROM stock_ledger
WHERE is_cancelled = false
GROUP BY company_id, item_id, warehouse_id;

CREATE UNIQUE INDEX idx_mv_stock_val ON mv_stock_valuation(company_id, item_id, warehouse_id);
```

## 12. BACKUP & RECOVERY

- Full daily backups
- Transaction log backups every hour
- Point-in-time recovery capability
- Geo-replicated backups for disaster recovery

## 13. HR & EMPLOYEE DOMAIN (Phase 2 - Foundation)

### 13.1 Employees

Employee master data for HR, Payroll, and Sales Analytics.

```sql
CREATE TABLE employees (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    employee_code     VARCHAR(50) NOT NULL,
    first_name        VARCHAR(100) NOT NULL,
    last_name         VARCHAR(100) NOT NULL,
    email             VARCHAR(100) UNIQUE NOT NULL,
    phone             VARCHAR(50),

    -- Employment details
    role              VARCHAR(50) NOT NULL,  -- 'admin', 'manager', 'sales_agent', 'warehouse_staff', etc.
    department        VARCHAR(100),
    hire_date         DATE NOT NULL,
    termination_date  DATE,
    employment_status VARCHAR(50) DEFAULT 'active',  -- 'active', 'inactive', 'terminated', 'on_leave'

    -- Sales commission (for sales agents)
    commission_rate   DECIMAL(5, 2) DEFAULT 5.00,  -- Percentage (e.g., 5.00 = 5%)

    -- Address
    address_line1     VARCHAR(200),
    address_line2     VARCHAR(200),
    city              VARCHAR(100),
    region_state      VARCHAR(100),
    country           VARCHAR(100) DEFAULT 'Philippines',
    postal_code       VARCHAR(20),

    -- Emergency contact
    emergency_contact_name  VARCHAR(200),
    emergency_contact_phone VARCHAR(50),

    is_active         BOOLEAN DEFAULT true,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL,
    version           INTEGER NOT NULL DEFAULT 1,
    custom_fields     JSONB,
    UNIQUE(company_id, employee_code)
);

CREATE INDEX idx_employees_company ON employees(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_code ON employees(employee_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_email ON employees(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_role ON employees(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_status ON employees(employment_status) WHERE deleted_at IS NULL;
```

### 13.2 Employee Distribution Locations

Sales agents' assigned territories for distribution and sales tracking.

```sql
CREATE TABLE employee_distribution_locations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    employee_id       UUID NOT NULL REFERENCES employees(id),
    city              VARCHAR(100) NOT NULL,
    region_state      VARCHAR(100) NOT NULL,  -- Region or State (e.g., "Davao Region", "Northern Mindanao")
    is_primary        BOOLEAN DEFAULT false,  -- Primary assigned territory
    assigned_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    notes             TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by        UUID NOT NULL REFERENCES users(id),
    deleted_at        TIMESTAMP NULL
);

CREATE INDEX idx_emp_dist_loc_company ON employee_distribution_locations(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_emp_dist_loc_employee ON employee_distribution_locations(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_emp_dist_loc_city ON employee_distribution_locations(city) WHERE deleted_at IS NULL;
CREATE INDEX idx_emp_dist_loc_region ON employee_distribution_locations(region_state) WHERE deleted_at IS NULL;
CREATE INDEX idx_emp_dist_loc_primary ON employee_distribution_locations(employee_id, is_primary)
    WHERE is_primary = true AND deleted_at IS NULL;
```

## 14. SALES ANALYTICS DOMAIN

### 14.1 Invoice Employees (Commission Split)

Associates multiple employees (sales agents) with invoices for commission tracking.

```sql
CREATE TABLE invoice_employees (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    invoice_id        UUID NOT NULL REFERENCES sales_invoices(id),
    employee_id       UUID NOT NULL REFERENCES employees(id),
    commission_split_percentage DECIMAL(5, 2) DEFAULT 0,  -- Percentage of total commission (e.g., 50.00 = 50%)
    commission_amount DECIMAL(20, 4) NOT NULL,  -- Calculated commission for this employee
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by        UUID NOT NULL REFERENCES users(id),
    UNIQUE(invoice_id, employee_id)
);

CREATE INDEX idx_invoice_emp_company ON invoice_employees(company_id);
CREATE INDEX idx_invoice_emp_invoice ON invoice_employees(invoice_id);
CREATE INDEX idx_invoice_emp_employee ON invoice_employees(employee_id);
```

### 14.2 Sales Distribution (Aggregated Analytics)

Pre-aggregated daily sales statistics for performance optimization.

```sql
CREATE TABLE sales_distribution (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id),
    date              DATE NOT NULL,
    employee_id       UUID NOT NULL REFERENCES employees(id),
    city              VARCHAR(100) NOT NULL,
    region_state      VARCHAR(100) NOT NULL,

    -- Aggregated metrics
    total_sales       DECIMAL(20, 4) DEFAULT 0,
    total_commission  DECIMAL(20, 4) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    average_order_value DECIMAL(20, 4) DEFAULT 0,

    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, date, employee_id, city, region_state)
);

CREATE INDEX idx_sales_dist_company ON sales_distribution(company_id);
CREATE INDEX idx_sales_dist_date ON sales_distribution(date);
CREATE INDEX idx_sales_dist_employee ON sales_distribution(employee_id);
CREATE INDEX idx_sales_dist_city ON sales_distribution(city);
CREATE INDEX idx_sales_dist_region ON sales_distribution(region_state);
CREATE INDEX idx_sales_dist_date_emp ON sales_distribution(date, employee_id);
CREATE INDEX idx_sales_dist_date_city ON sales_distribution(date, city);
```

### 14.3 Modifications to Existing Tables

#### Sales Invoices - Add Employee References

```sql
-- Add columns to sales_invoices table
ALTER TABLE sales_invoices ADD COLUMN primary_employee_id UUID REFERENCES employees(id);
ALTER TABLE sales_invoices ADD COLUMN commission_total DECIMAL(20, 4) DEFAULT 0;
ALTER TABLE sales_invoices ADD COLUMN commission_split_count INTEGER DEFAULT 1;

-- Create indexes
CREATE INDEX idx_invoices_primary_emp ON sales_invoices(primary_employee_id) WHERE deleted_at IS NULL;
```

#### Customers - Add Location Fields

```sql
-- Add region/state fields to customers for location-based analytics
-- Note: billing_city and billing_state already exist, ensure they're populated with Philippines addresses

-- Ensure shipping address has region_state
-- shipping_city and shipping_state already exist in customers table
```

### 14.4 RLS Policies for Employee and Analytics Tables

```sql
-- Employees: Read all in company, write for admins/managers only
CREATE POLICY employees_select ON employees
    FOR SELECT
    USING (company_id = security.current_company_id());

CREATE POLICY employees_modify ON employees
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_role('manager')
        )
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_role('manager')
        )
    );

-- Employee Distribution Locations: Same as employees
CREATE POLICY emp_dist_loc_select ON employee_distribution_locations
    FOR SELECT
    USING (company_id = security.current_company_id());

CREATE POLICY emp_dist_loc_modify ON employee_distribution_locations
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_role('manager')
        )
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_role('manager')
        )
    );

-- Invoice Employees: Admins and managers can see all, sales agents can see own
CREATE POLICY invoice_emp_select ON invoice_employees
    FOR SELECT
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_role('manager')
            OR employee_id IN (
                SELECT id FROM employees WHERE user_id = security.current_user_id()
            )
        )
    );

CREATE POLICY invoice_emp_modify ON invoice_employees
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_role('manager')
        )
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_role('manager')
        )
    );

-- Sales Distribution: Read-only, admins/managers see all, agents see own
CREATE POLICY sales_dist_select ON sales_distribution
    FOR SELECT
    USING (
        company_id = security.current_company_id()
        AND (
            security.is_admin()
            OR security.has_role('manager')
            OR employee_id IN (
                SELECT id FROM employees WHERE user_id = security.current_user_id()
            )
        )
    );

-- Sales Distribution is insert/update only by system (through application logic)
CREATE POLICY sales_dist_modify ON sales_distribution
    FOR ALL
    USING (
        company_id = security.current_company_id()
        AND security.is_admin()
    )
    WITH CHECK (
        company_id = security.current_company_id()
        AND security.is_admin()
    );

-- Enable RLS on new tables
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_distribution_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_distribution ENABLE ROW LEVEL SECURITY;
```

## 15. DATA MIGRATION & ADDRESS CLEANUP

### 15.1 Philippines Address Standardization

All addresses in the system must be updated to use Philippines (Mindanao region) locations.

#### Affected Tables
- `companies` - city, state (region)
- `warehouses` - city, state (region)
- `customers` - billing_city, billing_state, shipping_city, shipping_state
- `employees` - city, region_state
- `employee_distribution_locations` - city, region_state

#### Mindanao Reference Data

**Major Cities:**
- Davao City
- Cagayan de Oro City
- General Santos City
- Zamboanga City
- Butuan City
- Iligan City
- Cotabato City
- Koronadal City
- Pagadian City
- Digos City

**Regions:**
- Davao Region (Region XI)
- Northern Mindanao (Region X)
- Zamboanga Peninsula (Region IX)
- SOCCSKSARGEN (Region XII)
- Caraga (Region XIII)
- BARMM (Bangsamoro Autonomous Region in Muslim Mindanao)

#### Migration Script Template

```sql
-- Update companies
UPDATE companies
SET city = 'Davao City',
    state = 'Davao Region'
WHERE id = '<company-id>';

-- Update warehouses - example distribution
UPDATE warehouses
SET city = CASE warehouse_code
    WHEN 'WH-001' THEN 'Davao City'
    WHEN 'WH-002' THEN 'Cagayan de Oro City'
    WHEN 'WH-003' THEN 'General Santos City'
    ELSE 'Davao City'
END,
state = CASE warehouse_code
    WHEN 'WH-001' THEN 'Davao Region'
    WHEN 'WH-002' THEN 'Northern Mindanao'
    WHEN 'WH-003' THEN 'SOCCSKSARGEN'
    ELSE 'Davao Region'
END
WHERE company_id = '<company-id>';

-- Update customers - distribute across cities
UPDATE customers
SET billing_city = (ARRAY['Davao City', 'Cagayan de Oro City', 'General Santos City', 'Zamboanga City', 'Butuan City'])[floor(random() * 5 + 1)],
    billing_state = CASE
        WHEN billing_city = 'Davao City' THEN 'Davao Region'
        WHEN billing_city = 'Cagayan de Oro City' THEN 'Northern Mindanao'
        WHEN billing_city = 'General Santos City' THEN 'SOCCSKSARGEN'
        WHEN billing_city = 'Zamboanga City' THEN 'Zamboanga Peninsula'
        WHEN billing_city = 'Butuan City' THEN 'Caraga'
        ELSE 'Davao Region'
    END,
    shipping_city = billing_city,
    shipping_state = billing_state
WHERE company_id = '<company-id>';
```

### 15.2 Historical Invoice Backfill

Assign employees to existing invoices for sales analytics.

```sql
-- Create migration function
CREATE OR REPLACE FUNCTION backfill_invoice_employees()
RETURNS void AS $$
DECLARE
    inv_record RECORD;
    default_emp_id UUID;
    commission_amt DECIMAL(20, 4);
BEGIN
    -- Get or create default employee for historical data
    SELECT id INTO default_emp_id
    FROM employees
    WHERE employee_code = 'DEFAULT-AGENT'
    LIMIT 1;

    -- If no default employee exists, create one
    IF default_emp_id IS NULL THEN
        INSERT INTO employees (
            company_id, employee_code, first_name, last_name,
            email, role, hire_date, commission_rate
        )
        VALUES (
            '<company-id>', 'DEFAULT-AGENT', 'Default', 'Sales Agent',
            'default@example.com', 'sales_agent', '2024-01-01', 5.00
        )
        RETURNING id INTO default_emp_id;
    END IF;

    -- Backfill invoices without employee assignment
    FOR inv_record IN
        SELECT id, total_amount, company_id
        FROM sales_invoices
        WHERE primary_employee_id IS NULL
          AND deleted_at IS NULL
    LOOP
        -- Calculate commission (5% default)
        commission_amt := inv_record.total_amount * 0.05;

        -- Update invoice
        UPDATE sales_invoices
        SET primary_employee_id = default_emp_id,
            commission_total = commission_amt,
            commission_split_count = 1
        WHERE id = inv_record.id;

        -- Create invoice_employees record
        INSERT INTO invoice_employees (
            company_id, invoice_id, employee_id,
            commission_split_percentage, commission_amount
        )
        VALUES (
            inv_record.company_id, inv_record.id, default_emp_id,
            100.00, commission_amt
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute backfill
SELECT backfill_invoice_employees();
```

## 16. ANALYTICS VIEWS

### 16.1 Sales by Employee View

```sql
CREATE VIEW vw_sales_by_employee AS
SELECT
    e.id as employee_id,
    e.company_id,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    e.role,
    e.commission_rate,
    DATE_TRUNC('day', si.invoice_date) as sales_date,
    COUNT(DISTINCT si.id) as transaction_count,
    SUM(si.total_amount) as total_sales,
    SUM(ie.commission_amount) as total_commission,
    AVG(si.total_amount) as average_order_value
FROM employees e
JOIN invoice_employees ie ON e.id = ie.employee_id
JOIN sales_invoices si ON ie.invoice_id = si.id
WHERE e.deleted_at IS NULL
    AND si.deleted_at IS NULL
    AND si.status NOT IN ('draft', 'cancelled')
GROUP BY e.id, e.company_id, e.employee_code, e.first_name, e.last_name, e.role, e.commission_rate, DATE_TRUNC('day', si.invoice_date);
```

### 16.2 Sales by Location View

```sql
CREATE VIEW vw_sales_by_location AS
SELECT
    c.company_id,
    c.billing_city as city,
    c.billing_state as region_state,
    DATE_TRUNC('day', si.invoice_date) as sales_date,
    COUNT(DISTINCT si.id) as transaction_count,
    SUM(si.total_amount) as total_sales,
    AVG(si.total_amount) as average_order_value,
    COUNT(DISTINCT si.customer_id) as unique_customers
FROM customers c
JOIN sales_invoices si ON c.id = si.customer_id
WHERE c.deleted_at IS NULL
    AND si.deleted_at IS NULL
    AND si.status NOT IN ('draft', 'cancelled')
GROUP BY c.company_id, c.billing_city, c.billing_state, DATE_TRUNC('day', si.invoice_date);
```

### 16.3 Employee Commission Summary View

```sql
CREATE VIEW vw_employee_commission_summary AS
SELECT
    e.id as employee_id,
    e.company_id,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    DATE_TRUNC('month', si.invoice_date) as month,
    COUNT(DISTINCT si.id) as invoice_count,
    SUM(si.total_amount) as total_sales,
    SUM(ie.commission_amount) as total_commission,
    SUM(CASE WHEN si.payment_status = 'paid' THEN ie.commission_amount ELSE 0 END) as paid_commission,
    SUM(CASE WHEN si.payment_status != 'paid' THEN ie.commission_amount ELSE 0 END) as pending_commission
FROM employees e
JOIN invoice_employees ie ON e.id = ie.employee_id
JOIN sales_invoices si ON ie.invoice_id = si.id
WHERE e.deleted_at IS NULL
    AND si.deleted_at IS NULL
    AND si.status NOT IN ('draft', 'cancelled')
GROUP BY e.id, e.company_id, e.employee_code, e.first_name, e.last_name, DATE_TRUNC('month', si.invoice_date);
```
