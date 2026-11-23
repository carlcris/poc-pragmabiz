import { expect, it } from "vitest";
import { groupStockInTransitArrivals } from "./stock-in-transit-arrival-groups";
import type { StockInTransitArrivalRow } from "@/types/stock-in-transit";

const arrival = (
  loadListId: string,
  estimatedArrivalDate: string | null,
  arrivalShipmentCount: number
): StockInTransitArrivalRow => ({
  loadListId,
  loadListNumber: loadListId,
  supplierName: "Supplier",
  sourceBusinessUnitId: "source",
  destinationBusinessUnitId: "destination",
  destinationBusinessUnitName: "Destination",
  estimatedArrivalDate,
  daysUntilArrival: estimatedArrivalDate ? 5 : null,
  arrivalWindow: estimatedArrivalDate ? "next_7_days" : "no_eta",
  linerName: null,
  containerNumber: null,
  baseQuantity: 10,
  orderedUnitTotals: [{ unitName: "Box", quantity: 1, quantityPerUnit: 10 }],
  arrivalBaseQuantity: 30,
  arrivalOrderedUnitTotals: [
    { unitName: "Box", quantity: 2, quantityPerUnit: 10 },
    { unitName: "Carton", quantity: 1, quantityPerUnit: 10 },
  ],
  arrivalShipmentCount,
  arrivalContainerCount: 0,
  arrivalDestinationTotals: [],
});

it("keeps server order and complete date totals when a date spans loaded pages", () => {
  const groups = groupStockInTransitArrivals([
    arrival("first", "2026-11-27", 3),
    arrival("second", "2026-11-27", 3),
    arrival("no-date", null, 1),
  ]);

  expect(groups.map((group) => group.key)).toEqual(["2026-11-27", "no-eta"]);
  expect(groups[0].shipments.map((shipment) => shipment.loadListId)).toEqual(["first", "second"]);
  expect(groups[0]).toMatchObject({
    shipmentCount: 3,
    totalBaseQuantity: 30,
    orderedUnitTotals: [
      { unitName: "Box", quantity: 2, quantityPerUnit: 10 },
      { unitName: "Carton", quantity: 1, quantityPerUnit: 10 },
    ],
  });
});
