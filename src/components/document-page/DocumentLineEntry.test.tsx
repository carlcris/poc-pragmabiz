import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import { translations } from "@/lib/i18n/translations";
import type { DocumentFormLine } from "@/types/document-line";
import { DocumentLineEntry } from "./DocumentLineEntry";

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
  selectItem: undefined as ((id: string) => void) | undefined,
  selectUnit: undefined as ((id: string) => void) | undefined,
  changeQuantity: undefined as ((event: { target: { value: string } }) => void) | undefined,
  add: undefined as (() => void) | undefined,
}));

vi.mock("react", async (load) => ({
  ...(await load<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = state.index++;
    if (!(index in state.values)) state.values[index] = initial;
    return [
      state.values[index],
      (update: unknown) => {
        state.values[index] = typeof update === "function" ? update(state.values[index]) : update;
      },
    ];
  },
}));

vi.mock("@/components/shared/AsyncSearchCombobox", () => ({
  AsyncSearchCombobox: ({ onValueChange }: { onValueChange: (id: string) => void }) => {
    state.selectItem = onValueChange;
    return null;
  },
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
  }: {
    children: ReactNode;
    onValueChange: (id: string) => void;
  }) => {
    state.selectUnit = onValueChange;
    return children;
  },
  SelectTrigger: ({ "aria-invalid": invalid }: { "aria-invalid": boolean }) => (
    <button
      role="combobox"
      aria-controls="pack-options"
      aria-expanded={false}
      aria-invalid={invalid}
    />
  ),
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({ onChange }: { onChange: typeof state.changeQuantity }) => {
    state.changeQuantity = onChange;
    return null;
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => {
    state.add = onClick;
    return <button>{children}</button>;
  },
}));

vi.mock("@/hooks/useDebouncedValue", () => ({ useDebouncedValue: (value: string) => value }));
vi.mock("@/hooks/useCurrency", () => ({
  useCurrency: () => ({ currentCurrency: { code: "PHP" } }),
}));
vi.mock("@/hooks/useItems", () => {
  const item = {
    id: "item",
    code: "PM057MR000",
    name: "Moulding",
    isActive: true,
    purchasePrice: 1.08,
  };
  const pack = (qtyPerUnit: number) => ({
    id: `box-${qtyPerUnit}`,
    uomId: "box",
    uomCode: "BOX",
    uomName: "BOX",
    optionLabel: `BOX (${qtyPerUnit})`,
    qtyPerUnit,
    isActive: true,
  });
  return {
    useItems: () => ({ data: { data: [item] }, isLoading: false }),
    useItem: (id: string) => ({
      data: id === item.id ? { data: { ...item, unitOptions: [pack(50), pack(144)] } } : undefined,
    }),
  };
});

beforeEach(() => {
  state.values = [];
});

it("accepts distinct packs for the same item and clears the duplicate error when the pack changes", () => {
  const existingItemUnitOptionIds = new Set<string>();
  const onAdd = vi.fn((line: DocumentFormLine) =>
    existingItemUnitOptionIds.add(line.itemUnitOptionId)
  );
  const render = () => {
    state.index = 0;
    return renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={translations.en} timeZone="Asia/Manila">
        <DocumentLineEntry
          columns={["item", "unit", "qty", "totalQty", "action"]}
          canViewUnitCost={false}
          lockedCurrency={null}
          mixedCurrencyMessage={translations.en.stockRequisitionPage.mixedCurrencyNotAllowed}
          existingItemUnitOptionIds={existingItemUnitOptionIds}
          linesError={null}
          itemTriggerRef={{ current: null }}
          onAdd={onAdd}
          onEntryChange={() => {}}
        />
      </NextIntlClientProvider>
    );
  };
  render();
  state.selectItem?.("item");
  render();
  state.selectUnit?.("box-50");
  state.changeQuantity?.({ target: { value: "50" } });
  expect(render()).toContain("2,500");
  state.add?.();
  expect(onAdd).toHaveBeenCalledWith(
    expect.objectContaining({ itemId: "item", itemUnitOptionId: "box-50", qtyPerUnit: 50 }),
    null
  );

  render();
  state.selectItem?.("item");
  render();
  state.selectUnit?.("box-50");
  const rejected = render();
  expect(rejected).toContain("PM057MR000 already has a line for BOX (50).");
  expect(rejected).toContain('aria-invalid="true"');
  state.changeQuantity?.({ target: { value: "100" } });
  render();
  state.add?.();
  expect(onAdd).toHaveBeenCalledTimes(1);

  state.selectUnit?.("box-144");
  const differentPack = render();
  expect(differentPack).toContain("14,400");
  expect(differentPack).not.toContain("already has a line");
  state.add?.();
  expect(onAdd).toHaveBeenLastCalledWith(
    expect.objectContaining({ itemId: "item", itemUnitOptionId: "box-144", qtyPerUnit: 144 }),
    null
  );
});
