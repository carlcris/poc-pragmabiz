import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translations } from "@/lib/i18n/translations";
import { MoveStockDialog } from "./MoveStockDialog";

const state = vi.hoisted(() => ({ error: null as Error | null, isPending: false }));
vi.mock("@/hooks/useMoveStock", () => ({
  useMoveStock: () => ({
    error: state.error,
    isPending: state.isPending,
    reset: vi.fn(),
    mutate: vi.fn(),
  }),
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: keyof typeof translations.en.itemLocationsTab) =>
    translations.en.itemLocationsTab[key],
}));
vi.mock("@/components/warehouses/WarehouseSelect", () => ({
  WarehouseSelect: ({ scope, disabled }: { scope: string; disabled: boolean }) => (
    <button disabled={disabled}>{scope}</button>
  ),
}));
vi.mock("@/components/warehouses/WarehouseLocationSelect", () => ({
  WarehouseLocationSelect: () => <div>rack-selector</div>,
}));
vi.mock("@/components/ui/dialog", () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Container,
    DialogContent: Container,
    DialogHeader: Container,
    DialogTitle: Container,
    DialogDescription: Container,
    DialogFooter: Container,
  };
});

const renderDialog = () =>
  renderToStaticMarkup(<MoveStockDialog itemId="item" baseUnit="PCS" onOpenChange={() => {}} />);
beforeEach(() => {
  state.error = null;
  state.isPending = false;
});

describe("Move Stock dialog", () => {
  it("offers separate warehouses scoped to the current business unit", () => {
    const html = renderDialog();
    expect(html).toContain("Source Warehouse");
    expect(html).toContain("Destination Warehouse");
    expect(html.match(/current_business_unit/g)).toHaveLength(2);
    expect(html).toContain("same business unit");
  });

  it("renders recoverable stock conflicts inline from the preserved API code", () => {
    state.error = new Error("safe fallback", { cause: { code: "STOCK_MOVE_INSUFFICIENT_STOCK" } });
    const html = renderDialog();
    expect(html).toContain('role="alert"');
    expect(html).toContain("reduce the quantity, or select another source");
    expect(html).toContain("Source Warehouse");
  });

  it("keeps unexpected exception text out of the dialog", () => {
    state.error = new Error("private database exception");
    expect(renderDialog()).toContain("Failed to move stock");
    expect(renderDialog()).not.toContain("private database exception");
  });

  it("disables editing and cancel while a move is pending", () => {
    state.isPending = true;
    const html = renderDialog();
    expect(html).toContain('id="move-stock-quantity"');
    expect(html).toMatch(/disabled=""[^>]*>Cancel/);
    expect(html).toMatch(/disabled=""[^>]*>Moving/);
  });
});
