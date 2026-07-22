import { NextResponse } from "next/server";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { getUserCapabilities, hasCapability } from "@/services/permissions/permissionResolver";

export type CustomerPricingCapabilities = {
  canView: boolean;
  canManage: boolean;
};

export const getCustomerPricingCapabilities = async (
  userId: string,
  businessUnitId: string | null
): Promise<CustomerPricingCapabilities> => {
  const capabilities = await getUserCapabilities(userId, businessUnitId);

  return {
    canView: hasCapability(capabilities, GRANULAR_CAPABILITIES.CUSTOMER_SPECIAL_PRICES_VIEW),
    canManage: hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.CUSTOMER_SPECIAL_PRICES_MANAGE,
      "edit"
    ),
  };
};

export const requireCustomerPricingCapability = async (
  userId: string,
  businessUnitId: string | null,
  capability: keyof CustomerPricingCapabilities
) => {
  const capabilities = await getCustomerPricingCapabilities(userId, businessUnitId);
  if (capabilities[capability]) return null;

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
};
