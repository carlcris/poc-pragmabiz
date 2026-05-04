/**
 * POS Transaction Posting Service
 *
 * Handles automatic GL posting for POS transactions:
 * - Sale posting: DR Cash/Bank, CR Revenue/Tax
 * - COGS posting: DR COGS, CR Inventory
 */

import { createClient } from "@/lib/supabase/server";

export type POSSalePostingData = {
  transactionId: string;
  transactionCode: string;
  transactionDate: string;
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  totalAmount: number;
  amountPaid: number;
  description?: string;
};

export type POSCOGSItem = {
  itemId: string;
  itemCode?: string;
  itemName?: string;
  quantity: number;
  valuationRate: number; // Cost per unit from stock ledger
  totalCost: number; // quantity * valuationRate
};

export type POSCOGSPostingData = {
  transactionId: string;
  transactionCode: string;
  transactionDate: string;
  items: POSCOGSItem[];
  totalCOGS: number;
  description?: string;
};

/**
 * Post POS Sale to General Ledger
 * Journal Entry:
 *   DR Cash/Bank (A-1000)           | Amount Paid
 *   CR Sales Revenue (R-4000)       | Total Amount - Total Tax
 *   CR Sales Tax Payable (L-2100)   | Inclusive VAT component (if > 0)
 */
