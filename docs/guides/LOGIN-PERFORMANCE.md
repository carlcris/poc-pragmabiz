# Login Performance

Login keeps password authentication, application-account validation, Supabase session verification,
role-based landing rules, business-unit scope, cookie handling, and permission aggregation intact.
The API resolves business-unit context once and loads business-unit details, permissions, and roles
in parallel. Native mobile reuses the permission result for its capability maps. Web reuses the API's
profile fields after establishing the browser session.

## Full UI End-to-End Measurement

Measured on November 1, 2026, through computer-use interactions with the real sign-in forms. Web used
an isolated Next.js production build and the in-app browser. Native mobile used the installed Android
API 36 arm64 emulator app, Hermes, Expo 54 / React Native 0.81.5, and a development bundle. Both called
the same isolated Next.js server over HTTP and used the configured Supabase service with the
provisioned test account and normal authenticated access. These native debug-emulator figures are
not release-device or iOS measurements.

Each client had one warm-up followed by five measured logins. Code, assets, and the server were warm;
the test harness cleared the destination query cache between sessions so every measured login waited
for fresh dashboard data. Sign-out cleanup used only the benchmark session (`scope: "local"`).
Password authentication, browser session verification, native secure-storage writes, account checks,
and permission enforcement ran normally.

Timing starts in the valid submit handler. The HTTP phase includes the real client/server round trip,
the route's activity wrapper, Supabase work, response transfer, and JSON decoding. Session setup runs
from decoded response to completion of browser `setSession`, or native session conversion and
`saveSession`. The remaining time includes state updates, navigation, destination requests, and
rendering.

Paint markers use two `requestAnimationFrame` callbacks after the relevant React commit. The web
endpoint follows fresh warehouse-dashboard data. The native endpoint additionally waits for the
focused dashboard query to finish fetching and the non-closing native-stack transition to complete,
then waits two more animation frames. Screenshots verified the loaded destination. This is a
render-ready measurement, rather than a hardware display-present timestamp or background-network-idle
measurement. Test-control delays and screenshot capture occur outside the measured interval.

| Metric (median)                          | Web              | Native Android       |
| ---------------------------------------- | ---------------- | -------------------- |
| HTTP request and response decoding       | 106.00 ms        | 365.75 ms            |
| Session setup duration                   | 22.40 ms         | 243.12 ms            |
| Submit to first dashboard shell paint    | 163.70 ms        | 788.08 ms            |
| Submit to fresh dashboard data paint     | 361.60 ms        | 1,284.75 ms          |
| Submit to complete render-ready endpoint | 361.60 ms        | 1,320.14 ms          |
| Observed full end-to-end range           | 328.80–394.50 ms | 1,117.75–1,565.24 ms |

Phase medians are calculated independently and do not add up to the median total. After session setup,
navigation, fresh data, and rendering took a median 231.70 ms on web and 822.08 ms on native. With only
five samples, nearest-rank p95 equals the observed maximum and is not a reliable production tail-latency
estimate. The final-protocol warm-ups were 542.20 ms on web and 1,170.39 ms on native. An earlier first
observed web attempt took 1,061.60 ms; it was not a controlled cold-start test.

| Sample | Web full end-to-end | Native full end-to-end |
| ------ | ------------------- | ---------------------- |
| 1      | 360.90 ms           | 1,331.13 ms            |
| 2      | 361.60 ms           | 1,117.75 ms            |
| 3      | 394.50 ms           | 1,320.14 ms            |
| 4      | 328.80 ms           | 1,169.34 ms            |
| 5      | 379.20 ms           | 1,565.24 ms            |

### Comparison with the Original 409 ms

The web median is numerically 47.40 ms lower (11.6%); the native median is 911.14 ms higher (222.8%).
The original observation has no recorded timing boundary, build mode, or device conditions, so these
deltas do not establish an end-to-end optimization gain or regression. If 409 ms referred only to an
HTTP request, compare it with the HTTP row, not the full login total. The matched before/after API
measurements below provide the controlled evidence for the query optimization itself.

### Repeating a UI Capture

Use an isolated copy and a provisioned test account; keep credentials out of source and output. Add
temporary timing markers around the real submit handler, shared `requestLogin`, session persistence,
dashboard commit, fresh-data completion, and native transition completion. Clear the test query cache
between logins, run one warm-up and at least five samples, and verify the visible destination through
computer use. Keep debug/release mode, device, account, service, and warm/cold conditions consistent
between revisions. Restore temporary bundle settings and revoke only test-created sessions afterward.

The UI instrumentation and controls were kept outside the repository. The maintained
`benchmark:login` command below measures API handlers and the controlled web store; it does not
reproduce these UI paint timings or provide an automated UI performance-regression threshold.

