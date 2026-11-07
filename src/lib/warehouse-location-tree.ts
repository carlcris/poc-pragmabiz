import type { ItemStockPagination } from "@/types/inventory-location";

export type LocationTreeNode = {
  id: string;
  parentId: string | null;
  code: string;
  name: string | null;
  locationType: string;
  isActive: boolean;
  isDefault: boolean;
  hasChildren: boolean;
  onHand: number | null;
  available: number | null;
  directOnHand: number | null;
  directAvailable: number | null;
};
export type LocationTreePage = { data: LocationTreeNode[]; pagination: ItemStockPagination };
export type LocationTreeRow = { node: LocationTreeNode; level: number; direct: boolean };

// Server ordering is retained within each sibling group. Build once per data/expansion change.
export function flattenLocationTree(
  nodes: readonly LocationTreeNode[],
  isExpanded: (id: string) => boolean,
  disabledId?: string
): LocationTreeRow[] {
  const children = new Map<string | null, LocationTreeNode[]>();
  for (const node of nodes) {
    const group = children.get(node.parentId) ?? [];
    group.push(node);
    children.set(node.parentId, group);
  }
  const rows: LocationTreeRow[] = [];
  const stack = (children.get(null) ?? [])
    .map((node) => ({ node, level: 1, direct: false }))
    .reverse();
  while (stack.length) {
    const row = stack.pop()!;
    rows.push(row);
    if (row.direct || row.node.id === disabledId || !isExpanded(row.node.id)) continue;
    const descendants = children.get(row.node.id) ?? [];
    for (let index = descendants.length - 1; index >= 0; index--) {
      stack.push({ node: descendants[index], level: row.level + 1, direct: false });
    }
    if (row.node.hasChildren && (row.node.directOnHand ?? 0) > 0) {
      stack.push({ node: row.node, level: row.level + 1, direct: true });
    }
  }
  return rows;
}

// Across all mounted warehouse sections, allow only one hierarchy page request at a time.
let pageQueue: Promise<unknown> = Promise.resolve();
export function queueLocationTreePage<T>(
  signal: AbortSignal,
  fetchPage: () => Promise<T>
): Promise<T> {
  const result = pageQueue.then(() => {
    signal.throwIfAborted();
    return fetchPage();
  });
  pageQueue = result.catch(() => undefined);
  return result;
}

export async function loadLocationTree(
  fetchPage: (page: number, signal: AbortSignal) => Promise<LocationTreePage>,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void
): Promise<LocationTreeNode[]> {
  const nodes: LocationTreeNode[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await queueLocationTreePage(signal, () => fetchPage(page, signal));
    signal.throwIfAborted();
    nodes.push(...response.data);
    onProgress(nodes.length, response.pagination.total);
    totalPages = response.pagination.totalPages;
    page++;
  } while (page <= totalPages);
  return nodes;
}

export const LOCATION_TREE_ROW_HEIGHT = 44;
// Visible height assumed before the scroll container is measured (and during SSR).
export const LOCATION_TREE_VIEWPORT_HEIGHT = 384;
export function locationTreeWindow(length: number, scrollTop: number, viewportHeight: number) {
  const start = Math.max(
    0,
    Math.min(Math.floor(scrollTop / LOCATION_TREE_ROW_HEIGHT) - 4, Math.max(0, length - 1))
  );
  return {
    start,
    end: Math.min(length, start + Math.ceil(viewportHeight / LOCATION_TREE_ROW_HEIGHT) + 8),
  };
}
