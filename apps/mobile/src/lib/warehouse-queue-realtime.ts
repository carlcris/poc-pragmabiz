import { getRealtimeConfig } from "../api/realtime";
import { getRealtimeClient } from "./supabase";

let nextChannelId = 0;

export type WarehouseQueueKind = "picking" | "receiving";

export type WarehouseQueueAccess = {
  picking: boolean;
  loadListReceiving: boolean;
  deliveryNoteReceiving: boolean;
};

type QueueSubscription = {
  table: string;
  filter: string;
  queue: WarehouseQueueKind;
};

export const subscribeWarehouseQueue = (
  businessUnitId: string,
  accessToken: string,
  access: WarehouseQueueAccess,
  onChange: (queues: WarehouseQueueKind[]) => void
) => {
  const subscriptions: QueueSubscription[] = [];
  if (access.picking) {
    subscriptions.push({
      table: "pick_lists",
      filter: `business_unit_id=eq.${businessUnitId}`,
      queue: "picking",
    });
  }
  if (access.loadListReceiving) {
    subscriptions.push(
      {
        table: "load_lists",
        filter: `destination_business_unit_id=eq.${businessUnitId}`,
        queue: "receiving",
      },
      {
        table: "grns",
        filter: `business_unit_id=eq.${businessUnitId}`,
        queue: "receiving",
      }
    );
  }
  if (access.deliveryNoteReceiving) {
    subscriptions.push({
      table: "delivery_notes",
      filter: `requesting_business_unit_id=eq.${businessUnitId}`,
      queue: "receiving",
    });
  }
  if (subscriptions.length === 0) return () => undefined;

  let disposed = false;
  const pendingQueues = new Set<WarehouseQueueKind>();
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let removeChannel: (() => Promise<unknown>) | null = null;

  const scheduleRefresh = (queue: WarehouseQueueKind) => {
    if (disposed) return;
    pendingQueues.add(queue);
    if (refreshTimer) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      const queues = [...pendingQueues];
      pendingQueues.clear();
      if (!disposed) onChange(queues);
    }, 150);
  };

  const connect = async () => {
    try {
      const config = await getRealtimeConfig();
      if (disposed) return;

      const supabase = getRealtimeClient(config, accessToken);
      // Teardown is asynchronous; a returning screen must not reuse a channel still leaving.
      const channel = supabase.channel(
        `mobile-warehouse-queue-${businessUnitId}-${++nextChannelId}`
      );
      for (const subscription of subscriptions) {
        channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: subscription.table,
            filter: subscription.filter,
          },
          () => scheduleRefresh(subscription.queue)
        );
      }
      channel.subscribe((status) => {
        // Catch changes between the initial fetch and subscription, and while disconnected.
        if (status === "SUBSCRIBED") {
          for (const subscription of subscriptions) scheduleRefresh(subscription.queue);
        }
      });
      removeChannel = () => supabase.removeChannel(channel);
    } catch {
      if (disposed) return;
      // Retry configuration setup; the Realtime client owns channel reconnection.
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void connect();
      }, 5_000);
    }
  };

  void connect();

  return () => {
    disposed = true;
    pendingQueues.clear();
    if (refreshTimer) clearTimeout(refreshTimer);
    if (retryTimer) clearTimeout(retryTimer);
    if (removeChannel) void removeChannel();
  };
};
