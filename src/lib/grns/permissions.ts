import { NextResponse } from "next/server";
import { GRANULAR_CAPABILITIES, type GranularCapability } from "@/constants/granular-permissions";
import { RESOURCES } from "@/constants/resources";
import { getAuthenticatedUser, requirePermission } from "@/lib/auth";
import { canAccessCapability } from "@/services/permissions/permissionResolver";

export const GRN_RECEIVING_SAVE_CAPABILITY = GRANULAR_CAPABILITIES.GRN_RECEIVING_SAVE;
export const GRN_RECEIVING_START_CAPABILITY = GRANULAR_CAPABILITIES.GRN_RECEIVING_START;
export const GRN_RECEIVING_SUBMIT_CAPABILITY = GRANULAR_CAPABILITIES.GRN_RECEIVING_SUBMIT;

export async function requireGrnReceivingOperation(
  capability: GranularCapability
): Promise<NextResponse | null> {
  const parentDenied = await requirePermission(RESOURCES.GOODS_RECEIPT_NOTES, "view");
  if (parentDenied) return parentDenied;

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await canAccessCapability(user.id, capability, "edit", user.businessUnitId);
  if (!allowed) {
    return NextResponse.json(
      {
        error: "Forbidden",
        details: "You do not have permission to perform this GRN receiving operation",
      },
      { status: 403 }
    );
  }

  return null;
}
