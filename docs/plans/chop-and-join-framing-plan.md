# Chop & Join / Framing — implementation plan

> **Living document.** This plan is updated whenever a decision changes during implementation.
> Do not treat any section as final until it is marked ✅ Done. When a decision is revised, edit the
> relevant section in place and add a line to the Decision Log at the bottom with the date and reason.

**Last updated:** 2026-09-01 · **Status:** Steps 1–29 complete. Configured lines show only their total on the quotation.

**Approved visual references — both are authoritative, for different surfaces:**

| Surface | Reference |
|---|---|
| Quotation-integrated UI (line-type chooser, quotation form) | `docs/prototypes/chop-join-quotation.html` ([published](https://claude.ai/code/artifact/774085bd-5138-4208-b9e2-331f68dde35c)) |
| Configuration dialog, geometry/description logic, **and the generated documents** | `docs/prototypes/chop-and-join-final.html` |

> ⚠️ This note previously said `chop-and-join-final.html` was "the reference for geometry/description
> functions only." That understated it — the file is also the source of truth for the **Job
> requisition** and **Cut list** documents, and reading it as geometry-only is what led Step 5 to
> build an invoice table that did not match the approved design. **Open and render this prototype
> before writing any rendering code.**

---

## 1. What we are building

Custom picture framing quoting, entered as configured line items on a Sales Quotation. A quotation
can mix three kinds of line:

| Line type | How the customer is billed | Configuration |
|---|---|---|
| **Raw material** | Plain item × qty × price | None — normal add-item flow |
| **Chop & join** | **By parts consumed** — every material prints as its own billable line | Large modal dialog |
| **Framing** | **By the frame** — one line, one price, parts hidden | Same dialog, different billing mode |

The visual and behavioural reference is `docs/prototypes/chop-and-join-final.html` — a working
prototype whose `<script>` block is the reference implementation of the geometry and description
logic. Source receipts and handwritten pricing formulas are transcribed in
`docs/prototypes/chop-and-join-source-data.md`.

### Key insight driving the design

Chop & join and framing are **not two features**. They are one configuration engine and one geometry
model with a **billing-mode switch** that controls (a) which price tier is read per component and
(b) whether components print individually or roll up into a single frame price.

---

## 2. Decisions already settled

| # | Decision | Rationale |
|---|---|---|
| 1 | **One configured quotation line, exploded at render time** — not one line per part | The existing `invoice_display_mode` column (`summary`/`components`/`both`) was built for exactly this. Keeps the quotation clean; the invoice shows the parts breakdown. |
| 2 | **Chop & join and framing share one engine** | Confirmed with user — no functional difference beyond billing mode and price tier. |
| 3 | **Prices come from `item_prices` price tiers** | Tiers `framing` and `chop_join` already exist and are populated (see §3). |
| 4 | **Up to two job orders per quotation** — one per billing mode | Quotation with both modes spawns 2 job orders; with one mode, 1 job order; regardless of qty or line count. |
| 5 | **Large modal dialog, not a route change** | Avoids holding unsaved quotation state across a navigation. Matches existing `QuotationLineItemDialog` precedent. |
| 6 | **Polystyrene first; wood mouldings deferred** | Zero wood mouldings exist in the catalog (see §3). The wood formulas are also the ones that could not be reconciled against source data. |

---

## 3. Verified data facts

Queried against the live local database — these are confirmed, not assumed.

### Moulding pricing is ready

| Tier | Display name | Items | Price range |
|---|---|---|---|
| `framing` | Framing Price | 240 | ₱4.00 – ₱38.73 |
| `chop_join` | Chop & Join Price | 240 | ₱1.80 – ₱17.43 |

- The two tiers **always co-occur** — 240 items have both, **zero** have only one. No partial-data case to handle.
- All 240 are `item_type = 'raw_material'` in a single `Moldings` category → the "is this configurable?" test is answerable from data.
- Example — `1574-36B-BLK`: chop_join ₱6.19, framing ₱13.76 (framing ≈ 2× chop&join, consistent with finished-product vs. per-part service rate).

### All required material categories exist as real items

| Category | Items |
|---|---|
| Moldings | 246 |
| Matboard | 121 |
| Photo Frame | 91 |
| Backing | 64 |
| Glass | 34 |

### Mat/glass/backing per-area rates — user-entered for v1 ✅ Decided

Mat, glass, and backing items carry only **sheet-level prices** (`default`/`srp`/`ws`):
- Glass: ₱5.50 – ₱3,520 per sheet — **no glass item is priced below ₱5**
- Matboard: ₱10 – ₱436.50 per sheet
- Backing: ₱7 – ₱995 per sheet

But the invoices bill these **by area**, at rates that appear only in the handwritten formulas
(glass ₱0.25/₱0.35 per sq in, plywood ⅛″ ₱0.16, MDF ₱0.12, sintra ₱0.45, etc.). Those per-area
rates exist **nowhere in the database.**

**Decision: the user enters the per-area rate in the configuration dialog.** Storing them is
deferred — we will decide later whether they become `item_prices` tiers, a settings-level rate
table, or stay manual.

Implications for the build:
- The dialog exposes an editable **rate field per non-moulding component** (mat / glass / backing).
- The entered rate is persisted on the component row — `sales_quotation_item_components.unit_rate`
  already exists and is the right home, so **no schema change is needed for this.**
- Pre-fill the field where the formulas give an unambiguous rate (e.g. glass ₱0.35 at ≥15″,
  ₱0.25 below) as a **default the user can override**, not a locked value.
- Mouldings continue to read automatically from the `framing` / `chop_join` tiers — they are not
  user-entered.

Revisit when we decide on permanent storage — tracked as §11 Q1.

### Wood mouldings do not exist

All 240 priced mouldings are polystyrene. The single "WOOD" name match is
`057-10 MRN WOOD FINISH POLYSTYRENE` — a polystyrene moulding with a wood *finish*, not a wood moulding.

Consequence: the wood formula variants (`(L + W + FW) / 3 × price`) have **no priced items behind
them**, and are also the formulas that could not be reconciled against the source receipts (see the
cross-check notes in `chop-and-join-source-data.md` — the worked example uses a rate of 66 where its
own label implies 60). Building poly-only avoids encoding an unverified formula, and defers the
poly-vs-wood discriminator question entirely.

---

## 4. Schema

Extends the **existing** frame configuration tables rather than creating a parallel set. Those tables
(`sales_quotation_item_configurations`, `sales_quotation_item_components`, plus their
`sales_order_item_*` mirrors) already solve the same problem for the older "frame job order" feature.

### 4a. Billing-mode discriminator

Add to `sales_quotation_item_configurations` and `sales_order_item_configurations`:

```sql
billing_mode TEXT NOT NULL DEFAULT 'framing'
  CHECK (billing_mode IN ('framing', 'chop_join'))
```

This is the switch that drives price-tier selection and invoice display. Note `invoice_display_mode`
already exists and stays — `billing_mode` sets the *default* for it (`chop_join` → `components`,
`framing` → `summary`) but they remain independently settable.

### 4b. Chop & join geometry

The existing configuration table holds only `width`/`height`/`fixed_allowance`/molding fields —
enough for the old frame feature, not enough for chop & join. Add:

```sql
-- on sales_quotation_item_configurations + sales_order_item_configurations
artwork_length_in   NUMERIC(9,4)
artwork_width_in    NUMERIC(9,4)
frame_width_in      NUMERIC(9,4)
size_mode           TEXT CHECK (size_mode IN ('artwork','outside'))
overlap_in          NUMERIC(9,4) NOT NULL DEFAULT 0.125
mat_source          TEXT CHECK (mat_source IN ('store','customer'))
glazing_cut_to_mat_outer BOOLEAN NOT NULL DEFAULT true
```

### 4c. Mat layers — new child table

Matting is **a layer count with per-layer geometry**, never three booleans. The legacy app modelled
Single/Double/Triple as independent checkboxes; that is the specific bug this schema prevents.

```sql
CREATE TABLE public.sales_quotation_item_mat_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id),
  configuration_id UUID NOT NULL
    REFERENCES public.sales_quotation_item_configurations(id) ON DELETE CASCADE,
  layer_index INTEGER NOT NULL,          -- 0 = top mat
  mat_board_item_id UUID NOT NULL REFERENCES public.items(id),
  border_or_reveal_l_in NUMERIC(9,4) NOT NULL,
  border_or_reveal_w_in NUMERIC(9,4) NOT NULL,
  -- audit columns per house style
  UNIQUE (configuration_id, layer_index),
  CHECK (layer_index BETWEEN 0 AND 2)
);
```

Plus the `sales_order_item_mat_layers` mirror, carrying `quotation_mat_layer_id` for lineage —
matching how `sales_order_item_components.quotation_component_id` already works.

### 4d. Job order — two per quotation

Current constraint blocks the agreed model:

```sql
-- frame_job_orders currently has:
UNIQUE (quotation_id)     -- ← one job order per quotation, total
```

Change to allow one per billing mode:

```sql
ALTER TABLE public.frame_job_orders
  ADD COLUMN billing_mode TEXT NOT NULL DEFAULT 'framing'
    CHECK (billing_mode IN ('framing','chop_join'));

-- replace the blanket unique with a per-mode one
ALTER TABLE public.frame_job_orders DROP CONSTRAINT frame_job_orders_quotation_id_key;
CREATE UNIQUE INDEX ux_frame_job_orders_quotation_mode
  ON public.frame_job_orders (quotation_id, billing_mode)
  WHERE quotation_id IS NOT NULL AND status <> 'cancelled' AND deleted_at IS NULL;
```

> ⚠️ Note the existing `ux_frame_job_orders_active_sales_order` index is a *separate* constraint on
> `sales_order_id` and will need the same per-mode treatment.

**Table keeps its name.** Renaming to carry both modes was considered and rejected — it would touch
472 references (251 in `src/`, 221 in migrations) across 2 tables, 5 functions, and 12 indexes for
zero functional gain, and would bury the real feature diff in cosmetic churn. The name is also
already accurate: both modes *are* picture-framing work, differing only in how they bill. Instead,
make the scope explicit in a comment:

```sql
COMMENT ON TABLE public.frame_job_orders IS
  'Picture-framing job orders. Covers both billing modes: framing (billed per finished frame) and chop_join (billed per part consumed). One per quotation per billing_mode.';
```

### 4e. Dimensions

All dimensions **`NUMERIC(9,4)`** inches — four decimals, because framing works in sixteenths
(0.0625) and the glass/backing clearance cut is itself a sixteenth. Three decimals silently corrupts
real cut sizes (see the Step 2 notes). Never floats. All money `NUMERIC(20,4)` per house style.

---

## 5. Domain module — `src/lib/framing/`

Pure TypeScript. No React, no DB. Ported from the prototype's `<script>` block, which is the
reference implementation.

```
geometry.ts
  resolveArtworkSize(input)              // handles size_mode artwork|outside
  matOpenings(artwork, layers, overlap)  // bottom-up; opening per layer
  matOuter(topOpening, topBorder)
  frameOutside(sight, frameWidth)        // sight = matOuter ?? artwork
  mouldingFootage(outside)               // perimeter/12 × 1.10 waste

pricing.ts
  componentPrices(config, rates)         // per-part prices — chop & join billing
  frameTotal(config, rates)              // rolled-up single price — framing billing

description.ts
  articleLines(line)                     // printed "Article/Description" bullets
  specSummary(line)                      // one-line chip text

validation.ts
  matFitsSheet(matOuter, board)          // sheet-overflow warning or null
```

### Discounts are NOT baked into tier prices ✅ Decided

The `framing` and `chop_join` tier values are **gross rates with no discount applied.** The
discount rules from the handwritten notes (`less 30%` for aquarium/octagon, `× 20%` on chop & join
wood and store-supplied matting) are therefore **separate operations applied on top** of the tier
price — they are not already reflected in the stored number.

Consequences:
- `pricing.ts` computes from the tier rate, then applies any applicable discount as a distinct step.
- This keeps the existing quotation line `discount_percent` / `discount_amount` columns meaningful
  and independent — a customer-level or line-level discount composes on top of the formula
  discount rather than colliding with it.
- The aquarium/octagon `less 30%` rules are **out of scope for v1** (§10) since those frame types
  aren't being built yet — but the pricing module should be structured so a discount step can be
  added per frame type without restructuring.

### The size chain — the legacy app got this wrong

```
artwork
  → mat openings   (bottom-up: bottom opening = artwork − 2×overlap,
                    each layer above widens by 2× the reveal below it)
  → mat outer      (top opening + 2× top border)   ← the glass/backing cut size
  → frame outside  (mat outer + 2× frame width)
```

With no mat, `sight = artwork` and the mat steps are skipped.

`articleLines()` output is **generated, never typed by the user.** The legacy app made operators
hand-type `8 X 10 - 1001-1-B BLK POLYSTYRENE MOULDING`, which is the root cause of mismatches
between the screen and the printed form.

### Tests (vitest)

No test framework exists in the repo today — this introduces one. Cases: no mat; single mat; triple
mat with unequal L/W reveals; `size_mode = outside`; sheet-overflow warning boundary; and both
billing modes producing correct totals from the same geometry.

---

## 6. UI

### Quotation line flow

The quotation page stays the hub. `QuotationLineItemDialog` gains a line-type selector:

- **Raw material** (default) — existing behaviour unchanged
- **Chop & join** — opens the configuration panel, billing mode `chop_join`
- **Framing** — opens the same panel, billing mode `framing`

On Apply, the dialog closes and the quotation line is added/updated with its configuration +
components. Cancel discards. Esc = cancel, ⌘/Ctrl+Enter = apply.

### Configuration panel components

| Component | Purpose |
|---|---|
| `<FrameConfigForm>` | Moulding combobox, qty, artwork L×W, frame width, size-mode segmented control, three computed readouts |
| `<MatLayerRow>` | Board select, border-or-reveal L/W, link toggle, remove. Max 3 layers |
| `<GlazingSection>` | Glass type cards, cut-to-mat-outer toggle, sheet count |
| `<BackingSection>` | Board cards + fitting hardware (flexipoints, multipoints, L-support) |
| `<FramePreview>` | SVG, concentric rects, scaled to fit. Port `svgFrame()` directly |
| `<ComponentSummary>` | Read-only rollup shown on the quotation line |

Derived values are **computed, never stored in state**. Dialog edits a draft copy;
Cancel discards it.

Tailwind: add the prototype's CSS custom properties as theme tokens rather than hardcoding hex
values in classNames.

---

## 7. Invoice / print output

`invoice_display_mode` drives rendering from the same stored data:

- **`components`** (chop & join default) — each component prints as its own `Qty / Unit / Description / Amount` row, matching the real invoices in `chop-and-join-source-data.md`
- **`summary`** (framing default) — one row for the frame
- **`both`** — frame row plus an indented component breakdown

Two print targets from the same data:
1. **Job requisition form** — customer-facing, matches the paper form layout
2. **Cut list** — workshop-facing: glass/backing cut sizes (mat outer − ¹⁄₁₆″), footage per material, per-layer mat openings

> ⚠️ **No print/PDF output exists for `frame_job_orders` today** — `QuotationPDF.tsx` exists for the
> quotation itself, but there is no job-order print component. This is new ground, not a pattern to
> copy.

---

## 8. Job order handoff

Follows the existing `POST /api/sales-orders/[id]/create-frame-job-order` precedent exactly:
explicit user action from the Sales Order (not automatic at quotation confirm), gated on the order
having configured lines, reserving inventory per component.

Change: the RPC groups configured lines **by `billing_mode`** and creates one job order per distinct
mode present — up to two.

---

## 9. Order of work

Each step is a separate commit. **Stop after each for review.**

| # | Step | Depends on | Status |
|---|---|---|---|
| 1 | Schema + migration (§4) | — | ✅ **Done** — `20260901100000_add_chop_join_framing_configuration.sql` (+ precision fix, see Step 2) |
| 2 | Domain module + tests (§5) | 1 | ✅ **Done** — `src/lib/framing/`, 38 tests passing |
| 3 | Static UI — dialog shell + panel (§6) | 2 | ✅ **Done** — `src/components/framing/` |
| 4 | Wire up — persistence via RPC (§6) | 3 | ✅ **Done** — `20260901120000_persist_chop_join_framing_details.sql` |
| 4b | UI entry point — three-way line-type chooser | 4 | ✅ **Done** — `QuotationForm` + `toLineItem` |
| 4c | Fitting hardware as inventory items | 4b | ✅ **Done** — `supabase/seed.sql` |
| 5 | Invoice rendering (§7) | 4c | ✅ **Done** — `invoicePresenter` + `formatInches`, wired into PDF and view dialog |
| 6 | Job order handoff (§8) | 4 | ✅ **Done** — `20260901140000_split_frame_job_orders_by_billing_mode.sql` |
| 7 | Generated documents (§7) | 5 | ✅ **Done** — `documents.ts` + `GeneratedDocuments.tsx`, live in the config dialog |
| 8 | Frame components dialog | 7 | ✅ **Done** — `FrameComponentsDialog.tsx`, matting/glass/backing moved off the main form |
| 9 | Layout pass | 8 | ✅ **Done** — even split, inline readouts, pane minimums |
| 10 | Glass by type | 9 | ✅ **Done** — five fixed types, sheets locked except double glass |
| 11 | Backing by type + material items | 10 | ✅ **Done** — `supabase/seed.sql` |
| 12 | One dialog per component | 11 | ✅ **Done** — ⋯ on each summary row |
| 13 | Opening a dialog includes the component | 12 | ✅ **Done** — include checkboxes removed |
| 14 | Mat positions on the requisition | 13 | ✅ **Done** — Top / 2nd / 3rd mat named |
| 15 | Grouped Article / Description | 14 | ✅ **Done** — Moulding / Matting / Finishing blocks |
| 15b | Wider dialog for the requisition | 15 | ✅ **Done** — 1440px, document takes the larger half |
| 16 | Editing reopens the frame dialog | 15b | ✅ **Done** — `fromLineItem.ts` + two migrations |
| 17 | Moulding price checked at selection | 16 | ✅ **Done** — flagged in the picker; two edit bugs fixed |
| 18 | Configured lines legible on the quotation | 17 | ✅ **Done** — badge, spec and part count on the row |
| 18b | Exact line total survives the save | 18 | ✅ **Done** — `20260901180000_honour_explicit_line_total.sql` |
| 19 | Configured lines sold in pieces | 18b | ✅ **Done** — frame unit is explicit, no longer the moulding's |
| 20 | Rabbet overlap defaults to zero | 19 | ✅ **Done** — mat opening equals the artwork |
| 21 | Borders on the requisition's mat lines | 20 | ✅ **Done** — border / reveal per layer |
| 22 | Mat cut size in the left pane | 21 | ✅ **Done** — three labelled dimension pairs |
| 23 | Borders join the sizes in the left pane | 22 | ✅ **Done** — supersedes Step 21's placement |
| 24 | One name per measurement | 23 | ✅ **Done** — "Mat cut" everywhere |
| 25 | Item material column | 24 | ✅ **Done** — `20260901210000_add_item_material.sql` |
| 26 | Moulding pricing formula | 25 | ✅ **Done** — closes open question 5 |
| 27 | Mat pricing formula | 26 | ✅ **Done** — same `(L + W) × rate` as the moulding |
| 28 | Multiple sizes per configured line | 27 | ✅ **Done** — see §12 |
| 29 | Hide per-unit price, discount and tax on configured lines | 28 | ✅ **Done** |

### Step 1 — what landed

Migration `supabase/migrations/20260901100000_add_chop_join_framing_configuration.sql`, applied and
verified against the local database:

- `billing_mode` + chop & join geometry columns on **both** `sales_quotation_item_configurations`
  and `sales_order_item_configurations` (artwork L/W, frame width, size mode, overlap, mat source,
  glazing cut-to-outer), each with CHECK constraints.
- New `sales_quotation_item_mat_layers` and `sales_order_item_mat_layers` tables — layer-count model
  with `UNIQUE (configuration_id, layer_index)` and `layer_index BETWEEN 0 AND 2`. The order-side
  table carries `quotation_mat_layer_id` for lineage, matching the existing component pattern.
- `unit_rate` on mat layers holds the user-entered per-area rate (per the v1 decision).
- RLS enabled on both new tables, policies mirroring the existing configuration tables.
- `frame_job_orders.billing_mode` added; blanket `UNIQUE (quotation_id)` replaced with
  `ux_frame_job_orders_quotation_mode`; `ux_frame_job_orders_active_sales_order` likewise replaced
  with a per-mode variant.

**Verified by direct test** (all rolled back, no data left behind):
- Two job orders on one quotation with *different* modes → allowed ✅
- A second job order with the *same* mode → rejected by the new unique index ✅
- Full chain quotation → line item → chop_join configuration → 2 mat layers → inserts cleanly ✅
- Duplicate `layer_index` on one configuration → rejected ✅
- `npx tsc --noEmit` and `npm run lint` both clean ✅

### Step 2 — what landed

`src/lib/framing/` — pure TypeScript, no React, no DB:

| File | Contents |
|---|---|
| `types.ts` | `FrameConfiguration`, `FrameGeometry`, `PricedComponent`, `LinePricing`, `MatLayer` |
| `geometry.ts` | `resolveArtworkSize`, `matOpenings`, `matOuter`, `frameOutside`, `mouldingFootage`, `resolveGeometry`, `glazingCutSize`, `areaSqIn`, `perimeterIn` |
| `pricing.ts` | `priceComponents`, `priceLine`, `unitPrice` — one engine, `billingMode` only sets `billedLineCount` |
| `description.ts` | `articleLines` (generated, never typed by the operator), `specSummary` |
| `validation.ts` | `matFitsSheet` (rotation-aware), `validateConfiguration` |

Test framework: **vitest added** (none existed). `npm test` / `npm run test:watch`.
38 tests covering every case the brief asked for — no mat, single mat, triple mat with unequal L/W
reveals, `size_mode = outside` round-trip, and the sheet-overflow boundary — plus billing-mode
equivalence, quantity scaling, and rate-source labelling.

#### ⚠️ Schema defect found by the tests — fixed in `20260901100000_add_chop_join_framing_configuration.sql`

Step 1 specified `NUMERIC(8,3)` for inches. That is **wrong for this domain**: framing works in
sixteenths (0.0625), and glass/backing are cut one sixteenth under the mat outer. A 15.75″ mat outer
gives a real cut size of **15.6875″** — four decimals. `NUMERIC(8,3)` silently stores 15.688,
handing the workshop a cut a thousandth of an inch off on every fractional cut.

All dimension columns widened to `NUMERIC(9,4)`. Verified: `15.6875::NUMERIC(9,4)` → `15.6875`,
where `::NUMERIC(8,3)` → `15.688`. Caught before any data existed. §4e of this plan is corrected
accordingly.


### Step 3 — what landed

`src/components/framing/`:

| File | Purpose |
|---|---|
| `FrameConfigurationDialog.tsx` | The large modal. Left pane: moulding picker, artwork size + size-mode toggle, matting with layers, glazing, backing & hardware. Right pane: live SVG preview, computed readouts (mat outer / frame outside / footage / line total), sheet-fit warning, and a **"what the customer sees"** panel that switches between per-part rows and a single rolled-up row. |
| `MatLayerRow.tsx` | One mat layer — board picker, border-or-reveal L/W, per-area rate, remove. Labels change between *border* (top mat) and *reveal* (lower layers). |
| `FramePreview.tsx` | Concentric SVG cross-section, ported from the prototype's `svgFrame()`. Frame colour tracks the billing mode. |

`src/lib/framing/tiers.ts` — resolves the moulding rate from `item_prices`:
`framing` mode reads the `framing` tier, `chop_join` reads `chop_join`. **Returns null rather than
falling back** to a customer-segment tier — silently billing an `srp` price as a framing rate would
be worse than refusing to price the line, so the dialog surfaces a "no framing price on this item"
warning instead. Switching billing mode inside the dialog re-reads the rate from the other tier.

All UI text goes through `next-intl` (`framingDialog` namespace, en + zh) per repo convention.

**Verified:** `tsc --noEmit` clean, `eslint` clean, **44 tests passing** (38 domain + 6 tier
resolution). The app compiles with the new components — `/sales/quotations/create` returns 200 with
no build-error markers (it redirects to login, as expected for an auth-gated route).

> Not yet wired into `QuotationLineItemDialog` — that is Step 4. The dialog is currently a
> standalone component with a typed `onApply` contract; nothing renders it yet.


### Step 4 — what landed

**Persistence** — `20260901120000_persist_chop_join_framing_details.sql`:
- `save_sales_quotation_item_frame_details` extended to store `billing_mode`, the chop & join
  geometry, and a `matLayers` array. Billing mode **defaults** `invoice_display_mode`
  (`chop_join` → `components`, `framing` → `summary`) while leaving an explicit value able to win.
- Invalid billing modes raise `FRAME_CONFIG_INVALID_BILLING_MODE` rather than silently defaulting.
- New trigger `trg_soft_delete_quotation_mat_layers` cascades the soft-delete from a configuration
  to its mat layers. **Without this the existing update path — which soft-deletes the configuration
  then re-saves — would leave orphaned layers that collide with the re-inserted ones** on the
  `(configuration_id, layer_index)` unique constraint.

**Read path** — `src/app/api/quotations/_shared.ts`:
- Config row type extended; new mat-layer fetch keyed by configuration id; both mapped onto
  `QuotationLineItem.frameConfiguration` / `.matLayers`.
- Two `select("*")` wildcards **replaced with explicit column lists** (repo rule: fix wildcards in
  any query you touch). Two further wildcards remain in this file on `sales_quotations` and
  `sales_quotation_items` — untouched by this step, so left alone rather than expanding scope.
- Removed a **duplicated local `DbQuotationItemConfiguration`** in `available-lines/route.ts` that
  shadowed the shared one; it now imports the exported shared type, so the two cannot drift again.

**Types** — `src/types/quotation.ts` gains `FrameBillingMode`, `FrameSizeMode`, `FrameMatSource`,
`FrameQuotationMatLayer`, and the chop & join fields on `FrameQuotationConfiguration`.

**Verified:**
- Round-trip through the real RPC: mode `chop_join` → display `components`, geometry stored at full
  4-decimal precision, 2 mat layers + components persisted ✅
- Soft-delete cascade: layers drop to 0 when the configuration is soft-deleted ✅
- `tsc --noEmit`, `eslint`, 44 tests, `activity-logging:check` all clean ✅

**Regression tested end-to-end under a real authenticated session** (2026-09-01). The earlier
`auth.uid()` gap is closed — impersonating the `demo@pragmatica.app` user via JWT claims, with the
`authenticated` role active and RLS enforcing:

| Case | Result |
|---|---|
| One quotation mixing all three line types | 3 lines created ✅ |
| Chop & join line | `display=components`, artwork `15.0000x12.0000`, overlap `0.1250`, 2 mat layers ✅ |
| Framing line | `display=summary`, artwork `16.0000x20.0000`, 1 mat layer ✅ |
| Raw-material line | no configuration row, as intended ✅ |
| **Edit: 2 layers → 1, mode flipped** | live layers 2 → 1, `display` followed `summary`, `matSource`→customer, border `4.0000` ✅ |
| **Orphaned layers after edit** | **0** — the cascade trigger works ✅ |

The edit case is the one that would silently break without `trg_soft_delete_quotation_mat_layers`:
the update path soft-deletes then re-saves, so surviving layers would collide on the layer-index
unique constraint. All test data rolled back; database left clean.

> **UI entry point is still minimal.** `QuotationLineItemDialog` now carries `matLayers` on its
> payload, but the chop & join / framing *launcher* (the three-way line-type chooser from the
> approved prototype) is not yet built into it — the `FrameConfigurationDialog` exists and is
> wired for persistence, but a user cannot yet open it from the quotation screen. That belongs
> with Step 5/6 UI work.


### Step 4b — UI entry point

Built ahead of Step 5 so the feature is reachable and reviewable before another layer lands on top.

- **`QuotationForm`**: the single "Add Item" button is now a three-way chooser — **Raw material**
  (existing dialog, unchanged), **Chop & join**, **Framing**. The two configured modes open
  `FrameConfigurationDialog` with the billing mode preset.
- **`src/lib/framing/toLineItem.ts`**: converts a dialog result into a quotation line — plain
  item/qty/price fields, the configuration, the component rows, and the mat layers. Billing mode
  sets `invoiceDisplayMode` here, which is what makes the same stored data print two different ways.
- Chooser labels added to the `quotationForm` namespace (en + zh).

**15 new tests** (59 total) covering the converter: billing mode → display mode, geometry mapping,
mat-layer emission and index preservation, component-type mapping, and the line-total match against
the domain module.

> **Modelling consequence, since resolved in Step 4c.** `sales_quotation_item_components.item_id`
> is `NOT NULL`, and at the time Step 4b landed, fitting hardware had no inventory item behind it —
> so hardware priced into the line total but was dropped from the stored breakdown. **Step 4c closed
> this** by seeding real hardware items; hardware now persists as its own component row and prints
> on the invoice. See Step 4c below.

### Step 4c — Fitting hardware as real inventory items ✅ Done

Closes the gap Step 4b flagged. The source invoices bill `FLEXIPOINTS 1/1` and `MULTIPOINTS 2/3` as
their own printed lines, so hardware has to reach the persisted breakdown — pricing it silently into
the line total would bill the customer for something their invoice never names.

Chosen over relaxing `item_id` to nullable because these are real things the shop stocks and
consumes; making them items also means hardware draws down inventory like every other component.

- **`supabase/seed.sql`** — seeds four `raw_material` items under
  `Accessories`, uom `PCS`, each with a `default`-tier price. Idempotent (re-run inserts 0 rows).

  | Code | Name | Rate |
  |---|---|---|
  | `FIT-FLEXI` | Flexipoints | ₱1.50 |
  | `FIT-MULTI` | Multipoints | ₱8.00 |
  | `FIT-LSUP-S` | L-Support (Small) | ₱35.00 |
  | `FIT-LSUP-B` | L-Support (Big) | ₱60.00 |

  > **Superseded.** The point rates are no longer per-piece and the L-support prices were wrong —
  > see *Step 12 — Point fractions and flat L-support charges* below for the current figures.

- **`FittingHardware`** (`types.ts`) — each entry gained `itemId`. Small and big L-support are
  separate items, so `lSupport.itemId` follows `lSupport.size`.
- **`pricing.ts`** — hardware components carry those ids instead of `null`.
- **`useFramingHardware.ts`** (new) — resolves the four items by code and exposes rates + ids.
- **`FrameConfigurationDialog`** — attaches ids and rates once the catalogue loads; the size toggle
  swaps the L-support item.
- **`toLineItem.ts`** — the `itemId !== null` filter stays as a defensive guard (the column is still
  `NOT NULL`), but no longer drops hardware in practice.

**Verified end-to-end** against the local DB as the demo user: a chop & join quotation line persists
both rows — `molding / 1574-36B-BLK / qty 7.975 / ₱269.27` and
`accessory / FIT-FLEXI / Flexipoints / qty 8 / ₱12.00`.

60 tests passing; typecheck and lint clean.

### Step 5 — Invoice rendering ✅ Done

`invoice_display_mode` now actually drives output. It was stored and shown as a label since Step 1,
but **no renderer branched on it** — every configured line printed its full parts breakdown
regardless of billing mode. On a framing line that exposed the shop's per-component rates to the
customer, and Step 4c made it worse by adding hardware rows to that table. Step 5 fixes it.

- **`src/lib/framing/formatInches.ts`** (new) — decimal inches → the shop's fraction notation
  (`15.6875` → `15 11/16`). Values snap to the nearest sixteenth first, so arithmetic drift prints
  as the measurement it represents. The paper invoices print fractions; a customer comparing a quote
  against an old receipt should see the same notation, and the workshop should not have to convert
  a decimal back by hand.
- **`src/lib/framing/invoicePresenter.ts`** (new) — the single place that turns a stored line into
  printable rows. Three surfaces render the same line (view dialog, PDF, and the Step 6 job-order
  print); duplicating the mode branch in each is how they drift, and drift here means the printed
  rows stop matching the printed total.
  - `components` → one row per part, in `sortOrder`
  - `summary` → a single finished-frame row
  - `both` → the frame row plus an indented breakdown, where **only the frame row is billed** —
    counting the breakdown too would double the invoice
  - Defaults to `summary` when the mode is missing, never to `components`: the safe direction is to
    withhold the breakdown, not to leak rates.
- **`toLineItem.ts`** — now writes the *printable* description onto each component
  (`"21 X 16 - GLASS"`). The cut size is a property of the line's geometry, not of the item, so it
  has to be captured at save time; previously `description` held `detail` ("Store-supplied board")
  and the printed invoice would have carried no dimensions at all. The `detail` suffix is
  deliberately dropped — it is noise on a customer invoice, and where detail equals the item name it
  read as a stutter (`"GLASS (GLASS)"`).
- **`QuotationPDF.tsx`** — the print layout now uses one continuous invoice table
  (`Qty / Unit / Description / Unit Price / Disc. / Amount`) instead of nesting a component table
  inside each quotation line. Configured lines use a subtle group row followed directly by their
  presenter rows; summary-only and plain inventory lines use bold top-level typography, separated
  from the regular-weight component rows so they cannot be mistaken for part of a preceding
  configured line. A restrained navy/slate visual hierarchy, compact totals block, and fixed
  quotation/page footer give the document a deliberate business-form layout in A4 portrait while
  preserving the presenter totals. The legacy Frame Size / Molding / Service detail grid remains
  removed because those fields were not populated by current configurations.
- **`QuotationViewDialog.tsx`** — presents quotation lines in a compact staff-facing table. Lines
  with priced framing components expose one flat `Qty / Unit / Description / Unit Price / Disc. /
  Amount` drill-down. Matting remains in that component list rather than a separate section. The
  duplicate **"What the customer sees"** panel was removed; the print preview remains the
  authoritative customer-facing view.
- **`vitest.config.ts`** — `include` covered only `*.test.ts`, so any `.tsx` test would have been
  silently skipped rather than reported; added `*.test.tsx` and the automatic JSX runtime.

**22 new tests** (82 total): fraction formatting including the sixteenth-snap and sub-inch cases,
and the presenter across all three modes — hardware itemised, sort order respected, rows summing to
the line total, and a framing line proven not to leak per-part rates.

**Verified beyond unit tests:**
- The PDF renders both modes through `renderToBuffer` without throwing (25KB output).
- Round-tripped through the local DB as the demo user: `chop_join / components` persists, and the
  rows read back as `7.975 | CUT | 23 1/4 X 20 1/4 - POLYSTYRENE MOULDING | 6.19 | 269.27` and
  `8 | CUT | Flexipoints | 1.50 | 12.00` — the notation of the paper receipts.

> **Still open for Step 6:** the two remaining print targets in §7 — the **job requisition form** and
> the **cut list** (glass/backing cut sizes, footage per material, per-layer mat openings). Both are
> workshop-facing and belong with the job order, so they land with the handoff rather than here.

### Step 6 — Job order handoff ✅ Done

One sales order now spawns one job order per billing mode present — up to two. Chop & join is a
cutting service billed per part; framing produces a finished frame. The shop runs them as separate
jobs, so a mixed order must not collapse into one.

- **`20260901140000_split_frame_job_orders_by_billing_mode.sql`** — rewrites
  `create_frame_job_order_from_sales_order_transaction` to loop over the distinct billing modes on
  the order, creating a job order per mode and reserving **only that mode's components**. Returns one
  row per job created (the return type gains `billing_mode`, so the old signature is dropped first —
  `CREATE OR REPLACE` cannot change OUT parameters).
  - A mode that already has an active job order is **skipped, not rejected**, so adding a second mode
    to an order later still works. Previously any second attempt raised
    `'This sales order already has a frame job order'` outright.
  - When every mode is already covered, it still raises — the caller asked for work and none was
    created.
  - `ux_frame_job_orders_active_sales_order_mode` (Step 1) already permitted one active job per
    `(sales_order_id, billing_mode)`; the function was the piece out of step with the schema.
- **`create-frame-job-order/route.ts`** — returned `rows[0]` and discarded the rest. Now returns
  `frameJobOrders` (all created), keeping `frameJobOrder` as the first for the existing contract.
- **`useSalesOrders.ts`** — the toast names both jobs and their modes when more than one is created.
- **Sales order pages** — navigated straight to `frameJobOrder.id`, which would silently hide the
  second job. Now route to the job-order list when more than one was created.

> **Prerequisite defect found and fixed.** Both sales-order write paths persisted
> `invoice_display_mode` but **not `billing_mode`**, nor any of the chop & join geometry
> (`artwork_length_in`, `frame_width_in`, `size_mode`, `overlap_in`, `mat_source`,
> `glazing_cut_to_mat_outer`). Every configuration converted from a quotation therefore defaulted to
> `'framing'`, and grouping by mode would have filed chop & join work under a framing job order.
> Fixed in `sales-orders/route.ts` and `sales-orders/[id]/route.ts`. The read side
> (`available-lines`) already selected these columns — only the writes were behind.

**Verified against the local DB** as the demo user, all rolled back:
- A mixed order (one chop & join line, one framing line) creates `FJO-000000001 | chop_join` and
  `FJO-000000002 | framing`, with components correctly partitioned — the flexipoints land on the
  chop & join job only — and reservations summed across both (moulding 5 + 7 = 12).
- Re-running with no new modes raises `'…already has a frame job order for every billing mode'`
  rather than duplicating.
- Adding a framing line to an order that already has a chop & join job creates **only** the framing
  job; the existing job is not re-created and its stock is not double-reserved.

> **Known gap, not addressed here:** `sales_order_item_mat_layers` exists in the schema but no route
> writes it, so mat layers are lost when a quotation is converted to a sales order. It does not
> affect job-order splitting (the layers' cost is already in the component rows), but the workshop
> cut list in §7 will need them. Tracked as Q4.

### Step 7 — Generated documents ✅ Done

**Correction to Steps 5 and 6.** Both deferred the §7 print targets, and Step 5 instead built an
invoice table derived from the paper receipts. That was the wrong output: the approved prototype
`chop-and-join-final.html` renders a **live two-tab "Generated document" panel** — Job requisition
and Cut list — beside the configuration form. The prototype was never opened before that rendering
code was written. It has now been rendered and matched directly.

- **`src/lib/framing/documents.ts`** (new) — ports the prototype's `artParts()` and `renderCut()`:
  - `articleLines()` — the bulleted Article / Description: matting count, then each board, then the
    emphasised moulding line carrying `-(Store)` / `-(Customer)` and every `w/ …` accessory tail.
  - `requisitionRow()` — quantity, `CUT`, and the **stacked dimension pair** (artwork size over the
    ghosted finished-outside size).
  - `cutListRows()` — Material / Spec / Per cut / Total, with moulding footage, per-layer mat outer
    and opening, the shared glass/backing clearance cut, and hardware counts × quantity.
  - `sheetFitWarning()` — the prototype's `fitCheck()`, comparing sorted dimensions so a rotated mat
    still counts as fitting.
- **`src/components/framing/GeneratedDocuments.tsx`** (new) — the panel itself, keeping the paper
  look (bordered table, ruled fill-in fields, signature lines). It renders on a white ground in both
  themes deliberately: it is a piece of paper the shop prints, not a UI surface.
- **`FrameConfigurationDialog`** — the panel sits in the right sidebar under the billing summary, so
  the document updates live as the frame is configured. Dialog widened to `max-w-7xl` and the
  sidebar to `420px` so the document is legible. `customerName` threaded through from
  `QuotationForm`.

**Deviations from the prototype, both deliberate:**
- **Fractions, not decimals.** The prototype prints `14.75`; this prints `14 3/4`, matching the paper
  receipts and the rest of the app (user decision). Fractions are wider, so the dimension cell was
  widened to 126px and each measurement set `whitespace-nowrap` — at the prototype's 112px the pair
  wrapped mid-measurement.
- **`role="tablist"` on the tab pair.** The prototype puts bare `aria-selected` on buttons, which is
  invalid; lint caught it.

**16 new tests** (98 total) covering the article lines (mat source, accessory tail, emphasis, the
no-mat and multi-layer cases) and the cut list (footage totals, shared clearance cut, hardware
multiplication, omission of unincluded hardware, L-supports fixed at four per frame).

**Verified visually** by rendering the components to static HTML and comparing against the prototype
screenshots: the requisition's stacked dimension pair, bulleted description with the emphasised
moulding line, `TOTAL CUTS` / `TOTAL SALES`, and both signature lines; and the cut list's seven row
types with the sheet-fit confirmation.

### Step 8 — Frame components dialog ✅ Done

**Second correction against the prototype.** Matting, glass, and backing were inline `<section>`
blocks on the main configuration form. In the prototype they live in their own **"Frame components"**
modal, reached from a *Configure components →* button, with the main form showing only three compact
summary rows. Inline, the glass and backing controls sat far enough down the form that they were
easy to miss entirely.

This was found by driving the prototype rather than reading it — the earlier pass had only
screenshotted the top of the page and never clicked *Configure components*.

- **`src/components/framing/FrameComponentsDialog.tsx`** (new) — a nested dialog holding the three
  sections as **accordions** (Matting / Glass / Backing & fitting), each showing a summary while
  collapsed (`Single · em-1024`, `Clear glass · 1 sheet`, `MDF · flexi ×8`). Right rail carries the
  frame preview, a 2×2 readout (Mat outer / Top opening / Frame outside / active-section amount),
  and the sheet-fit check. In chop & join, the amount follows the active component section so its
  discount visibly uses the amount shown beside it; framing retains the whole line total because
  its components are not billed separately. Footer: spec summary, Cancel, **Apply to frame**.
- **Draft-and-apply**, as the prototype does it: edits are held in local draft state and only reach
  the frame on Apply, so Cancel discards component changes without disturbing the geometry the user
  already entered.
- **`FrameConfigurationDialog`** — the three sections were removed and replaced by three
  `SummaryRow`s (swatch · label · value · right-aligned meta) plus the trigger button. Seven now-dead
  symbols (`Plus`, `Checkbox`, `MatLayerRow`, `suggestedGlassRate`, `updateLayer`, `addLayer`,
  `removeLayer`, `MatLayer`, `DEFAULT_MAT_RATE`, `MAX_MAT_LAYERS`) went with them.

**Deviation from the prototype, by decision:** the prototype offers glass and backing as fixed
option cards with hardcoded rates (Clear glass ₱220/sq.ft, MDF ₱90/sq.ft…). We keep **ItemSelect
dropdowns** inside the accordions, so the picker stays driven by the real item catalogue and by the
user-entered per-area rates decided in §3. The accordion layout is the prototype's; the pickers are
ours.

**Verified visually** by rendering the summary rows and the dialog and comparing against the
prototype: the three summary rows with their metas, the expanded Matting body (Include matting,
Store / Customer supplied, TOP MAT card with border and rate fields, Add mat layer), the two
collapsed accordions with their summaries, and the right rail and footer.

New i18n namespace `frameComponentsDialog` plus ten new `framingDialog` keys, all at en/zh parity.

### Step 9 — Layout pass ✅ Done

The configuration dialog was crowded: a `1fr / 420px` split put **five** stacked blocks in the right
column — frame preview, four readout cards, fit alert, a billing-summary list, and the full paper
requisition. The requisition is a fixed-shape form, so at that width its description column collapsed
to a few characters per line.

The prototype solves this with different proportions — `minmax(540px,1.1fr) / minmax(420px,.9fr)`,
a near-even split — and by putting the derived sizes **inline on the form**, under the fields that
produce them, rather than stacked in the sidebar.

- **Even split with real floors.** `xl:grid-cols-[minmax(520px,1.05fr)_minmax(440px,0.95fr)]`, and
  the dialog widened to `max-w-[1240px]`. The floors matter more than the ratio: below ~440px the
  requisition is unreadable, so the grid now **stacks instead of compressing**. The breakpoint moved
  `lg:` → `xl:` for the same reason.
- **Readouts moved inline.** Mat outer / Frame outside / Moulding footage now sit in a three-column
  row under the size fields, tinted (`bg-primary/5`) so they read as output rather than as more
  inputs — the prototype's `.readout` treatment.
- **Billing-summary list removed.** The requisition directly below it already itemises the line;
  two breakdowns stacked in one column was most of the crowding.
- **Requisition table columns rebalanced** — the dimension cell shrinks to its content
  (`w-px whitespace-nowrap`) instead of holding a fixed 126px, and the three leading columns
  narrowed, giving the description the width it actually needs.
- **Spec line wraps** instead of being truncated by the *Configure components* button.
- **Components dialog**: `max-w-[980px]`, `minmax(420px,1fr) / 300px`, roomier accordion bodies
  (`p-5`, `space-y-4`), and its readouts stack one per row with `whitespace-nowrap` so a dimension
  pair never breaks mid-measurement.

**Verified visually at desktop width** — before/after comparison confirmed the description column
went from seven wrapped lines to four, the spec line stopped truncating, and every dimension pair
now renders whole.

### Step 10 — Glass chosen by type ✅ Done

The user supplied a screenshot of the **legacy job-order glass dialog**: a "Based on Outer Size"
checkbox, five glass types as checkboxes (With Glass / Double Glass / Acrylic / Non Glare / Octagon
Glass), a quantity box beside Double Glass only, and a Remarks field.

Glass had been an `ItemSelect` against the catalogue. That was wrong on the data, not just the
layout: **the catalogue's glass items are pre-cut stock sizes** (`10" X 12" A CUT SIZE CLEAR GLASS`)
and sheet stock, while custom framing cuts glass to the frame's own size. Picking "10 × 12 cut size"
for an 11¾ × 13¾ frame records something the shop will not actually use.

- **`GlazingType`** (`types.ts`) — `clear | double | acrylic | non_glare | octagon`, with
  `GLAZING_TYPES` carrying display order and swatches, and `glazingFallbackLabel()` for the label
  written onto component rows. `GlazingConfig` gains `glazingType` and an optional `remarks`.
- **`glazingSheetsEditable(type)`** — the one rule worth naming: double glass sandwiches the artwork
  between two panes, so it is the only type whose sheet count is the user's to set. Every other type
  is a single pane, fixed at 1.
- **Glazing section** — the `ItemSelect` is replaced by the prototype's **option cards**, one type
  only. Selecting a type sets the label, and resets `sheets` to 1 (or lifts it to at least 2 for
  double glass) so a stale count cannot survive a type change. The Sheets input is `readOnly` and
  visually muted for single-pane types, with a title explaining why. Optional Remarks added.
- **`documents.ts`** — the cut list and requisition now read `config.glazing.label` first, falling
  back to `labels.glazing` only for rows saved before this change. Glass is no longer a catalogue
  pick, so the configuration's own label is authoritative.

**Decisions taken from the user, deliberately narrower than the legacy screen:** one type only (the
legacy dialog allows several at once, which would need glazing to become a row list rather than the
single config it is today), and Remarks optional rather than required.

**5 new tests** (103 total): the sheets rule across all five types, the offered list and its order,
the chosen type reaching both documents, and double glass billing by its pane count (2 panes × 2
frames = 4).

**Verified visually** — both the double-glass state (editable sheets) and a single-pane state
(read-only, muted) rendered and checked.

> **Not carried over from the legacy screen:** its "Based on Outer Size" checkbox is our existing
> `cutToMatOuter`, already present. Its required-Remarks behaviour was declined in favour of optional.

### Step 11 — Backing by type, and the items behind both ✅ Done

Backing had the same defect as glass: an `ItemSelect` against a catalogue of **pre-cut stock sizes**
(`8 X 10 BACKING PLAIN MDF`), when custom framing cuts the board to the frame's own size. It now uses
the prototype's four option cards — MDF, Plywood, Sintra board, Foam board — under a **Board**
heading, with **Fitting hardware** below, matching the prototype's section structure.

- **`BackingType`** (`types.ts`) — `mdf | plywood | sintra | foam`, with `BACKING_TYPES` for display
  order and swatches. `BackingConfig.backingType` is nullable: a frame can legitimately have no
  backing, and tapping the selected card clears it.
- **Five call sites re-gated** from `backing.backingItemId` to `backing.backingType`
  (`description.ts` ×2, `documents.ts`, `pricing.ts`). Without this backing would have silently
  disappeared from pricing and both documents, since the item id is now null until resolved.

> **Regression this exposed, and fixed.** Once glass and backing stopped carrying catalogue items,
> `toLineItem`'s `item_id IS NOT NULL` guard **dropped both from the persisted component rows** while
> they still priced into the line total — verified: 2 components dropped, total unchanged at 358.55.
> A chop & join invoice would have billed for glass and backing without naming either. This is
> exactly the defect Step 4c fixed for hardware, and it is fixed the same way:
>
> - **`supabase/seed.sql`** — one item per type (`GLZ-CLEAR`,
>   `GLZ-DOUBLE`, `GLZ-ACRYLIC`, `GLZ-NONGLR`, `GLZ-OCTAGON`, `BCK-MDF`, `BCK-PLY`, `BCK-SINTRA`,
>   `BCK-FOAM`), named "(cut to size)" to distinguish them from the pre-cut stock items. No price
>   rows: the per-square-inch rates stay user-entered per §3. Idempotent (re-run inserts 0).
> - **`useFramingMaterials.ts`** (new) — resolves them by code; selecting a type attaches its id, and
>   an effect backfills ids for a configuration opened before the catalogue loads.

**Second bug found while verifying.** With no catalogue option behind them, `invoiceDescription` fell
back to the priced component's `label` — a display string that already embeds the raw size — printing
`18 11/16 X 15 11/16 - 18.6875 × 15.6875 glass`. Added `componentName()`, which takes glass and
backing names from the configuration instead. Now reads `18 11/16 X 15 11/16 - With Double Glass`.

**3 new tests** (106 total) covering both regressions: that glass and backing reach the persisted
rows, that their descriptions name the type without repeating the size, and that backing is omitted
entirely when no board is chosen.

**Verified against the local DB** as the demo user (rolled back): rows persist as
`GLZ-DOUBLE | 18 11/16 X 15 11/16 - With Double Glass | 205.15` and
`BCK-PLY | 18 11/16 X 15 11/16 - Plywood | 46.89`.

> **Mat keeps its `ItemSelect`** — mat boards are genuinely chosen from stock by colour and sheet
> size, so the picker is right there. Only glass and backing were miscategorised.

### Step 12 — One dialog per component ✅ Done

The three components shared a single dialog with three accordions. They are now **three separate
dialogs**, each opened by a ⋯ button on its own summary row — matting, glazing, and backing are
distinct sub-configurations, and stacking them in one form meant scrolling past two to reach the third.

- **`FrameComponentsDialog` takes a `section` prop** (`matting | glazing | backing`) and renders that
  component's controls alone. The section bodies were not rewritten — the accordion wrappers were
  replaced with a conditional, so the three dialogs share one implementation and cannot drift.
- **`SummaryRow` gained `onConfigure`** and a trailing ⋯ (`MoreHorizontal`), labelled per row
  (`Configure Matting`, `Configure Glass`, `Configure Backing & fitting`) for screen readers.
- **State is one value**, `componentsSection: "matting" | "glazing" | "backing" | null` — null closes
  the dialog, so two cannot be open at once.
- **`Configure components →` removed** (user's call). The three ⋯ menus fully replace it; keeping both
  would have meant two routes to the same editing.
- **Dead code removed**: the `Accordion` component, the `summaries` map, `matCountWord`,
  `backingSummary`, and the now-orphaned `none` / `sheet` translation keys. The row values on the
  main form already carry what the accordion summaries showed.

> **Empty-state fix (user asked for it in passing).** The matting row read **"Single mat"** next to
> **"No board chosen"** — claiming a configuration that did not exist. `matLabel` now returns
> "No matting" until matting is actually switched on.

**Not changed:** the ⋯ opens the dialog directly rather than a dropdown menu (user's call). If
per-row actions beyond editing are wanted later — Clear, Remove — a menu is the natural upgrade.

### Step 13 — Opening a dialog includes the component ✅ Done

With each component behind its own ⋯, an "Include matting" checkbox inside the matting dialog is
redundant: clicking ⋯ already expresses the intent. Both include checkboxes are removed.

- **Matting** — opening the dialog sets `included: true` and seeds **one mat layer** (single matt) so
  there is something to edit immediately. The `draft.mat.included` guard around the body is gone; the
  section renders unconditionally.
- **Glazing** — same rule, applied at the user's request. Opening sets `included: true` and takes the
  suggested rate for the frame's size (₱0.35 at ≥15″, ₱0.25 below), which is what the removed
  checkbox used to do.
- **Turning matting off** — removing the last mat layer sets `included: false`, and the row returns
  to "No matting". This required a fix: `onRemove` was `null` for the top layer, so the last layer
  could not be removed and matting could never have been switched off.
- **Turning glazing off** — tapping the selected glass card deselects it, matching how backing
  already worked. The rate/sheets/cut-to-outer row and the remarks field are hidden while no type is
  selected.
- `includeMatting` / `includeGlazing` translation keys removed from both locales.

**Verified** the three domain states price and describe correctly: nothing included → one `moulding`
component and "No components"; one mat layer → `moulding, mat` and "Single matting"; after removal →
back to "No components". Matting dialog rendered to confirm no checkbox and a seeded top mat.

### Step 14 — Mat positions on the requisition ✅ Done

The requisition listed mat boards as bare names, so a double or triple mat printed an unordered list
of board codes with nothing saying which went on top. The workshop could not tell the order.

- **`articleLines()`** now prefixes each board with its position — `Top mat — em-1024 white`,
  `2nd mat — em-3301 grey`, `3rd mat — em-5510 burgundy` — reusing the same `layerLabel()` the cut
  list already used, so the two documents agree.
- **A single mat stays unqualified.** "Top mat" on a lone layer reads as though a second one is
  missing, so the prefix appears only when there is more than one.

> **The prototype has this defect too** — its `artParts()` pushes bare board names the same way. This
> is a deliberate divergence, not a port: the prototype is the visual reference, but here it omits
> information the shop needs.

The source receipts do not settle the question — their `-INNER` / `-OUTER` suffixes mark a
frame-within-a-frame on the *moulding* codes, not mat layers.

**2 new tests** (108 total): three labelled positions on a triple mat, and a single mat left
unqualified. Rendered a triple-mat requisition to confirm it reads cleanly on the paper form.

### Step 15b — Wider dialog for the requisition ✅ Done

The grouped blocks made the Article column taller and denser, and at the previous width its content
wrapped mid-phrase.

- Dialog `max-w-[1240px]` → **`max-w-[1440px]`**.
- Split flipped so the **document takes the larger half**:
  `minmax(520px,1.05fr) minmax(440px,0.95fr)` → `minmax(520px,0.95fr) minmax(560px,1.05fr)`.
  The form pane does not shrink — it goes 626px → 683px; the document goes 566px → **755px**.
- The document's floor rose 440px → 560px, so below that the grid still stacks rather than
  compressing the form past legibility.

**Measured before/after** at the same content, rather than judged by eye:

| | Before (566px) | After (755px) |
|---|---|---|
| Moulding line | 2 lines (wrapped) | **1 line** |
| Finishing line | 2 lines (wrapped) | **1 line** |
| Form height | 317px | **283px** |

The form is *shorter* despite the pane being wider, because nothing wraps any more.

### Step 15 — Grouped Article / Description ✅ Done

The column ended in one run-on line that packed the moulding, mat source, glass, backing and every
piece of hardware together:

```
1574-36B-BLK BLK POLYSTYRENE MOULDING -(Store) w/ With Double Glass w/ MDF w/ Flexi ×8 w/ L-support big
```

Five designs were rendered on the real form for comparison
([artifact](https://claude.ai/code/artifact/29ef64ab-3059-4e19-968b-24f2c8be29a1)); the user chose
**grouped blocks**, with the first heading renamed from "Frame" to **Moulding**.

- **`articleBlocks()`** replaces `articleLines()` in `documents.ts`, returning
  `{ heading, lines, emphasis }[]` — a shape the flat bullet list could not express. Three fixed
  headings, so every part lands in a predictable place:
  - **Moulding** — emphasised, the line the shop reads first
  - **Matting — triple, store-supplied** — the count and who supplied the board ride on the heading;
    the lines beneath are purely the boards, each marked `bullet` to print indented
  - **Finishing** — glass, backing and hardware joined by middots
- **Empty groups are omitted**, not printed as "None": a frame with no mat carries no Matting
  heading, and one with nothing finishing it carries no Finishing heading.
- **Four defects fixed** along the way: `w/` repeated five times; `w/ With Double Glass` stuttering
  because the type label already begins with "With"; `-(Store)` shop shorthand replaced with
  `store-supplied`; and no grouping at all.

> **A superseded duplicate was removed.** `description.ts` carried its own older `articleLines()`
> with the same `w/` run-on and a `— (Store)` suffix. Nothing but its own two tests still called it —
> the requisition has used `documents.ts` since Step 7 — so it was deleted along with the now-unused
> `matSourceLabel`. Leaving it would have left a stale second version of this exact output in the
> tree, ready to be picked up by mistake.

**Test count went 111 → 109**: 12 rewritten for the block shape, 2 removed with the dead function.

### Step 16 — Editing a configured line ✅ Done

`handleEditItem` always opened the plain `QuotationLineItemDialog`, whatever the line was. Editing a
chop & join or framing line therefore dropped into the generic item form, and **re-saving from it
would have discarded the entire configuration** — geometry, mats, components, all of it. The
`frameDialog` state already carried `index` and `initial` for editing; nothing ever routed to it.

- **`src/lib/framing/fromLineItem.ts`** (new) — the inverse of `toLineItem`. Rebuilds an editable
  `FrameConfiguration` from a saved line, and returns null for a plain item so the caller falls back.
- **`handleEditItem`** now tries `frameLineToConfig` first and opens the frame dialog when it
  resolves, with the line's own billing mode.

> **Two schema gaps had to be closed first.** The configuration tables stored no glass type, backing
> type, or their per-square-inch rates — those lived only on component rows. That is enough to
> *print* a saved line but not to *edit* one, and reading a glass type back out of
> `"19 11/16 X 16 11/16 - With Double Glass"` would be guesswork.
>
> - **`20260901100000_add_chop_join_framing_configuration.sql`** — adds `glazing_type`, `glazing_included`,
>   `glazing_unit_rate`, `glazing_sheets`, `glazing_remarks`, `backing_type`, `backing_unit_rate` and
>   `mat_included` to both configuration tables, with CHECK constraints on the two type columns. Also
>   backfills `mat_included` from existing mat-layer rows so saved lines don't all read as mat-less.
> - **`20260901120000_persist_chop_join_framing_details.sql`** — teaches
>   `save_sales_quotation_item_frame_details` to write them.
>
> The read path (`_shared.ts` projection + transform, with `asFrameGlazingType` /
> `asFrameBackingType` narrowing), `available-lines`, and both sales-order write paths were extended
> to carry them too — the last of these is the same class of gap Step 6 found.

> **A pre-existing bug found in passing:** `QuotationForm` never plumbed `matLayers` on either the
> load or the submit path, so **mats were being lost on every save from this form**, not just on
> edit. Both paths fixed.

**11 new tests** (120 total) covering the round trip: geometry, billing mode, glass type/rate/sheets/
remarks, backing type/rate, per-layer mat borders, hardware rebuilt from component rows, the no-mat
case, and a **double round trip** proving repeated edits do not drift.

**Verified against the local DB** (rolled back): a saved line reads back as
`non_glare rate=0.3500 back=foam matIncl=false`, and a two-layer mat round-trips with each layer's
own border (2″ and ¼″).

> **The Supabase CLI works after all.** `supabase gen types typescript --local` fails on the broken
> `.env.local`, but **`--db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres` bypasses that
> parsing entirely**. Both type files are now genuinely generated rather than hand-maintained — which
> also confirmed every migration applied this session matches what the code expects. Use that flag
> until `.env.local` is fixed.

### Step 17 — Moulding price checked during selection ✅ Done

The "no Chop & join price" warning only appeared *after* an unpriced moulding was chosen. It now
shows in the picker itself, so the problem is visible while choosing.

- **`renderTrailing`** on the moulding `ItemSelect` marks any moulding with no tier for the active
  billing mode as **"No price"**, per row, before selection. (6 of the 246 catalogued mouldings are
  in this state — the `6123-*` group.)
- The full explanation still appears once such a moulding is selected; the picker flag is the early
  warning, not a replacement.

> **Two real bugs surfaced while investigating.** The moulding in the screenshot, `057-10`, *does*
> carry both tiers (chop_join ₱1.98, framing ₱4.39) — so the warning was a **false positive**, and
> its cause was the Step 16 edit path:
>
> 1. **The warning fired on every edit.** `frameLineToConfig` rebuilds the moulding from stored
>    columns, which carry no price tiers, and `mouldingRateMissing` read absent tiers as "no rate".
>    It now requires tiers to actually be present before judging a moulding unpriced.
> 2. **Editing a line silently zeroed its moulding rate.** The billing-mode effect re-resolved the
>    rate from those same absent tiers, got null, and overwrote the rate restored from the saved
>    component row — so an edited line would have re-priced at ₱0. The effect now returns early when
>    there are no tiers to read.
>
> The second is the more serious: it changed money, not just a message.

- **`canApply` now blocks on a genuinely missing rate.** It previously checked only validation errors
  and that a moulding was set, so an unpriced moulding could be applied and saved at ₱0 despite the
  warning.

**5 new tests** (125 total): the rate restored from the component row, the restored moulding
carrying no tiers, and `resolveMouldingRate` across the three real catalogue shapes — priced on both
tiers, priced only on customer-segment tiers, and tiers unknown.

### Step 18 — A configured line reads as a frame ✅ Done

**Not a pricing bug.** The user asked why a chop & join line shows one moulding rather than every
billable part. That is Decision 1 — *one stored line, exploded at render time* — and the line total
is already the sum of every component. Verified on a real configuration:

| Part | Amount |
|---|---|
| moulding | ₱15.79 |
| mat | ₱147.66 |
| glazing | ₱102.61 |
| backing | ₱46.91 |
| flexipoints | ₱12.00 |
| **line total** | **₱324.97** |

The moulding is under 5% of the line. The confusion was real, though, and it was a **display**
defect: the row rendered only `itemName` / `itemCode` — the moulding's — and **never rendered
`item.description`**, which carries the spec (`15″ × 12″ — Single matting · Clear glass · MDF`). A
configured frame was indistinguishable from buying a length of moulding at an inexplicable price.

- The row now shows a **billing-mode badge** (Chop & join / Framing) beside the item code and the
  **spec line**, so it reads as a configured frame rather than a moulding purchase.

> **"Bills as N parts on the invoice" was removed** at the user's request (2026-09-01), along with
> its `billsAsParts` key. The badge and spec line already distinguish a configured line; the part
> count was detail belonging to the invoice, not the quotation's editing table.
- Plain item rows are unchanged.

**2 new tests** (127 total) pinning the contract: the line total equals the sum of all components and
the moulding is a minority of it, and the description names the size and spec.

### Step 18b — The exact line total survives the save ✅ Done

`calculate_sales_quotation_item` derived `line_total` from `quantity × rate`, discarding whatever
total the caller sent. For a plain item that is right. For a configured frame it is not: the total is
the **sum of printed component amounts**, and `rate` is a rounded per-frame view of it, so
multiplying back cannot recover it. A 5-frame line totalling ₱1,624.79 stored as ₱1,624.80 — the
invoice's own rows then failed to add up to its total.

- **`20260901180000_honour_explicit_line_total.sql`** — an explicit `lineTotal` now wins, exactly as
  the function already honoured an explicit `discountAmount` and `taxAmount`. Callers that omit it
  are unaffected, and the update path shares the same calculator.
- `CreateQuotationItemRequest.lineTotal` added, and `QuotationForm` now sends it.

**Verified**: a line sent as `rate 324.96 × qty 5` with `lineTotal 1624.79` stores 1624.79, where it
previously stored 1624.80.

> The user reported a **₱3.00** discrepancy. This fixes a real defect but only a **₱0.01** one —
> rounding is bounded at roughly ±half a cent per unit, and no quantity turns 155.63 into 158.63.
> The larger gap is still unexplained and likely a component counted in one view and not the other.

### Step 19 — Configured lines are sold in pieces ✅ Done

The quotation row took the **moulding's** unit, so a framing line read **STICK** — how the raw
moulding is stocked, not what the customer buys. A chop & join line restored from an edit read blank,
because `fromLineItem` rebuilds its option with `uom: ""`.

- `frameConfigToLineItem` takes an explicit `frameUom`; `QuotationForm` resolves **PCS** from
  `useUnitsOfMeasure` and passes it. The line's quantity counts finished frames, so pieces is what it
  is measured in.
- **Components keep their own items' units** — the moulding component is still consumed by the STICK.
  Only the line header is in frames.
- Glass and backing are chosen by type and have no catalogue option to take a unit from; they fall
  back to the frame unit, being cut pieces themselves.

**4 new tests** (132 total): the frame unit overrides the moulding's, the moulding's is still the
fallback when none is given, components keep their own, and type-chosen components take the frame
unit. Verified PCS is active and unfiltered in the units API.

### Step 20 — The mat opening is sized to the artwork ✅ Done

`overlap_in` defaulted to **0.125**, so every mat opening was cut an eighth of an inch smaller than
the artwork on each edge. An 8 × 10 artwork with a 2″ border produced an **11¾ × 13¾** mat outer
where the shop expects **12 × 14** — the border is added to the artwork, not to a shrunken opening.

**User's decision:** drop the overlap. The border stays **per side**, so 2″ adds 4″ to each
dimension.

| | Before (overlap ⅛″) | After (overlap 0) |
|---|---|---|
| artwork | 8 × 10 | 8 × 10 |
| mat opening | 7¾ × 9¾ | **8 × 10** |
| mat outer | 11¾ × 13¾ | **12 × 14** |
| glass / backing | 11¹¹⁄₁₆ × 13¹¹⁄₁₆ | 11¹⁵⁄₁₆ × 13¹⁵⁄₁₆ |
| frame outside | 16¼ × 18¼ | 16½ × 18½ |
| line total (×5) | ₱874.46 | **₱907.79** |

- **`20260901100000_add_chop_join_framing_configuration.sql`** — column default 0 on both configuration tables.
- **`20260901120000_persist_chop_join_framing_details.sql`** — the save RPC carried its own
  `COALESCE(..., 0.125)` which **overrode the column default**; found by verifying a real insert
  rather than trusting the ALTER.
- UI default, `fromLineItem` fallback, and both sales-order conversion fallbacks set to 0.

> **The column stays.** An overlap is a real technique where the artwork must not fall through the
> window, and a line can still be given one — verified that an explicit `overlapIn: 0.125` is still
> honoured. It is simply no longer applied unasked.

> **Existing rows are left alone.** Their stored geometry produced prices already quoted; silently
> re-cutting saved work would change figures a customer may have seen.

**Note this moves money.** Mat, glass and backing are billed by area, so every new configured line
prices higher than it would have — ₱874.46 → ₱907.79 on the example above, about 3.8%.

**3 new tests** (135 total): the opening equals the artwork at zero overlap, a 2″ border adds 4″, and
an explicit overlap still applies.

### Step 21 — Borders on the requisition's mat lines ✅ Done

The Article column named each mat board but not what it was cut to, so the workshop could not work
from the form — the border is what decides the cut.

Each mat line now carries its measurement:

```
MATTING — TRIPLE, STORE-SUPPLIED
 · Top mat — em-1024 march mallow white, border 2″
 · 2nd mat — em-3301 charcoal grey, reveal 1/4″
 · 3rd mat — em-5510 burgundy, reveal 1/4″
```

- **"border" for the top mat, "reveal" beneath.** They are different measurements — a border is the
  band from the mat's outer edge to its opening; a reveal is the sliver of colour showing below the
  layer above — and the workshop cuts to both. Follows the prototype's own legend wording.
- **An even border collapses to one figure** — `border 2″`, not `2″ × 2″`, which is how the shop
  writes it. Uneven borders print both: `border 2″ × 3″`.

**4 new tests** (139 total). Two earlier tests asserted the exact mat line text and now match the
position prefix instead — they were written to check position naming, not the whole line.

### Step 22 — Mat cut size in the left pane ✅ Done

The requisition's left pane held two dimension pairs — artwork over the ghosted finished size — but
not the **mat cut**, which is what the border actually produces and the size the board is cut to.

The pane now prints the whole size chain:

```
ARTWORK    8  X  10
MAT CUT   12  X  14
OUTSIDE   16 1/2 X 18 1/2   (ghosted)
```

- **`RequisitionRow.matOuter`** added, nullable — a frame with no mat has none, and the pane simply
  omits the row rather than printing a placeholder.
- **The pairs are now labelled.** Two stacked pairs could be told apart by the ghosting; three could
  not. `DimensionPair` takes an optional label, and the ghosted outside size keeps its lighter
  treatment.

**5 new tests** (143 total): the mat cut for a plain 2″ border, widening for a lower layer's reveal,
the no-mat case, and the overlap case kept separate from the default.

> **A test-writing slip worth noting.** The first draft asserted 12 × 14 against a fixture that sets
> `overlapIn: 0.125`, where 11¾ × 13¾ is correct. The code was right; the expectations were wrong.
> The tests now state the overlap they exercise rather than assuming the default.

### Step 23 — Borders join the sizes in the left pane ✅ Done

**Supersedes Step 21's placement.** Step 21 put the border on each mat's article line
(`em-1024 march mallow white, border 2″`). The user preferred it in the left pane, beside the
dimensions it produces, with the mat cut size from Step 22 kept.

The left pane is now the whole cutting spec, and the article column is prose again:

```
ARTWORK   8      X  10          MOULDING
MAT CUT   12 1/2 X  14 1/2        057-02Q WHITE POLYSTYRENE …
──────────────────────          MATTING — TRIPLE, STORE-SUPPLIED
Top mat  border 2″                · Top mat — em-1024 march mallow white
2nd mat  reveal 1/4″              · 2nd mat — em-3301 charcoal grey
3rd mat  reveal 1/4″              · 3rd mat — em-5510 burgundy
                                FINISHING
                                  Clear glass · MDF backing · Flexipoints ×8
```

> **The finished outside size was removed** at the user's request (2026-09-01), along with its
> `outsideSize` translation key. Everything the pane now carries is something the workshop cuts to;
> the outside size is a consequence, not an instruction. `geometry.outside` still drives the cut
> list's moulding footage — only the printed pair went.

- **`RequisitionRow.matBorders`** — `{ label, text }` per layer, empty when there is no mat. The
  position label is blank for a lone mat, which needs no qualifier.
- `matBorderText` is unchanged, so the border/reveal distinction and the even-border collapse from
  Step 21 carry over intact — only the placement moved.
- A hairline rule separates the sizes from the borders, so the pane reads as two related groups
  rather than one run of figures.

**Test count 143 → 144**: four border-on-article tests moved to `requisitionRow`, one added for the
no-mat case, and the two assertions narrowed in Step 21 restored to exact matches now that the
article lines are plain board names again.

### Step 24 — One name per measurement ✅ Done

The outer edge of the mat board was called three different things: **"Mat outer"** in the
configuration dialog, **"Mat cut"** on the requisition, and hinted as **"glass size"** beside the
first. One number, three names.

- **"Mat cut" everywhere** — both `framingDialog.matOuter` and `framingDocuments.matSize` now carry
  the same wording in en and zh. (The keys keep their existing names; only the strings changed.)
- **The "glass size" hint is gone.** It duplicated what the cut list already states explicitly, and
  it was only true while *Cut to mat outer size* stayed ticked — it did not change when that was
  unticked, so it could mislead. It was also rendering as `Mat outerglass size`, running together.

> **"Top opening" was deliberately left alone.** It is the window cut in the board — a genuinely
> different measurement from the board's outer edge — so collapsing it into the same term would have
> lost information rather than simplified.

The `hint` prop on `Readout` stays: the moulding footage readout still uses it for `+10%`.

### Step 25 — Item material classification ✅ Done

The pricing formulas branch on what a moulding is made of — polystyrene uses `(L + W) × rate`, wood
uses `(L + W + FW) / 3 × rate × 20%` — but nothing on `items` distinguished them. `category_id` says
"Moldings" for both, and `item_type` already carries a different axis (`raw_material` /
`finished_good`).

- **`20260901210000_add_item_material.sql`** — adds `items.material`, CHECK-constrained to
  `polystyrene` / `wood`, and seeds all **246** Moldings rows to `polystyrene`. Idempotent (re-run
  updates 0). Scoped to Moldings: Glass and Backing have their own type systems and are untouched.
- **Nullable on purpose.** An unset material means *unclassified*, and pricing should refuse rather
  than assume polystyrene — a silent wrong assumption produces a mispriced quote, which is worse
  than a blocked one.
- `Item.material` added, and both item API transforms map it.

> **Name matching was ruled out by the data.** All 246 mouldings carry "POLYSTYRENE" in their name,
> and the single item containing "WOOD" is `057-10 MRN WOOD FINISH POLYSTYRENE` — a polystyrene
> moulding with a wood *finish*. A `LIKE '%WOOD%'` rule would misclassify the one item it would be
> tested against.

> **Two wildcard projections removed** from `items/route.ts` while threading the column through —
> `AGENTS.md` prohibits them and requires fixing any that a change touches. Both replaced with the
> explicit 34-column list.

Database types regenerated from the live schema rather than hand-edited.

**Chosen over the alternatives** — a generic `item_attributes` table would handle future axes without
migrations but constrains nothing, so a typo'd value fails silently in pricing code; sub-categories
under Moldings would reuse the unused `parent_id` but an item has only one category, so it cannot
express material *and* profile at once. A CHECK-constrained column is the smallest thing that
answers the axis actually needed.

> **Not yet wired to pricing.** The formulas themselves are unchanged — see the open question below.

### Step 26 — Moulding pricing follows the shop's formulas ✅ Done

The moulding was billed `outside perimeter ÷ 12 × 1.1 × rate`. The shop's own notes
(`chop-and-join-source-data.md`, Part 2) give a different formula on a different basis. On an 8 × 10
artwork with a 2″ border that was **₱12.71 against a correct ₱51.48** — roughly a quarter.

Three things were wrong, all confirmed by the user:

| | Was | Now |
|---|---|---|
| Basis | finished outside size (16½ × 18½) | **mat cut** (12 × 14) — `geometry.sight` |
| Shape | perimeter ÷ 12, billed per foot | **`L + W`**, billed per frame |
| Waste | × 1.1 | **none** — already in the per-unit rate |

**`mouldingCharge()`** in `pricing.ts` now implements the Standard variant:

```
polystyrene   (L + W) × rate
wood          (L + W + FW) / 3 × rate          (framing)
              (L + W + FW) / 3 × rate × 20%    (chop & join)
```

**Verified against the notes** — polystyrene chop & join ₱51.48 and framing ₱114.14 at the shop's own
tier rates; wood framing ₱244.83 and chop & join ₱48.97.

- **`FrameConfiguration.moulding.material`** added, read from the selected item, and
  **persisted** (`20260901100000` + `20260901120000`) so an edit reprices identically. Storing it
  rather than re-reading `items.material` means reclassifying an item never reprices an old quotation.
- **`validateConfiguration` refuses a moulding with no material.** Polystyrene and wood price
  differently, so an unclassified moulding cannot be priced — blocking is safer than defaulting.
- Threaded through `ItemSelectOption`, the read projection, `available-lines`, and both sales-order
  conversion paths.

> **`mouldingFootage` deliberately survives.** It still feeds the cut list and the dialog readout,
> which tell the workshop how much stock to pull — a material-planning figure, not money. Its comment
> and the readout's label (now "stock +10%") say so, since that ambiguity is what hid this bug.

> **Only the Standard variant is implemented.** Aquarium and Octagon are deferred at the user's
> request; they also carry an unresolved "less 30%" / "less 10%" discrepancy flagged in the notes.

**7 new tests** (151 total) covering all four formula branches, that the basis is the mat cut and not
the outside size, that no waste multiplier is applied, that an unclassified moulding is refused, and
that material survives an edit round trip.

> ⚠️ **This changes quoted prices substantially** — roughly 4× on a small frame. Existing saved lines
> keep their stored totals; only new and re-saved lines use the corrected formula.

### Step 27 — Mat billed like the moulding ✅ Done

The mat billed on **area**: `L × W × rate × 0.2` for a store board, and `2 × (L + W) × rate` for a
customer-supplied one. The user confirmed it bills the same way the moulding does.

```
mat layer   (L + W) × rate      on the mat cut size
```

On the 8 × 10 + 2″ example: the mat goes **₱84.00 → ₱65.00**, and the line total **₱135.48 → ₱116.48**.

- **`STORE_MAT_RATE_FACTOR` (0.2) is deleted.** It was never in the shop's notes — it was invented in
  Step 2 to tame an area charge that no longer exists. Keeping it would have double-discounted a rate
  the user enters directly.
- **The customer-supplied branch also went.** It used `perimeterIn`, which is `2 × (L + W)` — twice
  the intended figure. Store and customer boards now price identically; the toggle records who
  supplied the board for the workshop and prints on the requisition, but no longer changes money.

**2 tests replaced** (152 total): the old "customer-supplied prices differently" assertion is now
"prices the same whoever supplied the board", plus a direct check that a 12 × 14 mat at ₱2.50 bills
₱65.

> **Glass and backing still bill by area** — `areaSqIn(cut) × rate`. The user has not said these
> follow the same rule, and the source notes give per-square-inch rates for them (glass ₱0.25/₱0.35,
> plywood ⅛″ ₱0.16), so area remains plausible. Worth confirming, since it is now the only
> area-based charge left.

### Step 29 — Configured lines show only their total ✅ Done

Selling price, discount and tax do not apply to a configured frame on the quotation. All three now
print **—** on a configured line, on all three surfaces: the quotation table, the PDF, and the view
dialog. Plain item rows are untouched.

- **Selling price** was never meaningful on a configured line — it prices per part, and with several
  sizes the "unit" differs between them. It was already a derived average (see Step 4).
- **Discount and tax** are settled per item on the **sales invoice**, not at quotation stage.

> **Display only — no maths changed.** `toLineItem` has always written `discount: 0` and
> `taxRate: 0` on configured lines, so the quotation totals never read anything else. Verified before
> making the change.

Also fixed alongside: the size dialog held `max-h-[72vh]`, so an empty right pane collapsed it and
adding the first size made the dialog jump. Changed to `h-[72vh]`, with a placeholder in the right
pane — measured identical at **342 × 428** empty and with two sizes.

#### Rounding contract worth knowing before Step 5 (invoice)

Component amounts are each rounded to 2dp, and the line total is the **sum of those rounded
amounts** — not a recomputation from full precision. This is deliberate: a chop & join invoice
prints every component and then the total, so the printed rows must add up to the printed total.
The consequence is that `total ÷ quantity` can differ from the per-frame `unitPrice` by a cent;
the line total is authoritative.

> ⚠️ **Local environment issue, pre-existing and unrelated to this work:** the Supabase CLI cannot
> run (`supabase migration up`, `supabase gen types`) because `.env.local` fails to parse — line 11
> is a bare JWT with no `KEY=` prefix, likely a value that got split across two lines. The migration
> was therefore applied directly via `psql`, and the generated type files were updated by hand to
> match. **Fix `.env.local` before the next migration** so the normal CLI workflow works; also re-run
> `supabase gen types typescript --local` once fixed, to confirm the hand-written types match exactly
> what the generator produces.

---

## 10. Out of scope

- **Wood mouldings** — deferred (§3); revisit when wood items are added to the catalog
- **Aquarium and octagon frame types** — formulas transcribed in the source-data doc but not built
- **Multiple frames per quotation line** — the schema supports it, the UI is deliberately single-frame per line
- **Editing reference data** (mouldings/boards/glazing) in an admin screen — uses existing item master

---

## 11. Open questions

| # | Question | Blocks | Status |
|---|---|---|---|
| 1 | Where do per-area rates for mat/glass/backing permanently live? (`item_prices` tier / settings table / stay manual) | Nothing — v1 uses user-entered rates | **Deferred** — revisit after v1 |
| 2 | Do the handwritten discount rules apply on top of tier prices, or are they baked in? | Step 2 | ✅ **Resolved** — not baked in; applied separately (§5) |
| 3 | Should `frame_job_orders` be renamed now that it carries both modes? | Step 1 | ✅ **Resolved** — keep the name, add `billing_mode` + table comment (§4d) |
| 4 | `sales_order_item_mat_layers` exists but no route writes it, so mat layers are lost on quotation → sales order conversion | The workshop cut list (§7) — not job-order splitting | **Open** — found in Step 6; needs a write path before the cut list can print per-layer openings |
| 5 | **Moulding pricing does not follow the source formulas.** The code bills `outside perimeter ÷ 12 × 1.1 × rate`; the notes say `(L + W) × rate` on the **mat cut** size, with no waste factor (waste is already in the per-unit rate). On an 8 × 10 + 2″ border this is ₱12.71 vs ₱51.48 — roughly 4× | All chop & join and framing prices | ✅ **Resolved** — Step 26 |

---

## Decision log

| Date | Change | Reason |
|---|---|---|
| 2026-08-31 | Initial plan written | — |
| 2026-08-31 | Chop & join and framing merged into one engine with a billing-mode switch | User confirmed no functional difference beyond billing |
| 2026-08-31 | Storage model = one configured line exploded at render (option b), not one line per part | User selected; `invoice_display_mode` already supports it |
| 2026-08-31 | Configuration UI = large modal, not a route transition | User selected, to avoid unsaved-state complexity across navigation |
| 2026-08-31 | Up to 2 job orders per quotation, split by billing mode | User specified; requires relaxing `frame_job_orders.quotation_id UNIQUE` |
| 2026-08-31 | Pricing via existing `item_prices` tiers (option a) | User confirmed; `framing` + `chop_join` tiers verified present on 240 items |
| 2026-08-31 | Wood mouldings deferred, poly-only for v1 | Verified zero wood mouldings exist in catalog; wood formulas also unreconciled |
| 2026-08-31 | Mat/glass/backing per-area rates are **user-entered** in the dialog for v1; permanent storage deferred | User decision. Unblocks Step 1 — no schema change needed, `unit_rate` on the component row already fits |
| 2026-08-31 | Discounts are **not** baked into `framing`/`chop_join` tier prices — applied as a separate step | User confirmed. Keeps formula discounts and line/customer discounts independent |
| 2026-08-31 | Keep the `frame_job_orders` table name; add `billing_mode` + a scope-clarifying comment instead of renaming | 472 references would change for zero functional gain; name is already accurate since both modes are framing work |
| 2026-08-31 | Interactive prototype built and approved; becomes the UI reference for the quotation-integrated flow | User reviewed and approved. Confirms three line types, one dialog with mode switch, per-part vs. per-frame billing, one job order per mode |
| 2026-09-01 | Dimension precision corrected from `NUMERIC(8,3)` to `NUMERIC(9,4)` | Domain-module tests proved 3 decimals cannot represent sixteenth-inch cut sizes (15.6875 → 15.688). Fixed before any data existed |
| 2026-09-01 | vitest added as the test framework (none existed in the repo) | The brief requires unit tests on the geometry/pricing functions; pure functions with exact expected values are the right place for them |
| 2026-09-01 | Line total = sum of the 2dp-rounded component amounts, not a full-precision recompute | A chop & join invoice prints components then a total; the printed rows must add up to the printed total |
| 2026-09-01 | Moulding rate resolution returns null when the mode's tier is absent, instead of falling back to another tier | Billing an `srp` sheet price as a per-foot framing rate would silently overcharge; the dialog warns instead |
| 2026-09-01 | Mat layers cascade-soft-delete with their configuration via trigger | The quotation update path soft-deletes then re-saves; orphaned layers would collide on the layer-index unique constraint |
| 2026-09-01 | Removed the duplicated local `DbQuotationItemConfiguration` in `available-lines/route.ts` | Two copies of the same DB row type had already drifted once this step added columns; one exported source removes the class of bug |
| 2026-09-01 | Built the UI entry point (Step 4b) before Step 5 | The feature was unreachable from the app; reviewing invoice rendering on top of an unreachable feature would compound unverified work |
| 2026-09-01 | ~~Hardware prices into the line total but is not persisted as a component row~~ **Superseded 2026-09-01 by Step 4c** | `item_id` is NOT NULL and hardware had no inventory item at the time |
| 2026-09-01 | Created inventory items for fitting hardware rather than relaxing `item_id` to nullable (Step 4c) | The hardware is real stock the shop consumes, and the source invoices bill it as its own printed line; making it an item also lets it draw down inventory like every other component |
| 2026-09-01 | Persist the printable invoice description on each component, not the internal detail (Step 5) | The cut size belongs to the line's geometry, not the item, so it is unrecoverable after save; without it the printed invoice has no dimensions on it |
| 2026-09-01 | Rendering branches on mode in one shared presenter, not per surface (Step 5) | Three surfaces print the same line; duplicating the branch is how printed rows drift from the printed total |
| 2026-09-01 | Removed the legacy Frame Size / Molding / Service grid from the quotation PDF (Step 5) | It printed `serviceFeeMode`, stick length and stick counts, none of which the chop & join configurations set — every new line rendered zeros |
| 2026-09-01 | `both` mode bills only the summary row (Step 5) | The breakdown beneath it is explanatory; billing both would double the line |
| 2026-09-01 | A mode that already has an active job order is skipped, not rejected (Step 6) | Otherwise adding a second billing mode to an existing order is impossible without cancelling the first job |
| 2026-09-01 | Sales-order writes now persist `billing_mode` + chop & join geometry (Step 6) | They were dropped on conversion, so every configuration defaulted to `framing` and mode-grouping would have mis-filed chop & join work |
| 2026-09-01 | Navigate to the job-order list when two jobs are created (Step 6) | Routing to the first job silently hides the second |
| 2026-09-01 | Built the generated-document panel to match `chop-and-join-final.html` (Step 7) | Steps 5 and 6 deferred §7 twice and Step 5 shipped an invoice table instead; the prototype is the approved visual source of truth and had not been opened |
| 2026-09-01 | Documents live in the configuration dialog, not the job order page (Step 7) | The prototype shows them updating live as the frame is configured, which is where the shop checks its work |
| 2026-09-01 | Documents print fractions where the prototype prints decimals (Step 7) | The paper receipts and the workshop use sixteenths; the prototype's decimals were a simplification |
| 2026-09-01 | Moved the job-order toast out of `useSalesOrders` into the calling pages, using translated keys | The Step 6 version added a hardcoded English `BILLING_MODE_LABELS` map inside the hook — `AGENTS.md` prohibits local translation maps and hooks owning presentation |
| 2026-09-01 | Matting / glass / backing moved into their own nested dialog (Step 8) | The prototype puts them behind *Configure components →*; inline they buried the glass and backing controls far enough down the form to be missed |
| 2026-09-01 | Components dialog keeps ItemSelect rather than the prototype's fixed option cards (Step 8) | The prototype's cards carry hardcoded rates; ours must stay driven by the real item catalogue and the user-entered rates decided in §3 |
| 2026-09-01 | Components dialog holds a local draft and only commits on Apply (Step 8) | Mirrors the prototype, and lets Cancel discard component edits without touching geometry already entered on the main form |
| 2026-09-01 | Derived sizes moved inline onto the form; billing list dropped (Step 9) | Five stacked blocks in a 420px column crowded the sidebar and squeezed the requisition below legibility; the prototype puts readouts with the fields that produce them |
| 2026-09-01 | Panes carry minimum widths and stack below them (Step 9) | The requisition is a fixed-shape paper form — compressing it past ~440px collapses its description column, so stacking is the correct degradation |
| 2026-09-01 | Glass is a stored *type*, not a catalogue item (Step 10) | The glass items in inventory are pre-cut stock sizes and sheet stock; custom framing cuts to the frame's own size, so an item reference would record the wrong thing. Supersedes the Step 8 decision to keep ItemSelect for glass. |
| 2026-09-01 | Sheet count editable only for double glass (Step 10) | Every other type is a single pane; the legacy screen likewise puts a quantity box beside Double Glass alone |
| 2026-09-01 | One glass type per line, Remarks optional (Step 10) | User's call — the legacy screen allows multiple types, which would require glazing to become a row list rather than a single config |
| 2026-09-01 | Backing chosen by type, like glass (Step 11) | Same defect: the catalogue holds pre-cut sizes (`8 X 10 BACKING PLAIN MDF`) while custom framing cuts to the frame's own size |
| 2026-09-01 | Seeded one inventory item per glass and backing type (Step 11) | Without an item the components were dropped on save while still pricing into the total — the customer would pay for glass and backing that never appear on the invoice |
| 2026-09-01 | Component names for glass/backing come from the configuration, never the priced label (Step 11) | The priced `label` embeds the raw size, so using it printed the dimensions twice |
| 2026-09-01 | One dialog per component, opened from a per-row ⋯ (Step 12) | Three deep sub-configurations in one form meant scrolling past two to reach the third; supersedes the Step 8 three-accordion layout |
| 2026-09-01 | `Configure components →` removed (Step 12) | With every row opening its own dialog the button had nothing left to open, and two routes to the same editing invite drift |
| 2026-09-01 | Matting row reads "No matting" until matting is on (Step 12) | It previously showed "Single mat" beside "No board chosen", claiming a configuration that did not exist |
| 2026-09-01 | Include checkboxes removed; opening a dialog includes the component (Step 13) | With a per-row ⋯ the checkbox restates what the click already said; matting seeds a single matt so the dialog opens on something to edit |
| 2026-09-01 | Removing the last mat layer turns matting off; deselecting the glass card turns glazing off (Step 13) | With no checkbox there must still be a way back to "none" — a frame with no mat or no glass is legitimate |
| 2026-09-01 | The top mat layer became removable (Step 13) | `onRemove` was null for layer 0, so the last layer could not be removed and matting could never be switched off |
| 2026-09-01 | Requisition names each mat position when there are several (Step 14) | Bare board names left the workshop unable to tell which board goes on top; diverges from the prototype, which has the same gap |
| 2026-09-01 | Article / Description grouped into Moulding / Matting / Finishing blocks (Step 15) | User's pick from five rendered proposals; the previous single run-on line repeated "w/" five times and grouped nothing |
| 2026-09-01 | Deleted the superseded `articleLines()` in `description.ts` (Step 15) | A second, older version of the same output that only its own tests still called — a stale copy waiting to be used by mistake |
| 2026-09-01 | Dialog widened to 1440px and the document given the larger half (Step 15b) | The grouped blocks wrapped the moulding and finishing lines at 566px; at 755px neither wraps and the form is shorter |
| 2026-09-01 | Glass/backing type and rates persisted on the configuration, not just the component rows (Step 16) | Editing has to rebuild the configuration; inferring a glass type from a printed component description would be guesswork |
| 2026-09-01 | Editing a configured line reopens the frame dialog (Step 16) | The plain item form cannot represent geometry, mats or components, so saving from it silently discarded the configuration |
| 2026-09-01 | Type files regenerated with `supabase gen types --db-url …` (Step 16) | `--local` still fails on the broken `.env.local`, but `--db-url` bypasses that parsing — the files are no longer hand-maintained |
| 2026-09-01 | Unpriced mouldings flagged in the picker, not only after selection (Step 17) | The check was reactive; the shop should see the problem while choosing |
| 2026-09-01 | Absent price tiers are "unknown", never "unpriced" (Step 17) | A restored moulding carries no tiers, so conflating the two warned falsely on every edit *and* zeroed the restored rate |
| 2026-09-01 | A missing moulding rate blocks Apply (Step 17) | The warning alone let an unpriced moulding save a line at ₱0 |
| 2026-09-01 | Configured rows show billing mode, spec and part count (Step 18) | The row rendered only the moulding's name and never its description, so a whole frame looked like a moulding purchase at a strange price |
| 2026-09-01 | An explicit `lineTotal` overrides the server's `quantity × rate` (Step 18b) | A frame's total is the sum of its printed component amounts; the rounded per-frame rate cannot reproduce it, so the invoice's rows stopped adding up to its total |
| 2026-09-01 | Configured lines are sold in PCS, not the moulding's unit (Step 19) | The line counts finished frames; STICK describes how the raw moulding is stocked |
| 2026-09-01 | Rabbet overlap defaults to zero (Step 20) | The shop sizes a mat opening to the artwork itself; deducting ⅛″ unasked gave 11¾ × 13¾ where 12 × 14 was expected. The column remains for lines that want one. |
| 2026-09-01 | Mat lines print their border or reveal (Step 21) | The board name alone does not say what to cut; the top mat shows a border, layers beneath a reveal, and the workshop cuts to both |
| 2026-09-01 | Left pane shows the mat cut size as a third pair (Step 22) | It is what the border produces and the size the board is cut to; the pane previously jumped from artwork straight to the finished frame |
| 2026-09-01 | Borders moved from the article lines into the left pane (Step 23) | User's preference — the cutting figures belong with the dimensions they produce, leaving the article column as prose. Supersedes Step 21's placement; the border/reveal wording itself is unchanged. |
| 2026-09-01 | Finished outside size removed from the requisition (Step 23) | Every figure left in the pane is something the workshop cuts to; the outside size is a consequence of the others. Still used for moulding footage on the cut list. |
| 2026-09-01 | "Mat outer" / "Mat cut" / "glass size" unified as **Mat cut** (Step 24) | One measurement carrying three names; the glass hint also duplicated the cut list and went stale when *Cut to mat outer size* was unticked |
| 2026-09-01 | Added `items.material` rather than an attributes table or sub-categories (Step 25) | It is the only axis the formulas actually branch on; a generic table constrains no values and sub-categories cannot express two axes at once |
| 2026-09-01 | Moulding priced by the shop's formula on the mat cut, with no waste multiplier (Step 26) | The code billed outside-perimeter footage × 1.1, about a quarter of the correct figure; the per-unit rate already includes waste |
| 2026-09-01 | Moulding material is stored on the line, not re-read from the item (Step 26) | Reclassifying an item must never reprice an existing quotation |
| 2026-09-01 | An unclassified moulding blocks Apply (Step 26) | Polystyrene and wood price differently, so defaulting would silently misprice the line |
| 2026-09-01 | Mat bills `(L + W) × rate`, like the moulding (Step 27) | User's rule; replaces area × 0.2 for store boards and `2 × (L + W)` for customer boards |
| 2026-09-01 | Deleted `STORE_MAT_RATE_FACTOR` (Step 27) | Invented in Step 2 to tame an area charge that no longer exists; not in the shop's notes, and it would double-discount a rate the user enters directly |
| 2026-09-01 | Mat source no longer changes the price (Step 27) | User's decision — the toggle records who supplied the board for the workshop, nothing more |
| 2026-09-01 | Configured lines print — for selling price, discount and tax (Step 29) | The line prices per part with no meaningful unit; discount and tax are settled per item on the sales invoice |
| 2026-09-01 | The size dialog holds a fixed footprint from open (Step 29) | An empty right pane collapsed the height, so adding the first size made the dialog jump |

---

## 12. Multiple sizes per configured line (Step 28 — planned, not built)

### The problem

One trip through the frame dialog produces exactly one frame at one size. A customer ordering an
8 × 10 *and* a 12 × 10 means closing the dialog and starting again, re-entering the moulding, mat,
glass and backing both times. The shop's own paper requisitions cover several cuts on one form —
job 4 in `chop-and-join-source-data.md` has three different sizes on a single sheet.

`FrameConfiguration.quantity` does not solve this: it means *N identical frames*, not N different
sizes.

### Decided

| Question | Decision |
|---|---|
| Dialog shape | Main area lists the sizes; **Add size** and each row's edit button open the configuration in a sub-dialog |
| Preview | Right pane **top** (frame preview + readouts) follows the selected size |
| Requisition | Right pane **bottom** stays whole — it is the document for the entire job, showing every size |
| Configuration scope | **Per size.** Each size carries its own moulding, mat, glass, backing, hardware |
| What is saved | **One quotation line** for the whole job, not one per size |
| Line header item | A seeded **reference item** — `Chop & Join` / `Framing`, zero inventory |
| Billing mode | **One mode per line.** No mixing; a framing line holds only framing sizes |
| Reference item per mode | **Yes** — separate items, so the line names what it is |

The reference item is safe because a configured line already sets `skipInventory: true` and never
moves stock. Real inventory is drawn later through the job order's material requisitions
(`create_frame_job_order_from_sales_order_transaction` writes `inventory_reservations`).

### The blocker

```
sales_quotation_item_configurations_quotation_item_id_key
  UNIQUE (quotation_item_id)
```

One configuration per line, enforced by the schema. Mat layers already hang off `configuration_id`,
and components carry both `quotation_item_id` and `configuration_id`, so **those two tables are
already shaped for this** — only the configuration table's uniqueness has to go.

### Progress

| # | Step | Status |
|---|---|---|
| 1 | Schema — `size_index`, drop one-per-line UNIQUE | ✅ `20260901100000` |
| 2 | Seed reference items | ✅ `supabase/seed.sql` — `SVC-CHOPJOIN`, `SVC-FRAMING` |
| 3 | Save RPC loops over sizes | ✅ `20260901120000` |
| 4 | `frameSizesToLineItem` | ✅ one line, reference-item header, summed total |
| 5 | `frameLineToSizes` + read path | ✅ plus `frame_quantity` (`20260901100000`/`80000`) |
| 6 | Size-list dialog | ✅ `FrameSizesDialog`, requisition covers the job |
| 7 | Invoice presenter groups by size | ✅ `sizeHeading` rows in both renderers |

**Two defects the work surfaced:**

- **Per-size quantity was not persisted.** The line's `quantity` is the sum across sizes, so it
  cannot tell them apart coming back — reopening collapsed every size to one frame and halved the
  total. Caught by a "re-saves to the same total" test written before trusting the restore path.
  Fixed with a `frame_quantity` column rather than deriving it from `total_quantity / qty_per_frame`.
- **`available-lines` carried a duplicate `DbQuotationItemComponent` type**, the same drift found for
  the configuration type in Step 4b. Removed; it imports the shared one.

**The invoice groups parts by frame.** `invoiceRows` read only the singular `frameComponents`, so a
multi-size line would have printed size 1's parts and **silently omitted the rest — under-billing the
customer.** It now walks every size and emits a `sizeHeading` row naming the frame each group belongs
to. The heading carries no money of its own, so it cannot double-count; verified that the printed
parts still sum to the line total. A single-size line prints no heading, since a lone "8″ × 10″"
label is noise. Both renderers — the PDF and the view dialog — handle the new row kind, leaving the
money columns blank rather than printing a misleading ₱0.00.

**`GeneratedDocuments` now takes a size list.** It previously built one requisition row from one
configuration, so a multi-size job would have printed only the selected size — the opposite of the
design, where the preview follows the selection but the requisition covers the whole job.

### Work, in order

1. **Schema** — drop the UNIQUE on `quotation_item_id`, add `size_index` (0-based), and a new
   `UNIQUE (quotation_item_id, size_index)` in its place. Same on `sales_order_item_configurations`.
2. **Seed the reference items** — `SVC-CHOPJOIN` and `SVC-FRAMING`, zero stock, not orderable on
   their own. Follows the pattern of `supabase/seed.sql`.
3. **Save RPC** — `save_sales_quotation_item_frame_details` currently writes one configuration, one
   mat-layer set and one component group. It must loop over N sizes, keying mat layers and
   components to each size's configuration.
4. **`toLineItem`** — takes a list of configurations, returns one line: reference item as the header,
   total as the sum across sizes, components flattened with their `size_index`.
5. **`fromLineItem`** — restores the whole list so editing reopens every size. This is the riskiest
   step; the single-configuration assumption is baked into it.
6. **Dialog** — size list, selection-driven preview, sub-dialog for configuration. The existing
   `FrameComponentsDialog` pattern (per-section sub-dialogs) is the precedent.
7. **Invoice presenter** — a chop & join invoice prints one row per part; with several sizes it must
   group by size so the customer can tell which part belongs to which frame.

### Unchanged by this

- **Job-order split.** `billing_mode` stays on the line, so grouping by mode is untouched.
- **Pricing formulas.** Each size prices exactly as it does today; only the aggregation is new.
- **The requisition's own layout.** It already renders per line; it gains rows, not a new shape.

### Risks worth naming

- **Step 5 is where bugs have clustered.** The restore path has produced three defects this session
  (lost mat layers, a wiped moulding rate, a false "no price" warning). Restoring N configurations is
  strictly harder.
- **Existing saved lines have no `size_index`.** They default to 0 and remain single-size, so nothing
  breaks — but the migration must not assume the column is populated.
- **The line's `unitPrice` becomes meaningless** with mixed sizes. `lineTotal` is already sent
  explicitly (Step 18b), so this is cosmetic, but the quotation row should probably stop showing a
  per-unit price for multi-size lines.


---

## End-to-end UI verification (2026-09-01)

The feature was verified through the running app for the first time, against a real
authenticated session (`demo@pragmatica.app`, business unit Main-Bulacan) rather than by
reasoning from source. Method: the user signs in once in the in-app browser; the session
cookie then persists for the whole run. Everything after sign-in — navigation, form entry,
saving, DB inspection — is automatable.

**Path exercised:** create quotation → Add Item → Chop & join → Add size (8 × 10, moulding
057-10, frame width 2) → Add size (12 × 10, qty 3) → Add to quotation → save → reload from
DB → reopen for editing.

**Confirmed working end to end:**

| Behaviour | Evidence |
|---|---|
| Three-way line-type chooser | Raw material / Chop & join / Framing all render |
| Geometry chain | 8 × 10 artwork + 2″ moulding → 12″ × 14″ outside, 4.8 ft |
| Polystyrene pricing `(L + W) × rate` | 057-10 @ ₱1.98 → (8+10) × 1.98 = **₱35.64** |
| Per-size quantity | (12+10) × 1.98 × 3 = **₱130.68** |
| Line total = sum of sizes | ₱35.64 + ₱130.68 = **₱166.32** |
| Requisition prints every size | Both frames listed; TOTAL CUTS 4 (1 + 3) |
| Reference item heads the line | `SVC-CHOPJOIN`, unit PCS, qty 4 |
| Price/discount/tax suppressed | All three render `—` on configured lines |
| `frame_quantity` persists | `size_index` 0 → 1, `size_index` 1 → 3 |
| No round-trip drift | Reload and reopen both return ₱166.32 exactly |
| Editing shows the add UI | Reopen renders the same multi-size dialog, sizes restored |

**Defect found and fixed:** `specSummary()` in `src/lib/framing/description.ts` omitted the
moulding, so a moulding-only frame summarised as "No components" while the requisition beside
it printed that moulding and a total. The moulding now leads the summary. Two tests added
(`framing.test.ts`); 175 tests pass.

**Note for future sessions:** editing source mid-run triggers a hot reload that resets form
state (the customer field clears). That is a dev-server artifact, not a defect — re-select
before saving. Screenshots are downscaled from the emulated viewport, so drive the DOM by
element ref or script rather than by screenshot coordinates.

**Still unverified through the UI:** matting/glazing/backing component dialogs, the framing
(non-chop-join) billing mode, invoice rendering (Step 5), and job order handoff (Step 6).

### Empty state for the right pane (2026-09-01)

The pane previously showed a single sentence until a size existed, so the panel appeared from
nothing and the dialog's right half read as empty. It now always renders the same two things:

- **`FramePreviewPlaceholder`** (`FramePreview.tsx`) — the concentric cross-section drawn as a
  dashed 4:5 outline at the same 190px size as the real preview. Deliberately an outline, not
  invented geometry, so it cannot be misread as a configured frame. The "preview appears once
  you add a size" copy is kept beneath it.
- **A blank requisition** — `GeneratedDocuments` accepts `sizes: []` (and now-optional
  `config`/`labels`) and draws `BLANK_ROW_COUNT` ruled empty rows, with TOTAL CUTS 0 and the
  formatted zero total. The form keeps a page's proportions instead of collapsing.

Verified in the running app: empty state renders the dashed placeholder + 3 blank rows + ₱0.00;
adding an 8 × 10 swaps in the solid preview, drops the blank rows to one real row, and shows
₱35.64. 175 tests pass.

---

## Step 7 — Attachments on configured lines (2026-09-01)

The customer sends a frame sketch or a photo of the artwork; the bench needs to see it. Design
01 of five proposed (see the artifact): attachments are a **fourth row in the components list**,
opened by the same ⋯ that configures matting, glazing and backing — no new interaction to learn.

**Scope: per-size.** An attachment hangs off a configuration row, exactly as a mat layer does, so
a two-size line carries a different sketch per frame and removing a size takes its files with it.
Decided over a line-level "applies to all sizes" toggle; revisit only if operators start
uploading the same photo repeatedly.

### Migrations

- `20260901100000_add_chop_join_framing_configuration.sql` — `sales_quotation_item_attachments`
  (company-scoped RLS), the private `frame-attachments` bucket (10 MB; JPG/PNG/WebP/PDF), and
  `soft_delete_quotation_attachments`, a trigger mirroring `soft_delete_quotation_mat_layers`.
- `20260901120000_persist_chop_join_framing_details.sql` — the save RPC loops `frameConfiguration.attachments`.

**Two design decisions worth keeping:**

1. **The index on `storage_path` is NOT unique.** A save soft-deletes the old configurations and
   inserts new ones, so an unchanged file legitimately gains a fresh row on every save. A unique
   index rejected the second save of an unedited line — caught before shipping by reasoning
   through the update path, then confirmed against `update_sales_quotation_transaction`.
2. **Storage objects are never deleted here.** Removing a row leaves the object in the bucket: a
   save that rolls back must not have destroyed a customer's artwork. Reaping unreferenced
   objects is a separate janitorial concern, not yet built.

### Route

`/api/frame-attachments` — `POST` uploads and returns `{storagePath, …, previewUrl}`; `GET`
mints signed URLs for stored paths. Uses the admin client (the `warehouse-floor-maps` pattern)
with authorisation in the route, and **filters requested paths by the caller's company prefix** —
the admin client would otherwise sign another tenant's object.

Uploads take no configuration id: a file is attached while the dialog is still being filled in,
so `POST` writes an object, and the row is written later by the save RPC.

### Never billed

`toLineItem` puts attachments on the configuration, never among `components`. Three tests pin
this — the line total is byte-identical with and without a file, no component description
mentions the file, and no `http(s)` URL is ever serialised (signed URLs expire; only the path is
durable).

### Verified end to end in the running app

Upload → object lands under the company prefix with correct mime/size → preview opens **as a
dialog** (4th in the stack, no new tab) with a loaded image from a `token=` signed URL and a
download link → row reads "1 file(s)" → line total stays **₱35.64**, identical to the same frame
without an attachment → save → reopen → file restored and previews from a freshly minted URL.

178 tests pass; typecheck and lint clean.

### Attachments tab in the document panel

The borrowing from design 04, now built. `GeneratedDocuments` grows a third tab beside Job
requisition and Cut list, showing every size's files as a contact sheet with thumbnails,
filename, size and a download link.

- **The tab only appears when files exist**, labelled with a count — `Attachments (1)`. An empty
  third tab would be a dead control on the majority of lines.
- **Read-only.** Upload and remove stay in the attachments dialog, so the panel keeps its
  "generated document" promise of being output. This is what made design 04 wrong as the *entry
  point* but right as a *view*.
- **Files are tagged with their frame only on a multi-size line** (`sketch.png · 8″ × 10″`); on a
  single-size line the tag is noise. Verified both ways in the browser.
- **Thumbnails open the preview dialog.** `AttachmentPreviewDialog` is exported from
  `FrameAttachmentsDialog` and mounted by both surfaces, so a file looks and behaves identically
  whether clicked in the attachments dialog or on the sheet — one implementation, not two. The
  sheet passes its whole list, so the filmstrip still moves between files. Escape closes only the
  preview, leaving the sheet on its tab.
- Signed URLs are minted per view in one request for the whole sheet, never stored.
- `activeTab` falls back to the requisition if the last file is removed while the tab is open —
  otherwise the panel strands on an empty tab.

### Not yet done

- Carrying attachments through quotation → sales order conversion, which has the same gap already
  open for `sales_order_item_mat_layers`.
- Reaping storage objects whose rows were removed (see above — deliberate, needs a scheduled job).

### Linked mat borders and reveals (2026-09-01)

`MatLayerRow` linked L and W by default, with a toggle to break the link for a weighted mat.

- **Linked mirrors**: typing either value sets both. An even border is the common cut, and typing
  the same number twice was the common slip. Chosen over aspect-ratio scaling — matching the
  artwork's proportions produces odd fractions and is not how mat borders are cut.
- **W is `readOnly` while linked**, rather than editable-but-silently-rewritten, which reads as a
  bug.
- **Re-linking adopts L** for both, instead of keeping a W the field no longer shows separately.
- **The link state is derived, not stored** — `borderOrRevealLIn === borderOrRevealWIn` on mount.
  It is an editing affordance, not a property of the mat, so this needs no column and a reopened
  3 × 2 layer correctly comes back unlinked.

The geometry already supported independent axes (`matOpenings` walks L and W separately, covered
by the existing "triple mat with unequal L/W reveals" tests) — only the editor forced them equal.

Verified in the app: default linked at 2/2 with W read-only; typing 3 in L mirrored W to 3;
unlinking freed W to 2; artwork 8 × 10 with borders L 3 / W 2 gave **mat cut 14 × 14** and
**outside 18 × 18** — a square mat from a non-square artwork, which the old editor could not
express. Reopening the layer came back unlinked, as derived.

### Duplicate spec summary removed (2026-09-01)

`FrameConfigurationDialog` rendered `specSummary(config)` twice — once directly under the
component rows and once in the footer — so a configured frame showed
"057-02Q WHITE · Single matting" on two consecutive lines.

The footer copy is the keeper: it stays pinned while the form scrolls. The one under the
components list restated what the rows immediately above it already showed.
`FrameComponentsDialog` was checked and has only the footer copy.

---

## Job dates on a quotation (2026-09-01)

`date_received` (artwork in) and `due_date` (finished work promised back), both **required**.
They are shop-floor dates and deliberately separate from `quotation_date` / `valid_until`, which
are commercial: a quote may be raised days after the artwork arrived, and its validity window has
nothing to do with the promise date. The form puts them in their own row under a divider, with
hints, so "valid until" is not misread as a promise.

### Migrations

- `20260901310000_quotation_job_dates.sql` — both columns, backfilled from the commercial dates
  before the NOT NULL is applied (existing rows have no such dates to recover), plus
  `chk_quotation_due_after_received` (inclusive — same-day turnaround is legitimate).
- `20260901320000_quotation_job_dates_rpc.sql` — both RPCs take the dates.

**A trap worth recording:** adding defaulted parameters to a Postgres function creates an
**overload**, it does not replace the function. Both arities then satisfy a call that omits the
new dates and PostgREST reports an ambiguous match — which would have broken *every* quotation
save. The migration drops the old arities so exactly one function answers. Caught by checking
`pg_get_function_arguments` after applying, not by testing the happy path.

### A second schema is the one that matters

`QuotationForm` defines its **own** local zod schema; `src/lib/validations/quotation.ts` is not
what the form validates against. Adding the due-date refine only to the latter silently did
nothing — the browser showed no error on an invalid date. The rule now lives in both, and the
form's copy is the one that fires.

### Verified end to end

Fields default to today / +14 days; a due date before the received date shows "Due date must be
on or after the date received" and blocks saving; a real save stored received 2026-08-25 and due
2026-09-20 — distinct from quotation date 2026-08-31 and valid-until 2026-09-30, proving they are
separate columns; reopening the quotation restored both.

### Sizes empty state redesigned (2026-09-01)

The dashed box with a centred button was the generic empty-state pattern, and it carried a real
flaw: **two "Add size" buttons within 250px**, one in the section header and one inside the box,
doing the same thing. That duplication is what made it read as unconsidered.

It is now a **ghost of the real row** — same bordered container, same three columns, same
monospace dimension slot showing `—″ × —″` and a muted `₱0.00`. The row itself is the target, so
the header button stands alone.

- **`h-12` matches a populated row exactly.** A real row is taller than its padding because of
  the edit/delete icon buttons; without the explicit height the list jumped 8px the moment the
  first size landed. Measured both at 48px in the browser.
- **Copy says what a size is** rather than describing the emptiness: "Add the first frame on this
  line" instead of "No sizes yet. Add one to start." This dialog's whole point is that one line
  can hold several frames, and the empty state is where that is least obvious.

### Duplicate React key on the cut list (2026-09-01)

`cutListRows` assigns keys that are unique **within one configuration** (`moulding`, `glazing`,
`backing`). The document panel flattens every size into one table, so a two-size line produced two
rows keyed `moulding` and React threw "Encountered two children with the same key".

Fixed at the flatten site in `GeneratedDocuments`, qualifying each key with its size index — the
domain module has no reason to know its caller flattens. Two tests added, and the first was
confirmed to **fail** without the fix before being kept; the existing suite only ever called
`cutListRows` for a single config, which is why this reached the browser.

### Attachments tab followed the line, not the selected size (2026-09-01)

The attachments sheet flattened `entries` — every size on the line — so selecting a size with no
files still showed "Attachments (1)" and rendered another frame's sketch. On a two-size line that
told the operator this frame had a sketch when it did not.

**The distinction that was missed:** the requisition and cut list are *whole-job* documents and
deliberately print every size; attachments belong to *one* frame. Building the sheet to match the
job-wide documents was the wrong call. It now reads `config` — the selected size, which the panel
already received — so the tab appears only when the selected frame has files.

The size label is kept on multi-size lines (renamed `multiSize` → `showSizeLabel`): it no longer
disambiguates *between* files, but it confirms which frame you are looking at.

Verified: size 1 (8 × 10, one file) shows `Attachments (1)`; size 2 (14 × 16, none) shows only the
two document tabs; switching between them updates correctly; and sitting on the Attachments tab
while switching to a size with no files falls back to the requisition rather than stranding on an
empty tab — the existing `activeTab` guard covers size switching as well as file removal.

### "Save to quotation" when editing a line (2026-09-01)

`FrameSizesDialog` always said "Add to quotation", including when reopened on a line already on
the quotation — which reads as though it would add a second one. It now takes a `mode` prop and
says **"Save to quotation"** when editing.

The signal was already available: `QuotationForm` tracks `frameDialog.index`, null when adding and
set when editing, so no new state was needed. `FrameConfigurationDialog` (the inner per-size
editor) and `QuotationLineItemDialog` already switched their labels correctly; only the outer
sizes dialog was wrong.

---

## Framing instructions and items received (2026-09-01)

Two free-text fields for framing work, at deliberately different scopes.

**Framing instructions** — `framing_instructions` on the *configuration*, so per size. A textarea
below the components list in the configure dialog, framing mode only (chop & join sells cut parts,
with no assembly to instruct). Kept visible rather than behind a dialog: a "canvas torn top-left"
note is exactly what the bench must not have to hunt for. Prints on that size's requisition row
under an INSTRUCTIONS heading, separated by a rule, and only when given — a blank heading on the
requisition is worse than no heading.

**Items received** — `items_received` on the *quotation*, so per job. A new tab beside Job
requisition / Cut list / Attachments. Job-scoped because a customer hands over one bundle;
recording it against each size would multiply it on the very record meant to say what the shop is
holding. Unlike its neighbours this tab is an entry point rather than a generated view — the
custody record has to be typed somewhere, and it belongs beside the documents it prints on.

### Migrations

- `20260901100000_add_chop_join_framing_configuration.sql` — both columns.
- `20260901120000_persist_chop_join_framing_details.sql` — the configuration RPC.
- `20260901350000_save_items_received.sql` — the quotation RPCs, **dropping the old arities**
  (the same overload trap as the job dates: a defaulted parameter adds an overload rather than
  replacing, and two matching arities make PostgREST report an ambiguous call).

### A bug this surfaced

Instructions saved but did not come back on reopen. `_shared.ts` reads configurations with an
**explicit column list**, not `*`, so a new column is invisible until added there — unlike the
quotation-level reads, which use `*` and picked up `items_received` for free. Fixed in both
`_shared.ts` and `available-lines/route.ts`; the latter feeds quotation → sales order conversion,
so instructions would otherwise have been dropped on conversion too.

### Verified end to end

Framing line shows the instructions field and the Items received tab; chop & join shows neither.
Text prints live on the requisition. Saved: `items_received` on the quotation with newlines intact,
`framing_instructions` on the configuration. Reopened: both restored, and the instructions field
repopulates for editing. Four tests added (184 total), including that instructions never reach the
billed parts.

### Attachments moved out of the components list (2026-09-01)

The Attachments row is gone from the left pane; the document panel's tab is now **always
visible** and is where files are added and removed.

- **The tab no longer hides when empty.** It was the entry point, so hiding it until a file
  existed left no way to add the first one. The count suffix appears only once there are files —
  "Attachments" empty, "Attachments (1)" filled.
- **Upload and remove happen in the tab.** `uploadAttachment` was extracted from
  `FrameAttachmentsDialog` and is shared by both, so limits and error handling cannot drift.
  `FrameAttachmentsDialog` itself is retained — `AttachmentPreviewDialog` lives in it and is used
  by the sheet.
- **Files still belong to the selected size.** Uploading from the sizes dialog writes back into
  that size, not the line.
- The `activeTab` fallback now only fires for a tab that genuinely disappears (Items received on
  a chop & join line). Emptying attachments leaves you on the tab with its empty state, which is
  right now that it is permanent.

Verified: left pane shows only Matting / Glazing / Backing; the tab is present with no files;
uploading through it renders the thumbnail and relabels the tab; removing the last file returns
the empty state without switching tabs.

### Placeholders removed; outside-click no longer closes (2026-09-01)

- The example text is gone from **framing instructions** and **items received**, along with the
  two translation keys that fed it.
- The five framing dialogs now pass `onInteractOutside={(e) => e.preventDefault()}`. A frame
  configuration is long-form work and a stray backdrop click must not discard it; closing is
  deliberate only — the X, or Cancel.

**Scoped to the framing dialogs, not the shared component.** The guard could have gone into
`components/ui/dialog.tsx` in one line, but that governs every dialog in the app and would have
changed behaviour well outside this request.

**Escape is deliberately left working** as the standard accessible exit. Removing it as well would
leave keyboard users with no way out of a nested dialog.

Verified with both dialogs open: outside click keeps 2, Cancel drops to 1, X drops to 0.

### Mode banner removed from the configure dialog (2026-09-01)

The tinted "Chop & join / Framing" block at the top of the form repeated what the dialog header
directly above it already said — the mode name and its lede — about 60px lower. Removed for both
modes, so the form now opens on FRAME & ARTWORK.

Also cleaned up what it left behind: the `modeAccent` class helper (its only consumer) and the
`chopJoinBillingNote` / `framingBillingNote` translation keys, which nothing else referenced.
`chopJoinMode` / `framingMode` are kept — the dialog titles still use them.

### Fractional input (2026-09-01)

Flexipoints are consumed fractionally — half a box, an eighth — but every numeric field in the
framing dialogs parsed with `Number(event.target.value) || 0`. `Number("1/2")` is NaN, so the
`|| 0` **silently zeroed the value**: typing a fraction did not fail, it priced the line at zero.
The same bug sat on the dimension and mat-border fields, where the shop reads fractions off a
tape measure.

- **`parseInches`** (`formatInches.ts`) is the inverse of `formatInches`: accepts `1/2`, `15 1/2`,
  `15-1/2`, `8 11/16`, plain decimals, and tolerates the inch mark and unicode fraction slash.
  Returns **null** rather than 0 for unparseable text, so callers leave the last good value alone.
  A round-trip test pins it against `formatInches` so the two cannot drift.
- **`FractionInput`** holds the raw text while typing — `1/` is on the way to `1/2` and
  reformatting each keystroke fights the operator — commits as soon as the text parses, and
  normalises the display on blur.
- Wired into: flexipoints and multipoints quantities, length / width / frame width, and mat
  border/reveal L and W. **Not** the `unitRate` fields, which are money and stay decimal.
- The linked mat W keeps a plain read-only `Input`; a read-only `FractionInput` would still take
  focus.
- Mat cut and Frame outside readouts now print fractions too — they were showing raw decimals
  while everything around them printed sixteenths.

Verified in the app: 15 1/2 × 11 1/4 with a 1/2 moulding gives outside 16 1/2″ × 12 1/4″;
flexipoints at 1/2 price to ₱0.75 (₱1.50 × 0.5) and the field normalises to "1/2" on blur.
190 tests pass.

### Mat rate label corrected (2026-09-01)

The mat board **calculation** was already `(L + W) × rate` on the mat cut (changed earlier this
session), but the field was still labelled **"Rate / sq in"** — inherited from when mats billed by
area. An operator entering a genuine per-square-inch rate against a perimeter formula would have
priced the mat wildly wrong, so the label was actively misleading rather than merely stale.

The mat now uses its own key, `ratePerInch` — "Rate / inch (L + W)". Glass and backing keep
"Rate / sq in": they genuinely do bill on `areaSqIn(cut) × rate`, so the label is correct there
and the two must not share a key.

Verified: 10 × 8 artwork, 2″ border → mat cut 14″ × 12″ → (14 + 12) × 2.50 = **₱65.00**. Area
would have given ₱420.

### Plywood backing thickness (2026-09-01)

Plywood is the one backing the shop stocks in several thicknesses (⅛, ¼, ½), so the requisition
has to say which. A `Thickness` field now appears **only when plywood is selected**, taking
fractions through `FractionInput`.

- **Unpriced by design.** Thickness is a specification, not a multiplier — the per-square-inch
  rate entered beside it already reflects the board chosen, so multiplying would double-count.
  Three tests pin this, including that a stray thickness on MDF neither prices nor prints.
- **`backingLabel()`** derives the printed name (`Plywood 1/8″`) rather than baking it into
  `label` at selection time, which could not include a value typed afterwards. Both document
  label sites route through it, or the cut list would have kept printing a bare "Plywood" — which
  is exactly what the first pass did until checked in the browser.
- Migrations `20260901100000` (column) and `20260901120000` (save RPC); read path includes the
  **explicit select column list**, the trap that dropped framing instructions earlier today.

Verified: field hidden for MDF, shown for plywood; entering 1/8 leaves the price at ₱12.62
unchanged; the cut list prints "Plywood 1/8″ — cut 9 15/16″ × 7 15/16″". 194 tests pass.

### Fractional hardware quantities everywhere (2026-09-01)

`FractionInput` normalised the *field*, but every surface that rendered the number built its own
string and printed `0.5`. Fixed in five places, all now via `formatInches`:

- `documents.ts` — the requisition's Finishing line ("Flexipoints ×1/2")
- `documents.ts` — the cut list's per-cut and total columns
- `pricing.ts` — the component `detail` ("1/2 pcs per frame"), which reaches the invoice
- `description.ts` — `specSummary`, on the quotation row and dialog footer
- `FrameConfigurationDialog.tsx` — `hardwareSummary`, a **duplicate** of the spec summary local to
  the dialog, which is why the screen still showed "×0.5" after the domain fix

That last one is the lesson: fixing the domain function was not enough, because the component had
its own copy of the same shorthand. Only checking the rendered page caught it — a DOM assertion of
"no decimals anywhere" failed twice before it passed.

Three tests added (197 total), including that whole numbers still print plainly ("×8", not "×8/1").

### "Framing instructions" → "Additional instructions", both modes (2026-09-01)

Renamed and un-gated. The field now appears in **chop & join as well as framing**, optional in
both, and the requisition heading follows the new name.

My original reasoning — that chop & join sells cut parts so there is nothing to instruct — was
wrong: a chop & join order still carries handling notes ("cut long, customer collects"), and the
requisition is where the bench reads them.

The stored column and the domain field keep the name `framing_instructions` /
`framingInstructions`. Renaming them would mean a migration and a rewrite of the whole read/write
path for a label change; the type comment now records that the UI calls it "Additional
instructions" so the mismatch is not mistaken for a bug later.

Verified: field present and optional in both modes with the new label; a chop & join note prints
on its requisition under ADDITIONAL INSTRUCTIONS — a path that previously could not exist.

### Material required before dimensions (2026-09-01)

**The actual hole:** a mat layer could carry an empty `matBoardItemId` and still save — the
moulding was guarded at the dialog (`canApply` checks `moulding.itemId`), the mat board was not.
That produced a priced mat the workshop could not pull. `validateConfiguration` now rejects any
layer without a board, so the guard lives in the domain module rather than only in the UI.

**The ordering:** length, width, frame width, quantity and the three component rows are disabled
until a moulding is chosen, with a hint saying why. Sizing a frame whose material is unknown
produces a line with nothing to cut, and the moulding's own width is itself a dimension the
geometry needs.

`FractionInput` and `SummaryRow` both gained a `disabled` prop for this.

Verified: all four fields and all three component rows locked before selection and unlocked after;
adding matting without a board blocks the save with "Choose a mat board for every layer." Four
tests added (201 total).

### The matting dialog reached past the guard (2026-09-01)

The previous fix blocked the *outer* save but not the matting dialog's own **Apply to frame**,
which had no `disabled` at all. Matting could still be committed with no board chosen; only the
final save complained, by which point the operator had left the screen where it could be fixed.

`validateMatting()` is now exported from the validation module and gates that button, with the
reason shown in the dialog's own footer.

**Why a dedicated export rather than filtering the full error list:** the first attempt matched
error strings for "mat", which a reworded message would have silently defeated. The domain module
now owns the question of which errors this dialog can fix.

The filter matters in the other direction too: `validateConfiguration` covers dimensions the
parent owns, and blocking Apply on those would strand the operator on a screen where they cannot
be corrected. A test pins that `validateMatting` stays silent on a zero-size frame while
`validateConfiguration` does not.

Verified: Apply disabled with no board and the reason in the footer; enabled once a board is
picked; disabled again when a second layer is added without one. 205 tests pass.

### Components bill in CUT (2026-09-02)

Frame components inherited the unit their material is *stocked* in — STICK for a moulding, SHEET
for a mat board, PCS for hardware. A configured frame consumes a length cut from one and a piece
cut from the other, and the shop's paper invoices bill every such row as "CUT".

The intent was already half-present: `documents.ts` hardcodes `unit: "CUT"` on the requisition and
`invoicePresenter` falls back to `CUT_UNIT` — but the stored `uomCode` won, so saved lines printed
STICK and SHEET. Confirmed against real data: 9 STICK, 6 SHEET, 3 PCS across saved components.

- `supabase/seed.sql` seeds a company-scoped **CUT** unit, which did not exist.
- `frameConfigToLineItem` and `frameSizesToLineItem` take a `cutUom` and apply it to every
  component. Optional, so an un-updated caller keeps the old behaviour rather than breaking.
- **The line header stays PCS.** Its quantity counts finished frames, not cuts — that distinction
  was deliberate earlier in this plan and is preserved.

Four tests, verified to fail when the change is reverted (two did) rather than passing trivially.
213 tests pass.

**Not backfilled:** existing saved components keep STICK/SHEET. Re-saving a line corrects it. A
data migration would need to distinguish frame components from ordinary line items, and rewriting
historical documents is a bigger decision than this change.

---

## Per-component discounts (2026-09-02)

A real receipt showed a wood moulding at 20% while the mat and glass on the same frame carried
none — so the discount belongs on the **component**, not the line. This reverses an assumption
stated earlier in this plan, where component rows hardcoded `discountRate: 0`.

### Where the field sits

Beside each component's own rate: the moulding in the configure dialog (it has no components
dialog — its rate comes from the price tier), each mat layer in its row, glazing and backing in
their sections.

### Migrations

- `20260901100000` — `discount_percent` / `discount_amount` on component rows, typed to match
  `sales_quotation_items` exactly so the two round identically. CHECK constrains 0–100.
- `20260901120000` — the save RPC writes them.
- `20260901100000` / `20260901120000` — a `component_discounts` JSONB map on the configuration.
  The component rows are rebuilt from the configuration on every save, so without the map a
  reopened line would lose every discount and re-saving would quietly restore full price.

### Three decisions

1. **Keyed by component, not a field per component.** Mat layers come and go, so a map survives
   the list changing shape. A zero stores as an *absent* key, so an untouched frame writes no map
   and reads back identically to one saved before this existed.
2. **`amount` is always net.** Every component routes through one `add()` helper that applies the
   discount, so a component added later cannot forget it. The line total stays the plain sum of
   its parts. Quotation summaries add the component deductions back to both Subtotal and Discount
   so the payable total stays unchanged while the full discount remains visible.
3. **Clamped 0–100** in both the field and pricing. A negative rate would *increase* the charge;
   over 100 would owe the customer money. Both are typos, not pricing decisions.

Also fixed: `invoicePresenter` hardcoded `discountRate: 0` on component rows and now prints the
part's own rate, which is what the reference receipt's Disc Rate column shows.

Verified end to end: 10 × 8 at ₱1.98 → ₱35.64; 20% on the moulding → **₱28.51**; saved as
`discount_percent 20.00, discount_amount 7.13, total_amount 28.51`; reopened with the field
showing 20 and the total unchanged. 219 tests pass.

**Deferred:** line-level discount. It keeps its current behaviour (configured lines show `—`)
until we decide how the two interact.

### The Disc column on printed and on-screen copies (2026-09-02)

Discounts saved and priced correctly but never printed: the component breakdown table had
**Qty, Unit, Description, Unit Price, Amount** and no discount column — so a discounted moulding
showed its full unit price beside a reduced amount, with nothing explaining the gap.

Fixed on both surfaces so they cannot drift:

- `QuotationPDF` — a `Disc` column between Unit Price and Amount, matching the paper receipt's
  layout. Description narrows 58% → 50% to make room; the size-heading row leaves the cell blank
  as it does for the other money columns.
- `QuotationViewDialog` — the same column on screen.

**Blank rather than "0" when undiscounted**, as the reference receipt does: a column of zeros
reads as though something were being withheld.

`invoiceRows` already carried `discountRate` per row — only the rendering was missing. Two tests
added, verified to fail when the presenter is reverted to its hardcoded zero.

**Two mistakes worth recording.** The zh `discountRate` entries were seeded with the English
string, caught by reading the runtime object rather than the file. And restoring the presenter
after a revert-test replaced the *first* `discountRate: 0` in the file — the size-heading row —
rather than the component row; the full suite caught it, the targeted one would not have.

221 tests pass.

### Component discounts in quotation totals (2026-09-05)

The quotation header stores whole-line discounts, while chop-and-join component amounts are saved
after their individual discounts. The detail dialog, edit form, and PDF now reconstruct one shared
summary from the line details: component discounts are added back to Subtotal and included in
Discount, while Total remains the sum of the saved net line amounts. Multi-size lines use their
size-specific component lists once, avoiding the singular compatibility fields being counted again.

---

## Step 12 — Point fractions and flat L-support charges ✅ Done

Checking how the hardware was priced turned up three formulas that did not match the shop's:

| Component | Was | Is |
|---|---|---|
| Flexipoints | `rate × quantity` | `(numerator + denominator) × 2 × 1.50` |
| Multipoints | `rate × quantity` | `(numerator + denominator) × 2 × 8.00` |
| L-Support (Big) | `₱60.00` | flat **₱72.00** (the shop reckons 4 sides × ₱18) |
| L-Support (Small) | `₱35.00` | flat **₱32.00** (4 sides × ₱8) |

### Why the fraction cannot be a number

The formula reads the fraction's **two integers as figures in their own right**, not its value. So
`1/2` bills `(1 + 2) × 2 × 1.50 = ₱9.00` while `2/4` — the same number — bills `₱18.00`.

That single fact drove the whole change. A `NUMERIC` column storing `0.5` cannot say whether the
operator wrote `1/2` or `2/4`, so the pair had to become two integers end to end, and nothing in
the path may reduce or normalise them.

It also means **a finer division costs more**: `1/8` bills ₱27.00 against `1/2`'s ₱9.00. Flagged to
the user as unusual before building; confirmed as the shop's actual pricing — the denominator
tracks how finely the strip is cut, which is labour.

### What changed

- **`pointFraction.ts`** (new) — `formatFraction` / `parseFraction`. Parses a **bare fraction only**:
  whole numbers (`4`) and mixed numbers (`1 1/2`) are rejected, per the user, because the shop bills
  these components only as a fraction and neither form has a defined price. Returns `null` on bad
  input so a rejected keystroke leaves the last good value standing.
- **`PointFractionInput.tsx`** (new) — deliberately *not* `FractionInput`, which parses `1/2` to
  `0.5` (correct for a dimension, lossy here) and accepts the two forms now disallowed.
- **`pricing.ts`** — `pointAmount()` holds the formula. L-support is untouched: it reads its item
  price as-is and multiplies by the frame count. **The `× 4 sides` is the shop's reasoning for the
  figure, not arithmetic the app performs** — per the user, "just get its prices from db since these
  are flat values".
- **Component `quantity`** now counts *frames*, not pieces — the fraction is a size, so multiplying
  it out was meaningless. It moved to `detail` ("1/2 per frame") and to the cut list's `spec`.
- **`20260901100000_add_chop_join_framing_configuration.sql`** — four integer columns on both the quotation and
  sales-order configuration tables, with check constraints rejecting a zero denominator; plus the
  L-support price correction in `items.sales_price` and `item_prices.default`.
- **`20260901120000_persist_chop_join_framing_details.sql`** — extends the save RPC. Signature unchanged: the
  fields ride inside the existing `p_item` payload, so no overload is created.
- **`_shared.ts` and `available-lines/route.ts`** — both read configurations with **explicit column
  lists**, so new columns are invisible until added there. This is the fourth time that has bitten
  this feature; the second route matters because it feeds quotation → sales-order conversion.

### No backfill

Per the user: the development database is reset rather than migrated. Pre-existing configurations
carry no fraction and fall back to `1/2` on read. Backfilling was not possible in any case — a
stored `0.5` cannot be resolved back to the fraction that was typed.

### Verified

- **The user's own worked example** as a test: `1/2` flexipoints → ₱9.00.
- `2/4` bills ₱18.00 against `1/2`'s ₱9.00 — the unreduced-fraction case, tested at three layers
  (pricing, the parser, and the persistence round-trip).
- **Against the real RPC**, inside a transaction that was rolled back: `2/4` saved and read back as
  `2/4`, not reduced. The first attempt returned four NULLs — my test payload used the wrong nested
  shape, not a defect in the migration; worth recording because the failure looked exactly like a
  dropped column.
- The zero-denominator check constraint rejects the write.
- Formula tests revert-verified: five fail when `pointAmount` is returned to value-based arithmetic.

**240 tests pass; typecheck and lint clean.** One arity bug surfaced during lint — the new tests
passed a second argument to `priceLine`, which takes one. It was ignored at runtime, so the tests
passed while being wrong; `tsc` caught what green tests did not.

**Verified in the browser** on quotation **QT-000000013** (10″ × 8″, moulding 057-10):

| Check | Result |
|---|---|
| Flexipoints `1/2` | line total moved ₱35.64 → ₱44.64 = **₱9.00** |
| Flexipoints `2/4` | → ₱53.64 = **₱18.00**, double `1/2` as the formula requires |
| Multipoints `1/2` | **₱48.00** |
| L-support Small / Big | **₱32.00** / **₱72.00**, flat from the item price |
| Whole number `4`, mixed `1 1/2` | both rejected; the field restored `2/4` on blur and the total never moved |
| Cut list | `Flexipoints | 1/2 | 1 | 1` — fraction in `spec`, one set per frame |
| Saved rows | `flexipoints_numerator/denominator = 1/2`; components stored ₱9.00 and ₱48.00 |

No console errors from the new code.

### Follow-up — dropping the "×" on the requisition

The job order printed `Flexipoints ×1/8`, which read as a quantity: the bench saw "×" and took the
fraction for a count. It is a **size**, so the multiplication sign was actively misleading — a
leftover from when these really were per-piece quantities.

Removed from all four places that render it (`documents.ts` finishing line, `description.ts`
summary, and both `FrameConfigurationDialog` summaries). The bare fraction now matches the plain
names either side of it:

    With Glass · MDF backing · Flexipoints 1/8 · Multipoints 1/2 · L-support (small)

A test pins the absence of the sign — substring assertions alone would have let it creep back —
and was revert-verified. Confirmed live on QT-000000013: the requisition reads
`Flexipoints 1/2 · Multipoints 1/2` and the size chip `057-10 · flexi 1/2`.

> Line descriptions saved **before** this change keep the old `×` text: `item_description` is
> stored at save time, not re-rendered. They correct themselves when the line is next saved, and
> the database reset clears them anyway.

### Follow-up — prefilling the requisition header

The form printed a blank header the shop filled in by hand. Three of the four requested fields are
available while quoting and are now prefilled:

- **Customer** — was already wired.
- **Address** — `formatCustomerAddress` (new, `lib/framing/`). Prefers **shipping** over billing
  (the frame goes to the customer), and requires a *street line* to choose a set: a lone city is
  not somewhere to deliver to, so billing wins in that case. Returns `undefined` rather than `""`
  when nothing is on file, so the form keeps its "no address" placeholder instead of a bare rule
  that reads as a rendering fault.
- **Prepared by** — the signed-in user, from `authStore`. The name prints *above* the rule, which
  stays for a wet signature; `min-h` on the name slot keeps the "Received by" rule level with it.

#### Transaction No. is deliberately still blank

The requested mapping — transaction number = **JO number** — cannot be satisfied on this surface.
`frame_job_orders.job_order_code` (`FJO-…`) is assigned by a database trigger
(`apply_generated_document_code`) when a job order row is inserted, and **every insert path is
driven by a sales order**. While quoting there is no job order and therefore no number to print.

The prop is wired and documented, so it fills in automatically on any surface that has a job order.
None exists yet: `GeneratedDocuments` is currently rendered only by the two quotation dialogs — the
frame job order page does not render this requisition at all. Printing the quotation code there
instead was rejected: a form headed `QT-…` where the shop expects `FJO-…` is worse than a blank the
shop knows to fill.

The field therefore prints a muted **"Auto-generated"** placeholder (new `autoGenerated` key, en +
zh), reusing `PaperField`'s existing empty state — the same italic grey the address field already
uses for "No address on file". It says the number arrives on its own rather than leaving a bare
rule that reads as a field someone forgot to fill. `value || placeholder` means a real `FJO-…` code
replaces it and takes the solid mono styling, with no further change needed.

#### Aligning the header rules

Each `PaperField` was a self-contained flex row, so its value started wherever its own label ended
— "Customer:" and "Address:" are different widths, and the underlines came out ragged.

Fixed by making each header column a `grid-cols-[auto_1fr]` and turning `PaperField` into a
fragment, so the labels share one track and every rule starts at the same x. Measured after the
change: both left-column rules run 134 → 380 (previously offset). At mobile width the columns stack
and all three rules still end together.

**Verified** on QT-000000013: customer, `DepEd Division Office E. Quirino Avenue, Davao City,
Davao del Sur, 8000`, and `Demo User` over the Prepared-by rule. Five tests on the address
formatter; 246 total.

### Follow-up — Print / Download PDF on the generated documents

The prototype's `.ractions` bar, minus **Send to production** (not requested; there is no
production hand-off from a quotation anyway).

- **`RequisitionPDF.tsx`** (new) — the requisition and cut list drawn as real `@react-pdf`
  documents, taking the **same domain rows** the screen does (`requisitionRow` / `cutListRows`), so
  the paper and the file cannot disagree.
- **`printDocument.ts`** — reduced to blob delivery (`openPdf` / `savePdf`).
- **`window.print()` was not usable.** The app has no print stylesheet, so the existing
  `window.print()` dialogs print the whole dashboard with the modal chrome around it. Rendering to
  a PDF first means the bench gets exactly what was on screen.
- Actions appear only on the two **paper** tabs. Items received and attachments are working panels,
  not forms.
- The libraries are `import()`ed on demand — both are large and most sessions never print.
- Filenames are stable ASCII (`job-requisition.pdf`, `cut-list.pdf`), not the translated tab label,
  and take the job reference when one exists so two downloads do not collide.

#### The first attempt (html2canvas) was scrapped

Rasterising the on-screen panel produced a broken file: every ruled field had its underline drawn
**through** the text, and word spacing collapsed ("CHOPANDJOIN", "Preparedby") because html2canvas
1.4.1 mis-measures the `next/font` Inter face the app loads through a CSS variable. Drawing the
forms as vector PDFs fixed both and gives selectable text that prints sharply at any size.

#### Three font traps, all found by inspecting the PDF bytes

1. **Duplicate registration.** Registering the same 23 MB `ArialUnicode.ttf` under `normal` *and*
   `bold` made react-pdf fetch it twice concurrently — enough to hit
   `net::ERR_CACHE_WRITE_FAILURE`, surfacing as "Failed to fetch" and **no document at all**.
   `pdfFont.ts` now registers it once, guarded so only one module does so.
2. **No bold or italic face** is therefore available, and any `fontWeight`/`fontStyle` request
   silently falls back to Helvetica — losing CJK coverage. Emphasis in these documents comes from
   **size and colour only**; there is no `fontWeight` or `fontStyle` anywhere in `RequisitionPDF`.
3. **U+20B1 (₱) is not in the embedded subset**, so react-pdf dropped the glyph *and the character
   after it*: `₱92.64` printed as `$2.64`. `pdfMoney()` swaps it for `PHP `, matching what
   `QuotationPDF` already does — the screen keeps the real ₱, where it renders fine.

> A false lead worth recording: "does the PDF contain the string `Helvetica`?" is **not** a valid
> check — react-pdf's `FontStore` constructor registers Helvetica, Courier and Times
> unconditionally, so the name appears in every document it produces. The real signal is the
> page's `/Font` resource dictionary and the `/BaseFont` entries it points at.

#### Alignment, again — in the PDF this time

The on-screen form's ragged-rule fix did not carry over, because the PDF is a separate
implementation. Two cases, same root cause — a box sized to its own content:

- **Customer / Address**: each `Field` is its own flex row, so the differing label widths pushed
  the values to different x. react-pdf has no CSS grid, so `fieldLabel` takes a **fixed width**
  (46pt) to form a shared label column; `Transaction No.` sits in its own column and overrides it
  to 70pt.
- **Artwork size**: `sizeBox` used `minWidth`, so "10" and "8" drew rules of different lengths. Now
  a fixed 34pt, since the two are a matched pair.

`alignItems: "flex-end"` keeps each label on its rule however many lines the value wraps to.

**Mat cut** was a third case: the PDF printed it as a run-on sentence (`Mat cut 25 1/2 X 20 1/2`)
while the screen gives it a labelled ruled pair matching Artwork. It is a measurement the bench
cuts to, not a note, so it now shares a `DimensionPair` component with the artwork size, and the
per-layer border/reveal notes sit under a hairline divider as they do on screen. The size column
widened 104 → 122pt and the boxes 34 → 42pt, because mat cuts carry fractions ("25 1/2") that a
box sized for "10" would wrap.

**Verified** by generating the file in-page and rendering it: correct word spacing, underlines
**below** their text, header rules starting at a common x, matched size rules, `PHP 92.64` intact,
and the actions present on Job requisition and Cut list but absent on Attachments.

> A `paperRef is not defined` error seen mid-check was **stale Turbopack HMR**, not a defect — the
> declaration and use are in the same scope, and a hard reload cleared it. Worth recording because
> the button looked healthy either way: the failure threw before any state change, so only the
> console revealed it. Visual confirmation alone would have missed it.

---

## Step 13 — One mat border per stack; fixed ¼″ reveals ✅ Done

The reveal was being added **outside** the border instead of taken from **within** it, so every
multi-mat job cut oversized. Artwork 21 × 16, border 2″, one extra mat at ¼″:

| | Mat cut |
|---|---|
| Was | 25½ × 20½ |
| Shop practice | **25 × 20** |

That half inch was extra board, glass and backing on every stacked job.

### The model now

Mat outer is **artwork + 2 × border**, whatever the layer count. Adding a mat subdivides the
border, never extends it — so the frame the customer receives is the same size either way.

- **`MAT_REVEAL_IN = 0.25`** is a constant in `geometry.ts`, not a column and not an input: it is a
  shop practice, not a per-job choice.
- **The border moved to `MatConfig`**, edited by a new `MatBorderRow` below the layer list.
  `MatLayerRow` keeps only board, rate and discount — it carries no measurement at all.
- **L/W stay linked** with the existing unlink toggle, so a weighted mat is still possible. Note the
  weighting now applies to the whole stack: one layer can no longer be weighted differently from
  another. That capability is gone by design.
- **Openings cascade inward** from the outer edge rather than outward from the artwork.

### The stack must fit the border

N mats take `(N − 1) × ¼″`, and the top mat still needs a face, so the rule is
`border > (N − 1) × ¼″` **on both axes** — a weighted border is limited by its narrow side.

| Border | Max mats |
|---|---|
| 2″ | 3 (layer cap) |
| ½″ | 2 |
| ¼″ | 1 |

Enforced twice, deliberately: `Add mat layer` disables with the reason shown, **and**
`validateMatting` blocks Apply — because the border can be lowered *after* mats are added, which
the button guard alone would miss. Confirmed live: with a ¼″ border and two mats, Apply is blocked.

### Migrations

`20260901100000_add_chop_join_framing_configuration.sql` adds `mat_border_l_in`/`_w_in` to both configuration
tables with a `> 0` check, and drops `NOT NULL` from the per-layer columns rather than dropping
them — reversible, and any reporting query still reading them gets NULL instead of an error.
`20260901120000_persist_chop_join_framing_details.sql` updates the RPC (signature unchanged, no overload).

**No backfill.** A stored per-layer border cannot be resolved into a stack border without knowing
which layer the operator meant. Existing configured lines **reprice** — their mat outer shrinks, so
mat, glazing and backing all fall. Accepted: the development database is reset.

### Verified

- **The shop's own example as a test**: 21 × 16 with a 2″ border cuts 25 × 20.
- **Adding a layer does not change `matOuter`** — the property that makes this correct.
- Revert-verified: **21 tests fail** when the reveal is put back outside the border.
- **In the browser**: mat cut read `25″ × 20″`, and stayed `25″ × 20″` after a second mat was added.

**252 tests pass; typecheck and lint clean.**

> One bug of mine, caught by a test I had written with the right expectation: `maxMatsForBorder`
> used `floor(border / reveal)`, which is the count of whole reveals — but N mats need only
> `N − 1` of them, so a ½″ border reported 1 mat instead of 2. The fix is `ceil`. Worth recording
> because my first instinct was that the *test* was wrong.

---

## Step 14 — Framing bills one whole-frame rate ✅ Done

Framing claimed to bill "one price for the finished frame" but actually priced **exactly like chop
& join** — every part costed and summed — then collapsed the result to a single printed row
(`billedLineCount: 1`). It charged the sum of parts wearing a single-line disguise.

### The formula

```
polystyrene   (L + W) x frameRate
wood          (L + W + FW) / 3 x frameRate
```

then `x quantity`. `L x W` is the **sight** size — what the frame surrounds, so the artwork on a
bare frame and the mat outer when a mat is present. **Frame width enters the wood formula only**;
the shop's notes are asymmetric there and the code follows them rather than tidying them.

| Case | L + W | @ rate 50 |
|---|---|---|
| 21 x 16, no mat | 21 + 16 | **1850** |
| 21 x 16, 2″ border | 25 + 20 | **2250** |

This is the **entire** charge. Glass, matting, hardware, backing and the moulding itself are all
inside the rate — `priceComponents` returns exactly one `frame` row in framing mode. `chop_join` is
untouched and still bills each component individually.

### What that removes from the UI

Fields that would no longer move any total are **hidden, not disabled**: a rate field that changes
nothing teaches operators to distrust the screen.

- **Frame rate** input replaces the moulding Disc % in the header row.
- **Mat, glazing and backing rates** and every per-component **Disc %** — hidden in framing.
- **Store / Customer board toggle** — hidden. It only ever changed requisition wording, and framing
  bills one figure regardless.
- **Fitting hardware** — the whole section (flexipoints, multipoints, L-support) is hidden. It is
  part of what the frame rate buys, so there is nothing to choose or price.
- **Kept**: sheets, cut-to-mat-outer, remarks, backing thickness, mat border. The bench still needs
  to know what to pull and cut; those carry no price either way.

Hiding the hardware controls was not sufficient on its own. `billingMode` is reapplied to an
existing config when a line is reopened, so a line switched from chop & join keeps its old
`included` flags — and those were still printing on the requisition, the cut list and both summary
strings, asking the bench for parts the operator could no longer see or change. All four now gate
on the mode (`showsHardware` in `documents.ts`).

Per-component discounts therefore do not apply to framing at all, which makes the **line-level
discount** (deferred earlier) the only one that can. Worth picking up next.

### Validation

A framing line with no rate would price at zero and look deliberate, so `validateConfiguration`
refuses it.

### Migrations

`20260901100000_add_chop_join_framing_configuration.sql` adds `frame_rate` to both configuration tables with a `>= 0` check;
`20260901120000_persist_chop_join_framing_details.sql` updates the RPC (signature unchanged, no overload). No
backfill — existing framing lines have no rate and price at zero until one is entered.

### Verified

- **The shop's example as a test and in the browser**: 21 x 16 polystyrene at 50 → **₱1,850.00**.
- **With a 2″ mat border** → mat cut 25 x 20, line total **₱2,250.00**.
- **Doubling every component rate does not move a framing total** — the property that proves the
  parts are truly out of the calculation.
- Frame width changes the wood figure and leaves polystyrene alone.
- Revert-verified: **4 tests fail** when frame width is applied to polystyrene too.
- In the browser: the matting dialog shows only Border L/W — no rate, no discount, no
  Store/Customer toggle; glazing keeps Sheets and Remarks but loses its rate; Backing & fitting
  shows the board picker alone, with no hardware section. Chop & join still shows all of it.
- Hardware gating revert-verified: 2 tests fail when `showsHardware` returns true unconditionally.

**261 tests pass; typecheck and lint clean.**

---

## Step 15 — Mat rate joins the border; discount joins the selector ✅ Done

Two layout moves in the chop & join matting dialog, one of which changed the data model.

**Discount beside the mat board selector.** Purely layout — the discount is keyed per layer
(`mat-0`, `mat-1`) and stays that way. A mat row is now one line: board, then its markdown.

**Rate beside the Store / Customer toggle** (moved there after a first pass put it with the
border). Who supplied the board and what the shop charges for it are one decision, and the operator
switching to a customer's board is the one most likely to want the rate next.

The toggle itself became a **pill segmented control** (`ui/segmented-control.tsx`, new): a filled
track with the selected option raised out of it, replacing two loose buttons. Built as a shared
component rather than inlined because the size-mode toggle in `FrameConfigurationDialog` is the
same pattern and should adopt it.

It renders as a `radiogroup`, not buttons — arrow keys move between the options and a roving
`tabIndex` puts one stop on the group, which is what a keyboard user expects of a segmented choice.
Labels are just **Store** / **Customer**; the group's `aria-label` ("Who supplies the board")
carries the context the short labels drop.

The rate was stored *per layer* and each layer priced with its own.
The shop charges the same per inch whichever board a layer uses, so `unitRate` moved from
`MatLayer` to `MatConfig`, exactly as the border did in Step 13.

> This removes a real capability: per-layer rates were possible, so a cheap backing mat under an
> expensive top mat can no longer be quoted. Confirmed with the user before building — "rate is
> same in all matting".

The two are deliberately asymmetric: **one rate, many discounts**. A stack is cut from one grade of
board at one price, but a single mat can still be marked down.

`MatLayer` is now just `{ layerIndex, matBoardItemId }` — the row has nothing else to edit, so its
`onChange` prop went with it.

### Migrations

`20260901100000_add_chop_join_framing_configuration.sql` adds `mat_unit_rate` to both configuration tables;
`20260901120000_persist_chop_join_framing_details.sql` updates the RPC (signature unchanged). The per-layer `unit_rate`
column keeps its data and is still written — the persisted breakdown bills each mat as its own line
in chop & join — but every layer now receives the stack rate. No backfill: a line saved with
differing rates cannot be reduced to one without choosing a winner.

### The mat rate is required, and no longer defaulted

It was seeded at **2.5** in three places, so a line could be quoted at a rate nobody chose — the
worst kind of default, because it looks deliberate. Now it starts empty and
`validateMatting` blocks Apply until one is entered, which also gates the outer save.

Chop & join only: framing hides the field entirely (the frame rate is the whole charge), so a zero
there is correct rather than missing.

The field shows `*`, `required` and `aria-invalid`, and renders **empty** rather than `0` — a zero
reads as an answer, an empty field reads as the question it is.

Removing the final mat layer turns matting off; adding a layer again turns it back on so geometry
and the component amount resume immediately. Removing from a multi-layer stack also reindexes the
remaining board selections and per-layer discounts with their layers.

New matting starts with blank Border L/W fields rather than assuming 2″. An incomplete draft is
not priced: the matting amount stays at zero until a board is selected and both border dimensions
are entered, preventing a placeholder mat from looking billable.

**Money fields are right-aligned**, so decimal points line up down a column. Applied to all five
rather than the mat rate alone — mat, glazing and backing rates, the component discount, and the
frame rate — since one right-aligned field among four left-aligned ones is worse than the original
inconsistency. **Dimensions stay left**: they are measurements typed as fractions ("15 1/2"), not
amounts anyone compares down a column.

> Removing the default also surfaced two dead properties: the inline layer literal in
> `FrameComponentsDialog` still set `borderOrRevealLIn`/`WIn`, removed from `MatLayer` back in
> Step 13. TypeScript does not excess-check object literals inside an array, so they had sat there
> silently since.

### The preview's reveal was invisible — solved with zoom, not exaggeration

At pane scale a ¼″ reveal renders as **1.8px**, so a double mat looked identical to a single one.

A first attempt widened the bands to a legible minimum. It was **reverted at the user's call**, and
the objection was sound: the preview is the one place an operator checks what the customer will
see, and a drawing that inflates the mat stack to make a point is lying about the thing it exists
to show. Two bugs found while building it (a third mat drawing larger than the second; the artwork
window inflating the border on a single-mat frame) were symptoms of fighting the geometry.

`ZoomablePreview` (new) instead offers the **same drawing larger, on demand** — 560px, where a ¼″
reveal is 5.4px on a typical 25″ frame. Nothing is exaggerated; the proportions are simply legible.
Large frames stay tighter, which is correct: the reveal genuinely *is* a smaller share of a big
frame.

The inline preview is unchanged — it is what the operator watches while configuring — and the whole
tile is the zoom affordance, with a corner icon on hover and focus. Applied to all three previews
(configuration, components, sizes); the sizes dialog's empty-state placeholder keeps its plain
container, having nothing to enlarge.

### Field sizing was inconsistent

Three sizes had accumulated across the framing dialogs — `h-8`, `h-9` and the `h-10` default — with
labels split between `text-xs` and the default `text-sm`, so a single row could show three
different field heights. Nobody had chosen that; it was drift.

Standardised on **two** deliberate sizes:

- **Component dialogs** (matting, glazing, backing) — compact: `h-8` inputs, `text-xs` labels,
  including the checkbox rows that align to them.
- **Configuration dialog header** — full height: default `h-10` inputs, `text-sm` labels.

`ComponentDiscountInput` appears in both, so it took a `size` prop rather than being pinned to one:
it was the field that looked wrong in the header row (32px among 40px fields) *and* correct in the
component dialogs. Measured after the change — header row all 40px, glazing row all 32px with 12px
labels.

### Glazing remarks removed

A free-text note the operator filled in that **nothing downstream ever read**. Its own doc comment
claimed it was "carried onto the job order" and its placeholder said "prints on the job order" —
neither was true: it appears in no requisition, cut list or summary. It round-tripped to the
database and stopped there.

Removed from the UI, the domain `GlazingConfig`, both ends of the line-item round trip, and the
orphaned `remarks` / `remarksPlaceholder` translation keys. The `glazing_remarks` column and its
API plumbing stay — harmless now that nothing writes a value, and the column still holds whatever
earlier lines saved.

### The board-source hints were wrong and are gone

`storeBoardHint` said **"Priced on area."** and `customerBoardHint` **"Cutting service only, priced
on perimeter."** Both were stale: mats bill `(L + W) × rate` on the perimeter, and **who supplied
the board does not change the charge at all** — the toggle only records it for the requisition.
Two labels contradicting the field beside them, one of them naming a formula the code has never
used. Removed from all three translation blocks.

> Open question, raised but unresolved: the user's stated reason for moving the rate was that "rate
> changes depends if customer or store provided". The code does **not** vary the charge by source.
> Either the shop does discount a customer-supplied board — in which case there is a pricing bug —
> or the rate is simply retyped by hand, and putting the two controls together is exactly the
> affordance that supports it. The layout change is right either way; the pricing question stands.

### Verified

- Every layer bills at the stack rate, and all move together when it changes.
- A discount on `mat-0` leaves `mat-1` untouched — the asymmetry holds.
- In the browser: **one** rate field on the toggle row, **two** discount fields with two mats,
  and no board-source hint text.

**268 tests pass; typecheck and lint clean.**

---

## Step 16 — Fixed discount amount on a framing line ✅ Done

Framing lines already displayed like raw material — `quantity` is the frame count and
`unitPrice = total / frames`. What was missing was a discount: `discount` was hardcoded to `0`.

### Why an amount, not a percentage

The shop quotes "200 off this job". Storing that as the equivalent percentage **cannot work**:

| Qty | Total | 200 off as a rate |
|---|---|---|
| 1 | 1850 | 10.8108% |
| 3 | 5550 | 3.6036% |

Save 10.8108% at qty 1, change to qty 3, and the discount silently becomes **600**. So it is a
stored amount, clamped to `[0, gross]` — never negative, never more than the job is worth.

One discount for the **whole job**: not per size, not per frame.

### The server already supported it

`calculate_sales_quotation_item` accepts an explicit `discountAmount` and prefers it over the
derived percentage. **No migration and no RPC change.** The catch was `lineTotal`, which overrides
everything and which the framing path sends explicitly — so the discount is subtracted there too,
or it would save without reducing the total.

`unitPrice` stays **undiscounted**, so the deduction reads as a deduction rather than being smeared
into the per-frame price.

### The summary had to learn about it

The form derived each line's subtotal by inverting the discount *rate*
(`lineTotal / ((1 - rate) x (1 + tax))`). With a fixed amount and `discount: 0` that returns the
already-discounted total, so the quotation's **Discount** row would have shown ₱0.00 while ₱200 came
off — misleading on a printed quotation.

`lib/quotations/lineAmounts.ts` (new) does the split for both styles and is used by all three
reducers, which previously repeated the same arithmetic three times and had to agree.

### Presented as a receipt

The first version stacked three unrelated rows with no shape: the label and input pushed to
opposite edges, "Before discount" floating between them, nothing grouping any of it.

It is a receipt, so it is shaped like one — a `<dl>` in the same
`rounded-lg border bg-muted/30` panel the mat border block uses, with:

- every figure in **one right-aligned column**, the input included (measured: all four right edges
  land on the same pixel, so what the operator types sits under what it affects)
- a **minus sign** marking the deduction, transparent at zero so the column does not shift
- a **rule above the total**, which is what does the summing

### Displayed as amount, then rate

The Disc column showed a percentage — and for framing lines, an em dash, since they carried no
percentage at all. It now reads **`₱200.00 (20%)`**.

The amount leads because it is the figure the shop agreed and the customer checks; the rate follows
in brackets as the derived one. Printing the rate alone would round away the quoted sum — 200 off
1850 is 10.81%, a number nobody negotiated.

`formatLineDiscount` is shared by the form table, the view dialog and the PDF, so the three cannot
drift; `discountRateOf` derives the rate against the **pre-discount** total (200 off leaving 800 is
20%, not 25%). Blank when undiscounted, matching the paper receipts. The two column headers that
now show an amount changed from "Disc %" to "Discount" in both locales.

### Verified

- **The shop's example, live**: a ₱1,000 line discounted ₱200 shows `₱200.00 (20%)` and totals
  ₱800.00.
- In the browser: **Before discount ₱1,850.00 → Line total ₱1,650.00**, and the quotation summary
  reads Subtotal ₱1,850.00 / Discount −₱200.00 / Total ₱1,650.00.
- The amount holds at 200 whether the line carries one size or three.
- Clamped: a discount larger than the job zeroes the total rather than going negative.
- Reopening a saved line restores its discount (the reset effect, not just `useState`'s initial
  value — a second line opened after the first would otherwise keep the first one's discount).
- Both behaviours revert-verified: 3 tests fail when the discount is applied per size, 3 more when
  `lineAmounts` ignores the fixed amount.

**281 tests pass; typecheck and lint clean.**

> A silent hazard worth recording: `onApply` gained a second parameter, and TypeScript **accepts a
> handler that takes fewer arguments** — so the form compiled cleanly while ignoring the discount
> entirely. Found by grepping the call site rather than trusting the typechecker.

---

## Step 17 — Acceptance requires a waiver, a name and a channel 🚧 In progress

Marking a quotation accepted is the moment the shop commits materials and bench time, so it now
carries evidence: **who** on the customer's side agreed, through **which channel**, and the
**waiver** proving it. All three required — this is the record produced months later when a job is
disputed.

### Where the requirement had to live

The obvious place was `/api/quotations/[id]/status`, and I hardened it there first. That was the
wrong place: the UI accepts through **`confirm_sales_quotation_transaction`**, which sets
`status = 'accepted'` directly and never touches that route. Enforcing it only there would have
left the requirement walkable-around via the endpoint the app already calls.

It now lives in the RPC, which also makes it **atomic** — the status change and the waiver rows
commit together, closing the window where a quotation could end up accepted with no waiver.

The confirmation regression caused by the RPC's `RETURNS TABLE quotation_id` output variable
sharing a name with `sales_quotation_waivers.quotation_id` is fixed by qualifying the waiver
column. An authenticated confirmation and a forced failure after the quotation update both verify
that the operation succeeds atomically and rolls back without partial acceptance data.

### Schema

- `accepted_by_name`, `accepted_channel`, `accepted_at`, `accepted_recorded_by` on the quotation
- `sales_quotation_waivers` — a child table, because a photographed signed printout **and** a
  screenshot of the customer's Viber message are both evidence of the same acceptance
- Private `quotation-waivers` bucket, mirroring `frame-attachments`

Two constraints, both tested against the live database:

- **Channel is a fixed list** — `telegram` rejected. Free text would make "viber", "Viber" and
  "viber msg" three different channels and defeat any report.
- **Acceptance is all-or-nothing** — a name with no channel rejected. A half-written record reads as
  though detail was captured when it was not.

The accepting person's **name is free text**, per the user: reality is "the owner's wife" as often
as a registered contact.

> The migration DROPs the two-argument RPC rather than leaving it alongside the new five-argument
> one — matching arities make PostgREST report every call as ambiguous. A **third** overload
> (`uuid, uuid, uuid`, the business-unit variant) already existed and was left alone; verified that
> a named-argument call still resolves unambiguously to the new function.

### Still to build

The acceptance dialog with file upload, showing the record on the quotation afterwards, and the
seven channel labels in both locales.

**297 tests pass; typecheck and lint clean.**

### Left alone

`specSummary` (`description.ts`) mentions flexipoints but never multipoints or L-support. That gap
predates this change and is out of scope, but it means the one-line summary understates a frame
whose only hardware is multipoints.

## The order-quantity dialog (2026-09-05)

`SalesOrderLineItemDialog` serves **three shapes from one component**, and the read-only ones had
been dressed as editable:

- **A** — a quotation line *with* `frameSizes`: framing or chop & join
- **B** — a quotation line *without* them: a raw material quoted, then ordered
- **C** — no quotation at all: a free inventory item

The defect was uniform across A and B. Pricing tier, unit price, discount and tax all rendered as
`<Input disabled>`, visually identical to the one field the operator may actually change. Discount
and tax showed `0` as *placeholder* grey, which reads as an empty field asking to be filled. The
dialog's own subtitle said "enter only the quantity"; nothing on screen agreed with it.

The rule adopted: **a box means you may type here.** Locked values render as text. Case C keeps
every input box, because there everything genuinely is editable.

### What each shape looks like now

Case A is a table — one row per quoted size, carrying that size's components, its quoted/remaining
counts, its quantity field and its own amount. The previous card-per-size layout did not survive
more than one size, which is the case the table exists for. Amount per size is
`frameQuantity × unitPrice`: `FrameQuotationSize` holds no price of its own, and `totalServiceFee`
on the configuration is written as `0` by `toLineItem.ts`, so the line's `unitPrice` is the only
real per-frame figure.

Case B loses the table (there are no sizes) but keeps one quantity field with its UOM beside it and
the remaining-quantity hint below.

All three close on the **same figures panel** — subtotal, discount and tax when non-zero, then the
line total behind a rule. That shared ending is what keeps the three cases reading as one dialog
rather than three. `formatLineDiscount` is reused from `invoicePresenter`, so the "₱200.00 (20%)"
form matches the quotation table, the view dialog and the PDF.

> Discount and tax are shown as figures rather than hidden at zero: `SalesOrderForm` copies both
> straight off the quotation line, so they genuinely can be non-zero. An earlier draft of this
> change hid them whenever they were zero, which would have concealed a real quoted discount.

Four translation keys lost their last caller and were removed from all three blocks —
`readonlyNotice`, `frameSizes`, `frameSizesDescription`, `quotedAndRemaining`. The long grey
"cannot be changed" sentence is now a **From quotation** badge on the header card.

**319 tests pass; typecheck and lint clean.** Verified in the browser across all three shapes:
the table with its components and live per-size amounts, case B recomputing 3 × ₱112 = ₱336, and
the over-remaining guard still refusing 3 against a remaining of 1.

### Found while verifying — not fixed here

**A fixed discount amount never reaches the sales order.** `get_available_sales_quotation_lines`
has no `discount_amount` in its `RETURNS TABLE`, and `available-lines/route.ts` hardcodes
`discount_amount: 0` (~line 310) when building the item. A chop & join line quoted at 648.67 with
200 off arrives in the order at the full 648.67 — the customer is billed the undiscounted price.
Both the RPC and the route need it threaded through.

This is why the Discount figure in the new panel is currently unreachable for fixed-amount
discounts: the branch is correct, the data never arrives. Pre-existing, spans the database, and
outside the dialog — left for its own change.

## The production floor card (2026-09-05)

Rebuilt for the wall-mounted touch monitor it actually runs on. Three defects, all from the card
having been designed for a desk:

- **The hierarchy was inverted.** `Cutting` / `Cut molding` — the only two things an operator acts
  on — were `text-sm`, while the word **STATUS** was set larger. The station is now the card's
  headline; the job number and customer drop to a single line beneath a rule.
- **State was a 50%-opacity card tint** (`bg-green-50/50`), indistinguishable from white at three
  metres. Replaced by a saturated chip with its own dot. `getStatusColor` is gone.
- **The button row reshuffled between cards.** A third action turned the 2-up grid into 2+1, moving
  the primary button, so muscle memory aimed at the wrong control.

The primary action now owns a **full-width 76px row of its own**, never adjacent to another button:
a mis-tap between two large targets is the failure with a real cost on a floor. Secondary actions
sit in a 56px row below.

### One action forward, one exception

The primary carries the job: **Start → Complete Step**, and the order closes itself when the last
operation completes. The secondary slot carries the exception — **Hold** while running, **Complete**
only from `on_hold`.

> The user asked for Start → Hold → Complete, each replacing the last. Implemented literally that
> puts `complete` beside a running job, and the RPC's `complete` branch marks **every** remaining
> operation completed — one tap at the cutting station would close assembly, QC and release too.
> Confirmed against `apply_manufacturing_floor_action_transaction` before building, and the user
> chose `complete_step` as the follow-through instead.

### Blocked jobs lose their Start button

**Superseded by the residual-material rule:** frame job orders can now start and finish without a
material request or full warehouse issue. Their shortage notice is advisory and Start remains
available. Completion retains actual issued quantities and releases unused request reservations.
The guard and behavior described below are historical, not the current workflow.

`hasMaterialShortage` previously rendered as a mild inline note *above a live Start button*, and the
database refuses the action anyway (`prevent_frame_production_without_issued_materials` raises
`PRODUCTION_MATERIALS_NOT_ISSUED`). A blocked job now carries a solid red banner and no primary
action at all, so the UI states the rule the trigger already enforces.

**330 tests pass; typecheck and lint clean.** Verified in the browser through all three states —
Ready → In Progress → On Hold — driving the real RPC each time. Reaching `in_progress` required
issuing the job order's materials first; the guard fired correctly before that, and the test data
(status, issued quantities, and the two generated events) was restored afterwards.

## Seeding stock for the framing consumables (2026-09-05)

The glazing, backing and fitting items were seeded as **item masters only** — no `item_warehouse`
row at all, so all thirteen read as zero stock. That is not cosmetic: it breaks production outright.

The chain that fails without it:

1. A job order needs GLZ-DOUBLE, GLZ-CLEAR, BCK-PLY, BCK-MDF (real requirements on FJO-000000002).
2. Creating the material request, then **Approve and Reserve**, checks availability in the chosen
   warehouse and fails with `PRODUCTION_MATERIAL_REQUEST_INSUFFICIENT_STOCK`.
3. Materials therefore never reach `issued_quantity = required_quantity`.
4. `prevent_frame_production_without_issued_materials()` raises `PRODUCTION_MATERIALS_NOT_ISSUED`
   the moment an operation goes `in_progress`, so **Start** on the floor is refused.

This was hit for real while verifying the floor card: Start returned "Issue all required materials
before starting production", and the only way through at the time was editing `issued_quantity` by
hand — which the seed should have made unnecessary.

`seed.sql` now opens balances for all thirteen (500 glazing / backing, 250–300 for the specialty
sheets, 1000–2000 fittings) in every warehouse, matching the convention the glass and moulding
imports already use. The two `SVC-` codes are deliberately excluded: they are services, not stocked
goods. `available_stock` is a generated column (`current_stock - reserved_stock - putaway_qty`), so
only `current_stock` is seeded.

> Re-running tops balances back up rather than doubling them: the upsert uses
> `GREATEST(existing, seeded)` instead of overwriting, so a database part-way through a demo keeps
> whatever it has consumed. Verified by running the block twice — 52 rows both times, totals
> unchanged on the second pass.

**Verified end to end in the browser** rather than by inspecting the seed: created the material
request against WH-BU01, approved and reserved it with no shortage error, issued it, and started
production on the floor. All nine job-order lines reached `issued = required`, and stock drew down
from exactly the seeded balances (500 → 499, and GLZ-DOUBLE 300 → 298 for its quantity of two).

> The issued materials and drawn-down balances were left in place afterwards — reverting them would
> put the database back in the state this change exists to fix. Only the manufacturing order was
> restored to `ready`.

## Invoice PDF summary (2026-09-05)

Three changes to `InvoicePDF`, matching the quotation's summary treatment:

- **Payment Status panel removed.** It restated Total Amount, then added Amount Paid and Balance
  Due in a separate grey box — a second totals block competing with the first.
- **Payment Terms removed** from the rendered footer. The `paymentTerms` field itself is untouched
  and still used across the domain; only this document stops printing it. Notes remain.
- **One summary block**: Subtotal, Discount, Tax, a light rule, Total Amount, Amount Paid, then
  Amount Due as the emphasised closing figure. The grand-total row lost its heavy black rule and
  grey fill for a single hairline, per the reference.

### The page break was real, and the first probe missed it

`wrap={false}` on the summary is the same guard the quotation PDF uses. Verified by rendering, not
by reasoning — and the first attempt proved nothing: at 13–16 line items the block happened to fit
either way, so removing the guard produced identical output. Widening the sweep found the genuine
failures at **10 and 12 line items**, where Subtotal printed on one page and Amount Due on the next.
With the guard restored both hold together (10 lines → 2 pages, 12 → 3), summary intact.

> A revert-test that produces identical output has not confirmed the fix — it has only shown the
> chosen inputs do not exercise it. The boundary had to be searched for.

**334 tests pass; typecheck and lint clean.**
