export const loginErrorCodes = [
  "LOGIN_INVALID_INPUT",
  "LOGIN_INVALID_CREDENTIALS",
  "LOGIN_EMAIL_NOT_CONFIRMED",
  "LOGIN_ACCOUNT_UNAVAILABLE",
  "LOGIN_RATE_LIMITED",
  "LOGIN_UNAVAILABLE",
  "LOGIN_NETWORK_ERROR",
  "LOGIN_TIMEOUT",
  "LOGIN_VAN_NOT_ASSIGNED",
] as const;

export type LoginErrorCode = (typeof loginErrorCodes)[number];

export class LoginError extends Error {
  constructor(public readonly code: LoginErrorCode) {
    super(code);
    this.name = "LoginError";
  }
}

const isLoginErrorCode = (value: unknown): value is LoginErrorCode =>
  loginErrorCodes.some((code) => code === value);

export function getLoginErrorCode(error: unknown): LoginErrorCode {
  if (typeof error === "object" && error !== null && "code" in error) {
    if (isLoginErrorCode(error.code)) return error.code;
  }
  return "LOGIN_UNAVAILABLE";
}

// Only provider codes and statuses are classified; provider messages never reach the UI.
export function getSupabaseLoginErrorCode(error: {
  code?: string;
  status?: number;
}): LoginErrorCode {
  if (error.status && error.status >= 500) return "LOGIN_UNAVAILABLE";
  if (error.status === 429) return "LOGIN_RATE_LIMITED";
  switch (error.code) {
    case "invalid_credentials":
      return "LOGIN_INVALID_CREDENTIALS";
    case "email_not_confirmed":
      return "LOGIN_EMAIL_NOT_CONFIRMED";
    case "user_banned":
      return "LOGIN_ACCOUNT_UNAVAILABLE";
    case "over_request_rate_limit":
      return "LOGIN_RATE_LIMITED";
    default:
      return "LOGIN_UNAVAILABLE";
  }
}

export type LoginErrorMessageKey =
  | "invalidInput"
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "accountUnavailable"
  | "rateLimited"
  | "unavailable"
  | "networkError"
  | "timeout"
  | "vanNotAssigned";

export function getLoginErrorMessage(
  code: LoginErrorCode,
  t: (key: LoginErrorMessageKey) => string
): string {
  switch (code) {
    case "LOGIN_INVALID_INPUT":
      return t("invalidInput");
    case "LOGIN_INVALID_CREDENTIALS":
      return t("invalidCredentials");
    case "LOGIN_EMAIL_NOT_CONFIRMED":
      return t("emailNotConfirmed");
    case "LOGIN_ACCOUNT_UNAVAILABLE":
      return t("accountUnavailable");
    case "LOGIN_RATE_LIMITED":
      return t("rateLimited");
    case "LOGIN_NETWORK_ERROR":
      return t("networkError");
    case "LOGIN_TIMEOUT":
      return t("timeout");
    case "LOGIN_VAN_NOT_ASSIGNED":
      return t("vanNotAssigned");
    default:
      return t("unavailable");
  }
}

export async function requestLogin<T>(url: string, options: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (response.status >= 500) throw new LoginError("LOGIN_UNAVAILABLE");
    if (response.status === 429) throw new LoginError("LOGIN_RATE_LIMITED");

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      if (controller.signal.aborted) throw new LoginError("LOGIN_TIMEOUT");
      throw new LoginError("LOGIN_UNAVAILABLE");
    }
    if (!response.ok) {
      throw new LoginError(getLoginErrorCode(payload));
    }
    if (typeof payload !== "object" || payload === null) {
      throw new LoginError("LOGIN_UNAVAILABLE");
    }
    return payload as T;
  } catch (error) {
    if (error instanceof LoginError) throw error;
    throw new LoginError(controller.signal.aborted ? "LOGIN_TIMEOUT" : "LOGIN_NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }
}
