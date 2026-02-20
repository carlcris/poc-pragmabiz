import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";

type RealtimeInvalidationOptions = {
  tables: string[];
  queryKeys: string[];
  schema?: string;
  enabled?: boolean;
  debounceMs?: number;
  channelKey?: string;
};

type ChannelState = {
  channel: RealtimeChannel;
  listeners: Set<() => void>;
  debounceMs: number;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  isReleasing: boolean;
  hasWarnedFailure: boolean;
};

const channelPool = new Map<string, ChannelState>();

const stableJoin = (values: string[]) => [...values].sort().join(",");

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const resolveRealtimeTopic = (poolKey: string) => `rt-invalidate-${hashString(poolKey)}`;

const resolveChannelKey = ({
  schema,
  tables,
  channelKey,
}: {
  schema: string;
  tables: string[];
  channelKey?: string;
}) => {
  if (channelKey) return `custom:${channelKey}`;
  return `schema:${schema}|tables:${stableJoin(tables)}`;
};

const scheduleNotify = (state: ChannelState) => {
  if (state.debounceTimer) return;
  state.debounceTimer = setTimeout(() => {
    state.debounceTimer = null;
    for (const listener of state.listeners) {
      listener();
    }
  }, state.debounceMs);
};

const cleanupChannel = (poolKey: string, state: ChannelState) => {
  if (state.debounceTimer) {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = null;
  }

  state.isReleasing = true;
  supabase.removeChannel(state.channel);
  channelPool.delete(poolKey);
};

const ensureChannel = ({
  poolKey,
  schema,
  tables,
  debounceMs,
}: {
  poolKey: string;
  schema: string;
  tables: string[];
  debounceMs: number;
}) => {
  const existing = channelPool.get(poolKey);
  if (existing) {
    existing.debounceMs = debounceMs;
    return existing;
  }

  const channel = supabase.channel(resolveRealtimeTopic(poolKey));
  const state: ChannelState = {
    channel,
    listeners: new Set<() => void>(),
    debounceMs,
    debounceTimer: null,
    isReleasing: false,
    hasWarnedFailure: false,
  };

  for (const table of tables) {
    channel.on("postgres_changes", { event: "*", schema, table }, () => {
      scheduleNotify(state);
    });
  }

  channel.subscribe((status, err) => {
    if (status === "SUBSCRIBED") {
      state.isReleasing = false;
      return;
    }

    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      if (state.isReleasing || state.listeners.size === 0) return;
      if (!state.hasWarnedFailure) {
        state.hasWarnedFailure = true;
        const message = err instanceof Error ? err.message : undefined;
        console.warn("[realtime] subscription degraded; realtime disabled for this view", {
          poolKey,
          status,
          message,
        });
      }
      cleanupChannel(poolKey, state);
    }
  });
  channelPool.set(poolKey, state);
  return state;
};

const releaseChannel = (poolKey: string) => {
  const state = channelPool.get(poolKey);
  if (!state || state.listeners.size > 0) return;
  cleanupChannel(poolKey, state);
};

export const useRealtimeQueryInvalidation = ({
  tables,
  queryKeys,
  schema = "public",
  enabled = true,
  debounceMs = 150,
  channelKey,
}: RealtimeInvalidationOptions) => {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const authToken = useAuthStore((state) => state.token);
  const tablesRef = useRef(tables);
  const queryKeysRef = useRef(queryKeys);
  const tablesKey = stableJoin(tables);
  const queryKeysKey = stableJoin(queryKeys);
  const hasTables = tablesKey.length > 0;
  const hasQueryKeys = queryKeysKey.length > 0;
  const shouldSubscribe =
    enabled && isAuthenticated && !isAuthLoading && !!authToken && hasTables && hasQueryKeys;

  tablesRef.current = tables;
  queryKeysRef.current = queryKeys;

  const poolKey = resolveChannelKey({ schema, tables, channelKey });

  useEffect(() => {
    if (!shouldSubscribe) return;

    const state = ensureChannel({ poolKey, schema, tables: tablesRef.current, debounceMs });
    const listener = () => {
      for (const queryKey of queryKeysRef.current) {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      }
    };

    state.listeners.add(listener);

    return () => {
      state.listeners.delete(listener);
      releaseChannel(poolKey);
    };
  }, [debounceMs, poolKey, queryClient, queryKeysKey, schema, shouldSubscribe, tablesKey]);
};
