-- Drop stale item packaging RPC left behind after packaging was removed.
-- The current item creation flow uses item_unit_options, not item_packaging.

DROP FUNCTION IF EXISTS public.create_item_with_packages(
  uuid,
  uuid,
  character varying,
  character varying,
  character varying,
  text,
  character varying,
  character varying,
  character varying,
  uuid,
  numeric,
  numeric,
  jsonb
);

DROP FUNCTION IF EXISTS public.create_item_with_packages(
  uuid,
  uuid,
  character varying,
  character varying,
  text,
  character varying,
  character varying,
  character varying,
  uuid,
  numeric,
  numeric,
  jsonb
);
