import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { FrameQuotationComponent, FrameQuotationConfiguration } from "@/types/quotation";
import type { InvoicePresentableLine } from "@/lib/framing/invoicePresenter";
import { SalesDocumentLineItemsTable } from "./SalesDocumentLineItemsTable";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/hooks/useCurrency", () => ({
  useCurrency: () => ({ formatCurrency: (amount: number) => `₱${amount.toFixed(2)}` }),
}));

const config = (billingMode: "chop_join" | "framing"): FrameQuotationConfiguration => ({
  width: 20,
  height: 25,
  fixedAllowance: 0,
  frameQuantity: 1,
  serviceFeeMode: "per_frame",
  serviceFeeAmount: 0,
  totalServiceFee: 0,
  billingMode,
  invoiceDisplayMode: billingMode === "chop_join" ? "components" : "summary",
});

const line = (overrides: Partial<InvoicePresentableLine> = {}): InvoicePresentableLine => ({
  id: "line",
  description: "Frame",
  itemName: "Chop & Join",
  quantity: 1,
  uomCode: "PCS",
  unitPrice: 500.67,
  discount: 0,
  discountAmount: 200,
  taxRate: 0,
  lineTotal: 300.67,
  ...overrides,
});

describe("shared quotation and sales-order line presentation", () => {
  it.each(["chop_join", "framing"] as const)(
    "shows the fixed discount and hides the %s average selling price",
    (mode) => {
      const html = renderToStaticMarkup(
        <SalesDocumentLineItemsTable
          documentId="order"
          items={[line({ frameConfiguration: config(mode) })]}
          showFulfilled={false}
        />
      );
      expect(html).toContain("₱200.00 (39.95%)");
      expect(html).not.toContain("₱300.67");
      expect(html.match(/₱500\.67/g)).toHaveLength(1); // Gross total only, never selling price.
      expect(html).not.toContain("fulfilled");
    }
  );

  it("keeps ordinary inventory selling prices and shows discount amount plus percentage", () => {
    const html = renderToStaticMarkup(
      <SalesDocumentLineItemsTable
        documentId="order"
        showFulfilled={false}
        items={[
          line({
            itemName: "Raw material",
            quantity: 2,
            unitPrice: 100,
            discount: 5,
            discountAmount: 10,
            lineTotal: 190,
          }),
        ]}
      />
    );
    expect(html).toContain("₱100.00");
    expect(html).toContain("₱10.00 (5%)");
    expect(html).toContain("₱200.00");
    expect(html).not.toContain("₱190.00");
  });

  it("uses pre-tax amounts for the percentage beside a fixed discount", () => {
    const html = renderToStaticMarkup(
      <SalesDocumentLineItemsTable
        documentId="order"
        showFulfilled={false}
        items={[line({ discountAmount: 100, taxRate: 12, lineTotal: 1008 })]}
      />
    );
    expect(html).toContain("₱100.00 (10%)");
    expect(html).toContain("₱1000.00");
    expect(html).not.toContain("₱1008.00");
  });

  it("retains quotation fulfillment and sales-order production columns independently", () => {
    const item = { ...line(), orderedQuantity: 2, production: "Job A ready" };
    const quotation = renderToStaticMarkup(
      <SalesDocumentLineItemsTable documentId="quote" showFulfilled items={[item]} />
    );
    const order = renderToStaticMarkup(
      <SalesDocumentLineItemsTable
        documentId="order"
        showFulfilled={false}
        items={[item]}
        productionColumn={{ label: "Production", render: (entry) => entry.production }}
      />
    );
    expect(quotation).toContain("fulfilled");
    expect(quotation).toContain("₱500.67");
    expect(quotation).not.toContain("₱300.67");
    expect(order).toContain("Production");
    expect(order).toContain("₱500.67");
    expect(order).not.toContain("₱300.67");
    expect(order).toContain("Job A ready");
    expect(order).not.toContain("fulfilled");
  });

  it("restores the exact gross amount rather than multiplying a rounded selling rate", () => {
    const item = line({ quantity: 3, unitPrice: 541.6, discountAmount: 20, lineTotal: 1604.79 });
    const html = renderToStaticMarkup(
      <SalesDocumentLineItemsTable documentId="quote" items={[item]} showFulfilled />
    );
    expect(html).toContain("₱1624.79");
    expect(html).not.toContain("₱1624.80");
    expect(item.lineTotal).toBe(1604.79);
  });

  it("shows the gross amount even when a fixed discount makes the payable amount zero", () => {
    const html = renderToStaticMarkup(
      <SalesDocumentLineItemsTable
        documentId="quote"
        showFulfilled
        items={[line({ discountAmount: 500.67, lineTotal: 0 })]}
      />
    );
    expect(html).toContain("₱500.67 (100%)");
    expect(html).not.toContain("₱0.00");
  });

  it("includes each size's component discounts once in the gross row amount", () => {
    const component = (discountAmount: number): FrameQuotationComponent => ({
      itemId: "moulding",
      componentType: "molding",
      source: "auto",
      description: "Moulding",
      qtyPerFrame: 1,
      totalQuantity: 1,
      uomId: "cut",
      unitRate: 50,
      totalAmount: 50 - discountAmount,
      discountAmount,
      roundingMode: "none",
      sortOrder: 0,
    });
    const html = renderToStaticMarkup(
      <SalesDocumentLineItemsTable
        documentId="quote"
        showFulfilled
        items={[
          line({
            unitPrice: 100,
            lineTotal: 70,
            discountAmount: 10,
            frameComponents: [component(999)],
            frameSizes: [10, 10].map((amount) => ({
              frameConfiguration: config("chop_join"),
              frameComponents: [component(amount)],
              matLayers: [],
            })),
          }),
        ]}
      />
    );
    expect(html).toContain("₱100.00");
    expect(html).toContain("₱30.00 (30%)");
    expect(html).not.toContain("₱70.00");
    expect(html).not.toContain("₱999.00");
  });

  it("shows one parent row and an expansion control for chop & join components", () => {
    const html = renderToStaticMarkup(
      <SalesDocumentLineItemsTable
        documentId="order"
        showFulfilled={false}
        items={[
          line({
            frameConfiguration: config("chop_join"),
            frameComponents: [
              {
                itemId: "material",
                componentType: "molding",
                source: "auto",
                description: "Component details",
                qtyPerFrame: 1,
                totalQuantity: 1,
                uomId: "cut",
                unitRate: 500.67,
                totalAmount: 500.67,
                roundingMode: "none",
                sortOrder: 0,
              },
            ],
          }),
        ]}
      />
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("showLineDetails");
    expect(html).not.toContain("Component details");
    expect(html).toContain("₱200.00");
  });
});
