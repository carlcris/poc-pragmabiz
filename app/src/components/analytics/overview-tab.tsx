"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, DollarSign, Users, ShoppingCart, BarChart3, PieChart } from "lucide-react";
import { useSalesOverview, useSalesByEmployee, useSalesByLocation, useSalesByTime } from "@/hooks/useAnalytics";
import { useCurrency } from "@/hooks/useCurrency";
import { KPICard } from "@/components/dashboard/kpi-card";
import type { SalesAnalyticsFilters } from "@/types/analytics";
import { LineChart, Line, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";

interface OverviewTabProps {
  filters?: SalesAnalyticsFilters;
}

export function OverviewTab({ filters }: OverviewTabProps) {
  const { formatCurrency } = useCurrency();
  const { data: overviewData, isLoading: overviewLoading } = useSalesOverview(filters);
  const { data: employeeData, isLoading: employeeLoading } = useSalesByEmployee(filters);
  const { data: locationData, isLoading: locationLoading } = useSalesByLocation(filters);
  const { data: timeData, isLoading: timeLoading } = useSalesByTime(filters);

  const overview = overviewData?.data;
  const topEmployees = useMemo(() => employeeData?.data?.slice(0, 5) || [], [employeeData]);
  const topLocations = useMemo(() => locationData?.data?.slice(0, 5) || [], [locationData]);

  // Prepare chart data
  const salesTrendData = useMemo(() => {
    if (!timeData?.data) return [];
    return timeData.data.map((item) => ({
      date: format(parseISO(item.date), "MMM dd"),
      sales: item.sales,
      commission: item.commission,
      transactions: item.transactions,
    }));
  }, [timeData]);

  const topEmployeesChartData = useMemo(() => {
    return topEmployees.map((emp) => ({
      name: emp.employeeName.split(" ").slice(0, 2).join(" "), // Shorten names
      sales: emp.totalSales,
      commission: emp.totalCommission,
    }));
  }, [topEmployees]);

  const topLocationsChartData = useMemo(() => {
    return topLocations.map((loc) => ({
      name: loc.city,
      value: loc.totalSales,
    }));
  }, [topLocations]);

  // Colors for pie chart
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Sales"
          value={overview ? formatCurrency(overview.totalSales) : formatCurrency(0)}
          description={`${overview?.transactionCount || 0} transactions`}
          icon={DollarSign}
          iconColor="text-green-600"
          trend={
            overview?.comparison
              ? {
                  value: overview.comparison.salesGrowthPercentage,
                  label: "vs previous period",
                  isPositive: overview.comparison.salesGrowthPercentage >= 0,
                }
              : undefined
          }
          isLoading={overviewLoading}
        />
        <KPICard
          title="Total Commissions"
          value={overview ? formatCurrency(overview.totalCommissions) : formatCurrency(0)}
          description="Earned by all agents"
          icon={TrendingUp}
          iconColor="text-blue-600"
          isLoading={overviewLoading}
        />
        <KPICard
          title="Active Agents"
          value={overview?.activeAgents || 0}
          description="Sales agents with activity"
          icon={Users}
          iconColor="text-purple-600"
          isLoading={overviewLoading}
        />
        <KPICard
          title="Average Order Value"
          value={overview ? formatCurrency(overview.averageOrderValue) : formatCurrency(0)}
          description="Per transaction"
          icon={ShoppingCart}
          iconColor="text-orange-600"
          isLoading={overviewLoading}
        />
      </div>

      {/* Sales Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sales Trend
          </CardTitle>
          <CardDescription>Daily sales performance</CardDescription>
        </CardHeader>
        <CardContent>
          {timeLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : salesTrendData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No sales data available
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: "8px" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Sales"
                  dot={{ fill: "#3b82f6" }}
                />
                <Line
                  type="monotone"
                  dataKey="commission"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Commission"
                  dot={{ fill: "#10b981" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top 5 Agents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top 5 Sales Agents
            </CardTitle>
            <CardDescription>By total sales</CardDescription>
          </CardHeader>
          <CardContent>
            {employeeLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : topEmployeesChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No employee data available
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topEmployeesChartData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis
                    type="number"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: "8px" }}
                  />
                  <Legend />
                  <Bar dataKey="sales" fill="#3b82f6" name="Sales" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="commission" fill="#10b981" name="Commission" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top 5 Locations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Top 5 Locations
            </CardTitle>
            <CardDescription>By total sales</CardDescription>
          </CardHeader>
          <CardContent>
            {locationLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : topLocationsChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No location data available
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={topLocationsChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {topLocationsChartData.map((entry, index) => (
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
    </div>
  );
}
