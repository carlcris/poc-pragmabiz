import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Warehouse } from "@/types/warehouse";
import { WarehouseMobileList } from "./WarehouseMobileList";

const permissions = vi.hoisted(() => ({ canViewLocations: true }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}));
vi.mock("@/hooks/usePermissions", () => ({
  useCanView: () => permissions.canViewLocations,
  usePermissions: () => ({ can: () => true, isLoading: false }),
}));

const warehouse: Warehouse = {
  id: "warehouse-1",
  companyId: "company-1",
  code: "WH-BU01",
  name: "Main Warehouse",
  description: "",
  address: "",
  city: "Malolos City",
  state: "Region III",
  postalCode: "",
  country: "Philippines",
  phone: "+63 900 000 0000",
  email: "main@example.com",
  managerName: "Juan Dela Cruz",
  isActive: true,
  isVan: false,
  createdAt: "",
  updatedAt: "",
};

const render = () =>
  renderToStaticMarkup(
    <WarehouseMobileList
      warehouses={[warehouse]}
      onEditWarehouse={vi.fn()}
      onDeleteWarehouse={vi.fn()}
      isDeletePending={false}
    />
  );

beforeEach(() => {
  permissions.canViewLocations = true;
});

it("keeps every table column in the stacked row", () => {
  const html = render();
  for (const text of [
    "Main Warehouse",
    "WH-BU01",
    "active",
    "Malolos City, Region III",
    "Philippines",
    "Juan Dela Cruz",
    "+63 900 000 0000",
    "main@example.com",
  ]) {
    expect(html).toContain(text);
  }
  expect(html).toContain('aria-label="moreActionsFor:Main Warehouse"');
});

it("opens Locations from the row only when the user can view locations", () => {
  expect(render()).toContain('href="/inventory/warehouses/warehouse-1/locations"');
  permissions.canViewLocations = false;
  expect(render()).not.toContain("/locations");
});
