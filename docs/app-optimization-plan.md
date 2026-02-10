# App Optimization Plan (No-Break Phased Approach)

This document now includes both the strategic phase plan and execution-level detail.

## Goals
- Improve responsiveness, load times, and data efficiency without breaking workflows.
- Reduce overfetching and re-render cost across web/tablet/mobile.
- Standardize API usage and error handling for consistency and stability.

## Execution Principles
- Ship each phase in small, reversible PRs.
- Keep endpoints backward-compatible until all consumers are migrated.
- Measure before/after each phase on the same baseline routes.
- Do not begin the next phase until exit criteria are met.

## Baseline Routes and Workflows
- Dashboard
- Inventory items list
- Load lists
- GRN list/detail
- Tablet receiving flow

## Phase 0 — Baseline & Guardrails (No behavior changes)
**Objective:** add measurement and safety nets.

### Entry Criteria
- Current production/staging branch is stable.
- Monitoring credentials and sinks are available.

### Execution Steps
1. Add route-level performance instrumentation (TTFB, hydration, route transition).
2. Add API telemetry by endpoint (p50/p95 latency, error rate, request count).
3. Capture bundle stats for critical routes.
4. Add runtime error tracking (client/server) with user/session/business-unit context.
5. Add PR checklist items (bundle, API query count, render impact).
6. Introduce feature flags for risky optimizations.

### Deliverables
- Baseline performance report for baseline routes.
- PR template updates merged.
- Feature-flag utility documented.

### Exit Criteria
- Baseline metrics captured and shareable.
- Error tracking visible from client and server paths.

### Rollback
- Disable instrumentation using environment flags if overhead/regressions appear.

---

## Phase 1 — Data & API Efficiency (Low risk)
**Objective:** reduce DB round trips and payload size.

### Dependencies
- Phase 0 complete.

### Execution Steps
1. `In Progress` Audit endpoint `select` clauses; return only required columns.
2. `In Progress` Enforce server-side pagination/filtering on all list endpoints.
3. `In Progress` Standardize pagination defaults and max limits.
4. `Completed` Add/verify DB indexes for frequently filtered fields:
   - `status`
   - date/timestamp fields
   - `business_unit_id`
   - `warehouse_id`
5. `In Progress` Tune React Query behavior:
   - Deduplicate concurrent requests.
   - Reduce unnecessary `refetchOnWindowFocus`.
   - Set route-appropriate `staleTime`.
6. `Pending` Add before/after payload size checks.

### Deliverables
- `In Progress` Endpoint audit checklist completed.
- `Completed` Migration(s) for missing indexes.
- `In Progress` React Query defaults documented and applied.

### Exit Criteria
- Lower payload sizes on target endpoints.
- Fewer duplicate requests per page load.
- No endpoint error-rate regression.

### Rollback
- Revert individual query/index changes independently.
- Restore prior React Query defaults if freshness regressions appear.

---

## Phase 2 — Frontend Rendering & UX
**Objective:** make UI more responsive on large lists.

### Dependencies
- Phase 1 complete.

### Execution Steps
1. Profile expensive routes with React Profiler.
2. Memoize heavy table/card rows and derived props.
3. Virtualize large lists:
   - Inventory
   - Load list items
   - GRN items
4. Add skeletons for slow reads.
5. Add optimistic updates for low-risk mutations.
6. Reduce dialog state churn to avoid parent-tree re-renders.

### Deliverables
- Virtualized list components on target screens.
- Render profile snapshots (before/after).

### Exit Criteria
- No noticeable lag when scrolling large lists.
- UI remains responsive during mutations.

### Rollback
- Keep virtualization behind flags; disable for regressions.

---

## Phase 3 — Auth/Session & Network Consistency
**Objective:** unify auth handling and eliminate 401 edge cases.

### Dependencies
- Run after Phase 1; complete before late Phase 4 API specialization.

### Execution Steps
1. Route all client requests through `apiClient`.
2. Ensure each API request lifecycle calls `getUser()` once and reuses context.
3. Standardize API error response shape and status mapping.
4. Add tablet/mobile regression checks for cookie/header behavior.
5. Remove duplicated auth checks and legacy fetch helpers.

