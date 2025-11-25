/**
 * Cost of Goods Sold (COGS) Posting Service
 *
 * Handles automatic GL posting for COGS when items are sold:
 * - COGS posting: DR COGS, CR Inventory
 * - Uses valuation from stock_ledger (weighted average cost)
 */

import { createClient } from "@/lib/supabase/server";

export type COGSItem = {
  itemId: string;
  itemCode?: string;
  itemName?: string;
  quantity: number;
  valuationRate: number; // Cost per unit from stock ledger
  totalCost: number; // quantity * valuationRate
};

export type COGSPostingData = {
  invoiceId: string;
  invoiceCode: string;
  warehouseId: string;
  invoiceDate: string;
  items: COGSItem[];
  totalCOGS: number;
  description?: string;
};

/**
 * Calculate COGS for invoice items from stock ledger
 * Uses the most recent valuation_rate for each item in the warehouse
 */
export async function calculateCOGS(
  companyId: string,
  warehouseId: string,
  items: Array<{ itemId: string; quantity: number }>
): Promise<{ success: boolean; items?: COGSItem[]; totalCOGS?: number; error?: string }> {
  try {
    const supabase = await createClient();

    const cogsItems: COGSItem[] = [];
    let totalCOGS = 0;

    for (const item of items) {
      // Get the most recent valuation rate from stock ledger
      const { data: ledgerEntry, error: ledgerError } = await supabase
        .from("stock_ledger")
        .select("valuation_rate, item_id, items(item_code, item_name)")
        .eq("company_id", companyId)
        .eq("item_id", item.itemId)
        .eq("warehouse_id", warehouseId)
        .eq("is_cancelled", false)
        .not("valuation_rate", "is", null)
        .order("posting_date", { ascending: false })
        .order("posting_time", { ascending: false })
        .limit(1)
        .single();

      if (ledgerError || !ledgerEntry) {
        // If no stock ledger entry exists, try to get from items table (purchase_price)
        const { data: itemData, error: itemError } = await supabase
          .from("items")
          .select("item_code, item_name, purchase_price")
          .eq("id", item.itemId)
          .eq("company_id", companyId)
          .single();

        if (itemError || !itemData) {
          console.error(`Item not found: ${item.itemId}`);
          return {
            success: false,
            error: `Item not found: ${item.itemId}`,
          };
        }

        // Use purchase_price as fallback
        const valuationRate = parseFloat(itemData.purchase_price || "0");
        const totalCost = item.quantity * valuationRate;

        cogsItems.push({
          itemId: item.itemId,
          itemCode: itemData.item_code,
          itemName: itemData.item_name,
          quantity: item.quantity,
          valuationRate,
          totalCost,
        });

        totalCOGS += totalCost;
      } else {
        const valuationRate = parseFloat(ledgerEntry.valuation_rate || "0");
        const totalCost = item.quantity * valuationRate;

        cogsItems.push({
          itemId: item.itemId,
          itemCode: (ledgerEntry.items as { item_code: string })?.item_code,
          itemName: (ledgerEntry.items as { item_name: string })?.item_name,
          quantity: item.quantity,
          valuationRate,
          totalCost,
        });

        totalCOGS += totalCost;
      }
    }

    return {
      success: true,
      items: cogsItems,
      totalCOGS,
    };
  } catch (error) {
    console.error("Error calculating COGS:", error);
    return {
      success: false,
      error: "Failed to calculate COGS",
    };
  }
}

/**
 * Post COGS to General Ledger
 * Journal Entry:
 *   DR Cost of Goods Sold (C-5000)
 *   CR Inventory (A-1200)
 */
export async function postCOGS(
  companyId: string,
  userId: string,
  data: COGSPostingData
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // Skip if total COGS is zero
    if (data.totalCOGS === 0) {
      return {
        success: true,
        journalEntryId: undefined,
      };
    }

    // Get COGS account (C-5000)
    const { data: cogsAccount, error: cogsError } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", companyId)
      .eq("account_number", "C-5000")
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (cogsError || !cogsAccount) {
      return {
        success: false,
        error: "Cost of Goods Sold account (C-5000) not found",
      };
    }

    // Get Inventory account (A-1200)
    const { data: inventoryAccount, error: inventoryError } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", companyId)
      .eq("account_number", "A-1200")
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (inventoryError || !inventoryAccount) {
      return {
        success: false,
        error: "Inventory account (A-1200) not found",
      };
    }

    // Get next journal code
    const { data: journalCodeResult, error: codeError } = await supabase.rpc(
      "get_next_journal_code",
      { p_company_id: companyId }
    );

    if (codeError || !journalCodeResult) {
      return {
        success: false,
        error: "Failed to generate journal code",
      };
    }

    const journalCode = journalCodeResult as string;

    // Create journal entry header
    const { data: journalEntry, error: journalError } = await supabase
      .from("journal_entries")
      .insert({
        company_id: companyId,
        journal_code: journalCode,
        posting_date: data.invoiceDate,
        reference_type: "sales_invoice",
        reference_id: data.invoiceId,
        reference_code: data.invoiceCode,
        description:
          data.description ||
          `COGS for invoice ${data.invoiceCode} (${data.items.length} items)`,
        status: "posted", // Auto-post COGS entries
        source_module: "COGS",
        total_debit: data.totalCOGS,
        total_credit: data.totalCOGS,
        posted_at: new Date().toISOString(),
        posted_by: userId,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (journalError || !journalEntry) {
      console.error("Error creating COGS journal entry:", journalError);
      return {
        success: false,
        error: "Failed to create journal entry",
      };
    }

    // Create journal lines
    const journalLines = [
      {
        company_id: companyId,
        journal_entry_id: journalEntry.id,
        account_id: cogsAccount.id,
        debit: data.totalCOGS,
        credit: 0,
        description: `COGS for ${data.items.length} items sold - Invoice ${data.invoiceCode}`,
        line_number: 1,
        created_by: userId,
      },
      {
        company_id: companyId,
        journal_entry_id: journalEntry.id,
        account_id: inventoryAccount.id,
        debit: 0,
        credit: data.totalCOGS,
        description: `Inventory reduction - Invoice ${data.invoiceCode}`,
        line_number: 2,
        created_by: userId,
      },
    ];

    const { error: linesError } = await supabase
      .from("journal_lines")
      .insert(journalLines);

    if (linesError) {
      // Rollback: Delete journal entry
      await supabase.from("journal_entries").delete().eq("id", journalEntry.id);

      console.error("Error creating COGS journal lines:", linesError);
      return {
        success: false,
        error: "Failed to create journal lines",
      };
    }

    return {
      success: true,
      journalEntryId: journalEntry.id,
    };
  } catch (error) {
    console.error("Unexpected error in postCOGS:", error);
    return {
      success: false,
      error: "Internal error posting COGS",
    };
  }
}
