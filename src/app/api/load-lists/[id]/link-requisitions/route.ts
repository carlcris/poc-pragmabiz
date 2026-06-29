import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";

// POST /api/load-lists/[id]/link-requisitions
// Link load list items to stock requisition items
async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.LOAD_LISTS, "edit");
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId } = context;
    const body = await request.json();

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    // Validate input
    if (!body.links || !Array.isArray(body.links) || body.links.length === 0) {
      return NextResponse.json(
        { error: "Links array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Verify load list exists
    const { data: ll, error: llError } = await supabase
      .from("load_lists")
      .select("id")
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .single();

    if (llError || !ll) {
      return NextResponse.json({ error: "Load list not found" }, { status: 404 });
    }

    // Process each link
    const linksToInsert = [];

    for (const link of body.links) {
      if (!link.loadListItemId || !link.srItemId || !link.fulfilledQty) {
        return NextResponse.json(
          { error: "Each link must have loadListItemId, srItemId, and fulfilledQty" },
          { status: 400 }
        );
      }

      // Verify load list item belongs to this load list
      const { data: llItem, error: llItemError } = await supabase
        .from("load_list_items")
        .select("id, load_list_id, load_list_qty")
        .eq("id", link.loadListItemId)
        .eq("load_list_id", id)
        .single();

      if (llItemError || !llItem) {
        return NextResponse.json(
          { error: `Load list item ${link.loadListItemId} not found in this load list` },
          { status: 400 }
        );
      }

      // Verify SR item exists and get current fulfilled_qty
      const { data: srItem, error: srItemError } = await supabase
        .from("stock_requisition_items")
        .select(
          `
          id,
          requested_qty,
          fulfilled_qty,
        sr:stock_requisitions!inner(id, company_id, business_unit_id, status)
      `
        )
        .eq("id", link.srItemId)
        .single();

      if (srItemError || !srItem) {
        return NextResponse.json(
          { error: `Stock requisition item ${link.srItemId} not found` },
          { status: 400 }
        );
      }

      // Verify SR belongs to same company
      const sr = Array.isArray(srItem.sr) ? srItem.sr[0] : srItem.sr;

      if (!sr || sr.company_id !== companyId || sr.business_unit_id !== currentBusinessUnitId) {
        return NextResponse.json(
          { error: "Stock requisition does not belong to your business unit" },
          { status: 403 }
        );
      }

      // Verify SR is not cancelled
      if (sr.status === "cancelled") {
        return NextResponse.json(
          { error: "Cannot link to a cancelled stock requisition" },
          { status: 400 }
        );
      }

      // Check if fulfilled_qty would exceed requested_qty
      const currentFulfilled = parseFloat(srItem.fulfilled_qty);
      const requestedQty = parseFloat(srItem.requested_qty);
      const newFulfilledQty = parseFloat(link.fulfilledQty);

      if (currentFulfilled + newFulfilledQty > requestedQty) {
        return NextResponse.json(
          {
            error: `Fulfilled quantity (${
              currentFulfilled + newFulfilledQty
            }) would exceed requested quantity (${requestedQty}) for SR item ${link.srItemId}`,
          },
          { status: 400 }
        );
      }

      // Add to links to insert
      linksToInsert.push({
        load_list_item_id: link.loadListItemId,
        sr_item_id: link.srItemId,
        fulfilled_qty: newFulfilledQty,
      });
    }

    // Insert links
    const { data: insertedLinks, error: insertError } = await supabase
      .from("load_list_sr_items")
      .insert(linksToInsert)
      .select("id");

    if (insertError) {
      console.error("Error creating links:", insertError);
      return NextResponse.json(
        { error: insertError.message || "Failed to create links" },
        { status: 500 }
      );
    }

    const { error: reconcileError } = await supabase.rpc(
      "recalculate_stock_requisition_fulfillment_for_load_list",
      {
        p_company_id: companyId,
        p_load_list_id: id,
      }
    );

    if (reconcileError) {
      console.error("Error reconciling stock requisition fulfillment:", reconcileError);

      if (insertedLinks && insertedLinks.length > 0) {
        await supabase
          .from("load_list_sr_items")
          .delete()
          .in(
            "id",
            insertedLinks.map((link) => link.id)
          );
      }

      return NextResponse.json(
        { error: "Failed to reconcile linked stock requisitions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Links created successfully",
      linksCreated: linksToInsert.length,
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/load-lists/[id]/link-requisitions
// Get linked requisitions for a load list
async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.LOAD_LISTS, "view");
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId } = context;

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const { data: ll, error: llError } = await supabase
      .from("load_lists")
      .select("id")
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .single();

    if (llError || !ll) {
      return NextResponse.json({ error: "Load list not found" }, { status: 404 });
    }

    // Fetch links with related data
    const { data: links, error } = await supabase
      .from("load_list_sr_items")
      .select(
        `
        id,
        fulfilled_qty,
        load_list_item:load_list_items(
          id,
          load_list_qty,
          item:items(id, item_code, item_name)
        ),
        sr_item:stock_requisition_items(
          id,
          requested_qty,
          fulfilled_qty,
          sr:stock_requisitions(
            id,
            sr_number,
            requisition_date,
            status
          )
        )
      `
      )
      .eq("load_list_item.load_list_id", id);

    if (error) {
      console.error("Error fetching linked requisitions:", error);
      return NextResponse.json({ error: "Failed to fetch linked requisitions" }, { status: 500 });
    }

    // Format response
    const formattedLinks = links?.map((link: Record<string, unknown>) => ({
      id: link.id,
      fulfilledQty: parseFloat(String(link.fulfilled_qty)),
      loadListItem: link.load_list_item
        ? {
            id: (link.load_list_item as Record<string, unknown>).id as string,
            loadListQty: parseFloat(
              String((link.load_list_item as Record<string, unknown>).load_list_qty)
            ),
            item: (link.load_list_item as Record<string, unknown>).item,
          }
        : null,
      srItem: link.sr_item
        ? {
            id: (link.sr_item as Record<string, unknown>).id as string,
            requestedQty: parseFloat(
              String((link.sr_item as Record<string, unknown>).requested_qty)
            ),
            fulfilledQty: parseFloat(
              String((link.sr_item as Record<string, unknown>).fulfilled_qty)
            ),
            sr: (link.sr_item as Record<string, unknown>).sr,
          }
        : null,
    }));

    return NextResponse.json({ data: formattedLinks });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "link_requisitions",
  resourceType: "load_lists",
  route: "/api/load-lists/[id]/link-requisitions",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "link_requisitions",
  resourceType: "load_lists",
  route: "/api/load-lists/[id]/link-requisitions",
});
