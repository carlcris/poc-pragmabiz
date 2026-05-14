# Repository Guidelines

## Project Structure & Module Organization

This repo contains a Next.js 15 ERP frontend with Supabase-backed data.

- `src/app/` holds App Router route groups like `(auth)` and `(dashboard)`.
- `src/components/`, `src/hooks/`, `src/lib/`, `src/services/`, `src/stores/` organize UI, logic, API helpers, and state.
- `src/types/`, `src/constants/`, `src/config/` contain shared types and configuration.
- `src/assets/` and `public/` store static assets.
- `supabase/migrations/` contains schema and data migrations.
- `docs/` includes architecture and implementation notes.

## Build, Test, and Development Commands

Run these from the repo root:

- `npm install` installs dependencies.
- `npm run dev` starts the dev server at `http://localhost:3000`.
- `npm run build` generates the production bundle.
- `npm start` serves the production build locally.
- `npm run lint` runs ESLint with Next.js rules.
- `npm run format` formats `ts/tsx/js/json/md` via Prettier.

Supabase commands (repo root):

- `supabase start` / `supabase stop` manage local services.
- `supabase db reset` drops, migrates, and seeds the local DB.
- `supabase gen types typescript --local > src/types/database.types.ts` refreshes DB types.

## Coding Style & Naming Conventions

- TypeScript only; prefer `type` over `interface`.
- Avoid `any`; use `unknown` and narrow explicitly.
- Use PascalCase for components, camelCase for functions/vars.
- Prefer named exports; page files may default-export.
- Formatting is enforced by Prettier and `prettier-plugin-tailwindcss`.

## Testing Guidelines

There is no test runner configured in `package.json` yet. When introducing the test harness, use Jest with `next/jest`, React Testing Library, and MSW. Use MSW mocks in `src/mocks/` for local API simulation. Keep ad-hoc scripts alongside existing `test-*.js` files in the repo root until the formal harness exists.

Every codebase update must consider test impact:

- When changing existing behavior, update the affected tests in the same change.
- When adding a new feature, add equivalent tests that cover the expected behavior, edge cases, and important failure paths.
- If a correct test cannot be added because the harness does not exist yet, document the missing test coverage clearly in the task completion notes and prefer adding the harness before expanding untested behavior.
- At task completion, run post-flight testing for the affected module first, then broader checks as appropriate.
- Post-flight testing should be the narrowest reliable command that validates the changed area. Examples: a specific Jest test file once available, `npm run lint`, `npm run build`, or a targeted migration validation for database changes.
- Do not treat lint/build as a replacement for feature tests once a relevant test harness exists.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits with scopes, e.g. `feat(inventory): ...`, `fix(admin): ...`, `feature(security): ...`. Keep messages concise and scoped.

PRs should include a short summary, affected modules, screenshots for UI changes (desktop + mobile if relevant), and linked issues/docs when available.

## Database & API Notes

- Verify table/column names in `supabase/migrations/` before writing Supabase queries.
- The shared `apiClient` returns parsed JSON; avoid double-unwrapping response data.
- If code expects a schema change that is not present in the current database, stop and report the exact mismatch clearly.
- Do not add temporary fallbacks or compatibility code to mask unapplied migrations, schema drift, or environment drift unless the user explicitly asks for that behavior.
- In these cases, explain:
  - what the code expects
  - what the current database/environment actually has
  - the exact mismatch
  - the required migration or environment action
- Shared hooks should not own UI toasts by default.
- Prefer hooks to handle data work only: API calls, cache invalidation, and typed error propagation.
- Pages/components should own presentation side effects such as toast success/error messages, banners, and dialogs.
- If a shared hook needs optional UI behavior, expose callbacks or let the caller handle `mutateAsync` results instead of hardcoding toasts in the hook.
- Do not return raw database, Supabase, or internal exception messages directly to API clients.
- Log the real server-side error with enough detail for debugging, but return a user-friendly and non-sensitive error message in the API response.
- Treat raw backend error text as internal-only because exposing it can leak schema details, constraints, implementation internals, or security-sensitive information.

