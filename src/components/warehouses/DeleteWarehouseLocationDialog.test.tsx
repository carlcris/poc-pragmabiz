import { isValidElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { DeleteWarehouseLocationDialog } from "./DeleteWarehouseLocationDialog";
const state = vi.hoisted(() => ({ error: null as string | null, setError: vi.fn() }));
vi.mock("react", async (load) => ({
  ...(await load<typeof import("react")>()),
  useState: () => [state.error, state.setError],
  useRef: () => ({ current: false }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
function find(
  node: ReactNode,
  predicate: (props: Record<string, unknown>) => boolean
): Record<string, unknown> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = find(child, predicate);
      if (match) return match;
    }
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return;
  const props = node.props as Record<string, unknown>;
  return predicate(props) ? props : find(node.props.children, predicate);
}
beforeEach(() => {
  vi.clearAllMocks();
  state.error = null;
});
it.each([
  ["LOCATION_IN_USE", "deleteLocationInUse"],
  ["LOCATION_IS_PREFERRED", "locationIsPreferred"],
])("keeps %s open with translated guidance", async (code, key) => {
  const onClose = vi.fn();
  const props = {
    location: { code: "B01" },
    isPending: false,
    onClose,
    onDelete: vi.fn().mockRejectedValue(new Error("private", { cause: { code } })),
  };
  const tree = DeleteWarehouseLocationDialog(props);
  const submit = find(tree, (p) => p.variant === "destructive")?.onClick as () => Promise<void>;
  await submit();
  expect(onClose).not.toHaveBeenCalled();
  expect(state.setError).toHaveBeenLastCalledWith(key);
  state.error = key;
  expect(find(DeleteWarehouseLocationDialog(props), (p) => p.role === "alert")?.children).toBe(key);
});
it("prevents duplicate submissions and disables actions while pending", async () => {
  let finish: (() => void) | undefined;
  const onDelete = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const props = { location: { code: "B01" }, isPending: false, onClose: vi.fn(), onDelete };
  const tree = DeleteWarehouseLocationDialog(props);
  const submit = find(tree, (p) => p.variant === "destructive")?.onClick as () => Promise<void>;
  const first = submit();
  await submit();
  expect(onDelete).toHaveBeenCalledTimes(1);
  finish?.();
  await first;
  const pending = DeleteWarehouseLocationDialog({ ...props, isPending: true });
  expect(find(pending, (p) => p.variant === "destructive")?.disabled).toBe(true);
  expect(find(pending, (p) => p.variant === "outline")?.disabled).toBe(true);
});
