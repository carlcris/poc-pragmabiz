import type {
  SalesOrder,
  SalesOrderFilters,
  CreateSalesOrderRequest,
  UpdateSalesOrderRequest,
  SalesOrderPaymentSummary,
  SalesOrderMutationErrorCode,
} from "@/types/sales-order";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export class SalesOrderMutationError extends Error {
  readonly code: SalesOrderMutationErrorCode;

  constructor(message: string, code: SalesOrderMutationErrorCode) {
    super(message);
    this.name = "SalesOrderMutationError";
    this.code = code;
  }
}

const salesOrderMutationErrorCodes = new Set<SalesOrderMutationErrorCode>([
  "SALES_ORDER_UNAUTHENTICATED",
  "SALES_ORDER_FORBIDDEN",
  "SALES_ORDER_NOT_FOUND",
  "SALES_ORDER_NOT_EDITABLE",
  "SALES_ORDER_ITEMS_REQUIRED",
  "SALES_ORDER_VALIDATION_FAILED",
  "SALES_ORDER_CUSTOMER_INVALID",
  "SALES_ORDER_QUOTATION_LINE_INVALID",
  "SALES_ORDER_QUOTATION_FRAME_INVALID",
  "SALES_ORDER_FRAME_SOURCE_REQUIRED",
  "SALES_ORDER_FRAME_SIZE_INVALID",
  "SALES_ORDER_FRAME_QUANTITY_EXCEEDS_REMAINING",
  "SALES_ORDER_FRAME_QUANTITY_MISMATCH",
  "SALES_ORDER_SAVE_FAILED",
]);

const isSalesOrderMutationErrorCode = (value: unknown): value is SalesOrderMutationErrorCode =>
  typeof value === "string" &&
  salesOrderMutationErrorCodes.has(value as SalesOrderMutationErrorCode);

const parseSalesOrderMutationError = async (
  response: Response,
  fallback: string
): Promise<SalesOrderMutationError> => {
  const payload: unknown = await response.json().catch(() => null);
  if (typeof payload !== "object" || payload === null) {
    return new SalesOrderMutationError(fallback, "SALES_ORDER_SAVE_FAILED");
  }
  const message =
    "error" in payload && typeof payload.error === "string" ? payload.error : fallback;
  const code =
    "code" in payload && isSalesOrderMutationErrorCode(payload.code)
      ? payload.code
      : "SALES_ORDER_SAVE_FAILED";
  return new SalesOrderMutationError(message, code);
};

export interface SalesOrdersResponse {
  data: SalesOrder[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * A job order created from a sales order. `billingMode` says which kind of work
 * it covers — an order mixing chop & join and framing lines produces one of each.
 */
export interface FrameJobOrderCreated {
  id: string;
  jobOrderCode: string;
  billingMode: string;
}

export const salesOrdersApi = {
  async getSalesOrders(filters?: SalesOrderFilters): Promise<SalesOrdersResponse> {
    const params = new URLSearchParams();

    if (filters?.search) params.append("search", filters.search);
    if (filters?.status && filters.status !== "all") params.append("status", filters.status);
    if (filters?.customerId) params.append("customerId", filters.customerId);
    if (filters?.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters?.dateTo) params.append("dateTo", filters.dateTo);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.limit) params.append("limit", filters.limit.toString());

    const response = await fetch(`${API_BASE_URL}/sales-orders?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch sales orders");
    return response.json();
  },

  async getSalesOrder(id: string): Promise<SalesOrder> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}`);
    if (!response.ok) throw new Error("Failed to fetch sales order");
    return response.json();
  },

  async createSalesOrder(data: CreateSalesOrderRequest): Promise<SalesOrder> {
    const response = await fetch(`${API_BASE_URL}/sales-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw await parseSalesOrderMutationError(response, "Failed to create sales order");
    }
    return response.json();
  },

  async updateSalesOrder(id: string, data: UpdateSalesOrderRequest): Promise<SalesOrder> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw await parseSalesOrderMutationError(response, "Failed to update sales order");
    }
    return response.json();
  },

  async deleteSalesOrder(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete sales order");
  },

  async confirmOrder(id: string, warehouseId: string): Promise<SalesOrder> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warehouseId }),
    });
    if (!response.ok) {
      const error: unknown = await response.json().catch(() => null);
      const message =
        typeof error === "object" &&
        error !== null &&
        "error" in error &&
        typeof error.error === "string"
          ? error.error
          : "Failed to confirm sales order";
      throw new Error(message);
    }
    return response.json();
  },

  async shipOrder(id: string): Promise<SalesOrder> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}/ship`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to ship sales order");
    return response.json();
  },

  async deliverOrder(id: string): Promise<SalesOrder> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}/deliver`, {
      method: "POST",
    });
    if (!response.ok) throw new Error("Failed to deliver sales order");
    return response.json();
  },

  async cancelOrder(
    id: string
  ): Promise<{ success: boolean; salesOrderId: string; status: string }> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}/cancel`, {
      method: "POST",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to cancel sales order" }));
      throw new Error(error.error || "Failed to cancel sales order");
    }
    return response.json();
  },

  async convertToInvoice(
    id: string,
    warehouseId: string,
    locationId?: string
  ): Promise<{
    success: boolean;
    message: string;
    invoice: { id: string; invoiceNumber: string };
  }> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}/convert-to-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warehouseId, locationId }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to convert to invoice" }));
      throw new Error(error.error || "Failed to convert sales order to invoice");
    }
    return response.json();
  },

  async createFrameJobOrder(id: string): Promise<{
    success: boolean;
    salesOrderId: string;
    /** The first job order created. Kept for callers that expect a single job. */
    frameJobOrder: FrameJobOrderCreated;
    /** Every job order created — one per billing mode present on the order. */
    frameJobOrders: FrameJobOrderCreated[];
  }> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}/create-frame-job-order`, {
      method: "POST",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to create job order" }));
      throw new Error(error.error || "Failed to create job order");
    }
    return response.json();
  },

  async getPaymentSummary(id: string): Promise<SalesOrderPaymentSummary> {
    const response = await fetch(`${API_BASE_URL}/sales-orders/${id}/payment-summary`);
    if (!response.ok) throw new Error("Failed to fetch payment summary");
    return response.json();
  },
};
