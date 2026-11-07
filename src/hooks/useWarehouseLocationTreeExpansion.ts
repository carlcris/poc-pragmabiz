"use client";

import { useCallback, useState } from "react";

type TreeExpansionState = {
  isAllExpanded: boolean;
  // Branches toggled away from the default: collapsed ones in expand-all mode, else expanded ones.
  exceptionIds: ReadonlySet<string>;
};

export type WarehouseLocationTreeExpansion = {
  isExpanded: (locationId: string) => boolean;
  canExpandAll: boolean;
  canCollapseAll: boolean;
  toggle: (locationId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  expandPath: (locationIds: readonly string[]) => void;
};

const COLLAPSED: TreeExpansionState = { isAllExpanded: false, exceptionIds: new Set() };

/**
 * Expansion state for the lazily loaded location tree. Expand-all cannot list branch ids up
 * front because deeper levels load only when opened, so it flips the default instead: every
 * branch renders open and loads its own children page as it appears.
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

  return {
    isExpanded: (locationId) => state.isAllExpanded !== state.exceptionIds.has(locationId),
    canExpandAll: !state.isAllExpanded || state.exceptionIds.size > 0,
    canCollapseAll: state.isAllExpanded || state.exceptionIds.size > 0,
    toggle,
    expandAll,
    collapseAll,
    expandPath,
  };
}
