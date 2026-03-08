"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { PackageCheck, Clock, ArrowRight, Loader2, PlayCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTodaysReceivingQueue } from "@/hooks/usePurchasingDashboard";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { WidgetEmptyState } from "./WidgetEmptyState";

type TodaysReceivingQueueWidgetProps = {
  warehouseId?: string;
  businessUnitId?: string;
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  arrived: { label: "Arrived", className: "bg-amber-100 text-amber-700 border-amber-200" },
  receiving: { label: "Receiving", className: "bg-purple-100 text-purple-700 border-purple-200" },
};

export function TodaysReceivingQueueWidget({
  warehouseId,
  businessUnitId,
}: TodaysReceivingQueueWidgetProps) {
  const t = useTranslations("purchasingOverviewWidgets");
  const { data, isLoading, error } = useTodaysReceivingQueue({
    warehouseId,
    businessUnitId,
  });

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>{t("todaysReceivingQueueTitle")}</CardTitle>
              <CardDescription>{t("loadListsArrivedToday")}</CardDescription>
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
            <PackageCheck className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>{t("todaysReceivingQueueTitle")}</CardTitle>
              <CardDescription>{t("loadListsArrivedToday")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">{t("failedLoadReceivingQueue")}</p>
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
            <PackageCheck className="h-5 w-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <CardTitle>{t("todaysReceivingQueueTitle")}</CardTitle>
              <CardDescription>{t("loadListsArrivedToday")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <WidgetEmptyState
            icon={PackageCheck}
            title={t("noItemsInReceivingQueue")}
            description={t("noLoadListsArrivedToday")}
          />
        </CardContent>
      </Card>
    );
  }

  // Sort: "arrived" status first (needs to be started), then "receiving" (in progress)
  const sortedItems = [...data.items].sort((a, b) => {
    if (a.status === "arrived" && b.status === "receiving") return -1;
    if (a.status === "receiving" && b.status === "arrived") return 1;
    return 0;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-muted-foreground" />
          <div className="flex flex-col gap-1">
            <CardTitle>{t("todaysReceivingQueueTitle")}</CardTitle>
            <CardDescription>{t("loadListsArrivedToday")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total Count */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-4 w-4" />
              <span>{t("toReceive")}</span>
            </div>
            <span className="text-xl sm:text-2xl font-bold text-right text-primary">{data.count}</span>
          </div>
        </div>

        {/* Queue Items */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{t("queue")}</p>
          <div className="space-y-2">
            {sortedItems.map((item) => {
              const statusConfig = STATUS_CONFIG[item.status] || {
                label: item.status,
                className: "bg-gray-100 text-gray-700 border-gray-200",
              };
              const isArrived = item.status === "arrived";

              return (
                <Link
                  key={item.id}
                  href={`/tablet/receiving/${item.id}`}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50",
                    isArrived && "border-l-4 border-l-amber-500"
                  )}
                >
                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{item.ll_number}</span>
                      {isArrived && (
                        <Badge variant="outline" className="gap-1 text-xs flex-shrink-0">
                          <Clock className="h-3 w-3" />
                          {t("pending")}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate">
                      {item.supplier?.supplier_name || t("unknownSupplier")}
                    </span>
                    {item.actual_arrival_date && (
                      <span className="text-xs text-muted-foreground">
                        {t("arrived")}: {format(parseISO(item.actual_arrival_date), "h:mm a")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-3 flex-shrink-0">
                    <Badge className={statusConfig.className}>{statusConfig.label}</Badge>
                    <Button size="sm" variant={isArrived ? "default" : "outline"}>
                      {isArrived ? (
                        <>
                          <PlayCircle className="mr-1 h-3.5 w-3.5" />
                          {t("start")}
                        </>
                      ) : (
                        t("resume")
                      )}
                    </Button>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* View All Link */}
        <Button asChild variant="outline" className="w-full">
          <Link href="/tablet/receiving">
            {t("viewAllReceiving")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
