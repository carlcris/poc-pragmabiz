import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { normalizeTransactionItems } from "@/services/inventory/normalizationService";
import {
  adjustItemLocation,
  ensureWarehouseDefaultLocation,
} from "@/services/inventory/locationService";
import type { StockTransactionItemInput } from "@/types/inventory-normalization";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ReceiptItemUpdateInput = {
  purchaseOrderItemId: string;
  quantityReceived: number;
};

// POST /api/tablet/purchase-receipts/[id]/post
// Post receipt - change status to 'received' and create stock transactions
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.PURCHASE_RECEIPTS, "edit");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
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

    // Verify receipt exists and is in draft status
    const { data: existingReceipt, error: receiptError } = await supabase
      .from("purchase_receipts")
      .select("id, status, purchase_order_id, warehouse_id, receipt_date, receipt_code")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (receiptError || !existingReceipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    if (existingReceipt.status !== "draft") {
      return NextResponse.json({ error: "Only draft receipts can be posted" }, { status: 400 });
    }

    // Verify all items have quantity_received > 0
    const { data: items, error: itemsError } = await supabase
      .from("purchase_receipt_items")
      .select("id, purchase_order_item_id, quantity_received, item_id, uom_id, rate")
      .eq("receipt_id", id)
      .is("deleted_at", null);

    if (itemsError || !items || items.length === 0) {
      return NextResponse.json({ error: "Receipt must have at least one item" }, { status: 400 });
    }

    const invalidItems = items.filter((item) => Number(item.quantity_received) <= 0);
    if (invalidItems.length > 0) {
      return NextResponse.json(
        { error: "All items must have received quantity greater than 0" },
        { status: 400 }
      );
    }

    // Step 1: Update receipt status to 'received'
    const { error: updateError } = await supabase
      .from("purchase_receipts")
      .update({
        status: "received",
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to update receipt status" },
        { status: 500 }
      );
    }

    // Step 2: Update purchase order items quantity_received
    const itemsForUpdate: ReceiptItemUpdateInput[] = items.map((item) => ({
      purchaseOrderItemId: item.purchase_order_item_id,
      quantityReceived: Number(item.quantity_received),
    }));

    for (const item of itemsForUpdate) {
      const { data: currentItem } = await supabase
        .from("purchase_order_items")
        .select("quantity_received")
        .eq("id", item.purchaseOrderItemId)
        .single();

      const currentQty = Number(currentItem?.quantity_received || 0);
      const newQty = currentQty + item.quantityReceived;

      await supabase
        .from("purchase_order_items")
        .update({
          quantity_received: newQty,
          updated_by: user.id,
        })
        .eq("id", item.purchaseOrderItemId);
    }

    // Step 3: Update purchase order status
    if (existingReceipt.purchase_order_id) {
      const { data: poItemsData } = await supabase
        .from("purchase_order_items")
        .select("quantity, quantity_received")
        .eq("purchase_order_id", existingReceipt.purchase_order_id)
        .is("deleted_at", null);

      const poItems = poItemsData || [];

      if (poItems.length > 0) {
        const allFullyReceived = poItems.every((poItem) => {
          const ordered = Number(poItem.quantity);
          const received = Number(poItem.quantity_received || 0);
          return received >= ordered;
        });

        const anyReceived = poItems.some((poItem) => {
          const received = Number(poItem.quantity_received || 0);
          return received > 0;
        });

        let newStatus: string | null = null;
        if (allFullyReceived) {
          newStatus = "received";
        } else if (anyReceived) {
          newStatus = "partially_received";
        }

        if (newStatus) {
          await supabase
            .from("purchase_orders")
            .update({
              status: newStatus,
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingReceipt.purchase_order_id);
        }
      }
    }

    // Step 4: Create stock transaction and update inventory
    const itemInputs: StockTransactionItemInput[] = items.map((item) => ({
      itemId: item.item_id,
      inputQty: Number(item.quantity_received || 0),
      unitCost: Number(item.rate || 0),
    }));

    const normalizedItems = await normalizeTransactionItems(userData.company_id, itemInputs);

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
    const milliseconds = now.getTime().toString().slice(-4);
    const stockTxCode = `ST-${dateStr}${milliseconds}`;

    const defaultLocationId = await ensureWarehouseDefaultLocation({
      supabase,
      companyId: userData.company_id,
      warehouseId: existingReceipt.warehouse_id,
      userId: user.id,
    });

    const { data: stockTransaction, error: stockTxError } = await supabase
      .from("stock_transactions")
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId || null,
        transaction_code: stockTxCode,
        transaction_type: "in",
        transaction_date: existingReceipt.receipt_date,
        warehouse_id: existingReceipt.warehouse_id,
        to_location_id: defaultLocationId,
        reference_type: "purchase_receipt",
        reference_id: existingReceipt.id,
        reference_code: existingReceipt.receipt_code,
        status: "posted",
        notes: `Goods received - ${existingReceipt.receipt_code}`,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (stockTxError) {
      return NextResponse.json(
        { error: stockTxError.message || "Failed to create stock transaction" },
        { status: 500 }
      );
    }

    const postingDate = existingReceipt.receipt_date;
    const postingTime = now.toTimeString().split(" ")[0];

    // Step 5: Create stock transaction items and update item_warehouse
    for (const item of normalizedItems) {
      const { data: warehouseStock } = await supabase
        .from("item_warehouse")
        .select("current_stock, default_location_id")
        .eq("item_id", item.itemId)
        .eq("warehouse_id", existingReceipt.warehouse_id)
        .is("deleted_at", null)
        .single();

      const currentBalance = warehouseStock ? parseFloat(String(warehouseStock.current_stock)) : 0;
      const newBalance = currentBalance + item.normalizedQty;

      await supabase.from("stock_transaction_items").insert({
        company_id: userData.company_id,
        transaction_id: stockTransaction.id,
        item_id: item.itemId,
        input_qty: item.inputQty,
        conversion_factor: item.conversionFactor,
        normalized_qty: item.normalizedQty,
        quantity: item.normalizedQty,
        uom_id: item.uomId,
        unit_cost: item.unitCost,
        total_cost: item.totalCost,
        qty_before: currentBalance,
        qty_after: newBalance,
        valuation_rate: item.unitCost,
        stock_value_before: currentBalance * item.unitCost,
        stock_value_after: newBalance * item.unitCost,
        posting_date: postingDate,
        posting_time: postingTime,
        notes: `Receipt ${existingReceipt.receipt_code}`,
        created_by: user.id,
        updated_by: user.id,
      });

      await adjustItemLocation({
        supabase,
        companyId: userData.company_id,
        itemId: item.itemId,
        warehouseId: existingReceipt.warehouse_id,
        locationId: defaultLocationId || warehouseStock?.default_location_id || null,
        userId: user.id,
        qtyOnHandDelta: item.normalizedQty,
      });

      // Update or insert item_warehouse
      if (warehouseStock) {
        await supabase
          .from("item_warehouse")
          .update({
            current_stock: newBalance,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("item_id", item.itemId)
          .eq("warehouse_id", existingReceipt.warehouse_id);
      } else {
        await supabase.from("item_warehouse").insert({
          company_id: userData.company_id,
          item_id: item.itemId,
          warehouse_id: existingReceipt.warehouse_id,
          current_stock: newBalance,
          default_location_id: defaultLocationId,
          created_by: user.id,
          updated_by: user.id,
        });
      }
    }

    return NextResponse.json({
      message: "Receipt posted successfully",
      receiptId: id,
      stockTransactionId: stockTransaction.id,
      stockTransactionCode: stockTxCode,
    });
  } catch (error) {
    console.error("Error posting receipt:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
