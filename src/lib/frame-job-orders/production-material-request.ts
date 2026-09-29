export type ProductionMaterialRequestAction = "create" | "approve" | "issue" | "cancel";

export type ProductionMaterialRequestErrorCode =
  | "MATERIAL_REQUEST_INVALID"
  | "MATERIAL_REQUEST_UNAUTHORIZED"
  | "MATERIAL_REQUEST_CONTEXT_INVALID"
  | "MATERIAL_REQUEST_PERMISSION_DENIED"
  | "MATERIAL_REQUEST_WAREHOUSE_REQUIRED"
  | "MATERIAL_REQUEST_WAREHOUSE_INVALID"
  | "MATERIAL_REQUEST_JOB_NOT_FOUND"
  | "MATERIAL_REQUEST_JOB_CLOSED"
  | "MATERIAL_REQUEST_ACTIVE_EXISTS"
  | "MATERIAL_REQUEST_NO_OUTSTANDING_MATERIALS"
  | "MATERIAL_REQUEST_MATERIAL_UNAVAILABLE"
  | "MATERIAL_REQUEST_TOO_LARGE"
  | "MATERIAL_REQUEST_NOT_FOUND"
  | "MATERIAL_REQUEST_STATUS_CHANGED"
  | "MATERIAL_REQUEST_STOCK_UNAVAILABLE"
  | "MATERIAL_REQUEST_INSUFFICIENT_STOCK"
  | "MATERIAL_REQUEST_RESERVATION_MISSING"
  | "MATERIAL_REQUEST_FAILED";

type MaterialRequestErrorCause = {
  code?: unknown;
};

const errorCodes = new Set<ProductionMaterialRequestErrorCode>([
  "MATERIAL_REQUEST_INVALID",
  "MATERIAL_REQUEST_UNAUTHORIZED",
  "MATERIAL_REQUEST_CONTEXT_INVALID",
  "MATERIAL_REQUEST_PERMISSION_DENIED",
  "MATERIAL_REQUEST_WAREHOUSE_REQUIRED",
  "MATERIAL_REQUEST_WAREHOUSE_INVALID",
  "MATERIAL_REQUEST_JOB_NOT_FOUND",
  "MATERIAL_REQUEST_JOB_CLOSED",
  "MATERIAL_REQUEST_ACTIVE_EXISTS",
  "MATERIAL_REQUEST_NO_OUTSTANDING_MATERIALS",
  "MATERIAL_REQUEST_MATERIAL_UNAVAILABLE",
  "MATERIAL_REQUEST_TOO_LARGE",
  "MATERIAL_REQUEST_NOT_FOUND",
  "MATERIAL_REQUEST_STATUS_CHANGED",
  "MATERIAL_REQUEST_STOCK_UNAVAILABLE",
  "MATERIAL_REQUEST_INSUFFICIENT_STOCK",
  "MATERIAL_REQUEST_RESERVATION_MISSING",
  "MATERIAL_REQUEST_FAILED",
]);

export const getProductionMaterialRequestErrorCode = (
  error: unknown
): ProductionMaterialRequestErrorCode => {
  if (!(error instanceof Error) || !error.cause || typeof error.cause !== "object") {
    return "MATERIAL_REQUEST_FAILED";
  }

  const code = (error.cause as MaterialRequestErrorCause).code;
  return typeof code === "string" && errorCodes.has(code as ProductionMaterialRequestErrorCode)
    ? (code as ProductionMaterialRequestErrorCode)
    : "MATERIAL_REQUEST_FAILED";
};

export const mutateProductionMaterialRequest = async (
  jobOrderId: string,
  action: ProductionMaterialRequestAction,
  warehouseId?: string
) => {
  const response = await fetch(`/api/frame-job-orders/${jobOrderId}/material-request`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      action === "create" ? { action, warehouseId: warehouseId || null } : { action }
    ),
  });
  const body = (await response.json().catch(() => null)) as {
    success?: boolean;
    materialRequestId?: string;
    code?: string;
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(body?.error || "Production material request failed", {
      cause: { code: body?.code || "MATERIAL_REQUEST_FAILED" },
    });
  }

  return body as {
    success: true;
    materialRequestId: string;
  };
};