### Deliverables
- Documented `apiClient` request contract.
- Common API error schema applied to active routes.

### Exit Criteria
- No intermittent 401s in staging smoke tests.
- No duplicated auth checks in the same request.

### Rollback
- Maintain compatibility wrappers for legacy callers until fully migrated.

---

## Phase 4 — Domain-Specific Optimizations
**Objective:** targeted improvements in the most critical workflows.

### Dependencies
- Phases 1 and 3 complete.

### Execution Steps
1. Inventory:
   - Pre-aggregate on-hand/in-transit/reserved by BU.
   - Add short-TTL caching for summary endpoints.
2. Receiving / Load Lists / GRNs:
   - Batch status transition writes where possible.
   - Remove redundant receiving status writes.
   - Add lightweight GRN-by-`load_list_id` endpoint for tablet.
3. Dashboards:
   - Consolidate duplicated dashboard queries.
   - Replace expensive joins with safe cached aggregates.
4. Validate correctness with reconciliation scripts over sampled records.

### Deliverables
- Inventory aggregate/cache path.
- Optimized receiving and dashboard endpoints.
- Reconciliation report with drift checks.

### Exit Criteria
- Dashboard endpoints remain sub-500ms under typical load.
- Receiving flows do not lag on status transitions.
- Reconciliation within accepted tolerance.

### Rollback
- Feature-flag aggregate/cached reads and fall back to source queries.

---

## Phase 5 — UX Polish & Debt Cleanup
**Objective:** remove legacy patterns and keep tablet/web aligned.

### Dependencies
- Phase 4 stable for at least one release cycle.

### Execution Steps
1. Remove old PO receiving flow after usage confirmation.
2. Consolidate tablet + web shared hooks/components.
3. Normalize naming conventions (load list, GRN, stock requisitions).
4. Remove temporary compatibility code from prior phases.
5. Update architecture and onboarding docs.

### Deliverables
- Deprecated flow removals merged.
- Shared primitives used across tablet/web.
- Updated docs.

### Exit Criteria
- Reduced duplicate code and fewer special cases.
- No active route depends on deprecated receiving flow.

### Rollback
- Keep deprecated flow behind a gate for one release window before hard removal.

---

## Suggested Start Order (Low Risk → High Impact)
1. Phase 0
2. Phase 1
3. Phase 3
4. Phase 2
5. Phase 4
6. Phase 5

## Suggested Timeline (Example)
- Sprint 1: Phase 0
- Sprint 2: Phase 1
- Sprint 3: Phase 3
- Sprint 4: Phase 2
- Sprint 5-6: Phase 4
- Sprint 7: Phase 5

## Cross-Phase Tracking Template
Use this per phase in PR/release notes:
- Scope completed
- Metrics before/after (latency, payload, errors, renders)
- Flags enabled/disabled
- Risks found
- Rollback readiness

## Immediate Next Actions
1. Approve baseline metric schema and dashboards for Phase 0.
2. Freeze endpoint scope for Phase 1 audit.
3. Assign one owner per phase and one cross-phase QA owner.

## Current Execution Decision
- Phase 0 is intentionally skipped for now.
- Active implementation has started at Phase 1 with low-risk API payload/pagination hardening on core list endpoints.

## Progress Snapshot (As Of 2026-02-08)
- `Completed` Created and validated composite index migration: `supabase/migrations/20260207000000_add_phase1_composite_filter_indexes.sql` (`supabase db reset` passed).
- `In Progress` Reduced overfetch (`select` tightening) across core receiving/procurement endpoints: items, load lists, GRNs, purchase receipts, purchase orders, tablet receiving routes.
- `In Progress` Standardized pagination parsing/caps on core list routes (max page size guardrails applied).
- `In Progress` React Query tuning started (tablet receiving + warehouse dashboard stale/focus behavior adjusted).
- `Pending` Payload size before/after reporting and full endpoint audit completion.

## Notes
- Each phase is safe to ship independently.
- Avoid breaking changes by keeping endpoints backward-compatible until fully migrated.
- Prefer incremental refactors over sweeping changes.
