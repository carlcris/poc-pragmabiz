import { NextResponse } from "next/server";
import { GRANULAR_CAPABILITIES, type GranularCapability } from "@/constants/granular-permissions";
import { RESOURCES } from "@/constants/resources";
import { getAuthenticatedUser, requirePermission } from "@/lib/auth";
import {
  canAccessCapability,
  getUserCapabilities,
  hasCapability,
} from "@/services/permissions/permissionResolver";
import type { LoadListCapabilities } from "@/types/load-list";

export const LOAD_LIST_LINK_STOCK_REQUISITIONS_CAPABILITY =
  GRANULAR_CAPABILITIES.LOAD_LISTS_LINK_STOCK_REQUISITIONS;
export const LOAD_LIST_MARK_IN_TRANSIT_CAPABILITY =
  GRANULAR_CAPABILITIES.LOAD_LISTS_MARK_IN_TRANSIT;
export const LOAD_LIST_MARK_ARRIVED_CAPABILITY = GRANULAR_CAPABILITIES.LOAD_LISTS_MARK_ARRIVED;

export async function resolveLoadListCapabilities(
  userId: string,
  businessUnitId: string | null
): Promise<LoadListCapabilities> {
  const capabilities = await getUserCapabilities(userId, businessUnitId);

  return {
    canViewTotalAmount: hasCapability(capabilities, GRANULAR_CAPABILITIES.LOAD_LISTS_TOTAL_AMOUNT),
    canViewUnitPrice: hasCapability(capabilities, GRANULAR_CAPABILITIES.LOAD_LISTS_UNIT_PRICE),
    canLinkStockRequisitions: hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.LOAD_LISTS_LINK_STOCK_REQUISITIONS,
      "edit"
    ),
    canMarkInTransit: hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.LOAD_LISTS_MARK_IN_TRANSIT,
      "edit"
    ),
    canMarkArrived: hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.LOAD_LISTS_MARK_ARRIVED,
      "edit"
    ),
  };
}

export async function requireLoadListOperation(
  capability: GranularCapability
): Promise<NextResponse | null> {
  const parentDenied = await requirePermission(RESOURCES.LOAD_LISTS, "view");
  if (parentDenied) return parentDenied;

  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await canAccessCapability(user.id, capability, "edit", user.businessUnitId);
  if (!allowed) {
    return NextResponse.json(
      { error: "Forbidden", details: "You do not have permission for this load-list operation" },
      { status: 403 }
    );
  }

  return null;
}
