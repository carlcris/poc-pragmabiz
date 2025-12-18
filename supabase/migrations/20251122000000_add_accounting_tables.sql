-- ============================================================================
-- Migration: Add Accounting Tables (Chart of Accounts, General Ledger, Journals)
-- Version: 20251122000000
-- Description: Creates accounting module tables following double-entry bookkeeping
--              Implements non-breaking additive approach - existing tables unchanged
-- Author: System
-- Date: 2024-11-22
-- ============================================================================

-- ============================================================================
-- TABLE: accounts (Chart of Accounts)
-- ============================================================================

CREATE TABLE accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    account_number      VARCHAR(50) NOT NULL,  -- Alphanumeric: A-1000, L-2100, R-4000
    account_name        VARCHAR(200) NOT NULL,
    account_type        VARCHAR(50) NOT NULL,  -- 'asset', 'liability', 'equity', 'revenue', 'expense', 'cogs'
    parent_account_id   UUID REFERENCES accounts(id) ON DELETE RESTRICT,

    -- System vs User-created accounts
    is_system_account   BOOLEAN DEFAULT false,  -- Prevents deletion of core accounts
    is_active           BOOLEAN DEFAULT true,

    -- Hierarchy and display
    level               INTEGER DEFAULT 1,
    sort_order          INTEGER DEFAULT 0,

    -- Additional info
    description         TEXT,

    -- Audit fields
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at          TIMESTAMP,

    -- Versioning
    version             INTEGER NOT NULL DEFAULT 1,

    -- Constraints
    CONSTRAINT chk_account_type CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense', 'cogs')),
    CONSTRAINT chk_account_level CHECK (level >= 1 AND level <= 10),
    UNIQUE(company_id, account_number)
);

