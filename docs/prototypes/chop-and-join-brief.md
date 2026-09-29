# Chop & Join job order — implementation brief

## What this is
`docs/prototypes/chop-and-join.html` is a working, self-contained prototype of the
job order entry screen. It is the **visual and behavioural source of truth**. Every
number in it computes; the calculation functions in its `<script>` block are the
reference implementation of the domain logic.

Port it to the app stack. Do not redesign it.

## Stack
- Next.js (App Router), TypeScript
- Supabase (Postgres + auth)
- Drizzle ORM
- Tailwind + shadcn/ui
- Server Actions for mutations; no API routes unless something needs to be public

## Order of work
Do these as separate commits. Stop after each and let me review.

1. **Schema + migration** — Drizzle tables, no UI.
2. **Domain module** — pure functions, unit tested, no React.
3. **Static UI** — the two-pane shell + component dialog, hardcoded data.
4. **Wire up** — form state, server actions, persistence.
5. **Print output** — job requisition form and cut list.

---

## 1. Schema

Reference data (seeded, editable later in an admin screen):

- `mouldings` — code, name, frame_width_in (numeric), price_per_ft, active
- `mat_boards` — code, name, sheet_length_in, sheet_width_in, hex, price_per_sqft, active
- `glazing_types` — code, name, price_per_sqft, active
- `backing_boards` — code, name, price_per_sqft, active

Transactional:

- `job_orders` — doc_no (generated, `JORFRM-##########`), customer_id, location_id,
  address_snapshot (text), contact_snapshot (text), date_received, due_date,
  payment_terms, status (`draft` | `confirmed` | `in_production` | `released` | `cancelled`),
  negotiated_amount, deposit_amount, remarks, created_by, timestamps

- `job_order_lines` — job_order_id, line_no, moulding_id, qty_cuts,
  artwork_length_in, artwork_width_in, frame_width_in, size_mode (`artwork` | `outside`),
  overlap_in (default 0.125), mat_source (`store` | `customer`), notes

- `job_order_line_mats` — line_id, **layer_index** (0 = top mat), mat_board_id,
  border_or_reveal_l_in, border_or_reveal_w_in
  → unique (line_id, layer_index); layer_index 0..2

- `job_order_line_glazing` — line_id, glazing_type_id, cut_to_mat_outer (bool), sheets
- `job_order_line_backing` — line_id, backing_board_id, flexipoints_qty (nullable),
  multipoints_qty (nullable), l_support_size (nullable: `small` | `big`)

Notes:
- Address and contact are **snapshotted onto the order**, not joined live. A customer
  moving house must not rewrite last year's job forms.
- Prices are snapshotted onto the line at confirm time too — add
  `moulding_price_per_ft_snapshot` etc. to the line tables, nullable while draft.
- All dimensions are `numeric(8,3)` inches. Never floats.
- Matting is **a layer count with per-layer geometry**, never three booleans. The
  legacy app had Single/Double/Triple as independent checkboxes; that is the bug
  this schema exists to prevent.

## 2. Domain module — `lib/framing/`

Pure TypeScript, no React, no DB. Port these from the prototype's script block:

```
geometry.ts
  resolveArtworkSize(input)     // handles size_mode artwork|outside
  matOpenings(artwork, layers, overlap)   // bottom-up; returns opening per layer
  matOuter(topOpening, topBorder)
  frameOutside(sight, frameWidth)         // sight = matOuter ?? artwork
  mouldingFootage(outside)                // perimeter/12 * 1.10 waste

pricing.ts
  lineTotal(line, rates)

description.ts
  articleLines(line)            // the printed "Article/Description" bullets
  specSummary(line)             // the one-line chip text

validation.ts
  matFitsSheet(matOuter, board) // returns the warning or null
```

**The size chain matters and the legacy app got it wrong:**

```
artwork
  → mat openings (bottom-up: bottom opening = artwork − 2×overlap,
                  each layer above widens by 2× the reveal below it)
  → mat outer   (top opening + 2× top border)   ← this is the glass/backing cut size
  → frame outside (mat outer + 2× frame width)
```

When there is no mat, `sight = artwork` and the mat steps are skipped.

Write vitest cases for: no mat, single mat, triple mat with unequal L/W reveals,
size_mode = outside, and the sheet-overflow warning boundary.

`articleLines()` output is **generated, never typed by the user**. The legacy app made
operators hand-type `8 X 10 - 1001-1-B BLK POLYSTYRENE MOULDING`, which is the root
cause of the mismatches between the screen and the printed form.

## 3. UI

Two panes, left form / right live document. Read the prototype for exact spacing,
type scale, and colour tokens.

Components to build:
- `<OrderHeaderForm>` — customer combobox (shadcn Command), address, dates, terms
- `<FrameConfigForm>` — moulding combobox, qty, artwork L×W, frame width,
  size-mode segmented control, three computed readouts
- `<ComponentSummaryCard>` — read-only rows, click opens the dialog
- `<ComponentDialog>` — shadcn Dialog. Accordion: Matting / Glass / Backing.
  Edits a **draft copy**; Cancel discards, Apply commits, Esc = cancel,
  ⌘/Ctrl+Enter = apply.
- `<MatLayerRow>` — board select, border-or-reveal L and W, link toggle, remove.
  Max 3 layers.
- `<FramePreview>` — SVG, concentric rects, scaled to fit. Port `svgFrame()` directly.
- `<JobRequisitionForm>` and `<CutList>` — right pane, print-targeted

State: `react-hook-form` + `zod` for the order; plain `useState` for the dialog draft.
Derived values are computed, never stored in state.

Tailwind: add the prototype's CSS custom properties as theme tokens rather than
hardcoding hex values in classNames.

## 4. Persistence
- Autosave draft on a 700ms debounce via a server action; the "Saving… / All changes
  saved" indicator in the prototype reflects real state.
- Confirming an order snapshots prices and locks the line rows.
- `doc_no` is assigned by a Postgres sequence at confirm time, not at draft creation.

## 5. Print
Separate route, `@media print` stylesheet, no app chrome. Job form and cut list are
two print targets from the same data. The cut list is for the workshop: it needs
glass and backing cut sizes (mat outer − 1/16″), footage per material, and per-layer
mat openings.

## Out of scope for now
Multiple frames per order. The schema supports it (`job_order_lines` is already a
list), but the UI is deliberately single-frame. Don't build a line grid.
