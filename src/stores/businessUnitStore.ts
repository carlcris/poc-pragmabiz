/**
 * Business Unit Store
 *
 * Zustand store for managing business unit state
 * Persists current business unit selection to localStorage
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BusinessUnitWithAccess } from "@/types/business-unit";

type BusinessUnitStore = {
  // State
  currentBusinessUnit: BusinessUnitWithAccess | null;
  availableBusinessUnits: BusinessUnitWithAccess[];
  isLoading: boolean;
  isSwitching: boolean;
  hasHydrated: boolean;

  // Actions
  setCurrentBusinessUnit: (businessUnit: BusinessUnitWithAccess | null) => void;
  setAvailableBusinessUnits: (businessUnits: BusinessUnitWithAccess[]) => void;
  setLoading: (isLoading: boolean) => void;
  setSwitching: (isSwitching: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  clearBusinessUnit: () => void;

  // Computed
  hasMultipleBusinessUnits: () => boolean;
  getDefaultBusinessUnit: () => BusinessUnitWithAccess | null;
};

export const useBusinessUnitStore = create<BusinessUnitStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentBusinessUnit: null,
      availableBusinessUnits: [],
      isLoading: true, // Persisted selection is not ready until the provider verifies context.
      isSwitching: false,
      hasHydrated: false,

      // Actions
      setCurrentBusinessUnit: (businessUnit) => {
        set({ currentBusinessUnit: businessUnit });
      },

      setAvailableBusinessUnits: (businessUnits) => {
        set({ availableBusinessUnits: businessUnits });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      setSwitching: (isSwitching) => {
        set({ isSwitching });
      },

      setHasHydrated: (hasHydrated) => {
        set({ hasHydrated });
      },

      clearBusinessUnit: () => {
        set({
          currentBusinessUnit: null,
          availableBusinessUnits: [],
          isLoading: false,
          isSwitching: false,
          hasHydrated: true,
        });
      },

      // Computed
      hasMultipleBusinessUnits: () => {
        return get().availableBusinessUnits.length > 1;
      },

      getDefaultBusinessUnit: () => {
        const businessUnits = get().availableBusinessUnits;
        return businessUnits.find((bu) => bu.access.is_default) || null;
      },
    }),
    {
      name: "business-unit-storage",
      partialize: (state) => ({
        currentBusinessUnit: state.currentBusinessUnit,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
