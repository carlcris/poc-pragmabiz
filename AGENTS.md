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

## Agent-Specific Instructions
Follow the safety and type-verification protocols in `docs/CLAUDE.md` when touching APIs, hooks, or data types.

## Data Loading & Scalability Rules
- Never load all records at once.
- Always fetch in small chunks per request (target range: 10-50 items).
- Use cursor-based server-side pagination.
- Apply search filters and sorting on the backend, not in the frontend.
- Use virtual scrolling/windowing so only rows visible in the viewport are rendered.
- Use infinite scroll or explicit user-triggered loading to fetch the next page.
- Keep UI interactions smooth and memory usage low during large-list navigation.
- Cache already fetched pages locally to avoid repeated fetches.
- Ensure cursor fields are indexed in the database.
- Enable compressed API responses (GZIP/Brotli where available).
- Limit request rate and batch backend requests when possible.
- Key pattern: cursor-based server-side pagination + virtual scrolling + lazy loading = smooth, scalable UI.
