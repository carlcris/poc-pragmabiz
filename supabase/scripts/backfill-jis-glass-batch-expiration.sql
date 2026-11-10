-- Plain PostgreSQL / Supabase SQL Editor.
-- Requires migration 20261110100000_stock_adjustment_batch_expiration.sql.
-- Set v_company_id below. Run with ROLLBACK first; change it to COMMIT to save.
-- Fills NULL expiration dates only. Existing dates are never overwritten.
-- NULL does not distinguish a never-set date from a manually cleared date.
BEGIN;

DO $backfill$
DECLARE
  v_company_id UUID := NULL; -- Replace NULL with 'your-company-uuid'::UUID.
  v_updated_count BIGINT;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Set v_company_id before running this backfill';
  END IF;

  UPDATE public.item_batches AS batch
  SET expiration_date = (batch.received_at::DATE + INTERVAL '3 months')::DATE
  FROM public.items AS item
  JOIN public.item_categories AS category
    ON category.id = item.category_id
    AND category.company_id = item.company_id
    AND category.deleted_at IS NULL
  WHERE batch.company_id = v_company_id
    AND batch.item_id = item.id
    AND item.company_id = batch.company_id
    AND batch.deleted_at IS NULL
    AND item.deleted_at IS NULL
    AND batch.expiration_date IS NULL
    AND batch.received_at IS NOT NULL
    AND UPPER(BTRIM(category.name)) = 'GLASS'
    AND item.description ~* '\mJIS\M'
    AND CONCAT_WS(' ', item.item_name, item.description) !~* '\macrylic\M'
    AND UPPER(BTRIM(COALESCE(item.custom_fields->>'production', ''))) <> 'IMPORTED/LOCAL';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'JIS glass batches backfilled: % (saved only if COMMIT follows)', v_updated_count;
END;
$backfill$;

ROLLBACK; -- Replace with COMMIT after reviewing the dry-run count.
