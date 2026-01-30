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
import { Button } from "@/components/ui/button";
import { useSalesByTime } from "@/hooks/useAnalytics";
import { useCurrency } from "@/hooks/useCurrency";
import { format, parseISO } from "date-fns";
import type { SalesAnalyticsFilters } from "@/types/analytics";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";

interface ByTimeTabProps {
  filters?: SalesAnalyticsFilters;
}

export function ByTimeTab({ filters }: ByTimeTabProps) {
  const { formatCurrency } = useCurrency();
  const { data, isLoading } = useSalesByTime(filters);

  const salesData = useMemo(() => data?.data || [], [data]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Prepare chart data
  const chartData = useMemo(() => {
    return salesData.map((item) => ({
      date: format(parseISO(item.date), "MMM dd"),
      sales: item.sales,
      commissions: item.commissions,
      transactions: item.transactions,
    }));
  }, [salesData]);

  // Pagination logic
  const totalPages = Math.ceil(salesData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return salesData.slice(startIndex, endIndex);
  }, [salesData, currentPage, itemsPerPage]);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  return (
    <div className="space-y-6">
      {/* Sales Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sales Trend Over Time
          </CardTitle>
          <CardDescription>Sales and commissions by date</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : chartData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No sales data available
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "Transactions") return value ?? 0;
                    return formatCurrency(typeof value === "number" ? value : 0);
                  }}
                  contentStyle={{ borderRadius: "8px" }}
                />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Sales"
                  dot={{ fill: "#3b82f6" }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="commissions"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Commissions"
                  dot={{ fill: "#10b981" }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="transactions"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  name="Transactions"
                  dot={{ fill: "#f59e0b" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Sales by Date Table */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Sales Over Time</h3>
          <p className="text-sm text-muted-foreground">Daily sales breakdown</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : salesData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No sales data available</p>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Avg Order Value</TableHead>
                    <TableHead className="text-right">Commissions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((item) => (
                    <TableRow key={item.date}>
                      <TableCell className="font-medium">
                        {format(new Date(item.date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(item.sales)}
                      </TableCell>
                      <TableCell className="text-right">{item.transactions}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.averageOrderValue)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(item.commissions)}
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
                {Math.min(currentPage * itemsPerPage, salesData.length)} of {salesData.length}{" "}
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
