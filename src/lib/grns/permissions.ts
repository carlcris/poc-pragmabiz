import { NextResponse } from "next/server";
import { GRANULAR_CAPABILITIES, type GranularCapability } from "@/constants/granular-permissions";
import { RESOURCES } from "@/constants/resources";
import { requireRequestContext, type RequestContext } from "@/lib/auth/requestContext";
import { getUserCapabilities, hasCapability } from "@/services/permissions/permissionResolver";

export const GRN_RECEIVING_SAVE_CAPABILITY = GRANULAR_CAPABILITIES.GRN_RECEIVING_SAVE;
export const GRN_RECEIVING_START_CAPABILITY = GRANULAR_CAPABILITIES.GRN_RECEIVING_START;
export const GRN_RECEIVING_SUBMIT_CAPABILITY = GRANULAR_CAPABILITIES.GRN_RECEIVING_SUBMIT;
export const GRN_RECEIVING_CONFIRM_CAPABILITY = GRANULAR_CAPABILITIES.GRN_RECEIVING_CONFIRM;

export type GrnReceivingOperationAccess = {
  context: RequestContext;
};

export async function requireGrnReceivingOperation(
  capability: GranularCapability
): Promise<GrnReceivingOperationAccess | NextResponse> {
  const context = await requireRequestContext();
  if ("status" in context) return context;

  const capabilities = await getUserCapabilities(context.userId, context.currentBusinessUnitId);
  if (!hasCapability(capabilities, RESOURCES.GOODS_RECEIPT_NOTES, "view")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        details: "You do not have permission to view goods receipt notes",
      },
      { status: 403 }
    );
  }

  if (!hasCapability(capabilities, capability, "edit")) {
    return NextResponse.json(
      {
        error: "Forbidden",
        details: "You do not have permission to perform this GRN receiving operation",
      },
      { status: 403 }
    );
  }

  return { context };
}
