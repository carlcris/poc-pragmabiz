"use client";

import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { BarChart3, Calendar, MapPin, Users } from "lucide-react";
import { OverviewTab } from "@/components/analytics/overview-tab";
import { ByTimeTab } from "@/components/analytics/by-time-tab";
import { ByEmployeeTab } from "@/components/analytics/by-employee-tab";
import { ByLocationTab } from "@/components/analytics/by-location-tab";
import { AnalyticsFilters } from "@/components/analytics/analytics-filters";
import { subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import type { SalesAnalyticsFilters } from "@/types/analytics";

export default function SalesAnalyticsPage() {
  const [activeTab, setActiveTab] = useState("overview");

  // Filter state
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29), // Last 30 days by default
    to: new Date(),
  });
  const [employeeId, setEmployeeId] = useState<string | undefined>();
  const [city, setCity] = useState<string | undefined>();
  const [regionState, setRegionState] = useState<string | undefined>();

  const handleReset = () => {
    setDateRange({
      from: subDays(new Date(), 29),
      to: new Date(),
    });
    setEmployeeId(undefined);
    setCity(undefined);
    setRegionState(undefined);
  };

  const handleEmployeeChange = (value: string) => {
    setEmployeeId(value === "all" ? undefined : value);
  };

  const handleCityChange = (value: string) => {
    setCity(value === "all" ? undefined : value);
  };

  const handleRegionChange = (value: string) => {
    setRegionState(value === "all" ? undefined : value);
  };

  // Convert DateRange and other filters to SalesAnalyticsFilters format
  const analyticsFilters = useMemo<SalesAnalyticsFilters>(() => {
    const filters: SalesAnalyticsFilters = {};

    if (dateRange?.from) {
      filters.startDate = dateRange.from.toISOString();
    }
    if (dateRange?.to) {
      filters.endDate = dateRange.to.toISOString();
    }
    if (employeeId) {
      filters.employeeId = employeeId;
    }
    if (city) {
      filters.city = city;
    }
    if (regionState) {
      filters.regionState = regionState;
    }

    return filters;
  }, [dateRange, employeeId, city, regionState]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales Analytics</h1>
        <p className="text-muted-foreground">
          Comprehensive insights into sales performance across agents, locations, and time periods
        </p>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <AnalyticsFilters
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          employeeId={employeeId}
          onEmployeeChange={handleEmployeeChange}
          city={city}
          onCityChange={handleCityChange}
          regionState={regionState}
          onRegionChange={handleRegionChange}
          onReset={handleReset}
        />
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="by-time" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">By Time</span>
          </TabsTrigger>
          <TabsTrigger value="by-employee" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">By Employee</span>
          </TabsTrigger>
          <TabsTrigger value="by-location" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">By Location</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab filters={analyticsFilters} />
        </TabsContent>

        <TabsContent value="by-time" className="space-y-6">
          <ByTimeTab filters={analyticsFilters} />
        </TabsContent>

        <TabsContent value="by-employee" className="space-y-6">
          <ByEmployeeTab filters={analyticsFilters} />
        </TabsContent>

        <TabsContent value="by-location" className="space-y-6">
          <ByLocationTab filters={analyticsFilters} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
