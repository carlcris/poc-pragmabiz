import { NextResponse } from "next/server";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { RESOURCES } from "@/constants/resources";
import { getAuthenticatedUser, requirePermission } from "@/lib/auth";
import { canAccessCapability } from "@/services/permissions/permissionResolver";
import type { PermissionAction } from "@/types/rbac";

export const DELIVERY_NOTE_RECEIVING_CAPABILITY = GRANULAR_CAPABILITIES.DELIVERY_NOTE_RECEIVING;

export async function requireDeliveryNoteReceivingAccess(
  parentAction: Extract<PermissionAction, "view" | "edit">
): Promise<NextResponse | null> {
  const parentDenied = await requirePermission(RESOURCES.STOCK_REQUESTS, parentAction);
  if (parentDenied) return parentDenied;

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await canAccessCapability(
    user.id,
    DELIVERY_NOTE_RECEIVING_CAPABILITY,
    "edit",
    user.businessUnitId
  );
  if (!allowed) {
    return NextResponse.json(
      {
        error: "Forbidden",
        details: "You do not have permission to receive delivery notes",
      },
      { status: 403 }
    );
  }

  return null;
}
