---
name: Achlers Integrated Sales
description: An internal ERP operations console for inventory, sales, purchasing, accounting, and manufacturing.
colors:
  console-violet: "hsl(258 45% 65%)"
  console-violet-foreground: "hsl(0 0% 100%)"
  secondary-lilac: "hsl(258 50% 85%)"
  secondary-lilac-foreground: "hsl(258 45% 25%)"
  accent-lilac: "hsl(258 55% 75%)"
  accent-lilac-foreground: "hsl(258 45% 15%)"
  destructive-red: "hsl(0 84.2% 60.2%)"
  canvas: "hsl(0 0% 100%)"
  canvas-foreground: "hsl(240 10% 3.9%)"
  card: "hsl(0 0% 100%)"
  muted: "hsl(258 30% 95%)"
  muted-foreground: "hsl(258 10% 45%)"
  border: "hsl(258 20% 90%)"
  console-rail: "#240032"
typography:
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  signature: "16px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.console-violet}"
    textColor: "{colors.console-violet-foreground}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.console-violet}"
  button-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.canvas-foreground}"
    rounded: "{rounded.md}"
    height: "40px"
  card-default:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "24px"
  input-default:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.canvas-foreground}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "8px 12px"
---

# Design System: Achlers Integrated Sales

## Overview

**Creative North Star: "The Operations Console"**

This is a serious, dark-railed control console for running one business's warehouse, sales,
purchasing, and accounting operations. It is restrained and professional by design: the UI is
built almost entirely in neutral white/gray surfaces with one deliberate brand signal — Console
Violet — that marks primary actions, active navigation, and focus states, derived from the
company logo. The system does not perform brand expression for its own sake; density, scanability,
and permission-gated clarity outrank decoration throughout, in line with the product's Operate-mode
mandate across inventory, sales, purchasing, accounting, manufacturing, and POS workflows.

The one standing exception to the system's flatness is the Console Rail: a permanently dark,
fixed navigation sidebar (`#240032`) that frames every authenticated screen regardless of the
app's own light/dark theme. It is the system's one piece of atmosphere — white-on-dark overlays,
a glowing gradient tile around the logo — while the content canvas beside it stays light,
dense, and businesslike.

**Key Characteristics:**
- One brand accent (Console Violet) used sparingly against neutral surfaces.
- A permanently dark navigation rail independent of the app's light/dark theme.
- Flat-by-default surfaces; shadows are minimal, not a layered elevation system.
- Status is communicated as colored text, not badges (badges are reserved for counts/tags).
- Soft-square 8px radius as the default geometry, with one larger signature radius on the rail's logo tile.

## Colors

A near-monochrome neutral palette carries the interface; purple appears only where it signals
brand or primary action.

### Primary
- **Console Violet** (`hsl(258 45% 65%)`): primary button fills, active sidebar nav state, focus
  rings, links. In dark app-theme mode this lightens to `hsl(258 50% 75%)` to hold contrast
  against the dark canvas.

### Secondary
- **Secondary Lilac** (`hsl(258 50% 85%)`): secondary button fills and lower-emphasis surfaces
  that still want to read as "brand," paired with a deep plum foreground (`hsl(258 45% 25%)`).

### Tertiary
- **Accent Lilac** (`hsl(258 55% 75%)`): hover/accent backgrounds (e.g. ghost button hover,
  dropdown item hover) — one step lighter and more active than Secondary Lilac.

### Neutral
- **Canvas** (`hsl(0 0% 100%)` / dark mode `hsl(258 25% 8%)`): the main content background.
- **Card** (`hsl(0 0% 100%)` / dark mode `hsl(258 20% 12%)`): panel and card surfaces, one step
  off Canvas in dark mode only.
- **Muted** (`hsl(258 30% 95%)`): subdued fills for disabled states and low-emphasis backgrounds.
- **Border** (`hsl(258 20% 90%)`): the hairline that separates every card, input, and section.
- **Console Rail** (`#240032`): the fixed dark sidebar background. Not theme-reactive — it stays
  this color in both the app's light and dark modes, with white-opacity overlays (`white/10`,
  `white/15`, `white/20`) layered on top for borders, hover states, and dividers.

### Status Text
Workflow/status values (not counts or tags) render as colored text via a fixed tone set, never
as badges: `muted`, `blue`, `green`, `yellow`, `amber`, `orange`, `purple`, `indigo`, `red`,
`slate` — each a `-700` shade in light mode and `-400` in dark mode, at `text-sm font-medium`.

### Named Rules
**The One Accent Rule.** Console Violet is reserved for primary actions, active/selected states,
and focus rings. It does not spread across general UI chrome — most of the interface stays
neutral so dense operational data stays legible.

**The Rail Stays Dark Rule.** The Console Rail is a fixed structural element, not a themed
surface. It never switches to a light background, regardless of the signed-in user's light/dark
preference for the rest of the app.

## Typography

**Body Font:** Inter (with system-ui, sans-serif fallback)

**Character:** A single, highly legible grotesque carries the entire system — no display face,
no decorative pairing. The voice is utilitarian and dense-data-friendly, matching an Operate-mode
console rather than a marketing surface.

### Hierarchy
- **Title** (600 weight, 1.125rem–1.25rem, tight leading, `-0.01em` tracking): page headers
  (e.g. "Good morning, {name}!"), card titles, dialog titles.
- **Body** (400 weight, 1rem, 1.5 line-height): default reading size for forms, tables, and
  descriptive text; respects the user's configurable app-wide font-size preference.
- **Label** (500 weight, 0.875rem, 1.4 line-height): form labels, button text, status text,
  nav item text.
