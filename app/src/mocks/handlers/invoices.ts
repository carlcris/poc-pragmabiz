import { http, HttpResponse } from "msw";
import type { Invoice, CreateInvoiceRequest, InvoiceLineItem, RecordPaymentRequest } from "@/types/invoice";
import { invoices } from "../data/invoices";

const invoicesData = [...invoices];
type InvoiceLineItemInput = Omit<InvoiceLineItem, "id" | "lineTotal">;
type InvoiceLineItemUpdate = InvoiceLineItemInput & { id?: string };

// Helper function to calculate line total
function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  discount: number,
  taxRate: number
): number {
  const subtotal = quantity * unitPrice;
  const discountAmount = (subtotal * discount) / 100;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = (taxableAmount * taxRate) / 100;
  return taxableAmount + taxAmount;
}

// Helper function to calculate invoice totals
function calculateTotals(lineItems: InvoiceLineItem[]) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalDiscount = lineItems.reduce(
    (sum, item) => sum + (item.quantity * item.unitPrice * item.discount) / 100,
    0
  );
  const totalTax = lineItems.reduce((sum, item) => {
    const itemSubtotal = item.quantity * item.unitPrice;
    const itemDiscount = (itemSubtotal * item.discount) / 100;
    const taxableAmount = itemSubtotal - itemDiscount;
    return sum + (taxableAmount * item.taxRate) / 100;
  }, 0);
  const totalAmount = subtotal - totalDiscount + totalTax;

  return { subtotal, totalDiscount, totalTax, totalAmount };
}

// Helper function to update invoice status based on payment
function updateInvoiceStatus(invoice: Invoice): Invoice {
  if (invoice.amountPaid >= invoice.totalAmount) {
    invoice.status = "paid";
    invoice.amountDue = 0;
  } else if (invoice.amountPaid > 0) {
    invoice.status = "partially_paid";
    invoice.amountDue = invoice.totalAmount - invoice.amountPaid;
  } else if (new Date(invoice.dueDate) < new Date() && invoice.status !== "cancelled") {
    invoice.status = "overdue";
    invoice.amountDue = invoice.totalAmount;
  }
  return invoice;
}

export const invoiceHandlers = [
  // GET /api/invoices
  http.get("/api/invoices", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase();
    const status = url.searchParams.get("status");
    const customerId = url.searchParams.get("customerId");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    let filtered = [...invoicesData];

    // Filter by search
    if (search) {
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoiceNumber.toLowerCase().includes(search) ||
          invoice.customerName.toLowerCase().includes(search) ||
          invoice.customerEmail.toLowerCase().includes(search)
      );
    }

    // Filter by status
    if (status && status !== "all") {
      filtered = filtered.filter((invoice) => invoice.status === status);
    }

    // Filter by customer
    if (customerId) {
      filtered = filtered.filter((invoice) => invoice.customerId === customerId);
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(
        (invoice) => new Date(invoice.invoiceDate) >= new Date(dateFrom)
      );
    }
    if (dateTo) {
      filtered = filtered.filter(
        (invoice) => new Date(invoice.invoiceDate) <= new Date(dateTo)
      );
    }

    // Sort by invoice date (newest first)
    filtered.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());

    // Pagination
    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedData = filtered.slice(start, end);

    return HttpResponse.json({
      data: paginatedData,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  }),

  // GET /api/invoices/:id
  http.get("/api/invoices/:id", ({ params }) => {
    const { id } = params;
    const invoice = invoicesData.find((inv) => inv.id === id);

    if (!invoice) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(invoice);
  }),

  // POST /api/invoices
  http.post("/api/invoices", async ({ request }) => {
    const body = (await request.json()) as CreateInvoiceRequest;

    const lineItems: InvoiceLineItem[] = body.lineItems.map((item, index) => ({
      id: `invli-${Date.now()}-${index}`,
      ...item,
      lineTotal: calculateLineTotal(item.quantity, item.unitPrice, item.discount, item.taxRate),
    }));

    const totals = calculateTotals(lineItems);
    const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoicesData.length + 1).padStart(3, "0")}`;

    const newInvoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber,
      customerName: "Customer Name",
      customerEmail: "customer@email.com",
      ...body,
      lineItems,
      ...totals,
      amountPaid: 0,
      amountDue: totals.totalAmount,
      status: "draft",
      createdBy: "admin@company.com",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    invoicesData.push(newInvoice);
    return HttpResponse.json(newInvoice, { status: 201 });
  }),

  // PUT /api/invoices/:id
  http.put("/api/invoices/:id", async ({ params, request }) => {
    const { id } = params;
    const body = await request.json() as Partial<CreateInvoiceRequest> & { status?: string; amountPaid?: number };
    const index = invoicesData.findIndex((inv) => inv.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    let lineItems = invoicesData[index].lineItems;
    let totals = {
      subtotal: invoicesData[index].subtotal,
      totalDiscount: invoicesData[index].totalDiscount,
      totalTax: invoicesData[index].totalTax,
      totalAmount: invoicesData[index].totalAmount,
    };

    if (body.lineItems) {
      lineItems = body.lineItems.map((item: InvoiceLineItemUpdate, idx: number) => ({
        id: item.id ?? `invli-${Date.now()}-${idx}`,
        ...item,
        lineTotal: calculateLineTotal(item.quantity, item.unitPrice, item.discount, item.taxRate),
      }));
      totals = calculateTotals(lineItems);
    }

    const updatedInvoice: Invoice = {
      ...invoicesData[index],
      ...(body as Partial<Invoice>),
      lineItems,
      ...totals,
      updatedAt: new Date().toISOString(),
    };

    invoicesData[index] = updateInvoiceStatus(updatedInvoice);
    return HttpResponse.json(invoicesData[index]);
  }),

  // DELETE /api/invoices/:id
  http.delete("/api/invoices/:id", ({ params }) => {
    const { id } = params;
    const index = invoicesData.findIndex((inv) => inv.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    invoicesData.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // POST /api/invoices/:id/send
  http.post("/api/invoices/:id/send", ({ params }) => {
    const { id } = params;
    const index = invoicesData.findIndex((inv) => inv.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    invoicesData[index].status = "sent";
    invoicesData[index].updatedAt = new Date().toISOString();
    return HttpResponse.json(invoicesData[index]);
  }),

  // POST /api/invoices/:invoiceId/payments
  http.post("/api/invoices/:invoiceId/payments", async ({ params, request }) => {
    const { invoiceId } = params;
    const body = await request.json() as RecordPaymentRequest;
    const index = invoicesData.findIndex((inv) => inv.id === invoiceId);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    invoicesData[index].amountPaid += body.amount;
    invoicesData[index].updatedAt = new Date().toISOString();
    invoicesData[index] = updateInvoiceStatus(invoicesData[index]);

    return HttpResponse.json(invoicesData[index]);
  }),

  // POST /api/invoices/:id/cancel
  http.post("/api/invoices/:id/cancel", ({ params }) => {
    const { id } = params;
    const index = invoicesData.findIndex((inv) => inv.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    invoicesData[index].status = "cancelled";
    invoicesData[index].updatedAt = new Date().toISOString();
    return HttpResponse.json(invoicesData[index]);
  }),
];
