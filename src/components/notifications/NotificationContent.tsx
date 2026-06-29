"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Notification, ReorderAlertNotificationMetadata } from "@/types/notifications";

type NotificationContentProps = {
  notification: Notification;
  compact?: boolean;
};

const isReorderAlertMetadata = (
  metadata: unknown
): metadata is ReorderAlertNotificationMetadata => {
  if (!metadata || typeof metadata !== "object") return false;

  const value = metadata as Record<string, unknown>;
  return (
    value.category === "reorder_alert" &&
    typeof value.reorderAlertKey === "string" &&
    typeof value.itemId === "string" &&
    typeof value.itemName === "string" &&
    (value.severity === "critical" || value.severity === "warning") &&
    typeof value.availableStock === "number" &&
    Number.isFinite(value.availableStock) &&
    typeof value.reorderPoint === "number" &&
    Number.isFinite(value.reorderPoint) &&
    value.scope === "all_warehouses" &&
    value.alertStatus === "active"
  );
};

export function NotificationContent({
  notification,
  compact = false,
}: NotificationContentProps) {
  const t = useTranslations("notificationsPage");
  const format = useFormatter();

  let title = notification.title;
  let message = notification.message;

  if (notification.type === "reorder_alert") {
    if (isReorderAlertMetadata(notification.metadata)) {
      const availableStock = format.number(notification.metadata.availableStock, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const reorderPoint = format.number(notification.metadata.reorderPoint, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const isStockout = notification.metadata.availableStock <= 0;

      title = isStockout
        ? t("reorderStockoutTitle")
        : notification.metadata.severity === "critical"
          ? t("reorderCriticalTitle")
          : t("reorderTitle");
      message = isStockout
        ? t("reorderStockoutMessage", {
            itemName: notification.metadata.itemName,
            availableStock,
          })
        : t("reorderBelowPointMessage", {
            itemName: notification.metadata.itemName,
            availableStock,
            reorderPoint,
          });
    } else {
      title = t("reorderTitle");
      message = t("reorderFallbackMessage");
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{title}</span>
        {!notification.is_read && (
          <Badge className="bg-blue-600 text-[10px] hover:bg-blue-700">{t("new")}</Badge>
        )}
      </div>
      <p className={cn(compact ? "text-xs" : "text-sm", "text-muted-foreground")}>{message}</p>
    </>
  );
}
