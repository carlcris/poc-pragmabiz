import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { loadEnvConfig, processEnv } from "@next/env";
import { NextRequest, NextResponse } from "next/server";
import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  operations: [] as string[],
  fallback: false,
  cleanup: [] as Array<() => Promise<unknown>>,
}));

vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
  setActivityContext: vi.fn(),
}));
vi.mock("@/lib/supabase/route-handler", async (importOriginal) => {
  if (process.env.LOGIN_BENCHMARK_LIVE === "1") {
    const original = await importOriginal<typeof import("../src/lib/supabase/route-handler")>();
    return {
      createRouteHandlerClient: (request: NextRequest) => {
        const client = original.createRouteHandlerClient(request);
        state.cleanup.push(() => client.supabase.auth.signOut({ scope: "local" }));
        return client;
      },
    };
  }
  return {
    createRouteHandlerClient: () => ({ supabase: fixtureClient, response: NextResponse.next() }),
  };
});
vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: {
      setSession: async () => {
        await delay("auth.setSession");
        return { error: null };
      },
    },
    from: (table: string) => fixtureQuery(table),
  },
}));
vi.mock("@/stores/businessUnitStore", () => ({ useBusinessUnitStore: { getState: vi.fn() } }));
vi.mock("@/stores/permissionStore", () => ({ usePermissionStore: { getState: vi.fn() } }));
vi.mock("@/lib/auth/sessionInvalidation", () => ({
  clearIntentionalLogoutMarker: vi.fn(),
  clearSessionInvalidNoticeShown: vi.fn(),
  markIntentionalLogout: vi.fn(),
  notifySessionInvalid: vi.fn(),
}));

const delay = async (operation: string) => {
  state.operations.push(operation);
  await new Promise((resolve) => setTimeout(resolve, operation === "auth.signIn" ? 40 : 20));
};
const fixtureProfile = {
  id: "user",
  username: "operator",
  email: "user@example.com",
  first_name: "Test",
  last_name: "User",
  company_id: "company",
};
const fixturePermissions = [
  { resource: "dashboard", can_view: true, can_create: false, can_edit: false, can_delete: false },
];
const queryResult = (table: string) => ({
  data:
    table === "users"
      ? fixtureProfile
      : table === "business_units"
        ? { id: "unit", code: "MAIN", name: "Main" }
        : table === "user_roles"
          ? [{ roles: { name: "Admin" } }]
          : [{ business_unit_id: "unit", is_current: true, is_default: true }],
  error: null,
});
function fixtureQuery(table: string) {
  const execute = async () => {
    await delay(table);
    return queryResult(table);
  };
  const query = {
    select: () => query,
    eq: () => query,
    is: () => query,
    maybeSingle: execute,
    then: (resolve: (value: ReturnType<typeof queryResult>) => unknown) => execute().then(resolve),
  };
  return query;
}
const fixtureClient = {
  auth: {
    signInWithPassword: async () => {
      await delay("auth.signIn");
      const claims = state.fallback ? {} : { current_business_unit_id: "unit" };
      return {
        data: {
          user: { id: "user", email: "user@example.com" },
          session: {
            access_token: `header.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`,
            refresh_token: "refresh",
          },
        },
        error: null,
      };
    },
  },
  from: fixtureQuery,
  rpc: async (name: string) => {
    await delay(name);
    return { data: fixturePermissions, error: null };
  },
};

