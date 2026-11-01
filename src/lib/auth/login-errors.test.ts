import { afterEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "next-intl";
import { translations } from "../i18n/translations";
import {
  getLoginErrorCode,
  getLoginErrorMessage,
  getSupabaseLoginErrorCode,
  loginErrorCodes,
  requestLogin,
} from "./login-errors";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("login error guidance", () => {
  it.each([
    [{ code: "invalid_credentials", status: 400 }, "LOGIN_INVALID_CREDENTIALS"],
    [{ code: "email_not_confirmed", status: 400 }, "LOGIN_EMAIL_NOT_CONFIRMED"],
    [{ code: "user_banned", status: 403 }, "LOGIN_ACCOUNT_UNAVAILABLE"],
    [{ status: 429 }, "LOGIN_RATE_LIMITED"],
    [{ code: "invalid_credentials", status: 500 }, "LOGIN_UNAVAILABLE"],
    [{ code: "unexpected_failure", status: 500 }, "LOGIN_UNAVAILABLE"],
    [{ code: "unknown", status: 400 }, "LOGIN_UNAVAILABLE"],
  ] as const)("classifies provider errors %j", (error, code) => {
    expect(getSupabaseLoginErrorCode(error)).toBe(code);
  });

  it.each(["en", "zh"] as const)("translates every supported failure in %s", (locale) => {
    const t = createTranslator({ locale, messages: translations[locale].loginErrors });
    for (const code of loginErrorCodes) {
      const message = getLoginErrorMessage(code, t);
      expect(message).not.toBe(code);
      expect(message.length).toBeGreaterThan(10);
    }
    expect(getLoginErrorMessage("LOGIN_UNAVAILABLE", t)).toBe(
      translations[locale].loginErrors.unavailable
    );
  });

  it("does not interpret unknown error messages as a public failure code", () => {
    expect(getLoginErrorCode(new Error("Internal Server Error"))).toBe("LOGIN_UNAVAILABLE");
    expect(getLoginErrorCode({ code: "SQL_FAILURE", message: "private details" })).toBe(
      "LOGIN_UNAVAILABLE"
    );
  });
});

describe("shared native and web login request", () => {
  it.each([
    new Response("Internal Server Error", { status: 500 }),
    new Response("<html>proxy failure</html>", { status: 502 }),
    Response.json(
      { code: "LOGIN_INVALID_CREDENTIALS", message: "private details" },
      { status: 503 }
    ),
    new Response("invalid JSON", { status: 200 }),
    Response.json(null),
    Response.json({ message: "private details", code: "UNKNOWN" }, { status: 400 }),
  ])("hides unexpected and non-JSON responses", async (response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(requestLogin("/api/auth/login", {})).rejects.toMatchObject({
      code: "LOGIN_UNAVAILABLE",
      message: "LOGIN_UNAVAILABLE",
    });
  });

  it("preserves a known failure code without exposing the response message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            code: "LOGIN_INVALID_CREDENTIALS",
            message: "private details",
          },
          { status: 401 }
        )
      )
    );
    await expect(requestLogin("/api/auth/login", {})).rejects.toMatchObject({
      code: "LOGIN_INVALID_CREDENTIALS",
      message: "LOGIN_INVALID_CREDENTIALS",
    });
  });

  it("handles rate limiting even when a proxy supplies a plain-text response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Too many requests", { status: 429 }))
    );
    await expect(requestLogin("/api/auth/login", {})).rejects.toMatchObject({
      code: "LOGIN_RATE_LIMITED",
    });
  });

  it("classifies network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(requestLogin("/api/auth/login", {})).rejects.toMatchObject({
      code: "LOGIN_NETWORK_ERROR",
    });
  });

  it("bounds the request duration and cancels a stalled request without retries", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError"))
          );
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const assertion = expect(requestLogin("/api/auth/login", {})).rejects.toMatchObject({
      code: "LOGIN_TIMEOUT",
    });
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps successful responses and the mobile client header intact", async () => {
    const payload = { user: { id: "user" }, token: "access", refreshToken: "refresh" };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(payload));
    vi.stubGlobal("fetch", fetchMock);
    const options = { method: "POST", headers: { "X-Client-Source": "mobile" }, body: "{}" };
    await expect(requestLogin("/api/auth/login", options)).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining(options));
  });
});
