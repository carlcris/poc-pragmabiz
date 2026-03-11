-- ============================================================================
-- Migration: Drop deprecated code generator functions
-- Description: Removes legacy helper functions that generated document codes
--              outside the shared trigger-based generator pattern.
-- Date: 2026-03-11
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.set_stock_request_code() CASCADE;
DROP FUNCTION IF EXISTS public.get_next_stock_request_code(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_next_journal_code(UUID) CASCADE;

COMMIT;
