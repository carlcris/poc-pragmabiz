# App-Wide User Activity Logging Plan

**Status:** Implemented
**Created:** 2026-06-29
**Audience:** Backend developers, database administrators, and technical operators

## Objective

Capture server-observable user and system activity in a structured, append-only log for internal technical investigation. The system must cover API reads and mutations, retain records for 90 days, and never expose an end-user activity-log UI.

## Approved Decisions

- Log authenticated API activity for `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`.
- Log successful and failed authentication events with stronger credential redaction.
- Store sanitized request payloads for mutation methods.
- Store route parameters and query parameters for reads, but never response datasets.
- Retain activity records for 90 days.
- Use PostgreSQL/Supabase as the only activity-log destination for now.
- Fail open when activity logging fails: preserve the original application response and emit a server-side `console.error`.
- Represent scheduled and internal operations with `actor_type = 'system'` and a nullable `user_id`; do not create a fake user account.
- Add no end-user UI or API that exposes activity logs.
- Make activity-log coverage a mandatory post-flight check for every feature implementation.

## Architecture Decision

### Do Not Use Next.js Middleware as the Authoritative Logger

The current Next.js middleware is responsible for session refresh and excludes `/api`. Expanding it would not solve the core logging requirements because middleware cannot reliably capture:

- The final route outcome and HTTP status.
- Route-level company and business-unit context.
- Semantic business actions such as approve, post, dispatch, receive, or cancel.
- Database-generated entity identifiers.
- Whether a transactional RPC committed or rolled back.
- Sanitized, schema-aware mutation payloads.

Middleware may propagate a request ID in the future, but it must not own authoritative activity logging.

### Primary Boundary: Typed API Route Wrapper

Create a typed route-handler wrapper that:

1. Generates or accepts a request ID.
2. Resolves actor, company, and business-unit context once.
3. Captures route and query parameters.
4. Clones and parses supported request bodies.
5. Applies recursive redaction and payload limits.
6. Executes the route handler.
7. Records one request activity event with outcome, status, and duration.
8. Returns the original response unchanged.
9. Logs insertion failures with `console.error` without failing the business request.

Standard CRUD routes may derive actions from the HTTP method. Workflow routes must declare semantic actions explicitly.

### Transactional Boundary for Critical Operations

Critical workflow RPCs should write an additional business-operation activity record inside the same database transaction when the activity record must share commit/rollback behavior with the operation.

Examples:

- Post or void financial documents.
- Approve or cancel purchase orders.
- Post stock adjustments.
- Dispatch or receive stock.
- Complete pick lists.
- Execute transformations.
- Process payments.

Request-level and business-operation records use the same request ID. They are separate event kinds, not accidental duplicates.

## Proposed Data Model

Create a monthly partitioned `user_activity_logs` table with these logical fields:

| Field              | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `id`               | UUID event identifier                                          |
| `occurred_at`      | Server timestamp and partition key                             |
| `request_id`       | Correlates API and transactional events                        |
| `event_kind`       | `request` or `business_operation`                              |
| `actor_type`       | `user`, `system`, or `anonymous`                               |
| `user_id`          | Authenticated user when applicable                             |
| `company_id`       | Tenant scope when available                                    |
| `business_unit_id` | Active business-unit scope when available                      |
| `source`           | `web`, `mobile`, `tablet`, `api`, or `system`                  |
| `http_method`      | Request method for request events                              |
| `route`            | Normalized route template, not a raw URL                       |
| `action`           | Semantic action such as `view`, `create`, `post`, or `approve` |
| `resource_type`    | Stable domain resource name                                    |
| `entity_id`        | Primary affected entity when known                             |
| `entity_ids`       | Additional affected entity identifiers                         |
| `route_params`     | Sanitized route parameters                                     |
| `query_params`     | Sanitized read filters and pagination                          |
| `request_payload`  | Sanitized mutation payload                                     |
| `outcome`          | `succeeded` or `failed`                                        |
| `http_status`      | Final HTTP status when applicable                              |
| `duration_ms`      | Route execution and logging timing                             |
| `error_code`       | Stable safe error classification                               |
| `ip_address`       | Request IP when available                                      |
| `user_agent`       | Bounded user-agent value                                       |
| `metadata`         | Small structured technical context                             |

### Indexes

Add indexes for:

- Company and descending occurrence time.
- User and descending occurrence time.
- Resource type, entity ID, and descending occurrence time.
- Action and descending occurrence time.
- Outcome and descending occurrence time.
- Request ID.

Monthly partitions make the 90-day retention policy predictable and avoid large row-by-row cleanup operations.

## Payload Policy

### Mutation Requests

Capture sanitized JSON payloads for `POST`, `PUT`, `PATCH`, and `DELETE`.

### Read Requests

Capture:

- Normalized route.
- Route parameters.
- Query filters.
- Pagination and sorting inputs.

Do not capture:

- Response rows.
- Report datasets.
- Export file contents.

### Mandatory Redaction

Recursively remove or replace:

