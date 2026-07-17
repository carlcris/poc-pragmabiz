# Pragmabiz Warehouse Mobile

Self-contained Expo app for warehouse receiving and picking.

## Local Development

Start the Next.js API server from the repo root, then run Expo from this directory:

```sh
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000 CI=1 npx expo start --port 8082 --clear
```

Use `10.0.2.2` for Android emulator access to the host machine.
The app loads its public Supabase Realtime configuration from the authenticated API. `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` remain optional build-time overrides.

## Android Builds

Run EAS from this `apps/mobile` directory so it uses this app's Expo project and credentials:

```sh
npm run build:android:local
npm run build:android:apk:local
eas build --platform android --profile local-apk --local
```

The `local-apk` profile embeds the private LAN API address configured in `eas.json` and enables
Android cleartext traffic only for that HTTP build. Confirm that the address belongs to the API
server on the current network before building. The device and API server must be on the same LAN,
and the API server must listen on a non-loopback interface.

All other EAS profiles use the public HTTPS API at `https://achlers.onrender.com` and retain
Android's default cleartext-traffic restriction.

## SUNMI Hardware Scanner

Android builds include a local Expo module that receives scans from the integrated SUNMI scan
head. On picking, delivery-note receiving, and item-info screens, pressing the device's physical
scan key sends the captured value directly to the same processing path as a camera scan. The
hardware value is not copied into the manual-entry field, and the receiver is inactive while the
camera scanner is open.

Configure the SUNMI ScannerHead data output mode before deployment:

- Enable broadcast output for `com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED`.
- Disable simulated-keyboard and direct-fill output so scans do not type into the focused field.
- Keep the scanner output encoding aligned with the barcode payload; UTF-8 is the normal default.

The native scanner module is unavailable in Expo Go. Use an Android development, APK, preview,
or production build when testing the physical scan head. Camera scanning remains available on
SUNMI devices without a compatible scan head and on other supported platforms.

## Boundaries

- This app does not import from the root `src/` web app.
- All API contracts copied for mobile live under `apps/mobile/src/contracts`.
- The Next.js API server is the backend boundary.