- **Muted/Caption** (400 weight, 0.75rem–0.875rem, muted-foreground color): subtitles, helper
  text, timestamps.

### Named Rules
**The One Typeface Rule.** Inter is the only typeface in the system. Hierarchy comes from size
and weight, never from a second font family.

## Layout

The app shell is a fixed-width Console Rail (`md:w-64` expanded, `md:w-20` collapsed) pinned to
the left edge (`md:fixed md:inset-y-0 md:left-0`) beside a scrollable light content canvas. Below
the `md` breakpoint the rail collapses into a 56px top bar holding the menu trigger, logo, and
name, with the Header's account actions overlaid on its right side.

Content pages use a centered, padded container (`container mx-auto p-4 md:p-6`) with vertical
rhythm via `space-y-6`. Page headers sit inside a bottom-bordered block (`border-b border-gray-200
pb-5`) before any content region — breadcrumb/header, then toolbar, then content, per the
dashboard-shell convention. Summary/stat cards lay out in a responsive grid (commonly
`grid gap-4 md:grid-cols-3`) that collapses to a single column on small screens.

## Elevation & Depth

The system is flat by default. Cards and panels use a border plus a light `shadow-sm` rather
than a multi-step elevation scale; most depth cues come from background-color layering (Card vs.
Canvas, Muted fills) rather than shadow. The one deliberate exception is the Console Rail's logo
tile, which carries a pronounced glow (`shadow-[0_12px_30px_rgba(15,23,42,0.35)]`) and a subtle
gradient and ring — a signature moment, not a pattern to repeat elsewhere.

### Named Rules
**The Flat-By-Default Rule.** Shadows are a light touch (`shadow-sm`) on cards and popovers, never
a layered system. The one deliberate exception is the Console Rail's logo tile.

## Shapes

An 8px base radius (`--radius: 0.5rem`) runs through buttons, inputs, and cards via
`rounded-md`/`rounded-lg`, giving every control the same soft-square geometry. The one deliberate
exception is the Console Rail's logo tile, which steps up to a 16px radius (`rounded-2xl`) on
desktop — a single signature moment that marks the brand mark, not a second radius scale to apply
elsewhere.

## Components

### Buttons
- **Shape:** soft-square, 6px radius (`rounded-md`), default height 40px (`h-10`).
- **Primary:** Console Violet fill, white text, `hover:bg-primary/90`.
- **Secondary:** Secondary Lilac fill, deep-plum text, `hover:bg-secondary/80`.
- **Outline:** bordered, canvas background, Accent Lilac hover fill.
- **Ghost:** transparent at rest, Accent Lilac hover fill.
- **Destructive:** destructive-red fill for irreversible actions (delete, void, cancel).
- **Focus:** a 2px Console Violet ring with background-colored offset (`focus-visible:ring-2
  focus-visible:ring-ring focus-visible:ring-offset-2`).

### Cards
- **Corner Style:** 8px radius (`rounded-lg`).
- **Background:** Card neutral, one step off Canvas only in dark mode.
- **Shadow Strategy:** light `shadow-sm`; see Elevation & Depth.
- **Border:** 1px hairline in Border neutral.
- **Internal Padding:** 24px (`p-6`), header/content/footer sub-regions each carry their own
  `p-6` with header-to-content gap removed (`pt-0`) to avoid doubled spacing.

### Inputs / Fields
- **Style:** 1px Border-neutral stroke, Canvas background, 6px radius, 40px height.
- **Focus:** 2px Console Violet ring with background-colored offset, matching buttons.
- **Numeric fields:** a dedicated display-buffer behavior lets partial numeric entry (`-`, `.`,
  trailing `.`) exist mid-edit without being coerced back to the committed value until blur.
- **Disabled:** 50% opacity, pointer-events disabled.

### Navigation (Console Rail)
- **Style:** fixed dark rail (`#240032`) with `white/10`–`white/20` opacity overlays for borders,
  dividers, and hover states; active item marked by Console Violet, not by an opacity overlay.
- **Typography:** Label-scale text, white/90-ish opacity at rest.
- **States:** default (white/70-ish), hover (`white/10` background), active (Console Violet
  accent), loading (pulse skeleton in `white/10`).
- **Mobile treatment:** collapses to a 56px top bar; the full rail opens as an overlay/drawer
  rather than staying pinned.

### Status Text (signature component)
Workflow and status values (order status, stock status, approval state) render as colored label
text via the fixed tone set in Colors > Status Text, never as a badge chip. Badges remain
reserved for counts, categories, and tags, per the system's own hard rule.

## Do's and Don'ts

### Do:
- **Do** reserve Console Violet for primary actions, active nav state, and focus rings (The One
  Accent Rule).
- **Do** keep the Console Rail permanently dark (`#240032`) regardless of the app's light/dark
  theme (The Rail Stays Dark Rule).
- **Do** render status/workflow values as colored text from the fixed tone set, not as badges.
- **Do** use the 8px base radius for all standard controls; reserve the 16px signature radius for
  the rail's logo tile only.
- **Do** keep shadows light (`shadow-sm`) and flat-by-default; let background-color layering do
  most of the depth work.

### Don't:
- **Don't** let Console Violet spread across general chrome, backgrounds, or large fills outside
  primary actions and active/focus states.
- **Don't** theme the Console Rail to follow light/dark mode; it is a fixed structural element.
- **Don't** introduce a second typeface; Inter carries the full hierarchy via size and weight.
- **Don't** use badges for workflow/status values; badges are for counts, categories, or tags only.
- **Don't** introduce a new shadow/elevation scale; the system is flat except for the rail's one
  signature glow.
