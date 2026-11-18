import { type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { ItemCategorySelect } from "./ItemCategorySelect";
import type { ItemCategoriesResponse, ItemCategory } from "@/types/item-category";

type ComboboxProps = {
  options: ItemCategory[];
  selectedOption: ItemCategory | null;
  getOptionValue: (option: ItemCategory) => string;
  onValueChange: (value: string) => void;
  onSearchValueChange?: (value: string) => void;
  emptyMessage: string;
  isLoading: boolean;
  pagination?: {
    hasMore: boolean;
    isFetchingMore: boolean;
    canFetchMore: boolean;
    hasError: boolean;
    onFetchMore: () => void;
  };
};

const CATEGORY_PAGE_SIZE = 6;

const page = (categories: ItemCategory[], pageNumber: number, total: number) => ({
  data: categories,
  pagination: {
    page: pageNumber,
    limit: CATEGORY_PAGE_SIZE,
    total,
    totalPages: Math.ceil(total / CATEGORY_PAGE_SIZE),
  },
});

const state = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
  query: vi.fn(),
  pages: [] as unknown[],
  isFetching: false,
  isFetchingNextPage: false,
  hasNextPage: true,
  isError: false,
  isFetchNextPageError: false,
  fetchNextPage: vi.fn(),
  combobox: undefined as undefined | Record<string, unknown>,
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
vi.mock("@/hooks/useItemCategories", () => ({
  useItemCategories: (...args: unknown[]) => {
    state.query(...args);
    return {
      data: { pages: state.pages },
      isFetching: state.isFetching,
      isFetchingNextPage: state.isFetchingNextPage,
      hasNextPage: state.hasNextPage,
      fetchNextPage: state.fetchNextPage,
      isError: state.isError,
      isFetchNextPageError: state.isFetchNextPageError,
    };
  },
}));
vi.mock("@/components/shared/AsyncSearchCombobox", () => ({
  AsyncSearchCombobox: (props: Record<string, unknown>) => {
    state.combobox = props;
    return null;
  },
}));

const render = (props: Partial<ComponentProps<typeof ItemCategorySelect>> = {}) => {
  state.index = 0;
  renderToStaticMarkup(<ItemCategorySelect value="" onValueChange={() => {}} {...props} />);
};
const combobox = () => state.combobox as unknown as ComboboxProps;
const pagination = () => combobox().pagination!;
const labels = () => combobox().options.map((option) => option.name);

beforeEach(() => {
  state.values = [];
  state.pages = [page([{ id: "c1", name: "Alpha" }], 1, 18)];
  state.isFetching = false;
  state.isFetchingNextPage = false;
  state.hasNextPage = true;
  state.isError = false;
  state.isFetchNextPageError = false;
  state.query.mockClear();
  state.fetchNextPage.mockClear();
});

it("requests the first page at the hook's default size and appends later pages in order", () => {
  render();
  expect(state.query).toHaveBeenLastCalledWith({ search: "" });
  expect(labels()).toEqual(["Alpha"]);

  state.pages = [
    page([{ id: "c1", name: "Alpha" }], 1, 18),
    page([{ id: "c2", name: "Beta" }], 2, 18),
  ];
  render();
  expect(labels()).toEqual(["Alpha", "Beta"]);
});

it("drops a category repeated across pages instead of listing it twice", () => {
  state.pages = [
    page([{ id: "c1", name: "Alpha" }], 1, 18),
    page(
      [
        { id: "c1", name: "Alpha" },
        { id: "c2", name: "Beta" },
      ],
      2,
      18
    ),
  ];
  render();
  expect(labels()).toEqual(["Alpha", "Beta"]);
});

it("drops a duplicate name when categories are selected by name", () => {
  state.pages = [
    page(
      [
        { id: "c1", name: "Alpha" },
        { id: "c2", name: "Alpha" },
        { id: "c3", name: "Beta" },
      ],
      1,
      18
    ),
  ];
  render({ valueField: "name" });
  expect(labels()).toEqual(["Alpha", "Beta"]);

  // The same rows keep both entries when ids are the stored value.
  render({ valueField: "id" });
  expect(labels()).toEqual(["Alpha", "Alpha", "Beta"]);
});

it("keeps the synthetic All Categories option first and outside paging", () => {
  render({ allowAll: true });
  expect(labels()).toEqual(["allCategories", "Alpha"]);
  expect(combobox().getOptionValue({ id: "all", name: "allCategories" })).toBe("all");

  const onOptionChange = vi.fn();
  const onValueChange = vi.fn();
  render({ allowAll: true, onOptionChange, onValueChange });
  combobox().onValueChange("all");
  expect(onValueChange).toHaveBeenCalledWith("all");
  expect(onOptionChange).toHaveBeenCalledWith(null);
});

it("reports the selected option by valueField and retains its label off-page", () => {
  render({ valueField: "name", value: "Alpha" });
  expect(combobox().getOptionValue({ id: "c1", name: "Alpha" })).toBe("Alpha");
  expect(combobox().selectedOption).toEqual({ id: "c1", name: "Alpha" });

  // A selection made on an earlier search is no longer in the fetched pages.
  state.pages = [page([{ id: "c9", name: "Zulu" }], 1, 18)];
  render({ valueField: "name", value: "Alpha" });
  expect(combobox().selectedOption).toEqual({ id: "Alpha", name: "Alpha" });
});

it("fetches the next page without restarting an in-flight request", () => {
  render();
  pagination().onFetchMore();
  expect(state.fetchNextPage).toHaveBeenCalledWith({ cancelRefetch: false });
});

it("blocks another page while one is in flight or the search is settling", () => {
  render();
  expect(pagination().canFetchMore).toBe(true);

  state.isFetching = true;
  state.isFetchingNextPage = true;
  render();
  expect(pagination().canFetchMore).toBe(false);
  // A page request must not read as a first load, which would blank the list.
  expect(combobox().isLoading).toBe(false);
});

it("stops offering more pages once the last page is reached", () => {
  state.hasNextPage = false;
  render();
  expect(pagination().hasMore).toBe(false);
});

it("offers retry on a failed later page and keeps the pages already listed", () => {
  state.isError = true;
  state.isFetchNextPageError = true;
  render();
  expect(labels()).toEqual(["Alpha"]);
  expect(pagination().hasError).toBe(true);
  expect(pagination().hasMore).toBe(true);
});

it("reports a failed first page through the empty state, not the retry row", () => {
  state.isError = true;
  state.pages = [];
  render();
  expect(pagination().hasError).toBe(false);
  expect(combobox().emptyMessage).toBe("loadError");
});

it("does not label a failed background refetch as a pagination failure", () => {
  state.isError = true;
  render();
  expect(labels()).toEqual(["Alpha"]);
  expect(pagination().hasError).toBe(false);
});

it("keeps search server-side by passing the debounced term to the query", () => {
  render();
  combobox().onSearchValueChange?.("alp");
  render();
  expect(state.query).toHaveBeenLastCalledWith({ search: "alp" });
});

it("tolerates a missing response without options or paging state", () => {
  state.pages = [] as unknown as ItemCategoriesResponse[];
  render();
  expect(labels()).toEqual([]);
});
