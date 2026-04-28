-- Migration: Reconcile item location balances from item warehouse totals
-- Description:
--   - Ensures every warehouse has a MAIN location.
--   - Ensures item_warehouse.default_location_id points to MAIN where missing.
--   - Backfills only missing positive location quantity from item_warehouse aggregates.

INSERT INTO public.warehouse_locations (
  company_id,
  warehouse_id,
  code,
  name,
  location_type,
  is_pickable,
  is_storable,
  is_active,
  created_at,
  updated_at
)
SELECT
  w.company_id,
  w.id,
  'MAIN',
  'Main',
  'bin',
  true,
  true,
  true,
  now(),
  now()
FROM public.warehouses w
WHERE w.deleted_at IS NULL
ON CONFLICT (company_id, warehouse_id, code) DO NOTHING;

UPDATE public.item_warehouse iw
SET
  default_location_id = wl.id,
  updated_at = now()
FROM public.warehouse_locations wl
WHERE wl.company_id = iw.company_id
  AND wl.warehouse_id = iw.warehouse_id
  AND wl.code = 'MAIN'
  AND wl.deleted_at IS NULL
  AND iw.deleted_at IS NULL
  AND iw.default_location_id IS NULL;

WITH location_totals AS (
  SELECT
    il.company_id,
    il.item_id,
    il.warehouse_id,
    COALESCE(SUM(il.qty_on_hand), 0) AS qty_on_hand,
    COALESCE(SUM(il.qty_reserved), 0) AS qty_reserved
  FROM public.item_location il
  WHERE il.deleted_at IS NULL
  GROUP BY il.company_id, il.item_id, il.warehouse_id
),
missing_balances AS (
  SELECT
    iw.company_id,
    iw.item_id,
    iw.warehouse_id,
    COALESCE(iw.default_location_id, wl.id) AS location_id,
    GREATEST(0, COALESCE(iw.current_stock, 0) - COALESCE(lt.qty_on_hand, 0)) AS missing_on_hand,
    GREATEST(0, COALESCE(iw.reserved_stock, 0) - COALESCE(lt.qty_reserved, 0)) AS missing_reserved
  FROM public.item_warehouse iw
  JOIN public.warehouse_locations wl
    ON wl.company_id = iw.company_id
   AND wl.warehouse_id = iw.warehouse_id
   AND wl.code = 'MAIN'
   AND wl.deleted_at IS NULL
  LEFT JOIN location_totals lt
    ON lt.company_id = iw.company_id
   AND lt.item_id = iw.item_id
   AND lt.warehouse_id = iw.warehouse_id
  WHERE iw.deleted_at IS NULL
)
INSERT INTO public.item_location (
  company_id,
  item_id,
  warehouse_id,
  location_id,
  qty_on_hand,
  qty_reserved,
  created_at,
  updated_at
)
SELECT
  company_id,
  item_id,
  warehouse_id,
  location_id,
  missing_on_hand,
  LEAST(missing_reserved, missing_on_hand),
  now(),
  now()
FROM missing_balances
WHERE missing_on_hand > 0
ON CONFLICT (company_id, item_id, warehouse_id, location_id)
DO UPDATE SET
  qty_on_hand = public.item_location.qty_on_hand + EXCLUDED.qty_on_hand,
  qty_reserved = LEAST(
    public.item_location.qty_on_hand + EXCLUDED.qty_on_hand,
    public.item_location.qty_reserved + EXCLUDED.qty_reserved
  ),
  updated_at = now();
