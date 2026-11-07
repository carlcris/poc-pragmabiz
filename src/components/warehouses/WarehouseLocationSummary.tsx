"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Ban, CheckCircle2, Copy, MoreVertical, Pencil } from "lucide-react";
import {
  getWarehouseLocationRestrictionMessage,
  getWarehouseLocationRestrictions,
} from "@/lib/warehouse-location-restrictions";
import {
  formatWarehouseLocationNamePath,
  getWarehouseLocationDisplayName,
  getWarehouseLocationUse,
  isWarehouseLocationType,
  warehouseLocationTypeLabelKeys,
  warehouseLocationUseLabelKeys,
} from "@/lib/warehouse-location-form";
import { cn } from "@/lib/utils";
import { StatusText } from "@/components/shared/StatusText";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WarehouseLocationDetail } from "@/types/inventory-location";

type WarehouseLocationSummaryProps = {
  location: WarehouseLocationDetail;
  canEdit: boolean;
  isToggling: boolean;
  onEdit: () => void;
  onMove: () => void;
  onCopy?: () => void;
  onToggleActive: (isActive: boolean) => void;
};

export function WarehouseLocationSummary({
  location,
  canEdit,
  isToggling,
  onEdit,
  onMove,
  onCopy,
  onToggleActive,
}: WarehouseLocationSummaryProps) {
  const t = useTranslations("warehouseLocationsPage");
  const format = useFormatter();
  const restrictions = getWarehouseLocationRestrictions(location);
  const restrictionText = (
    reason: Parameters<typeof getWarehouseLocationRestrictionMessage>[0]
  ) => {
    const message = getWarehouseLocationRestrictionMessage(reason, location);
    return t(message.key, message.values);
  };
  const toggleReason = location.isActive ? restrictions.disable : restrictions.enable;
  const quantity = (value: number) => format.number(value, { maximumFractionDigits: 2 });
  const stats = [
    {
      label: t("use"),
      value: t(warehouseLocationUseLabelKeys[getWarehouseLocationUse(location)]),
    },
    { label: t("stockHere"), value: quantity(location.directOnHand) },
    { label: t("includingSublocations"), value: quantity(location.subtreeOnHand) },
    { label: t("sublocationCount"), value: format.number(location.childCount) },
  ];

  return (
    <Card aria-labelledby="selected-location-title">
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-48 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="selected-location-title" className="text-lg font-semibold">
                {getWarehouseLocationDisplayName(location)}
              </h2>
              <Badge variant="secondary">
                {isWarehouseLocationType(location.locationType)
                  ? t(warehouseLocationTypeLabelKeys[location.locationType])
                  : location.locationType}
              </Badge>
              <StatusText tone={location.isActive ? "green" : "muted"}>
                {location.isActive ? t("active") : t("inactive")}
              </StatusText>
            </div>
            <p className="break-words text-sm text-muted-foreground">
              {t("locationPath")}:{" "}
              <span className="text-foreground">
                {formatWarehouseLocationNamePath(location.ancestors, location)}
              </span>
            </p>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                {t("edit")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={Boolean(restrictions.move)}
                aria-describedby={restrictions.move ? "selected-location-move-reason" : undefined}
                onClick={onMove}
              >
                {t("move")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label={t("moreActionsFor", { code: location.code })}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-w-xs">
                  {onCopy ? (
                    <DropdownMenuItem onClick={onCopy}>
                      <Copy className="h-4 w-4" />
                      <span>{t("copyStructure")}</span>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    disabled={Boolean(toggleReason) || isToggling}
                    onClick={() => onToggleActive(!location.isActive)}
                    className={cn(
                      "items-start",
                      location.isActive && "text-destructive focus:text-destructive"
                    )}
                  >
                    {location.isActive ? (
                      <Ban className="mt-0.5 h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4" />
                    )}
                    <span className="flex flex-col">
                      <span>{location.isActive ? t("disable") : t("enable")}</span>
                      {toggleReason ? (
                        <span className="text-xs text-muted-foreground">
                          {restrictionText(toggleReason)}
                        </span>
                      ) : null}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg bg-muted/50 px-3 py-2">
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="text-sm font-semibold tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
        {canEdit && restrictions.move ? (
          <p id="selected-location-move-reason" className="text-xs text-muted-foreground">
            {t("moveUnavailable", { reason: restrictionText(restrictions.move) })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
