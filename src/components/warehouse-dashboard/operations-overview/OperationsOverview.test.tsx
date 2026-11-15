import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { OperationsOverview } from "./OperationsOverview";

const state = vi.hoisted(() => ({ isSwitching: false }));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/stores/businessUnitStore", () => ({
  useBusinessUnitStore: (selector: (value: typeof state) => unknown) => selector(state),
}));
vi.mock("@/hooks/useWarehouseOperationsOverview", () => ({
  useWarehouseOperationsOverview: () => ({
    data: {
      openWorkAge: { pickLists: null, stockRequests: null, incoming: null },
      stockHealth: { inStock: 1542, belowReorder: 0, fullyReserved: 0, outOfStock: 0 },
    },
    error: null,
    isPending: false,
    isPlaceholderData: false,
  }),
}));

it("replaces cached business-unit data with skeletons as soon as a switch starts", () => {
  const render = () => renderToStaticMarkup(<OperationsOverview locale="en" />);
  expect(render()).toContain("1,542");

  state.isSwitching = true;
  const html = render();
  expect(html).toContain('id="operations-overview-title"');
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain("animate-pulse");
  expect(html).not.toContain("1,542");
});
