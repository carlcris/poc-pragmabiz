import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/activity-logging/route-activity-logger", () => ({
  withActivityLogging: (handler: unknown) => handler,
  setActivityContext: vi.fn(),
}));
vi.mock("@/lib/supabase/route-handler", () => ({
  createRouteHandlerClient: () => {
    const response = NextResponse.next();
    response.cookies.set("sb-test-auth-token", "test-session", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return {
      supabase: {
        auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut },
        from: mocks.from,
        rpc: mocks.rpc,
      },
      response,
    };
  },
}));

const request = (body: unknown = { email: "user@example.com", password: "password" }) =>
  new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.signIn.mockResolvedValue({ data: { user: null, session: null }, error: null });
});

afterEach(() => vi.restoreAllMocks());

const defaultPermissionRows = [
  { resource: "dashboard", can_view: true, can_create: false, can_edit: false, can_delete: false },
  { resource: "items", can_view: true, can_create: true, can_edit: false, can_delete: false },
  {
    resource: "items.field.cost",
    can_view: false,
    can_create: false,
    can_edit: false,
    can_delete: false,
  },
];

function configureSuccessfulLogin(
  options: {
    claims?: Record<string, string>;
    accessRows?: Array<{ business_unit_id: string; is_current: boolean; is_default: boolean }>;
    permissionRows?: typeof defaultPermissionRows;
    permissionError?: { message: string };
    roleRows?: Array<{ roles: { name: string } | Array<{ name: string }> }>;
  } = {}
) {
  const token = `header.${Buffer.from(JSON.stringify(options.claims ?? { current_business_unit_id: "unit" })).toString("base64url")}.signature`;
  mocks.signIn.mockResolvedValue({
    data: {
      user: { id: "user", email: "user@example.com" },
      session: { access_token: token, refresh_token: "refresh" },
    },
    error: null,
  });
  mocks.rpc.mockResolvedValue({
    data: options.permissionRows ?? defaultPermissionRows,
    error: options.permissionError ?? null,
  });

  const results: Record<string, { data: unknown; error: null }> = {
    users: {
      data: {
        id: "user",
        username: "operator",
        first_name: "Test",
        last_name: "User",
        company_id: "company",
      },
      error: null,
    },
    business_units: { data: { id: "unit", code: "MAIN", name: "Main" }, error: null },
    user_roles: { data: options.roleRows ?? [{ roles: { name: "Admin" } }], error: null },
    user_business_unit_access: { data: options.accessRows ?? [], error: null },
  };
  const queries = Object.fromEntries(
    Object.entries(results).map(([table, result]) => [
      table,
      {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue(result),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      },
    ])
  );
  mocks.from.mockImplementation((table: string) => queries[table]);
  return queries;
}

const mobileRequest = () => {
  const loginRequest = request();
  loginRequest.headers.set("X-Client-Source", "mobile");
  return loginRequest;
};

