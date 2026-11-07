/**
 * A tree can move without resizing when a preceding section collapses. Observe its
 * ancestors and their preceding siblings, not the virtual rows inside the tree.
 * Child-list observation keeps the resize targets current as sections mount/unmount.
 */
export function observeLocationTreeLayout(
  tree: HTMLElement,
  container: HTMLElement | null,
  measure: () => void
): () => void {
  const resizeObserver = new ResizeObserver(measure);
  const mutationObserver = new MutationObserver(() => {
    observeLayout();
    measure();
  });
  const observeLayout = () => {
    resizeObserver.disconnect();
    mutationObserver.disconnect();
    resizeObserver.observe(tree);
    for (let node: HTMLElement | null = tree; node; node = node.parentElement) {
      if (node === container) break;
      for (
        let sibling = node.previousElementSibling;
        sibling;
        sibling = sibling.previousElementSibling
      ) {
        resizeObserver.observe(sibling);
      }
      const parent = node.parentElement;
      if (parent) {
        resizeObserver.observe(parent);
        mutationObserver.observe(parent, { childList: true });
      }
    }
  };
  observeLayout();
  return () => {
    resizeObserver.disconnect();
    mutationObserver.disconnect();
  };
}
