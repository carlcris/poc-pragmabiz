import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { WarehouseLocation } from "@/types/inventory-location";
import { WarehouseLocationMobileList } from "./WarehouseLocationMobileList";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (value: number) => String(value) }),
}));

const location: WarehouseLocation = {
  id: "location-1",
  companyId: "company-1",
  warehouseId: "warehouse-1",
  code: "Z01",
  name: "Zone 1",
  locationPath: "MAIN / Z01",
  locationType: "zone",
  isPickable: true,
  isStorable: true,
  isActive: true,
  subtreeQuantity: 12.5,
  createdAt: "",
  updatedAt: "",
};

const render = (isSearching: boolean) =>
  renderToStaticMarkup(
    <WarehouseLocationMobileList
      locations={[location]}
      isSearching={isSearching}
      onOpenLocation={vi.fn()}
      getLocationTypeLabel={(type) => `type-${type}`}
      formatCapacity={() => "3 / 10"}
      renderOccupancy={() => "Partial · 30%"}
      renderActionsMenu={(row) => <span data-menu={row.id} />}
    />
  );

it("keeps every table column in the stacked row", () => {
  const html = render(false);
  for (const text of [
    "Z01",
    "Zone 1",
    "type-zone",
    "useStoreAndPick",
    "active",
    "capacity",
    "3 / 10",
    "subtreeQuantity",
    "12.5",
    "occupancy",
    "Partial · 30%",
    'data-menu="location-1"',
  ]) {
    expect(html).toContain(text);
  }
  expect(html).not.toContain("MAIN / Z01");
});

it("shows the location path while searching", () => {
  expect(render(true)).toContain("MAIN / Z01");
});
