-- Run after migrations. Uses temporary rows and the actual deployed predicates.
CREATE TEMP TABLE manufacturing_order_uniqueness_test (
  sales_order_id UUID,
  frame_job_order_id UUID,
  status TEXT,
  deleted_at TIMESTAMPTZ
) ON COMMIT DROP;

DO $test$
DECLARE
  v_index RECORD;
  v_count INTEGER := 0;
  v_sales UUID := gen_random_uuid();
  v_first_job UUID := gen_random_uuid();
  v_second_job UUID := gen_random_uuid();
BEGIN
  FOR v_index IN
    SELECT indexdef FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'ux_manufacturing_orders_active_sales_order',
        'ux_manufacturing_orders_active_frame_job_order'
      )
  LOOP
    EXECUTE replace(v_index.indexdef, 'public.manufacturing_orders',
      'pg_temp.manufacturing_order_uniqueness_test');
    v_count := v_count + 1;
  END LOOP;
  IF v_count <> 2 THEN RAISE EXCEPTION 'Expected both production uniqueness indexes'; END IF;

  INSERT INTO manufacturing_order_uniqueness_test VALUES
    (v_sales, v_first_job, 'queued', NULL),
    (v_sales, v_second_job, 'queued', NULL),
    (v_sales, NULL, 'queued', NULL);

  BEGIN
    INSERT INTO manufacturing_order_uniqueness_test VALUES
      (v_sales, v_first_job, 'queued', NULL);
    RAISE EXCEPTION 'Duplicate frame job was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO manufacturing_order_uniqueness_test VALUES
      (v_sales, NULL, 'queued', NULL);
    RAISE EXCEPTION 'Duplicate direct sales-order production was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- Cancelled/deleted records must not prevent replacement production.
  INSERT INTO manufacturing_order_uniqueness_test VALUES
    (v_sales, v_first_job, 'cancelled', NULL),
    (v_sales, v_first_job, 'queued', NOW()),
    (v_sales, NULL, 'cancelled', NULL),
    (v_sales, NULL, 'queued', NOW());
  SELECT COUNT(*) INTO v_count FROM manufacturing_order_uniqueness_test;
  IF v_count <> 7 THEN RAISE EXCEPTION 'Unexpected rows after rejected duplicates'; END IF;
END;
$test$;
