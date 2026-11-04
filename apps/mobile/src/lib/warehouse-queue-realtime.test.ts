import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeWarehouseQueue, type WarehouseQueueAccess } from "./warehouse-queue-realtime";

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn<() => Promise<{ url: string; publishableKey: string }>>(),
  getClient: vi.fn(),
  channel: vi.fn(),
  on: vi.fn(),
  subscribe: vi.fn(),
  removeChannel: vi.fn(),
  onChange: vi.fn(),
  event: null as (() => void) | null,
  events: new Map<string, () => void>(),
  status: null as ((status: string) => void) | null,
}));

vi.mock("../api/realtime", () => ({
  getRealtimeConfig: mocks.getConfig,
}));
vi.mock("./supabase", () => ({
  getRealtimeClient: mocks.getClient,
}));

const channel = { on: mocks.on, subscribe: mocks.subscribe };
let unsubscribe: (() => void) | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.event = null;
  mocks.events.clear();
  mocks.status = null;
  mocks.getConfig.mockResolvedValue({ url: "https://example.test", publishableKey: "public-key" });
  mocks.getClient.mockReturnValue({ channel: mocks.channel, removeChannel: mocks.removeChannel });
  mocks.channel.mockReturnValue(channel);
  mocks.on.mockImplementation((_event: string, filter: { table: string }, callback: () => void) => {
    mocks.event = callback;
    mocks.events.set(filter.table, callback);
    return channel;
  });
  mocks.subscribe.mockImplementation((callback: (status: string) => void) => {
    mocks.status = callback;
    return channel;
  });
  mocks.removeChannel.mockResolvedValue("ok");
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = undefined;
  vi.useRealTimers();
});

const pickingAccess: WarehouseQueueAccess = {
  picking: true,
  loadListReceiving: false,
  deliveryNoteReceiving: false,
};
const receivingAccess: WarehouseQueueAccess = {
  picking: false,
  loadListReceiving: true,
  deliveryNoteReceiving: true,
};

const start = async (access: WarehouseQueueAccess = pickingAccess) => {
  unsubscribe = subscribeWarehouseQueue("branch-a", "user-token", access, mocks.onChange);
  await vi.advanceTimersByTimeAsync(0);
};

