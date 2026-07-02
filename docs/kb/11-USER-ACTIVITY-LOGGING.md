# User Activity Logging

**Status:** Implemented
**Implementation plan:** [App-Wide User Activity Logging Plan](../plans/app-wide-user-activity-logging-plan.md)

## Overview

User Activity Logging records server-observable activity across the ERP application. Its purpose is internal troubleshooting, operational investigation, and traceability by developers and database administrators.

This capability is not an end-user feature and will not include a user-facing UI.

## Scope

The logging system will cover:

- API reads through `GET`.
- API mutations through `POST`, `PUT`, `PATCH`, and `DELETE`.
- Authentication and session events.
- Web, mobile, tablet, and direct API sources.
- Scheduled and internal database operations using a system actor.
- Success and failure outcomes.
- Critical transactional business operations.

## Core Principles

### Structured Events

Each event uses stable fields for actor, tenant, route, resource, action, entity, payload, outcome, status, duration, and correlation.

Logs must not rely on free-form message strings as their primary structure.

### Append Only

Activity records are immutable. Application users cannot update or delete them.

### Database Only

PostgreSQL/Supabase is the only activity-log destination for the initial implementation. There is no external logging server or end-user API.

### Fail Open

If request-level activity insertion fails, the original business response continues unchanged. The server records a structured `console.error` containing safe context and the request ID.

### Ninety-Day Retention

Records remain available for 90 days. Monthly partitions and scheduled cleanup keep retention work bounded.

## Why Middleware Is Not the Logging Boundary

Next.js middleware is suitable for session refresh, routing decisions, and correlation headers. It is not suitable for authoritative activity logging because it does not reliably know:

- The route handler's final outcome.
- The final HTTP status.
- The resolved company and business unit.
- Generated entity IDs.
- Semantic business actions.
- Whether database work committed or rolled back.

The primary boundary is a typed API route wrapper. Middleware does not own payload or outcome logging.

## Event Types

### Request Events

One request event records the completed API interaction.

Examples:

- A user lists stock adjustments.
- A user views an invoice.
- A user creates a purchase order.
- A user updates an item.
- A user deletes a draft document.
- A login attempt succeeds or fails.

### Business-Operation Events

Critical transactional RPCs may add a second event correlated by the same request ID.

Examples:

- Posting an invoice.
- Approving a purchase order.
- Posting a stock adjustment.
- Dispatching or receiving stock.
- Voiding a POS transaction.

The request event describes the API interaction. The business-operation event describes the committed domain operation.

## Actor Model

Supported actor types:

- `user`: authenticated application user.
- `system`: scheduled or internal operation with no fake user account.
- `anonymous`: unauthenticated activity such as a failed login attempt.

`user_id` is nullable for system and anonymous actors.

## Activity Context

Events may include:

- Request ID.
- User ID.
- Company ID.
- Business-unit ID.
- Source application.
- HTTP method and normalized route.
- Stable resource and action names.
- Primary and additional entity IDs.
- Sanitized route, query, and payload data.
- Outcome, HTTP status, duration, and safe error code.
- Bounded IP and user-agent metadata.

## Human-Readable Activity Messages

Every new activity record includes both structured reporting fields and a safe presentation
snapshot:

- `actor_label`: actor name or verified email at the time of the event.
- `entity_code`: business code such as an item or document number when already available.
- `entity_label`: entity name at the time of the event when already available.
- `message_key`: stable key for future report or localized UI rendering.
- `display_message`: immediately readable English summary.

Example:

```text
Maria Santos deleted item ITM-0042 (Safety Gloves).
```

The identifiers, action, resource type, and outcome remain authoritative for filtering and
reporting. Consumers must not parse `display_message` to recover structured data.

### No Automatic Enrichment Queries

The activity logger never queries users, items, or documents solely to improve a message.

- Actor labels come from the signed `actor_label` JWT claim or context already resolved by the
  route. The access-token hook derives this claim from the existing user-profile lookup using full
  name, username, then email fallback, without another database round trip.
- Browser API calls are cookie-authenticated and do not send a separate `Authorization` bearer
  token. Actor resolution uses the cookie-backed session for browser requests; bearer token actor
  resolution is reserved for non-browser clients. Expired JWTs and rotated refresh tokens are
  treated as unauthenticated actor context for logging purposes rather than application errors.
- Routes that create the shared Supabase server client with business-unit context also pass the
  resolved user, company, and business-unit IDs into the activity logger for the current request.
  This keeps company-scoped activity-log reads aligned with the same context used by API
  authorization and RLS, without per-route enrichment queries.
- Entity labels and codes come from rows or RPC results the operation already loaded or returned.
- Delete operations reuse their existing pre-delete row or transactional result.
- When display details are unavailable, the formatter emits a generic message instead of reading
  more data.

Messages are generated only from explicitly allowlisted presentation fields. Raw request payloads
and response bodies are never used as display-message templates.

User-name changes appear after the user's token is refreshed or the user signs in again. Existing
activity rows intentionally retain their historical actor label.

## Read Logging

Read events capture:

- Route template.
- Entity identifier when applicable.
- Search and filter parameters.
- Pagination and sorting inputs.

Read events never capture response records, report datasets, or export file contents.

## Mutation Payload Logging

`POST`, `PUT`, `PATCH`, and `DELETE` events capture the sanitized request payload when present.

