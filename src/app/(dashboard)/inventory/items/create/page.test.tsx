import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import CreateItemPage from "./page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/hooks/useItems", () => ({ useCreateItem: () => ({ isPending: false }) }));
vi.mock("@/hooks/useItemCategories", () => ({ useItemCategories: () => ({ data: { data: [] } }) }));
vi.mock("@/hooks/useUnitsOfMeasure", () => ({ useUnitsOfMeasure: () => ({ data: { data: [] } }) }));
vi.mock("@/hooks/useGranularCapabilities", () => ({
  useGranularCapabilities: () => ({ data: {} }),
}));
vi.mock("@/stores/authStore", () => ({ useAuthStore: () => ({ user: { companyId: "company" } }) }));
vi.mock("@/components/permissions/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/ui/image-upload", () => ({ ImageUpload: () => null }));
vi.mock("@/components/items/ItemCategorySelect", () => ({
  ItemCategorySelect: ({ valueField }: { valueField: string }) => (
    <button data-category-value-field={valueField}>Search categories</button>
  ),
}));
vi.mock("@/components/ui/form", async (original) => {
  const actual = await original<typeof import("@/components/ui/form")>();
  return {
    ...actual,
    FormField: (props: Parameters<typeof actual.FormField>[0]) => (
      <section data-field={props.name}>
        <actual.FormField {...props} />
      </section>
    ),
  };
});
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value }: { children: ReactNode; value: string }) => (
    <div data-select-value={value}>{children}</div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => children,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <span data-option={value}>{children}</span>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  SelectValue: () => null,
}));

it("offers valid item types and puts the searchable category control on the category field", () => {
  const html = renderToStaticMarkup(<CreateItemPage />);
  const itemType = html.match(/<section data-field="itemType">([\s\S]*?)<\/section>/)?.[1];
  expect(itemType).toBeDefined();
  for (const value of ["raw_material", "finished_good", "asset", "service"]) {
    expect(itemType).toContain(`data-option="${value}"`);
  }
  expect(itemType).not.toContain("data-category-value-field");
  const category = html.match(/<section data-field="category">([\s\S]*?)<\/section>/)?.[1];
  expect(category).toContain('data-category-value-field="name"');
});
