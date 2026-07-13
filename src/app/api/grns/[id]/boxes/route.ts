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
    warehouseLocationId: z.string().uuid().nullable().optional(),
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
        warehouse_location_id,
        batch_location_sku,
        delivery_date,
        container_number,
        seal_number,
        created_at,
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

    // Fetch GRN header for batch/warehouse context (used to derive batch_location_sku when available).
    const { data: grnHeader } = await supabase
      .from("grns")
      .select("id, warehouse_id, batch_number, status")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .maybeSingle();

    const boxItemLocationKeys = new Set<string>();
    for (const box of boxes || []) {
      const rec = box as Record<string, unknown>;
      const grnItem = rec.grn_item as Record<string, unknown> | null;
      const itemRef = grnItem?.item as Record<string, unknown> | Record<string, unknown>[] | null;
      const item = Array.isArray(itemRef) ? itemRef[0] : itemRef;
      const itemId = item?.id as string | undefined;
      const locationId = rec.warehouse_location_id as string | undefined;
      if (itemId && locationId && grnHeader?.warehouse_id && grnHeader?.batch_number) {
        boxItemLocationKeys.add(`${itemId}::${locationId}`);
      }
    }

    const batchLocationSkuByKey = new Map<string, string>();
    if (boxItemLocationKeys.size > 0 && grnHeader?.warehouse_id && grnHeader?.batch_number) {
      const itemIds = Array.from(
        new Set(Array.from(boxItemLocationKeys).map((k) => k.split("::")[0]))
      );
      const locationIds = Array.from(
        new Set(Array.from(boxItemLocationKeys).map((k) => k.split("::")[1]))
      );

      const { data: batchLocationRows } = await supabase
        .from("item_batch_locations")
        .select(
          `
          item_id,
          location_id,
          batch_location_sku,
          item_batch:item_batches!item_batch_locations_item_batch_id_fkey(batch_code, warehouse_id)
        `
        )
        .eq("company_id", userData.company_id)
        .eq("warehouse_id", grnHeader.warehouse_id)
        .in("item_id", itemIds)
        .in("location_id", locationIds)
        .is("deleted_at", null);

      for (const row of batchLocationRows || []) {
        const itemBatch = Array.isArray(row.item_batch) ? row.item_batch[0] : row.item_batch;
        if (!itemBatch) continue;
        if ((itemBatch.batch_code as string | undefined) !== grnHeader.batch_number) continue;
        const key = `${row.item_id as string}::${row.location_id as string}`;
        if (row.batch_location_sku) {
          batchLocationSkuByKey.set(key, row.batch_location_sku as string);
        }
      }
    }

    // Format response
    const formattedBoxes = boxes?.map((box: Record<string, unknown>) => ({
      ...((): { itemId?: string; batchLocationSku?: string | null } => {
        const grnItem = box.grn_item as Record<string, unknown> | null;
        const itemRef = grnItem?.item as Record<string, unknown> | Record<string, unknown>[] | null;
        const item = Array.isArray(itemRef) ? itemRef[0] : itemRef;
        const itemId = item?.id as string | undefined;
        const locationId = box.warehouse_location_id as string | undefined;
        const key = itemId && locationId ? `${itemId}::${locationId}` : "";
        const storedBatchLocationSku =
          (box.batch_location_sku as string | null | undefined) ?? null;
        return {
          itemId,
          batchLocationSku:
            storedBatchLocationSku ?? (key ? (batchLocationSkuByKey.get(key) ?? null) : null),
        };
      })(),
      id: box.id,
      grnItemId: box.grn_item_id as string,
      boxNumber: box.box_number as number,
      barcode: box.barcode as string,
      qtyPerBox: parseFloat(String(box.qty_per_box)),
      warehouseLocationId: box.warehouse_location_id as string | null,
      warehouseLocation: box.warehouse_location
        ? {
            id: (box.warehouse_location as Record<string, unknown>).id as string,
            code: (box.warehouse_location as Record<string, unknown>).code as string,
            name: (box.warehouse_location as Record<string, unknown>).name as string,
          }
        : null,
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
        p_warehouse_location_id: body.warehouseLocationId ?? null,
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
        regenerateError.message === "Warehouse location is not valid for this GRN" ||
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
