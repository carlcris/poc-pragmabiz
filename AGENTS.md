# Repository Guidelines

## Project Structure & Module Organization
This repo is an ERP system with a Next.js 15 frontend and Supabase-backed database.

- `app/` contains the Next.js App Router app, API routes, UI components, hooks, and stores.
- `app/src/app/` holds route segments like `(auth)`, `(dashboard)`, and `mobile`.
- `app/src/components/`, `app/src/hooks/`, `app/src/lib/`, `app/src/types/` organize UI, logic, utilities, and types.
- `app/public/` and `app/src/assets/` store static assets.
- `supabase/` contains Supabase config and database migrations (`supabase/migrations/`).
- `docs/` contains design, architecture, and implementation notes.

## Build, Test, and Development Commands
Run these from `app/`:

- `npm install` installs dependencies.
- `npm run dev` starts the local dev server at `http://localhost:3000`.
- `npm run build` builds the production bundle.
- `npm start` runs the production build locally.
- `npm run lint` runs Next.js ESLint rules.
- `npm run format` formats `ts/tsx/js/json/md` via Prettier.

Supabase (from repo root):

- `supabase start` / `supabase stop` manage local services.
- `supabase db reset` drops, migrates, and seeds the local DB.
- `supabase gen types typescript --local > app/src/types/database.types.ts` refreshes DB types.

## Coding Style & Naming Conventions
- TypeScript only; prefer `type` over `interface`.
- Avoid `any`; use `unknown` and narrow.
- Use arrow functions for non-page components/hooks; pages can default-export.
- Prefer named exports elsewhere; keep props destructured.
- Formatting is enforced by Prettier + `prettier-plugin-tailwindcss`.

## Testing Guidelines
There is no dedicated test runner in `package.json`. Use MSW mocks under `app/src/mocks/` for local API simulation, and add tests only if you introduce a harness. Any ad-hoc scripts should live alongside existing `test-*.js` files in `app/`.

## Commit & Pull Request Guidelines
Recent commits use Conventional Commits with scopes, e.g. `feat(inventory): ...` and `fix(admin): ...`. Keep messages in that format and concise.

PRs should include:
- A short description of the change and affected modules.
- Screenshots for UI updates (desktop and mobile if applicable).
- Linked issue or doc reference when available.

## Database & API Notes
- Verify table and column names in `supabase/migrations/` before writing Supabase queries.
- The shared `apiClient` returns parsed JSON; unwrap response data only once.

## Agent-Specific Instructions
Follow the safety and type-verification protocols documented in `docs/CLAUDE.md` when touching APIs, hooks, or data types.
