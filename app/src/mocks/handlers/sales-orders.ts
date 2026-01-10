import { http, HttpResponse } from "msw";
import type { SalesOrder, CreateSalesOrderRequest, SalesOrderLineItem } from "@/types/sales-order";
import { salesOrders } from "../data/sales-orders";

const salesOrdersData = [...salesOrders];
type SalesOrderLineItemInput = {
  id?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
} & Record<string, unknown>;

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

// Helper function to calculate order totals
function calculateTotals(lineItems: SalesOrderLineItem[]) {
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

export const salesOrderHandlers = [
  // GET /api/sales-orders
  http.get("/api/sales-orders", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase();
    const status = url.searchParams.get("status");
    const customerId = url.searchParams.get("customerId");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    let filtered = [...salesOrdersData];

    // Filter by search
    if (search) {
      filtered = filtered.filter(
        (order) =>
          order.orderNumber.toLowerCase().includes(search) ||
          order.customerName.toLowerCase().includes(search) ||
          order.customerEmail.toLowerCase().includes(search)
      );
    }

    // Filter by status
    if (status && status !== "all") {
      filtered = filtered.filter((order) => order.status === status);
    }

    // Filter by customer
    if (customerId) {
      filtered = filtered.filter((order) => order.customerId === customerId);
    }

    // Filter by date range
    if (dateFrom) {
      filtered = filtered.filter(
        (order) => new Date(order.orderDate) >= new Date(dateFrom)
      );
    }
    if (dateTo) {
      filtered = filtered.filter(
        (order) => new Date(order.orderDate) <= new Date(dateTo)
      );
    }

    // Sort by order date (newest first)
    filtered.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

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

  // GET /api/sales-orders/:id
  http.get("/api/sales-orders/:id", ({ params }) => {
    const { id } = params;
    const order = salesOrdersData.find((o) => o.id === id);

    if (!order) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(order);
  }),

  // POST /api/sales-orders
  http.post("/api/sales-orders", async ({ request }) => {
    const body = (await request.json()) as CreateSalesOrderRequest;

    // Calculate line totals
    const lineItems: SalesOrderLineItem[] = body.lineItems.map((item, index) => ({
      id: `soli-${Date.now()}-${index}`,
      ...item,
      lineTotal: calculateLineTotal(item.quantity, item.unitPrice, item.discount, item.taxRate),
    }));

    // Calculate totals
    const totals = calculateTotals(lineItems);

    // Generate order number
    const orderNumber = `SO-${new Date().getFullYear()}-${String(salesOrdersData.length + 1).padStart(3, "0")}`;

    // Get customer info (in real app, this would come from the customer API)
    const customerName = "Customer Name"; // Placeholder
    const customerEmail = "customer@email.com"; // Placeholder

    const newOrder: SalesOrder = {
      id: `so-${Date.now()}`,
      orderNumber,
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

    salesOrdersData.push(newOrder);

    return HttpResponse.json(newOrder, { status: 201 });
  }),

  // PUT /api/sales-orders/:id
  http.put("/api/sales-orders/:id", async ({ params, request }) => {
    const { id } = params;
    const body = await request.json() as Partial<CreateSalesOrderRequest> & { status?: string };
    const index = salesOrdersData.findIndex((o) => o.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    // If line items are being updated, recalculate line totals
    let lineItems = salesOrdersData[index].lineItems;
    let totals = {
      subtotal: salesOrdersData[index].subtotal,
      totalDiscount: salesOrdersData[index].totalDiscount,
      totalTax: salesOrdersData[index].totalTax,
      totalAmount: salesOrdersData[index].totalAmount,
    };

    if (body.lineItems) {
      lineItems = body.lineItems.map((item: SalesOrderLineItemInput, idx: number) => ({
        id: item.id ?? `soli-${Date.now()}-${idx}`,
        ...item,
        lineTotal: calculateLineTotal(item.quantity, item.unitPrice, item.discount, item.taxRate),
      }));
      totals = calculateTotals(lineItems);
    }

    const updatedOrder: SalesOrder = {
      ...salesOrdersData[index],
      ...(body as Partial<SalesOrder>),
      lineItems,
      ...totals,
      updatedAt: new Date().toISOString(),
    };

    salesOrdersData[index] = updatedOrder;

    return HttpResponse.json(updatedOrder);
  }),

  // DELETE /api/sales-orders/:id
  http.delete("/api/sales-orders/:id", ({ params }) => {
    const { id } = params;
    const index = salesOrdersData.findIndex((o) => o.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    salesOrdersData.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /api/sales-orders/:id/confirm
  http.post("/api/sales-orders/:id/confirm", ({ params }) => {
    const { id } = params;
    const index = salesOrdersData.findIndex((o) => o.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    salesOrdersData[index].status = "confirmed";
    salesOrdersData[index].updatedAt = new Date().toISOString();

    return HttpResponse.json(salesOrdersData[index]);
  }),

  // POST /api/sales-orders/:id/ship
  http.post("/api/sales-orders/:id/ship", ({ params }) => {
    const { id } = params;
    const index = salesOrdersData.findIndex((o) => o.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    salesOrdersData[index].status = "shipped";
    // Update quantityShipped for all line items
    salesOrdersData[index].lineItems = salesOrdersData[index].lineItems.map(item => ({
      ...item,
      quantityShipped: item.quantity,
    }));
    salesOrdersData[index].updatedAt = new Date().toISOString();

    return HttpResponse.json(salesOrdersData[index]);
  }),

  // POST /api/sales-orders/:id/deliver
  http.post("/api/sales-orders/:id/deliver", ({ params }) => {
    const { id } = params;
    const index = salesOrdersData.findIndex((o) => o.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    salesOrdersData[index].status = "delivered";
    // Update quantityDelivered for all line items
    salesOrdersData[index].lineItems = salesOrdersData[index].lineItems.map(item => ({
      ...item,
      quantityDelivered: item.quantity,
    }));
    salesOrdersData[index].updatedAt = new Date().toISOString();

    return HttpResponse.json(salesOrdersData[index]);
  }),

  // POST /api/sales-orders/:id/cancel
  http.post("/api/sales-orders/:id/cancel", ({ params }) => {
    const { id } = params;
    const index = salesOrdersData.findIndex((o) => o.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    salesOrdersData[index].status = "cancelled";
    salesOrdersData[index].updatedAt = new Date().toISOString();

    return HttpResponse.json(salesOrdersData[index]);
  }),
];
