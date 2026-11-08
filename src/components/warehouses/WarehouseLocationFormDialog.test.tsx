import { isValidElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { WarehouseLocationFormDialog } from "./WarehouseLocationFormDialog";
const state = vi.hoisted(() => ({ submit: vi.fn() }));
vi.mock("react", async (load) => ({
  ...(await load<typeof import("react")>()),
  useState: (initial: unknown) => [initial, vi.fn()],
  useRef: () => ({ current: null }),
}));
vi.mock("./WarehouseLocationSelect", () => ({ WarehouseLocationSelect: () => null }));
vi.mock("./WarehouseLocationBrowseButton", () => ({ WarehouseLocationBrowseButton: () => null }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/hooks/useWarehouseLocationDetail", () => ({
  useWarehouseLocationDetail: () => ({ data: null }),
}));
function find(
  node: ReactNode,
  predicate: (props: Record<string, unknown>, type: unknown) => boolean
): Record<string, unknown> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = find(child, predicate);
      if (match) return match;
    }
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return;
  const props = node.props as Record<string, unknown>;
  return predicate(props, node.type) ? props : find(node.props.children, predicate);
}
beforeEach(() => {
  state.submit.mockReset();
  state.submit.mockResolvedValue(undefined);
});
it("shows a read-only generated code and submits a new location without a code", async () => {
  const tree = WarehouseLocationFormDialog({
    open: true,
    onOpenChange: vi.fn(),
    warehouseId: "warehouse",
    warehouseLabel: "Warehouse",
    location: null,
    defaultParent: { id: "parent", code: "Z01", name: "Zone 1", locationPath: "Z01 - Zone 1" },
    suggestedType: "rack",
    canSubmit: true,
    isSubmitting: false,
    onSubmit: state.submit,
  });
  const input = find(tree, (props) => props.id === "location-code");
  expect(input?.readOnly).toBe(true);
  expect(input?.value).toBe("");
  expect(input?.onChange).toBeUndefined();
  expect(input?.placeholder).toBe("codeGenerated");
  const form = find(tree, (_props, type) => type === "form");
  const submit = form?.onSubmit as (event: { preventDefault: () => void }) => Promise<void>;
  await submit({ preventDefault: vi.fn() });
  expect(state.submit).toHaveBeenCalledWith(
    expect.objectContaining({ locationType: "rack" }),
    "parent"
  );
  expect(state.submit.mock.calls[0][0]).not.toHaveProperty("code");
});

it("blocks a second submit while the first generated-code creation is pending", async () => {
  let finish: (() => void) | undefined;
  state.submit.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const tree = WarehouseLocationFormDialog({
    open: true,
    onOpenChange: vi.fn(),
    warehouseId: "warehouse",
    warehouseLabel: "Warehouse",
    location: null,
    defaultParent: null,
    suggestedType: "zone",
    canSubmit: true,
    isSubmitting: false,
    onSubmit: state.submit,
  });
  const form = find(tree, (_props, type) => type === "form");
  const submit = form?.onSubmit as (event: { preventDefault: () => void }) => void;
  submit({ preventDefault: vi.fn() });
  submit({ preventDefault: vi.fn() });
  expect(state.submit).toHaveBeenCalledTimes(1);
  finish?.();
  await Promise.resolve();
});
