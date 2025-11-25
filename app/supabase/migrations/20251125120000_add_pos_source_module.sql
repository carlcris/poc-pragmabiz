-- Migration: Add POS to journal_entries source_module constraint
-- Version: 20251125120000
-- Description: Adds 'POS' as an allowed source_module value for journal entries
-- Author: System
-- Date: 2025-11-25

-- Drop the old constraint
ALTER TABLE journal_entries
DROP CONSTRAINT IF EXISTS chk_journal_source;

-- Add the new constraint with 'POS' included
ALTER TABLE journal_entries
ADD CONSTRAINT chk_journal_source
CHECK (source_module IN ('AR', 'AP', 'POS', 'Inventory', 'Manual', 'COGS'));

-- Add comment
COMMENT ON CONSTRAINT chk_journal_source ON journal_entries IS
'Ensures source_module is one of: AR (Accounts Receivable), AP (Accounts Payable), POS (Point of Sale), Inventory, Manual, COGS (Cost of Goods Sold)';
