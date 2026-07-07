import { apiRequest, ApiError } from "@/api/client";
import { API_BASE_URL } from "@/config/env";
import type { BusinessUnit, BusinessUnitsResponse, SetBusinessUnitResponse } from "@/contracts/businessUnit";
import { useAuthStore } from "@/stores/authStore";

const toCookieHeader = (setCookieHeader: string | null) => {
  if (!setCookieHeader) return "";
  return setCookieHeader
    .split(/,(?=\s*[^;,]+=)/)
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
};

const readPayload = async <T>(response: Response): Promise<T & { error?: string; message?: string }> => {
  const text = await response.text();
  if (!text) return {} as T & { error?: string; message?: string };
  try {
    return JSON.parse(text) as T & { error?: string; message?: string };
  } catch {
    return {
      message: text.length > 160 ? "The server returned an invalid response." : text
    } as T & { error?: string; message?: string };
  }
};

export const listBusinessUnits = async (): Promise<BusinessUnit[]> => {
  const response = await apiRequest<BusinessUnitsResponse>("/api/business-units");
  return response.data;
};

export const setBusinessUnitContext = async (
  businessUnitId: string
): Promise<SetBusinessUnitResponse & { cookieHeader: string }> => {
  const session = useAuthStore.getState().session;
  const response = await fetch(`${API_BASE_URL}/api/business-units/set-context`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(session?.cookieHeader ? { Cookie: session.cookieHeader } : {})
    },
    body: JSON.stringify({ business_unit_id: businessUnitId })
  });

  const payload = await readPayload<SetBusinessUnitResponse>(response);
  if (!response.ok || !payload.token || !payload.refreshToken || !payload.business_unit) {
    throw new ApiError(payload.message || payload.error || "Failed to switch business unit", response.status);
  }

  return {
    ...payload,
    cookieHeader: payload.cookieHeader || toCookieHeader(response.headers.get("set-cookie"))
  };
};