it("measures login handlers and the web client against the same workload", async () => {
  loadEnvConfig(process.cwd());
  const live = process.env.LOGIN_BENCHMARK_LIVE === "1";
  if (live) {
    // Next's normal test-mode loader deliberately skips .env.local.
    const envFile = process.env.LOGIN_BENCHMARK_ENV_FILE || ".env.local";
    if (existsSync(envFile)) {
      processEnv(
        [{ path: envFile, contents: await readFile(envFile, "utf8"), env: {} }],
        process.cwd(),
        undefined,
        true
      );
    } else if (process.env.LOGIN_BENCHMARK_ENV_FILE) {
      throw new Error("The configured LOGIN_BENCHMARK_ENV_FILE does not exist.");
    }
  }
  const credentials = live
    ? { email: process.env.LOGIN_BENCHMARK_EMAIL, password: process.env.LOGIN_BENCHMARK_PASSWORD }
    : { email: "user@example.com", password: "password" };
  if (!credentials.email || !credentials.password)
    throw new Error("Set LOGIN_BENCHMARK_EMAIL and LOGIN_BENCHMARK_PASSWORD for a live run.");
  let routePath = path.resolve(
    process.env.LOGIN_BENCHMARK_ROUTE || "src/app/api/auth/login/route.ts"
  );
  let storePath = path.resolve(process.env.LOGIN_BENCHMARK_STORE || "src/stores/authStore.ts");
  let snapshotDirectory: string | undefined;
  const baselineRef = process.env.LOGIN_BENCHMARK_BASELINE_REF;
  if (baselineRef) {
    await mkdir("tmp", { recursive: true });
    snapshotDirectory = await mkdtemp(path.resolve("tmp/login-benchmark-"));
    const readBaseline = (file: string) =>
      execFileSync("git", ["show", `${baselineRef === "INDEX" ? "" : baselineRef}:${file}`], {
        encoding: "utf8",
      });
    routePath = path.join(snapshotDirectory, "route.ts");
    storePath = path.join(snapshotDirectory, "auth-store.ts");
    await writeFile(routePath, readBaseline("src/app/api/auth/login/route.ts"));
    // Preserve module resolution when the store is loaded outside its source directory.
    await writeFile(
      storePath,
      readBaseline("src/stores/authStore.ts")
        .replace('from "./businessUnitStore"', 'from "@/stores/businessUnitStore"')
        .replace('from "./permissionStore"', 'from "@/stores/permissionStore"')
    );
  }
  const { POST } = (await import(
    /* @vite-ignore */ routePath
  )) as typeof import("../src/app/api/auth/login/route");
  const originalFetch = globalThis.fetch;
  const runApi = async (native: boolean) =>
    POST(
      new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(native ? { "X-Client-Source": "mobile" } : {}),
        },
        body: JSON.stringify(credentials),
      })
    );

  let webLogin: (() => Promise<unknown>) | undefined;
  if (live) {
    const countedFetch: typeof fetch = (input, options) => {
      const url = input instanceof Request ? input.url : String(input);
      state.operations.push(new URL(url).pathname);
      return originalFetch(input, options);
    };
    vi.stubGlobal("fetch", countedFetch);
  } else {
    vi.stubGlobal("fetch", () => runApi(false));
    const { useAuthStore } = (await import(
      /* @vite-ignore */ storePath
    )) as typeof import("../src/stores/authStore");
    webLogin = async () => {
      const result = await useAuthStore
        .getState()
        .login({ email: credentials.email!, password: credentials.password! });
      const { user, isAuthenticated } = useAuthStore.getState();
      return { ...result, user, isAuthenticated };
    };
  }

  const iterations = live ? 5 : 15;
  const cases = live
    ? ["web-api", "mobile-api"]
    : ["web-api", "mobile-api", "web-login", "mobile-api-no-bu-claim"];
  const results = [];
  try {
    for (const scenario of cases) {
      const samples: number[] = [];
      let operations: string[] = [];
      let authorizationDigest = "";
      state.fallback = scenario === "mobile-api-no-bu-claim";
      for (let index = -1; index < iterations; index += 1) {
        state.operations = [];
        const started = performance.now();
        const response =
          scenario === "web-login"
            ? await webLogin?.()
            : await runApi(scenario.startsWith("mobile"));
        const elapsed = performance.now() - started;
        if (response instanceof Response) {
          expect(response.status).toBe(200);
          const payload = await response.json();
          expect(payload.landingPage).toEqual(expect.any(String));
          if (scenario.startsWith("mobile")) expect(payload.permissions).toBeDefined();
          authorizationDigest = createHash("sha256")
            .update(
              JSON.stringify({
                user: payload.user,
                currentBusinessUnit: payload.currentBusinessUnit,
                landingPage: payload.landingPage,
                permissions: payload.permissions,
                capabilities: payload.capabilities,
              })
            )
            .digest("hex");
        } else {
          authorizationDigest = createHash("sha256").update(JSON.stringify(response)).digest("hex");
        }
        if (index >= 0) samples.push(elapsed);
        operations = [...state.operations];
        for (const cleanup of state.cleanup.splice(0)) await cleanup();
      }
      samples.sort((a, b) => a - b);
      results.push({
        scenario,
        samples: iterations,
        medianMs: Number(samples[Math.floor(samples.length / 2)].toFixed(2)),
        p95Ms: Number(samples[Math.ceil(samples.length * 0.95) - 1].toFixed(2)),
        requests: operations.length,
        operations,
        authorizationDigest,
      });
    }
    const report = {
      mode: live
        ? "live Supabase, in-process API handler; activity wrapper excluded"
        : "controlled latency: Auth 40 ms, each other request 20 ms; activity wrapper excluded",
      results,
    };
    if (process.env.LOGIN_BENCHMARK_OUTPUT)
      await writeFile(process.env.LOGIN_BENCHMARK_OUTPUT, `${JSON.stringify(report, null, 2)}\n`);
    console.info(JSON.stringify(report, null, 2));
  } finally {
    for (const cleanup of state.cleanup.splice(0)) await cleanup();
    vi.unstubAllGlobals();
    if (snapshotDirectory) await rm(snapshotDirectory, { recursive: true });
  }
});
