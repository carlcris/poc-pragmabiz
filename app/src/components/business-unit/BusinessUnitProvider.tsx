'use client';

/**
 * Business Unit Provider Component
 *
 * Initializes business unit context for the application
 * Loads available business units and sets default if none selected
 */

import { useEffect } from 'react';
import { useBusinessUnits, useSetBusinessUnitContext } from '@/hooks/useBusinessUnits';
import { useBusinessUnitStore } from '@/stores/businessUnitStore';
import { Loader2 } from 'lucide-react';

type BusinessUnitProviderProps = {
  children: React.ReactNode;
};

export const BusinessUnitProvider = ({
  children,
}: BusinessUnitProviderProps) => {
  const { data: businessUnits, isLoading, error } = useBusinessUnits();
  const { currentBusinessUnit, setAvailableBusinessUnits } =
    useBusinessUnitStore();
  const { mutate: setContext } = useSetBusinessUnitContext();

  // Initialize business unit when data is loaded
  useEffect(() => {
    if (!isLoading && businessUnits && businessUnits.length > 0) {
      setAvailableBusinessUnits(businessUnits);

      // Auto-select default BU if none is currently selected
      if (!currentBusinessUnit) {
        const defaultBU = businessUnits.find((bu) => bu.access.is_default);
        if (defaultBU) {
          // Set context via API to validate and update server-side context
          setContext(defaultBU.id);
        } else {
          // If no default, select the first available
          setContext(businessUnits[0].id);
        }
      }
    }
  }, [businessUnits, isLoading, currentBusinessUnit, setAvailableBusinessUnits, setContext]);

  // Show loading state while initializing
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading business units...
          </p>
        </div>
      </div>
    );
  }

  // Log error but don't block the app
  if (error) {
    console.error('Error loading business units:', error);
    // For now, allow the app to continue even if BU loading fails
    // This prevents complete app failure during development
  }

  // Warn if no business units but don't block
  if (!isLoading && (!businessUnits || businessUnits.length === 0)) {
    console.warn('No business units available for user');
    // For now, allow the app to continue
    // In production, you might want to show an error or redirect
  }

  return <>{children}</>;
};
