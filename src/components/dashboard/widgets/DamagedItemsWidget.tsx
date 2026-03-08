"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, TrendingDown, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDamagedItemsThisMonth } from "@/hooks/usePurchasingDashboard";
import { formatCurrency } from "@/lib/utils/currency";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { WidgetEmptyState } from "./WidgetEmptyState";

const COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#06b6d4"];

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  broken: "broken",
  defective: "defective",
  missing: "missing",
  expired: "expired",
  wrong_item: "wrongItem",
  other: "other",
};

type DamagedItemsWidgetProps = {
  businessUnitId?: string;
  warehouseId?: string;
};

export function DamagedItemsWidget({ businessUnitId, warehouseId }: DamagedItemsWidgetProps) {
  const t = useTranslations("purchasingOverviewWidgets");
  const { data, isLoading, error } = useDamagedItemsThisMonth({ businessUnitId, warehouseId });

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>{t("damagedItemsThisMonthTitle")}</CardTitle>
              <CardDescription>{t("qualityIssuesAndValueImpact")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>{t("damagedItemsThisMonthTitle")}</CardTitle>
              <CardDescription>{t("qualityIssuesAndValueImpact")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">{t("failedLoadDamagedItemsData")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : t("anErrorOccurred")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!data || data.count === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>{t("damagedItemsThisMonthTitle")}</CardTitle>
              <CardDescription>{t("qualityIssuesAndValueImpact")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetEmptyState
            icon={AlertTriangle}
            title={t("noDamagedItemsThisMonth")}
            description={t("excellentQualityRecord")}
            variant="success"
          />
        </CardContent>
      </Card>
    );
  }

  const topSuppliers = data.bySupplier.slice(0, 5);
  const alertThreshold = 20; // Alert if more than 20 damaged items

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <CardTitle>{t("damagedItemsThisMonthTitle")}</CardTitle>
            <CardDescription>{t("qualityIssuesAndValueImpact")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alert if high damage count */}
        {data.count > alertThreshold && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t("highDamageCountDetected", { count: data.count })}
            </AlertDescription>
          </Alert>
        )}

        {/* KPI Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-lg border bg-muted/50 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              <span>{t("count")}</span>
            </div>
            <p className="mt-2 text-xl sm:text-2xl font-bold text-destructive">{data.count}</p>
          </div>
          <div className="rounded-lg border bg-muted/50 p-3 sm:p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingDown className="h-4 w-4" />
              <span>{t("totalValue")}</span>
            </div>
            <p className="mt-2 text-xl sm:text-2xl font-bold text-destructive">{formatCurrency(data.totalValue)}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {/* By Supplier Pie Chart */}
          {topSuppliers.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t("bySupplier")}</p>
              <div className="rounded-lg border bg-card p-3">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={topSuppliers}
                      dataKey="count"
                      nameKey="supplierName"
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      label
                    >
                      {topSuppliers.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* By Damage Type Bar Chart */}
          {data.byDamageType.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{t("byType")}</p>
              <div className="rounded-lg border bg-card p-3">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.byDamageType}>
                    <XAxis
                      dataKey="damageType"
                      tickFormatter={(value) => t(DAMAGE_TYPE_LABELS[value] || value)}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* View Details Link */}
        <Button asChild variant="outline" className="w-full">
          <Link href="/purchasing/damaged-items">
            {t("viewDamageReports")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