## Database Code Generation Rules

- Auto-generated document codes must be generated at the database level, not in application code.
- Use the shared database generator function plus `BEFORE INSERT` trigger pattern for any new code-bearing table.
- The shared generator must accept a `code_prefix` and produce a fixed-width numeric suffix.
- Standard numeric suffix width is `9` digits.
- Standard format is `<code_prefix><zero-padded-sequence>`, for example `ST-000000001`.
- `code_prefix` is the sequence namespace. Reuse a prefix only if those tables are supposed to share the same numeric series.
- Scope generated sequences by company unless there is a documented exception.
- Application inserts must omit the generated code column so the trigger remains the single source of truth.
- Do not backfill or rewrite historical codes unless explicitly required by the task.

## Insert-Only Fields

Fields that are assigned only at creation time must not be passed again through update paths.

- Omit insert-only fields from update RPCs/services entirely; do not pass them back "unchanged".
- Treat the following as insert-only unless a documented exception exists:
  - identity-defining foreign keys
  - control numbers and transmittal numbers
  - immutable ownership/reference columns
  - creation-time linkage fields
- Keep insert and update payload contracts separate. Do not reuse insert payloads for updates.
- If an existing row is missing an insert-only value due to legacy data, backfill it intentionally in a targeted repair path rather than folding it into routine updates.

Reason:

- Update paths often operate on partial or stale state.
- Re-sending insert-only fields can null out or overwrite references when the current value is not tracked correctly.
- This is a data-integrity rule, not just a style preference.

## Agent-Specific Instructions

Follow the safety and type-verification protocols in `docs/CLAUDE.md` when touching APIs, hooks, or data types.

## Core Development Principles:

These rules apply to every task in this project unless explicitly overridden.
Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

## Rule 1 — Think Before Coding
State assumptions explicitly. If uncertain, ask rather than guess.
Present multiple interpretations when ambiguity exists.
Push back when a simpler approach exists.
Stop when confused. Name what's unclear.

## Rule 2 — Simplicity First
Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

## Rule 3 — Surgical Changes
Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor what isn't broken. Match existing style.

## Rule 4 — Goal-Driven Execution
Define success criteria. Loop until verified.
Don't follow steps. Define success and iterate.
Strong success criteria let you loop independently.

## Rule 5 — Use the model only for judgment calls
Use me for: classification, drafting, summarization, extraction.
Do NOT use me for: routing, retries, deterministic transforms.
If code can answer, code answers.

## Rule 6 — Token budgets are not advisory
Per-task: 4,000 tokens. Per-session: 30,000 tokens.
If approaching budget, summarize and start fresh.
Surface the breach. Do not silently overrun.

## Rule 7 — Surface conflicts, don't average them
If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don't blend conflicting patterns.

## Rule 8 — Read before you write
Before adding code, read exports, immediate callers, shared utilities.
"Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.

## Rule 9 — Tests verify intent, not just behavior
Tests must encode WHY behavior matters, not just WHAT it does.
A test that can't fail when business logic changes is wrong.

## Rule 10 — Checkpoint after every significant step
Summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.
If you lose track, stop and restate.

## Rule 11 — Match the codebase's conventions, even if you disagree
Conformance > taste inside the codebase.
If you genuinely think a convention is harmful, surface it. Don't fork silently.

## Rule 12 — Fail loud
"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.

## Implementation Quality Rules

- Do not ship temporary fixes as the default implementation.
- Default to production-grade solutions, even when addressing a narrow bug.
- Do not patch code only to make the current symptom disappear; fix the underlying contract, data flow, or schema correctly.
- Prefer completing the proper end-to-end implementation over adding short-term workarounds that will need cleanup later.
- If a correct implementation depends on a migration, contract update, or broader refactor, surface that explicitly instead of masking it with fallback behavior.

