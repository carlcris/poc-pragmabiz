import {
  Children,
  isValidElement,
  type ChangeEvent,
  type ComponentProps,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, expect, it, vi } from "vitest";
import { translations } from "@/lib/i18n/translations";
import type {
  CreateLoadListSRLinkRequest,
  EligibleLoadListRequisitionItem,
  EligibleLoadListRequisitionItemFilters,
  EligibleLoadListRequisitionItemsResponse,
  LoadList,
} from "@/types/load-list";
import { LinkStockRequisitionsDialog } from "./LinkStockRequisitionsDialog";

type DialogButton = Pick<ComponentProps<"button">, "children" | "disabled" | "aria-current"> & {
  onClick: () => void | Promise<void>;
};

type RequisitionCheckbox = {
  id: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
  "aria-label": string;
};

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
  itemButtons: [] as DialogButton[],
  query: vi.fn(),
  buttons: new Map<string, DialogButton>(),
  checkboxes: new Map<string, RequisitionCheckbox>(),
  inputs: new Map<string, ComponentProps<"input">>(),
  createLinks: vi.fn<
    (request: { id: string; data: CreateLoadListSRLinkRequest }) => Promise<{
      linksCreated: number;
      message: string;
    }>
  >(),
  onOpenChange: vi.fn(),
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
    filters: EligibleLoadListRequisitionItemFilters,
    enabled: boolean
  ) => {
    state.query(id, filters, enabled);
    const selected = loadList.items?.find((item) => item.id === filters.loadListItemId);
    const matchingLines =
      enabled && selected
        ? requisitionItems.filter(
            (line) =>
              line.itemId === selected.itemId && line.itemUnitOptionId === selected.itemUnitOptionId
          )
        : [];
    const { page = 1, limit = 20 } = filters;
    const data: EligibleLoadListRequisitionItemsResponse = {
      data: matchingLines.slice((page - 1) * limit, page * limit),
      pagination: {
        total: matchingLines.length,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(matchingLines.length / limit)),
      },
    };
    return { data, isFetching: false };
  },
  useLinkSRsToLoadList: () => ({ isPending: false, mutateAsync: state.createLinks }),
  useRemoveLoadListSRLink: () => ({ isPending: false }),
  useLoadListSRLinks: () => ({ data: { data: [] } }),
}));

vi.mock("@/components/ui/dialog", () => {
  const passThrough = ({ children }: { children: ReactNode }) => children;
  const captureItemButtons = (children: ReactNode) => {
    Children.forEach(children, (child) => {
      if (!isValidElement<DialogButton>(child)) return;
      if (child.type === "button") state.itemButtons.push(child.props);
      captureItemButtons(child.props.children);
    });
  };
  return {
    Dialog: passThrough,
    DialogContent: ({ children }: { children: ReactNode }) => {
      captureItemButtons(children);
      return children;
    },
    DialogTitle: passThrough,
    DialogDescription: passThrough,
  };
});

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: (props: RequisitionCheckbox) => {
    state.checkboxes.set(props.id, props);
    return (
      <input
        type="checkbox"
        id={props.id}
        aria-label={props["aria-label"]}
        checked={props.checked}
        disabled={props.disabled}
        readOnly
      />
    );
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: (props: DialogButton) => {
    if (typeof props.children === "string") state.buttons.set(props.children, props);
    return <button disabled={props.disabled}>{props.children}</button>;
  },
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: ComponentProps<"input">) => {
    if (props["aria-label"]) state.inputs.set(props["aria-label"], props);
    return <input {...props} />;
  },
}));

