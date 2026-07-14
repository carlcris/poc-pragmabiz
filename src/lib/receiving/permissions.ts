import { NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requireAnyPermission } from "@/lib/auth";
import { requireRequestContext, type RequestContext } from "@/lib/auth/requestContext";
import { getUserCapabilities, hasCapability } from "@/services/permissions/permissionResolver";

export const requireLoadListReceivingView = () =>
  requireAnyPermission([
    [RESOURCES.LOAD_LISTS, "view"],
    [RESOURCES.GOODS_RECEIPT_NOTES, "view"],
  ]);

export type LoadListReceivingDetailAccess = {
  context: RequestContext;
};

export async function requireLoadListReceivingDetailAccess(
  includeGrn: boolean
): Promise<LoadListReceivingDetailAccess | NextResponse> {
  const context = await requireRequestContext();
  if ("status" in context) return context;

  const capabilities = await getUserCapabilities(context.userId, context.currentBusinessUnitId);
  const canViewLoadLists = hasCapability(capabilities, RESOURCES.LOAD_LISTS, "view");
  const canViewGrns = hasCapability(capabilities, RESOURCES.GOODS_RECEIPT_NOTES, "view");

  if (!canViewLoadLists && !canViewGrns) {
    return NextResponse.json(
      { error: "Forbidden", details: "You do not have permission to view load list receiving" },
      { status: 403 }
    );
  }

  if (includeGrn && !canViewGrns) {
    return NextResponse.json(
      { error: "Forbidden", details: "You do not have permission to view goods receipt notes" },
      { status: 403 }
    );
  }

  return { context };
}
