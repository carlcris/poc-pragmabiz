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
There is no test runner configured in `package.json`. Use MSW mocks in `src/mocks/` for local API simulation and add tests only when introducing a harness. Keep ad-hoc scripts alongside existing `test-*.js` files in the repo root.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commits with scopes, e.g. `feat(inventory): ...`, `fix(admin): ...`, `feature(security): ...`. Keep messages concise and scoped.

PRs should include a short summary, affected modules, screenshots for UI changes (desktop + mobile if relevant), and linked issues/docs when available.

## Database & API Notes
- Verify table/column names in `supabase/migrations/` before writing Supabase queries.
- The shared `apiClient` returns parsed JSON; avoid double-unwrapping response data.

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

## Agent-Specific Instructions
Follow the safety and type-verification protocols in `docs/CLAUDE.md` when touching APIs, hooks, or data types.

## Data Loading & Scalability Rules
- Never load all records at once.
- Always fetch in small chunks per request (target range: 10-50 items).
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