describe("mobile warehouse queue realtime", () => {
  it("listens for queued and updated pick lists using the user's token and business unit", async () => {
    await start();

    expect(mocks.getClient).toHaveBeenCalledWith(
      { url: "https://example.test", publishableKey: "public-key" },
      "user-token"
    );
    expect(mocks.on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "pick_lists",
        filter: "business_unit_id=eq.branch-a",
      },
      expect.any(Function)
    );
    mocks.event?.();
    await vi.advanceTimersByTimeAsync(150);
    expect(mocks.onChange).toHaveBeenCalledTimes(1);
    expect(mocks.onChange).toHaveBeenCalledWith(["picking"]);
  });

  it("coalesces an event burst into one refresh without delaying it indefinitely", async () => {
    await start();
    mocks.event?.();
    await vi.advanceTimersByTimeAsync(100);
    mocks.event?.();
    mocks.event?.();
    await vi.advanceTimersByTimeAsync(50);
    expect(mocks.onChange).toHaveBeenCalledTimes(1);
  });

  it("catches changes missed before subscribing and during disconnection", async () => {
    await start();
    mocks.status?.("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(150);
    mocks.status?.("CHANNEL_ERROR");
    mocks.status?.("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(150);
    expect(mocks.onChange).toHaveBeenCalledTimes(2);
  });

  it("removes the channel and cancels refreshes when the view stops watching", async () => {
    await start();
    mocks.event?.();
    unsubscribe?.();
    unsubscribe = undefined;
    mocks.event?.();
    mocks.status?.("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(150);
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
    expect(mocks.onChange).not.toHaveBeenCalled();
  });

  it("does not open a stale subscription if setup finishes after a scope change", async () => {
    let resolveConfig: ((config: { url: string; publishableKey: string }) => void) | undefined;
    mocks.getConfig.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveConfig = resolve;
      })
    );
    await start();
    unsubscribe?.();
    unsubscribe = undefined;
    resolveConfig?.({ url: "https://example.test", publishableKey: "public-key" });
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.channel).not.toHaveBeenCalled();
  });

  it("retries failed setup without polling queue data", async () => {
    mocks.getConfig.mockRejectedValueOnce(new Error("offline"));
    await start();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.getConfig).toHaveBeenCalledTimes(2);
    expect(mocks.channel).toHaveBeenCalledTimes(1);
    expect(mocks.onChange).not.toHaveBeenCalled();
  });

  it("cancels setup retries after leaving the view", async () => {
    mocks.getConfig.mockRejectedValueOnce(new Error("offline"));
    await start();
    unsubscribe?.();
    unsubscribe = undefined;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mocks.getConfig).toHaveBeenCalledTimes(1);
  });

  it("uses a new channel while the previous screen's channel is still leaving", async () => {
    mocks.removeChannel.mockReturnValueOnce(new Promise(() => undefined));
    await start();
    const firstTopic = mocks.channel.mock.calls[0]?.[0];
    unsubscribe?.();
    await start();
    expect(mocks.channel.mock.calls[1]?.[0]).not.toBe(firstTopic);
  });

  it("scopes load-list arrivals to their destination and GRN changes to the receiving branch", async () => {
    await start({ ...receivingAccess, deliveryNoteReceiving: false });
    expect(mocks.on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "load_lists",
        filter: "destination_business_unit_id=eq.branch-a",
      },
      expect.any(Function)
    );
    expect(mocks.on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "grns",
        filter: "business_unit_id=eq.branch-a",
      },
      expect.any(Function)
    );
    mocks.events.get("load_lists")?.();
    mocks.events.get("grns")?.();
    await vi.advanceTimersByTimeAsync(150);
    expect(mocks.onChange).toHaveBeenCalledExactlyOnceWith(["receiving"]);
    expect(mocks.events.has("delivery_notes")).toBe(false);
    expect(mocks.events.has("pick_lists")).toBe(false);
  });

  it("scopes incoming delivery notes to the requesting branch", async () => {
    await start({ ...receivingAccess, loadListReceiving: false });
    expect(mocks.on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "delivery_notes",
        filter: "requesting_business_unit_id=eq.branch-a",
      },
      expect.any(Function)
    );
    mocks.events.get("delivery_notes")?.();
    await vi.advanceTimersByTimeAsync(150);
    expect(mocks.onChange).toHaveBeenCalledExactlyOnceWith(["receiving"]);
    expect(mocks.events.has("load_lists")).toBe(false);
    expect(mocks.events.has("grns")).toBe(false);
  });

  it("refreshes Home's permitted queues in one batch when subscribing or reconnecting", async () => {
    await start({ ...receivingAccess, picking: true });
    expect(mocks.channel).toHaveBeenCalledTimes(1);
    mocks.status?.("SUBSCRIBED");
    mocks.events.get("load_lists")?.();
    await vi.advanceTimersByTimeAsync(150);
    expect(mocks.onChange).toHaveBeenCalledExactlyOnceWith(["picking", "receiving"]);
    mocks.status?.("CHANNEL_ERROR");
    mocks.status?.("SUBSCRIBED");
    await vi.advanceTimersByTimeAsync(150);
    expect(mocks.onChange).toHaveBeenCalledTimes(2);
    expect(mocks.onChange).toHaveBeenLastCalledWith(["picking", "receiving"]);
  });

  it("does not subscribe without a permitted queue", async () => {
    await start({ picking: false, loadListReceiving: false, deliveryNoteReceiving: false });
    expect(mocks.getConfig).not.toHaveBeenCalled();
    expect(mocks.channel).not.toHaveBeenCalled();
  });
});
