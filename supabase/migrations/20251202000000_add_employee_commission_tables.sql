-- ============================================================================
-- Migration: Add Employee and Commission Tables
-- Version: 20251202000000
-- Description: Creates employee, territory, commission, and analytics tables
-- Author: System
-- Date: 2024-12-02
-- ============================================================================

-- ============================================================================
-- TABLE: employees
-- Description: Employee master data for HR, Payroll, and Sales Analytics
-- ============================================================================
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_code VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(50),

    -- Employment details
    role VARCHAR(50) NOT NULL DEFAULT 'sales_agent',
    department VARCHAR(100),
    hire_date DATE NOT NULL,
    termination_date DATE,
    employment_status VARCHAR(50) NOT NULL DEFAULT 'active',

    -- Sales commission (for sales agents)
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 5.00,  -- Percentage (e.g., 5.00 = 5%)

    -- Address (Philippines - Mindanao)
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    city VARCHAR(100),
    region_state VARCHAR(100),
    country VARCHAR(100) NOT NULL DEFAULT 'Philippines',
    postal_code VARCHAR(20),

    -- Emergency contact
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(50),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP,

    -- Versioning
    version INTEGER NOT NULL DEFAULT 1,

    -- Custom fields
    custom_fields JSONB,

    -- Constraints
    CONSTRAINT chk_employee_role CHECK (role IN ('admin', 'manager', 'sales_agent', 'warehouse_staff', 'accountant')),
    CONSTRAINT chk_employee_status CHECK (employment_status IN ('active', 'inactive', 'terminated', 'on_leave')),
    CONSTRAINT chk_commission_rate CHECK (commission_rate >= 0 AND commission_rate <= 100),
    UNIQUE(company_id, employee_code)
);

