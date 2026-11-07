import { beforeEach, expect, it, vi } from "vitest";
import { useWarehouseLocationTreeExpansion } from "./useWarehouseLocationTreeExpansion";

const state = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock("react", async (load) => ({
  ...(await load<typeof import("react")>()),
  useCallback: <T>(callback: T) => callback,
  useState: (initial: unknown) => {
    if (state.value === undefined) state.value = initial;
    return [
      state.value,
      (next: unknown) => {
        state.value = typeof next === "function" ? next(state.value) : next;
      },
    ];
  },
}));

beforeEach(() => {
  state.value = undefined;
});

it("expands every branch, keeps manual toggles, and collapses back to none", () => {
  let tree = useWarehouseLocationTreeExpansion();
  expect(tree.isExpanded("rack")).toBe(false);
  expect(tree.canExpandAll).toBe(true);
  expect(tree.canCollapseAll).toBe(false);

  tree.expandAll();
  tree = useWarehouseLocationTreeExpansion();
  expect(tree.isExpanded("rack")).toBe(true);
  expect(tree.isExpanded("bin")).toBe(true);
  expect(tree.canExpandAll).toBe(false);
  expect(tree.canCollapseAll).toBe(true);

  tree.toggle("rack");
  tree = useWarehouseLocationTreeExpansion();
  expect(tree.isExpanded("rack")).toBe(false);
  expect(tree.isExpanded("bin")).toBe(true);
  expect(tree.canExpandAll).toBe(true);

  tree.expandPath(["rack"]);
  tree = useWarehouseLocationTreeExpansion();
  expect(tree.isExpanded("rack")).toBe(true);

  tree.collapseAll();
  tree = useWarehouseLocationTreeExpansion();
  expect(tree.isExpanded("rack")).toBe(false);
  expect(tree.canCollapseAll).toBe(false);
});

it("opens only the requested path while not in expand-all mode", () => {
  let tree = useWarehouseLocationTreeExpansion();
  tree.expandPath(["zone", "rack"]);
  tree = useWarehouseLocationTreeExpansion();
  expect(tree.isExpanded("zone")).toBe(true);
  expect(tree.isExpanded("rack")).toBe(true);
  expect(tree.isExpanded("bin")).toBe(false);

  tree.toggle("zone");
  tree = useWarehouseLocationTreeExpansion();
  expect(tree.isExpanded("zone")).toBe(false);
  expect(tree.canCollapseAll).toBe(true);
});
