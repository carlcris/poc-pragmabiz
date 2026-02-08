import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/tablet/purchase-receipts/[id] - Get single receipt with items
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.PURCHASE_RECEIPTS, "view");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id } = await context.params;

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

    // Fetch receipt with all related data
    const { data: receipt, error } = await supabase
      .from("purchase_receipts")
      .select(
        `
        id,
        receipt_code,
        receipt_date,
        status,
        supplier_invoice_number,
        supplier_invoice_date,
        notes,
        created_at,
        created_by,
        updated_at,
        updated_by,
        supplier:suppliers(id, supplier_code, supplier_name, contact_person, phone, email),
        warehouse:warehouses(id, warehouse_code, warehouse_name),
        purchase_order:purchase_orders(
          id,
          order_code,
          order_date,
          expected_delivery_date,
          status
        ),
        purchase_receipt_items(
          id,
          item_id,
          quantity_ordered,
          quantity_received,
          rate,
          notes,
          item:items(
            id,
            item_code,
            item_name,
            item_name_cn
          ),
          uom:units_of_measure(
            id,
            code,
            name,
            symbol
          ),
          packaging:item_packaging(
            id,
            pack_name,
            qty_per_pack
          )
        )
      `
      )
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (error || !receipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    const supplier = Array.isArray(receipt.supplier) ? receipt.supplier[0] : receipt.supplier;
    const warehouse = Array.isArray(receipt.warehouse) ? receipt.warehouse[0] : receipt.warehouse;
    const purchaseOrder = Array.isArray(receipt.purchase_order)
      ? receipt.purchase_order[0]
      : receipt.purchase_order;

    // Format response for tablet UI
    const formattedReceipt = {
      id: receipt.id,
      receiptCode: receipt.receipt_code,
      receiptDate: receipt.receipt_date,
      status: receipt.status,

      // Relations
      supplier: {
        id: supplier.id,
        code: supplier.supplier_code,
        name: supplier.supplier_name,
        contact_person: supplier.contact_person,
        phone: supplier.phone,
        email: supplier.email,
      },
      warehouse: {
        id: warehouse.id,
        code: warehouse.warehouse_code,
        name: warehouse.warehouse_name,
      },
      purchaseOrder: purchaseOrder,

      // Invoice details
      supplierInvoiceNumber: receipt.supplier_invoice_number,
      supplierInvoiceDate: receipt.supplier_invoice_date,

      // Items with calculated fields
      items:
        receipt.purchase_receipt_items?.map((item) => {
          const itemDetails = Array.isArray(item.item) ? item.item[0] : item.item;
          const uom = Array.isArray(item.uom) ? item.uom[0] : item.uom;
          const packaging = Array.isArray(item.packaging)
            ? item.packaging[0]
            : item.packaging;

            return {
              id: item.id,
              itemId: item.item_id,
              item: itemDetails,
              quantityOrdered: Number(item.quantity_ordered),
              quantityReceived: Number(item.quantity_received),
              uom: uom,
              packaging: packaging,
              rate: Number(item.rate),
              lineTotal: Number(item.quantity_received) * Number(item.rate),
              notes: item.notes,
              isFullyReceived: Number(item.quantity_received) === Number(item.quantity_ordered),
              isPartiallyReceived:
                Number(item.quantity_received) > 0 &&
                Number(item.quantity_received) < Number(item.quantity_ordered),
              remainingQty: Number(item.quantity_ordered) - Number(item.quantity_received),
            };
          }
        ) || [],

      // Notes
      notes: receipt.notes,

      // Summary
      summary: {
        totalItems: receipt.purchase_receipt_items?.length || 0,
        fullyReceivedItems:
          receipt.purchase_receipt_items?.filter(
            (item: { quantity_ordered: number; quantity_received: number }) =>
              Number(item.quantity_received) === Number(item.quantity_ordered)
          ).length || 0,
        partiallyReceivedItems:
          receipt.purchase_receipt_items?.filter(
            (item: { quantity_ordered: number; quantity_received: number }) =>
              Number(item.quantity_received) > 0 &&
              Number(item.quantity_received) < Number(item.quantity_ordered)
          ).length || 0,
        notReceivedItems:
          receipt.purchase_receipt_items?.filter(
            (item: { quantity_received: number }) => Number(item.quantity_received) === 0
          ).length || 0,
      },

      // Audit
      createdAt: receipt.created_at,
      createdBy: receipt.created_by,
      updatedAt: receipt.updated_at,
      updatedBy: receipt.updated_by,
    };

    return NextResponse.json(formattedReceipt);
  } catch (error) {
    console.error("Error fetching purchase receipt:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
