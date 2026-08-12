"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { InventoryReservationStatus } from "@/types/inventory-reservations";

const statusBadgeConfig: Record<
  InventoryReservationStatus,
  { className: string; dotColor: string }
> = {
  active: {
    className: "border-blue-200 bg-blue-50 text-blue-700",
    dotColor: "bg-blue-500",
  },
  partial: {
    className: "border-amber-200 bg-amber-50 text-amber-700",
    dotColor: "bg-amber-500",
  },
  consumed: {
    className: "border-green-200 bg-green-50 text-green-700",
    dotColor: "bg-green-500",
  },
  released: {
    className: "border-slate-200 bg-slate-50 text-slate-700",
    dotColor: "bg-slate-500",
  },
  transferred: {
    className: "border-violet-200 bg-violet-50 text-violet-700",
    dotColor: "bg-violet-500",
  },
  closed: {
    className: "border-slate-200 bg-slate-50 text-slate-600",
    dotColor: "bg-slate-400",
  },
};

export function InventoryReservationQuantity({ value, unit }: { value: number; unit: string }) {
  const locale = useLocale();

  return (
    <div className="text-right tabular-nums">
      <div className="font-semibold">
        {value.toLocaleString(locale, { maximumFractionDigits: 2 })}
      </div>
      <div className="text-xs text-muted-foreground">{unit}</div>
    </div>
  );
}

export function InventoryReservationStatusText({
  status,
}: {
  status: InventoryReservationStatus;
}) {
  const t = useTranslations("inventoryReservationsPage");
  const label = (() => {
    switch (status) {
      case "active":
        return t("status.active");
      case "partial":
        return t("status.partial");
      case "consumed":
        return t("status.consumed");
      case "released":
        return t("status.released");
      case "transferred":
        return t("status.transferred");
      case "closed":
        return t("status.closed");
    }
  })();

  const config = statusBadgeConfig[status];

  return (
    <Badge variant="outline" className={`gap-1.5 font-medium ${config.className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotColor}`} />
      {label}
    </Badge>
  );
}

export function InventoryReservationUpdatedAt({ value }: { value: string }) {
  const locale = useLocale();
  const date = new Date(value);

  return (
    <div className="tabular-nums">
      <div className="font-medium">{date.toLocaleDateString(locale)}</div>
      <div className="text-xs text-muted-foreground">{date.toLocaleTimeString(locale)}</div>
    </div>
  );
}
