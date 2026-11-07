"use client";

import { useCallback, useState } from "react";

type TreeExpansionState = {
  isAllExpanded: boolean;
  // Branches toggled away from the default: collapsed ones in expand-all mode, else expanded ones.
  exceptionIds: ReadonlySet<string>;
};

export type WarehouseLocationTreeExpansion = {
  isExpanded: (locationId: string) => boolean;
  isAllExpanded: boolean;
  canExpandAll: boolean;
  canCollapseAll: boolean;
  toggle: (locationId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  expandPath: (locationIds: readonly string[]) => void;
};

const COLLAPSED: TreeExpansionState = { isAllExpanded: false, exceptionIds: new Set() };

/**
 * Individual branches load lazily; expand-all switches consumers to the batched hierarchy.
 * Exceptions retain manual collapse/expand choices without enumerating every branch.
 */
export function useWarehouseLocationTreeExpansion(): WarehouseLocationTreeExpansion {
  const [state, setState] = useState<TreeExpansionState>(COLLAPSED);

  const toggle = useCallback((locationId: string) => {
    setState((current) => {
      const exceptionIds = new Set(current.exceptionIds);
      if (exceptionIds.has(locationId)) exceptionIds.delete(locationId);
      else exceptionIds.add(locationId);
      return { ...current, exceptionIds };
    });
  }, []);

  const expandPath = useCallback((locationIds: readonly string[]) => {
    setState((current) => {
      const exceptionIds = new Set(current.exceptionIds);
      for (const locationId of locationIds) {
        if (current.isAllExpanded) exceptionIds.delete(locationId);
        else exceptionIds.add(locationId);
      }
      return { ...current, exceptionIds };
    });
  }, []);

  const expandAll = useCallback(() => {
    setState({ isAllExpanded: true, exceptionIds: new Set() });
  }, []);

  const collapseAll = useCallback(() => setState(COLLAPSED), []);

  const isExpanded = useCallback(
    (locationId: string) => state.isAllExpanded !== state.exceptionIds.has(locationId),
    [state]
  );

  return {
    isAllExpanded: state.isAllExpanded,
    isExpanded,
    canExpandAll: !state.isAllExpanded || state.exceptionIds.size > 0,
    canCollapseAll: state.isAllExpanded || state.exceptionIds.size > 0,
    toggle,
    expandAll,
    collapseAll,
    expandPath,
  };
}
