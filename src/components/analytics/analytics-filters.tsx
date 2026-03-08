"use client";

import { useTranslations } from "next-intl";
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

export function AnalyticsFilters({ dateRange, onDateRangeChange, employeeId, onEmployeeChange, city, onCityChange, regionState, onRegionChange, onReset }: AnalyticsFiltersProps) {
  const t = useTranslations("analyticsFilters");
  const { data: employeesData } = useEmployees({ limit: 100 });
  const employees = employeesData?.data || [];
  const salesAgents = employees.filter((emp) => emp.role === "sales_agent" && emp.isActive);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-medium">{t("dateRange")}</label>
          <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">{t("salesAgent")}</label>
          <Select value={employeeId || "all"} onValueChange={onEmployeeChange}>
            <SelectTrigger><SelectValue placeholder={t("allAgents")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allAgents")}</SelectItem>
              {salesAgents.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">{t("city")}</label>
          <Select value={city || "all"} onValueChange={onCityChange}>
            <SelectTrigger><SelectValue placeholder={t("allCities")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCities")}</SelectItem>
              {MINDANAO_CITIES.map((cityName) => <SelectItem key={cityName} value={cityName}>{cityName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">{t("region")}</label>
          <Select value={regionState || "all"} onValueChange={onRegionChange}>
            <SelectTrigger><SelectValue placeholder={t("allRegions")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allRegions")}</SelectItem>
              {MINDANAO_REGIONS.map((region) => <SelectItem key={region} value={region}>{region}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          {t("resetFilters")}
        </Button>
      </div>
    </div>
  );
}