const item = { id: "item", code: "PM057WT000", name: "057-02Q" };
const otherItem = { id: "other-item", code: "PM05710MR0", name: "057-10 MRN" };
const pack = (qtyPerUnit: number) => ({
  itemId: item.id,
  itemUnitOptionId: `box-${qtyPerUnit}`,
  unitName: `BOX (${qtyPerUnit})`,
  qtyPerUnit,
});
const otherItemPack = {
  ...pack(144),
  itemId: otherItem.id,
  itemUnitOptionId: "other-box-144",
};
const requisitionLine = (
  qtyPerUnit: number,
  requestedQty: number,
  reference: number
): EligibleLoadListRequisitionItem => ({
  ...pack(qtyPerUnit),
  id: `requisition-line-${reference}`,
  stockRequisitionId: `requisition-${reference}`,
  stockRequisitionNumber: `SRQ-${String(reference).padStart(6, "0")}`,
  stockRequisitionStatus: "submitted",
  requisitionDate: "2026-11-23",
  itemCode: item.code,
  itemName: item.name,
  requestedQty,
  fulfilledQty: 0,
  outstandingQty: requestedQty,
});
const box50Line = requisitionLine(50, 10, 10);
const box144Line = requisitionLine(144, 100, 11);
const otherItemLine = {
  ...requisitionLine(144, 15, 12),
  ...otherItemPack,
  itemCode: otherItem.code,
  itemName: otherItem.name,
};
const requisitionItems = [
  box50Line,
  box144Line,
  otherItemLine,
  ...Array.from({ length: 20 }, (_, index) => requisitionLine(50, 5, index + 20)),
];
const loadList: LoadList = {
  id: "load-list",
  llNumber: "LL-000011",
  companyId: "company",
  sourceBusinessUnitId: "source",
  destinationBusinessUnitId: "destination",
  supplierId: "supplier",
  isSourceBusinessUnit: true,
  isTargetBusinessUnit: false,
  status: "in_transit",
  currency: "PHP",
  items: [
    { ...pack(50), id: "load-list-50", item, loadListQty: 50 },
    { ...pack(144), id: "load-list-144", item, loadListQty: 100 },
    { ...otherItemPack, id: "load-list-other-144", item: otherItem, loadListQty: 10 },
  ].map((line) => ({
    ...line,
    loadListId: "load-list",
    unitPrice: null,
    totalPrice: null,
  })),
  createdBy: "user",
  createdAt: "2026-11-23",
  updatedAt: "2026-11-23",
};

const render = (locale: "en" | "zh" = "en") => {
  state.index = 0;
  state.itemButtons = [];
  state.buttons.clear();
  state.checkboxes.clear();
  state.inputs.clear();
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={translations[locale]} timeZone="Asia/Manila">
      <LinkStockRequisitionsDialog open onOpenChange={state.onOpenChange} loadList={loadList} />
    </NextIntlClientProvider>
  );
};

const itemButton = (itemCode: string, packLabel: string) => {
  const label = `${itemCode} · ${packLabel}`;
  const button = state.itemButtons.find(({ children }) =>
    renderToStaticMarkup(<>{children}</>).includes(label)
  );
  if (!button) throw new Error(`Missing load list item button for ${label}`);
  return button;
};

const button = (label: string) => {
  const control = state.buttons.get(label);
  if (!control) throw new Error(`Missing dialog button ${label}`);
  return control;
};

const checkbox = (line: EligibleLoadListRequisitionItem) => {
  const control = state.checkboxes.get(`link-line-${line.id}`);
  if (!control) throw new Error(`Missing checkbox for ${line.stockRequisitionNumber}`);
  return control;
};

beforeEach(() => {
  state.values = [];
  state.query.mockClear();
  state.createLinks.mockReset();
  state.createLinks.mockResolvedValue({ linksCreated: 3, message: "Created" });
  state.onOpenChange.mockClear();
});

it("automatically selects the first item and resets pack-scoped pagination when the item changes", () => {
  render();
  expect(itemButton(item.code, "BOX (50)")["aria-current"]).toBe("true");
  expect(itemButton(item.code, "BOX (144)")["aria-current"]).toBeUndefined();
  expect(state.query).toHaveBeenLastCalledWith(
    "load-list",
    { loadListItemId: "load-list-50", limit: 20, page: 1, search: undefined },
    true
  );
  expect(checkbox(box50Line).checked).toBe(false);
  expect(state.checkboxes.size).toBe(20);
  expect(state.checkboxes.has(`link-line-${box144Line.id}`)).toBe(false);

  expect(button("Next").disabled).toBe(false);
  button("Next").onClick();
  render();
  expect(state.query).toHaveBeenLastCalledWith(
    "load-list",
    expect.objectContaining({ loadListItemId: "load-list-50", page: 2 }),
    true
  );
  expect([...state.checkboxes.keys()]).toEqual(["link-line-requisition-line-39"]);

  itemButton(item.code, "BOX (144)").onClick();
  render();
  expect(state.query).toHaveBeenLastCalledWith(
    "load-list",
    { loadListItemId: "load-list-144", limit: 20, page: 1, search: undefined },
    true
  );
  expect(itemButton(item.code, "BOX (144)")["aria-current"]).toBe("true");
  expect([...state.checkboxes.keys()]).toEqual([`link-line-${box144Line.id}`]);
});

