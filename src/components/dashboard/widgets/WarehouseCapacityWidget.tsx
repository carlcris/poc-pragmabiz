"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Warehouse, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWarehouseCapacity } from "@/hooks/usePurchasingDashboard";
import { cn } from "@/lib/utils";
import { WidgetEmptyState } from "./WidgetEmptyState";

type WarehouseCapacityWidgetProps = {
  warehouseId?: string;
};

export function WarehouseCapacityWidget({ warehouseId }: WarehouseCapacityWidgetProps) {
  const t = useTranslations("purchasingOverviewWidgets");
  const format = useFormatter();
  const { data, isLoading, error } = useWarehouseCapacity({ warehouseId });

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>{t("warehouseCapacityTitle")}</CardTitle>
              <CardDescription>{t("spaceUtilizationMetrics")}</CardDescription>
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
            <Warehouse className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>{t("warehouseCapacityTitle")}</CardTitle>
              <CardDescription>{t("spaceUtilizationMetrics")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">{t("failedLoadCapacityData")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty/no data state
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>{t("warehouseCapacityTitle")}</CardTitle>
              <CardDescription>{t("spaceUtilizationMetrics")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetEmptyState icon={Warehouse} title={t("noCapacityDataAvailable")} />
        </CardContent>
      </Card>
    );
  }

  const utilizationPercent = data.utilizationPercent;
  const displayedProgress = Math.min(Math.max(utilizationPercent, 0), 100);
  const isOverCapacity = data.overCapacityLocations > 0 || utilizationPercent > 100;
  const isHighCapacity = utilizationPercent >= 90;
  const isMediumCapacity = utilizationPercent >= 75 && utilizationPercent < 90;

  // Determine status color
  const statusConfig = {
    label: isHighCapacity ? t("critical") : isMediumCapacity ? t("warning") : t("good"),
    color: isHighCapacity ? "text-red-600" : isMediumCapacity ? "text-amber-600" : "text-green-600",
    progressColor: isHighCapacity
      ? "bg-red-500"
      : isMediumCapacity
        ? "bg-amber-500"
        : "bg-green-500",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Warehouse className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <CardTitle>{t("warehouseCapacityTitle")}</CardTitle>
            <CardDescription>{t("spaceUtilizationMetrics")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.unconfiguredLocations > 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t("unconfiguredRackCapacityAlert", { count: data.unconfiguredLocations })}
            </AlertDescription>
          </Alert>
        ) : null}

        {isOverCapacity ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t("overCapacityRackAlert", { count: data.overCapacityLocations })}
            </AlertDescription>
          </Alert>
        ) : isHighCapacity ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t("warehouseAtCapacityAlert", { value: utilizationPercent.toFixed(1) })}
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Utilization Gauge */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{t("utilization")}</span>
            <span className={cn("text-xl font-bold sm:text-2xl", statusConfig.color)}>
              {utilizationPercent.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", statusConfig.progressColor)}
              style={{ width: `${displayedProgress}%` }}
            />
          </div>
          <div className="flex justify-center">
            <span className={cn("text-sm font-semibold", statusConfig.color)}>
              {statusConfig.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-lg border bg-muted/50 p-2 text-center sm:p-3">
            <div className="text-xs text-muted-foreground">{t("emptyRacks")}</div>
            <p className="mt-1 text-base font-bold tabular-nums sm:text-lg">
              {data.emptyLocations}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/50 p-2 text-center sm:p-3">
            <div className="text-xs text-muted-foreground">{t("partialRacks")}</div>
            <p className="mt-1 text-base font-bold tabular-nums text-blue-600 sm:text-lg">
              {data.partiallyOccupiedLocations}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/50 p-2 text-center sm:p-3">
            <div className="text-xs text-muted-foreground">{t("fullRacks")}</div>
            <p className="mt-1 text-base font-bold tabular-nums text-amber-600 sm:text-lg">
              {data.fullLocations}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/50 p-2 text-center sm:p-3">
            <div className="text-xs text-muted-foreground">{t("unconfiguredRacks")}</div>
            <p className="mt-1 text-base font-bold tabular-nums text-muted-foreground sm:text-lg">
              {data.unconfiguredLocations}
            </p>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("capacityUsed")}</span>
            <span className="font-semibold tabular-nums">
              {format.number(data.usedCapacity, { maximumFractionDigits: 2 })} /{" "}
              {format.number(data.totalCapacity, { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("remainingCapacity")}</span>
            <span className="font-semibold tabular-nums text-green-600">
              {format.number(data.availableCapacity, { maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("configuredRacks")}</span>
            <span className="font-semibold tabular-nums">
              {data.configuredLocations} / {data.totalLocations}
            </span>
          </div>
        </div>

        {/* Recommendations */}
        {isHighCapacity && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">{t("recommendations")}:</p>
            <ul className="mt-1 space-y-1 text-xs text-amber-700">
              <li>• {t("reviewSlowMovingInventory")}</li>
              <li>• {t("optimizeBinAssignments")}</li>
              <li>• {t("considerWarehouseExpansion")}</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
