# Expo Mobile App Migration Plan

## Project Overview

Migrate the current warehouse tablet support from the Next.js browser app in `src/app/tablet/*` into a deployable Expo React Native app for both phones and tablets.

The first mobile release will be online-only and will call the existing Next.js API server over HTTP. The mobile app must be self-contained so it can later be detached into its own repository without depending on imports from the web app.

## Goals

- Build a deployable Expo app for warehouse receiving and picking.
- Support both phone and tablet layouts.
- Keep the existing Next.js web app and `/tablet/*` routes working during migration.
- Use the Next.js API server as the backend boundary.
- Keep mobile DTOs, constants, validation, and API clients inside the mobile project.
- Structure the data layer so offline support can be added later without rewriting screens.

## Non-Goals

- Do not move the existing web app during the mobile migration.
- Do not create a shared package for mobile contracts in this phase.
- Do not connect the mobile app directly to Supabase.
- Do not implement offline sync in the first release.
- Do not refactor unrelated ERP modules as part of the mobile conversion.

## Target Directory Structure

For the mobile migration phase, keep the existing web app in place and add Expo as a sibling app:

```txt
poc-pragmabiz/
├── src/
│   ├── app/
│   │   ├── tablet/
│   │   └── api/tablet/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── stores/
│   └── types/
│
├── apps/
│   └── mobile/
│       ├── app/
│       │   ├── _layout.tsx
│       │   ├── index.tsx
│       │   ├── login.tsx
│       │   ├── receiving/
│       │   │   ├── index.tsx
│       │   │   └── [id].tsx
│       │   └── picking/
│       │       ├── index.tsx
│       │       └── [id].tsx
│       │
│       ├── src/
│       │   ├── api/
│       │   ├── components/
│       │   ├── config/
│       │   ├── constants/
│       │   ├── contracts/
│       │   ├── features/
│       │   ├── hooks/
│       │   ├── navigation/
│       │   ├── storage/
│       │   ├── stores/
│       │   ├── types/
│       │   └── utils/
│       │
│       ├── assets/
│       ├── app.json
│       ├── eas.json
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
│
├── supabase/
├── docs/
└── package.json
```

## Mobile App Internal Structure

```txt
apps/mobile/src/
├── api/
│   ├── client.ts
│   ├── auth.ts
│   ├── dashboard.ts
│   ├── receiving.ts
│   └── picking.ts
│
├── contracts/
│   ├── auth.ts
│   ├── dashboard.ts
│   ├── receiving.ts
│   ├── picking.ts
│   └── errors.ts
│
├── constants/
│   ├── app.ts
│   ├── queryKeys.ts
│   └── statuses.ts
│
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── receiving/
│   └── picking/
│
├── components/
│   ├── layout/
│   ├── receiving/
│   ├── picking/
│   └── shared/
│
├── hooks/
├── stores/
├── storage/
├── config/
├── navigation/
├── types/
└── utils/
```

## Architecture Decisions

### 1. App Boundary

The Expo app lives in `apps/mobile` and must not import from root `src/*`.

Allowed integration:

- HTTP calls to the Next.js API server.
- Copied DTOs, constants, status maps, and validation logic inside `apps/mobile/src/contracts` and `apps/mobile/src/constants`.

Not allowed:

- Imports from `src/components`, `src/hooks`, `src/lib`, `src/stores`, or `src/types`.
- Imports from `next/*`.
- Direct Supabase access from the mobile app.
- Runtime dependency on a shared package for warehouse contracts.

### 2. Backend Boundary

The mobile app calls the existing Next.js API server. API base URLs must be environment-driven:

- Local development
- Staging
- Production

The mobile app should treat the API server as the source of truth for permissions, validation, workflow state, and inventory mutations.

### 3. Online-Only First Release

The first release requires network access for login, reads, and mutations.

To prepare for future offline support:

