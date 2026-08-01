import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "@/config/env";
import { useAuthStore } from "@/stores/authStore";

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ApiOptions = {
  method?: ApiMethod;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const buildUrl = (path: string, query?: ApiOptions["query"]) => {
  const url = new URL(path.startsWith("http") ? path : `${API_BASE_URL}${path}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
};

const readErrorPayload = async (response: Response) => {
  const text = await response.text();
  if (!text) return { message: "Request failed" };
  try {
    const payload = JSON.parse(text) as Record<string, unknown>;
    const message = payload.message || payload.error;
    return {
      message: typeof message === "string" && message ? message : "Request failed",
      code: typeof payload.code === "string" && payload.code ? payload.code : undefined,
    };
  } catch {
    return { message: text.length > 160 ? "Request failed" : text };
  }
};

const readJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError("The server returned an invalid response.", response.status);
  }
};

export const apiRequest = async <T>(path: string, options: ApiOptions = {}): Promise<T> => {
  const session = useAuthStore.getState().session;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(path, options.query), {
      method: options.method || "GET",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...(session?.cookieHeader ? { Cookie: session.cookieHeader } : {})
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });

    if (response.status === 401) {
      await useAuthStore.getState().logout();
      throw new ApiError("Your session has expired. Please sign in again.", 401);
    }

    if (!response.ok) {
      const error = await readErrorPayload(response);
      throw new ApiError(error.message, response.status, error.code);
    }

    if (response.status === 204) return undefined as T;
    return readJson<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("The server took too long to respond.", 408);
    }
    throw new ApiError("Unable to reach the server.", 0);
  } finally {
    clearTimeout(timeout);
  }
};
