# Pragmabiz Warehouse Mobile

Self-contained Expo app for warehouse receiving and picking.

## Local Development

Start the Next.js API server from the repo root, then run Expo from this directory:

```sh
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000 CI=1 npx expo start --port 8082 --clear
```

Use `10.0.2.2` for Android emulator access to the host machine.

## Boundaries

- This app does not import from the root `src/` web app.
- All API contracts copied for mobile live under `apps/mobile/src/contracts`.
- The Next.js API server is the backend boundary.
