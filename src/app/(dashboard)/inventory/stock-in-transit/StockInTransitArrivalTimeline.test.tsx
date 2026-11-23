import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import { translations } from "@/lib/i18n/translations";
import { groupStockInTransitArrivals } from "@/lib/stock-in-transit-arrival-groups";
import type { StockInTransitArrivalRow } from "@/types/stock-in-transit";
import { StockInTransitArrivalTimeline } from "./StockInTransitArrivalTimeline";

vi.mock("@/hooks/usePermissions", () => ({ useCanView: () => false }));
vi.mock("@/stores/businessUnitStore", () => ({
  useBusinessUnitStore: (selector: (state: { isSwitching: boolean }) => unknown) =>
    selector({ isSwitching: true }),
}));

const shipment = (
  loadListNumber: string,
  orderedUnitTotals: StockInTransitArrivalRow["orderedUnitTotals"],
  baseQuantity: number
): StockInTransitArrivalRow => ({
  loadListId: loadListNumber,
  loadListNumber,
  supplierName: "Supplier",
  sourceBusinessUnitId: "source",
  destinationBusinessUnitId: "main",
  destinationBusinessUnitName: "Main",
  estimatedArrivalDate: "2026-11-27",
  daysUntilArrival: 4,
  arrivalWindow: "next_7_days",
  linerName: "Liner",
  containerNumber: `${loadListNumber}-CONTAINER`,
  baseQuantity,
  orderedUnitTotals,
  arrivalBaseQuantity: 14_410,
  arrivalOrderedUnitTotals: [
    { unitName: "BOX (144)", quantity: 100, quantityPerUnit: 144 },
    { unitName: "STICK", quantity: 10, quantityPerUnit: 1 },
  ],
  arrivalShipmentCount: 2,
  arrivalContainerCount: 2,
  arrivalDestinationTotals: [
    {
      destinationBusinessUnitId: "main",
      destinationBusinessUnitName: "Main",
      baseQuantity: 14_410,
      orderedUnitTotals: [
        { unitName: "BOX (144)", quantity: 100, quantityPerUnit: 144 },
        { unitName: "STICK", quantity: 10, quantityPerUnit: 1 },
      ],
    },
  ],
});

it("shows mixed ordered units before the combined base quantity", () => {
  const markup = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={translations.en} timeZone="Asia/Manila">
      <StockInTransitArrivalTimeline
        unitName="Stick"
        groups={groupStockInTransitArrivals([
          shipment(
            "LL-1",
            [{ unitName: "BOX (144)", quantity: 100, quantityPerUnit: 144 }],
            14_400
          ),
          shipment("LL-2", [{ unitName: "STICK", quantity: 10, quantityPerUnit: 1 }], 10),
        ])}
      />
    </NextIntlClientProvider>
  );

  const groupOrdered = markup.indexOf("100 BOX (144) + 10 STICK");
  const groupBase = markup.indexOf("14,410 Stick");
  const shipmentOrdered = markup.indexOf(">100 BOX (144)<");
  const shipmentBase = markup.indexOf("14,400 Stick");

  expect(groupOrdered).toBeGreaterThan(-1);
  expect(groupBase).toBeGreaterThan(groupOrdered);
  expect(markup).toContain("Main 100 BOX (144) + 10 STICK");
  expect(shipmentOrdered).toBeGreaterThan(groupBase);
  expect(shipmentBase).toBeGreaterThan(shipmentOrdered);
  expect(markup).toContain(">10 STICK<");
  expect(markup).not.toContain(">10 Stick<");
});
