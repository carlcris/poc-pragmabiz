-- ============================================================================
-- Migration: Payment terms on a quotation
-- Description:
--   Quotations were the only sales document without payment terms — customers,
--   suppliers, purchase orders, sales orders and invoices all carry them. The
--   terms a job is quoted under belong on the quote the customer accepts, not
--   only on the order raised afterwards.
--
--   Values reuse the vocabulary already stored on `customers` (cash,
--   due_on_receipt, net_30, net_60, net_90, cod) so the two can be compared and
--   defaulted from one another. Free text like `sales_orders` holds
--   ("Payment due within 30 days") is deliberately not adopted — it cannot be
--   filtered or compared.
--
--   Defaults to 'cash': the shop is walk-in trade, and a framing customer
--   collecting their work pays for it then.
-- Date: 2026-09-02
-- ============================================================================

BEGIN;

ALTER TABLE public.sales_quotations
  ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50) NOT NULL DEFAULT 'cash';

-- Guards the vocabulary without an enum, matching how the rest of the schema
-- treats these columns; a new term is a one-line constraint change.
ALTER TABLE public.sales_quotations
  DROP CONSTRAINT IF EXISTS chk_quotation_payment_terms;
ALTER TABLE public.sales_quotations
  ADD CONSTRAINT chk_quotation_payment_terms
  CHECK (payment_terms IN ('cash', 'due_on_receipt', 'net_30', 'net_60', 'net_90', 'cod'));

COMMENT ON COLUMN public.sales_quotations.payment_terms IS
  'Payment terms quoted, from the same vocabulary as customers.payment_terms.';

COMMIT;
