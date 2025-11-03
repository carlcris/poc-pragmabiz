import { http, HttpResponse } from "msw";
import type { Quotation, CreateQuotationRequest, QuotationLineItem } from "@/types/quotation";
import { quotations } from "../data/quotations";

let quotationsData = [...quotations];

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

// Helper function to calculate quotation totals
function calculateTotals(lineItems: QuotationLineItem[]) {
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

export const quotationHandlers = [
  // GET /api/quotations
  http.get("/api/quotations", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase();
    const status = url.searchParams.get("status");
    const customerId = url.searchParams.get("customerId");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    let filtered = [...quotationsData];

    // Filter by search
    if (search) {
      filtered = filtered.filter(
        (quotation) =>
          quotation.quotationNumber.toLowerCase().includes(search) ||
          quotation.customerName.toLowerCase().includes(search) ||
          quotation.customerEmail.toLowerCase().includes(search)
      );
    }

    // Filter by status
    if (status && status !== "all") {
      filtered = filtered.filter((quotation) => quotation.status === status);
    }

    // Filter by customer
    if (customerId) {
      filtered = filtered.filter((quotation) => quotation.customerId === customerId);
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(
        (quotation) => new Date(quotation.quotationDate) >= new Date(dateFrom)
      );
    }
    if (dateTo) {
      filtered = filtered.filter(
        (quotation) => new Date(quotation.quotationDate) <= new Date(dateTo)
      );
    }

    // Sort by quotation date (newest first)
    filtered.sort((a, b) => new Date(b.quotationDate).getTime() - new Date(a.quotationDate).getTime());

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

  // GET /api/quotations/:id
  http.get("/api/quotations/:id", ({ params }) => {
    const { id } = params;
    const quotation = quotationsData.find((q) => q.id === id);

    if (!quotation) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(quotation);
  }),

  // POST /api/quotations
  http.post("/api/quotations", async ({ request }) => {
    const body = (await request.json()) as CreateQuotationRequest;

    // Calculate line totals
    const lineItems: QuotationLineItem[] = body.lineItems.map((item, index) => ({
      id: `li-${Date.now()}-${index}`,
      ...item,
      lineTotal: calculateLineTotal(item.quantity, item.unitPrice, item.discount, item.taxRate),
    }));

    // Calculate totals
    const totals = calculateTotals(lineItems);

    // Generate quotation number
    const quotationNumber = `QT-${new Date().getFullYear()}-${String(quotationsData.length + 1).padStart(3, "0")}`;

    // Get customer info (in real app, this would come from the customer API)
    const customerName = "Customer Name"; // Placeholder
    const customerEmail = "customer@email.com"; // Placeholder

    const newQuotation: Quotation = {
      id: `quot-${Date.now()}`,
      quotationNumber,
      customerName,
      customerEmail,
      ...body,
      lineItems,
      ...totals,
      status: "draft",
      createdBy: "admin@company.com",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    quotationsData.push(newQuotation);

    return HttpResponse.json(newQuotation, { status: 201 });
  }),

  // PUT /api/quotations/:id
  http.put("/api/quotations/:id", async ({ params, request }) => {
    const { id } = params;
    const body = await request.json() as Partial<CreateQuotationRequest> & { status?: string };
    const index = quotationsData.findIndex((q) => q.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    // If line items are being updated, recalculate line totals
    let lineItems = quotationsData[index].lineItems;
    let totals = {
      subtotal: quotationsData[index].subtotal,
      totalDiscount: quotationsData[index].totalDiscount,
      totalTax: quotationsData[index].totalTax,
      totalAmount: quotationsData[index].totalAmount,
    };

    if (body.lineItems) {
      lineItems = body.lineItems.map((item: any, idx: number) => ({
        id: item.id || `li-${Date.now()}-${idx}`,
        ...item,
        lineTotal: calculateLineTotal(item.quantity, item.unitPrice, item.discount, item.taxRate),
      }));
      totals = calculateTotals(lineItems);
    }

    const updatedQuotation: Quotation = {
      ...quotationsData[index],
      ...(body as Partial<Quotation>),
      lineItems,
      ...totals,
      updatedAt: new Date().toISOString(),
    };

    quotationsData[index] = updatedQuotation;

    return HttpResponse.json(updatedQuotation);
  }),

  // DELETE /api/quotations/:id
  http.delete("/api/quotations/:id", ({ params }) => {
    const { id } = params;
    const index = quotationsData.findIndex((q) => q.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    quotationsData.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /api/quotations/:id/convert-to-order
  http.post("/api/quotations/:id/convert-to-order", ({ params }) => {
    const { id } = params;
    const quotation = quotationsData.find((q) => q.id === id);

    if (!quotation) {
      return new HttpResponse(null, { status: 404 });
    }

    // In a real app, this would create a sales order
    // For now, just update the status
    quotation.status = "accepted";
    quotation.updatedAt = new Date().toISOString();

    return HttpResponse.json({ message: "Quotation converted to order successfully" });
  }),
];
