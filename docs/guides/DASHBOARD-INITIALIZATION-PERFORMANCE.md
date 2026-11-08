# Dashboard initialization performance

Measured November 8, 2026, on full reloads of `/inventory/items`, including dashboard initialization.
The baseline already includes the item-page optimizations documented in
[Inventory item loading performance](INVENTORY-ITEM-LOADING-PERFORMANCE.md). This comparison isolates
the subsequent dashboard-startup changes, rather than combining gains from the two tasks.

## Findings and implementation

The baseline made two `/api/business-units` requests: the shared query and a separate switcher
bootstrap fetch. The provider also started a browser Auth user verification followed by a profile
query while its parent shell hydrated an already-verified server session. Page requests waited for
the business-unit option list even though the layout had verified the selected active membership.
Warehouse lookup started once with unresolved scope and again after scope hydration.

The implementation:

- Passes the verified server user identity into the provider. Server-rendered dashboard startup
  reuses that authentication snapshot; tablet startup without it still checks browser authentication.
- Starts page requests before the full business-unit list finishes only when the current user,
  active membership, selected business unit, and verified JWT unit all match. Missing or changed
  context retains the existing context-update flow.
- Starts persisted business-unit state as loading. Local storage alone cannot declare scope ready.
- Loads remaining business-unit options in the background without reselecting the initial unit
  when they arrive. The switcher shares the query and its retry/error state instead of issuing an
  independent bootstrap request.
- Gates current-unit warehouse lookup on authentication and hydrated business-unit readiness.
  Accessible-unit searches still work without a selected current unit.

Server-layout and middleware authentication, API authorization, RLS, and permission scope checks
are unchanged. No SQL, RPC, API payload, filtering, or pagination contracts changed. The existing
business-unit list still returns the user's accessible units; this change deduplicates its fetch,
not its response shape or client-side grouping. New switcher strings are translated in English
and Chinese. The existing tablet dropdown stacking order was retained; new sizing uses presets.

## Matched full-page measurement

Two isolated production builds used identical temporary timing instrumentation, the same authenticated
browser account, Main-Bulacan business unit, and configured Supabase database (763 items). Source
copies preserved unrelated working-tree changes. No service-role shortcut or authentication bypass
was used. Both builds included the prior item API/page optimizations.

One warm-up per version was excluded. Seven matched pairs alternated baseline-first and
optimized-first ordering. Each sample reloaded the whole document, creating a fresh in-memory React
Query cache while retaining the ordinary authenticated session and persisted browser selection.
Builds and validation commands were finished before measurement.

The ready marker runs after two animation frames following a successful table/statistics React commit.
Time starts at browser navigation start, so it includes the initial document request, server rendering,
client hydration, dashboard initialization, data fetch, and the render-ready marker. It does not
measure physical display presentation, image decoding, or every possible background request.
Resource counts below are completed matching API/Auth/profile resource entries observed by that
marker; all runs consistently contained the request counts shown. They exclude assets and internal
server-to-Supabase calls.

| Median metric                              |   Before |    After |             Observed change |
| ------------------------------------------ | -------: | -------: | --------------------------: |
| Full reload to table/statistics ready      | 439.5 ms | 329.2 ms |                25.1% faster |
| Page mount to item queries enabled         | 239.9 ms |  21.9 ms |          90.9% shorter wait |
| Navigation to item queries enabled         | 350.9 ms | 126.4 ms |               64.0% earlier |
| Document time to first byte                |  45.6 ms |  54.6 ms | No demonstrated improvement |
| Observed startup API/Auth/profile requests |       12 |        8 |                     4 fewer |

The removed requests were one business-unit request, one warehouse lookup, one browser Auth user
request, and one browser profile request. Navigation activity logging remained enabled.

The improvement comes from the shorter startup dependency chain and less duplicate work. Individual
item requests now overlap other startup work and can take longer than the baseline's late-starting
item requests; this is not an endpoint-latency improvement. The measured end-to-end reload is faster.
TTFB differences are environmental variation; the server document/authentication path was unchanged.

| Pair | Before ready | After ready |
| ---- | -----------: | ----------: |
| 1    |     619.2 ms |    406.7 ms |
| 2    |     402.9 ms |    365.6 ms |
| 3    |     446.1 ms |    314.7 ms |
| 4    |     393.9 ms |    320.0 ms |
| 5    |     439.5 ms |    351.5 ms |
| 6    |     369.2 ms |    329.2 ms |
| 7    |     456.4 ms |    328.3 ms |

These are warm local production-build results, not a production p95 estimate or controlled cold-start
benchmark. Browser and server caching, network variance, and the small sample size limit generalization.
The measurement covers full inventory-page loads through the dashboard shell, not every dashboard route.

## Initial warm-load validation

- Production baseline and optimized builds passed.
- TypeScript, targeted ESLint, formatting, and activity-logging checks passed.
- 69 focused tests cover initialization, persisted scope, missing JWT context, tablet startup,
  sign-out/account isolation, permission cache scope, single-query switcher behavior, lookup gating,
  and the existing inventory loading/cache behavior.
- Browser checks confirmed the loaded inventory page, unchanged quantities, and business-unit
  options available after background loading.
- Live account switching, live business-unit changes, cold starts, and remote production/p95 measurements
  were not exercised. Existing mocked regression coverage verifies the affected account/scope branches.

The authentication KB, login performance guide, and prior item-loading guide were checked and updated.
Temporary timing controls, environment copies, and benchmark servers were removed after measurement.

## Cold-process and cold-origin follow-up

