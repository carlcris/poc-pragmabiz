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
- Coverage check: `npm run activity-logging:check`.

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

The wrapper emits request events after the response through Next.js `after()`. Critical database
operations can additionally write a correlated `business_operation` event inside their owning RPC
when commit/rollback-level audit precision is required.

## Related Documentation

- [App-Wide User Activity Logging Plan](../plans/app-wide-user-activity-logging-plan.md)
- [Authentication and Authorization](01-AUTHENTICATION-AUTHORIZATION.md)
- [Project Overview](00-PROJECT-OVERVIEW.md)
