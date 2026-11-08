"use client";

/**
 * Business Unit Provider Component
 *
 * Initializes business unit context for the application
 * Loads available business units and sets default if none selected
 */

import type { BusinessUnitWithAccess } from "@/types/business-unit";
import { useEffect, useRef } from "react";
import { useBusinessUnits, useSetBusinessUnitContext } from "@/hooks/useBusinessUnits";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { useAuthStore } from "@/stores/authStore";

type BusinessUnitProviderProps = {
  children: React.ReactNode;
  initialUserId?: string;
  initialBusinessUnit?: BusinessUnitWithAccess | null;
  initialBusinessUnitId?: string | null;
  sessionBusinessUnitId?: string | null;
};

export const BusinessUnitProvider = ({
  children,
  initialUserId,
  initialBusinessUnit,
  initialBusinessUnitId,
  sessionBusinessUnitId,
}: BusinessUnitProviderProps) => {
  const userId = useAuthStore((state) => state.user?.id);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoggingOut = useAuthStore((state) => state.isLoggingOut);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const { data: businessUnits, isLoading } = useBusinessUnits();
  const { currentBusinessUnit, setAvailableBusinessUnits, setCurrentBusinessUnit, setLoading } =
    useBusinessUnitStore();
  const { mutate: setContext } = useSetBusinessUnitContext({ silent: true });
  const hasInitialized = useRef(false);
  const hasCheckedAuth = useRef(false);
  const hasHydratedBusinessUnit = useRef(false);

  const hasVerifiedInitialContext = Boolean(
    initialUserId &&
    initialUserId === userId &&
    initialBusinessUnit?.is_active &&
    initialBusinessUnit.id === initialBusinessUnitId &&
    initialBusinessUnitId === sessionBusinessUnitId
  );

  useEffect(() => {
    if (!isAuthenticated || isLoggingOut || hasHydratedBusinessUnit.current) return;
    if (initialUserId && initialUserId !== userId) return;
    hasHydratedBusinessUnit.current = true;
    if (initialBusinessUnit) setCurrentBusinessUnit(initialBusinessUnit);
    // The server already checked this active membership and its JWT scope. Loading
    // the switcher's remaining options must not hold up the page or reselect a BU.
    if (hasVerifiedInitialContext) hasInitialized.current = true;
  }, [
    isAuthenticated,
    isLoggingOut,
    initialBusinessUnit,
    initialUserId,
    userId,
    hasVerifiedInitialContext,
    setCurrentBusinessUnit,
  ]);

  useEffect(() => {
    if (initialUserId || isAuthenticated || isLoggingOut || hasCheckedAuth.current) return;
    hasCheckedAuth.current = true;
    void checkAuth();
  }, [checkAuth, initialUserId, isAuthenticated, isLoggingOut]);

  useEffect(() => {
    setLoading(isAuthLoading || (isLoading && !hasVerifiedInitialContext));
  }, [isAuthLoading, isLoading, hasVerifiedInitialContext, setLoading]);

  // Initialize business unit when data is loaded
  useEffect(() => {
    if (!isAuthenticated || isLoggingOut) return;
    if (!isLoading && businessUnits && businessUnits.length > 0) {
      setAvailableBusinessUnits(businessUnits);
      if (hasInitialized.current) return;

      // The server selection takes precedence over persisted browser state at login.
      const selectedId = initialBusinessUnitId ?? currentBusinessUnit?.id;
      const targetBU =
        businessUnits.find((unit) => unit.id === selectedId) ||
        businessUnits.find((unit) => unit.access.is_default) ||
        businessUnits[0];
      setCurrentBusinessUnit(targetBU);
      hasInitialized.current = true;

      // A DB-resolved fallback is not proof that the JWT already carries this context.
      if (targetBU.id !== sessionBusinessUnitId) {
        setContext(targetBU.id);
      }
    }
  }, [
    isAuthenticated,
    isLoggingOut,
    businessUnits,
    isLoading,
    currentBusinessUnit,
    initialBusinessUnitId,
    sessionBusinessUnitId,
    setAvailableBusinessUnits,
    setCurrentBusinessUnit,
    setContext,
  ]);

  return <>{children}</>;
};