Measured November 8, 2026, after the optimization, using an isolated production build.
Each included sample was the first page request to a fresh `next start` process on a previously
unused localhost port (3111, 3113, 3114). There was no HTTP warm-up. Existing authenticated cookies
were retained; origin-local storage and the React Query cache were fresh. All 43 observed Next.js
static resources transferred bytes in each cold sample (537,395 bytes including transfer overhead;
1,482,820 decoded bytes). This confirms cold browser asset loading for those origins.

Timing starts at browser navigation, after the server is listening, and ends at the same
successful inventory table/statistics commit plus two animation frames as above. It excludes
process launch time, image decode completion, and physical screen presentation. The database,
OS filesystem cache, browser process, and network connections were not reset. This is an
authenticated application-process/browser-origin cold test, not a cold database or deployment test.

| Sample | Cold full-page ready |  Cold TTFB | Cold page mount | Paired warm full-page ready |
| ------ | -------------------: | ---------: | --------------: | --------------------------: |
| 1      |           8,820.3 ms | 1,006.1 ms |      3,144.9 ms |                  2,848.2 ms |
| 2      |           4,149.1 ms | 1,040.6 ms |      1,933.9 ms |                  1,391.2 ms |
| 3      |           6,086.4 ms |   538.0 ms |      2,415.4 ms |                    979.1 ms |
| Median |           6,086.4 ms | 1,006.1 ms |      2,415.4 ms |                  1,391.2 ms |

A fourth attempted origin (3112) initially timed out in browser navigation. Its recovered
6,045.5 ms load is excluded because first-request status could not be established reliably.
The included cold samples each completed eight startup API calls, including one business-unit
fetch, one warehouse lookup, and two item calls. The item list/statistics calls took approximately
5,168/5,088 ms, 1,877/1,826 ms, and 2,863/2,860 ms respectively. The delay spans several initial
API routes, rather than being isolated to item rendering. These observations locate time in the
startup path but do not distinguish module initialization, request queuing, or database work;
server-side spans would be required to attribute that cost.

The small sample and wide timing spread make this diagnostic evidence, not a production SLO or
p95 estimate. Even paired warm loads were much slower than the earlier 329.2 ms optimized median,
so cross-session comparisons cannot establish a regression or a cold-start improvement percentage.
There is no pre-optimization cold baseline in this follow-up.

## Live scope-switch follow-up

In the local app, Demo User switched Main-Bulacan → Abad Santos → Bambang → Main-Bulacan using
the normal switcher, without page reloads between switches. The company item catalog stayed at
763 items while stock totals and warehouse choices changed with business-unit scope:

| Business unit | First item on hand / allocated / available | Total available value | Warehouse option observed |
| ------------- | ------------------------------------------ | --------------------: | ------------------------- |
| Main-Bulacan  | 2,042 / 344 / 1,698                        |           ₱667,754.50 | Not separately recorded   |
| Abad Santos   | 1,001 / 0 / 1,001                          |           ₱469,813.25 | Warehouse ABD             |
| Bambang       | 1 / 0 / 1                                  |           ₱233,813.25 | Warehouse BA01            |

The first item was `PM057WT000`. A reload while in Bambang retained Bambang and its quantity of
1; returning to Main-Bulacan restored 2,042 / 344 / 1,698. No inventory records or permissions
were edited. These browser checks establish settled-state scope behavior; they do not prove
absence of a sub-frame stale-data flash or cover rapid overlapping switches.

The isolated production build and all 69 focused regression tests passed again. The automated
suite covers stale server snapshots after account changes, sign-out cleanup and pending reads,
provider initialization, scope-aware permissions, and lookup gating. Full-repository lint was
not repeated for this measurement-only follow-up. No application source, API, schema, RLS,
translation, filtering, or pagination behavior was changed.

### Account-switch result and remaining transition defect

In the isolated production build, Demo User signed out and the user signed in as a second account
(Carlito) through the real login form in the same tab, without a manual reload. The dashboard
greeting, user menu, and profile all identified the second account. Its profile showed Super Admin
for all business units. Inventory returned the expected Main-Bulacan values, and switching to
Abad Santos settled to 1,001 on hand / 0 allocated / 1,001 available and ₱469,813.25 total value.
Browser Back retained the second account's profile. Both tested accounts have broad access, so
restricted-role and cross-company authorization remain unverified by this browser check.

**Finding from the browser measurement: old stock rows appeared under the new business-unit label.**
Immediately after the production selector became Abad Santos, a DOM read of the first item still
showed Main-Bulacan's 2,042 / 344 / 1,698 quantities. A later read showed the correct Abad Santos
values. This is a transient presentation defect, not evidence that the settled API response used
the wrong scope. Duration was not measured. The previous 69-test pass does not cover this case.

The inventory-row follow-up now reuses previous data only when the previous query's business-unit
ID matches the selected unit. Same-unit pagination retains rows; a change of business unit shows
the table loading state until that unit's query resolves. A primed-cache QueryObserver regression
uses delayed page and unit responses to verify both behaviors without a browser reload.

This fixes the inventory-row finding. The separate statistics hook still retains previous data and
omits business-unit identity from its key; statistics transition behavior has not been changed or
reverified in this follow-up. The earlier browser measurements remain historical observations.

The reverse switch Carlito → logout → Demo User also passed in the same tab without a manual
reload. The greeting, user menu, and previously visited profile identified Demo User; browser Back
retained that identity. Main-Bulacan inventory again showed 763 items, ₱667,754.50 total available
value, and first-item quantities of 2,042 on hand / 344 allocated / 1,698 available. This completes
the live account round trip. The transient business-unit row issue was addressed in the follow-up described above.

After verification, the temporary benchmark servers and isolated source/environment copy were
removed. The user's existing development server was left running.
