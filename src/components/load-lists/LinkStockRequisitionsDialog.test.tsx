import type { ComponentProps, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import { translations } from "@/lib/i18n/translations";
import type {
  EligibleLoadListRequisitionItem,
  EligibleLoadListRequisitionItemFilters,
  LoadList,
} from "@/types/load-list";
import { LinkStockRequisitionsDialog } from "./LinkStockRequisitionsDialog";

type SelectProps = {
  children: ReactNode;
  value: string;
  disabled?: boolean;
  onValueChange: (id: string) => void;
};

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
  options: [] as SelectProps[],
  query: vi.fn(),
  isPlaceholderData: false,
  nextPage: undefined as (() => void) | undefined,
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

vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("@/hooks/useDebouncedValue", () => ({ useDebouncedValue: (value: string) => value }));
vi.mock("@/hooks/useLoadLists", () => ({
  useEligibleLoadListRequisitionItems: (
    id: string,
    filters: EligibleLoadListRequisitionItemFilters
  ) => {
    state.query(id, filters);
    return {
      data: {
        data: [requisitionLine(50), requisitionLine(144)],
        pagination: { total: 21, page: filters.page ?? 1, limit: 20, totalPages: 2 },
      },
      isPlaceholderData: state.isPlaceholderData,
    };
  },
  useLinkSRsToLoadList: () => ({ isPending: false }),
  useRemoveLoadListSRLink: () => ({ isPending: false }),
  useLoadListSRLinks: () => ({ data: { data: [] } }),
}));

vi.mock("@/components/ui/dialog", () => {
  const passThrough = ({ children }: { children: ReactNode }) => children;
  return {
    Dialog: passThrough,
    DialogContent: passThrough,
    DialogTitle: passThrough,
    DialogDescription: passThrough,
  };
});

vi.mock("@/components/ui/select", () => ({
  Select: (props: SelectProps) => {
    state.options.push(props);
    return props.children;
  },
  SelectContent: ({ children }: { children: ReactNode }) => children,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <span data-option-value={value}>{children}</span>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => {
    if (children === "Next") state.nextPage = onClick;
    return <button>{children}</button>;
  },
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: ComponentProps<"input">) => <input {...props} />,
}));

const item = { id: "item", code: "PM057MR000", name: "Moulding" };
const pack = (qtyPerUnit: number) => ({
  itemId: item.id,
  itemUnitOptionId: `box-${qtyPerUnit}`,
  unitName: `BOX (${qtyPerUnit})`,
  qtyPerUnit,
});
const requisitionLine = (qtyPerUnit: number): EligibleLoadListRequisitionItem => ({
  ...pack(qtyPerUnit),
  id: `requisition-${qtyPerUnit}`,
  stockRequisitionId: "requisition",
  stockRequisitionNumber: "SR-0001",
  stockRequisitionStatus: "submitted",
  requisitionDate: "2026-11-23",
  itemCode: item.code,
  itemName: item.name,
  requestedQty: 50,
  fulfilledQty: 0,
  outstandingQty: 50,
});
const loadList: LoadList = {
  id: "load-list",
  llNumber: "LL-0001",
  companyId: "company",
  sourceBusinessUnitId: "source",
  destinationBusinessUnitId: "destination",
  supplierId: "supplier",
  isSourceBusinessUnit: true,
  isTargetBusinessUnit: false,
  status: "in_transit",
  currency: "PHP",
  items: [50, 144].map((qtyPerUnit) => ({
    ...pack(qtyPerUnit),
    id: `load-list-${qtyPerUnit}`,
    loadListId: "load-list",
    item,
    loadListQty: 50,
    unitPrice: null,
    totalPrice: null,
  })),
  createdBy: "user",
  createdAt: "2026-11-23",
  updatedAt: "2026-11-23",
};

const render = () => {
  state.index = 0;
  state.options = [];
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={translations.en} timeZone="Asia/Manila">
      <LinkStockRequisitionsDialog open onOpenChange={() => {}} loadList={loadList} />
    </NextIntlClientProvider>
  );
};

beforeEach(() => {
  state.values = [];
  state.query.mockClear();
  state.isPlaceholderData = false;
});

it("browses supplier lines initially and resets paging to select only the matching pack", () => {
  const initial = render();
  expect(initial).toContain("BOX (50)");
  expect(initial).toContain("BOX (144)");
  expect(state.query).toHaveBeenLastCalledWith("load-list", {
    loadListItemId: undefined,
    limit: 20,
    page: 1,
    search: undefined,
  });
  state.nextPage?.();
  render();
  expect(state.query).toHaveBeenLastCalledWith("load-list", expect.objectContaining({ page: 2 }));

  state.options[0].onValueChange("load-list-50");
  state.isPlaceholderData = true;
  expect(render()).not.toContain('data-option-value="requisition-50"');
  expect(state.options[1].disabled).toBe(true);
  expect(state.query).toHaveBeenLastCalledWith(
    "load-list",
    expect.objectContaining({ loadListItemId: "load-list-50", page: 1 })
  );

  state.isPlaceholderData = false;
  const box50 = render();
  expect(box50).toContain('data-option-value="requisition-50"');
  expect(box50).not.toContain('data-option-value="requisition-144"');
  state.options[1].onValueChange("requisition-50");
  render();
  expect(state.options[1].value).toBe("requisition-50");

  state.options[0].onValueChange("load-list-144");
  const box144 = render();
  expect(box144).not.toContain('data-option-value="requisition-50"');
  expect(box144).toContain('data-option-value="requisition-144"');
  expect(state.options[1].value).toBe("");
});
