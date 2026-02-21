# Generic Rule: Scalable, Optimized, Production-Ready API Design

## Scope
Apply this rule primarily to list/search/report APIs that return collections and aggregates.
For detail endpoints (`GET /:id`) and command endpoints (`POST/PATCH/DELETE`), apply the reliability,
authorization, and contract stability sections, but skip pagination requirements.

## Core Principles
1. Keep endpoints single-responsibility and predictable.
2. Move heavy computation, filtering, and aggregation to the database layer.
3. Design for large datasets from day one.
4. Optimize for correctness first, then performance, then developer ergonomics.

## Must-Have Rules
1. Enforce strict server-side pagination.
2. Use backend filtering and sorting only; never fetch-all then filter in application memory.
3. Use strict page-based pagination by default for list APIs in this repository today; defer cursor-based pagination until UUIDv7 (or another monotonic cursor key) is adopted.
4. Keep request parameters validated early (types, enum values, UUIDs, ranges).
5. Keep response schemas stable and versioned when contracts change.
6. Use explicit, indexed fields for search, sort, and pagination keys.
7. Execute joins/aggregates in SQL (views, CTEs, RPC/functions) instead of per-row app loops.
8. Make expensive expansions optional (`includeStats`, `expand`, `includeDetails`) and default-off.
9. Return only required fields; avoid overfetching.
10. Keep handlers thin: auth, validation, orchestration, response mapping.
11. Enforce authz and data scope at both API and DB policy level.
12. Use idempotency for write operations that can be retried.
13. Add deterministic timeout/retry behavior for external dependencies.
14. Log structured telemetry (request id, latency, result size, error class).
15. Fail with clear, machine-readable errors and consistent HTTP status codes.

## Repository Defaults
1. Default page size target: 10-50 records per request.
2. Page-based server-side pagination + lazy loading is the default list pattern for now.
3. Enable compressed API responses (GZIP/Brotli) where available.
4. Apply backend request-rate limiting and batch backend calls when possible.
5. Avoid full-list queries in UI flows unless explicitly approved for bounded datasets.

## Performance Requirements
1. Never run N+1 queries in API handlers.
2. Batch reads/writes when possible.
3. Avoid duplicate full scans for list + summary in same call unless explicitly requested.
4. Apply freshness policy by data type:
   - Mutable operational data: default `no-store` or very short TTL.
   - Stable reference data: allow bounded TTL with explicit invalidation strategy.
5. Use DB query plans and indexes to validate critical paths.
6. Keep payload sizes bounded via pagination and field selection.

## Data Contract Requirements
1. Standard list response:
   - `data`
   - `pagination` (`cursor` or `page`, `limit`, and one of: `total` or `hasMore`/`nextCursor`)
   - optional `statistics`
2. Always return deterministic ordering for paged results.
3. Keep numeric/decimal fields normalized and typed consistently.
4. Avoid leaking internal schema details in external responses.

## Reliability Requirements
1. Treat partial failures explicitly (all-or-nothing transaction or per-item status contract).
2. Use database transactions for multi-table writes.
3. Ensure operations are safe under concurrency (locking or conflict handling).
4. Add guardrails for high-cost queries (max limit, max date range, complexity constraints).

## Anti-Patterns (Do Not Do)
1. Fetch all rows to compute status/counts in memory.
2. Filter in frontend because backend query is incomplete.
3. Hide implicit scope behavior behind UI defaults.
4. Return different response shapes for same endpoint without versioning.
5. Couple one endpoint to unrelated workflows.

## Definition of Done (API)
1. Contract documented and validated.
2. Query path indexed and benchmarked.
3. Authorization and scope tests passed.
4. Lint/build/type checks passed.
5. Observability (logs/metrics/errors) in place.
6. Backward compatibility confirmed for existing consumers.

## Quick Implementation Checklist
1. Define endpoint contract and limits.
2. Design SQL-first query plan (including indexes).
3. Implement thin handler + strict validation.
4. Add optional expansions for expensive data.
5. Add tests for pagination, filtering, authz, and edge cases.
6. Measure latency and payload size before release.
