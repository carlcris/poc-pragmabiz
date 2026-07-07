import type { AuthSession, LoginResponse } from "@/contracts/auth";
import { API_BASE_URL } from "@/config/env";

const toCookieHeader = (setCookieHeader: string | null) => {
  if (!setCookieHeader) return "";
  return setCookieHeader
    .split(/,(?=\s*[^;,]+=)/)
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
};

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
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const payload = await readPayload(response);

  if (!response.ok || !payload.user || !payload.token || !payload.refreshToken) {
    throw new Error(payload.message || payload.error || "Sign in failed");
  }

  return {
    user: payload.user,
    token: payload.token,
    refreshToken: payload.refreshToken,
    cookieHeader: toCookieHeader(response.headers.get("set-cookie")),
    currentBusinessUnit: payload.currentBusinessUnit ?? null
  };
};

export const logout = async () => {
  await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST" }).catch(() => undefined);
};
