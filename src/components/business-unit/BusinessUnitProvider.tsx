"use client";

/**
 * Business Unit Provider Component
 *
 * Initializes business unit context for the application
 * Loads available business units and sets default if none selected
 */

import { useEffect, useRef } from "react";
import { useBusinessUnits, useSetBusinessUnitContext } from "@/hooks/useBusinessUnits";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";

type BusinessUnitProviderProps = {
  children: React.ReactNode;
};

export const BusinessUnitProvider = ({ children }: BusinessUnitProviderProps) => {
  const { data: businessUnits, isLoading, error } = useBusinessUnits();
  const { currentBusinessUnit, setAvailableBusinessUnits, setCurrentBusinessUnit, setLoading } =
    useBusinessUnitStore();
  const { mutate: setContext } = useSetBusinessUnitContext({ silent: true });
  const hasInitialized = useRef(false);

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading, setLoading]);

  // Initialize business unit when data is loaded
  useEffect(() => {
    if (!isLoading && businessUnits && businessUnits.length > 0 && !hasInitialized.current) {
      setAvailableBusinessUnits(businessUnits);

      // Check if current BU is valid for this user
      const isCurrentBUValid =
        currentBusinessUnit && businessUnits.some((bu) => bu.id === currentBusinessUnit.id);

      // Auto-select default BU if none is selected OR if current BU is invalid
      if (!currentBusinessUnit || !isCurrentBUValid) {
        if (!isCurrentBUValid && currentBusinessUnit) {
        }

        const defaultBU = businessUnits.find((bu) => bu.access.is_default);
        const targetBU = defaultBU || businessUnits[0];

        // Update store directly to avoid triggering query invalidation
        // This prevents the flickering on initial load
        setCurrentBusinessUnit(targetBU);

        // Mark as initialized to prevent re-running this logic
        hasInitialized.current = true;

        // Update server-side context in background (without clearing queries)
        // We'll modify setContext to not clear queries on silent updates
        setContext(targetBU.id);
      } else {
        // Current BU is valid, just mark as initialized
        hasInitialized.current = true;
      }
    }
  }, [
    businessUnits,
    isLoading,
    currentBusinessUnit,
    setAvailableBusinessUnits,
    setCurrentBusinessUnit,
    setContext,
  ]);

  // Log error but don't block the app
  if (error) {
    // For now, allow the app to continue even if BU loading fails
    // This prevents complete app failure during development
  }

  // Warn if no business units but don't block
  if (!isLoading && (!businessUnits || businessUnits.length === 0)) {
    // For now, allow the app to continue
    // In production, you might want to show an error or redirect
  }

  return <>{children}</>;
};
