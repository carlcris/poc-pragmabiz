# TIMESTAMPTZ Rollout Plan

## Objective

Standardize operational datetime storage across the ERP to use `TIMESTAMPTZ` instead of `TIMESTAMP`.

This is a future execution plan. It is not a blanket migration to run blindly. The rollout should be staged, verified per module, and applied only after auditing write paths and downstream consumers.

## Why

Current risks with `TIMESTAMP`:

- date flips around midnight when users operate outside the database server timezone
- ambiguous queue, lead-time, SLA, and audit calculations
- inconsistent client rendering because timezone context is missing
- hidden assumptions like `timezone('utc', now())` pushed into application or SQL code

Desired contract:

- store real instants as `TIMESTAMPTZ`
- write them with `now()` or equivalent timezone-safe server timestamps
- render them explicitly in the user locale/timezone
- reserve plain `DATE` only for calendar-only business fields

## Scope

This plan applies to operational timestamp columns such as:

- `created_at`
- `updated_at`
- `deleted_at`
- `started_at`
- `completed_at`
- `approved_at`
- `confirmed_at`
- `reserved_at`
- `consumed_at`
- `released_at`
- `received_at`
- `posted_at`
- workflow/event timestamps of the same kind

This plan does **not** automatically convert:

- pure `DATE` business fields like `due_date`, `order_date`, `invoice_date`, `required_date`
- intentionally date-only accounting or tax fields

## Rollout Principles

1. Do not migrate the whole ERP in one shot.
2. Migrate by domain/module.
3. Audit schema, write paths, API responses, and UI renderers together.
4. Remove manual timezone coercion from code when moving to `TIMESTAMPTZ`.
5. For legacy `TIMESTAMP` data, define the interpretation rule explicitly before conversion.
6. Prefer `ALTER COLUMN ... TYPE TIMESTAMPTZ USING ... AT TIME ZONE 'UTC'` only when the legacy values were intended to represent UTC clock time.
7. If a module stored local-server time instead, stop and document that mismatch before conversion.

## Module Order

Recommended execution order:

1. Manufacturing
2. Sales workflow
3. Inventory workflow
4. Purchasing workflow
5. Accounting workflow
6. Notifications, logs, and reporting support tables
7. Remaining master-data audit columns

Manufacturing was already identified as high-risk because queue and production timing are user-facing and operationally sensitive.

## Per-Module Execution Checklist

For each module:

1. Inventory the schema
   - list all `TIMESTAMP` columns
   - classify each as:
     - operational instant -> convert to `TIMESTAMPTZ`
     - date-only business field -> keep as `DATE`
     - unknown -> investigate

2. Inventory write paths
   - SQL migrations / RPCs
   - API routes
   - Supabase inserts/updates
   - triggers/functions like `update_updated_at_column()`
   - client code generating timestamps

3. Inventory read/render paths
   - APIs returning those fields
   - list/detail pages
   - PDFs/reports
   - queue/age/SLA calculations
   - export jobs

4. Define legacy-data interpretation
   - verify whether old `TIMESTAMP` values were effectively UTC
   - if yes, convert with `AT TIME ZONE 'UTC'`
   - if not, define a module-specific conversion rule

5. Create migration
   - alter target columns to `TIMESTAMPTZ`
   - fix defaults if needed
   - replace `timezone('utc', now())` writes with `now()`
   - update helper functions if they assume timezone-less timestamps

6. Update app code
   - ensure no code strips timezone context
   - avoid rebuilding timestamps in the client
   - keep formatting explicit with locale/timezone-aware renderers

7. Verify
   - create new rows before/after midnight local time
   - verify DB values
   - verify API payloads
   - verify UI labels and elapsed-time calculations
   - verify reports/PDFs

## Audit SQL

Use this to find remaining timezone-risk columns:

```sql
SELECT
  table_schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type IN ('timestamp without time zone', 'timestamp with time zone')
ORDER BY table_name, column_name;
```

Use this to focus only on still-unmigrated columns:

```sql
SELECT
  table_schema,
  table_name,
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND data_type = 'timestamp without time zone'
ORDER BY table_name, column_name;
```

## Code Audit Targets

Search patterns to eliminate during rollout:

```text
timezone('utc', now())
CURRENT_TIMESTAMP
new Date(value)
toLocaleDateString
toLocaleString
toISOString
split("T")[0]
```

Notes:

- `CURRENT_TIMESTAMP` is fine with `TIMESTAMPTZ`, but verify the target column type.
- `split("T")[0]` is usually a red flag when used on instant timestamps instead of true date fields.
- `new Date(value)` is not wrong by itself, but it becomes dangerous if the source field lacks timezone context.

## Migration Template

Pattern for modules where legacy values were intended as UTC:

```sql
ALTER TABLE public.some_table
  ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
  ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC';
```

Pattern for write-path cleanup:

```sql
-- Before
started_at = timezone('utc', now())

-- After
started_at = now()
```

## Validation Rules

A module rollout is not complete until all of these are true:

- schema columns are `TIMESTAMPTZ`
- new writes use timezone-safe server timestamps
- no client/API fallback relies on implicit server timezone
- elapsed-time calculations are based on timezone-safe instants
- user-visible dates/times render correctly in local timezone

## Known Follow-Up

After enough modules are migrated, update the general database standards docs so new tables stop using `TIMESTAMP` as the default audit pattern.
