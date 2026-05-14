-- ============================================================================
-- Migration: Allow repeated delivery note receiving scans
-- Description:
--   - Receiving now counts one valid scan as one received item.
--   - The same physical box/QR may be scanned multiple times when the box
--     contains multiple item quantities, so box_id cannot be unique per DN.
-- ============================================================================

ALTER TABLE public.delivery_note_item_receiving_scans
  DROP CONSTRAINT IF EXISTS delivery_note_item_receiving_scans_box_unique;

ALTER TABLE public.delivery_note_receiving_exceptions
  DROP CONSTRAINT IF EXISTS delivery_note_receiving_exceptions_box_unique;
