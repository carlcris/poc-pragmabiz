/**
 * POS Stock Transaction Service
 *
 * Handles stock transactions for POS sales:
 * - Creates outbound stock transactions when items are sold
 * - Updates stock ledger with item movements
 * - Reduces inventory quantities in item_warehouse
 * - Creates reversal transactions for voided sales
 */

import { createClient } from "@/lib/supabase/server";

export type POSStockTransactionData = {
  transactionId: string;
  transactionCode: string;
  transactionDate: string;
  warehouseId: string;
  items: Array<{
    itemId: string;
    quantity: number;
    uomId: string;
    rate: number;
  }>;
};

/**
 * Create stock transaction for POS sale
 * - Creates stock_transactions record (type: 'out')
 * - Creates stock_ledger entries for each item
 * - Updates item_warehouse quantities (reduces stock)
 */
export async function createPOSStockTransaction(
  companyId: string,
  userId: string,
  data: POSStockTransactionData
): Promise<{ success: boolean; stockTransactionId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // Generate stock transaction code: ST-POS-{transaction_code}
    const stockTransactionCode = `ST-POS-${data.transactionCode}`;

    // Create stock transaction header
    const { data: stockTransaction, error: transactionError } = await supabase
      .from("stock_transactions")
      .insert({
        company_id: companyId,
        transaction_code: stockTransactionCode,
        transaction_type: "out",
        transaction_date: data.transactionDate.split("T")[0], // Extract date only
        warehouse_id: data.warehouseId,
        reference_type: "pos_transaction",
        reference_id: data.transactionId,
        reference_code: data.transactionCode,
        notes: `POS Sale - ${data.transactionCode}`,
        status: "draft",
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (transactionError || !stockTransaction) {
      console.error("Error creating POS stock transaction:", transactionError);
      return {
        success: false,
        error: "Failed to create stock transaction",
      };
    }

    // Get current stock levels for each item in this warehouse
    const stockBalances = new Map<string, number>();

    for (const item of data.items) {
      const { data: latestLedger } = await supabase
        .from("stock_ledger")
        .select("qty_after_trans")
        .eq("company_id", companyId)
        .eq("item_id", item.itemId)
        .eq("warehouse_id", data.warehouseId)
        .order("posting_date", { ascending: false })
        .order("posting_time", { ascending: false })
        .limit(1)
        .single();

      stockBalances.set(
        item.itemId,
        latestLedger ? parseFloat(latestLedger.qty_after_trans) : 0
      );
    }

    // Create stock_transaction_items records
    const transactionItems = data.items.map((item) => ({
      company_id: companyId,
      transaction_id: stockTransaction.id,
      item_id: item.itemId,
      quantity: item.quantity,
      uom_id: item.uomId,
      unit_cost: item.rate,
      total_cost: item.quantity * item.rate,
      created_by: userId,
      updated_by: userId,
    }));

    const { data: createdTransactionItems, error: itemsError } = await supabase
      .from("stock_transaction_items")
      .insert(transactionItems)
      .select();

    if (itemsError || !createdTransactionItems) {
      console.error("Error creating stock transaction items:", itemsError);
      // Rollback: delete transaction
      await supabase
        .from("stock_transactions")
        .delete()
        .eq("id", stockTransaction.id);
      return {
        success: false,
        error: "Failed to create stock transaction items",
      };
    }

    // Create stock ledger entries for each item
    const now = new Date();
    const postingDate = now.toISOString().split("T")[0];
    const postingTime = now.toTimeString().split(" ")[0];

    const ledgerEntries = data.items.map((item, index) => {
      const currentBalance = stockBalances.get(item.itemId) || 0;
      const newBalance = currentBalance - item.quantity;
      const transactionItem = createdTransactionItems[index];

      return {
        company_id: companyId,
        item_id: item.itemId,
        warehouse_id: data.warehouseId,
        transaction_id: stockTransaction.id,
        transaction_item_id: transactionItem.id,
        transaction_type: "pos_sale",
        posting_date: postingDate,
        posting_time: postingTime,
        voucher_type: "POS Sale",
        voucher_no: data.transactionCode,
        actual_qty: -item.quantity, // Negative for outgoing
        qty_after_trans: newBalance,
        qty_change: -item.quantity,
        uom_id: item.uomId,
        rate: item.rate,
        incoming_rate: item.rate,
        valuation_rate: item.rate,
        stock_value: newBalance * item.rate,
        stock_value_diff: -item.quantity * item.rate,
        value_change: -item.quantity * item.rate,
        reference_type: "pos_transaction",
        reference_id: data.transactionId,
        reference_code: data.transactionCode,
        is_cancelled: false,
        created_by: userId,
      };
    });

    const { error: ledgerError } = await supabase
      .from("stock_ledger")
      .insert(ledgerEntries);

    if (ledgerError) {
      console.error("Error creating stock ledger entries:", ledgerError);
      // Rollback: delete transaction items and transaction
      await supabase
        .from("stock_transaction_items")
        .delete()
        .in("id", createdTransactionItems.map((item) => item.id));
      await supabase
        .from("stock_transactions")
        .delete()
        .eq("id", stockTransaction.id);
      return {
        success: false,
        error: "Failed to create stock ledger entries",
      };
    }

    // Update item_warehouse quantities (reduce stock)
    for (const item of data.items) {
      const currentBalance = stockBalances.get(item.itemId) || 0;
      const newBalance = currentBalance - item.quantity;

      // Check if item_warehouse record exists
      const { data: existingItemWarehouse } = await supabase
        .from("item_warehouse")
        .select("id, current_stock")
        .eq("company_id", companyId)
        .eq("item_id", item.itemId)
        .eq("warehouse_id", data.warehouseId)
        .is("deleted_at", null)
        .single();

      if (existingItemWarehouse) {
        // Update existing record
        const { error: updateError } = await supabase
          .from("item_warehouse")
          .update({
            current_stock: newBalance,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingItemWarehouse.id);

        if (updateError) {
          console.error("Error updating item_warehouse:", updateError);
          // Log warning but continue - stock ledger is source of truth
        }
      } else {
        // Create new record (shouldn't normally happen, but handle gracefully)
        const { error: insertError } = await supabase
          .from("item_warehouse")
          .insert({
            company_id: companyId,
            item_id: item.itemId,
            warehouse_id: data.warehouseId,
            current_stock: newBalance,
            reserved_stock: 0,
            reorder_level: 0,
            reorder_quantity: 0,
            is_active: true,
            created_by: userId,
            updated_by: userId,
          });

        if (insertError) {
          console.error("Error creating item_warehouse:", insertError);
          // Log warning but continue
        }
      }
    }

    return {
      success: true,
      stockTransactionId: stockTransaction.id,
    };
  } catch (error) {
    console.error("Unexpected error in createPOSStockTransaction:", error);
    return {
      success: false,
      error: "Internal error creating stock transaction",
    };
  }
}

/**
 * Reverse POS stock transaction (for voided sales)
 * - Creates reversing stock_transactions record (type: 'in')
 * - Creates reversing stock_ledger entries (add back stock)
 * - Updates item_warehouse quantities (restore stock)
 */
export async function reversePOSStockTransaction(
  companyId: string,
  userId: string,
  transactionId: string,
  transactionCode: string,
  warehouseId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Get original POS transaction items
    const { data: posTransactionItems, error: itemsError } = await supabase
      .from("pos_transaction_items")
      .select("item_id, item_code, item_name, quantity, pos_transactions(transaction_date)")
      .eq("pos_transaction_id", transactionId);

    if (itemsError || !posTransactionItems || posTransactionItems.length === 0) {
      console.error("Error fetching POS transaction items:", itemsError);
      return {
        success: false,
        error: "Failed to fetch transaction items",
      };
    }

    // Get transaction date from first item
    const transactionDate = (posTransactionItems[0].pos_transactions as { transaction_date: string })?.transaction_date || new Date().toISOString();

    // Generate reversal stock transaction code
    const reversalCode = `ST-POS-VOID-${transactionCode}`;

    // Create reversal stock transaction header
    const { data: reversalTransaction, error: transactionError } = await supabase
      .from("stock_transactions")
      .insert({
        company_id: companyId,
        transaction_code: reversalCode,
        transaction_type: "in", // Opposite of 'out'
        transaction_date: new Date().toISOString().split("T")[0], // Current date for reversal
        warehouse_id: warehouseId,
        reference_type: "pos_transaction",
        reference_id: transactionId,
        reference_code: transactionCode,
        notes: `Void/Reversal - POS Sale ${transactionCode}`,
        status: "draft",
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (transactionError || !reversalTransaction) {
      console.error("Error creating reversal stock transaction:", transactionError);
      return {
        success: false,
        error: "Failed to create reversal transaction",
      };
    }

    // Get items with UOM
    const { data: itemsData, error: itemsDataError } = await supabase
      .from("items")
      .select("id, uom_id, purchase_price")
      .in("id", posTransactionItems.map((item) => item.item_id))
      .eq("company_id", companyId);

    if (itemsDataError || !itemsData) {
      console.error("Error fetching items data:", itemsDataError);
      await supabase.from("stock_transactions").delete().eq("id", reversalTransaction.id);
      return {
        success: false,
        error: "Failed to fetch items data",
      };
    }

    const itemsMap = new Map(itemsData.map((item) => [item.id, item]));

    // Get current stock levels for each item
    const stockBalances = new Map<string, number>();

    for (const item of posTransactionItems) {
      const { data: latestLedger } = await supabase
        .from("stock_ledger")
        .select("qty_after_trans")
        .eq("company_id", companyId)
        .eq("item_id", item.item_id)
        .eq("warehouse_id", warehouseId)
        .order("posting_date", { ascending: false })
        .order("posting_time", { ascending: false })
        .limit(1)
        .single();

      stockBalances.set(
        item.item_id,
        latestLedger ? parseFloat(latestLedger.qty_after_trans) : 0
      );
    }

    // Create reversal stock_transaction_items
    const reversalItems = posTransactionItems.map((item) => {
      const itemData = itemsMap.get(item.item_id);
      const rate = parseFloat(itemData?.purchase_price || "0");

      return {
        company_id: companyId,
        transaction_id: reversalTransaction.id,
        item_id: item.item_id,
        quantity: item.quantity, // Positive for returning stock
        uom_id: itemData?.uom_id || "",
        unit_cost: rate,
        total_cost: item.quantity * rate,
        created_by: userId,
        updated_by: userId,
      };
    });

    const { data: createdReversalItems, error: reversalItemsError } = await supabase
      .from("stock_transaction_items")
      .insert(reversalItems)
      .select();

    if (reversalItemsError || !createdReversalItems) {
      console.error("Error creating reversal transaction items:", reversalItemsError);
      await supabase.from("stock_transactions").delete().eq("id", reversalTransaction.id);
      return {
        success: false,
        error: "Failed to create reversal items",
      };
    }

    // Create reversal stock ledger entries (positive quantities)
    const now = new Date();
    const postingDate = now.toISOString().split("T")[0];
    const postingTime = now.toTimeString().split(" ")[0];

    const reversalLedgerEntries = posTransactionItems.map((item, index) => {
      const currentBalance = stockBalances.get(item.item_id) || 0;
      const newBalance = currentBalance + item.quantity; // Add back
      const itemData = itemsMap.get(item.item_id);
      const rate = parseFloat(itemData?.purchase_price || "0");
      const reversalItem = createdReversalItems[index];

      return {
        company_id: companyId,
        item_id: item.item_id,
        warehouse_id: warehouseId,
        transaction_id: reversalTransaction.id,
        transaction_item_id: reversalItem.id,
        transaction_type: "pos_void",
        posting_date: postingDate,
        posting_time: postingTime,
        voucher_type: "POS Void",
        voucher_no: transactionCode,
        actual_qty: item.quantity, // Positive for returning
        qty_after_trans: newBalance,
        qty_change: item.quantity,
        uom_id: itemData?.uom_id,
        rate: rate,
        incoming_rate: rate,
        valuation_rate: rate,
        stock_value: newBalance * rate,
        stock_value_diff: item.quantity * rate,
        value_change: item.quantity * rate,
        reference_type: "pos_transaction",
        reference_id: transactionId,
        reference_code: transactionCode,
        is_cancelled: false,
        created_by: userId,
      };
    });

    const { error: reversalLedgerError } = await supabase
      .from("stock_ledger")
      .insert(reversalLedgerEntries);

    if (reversalLedgerError) {
      console.error("Error creating reversal ledger entries:", reversalLedgerError);
      // Rollback
      await supabase
        .from("stock_transaction_items")
        .delete()
        .in("id", createdReversalItems.map((item) => item.id));
      await supabase.from("stock_transactions").delete().eq("id", reversalTransaction.id);
      return {
        success: false,
        error: "Failed to create reversal ledger entries",
      };
    }

    // Update item_warehouse quantities (restore stock)
    for (const item of posTransactionItems) {
      const currentBalance = stockBalances.get(item.item_id) || 0;
      const newBalance = currentBalance + item.quantity;

      const { data: existingItemWarehouse } = await supabase
        .from("item_warehouse")
        .select("id")
        .eq("company_id", companyId)
        .eq("item_id", item.item_id)
        .eq("warehouse_id", warehouseId)
        .is("deleted_at", null)
        .single();

      if (existingItemWarehouse) {
        const { error: updateError } = await supabase
          .from("item_warehouse")
          .update({
            current_stock: newBalance,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingItemWarehouse.id);

        if (updateError) {
          console.error("Error updating item_warehouse:", updateError);
          // Log warning but continue
        }
      }
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Unexpected error in reversePOSStockTransaction:", error);
    return {
      success: false,
      error: "Internal error reversing stock transaction",
    };
  }
}
