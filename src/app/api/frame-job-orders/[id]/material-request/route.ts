import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { asRpcClient, logQuotationError } from "../../../quotations/_shared";

const materialRequestMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), warehouseId: z.string().uuid() }).strict(),
  z.object({ action: z.literal("approve") }).strict(),
  z.object({ action: z.literal("issue") }).strict(),
  z.object({ action: z.literal("cancel") }).strict(),
]);

type MaterialRequestAction = z.infer<typeof materialRequestMutationSchema>["action"];

const materialRequestErrors: Record<
  string,
  { code: string; error: string; status: 400 | 403 | 404 | 409 }
> = {
  PRODUCTION_MATERIAL_REQUEST_CONTEXT_INVALID: {
    code: "MATERIAL_REQUEST_CONTEXT_INVALID",
    error: "Select a valid business unit and try again.",
    status: 400,
  },
  PRODUCTION_MATERIAL_REQUEST_PERMISSION_DENIED: {
    code: "MATERIAL_REQUEST_PERMISSION_DENIED",
    error: "You do not have permission to manage production material requests.",
    status: 403,
  },
  PRODUCTION_MATERIAL_REQUEST_WAREHOUSE_REQUIRED: {
    code: "MATERIAL_REQUEST_WAREHOUSE_REQUIRED",
    error: "Select the warehouse that will issue the production materials.",
    status: 400,
  },
  PRODUCTION_MATERIAL_REQUEST_WAREHOUSE_INVALID: {
    code: "MATERIAL_REQUEST_WAREHOUSE_INVALID",
    error: "Select an active warehouse in the job order business unit.",
    status: 409,
  },
  PRODUCTION_MATERIAL_REQUEST_JOB_NOT_FOUND: {
    code: "MATERIAL_REQUEST_JOB_NOT_FOUND",
    error: "This job order is no longer available.",
    status: 404,
  },
  PRODUCTION_MATERIAL_REQUEST_JOB_CLOSED: {
    code: "MATERIAL_REQUEST_JOB_CLOSED",
    error: "Materials cannot be requested for a completed or cancelled job order.",
    status: 409,
  },
  PRODUCTION_MATERIAL_REQUEST_ACTIVE_EXISTS: {
    code: "MATERIAL_REQUEST_ACTIVE_EXISTS",
    error: "This job order already has an active production material request.",
    status: 409,
  },
  PRODUCTION_MATERIAL_REQUEST_NO_OUTSTANDING_MATERIALS: {
    code: "MATERIAL_REQUEST_NO_OUTSTANDING_MATERIALS",
    error: "All stock-managed materials for this job order have already been issued.",
    status: 409,
  },
  PRODUCTION_MATERIAL_REQUEST_MATERIAL_UNAVAILABLE: {
    code: "MATERIAL_REQUEST_MATERIAL_UNAVAILABLE",
    error:
      "One or more required materials are unavailable. Reactivate them before creating the request.",
    status: 409,
  },
  PRODUCTION_MATERIAL_REQUEST_TOO_LARGE: {
    code: "MATERIAL_REQUEST_TOO_LARGE",
    error: "This job order has too many material lines for one request.",
    status: 409,
  },
  PRODUCTION_MATERIAL_REQUEST_NOT_FOUND: {
    code: "MATERIAL_REQUEST_NOT_FOUND",
    error: "Create a production material request before continuing.",
    status: 404,
  },
  PRODUCTION_MATERIAL_REQUEST_STATUS_CHANGED: {
    code: "MATERIAL_REQUEST_STATUS_CHANGED",
    error: "The material request status changed. Refresh the job order and try again.",
    status: 409,
  },
  PRODUCTION_MATERIAL_REQUEST_STOCK_UNAVAILABLE: {
    code: "MATERIAL_REQUEST_STOCK_UNAVAILABLE",
    error: "One or more required materials are not stocked in the selected warehouse.",
    status: 409,
  },
  PRODUCTION_MATERIAL_REQUEST_INSUFFICIENT_STOCK: {
    code: "MATERIAL_REQUEST_INSUFFICIENT_STOCK",
    error: "The selected warehouse does not have enough available stock for this request.",
    status: 409,
  },
  PRODUCTION_MATERIAL_REQUEST_RESERVATION_MISSING: {
    code: "MATERIAL_REQUEST_RESERVATION_MISSING",
    error: "The material reservation is incomplete. Cancel and recreate the request.",
    status: 409,
  },
};

const rpcByAction: Record<Exclude<MaterialRequestAction, "create">, string> = {
  approve: "approve_production_material_request_transaction",
  issue: "issue_production_material_request_transaction",
  cancel: "cancel_production_material_request_transaction",
};

async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const validation = materialRequestMutationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          code: "MATERIAL_REQUEST_INVALID",
          error: "Choose a valid material request action.",
        },
        { status: 400 }
      );
    }

    const requiredAction = validation.data.action === "create" ? "create" : "edit";
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, requiredAction);
    if (unauthorized) {
      return NextResponse.json(
        {
          code:
            unauthorized.status === 401
              ? "MATERIAL_REQUEST_UNAUTHORIZED"
              : "MATERIAL_REQUEST_PERMISSION_DENIED",
          error:
            unauthorized.status === 401
              ? "Sign in again to manage production material requests."
              : "You do not have permission to manage production material requests.",
        },
        { status: unauthorized.status === 401 ? 401 : 403 }
      );
    }

    const { id: jobOrderId } = await params;
    const { supabase } = await createServerClientWithBU();
    const rpcName =
      validation.data.action === "create"
        ? "create_production_material_request_transaction"
        : rpcByAction[validation.data.action];
    const rpcArgs =
      validation.data.action === "create"
        ? {
            p_frame_job_order_id: jobOrderId,
            p_warehouse_id: validation.data.warehouseId,
          }
        : { p_frame_job_order_id: jobOrderId };

    const { data: materialRequestId, error } = await asRpcClient(supabase).rpc(rpcName, rpcArgs);

    if (error || typeof materialRequestId !== "string") {
      logQuotationError("Production material request mutation failed", {
        jobOrderId,
        action: validation.data.action,
        error,
      });
      const mapped = materialRequestErrors[error?.message || ""];
      return NextResponse.json(
        mapped
          ? { code: mapped.code, error: mapped.error }
          : {
              code: "MATERIAL_REQUEST_FAILED",
              error: "The production material request could not be updated.",
            },
        { status: mapped?.status ?? 500 }
      );
    }

    return NextResponse.json({
      success: true,
      jobOrderId,
      materialRequestId,
      action: validation.data.action,
    });
  } catch (error) {
    logQuotationError("Unexpected production material request failure", error);
    return NextResponse.json(
      {
        code: "MATERIAL_REQUEST_FAILED",
        error: "The production material request could not be updated.",
      },
      { status: 500 }
    );
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "manage_material_request",
  resourceType: "frame_job_orders",
  route: "/api/frame-job-orders/[id]/material-request",
});
