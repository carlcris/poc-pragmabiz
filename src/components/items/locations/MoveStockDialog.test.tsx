import type { ItemLocation } from "@/types/inventory-location";
import type { ItemUnitOption } from "@/types/item";
import type { ReactNode, ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translations } from "@/lib/i18n/translations";
import { MoveStockDialog } from "./MoveStockDialog";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "zh",
  sourceData: undefined as { data: ItemLocation[] } | undefined,
  error: null as Error | null,
  isPending: false,
  values: [] as string[],
  index: 0,
  mutate: vi.fn(),
  submit: undefined as (() => void) | undefined,
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: state.sourceData }) }));
vi.mock("@/stores/businessUnitStore", () => ({ useBusinessUnitStore: () => "bu" }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => actual.useState(state.values[state.index++] ?? initial),
  };
});
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: ComponentProps<"button">) => {
    if (children === "Move Stock")
      state.submit = () => onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    return <button {...props}>{children}</button>;
  },
}));
vi.mock("@/hooks/useMoveStock", () => ({
  useMoveStock: () => ({
    error: state.error,
    isPending: state.isPending,
    reset: vi.fn(),
    mutate: state.mutate,
  }),
}));
vi.mock("next-intl", () => ({
  useTranslations:
    () =>
    (
      key: keyof typeof translations.en.itemLocationsTab,
      values?: Record<string, string | number>
    ) =>
      Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        translations[state.locale].itemLocationsTab[key]
      ),
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

const box: ItemUnitOption = {
  id: "box",
  itemId: "item",
  uomId: "box-uom",
  uomCode: "BOX",
  uomName: "Box",
  displayLabel: "BOX (144 PCS)",
  qtyPerUnit: 144,
  barcode: "box",
  isBase: false,
  isDefault: false,
  isActive: true,
  sortOrder: 1,
};
const sourceLocation: ItemLocation = {
  id: "source",
  itemId: "11111111-1111-4111-8111-111111111111",
  warehouseId: "11111111-1111-4111-8111-111111111112",
  locationId: "11111111-1111-4111-8111-111111111114",
  warehouseCode: "WH",
  warehouseName: "Warehouse",
  locationCode: "FROM",
  locationPath: "FROM - Source",
  locationNamePath: "Source",
  warehouseOnHand: 58,
  batchCount: 1,
  batchPage: 1,
  batchPageSize: 20,
  pathIds: ["11111111-1111-4111-8111-111111111114"],
  locationName: "Source",
  locationType: "rack",
  qtyOnHand: 1000,
  qtyReserved: 0,
  qtyAvailable: 1000,
};
const renderDialog = (
  unitOptions = [box],
  sourceLocations: ItemLocation[] | null = [sourceLocation]
) => {
  state.index = 0;
  return renderToStaticMarkup(
    <MoveStockDialog
      itemId="11111111-1111-4111-8111-111111111111"
      baseUnit="PCS"
      unitOptions={unitOptions}
      sourceLocations={sourceLocations ?? undefined}
      onOpenChange={() => {}}
    />
  );
};
const setQuantity = (quantity: string, unit = "base") => {
  state.values = [
    "11111111-1111-4111-8111-111111111112",
    "11111111-1111-4111-8111-111111111113",
    "11111111-1111-4111-8111-111111111114",
    "11111111-1111-4111-8111-111111111115",
    quantity,
    unit,
  ];
};
beforeEach(() => {
  state.locale = "en";
  state.values = [];
  state.mutate.mockClear();
  state.submit = undefined;
  state.sourceData = undefined;
  state.error = null;
  state.isPending = false;
});

describe("Move Stock dialog", () => {
  it("blocks one box of 144 when the source has only 58 base units", () => {
    setQuantity("1", "box");
    const html = renderDialog([box], [{ ...sourceLocation, qtyOnHand: 58, qtyAvailable: 58 }]);
    expect(html).toContain("Total quantity: 144 PCS");
    expect(html).toContain("Available at source: 58 PCS");
    expect(html).toMatch(/disabled=""[^>]*>Move Stock/);
    state.submit?.();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it.each(["5", "58"])("allows %s base units from a source with 58", (quantity) => {
    setQuantity(quantity);
    renderDialog([box], [{ ...sourceLocation, qtyOnHand: 58, qtyAvailable: 58 }]);
    state.submit?.();
    expect(state.mutate).toHaveBeenCalled();
  });
  it("uses available stock rather than reserved on-hand stock", () => {
    setQuantity("58");
    renderDialog([box], [{ ...sourceLocation, qtyOnHand: 58, qtyReserved: 8, qtyAvailable: 50 }]);
    state.submit?.();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("does not use stock from another rack or warehouse", () => {
    setQuantity("1", "box");
    renderDialog(
      [box],
      [
        { ...sourceLocation, locationId: "other-rack" },
        { ...sourceLocation, warehouseId: "other-warehouse" },
      ]
    );
    state.submit?.();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("loads availability for a source outside the visible location page", () => {
    setQuantity("5");
    state.sourceData = { data: [{ ...sourceLocation, qtyAvailable: 58 }] };
    renderDialog([box], []);
    state.submit?.();
    expect(state.mutate).toHaveBeenCalled();
  });
  it("blocks submission when source availability cannot be loaded", () => {
    setQuantity("5");
    expect(renderDialog([box], null)).toContain("Source stock is unavailable");
    state.submit?.();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it.each([
    ["2", "box", 288],
    ["5", "base", 5],
    ["0.1", "box", 14.4],
  ])("submits %s in %s as %s base units", (quantity, unit, expected) => {
    setQuantity(quantity, unit);
    expect(renderDialog()).toContain(`Total quantity: ${expected} PCS`);
    state.submit?.();
    expect(state.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ itemId: "11111111-1111-4111-8111-111111111111", quantity: expected }],
      }),
      expect.any(Object)
    );
  });
  it.each(["0", "-2", "0.001", "10000000"])("blocks invalid quantity %s", (quantity) => {
    setQuantity(quantity, "box");
    expect(renderDialog()).toContain('role="alert"');
    state.submit?.();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("rejects fractional base quantities without silently rounding", () => {
    setQuantity("0.01", "box");
    renderDialog([{ ...box, qtyPerUnit: 1.5 }]);
    state.submit?.();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("blocks a selected unit that is no longer active", () => {
    setQuantity("2", "box");
    renderDialog([{ ...box, isActive: false }]);
    state.submit?.();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("allows base-unit moves without alternate units", () => {
    setQuantity("5");
    renderDialog([]);
    state.submit?.();
    expect(state.mutate).toHaveBeenCalled();
  });
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

  it.each([
    [
      "en",
      "expiration date",
      "unset expiration date",
      "correct any inaccurate records",
      "select another warehouse",
    ],
    ["zh", "有效期不同", "一方未设置有效期", "更正不准确的记录", "选择其他仓库"],
  ] as const)(
    "explains expiration-only batch conflicts in %s",
    (locale, mismatch, unset, correction, alternative) => {
      state.locale = locale;
      state.error = new Error("safe fallback", { cause: { code: "STOCK_MOVE_BATCH_CONFLICT" } });
      const html = renderDialog();
      expect(html).toContain('role="alert"');
      expect(html).toContain(mismatch);
      expect(html).toContain(unset);
      expect(html).toContain(correction);
      expect(html).toContain(alternative);
      expect(html).toContain('id="move-stock-quantity"');
      expect(html).not.toContain("safe fallback");
    }
  );

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
