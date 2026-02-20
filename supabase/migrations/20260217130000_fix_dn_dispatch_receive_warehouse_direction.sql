-- Fix DN stock movement direction after warehouse role rename.
-- Dispatch must consume stock from fulfilling warehouse.
-- Receive must add stock to requesting warehouse.

BEGIN;

DO $$
DECLARE
  v_sig regprocedure;
  v_def text;
  v_new_def text;
BEGIN
  FOR v_sig, v_def IN
    SELECT
      p.oid::regprocedure,
      pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'post_delivery_note_dispatch'
  LOOP
    v_new_def := replace(
      v_def,
      'COALESCE(v_dn_item.requesting_warehouse_id, v_dn.requesting_warehouse_id)',
      'COALESCE(v_dn_item.fulfilling_warehouse_id, v_dn.fulfilling_warehouse_id)'
    );

    IF v_new_def <> v_def THEN
      EXECUTE v_new_def;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  v_sig regprocedure;
  v_def text;
  v_new_def text;
BEGIN
  FOR v_sig, v_def IN
    SELECT
      p.oid::regprocedure,
      pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'post_delivery_note_receive'
  LOOP
    v_new_def := replace(
      v_def,
      'COALESCE(v_dn_item.fulfilling_warehouse_id, v_dn.fulfilling_warehouse_id)',
      'COALESCE(v_dn_item.requesting_warehouse_id, v_dn.requesting_warehouse_id)'
    );

    IF v_new_def <> v_def THEN
      EXECUTE v_new_def;
    END IF;
  END LOOP;
END $$;

COMMIT;
