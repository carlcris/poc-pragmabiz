import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  setActivityContextIfAvailable,
  withActivityLogging,
} from "@/lib/activity-logging/route-activity-logger";
import { requireRequestContext } from "@/lib/auth/requestContext";
import {
  LOAD_LIST_MARK_IN_TRANSIT_CAPABILITY,
  requireLoadListOperation,
} from "@/lib/load-lists/permissions";
import type { Database } from "@/types/database.types";

const transitDetailsSchema = z
  .object({
    linerName: z.string().trim().max(150).nullable().optional(),
    estimatedArrivalDate: z.iso
      .date()
      .refine((value) => value >= "0001-01-01")
      .nullable()
      .optional(),
  })
  .strict()
  .refine((value) => value.linerName !== undefined || value.estimatedArrivalDate !== undefined);

async function PATCHHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const denied = await requireLoadListOperation(LOAD_LIST_MARK_IN_TRANSIT_CAPABILITY);
    if (denied) {
      if (denied.status !== 403) return denied;
      return NextResponse.json(
        {
          error: "You do not have permission to edit transit details.",
          code: "LOAD_LIST_TRANSIT_DETAILS_FORBIDDEN",
        },
        { status: 403 }
      );
    }

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;
    if (!currentBusinessUnitId) {
      return NextResponse.json(
        {
          error: "Select the source business unit and try again.",
          code: "LOAD_LIST_TRANSIT_DETAILS_SCOPE_REQUIRED",
        },
        { status: 400 }
      );
    }

    const { id } = await params;
    const body = transitDetailsSchema.safeParse(await request.json().catch(() => null));
    if (!z.uuid().safeParse(id).success || !body.success) {
      return NextResponse.json(
        {
          error: "Enter a valid liner name of up to 150 characters and a valid arrival date.",
          code: "INVALID_LOAD_LIST_TRANSIT_DETAILS",
        },
        { status: 400 }
      );
    }

    const update: Database["public"]["Tables"]["load_lists"]["Update"] = {
      updated_by: userId,
    };
    if (body.data.linerName !== undefined) {
      update.liner_name = body.data.linerName || null;
    }
    if (body.data.estimatedArrivalDate !== undefined) {
      update.estimated_arrival_date = body.data.estimatedArrivalDate;
    }

    const { data: loadList, error } = await supabase
      .from("load_lists")
      .update(update)
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .eq("status", "in_transit")
      .is("deleted_at", null)
      .select("id, ll_number")
      .maybeSingle();

    if (error) throw error;
    if (!loadList) {
      return NextResponse.json(
        {
          error:
            "This load list is no longer available for transit edits. Refresh it in the source business unit.",
          code: "LOAD_LIST_TRANSIT_DETAILS_UNAVAILABLE",
        },
        { status: 409 }
      );
    }

    setActivityContextIfAvailable({ entityId: loadList.id, entityCode: loadList.ll_number });
    return NextResponse.json({ id: loadList.id, llNumber: loadList.ll_number });
  } catch (error) {
    console.error("Failed to update load list transit details", error);
    return NextResponse.json(
      { error: "Could not save transit details. Try again." },
      { status: 500 }
    );
  }
}

export const PATCH = withActivityLogging(PATCHHandler, {
  action: "update",
  resourceType: "load_lists",
  route: "/api/load-lists/[id]/transit-details",
});
