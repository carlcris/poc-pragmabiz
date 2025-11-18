import { http, HttpResponse } from "msw";
import { itemHandlers } from "./handlers/itemHandlers";
import { authHandlers } from "./handlers/authHandlers";
import { warehouseHandlers } from "./handlers/warehouses";
import { stockTransactionHandlers } from "./handlers/stock-transactions";
import { customerHandlers } from "./handlers/customers";
import { quotationHandlers } from "./handlers/quotations";
import { salesOrderHandlers } from "./handlers/sales-orders";
import { invoiceHandlers } from "./handlers/invoices";
import { supplierHandlers } from "./handlers/suppliers";
import { purchaseOrderHandlers } from "./handlers/purchase-orders";
import { posHandlers } from "./handlers/pos";
import { reorderHandlers } from "./handlers/reorder";
import { employeeHandlers } from "./handlers/employees";
import { analyticsHandlers } from "./handlers/analytics";

export const handlers = [
  ...authHandlers,
  ...itemHandlers,
  ...warehouseHandlers,
  ...stockTransactionHandlers,
  ...customerHandlers,
  ...quotationHandlers,
  ...salesOrderHandlers,
  ...invoiceHandlers,
  ...supplierHandlers,
  ...purchaseOrderHandlers,
  ...posHandlers,
  ...reorderHandlers,
  ...employeeHandlers,
  ...analyticsHandlers,

  // Health check endpoint
  http.get("/api/health", () => {
    return HttpResponse.json({ status: "ok", timestamp: new Date().toISOString() });
  }),
];