## Live Supabase API-Handler Measurement

Measured on November 1, 2026, against the configured Supabase service using the same provisioned test
account, real password authentication, and authenticated database access with RLS. Each flow has one
warm-up and five measured samples. Only sessions created by the benchmark are signed out afterward.

| Flow              | Before median | After median | Reduction | Before p95 | After p95 | Requests before → after |
| ----------------- | ------------- | ------------ | --------- | ---------- | --------- | ----------------------- |
| Web API           | 105.28 ms     | 84.05 ms     | 20.2%     | 117.52 ms  | 85.74 ms  | 5 → 5                   |
| Native mobile API | 95.87 ms      | 85.90 ms     | 10.4%     | 98.26 ms   | 89.39 ms  | 6 → 5                   |

The account, business-unit, landing-page, permission, and capability output digests matched before
and after for both clients. These are in-process API-handler measurements, including the actual
Supabase requests. The client-to-Next.js HTTP hop, activity wrapper, browser session setup, native
storage, and rendering are excluded. The measurement boundary of the original 409 ms observation
was not captured, so compare it separately with matching browser/device tooling.

## Controlled Before/After Measurement

Measured on November 1, 2026, using the actual before/after API handlers and web store with controlled
Supabase responses: password authentication waits 40 ms and each other outbound operation waits
20 ms. Each scenario has one warm-up followed by 15 measured samples. Request counts include
authentication and model the browser's session-verification request where applicable.

| Scenario                                        | Before median | After median | Reduction | Requests before → after |
| ----------------------------------------------- | ------------- | ------------ | --------- | ----------------------- |
| Web API                                         | 105.47 ms     | 83.75 ms     | 20.6%     | 5 → 5                   |
| Native mobile API                               | 126.12 ms     | 83.92 ms     | 33.5%     | 6 → 5                   |
| Web login including session setup               | 147.01 ms     | 105.20 ms    | 28.4%     | 7 → 6                   |
| Native mobile API without a business-unit claim | 167.74 ms     | 104.94 ms    | 37.4%     | 8 → 6                   |

The account, business-unit, landing-page, permission, and capability output digests matched before
and after for all scenarios. Regression tests also cover rejected credentials, failed session
verification, unprovisioned accounts, denied permissions, permission-query failure, role selection,
business-unit precedence, and preserved tokens/cookie attributes.

These measurements isolate request scheduling and duplicate reads under fixed delays. Deployed
latency also depends on Auth/database execution, network distance, connection reuse, and server
startup. Activity logging is excluded from the harness; production continues to use the existing logging wrapper.
Native secure-storage writes and page rendering are also outside these measurements.

## Reproduce the Controlled Benchmark

Run from the repository root:

```sh
LOGIN_BENCHMARK_OUTPUT=/tmp/login-after.json npm run benchmark:login
```

To compare against a previous Git revision, set `LOGIN_BENCHMARK_BASELINE_REF` to that revision.
`INDEX` reads the staged versions of the login route and web store, which was the baseline for the
measurement above. Capture the baseline before staging the optimization:

```sh
LOGIN_BENCHMARK_BASELINE_REF=INDEX \
LOGIN_BENCHMARK_OUTPUT=/tmp/login-before.json \
npm run benchmark:login
```

The harness copies the selected revision's route/store into an ignored temporary directory, adjusts
the store's two relative imports to preserve module resolution, and removes the snapshots afterward.
Compare `medianMs`, `p95Ms`, request counts, and `authorizationDigest` in the JSON reports.

## Measure Against Supabase

Provide `LOGIN_BENCHMARK_EMAIL` and `LOGIN_BENCHMARK_PASSWORD` through the environment or an ignored
`.env.local` file for a provisioned test account. Live mode loads `.env.local` explicitly because the
standard Next.js test-mode environment loader skips it. Set `LOGIN_BENCHMARK_ENV_FILE` to use another
local environment file. The harness reads the repository's configured Supabase URL and anonymous key.
It does not use a service-role key or bypass RLS.

```sh
LOGIN_BENCHMARK_LIVE=1 \
LOGIN_BENCHMARK_OUTPUT=/tmp/login-live-after.json \
npm run benchmark:login
```

Use the same baseline-ref option for the corresponding live before run. Live mode measures the web
and native API handlers in process, with one warm-up and five samples per client. It invokes real
password authentication and the existing authenticated database requests. Each created test session
is signed out with `scope: "local"` after timing; other sessions remain active. The outer Next.js HTTP
hop and activity wrapper are excluded. Credentials, tokens, and raw permission data are not printed.

For full user-observed latency, also compare the deployed login request and navigation in browser or
device network tooling under the same account, service, region, and warm/cold conditions.
