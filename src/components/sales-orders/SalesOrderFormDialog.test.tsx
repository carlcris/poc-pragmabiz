import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { SalesOrder, SalesOrderLineItem } from "@/types/sales-order";
import { SalesOrderFormDialog } from "./SalesOrderFormDialog";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/hooks/useCurrency", () => ({
  useCurrency: () => ({ symbol: "₱", formatCurrency: (value: number) => `₱${value.toFixed(2)}` }),
}));
vi.mock("@/hooks/useSalesOrders", () => ({
  useSalesOrderPaymentSummary: () => ({ data: undefined }),
}));
vi.mock("@react-pdf/renderer", () => ({ pdf: vi.fn() }));
vi.mock("./SalesOrderPDF", () => ({ SalesOrderPDF: () => null }));
vi.mock("./SalesOrderForm", () => ({ SalesOrderForm: () => <div>order-editor</div> }));
// Portals need a browser DOM. Render the dialog contents inline while retaining
// the real active dialog and line table, rather than testing only the helper.
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

const material: SalesOrderLineItem = {
  id: "raw",
  itemId: "material",
  itemCode: "PM057BK000",
  itemName: "Raw material",
  description: "Moulding",
  quantity: 7,
  uomId: "stick",
  uomCode: "STICK",
  unitPrice: 118,
  discount: 0,
  discountAmount: 0,
  taxRate: 0,
  lineTotal: 826,
};
const chop: SalesOrderLineItem = {
  ...material,
  id: "chop",
  itemName: "Chop & Join",
  quantity: 1,
  uomCode: "PCS",
  unitPrice: 500.67,
  discountAmount: 200,
  lineTotal: 300.67,
  frameConfiguration: {
    width: 20,
    height: 25,
    fixedAllowance: 0,
    serviceFeeMode: "per_frame",
    serviceFeeAmount: 0,
    totalServiceFee: 0,
    billingMode: "chop_join",
    invoiceDisplayMode: "components",
  },
  manufacturing: { required: true, status: "needs_job_order", label: "Needs Job Order" },
};
const order: SalesOrder = {
  id: "order",
  companyId: "company",
  orderNumber: "SO-1",
  customerId: "customer",
  customerName: "Customer",
  customerEmail: "",
  orderDate: "2026-09-25",
  expectedDeliveryDate: "2026-10-09",
  status: "draft",
  fulfillingWarehouseId: null,
  fulfillingWarehouseCode: null,
  fulfillingWarehouseName: null,
  lineItems: [
    chop,
    {
      ...chop,
      id: "frame",
      itemName: "Framing",
      unitPrice: 1025,
      discountAmount: 100,
      lineTotal: 925,
      frameConfiguration: {
        ...chop.frameConfiguration!,
        billingMode: "framing",
        invoiceDisplayMode: "summary",
      },
    },
    material,
  ],
  subtotal: 2351.67,
  totalDiscount: 300,
  totalTax: 0,
  totalAmount: 2051.67,
  shippingAddress: "",
  shippingCity: "",
  shippingState: "",
  shippingPostalCode: "",
  shippingCountry: "",
  paymentTerms: "",
  notes: "",
  createdBy: "actor",
  createdAt: "",
  updatedAt: "",
};

describe("Sales Orders page's combined view/edit dialog", () => {
  it("renders the quotation-style table in the actual view-mode dialog", () => {
    const html = renderToStaticMarkup(
      <SalesOrderFormDialog open onOpenChange={() => {}} salesOrder={order} initialMode="view" />
    );
    expect(html).toContain("₱200.00 (39.95%)");
    expect(html).toContain("₱100.00 (9.76%)");
    expect(html.match(/₱500\.67/g)).toHaveLength(1);
    expect(html.match(/₱1025\.00/g)).toHaveLength(1);
    expect(html).toContain("₱118.00");
    expect(html).not.toContain("₱300.67");
    expect(html).not.toContain("₱925.00");
    expect(html).toContain("₱826.00");
    expect(html).toContain("₱2051.67");
    expect(html).toContain("Needs Job Order");
    expect(html).not.toContain("order-editor");
  });

  it("keeps the existing editor separate from the read-only details table", () => {
    const html = renderToStaticMarkup(
      <SalesOrderFormDialog open onOpenChange={() => {}} salesOrder={order} initialMode="edit" />
    );
    expect(html).toContain("order-editor");
    expect(html).not.toContain("₱200.00 (39.95%)");
  });
});
