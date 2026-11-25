-- Run as postgres against the migrated local database. Every fixture rolls back.
-- docker exec -i supabase_db_backend psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/transformation-additional-output-images.sql
BEGIN;

CREATE TEMP TABLE output_image_test_context ON COMMIT DROP AS
SELECT actor.id AS actor_id, actor.company_id, access_row.business_unit_id,
  other_access.business_unit_id AS source_business_unit_id,
  item_set.item_ids, item_set.uom_ids,
  'IMAGE-TEST-' || left(gen_random_uuid()::TEXT, 12) AS prefix,
  actor.company_id::TEXT || '/' || access_row.business_unit_id::TEXT || '/' ||
    actor.id::TEXT || '/' || gen_random_uuid()::TEXT AS image_path,
  actor.company_id::TEXT || '/' || other_access.business_unit_id::TEXT || '/' ||
    actor.id::TEXT || '/' || gen_random_uuid()::TEXT AS source_image_path
FROM public.users actor
JOIN public.user_business_unit_access access_row ON access_row.user_id = actor.id
JOIN public.business_units current_bu ON current_bu.id = access_row.business_unit_id
  AND current_bu.company_id = actor.company_id AND current_bu.is_active
JOIN public.user_business_unit_access other_access ON other_access.user_id = actor.id
  AND other_access.business_unit_id <> access_row.business_unit_id
JOIN public.business_units source_bu ON source_bu.id = other_access.business_unit_id
  AND source_bu.company_id = actor.company_id AND source_bu.is_active
CROSS JOIN LATERAL (
  SELECT array_agg(candidate.id ORDER BY candidate.id) AS item_ids,
    array_agg(candidate.uom_id ORDER BY candidate.id) AS uom_ids
  FROM (
    SELECT item.id, item.uom_id FROM public.items item
    JOIN public.units_of_measure uom ON uom.id = item.uom_id
      AND uom.company_id = actor.company_id AND uom.is_active AND uom.deleted_at IS NULL
    WHERE item.company_id = actor.company_id AND item.is_active
      AND item.is_stock_item AND item.item_type IN ('raw_material', 'finished_good')
      AND item.deleted_at IS NULL
    ORDER BY item.id LIMIT 4
  ) candidate
) item_set
WHERE actor.is_active AND actor.deleted_at IS NULL
  AND cardinality(item_set.item_ids) = 4
  AND public.user_has_permission(actor.id, 'stock_transformations', 'create', access_row.business_unit_id)
  AND public.user_has_permission(actor.id, 'stock_transformations', 'create', other_access.business_unit_id)
ORDER BY actor.id, access_row.business_unit_id, other_access.business_unit_id LIMIT 1;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM output_image_test_context) THEN
    RAISE EXCEPTION 'Image test requires an authorized local actor with two BUs and four stock items';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'transformation-output-images'
      AND public = false AND file_size_limit = 4194304
      AND allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ) THEN RAISE EXCEPTION 'Private image bucket limits are incorrect'; END IF;
END $$;

-- Metadata-only Storage fixtures are enough to exercise transactional references.
INSERT INTO storage.objects(bucket_id, name, metadata)
SELECT 'transformation-output-images', path.base_path || suffix.file_suffix,
  jsonb_build_object('size', 128, 'mimetype', suffix.mime_type)
FROM output_image_test_context context
CROSS JOIN LATERAL (VALUES (context.image_path), (context.source_image_path)) path(base_path)
CROSS JOIN (VALUES ('/original', 'image/png'), ('/thumbnail.webp', 'image/webp')) suffix(file_suffix, mime_type);

CREATE FUNCTION pg_temp.force_output_image_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.notes = 'force-image-save-failure' THEN
    IF NOT EXISTS (SELECT 1 FROM public.transformation_template_inputs WHERE template_id = NEW.template_id)
      OR NOT EXISTS (SELECT 1 FROM public.transformation_template_outputs WHERE template_id = NEW.template_id) THEN
      RAISE EXCEPTION 'Forced failure must run after header and primary lines are written';
    END IF;
    RAISE EXCEPTION 'forced additional output image rollback';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER output_image_save_failure BEFORE INSERT ON public.transformation_template_additional_outputs
FOR EACH ROW EXECUTE FUNCTION pg_temp.force_output_image_failure();

GRANT SELECT ON output_image_test_context TO authenticated;

DO $$
DECLARE
  context RECORD;
  inputs JSONB;
  outputs JSONB;
  additional JSONB;
  source_id UUID;
  target_id UUID;
  copied_id UUID;
  plain_id UUID;
  source JSONB;
  invalid_path TEXT;
