# Repository Guidelines

## Project Structure & Module Organization
This repo contains a Next.js 15 ERP frontend with Supabase-backed data.

- `app/src/app/` holds App Router route groups like `(auth)` and `(dashboard)`.
- `app/src/components/`, `app/src/hooks/`, `app/src/lib/`, `app/src/services/`, `app/src/stores/` organize UI, logic, API helpers, and state.
- `app/src/types/`, `app/src/constants/`, `app/src/config/` contain shared types and configuration.
- `app/src/assets/` and `app/public/` store static assets.
- `supabase/migrations/` contains schema and data migrations.
- `docs/` includes architecture and implementation notes.

## Build, Test, and Development Commands
Run these from `app/`:

- `npm install` installs dependencies.
- `npm run dev` starts the dev server at `http://localhost:3000`.
- `npm run build` generates the production bundle.
- `npm start` serves the production build locally.
- `npm run lint` runs ESLint with Next.js rules.
- `npm run format` formats `ts/tsx/js/json/md` via Prettier.

Supabase commands (repo root):

- `supabase start` / `supabase stop` manage local services.
- `supabase db reset` drops, migrates, and seeds the local DB.
- `supabase gen types typescript --local > app/src/types/database.types.ts` refreshes DB types.

## Coding Style & Naming Conventions
- TypeScript only; prefer `type` over `interface`.
- Avoid `any`; use `unknown` and narrow explicitly.
- Use PascalCase for components, camelCase for functions/vars.
- Prefer named exports; page files may default-export.
- Formatting is enforced by Prettier and `prettier-plugin-tailwindcss`.

## Testing Guidelines
There is no test runner configured in `app/package.json`. Use MSW mocks in `app/src/mocks/` for local API simulation and add tests only when introducing a harness. Keep ad-hoc scripts alongside existing `test-*.js` files in `app/`.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commits with scopes, e.g. `feat(inventory): ...`, `fix(admin): ...`, `feature(security): ...`. Keep messages concise and scoped.

PRs should include a short summary, affected modules, screenshots for UI changes (desktop + mobile if relevant), and linked issues/docs when available.

## Database & API Notes
- Verify table/column names in `supabase/migrations/` before writing Supabase queries.
- The shared `apiClient` returns parsed JSON; avoid double-unwrapping response data.

## Agent-Specific Instructions
Follow the safety and type-verification protocols in `docs/CLAUDE.md` when touching APIs, hooks, or data types.
