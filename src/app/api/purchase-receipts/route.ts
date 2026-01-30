import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { Tables } from "@/types/supabase";

type PurchaseReceiptRow = Tables<"purchase_receipts"> & {
  batch_sequence_number?: string | null;
};
type PurchaseReceiptItemRow = Tables<"purchase_receipt_items">;
type PurchaseOrderRow = Tables<"purchase_orders">;
type SupplierRow = Tables<"suppliers">;
type WarehouseRow = Tables<"warehouses">;
type ItemRow = Tables<"items">;
type ItemPackagingRow = Tables<"item_packaging">;
type UnitRow = Tables<"units_of_measure">;

type PurchaseReceiptItemQueryRow = PurchaseReceiptItemRow & {
  item?: Pick<ItemRow, "id" | "item_code" | "item_name"> | null;
  uom?: Pick<UnitRow, "id" | "code" | "name"> | null;
  packaging?: Pick<ItemPackagingRow, "id" | "pack_name" | "qty_per_pack"> | null;
};

type PurchaseReceiptQueryRow = PurchaseReceiptRow & {
  purchase_order?: Pick<PurchaseOrderRow, "id" | "order_code"> | null;
  supplier?: Pick<SupplierRow, "id" | "supplier_code" | "supplier_name"> | null;
  warehouse?: Pick<WarehouseRow, "id" | "warehouse_code" | "warehouse_name"> | null;
  items?: PurchaseReceiptItemQueryRow[] | null;
};

type PurchaseReceiptItemInput = {
  purchaseOrderItemId: string;
  itemId: string;
  quantityOrdered: number;
  quantityReceived: number;
  packagingId?: string | null;
  uomId?: string | null;
  rate: number;
  notes?: string | null;
};

type PurchaseReceiptCreateBody = {
  purchaseOrderId: string;
  warehouseId: string;
  receiptDate: string;
  batchSequenceNumber?: string | null;
  supplierInvoiceNumber?: string | null;
  supplierInvoiceDate?: string | null;
  notes?: string | null;
  items?: PurchaseReceiptItemInput[];
};

