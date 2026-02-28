-- ============================================================================
-- Migration: Fix GRN approval RPC RLS execution
-- Version: 20260224191000
-- Description: Runs GRN approval inventory posting RPC as SECURITY DEFINER so
--              transactional inserts/updates are not blocked by table RLS.
-- Date: 2026-02-24
-- ============================================================================

BEGIN;

ALTER FUNCTION public.approve_grn_with_batch_inventory(UUID, UUID, UUID, TEXT)
  SECURITY DEFINER;

ALTER FUNCTION public.approve_grn_with_batch_inventory(UUID, UUID, UUID, TEXT)
  SET search_path = public, pg_temp;

COMMENT ON FUNCTION public.approve_grn_with_batch_inventory(UUID, UUID, UUID, TEXT) IS
  'Approves a GRN and posts inventory into warehouse/location/batch tables in one transaction. SECURITY DEFINER to avoid RLS blocking internal stock postings.';

COMMIT;
