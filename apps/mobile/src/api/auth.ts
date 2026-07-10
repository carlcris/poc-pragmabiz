import type { AuthSession, LoginResponse } from "@/contracts/auth";
import { API_BASE_URL } from "@/config/env";

const readPayload = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Partial<LoginResponse> & {
      message?: string;
      error?: string;
    };
  } catch {
    return {
      message: text.length > 160 ? "The server returned an invalid response." : text
    };
  }
};

export const login = async (email: string, password: string): Promise<AuthSession> => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    credentials: "omit",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Client-Source": "mobile"
    },
    body: JSON.stringify({ email, password })
  });

  const payload = await readPayload(response);

  if (
    !response.ok ||
    !payload.user ||
    !payload.token ||
    !payload.refreshToken ||
    !payload.cookieHeader ||
    !payload.permissions ||
    !payload.capabilities
  ) {
    throw new Error(payload.message || payload.error || "Sign in failed");
  }

  return {
    user: payload.user,
    token: payload.token,
    refreshToken: payload.refreshToken,
    cookieHeader: payload.cookieHeader,
    permissions: payload.permissions,
    capabilities: payload.capabilities,
    currentBusinessUnit: payload.currentBusinessUnit ?? null
  };
};

export const logout = async (session: AuthSession | null) => {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "omit",
    headers: {
      Accept: "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(session?.cookieHeader ? { Cookie: session.cookieHeader } : {})
    }
  }).catch(() => undefined);
};
