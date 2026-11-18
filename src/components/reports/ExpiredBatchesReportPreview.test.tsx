import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExpiredBatchesReportPreview } from "./ExpiredBatchesReportPreview";
import {
  REPORT_PREVIEW_CONTENT_CLASS_NAME,
  REPORT_PREVIEW_GRID_CLASS_NAME,
} from "./report-preview-layout";
import type { ExpiredBatchesFilters } from "@/types/expired-batches-report";
const state = vi.hoisted(() => ({
  query: vi.fn((_filters: unknown, _enabled?: boolean) => ({
    refetch: vi.fn(),
    isFetching: false,
  })),
}));
vi.mock("@/hooks/useExpiredBatchesReport", () => ({ useExpiredBatchesReport: state.query }));
vi.mock("@/stores/businessUnitStore", () => ({ useBusinessUnitStore: () => "bu" }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/components/warehouses/WarehouseSelect", () => ({
  WarehouseSelect: () => <div>warehouse selector</div>,
}));
vi.mock("@/components/items/ItemCategorySelect", () => ({
  ItemCategorySelect: () => <div>category selector</div>,
}));
vi.mock("./ReportItemSelect", () => ({
  ReportItemSelect: () => <div>item selector</div>,
}));
vi.mock("./ReportPreviewFrame", () => ({
  ReportPreviewFrame: () => <div>PDF placeholder</div>,
  useReportPdfPreviewState: () => ({
    previewUrl: null,
    isGeneratingPreview: false,
    replacePreviewUrl: vi.fn(),
    setIsGeneratingPreview: vi.fn(),
  }),
}));
beforeEach(() => {
  state.query.mockClear();
});
it("uses the settings/sidebar PDF flow with only a disabled export query", () => {
  const html = renderToStaticMarkup(
    <ExpiredBatchesReportPreview open reportName="Expired Batches" onPreviewStateChange={vi.fn()} />
  );
  expect(html).toContain(REPORT_PREVIEW_GRID_CLASS_NAME);
  expect(html).toContain(REPORT_PREVIEW_CONTENT_CLASS_NAME);
  expect(html).toContain("reportSettings");
  expect(html).toContain("PDF placeholder");
  expect(html).not.toContain("<table");
  expect(html).toContain("item selector");
  expect(state.query).toHaveBeenCalledTimes(1);
  expect(state.query).toHaveBeenCalledWith(
    expect.objectContaining({ exportMode: "pdf", groupBy: "item", page: 1 }),
    false
  );
});
it("filters by item id instead of a prose search term", () => {
  renderToStaticMarkup(
    <ExpiredBatchesReportPreview open reportName="Expired Batches" onPreviewStateChange={vi.fn()} />
  );
  const filters = state.query.mock.lastCall?.[0] as ExpiredBatchesFilters;
  // The item selector owns item filtering now. A leftover `search` filter would
  // keep sending the removed prose term to the report endpoint.
  expect(filters).not.toHaveProperty("search");
  expect(filters).toHaveProperty("itemId", undefined);
});
