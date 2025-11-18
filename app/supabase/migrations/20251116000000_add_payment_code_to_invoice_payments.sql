-- Add payment_code column to invoice_payments table

ALTER TABLE invoice_payments
ADD COLUMN IF NOT EXISTS payment_code VARCHAR(50);

-- Make it unique per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_payments_payment_code
ON invoice_payments(company_id, payment_code)
WHERE deleted_at IS NULL;

COMMENT ON COLUMN invoice_payments.payment_code IS 'Unique payment code (e.g., PAY-2025-0001)';
