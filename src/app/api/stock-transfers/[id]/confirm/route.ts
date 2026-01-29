import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { normalizeTransactionItems } from "@/services/inventory/normalizationService";
import {
  adjustItemLocation,
  ensureWarehouseDefaultLocation,
} from "@/services/inventory/locationService";
import type { StockTransactionItemInput } from "@/types/inventory-normalization";

type StockTransferItemRow = {
  id: string;
  item_id: string;
  quantity: number | string;
  packaging_id: string | null;
  uom_id: string | null;
};

type StockTransferRow = {
  to_warehouse_id: string;
  from_warehouse_id: string;
  status: string;
  custom_fields?: { fromLocationId?: string | null; toLocationId?: string | null } | null;
  stock_transfer_items: StockTransferItemRow[];
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require 'stock_transfers' edit permission (confirming is a form of editing)
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFERS, "edit");
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

    const { id: transferId } = await params;

    // Get the stock transfer
    const { data: transfer, error: transferError } = await supabase
      .from("stock_transfers")
      .select(
        `
        *,
        stock_transfer_items (*)
      `
      )
      .eq("id", transferId)
      .eq("company_id", userData.company_id)
      .single();

    if (transferError || !transfer) {
      return NextResponse.json({ error: "Stock transfer not found" }, { status: 404 });
    }

    const typedTransfer = transfer as StockTransferRow;

    // Verify the transfer is for the user's van
    if (typedTransfer.to_warehouse_id !== userData.van_warehouse_id) {
      return NextResponse.json(
        { error: "This transfer is not assigned to your van" },
        { status: 403 }
      );
    }

    // Verify transfer is in pending status
    if (typedTransfer.status !== "pending" && typedTransfer.status !== "in_transit") {
      return NextResponse.json(
        { error: "Transfer cannot be confirmed in current status" },
        { status: 400 }
      );
    }

    // Update transfer status to received
    const { error: updateError } = await supabase
      .from("stock_transfers")
      .update({
        status: "received",
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", transferId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to confirm transfer" }, { status: 500 });
    }

    // Update received quantities for all items
    const itemUpdates = typedTransfer.stock_transfer_items.map((item) => ({
      id: item.id,
      received_quantity: item.quantity, // Mark full quantity as received
    }));

    for (const itemUpdate of itemUpdates) {
      await supabase
        .from("stock_transfer_items")
        .update({ received_quantity: itemUpdate.received_quantity })
        .eq("id", itemUpdate.id);
    }

    // STEP 1: Normalize all item quantities from packages to base units
    const itemInputs: StockTransactionItemInput[] = typedTransfer.stock_transfer_items.map(
      (item) => ({
        itemId: item.item_id,
        packagingId: item.packaging_id || null, // null = use base package
        inputQty: parseFloat(String(item.quantity)),
        unitCost: 0, // Transfers don't have cost (internal movement)
      })
    );

    const normalizedItems = await normalizeTransactionItems(userData.company_id, itemInputs);

    // STEP 2: Create stock transaction for the transfer
    const currentYear = new Date().getFullYear();
    const { data: lastTransaction } = await supabase
      .from("stock_transactions")
      .select("transaction_code")
      .eq("company_id", userData.company_id)
      .like("transaction_code", `ST-${currentYear}-%`)
      .order("transaction_code", { ascending: false })
      .limit(1);

    let nextNum = 1;
    if (lastTransaction && lastTransaction.length > 0) {
      const match = lastTransaction[0].transaction_code.match(/ST-\d+-(\d+)/);
      if (match) {
        nextNum = parseInt(match[1]) + 1;
      }
    }
    const transactionCode = `ST-${currentYear}-${String(nextNum).padStart(4, "0")}`;

    // Create the stock transaction header
    const defaultFromLocationId = await ensureWarehouseDefaultLocation({
      supabase,
      companyId: userData.company_id,
      warehouseId: typedTransfer.from_warehouse_id,
      userId: user.id,
    });

    const defaultToLocationId = await ensureWarehouseDefaultLocation({
      supabase,
      companyId: userData.company_id,
      warehouseId: typedTransfer.to_warehouse_id,
      userId: user.id,
    });

    const fromLocationId = typedTransfer.custom_fields?.fromLocationId || defaultFromLocationId;
    const toLocationId = typedTransfer.custom_fields?.toLocationId || defaultToLocationId;

    const { data: stockTransaction, error: transactionError } = await supabase
      .from("stock_transactions")
      .insert({
        company_id: userData.company_id,
        transaction_code: transactionCode,
        transaction_type: "transfer",
        transaction_date: new Date().toISOString().split("T")[0],
        warehouse_id: typedTransfer.from_warehouse_id,
        to_warehouse_id: typedTransfer.to_warehouse_id,
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        reference_type: "Stock Transfer",
        reference_id: transferId,
        status: "posted",
        notes: `Transfer from ${typedTransfer.from_warehouse_id} to ${typedTransfer.to_warehouse_id}`,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (transactionError) {
      return NextResponse.json({ error: "Failed to create stock transaction" }, { status: 500 });
    }

    // STEP 3: Update stock levels using normalized quantities (base units)
    const postingDate = new Date().toISOString().split("T")[0];
    const postingTime = new Date().toISOString().split("T")[1].substring(0, 8);

    for (let i = 0; i < normalizedItems.length; i++) {
      const item = normalizedItems[i];
      // OUT from source warehouse (reduce stock)
      const { data: sourceStock } = await supabase
        .from("item_warehouse")
        .select("id, current_stock, default_location_id")
        .eq("company_id", userData.company_id)
        .eq("item_id", item.itemId)
        .eq("warehouse_id", typedTransfer.from_warehouse_id)
        .is("deleted_at", null)
        .single();

      const sourceCurrentStock = sourceStock ? parseFloat(String(sourceStock.current_stock)) : 0;
      const newSourceStock = Math.max(0, sourceCurrentStock - item.normalizedQty);

      await adjustItemLocation({
        supabase,
        companyId: userData.company_id,
        itemId: item.itemId,
        warehouseId: typedTransfer.from_warehouse_id,
        locationId: fromLocationId || sourceStock?.default_location_id || null,
        userId: user.id,
        qtyOnHandDelta: -item.normalizedQty,
      });

      if (sourceStock) {
        const { error: sourceUpdateError } = await supabase
          .from("item_warehouse")
          .update({
            current_stock: newSourceStock,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sourceStock.id);

        if (sourceUpdateError) {
          return NextResponse.json(
            { error: sourceUpdateError.message || "Failed to update source stock" },
            { status: 500 }
          );
        }
      }

      // IN to destination warehouse (add stock)
      const { data: destStock } = await supabase
        .from("item_warehouse")
        .select("id, current_stock, default_location_id, deleted_at")
        .eq("company_id", userData.company_id)
        .eq("item_id", item.itemId)
        .eq("warehouse_id", typedTransfer.to_warehouse_id)
        .maybeSingle();

      const destCurrentStock = destStock ? parseFloat(String(destStock.current_stock)) : 0;
      const newDestStock = destCurrentStock + item.normalizedQty;

      const { error: destUpsertError } = await supabase.from("item_warehouse").upsert(
        {
          company_id: userData.company_id,
          item_id: item.itemId,
          warehouse_id: typedTransfer.to_warehouse_id,
          current_stock: newDestStock,
          default_location_id: toLocationId || destStock?.default_location_id || null,
          deleted_at: null,
          created_by: destStock?.id ? undefined : user.id,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id,item_id,warehouse_id" }
      );

      if (destUpsertError) {
        return NextResponse.json(
          { error: destUpsertError.message || "Failed to update destination stock" },
          { status: 500 }
        );
      }

      await adjustItemLocation({
        supabase,
        companyId: userData.company_id,
        itemId: item.itemId,
        warehouseId: typedTransfer.to_warehouse_id,
        locationId: toLocationId || destStock?.default_location_id || null,
        userId: user.id,
        qtyOnHandDelta: item.normalizedQty,
      });

      // STEP 4: Create stock transaction item with full normalization metadata
      await supabase.from("stock_transaction_items").insert({
        company_id: userData.company_id,
        transaction_id: stockTransaction.id,
        item_id: item.itemId,
        // Normalization fields (NEW)
        input_qty: item.inputQty,
        input_packaging_id: item.inputPackagingId,
        conversion_factor: item.conversionFactor,
        normalized_qty: item.normalizedQty,
        base_package_id: item.basePackageId,
        // Standard fields
        quantity: item.normalizedQty, // Backward compat
        uom_id: item.uomId,
        unit_cost: 0, // Transfers don't have cost
        total_cost: 0,
        // Audit fields
        qty_before: sourceCurrentStock,
        qty_after: newSourceStock,
        valuation_rate: 0,
        stock_value_before: 0,
        stock_value_after: 0,
        posting_date: postingDate,
        posting_time: postingTime,
        created_by: user.id,
        updated_by: user.id,
      });
    }

    return NextResponse.json({
      message: "Stock transfer confirmed successfully",
      data: {
        id: transferId,
        status: "received",
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
