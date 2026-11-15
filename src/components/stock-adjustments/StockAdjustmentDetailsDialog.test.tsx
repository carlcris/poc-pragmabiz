import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import { translations } from "@/lib/i18n/translations";
import type { StockAdjustment } from "@/types/stock-adjustment";
import { StockAdjustmentDetailsDialog } from "./StockAdjustmentDetailsDialog";

const state = vi.hoisted(() => ({
  useStockAdjustment: vi.fn(),
  refetch: vi.fn(),
  retryActions: [] as Array<() => void>,
}));

vi.mock("@/hooks/useStockAdjustments", () => ({ useStockAdjustment: state.useStockAdjustment }));
vi.mock("@/components/ui/dialog", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: ({ children, open }: { children?: ReactNode; open: boolean }) =>
      open ? <div role="dialog">{children}</div> : null,
    DialogContent: Container,
    DialogDescription: Container,
    DialogFooter: Container,
    DialogHeader: Container,
    DialogTitle: Container,
  };
});
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children?: ReactNode; onClick: () => void }) => {
    state.retryActions.push(onClick);
    return <button type="button">{children}</button>;
  },
}));

const renderDetails = (locale: "en" | "zh") =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={translations[locale]} timeZone="Asia/Manila">
      <StockAdjustmentDetailsDialog
        selection={{ id: "adjustment", adjustmentCode: "SA-00125" }}
        onOpenChange={vi.fn()}
        onEdit={vi.fn()}
        onPrintBatchLabel={vi.fn()}
        formatCurrency={String}
      />
    </NextIntlClientProvider>
  );

beforeEach(() => {
  state.refetch.mockReset();
  state.retryActions.length = 0;
});

it.each(["en", "zh"] as const)(
  "lets users retry the detail query after it fails in %s",
  (locale) => {
    state.useStockAdjustment.mockReturnValue({
      data: undefined,
      isError: true,
      isFetching: false,
      refetch: state.refetch,
    });

    const html = renderDetails(locale);

    expect(state.useStockAdjustment).toHaveBeenLastCalledWith("adjustment");
    expect(html).toContain("SA-00125");
    expect(html).toContain('role="alert"');
    expect(html).toContain(translations[locale].stockAdjustmentsPage.retryLoadingDetails);
    expect(state.retryActions).toHaveLength(1);
    state.retryActions[0]?.();
    expect(state.refetch).toHaveBeenCalledTimes(1);
  }
);

it("shows the retry action after a failed refresh of cached details", () => {
  const cachedAdjustment: StockAdjustment = {
    id: "adjustment",
    companyId: "company",
    adjustmentCode: "SA-00125",
    adjustmentType: "physical_count",
    adjustmentDate: "2026-11-15",
    warehouseId: "warehouse",
    status: "draft",
    reason: "Original reason",
    totalValue: 0,
    createdBy: "user",
    updatedBy: "user",
    createdAt: "2026-11-15T00:00:00Z",
    updatedAt: "2026-11-15T00:00:00Z",
    items: [],
  };
  const query = {
    data: cachedAdjustment,
    isError: true,
    isFetching: false,
    refetch: state.refetch,
  };
  state.useStockAdjustment.mockReturnValue(query);
  state.refetch.mockImplementation(() => {
    state.useStockAdjustment.mockReturnValue({
      ...query,
      isError: false,
      data: { ...cachedAdjustment, reason: "Updated reason" },
    });
  });

  const messages = translations.en.stockAdjustmentsPage;
  const failed = renderDetails("en");
  expect(failed).toContain('role="alert"');
  expect(failed).toContain(messages.retryLoadingDetails);
  expect(failed).not.toContain("Original reason");
  expect(state.retryActions).toHaveLength(1);
  state.retryActions[0]?.();
  expect(state.refetch).toHaveBeenCalledTimes(1);

  const recovered = renderDetails("en");
  expect(recovered).toContain("Updated reason");
  expect(recovered).not.toContain("Original reason");
  expect(recovered).not.toContain(messages.retryLoadingDetails);
});
