"use client";

/**
 * Business Unit Switcher Component
 *
 * Dropdown component for switching between business units
 * Displays available business units and allows user to switch context
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, Building2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import { useSetBusinessUnitContext } from "@/hooks/useBusinessUnits";
import type { BusinessUnitWithAccess } from "@/types/business-unit";
import { toProperCase } from "@/lib/string";
import { apiClient } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { WAREHOUSE_DASHBOARD_QUERY_KEY, PICK_LISTS_QUERY_KEY } from "@/hooks/queryKeys";

type BusinessUnitSwitcherProps = {
  initialBusinessUnitName?: string | null;
  variant?: "default" | "tablet";
};

export const BusinessUnitSwitcher = ({
  initialBusinessUnitName = null,
  variant = "default",
}: BusinessUnitSwitcherProps) => {
  const [open, setOpen] = useState(false);
  const tabletDropdownRef = useRef<HTMLDivElement | null>(null);
  const [fallbackBusinessUnits, setFallbackBusinessUnits] = useState<BusinessUnitWithAccess[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const {
    currentBusinessUnit,
    availableBusinessUnits,
    hasHydrated,
    isLoading,
    setAvailableBusinessUnits,
  } = useBusinessUnitStore();
  const queryClient = useQueryClient();
  const { mutate: setContext, isPending } = useSetBusinessUnitContext({
    silent: variant === "tablet",
  });
  const isInitializing = !hasHydrated || (isLoading && !currentBusinessUnit);
  const effectiveBusinessUnits =
    availableBusinessUnits.length > 0 ? availableBusinessUnits : fallbackBusinessUnits;
  const displayBusinessUnitName =
    currentBusinessUnit?.name ||
    initialBusinessUnitName ||
    null;

  useEffect(() => {
    let active = true;

    const bootstrapBusinessUnits = async () => {
      if (availableBusinessUnits.length > 0 || isBootstrapping) return;
      try {
        setIsBootstrapping(true);
        setBootstrapError(null);
        const response = await apiClient.get<{ data: BusinessUnitWithAccess[] }>("/api/business-units");
        const rows = Array.isArray(response?.data) ? response.data : [];
        if (!active) return;
        setFallbackBusinessUnits(rows);
        if (rows.length > 0) {
          setAvailableBusinessUnits(rows);
        }
      } catch {
        if (!active) return;
        setBootstrapError("Failed to load business units");
      } finally {
        if (active) setIsBootstrapping(false);
      }
    };

    void bootstrapBusinessUnits();
    return () => {
      active = false;
    };
  }, [availableBusinessUnits.length, setAvailableBusinessUnits]);

  // Sort business units: default first, then alphabetically by name
  const sortedBusinessUnits = useMemo(() => {
    return [...effectiveBusinessUnits].sort((a, b) => {
      // Default BU always comes first
      if (a.access.is_default && !b.access.is_default) return -1;
      if (!a.access.is_default && b.access.is_default) return 1;
      // Then sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }, [effectiveBusinessUnits]);

  const handleSelect = (businessUnit: BusinessUnitWithAccess) => {
    if (businessUnit.id === currentBusinessUnit?.id) {
      setOpen(false);
      return;
    }

    setContext(businessUnit.id, {
      onSuccess: () => {
        setOpen(false);
        if (variant === "tablet") {
          void queryClient.invalidateQueries({ queryKey: [WAREHOUSE_DASHBOARD_QUERY_KEY] });
          void queryClient.invalidateQueries({ queryKey: ["loadLists"] });
          void queryClient.invalidateQueries({ queryKey: [PICK_LISTS_QUERY_KEY] });
          return;
        }
        // Cache is cleared and queries will refetch with new BU context from JWT
        // Page will show loading states while new data is fetched
      },
    });
  };

  useEffect(() => {
    if (!(variant === "tablet" && open)) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!tabletDropdownRef.current || !target) return;
      if (!tabletDropdownRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open, variant]);

  // If only one business unit, show it but make it non-interactive
  if (effectiveBusinessUnits.length <= 1 && variant !== "tablet") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
        <Building2 className="h-4 w-4 shrink-0 text-white/70" />
        <span className="truncate text-sm text-white/90">
          {displayBusinessUnitName ||
            (isInitializing || isBootstrapping ? "Business unit" : "No business unit")}
        </span>
      </div>
    );
  }

  const isTablet = variant === "tablet";

  if (isTablet) {
    return (
      <div className="relative" ref={tabletDropdownRef}>
        <Button
          type="button"
          variant="outline"
          aria-expanded={open}
          aria-label="Select business unit"
          onClick={() => setOpen((prev) => !prev)}
          className="h-11 w-full justify-between border-gray-200 bg-white text-gray-900 shadow-sm hover:bg-gray-50"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-medium">
              {displayBusinessUnitName || (isInitializing ? "Loading..." : "Select business unit")}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-500" />
        </Button>

        {open && (
          <div className="absolute left-0 right-0 z-[120] mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Switch Business Unit
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {sortedBusinessUnits.length > 0 ? (
                sortedBusinessUnits.map((businessUnit) => (
                  <button
                    key={businessUnit.id}
                    type="button"
                    onClick={() => handleSelect(businessUnit)}
                    disabled={isPending}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                      "hover:bg-gray-50 disabled:opacity-60",
                      currentBusinessUnit?.id === businessUnit.id && "bg-primary/5"
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        currentBusinessUnit?.id === businessUnit.id
                          ? "opacity-100 text-primary"
                          : "opacity-0"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-gray-900">
                          {businessUnit.name}
                        </span>
                        {businessUnit.access.is_default && (
                          <Badge variant="secondary" className="shrink-0 text-[10px]">
                            Default
                          </Badge>
                        )}
                      </div>
                      <div className="truncate text-xs text-gray-500">
                        {businessUnit.code} • {toProperCase(businessUnit.type)}
                      </div>
                    </div>
                    {isPending && currentBusinessUnit?.id === businessUnit.id ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-500" />
                    ) : null}
                  </button>
                ))
              ) : isBootstrapping ? (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading business units...</span>
                </div>
              ) : bootstrapError ? (
                <div className="space-y-2 px-3 py-3">
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>{bootstrapError}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFallbackBusinessUnits([]);
                      setBootstrapError(null);
                      setIsBootstrapping(false);
                    }}
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <div className="px-3 py-3 text-sm text-gray-600">No business units available</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select business unit"
          className={cn(
            "w-full justify-between",
            isTablet ? "h-11 border-gray-200 bg-white text-gray-900 shadow-sm hover:bg-gray-50" : ""
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">
              {displayBusinessUnitName || (isInitializing ? "Loading..." : "Select business unit")}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[300px] p-0"
        side="right"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search business unit..." />
          <CommandList>
            <CommandEmpty>No business unit found.</CommandEmpty>
            <CommandGroup>
              {sortedBusinessUnits.map((businessUnit) => (
                <CommandItem
                  key={businessUnit.id}
                  value={businessUnit.name}
                  onSelect={() => handleSelect(businessUnit)}
                  disabled={isPending}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      currentBusinessUnit?.id === businessUnit.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{businessUnit.name}</span>
                      {businessUnit.access.is_default && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          Default
                        </Badge>
                      )}
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      {businessUnit.code} • {toProperCase(businessUnit.type)}
                    </span>
                  </div>
                  {isPending && currentBusinessUnit?.id === businessUnit.id && (
                    <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin" />
                  )}
                </CommandItem>
              ))}
              {sortedBusinessUnits.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground">
                  {isBootstrapping ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading business units...</span>
                    </div>
                  ) : bootstrapError ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="h-4 w-4" />
                        <span>{bootstrapError}</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFallbackBusinessUnits([]);
                          setBootstrapError(null);
                          setIsBootstrapping(false);
                        }}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : (
                    "No business units available"
                  )}
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
