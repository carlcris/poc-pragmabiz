-- ============================================================================
-- Migration: Add a material classification to items
-- Description:
--   Chop & join and framing price a moulding differently depending on what it
--   is made of — polystyrene uses `(L + W) × rate`, wood uses
--   `(L + W + FW) / 3 × rate × 20%` (see docs/prototypes/chop-and-join-source-data.md
--   Part 2). Nothing on `items` distinguishes them: `category_id` says
--   "Moldings" for both, and `item_type` already carries a different axis
--   (raw_material vs finished_good).
--
--   Name matching is not an option. All 246 catalogued mouldings carry
--   "POLYSTYRENE" in their name, and the single item containing "WOOD" is
--   `057-10 MRN WOOD FINISH POLYSTYRENE` — a polystyrene moulding with a wood
--   *finish*. A LIKE '%WOOD%' rule would misclassify the one item it would be
--   tested against.
--
--   The column is nullable on purpose: an unset material means "not classified",
--   and pricing refuses rather than assuming polystyrene. A silently wrong
--   assumption here produces a mispriced quote, which is worse than a blocked one.
-- Date: 2026-09-01
-- ============================================================================

BEGIN;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS material TEXT;

ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS chk_items_material;

ALTER TABLE public.items
  ADD CONSTRAINT chk_items_material
  CHECK (material IS NULL OR material IN ('polystyrene', 'wood'));

COMMENT ON COLUMN public.items.material IS
  'What the item is made of, where that changes how it is priced. Drives the moulding pricing formula: polystyrene and wood use different maths. NULL means unclassified — pricing refuses rather than assuming.';

-- Every moulding in the catalogue is polystyrene today, including the one with a
-- wood *finish*. Scoped to the Moldings category: other categories have their own
-- type systems (glazing_type, backing_type) and are not touched here.
UPDATE public.items i
SET material = 'polystyrene'
FROM public.item_categories c
WHERE c.id = i.category_id
  AND c.name = 'Moldings'
  AND c.deleted_at IS NULL
  AND i.deleted_at IS NULL
  AND i.material IS NULL;

COMMIT;
