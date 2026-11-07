import { afterEach, expect, it, vi } from "vitest";
import { observeLocationTreeLayout } from "./warehouse-location-tree-layout";
import { locationTreeWindow } from "./warehouse-location-tree";

type LayoutNode = {
  parentElement: LayoutNode | null;
  previousElementSibling: LayoutNode | null;
};
const element = (
  parentElement: LayoutNode | null,
  previousElementSibling: LayoutNode | null = null
): LayoutNode => ({ parentElement, previousElementSibling });
const asElement = (node: LayoutNode) => node as unknown as HTMLElement;

function observers() {
  const resized = new Set<Element>();
  const mutated = new Set<Node>();
  let onResize: () => void = () => undefined;
  let onMutation: () => void = () => undefined;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        onResize = callback;
      }
      observe(target: Element) {
        resized.add(target);
      }
      disconnect() {
        resized.clear();
      }
    }
  );
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: () => void) {
        onMutation = callback;
      }
      observe(target: Node) {
        mutated.add(target);
      }
      disconnect() {
        mutated.clear();
      }
    }
  );
  return {
    resized,
    mutated,
    resize: (target: LayoutNode) => {
      if (resized.has(asElement(target))) onResize();
    },
    mutate: (target: LayoutNode) => {
      if (mutated.has(asElement(target))) onMutation();
    },
  };
}
afterEach(() => vi.unstubAllGlobals());

it("refreshes a later tree's visible rows when an earlier warehouse collapses without resizing the tree or viewport", () => {
  const observer = observers();
  const viewport = element(null);
  const content = element(viewport);
  const firstWarehouse = element(content);
  const secondWarehouse = element(content, firstWarehouse);
  const tree = element(secondWarehouse);
  let treeTop = 1200;
  let range = locationTreeWindow(100, 0, 0);
  const measure = vi.fn(() => {
    range = locationTreeWindow(100, Math.max(0, -treeTop), Math.max(0, 800 - Math.max(0, treeTop)));
  });
  const stop = observeLocationTreeLayout(asElement(tree), asElement(viewport), measure);
  treeTop = 100;
  observer.resize(firstWarehouse);
  expect(measure).toHaveBeenCalledTimes(1);
  expect(range).toEqual({ start: 0, end: 24 });
  // Expanding the preceding section moves the tree out of view again.
  treeTop = 1200;
  observer.resize(firstWarehouse);
  expect(range.end).toBe(8);
  stop();
  expect(observer.resized.size).toBe(0);
  expect(observer.mutated.size).toBe(0);
});

it("tracks inserted preceding sections and handles removal even when the content height stays fixed", () => {
  const observer = observers();
  const viewport = element(null);
  const content = element(viewport);
  const section = element(content);
  const tree = element(section);
  const measure = vi.fn();
  const stop = observeLocationTreeLayout(asElement(tree), asElement(viewport), measure);
  const inserted = element(content);
  section.previousElementSibling = inserted;
  observer.mutate(content);
  expect(observer.resized.has(asElement(inserted))).toBe(true);
  observer.resize(inserted);
  expect(measure).toHaveBeenCalledTimes(2);
  section.previousElementSibling = null;
  observer.mutate(content);
  expect(observer.resized.has(asElement(inserted))).toBe(false);
  expect(measure).toHaveBeenCalledTimes(3);
  stop();
});

it("observes document-flow ancestors for window scrolling but never subscribes to virtual row changes", () => {
  const observer = observers();
  const body = element(null);
  const header = element(body);
  const content = element(body, header);
  const tree = element(content);
  const measure = vi.fn();
  const stop = observeLocationTreeLayout(asElement(tree), null, measure);
  observer.resize(header);
  expect(measure).toHaveBeenCalledTimes(1);
  expect(observer.mutated.has(asElement(tree))).toBe(false);
  expect(observer.resized.has(asElement(body))).toBe(true);
  stop();
});
