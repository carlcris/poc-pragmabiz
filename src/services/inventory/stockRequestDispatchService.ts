import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adjustItemLocation,
  consumeItemLocationsFIFO,
  ensureWarehouseDefaultLocation,
} from "@/services/inventory/locationService";

type DispatchStockRequestItem = {
  itemId: string;
  quantity: number;
  uomId: string;
  notes?: string | null;
};

type DispatchStockRequestInput = {
  supabase: SupabaseClient;
  companyId: string;
  businessUnitId: string;
  userId: string;
  stockRequestId: string;
  requestCode: string;
  destinationWarehouseId: string;
  dispatchDate?: string;
  notes?: string | null;
  items: DispatchStockRequestItem[];
};

const parseNumber = (value: unknown) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const dispatchStockRequestInventory = async ({
  supabase,
  companyId,
  businessUnitId,
  userId,
  stockRequestId,
  requestCode,
  destinationWarehouseId,
  dispatchDate,
  notes,
  items,
}: DispatchStockRequestInput) => {
  const dispatchItems = items.filter((item) => item.quantity > 0);

  if (dispatchItems.length === 0) {
    throw new Error("No quantities available for dispatch.");
  }

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0].replace(/-/g, "");
  const milliseconds = now.getTime().toString().slice(-4);
  const transactionCode = `ST-${dateStr}${milliseconds}`;
  const transactionDate = dispatchDate || now.toISOString().split("T")[0];
  const postingDate = transactionDate;
  const postingTime = now.toTimeString().split(" ")[0];

  const defaultFromLocationId = await ensureWarehouseDefaultLocation({
    supabase,
    companyId,
    warehouseId: destinationWarehouseId,
    userId,
  });

  const transactionNote = notes || `Stock request ${requestCode} dispatched`;

  const { data: stockTransaction, error: transactionError } = await supabase
    .from("stock_transactions")
    .insert({
      company_id: companyId,
      business_unit_id: businessUnitId,
      transaction_code: transactionCode,
      transaction_type: "out",
      transaction_date: transactionDate,
      warehouse_id: destinationWarehouseId,
      from_location_id: defaultFromLocationId,
      reference_type: "stock_request",
      reference_id: stockRequestId,
      reference_code: requestCode,
      status: "posted",
      notes: transactionNote,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();

  if (transactionError || !stockTransaction) {
    throw new Error(transactionError?.message || "Failed to create stock transaction");
  }

  for (const item of dispatchItems) {
    const { data: warehouseStock } = await supabase
      .from("item_warehouse")
      .select("id, current_stock, default_location_id")
      .eq("company_id", companyId)
      .eq("item_id", item.itemId)
      .eq("warehouse_id", destinationWarehouseId)
      .is("deleted_at", null)
      .maybeSingle();

    const currentBalance = parseNumber(warehouseStock?.current_stock);

    if (currentBalance < item.quantity) {
      throw new Error(`Insufficient stock for item ${item.itemId}`);
    }

    const newBalance = currentBalance - item.quantity;

    const { data: locationRows } = await supabase
      .from("item_location")
      .select("location_id, qty_on_hand")
      .eq("company_id", companyId)
      .eq("item_id", item.itemId)
      .eq("warehouse_id", destinationWarehouseId)
      .is("deleted_at", null);

    const locationTotal = (locationRows || []).reduce(
      (sum, row) => sum + parseNumber(row.qty_on_hand),
      0
    );

    if (locationTotal < currentBalance) {
      const missingQty = currentBalance - locationTotal;
      await adjustItemLocation({
        supabase,
        companyId,
        itemId: item.itemId,
        warehouseId: destinationWarehouseId,
        locationId: defaultFromLocationId || warehouseStock?.default_location_id || null,
        userId,
        qtyOnHandDelta: missingQty,
      });
    }

    await consumeItemLocationsFIFO({
      supabase,
      companyId,
      itemId: item.itemId,
      warehouseId: destinationWarehouseId,
      quantity: item.quantity,
      userId,
    });

    if (warehouseStock?.id) {
      const { error: updateWarehouseError } = await supabase
        .from("item_warehouse")
        .update({
          current_stock: newBalance,
          updated_by: userId,
          updated_at: now.toISOString(),
        })
        .eq("id", warehouseStock.id);

      if (updateWarehouseError) {
        throw new Error(updateWarehouseError.message);
      }
    } else {
      const { error: insertWarehouseError } = await supabase.from("item_warehouse").insert({
        company_id: companyId,
        item_id: item.itemId,
        warehouse_id: destinationWarehouseId,
        current_stock: newBalance,
        default_location_id: defaultFromLocationId,
        created_by: userId,
        updated_by: userId,
      });

      if (insertWarehouseError) {
        throw new Error(insertWarehouseError.message);
      }
    }

    const { error: itemError } = await supabase.from("stock_transaction_items").insert({
      company_id: companyId,
      transaction_id: stockTransaction.id,
      item_id: item.itemId,
      quantity: item.quantity,
      uom_id: item.uomId,
      unit_cost: 0,
      total_cost: 0,
      qty_before: currentBalance,
      qty_after: newBalance,
      valuation_rate: 0,
      stock_value_before: 0,
      stock_value_after: 0,
      posting_date: postingDate,
      posting_time: postingTime,
      notes: item.notes || transactionNote,
      created_by: userId,
      updated_by: userId,
    });

    if (itemError) {
      throw new Error(itemError.message);
    }
  }

  return stockTransaction.id;
};