- Keep API calls behind repository-style functions in `apps/mobile/src/api`.
- Keep mutation payloads serializable.
- Avoid placing business-rule fallbacks in screens.
- Add stable client request IDs where useful for future idempotency.
- Keep local storage concerns isolated in `apps/mobile/src/storage`.

### 4. Phone and Tablet Support

Screens must adapt to compact phone layouts and wider tablet layouts. The mobile app should not be a direct pixel copy of the browser tablet UI.

Required layout behavior:

- Use compact stacked layouts on phones.
- Use wider two-column or denser layouts only where they improve tablet workflows.
- Keep touch targets large enough for warehouse use.
- Keep loading, empty, error, and loaded states layout-stable.

## Migration Phases

### Phase 1: Discovery and Contract Mapping

- Audit `src/app/tablet`, `src/components/tablet`, `src/hooks/tablet`, and `src/app/api/tablet`.
- Document current login, dashboard, receiving, picking, and scanning behavior.
- Identify every API route the mobile app needs.
- Copy required request and response contracts into `apps/mobile/src/contracts`.
- Confirm whether existing API routes are sufficient for mobile or need additional endpoints.

### Phase 2: Expo Scaffold

- Create `apps/mobile`.
- Add Expo with TypeScript and Expo Router.
- Add React Query for server state.
- Add Zustand or equivalent lightweight local state for auth/session UI state.
- Add secure storage for auth tokens/session metadata.
- Add camera/barcode scanning dependencies.
- Add EAS configuration for deployable builds.

### Phase 3: API Client and Auth

- Implement `apps/mobile/src/api/client.ts` with base URL configuration, auth headers, timeout handling, and normalized error responses.
- Implement login/logout/session restoration.
- Store sensitive session values in secure storage.
- Add route protection for warehouse screens.
- Ensure API errors shown to users are friendly and do not expose raw backend details.

### Phase 4: Native Workflow Screens

- Implement login.
- Implement dashboard.
- Implement receiving list and detail.
- Implement picking list and detail.
- Replace browser components with React Native components for headers, bottom navigation, cards, quantity steppers, status badges, dialogs, empty states, loading states, and error states.
- Implement scanner flows using Expo camera APIs with manual entry fallback.

### Phase 5: Workflow Mutations

- Wire receiving mutations through the Next.js API server.
- Wire picking mutations through the Next.js API server.
- Add duplicate-submit protection.
- Handle partial receiving and partial picking.
- Handle picker lock conflicts.
- Handle auth expiry and retryable network failures.

### Phase 6: Validation and Release Readiness

- Validate phone and tablet layouts.
- Validate Android and iOS simulator flows.
- Validate bad network, timeout, denied camera permission, empty list, and API failure states.
- Add focused mobile tests for API clients, session handling, and core receiving/picking workflows once the harness exists.
- Run existing web checks to confirm the current Next.js app was not broken.
- Run Expo typecheck/lint, `npx expo start`, and EAS preview build validation.

## Post-Migration Repo Cleanup

After the mobile app is stable, do a separate monorepo restructuring pass. Do not combine this with the mobile migration.

Future target:

```txt
poc-pragmabiz/
├── apps/
│   ├── web/
│   └── mobile/
├── packages/
│   └── config/
├── supabase/
└── docs/
```

The web move should be treated as its own migration because the current Next.js app depends on `src/app` being the app router root.

## Validation Checklist

- `npm run lint`
- `npm run build`
- Expo typecheck or equivalent mobile TypeScript validation
- Expo lint if configured
- `npx expo start`
- Android simulator smoke test
- iOS simulator smoke test
- EAS preview build

## Open Risks

- Existing `/api/tablet/*` endpoints may not fully cover mobile receiving and picking flows.
- Current browser tablet components may contain workflow assumptions that need to be moved into API responses or copied into mobile contracts.
- Online-only v1 still needs clear failure states for warehouse users with unstable connectivity.
- Keeping copied contracts inside mobile improves detachability but introduces drift risk; contract changes must update both API server behavior and mobile contract files intentionally.
