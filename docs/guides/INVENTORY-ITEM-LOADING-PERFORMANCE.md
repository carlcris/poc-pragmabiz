# Inventory item loading performance

Measured November 8, 2026, using isolated Next.js production builds of the working tree before and
after the item-page optimizations. Both builds used the same authenticated browser account, the
Main-Bulacan business unit, and the same configured Supabase database (763 items). Authentication,
RLS, permission checks, navigation activity logging, and ordinary application requests remained enabled.

A subsequent dashboard-initialization optimization is measured separately in
[DASHBOARD-INITIALIZATION-PERFORMANCE.md](DASHBOARD-INITIALIZATION-PERFORMANCE.md). The results below
remain the baseline item-page optimization results, before that follow-up.

## Changes

- The inventory page requests `GET /api/items?view=inventory`. This response contains the table's
  stock/display fields and skips pricing settings, timezone, price tiers, and unit-option enrichment.
  The existing full list and export contracts retain their pricing and barcode data.
- Statistics no longer read the default pricing tier. The value card uses the statistics response's
  capability flag; the page no longer subscribes to the separate capabilities endpoint.
- Existing rows remain visible during same-business-unit refetch, with a translated refresh indicator.
  Switching business units clears previous rows until the new unit's query resolves. The initial empty
  search does not schedule a page reset, so a quick Next-page click is not undone by the debounce timer.
- Category lookup uses one verified request context and reuses its actor for permission checks.
  It returns five initial options with bounded server search and pagination. All current category
  consumers, including forms and report previews, use the searchable selector.

## Method

Two temporary source copies on localhost ports 3101 and 3102 preserved existing unrelated working-tree
changes. Each copy was built in production mode. Temporary identical page instrumentation recorded
ready time after two animation frames following a successful table/statistics React commit. Baseline
navigation also waited for its separate value-card capability query. This measures table and metric
readiness, not image decoding, all network activity, or the browser's actual display-present timestamp.

Each navigation run started from a benchmark route inside the already-loaded dashboard shell. A visible
button cleared only `items`, `items-stats`, `item-categories`, and `granular-capabilities` query caches,
recorded `performance.now()`, then navigated through the Next.js router. This forces fresh item data
without repeating login or dashboard initialization. One warm-up per build was excluded. Five pairs
alternated baseline-first and optimized-first order. Resource timings include the browser/server round
trip; payload sizes are decoded JSON bytes, not compressed transfer sizes.

Full-page reloads were measured separately, using new in-memory React Query caches on each reload.
Persisted business-unit state and the authenticated session were retained. Builds and validation were
finished before the matched samples. Exploratory loads during compilation were excluded. These are
small, warm local samples; they do not establish production p95 or cold-start performance.

## Final navigation results

| Median metric                        |   Before |    After | Reduction |
| ------------------------------------ | -------: | -------: | --------: |
| Navigation to table/statistics ready | 197.8 ms | 145.1 ms |     26.6% |
| Item list API                        | 137.2 ms |  94.2 ms |     31.3% |
| Statistics API                       | 104.6 ms |  81.8 ms |     21.8% |

| Sample | Before ready | After ready |
| ------ | -----------: | ----------: |
| 1      |     212.3 ms |    177.4 ms |
| 2      |     197.8 ms |    145.1 ms |
| 3      |     248.1 ms |    160.0 ms |
| 4      |     197.7 ms |    144.6 ms |
| 5      |     179.2 ms |    144.3 ms |

The table/statistics marker does not wait for category options. Baseline category requests commonly
finished later than the marker, so category API timing is reported from the separate reload pass.
The measured navigation improvement is for the table and cards, not completion of every filter or
image request. The final navigation pass includes the quick-pagination fix; the reload pass below
preceded that guard, which only prevents an unchanged initial search from resetting the page number.

## Full-page reload results

| Median metric                    |          Before |       After |
| -------------------------------- | --------------: | ----------: |
| Reload to table/statistics ready |        621.9 ms |    632.8 ms |
| Item list API                    |        154.4 ms |     75.6 ms |
| Statistics API                   |        117.8 ms |     65.3 ms |
| Category API                     |        351.5 ms |    196.5 ms |
| Inventory list decoded JSON      |    16,772 bytes | 2,695 bytes |
| Category decoded JSON            |     2,090 bytes |   385 bytes |
| Separate capabilities request    | 1 / 6,473 bytes |           0 |

The list payload decreased by 83.9%. Reload timing did **not** improve in this sample (about 1.8%
higher median). Dashboard/session/BU initialization and environmental variation dominate enough to
mask the shorter item requests. Do not present the API reductions as an equivalent full-reload gain.

| Sample | Before ready | After ready |
| ------ | -----------: | ----------: |
| 1      |     964.5 ms |    611.9 ms |
| 2      |     815.6 ms |    445.7 ms |
| 3      |     499.8 ms |    994.0 ms |
| 4      |     621.9 ms |    632.8 ms |
| 5      |     530.6 ms |    635.8 ms |

## Validation and remaining coverage

Focused regressions cover inventory payload shape and skipped enrichment, full list/export pricing,
statistics redaction, category bounds/search/scope, direct and dependent lookup permissions,
background row retention, value-card visibility, and active/inactive cache invalidation through an
existing item update mutation. Browser checks cover category search beyond the first five options
and pagination without a document reload.

No SQL or RLS changes were made. Referenced category columns and the stock RPC contract were checked
against the migration chain; the live authenticated requests returned successfully. English and
Chinese selector/refresh messages are maintained together. The inventory KB documents the new
request and response contracts.

Repository-wide lint also traverses an unrelated `.claude/worktrees` checkout, which contains two
pre-existing lint errors. That measurement also reported an unused `itemTypes` warning in the item-create page. The follow-up
restores the enum-based Item Type selector and places the searchable selector on Category; the
`itemTypes` options are used again. Cold starts, remote production latency, large-data query plans, and
end-to-end report export/form-save coverage remain outside this loading benchmark.

Validation completed with 35 focused tests, TypeScript (`tsc --noEmit`), the activity-logging checker,
and production builds of both instrumented copies. Changed source formatting was checked; the existing
edit page's unrelated formatting was preserved to avoid a whole-file rewrite. Existing fixed table
widths and mobile table-height values were retained to preserve the ten-column table footprint; the
new category control uses the `w-48` preset and the refresh region uses `h-4`.

The KB's list/category sections were updated. Older item-create/detail examples elsewhere in that
KB still need a separate contract documentation audit. Temporary timing UI, benchmark routes,
credential-bearing environment copies, and servers were removed after the measurements.
