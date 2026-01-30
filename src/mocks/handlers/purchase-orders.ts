import { http, HttpResponse } from "msw";
import type {
  PurchaseOrder,
  CreatePurchaseOrderRequest,
  PurchaseOrderLineItem,
} from "@/types/purchase-order";
import { purchaseOrders } from "../data/purchase-orders";
import { suppliers } from "../data/suppliers";

const purchaseOrdersData = [...purchaseOrders];
type PurchaseOrderLineItemInput = {
  id?: string;
  itemId: string;
  packagingId?: string | null;
  uomId?: string;
  quantity: number;
  rate: number;
  discountPercent: number;
  taxPercent: number;
  quantityReceived?: number;
} & Record<string, unknown>;

// Helper function to calculate line total
function calculateLineTotal(
  quantity: number,
  rate: number,
  discountPercent: number,
  taxPercent: number
): number {
  const subtotal = quantity * rate;
  const discountAmount = (subtotal * discountPercent) / 100;
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = (taxableAmount * taxPercent) / 100;
  return taxableAmount + taxAmount;
}

// Helper function to calculate order totals
function calculateTotals(lineItems: PurchaseOrderLineItem[]) {
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const discountAmount = lineItems.reduce(
    (sum, item) => sum + (item.quantity * item.rate * item.discountPercent) / 100,
    0
  );
  const taxAmount = lineItems.reduce((sum, item) => {
    const itemSubtotal = item.quantity * item.rate;
    const itemDiscount = (itemSubtotal * item.discountPercent) / 100;
    const taxableAmount = itemSubtotal - itemDiscount;
    return sum + (taxableAmount * item.taxPercent) / 100;
  }, 0);
  const totalAmount = subtotal - discountAmount + taxAmount;

  return { subtotal, discountAmount, taxAmount, totalAmount };
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
          order.orderCode.toLowerCase().includes(search) ||
          order.supplier?.name?.toLowerCase().includes(search) ||
          order.supplier?.email?.toLowerCase().includes(search)
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
      filtered = filtered.filter((order) => new Date(order.orderDate) >= new Date(dateFrom));
    }
    if (dateTo) {
      filtered = filtered.filter((order) => new Date(order.orderDate) <= new Date(dateTo));
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
      return HttpResponse.json({ error: "Supplier not found" }, { status: 400 });
    }

    // Calculate line totals
    const lineItems: PurchaseOrderLineItem[] = body.items.map((item, index) => ({
      id: `poli-${Date.now()}-${index}`,
      ...item,
      lineTotal: calculateLineTotal(
        item.quantity,
        item.rate,
        item.discountPercent,
        item.taxPercent
      ),
      quantityReceived: 0,
    }));

    // Calculate totals
    const totals = calculateTotals(lineItems);

    // Generate order number
    const orderCode = `PO-${new Date().getFullYear()}-${String(purchaseOrdersData.length + 1).padStart(3, "0")}`;

    const newOrder: PurchaseOrder = {
      id: `po-${Date.now()}`,
      companyId: "company-1",
      orderCode,
      supplier: {
        id: supplier.id,
        code: supplier.code,
        name: supplier.name,
        email: supplier.email,
        phone: supplier.phone,
      },
      ...body,
      items: lineItems,
      ...totals,
      status: "draft",
      createdBy: "user-1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    purchaseOrdersData.push(newOrder);

    return HttpResponse.json(newOrder, { status: 201 });
  }),

  // PATCH /api/purchase-orders/:id
  http.patch("/api/purchase-orders/:id", async ({ params, request }) => {
    const { id } = params;
    const body = (await request.json()) as Partial<CreatePurchaseOrderRequest> & {
      status?: string;
    };
    const index = purchaseOrdersData.findIndex((o) => o.id === id);

    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    // If line items are being updated, recalculate line totals
    let lineItems = purchaseOrdersData[index].items;
    let totals = {
      subtotal: purchaseOrdersData[index].subtotal,
      discountAmount: purchaseOrdersData[index].discountAmount,
      taxAmount: purchaseOrdersData[index].taxAmount,
      totalAmount: purchaseOrdersData[index].totalAmount,
    };

    if (body.items) {
      lineItems = body.items.map((item: PurchaseOrderLineItemInput, idx: number) => ({
        id: item.id ?? `poli-${Date.now()}-${idx}`,
        ...item,
        lineTotal: calculateLineTotal(
          item.quantity,
          item.rate,
          item.discountPercent,
          item.taxPercent
        ),
        quantityReceived: item.quantityReceived || 0,
      }));
      totals = calculateTotals(lineItems);
    }

    const updatedOrder: PurchaseOrder = {
      ...purchaseOrdersData[index],
      ...(body as Partial<PurchaseOrder>),
      items: lineItems,
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
