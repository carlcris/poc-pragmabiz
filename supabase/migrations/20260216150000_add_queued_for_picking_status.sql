-- Migration: Add queued_for_picking delivery note status
-- Date: 2026-02-16

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_note_status')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'delivery_note_status'
         AND e.enumlabel = 'queued_for_picking'
     ) THEN
    ALTER TYPE delivery_note_status ADD VALUE 'queued_for_picking' AFTER 'confirmed';
  END IF;
END
$$;
