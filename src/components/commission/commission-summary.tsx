"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { useCommissionSummary } from "@/hooks/useCommission";
import { useCurrency } from "@/hooks/useCurrency";
import { DollarSign, TrendingUp, Users, CheckCircle, Clock, Percent } from "lucide-react";
import { MetricCard } from "@/components/shared/MetricCard";

interface CommissionSummaryProps {
  dateRange?: {
    from: Date;
    to: Date;
  };
  employeeId?: string;
}

export function CommissionSummary({ dateRange, employeeId }: CommissionSummaryProps) {
  const t = useTranslations("commissionSummary");
  const { formatCurrency } = useCurrency();
  const { data, isLoading } = useCommissionSummary({
    dateFrom: dateRange?.from,
    dateTo: dateRange?.to,
    employeeId,
  });

  const summary = data?.summary;

  const stats = [
    {
      title: t("totalCommission"),
      value: summary ? formatCurrency(summary.totalCommission) : "-",
      icon: DollarSign,
      description: t("fromTransactions", { count: summary?.transactionCount || 0 }),
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: t("totalSales"),
      value: summary ? formatCurrency(summary.totalSales) : "-",
      icon: TrendingUp,
      description: t("totalSalesVolume"),
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: t("paidCommission"),
      value: summary ? formatCurrency(summary.paidCommission) : "-",
      icon: CheckCircle,
      description: t("fromPaidInvoices"),
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      title: t("pendingCommission"),
      value: summary ? formatCurrency(summary.pendingCommission) : "-",
      icon: Clock,
      description: t("fromUnpaidInvoices"),
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: t("activeEmployees"),
      value: summary?.uniqueEmployees || 0,
      icon: Users,
      description: t("employeesWithCommissions"),
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: t("effectiveRate"),
      value: summary ? `${summary.effectiveRate.toFixed(2)}%` : "-",
      icon: Percent,
      description: t("averageCommissionRate"),
      color: "text-pink-600",
      bgColor: "bg-pink-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <MetricCard
              key={stat.title}
              title={stat.title}
              icon={Icon}
              value={String(stat.value)}
              caption={stat.description}
              isLoading={isLoading}
              iconClassName={`h-4 w-4 ${stat.color}`}
            />
          );
        })}
      </div>

      {/* Additional Insights */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>{t("commissionInsights")}</CardTitle>
            <CardDescription>{t("keyPerformanceIndicators")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {t("averageCommissionPerTransaction")}
              </span>
              <span className="text-sm font-semibold">
                {formatCurrency(summary.avgCommissionPerTransaction)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("commissionPayoutRate")}</span>
              <span className="text-sm font-semibold">
                {summary.totalCommission > 0
                  ? `${((summary.paidCommission / summary.totalCommission) * 100).toFixed(1)}%`
                  : "0%"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t("averageSalesPerTransaction")}</span>
              <span className="text-sm font-semibold">
                {formatCurrency(
                  summary.transactionCount > 0 ? summary.totalSales / summary.transactionCount : 0
                )}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
