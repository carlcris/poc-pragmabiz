"use client";

/**
 * Business Unit Switcher Component
 *
 * Dropdown component for switching between business units
 * Displays available business units and allows user to switch context
 */

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Building2, Loader2 } from "lucide-react";
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

export const BusinessUnitSwitcher = () => {
  const [open, setOpen] = useState(false);
  const { currentBusinessUnit, availableBusinessUnits } = useBusinessUnitStore();
  const { mutate: setContext, isPending } = useSetBusinessUnitContext();

  // Sort business units: default first, then alphabetically by name
  const sortedBusinessUnits = useMemo(() => {
    return [...availableBusinessUnits].sort((a, b) => {
      // Default BU always comes first
      if (a.access.is_default && !b.access.is_default) return -1;
      if (!a.access.is_default && b.access.is_default) return 1;
      // Then sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }, [availableBusinessUnits]);

  const handleSelect = (businessUnit: BusinessUnitWithAccess) => {
    if (businessUnit.id === currentBusinessUnit?.id) {
      setOpen(false);
      return;
    }

    setContext(businessUnit.id, {
      onSuccess: () => {
        setOpen(false);
        // Cache is cleared and queries will refetch with new BU context from JWT
        // Page will show loading states while new data is fetched
      },
    });
  };

  // If only one business unit, show it but make it non-interactive
  if (availableBusinessUnits.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
        <Building2 className="h-4 w-4 shrink-0 text-white/70" />
        <span className="truncate text-sm text-white/90">
          {currentBusinessUnit?.name || "No business unit"}
        </span>
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
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{currentBusinessUnit?.name || "Select business unit"}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" side="right" align="start">
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
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