// GET /api/purchase-receipts
export async function GET(request: NextRequest) {
  try {
    // Check permission
    await requirePermission(RESOURCES.PURCHASE_RECEIPTS, "view");

    const { supabase } = await createServerClientWithBU();
    const { searchParams } = new URL(request.url);

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
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
        purchase_order:purchase_orders!purchase_receipts_purchase_order_id_fkey(id, order_code),
        supplier:suppliers!purchase_receipts_supplier_id_fkey(id, supplier_code, supplier_name),
        warehouse:warehouses!purchase_receipts_warehouse_id_fkey(id, warehouse_code, warehouse_name),
        items:purchase_receipt_items(
          id,
          purchase_order_item_id,
          item_id,
          item:items(id, item_code, item_name),
          quantity_ordered,
          quantity_received,
          uom_id,
          uom:units_of_measure(id, code, name),
          packaging_id,
          packaging:item_packaging(id, pack_name, qty_per_pack),
          rate,
          notes
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", userData.company_id)
      .is("deleted_at", null);

    // Apply filters
    const status = searchParams.get("status");
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const purchaseOrderId = searchParams.get("purchase_order_id");
    if (purchaseOrderId) {
      query = query.eq("purchase_order_id", purchaseOrderId);
    }

    const supplierId = searchParams.get("supplier_id");
    if (supplierId) {
      query = query.eq("supplier_id", supplierId);
    }

    const warehouseId = searchParams.get("warehouse_id");
    if (warehouseId) {
      query = query.eq("warehouse_id", warehouseId);
    }

    const search = searchParams.get("search");
    if (search) {
      query = query.or(`receipt_code.ilike.%${search}%,batch_sequence_number.ilike.%${search}%`);
    }

    // Date range filters
    const fromDate = searchParams.get("from_date");
    if (fromDate) {
      query = query.gte("receipt_date", fromDate);
    }

    const toDate = searchParams.get("to_date");
    if (toDate) {
      query = query.lte("receipt_date", toDate);
    }

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.range(from, to).order("created_at", { ascending: false });

    const { data: receipts, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: "Failed to fetch purchase receipts" }, { status: 500 });
    }

    // Format response
    const formattedReceipts = (receipts as PurchaseReceiptQueryRow[] | null)?.map((receipt) => ({
      id: receipt.id,
      companyId: receipt.company_id,
      receiptCode: receipt.receipt_code,
      purchaseOrderId: receipt.purchase_order_id,
      purchaseOrder: receipt.purchase_order
        ? {
            id: receipt.purchase_order.id,
            orderCode: receipt.purchase_order.order_code,
          }
        : undefined,
      supplierId: receipt.supplier_id,
      supplier: receipt.supplier
        ? {
            id: receipt.supplier.id,
            code: receipt.supplier.supplier_code,
            name: receipt.supplier.supplier_name,
          }
        : undefined,
      warehouseId: receipt.warehouse_id,
      warehouse: receipt.warehouse
        ? {
            id: receipt.warehouse.id,
            code: receipt.warehouse.warehouse_code,
            name: receipt.warehouse.warehouse_name,
          }
        : undefined,
      receiptDate: receipt.receipt_date,
      batchSequenceNumber: receipt.batch_sequence_number,
      supplierInvoiceNumber: receipt.supplier_invoice_number,
      supplierInvoiceDate: receipt.supplier_invoice_date,
      status: receipt.status,
      notes: receipt.notes,
      items: receipt.items?.map((item) => ({
        id: item.id,
        purchaseOrderItemId: item.purchase_order_item_id,
        itemId: item.item_id,
        item: item.item
          ? {
              id: item.item.id,
              code: item.item.item_code,
              name: item.item.item_name,
            }
          : undefined,
        quantityOrdered: Number(item.quantity_ordered),
        quantityReceived: Number(item.quantity_received),
        uomId: item.uom_id,
        uom: item.uom
          ? {
              id: item.uom.id,
              code: item.uom.code,
              name: item.uom.name,
            }
          : undefined,
        packagingId: item.packaging_id,
        packaging: item.packaging
          ? {
              id: item.packaging.id,
              name: item.packaging.pack_name,
              qtyPerPack: item.packaging.qty_per_pack,
            }
          : undefined,
        rate: Number(item.rate),
        notes: item.notes,
      })),
      createdAt: receipt.created_at,
      createdBy: receipt.created_by,
      updatedAt: receipt.updated_at,
      updatedBy: receipt.updated_by,
      version: receipt.version,
    }));

    return NextResponse.json({
      data: formattedReceipts,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/purchase-receipts
export async function POST(request: NextRequest) {
  try {
    // Check permission
    await requirePermission(RESOURCES.PURCHASE_RECEIPTS, "create");

    const { supabase } = await createServerClientWithBU();
    const body = (await request.json()) as PurchaseReceiptCreateBody;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Get purchase order and supplier info
    const { data: poData } = await supabase
      .from("purchase_orders")
      .select("supplier_id")
      .eq("id", body.purchaseOrderId)
      .single();

    if (!poData) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    // Generate receipt code
    const currentYear = new Date().getFullYear();
    const { data: lastReceipt } = await supabase
      .from("purchase_receipts")
      .select("receipt_code")
      .eq("company_id", userData.company_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let nextNum = 1;
    if (lastReceipt?.receipt_code) {
      const match = lastReceipt.receipt_code.match(/GRN-\d+-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }
    const receiptCode = `GRN-${currentYear}-${String(nextNum).padStart(4, "0")}`;

    // Create receipt
    const { data: receipt, error: receiptError } = await supabase
      .from("purchase_receipts")
      .insert({
        company_id: userData.company_id,
        receipt_code: receiptCode,
        purchase_order_id: body.purchaseOrderId,
        supplier_id: poData.supplier_id,
        warehouse_id: body.warehouseId,
        receipt_date: body.receiptDate,
        batch_sequence_number: body.batchSequenceNumber || null,
        supplier_invoice_number: body.supplierInvoiceNumber,
        supplier_invoice_date: body.supplierInvoiceDate,
        status: "draft",
        notes: body.notes,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (receiptError) {
      return NextResponse.json(
        { error: receiptError.message || "Failed to create receipt" },
        { status: 500 }
      );
    }

    // Create receipt items
    if (body.items && body.items.length > 0) {
      const receiptItems = body.items.map((item) => ({
        company_id: userData.company_id,
        receipt_id: receipt.id,
        purchase_order_item_id: item.purchaseOrderItemId,
        item_id: item.itemId,
        quantity_ordered: item.quantityOrdered,
        quantity_received: item.quantityReceived,
        packaging_id: item.packagingId || null,
        uom_id: item.uomId,
        rate: item.rate,
        notes: item.notes,
        created_by: user.id,
        updated_by: user.id,
      }));

      const { error: itemsError } = await supabase
        .from("purchase_receipt_items")
        .insert(receiptItems);

      if (itemsError) {
        // Rollback receipt creation
        await supabase.from("purchase_receipts").delete().eq("id", receipt.id);
        return NextResponse.json(
          { error: itemsError.message || "Failed to create receipt items" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        id: receipt.id,
        receiptCode: receipt.receipt_code,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
