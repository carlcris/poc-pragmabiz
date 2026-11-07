import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExpandedLocationTree } from "./ExpandedLocationTree";
import type { LocationTreeNode } from "@/lib/warehouse-location-tree";
const state = vi.hoisted(() => ({
  data: undefined as LocationTreeNode[] | undefined,
  error: null as Error | null,
}));
vi.mock("@/hooks/useWarehouseLocationHierarchy", () => ({
  useWarehouseLocationHierarchy: () => ({
    ...state,
    progress: { loaded: 500, total: 8420 },
    refetch: vi.fn(),
  }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, args?: Record<string, unknown>) =>
    args ? `${key}:${JSON.stringify(args)}` : key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
}));
const expansion = {
  isAllExpanded: true,
  isExpanded: () => true,
  canExpandAll: false,
  canCollapseAll: true,
  toggle: vi.fn(),
  expandAll: vi.fn(),
  collapseAll: vi.fn(),
  expandPath: vi.fn(),
};
const render = () =>
  renderToStaticMarkup(
    <ExpandedLocationTree
      warehouseId="warehouse"
      itemId="item"
      label="Stock tree"
      selectedId={null}
      expansion={expansion}
      onSelect={vi.fn()}
    />
  );
beforeEach(() => {
  state.error = null;
  state.data = undefined;
});
it("renders at most 17 rows for 8,420 expanded nodes with an accessible tree tab stop", () => {
  state.data = Array.from({ length: 8420 }, (_, index) => ({
    id: String(index),
    parentId: null,
    code: String(index),
    name: `Location ${index}`,
    locationType: "bin",
    isActive: true,
    isDefault: index === 0,
    hasChildren: false,
    onHand: 7,
    available: 5,
    directOnHand: 7,
    directAvailable: 5,
  }));
  const html = render();
  expect(html.match(/role="treeitem"/g)).toHaveLength(17);
  expect(html).toContain('role="tree"');
  expect(html).toContain('tabindex="0"');
  expect(html).toContain('aria-activedescendant="expanded-item-warehouse-0"');
  expect(html).toContain("preferredBadge");
  expect(html).not.toContain("Location 500");
});
it("shows translated loading progress without mounting per-parent queries", () => {
  const html = render();
  expect(html).toContain("treeLoadingProgress");
  expect(html).toContain("8420");
  expect(html).not.toContain('role="treeitem"');
});
it("offers retry after a failed batch instead of presenting a partial hierarchy as complete", () => {
  state.error = new Error("offline");
  const html = render();
  expect(html).toContain("treeLoadError");
  expect(html).toContain("treeRetry");
});