describe("login API safe errors", () => {
  it.each([
    ["invalid_credentials", 400, 401, "LOGIN_INVALID_CREDENTIALS"],
    ["email_not_confirmed", 400, 403, "LOGIN_EMAIL_NOT_CONFIRMED"],
    ["user_banned", 403, 403, "LOGIN_ACCOUNT_UNAVAILABLE"],
    ["over_request_rate_limit", 429, 429, "LOGIN_RATE_LIMITED"],
    ["unexpected_failure", 500, 503, "LOGIN_UNAVAILABLE"],
  ])("maps %s to a safe status and code", async (providerCode, providerStatus, status, code) => {
    mocks.signIn.mockResolvedValue({
      data: {},
      error: { code: providerCode, status: providerStatus, message: "private provider details" },
    });
    const response = await POST(request());
    expect(response.status).toBe(status);
    const payload = await response.json();
    expect(payload).toMatchObject({ code, message: expect.any(String) });
    expect(payload.message).not.toContain("private provider details");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([
    null,
    [],
    {},
    { email: 123, password: "password" },
    { email: "a", password: "" },
    { email: "a".repeat(255), password: "password" },
  ])("rejects invalid credential input without contacting auth", async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "LOGIN_INVALID_INPUT" });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/auth/login", { method: "POST", body: "{" })
    );
    expect(response.status).toBe(400);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("logs unexpected details only on the server", async () => {
    mocks.signIn.mockRejectedValue(new Error("private database connection details"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.code).toBe("LOGIN_UNAVAILABLE");
    expect(payload.message).not.toMatch(/private|database|Internal server error/i);
    expect(console.error).toHaveBeenCalled();
  });

  it("does not mistake a missing session for incorrect credentials", async () => {
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "LOGIN_UNAVAILABLE" });
  });

  it("keeps profile database errors server-side", async () => {
    mocks.signIn.mockResolvedValue({
      data: { user: { id: "user" }, session: { access_token: "token" } },
      error: null,
    });
    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: { message: "private SQL details" } }),
        }),
      }),
    });
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: "LOGIN_UNAVAILABLE" });
    expect(console.error).toHaveBeenCalledWith("Failed to load login profile", expect.any(Object));
  });

  it("directs an unprovisioned account to its administrator", async () => {
    mocks.signIn.mockResolvedValue({
      data: { user: { id: "user" }, session: { access_token: "token" } },
      error: null,
    });
    mocks.from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    });
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "LOGIN_ACCOUNT_UNAVAILABLE" });
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([false, true])("preserves successful login responses (native: %s)", async (native) => {
    mocks.signIn.mockResolvedValue({
      data: {
        user: { id: "user", email: "user@example.com" },
        session: { access_token: "token", refresh_token: "refresh" },
      },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "user",
                  email: "user@example.com",
                  username: "operator",
                  first_name: "Test",
                  last_name: "User",
                  company_id: "company",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () =>
            table === "user_roles"
              ? { is: async () => ({ data: [], error: null }) }
              : Promise.resolve({ data: [], error: null }),
        }),
      };
    });
    const loginRequest = request();
    if (native) loginRequest.headers.set("X-Client-Source", "mobile");
    const response = await POST(loginRequest);
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      user: { id: "user", companyId: "company" },
      token: "token",
      refreshToken: "refresh",
      landingPage: expect.any(String),
    });
    if (native) {
      expect(payload).toMatchObject({
        cookieHeader: expect.any(String),
        permissions: expect.any(Object),
        capabilities: {},
      });
    } else {
      expect(payload).not.toHaveProperty("cookieHeader");
    }
  });
});

