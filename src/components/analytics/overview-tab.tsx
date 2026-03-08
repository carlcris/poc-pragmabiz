"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, DollarSign, Users, ShoppingCart, BarChart3, PieChart } from "lucide-react";
import {
  useSalesOverview,
  useSalesByEmployee,
  useSalesByLocation,
  useSalesByTime,
} from "@/hooks/useAnalytics";
import { useCurrency } from "@/hooks/useCurrency";
import { KPICard } from "@/components/dashboard/kpi-card";
import type { SalesAnalyticsFilters } from "@/types/analytics";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";

interface OverviewTabProps {
  filters?: SalesAnalyticsFilters;
}

export function OverviewTab({ filters }: OverviewTabProps) {
  const t = useTranslations("analyticsOverviewTab");
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
      commissions: item.commissions,
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
          title={t("totalSales")}
          value={overview ? formatCurrency(overview.totalSales) : formatCurrency(0)}
          description={t("transactions", { count: overview?.transactionCount || 0 })}
          icon={DollarSign}
          iconColor="text-green-600"
          trend={
            overview?.comparison
              ? {
                  value: overview.comparison.salesGrowthPercentage,
                  label: t("vsPreviousPeriod"),
                  isPositive: overview.comparison.salesGrowthPercentage >= 0,
                }
              : undefined
          }
          isLoading={overviewLoading}
        />
        <KPICard
          title={t("totalCommissions")}
          value={overview ? formatCurrency(overview.totalCommissions) : formatCurrency(0)}
          description={t("earnedByAllAgents")}
          icon={TrendingUp}
          iconColor="text-blue-600"
          isLoading={overviewLoading}
        />
        <KPICard
          title={t("activeAgents")}
          value={overview?.activeAgents || 0}
          description={t("salesAgentsWithActivity")}
          icon={Users}
          iconColor="text-purple-600"
          isLoading={overviewLoading}
        />
        <KPICard
          title={t("averageOrderValue")}
          value={overview ? formatCurrency(overview.averageOrderValue) : formatCurrency(0)}
          description={t("perTransaction")}
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
            {t("salesTrend")}
          </CardTitle>
          <CardDescription>{t("dailySalesPerformance")}</CardDescription>
        </CardHeader>
        <CardContent>
          {timeLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : salesTrendData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noSalesData")}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(typeof value === "number" ? value : 0)}
                  contentStyle={{ borderRadius: "8px" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name={t("sales")}
                  dot={{ fill: "#3b82f6" }}
                />
                <Line
                  type="monotone"
                  dataKey="commissions"
                  stroke="#10b981"
                  strokeWidth={2}
                  name={t("commission")}
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
              {t("topSalesAgents")}
            </CardTitle>
            <CardDescription>{t("byTotalSales")}</CardDescription>
          </CardHeader>
          <CardContent>
            {employeeLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : topEmployeesChartData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("noEmployeeData")}
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
                    formatter={(value) => formatCurrency(typeof value === "number" ? value : 0)}
                    contentStyle={{ borderRadius: "8px" }}
                  />
                  <Legend />
                  <Bar dataKey="sales" fill="#3b82f6" name={t("sales")} radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="commissions"
                    fill="#10b981"
                    name={t("commission")}
                    radius={[4, 4, 0, 0]}
                  />
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
              {t("topLocations")}
            </CardTitle>
            <CardDescription>{t("byTotalSalesLocations")}</CardDescription>
          </CardHeader>
          <CardContent>
            {locationLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : topLocationsChartData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("noLocationData")}
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={topLocationsChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ""} (${(((percent ?? 0) * 100).toFixed(0))}%)`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {topLocationsChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(typeof value === "number" ? value : 0)}
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