export async function postPOSSale(
  companyId: string,
  userId: string,
  data: POSSalePostingData
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // Get Cash/Bank account (A-1000)
    const { data: cashAccount, error: cashError } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", companyId)
      .eq("account_number", "A-1000")
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (cashError || !cashAccount) {
      return {
        success: false,
        error: "Cash/Bank account (A-1000) not found",
      };
    }

    // Get Sales Revenue account (R-4000)
    const { data: revenueAccount, error: revenueError } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", companyId)
      .eq("account_number", "R-4000")
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (revenueError || !revenueAccount) {
      return {
        success: false,
        error: "Sales Revenue account (R-4000) not found",
      };
    }

    // Get Sales Tax Payable account (L-2100) - only if tax > 0
    let taxAccount: { id: string } | null = null;
    if (data.totalTax > 0) {
      const { data: taxAcct, error: taxError } = await supabase
        .from("accounts")
        .select("id")
        .eq("company_id", companyId)
        .eq("account_number", "L-2100")
        .eq("is_active", true)
        .is("deleted_at", null)
        .single();

      if (taxError || !taxAcct) {
        return {
          success: false,
          error: "Sales Tax Payable account (L-2100) not found",
        };
      }
      taxAccount = taxAcct;
    }

    const netRevenue = data.totalAmount - data.totalTax;

    // Create journal entry header
    // Note: Use totalAmount (not amountPaid) - we don't track change given to customers
    const { data: journalEntry, error: journalError } = await supabase
      .from("journal_entries")
      .insert({
        company_id: companyId,
        posting_date: data.transactionDate,
        reference_type: "pos_transaction",
        reference_id: data.transactionId,
        reference_code: data.transactionCode,
        description: data.description || `POS Sale - ${data.transactionCode}`,
        status: "posted", // Auto-post POS entries
        source_module: "POS",
        total_debit: data.totalAmount,
        total_credit: data.totalAmount,
        posted_at: new Date().toISOString(),
        posted_by: userId,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (journalError || !journalEntry) {
      return {
        success: false,
        error: "Failed to create journal entry",
      };
    }

    // Build journal lines array
    const journalLines = [];
    let lineNumber = 1;

    // DR Cash/Bank (use totalAmount - we don't track change given back)
    journalLines.push({
      company_id: companyId,
      journal_entry_id: journalEntry.id,
      account_id: cashAccount.id,
      debit: data.totalAmount,
      credit: 0,
      description: `Cash received - POS ${data.transactionCode}`,
      line_number: lineNumber++,
      created_by: userId,
    });

    // CR Sales Revenue (net of discount)
    journalLines.push({
      company_id: companyId,
      journal_entry_id: journalEntry.id,
      account_id: revenueAccount.id,
      debit: 0,
      credit: netRevenue,
      description: `Sales revenue - POS ${data.transactionCode}`,
      line_number: lineNumber++,
      created_by: userId,
    });

    // CR Sales Tax Payable (if tax > 0)
    if (data.totalTax > 0 && taxAccount) {
      journalLines.push({
        company_id: companyId,
        journal_entry_id: journalEntry.id,
        account_id: taxAccount.id,
        debit: 0,
        credit: data.totalTax,
        description: `Sales tax collected - POS ${data.transactionCode}`,
        line_number: lineNumber++,
        created_by: userId,
      });
    }

    // Insert journal lines
    const { error: linesError } = await supabase.from("journal_lines").insert(journalLines);

    if (linesError) {
      // Rollback: Delete journal entry
      await supabase.from("journal_entries").delete().eq("id", journalEntry.id);

      return {
        success: false,
        error: "Failed to create journal lines",
      };
    }

    return {
      success: true,
      journalEntryId: journalEntry.id,
    };
  } catch {
    return {
      success: false,
      error: "Internal error posting POS sale",
    };
  }
}

/**
 * Calculate COGS for POS transaction items from stock ledger
 * Uses the most recent valuation_rate for each item
 * Falls back to purchase_price if no stock ledger entry exists
 */
export async function calculatePOSCOGS(
  companyId: string,
  transactionId: string
): Promise<{ success: boolean; items?: POSCOGSItem[]; totalCOGS?: number; error?: string }> {
  try {
    const supabase = await createClient();

    // Get POS transaction items
    const { data: transactionItems, error: itemsError } = await supabase
      .from("pos_transaction_items")
      .select("id, item_id, item_code, item_name, quantity")
      .eq("pos_transaction_id", transactionId);

    if (itemsError || !transactionItems) {
      return {
        success: false,
        error: "Failed to fetch transaction items",
      };
    }

    const cogsItems: POSCOGSItem[] = [];
    let totalCOGS = 0;

    for (const item of transactionItems) {
      // Get the most recent valuation rate from stock_transaction_items
      const { data: transactionItem, error: txItemError } = await supabase
        .from("stock_transaction_items")
        .select("valuation_rate")
        .eq("company_id", companyId)
        .eq("item_id", item.item_id)
        .not("valuation_rate", "is", null)
        .order("posting_date", { ascending: false })
        .order("posting_time", { ascending: false })
        .limit(1)
        .single();

      let valuationRate = 0;

      if (txItemError || !transactionItem) {
        // Fallback to purchase_price from items table
        const { data: itemData, error: itemError } = await supabase
          .from("items")
          .select("purchase_price")
          .eq("id", item.item_id)
          .eq("company_id", companyId)
          .single();

        if (itemError || !itemData) {
          // Continue with zero cost rather than failing
          valuationRate = 0;
        } else {
          valuationRate = parseFloat(itemData.purchase_price || "0");
        }
      } else {
        valuationRate = parseFloat(transactionItem.valuation_rate || "0");
      }

      const totalCost = item.quantity * valuationRate;

      cogsItems.push({
        itemId: item.item_id,
        itemCode: item.item_code,
        itemName: item.item_name,
        quantity: item.quantity,
        valuationRate,
        totalCost,
      });

      totalCOGS += totalCost;
    }

    return {
      success: true,
      items: cogsItems,
      totalCOGS,
    };
  } catch {
    return {
      success: false,
      error: "Failed to calculate COGS",
    };
  }
}

/**
 * Post POS COGS to General Ledger
 * Journal Entry:
 *   DR Cost of Goods Sold (C-5000)
 *   CR Inventory (A-1200)
 */
export async function postPOSCOGS(
  companyId: string,
  userId: string,
  data: POSCOGSPostingData
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

    // Create journal entry header
    const { data: journalEntry, error: journalError } = await supabase
      .from("journal_entries")
      .insert({
        company_id: companyId,
        posting_date: data.transactionDate,
        reference_type: "pos_transaction",
        reference_id: data.transactionId,
        reference_code: data.transactionCode,
        description:
          data.description ||
          `COGS - POS Sale ${data.transactionCode} (${data.items.length} items)`,
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
        description: `COGS for ${data.items.length} items sold - POS ${data.transactionCode}`,
        line_number: 1,
        created_by: userId,
      },
      {
        company_id: companyId,
        journal_entry_id: journalEntry.id,
        account_id: inventoryAccount.id,
        debit: 0,
        credit: data.totalCOGS,
        description: `Inventory reduction - POS ${data.transactionCode}`,
        line_number: 2,
        created_by: userId,
      },
    ];

    const { error: linesError } = await supabase.from("journal_lines").insert(journalLines);

    if (linesError) {
      // Rollback: Delete journal entry
      await supabase.from("journal_entries").delete().eq("id", journalEntry.id);

      return {
        success: false,
        error: "Failed to create journal lines",
      };
    }

    return {
      success: true,
      journalEntryId: journalEntry.id,
    };
  } catch {
    return {
      success: false,
      error: "Internal error posting POS COGS",
    };
  }
}
