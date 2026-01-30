"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSalesByEmployee } from "@/hooks/useAnalytics";
import { useCurrency } from "@/hooks/useCurrency";
import { Trophy, Medal, BarChart3, PieChart, ChevronLeft, ChevronRight } from "lucide-react";
import type { SalesAnalyticsFilters } from "@/types/analytics";
import {
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

interface ByEmployeeTabProps {
  filters?: SalesAnalyticsFilters;
}

export function ByEmployeeTab({ filters }: ByEmployeeTabProps) {
  const { formatCurrency } = useCurrency();
  const { data, isLoading } = useSalesByEmployee(filters);

  const employeeData = useMemo(() => data?.data || [], [data]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Prepare chart data for top 10 employees
  const topEmployeesChartData = useMemo(() => {
    return employeeData.slice(0, 10).map((emp) => ({
      name: emp.employeeName.split(" ").slice(0, 2).join(" "),
      sales: emp.totalSales,
      commission: emp.totalCommission,
      transactions: emp.transactionCount,
    }));
  }, [employeeData]);

  // Prepare commission distribution data (top 5)
  const commissionDistributionData = useMemo(() => {
    return employeeData.slice(0, 5).map((emp) => ({
      name: emp.employeeName.split(" ").slice(0, 2).join(" "),
      value: emp.totalCommission,
    }));
  }, [employeeData]);

  // Colors for pie chart
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  // Pagination logic
  const totalPages = Math.ceil(employeeData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return employeeData.slice(startIndex, endIndex);
  }, [employeeData, currentPage, itemsPerPage]);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="flex items-center gap-1">
          <Trophy className="h-4 w-4 text-yellow-600" />
          <span className="font-bold text-yellow-600">#{rank}</span>
        </div>
      );
    } else if (rank === 2) {
      return (
        <div className="flex items-center gap-1">
          <Medal className="h-4 w-4 text-gray-400" />
          <span className="font-bold text-gray-600">#{rank}</span>
        </div>
      );
    } else if (rank === 3) {
      return (
        <div className="flex items-center gap-1">
          <Medal className="h-4 w-4 text-amber-700" />
          <span className="font-bold text-amber-700">#{rank}</span>
        </div>
      );
    }
    return <span className="text-muted-foreground">#{rank}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Employees Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Top 10 Employees by Sales
            </CardTitle>
            <CardDescription>Sales and commission comparison</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : topEmployeesChartData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No employee data available
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topEmployeesChartData}>
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
                    formatter={(value, name) => {
                      if (name === "transactions") return value ?? 0;
                      return formatCurrency(typeof value === "number" ? value : 0);
                    }}
                    contentStyle={{ borderRadius: "8px" }}
                  />
                  <Legend />
                  <Bar dataKey="sales" fill="#3b82f6" name="Sales" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="commission"
                    fill="#10b981"
                    name="Commission"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Commission Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Commission Distribution
            </CardTitle>
            <CardDescription>Top 5 earners by commission</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[350px] w-full" />
            ) : commissionDistributionData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No commission data available
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <RechartsPieChart>
                  <Pie
                    data={commissionDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ""} (${(((percent ?? 0) * 100).toFixed(0))}%)`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {commissionDistributionData.map((entry, index) => (
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

      {/* Employee Leaderboard */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Employee Performance Leaderboard</h3>
          <p className="text-sm text-muted-foreground">Ranked by total sales</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : employeeData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No employee data available
          </p>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Territory</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Avg Order</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((employee) => (
                    <TableRow key={employee.employeeId}>
                      <TableCell>{getRankBadge(employee.rank || 0)}</TableCell>
                      <TableCell className="font-medium">{employee.employeeName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{employee.employeeCode}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {employee.territories.length > 0
                            ? employee.territories[0]
                            : "No territory"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(employee.totalSales)}
                      </TableCell>
                      <TableCell className="text-right">{employee.transactionCount}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(employee.averageOrderValue)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(employee.totalCommission)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {employee.commissionRate}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, employeeData.length)} of {employeeData.length}{" "}
                entries
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