it.each([
  {
    locale: "en",
    submitTwo: "Create 2 Links",
    submitThree: "Create 3 Links",
    error: "SRQ-000010 has 10 outstanding for BOX (50) · 50 base units per pack. Enter 10 or less.",
  },
  {
    locale: "zh",
    submitTwo: "创建 2 个关联",
    submitThree: "创建 3 个关联",
    error:
      "SRQ-000010 中 BOX (50) · 每包含 50 个基本单位 的待处理数量为 10。请输入不超过 10 的数量。",
  },
] as const)(
  "preserves other pending links when recovering from an invalid inline quantity in $locale",
  async ({ locale, submitTwo, submitThree, error }) => {
    const selectItem = (itemCode: string, packLabel: string) => {
      itemButton(itemCode, packLabel).onClick();
      render(locale);
    };
    const quantityInput = (line: EligibleLoadListRequisitionItem) => {
      const label = translations[locale].linkStockRequisitionsDialog.linkQtyFor.replace(
        "{reference}",
        line.stockRequisitionNumber
      );
      const control = state.inputs.get(label);
      if (!control?.onChange) throw new Error(`Missing input ${label}`);
      return { ...control, onChange: control.onChange };
    };
    const changeQuantity = (value: string) =>
      quantityInput(box50Line).onChange({ target: { value } } as ChangeEvent<HTMLInputElement>);

    render(locale);
    selectItem(otherItem.code, "BOX (144)");
    expect(quantityInput(otherItemLine).value).toBe("10");
    checkbox(otherItemLine).onCheckedChange(true);
    render(locale);
    expect(checkbox(otherItemLine).checked).toBe(true);

    selectItem(item.code, "BOX (144)");
    checkbox(box144Line).onCheckedChange(true);
    render(locale);
    expect(button(submitTwo).disabled).toBe(false);

    selectItem(item.code, "BOX (50)");
    expect(quantityInput(box50Line).value).toBe("10");
    changeQuantity("50");
    const rejected = render(locale);
    expect(rejected).toContain(error);
    expect(rejected).toContain(`id="${quantityInput(box50Line)["aria-describedby"]}" role="alert"`);
    expect(quantityInput(box50Line)["aria-invalid"]).toBe(true);
    expect(checkbox(box50Line).checked).toBe(true);
    expect(button(submitThree).disabled).toBe(true);
    expect(state.createLinks).not.toHaveBeenCalled();

    selectItem(item.code, "BOX (144)");
    expect(checkbox(box144Line).checked).toBe(true);
    expect(button(submitThree).disabled).toBe(true);

    selectItem(item.code, "BOX (50)");
    expect(quantityInput(box50Line).value).toBe("50");
    checkbox(box50Line).onCheckedChange(false);
    expect(render(locale)).not.toContain(error);
    expect(checkbox(box50Line).checked).toBe(false);
    expect(button(submitTwo).disabled).toBe(false);

    changeQuantity("10");
    expect(render(locale)).not.toContain(error);
    expect(checkbox(box50Line).checked).toBe(true);
    expect(button(submitThree).disabled).toBe(false);
    await button(submitThree).onClick();

    expect(state.createLinks).toHaveBeenCalledTimes(1);
    expect(state.createLinks).toHaveBeenCalledWith({
      id: "load-list",
      data: {
        links: [
          { loadListItemId: "load-list-other-144", srItemId: otherItemLine.id, fulfilledQty: 10 },
          { loadListItemId: "load-list-144", srItemId: box144Line.id, fulfilledQty: 100 },
          { loadListItemId: "load-list-50", srItemId: box50Line.id, fulfilledQty: 10 },
        ],
      },
    });
    expect(state.onOpenChange).toHaveBeenCalledWith(false);
  }
);
