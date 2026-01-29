import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type StockTransferItemRow = {
  id: string;
  item_id: string;
  item_code: string | null;
  item_name: string | null;
  quantity: number | string;
  received_quantity: number | string | null;
  packaging_id: string | null;
  uom_id: string | null;
  uom_name: string | null;
  sort_order: number | null;
};

type StockTransferRow = {
  id: string;
  transfer_code: string;
  transfer_date: string | null;
  status: string;
  notes: string | null;
  total_items: number | null;
  from_warehouse?: {
    id: string;
    warehouse_code: string | null;
    warehouse_name: string | null;
  } | null;
  to_warehouse?: {
    id: string;
    warehouse_code: string | null;
    warehouse_name: string | null;
  } | null;
  stock_transfer_items?: StockTransferItemRow[] | null;
};

type StockTransferItemInput = {
  itemId: string;
  quantity: number | string;
  uomId: string;
  code?: string | null;
  name?: string | null;
  packagingId?: string | null;
  uomName?: string | null;
};

export async function GET(request: NextRequest) {
  try {
    // Require 'stock_transfers' view permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFERS, "view");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user details
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("company_id, van_warehouse_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "pending";
    const toWarehouseId = searchParams.get("to_warehouse_id") || userData.van_warehouse_id;

    // Fetch stock transfers
    let query = supabase
      .from("stock_transfers")
      .select(
        `
        id,
        transfer_code,
        transfer_date,
        from_warehouse_id,
        to_warehouse_id,
        status,
        notes,
        total_items,
        created_at,
        from_warehouse:warehouses!from_warehouse_id (
          id,
          warehouse_code,
          warehouse_name
        ),
        to_warehouse:warehouses!to_warehouse_id (
          id,
          warehouse_code,
          warehouse_name
        ),
        stock_transfer_items (
          id,
          item_id,
          item_code,
          item_name,
          quantity,
          received_quantity,
          packaging_id,
          uom_id,
          uom_name,
          sort_order
        )
      `
      )
      .eq("company_id", userData.company_id)
      .order("transfer_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    if (toWarehouseId) {
      query = query.eq("to_warehouse_id", toWarehouseId);
    }

    const { data: transfers, error: transfersError } = await query;

    if (transfersError) {
      return NextResponse.json({ error: "Failed to fetch stock transfers" }, { status: 500 });
    }

    // Transform data
    const transformedTransfers =
      (transfers as StockTransferRow[] | null)?.map((transfer) => ({
        id: transfer.id,
        code: transfer.transfer_code,
        date: transfer.transfer_date,
        status: transfer.status,
        notes: transfer.notes,
        totalItems: transfer.total_items,
        fromWarehouse: {
          id: transfer.from_warehouse?.id,
          code: transfer.from_warehouse?.warehouse_code,
          name: transfer.from_warehouse?.warehouse_name,
        },
        toWarehouse: {
          id: transfer.to_warehouse?.id,
          code: transfer.to_warehouse?.warehouse_code,
          name: transfer.to_warehouse?.warehouse_name,
        },
        items:
          transfer.stock_transfer_items
            ?.map((item) => ({
              id: item.id,
              itemId: item.item_id,
              code: item.item_code,
              name: item.item_name,
              quantity: parseFloat(String(item.quantity)),
              receivedQuantity: parseFloat(String(item.received_quantity ?? 0)) || 0,
              packagingId: item.packaging_id,
              uomId: item.uom_id,
              uom: item.uom_name,
              sortOrder: item.sort_order ?? 0,
            }))
            .sort((a, b) => a.sortOrder - b.sortOrder) || [],
      })) || [];

    return NextResponse.json({
      data: transformedTransfers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require 'stock_transfers' create permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFERS, "create");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user details
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      fromWarehouseId?: string;
      toWarehouseId?: string;
      transferDate?: string;
      notes?: string;
      items?: StockTransferItemInput[];
      fromLocationId?: string | null;
      toLocationId?: string | null;
    };
    const {
      fromWarehouseId,
      toWarehouseId,
      transferDate,
      notes,
      items,
      fromLocationId,
      toLocationId,
    } = body;

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    // Validate required fields
    if (!fromWarehouseId || !toWarehouseId || !transferDate || !items || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: "Items must be an array" }, { status: 400 });
    }

    if (fromWarehouseId === toWarehouseId) {
      return NextResponse.json(
        { error: "Use stock transactions to transfer within the same warehouse" },
        { status: 400 }
      );
    }

    for (const item of items) {
      if (!item?.itemId || !item?.quantity || !item?.uomId) {
        return NextResponse.json(
          { error: "Each item requires itemId, quantity, and uomId" },
          { status: 400 }
        );
      }
      if (Number(item.quantity) <= 0) {
        return NextResponse.json(
          { error: "Item quantity must be greater than 0" },
          { status: 400 }
        );
      }
    }

    // Generate transfer code
    const transferCode = `ST-${Date.now()}`;

    // Create stock transfer with status='pending'
    const { data: transfer, error: transferError } = await supabase
      .from("stock_transfers")
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        transfer_code: transferCode,
        transfer_date: transferDate,
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        status: "pending",
        notes: notes || null,
        total_items: items.length,
        custom_fields: fromLocationId || toLocationId ? { fromLocationId, toLocationId } : null,
        requested_by: user.id,
        requested_at: new Date().toISOString(),
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (transferError) {
      return NextResponse.json(
        { error: transferError.message || "Failed to create stock transfer" },
        { status: 500 }
      );
    }

    // Create stock transfer items
    const transferItems = items.map((item, index) => ({
      company_id: userData.company_id,
      transfer_id: transfer.id,
      item_id: item.itemId,
      item_code: item.code,
      item_name: item.name,
      quantity: item.quantity,
      received_quantity: 0,
      packaging_id: item.packagingId || null,
      uom_id: item.uomId,
      uom_name: item.uomName,
      sort_order: index + 1,
      created_by: user.id,
      updated_by: user.id,
    }));

    const { error: itemsError } = await supabase.from("stock_transfer_items").insert(transferItems);

    if (itemsError) {
      // Rollback: delete the transfer
      await supabase.from("stock_transfers").delete().eq("id", transfer.id);
      return NextResponse.json(
        { error: itemsError.message || "Failed to create stock transfer items" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Stock transfer created successfully",
        data: {
          id: transfer.id,
          code: transfer.transfer_code,
          status: transfer.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
