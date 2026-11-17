import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ItemUnitOptionsCard } from "./ItemUnitOptionsCard";

const mocks = vi.hoisted(() => ({ isInventoryPreview: false, isActive: true }));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useUnitsOfMeasure", () => ({ useUnitsOfMeasure: () => ({ data: { data: [] } }) }));
vi.mock("@/hooks/useItemUnitOptions", () => {
  const mutation = { isPending: false, mutateAsync: vi.fn() };
  return {
    useItemUnitOptions: () => ({
      isLoading: false,
      data: {
        data: [
          {
            id: "box",
            uomId: "uom-box",
            uomCode: "BOX",
            qtyPerUnit: 12,
            optionLabel: null,
            displayLabel: "BOX (12)",
            barcode: "BOX-12",
            isBase: false,
            isDefault: false,
            isActive: mocks.isActive,
            isInventoryPreview: mocks.isInventoryPreview,
          },
        ],
      },
    }),
    useCreateItemUnitOption: () => mutation,
    useUpdateItemUnitOption: () => mutation,
    useDeleteItemUnitOption: () => mutation,
    useSetItemInventoryPreview: () => mutation,
  };
});

beforeEach(() => {
  mocks.isInventoryPreview = false;
  mocks.isActive = true;
});

it("keeps Edit visible and moves secondary and destructive actions into the row menu", () => {
  const html = renderToStaticMarkup(
    <ItemUnitOptionsCard itemId="item" baseUomCode="PC" editable />
  );
  expect(html.match(/aria-label="moreUnitOptionActions"/g)?.length).toBe(2);
  expect(html).toContain(">edit<");
  expect(html).not.toContain("setDefaultAction");
  expect(html).not.toContain("deleteAction");
  expect(html).toContain('class="divide-y rounded-md border md:hidden"');
  expect(html).not.toContain("showInInventoryAction");
});

it("badges the nominated row independently of Set Default", () => {
  mocks.isInventoryPreview = true;
  const html = renderToStaticMarkup(
    <ItemUnitOptionsCard itemId="item" baseUomCode="PC" editable />
  );
  // Both layouts render the badge; neither marks the row as the default unit.
  expect(html.match(/inventoryPreviewLabel/g)?.length).toBe(2);
  expect(html).not.toContain("defaultLabel");
});

it("omits the inventory preview badge when the row is not nominated", () => {
  const html = renderToStaticMarkup(
    <ItemUnitOptionsCard itemId="item" baseUomCode="PC" editable />
  );
  expect(html).not.toContain("inventoryPreviewLabel");
});

it("hides the row menu from non-editable users", () => {
  mocks.isInventoryPreview = true;
  const html = renderToStaticMarkup(<ItemUnitOptionsCard itemId="item" baseUomCode="PC" />);
  expect(html).not.toContain("moreUnitOptionActions");
  expect(html).toContain("inventoryPreviewLabel");
});
