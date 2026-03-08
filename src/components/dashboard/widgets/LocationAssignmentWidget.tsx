"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { MapPin, Package, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocationAssignmentStatus } from "@/hooks/usePurchasingDashboard";
import { cn } from "@/lib/utils";
import { WidgetEmptyState } from "./WidgetEmptyState";

export function LocationAssignmentWidget() {
  const t = useTranslations("purchasingOverviewWidgets");
  const { data, isLoading, error } = useLocationAssignmentStatus();

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>{t("locationAssignmentTitle")}</CardTitle>
              <CardDescription>{t("warehouseLocationAssignmentStatus")}</CardDescription>
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
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>{t("locationAssignmentTitle")}</CardTitle>
              <CardDescription>{t("warehouseLocationAssignmentStatus")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">{t("failedLoadLocationData")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : t("anErrorOccurred")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty/no data state
  if (!data || data.totalBoxes === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>{t("locationAssignmentTitle")}</CardTitle>
              <CardDescription>{t("warehouseLocationAssignmentStatus")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetEmptyState
            icon={MapPin}
            title={t("noBoxesInSystem")}
            description={t("noLocationDataAvailable")}
          />
        </CardContent>
      </Card>
    );
  }

  const assignmentPercent = data.assignmentPercent;
  const isLowAssignment = assignmentPercent < 80;
  const isMediumAssignment = assignmentPercent >= 80 && assignmentPercent < 95;

  // Determine status color
  const statusConfig = {
    label: isLowAssignment ? t("poor") : isMediumAssignment ? t("good") : t("excellent"),
    color: isLowAssignment
      ? "text-red-600"
      : isMediumAssignment
        ? "text-amber-600"
        : "text-green-600",
    bgColor: isLowAssignment
      ? "bg-red-100 text-red-700"
      : isMediumAssignment
        ? "bg-amber-100 text-amber-700"
        : "bg-green-100 text-green-700",
    progressColor: isLowAssignment
      ? "bg-red-500"
      : isMediumAssignment
        ? "bg-amber-500"
        : "bg-green-500",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <CardTitle>{t("locationAssignmentTitle")}</CardTitle>
            <CardDescription>{t("warehouseLocationAssignmentStatus")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Low Assignment Alert */}
        {isLowAssignment && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {t("boxesAssignedAlert", { value: assignmentPercent.toFixed(1) })}
            </AlertDescription>
          </Alert>
        )}

        {/* Assignment Percentage */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{t("assignmentRate")}</span>
            <span className={cn("text-xl sm:text-2xl font-bold", statusConfig.color)}>
              {assignmentPercent.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", statusConfig.progressColor)}
              style={{ width: `${assignmentPercent}%` }}
            />
          </div>
          <div className="flex justify-center">
            <div className={cn("rounded-full px-3 py-1 text-xs font-semibold", statusConfig.bgColor)}>
              {statusConfig.label}
            </div>
          </div>
        </div>

        {/* Box Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-lg border bg-muted/50 p-2 sm:p-3 text-center">
            <div className="text-xs text-muted-foreground">{t("total")}</div>
            <p className="mt-1 text-base sm:text-lg font-bold">{data.totalBoxes}</p>
          </div>
          <div className="rounded-lg border bg-muted/50 p-2 sm:p-3 text-center">
            <div className="text-xs text-muted-foreground">{t("assigned")}</div>
            <p className="mt-1 text-base sm:text-lg font-bold text-green-600">{data.assignedBoxes}</p>
          </div>
          <div className="rounded-lg border bg-muted/50 p-2 sm:p-3 text-center">
            <div className="text-xs text-muted-foreground">{t("unassigned")}</div>
            <p className="mt-1 text-base sm:text-lg font-bold text-red-600">{data.unassignedBoxes}</p>
          </div>
        </div>

        {/* Assignment Breakdown */}
        <div className="space-y-2 rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 text-green-600" />
              <span>{t("locationsAssigned")}</span>
            </div>
            <span className="font-semibold text-green-600">
              {t("boxesCount", { count: data.assignedBoxes })}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4 text-red-600" />
              <span>{t("needAssignment")}</span>
            </div>
            <span className="font-semibold text-red-600">
              {t("boxesCount", { count: data.unassignedBoxes })}
            </span>
          </div>
        </div>

        {/* View Unassigned Button */}
        {data.unassignedBoxes > 0 && (
          <Button asChild variant="default" className="w-full">
            <Link href="/purchasing/grns?tab=unassigned-boxes">
              <Package className="mr-2 h-4 w-4" />
              {t("viewUnassignedBoxes", { count: data.unassignedBoxes })}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}

        {/* Recommendations */}
        {isLowAssignment && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-800">{t("recommendations")}:</p>
            <ul className="mt-1 space-y-1 text-xs text-amber-700">
              <li>• {t("assignLocationsImproveTracking")}</li>
              <li>• {t("useBatchAssignmentForEfficiency")}</li>
              <li>• {t("reviewWarehouseLayoutOptimization")}</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
