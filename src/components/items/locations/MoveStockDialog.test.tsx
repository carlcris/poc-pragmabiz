import type { ItemUnitOption } from "@/types/item";
import type { ReactNode, ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryObserver, type FetchStatus } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translations } from "@/lib/i18n/translations";
import type { StockMoveBatchOption, StockMoveSourceAvailabilityResponse } from "@/types/stock-move";
import {
  emptyBatchSelection,
  toggleAllBatches,
  toggleBatch,
  type StockMoveBatchSelectionState,
} from "@/lib/stock-move-batch-selection";
import { MoveStockDialog } from "./MoveStockDialog";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "zh",
  availability: undefined as StockMoveSourceAvailabilityResponse | undefined,
  availabilityFetchStatus: "idle" as FetchStatus,
  availabilityKey: undefined as readonly unknown[] | undefined,
  refreshClient: undefined as QueryClient | undefined,
  removeUnavailable: undefined as (() => void) | undefined,
  invalidated: [] as unknown[][],
  error: null as Error | null,
  isPending: false,
  values: [] as unknown[],
  index: 0,
  // What each useState setter was called with, keyed by the hook's declaration
  // index, so a callback's real effect can be asserted under static rendering.
  setValues: {} as Record<number, unknown[]>,
  mutate: vi.fn(),
  submit: undefined as (() => void) | undefined,
  // Types into the quantity field through the real shared Input, so a draft the
  // Input swallows before `onChange` is exercised rather than assumed.
  typeQuantity: undefined as ((next: string) => void) | undefined,
  toggleBatch: undefined as ((id: string, checked: boolean) => void) | undefined,
  toggleAll: undefined as ((checked: boolean) => void) | undefined,
}));
vi.mock("@tanstack/react-query", async (load) => ({
  ...(await load<typeof import("@tanstack/react-query")>()),
  useQuery: ({ queryKey, enabled }: { queryKey: readonly unknown[]; enabled: boolean }) => {
    state.availabilityKey = queryKey;
    return {
      data: enabled ? state.availability : undefined,
      fetchStatus: state.availabilityFetchStatus,
    };
  },
  useQueryClient: () => ({
    invalidateQueries: ({ queryKey }: { queryKey: unknown[] }) => {
      state.invalidated.push(queryKey);
      return state.refreshClient?.invalidateQueries({ queryKey });
    },
  }),
}));
vi.mock("@/stores/businessUnitStore", () => ({ useBusinessUnitStore: () => "bu" }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    // A seeded value is used as-is, including `null`, so the quantity draft can
    // be seeded to its auto-follow state as well as to a typed one. Each setter
    // records its arguments, which is how a handler's real state change is
    // observed without a live renderer.
    useState: (initial: unknown) => {
      const index = state.index++;
      const [value] = actual.useState(index < state.values.length ? state.values[index] : initial);
      return [
        value,
        (next: unknown) => {
          (state.setValues[index] ??= []).push(next);
        },
      ];
    },
  };
});
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, disabled, ...props }: ComponentProps<"button">) => {
    const click = () => {
      if (!disabled) onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    };
    if (children === "Move Stock") state.submit = click;
    if (children === "Remove unavailable batches") state.removeUnavailable = click;
    return (
      <button disabled={disabled} {...props}>
        {children}
      </button>
    );
  },
}));
// Stands in for the paged checklist so selections run through the real handlers.
vi.mock("@/components/items/locations/MoveStockBatchChecklist", () => ({
  MoveStockBatchChecklist: ({
    selection,
    namedAvailability,
    onToggleBatch,
    onToggleAll,
    disabled,
  }: {
    selection: StockMoveBatchSelectionState;
    namedAvailability?: ReadonlyMap<string, number>;
    onToggleBatch: (id: string, checked: boolean) => void;
    onToggleAll: (checked: boolean) => void;
    disabled?: boolean;
  }) => {
    state.toggleBatch = onToggleBatch;
    state.toggleAll = onToggleAll;
    return (
      <div
        data-mode={selection.mode}
        data-named={selection.batchLocationIds.join(",")}
        data-named-availability={Array.from(
          namedAvailability ?? [],
          ([id, qty]) => `${id}:${qty}`
        ).join(",")}
        data-disabled={String(Boolean(disabled))}
      >
        batch-checklist
      </div>
    );
  },
}));
// Renders the real shared Input and, for the quantity field only, exposes a
// `typeQuantity` that dispatches one `input` event the way React does: the
// dialog's forwarded `onInput` runs, and the shared Input's own numeric gate
// decides whether `onChange` reaches the dialog at all. The gate is the bug
// trigger, so it is reproduced here rather than mocked away: the shared Input
// keeps an unfinished draft ("", "-", ".", "-.", "1.") in its private display
// state and never calls the consumer's `onChange` for it.
const sharedInputSuppressesChange = (next: string) =>
  !/^-?\d*(\.\d*)?$/.test(next) ||
  next === "" ||
  next === "-" ||
  next === "." ||
  next === "-." ||
  next.endsWith(".");