describe("login query reuse and permission preservation", () => {
  it("preserves issued tokens and cookie attributes for native and browser sessions", async () => {
    configureSuccessfulLogin();
    const response = await POST(mobileRequest());
    const payload = await response.json();
    expect(payload.token).toBe(
      (await mocks.signIn.mock.results[0].value).data.session.access_token
    );
    expect(payload.refreshToken).toBe("refresh");
    expect(payload.cookieHeader).toBe("sb-test-auth-token=test-session");
    expect(response.cookies.get("sb-test-auth-token")).toMatchObject({
      value: "test-session",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it.each([false, true])("loads a single permission snapshot (native: %s)", async (native) => {
    const queries = configureSuccessfulLogin();
    const response = await POST(native ? mobileRequest() : request());
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.landingPage).toBe("/dashboard");
    expect(mocks.signIn).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_user_permissions", {
      p_user_id: "user",
      p_business_unit_id: "unit",
    });
    expect(mocks.from.mock.calls.map(([table]) => table).sort()).toEqual([
      "business_units",
      "user_roles",
      "users",
    ]);
    expect(queries.user_roles.eq).toHaveBeenCalledWith("user_id", "user");
    expect(queries.user_roles.is).toHaveBeenCalledWith("deleted_at", null);
    if (native) {
      expect(payload.permissions.items).toEqual({
        can_view: true,
        can_create: true,
        can_edit: false,
        can_delete: false,
      });
      expect(payload.permissions).not.toHaveProperty("items.field.cost");
      expect(payload.capabilities["items.field.cost"].can_view).toBe(false);
      expect(payload.permissions.dashboard.can_edit).toBe(false);
    } else {
      expect(payload).not.toHaveProperty("permissions");
      expect(payload).not.toHaveProperty("capabilities");
    }
  });

  it.each([
    [{ current_business_unit_id: "current", default_business_unit_id: "default" }, "current"],
    [{ default_business_unit_id: "default" }, "default"],
  ])("preserves business-unit token precedence %j", async (claims, expectedUnit) => {
    configureSuccessfulLogin({ claims });
    await POST(mobileRequest());
    expect(mocks.from).not.toHaveBeenCalledWith("user_business_unit_access");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_user_permissions", {
      p_user_id: "user",
      p_business_unit_id: expectedUnit,
    });
  });

  it.each([
    [
      [
        { business_unit_id: "default", is_current: false, is_default: true },
        { business_unit_id: "current", is_current: true, is_default: false },
      ],
      "current",
    ],
    [[{ business_unit_id: "default", is_current: false, is_default: true }], "default"],
    [[{ business_unit_id: "first", is_current: false, is_default: false }], "first"],
    [[], null],
  ] as const)("resolves missing token context only once (%j)", async (accessRows, expectedUnit) => {
    configureSuccessfulLogin({ claims: {}, accessRows: [...accessRows] });
    await POST(mobileRequest());
    expect(
      mocks.from.mock.calls.filter(([table]) => table === "user_business_unit_access")
    ).toHaveLength(1);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("get_user_permissions", {
      p_user_id: "user",
      p_business_unit_id: expectedUnit,
    });
  });

  it("keeps role-based landing selection subject to the same permissions", async () => {
    configureSuccessfulLogin({
      roleRows: [{ roles: [{ name: "Cashier" }] }],
      permissionRows: [
        { resource: "pos", can_view: true, can_create: false, can_edit: false, can_delete: false },
      ],
    });
    expect(await (await POST(request())).json()).toMatchObject({ landingPage: "/sales/pos" });
    configureSuccessfulLogin({ roleRows: [{ roles: { name: "Cashier" } }], permissionRows: [] });
    const denied = await (await POST(mobileRequest())).json();
    expect(denied.landingPage).toBe("/403");
    expect(Object.values(denied.permissions)).toEqual(
      expect.arrayContaining([
        { can_view: false, can_create: false, can_edit: false, can_delete: false },
      ])
    );
    expect(denied.capabilities).toEqual({});
  });

  it("fails closed for both landing and capabilities when permission loading fails", async () => {
    configureSuccessfulLogin({ permissionError: { message: "private SQL details" } });
    const payload = await (await POST(mobileRequest())).json();
    expect(payload.landingPage).toBe("/403");
    expect(
      Object.values(payload.permissions).every((permission) => {
        const actions = permission as Record<string, boolean>;
        return Object.values(actions).every((allowed) => !allowed);
      })
    ).toBe(true);
    expect(payload.capabilities).toEqual({});
    expect(JSON.stringify(payload)).not.toContain("private SQL details");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("starts independent reads together after account validation", async () => {
    const queries = configureSuccessfulLogin();
    let finishBusinessUnit:
      | ((result: { data: { id: string; code: string; name: string }; error: null }) => void)
      | undefined;
    queries.business_units.maybeSingle.mockReturnValue(
      new Promise((resolve) => {
        finishBusinessUnit = resolve;
      })
    );
    const responsePromise = POST(request());
    await vi.waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
      expect(mocks.from).toHaveBeenCalledWith("user_roles");
    });
    expect(finishBusinessUnit).toBeDefined();
    finishBusinessUnit?.({ data: { id: "unit", code: "MAIN", name: "Main" }, error: null });
    expect((await responsePromise).status).toBe(200);
  });
});
