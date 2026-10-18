import "server-only";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";

export const getScopedWarehouse = async (warehouseId: string) => {
  const context = await createServerClientWithBU();
  if (!context.userId || !context.companyId || !context.currentBusinessUnitId) return null;

  const { data: warehouse, error } = await context.supabase
    .from("warehouses")
    .select("id")
    .eq("id", warehouseId)
    .eq("company_id", context.companyId)
    .eq("business_unit_id", context.currentBusinessUnitId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("Failed to validate warehouse floor map scope", error);
    return null;
  }

  return warehouse
    ? {
        ...context,
        userId: context.userId,
        companyId: context.companyId,
        currentBusinessUnitId: context.currentBusinessUnitId,
        warehouse,
      }
    : null;
};
