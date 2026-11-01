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
  createRouteHandlerClient: () => ({
    supabase: {
      auth: { signInWithPassword: mocks.signIn, signOut: mocks.signOut },
      from: mocks.from,
      rpc: mocks.rpc,
    },
    response: NextResponse.next(),
  }),
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
