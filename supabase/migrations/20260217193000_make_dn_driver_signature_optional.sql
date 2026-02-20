-- Make driver signature optional when dispatching delivery notes.

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
    v_new_def := v_def;

    v_new_def := replace(
      v_new_def,
      $needle$
  IF COALESCE(BTRIM(p_driver_signature), '') = '' THEN
    RAISE EXCEPTION 'Driver signature is required for dispatch';
  END IF;

$needle$,
      E'\n'
    );

    v_new_def := replace(
      v_new_def,
      '    driver_signature = BTRIM(p_driver_signature),',
      '    driver_signature = COALESCE(NULLIF(BTRIM(p_driver_signature), ''''), driver_signature),'
    );

    IF v_new_def <> v_def THEN
      EXECUTE v_new_def;
    END IF;
  END LOOP;
END $$;

COMMIT;
