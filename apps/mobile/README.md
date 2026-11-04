# Pragmabiz Warehouse Mobile

Self-contained Expo app for warehouse receiving and picking.

## Local Development

Start the Next.js API server from the repo root, then run Expo from this directory:

```sh
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000 CI=1 npx expo start --port 8082 --clear
```

Use `10.0.2.2` for Android emulator access to the host machine.
The app loads its public Supabase Realtime configuration from the authenticated API. `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` remain optional build-time overrides.

The API response is `{ url: string, publishableKey: string }`. Deploy this mobile client
together with the matching API; the former `anonKey` response field is no longer supported.
When overriding configuration, set both variables and use an `sb_publishable_...` key.
Rebuild the mobile bundle after changing overrides. Never include a Supabase secret key
in the mobile app.

`babel.config.cts` uses the Expo preset and transforms class static blocks used by the shared
translation dependencies. Keep this transform enabled for Android development bundles. Restart
Metro with `--clear` after changing Babel configuration.

Run mobile unit tests with the repository's existing Vitest installation, from the repository root:

```sh
npm test -- --config apps/mobile/vitest.config.ts
```

The mobile test configuration uses this app's module aliases, separate from the Next.js application.

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

All other EAS profiles use the public HTTPS API at `https://stagingachlers.netlify.app` and retain
Android's default cleartext-traffic restriction.

### Launcher Icon

`app.json` sets `expo.icon` to the existing 1024×1024 `assets/achlers_logo.png`. Expo generates
the Android launcher resources from this complete square image. Use this standard icon configuration
to keep the logo within the launcher bounds. A custom `android.adaptiveIcon` requires separate
artwork padded for Android's adaptive-icon safe area.

After changing the icon configuration or image, rebuild using `npm run build:android:apk:local`
and install the resulting APK. Metro reloads and JavaScript updates do not replace the native
launcher resources. Check the installed app's home-screen and app-drawer icons on the target device.

## SUNMI Hardware Scanner

Android builds include a local Expo module that receives scans from the integrated SUNMI scan
head. On picking, delivery-note receiving, and item-info screens, pressing the device's physical
scan key sends the captured value directly to the same processing path as a camera scan. The
hardware value is not copied into the manual-entry field, and the receiver is inactive while the
camera scanner is open.

Configure the SUNMI ScannerHead data output mode before deployment:

- Enable broadcast output for `com.sunmi.scanner.ACTION_DATA_CODE_RECEIVED`.
- Disable simulated-keyboard and direct-fill output so scans do not type into the focused field.
- Disable **Send Enter key** and **Send TAB key** as well; these suffixes can activate or move
  keyboard focus even when the scan payload is delivered by broadcast.
- Keep the scanner output encoding aligned with the barcode payload; UTF-8 is the normal default.

The shared screen header provides a neutral initial keyboard-focus target so repeated Enter
suffixes do not focus and activate Back. Touch navigation, Android Back, and submission from a
focused manual-entry field remain available. Keep key suffixes disabled on deployed devices.

The native scanner module is unavailable in Expo Go. Use an Android development, APK, preview,
or production build when testing the physical scan head. Camera scanning remains available on
SUNMI devices without a compatible scan head and on other supported platforms.

## Boundaries

- This app does not import from the root `src/` web app.
- All API contracts copied for mobile live under `apps/mobile/src/contracts`.
- The Next.js API server is the backend boundary.
