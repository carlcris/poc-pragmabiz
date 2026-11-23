import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { expect, it, vi } from "vitest";
import { translations } from "@/lib/i18n/translations";
import type {
  StockInTransitArrivalWindowOrderedUnitTotals,
  StockInTransitArrivalWindowTotals,
  StockInTransitItemRow,
  StockInTransitOrderedUnitTotal,
} from "@/types/stock-in-transit";
import { StockInTransitItemDetail } from "./StockInTransitItemDetail";

const arrivals = vi.hoisted(() => ({ summary: {} as Record<string, unknown> }));

vi.mock("@/hooks/useStockInTransitItemArrivals", () => ({
  useStockInTransitItemArrivals: () => ({
    isPending: false,
    isError: false,
    hasNextPage: false,
    data: { pages: [{ data: [], summary: arrivals.summary }] },
  }),
}));
vi.mock("@/hooks/usePermissions", () => ({ useCanView: () => false }));
vi.mock("@/stores/businessUnitStore", () => ({
  useBusinessUnitStore: (selector: (state: { isSwitching: boolean }) => unknown) =>
    selector({ isSwitching: true }),
}));

const boxTotal: StockInTransitOrderedUnitTotal = {
  unitName: "BOX (144)",
  quantity: 100,
  quantityPerUnit: 144,
};
const stickTotal: StockInTransitOrderedUnitTotal = {
  unitName: "STICK",
  quantity: 10,
  quantityPerUnit: 1,
};

const renderDetail = (
  orderedUnitTotals: StockInTransitOrderedUnitTotal[],
  totalBaseQuantity: number,
  shipmentCount: number,
  arrivalWindowTotals: StockInTransitArrivalWindowTotals,
  arrivalWindowOrderedUnitTotals: StockInTransitArrivalWindowOrderedUnitTotals
) => {
  arrivals.summary = { arrivalWindowTotals, arrivalWindowOrderedUnitTotals };
  const item: StockInTransitItemRow = {
    itemId: "item",
    itemCode: "PM057WT000",
    itemName: "Picture Frame Moulding",
    baseUnitName: "Stick",
    totalBaseQuantity,
    orderedUnitTotals,
    shipmentCount,
    nextEstimatedArrivalDate: "2026-11-16",
    nextDaysUntilArrival: -7,
    nextArrivalWindow: "late",
  };

  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={translations.en} timeZone="Asia/Manila">
      <StockInTransitItemDetail item={item} isEnabled />
    </NextIntlClientProvider>
  );
};

it("hides the arrival mix base quantity only when it repeats the ordered quantity", () => {
  const markup = renderDetail(
    [boxTotal, stickTotal],
    14_410,
    2,
    { late: 10, next_7_days: 14_400, days_8_to_14: 0, later: 0, no_eta: 0 },
    { late: [stickTotal], next_7_days: [boxTotal], days_8_to_14: [], later: [], no_eta: [] }
  );

  expect(markup).toContain("14,410 Stick in transit on 2 load lists");
  expect(markup).toContain(">10 STICK<");
  expect(markup).not.toContain("(10 Stick)");
  expect(markup).toContain("(14,400 Stick)");
});

it("keeps the load list count when the item total is already in the base unit", () => {
  const markup = renderDetail(
    [stickTotal],
    10,
    1,
    { late: 10, next_7_days: 0, days_8_to_14: 0, later: 0, no_eta: 0 },
    { late: [stickTotal], next_7_days: [], days_8_to_14: [], later: [], no_eta: [] }
  );

  expect(markup).toContain("In transit on 1 load list");
  expect(markup).not.toContain("10 Stick");
});

it("displays different pack sizes with matching unit labels in the item total and arrival mix", () => {
  const boxTotals = [
    { unitName: "BOX", quantity: 5, quantityPerUnit: 72 },
    { unitName: "BOX", quantity: 2, quantityPerUnit: 144 },
  ];
  const markup = renderDetail(
    boxTotals,
    648,
    2,
    { late: 0, next_7_days: 648, days_8_to_14: 0, later: 0, no_eta: 0 },
    { late: [], next_7_days: boxTotals, days_8_to_14: [], later: [], no_eta: [] }
  );

  expect(markup).toContain(">5 BOX (72) + 2 BOX (144)<");
  expect(markup).toContain("648 Stick in transit on 2 load lists");
  expect(markup).toContain("Next 7 Days 5 BOX (72) + 2 BOX (144)");
});
