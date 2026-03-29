"use client";

/**
 * Business Unit Switcher Component
 *
 * Dropdown component for switching between business units
 * Displays available business units and allows user to switch context
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { Check, ChevronsUpDown, Building2, Loader2, AlertCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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

type CompanyGroup = {
  id: string;
  code: string;
  name: string;
  businessUnits: BusinessUnitWithAccess[];
};

export const BusinessUnitSwitcher = ({
  initialBusinessUnitName = null,
  variant = "default",
}: BusinessUnitSwitcherProps) => {
  const [open, setOpen] = useState(false);
  const tabletDropdownRef = useRef<HTMLDivElement | null>(null);
  const hasBootstrappedRef = useRef(false);
  const [fallbackBusinessUnits, setFallbackBusinessUnits] = useState<BusinessUnitWithAccess[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
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
  const resolvedCurrentBusinessUnit =
    currentBusinessUnit
      ? effectiveBusinessUnits.find((businessUnit) => businessUnit.id === currentBusinessUnit.id) ??
        currentBusinessUnit
      : null;
  const displayBusinessUnitName =
    resolvedCurrentBusinessUnit?.name ||
    initialBusinessUnitName ||
    null;

  useEffect(() => {
    let active = true;

    const bootstrapBusinessUnits = async () => {
      if (availableBusinessUnits.length > 0 || hasBootstrappedRef.current) return;
      hasBootstrappedRef.current = true;
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
  }, [availableBusinessUnits.length, bootstrapAttempt, isBootstrapping, setAvailableBusinessUnits]);

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

  const companyGroups = useMemo(() => {
    const groups = new Map<string, CompanyGroup>();

    sortedBusinessUnits.forEach((businessUnit) => {
      const companyId = businessUnit.company?.id ?? businessUnit.company_id;
      const existingGroup = groups.get(companyId);

      if (existingGroup) {
        existingGroup.businessUnits.push(businessUnit);
        return;
      }

      groups.set(companyId, {
        id: companyId,
        code: businessUnit.company?.code ?? "",
        name: businessUnit.company?.name ?? "Company",
        businessUnits: [businessUnit],
      });
    });

    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [sortedBusinessUnits]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const filteredCompanyGroups = useMemo(() => {
    if (!normalizedSearchTerm) return companyGroups;

    return companyGroups
      .map((company) => {
        const matchesCompany =
          company.name.toLowerCase().includes(normalizedSearchTerm) ||
          company.code.toLowerCase().includes(normalizedSearchTerm);

        if (matchesCompany) {
          return company;
        }

        const matchedBusinessUnits = company.businessUnits.filter((businessUnit) => {
          const searchHaystack = [
            businessUnit.name,
            businessUnit.code,
            businessUnit.type,
          ]
            .join(" ")
            .toLowerCase();

          return searchHaystack.includes(normalizedSearchTerm);
        });

        if (matchedBusinessUnits.length === 0) return null;

        return {
          ...company,
          businessUnits: matchedBusinessUnits,
        };
      })
      .filter((company): company is CompanyGroup => company !== null);
  }, [companyGroups, normalizedSearchTerm]);

  useEffect(() => {
    if (filteredCompanyGroups.length === 0) {
      setSelectedCompanyId(null);
      return;
    }

    const currentCompanyId =
      resolvedCurrentBusinessUnit?.company?.id ?? resolvedCurrentBusinessUnit?.company_id;

    if (
      currentCompanyId &&
      filteredCompanyGroups.some((company) => company.id === currentCompanyId)
    ) {
      setSelectedCompanyId(currentCompanyId);
      return;
    }

    if (
      selectedCompanyId &&
      filteredCompanyGroups.some((company) => company.id === selectedCompanyId)
    ) {
      return;
    }

    setSelectedCompanyId(filteredCompanyGroups[0].id);
  }, [resolvedCurrentBusinessUnit, filteredCompanyGroups, selectedCompanyId]);

  const selectedCompany =
    filteredCompanyGroups.find((company) => company.id === selectedCompanyId) ??
    filteredCompanyGroups[0] ??
    null;
  const selectedCompanyBusinessUnits = selectedCompany?.businessUnits ?? [];
  const displayLabel = displayBusinessUnitName;

  const handleSelect = (businessUnit: BusinessUnitWithAccess) => {
    if (businessUnit.id === resolvedCurrentBusinessUnit?.id) {
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
          {displayLabel ||
            (isInitializing || isBootstrapping ? "Business unit" : "No business unit")}
        </span>
      </div>
    );
  }

  const isTablet = variant === "tablet";

  const handleRetryBootstrap = () => {
    hasBootstrappedRef.current = false;
    setFallbackBusinessUnits([]);
    setBootstrapError(null);
    setIsBootstrapping(false);
    setBootstrapAttempt((attempt) => attempt + 1);
  };

  const renderCompanyButtons = () => {
    if (filteredCompanyGroups.length === 0) return null;

    return filteredCompanyGroups.map((company) => {
      const isSelected = selectedCompany?.id === company.id;

      return (
        <button
          key={company.id}
          type="button"
          onClick={() => setSelectedCompanyId(company.id)}
          className={cn(
            "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
            "hover:bg-muted/50",
            isSelected && "bg-primary/5"
          )}
        >
          <Check
            className={cn(
              "h-4 w-4 shrink-0",
              isSelected ? "opacity-100 text-primary" : "opacity-0"
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{company.name}</div>
            {company.code ? (
              <div className="truncate text-xs text-muted-foreground">{company.code}</div>
            ) : null}
          </div>
        </button>
      );
    });
  };

  const renderBusinessUnitButtons = () => {
    if (selectedCompanyBusinessUnits.length > 0) {
      return selectedCompanyBusinessUnits.map((businessUnit) => (
        <button
          key={businessUnit.id}
          type="button"
          onClick={() => handleSelect(businessUnit)}
          disabled={isPending}
          className={cn(
            "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
            "hover:bg-muted/50 disabled:opacity-60",
            resolvedCurrentBusinessUnit?.id === businessUnit.id && "bg-primary/5"
          )}
        >
          <Check
            className={cn(
              "h-4 w-4 shrink-0",
              resolvedCurrentBusinessUnit?.id === businessUnit.id
                ? "opacity-100 text-primary"
                : "opacity-0"
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{businessUnit.name}</span>
              {businessUnit.access.is_default && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  Default
                </Badge>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {businessUnit.code} • {toProperCase(businessUnit.type)}
            </div>
          </div>
          {isPending && resolvedCurrentBusinessUnit?.id === businessUnit.id ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : null}
        </button>
      ));
    }

    if (isBootstrapping) {
      return (
        <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading business units...</span>
        </div>
      );
    }

    if (bootstrapError) {
      return (
        <div className="space-y-2 px-3 py-3">
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span>{bootstrapError}</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleRetryBootstrap}>
            Retry
          </Button>
        </div>
      );
    }

    return (
      <div className="px-3 py-3 text-sm text-muted-foreground">
        {normalizedSearchTerm
          ? "No matching companies or business units"
          : selectedCompany
            ? "No business units available for this company"
            : "No business units available"}
      </div>
    );
  };

  const renderSwitcherContent = (tone: "tablet" | "default") => (
    <>
      <div
        className={cn(
          "border-b px-3 py-3",
          tone === "tablet" ? "border-gray-100" : "border-border"
        )}
      >
        <label className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search business unit..."
            className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>
      <div
        className={cn(
          "px-3 py-2 text-xs font-semibold uppercase tracking-wide",
          tone === "tablet" ? "border-b border-gray-100 text-gray-500" : "border-b text-muted-foreground"
        )}
      >
        Company
      </div>
      <div className="py-1">{renderCompanyButtons()}</div>
      <div className={cn("border-t", tone === "tablet" ? "border-gray-100" : "border-border")} />
      <div
        className={cn(
          "px-3 py-2 text-xs font-semibold uppercase tracking-wide",
          tone === "tablet" ? "text-gray-500" : "text-muted-foreground"
        )}
      >
        {selectedCompany?.name ?? "Business Unit"}
      </div>
      <div className="max-h-72 overflow-y-auto py-1">{renderBusinessUnitButtons()}</div>
    </>
  );

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
              {displayLabel || (isInitializing ? "Loading..." : "Select business unit")}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-gray-500" />
        </Button>

        {open && (
          <div className="absolute left-0 right-0 z-[120] mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            {renderSwitcherContent("tablet")}
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
              {displayLabel || (isInitializing ? "Loading..." : "Select business unit")}
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
        {renderSwitcherContent("default")}
      </PopoverContent>
    </Popover>
  );
};
