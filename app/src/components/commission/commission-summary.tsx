"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommissionSummary } from "@/hooks/useCommission";
import { useCurrency } from "@/hooks/useCurrency";
import { DollarSign, TrendingUp, Users, CheckCircle, Clock, Percent } from "lucide-react";

interface CommissionSummaryProps {
  dateRange?: {
    from: Date;
    to: Date;
  };
  employeeId?: string;
}

export function CommissionSummary({ dateRange, employeeId }: CommissionSummaryProps) {
  const { formatCurrency } = useCurrency();
  const { data, isLoading } = useCommissionSummary({
    dateFrom: dateRange?.from,
    dateTo: dateRange?.to,
    employeeId,
  });

  const summary = data?.summary;

  const stats = [
    {
      title: "Total Commission",
      value: summary ? formatCurrency(summary.totalCommission) : "-",
      icon: DollarSign,
      description: `From ${summary?.transactionCount || 0} transactions`,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Total Sales",
      value: summary ? formatCurrency(summary.totalSales) : "-",
      icon: TrendingUp,
      description: "Total sales volume",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Paid Commission",
      value: summary ? formatCurrency(summary.paidCommission) : "-",
      icon: CheckCircle,
      description: "From paid invoices",
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      title: "Pending Commission",
      value: summary ? formatCurrency(summary.pendingCommission) : "-",
      icon: Clock,
      description: "From unpaid invoices",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Active Employees",
      value: summary?.uniqueEmployees || 0,
      icon: Users,
      description: "Employees with commissions",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Effective Rate",
      value: summary ? `${summary.effectiveRate.toFixed(2)}%` : "-",
      icon: Percent,
      description: "Average commission rate",
      color: "text-pink-600",
      bgColor: "bg-pink-100",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`h-8 w-8 rounded-full ${stat.bgColor} flex items-center justify-center`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Additional Insights */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Commission Insights</CardTitle>
            <CardDescription>Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Average Commission per Transaction</span>
              <span className="text-sm font-semibold">{formatCurrency(summary.avgCommissionPerTransaction)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Commission Payout Rate</span>
              <span className="text-sm font-semibold">
                {summary.totalCommission > 0
                  ? `${((summary.paidCommission / summary.totalCommission) * 100).toFixed(1)}%`
                  : "0%"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Average Sales per Transaction</span>
              <span className="text-sm font-semibold">
                {formatCurrency(summary.transactionCount > 0 ? summary.totalSales / summary.transactionCount : 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