vi.mock("@/components/ui/input", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/input")>();
  return {
    Input: (props: ComponentProps<typeof actual.Input>) => {
      if (props.id === "move-stock-quantity") {
        state.typeQuantity = (next: string) => {
          // One DOM `input` event, seen by both handlers as React dispatches it.
          const event = { target: { value: next }, currentTarget: { value: next } };
          props.onInput?.(event as unknown as React.InputEvent<HTMLInputElement>);
          if (sharedInputSuppressesChange(next)) return;
          props.onChange?.(event as unknown as React.ChangeEvent<HTMLInputElement>);
        };
      }
      return <actual.Input {...props} />;
    },
  };
});
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
const itemId = "11111111-1111-4111-8111-111111111111";
const sourceWarehouseId = "11111111-1111-4111-8111-111111111112";
const sourceLocationId = "11111111-1111-4111-8111-111111111114";
const sourcePrefix = [
  "item-locations",
  itemId,
  "bu",
  "move-batches",
  sourceWarehouseId,
  sourceLocationId,
];
const renderDialog = (unitOptions = [box], availableQuantity?: number) => {
  state.index = 0;
  if (availableQuantity !== undefined) {
    state.availability = {
      availableQuantity,
      namedBatches: state.availability?.namedBatches ?? [],
    };
  }
  return renderToStaticMarkup(
    <MoveStockDialog
      itemId={itemId}
      baseUnit="PCS"
      unitOptions={unitOptions}
      onOpenChange={() => {}}
    />
  );
};
const firstBatch: StockMoveBatchOption = {
  id: "22222222-2222-4222-8222-222222222221",
  batchCode: "B-PAGE-1",
  qtyAvailable: 40,
};
const secondBatch: StockMoveBatchOption = {
  id: "22222222-2222-4222-8222-222222222222",
  batchCode: "B-PAGE-2",
  qtyAvailable: 18,
};
const allBatches = toggleAllBatches(true);
const bothBatches = toggleBatch(
  toggleBatch(emptyBatchSelection, firstBatch.id, true),
  secondBatch.id,
  true
);
// Seeds the dialog's useState calls in declaration order: source warehouse,
// destination warehouse, from location, to location, quantity draft, unit,
// batch selection, business unit the selection belongs to.
//
// `quantityDraft` is `null` when the amount follows the checked batches and a
// string once the user has typed, so "" means a deliberately emptied field.
const seedState = (
  quantityDraft: string | null,
  unit = "base",
  selection: StockMoveBatchSelectionState = allBatches
) => {
  state.availability = {
    availableQuantity: selection.mode === "include" ? 58 : 1000,
    namedBatches: [firstBatch, secondBatch].filter(({ id }) =>
      selection.batchLocationIds.includes(id)
    ),
  };
  state.values = [
    sourceWarehouseId,
    "11111111-1111-4111-8111-111111111113",
    sourceLocationId,
    "11111111-1111-4111-8111-111111111115",
    quantityDraft,
    unit,
    selection,
    "bu",
  ];
};
// Declaration order of the dialog's useState calls, used to read back what a
// handler actually set.
const QUANTITY_DRAFT_STATE = 4;
const BATCH_SELECTION_STATE = 6;
const setCalls = (index: number) => state.setValues[index] ?? [];
// The amount the quantity field actually shows; "" when React omits the
// attribute for an empty controlled value.
const quantityFieldValue = (html: string) => {
  const field = html.match(/<input[^>]*id="move-stock-quantity"[^>]*>/)?.[0] ?? "";
  return field.match(/\svalue="([^"]*)"/)?.[1] ?? "";
};
const movedItems = (quantity: number, selection: StockMoveBatchSelectionState) => [
  {
    itemId,
    batchSelection: {
      mode: selection.mode,
      batchLocationIds: selection.batchLocationIds,
    },
    quantity,
  },
];
beforeEach(() => {
  state.locale = "en";
  state.values = [];
  state.setValues = {};
  state.mutate.mockClear();
  state.submit = undefined;
  state.typeQuantity = undefined;
  state.toggleBatch = undefined;
  state.toggleAll = undefined;
  state.availability = undefined;
  state.availabilityFetchStatus = "idle";
  state.availabilityKey = undefined;
  state.refreshClient = undefined;
  state.removeUnavailable = undefined;
  state.invalidated = [];
  state.error = null;
  state.isPending = false;
});

