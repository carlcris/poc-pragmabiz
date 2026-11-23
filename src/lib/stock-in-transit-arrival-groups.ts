import type { StockInTransitArrivalRow } from "@/types/stock-in-transit";

export type StockInTransitArrivalGroup = {
  key: string;
  estimatedArrivalDate: string | null;
  daysUntilArrival: number | null;
  arrivalWindow: StockInTransitArrivalRow["arrivalWindow"];
  totalBaseQuantity: number;
  orderedUnitTotals: StockInTransitArrivalRow["arrivalOrderedUnitTotals"];
  shipmentCount: number;
  containerCount: number;
  destinationTotals: StockInTransitArrivalRow["arrivalDestinationTotals"];
  shipments: StockInTransitArrivalRow[];
};

/** Groups server-ordered shipments by ETA while keeping complete date totals across pages. */
export function groupStockInTransitArrivals(
  rows: StockInTransitArrivalRow[]
): StockInTransitArrivalGroup[] {
  const groups = new Map<string, StockInTransitArrivalGroup>();

  for (const row of rows) {
    const key = row.estimatedArrivalDate ?? "no-eta";
    const group = groups.get(key);
    if (group) {
      group.shipments.push(row);
      continue;
    }
    groups.set(key, {
      key,
      estimatedArrivalDate: row.estimatedArrivalDate,
      daysUntilArrival: row.daysUntilArrival,
      arrivalWindow: row.arrivalWindow,
      totalBaseQuantity: row.arrivalBaseQuantity,
      orderedUnitTotals: row.arrivalOrderedUnitTotals,
      shipmentCount: row.arrivalShipmentCount,
      containerCount: row.arrivalContainerCount,
      destinationTotals: row.arrivalDestinationTotals,
      shipments: [row],
    });
  }

  return Array.from(groups.values());
}
