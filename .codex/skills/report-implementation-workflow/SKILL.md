---
name: report-implementation-workflow
description: Use when implementing, reviewing, or fixing app reports in this repo, including report catalog entries, report API routes under src/app/api/reports, report hooks, PDF previews, exports, filtering, sorting, pagination, aggregate queries, permissions, documentation, and report performance review findings.
---

# Report Implementation Workflow

## Pair With Required Skills

Use this skill together with:

- `scalable-list-api` for report lists, pagination, filtering, sorting, exports, and aggregate datasets.
- `supabase-api-safety` for report API routes, Supabase queries, auth, scope, and safe API errors.
- `typescript-contract-verification` for API, hook, PDF, and component response shapes.
- `project-docs-sync` after implementation.
- `supabase-migration-chain` when adding or changing report RPCs, SQL functions, views, indexes, RLS, or generated DB types.
- `granular-permissions-rollout` when changing report permission keys, sensitive cards, redaction, or permission UI behavior.
- `i18n-translation-workflow` when adding or changing user-facing report UI text.

## Workflow

1. Identify the report surface before editing.
   Read the report catalog/page, preview component, hook, API route, PDF component, shared types, permission constants, and relevant docs. For existing reports, inspect immediate callers before changing request or response shapes.

2. Define the contract.
   Specify filters, search, sort fields, grouping, page/limit, export mode, aggregate blocks, response wrappers, and safe error responses. Keep successful response shapes stable unless the task explicitly requires a breaking change.

3. Enforce permission first.
   In report APIs, use:

   ```ts
   const unauthorized = await requirePermission(RESOURCES.REPORTS, "view");
   if (unauthorized) return unauthorized;
   ```

   Do this before company lookups, report queries, aggregation, or export work. Add granular capability checks after base report access when the report exposes sensitive values.

4. Keep filtering and pagination server-side.
   Push company, business-unit, warehouse, item, category, date range, status, search, sorting, and range limits into the database/API query. Do not fetch all rows and filter in React. Normal interactive list requests should stay bounded, typically 10-50 rows per page.

5. Treat exports as explicit modes.
   Do not silently reuse a small UI page as a full export. Add an explicit parameter such as `exportMode=pdf` when export behavior needs a different cap. Keep export row limits intentional and documented. Do not remove bounds for PDF/CSV/Excel exports.

6. Handle heavy aggregate reports honestly.
   Prefer database-owned RPCs/functions for large aggregations. If a report still aggregates in application memory, bound source rows before aggregation and fail fast with a safe `413` response when filters are too broad. Do not return partial totals as if complete.

7. Avoid N+1 and row-by-row report work.
   Batch dimension lookups, use joins/RPCs where practical, and avoid loops that make one query per row. Chunking is only acceptable with an overall ceiling and a correctness-preserving failure path.

8. Keep errors safe.
   Log internal errors server-side. Return stable client messages such as `Failed to fetch stock valuation data` or `Report is too large to generate. Narrow the filters and try again.` Never expose raw Supabase/Postgres errors.

9. Update docs when behavior changes.
   Update `docs/kb` or `docs/guides` when changing report availability, filters, limits, permission behavior, API contracts, export behavior, or operational constraints.

10. Validate with the narrowest reliable checks.
    Run `npm run lint` and `npm run build` for report API/hook/component changes unless a narrower project-approved check exists and is enough. Do not start the app server unless the user asks.

## Implementation Standards

- Use precise names: `exportMode`, `PDF_REPORT_ROW_LIMIT`, `MAX_SOURCE_ROWS`, `groupBy`, `stockStatus`, not vague or unrelated names.
- Balance simplicity and efficiency. If a simpler implementation sacrifices efficiency or completeness, state the tradeoff before implementing when the user asked to review the approach.
- For broad report datasets, prefer refusing with a safe message over silently truncating totals.
- Do not touch commission or analytics report surfaces unless the user explicitly includes them.
- Do not add backward-compatible aliases for new report params during active development unless explicitly requested. Update current callers instead.
- Do not change generated schema types unless a schema migration was applied locally and types were regenerated.

## Review Checklist

- Permission guard returns unauthorized before report work.
- Company/business-unit scope is applied in the query, not only after fetching.
- Filters/search/sort/page are server-backed and deterministic.
- Normal requests are bounded; export requests have explicit caps.
- Aggregate totals are complete for accepted requests.
- Too-large reports fail safely instead of returning partial data.
- API response wrapping matches hooks and components.
- PDF preview uses the intended dataset size and does not accidentally export only page 1 unless that is the documented behavior.
- Docs were checked and updated or explicitly not needed.
- Lint/build or appropriate validation was run, and missing test coverage is reported.
