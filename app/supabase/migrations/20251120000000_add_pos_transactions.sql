-- Create POS transactions table
CREATE TABLE IF NOT EXISTS pos_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  transaction_code VARCHAR(50) NOT NULL UNIQUE,
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Customer information (optional)
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(255),

  -- Financial summary
  subtotal DECIMAL(15, 4) NOT NULL,
  total_discount DECIMAL(15, 4) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  total_tax DECIMAL(15, 4) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15, 4) NOT NULL,
  amount_paid DECIMAL(15, 4) NOT NULL,
  change_amount DECIMAL(15, 4) NOT NULL DEFAULT 0,

  -- Transaction status
  status VARCHAR(20) NOT NULL DEFAULT 'completed',

  -- Cashier information
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  cashier_name VARCHAR(255) NOT NULL,

  -- Additional info
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT pos_transactions_company_code_unique UNIQUE (company_id, transaction_code)
);

-- Create POS transaction items table
CREATE TABLE IF NOT EXISTS pos_transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_transaction_id UUID NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,

  -- Item reference
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  item_code VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,

  -- Quantity and pricing
  quantity DECIMAL(15, 4) NOT NULL,
  unit_price DECIMAL(15, 4) NOT NULL,
  discount DECIMAL(5, 2) NOT NULL DEFAULT 0,
  line_total DECIMAL(15, 4) NOT NULL,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create POS transaction payments table
CREATE TABLE IF NOT EXISTS pos_transaction_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_transaction_id UUID NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,

  -- Payment details
  payment_method VARCHAR(20) NOT NULL,
  amount DECIMAL(15, 4) NOT NULL,
  reference VARCHAR(100),

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_pos_transactions_company ON pos_transactions(company_id);
CREATE INDEX idx_pos_transactions_customer ON pos_transactions(customer_id);
CREATE INDEX idx_pos_transactions_cashier ON pos_transactions(cashier_id);
CREATE INDEX idx_pos_transactions_date ON pos_transactions(transaction_date);
CREATE INDEX idx_pos_transactions_status ON pos_transactions(status);
CREATE INDEX idx_pos_transaction_items_transaction ON pos_transaction_items(pos_transaction_id);
CREATE INDEX idx_pos_transaction_items_item ON pos_transaction_items(item_id);
CREATE INDEX idx_pos_transaction_payments_transaction ON pos_transaction_payments(pos_transaction_id);

-- Create trigger for updated_at on pos_transactions
CREATE TRIGGER update_pos_transactions_updated_at
  BEFORE UPDATE ON pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for updated_at on pos_transaction_items
CREATE TRIGGER update_pos_transaction_items_updated_at
  BEFORE UPDATE ON pos_transaction_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for updated_at on pos_transaction_payments
CREATE TRIGGER update_pos_transaction_payments_updated_at
  BEFORE UPDATE ON pos_transaction_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transaction_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pos_transactions
CREATE POLICY pos_transactions_select
  ON pos_transactions FOR SELECT
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY pos_transactions_insert
  ON pos_transactions FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY pos_transactions_update
  ON pos_transactions FOR UPDATE
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

CREATE POLICY pos_transactions_delete
  ON pos_transactions FOR DELETE
  USING (company_id IN (SELECT company_id FROM users WHERE id = auth.uid()));

-- RLS Policies for pos_transaction_items
CREATE POLICY pos_transaction_items_select
  ON pos_transaction_items FOR SELECT
  USING (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY pos_transaction_items_insert
  ON pos_transaction_items FOR INSERT
  WITH CHECK (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY pos_transaction_items_update
  ON pos_transaction_items FOR UPDATE
  USING (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY pos_transaction_items_delete
  ON pos_transaction_items FOR DELETE
  USING (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

-- RLS Policies for pos_transaction_payments
CREATE POLICY pos_transaction_payments_select
  ON pos_transaction_payments FOR SELECT
  USING (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY pos_transaction_payments_insert
  ON pos_transaction_payments FOR INSERT
  WITH CHECK (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY pos_transaction_payments_update
  ON pos_transaction_payments FOR UPDATE
  USING (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));

CREATE POLICY pos_transaction_payments_delete
  ON pos_transaction_payments FOR DELETE
  USING (pos_transaction_id IN (
    SELECT id FROM pos_transactions WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  ));
