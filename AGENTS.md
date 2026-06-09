# Repository Instructions

This repository is a Next.js 15 ERP frontend with Supabase-backed data. This file is the root routing and enforcement contract for Codex work in this repo.

Use nested `AGENTS.md` files for directory-specific rules. Use skills for procedural workflows. Treat `docs/CLAUDE.md` as historical guidance unless a current instruction or skill explicitly references it.

## Project Map

- `src/app/` contains App Router pages and API routes.
- `src/components/`, `src/hooks/`, `src/lib/`, `src/services/`, and `src/stores/` contain UI, data logic, helpers, API clients, and state.
- `src/types/`, `src/constants/`, and `src/config/` contain shared contracts and configuration.
- `supabase/migrations/` contains schema, RLS, RPC, trigger, and data migrations.
- `docs/` contains architecture, workflow, and product reference material.

## Commands

Run commands from the repo root unless a nested instruction says otherwise.

- `npm install` installs dependencies.
- `npm run dev` starts the dev server.
- `npm run build` builds the production bundle.
- `npm start` serves the production build.
- `npm run lint` runs ESLint.
- `npm run format` formats supported files.
- `supabase start` / `supabase stop` manage local Supabase.
- `supabase db reset` rebuilds the local DB from migrations and seed data.
- `supabase gen types typescript --local > src/types/database.types.ts` refreshes generated DB types.

## Hard Constraints

- TypeScript only. Prefer `type` over `interface`. Avoid `any`; use `unknown` and narrow explicitly.
- Prefer named exports. Page files may default-export.
- Keep changes surgical and production-grade. Do not add speculative abstractions or temporary fallbacks unless explicitly requested.
- Read the relevant exports, callers, hooks, API routes, migrations, and types before editing.
- If schema or environment drift is found, stop and report the exact mismatch instead of masking it with compatibility code.
- Never expose raw database, Supabase, or internal exception text to API clients. Log internal details server-side and return safe messages.
- Do not send insert-only identity, ownership, control number, or creation-linkage fields through update paths.
- Server data lists, reports, selects, comboboxes, and autocomplete controls must use backend filtering/sorting and bounded pagination.
- UI text introduced or changed by implementation work must use the repository `next-intl` translation system.

## Subsystem Rules

### API Routes And Data Contracts

- Verify table, column, relationship, enum, RPC, trigger, and policy names against `supabase/migrations/` before writing Supabase queries.
- Keep handlers thin: validate input, enforce auth/scope, call DB/RPC/service code, and map safe responses.
- Keep response shapes stable. Check all hooks, services, and callers before changing wrappers or field names.
- The shared `apiClient` returns parsed JSON; avoid unverified double-unwrapping.

### Hooks

- Hooks own data fetching, mutations, cache invalidation, typed state, and typed error propagation.
- Hooks should not hardcode UI toasts, banners, dialogs, or presentation side effects by default.
- Pages and components should decide how mutation success/error states are shown.

### Dashboard Pages

- Render a stable dashboard shell first: breadcrumb, page header, toolbar/filter row, then content region.
- Do not replace normal dashboard pages with blank screens or full-page spinners during data fetches.
- Skeleton only dynamic regions and keep loading, empty, error, and loaded states in the same shell footprint.
- Visible row actions like `Edit`, `View`, or `Open` should include text labels. Put destructive and secondary actions in a kebab dropdown.

### Components And I18n

- Use PascalCase for components and camelCase for functions and variables.
- Do not introduce hardcoded user-facing strings when they should be translated.
- Use `next-intl` with `src/lib/i18n/translations.ts` as the source of truth.
- Keep `en` and `zh` translation keys in parity. Do not use inline locale conditionals, local translation maps, dynamic generated keys, or placeholder keys.

### Supabase Migrations

- Search the full migration chain before changing any database object.
- Identify the latest effective definition; later `ALTER`, corrective migrations, and `CREATE OR REPLACE FUNCTION` migrations can supersede earlier definitions.
- Do not patch outdated migrations when newer migrations define current behavior.
- Regenerate `src/types/database.types.ts` when schema changes are applied locally.
- Generated document/control codes must be database-owned with the shared generator plus `BEFORE INSERT` trigger pattern. Application inserts must omit generated code columns.

## Skill Routing

Use the relevant skill when a task matches one of these triggers:

- API routes, Supabase queries, hooks, services, or DB-backed data contracts: `supabase-api-safety`.
- Hook/API/function return shapes, `apiClient` wrapping, React Query return values, or callback parameter types: `typescript-contract-verification`.
- SQL migrations, RLS policies, RPCs, triggers, indexes, generated DB types, or schema behavior: `supabase-migration-chain`.
- Generated document/control codes: `database-code-generation`.
- Create/update payload contracts, insert-only fields, redacted values, or PATCH semantics: `mutation-contract-safety`.
- Lists, reports, dashboards, search, sorting, filtering, pagination, selects, comboboxes, or autocomplete: `scalable-list-api`.
- Dashboard page shells, tables, widgets, loading states, empty states, or row actions: `dashboard-page-shell`.
- User-facing UI text, validation messages, toasts, dialogs, empty/loading/error copy, or translation migration: `i18n-translation-workflow`.
- Field/widget/section/operation permissions, redaction, RLS permission behavior, or permission settings UI: `granular-permissions-rollout`.
- Post-change validation or regression checking: `consistency-regression-checker`.
- Release safety review: `release-readiness-checker`.
- Security review or vulnerability assessment: `security-vulnerability-checker`.

## Testing And Verification

There is no formal test runner configured in `package.json` yet. When adding one, use Jest with `next/jest`, React Testing Library, and MSW. Until then, use the narrowest reliable post-flight command for the changed surface, such as `npm run lint`, `npm run build`, a targeted migration validation, or an existing ad-hoc script.

Every code change must consider test impact. If the correct test cannot be added because the harness does not exist, state the missing coverage in the final response.

## Conflict Resolution

- This root `AGENTS.md` is the single repo instruction file.
- Skills provide procedures; this root file provides routing and constraints.
- If instructions conflict, follow the more local and more current source, then surface the conflict clearly.
- Do not apply `node_modules/**/AGENTS.md` unless the task explicitly targets vendored source.

## Final Response Contract

At completion, report:

- Files changed, or that the task was read-only.
- Validation run and result.
- Validation skipped and why.
- Missing test coverage, if any.
- For DB/API work, schema or migration verification outcome.
- For UI work, translation impact.
- For list/select/report work, server-side filtering and pagination impact.
- For permission work, API and UI enforcement impact.
