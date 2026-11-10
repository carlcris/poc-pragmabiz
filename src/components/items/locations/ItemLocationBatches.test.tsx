import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { translations } from "@/lib/i18n/translations";
import { ItemLocationBatches } from "./ItemLocationBatches";

const state = vi.hoisted(() => ({
  page: 1,
  canEdit: false,
  nextPage: undefined as undefined | ((page: number) => void),
  printed: vi.fn(),
  print: undefined as undefined | (() => void),
}));
vi.mock("react", async (load) => ({
  ...(await load<typeof import("react")>()),
  useState: (initial: unknown) =>
    initial === null
      ? [null, vi.fn()]
      : [
          state.page,
          (page: number) => {
            state.page = page;
          },
        ],
}));
vi.mock("@/hooks/usePermissions", () => ({ useCanEdit: () => state.canEdit }));
vi.mock("./ItemBatchExpirationDialog", () => ({ ItemBatchExpirationDialog: () => null }));
vi.mock("@/stores/businessUnitStore", () => ({ useBusinessUnitStore: () => "bu" }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: keyof typeof translations.en.itemLocationsTab) =>
    translations.en.itemLocationsTab[key] ?? key,
  useFormatter: () => ({
    number: String,
    dateTime: (date: Date) => date.toISOString().slice(0, 10),
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
    const page = queryKey.at(-1);
    return {
      data: {
        data: [
          {
            batchCount: 21,
            batchPageSize: 20,
            batches:
              page === 1
                ? Array.from({ length: 20 }, (_, id) => ({
                    id: String(id),
                    batchCode: `EMPTY-${id}`,
                    qtyOnHand: 0,
                    qtyAvailable: 0,
                    qtyReserved: 0,
                    receivedAt: "2026-01-01",
                    expirationDate: null,
                  }))
                : [
                    {
                      id: "stocked",
                      batchCode: "STOCKED",
                      qtyOnHand: 50,
                      qtyAvailable: 50,
                      qtyReserved: 0,
                      receivedAt: "2026-02-01",
                      expirationDate: "2026-05-01",
                    },
                  ],
          },
        ],
      },
    };
  },
}));
vi.mock("@/components/shared/DataTablePagination", () => ({
  DataTablePagination: ({
    onPageChange,
    totalItems,
    totalPages,
  }: {
    onPageChange: (page: number) => void;
    totalItems: number;
    totalPages: number;
  }) => {
    state.nextPage = onPageChange;
    return (
      <p>
        {totalItems} batches / {totalPages} pages
      </p>
    );
  },
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ onClick, children }: ComponentProps<"button">) => {
    state.print = () => onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    return <button>{children}</button>;
  },
}));
beforeEach(() => {
  state.page = 1;
  state.canEdit = false;
  state.nextPage = undefined;
  state.printed.mockReset();
});
it("reaches and prints the stocked batch after twenty exhausted batches", () => {
  const render = () =>
    renderToStaticMarkup(
      <ItemLocationBatches
        itemId="item"
        locationId="rack"
        canPrint
        printDisabled={false}
        onPrint={state.printed}
      />
    );
  expect(render()).toContain("21 batches / 2 pages");
  expect(render()).toContain("Expiration Date");
  expect(render()).toContain("—");
  expect(state.nextPage).toBeDefined();
  state.nextPage!(2);
  const html = render();
  expect(html).toContain("STOCKED");
  expect(html).toContain("2026-05-01");
  expect(html).not.toContain("EMPTY-");
  state.print!();
  expect(state.printed).toHaveBeenCalledWith(
    expect.objectContaining({ id: "stocked", qtyOnHand: 50 })
  );
});

it("shows expiration editing only to item editors", () => {
  const render = () =>
    renderToStaticMarkup(
      <ItemLocationBatches
        itemId="item"
        locationId="rack"
        canPrint={false}
        printDisabled={false}
        onPrint={state.printed}
      />
    );
  expect(render()).not.toContain("Edit Expiration");
  state.canEdit = true;
  expect(render()).toContain("Edit Expiration");
});

it.each([
  [2, true],
  [1, false],
  [0, false],
])("highlights only dates before today (May day %s)", (day, expired) => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date(2026, 4, day, 12));
    state.page = 2;
    const html = renderToStaticMarkup(
      <ItemLocationBatches
        itemId="item"
        locationId="rack"
        canPrint={false}
        printDisabled={false}
        onPrint={state.printed}
      />
    );
    expect(html.includes("text-destructive")).toBe(expired);
  } finally {
    vi.useRealTimers();
  }
});
