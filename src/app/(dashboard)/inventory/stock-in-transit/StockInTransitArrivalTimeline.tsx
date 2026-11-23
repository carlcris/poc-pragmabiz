import Link from "next/link";
import { useTranslations } from "next-intl";
import { RESOURCES } from "@/constants/resources";
import { useCanView } from "@/hooks/usePermissions";
import type { StockInTransitArrivalGroup } from "@/lib/stock-in-transit-arrival-groups";
import { cn } from "@/lib/utils";
import { useBusinessUnitStore } from "@/stores/businessUnitStore";
import type { StockInTransitArrivalRow } from "@/types/stock-in-transit";
import { ARRIVAL_WINDOW_STYLES, useArrivalLabels } from "./useArrivalLabels";

type StockInTransitArrivalTimelineProps = {
  groups: StockInTransitArrivalGroup[];
  unitName: string;
};

type ArrivalShipmentEntryProps = {
  shipment: StockInTransitArrivalRow;
  unitName: string;
  canViewLoadLists: boolean;
  currentBusinessUnitId?: string;
  isGrouped?: boolean;
};

function ArrivalShipmentEntry({
  shipment,
  unitName,
  canViewLoadLists,
  currentBusinessUnitId,
  isGrouped = false,
}: ArrivalShipmentEntryProps) {
  const t = useTranslations("stockInTransitPage");
  const { formatDistinctBaseQuantity, formatOrderedQuantities } = useArrivalLabels();
  const baseQuantity = formatDistinctBaseQuantity(
    shipment.orderedUnitTotals,
    shipment.baseQuantity,
    unitName
  );
  const canOpenLoadList =
    canViewLoadLists &&
    (currentBusinessUnitId === shipment.sourceBusinessUnitId ||
      currentBusinessUnitId === shipment.destinationBusinessUnitId);
  const numberClassName = cn("tabular-nums", isGrouped ? "font-medium" : "font-semibold");

  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        {canOpenLoadList ? (
          <Link
            href={`/purchasing/load-lists/${shipment.loadListId}`}
            className={cn(
              numberClassName,
              "min-w-0 truncate text-violet-700 hover:underline dark:text-violet-300"
            )}
          >
            {shipment.loadListNumber}
          </Link>
        ) : (
          <span className={cn(numberClassName, "min-w-0 truncate")}>{shipment.loadListNumber}</span>
        )}
        <span
          className={cn(
            "ml-auto min-w-0 text-right font-semibold tabular-nums",
            !isGrouped && "text-base"
          )}
        >
          {formatOrderedQuantities(shipment.orderedUnitTotals)}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="min-w-0 text-sm text-muted-foreground">
          {t("supplierToDestination", {
            supplier: shipment.supplierName,
            destination: shipment.destinationBusinessUnitName ?? t("notAvailable"),
          })}
        </p>
        {baseQuantity && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {baseQuantity}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("shipmentDetails", {
          container: shipment.containerNumber ?? t("noContainer"),
          liner: shipment.linerName ?? t("noLiner"),
        })}
      </p>
    </div>
  );
}

export function StockInTransitArrivalTimeline({
  groups,
  unitName,
}: StockInTransitArrivalTimelineProps) {
  const t = useTranslations("stockInTransitPage");
  const canViewLoadLists = useCanView(RESOURCES.LOAD_LISTS);
  const currentBusinessUnitId = useBusinessUnitStore((state) =>
    state.isSwitching ? undefined : state.currentBusinessUnit?.id
  );
  const {
    formatArrivalDate,
    formatDistinctBaseQuantity,
    formatOrderedQuantities,
    formatRelativeArrival,
  } = useArrivalLabels();

  return (
    <ol className="flex flex-col">
      {groups.map((group) => {
        const style = ARRIVAL_WINDOW_STYLES[group.arrivalWindow];
        const date = group.estimatedArrivalDate
          ? formatArrivalDate(group.estimatedArrivalDate)
          : t("noEta");
        const countLabel =
          group.containerCount === group.shipmentCount
            ? t("containerCount", { count: group.shipmentCount })
            : t("shipmentCount", { count: group.shipmentCount });
        const groupBaseQuantity = formatDistinctBaseQuantity(
          group.orderedUnitTotals,
          group.totalBaseQuantity,
          unitName
        );

        return (
          <li key={group.key} className="flex gap-2 sm:gap-3">
            <div className="w-20 shrink-0 py-3 text-right sm:w-24">
              <div className="text-sm font-semibold">{date}</div>
              <div className={cn("text-xs font-medium", style.text)}>
                {formatRelativeArrival(group.daysUntilArrival)}
              </div>
            </div>
            <div aria-hidden="true" className="relative flex w-4 shrink-0 justify-center">
              <span className="absolute inset-y-0 w-0.5 bg-border" />
              <span
                className={cn("relative mt-4 h-3 w-3 rounded-full ring-2 ring-card", style.marker)}
              />
            </div>
            <div className="min-w-0 flex-1 border-b py-3">
              {group.shipmentCount === 1 ? (
                <ArrivalShipmentEntry
                  shipment={group.shipments[0]}
                  unitName={unitName}
                  canViewLoadLists={canViewLoadLists}
                  currentBusinessUnitId={currentBusinessUnitId}
                />
              ) : (
                <div className="space-y-3">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <span className="font-semibold">{countLabel}</span>
                      <span className="ml-auto min-w-0 text-right text-base font-semibold tabular-nums">
                        {formatOrderedQuantities(group.orderedUnitTotals)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="min-w-0 text-sm tabular-nums text-muted-foreground">
                        {group.destinationTotals
                          .map((destination) =>
                            t("destinationQuantity", {
                              destination:
                                destination.destinationBusinessUnitName ?? t("notAvailable"),
                              quantity: formatOrderedQuantities(destination.orderedUnitTotals),
                            })
                          )
                          .join(" · ")}
                      </p>
                      {groupBaseQuantity && (
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {groupBaseQuantity}
                        </span>
                      )}
                    </div>
                  </div>
                  <ul
                    aria-label={t("sameDateShipments", { count: group.shipmentCount, date })}
                    className="flex flex-col gap-3.5"
                  >
                    {group.shipments.map((shipment) => (
                      <li key={shipment.loadListId}>
                        <ArrivalShipmentEntry
                          shipment={shipment}
                          unitName={unitName}
                          canViewLoadLists={canViewLoadLists}
                          currentBusinessUnitId={currentBusinessUnitId}
                          isGrouped
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
