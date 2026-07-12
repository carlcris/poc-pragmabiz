import { apiRequest } from "@/api/client";
import { API_BASE_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/config/env";

export type RealtimeConfig = {
  url: string;
  anonKey: string;
};

let configPromise: Promise<RealtimeConfig> | null = null;

const normalizeRealtimeUrl = (value: string) => {
  const realtimeUrl = new URL(value);
  const apiUrl = new URL(API_BASE_URL);
  if (
    (realtimeUrl.hostname === "127.0.0.1" || realtimeUrl.hostname === "localhost") &&
    apiUrl.hostname !== "127.0.0.1" &&
    apiUrl.hostname !== "localhost"
  ) {
    realtimeUrl.hostname = apiUrl.hostname;
  }
  return realtimeUrl.toString().replace(/\/$/, "");
};

const loadRealtimeConfig = async (): Promise<RealtimeConfig> => {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    return { url: normalizeRealtimeUrl(SUPABASE_URL), anonKey: SUPABASE_ANON_KEY };
  }

  const response = await apiRequest<Partial<RealtimeConfig>>("/api/mobile/realtime-config");
  if (typeof response.url !== "string" || typeof response.anonKey !== "string") {
    throw new Error("Realtime configuration is unavailable");
  }

  return { url: normalizeRealtimeUrl(response.url), anonKey: response.anonKey };
};

export const getRealtimeConfig = () => {
  if (!configPromise) {
    configPromise = loadRealtimeConfig().catch((error) => {
      configPromise = null;
      throw error;
    });
  }
  return configPromise;
};
