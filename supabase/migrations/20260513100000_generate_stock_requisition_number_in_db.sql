-- ============================================================================
-- Migration: Generate stock requisition numbers in the database
-- Description:
--   - Moves stock_requisitions.sr_number generation to the shared document code
--     trigger pattern.
--   - Keeps stock requisitions on their own sequence namespace instead of
--     sharing the stock_requests SR sequence.
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_generate_stock_requisition_number ON public.stock_requisitions;
CREATE TRIGGER trigger_generate_stock_requisition_number
  BEFORE INSERT ON public.stock_requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_generated_document_code('sr_number', 'SRQ', '9');

COMMENT ON TRIGGER trigger_generate_stock_requisition_number ON public.stock_requisitions IS
  'Assigns sr_number from the shared company-scoped document code generator.';

COMMENT ON COLUMN public.stock_requisitions.sr_number IS
  'Database-generated stock requisition number assigned by trigger_generate_stock_requisition_number.';
