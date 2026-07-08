import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";

type LinkRequest = {
  loadListItemId: string;
  srItemId: string;
  fulfilledQty: number;
};

const toNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

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

    const requestedLinks: LinkRequest[] = [];
    for (const rawLink of body.links as unknown[]) {
      const link = rawLink as Record<string, unknown>;
      const loadListItemId = typeof link.loadListItemId === "string" ? link.loadListItemId : "";
      const srItemId = typeof link.srItemId === "string" ? link.srItemId : "";
      const fulfilledQty = toNumber(link.fulfilledQty);

      if (!loadListItemId || !srItemId || fulfilledQty <= 0) {
        return NextResponse.json(
          { error: "Each link must have loadListItemId, srItemId, and a positive fulfilledQty" },
          { status: 400 }
        );
      }

      requestedLinks.push({ loadListItemId, srItemId, fulfilledQty });
    }

    // Verify load list exists
    const { data: ll, error: llError } = await supabase
      .from("load_lists")
      .select("id, status")
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .single();

    if (llError || !ll) {
      return NextResponse.json({ error: "Load list not found" }, { status: 404 });
    }

    if (!["draft", "confirmed"].includes(ll.status)) {
      return NextResponse.json(
        { error: "Only draft or confirmed load lists can be modified" },
        { status: 400 }
      );
    }

    const loadListItemIds = [...new Set(requestedLinks.map((link) => link.loadListItemId))];
    const srItemIds = [...new Set(requestedLinks.map((link) => link.srItemId))];

    const { data: llItems, error: llItemsError } = await supabase
      .from("load_list_items")
      .select("id, load_list_id, load_list_qty")
      .eq("load_list_id", id)
      .in("id", loadListItemIds);

    if (llItemsError || !llItems || llItems.length !== loadListItemIds.length) {
      return NextResponse.json(
        { error: "One or more load list items were not found in this load list" },
        { status: 400 }
      );
    }

    const { data: srItems, error: srItemsError } = await supabase
      .from("stock_requisition_items")
      .select(
        `
        id,
        requested_qty,
        fulfilled_qty,
        sr:stock_requisitions!inner(id, company_id, business_unit_id, status)
      `
      )
      .in("id", srItemIds);

    if (srItemsError || !srItems || srItems.length !== srItemIds.length) {
      return NextResponse.json(
        { error: "One or more stock requisition items were not found" },
        { status: 400 }
      );
    }

    const { data: existingLinks, error: existingLinksError } = await supabase
      .from("load_list_sr_items")
      .select("load_list_item_id, fulfilled_qty")
      .in("load_list_item_id", loadListItemIds);

    if (existingLinksError) {
      console.error("Error checking existing load list requisition links:", existingLinksError);
      return NextResponse.json({ error: "Failed to validate load list links" }, { status: 500 });
    }

    const llItemById = new Map(llItems.map((item) => [item.id, item]));
    const srItemById = new Map(srItems.map((item) => [item.id, item]));
    const linkedQtyByLoadListItem = new Map<string, number>();
    for (const existingLink of existingLinks || []) {
      const current = linkedQtyByLoadListItem.get(existingLink.load_list_item_id) || 0;
      linkedQtyByLoadListItem.set(
        existingLink.load_list_item_id,
        current + toNumber(existingLink.fulfilled_qty)
      );
    }

    const requestedQtyByLoadListItem = new Map<string, number>();
    const requestedQtyBySrItem = new Map<string, number>();
    const requestedLinkPairs = new Set<string>();

    for (const link of requestedLinks) {
      const linkPair = `${link.loadListItemId}:${link.srItemId}`;
      if (requestedLinkPairs.has(linkPair)) {
        return NextResponse.json(
          { error: "One or more selected load list items are duplicated in this request" },
          { status: 400 }
        );
      }
      requestedLinkPairs.add(linkPair);

      const llItem = llItemById.get(link.loadListItemId);
      const srItem = srItemById.get(link.srItemId);
      const sr = one(srItem?.sr);

      if (!sr || sr.company_id !== companyId || sr.business_unit_id !== currentBusinessUnitId) {
        return NextResponse.json(
          { error: "Stock requisition does not belong to your business unit" },
          { status: 403 }
        );
      }

      if (sr.status === "cancelled") {
        return NextResponse.json(
          { error: "Cannot link to a cancelled stock requisition" },
          { status: 400 }
        );
      }

      const currentLoadListRequestedQty = requestedQtyByLoadListItem.get(link.loadListItemId) || 0;
      const existingLoadListLinkedQty = linkedQtyByLoadListItem.get(link.loadListItemId) || 0;
      const nextLoadListLinkedQty =
        existingLoadListLinkedQty + currentLoadListRequestedQty + link.fulfilledQty;
      const loadListQty = toNumber(llItem?.load_list_qty);

      if (nextLoadListLinkedQty > loadListQty) {
        return NextResponse.json(
          { error: "Linked quantity would exceed load list item quantity" },
          { status: 400 }
        );
      }

      requestedQtyByLoadListItem.set(
        link.loadListItemId,
        currentLoadListRequestedQty + link.fulfilledQty
      );

      const currentSrRequestedQty = requestedQtyBySrItem.get(link.srItemId) || 0;
      const currentFulfilled = toNumber(srItem?.fulfilled_qty);
      const requestedQty = toNumber(srItem?.requested_qty);
      const nextSrFulfilledQty = currentFulfilled + currentSrRequestedQty + link.fulfilledQty;

      if (nextSrFulfilledQty > requestedQty) {
        return NextResponse.json(
          { error: "Fulfilled quantity would exceed requested quantity" },
          { status: 400 }
        );
      }

      requestedQtyBySrItem.set(link.srItemId, currentSrRequestedQty + link.fulfilledQty);
    }

    const linksToInsert = requestedLinks.map((link) => ({
      load_list_item_id: link.loadListItemId,
      sr_item_id: link.srItemId,
      fulfilled_qty: link.fulfilledQty,
    }));

    // Insert links
    const { data: insertedLinks, error: insertError } = await supabase
      .from("load_list_sr_items")
      .insert(linksToInsert)
      .select("id");

    if (insertError) {
      console.error("Error creating links:", insertError);
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            error:
              "One or more selected load list items are already linked to those requisition items",
          },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: "Failed to create links" }, { status: 500 });
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
      .select("id, status")
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
        load_list_item:load_list_items!inner(
          id,
          load_list_id,
          load_list_qty,
          item:items(id, item_code, item_name)
        ),
        sr_item:stock_requisition_items(
          id,
          requested_qty,
          fulfilled_qty,
          item:items(id, item_code, item_name),
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
    const formattedLinks = links?.map((link: Record<string, unknown>) => {
      const loadListItem = link.load_list_item as Record<string, unknown> | null;
      const loadListItemItem = loadListItem?.item as Record<string, unknown> | null;
      const srItem = link.sr_item as Record<string, unknown> | null;
      const srItemItem = srItem?.item as Record<string, unknown> | null;
      const sr = srItem?.sr as Record<string, unknown> | null;

      return {
        id: link.id,
        fulfilledQty: parseFloat(String(link.fulfilled_qty)),
        loadListItem: loadListItem
          ? {
              id: loadListItem.id as string,
              loadListQty: parseFloat(String(loadListItem.load_list_qty)),
              item: loadListItemItem
                ? {
                    id: loadListItemItem.id as string,
                    code: String(loadListItemItem.item_code ?? ""),
                    name: String(loadListItemItem.item_name ?? ""),
                  }
                : null,
            }
          : null,
        srItem: srItem
          ? {
              id: srItem.id as string,
              requestedQty: parseFloat(String(srItem.requested_qty)),
              fulfilledQty: parseFloat(String(srItem.fulfilled_qty)),
              item: srItemItem
                ? {
                    id: srItemItem.id as string,
                    code: String(srItemItem.item_code ?? ""),
                    name: String(srItemItem.item_name ?? ""),
                  }
                : null,
              sr: sr
                ? {
                    id: sr.id as string,
                    srNumber: String(sr.sr_number ?? ""),
                    requisitionDate: String(sr.requisition_date ?? ""),
                    status: String(sr.status ?? ""),
                  }
                : null,
            }
          : null,
      };
    });

    return NextResponse.json({ data: formattedLinks });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/load-lists/[id]/link-requisitions?link_id=...
// Remove a linked stock requisition item from a load list
async function DELETEHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.LOAD_LISTS, "edit");
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;
    const linkId = request.nextUrl.searchParams.get("link_id");

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    if (!linkId) {
      return NextResponse.json({ error: "Link id is required" }, { status: 400 });
    }

    const { data: ll, error: llError } = await supabase
      .from("load_lists")
      .select("id, status")
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .single();

    if (llError || !ll) {
      return NextResponse.json({ error: "Load list not found" }, { status: 404 });
    }

    if (!["draft", "confirmed"].includes(ll.status)) {
      return NextResponse.json(
        { error: "Only draft or confirmed load lists can be modified" },
        { status: 400 }
      );
    }

    const { error: removeError } = await supabase.rpc("remove_load_list_sr_link", {
      p_company_id: companyId,
      p_business_unit_id: currentBusinessUnitId,
      p_user_id: userId,
      p_load_list_id: id,
      p_link_id: linkId,
    });

    if (removeError) {
      console.error("Error removing load list requisition link:", removeError);

      if (removeError.message === "Link not found") {
        return NextResponse.json({ error: "Link not found" }, { status: 404 });
      }

      if (
        removeError.message === "Only draft or confirmed load lists can be modified" ||
        removeError.message === "Load list not found"
      ) {
        return NextResponse.json({ error: removeError.message }, { status: 400 });
      }

      if (removeError.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      return NextResponse.json({ error: "Failed to remove link" }, { status: 500 });
    }

    return NextResponse.json({ message: "Link removed successfully" });
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
export const DELETE = withActivityLogging(DELETEHandler, {
  action: "link_requisitions",
  resourceType: "load_lists",
  route: "/api/load-lists/[id]/link-requisitions",
});