BEGIN
  SELECT actor_id, company_id, business_unit_id, source_business_unit_id,
    item_ids, uom_ids, prefix, image_path, source_image_path INTO STRICT context
  FROM output_image_test_context;
  inputs := jsonb_build_array(jsonb_build_object('itemId', context.item_ids[1],
    'uomId', context.uom_ids[1], 'quantity', 1));
  outputs := jsonb_build_array(jsonb_build_object('itemId', context.item_ids[2],
    'uomId', context.uom_ids[2], 'quantity', 1, 'isScrap', false));
  additional := jsonb_build_object('itemId', context.item_ids[3], 'quantity', 1);

  PERFORM set_config('request.jwt.claim.sub', context.actor_id::TEXT, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', context.actor_id,
    'role', 'authenticated', 'current_business_unit_id', context.source_business_unit_id)::TEXT, true);
  SET LOCAL ROLE authenticated;

  source_id := public.create_transformation_template_with_additional_outputs(
    context.prefix || '-SOURCE', 'Source image template', p_inputs => inputs, p_outputs => outputs,
    p_additional_outputs => jsonb_build_array(additional || jsonb_build_object('imagePath', context.source_image_path)));

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', context.actor_id,
    'role', 'authenticated', 'current_business_unit_id', context.business_unit_id)::TEXT, true);
  target_id := public.create_transformation_template_with_additional_outputs(
    context.prefix || '-OWNED', 'Owned image template', p_inputs => inputs, p_outputs => outputs,
    p_additional_outputs => jsonb_build_array(additional || jsonb_build_object('imagePath', context.image_path)));
  IF NOT EXISTS (SELECT 1 FROM public.transformation_template_additional_outputs
    WHERE template_id = target_id AND image_path = context.image_path) THEN
    RAISE EXCEPTION 'Owned output image was not persisted';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'transformation-output-images') THEN
    RAISE EXCEPTION 'Authenticated caller can directly read private image objects';
  END IF;

  BEGIN
    UPDATE public.transformation_template_additional_outputs
    SET image_path = context.source_image_path WHERE template_id = target_id;
    RAISE EXCEPTION 'Direct image path update was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.transformation_template_additional_outputs
      (template_id, item_id, quantity, image_path, created_by, updated_by)
    VALUES (target_id, context.item_ids[4], 1, context.source_image_path, context.actor_id, context.actor_id);
    RAISE EXCEPTION 'Direct image path insert was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  source := public.get_transformation_template_copy_source_with_additional_outputs(source_id);
  IF source -> 'additional_outputs' -> 0 ->> 'image_path' IS DISTINCT FROM context.source_image_path THEN
    RAISE EXCEPTION 'Copy source omitted the output image path';
  END IF;
  copied_id := public.create_transformation_template_with_additional_outputs(
    context.prefix || '-COPY', 'Copied image template', p_inputs => inputs, p_outputs => outputs,
    p_copied_from_template_id => source_id,
    p_additional_outputs => jsonb_build_array(additional || jsonb_build_object('imagePath', context.source_image_path)));
  IF NOT EXISTS (SELECT 1 FROM public.transformation_template_additional_outputs
    WHERE template_id = copied_id AND image_path = context.source_image_path) THEN
    RAISE EXCEPTION 'Cross-BU copy did not preserve the authorized source image';
  END IF;
  PERFORM public.create_transformation_template_with_additional_outputs(
    context.prefix || '-RECOPY', 'Recopied image template', p_inputs => inputs, p_outputs => outputs,
    p_copied_from_template_id => copied_id,
    p_additional_outputs => jsonb_build_array(additional || jsonb_build_object('imagePath', context.source_image_path)));

  plain_id := public.create_transformation_template_with_additional_outputs(
    context.prefix || '-PLAIN', 'Image optional template', p_inputs => inputs, p_outputs => outputs,
    p_additional_outputs => jsonb_build_array(additional));
  IF NOT EXISTS (SELECT 1 FROM public.transformation_template_additional_outputs
    WHERE template_id = plain_id AND image_path IS NULL) THEN
    RAISE EXCEPTION 'Optional image behavior regressed';
  END IF;

  FOREACH invalid_path IN ARRAY ARRAY[
    context.source_image_path,
    context.image_path || '/unexpected',
    context.company_id::TEXT || '/' || context.business_unit_id::TEXT || '/' ||
      context.actor_id::TEXT || '/' || gen_random_uuid()::TEXT
  ] LOOP
    BEGIN
      PERFORM public.create_transformation_template_with_additional_outputs(
        context.prefix || '-INVALID', 'Invalid image template', p_inputs => inputs, p_outputs => outputs,
        p_additional_outputs => jsonb_build_array(additional || jsonb_build_object('imagePath', invalid_path)));
      RAISE EXCEPTION 'Invalid image path or unauthorized image ownership was accepted';
    EXCEPTION WHEN invalid_parameter_value THEN
      IF SQLERRM <> 'Invalid additional output image' THEN RAISE; END IF;
    END;
    IF EXISTS (SELECT 1 FROM public.transformation_templates WHERE template_code = context.prefix || '-INVALID') THEN
      RAISE EXCEPTION 'Invalid image left a partially created template';
    END IF;
  END LOOP;

  BEGIN
    PERFORM public.create_transformation_template_with_additional_outputs(
      context.prefix || '-WRONG-ITEM', 'Wrong source item template', p_inputs => inputs, p_outputs => outputs,
      p_copied_from_template_id => source_id,
      p_additional_outputs => jsonb_build_array(jsonb_build_object('itemId', context.item_ids[4],
        'quantity', 1, 'imagePath', context.source_image_path)));
    RAISE EXCEPTION 'Source image was reused for a different output item';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'Invalid additional output image' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.create_transformation_template_with_additional_outputs(
      context.prefix || '-WRONG-SOURCE', 'Wrong source template', p_inputs => inputs, p_outputs => outputs,
      p_copied_from_template_id => plain_id,
      p_additional_outputs => jsonb_build_array(additional || jsonb_build_object('imagePath', context.source_image_path)));
    RAISE EXCEPTION 'Image from a different copy source was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'Invalid additional output image' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.create_transformation_template_with_additional_outputs(
      context.prefix || '-ROLLBACK', 'Forced rollback image template', p_inputs => inputs, p_outputs => outputs,
      p_additional_outputs => jsonb_build_array(additional || jsonb_build_object(
        'imagePath', context.image_path, 'notes', 'force-image-save-failure')));
    RAISE EXCEPTION 'Forced image save failure was not raised';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'forced additional output image rollback' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.transformation_templates WHERE template_code = context.prefix || '-ROLLBACK') THEN
    RAISE EXCEPTION 'Forced image save failure left committed header/primary rows';
  END IF;
  RESET ROLE;
END $$;

ROLLBACK;