The logger must recursively redact credentials, tokens, cookies, secrets, PINs, payment credentials, and configured sensitive domain fields.

Multipart activity stores file metadata only:

- File name.
- Content type.
- Size.

File bytes, images, and base64 content are never stored.

Payloads are size-bounded. Truncated payloads include explicit truncation metadata.

## Action Naming

Stable action names include:

- `list`, `view`, `search`, `export`.
- `create`, `update`, `delete`.
- `submit`, `approve`, `reject`, `post`, `void`, `cancel`.
- `dispatch`, `receive`, `complete`, `reconcile`.
- `login`, `login_failed`, `logout`, `switch_business_unit`.
- `assign_role`, `remove_role`, `change_permission`.

Workflow routes declare semantic actions explicitly instead of relying only on HTTP methods.

## Security Model

The security contract is:

- RLS enabled on the activity-log table and partitions.
- No activity-log read API or UI.
- No authenticated-client `SELECT`, `UPDATE`, or `DELETE`.
- Inserts accepted only through a restricted database function used by trusted server code.
- Multi-tenant actor context stored with every event when available.
- Payloads treated as sensitive internal data.

Technical staff will inspect records through controlled database tooling.

## Efficiency and Scaling

Logging every read creates one additional database write per API request. This is an accepted tradeoff for complete server-observable activity coverage.

The initial design controls the impact through:

- One append per completed request.
- No response-body logging.
- Bounded payloads.
- Monthly time partitions.
- Targeted indexes.
- Ninety-day retention.
- A pilot rollout with latency and volume measurement before full read coverage.

An external queue is intentionally deferred because it would add delivery infrastructure and operational complexity. It can be reconsidered if measured write volume or request latency justifies it.

## Mandatory Feature Post-Flight

Every feature change must verify:

- New and changed user activities are identified.
- Resource and action names are stable and domain-oriented.
- Read and mutation routes are covered.
- Mutation payloads are correctly redacted.
- Read logs contain query context but no response data.
- Critical operations use transactional activity records when required.
- Success, failure, and denied outcomes are validated.
- Any exemption is explicit and documented.
- The automated activity-logging coverage check passes.

## Retention and Operations

- Retention period: 90 days.
- Cleanup frequency: daily.
- Expired full partitions are dropped.
- Boundary-partition rows are removed in bounded batches when required.
- Cleanup failures are written to database/server operational logs.

## Implementation Status

The request-level logging foundation is implemented across all current API route handlers.

- Parent table: `public.user_activity_logs`.
- Physical monthly partitions: private `activity_logging` schema.
- Append function: `public.append_user_activity_log(jsonb)`, executable only by `service_role`.
- Retention function: `public.maintain_user_activity_logs(integer, integer)`.
- Route wrapper: `src/lib/activity-logging/route-activity-logger.ts`.
- Admin UI: `/admin/activity-logs`.
- Access permission: `activity_logs.view`.
- Coverage check: `npm run activity-logging:check`.

## Activity Logs Admin UI

The Activity Logs page is an interactive admin surface for reviewing minimal, end-user-consumable
activity details.

- Route: `/admin/activity-logs`.
- API: `GET /api/admin/activity-logs`.
- Default access: Super Admin roles receive `activity_logs.view`.
- Configurable access: other roles can be granted `activity_logs.view` from role permissions.
- The API returns display-safe fields such as time, display message, actor label, action, resource,
  outcome, status, source, and request correlation identifiers.
- The API does not return request payloads, route/query params, metadata, IP address, or user-agent
  fields.
- The UI includes quick time presets for today, yesterday, last 7 days, last 30 days, and custom
  date ranges. Preset date ranges are evaluated in the app business timezone (`Asia/Manila`) and
  converted to UTC timestamp boundaries before querying `occurred_at`.
- Date range filters are guarded in the UI and API: the start date cannot be after the end date,
  and direct API requests with an invalid range return `400`.
- UI filters for search, date range, outcome, and source are server-backed and paginated with a
  maximum page size of 50. Manual filter edits are local until the user clicks Apply filters,
  avoiding a list request for each keystroke or control change. Quick date presets apply
  immediately because the preset click is an explicit filter action.

### Adding or Changing an API Route

Export every supported method through `withActivityLogging` with an explicit normalized route,
resource type, and stable action:

```typescript
const POSTHandler = async (request: NextRequest) => {
  // Existing authorization, validation, and business operation.
};

export const POST = withActivityLogging(POSTHandler, {
  action: "approve",
  resourceType: "purchase_orders",
  route: "/api/purchase-orders/[id]/approve",
});
```

Use `setActivityContext` after successful login, session establishment, tenant-context changes, or
when the handler resolves a more precise entity or semantic action than route parameters provide.

Entity presentation snapshots can be supplied without an enrichment query:

```typescript
setActivityContext({
  entityId: item.id,
  entityCode: item.item_code,
  entityLabel: item.item_name,
});
```

The wrapper emits request events after the response through Next.js `after()`. Critical database
operations can additionally write a correlated `business_operation` event inside their owning RPC
when commit/rollback-level audit precision is required.

## Related Documentation

- [App-Wide User Activity Logging Plan](../plans/app-wide-user-activity-logging-plan.md)
- [Authentication and Authorization](01-AUTHENTICATION-AUTHORIZATION.md)
- [Project Overview](00-PROJECT-OVERVIEW.md)
