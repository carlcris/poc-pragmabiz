import { describe, expect, it, vi } from "vitest";
import {
  flattenLocationTree,
  loadLocationTree,
  locationTreeWindow,
  LOCATION_TREE_VIEWPORT_HEIGHT,
  type LocationTreeNode,
  type LocationTreePage,
} from "./warehouse-location-tree";

const node = (id: string, parentId: string | null = null): LocationTreeNode => ({
  id,
  parentId,
  code: id,
  name: id,
  locationType: "bin",
  isActive: true,
  isDefault: false,
  hasChildren: false,
  onHand: null,
  available: null,
  directOnHand: null,
  directAvailable: null,
});
const page = (data: LocationTreeNode[], current: number, total: number): LocationTreePage => ({
  data,
  pagination: { page: current, limit: 500, total, totalPages: Math.ceil(total / 500) },
});

describe("batched expansion", () => {
  it("loads all 8,420 locations in 17 requests, including siblings past the old 50-row boundary", async () => {
    const nodes = Array.from({ length: 8420 }, (_, index) => node(String(index)));
    const fetchPage = vi.fn(async (current: number) =>
      page(nodes.slice((current - 1) * 500, current * 500), current, nodes.length)
    );
    const progress = vi.fn();
    expect(await loadLocationTree(fetchPage, new AbortController().signal, progress)).toEqual(
      nodes
    );
    expect(fetchPage).toHaveBeenCalledTimes(17);
    expect(progress).toHaveBeenLastCalledWith(8420, 8420);
  });
  it("serializes page requests even across multiple warehouse trees", async () => {
    let active = 0;
    let maximum = 0;
    const fetchPage = async (current: number) => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return page([node(String(current))], current, 1000);
    };
    await Promise.all(
      Array.from({ length: 20 }, () =>
        loadLocationTree(fetchPage, new AbortController().signal, () => undefined)
      )
    );
    expect(maximum).toBe(1);
  });
  it("stops before the next page after Collapse All or warehouse unmount", async () => {
    const controller = new AbortController();
    const fetchPage = vi.fn(async (current: number) => page([node("first")], current, 1000));
    await expect(
      loadLocationTree(fetchPage, controller.signal, () => controller.abort())
    ).rejects.toThrow();
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
  it("propagates the signal to the active request and does not continue after failure", async () => {
    const controller = new AbortController();
    const fetchPage = vi.fn(
      async (_page: number, signal: AbortSignal): Promise<LocationTreePage> => {
        expect(signal).toBe(controller.signal);
        throw new Error("unavailable");
      }
    );
    await expect(loadLocationTree(fetchPage, controller.signal, () => undefined)).rejects.toThrow(
      "unavailable"
    );
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});

it("flattens server sibling order, preserves direct stock, and respects collapsed/disabled branches", () => {
  const root = { ...node("root"), hasChildren: true, directOnHand: 2, directAvailable: 1 };
  const nodes = [node("bin", "root"), root, node("other")];
  expect(
    flattenLocationTree(nodes, () => true).map((row) => [row.node.id, row.level, row.direct])
  ).toEqual([
    ["root", 1, false],
    ["root", 2, true],
    ["bin", 2, false],
    ["other", 1, false],
  ]);
  expect(flattenLocationTree(nodes, () => false)).toHaveLength(2);
  expect(flattenLocationTree(nodes, () => true, "root")).toHaveLength(2);
});

it("keeps the render window bounded at the start, middle, and end of a large tree", () => {
  for (const top of [0, 200000, 8420 * 44]) {
    const range = locationTreeWindow(8420, top, LOCATION_TREE_VIEWPORT_HEIGHT);
    expect(range.end - range.start).toBeLessThanOrEqual(17);
    expect(range.start).toBeGreaterThanOrEqual(0);
    expect(range.end).toBeLessThanOrEqual(8420);
  }
  expect(locationTreeWindow(0, 0, LOCATION_TREE_VIEWPORT_HEIGHT)).toEqual({ start: 0, end: 0 });
});

it("aborts the in-flight page when the expanded tree observer unmounts", async () => {
  const { QueryClient, QueryObserver } = await import("@tanstack/react-query");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let began: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    began = resolve;
  });
  let requestSignal: AbortSignal | undefined;
  const fetchPage = vi.fn((_current: number, signal: AbortSignal) => {
    requestSignal = signal;
    began();
    return new Promise<LocationTreePage>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  });
  const observer = new QueryObserver(client, {
    queryKey: ["warehouse-locations", "warehouse", "hierarchy"],
    queryFn: ({ signal }) => loadLocationTree(fetchPage, signal, () => undefined),
  });
  const unsubscribe = observer.subscribe(() => undefined);
  await started;
  unsubscribe();
  expect(requestSignal?.aborted).toBe(true);
  expect(fetchPage).toHaveBeenCalledTimes(1);
  client.clear();
});
