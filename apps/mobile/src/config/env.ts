import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (typeof extra?.apiBaseUrl === "string" ? extra.apiBaseUrl : undefined) ||
  "http://localhost:3000";

export const REQUEST_TIMEOUT_MS = 20000;
