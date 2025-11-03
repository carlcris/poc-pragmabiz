import { http, HttpResponse } from "msw";
import type { PurchaseOrder, CreatePurchaseOrderRequest, PurchaseOrderLineItem } from "@/types/purchase-order";
import { purchaseOrders } from "../data/purchase-orders";
import { suppliers } from "../data/suppliers";

let purchaseOrdersData = [...purchaseOrders];

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
function calculateTotals(lineItems: PurchaseOrderLineItem[]) {
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

export const purchaseOrderHandlers = [
  // GET /api/purchase-orders
  http.get("/api/purchase-orders", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase();
    const status = url.searchParams.get("status");
    const supplierId = url.searchParams.get("supplierId");
    const dateFrom = url.searchParams.get("dateFrom");
    const dateTo = url.searchParams.get("dateTo");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    let filtered = [...purchaseOrdersData];

    // Filter by search
    if (search) {
      filtered = filtered.filter(
        (order) =>
          order.orderNumber.toLowerCase().includes(search) ||
          order.supplierName.toLowerCase().includes(search) ||
          order.supplierEmail.toLowerCase().includes(search)
      );
    }

    // Filter by status
    if (status && status !== "all") {
      filtered = filtered.filter((order) => order.status === status);
    }

    // Filter by supplier
    if (supplierId) {
      filtered = filtered.filter((order) => order.supplierId === supplierId);
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

  // GET /api/purchase-orders/:id
  http.get("/api/purchase-orders/:id", ({ params }) => {
    const { id } = params;
    const order = purchaseOrdersData.find((o) => o.id === id);

    if (!order) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(order);
  }),

  // POST /api/purchase-orders
  http.post("/api/purchase-orders", async ({ request }) => {
    const body = (await request.json()) as CreatePurchaseOrderRequest;

    // Get supplier info
    const supplier = suppliers.find((s) => s.id === body.supplierId);

    if (!supplier) {
      return HttpResponse.json(
        { error: "Supplier not found" },
        { status: 400 }
      );
    }

    // Calculate line totals
    const lineItems: PurchaseOrderLineItem[] = body.lineItems.map((item, index) => ({
      id: `poli-${Date.now()}-${index}`,
      ...item,
      lineTotal: calculateLineTotal(item.quantity, item.unitPrice, item.discount, item.taxRate),
      quantityReceived: 0,
    }));

    // Calculate totals
    const totals = calculateTotals(lineItems);

    // Generate order number
    const orderNumber = `PO-${new Date().getFullYear()}-${String(purchaseOrdersData.length + 1).padStart(3, "0")}`;

    const newOrder: PurchaseOrder = {
      id: `po-${Date.now()}`,
      orderNumber,
      supplierName: supplier.name,
      supplierEmail: supplier.email,
      ...body,
      lineItems,
      ...totals,
      status: "draft",
      createdByName: "Current User",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    purchaseOrdersData.push(newOrder);

    return HttpResponse.json(newOrder, { status: 201 });
  }),

  // PATCH /api/purchase-orders/:id
  http.patch("/api/purchase-orders/:id", async ({ params, request }) => {
    const { id } = params;
    const body = await request.json() as Partial<CreatePurchaseOrderRequest> & { status?: string };
    const index = purchaseOrdersData.findIndex((o) => o.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    // If line items are being updated, recalculate line totals
    let lineItems = purchaseOrdersData[index].lineItems;
    let totals = {
      subtotal: purchaseOrdersData[index].subtotal,
      totalDiscount: purchaseOrdersData[index].totalDiscount,
      totalTax: purchaseOrdersData[index].totalTax,
      totalAmount: purchaseOrdersData[index].totalAmount,
    };

    if (body.lineItems) {
      lineItems = body.lineItems.map((item: any, idx: number) => ({
        id: item.id || `poli-${Date.now()}-${idx}`,
        ...item,
        lineTotal: calculateLineTotal(item.quantity, item.unitPrice, item.discount, item.taxRate),
        quantityReceived: item.quantityReceived || 0,
      }));
      totals = calculateTotals(lineItems);
    }

    const updatedOrder: PurchaseOrder = {
      ...purchaseOrdersData[index],
      ...(body as Partial<PurchaseOrder>),
      lineItems,
      ...totals,
      updatedAt: new Date().toISOString(),
    };

    purchaseOrdersData[index] = updatedOrder;

    return HttpResponse.json(updatedOrder);
  }),

  // DELETE /api/purchase-orders/:id
  http.delete("/api/purchase-orders/:id", ({ params }) => {
    const { id } = params;
    const index = purchaseOrdersData.findIndex((o) => o.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    purchaseOrdersData.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /api/purchase-orders/:id/submit
  http.post("/api/purchase-orders/:id/submit", ({ params }) => {
    const { id } = params;
    const index = purchaseOrdersData.findIndex((o) => o.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    purchaseOrdersData[index].status = "submitted";
    purchaseOrdersData[index].updatedAt = new Date().toISOString();

    return HttpResponse.json(purchaseOrdersData[index]);
  }),

  // POST /api/purchase-orders/:id/approve
  http.post("/api/purchase-orders/:id/approve", ({ params }) => {
    const { id } = params;
    const index = purchaseOrdersData.findIndex((o) => o.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    purchaseOrdersData[index].status = "approved";
    purchaseOrdersData[index].approvedBy = "user-1";
    purchaseOrdersData[index].approvedByName = "Admin User";
    purchaseOrdersData[index].approvedAt = new Date().toISOString();
    purchaseOrdersData[index].updatedAt = new Date().toISOString();

    return HttpResponse.json(purchaseOrdersData[index]);
  }),

  // POST /api/purchase-orders/:id/cancel
  http.post("/api/purchase-orders/:id/cancel", ({ params }) => {
    const { id } = params;
    const index = purchaseOrdersData.findIndex((o) => o.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    purchaseOrdersData[index].status = "cancelled";
    purchaseOrdersData[index].updatedAt = new Date().toISOString();

    return HttpResponse.json(purchaseOrdersData[index]);
  }),
];