## Data Loading & Scalability Rules

- Never load all records at once.
- Always fetch in small chunks per request (target range: 10-50 items).
- For server-backed select, combobox, and autocomplete fields:
  - initial open/load must fetch only the top `5` results
  - once the user types, the field must query the API/database with the search term instead of filtering a prefetched client-side list
  - do not preload large option sets "just in case"
  - do not implement local search over stale in-memory results for server data
  - searchable option controls must use server-side filtering as the source of truth
- Use cursor-based server-side pagination.
- Hard rule: Never implement sorting or filtering in the frontend for server data lists.
- Always implement sorting and filtering at the database/API query level.
- Frontend controls may only pass filter/sort params to APIs and render returned data as-is.
- Use virtual scrolling/windowing so only rows visible in the viewport are rendered.
- Use infinite scroll or explicit user-triggered loading to fetch the next page.
- Keep UI interactions smooth and memory usage low during large-list navigation.
- Cache already fetched pages locally to avoid repeated fetches.
- Ensure cursor fields are indexed in the database.
- Enable compressed API responses (GZIP/Brotli where available).
- Limit request rate and batch backend requests when possible.
- Key pattern: cursor-based server-side pagination + virtual scrolling + lazy loading = smooth, scalable UI.

## Page Consistency Rules

- Dashboard pages must render a stable page shell first: breadcrumb, page header, toolbar/filter row, then content region.
- Use the inventory transformations list page as the visual baseline for page-level composition and responsive behavior.
- Page headers must place title and subtitle on the left and actions on the right on desktop.
- On narrower widths, header actions must wrap below the subtitle instead of compressing or overlapping content.
- Preferred header layout pattern:
  - `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`
  - actions row: `flex flex-col gap-2 sm:flex-row sm:gap-2`
- Toolbar and filter rows must render before async data resolves and keep a stable layout during loading.
- Never replace a normal dashboard page with a blank screen or full-page spinner during data fetch.
- Render all static page structure first, then show skeleton loaders only for dynamic regions.
- Skeleton loaders must match the final layout footprint closely to avoid layout shift.
- Empty, loading, error, and loaded states must reuse the same page shell and content container footprint.
- Empty states should appear inside the content region, not replace the page header or filters.
- Prefer shared empty-state components, e.g. `src/components/shared/EmptyStatePanel.tsx`.
- Avoid flicker on reload:
  - do not render raw IDs or temporary fallback text where user-facing names should appear
  - do not unmount the whole page body while refetching
  - keep tabs, cards, tables, and panel regions height-stable where practical
- For detail, edit, and create pages, render section shells, titles, tabs, and action areas first; only field values or data-driven panels should skeleton.
- Widgets and metric cards must render their static shell on first paint.
- Do not block widget borders, titles, icons, or layout behind a page-level loading return when the shell can render immediately.
- Skeleton only widget dynamic content such as values, captions, deltas, and status pills.
- Prefer shared metric/widget components so first-paint and loading behavior stay consistent across pages.
- For list tables with row actions, use a consistent action-column pattern based on `src/app/(dashboard)/inventory/items/page.tsx`.
- Row actions must not rely on ambiguous icon-only primary controls. Visible row actions like `Edit`, `View`, or `Open` should include a text label when rendered directly in the cell.
- Destructive actions such as `Delete`, `Void`, or `Cancel` should not appear as always-visible standalone buttons in the row action cell.
- Place destructive or secondary actions inside a kebab dropdown menu using a vertical icon trigger.
- The kebab trigger itself should be icon-only and use the conventional vertical menu icon; labels belong inside the dropdown items, not on the trigger.
- Prefer up to three visible non-destructive actions in a row action cell. Keep only the highest-frequency actions visible and move destructive actions into the kebab menu.
- If a row needs more than three useful visible actions, keep the most important ones visible and move the rest into the kebab to preserve scanability.
