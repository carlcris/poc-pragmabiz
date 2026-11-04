import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (typeof extra?.apiBaseUrl === "string" ? extra.apiBaseUrl : undefined) ||
  "http://localhost:3000";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

export const REQUEST_TIMEOUT_MS = 20000;
