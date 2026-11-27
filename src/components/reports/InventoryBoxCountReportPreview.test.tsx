import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { translations } from "@/lib/i18n/translations";
import type { InventoryBoxCountPackingUnitsResponse } from "@/types/inventory-box-count-report";
import { InventoryBoxCountBusinessUnitSelect } from "./InventoryBoxCountBusinessUnitSelect";
import { InventoryBoxCountPackingUnitSelect } from "./InventoryBoxCountPackingUnitSelect";
import { InventoryBoxCountReportPreview } from "./InventoryBoxCountReportPreview";

const state = vi.hoisted(() => ({
  lookup: vi.fn(),
  businessUnits: {
    currentBusinessUnit: null as {
      id: string;
      name: string;
      company_id: string;
      is_active: boolean;
    } | null,
    isLoading: false,
    isSwitching: false,
  },
  auth: {
    user: { id: "user-id", companyId: "company-id" },
    isAuthenticated: true,
    isLoggingOut: false,
  },
}));

vi.mock("@/hooks/useInventoryBoxCountPackingUnits", () => ({
  useInventoryBoxCountPackingUnits: state.lookup,
  INVENTORY_BOX_COUNT_UNIT_SEARCH_MAX_LENGTH: 100,
}));
vi.mock("@/components/items/ItemCategorySelect", () => ({
  ItemCategorySelect: () => <button type="button">Category</button>,
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (select: (s: typeof state.auth) => unknown) => select(state.auth),
}));
vi.mock("@/stores/businessUnitStore", () => ({
  useBusinessUnitStore: (select: (s: typeof state.businessUnits) => unknown) =>
    select(state.businessUnits),
}));

const box = { id: "box-id", code: "BOX", name: "Standard box" };
const pack = { id: "pack-id", code: "PACK", name: "Pack" };
const firstPage = {
  data: [pack],
  pagination: { page: 1, limit: 5, total: 12, totalPages: 3 },
  defaultUnit: box,
} satisfies InventoryBoxCountPackingUnitsResponse;

function renderReport(element: ReactNode) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider
        locale="en"
        timeZone="Asia/Manila"
        messages={{
          businessUnitSelect: translations.en.businessUnitSelect,
          common: translations.en.common,
          reportsPage: translations.en.reportsPage,
          inventoryBoxCountReport: translations.en.inventoryBoxCountReport,
        }}
      >
        {element}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  state.businessUnits.currentBusinessUnit = null;
  state.lookup.mockReturnValue({ data: { pages: [firstPage] } });
});

it("selects BOX from the server default even when it is outside the returned option page", () => {
  const markup = renderReport(
    <InventoryBoxCountReportPreview
      open
      reportName={translations.en.reportsPage.inventoryBoxCountName}
      onPreviewStateChange={vi.fn()}
    />
  );
  expect(markup).toContain('for="inventory-box-count-calculation-unit">Unit</label>');
  expect(markup).toContain("Standard box (BOX)");
  expect(markup).not.toContain("Select unit");
});

it("leaves the unit unselected when the company has no BOX default", () => {
  state.lookup.mockReturnValue({ data: { pages: [{ ...firstPage, defaultUnit: null }] } });
  const markup = renderReport(
    <InventoryBoxCountReportPreview
      open
      reportName={translations.en.reportsPage.inventoryBoxCountName}
      onPreviewStateChange={vi.fn()}
    />
  );
  expect(markup).toContain("Select unit");
  expect(markup).not.toContain("Standard box (BOX)");
});

it("keeps the selected unit label when the displayed option page omits it", () => {
  state.lookup.mockReturnValue({ data: { pages: [{ ...firstPage, data: [box] }] } });
  const markup = renderReport(
    <InventoryBoxCountPackingUnitSelect
      id="calculation-unit"
      companyId="company-id"
      value={pack}
      onValueChange={vi.fn()}
      enabled
      disabled={false}
    />
  );
  expect(markup).toContain("Pack (PACK)");
});

it("defaults to the active business unit before any lookup page is available", () => {
  state.businessUnits.currentBusinessUnit = {
    id: "current-unit",
    company_id: "company-id",
    is_active: true,
    name: "Current warehouse",
  };
  const markup = renderReport(
    <InventoryBoxCountReportPreview
      open
      reportName={translations.en.reportsPage.inventoryBoxCountName}
      onPreviewStateChange={vi.fn()}
    />
  );
  expect(markup).toContain('for="inventory-box-count-business-unit">Business Unit</label>');
  expect(markup).toContain("Current warehouse");
});

it.each([
  { selection: null, label: "All accessible business units" },
  { selection: { id: "later-page", name: "Later warehouse" }, label: "Later warehouse" },
])("displays $label independently of the loaded lookup pages", ({ selection, label }) => {
  const markup = renderReport(
    <InventoryBoxCountBusinessUnitSelect
      id="business-unit"
      companyId="company-id"
      value={selection}
      onValueChange={vi.fn()}
      enabled
      disabled={false}
    />
  );
  expect(markup).toContain(label);
});