-- Indexes for accounts
CREATE INDEX idx_accounts_company ON accounts(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_type ON accounts(account_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_parent ON accounts(parent_account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_number ON accounts(account_number) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_accounts_number_unique ON accounts(company_id, account_number) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER trigger_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE accounts IS 'Chart of Accounts - defines all GL accounts';
COMMENT ON COLUMN accounts.account_number IS 'Alphanumeric account code (e.g., A-1000, L-2100)';
COMMENT ON COLUMN accounts.is_system_account IS 'System accounts cannot be deleted (AR, AP, Inventory, etc.)';

-- ============================================================================
-- TABLE: journal_entries (General Ledger Header)
-- ============================================================================

CREATE TABLE journal_entries (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    journal_code        VARCHAR(100) NOT NULL,  -- Auto-generated: JE-00001
    posting_date        DATE NOT NULL,

    -- Source tracking
    reference_type      VARCHAR(50),  -- 'sales_invoice', 'purchase_receipt', 'stock_adjustment', 'manual'
    reference_id        UUID,         -- ID of source document
    reference_code      VARCHAR(100), -- Code of source document (for display)

    -- Journal info
    description         TEXT,
    status              VARCHAR(50) NOT NULL DEFAULT 'draft',  -- 'draft', 'posted', 'cancelled'
    source_module       VARCHAR(50) NOT NULL,  -- 'AR', 'AP', 'Inventory', 'Manual'

    -- Totals (for validation)
    total_debit         NUMERIC(20,4) NOT NULL DEFAULT 0,
    total_credit        NUMERIC(20,4) NOT NULL DEFAULT 0,

    -- Posting info
    posted_at           TIMESTAMP,
    posted_by           UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Audit fields
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    deleted_at          TIMESTAMP,

    -- Versioning
    version             INTEGER NOT NULL DEFAULT 1,

    -- Constraints
    CONSTRAINT chk_journal_status CHECK (status IN ('draft', 'posted', 'cancelled')),
    CONSTRAINT chk_journal_balanced CHECK (total_debit = total_credit OR status = 'draft'),
    CONSTRAINT chk_journal_source CHECK (source_module IN ('AR', 'AP', 'Inventory', 'Manual', 'COGS')),
    CONSTRAINT chk_journal_reference CHECK (
        (reference_type IS NULL AND reference_id IS NULL) OR
        (reference_type IS NOT NULL AND reference_id IS NOT NULL)
    ),
    UNIQUE(company_id, journal_code)
);

-- Indexes for journal_entries
CREATE INDEX idx_journal_entries_company ON journal_entries(company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_entries_code ON journal_entries(journal_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_entries_date ON journal_entries(posting_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_entries_status ON journal_entries(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_entries_reference ON journal_entries(reference_type, reference_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_entries_source ON journal_entries(source_module) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_journal_entries_code_unique ON journal_entries(company_id, journal_code) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER trigger_journal_entries_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE journal_entries IS 'General Ledger journal entries (header)';
COMMENT ON COLUMN journal_entries.reference_type IS 'Type of source document (sales_invoice, purchase_receipt, etc.)';
COMMENT ON COLUMN journal_entries.reference_id IS 'ID of source document in respective table';

-- ============================================================================
-- TABLE: journal_lines (General Ledger Details)
-- ============================================================================

CREATE TABLE journal_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    journal_entry_id    UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,

    -- Amounts
    debit               NUMERIC(20,4) NOT NULL DEFAULT 0,
    credit              NUMERIC(20,4) NOT NULL DEFAULT 0,

    -- Line details
    description         TEXT,
    line_number         INTEGER NOT NULL,  -- Order within journal

    -- Additional tracking
    cost_center_id      UUID,  -- Future: link to cost centers
    project_id          UUID,  -- Future: link to projects

    -- Audit fields
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by          UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT chk_journal_line_amounts CHECK (
        (debit > 0 AND credit = 0) OR
        (debit = 0 AND credit > 0)
    ),
    CONSTRAINT chk_journal_line_number CHECK (line_number > 0)
);

-- Indexes for journal_lines
CREATE INDEX idx_journal_lines_company ON journal_lines(company_id);
CREATE INDEX idx_journal_lines_journal ON journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX idx_journal_lines_line_number ON journal_lines(journal_entry_id, line_number);

COMMENT ON TABLE journal_lines IS 'General Ledger journal entry line items';
COMMENT ON CONSTRAINT chk_journal_line_amounts ON journal_lines IS 'Each line must be either debit OR credit, not both';

-- ============================================================================
-- SEED DATA: Default Chart of Accounts
-- ============================================================================
-- Note: Seed data has been moved to supabase/seed.sql
-- This ensures proper execution order: migrations first, then seeds

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;

-- Policies for accounts
CREATE POLICY accounts_select_policy ON accounts
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY accounts_insert_policy ON accounts
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY accounts_update_policy ON accounts
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY accounts_delete_policy ON accounts
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
        AND is_system_account = false  -- Prevent deletion of system accounts
    );

-- Policies for journal_entries
CREATE POLICY journal_entries_select_policy ON journal_entries
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY journal_entries_insert_policy ON journal_entries
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY journal_entries_update_policy ON journal_entries
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY journal_entries_delete_policy ON journal_entries
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
        AND status = 'draft'  -- Only draft journals can be deleted
    );

-- Policies for journal_lines
CREATE POLICY journal_lines_select_policy ON journal_lines
    FOR SELECT USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY journal_lines_insert_policy ON journal_lines
    FOR INSERT WITH CHECK (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY journal_lines_update_policy ON journal_lines
    FOR UPDATE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY journal_lines_delete_policy ON journal_lines
    FOR DELETE USING (
        company_id IN (
            SELECT company_id FROM users WHERE id = auth.uid()
        )
    );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get next journal code
CREATE OR REPLACE FUNCTION get_next_journal_code(p_company_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    last_code VARCHAR;
    last_number INTEGER;
    next_number INTEGER;
    next_code VARCHAR;
BEGIN
    -- Get last journal code for company
    SELECT journal_code INTO last_code
    FROM journal_entries
    WHERE company_id = p_company_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF last_code IS NULL THEN
        RETURN 'JE-00001';
    END IF;

    -- Extract number from code (JE-00001 -> 1)
    last_number := CAST(SUBSTRING(last_code FROM '[0-9]+') AS INTEGER);
    next_number := last_number + 1;
    next_code := 'JE-' || LPAD(next_number::TEXT, 5, '0');

    RETURN next_code;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_next_journal_code IS 'Generates next sequential journal entry code (JE-00001, JE-00002, etc.)';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
