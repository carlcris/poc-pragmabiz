-- ============================================================================
-- Migration: Add global document code generator and stock transaction trigger
-- Description: Centralize generated document codes in the database with shared
--              sequence storage and reusable trigger logic.
-- Date: 2026-03-11
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.document_code_sequences (
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code_prefix TEXT NOT NULL,
  last_number BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (company_id, code_prefix),
  CONSTRAINT document_code_sequences_prefix_not_blank CHECK (btrim(code_prefix) <> ''),
  CONSTRAINT document_code_sequences_last_number_positive CHECK (last_number >= 0)
);

COMMENT ON TABLE public.document_code_sequences IS
  'Stores the latest generated numeric suffix per company and document prefix for trigger-based document codes.';

COMMENT ON COLUMN public.document_code_sequences.code_prefix IS
  'Document prefix without company code or numeric suffix, for example ST or SR.';

CREATE OR REPLACE FUNCTION public.generate_document_code(
  p_company_id UUID,
  p_code_prefix TEXT,
  p_digits INTEGER DEFAULT 7
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT := btrim(p_code_prefix);
  v_company_code TEXT;
  v_next_number BIGINT;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'generate_document_code requires company_id';
  END IF;

  IF v_prefix IS NULL OR v_prefix = '' THEN
    RAISE EXCEPTION 'generate_document_code requires a non-empty code_prefix';
  END IF;

  IF p_digits IS NULL OR p_digits < 1 OR p_digits > 18 THEN
    RAISE EXCEPTION 'generate_document_code requires digits between 1 and 18';
  END IF;

  SELECT upper(regexp_replace(btrim(code), '[^A-Za-z0-9]', '', 'g'))
  INTO v_company_code
  FROM public.companies
  WHERE id = p_company_id;

  IF v_company_code IS NULL OR v_company_code = '' THEN
    RAISE EXCEPTION 'generate_document_code requires a valid company code for company_id %', p_company_id;
  END IF;

  INSERT INTO public.document_code_sequences (company_id, code_prefix, last_number)
  VALUES (p_company_id, v_prefix, 1)
  ON CONFLICT (company_id, code_prefix)
  DO UPDATE SET
    last_number = public.document_code_sequences.last_number + 1,
    updated_at = timezone('utc', now())
  RETURNING last_number INTO v_next_number;

  RETURN v_prefix || '-' || v_company_code || lpad(v_next_number::TEXT, p_digits, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_document_code(UUID, TEXT, INTEGER) IS
  'Generates the next sequential company-scoped document code using PREFIX-COMPANYCODE plus a fixed-width numeric suffix.';

CREATE OR REPLACE FUNCTION public.apply_generated_document_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_column TEXT := NULLIF(btrim(TG_ARGV[0]), '');
  v_code_prefix TEXT := NULLIF(btrim(TG_ARGV[1]), '');
  v_digits INTEGER := COALESCE(NULLIF(TG_ARGV[2], '')::INTEGER, 7);
  v_existing_code TEXT;
  v_generated_code TEXT;
BEGIN
  IF v_target_column IS NULL THEN
    RAISE EXCEPTION 'apply_generated_document_code requires target column name';
  END IF;

  v_existing_code := NULLIF(btrim(to_jsonb(NEW) ->> v_target_column), '');
  IF v_existing_code IS NOT NULL THEN
    RAISE EXCEPTION '% is generated automatically; do not supply a value', v_target_column;
  END IF;

  v_generated_code := public.generate_document_code(NEW.company_id, v_code_prefix, v_digits);
  NEW := jsonb_populate_record(NEW, jsonb_build_object(v_target_column, v_generated_code));

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.apply_generated_document_code() IS
  'Reusable BEFORE INSERT trigger function for assigning generated codes to configurable target columns.';

DROP TRIGGER IF EXISTS trigger_generate_stock_transaction_code ON public.stock_transactions;
CREATE TRIGGER trigger_generate_stock_transaction_code
  BEFORE INSERT ON public.stock_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('transaction_code', 'ST', '7');

DROP TRIGGER IF EXISTS trigger_set_stock_request_code ON public.stock_requests;
CREATE TRIGGER trigger_set_stock_request_code
  BEFORE INSERT ON public.stock_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('request_code', 'SR', '7');

DROP TRIGGER IF EXISTS trigger_generate_sales_order_code ON public.sales_orders;
CREATE TRIGGER trigger_generate_sales_order_code
  BEFORE INSERT ON public.sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('order_code', 'SO', '7');

DROP TRIGGER IF EXISTS trigger_generate_sales_quotation_code ON public.sales_quotations;
CREATE TRIGGER trigger_generate_sales_quotation_code
  BEFORE INSERT ON public.sales_quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('quotation_code', 'QT', '7');

DROP TRIGGER IF EXISTS trigger_generate_sales_invoice_code ON public.sales_invoices;
CREATE TRIGGER trigger_generate_sales_invoice_code
  BEFORE INSERT ON public.sales_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('invoice_code', 'INV', '7');

DROP TRIGGER IF EXISTS trigger_generate_purchase_order_code ON public.purchase_orders;
CREATE TRIGGER trigger_generate_purchase_order_code
  BEFORE INSERT ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('order_code', 'PO', '7');

DROP TRIGGER IF EXISTS trigger_generate_purchase_receipt_code ON public.purchase_receipts;
CREATE TRIGGER trigger_generate_purchase_receipt_code
  BEFORE INSERT ON public.purchase_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('receipt_code', 'GRN', '7');

DROP TRIGGER IF EXISTS trigger_generate_stock_adjustment_code ON public.stock_adjustments;
CREATE TRIGGER trigger_generate_stock_adjustment_code
  BEFORE INSERT ON public.stock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('adjustment_code', 'ADJ', '7');

DROP TRIGGER IF EXISTS trigger_generate_stock_transfer_code ON public.stock_transfers;
CREATE TRIGGER trigger_generate_stock_transfer_code
  BEFORE INSERT ON public.stock_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('transfer_code', 'STX', '7');

DROP TRIGGER IF EXISTS trigger_generate_transformation_order_code ON public.transformation_orders;
CREATE TRIGGER trigger_generate_transformation_order_code
  BEFORE INSERT ON public.transformation_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('order_code', 'TRN', '7');

DROP TRIGGER IF EXISTS trigger_generate_invoice_payment_code ON public.invoice_payments;
CREATE TRIGGER trigger_generate_invoice_payment_code
  BEFORE INSERT ON public.invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('payment_code', 'PAY', '7');

DROP TRIGGER IF EXISTS trigger_generate_grn_number ON public.grns;
CREATE TRIGGER trigger_generate_grn_number
  BEFORE INSERT ON public.grns
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('grn_number', 'GRN', '7');

DROP TRIGGER IF EXISTS trigger_generate_pick_list_no ON public.pick_lists;
CREATE TRIGGER trigger_generate_pick_list_no
  BEFORE INSERT ON public.pick_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('pick_list_no', 'PL', '7');

DROP TRIGGER IF EXISTS trigger_generate_pos_transaction_code ON public.pos_transactions;
CREATE TRIGGER trigger_generate_pos_transaction_code
  BEFORE INSERT ON public.pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('transaction_code', 'POS', '7');

DROP TRIGGER IF EXISTS trigger_generate_journal_code ON public.journal_entries;
CREATE TRIGGER trigger_generate_journal_code
  BEFORE INSERT ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('journal_code', 'JE', '7');

DROP TRIGGER IF EXISTS trigger_generate_load_list_number ON public.load_lists;
CREATE TRIGGER trigger_generate_load_list_number
  BEFORE INSERT ON public.load_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('ll_number', 'LL', '7');

DROP TRIGGER IF EXISTS trigger_generate_delivery_note_number ON public.delivery_notes;
CREATE TRIGGER trigger_generate_delivery_note_number
  BEFORE INSERT ON public.delivery_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('dn_no', 'DN', '7');
