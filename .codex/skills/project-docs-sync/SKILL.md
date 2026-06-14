---
name: project-docs-sync
description: Use after implementation tasks to check whether changes affect docs/kb or docs/guides, and to update project knowledge base or guide documentation when code, API, schema, permission, workflow, configuration, or architecture behavior changes.
---

# Project Docs Sync

Use this skill during post-flight for implementation tasks.

## Scope

Check documentation impact for:

- User-visible module behavior.
- Business workflows and state transitions.
- API request/response contracts.
- Supabase schema, RLS, RPCs, triggers, generated codes, permissions, or redaction behavior.
- Configuration, setup, architecture, operational guidance, reports, dashboards, lists, selects, and pagination behavior.

Do not update docs for purely internal refactors with no behavior, contract, workflow, or operational impact.

## Documentation Targets

- `docs/kb/`: module and domain knowledge base documentation.
- `docs/guides/`: workflow, developer, operational, and usage guides.

## Workflow

1. Identify the change surface.
   Review changed files and classify the change as UI, API, DB, permission, workflow, config, architecture, report/list behavior, or internal-only.

2. Locate relevant docs.
   Search `docs/kb` and `docs/guides` using module names, route names, table names, RPC names, permission keys, workflow states, and user-facing feature names from the change.

3. Decide documentation impact.
   Update docs when existing documentation would become incomplete, misleading, or stale. If no relevant docs exist for a meaningful behavior change, report the missing coverage.

4. Update surgically.
   Keep documentation factual and aligned to implementation. Preserve existing structure. Avoid broad rewrites, roadmap language, and speculative details.

5. Report post-flight.
   Final response must state:
   - Docs checked.
   - Docs changed, or why no docs update was needed.
   - Missing documentation coverage, if any.

## Checks

- Verify no stale references to renamed or removed routes, files, tables, fields, permissions, or workflows remain in `docs/kb` or `docs/guides`.
- For path changes, run a targeted `rg` for the old path/name.
- If docs are updated, include those files in the normal validation summary.
