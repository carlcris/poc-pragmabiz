import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// GET /api/tablet/purchase-receipts - List purchase receipts for receiving
export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.PURCHASE_RECEIPTS, "view");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { searchParams } = new URL(request.url);

    // Get query parameters
    const status = searchParams.get("status") || "draft"; // Default to draft for receiving
    const warehouseId = searchParams.get("warehouse_id");
    const search = searchParams.get("search");
    const fromDate = searchParams.get("from_date");
    const toDate = searchParams.get("to_date");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

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
      .from("purchase_receipts")
      .select(
        `
        *,
        supplier:suppliers(id, supplier_code, supplier_name),
        warehouse:warehouses(id, warehouse_code, warehouse_name),
        purchase_order:purchase_orders(id, order_code),
        purchase_receipt_items(
          id,
          quantity_ordered,
          quantity_received
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .order("receipt_date", { ascending: false })
      .order("created_at", { ascending: false });

    // Apply filters
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (warehouseId) {
      query = query.eq("warehouse_id", warehouseId);
    }

    if (search) {
      query = query.or(`receipt_code.ilike.%${search}%,supplier_invoice_number.ilike.%${search}%`);
    }

    if (fromDate) {
      query = query.gte("receipt_date", fromDate);
    }

    if (toDate) {
      query = query.lte("receipt_date", toDate);
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: receipts, error, count } = await query;

    if (error) {
      console.error("Error fetching purchase receipts:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate summary for each receipt
    const receiptsWithSummary = receipts?.map((receipt) => {
      const items = receipt.purchase_receipt_items || [];
      const totalItems = items.length;
      const receivedItems = items.filter(
        (item: { quantity_received: number }) => item.quantity_received > 0
      ).length;
      const isPartiallyReceived = receivedItems > 0 && receivedItems < totalItems;
      const isFullyReceived = receivedItems === totalItems && totalItems > 0;

      return {
        id: receipt.id,
        receiptCode: receipt.receipt_code,
        receiptDate: receipt.receipt_date,
        status: receipt.status,
        supplier: {
          id: receipt.supplier.id,
          code: receipt.supplier.supplier_code,
          name: receipt.supplier.supplier_name,
        },
        warehouse: {
          id: receipt.warehouse.id,
          code: receipt.warehouse.warehouse_code,
          name: receipt.warehouse.warehouse_name,
        },
        purchaseOrder: receipt.purchase_order,
        supplierInvoiceNumber: receipt.supplier_invoice_number,
        supplierInvoiceDate: receipt.supplier_invoice_date,
        notes: receipt.notes,
        summary: {
          totalItems,
          receivedItems,
          isPartiallyReceived,
          isFullyReceived,
        },
        createdAt: receipt.created_at,
        updatedAt: receipt.updated_at,
      };
    });

    return NextResponse.json({
      data: receiptsWithSummary,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error in tablet purchase receipts list:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
