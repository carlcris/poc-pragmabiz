import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RealtimeConfig } from "@/api/realtime";

let client: SupabaseClient | null = null;
let clientUrl: string | null = null;

export const getRealtimeClient = (config: RealtimeConfig, accessToken: string) => {
  if (!client || clientUrl !== config.url) {
    client = createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    clientUrl = config.url;
  }

  client.realtime.setAuth(accessToken);
  return client;
};
