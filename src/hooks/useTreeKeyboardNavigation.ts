"use client";

import { type KeyboardEvent, useRef, useState } from "react";

type TreeKeyboardNavigationOptions = {
  onToggle: (id: string) => void;
  onActivate: (id: string) => void;
};

/**
 * WAI-ARIA tree keyboard model over rendered `[role=treeitem]` elements. Items carry
 * `data-tree-id`, `data-tree-parent`, and optionally `data-tree-expandable` and
 * `data-tree-expanded`. Collapsed groups are not rendered, so document order is visible order.
 */
export function useTreeKeyboardNavigation<T extends HTMLElement>({
  onToggle,
  onActivate,
}: TreeKeyboardNavigationOptions) {
  const treeRef = useRef<T>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const focusItem = (item: HTMLElement | undefined) => {
    if (!item?.dataset.treeId) return;
    setFocusedId(item.dataset.treeId);
    item.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<T>) => {
    const items = Array.from(
      treeRef.current?.querySelectorAll<HTMLElement>("[role=treeitem]") ?? []
    );
    const current = (event.target as HTMLElement).closest<HTMLElement>("[role=treeitem]");
    const id = current?.dataset.treeId;
    if (!current || !id) return;
    const index = items.indexOf(current);
    const isExpandable = Boolean(current.dataset.treeExpandable);
    const isExpanded = Boolean(current.dataset.treeExpanded);

    switch (event.key) {
      case "ArrowDown":
        focusItem(items[index + 1]);
        break;
      case "ArrowUp":
        focusItem(items[index - 1]);
        break;
      case "Home":
        focusItem(items[0]);
        break;
      case "End":
        focusItem(items.at(-1));
        break;
      case "ArrowRight":
        if (isExpandable && !isExpanded) onToggle(id);
        else if (isExpanded) focusItem(items[index + 1]);
        break;
      case "ArrowLeft":
        if (isExpandable && isExpanded) onToggle(id);
        else focusItem(items.find((item) => item.dataset.treeId === current.dataset.treeParent));
        break;
      case "Enter":
      case " ":
        if (current.getAttribute("aria-disabled") !== "true") onActivate(id);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return { treeRef, focusedId, handleKeyDown };
}