describe("Move Stock dialog", () => {
  it("blocks one box of 144 when the source has only 58 base units", () => {
    seedState("1", "box");
    const html = renderDialog([box], 58);
    expect(html).toContain("Total quantity: 144 PCS");
    expect(html).toContain("Available at source: 58 PCS");
    expect(html).toMatch(/disabled=""[^>]*>Move Stock/);
    state.submit?.();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it.each(["5", "58"])("allows %s base units from a source with 58", (quantity) => {
    seedState(quantity);
    renderDialog([box], 58);
    state.submit?.();
    expect(state.mutate).toHaveBeenCalled();
  });
  it("uses available stock rather than reserved on-hand stock", () => {
    seedState("58");
    renderDialog([box], 50);
    state.submit?.();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("loads the balance for the exact source warehouse and rack", () => {
    seedState("5");
    renderDialog([box], 58);
    expect(state.availabilityKey).toEqual([...sourcePrefix, "availability", "exclude", []]);
    state.submit?.();
    expect(state.mutate).toHaveBeenCalled();
  });
  it("blocks submission and offers retry when source availability cannot be loaded", () => {
    seedState("5");
    state.availability = undefined;
    const html = renderDialog();
    expect(html).toContain("Source stock is unavailable");
    expect(html).toContain("Retry");
    state.submit?.();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it.each([
    ["2", "box", 288],
    ["5", "base", 5],
    ["0.1", "box", 14.4],
  ])("submits %s in %s as %s base units", (quantity, unit, expected) => {
    seedState(quantity, unit);
    expect(renderDialog()).toContain(`Total quantity: ${expected} PCS`);
    state.submit?.();
    expect(state.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ items: movedItems(expected as number, allBatches) }),
      expect.any(Object)
    );
  });
  it.each(["0", "-2", "0.001", "10000000"])("blocks invalid quantity %s", (quantity) => {
    seedState(quantity, "box");
    expect(renderDialog()).toContain('role="alert"');
    state.submit?.();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("rejects fractional base quantities without silently rounding", () => {
    seedState("0.01", "box");
    renderDialog([{ ...box, qtyPerUnit: 1.5 }]);
    state.submit?.();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("blocks a selected unit that is no longer active", () => {
    seedState("2", "box");
    renderDialog([{ ...box, isActive: false }]);
    state.submit?.();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("allows base-unit moves without alternate units", () => {
    seedState("5");
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
    seedState("5");
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
      seedState("5");
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
    expect(html).toContain('data-disabled="true"');
  });

  describe("batch selection", () => {
    it("asks for a batch once a source is chosen and blocks submission", () => {
      // The prompt is scoped to a chosen source, so the source must be seeded.
      seedState(null, "base", emptyBatchSelection);
      const html = renderDialog();
      expect(html).toContain('data-mode="include"');
      expect(html).toContain('data-named=""');
      expect(html).toContain("Check at least one batch to move");
      expect(html).toMatch(/disabled=""[^>]*>Move Stock/);
      state.submit?.();
      expect(state.mutate).not.toHaveBeenCalled();
    });

    it("keeps the batch checklist and the move disabled before a source is chosen", () => {
      const html = renderDialog();
      expect(html).toContain('data-mode="include"');
      expect(html).toContain('data-named=""');
      expect(html).toContain('data-disabled="true"');
      expect(html).toMatch(/disabled=""[^>]*>Move Stock/);
      state.submit?.();
      expect(state.mutate).not.toHaveBeenCalled();
    });

    it("submits every individually checked batch in include mode", () => {
      seedState("50", "base", bothBatches);
      const html = renderDialog();
      expect(html).toContain(`data-named="${firstBatch.id},${secondBatch.id}"`);
      // 40 + 18 is the checked availability, independent of the loaded page.
      expect(html).toContain("Available in 2 selected batches: 58 PCS");
      state.submit?.();
      expect(state.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ items: movedItems(50, bothBatches) }),
        expect.any(Object)
      );
    });

    it("caps the move at the checked batches even when the location holds more", () => {
      seedState("59", "base", bothBatches);
      const html = renderDialog();
      expect(html).toContain('role="alert"');
      expect(html).toContain("no longer hold enough available stock");
      state.submit?.();
      expect(state.mutate).not.toHaveBeenCalled();
    });

    it("auto-fills the server movable balance after Select All and caps submission at it", () => {
      // SQL regression fixture has 15 at the rack but only 13 movable.
      seedState(null, "base", allBatches);
      const html = renderDialog([box], 13);
      expect(html).toContain('data-mode="exclude"');
      expect(html).toContain('data-named=""');
      expect(html).toContain("Available at source: 13 PCS");
      expect(quantityFieldValue(html)).toBe("13");
      state.submit?.();
      expect(state.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ items: movedItems(13, allBatches) }),
        expect.any(Object)
      );
      state.mutate.mockClear();
      seedState("15", "base", allBatches);
      renderDialog([box], 13);
      state.submit?.();
      expect(state.mutate).not.toHaveBeenCalled();
    });

    it("excludes an unchecked batch after Select All and subtracts its quantity", () => {
      const withException = toggleBatch(allBatches, firstBatch.id, false);
      seedState("18", "base", withException);
      const html = renderDialog([box], 18);
      expect(html).toContain(`data-named="${firstBatch.id}"`);
      // The server supplied the balance after excluding the named batch.
      expect(html).toContain("Available at source: 18 PCS");
      state.submit?.();
      expect(state.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            {
              itemId,
              batchSelection: { mode: "exclude", batchLocationIds: [firstBatch.id] },
              quantity: 18,
            },
          ],
        }),
        expect.any(Object)
      );
    });

    it("blocks an exclude-mode quantity above the remaining availability", () => {
      seedState("19", "base", toggleBatch(allBatches, firstBatch.id, false));
      renderDialog([box], 18);
      state.submit?.();
      expect(state.mutate).not.toHaveBeenCalled();
    });

    it("auto-fills the checked availability and submits exactly the shown amount", () => {
      seedState(null, "base", bothBatches);
      const html = renderDialog();
      // The field, the preview and the payload all carry the same 58.
      expect(quantityFieldValue(html)).toBe("58");
      expect(html).toContain("Total quantity: 58 PCS");
      state.submit?.();
      expect(state.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ items: movedItems(58, bothBatches) }),
        expect.any(Object)
      );
    });

    it("never submits a deliberately emptied amount as the whole balance", () => {
      seedState("", "base", bothBatches);
      const html = renderDialog();
      // No amount is shown, so none may be sent.
      expect(quantityFieldValue(html)).toBe("");
      expect(html).not.toContain("Total quantity:");
      expect(html).toMatch(/disabled=""[^>]*>Move Stock/);
      state.submit?.();
      expect(state.mutate).not.toHaveBeenCalled();
    });

    // Reproduces the browser report: 5 typed, then cleared, left the field
    // visually empty while the move still submitted 5. The shared Input keeps
    // these drafts to itself, so the dialog has to read them off the `input`
    // event or it never learns the field was emptied.
    it.each(["", "-", ".", "-.", "5."])(
      "records the %o draft the shared Input withholds from onChange",
      (draft) => {
        seedState("5", "base", bothBatches);
        renderDialog();
        state.typeQuantity?.(draft);
        expect(setCalls(QUANTITY_DRAFT_STATE)).toEqual([draft]);
      }
    );

    it.each(["-", ".", "-.", "5."])("blocks the incomplete draft %o from submitting", (draft) => {
      seedState(draft, "base", bothBatches);
      const html = renderDialog();
      // Nothing is previewed, because nothing is submittable.
      expect(quantityFieldValue(html)).toBe(draft);
      expect(html).not.toContain("Total quantity:");
      expect(html).toMatch(/disabled=""[^>]*>Move Stock/);
      state.submit?.();
      expect(state.mutate).not.toHaveBeenCalled();
    });

    it("still takes a completed decimal straight from onChange", () => {
      seedState("5.", "base", bothBatches);
      renderDialog();
      state.typeQuantity?.("5.5");
      expect(setCalls(QUANTITY_DRAFT_STATE)).toEqual(["5.5"]);
    });

    it("leaves the amount empty when an alternate unit has no unambiguous auto value", () => {
      seedState(null, "box", bothBatches);
      const html = renderDialog();
      expect(quantityFieldValue(html)).toBe("");
      expect(html).not.toContain("Total quantity:");
      expect(html).toMatch(/disabled=""[^>]*>Move Stock/);
      state.submit?.();
      expect(state.mutate).not.toHaveBeenCalled();
    });

    it("explains an unmovable balance instead of blaming a quantity never typed", () => {
      seedState(null, "base", toggleBatch(emptyBatchSelection, firstBatch.id, true));
      const html = renderDialog([box], 58.005);
      expect(html).toContain("cannot be moved in one transfer");
      // The precision complaint is about the balance, not a typed value.
      expect(html).not.toContain("Enter a positive quantity");
      state.submit?.();
      expect(state.mutate).not.toHaveBeenCalled();
    });

    it("keeps the unmovable-balance message off an unset destination", () => {
      seedState(null, "base", bothBatches);
      state.values[1] = "";
      state.values[3] = "";
      const html = renderDialog();
      // 58 is movable; only the destination is missing, so the balance is not
      // what blocks the move.
      expect(html).not.toContain("cannot be moved in one transfer");
      expect(html).not.toContain("Enter a positive quantity");
      state.submit?.();
      expect(state.mutate).not.toHaveBeenCalled();
    });

    it("reports an over-cap selection as the reason rather than the typed amount", () => {
      const tooMany = {
        mode: "include" as const,
        batchLocationIds: Array.from({ length: 101 }, (_unused, index) => `3333333${index}`),
      };
      // The amount itself is fine; only the selection size blocks the move.
      seedState(null, "base", tooMany);
      const html = renderDialog();
      expect(html).toContain("Select at most 100 individual batches");
      expect(html).not.toContain("cannot be moved in one transfer");
      expect(html).not.toContain("Enter a positive quantity");
      state.submit?.();
      expect(state.mutate).not.toHaveBeenCalled();
    });

    it("blocks more individual batches than the server accepts", () => {
      const tooMany = {
        mode: "include" as const,
        batchLocationIds: Array.from({ length: 101 }, (_unused, index) => `3333333${index}`),
      };
      seedState("5", "base", tooMany);
      const html = renderDialog();
      expect(html).toContain("Select at most 100 individual batches");
      expect(html).toMatch(/disabled=""[^>]*>Move Stock/);
      state.submit?.();
      expect(state.mutate).not.toHaveBeenCalled();
    });

    it("checks a batch through the real handler without discarding a typed amount", () => {
      seedState("5", "base", emptyBatchSelection);
      renderDialog();
      state.toggleBatch?.(firstBatch.id, true);
      expect(setCalls(BATCH_SELECTION_STATE)).toEqual([
        toggleBatch(emptyBatchSelection, firstBatch.id, true),
      ]);
      // An individual checkbox must not erase the quantity the user typed.
      expect(setCalls(QUANTITY_DRAFT_STATE)).toEqual([]);
    });

    it("keeps an intentionally emptied amount when one batch is unchecked", () => {
      seedState("", "base", bothBatches);
      renderDialog();
      state.toggleBatch?.(firstBatch.id, false);
      expect(setCalls(BATCH_SELECTION_STATE)).toEqual([
        toggleBatch(bothBatches, firstBatch.id, false),
      ]);
      expect(setCalls(QUANTITY_DRAFT_STATE)).toEqual([]);
    });

    it("switches the whole selection through the master handler", () => {
      seedState("5", "base", emptyBatchSelection);
      renderDialog();
      state.toggleAll?.(true);
      expect(setCalls(BATCH_SELECTION_STATE)).toEqual([allBatches]);

      state.toggleAll?.(false);
      expect(setCalls(BATCH_SELECTION_STATE)).toEqual([allBatches, emptyBatchSelection]);
    });

    it("empties a stale off-page selection through the master checkbox", () => {
      // The exception names a batch that no loaded page shows, so unchecking the
      // master box is the only way back to an empty selection.
      seedState("5", "base", toggleBatch(allBatches, firstBatch.id, false));
      renderDialog([box], 58);

      state.toggleAll?.(false);
      // Unchecking empties the selection rather than keeping the exclusion.
      expect(setCalls(BATCH_SELECTION_STATE)).toEqual([emptyBatchSelection]);
    });

    it("blocks the move while nothing is selected", () => {
      seedState(null, "base", emptyBatchSelection);
      const cleared = renderDialog([box], 58);
      expect(cleared).toContain('data-mode="include"');
      expect(cleared).toContain('data-named=""');
      expect(cleared).toContain("Check at least one batch to move");
      expect(cleared).toMatch(/disabled=""[^>]*>Move Stock/);
      state.submit?.();
      expect(state.mutate).not.toHaveBeenCalled();
    });

    it("keeps the selection and shows recovery guidance after a stale-batch error", () => {
      state.error = new Error("safe fallback", {
        cause: { code: "STOCK_MOVE_BATCH_UNAVAILABLE" },
      });
      seedState("40", "base", bothBatches);
      const html = renderDialog();
      // The failure must never silently widen the move to other batches.
      expect(html).toContain(`data-named="${firstBatch.id},${secondBatch.id}"`);
      expect(html).toContain("Remove unavailable batches or choose another source");
      expect(html).not.toContain("safe fallback");
    });

    it("points an include-mode shortage at the other batches", () => {
      state.error = new Error("safe fallback", {
        cause: { code: "STOCK_MOVE_INSUFFICIENT_STOCK" },
      });
      seedState("40", "base", bothBatches);
      const html = renderDialog();
      expect(html).toContain("check more batches");
    });

    it("refreshes this source's lookup pages when a move fails on stale batches", () => {
      seedState("50", "base", bothBatches);
      renderDialog();
      state.submit?.();
      const [, options] = state.mutate.mock.calls[0] as [
        unknown,
        { onError: (error: unknown) => void },
      ];
      options.onError(
        new Error("safe fallback", { cause: { code: "STOCK_MOVE_BATCH_UNAVAILABLE" } })
      );
      expect(state.invalidated).toEqual([
        [
          "item-locations",
          itemId,
          "bu",
          "move-batches",
          "11111111-1111-4111-8111-111111111112",
          "11111111-1111-4111-8111-111111111114",
        ],
      ]);
    });

    it.each(["include", "exclude"] as const)(
      "refreshes an off-page named batch in %s mode without losing the choice",
      async (mode) => {
        const selection =
          mode === "include"
            ? toggleBatch(emptyBatchSelection, secondBatch.id, true)
            : toggleBatch(allBatches, secondBatch.id, false);
        seedState(null, "base", selection);
        state.availability = {
          availableQuantity: 10,
          namedBatches: [{ id: secondBatch.id, qtyAvailable: 10 }],
        };
        const refreshedAmount = mode === "include" ? 5 : 12;
        const refreshedNamedQuantity = mode === "include" ? 5 : 0;
        const refreshedAvailability: StockMoveSourceAvailabilityResponse = {
          availableQuantity: refreshedAmount,
          namedBatches: mode === "include" ? [{ id: secondBatch.id, qtyAvailable: 5 }] : [],
        };
        const client = new QueryClient({
          defaultOptions: { queries: { staleTime: Infinity, retry: false } },
        });
        state.refreshClient = client;
        renderDialog();
        const availabilityKey = [...sourcePrefix, "availability", mode, [secondBatch.id]];
        expect(state.availabilityKey).toEqual(availabilityKey);
        client.setQueryData(availabilityKey, state.availability);
        const offPageKey = [...sourcePrefix, 2];
        const otherRackKey = [...sourcePrefix.slice(0, -1), "another-rack", 2];
        client.setQueryData(offPageKey, [secondBatch]);
        client.setQueryData(otherRackKey, []);
        const queryFn = vi.fn().mockResolvedValue(refreshedAvailability);
        const observer = new QueryObserver<StockMoveSourceAvailabilityResponse>(client, {
          queryKey: availabilityKey,
          queryFn,
        });
        const unsubscribe = observer.subscribe(() => {});

        try {
          state.submit?.();
          const [, options] = state.mutate.mock.calls[0] as [
            unknown,
            { onError: (error: unknown) => void },
          ];
          options.onError(new Error("stale", { cause: { code: "STOCK_MOVE_INSUFFICIENT_STOCK" } }));
          expect(state.invalidated).toEqual([sourcePrefix]);
          expect(client.getQueryState(offPageKey)?.isInvalidated).toBe(true);
          expect(client.getQueryState(otherRackKey)?.isInvalidated).toBe(false);
          state.mutate.mockClear();
          state.availabilityFetchStatus = observer.getCurrentResult().fetchStatus;
          expect(renderDialog()).toContain("Checking available stock");
          state.submit?.();
          expect(state.mutate).not.toHaveBeenCalled();

          await vi.waitFor(() =>
            expect(observer.getCurrentResult().data).toEqual(refreshedAvailability)
          );
          state.availabilityFetchStatus = observer.getCurrentResult().fetchStatus;
          state.availability = observer.getCurrentResult().data;
          const refreshed = renderDialog();
          expect(refreshed).toContain(`data-named="${secondBatch.id}"`);
          expect(refreshed).toContain(
            `data-named-availability="${secondBatch.id}:${refreshedNamedQuantity}"`
          );
          expect(quantityFieldValue(refreshed)).toBe(String(refreshedAmount));
          state.submit?.();
          expect(state.mutate).toHaveBeenCalledWith(
            expect.objectContaining({ items: movedItems(refreshedAmount, selection) }),
            expect.any(Object)
          );
          expect(setCalls(BATCH_SELECTION_STATE)).toEqual([]);
          expect(setCalls(QUANTITY_DRAFT_STATE)).toEqual([]);
        } finally {
          unsubscribe();
          client.clear();
        }
      }
    );

    it("blocks retry with the retained balance when availability refresh pauses offline", () => {
      seedState(null, "base", allBatches);
      state.availabilityFetchStatus = "paused";
      const html = renderDialog([box], 13);
      expect(quantityFieldValue(html)).toBe("13");
      expect(html).toMatch(/disabled=""[^>]*>Move Stock/);
      state.submit?.();
      expect(state.mutate).not.toHaveBeenCalled();
    });

    it("keeps a typed quantity and lets the user remove a depleted off-page checked batch", () => {
      seedState("4", "base", bothBatches);
      state.availability = {
        availableQuantity: 5,
        namedBatches: [{ id: firstBatch.id, qtyAvailable: 5 }],
      };
      const html = renderDialog();
      expect(quantityFieldValue(html)).toBe("4");
      expect(html).toContain(`data-named="${firstBatch.id},${secondBatch.id}"`);
      expect(html).toContain("Remove unavailable batches");
      state.submit?.();
      expect(state.mutate).not.toHaveBeenCalled();
      state.removeUnavailable?.();
      expect(setCalls(BATCH_SELECTION_STATE)).toEqual([
        toggleBatch(bothBatches, secondBatch.id, false),
      ]);
      expect(setCalls(QUANTITY_DRAFT_STATE)).toEqual([]);
    });

    it("leaves lookup pages alone for failures unrelated to batch availability", () => {
      seedState("50", "base", bothBatches);
      renderDialog();
      state.submit?.();
      const [, options] = state.mutate.mock.calls[0] as [
        unknown,
        { onError: (error: unknown) => void },
      ];
      options.onError(new Error("safe fallback", { cause: { code: "STOCK_MOVE_FORBIDDEN" } }));
      expect(state.invalidated).toEqual([]);
    });
  });
});
