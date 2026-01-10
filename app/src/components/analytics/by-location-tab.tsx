"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSalesByLocation } from "@/hooks/useAnalytics";
import { useCurrency } from "@/hooks/useCurrency";
import { MapPin, BarChart3, PieChart, ChevronLeft, ChevronRight } from "lucide-react";
import type { SalesAnalyticsFilters } from "@/types/analytics";
import { BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ByLocationTabProps {
  filters?: SalesAnalyticsFilters;
}

export function ByLocationTab({ filters }: ByLocationTabProps) {
  const { formatCurrency } = useCurrency();
  const { data, isLoading } = useSalesByLocation(filters);

  const locationData = useMemo(() => data?.data || [], [data]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Prepare chart data for top 10 cities
  const topCitiesChartData = useMemo(() => {
    return locationData.slice(0, 10).map((loc) => ({
      name: loc.city,
      sales: loc.totalSales,
      transactions: loc.transactionCount,
      customers: loc.uniqueCustomers,
    }));
  }, [locationData]);

  // Prepare regional distribution data
  const regionalDistributionData = useMemo(() => {
    const regionMap = new Map<string, number>();

    locationData.forEach((loc) => {
      const current = regionMap.get(loc.regionState) || 0;
      regionMap.set(loc.regionState, current + loc.totalSales);
    });

    return Array.from(regionMap.entries()).map(([region, sales]) => ({
      name: region,
      value: sales,
    }));
  }, [locationData]);

  // Colors for pie chart
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  // Pagination logic
  const totalPages = Math.ceil(locationData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return locationData.slice(startIndex, endIndex);
  }, [locationData, currentPage, itemsPerPage]);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  return (
    <div className="space-y-6">
      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Cities Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top 10 Cities by Sales
            </CardTitle>
            <CardDescription>Sales performance by city</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : topCitiesChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No location data available
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topCitiesChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "transactions" || name === "customers") return value;
                      return formatCurrency(value);
                    }}
                    contentStyle={{ borderRadius: "8px" }}
                  />
                  <Legend />
                  <Bar dataKey="sales" fill="#3b82f6" name="Sales" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Regional Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Regional Distribution
            </CardTitle>
            <CardDescription>Sales by region</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : regionalDistributionData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No regional data available
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <RechartsPieChart>
                  <Pie
                    data={regionalDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {regionalDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: "8px" }}
                  />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Location Performance Table */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Sales by Location
          </h3>
          <p className="text-sm text-muted-foreground">Performance breakdown by city and region</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : locationData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No location data available
          </p>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>City</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Avg Order Value</TableHead>
                    <TableHead className="text-right">Unique Customers</TableHead>
                    <TableHead>Top Employee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((location) => (
                    <TableRow key={`${location.city}-${location.regionState}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {location.city}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{location.regionState}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(location.totalSales)}
                      </TableCell>
                      <TableCell className="text-right">{location.transactionCount}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(location.averageOrderValue)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {location.uniqueCustomers}
                      </TableCell>
                      <TableCell>
                        {location.topEmployee ? (
                          <div className="text-sm">
                            <div className="font-medium">{location.topEmployee.name}</div>
                            <div className="text-muted-foreground">
                              {formatCurrency(location.topEmployee.sales)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, locationData.length)} of {locationData.length} entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
