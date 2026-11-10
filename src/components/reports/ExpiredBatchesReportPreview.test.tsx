import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExpiredBatchesReportPreview } from "./ExpiredBatchesReportPreview";
const state = vi.hoisted(() => ({ query: vi.fn(() => ({ refetch: vi.fn(), isFetching: false })) }));
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
vi.mock("./ReportPreviewFrame", () => ({
  ReportPreviewFrame: () => <div>PDF placeholder</div>,
  useReportPdfPreviewState: () => ({
    previewUrl: null,
    isGeneratingPreview: false,
    replacePreviewUrl: vi.fn(),
    setIsGeneratingPreview: vi.fn(),
  }),
}));
it("uses the settings/sidebar PDF flow with only a disabled export query", () => {
  const html = renderToStaticMarkup(
    <ExpiredBatchesReportPreview open reportName="Expired Batches" onPreviewStateChange={vi.fn()} />
  );
  expect(html).toContain("lg:grid-cols-4");
  expect(html).toContain("lg:col-span-3");
  expect(html).toContain("reportSettings");
  expect(html).toContain("PDF placeholder");
  expect(html).not.toContain("<table");
  expect(state.query).toHaveBeenCalledTimes(1);
  expect(state.query).toHaveBeenCalledWith(
    expect.objectContaining({ exportMode: "pdf", groupBy: "item", page: 1 }),
    false
  );
});
