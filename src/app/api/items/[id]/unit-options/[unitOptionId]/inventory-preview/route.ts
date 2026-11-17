import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { RESOURCES } from "@/constants/resources";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { checkPermissionForUser } from "@/lib/auth/checkPermission";
import { requireRequestContext } from "@/lib/auth/requestContext";
import type { Database } from "@/types/database.types";
import type { ItemInventoryPreviewErrorCode } from "@/types/item";

const previewPayload = z.strictObject({ enabled: z.boolean() });
const previewParams = z.object({ id: z.guid(), unitOptionId: z.guid() });

const previewError = (status: number, code: ItemInventoryPreviewErrorCode, error: string) =>
  NextResponse.json({ error, code }, { status });

const forbidden = () =>
  previewError(403, "INVENTORY_PREVIEW_FORBIDDEN", "You cannot change this inventory preview.");

async function PUTHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; unitOptionId: string }> }
) {
  try {
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { userId, companyId, currentBusinessUnitId } = context;
    const supabase: SupabaseClient<Database> = context.supabase;
    if (!currentBusinessUnitId) return forbidden();
    const canEdit = await checkPermissionForUser(
      { id: userId, companyId, businessUnitId: currentBusinessUnitId },
      RESOURCES.ITEMS,
      "edit"
    );
    if (!canEdit) return forbidden();

    const target = previewParams.safeParse(await params);
    const payload = previewPayload.safeParse(await request.json().catch(() => null));
    if (!target.success || !payload.success) {
      return previewError(
        400,
        "INVENTORY_PREVIEW_INVALID_REQUEST",
        "Refresh Unit Options and select the unit again."
      );
    }

    const { error } = await supabase.rpc("set_item_inventory_preview_unit", {
      p_company_id: companyId,
      p_item_id: target.data.id,
      p_unit_option_id: target.data.unitOptionId,
      p_enabled: payload.data.enabled,
      p_business_unit_id: currentBusinessUnitId,
    });

    if (error?.code === "42501") return forbidden();
    if (error?.code === "P0002") {
      return previewError(
        404,
        "INVENTORY_PREVIEW_NOT_FOUND",
        "This item or unit option is no longer available. Refresh Unit Options and choose again."
      );
    }
    if (error?.code === "22023") {
      return previewError(
        409,
        "INVENTORY_PREVIEW_INELIGIBLE",
        "Choose an active unit option other than the base unit."
      );
    }
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update inventory preview unit:", error);
    return NextResponse.json(
      { error: "Could not save the inventory preview unit. Try again." },
      { status: 500 }
    );
  }
}

export const PUT = withActivityLogging(PUTHandler, {
  action: "update",
  resourceType: "items",
  route: "/api/items/[id]/unit-options/[unitOptionId]/inventory-preview",
});
