import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  adjustItemLocation,
  ensureWarehouseDefaultLocation,
} from "@/services/inventory/locationService";

// POST /api/invoices/[id]/send
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(RESOURCES.SALES_INVOICES, "edit");
    const { id } = await params;
    const { supabase } = await createServerClientWithBU();

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

    // Fetch invoice with items
    const { data: invoice, error: fetchError } = await supabase
      .from("sales_invoices")
      .select(
        `
        *,
        items:sales_invoice_items(
          id,
          item_id,
          quantity,
          uom_id,
          rate
        )
      `
      )
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Only draft invoices can be sent
    if (invoice.status !== "draft") {
      return NextResponse.json({ error: "Only draft invoices can be sent" }, { status: 400 });
    }

    // Stock validation and deduction (only if warehouse is assigned)
    let stockTransactionCode: string | null = null;

    if (invoice.warehouse_id) {
      // Check stock availability before sending
      for (const item of invoice.items || []) {
        const { data: warehouseStock } = await supabase
          .from("item_warehouse")
          .select("current_stock, default_location_id")
          .eq("item_id", item.item_id)
          .eq("warehouse_id", invoice.warehouse_id)
          .single();

        const currentStock = warehouseStock ? parseFloat(String(warehouseStock.current_stock)) : 0;

        if (currentStock < parseFloat(item.quantity)) {
          return NextResponse.json(
            {
              error: `Insufficient stock for item. Available: ${currentStock}, Required: ${item.quantity}`,
            },
            { status: 400 }
          );
        }
      }

      // Generate stock transaction code (ST-YYYY-NNNN)
      const currentYear = new Date().getFullYear();
      const { data: lastStockTx } = await supabase
        .from("stock_transactions")
        .select("transaction_code")
        .eq("company_id", userData.company_id)
        .like("transaction_code", `ST-${currentYear}-%`)
        .order("transaction_code", { ascending: false })
        .limit(1);

      let nextStockTxNum = 1;
      if (lastStockTx && lastStockTx.length > 0) {
        const match = lastStockTx[0].transaction_code.match(/ST-\d+-(\d+)/);
        if (match) {
          nextStockTxNum = parseInt(match[1]) + 1;
        }
      }
      const stockTxCode = `ST-${currentYear}-${String(nextStockTxNum).padStart(4, "0")}`;

      const defaultLocationId = await ensureWarehouseDefaultLocation({
        supabase,
        companyId: userData.company_id,
        warehouseId: invoice.warehouse_id,
        userId: user.id,
      });
      const selectedLocationId = invoice.custom_fields?.locationId || defaultLocationId;

      // Create stock OUT transaction
      const { data: stockTransaction, error: stockTxError } = await supabase
        .from("stock_transactions")
        .insert({
          company_id: userData.company_id,
          transaction_code: stockTxCode,
          transaction_type: "out",
          transaction_date: invoice.invoice_date,
          warehouse_id: invoice.warehouse_id,
          from_location_id: selectedLocationId,
          reference_type: "sales_invoice",
          reference_id: invoice.id,
          status: "posted",
          notes: `Stock OUT for invoice ${invoice.invoice_number}`,
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

      stockTransactionCode = stockTxCode;

      // Create stock transaction items and update stock ledger
      for (const item of invoice.items || []) {
        // Create stock transaction item
        const { data: stockTxItem, error: stockTxItemError } = await supabase
          .from("stock_transaction_items")
          .insert({
            company_id: userData.company_id,
            transaction_id: stockTransaction.id,
            item_id: item.item_id,
            quantity: parseFloat(item.quantity),
            uom_id: item.uom_id,
            unit_cost: parseFloat(item.rate),
            total_cost: parseFloat(item.quantity) * parseFloat(item.rate),
            notes: `From invoice ${invoice.invoice_number}`,
            created_by: user.id,
            updated_by: user.id,
          })
          .select()
          .single();

        if (stockTxItemError) {
          // Rollback stock transaction
          await supabase.from("stock_transactions").delete().eq("id", stockTransaction.id);
          return NextResponse.json(
            { error: "Failed to create stock transaction items" },
            { status: 500 }
          );
        }

        // Get current stock balance from item_warehouse
        const { data: warehouseStock } = await supabase
          .from("item_warehouse")
          .select("current_stock, default_location_id")
          .eq("item_id", item.item_id)
          .eq("warehouse_id", invoice.warehouse_id)
          .single();

        const currentBalance = warehouseStock
          ? parseFloat(String(warehouseStock.current_stock))
          : 0;

        const newBalance = currentBalance - parseFloat(item.quantity);

        const postingDate = invoice.invoice_date;
        const postingTime = new Date().toTimeString().split(" ")[0];

        // Update stock_transaction_items with before/after quantities
        await supabase
          .from("stock_transaction_items")
          .update({
            qty_before: currentBalance,
            qty_after: newBalance,
            valuation_rate: parseFloat(item.rate),
            stock_value_before: currentBalance * parseFloat(item.rate),
            stock_value_after: newBalance * parseFloat(item.rate),
            posting_date: postingDate,
            posting_time: postingTime,
          })
          .eq("id", stockTxItem.id);

        await adjustItemLocation({
          supabase,
          companyId: userData.company_id,
          itemId: item.item_id,
          warehouseId: invoice.warehouse_id,
          locationId: selectedLocationId || warehouseStock?.default_location_id || null,
          userId: user.id,
          qtyOnHandDelta: -parseFloat(item.quantity),
        });

        // Update item_warehouse current_stock
        await supabase
          .from("item_warehouse")
          .update({
            current_stock: newBalance,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("item_id", item.item_id)
          .eq("warehouse_id", invoice.warehouse_id);
      }
    } else {
    }

    // Update invoice status to sent
    const { error: updateError } = await supabase
      .from("sales_invoices")
      .update({
        status: "sent",
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      // Rollback stock transactions if they were created
      if (invoice.warehouse_id && stockTransactionCode) {
        const { data: stockTx } = await supabase
          .from("stock_transactions")
          .select("id")
          .eq("transaction_code", stockTransactionCode)
          .single();

        if (stockTx) {
          await supabase.from("stock_transaction_items").delete().eq("transaction_id", stockTx.id);
          await supabase.from("stock_transactions").delete().eq("id", stockTx.id);
        }
      }
      return NextResponse.json({ error: "Failed to send invoice" }, { status: 500 });
    }

    const responseMessage = invoice.warehouse_id
      ? "Invoice sent successfully. Stock levels updated."
      : "Invoice sent successfully. No stock deduction (no warehouse assigned).";

    return NextResponse.json({
      success: true,
      message: responseMessage,
      stockTransactionCode: stockTransactionCode,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
