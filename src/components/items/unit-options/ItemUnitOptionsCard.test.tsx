import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ItemUnitOptionsCard } from "./ItemUnitOptionsCard";

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
            isActive: true,
          },
        ],
      },
    }),
    useCreateItemUnitOption: () => mutation,
    useUpdateItemUnitOption: () => mutation,
    useDeleteItemUnitOption: () => mutation,
  };
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
});