-- Indexes for employees
CREATE INDEX idx_employees_company ON employees(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_code ON employees(employee_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_email ON employees(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_role ON employees(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_employees_status ON employees(employment_status) WHERE deleted_at IS NULL;

-- RLS policies for employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY employees_select ON employees
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY employees_insert ON employees
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY employees_update ON employees
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY employees_delete ON employees
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER trg_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: employee_distribution_locations
-- Description: Sales agents' assigned territories for distribution tracking
-- ============================================================================
CREATE TABLE employee_distribution_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    city VARCHAR(100) NOT NULL,
    region_state VARCHAR(100) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP,

    -- Constraints
    UNIQUE(company_id, employee_id, city, region_state)
);

-- Indexes for employee_distribution_locations
CREATE INDEX idx_emp_dist_loc_company ON employee_distribution_locations(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_emp_dist_loc_employee ON employee_distribution_locations(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_emp_dist_loc_city ON employee_distribution_locations(city) WHERE deleted_at IS NULL;
CREATE INDEX idx_emp_dist_loc_region ON employee_distribution_locations(region_state) WHERE deleted_at IS NULL;
CREATE INDEX idx_emp_dist_loc_primary ON employee_distribution_locations(employee_id, is_primary)
    WHERE is_primary = true AND deleted_at IS NULL;

-- RLS policies for employee_distribution_locations
ALTER TABLE employee_distribution_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY emp_dist_loc_select ON employee_distribution_locations
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY emp_dist_loc_insert ON employee_distribution_locations
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY emp_dist_loc_update ON employee_distribution_locations
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY emp_dist_loc_delete ON employee_distribution_locations
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER trg_emp_dist_loc_updated_at
    BEFORE UPDATE ON employee_distribution_locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: invoice_employees
-- Description: Associates employees with invoices for commission tracking
-- ============================================================================
CREATE TABLE invoice_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    commission_split_percentage NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    commission_amount NUMERIC(20, 4) NOT NULL DEFAULT 0,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT chk_commission_split CHECK (commission_split_percentage >= 0 AND commission_split_percentage <= 100),
    CONSTRAINT chk_commission_amount CHECK (commission_amount >= 0),
    UNIQUE(invoice_id, employee_id)
);

-- Indexes for invoice_employees
CREATE INDEX idx_invoice_emp_company ON invoice_employees(company_id);
CREATE INDEX idx_invoice_emp_invoice ON invoice_employees(invoice_id);
CREATE INDEX idx_invoice_emp_employee ON invoice_employees(employee_id);

-- RLS policies for invoice_employees
ALTER TABLE invoice_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_emp_select ON invoice_employees
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY invoice_emp_insert ON invoice_employees
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY invoice_emp_update ON invoice_employees
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY invoice_emp_delete ON invoice_employees
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- TABLE: sales_distribution
-- Description: Pre-aggregated daily sales statistics for analytics
-- ============================================================================
CREATE TABLE sales_distribution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    city VARCHAR(100) NOT NULL,
    region_state VARCHAR(100) NOT NULL,

    -- Aggregated metrics
    total_sales NUMERIC(20, 4) NOT NULL DEFAULT 0,
    total_commission NUMERIC(20, 4) NOT NULL DEFAULT 0,
    transaction_count INTEGER NOT NULL DEFAULT 0,
    average_order_value NUMERIC(20, 4) NOT NULL DEFAULT 0,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT chk_sales_dist_metrics CHECK (
        total_sales >= 0 AND
        total_commission >= 0 AND
        transaction_count >= 0 AND
        average_order_value >= 0
    ),
    UNIQUE(company_id, date, employee_id, city, region_state)
);

-- Indexes for sales_distribution
CREATE INDEX idx_sales_dist_company ON sales_distribution(company_id);
CREATE INDEX idx_sales_dist_date ON sales_distribution(date);
CREATE INDEX idx_sales_dist_employee ON sales_distribution(employee_id);
CREATE INDEX idx_sales_dist_city ON sales_distribution(city);
CREATE INDEX idx_sales_dist_region ON sales_distribution(region_state);
CREATE INDEX idx_sales_dist_date_emp ON sales_distribution(date, employee_id);
CREATE INDEX idx_sales_dist_date_city ON sales_distribution(date, city);

-- RLS policies for sales_distribution
ALTER TABLE sales_distribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_dist_select ON sales_distribution
    FOR SELECT
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_dist_insert ON sales_distribution
    FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_dist_update ON sales_distribution
    FOR UPDATE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY sales_dist_delete ON sales_distribution
    FOR DELETE
    USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER trg_sales_dist_updated_at
    BEFORE UPDATE ON sales_distribution
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MODIFY: sales_invoices table - Update employee reference
-- Description: Change primary_employee_id to reference employees table
-- ============================================================================

-- Drop existing foreign key constraint
ALTER TABLE sales_invoices DROP CONSTRAINT IF EXISTS sales_invoices_primary_employee_id_fkey;

-- Add new foreign key constraint to employees table
ALTER TABLE sales_invoices
    ADD CONSTRAINT sales_invoices_primary_employee_id_fkey
    FOREIGN KEY (primary_employee_id)
    REFERENCES employees(id)
    ON DELETE SET NULL;

-- Create index for primary_employee_id
CREATE INDEX IF NOT EXISTS idx_invoices_primary_emp ON sales_invoices(primary_employee_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- View: Sales by Employee
CREATE OR REPLACE VIEW vw_sales_by_employee AS
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

-- View: Employee Commission Summary
CREATE OR REPLACE VIEW vw_employee_commission_summary AS
SELECT
    e.id as employee_id,
    e.company_id,
    e.employee_code,
    CONCAT(e.first_name, ' ', e.last_name) as employee_name,
    DATE_TRUNC('month', si.invoice_date) as month,
    COUNT(DISTINCT si.id) as invoice_count,
    SUM(si.total_amount) as total_sales,
    SUM(ie.commission_amount) as total_commission,
    SUM(CASE WHEN si.status = 'paid' THEN ie.commission_amount ELSE 0 END) as paid_commission,
    SUM(CASE WHEN si.status != 'paid' THEN ie.commission_amount ELSE 0 END) as pending_commission
FROM employees e
JOIN invoice_employees ie ON e.id = ie.employee_id
JOIN sales_invoices si ON ie.invoice_id = si.id
WHERE e.deleted_at IS NULL
    AND si.deleted_at IS NULL
    AND si.status NOT IN ('draft', 'cancelled')
GROUP BY e.id, e.company_id, e.employee_code, e.first_name, e.last_name, DATE_TRUNC('month', si.invoice_date);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
