import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { z } from "zod";
import {
  LOAD_LIST_LINK_STOCK_REQUISITIONS_CAPABILITY,
  requireLoadListOperation,
} from "@/lib/load-lists/permissions";

const linkRequestSchema = z
  .object({
    links: z
      .array(
        z
          .object({
            loadListItemId: z.string().uuid(),
            srItemId: z.string().uuid(),
            fulfilledQty: z.number().finite().positive(),
          })
          .strict()
      )
      .min(1)
      .max(100),
  })
  .strict();
const uuidSchema = z.string().uuid();

// POST /api/load-lists/[id]/link-requisitions
// Link load list items to stock requisition items
async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requireLoadListOperation(
      LOAD_LIST_LINK_STOCK_REQUISITIONS_CAPABILITY
    );
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;
    const parsedBody = linkRequestSchema.safeParse(await request.json().catch(() => null));

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    if (!parsedBody.success) {
      return NextResponse.json({ error: "Invalid stock requisition links" }, { status: 400 });
    }

    const requestedLinks = parsedBody.data.links;

    const { data: linksCreated, error: linkError } = await supabase.rpc(
      "link_load_list_stock_requisitions",
      {
        p_company_id: companyId,
        p_business_unit_id: currentBusinessUnitId,
        p_user_id: userId,
        p_load_list_id: id,
        p_links: requestedLinks.map((link) => ({
          load_list_item_id: link.loadListItemId,
          sr_item_id: link.srItemId,
          fulfilled_qty: link.fulfilledQty,
        })),
      }
    );

    if (linkError) {
      console.error("Error linking stock requisitions to load list:", linkError);
      const safeErrors: Record<string, { error: string; status: number }> = {
        Unauthorized: { error: "Unauthorized", status: 403 },
        "Load list not found": { error: "Load list not found", status: 404 },
        "Only draft or confirmed load lists can be modified": {
          error: "Only draft or confirmed load lists can be modified",
          status: 400,
        },
        "One or more selected links already exist": {
          error: "One or more selected links already exist",
          status: 409,
        },
        "Linked quantity would exceed load list item quantity": {
          error: "Linked quantity would exceed load list item quantity",
          status: 400,
        },
        "Linked quantity would exceed stock requisition item quantity": {
          error: "Linked quantity would exceed stock requisition item quantity",
          status: 400,
        },
        "Load list and stock requisition items must reference the same item": {
          error: "Load list and stock requisition items must reference the same item",
          status: 400,
        },
        "Invalid stock requisition links": {
          error: "Invalid stock requisition links",
          status: 400,
        },
        "Duplicate stock requisition links are not allowed": {
          error: "Duplicate stock requisition links are not allowed",
          status: 400,
        },
        "One or more stock requisition items are unavailable": {
          error: "One or more stock requisition items are unavailable",
          status: 400,
        },
      };
      const safeError = safeErrors[linkError.message];
      return NextResponse.json(safeError ?? { error: "Failed to create links" }, {
        status: safeError?.status ?? 500,
      });
    }

    return NextResponse.json({
      message: "Links created successfully",
      linksCreated: linksCreated ?? 0,
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
    const unauthorized = await requireLoadListOperation(
      LOAD_LIST_LINK_STOCK_REQUISITIONS_CAPABILITY
    );
    if (unauthorized) return unauthorized;
    const { id } = await params;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;
    const linkId = request.nextUrl.searchParams.get("link_id");
    const parsedLinkId = uuidSchema.safeParse(linkId);

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    if (!parsedLinkId.success) {
      return NextResponse.json({ error: "Link id is required" }, { status: 400 });
    }

    const { error: removeError } = await supabase.rpc("remove_load_list_sr_link", {
      p_company_id: companyId,
      p_business_unit_id: currentBusinessUnitId,
      p_user_id: userId,
      p_load_list_id: id,
      p_link_id: parsedLinkId.data,
    });

    if (removeError) {
      console.error("Error removing load list requisition link:", removeError);

      if (removeError.message === "Link not found") {
        return NextResponse.json({ error: "Link not found" }, { status: 404 });
      }

      if (removeError.message === "Load list not found") {
        return NextResponse.json({ error: "Load list not found" }, { status: 404 });
      }

      if (removeError.message === "Only draft or confirmed load lists can be modified") {
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
