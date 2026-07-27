---
name: actionable-mutation-errors
description: Make known mutation, workflow, API, Supabase, and RPC business failures safe, specific, translated, and actionable in the UI. Use when creating or changing POST/PUT/PATCH/DELETE routes, server actions, transactional RPC callers, mutation hooks, forms, confirmation dialogs, or toasts; when logs contain a useful failure reason but users see a generic error; or when adding error codes, HTTP status mappings, retry guidance, stale-resource handling, stock conflicts, permission failures, or validation feedback.
---

# Actionable Mutation Errors

Ensure a known business failure keeps its meaning from the database or service boundary through the
API client and into the affected form or dialog. Keep unknown failures generic and safe.

## Workflow

1. Trace the complete failure path.
   - Read the latest effective RPC/function or service definition.
   - Read the API route, shared API client, API helper, mutation hook, shared types, and immediate UI
     caller.
   - Confirm the actual response wrapper and how non-2xx response data is preserved.

2. Inventory deterministic failures.
   - List every known business exception that the operation can produce.
   - Include equivalent preflight failures from authentication, permissions, scope, and request
     validation.
   - Classify each as `400` invalid request, `401` unauthenticated, `403` forbidden, `404` missing,
     `409` stale/conflicting business state, or `500` unexpected failure.
   - Do not add database reads solely to enrich an error. Use bounded structured details only when
     the operation already has them or the user explicitly requires line-level detail.

3. Define a stable API contract.
   - Map known internal failures at the server boundary to:

     ```json
     {
       "error": "Safe fallback message",
       "code": "STABLE_DOMAIN_ERROR_CODE"
     }
     ```

   - Log raw database, Supabase, or exception details server-side with operation context.
   - Never return raw backend messages, stack traces, SQL details, or arbitrary exception text.
   - Return unknown failures as a generic safe `500`.
   - Use the same stable code for the same condition whether it is caught during preflight or by the
     transactional operation.

4. Preserve and type the code client-side.
   - Add a shared string-literal union for the operation's public error codes.
   - Verify the shared API client preserves the parsed error payload, normally in `Error.cause`.
   - Narrow the code with a shared helper. Never branch in UI code on human-readable error text.
   - Keep current successful response shapes unchanged unless the task explicitly requires a
     contract change.

5. Present corrective guidance.
   - Add matching `next-intl` keys for English and Chinese.
   - State what failed and what the user can do next. Prefer “reactivate the item, or cancel and
     recreate the order” over “operation failed.”
   - Let the page or component own toasts, inline alerts, and dialog state. Mutation hooks should not
     hardcode presentation side effects by default.
   - Keep a form or asynchronous dialog open after a recoverable failure and show the message near
     the action. Do not use an auto-closing dialog action for a submit that can fail; use a normal
     button and close only after success.
   - Clear stale errors when starting a retry, changing the relevant input, or closing the surface.
   - Disable submission while pending so one user action cannot create duplicate requests.

6. Keep correctness boundaries intact.
   - Do not weaken transactional validation to avoid an error.
   - Do not add redundant processed-row counters, post-insert count checks, retries, or fallback
     writes unless independently required for correctness.
   - Do not expose hidden records, sensitive values, or permission details in error messages.
   - Preserve API authorization and database rollback behavior.

## Required Verification

- Exercise or inspect at least one known failure from backend reason to rendered UI message.
- Confirm the API returns the expected safe code, message, and HTTP status.
- Confirm unknown errors remain generic and raw details remain server-only.
- Confirm the dialog/form remains usable after failure and duplicate submission is blocked.
- Run TypeScript, lint, activity-logging enforcement, formatting/diff checks, and the production
  build in proportion to the change.
- Check `docs/kb` and `docs/guides`; update the error contract or QA workflow when behavior changed.
- Report missing automated API/UI coverage when the repository lacks a suitable test harness.
