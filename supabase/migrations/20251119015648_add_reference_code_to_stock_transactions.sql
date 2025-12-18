-- Add reference_code column to stock_transactions table
ALTER TABLE stock_transactions
ADD COLUMN reference_code VARCHAR(100);

-- Create index for reference_code
CREATE INDEX idx_stock_transactions_reference_code ON stock_transactions(reference_code) WHERE reference_code IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN stock_transactions.reference_code IS 'Human-readable reference code from the source document (e.g., invoice number, order number)';

-- Add missing columns to stock_ledger table
ALTER TABLE stock_ledger
ADD COLUMN transaction_type VARCHAR(50),
ADD COLUMN qty_change NUMERIC(20,4),
ADD COLUMN uom_id UUID REFERENCES units_of_measure(id),
ADD COLUMN rate NUMERIC(20,4),
ADD COLUMN value_change NUMERIC(20,4),
ADD COLUMN reference_type VARCHAR(50),
ADD COLUMN reference_id UUID,
ADD COLUMN reference_code VARCHAR(100),
ADD COLUMN created_by UUID REFERENCES users(id);

-- Create indexes for new stock_ledger columns
CREATE INDEX idx_stock_ledger_reference_type_id ON stock_ledger(reference_type, reference_id) WHERE reference_type IS NOT NULL;
CREATE INDEX idx_stock_ledger_reference_code ON stock_ledger(reference_code) WHERE reference_code IS NOT NULL;
CREATE INDEX idx_stock_ledger_transaction_type ON stock_ledger(transaction_type) WHERE transaction_type IS NOT NULL;

-- Add comments for new columns
COMMENT ON COLUMN stock_ledger.transaction_type IS 'Type of transaction (sales, purchase, adjustment, transfer, etc.)';
COMMENT ON COLUMN stock_ledger.qty_change IS 'Quantity change (positive for incoming, negative for outgoing)';
COMMENT ON COLUMN stock_ledger.uom_id IS 'Unit of measure for the transaction';
COMMENT ON COLUMN stock_ledger.rate IS 'Rate/price per unit';
COMMENT ON COLUMN stock_ledger.value_change IS 'Total value change (qty_change * rate)';
COMMENT ON COLUMN stock_ledger.reference_type IS 'Type of source document (sales_invoice, purchase_order, etc.)';
COMMENT ON COLUMN stock_ledger.reference_id IS 'UUID of the source document';
COMMENT ON COLUMN stock_ledger.reference_code IS 'Human-readable reference code from the source document';
COMMENT ON COLUMN stock_ledger.created_by IS 'User who created this ledger entry';
