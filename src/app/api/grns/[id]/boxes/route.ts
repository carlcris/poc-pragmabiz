import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// GET /api/grns/[id]/boxes - List boxes for a GRN item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        *,
        grn_item:grn_items!inner(
          id,
          grn_id,
          item:items(id, item_code, item_name)
        ),
        warehouse_location:warehouse_locations(id, code, name)
      `
      )
      .eq("grn_item.grn_id", id);

    // Filter by GRN item if specified
    if (grnItemId) {
      query = query.eq("grn_item_id", grnItemId);
    }

    const { data: boxes, error } = await query.order("box_number", { ascending: true });

    if (error) {
      console.error("Error fetching boxes:", error);
      return NextResponse.json({ error: "Failed to fetch boxes" }, { status: 500 });
    }

    // Format response
    const formattedBoxes = boxes?.map((box: any) => ({
      id: box.id,
      grnItemId: box.grn_item_id,
      boxNumber: box.box_number,
      barcode: box.barcode,
      qtyPerBox: parseFloat(box.qty_per_box),
      warehouseLocationId: box.warehouse_location_id,
      warehouseLocation: box.warehouse_location
        ? {
            id: box.warehouse_location.id,
            code: box.warehouse_location.code,
            name: box.warehouse_location.name,
          }
        : null,
      deliveryDate: box.delivery_date,
      containerNumber: box.container_number,
      sealNumber: box.seal_number,
      createdAt: box.created_at,
    }));

    return NextResponse.json({ data: formattedBoxes });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/grns/[id]/boxes - Generate boxes and barcodes for GRN items
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.GOODS_RECEIPT_NOTES, "create");
    const { id } = await params;
    const { supabase } = await createServerClientWithBU();
    const body = await request.json();

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

    // Verify GRN exists and belongs to company
    const { data: grn, error: grnError } = await supabase
      .from("grns")
      .select("id, grn_number, company_id, container_number, seal_number, delivery_date")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (grnError || !grn) {
      return NextResponse.json({ error: "GRN not found" }, { status: 404 });
    }

    // Validate required fields
    if (!body.grnItemId || !body.numBoxes || body.numBoxes <= 0) {
      return NextResponse.json(
        { error: "GRN item ID and number of boxes are required" },
        { status: 400 }
      );
    }

    // Get GRN item details
    const { data: grnItem, error: itemError } = await supabase
      .from("grn_items")
      .select("id, item_id, received_qty, num_boxes")
      .eq("id", body.grnItemId)
      .eq("grn_id", id)
      .single();

    if (itemError || !grnItem) {
      return NextResponse.json({ error: "GRN item not found" }, { status: 404 });
    }

    const receivedQty = parseFloat(grnItem.received_qty);
    if (!receivedQty || receivedQty <= 0) {
      return NextResponse.json(
        { error: "Cannot generate boxes with zero received quantity" },
        { status: 400 }
      );
    }

    // Calculate quantity per box
    const qtyPerBox = receivedQty / body.numBoxes;
    if (!Number.isFinite(qtyPerBox) || qtyPerBox <= 0) {
      return NextResponse.json(
        { error: "Calculated quantity per box must be greater than zero" },
        { status: 400 }
      );
    }

    // Generate boxes with barcodes
    const boxesToInsert = [];
    for (let i = 1; i <= body.numBoxes; i++) {
      // Generate barcode: GRN-{grnNumber}-ITEM-{itemId}-BOX-{boxNumber}
      const barcode = `${grn.grn_number}-${body.grnItemId.substring(0, 8)}-${String(i).padStart(3, "0")}`;

      boxesToInsert.push({
        grn_item_id: body.grnItemId,
        box_number: i,
        barcode: barcode,
        qty_per_box: qtyPerBox,
        warehouse_location_id: body.warehouseLocationId || null,
        delivery_date: grn.delivery_date,
        container_number: grn.container_number,
        seal_number: grn.seal_number,
      });
    }

    // Insert boxes
    const { data: boxes, error: insertError } = await supabase
      .from("grn_boxes")
      .insert(boxesToInsert)
      .select();

    if (insertError) {
      console.error("Error creating boxes:", insertError);
      return NextResponse.json({ error: "Failed to create boxes" }, { status: 500 });
    }

    // Update GRN item to mark barcodes as printed
    await supabase
      .from("grn_items")
      .update({ barcodes_printed: true })
      .eq("id", body.grnItemId);

    return NextResponse.json({
      message: `${body.numBoxes} boxes created successfully`,
      boxes: boxes.length,
    });
  } catch (error) {
    console.error("Internal server error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
