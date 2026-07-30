import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { z } from "zod";

const generateBoxesSchema = z
  .object({
    grnItemId: z.string().uuid(),
    numBoxes: z.number().int().min(1).max(1_000_000),
  })
  .strict();

// GET /api/grns/[id]/boxes - List boxes for a GRN item
async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(RESOURCES.GOODS_RECEIPT_NOTES, "view");
    const { id } = await params;
    const { supabase } = await createServerClientWithBU();
    const { searchParams } = new URL(request.url);
    const grnItemId = searchParams.get("grn_item_id");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Build query
    let query = supabase
      .from("grn_boxes")
      .select(
        `
        id,
        grn_item_id,
        box_number,
        barcode,
        qty_per_box,
        delivery_date,
        container_number,
        seal_number,
        created_at,
        grn_item:grn_items!inner(
          id,
          grn:grns!inner(id, company_id),
          item:items(id, item_code, item_name)
        )
      `
      )
      .eq("grn_item.grn.id", id)
      .eq("grn_item.grn.company_id", userData.company_id);

    // Filter by GRN item if specified
    if (grnItemId) {
      query = query.eq("grn_item_id", grnItemId);
    }

    const { data: boxes, error } = await query.order("box_number", { ascending: true });

    if (error) {
      console.error("Error fetching boxes:", error);
      return NextResponse.json({ error: "Failed to fetch boxes" }, { status: 500 });
    }

    // Boxes remain business-unit staged until their putaway task selects a warehouse and rack.
    const formattedBoxes = boxes?.map((box: Record<string, unknown>) => ({
      ...((): { itemId?: string } => {
        const grnItem = box.grn_item as Record<string, unknown> | null;
        const itemRef = grnItem?.item as Record<string, unknown> | Record<string, unknown>[] | null;
        const item = Array.isArray(itemRef) ? itemRef[0] : itemRef;
        return {
          itemId: item?.id as string | undefined,
        };
      })(),
      id: box.id,
      grnItemId: box.grn_item_id as string,
      boxNumber: box.box_number as number,
      barcode: box.barcode as string,
      qtyPerBox: parseFloat(String(box.qty_per_box)),
      deliveryDate: box.delivery_date as string | null,
      containerNumber: box.container_number as string | null,
      sealNumber: box.seal_number as string | null,
      createdAt: box.created_at as string,
    }));

    return NextResponse.json({ data: formattedBoxes });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/grns/[id]/boxes - Generate boxes and barcodes for GRN items
async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.GOODS_RECEIPT_NOTES, "create");
    if (unauthorized) return unauthorized;

    const { id } = await params;
    const { supabase } = await createServerClientWithBU();
    const parsedBody = generateBoxesSchema.safeParse(await request.json());

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "GRN item ID and number of boxes are required" },
        { status: 400 }
      );
    }

    const body = parsedBody.data;

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const { data: createdCount, error: regenerateError } = await supabase.rpc(
      "regenerate_grn_boxes",
      {
        p_company_id: userData.company_id,
        p_user_id: user.id,
        p_grn_id: id,
        p_grn_item_id: body.grnItemId,
        p_num_boxes: body.numBoxes,
      }
    );

    if (regenerateError) {
      console.error("Error regenerating GRN boxes:", regenerateError);

      if (regenerateError.message === "Unauthorized") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (regenerateError.message === "GRN item not found") {
        return NextResponse.json({ error: "GRN item not found" }, { status: 404 });
      }

      if (
        regenerateError.message === "Invalid number of boxes" ||
        regenerateError.message === "Cannot generate boxes with zero received quantity" ||
        regenerateError.message === "GRN item unit snapshot is invalid" ||
        regenerateError.message === "Calculated quantity per box must be greater than zero"
      ) {
        return NextResponse.json({ error: "Unable to generate boxes" }, { status: 400 });
      }

      return NextResponse.json({ error: "Failed to regenerate boxes" }, { status: 500 });
    }

    return NextResponse.json({
      message: `${body.numBoxes} boxes created successfully`,
      boxes: createdCount ?? 0,
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "grns",
  route: "/api/grns/[id]/boxes",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "grns",
  route: "/api/grns/[id]/boxes",
});
