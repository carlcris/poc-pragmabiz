import type { AuthSession, LoginResponse } from "@/contracts/auth";
import { API_BASE_URL } from "@/config/env";
import { LoginError, requestLogin } from "../../../../src/lib/auth/login-errors";

export const login = async (email: string, password: string): Promise<AuthSession> => {
  const payload = await requestLogin<LoginResponse>(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    credentials: "omit",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Client-Source": "mobile",
    },
    body: JSON.stringify({ email, password }),
  });

  if (
    !payload.user ||
    !payload.token ||
    !payload.refreshToken ||
    !payload.cookieHeader ||
    !payload.permissions ||
    !payload.capabilities
  ) {
    throw new LoginError("LOGIN_UNAVAILABLE");
  }

  return {
    user: payload.user,
    token: payload.token,
    refreshToken: payload.refreshToken,
    cookieHeader: payload.cookieHeader,
    permissions: payload.permissions,
    capabilities: payload.capabilities,
    currentBusinessUnit: payload.currentBusinessUnit ?? null,
  };
};

export const logout = async (session: AuthSession | null) => {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "omit",
    headers: {
      Accept: "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(session?.cookieHeader ? { Cookie: session.cookieHeader } : {}),
    },
  }).catch(() => undefined);
};
