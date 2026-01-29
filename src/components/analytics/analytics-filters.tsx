"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "./date-range-picker";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { DateRange } from "react-day-picker";
import { MINDANAO_CITIES, MINDANAO_REGIONS } from "@/types/employee";
import { useEmployees } from "@/hooks/useEmployees";

interface AnalyticsFiltersProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  employeeId?: string;
  onEmployeeChange: (value: string) => void;
  city?: string;
  onCityChange: (value: string) => void;
  regionState?: string;
  onRegionChange: (value: string) => void;
  onReset: () => void;
}

export function AnalyticsFilters({
  dateRange,
  onDateRangeChange,
  employeeId,
  onEmployeeChange,
  city,
  onCityChange,
  regionState,
  onRegionChange,
  onReset,
}: AnalyticsFiltersProps) {
  const { data: employeesData } = useEmployees({ limit: 100 });
  const employees = employeesData?.data || [];

  // Filter only sales agents
  const salesAgents = employees.filter((emp) => emp.role === "sales_agent" && emp.isActive);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Date Range */}
        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-medium">Date Range</label>
          <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
        </div>

        {/* Employee Filter */}
        <div>
          <label className="mb-2 block text-sm font-medium">Sales Agent</label>
          <Select value={employeeId || "all"} onValueChange={onEmployeeChange}>
            <SelectTrigger>
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {salesAgents.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* City Filter */}
        <div>
          <label className="mb-2 block text-sm font-medium">City</label>
          <Select value={city || "all"} onValueChange={onCityChange}>
            <SelectTrigger>
              <SelectValue placeholder="All cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {MINDANAO_CITIES.map((cityName) => (
                <SelectItem key={cityName} value={cityName}>
                  {cityName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Region Filter */}
        <div>
          <label className="mb-2 block text-sm font-medium">Region</label>
          <Select value={regionState || "all"} onValueChange={onRegionChange}>
            <SelectTrigger>
              <SelectValue placeholder="All regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {MINDANAO_REGIONS.map((region) => (
                <SelectItem key={region} value={region}>
                  {region}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reset Button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Filters
        </Button>
      </div>
    </div>
  );
}
