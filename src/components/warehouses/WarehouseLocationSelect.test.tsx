import { type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { WarehouseLocationSelect } from "./WarehouseLocationSelect";

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
  lookup: vi.fn(),
  hasMore: true,
  fetching: false,
  search: undefined as undefined | ((value: string) => void),
  buttons: [] as { label: string; disabled: boolean; onClick: () => void }[],
}));
vi.mock("react", async (load) => ({
  ...(await load<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = state.index++;
    if (!(index in state.values)) state.values[index] = initial;
    return [
      state.values[index],
      (value: unknown) => {
        state.values[index] = value;
      },
    ];
  },
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/hooks/useDebouncedValue", () => ({ useDebouncedValue: (value: string) => value }));
vi.mock("@/hooks/useLookups", () => ({
  useLookupWarehouseLocations: (...args: unknown[]) => {
    state.lookup(...args);
    return { data: { data: [], hasMore: state.hasMore }, isFetching: state.fetching };
  },
}));
vi.mock("@/components/shared/AsyncSearchCombobox", () => ({
  AsyncSearchCombobox: (props: {
    footer: ReactNode;
    onSearchValueChange: (value: string) => void;
  }) => {
    state.search = props.onSearchValueChange;
    return <>{props.footer}</>;
  },
}));
vi.mock("@/components/ui/button", () => ({
  Button: (props: {
    children: ReactNode;
    "aria-label": string;
    disabled: boolean;
    onClick: () => void;
  }) => {
    state.buttons.push({
      label: props["aria-label"],
      disabled: props.disabled,
      onClick: props.onClick,
    });
    return <button disabled={props.disabled}>{props.children}</button>;
  },
}));
const render = (props: Partial<ComponentProps<typeof WarehouseLocationSelect>> = {}) => {
  state.index = 0;
  state.buttons = [];
  renderToStaticMarkup(
    <WarehouseLocationSelect warehouseId="wh" value="" onValueChange={() => {}} {...props} />
  );
};
const next = () => state.buttons.find((button) => button.label === "goToNextPage")!;
beforeEach(() => {
  state.values = [];
  state.hasMore = true;
  state.fetching = false;
  state.lookup.mockClear();
});
it("reaches later results and resets to page one for a new search", () => {
  render();
  expect(state.lookup).toHaveBeenLastCalledWith(
    "wh",
    expect.objectContaining({ page: 1, limit: 5 })
  );
  expect(state.buttons[0].disabled).toBe(true);
  next().onClick();
  render();
  expect(state.lookup).toHaveBeenLastCalledWith("wh", expect.objectContaining({ page: 2 }));
  state.search?.("Rack 01 / Bin 10");
  render();
  expect(state.lookup).toHaveBeenLastCalledWith(
    "wh",
    expect.objectContaining({ page: 1, search: "Rack 01 / Bin 10" })
  );
});
it("resets pagination when the warehouse or eligibility filters change", () => {
  render();
  next().onClick();
  render({ warehouseId: "other", storableOnly: true });
  expect(state.lookup).toHaveBeenLastCalledWith(
    "other",
    expect.objectContaining({ page: 1, storableOnly: true })
  );
});
it("keeps previous-page navigation on the last page and disables next", () => {
  render();
  next().onClick();
  state.hasMore = false;
  render();
  expect(next().disabled).toBe(true);
  expect(state.buttons[0].disabled).toBe(false);
  state.buttons[0].onClick();
  render();
  expect(state.lookup).toHaveBeenLastCalledWith("wh", expect.objectContaining({ page: 1 }));
});
it("disables paging while a request is in flight", () => {
  state.fetching = true;
  render();
  expect(next().disabled).toBe(true);
});

it("passes the item filter to server search and resets paging when the item changes", () => {
  render({ itemId: "item-a" });
  next().onClick();
  render({ itemId: "item-a" });
  expect(state.lookup).toHaveBeenLastCalledWith(
    "wh",
    expect.objectContaining({ itemId: "item-a", page: 2, limit: 5 })
  );
  render({ itemId: "item-b" });
  expect(state.lookup).toHaveBeenLastCalledWith(
    "wh",
    expect.objectContaining({ itemId: "item-b", page: 1, limit: 5 })
  );
});