- Passwords and password confirmations.
- PINs and one-time codes.
- Access tokens, refresh tokens, API keys, and secrets.
- Authorization and cookie values.
- Card numbers, CVV values, and payment credentials.
- Private keys and signing material.
- Configured sensitive domain fields.

For multipart requests, store file name, content type, and size only. Never persist file bytes, base64 content, or images.

Apply a strict serialized payload-size limit. Record truncation metadata when a sanitized payload exceeds the limit.

## Action Taxonomy

Use stable domain-oriented action names:

- Reads: `list`, `view`, `search`, `export`.
- CRUD: `create`, `update`, `delete`.
- Workflow: `submit`, `approve`, `reject`, `post`, `void`, `cancel`, `dispatch`, `receive`, `complete`, `reconcile`.
- Authentication: `login`, `login_failed`, `logout`, `refresh_session`, `switch_business_unit`.
- Administration: `assign_role`, `remove_role`, `change_permission`, `activate_user`, `deactivate_user`.

Do not derive workflow action names from arbitrary URL text when a stable explicit action can be declared.

## Security and Access

- Enable RLS on all partitions.
- Do not grant authenticated users `SELECT`, `UPDATE`, or `DELETE`.
- Allow appending only through a restricted database function called by trusted server code.
- Keep activity-log APIs and UI out of scope.
- Technical staff review logs through controlled database tooling.
- Treat activity payloads as sensitive internal data.

## Failure Behavior

Activity logging is fail-open because its purpose is internal diagnostics rather than compliance enforcement.

If an insert fails:

1. Emit a structured `console.error` with request ID, route, action, and safe error details.
2. Do not expose the logging failure to the client.
3. Do not change the original business response.

Transactional business-operation records remain subject to the owning RPC transaction.

## Retention

- Retain records for 90 days.
- Run a daily scheduled database maintenance operation.
- Drop expired monthly partitions when fully outside the retention window.
- Remove expired rows from the partially retained boundary partition in bounded batches if required.
- Log cleanup failures through server/database operational logs.

## Rollout Plan

All request-level rollout phases below were completed on 2026-06-29. Transactional RPCs may add
correlated `business_operation` events when a workflow requires the activity record to commit or
roll back with the business transaction.

### Phase 1: Foundation

- Add the partitioned table, indexes, grants, RLS, and restricted insert function.
- Add shared TypeScript contracts and payload sanitizer.
- Add request-ID support and the typed route wrapper.
- Add retention maintenance.

### Phase 2: Pilot

- Wrap authentication, RBAC administration, stock adjustments, and one read-heavy module.
- Verify redaction, latency, actor context, and tenant isolation.
- Measure activity rows per day and database growth.

### Phase 3: Mutation Coverage

- Migrate all `POST`, `PUT`, `PATCH`, and `DELETE` routes.
- Add transactional records to critical RPCs.
- Add route-level semantic action declarations.

### Phase 4: Read Coverage

- Migrate all `GET` routes.
- Confirm query logging does not include response datasets.
- Validate high-volume list and lookup endpoints.

### Phase 5: Enforcement

- Add an automated repository check that identifies unwrapped API handlers.
- Require explicit, documented exemptions for health checks and infrastructure-only endpoints.
- Add the mandatory feature post-flight rule to `AGENTS.md`.

## Implemented Components

- `public.user_activity_logs` partitioned parent table.
- Private monthly partitions in the `activity_logging` schema.
- Restricted `append_user_activity_log` RPC for `service_role` only.
- Daily `pg_cron` maintenance with 90-day retention and bounded boundary deletion.
- Typed request wrapper using Next.js `after()` for post-response appends.
- Recursive sensitive-field redaction and bounded mutation payload capture.
- Explicit authentication and business-unit context overrides.
- Request-ID response headers and API/business-event correlation support.
- Activity coverage for all current API route handlers.
- `npm run activity-logging:check` enforcement for future API handlers.

## Mandatory Feature Post-Flight

Every feature implementation must:

- Identify all new or changed server-observable user actions.
- Assign stable resource and action names.
- Add or update route activity coverage.
- Confirm mutation payload redaction.
- Confirm read query logging without response data.
- Decide whether critical operations also need transactional activity records.
- Test success, failure, and authorization-denied outcomes.
- Document explicit exemptions.
- Run the activity-logging coverage check.

## Validation

- Verify successful and failed reads.
- Verify successful and failed mutations.
- Verify authentication and anonymous failure events.
- Verify user, company, and business-unit attribution.
- Verify system actor behavior.
- Verify semantic workflow actions.
- Verify recursive redaction and payload truncation.
- Verify multipart metadata handling.
- Verify transactional rollback behavior.
- Verify RLS and direct-access denial.
- Verify 90-day retention.
- Measure request latency and write volume under concurrent read traffic.
- Run `supabase db reset`, regenerate database types, `npm run lint`, and `npm run build`.

## Related Documentation

- [User Activity Logging KB](../kb/11-USER-ACTIVITY-LOGGING.md)
- [Authentication and Authorization](../kb/01-AUTHENTICATION-AUTHORIZATION.md)
- [Project Overview](../kb/00-PROJECT-OVERVIEW.md)
