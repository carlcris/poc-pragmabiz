import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import {
  LOAD_LIST_MARK_ARRIVED_CAPABILITY,
  LOAD_LIST_MARK_IN_TRANSIT_CAPABILITY,
  requireLoadListOperation,
} from "@/lib/load-lists/permissions";

const normalizeOptionalDate = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeLoadListItemBaseQty = (item: {
  load_list_qty?: string | number | null;
  item_unit_option?:
    | { qty_per_unit?: string | number | null }
    | { qty_per_unit?: string | number | null }[]
    | null;
}) => {
  const rawUnitOption = Array.isArray(item.item_unit_option)
    ? (item.item_unit_option[0] ?? null)
    : (item.item_unit_option ?? null);
  const qtyPerUnit = Number(rawUnitOption?.qty_per_unit ?? 1) || 1;
  const loadListQty = Number(item.load_list_qty ?? 0) || 0;

  return { loadListBaseQty: loadListQty * qtyPerUnit };
};

// PATCH /api/load-lists/[id]/status
async function PATCHHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.LOAD_LISTS, "view");
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;
    const body = await request.json();

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    if (body.status === "received") {
      return NextResponse.json(
        { error: "Load lists can only be marked received by confirming the linked GRN" },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = [
      "draft",
      "confirmed",
      "in_transit",
      "arrived",
      "receiving",
      "pending_approval",
      "cancelled",
    ];
    if (!body.status || !validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Fetch load list with items and warehouse info
    const { data: ll, error: fetchError } = await supabase
      .from("load_lists")
      .select(
        `
        id,
        ll_number,
        status,
        warehouse_id,
        created_by,
        liner_name,
        estimated_arrival_date,
        items:load_list_items(
          id,
          item_id,
          item_unit_option_id,
          load_list_qty,
          item_unit_option:item_unit_options(
            qty_per_unit
          )
        )
      `
      )
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !ll) {
      return NextResponse.json({ error: "Load list not found" }, { status: 404 });
    }

    const currentStatus = ll.status;
    const newStatus = body.status;
    const isArrivalReversal = currentStatus === "arrived" && newStatus === "in_transit";
    const isInitialInTransit = currentStatus === "confirmed" && newStatus === "in_transit";
    const isMarkArrived = newStatus === "arrived";
    const effectiveEstimatedArrivalDate =
      normalizeOptionalDate(body.estimatedArrivalDate) || ll.estimated_arrival_date || null;

    const operationDenied = isInitialInTransit
      ? await requireLoadListOperation(LOAD_LIST_MARK_IN_TRANSIT_CAPABILITY)
      : isMarkArrived
        ? await requireLoadListOperation(LOAD_LIST_MARK_ARRIVED_CAPABILITY)
        : await requirePermission(RESOURCES.LOAD_LISTS, "edit");
    if (operationDenied) return operationDenied;

    // Validate status transition
    if (currentStatus === "cancelled" && newStatus !== "cancelled") {
      return NextResponse.json(
        { error: "Cannot change status of a cancelled load list" },
        { status: 400 }
      );
    }

    if (currentStatus === "received" && newStatus !== "received" && newStatus !== "cancelled") {
      return NextResponse.json(
        { error: "Cannot change status of a received load list" },
        { status: 400 }
      );
    }

    if (
      newStatus === "cancelled" &&
      ["arrived", "receiving", "pending_approval", "received"].includes(currentStatus)
    ) {
      return NextResponse.json(
        {
          error:
            "Load lists that have arrived or started receiving must be reversed before cancellation",
        },
        { status: 400 }
      );
    }

    if (newStatus === "in_transit" && currentStatus !== "confirmed" && !isArrivalReversal) {
      return NextResponse.json(
        { error: "Only confirmed load lists can be marked in transit" },
        { status: 400 }
      );
    }

    if (isInitialInTransit) {
      const { error: markInTransitError } = await supabase.rpc("mark_load_list_in_transit", {
        p_company_id: companyId,
        p_business_unit_id: currentBusinessUnitId,
        p_user_id: userId,
        p_load_list_id: ll.id,
        p_estimated_arrival_date: effectiveEstimatedArrivalDate,
        p_liner_name:
          typeof body.linerName === "string" ? body.linerName.trim() || null : ll.liner_name,
      });

      if (markInTransitError) {
        console.error("Error marking load list in transit:", markInTransitError);
        const status = markInTransitError.message === "Unauthorized" ? 403 : 400;
        const error =
          markInTransitError.message === "Load list not found" ||
          markInTransitError.message === "Only confirmed load lists can be marked in transit"
            ? markInTransitError.message
            : "Failed to mark load list in transit";
        return NextResponse.json({ error }, { status });
      }

      return NextResponse.json({
        id: ll.id,
        llNumber: ll.ll_number,
        status: "in_transit",
        message: "Status updated successfully",
      });
    }

    if (isMarkArrived) {
      const { data: grnNumber, error: markArrivedError } = await supabase.rpc(
        "mark_load_list_arrived",
        {
          p_company_id: companyId,
          p_business_unit_id: currentBusinessUnitId,
          p_user_id: userId,
          p_load_list_id: ll.id,
          p_actual_arrival_date: new Date().toISOString().split("T")[0],
        }
      );

      if (markArrivedError) {
        console.error("Error marking load list arrived:", markArrivedError);
        const status = markArrivedError.message === "Unauthorized" ? 403 : 400;
        const error =
          markArrivedError.message === "Load list not found" ||
          markArrivedError.message === "Only in-transit load lists can be marked arrived" ||
          markArrivedError.message === "Load list has no items" ||
          markArrivedError.message === "Target warehouse not found"
            ? markArrivedError.message
            : "Failed to mark load list arrived";
        return NextResponse.json({ error }, { status });
      }

      if (ll.created_by) {
        const { error: notificationError } = await supabase.from("notifications").insert({
          company_id: companyId,
          user_id: ll.created_by,
          title: "Shipments arrived",
          message: `Load list ${ll.ll_number} has arrived.`,
          type: "load_list_status",
          metadata: {
            load_list_id: ll.id,
            ll_number: ll.ll_number,
            status: "arrived",
          },
        });

        if (notificationError) {
          console.error("Error creating load list arrival notification:", notificationError);
        }
      }

      return NextResponse.json({
        id: ll.id,
        llNumber: ll.ll_number,
        status: "arrived",
        message: grnNumber
          ? `Status updated successfully. GRN ${grnNumber} created.`
          : "Status updated successfully",
        ...(grnNumber ? { grnNumber } : {}),
      });
    }

    if (isArrivalReversal) {
      const { error: reversalError } = await supabase.rpc("reverse_load_list_arrival", {
        p_company_id: companyId,
        p_load_list_id: ll.id,
        p_user_id: userId,
      });

      if (reversalError) {
        console.error("Error reversing load list arrival:", reversalError);
        return NextResponse.json({ error: "Failed to reverse load list arrival" }, { status: 400 });
      }

      return NextResponse.json({
        id: ll.id,
        llNumber: ll.ll_number,
        status: "in_transit",
        message: "Status updated successfully",
      });
    }

    // ========================================================================
    // INVENTORY UPDATES - Critical business logic
    // ========================================================================

    try {
      // Handle transition FROM any active transit state TO "cancelled"
      if (currentStatus === "in_transit" && newStatus === "cancelled") {
        // Decrement in_transit (rollback)
        for (const item of ll.items) {
          const { loadListBaseQty } = normalizeLoadListItemBaseQty(item);
          // Ensure item_warehouse record exists
          const { data: existingRecord } = await supabase
            .from("item_warehouse")
            .select("id, in_transit")
            .eq("item_id", item.item_id)
            .eq("warehouse_id", ll.warehouse_id)
            .eq("company_id", companyId)
            .single();

          if (existingRecord) {
            const newInTransit = Math.max(
              0,
              parseFloat(existingRecord.in_transit) - loadListBaseQty
            );

            await supabase
              .from("item_warehouse")
              .update({
                in_transit: newInTransit,
                updated_by: userId,
              })
              .eq("item_id", item.item_id)
              .eq("warehouse_id", ll.warehouse_id)
              .eq("company_id", companyId);
          }
        }
      }
    } catch (inventoryError) {
      console.error("Error updating inventory:", inventoryError);
      return NextResponse.json(
        { error: "Failed to update inventory. Transaction rolled back." },
        { status: 500 }
      );
    }

    // Update load list status
    const updateData: Record<string, string | number | null> = {
      status: newStatus,
      updated_by: userId,
    };

    const { data: updatedLL, error: updateError } = await supabase
      .from("load_lists")
      .update(updateData)
      .eq("id", id)
      .select("id, ll_number, status")
      .single();

    if (updateError) {
      console.error("Error updating load list status:", updateError);
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }

    if (currentStatus !== newStatus && newStatus === "receiving") {
      const titleMap: Record<string, string> = {
        receiving: "Shipments receiving started",
      };
      const messageMap: Record<string, string> = {
        receiving: `Load list ${ll.ll_number} is now receiving.`,
      };

      const notificationTargets = [ll.created_by].filter(Boolean);
      if (notificationTargets.length > 0) {
        const notifications = notificationTargets.map((userId) => ({
          company_id: companyId,
          user_id: userId,
          title: titleMap[newStatus] || "Load list update",
          message: messageMap[newStatus] || `Load list ${ll.ll_number} updated.`,
          type: "load_list_status",
          metadata: {
            load_list_id: ll.id,
            ll_number: ll.ll_number,
            status: newStatus,
          },
        }));

        const { error: notificationError } = await supabase
          .from("notifications")
          .insert(notifications);

        if (notificationError) {
          console.error("Error creating load list notifications:", notificationError);
        }
      }
    }

    const response = {
      id: updatedLL.id,
      llNumber: updatedLL.ll_number,
      status: updatedLL.status,
      message: "Status updated successfully",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const PATCH = withActivityLogging(PATCHHandler, {
  action: "change_status",
  resourceType: "load_lists",
  route: "/api/load-lists/[id]/status",
});
