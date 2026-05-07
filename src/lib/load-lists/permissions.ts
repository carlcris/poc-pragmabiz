import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { getUserCapabilities, hasCapability } from "@/services/permissions/permissionResolver";
import type { LoadListCapabilities } from "@/types/load-list";

export async function resolveLoadListCapabilities(
  userId: string,
  businessUnitId: string | null
): Promise<LoadListCapabilities> {
  const capabilities = await getUserCapabilities(userId, businessUnitId);

  return {
    canViewTotalAmount: hasCapability(capabilities, GRANULAR_CAPABILITIES.LOAD_LISTS_TOTAL_AMOUNT),
    canViewUnitPrice: hasCapability(capabilities, GRANULAR_CAPABILITIES.LOAD_LISTS_UNIT_PRICE),
  };
}
