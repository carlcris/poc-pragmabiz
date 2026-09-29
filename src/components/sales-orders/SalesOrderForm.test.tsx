import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SalesOrderForm } from "./SalesOrderForm";
import type { SalesOrderLineItem } from "@/types/sales-order";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/hooks/useCurrency", () => ({
  useCurrency: () => ({ formatCurrency: (value: number) => `₱${value.toFixed(2)}` }),
}));
vi.mock("@/hooks/useSalesOrders", () => ({
  useCreateSalesOrder: () => ({ isPending: false }),
  useUpdateSalesOrder: () => ({ isPending: false }),
}));
vi.mock("@/hooks/useCustomers", () => ({
  useCustomers: () => ({ data: { data: [] } }),
  useCustomer: () => ({ data: undefined }),
}));
vi.mock("@/hooks/useDebouncedValue", () => ({ useDebouncedValue: (value: string) => value }));
vi.mock("@/components/shared/AsyncSearchCombobox", () => ({ AsyncSearchCombobox: () => null }));
vi.mock("./SalesOrderLineItemDialog", () => ({ SalesOrderLineItemDialog: () => null }));

const frame: SalesOrderLineItem = {
  id: "line",
  itemId: "item",
  itemCode: "SVC-CHOPJOIN",
  itemName: "Chop & Join",
  description: "Frame",
  quotationId: "quote",
  quotationItemId: "quote-line",
  quotationNumber: "QT-3",
  quantity: 1,
  uomId: "pcs",
  uomCode: "PCS",
  unitPrice: 647.67,
  discount: 0,
  discountAmount: 100,
  taxRate: 0,
  lineTotal: 547.67,
  frameConfiguration: {
    width: 20,
    height: 25,
    fixedAllowance: 0,
    serviceFeeMode: "per_frame",
    serviceFeeAmount: 0,
    totalServiceFee: 0,
    invoiceDisplayMode: "components",
    billingMode: "chop_join",
  },
  quotationPricing: {
    quantity: 1,
    discountAmount: 100,
    taxAmount: 0,
    lineTotal: 547.67,
    sizes: [],
  },
};

describe("editable Sales Order form", () => {
  it("shows fixed discounts in the actual form row and totals, not only the view dialog", () => {
    const html = renderToStaticMarkup(<SalesOrderForm initialValues={{ lineItems: [frame] }} />);
    expect(html).toContain("₱100.00 (15.44%)");
    expect(html).toContain("-₱100.00");
    expect(html).toContain("₱547.67");
    expect(html).toContain("₱647.67");
    expect(html).not.toContain("discountPct");
    expect(html).not.toContain("-₱0.00");
    expect(html).toContain("—");
  });
  it("retains percentage pricing for editable ordinary inventory", () => {
    const html = renderToStaticMarkup(
      <SalesOrderForm
        initialValues={{
          lineItems: [
            {
              ...frame,
              quotationId: undefined,
              quotationItemId: undefined,
              quotationPricing: undefined,
              frameConfiguration: null,
              quantity: 2,
              unitPrice: 100,
              discount: 10,
              discountAmount: 20,
              taxRate: 12,
              lineTotal: 201.6,
            },
          ],
        }}
      />
    );
    expect(html).toContain("₱20.00 (10%)");
    expect(html).toContain("₱21.60");
    expect(html).toContain("₱201.60");
    expect(html).toContain("₱200.00");
  });
});
