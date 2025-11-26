/**
 * POS Transaction Posting Service
 *
 * Handles automatic GL posting for POS transactions:
 * - Sale posting: DR Cash/Bank, CR Revenue/Discounts/Tax
 * - COGS posting: DR COGS, CR Inventory
 * - Void/reversal posting: Reverse both sale and COGS entries
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
 *   CR Sales Revenue (R-4000)       | Subtotal - Total Discount
 *   CR Sales Discounts (R-4010)     | Total Discount (if > 0)
 *   CR Sales Tax Payable (L-2100)   | Total Tax (if > 0)
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
      console.error("Cash/Bank account (A-1000) not found:", cashError);
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
      console.error("Sales Revenue account (R-4000) not found:", revenueError);
      return {
        success: false,
        error: "Sales Revenue account (R-4000) not found",
      };
    }

    // Get Sales Discounts account (R-4010) - only if discount > 0
    let discountAccount: { id: string } | null = null;
    if (data.totalDiscount > 0) {
      const { data: discountAcct, error: discountError } = await supabase
        .from("accounts")
        .select("id")
        .eq("company_id", companyId)
        .eq("account_number", "R-4010")
        .eq("is_active", true)
        .is("deleted_at", null)
        .single();

      if (discountError || !discountAcct) {
        console.error("Sales Discounts account (R-4010) not found:", discountError);
        return {
          success: false,
          error: "Sales Discounts account (R-4010) not found",
        };
      }
      discountAccount = discountAcct;
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
        console.error("Sales Tax Payable account (L-2100) not found:", taxError);
        return {
          success: false,
          error: "Sales Tax Payable account (L-2100) not found",
        };
      }
      taxAccount = taxAcct;
    }

    // Get next journal code
    const { data: journalCodeResult, error: codeError } = await supabase.rpc(
      "get_next_journal_code",
      { p_company_id: companyId }
    );

    if (codeError || !journalCodeResult) {
      console.error("Failed to generate journal code:", codeError);
      return {
        success: false,
        error: "Failed to generate journal code",
      };
    }

    const journalCode = journalCodeResult as string;

    // Calculate net revenue (subtotal - discount)
    const netRevenue = data.subtotal - data.totalDiscount;

    // Create journal entry header
    // Note: Use totalAmount (not amountPaid) - we don't track change given to customers
    const { data: journalEntry, error: journalError } = await supabase
      .from("journal_entries")
      .insert({
        company_id: companyId,
        journal_code: journalCode,
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
      console.error("Error creating POS sale journal entry:", journalError);
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

    // CR Sales Discounts (if discount > 0)
    if (data.totalDiscount > 0 && discountAccount) {
      journalLines.push({
        company_id: companyId,
        journal_entry_id: journalEntry.id,
        account_id: discountAccount.id,
        debit: 0,
        credit: data.totalDiscount,
        description: `Sales discount - POS ${data.transactionCode}`,
        line_number: lineNumber++,
        created_by: userId,
      });
    }

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
    const { error: linesError } = await supabase
      .from("journal_lines")
      .insert(journalLines);

    if (linesError) {
      // Rollback: Delete journal entry
      await supabase.from("journal_entries").delete().eq("id", journalEntry.id);

      console.error("Error creating POS sale journal lines:", linesError);
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
    console.error("Unexpected error in postPOSSale:", error);
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
      console.error("Error fetching POS transaction items:", itemsError);
      return {
        success: false,
        error: "Failed to fetch transaction items",
      };
    }

    const cogsItems: POSCOGSItem[] = [];
    let totalCOGS = 0;

    for (const item of transactionItems) {
      // Get the most recent valuation rate from stock ledger
      // Note: POS doesn't specify warehouse, so we query all warehouses
      const { data: ledgerEntry, error: ledgerError } = await supabase
        .from("stock_ledger")
        .select("valuation_rate")
        .eq("company_id", companyId)
        .eq("item_id", item.item_id)
        .eq("is_cancelled", false)
        .not("valuation_rate", "is", null)
        .order("posting_date", { ascending: false })
        .order("posting_time", { ascending: false })
        .limit(1)
        .single();

      let valuationRate = 0;

      if (ledgerError || !ledgerEntry) {
        // Fallback to purchase_price from items table
        const { data: itemData, error: itemError } = await supabase
          .from("items")
          .select("purchase_price")
          .eq("id", item.item_id)
          .eq("company_id", companyId)
          .single();

        if (itemError || !itemData) {
          console.error(`Item not found: ${item.item_id}`, itemError);
          // Continue with zero cost rather than failing
          valuationRate = 0;
        } else {
          valuationRate = parseFloat(itemData.purchase_price || "0");
        }
      } else {
        valuationRate = parseFloat(ledgerEntry.valuation_rate || "0");
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
  } catch (error) {
    console.error("Error calculating POS COGS:", error);
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
      console.error("COGS account (C-5000) not found:", cogsError);
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
      console.error("Inventory account (A-1200) not found:", inventoryError);
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
      console.error("Failed to generate journal code:", codeError);
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
      console.error("Error creating POS COGS journal entry:", journalError);
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

    const { error: linesError } = await supabase
      .from("journal_lines")
      .insert(journalLines);

    if (linesError) {
      // Rollback: Delete journal entry
      await supabase.from("journal_entries").delete().eq("id", journalEntry.id);

      console.error("Error creating POS COGS journal lines:", linesError);
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
    console.error("Unexpected error in postPOSCOGS:", error);
    return {
      success: false,
      error: "Internal error posting POS COGS",
    };
  }
}

/**
 * Reverse POS Transaction (for voids)
 * Creates reversal journal entries for both sale and COGS
 */
export async function reversePOSTransaction(
  companyId: string,
  userId: string,
  transactionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    // Get original POS transaction
    const { data: transaction, error: transactionError } = await supabase
      .from("pos_transactions")
      .select("transaction_code, transaction_date, subtotal, total_discount, total_tax, total_amount, amount_paid")
      .eq("id", transactionId)
      .eq("company_id", companyId)
      .single();

    if (transactionError || !transaction) {
      console.error("POS transaction not found:", transactionError);
      return {
        success: false,
        error: "Transaction not found",
      };
    }

    // Create reversal sale journal entry (opposite signs)
    const saleReversalData: POSSalePostingData = {
      transactionId,
      transactionCode: transaction.transaction_code,
      transactionDate: new Date().toISOString(), // Use current date for reversal
      subtotal: -transaction.subtotal,
      totalDiscount: -transaction.total_discount,
      totalTax: -transaction.total_tax,
      totalAmount: -transaction.total_amount,
      amountPaid: -transaction.amount_paid,
      description: `Void/Reversal - POS ${transaction.transaction_code}`,
    };

    const saleReversalResult = await postPOSSaleReversal(
      companyId,
      userId,
      saleReversalData
    );

    if (!saleReversalResult.success) {
      console.error("Failed to post sale reversal:", saleReversalResult.error);
      // Continue anyway - log as warning
    }

    // Calculate and create reversal COGS journal entry
    const cogsCalcResult = await calculatePOSCOGS(companyId, transactionId);

    if (cogsCalcResult.success && cogsCalcResult.items && cogsCalcResult.totalCOGS) {
      const cogsReversalData: POSCOGSPostingData = {
        transactionId,
        transactionCode: transaction.transaction_code,
        transactionDate: new Date().toISOString(),
        items: cogsCalcResult.items.map(item => ({
          ...item,
          totalCost: -item.totalCost, // Negative for reversal
        })),
        totalCOGS: -cogsCalcResult.totalCOGS, // Negative for reversal
        description: `Void/Reversal COGS - POS ${transaction.transaction_code}`,
      };

      const cogsReversalResult = await postPOSCOGSReversal(
        companyId,
        userId,
        cogsReversalData
      );

      if (!cogsReversalResult.success) {
        console.error("Failed to post COGS reversal:", cogsReversalResult.error);
        // Continue anyway - log as warning
      }
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error("Unexpected error in reversePOSTransaction:", error);
    return {
      success: false,
      error: "Internal error reversing POS transaction",
    };
  }
}

/**
 * Helper function to post sale reversal with opposite signs
 * Same logic as postPOSSale but handles negative amounts
 */
async function postPOSSaleReversal(
  companyId: string,
  userId: string,
  data: POSSalePostingData
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // Get accounts (same as postPOSSale)
    const { data: cashAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", companyId)
      .eq("account_number", "A-1000")
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    const { data: revenueAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", companyId)
      .eq("account_number", "R-4000")
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (!cashAccount || !revenueAccount) {
      return { success: false, error: "Required accounts not found" };
    }

    // Get discount and tax accounts if needed
    let discountAccount: { id: string } | null = null;
    if (data.totalDiscount !== 0) {
      const { data: discountAcct } = await supabase
        .from("accounts")
        .select("id")
        .eq("company_id", companyId)
        .eq("account_number", "R-4010")
        .eq("is_active", true)
        .is("deleted_at", null)
        .single();
      discountAccount = discountAcct;
    }

    let taxAccount: { id: string } | null = null;
    if (data.totalTax !== 0) {
      const { data: taxAcct } = await supabase
        .from("accounts")
        .select("id")
        .eq("company_id", companyId)
        .eq("account_number", "L-2100")
        .eq("is_active", true)
        .is("deleted_at", null)
        .single();
      taxAccount = taxAcct;
    }

    // Get journal code
    const { data: journalCodeResult } = await supabase.rpc(
      "get_next_journal_code",
      { p_company_id: companyId }
    );

    if (!journalCodeResult) {
      return { success: false, error: "Failed to generate journal code" };
    }

    const journalCode = journalCodeResult as string;
    const netRevenue = data.subtotal - data.totalDiscount;

    // Create journal entry with reversed amounts
    // Note: Use totalAmount (not amountPaid) - we don't track change
    const { data: journalEntry, error: journalError } = await supabase
      .from("journal_entries")
      .insert({
        company_id: companyId,
        journal_code: journalCode,
        posting_date: data.transactionDate,
        reference_type: "pos_transaction",
        reference_id: data.transactionId,
        reference_code: data.transactionCode,
        description: data.description,
        status: "posted",
        source_module: "POS",
        total_debit: Math.abs(data.totalAmount),
        total_credit: Math.abs(data.totalAmount),
        posted_at: new Date().toISOString(),
        posted_by: userId,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (journalError || !journalEntry) {
      return { success: false, error: "Failed to create journal entry" };
    }

    // Build journal lines with REVERSED debits/credits
    const journalLines = [];
    let lineNumber = 1;

    // CR Cash/Bank (opposite of debit in original)
    // Note: Use totalAmount (not amountPaid) - we don't track change given to customers
    journalLines.push({
      company_id: companyId,
      journal_entry_id: journalEntry.id,
      account_id: cashAccount.id,
      debit: 0,
      credit: Math.abs(data.totalAmount),
      description: `Void - Cash reversal - POS ${data.transactionCode}`,
      line_number: lineNumber++,
      created_by: userId,
    });

    // DR Sales Revenue (opposite of credit in original)
    journalLines.push({
      company_id: companyId,
      journal_entry_id: journalEntry.id,
      account_id: revenueAccount.id,
      debit: Math.abs(netRevenue),
      credit: 0,
      description: `Void - Revenue reversal - POS ${data.transactionCode}`,
      line_number: lineNumber++,
      created_by: userId,
    });

    // DR Sales Discounts (if applicable)
    if (data.totalDiscount !== 0 && discountAccount) {
      journalLines.push({
        company_id: companyId,
        journal_entry_id: journalEntry.id,
        account_id: discountAccount.id,
        debit: Math.abs(data.totalDiscount),
        credit: 0,
        description: `Void - Discount reversal - POS ${data.transactionCode}`,
        line_number: lineNumber++,
        created_by: userId,
      });
    }

    // DR Sales Tax Payable (if applicable)
    if (data.totalTax !== 0 && taxAccount) {
      journalLines.push({
        company_id: companyId,
        journal_entry_id: journalEntry.id,
        account_id: taxAccount.id,
        debit: Math.abs(data.totalTax),
        credit: 0,
        description: `Void - Tax reversal - POS ${data.transactionCode}`,
        line_number: lineNumber++,
        created_by: userId,
      });
    }

    const { error: linesError } = await supabase
      .from("journal_lines")
      .insert(journalLines);

    if (linesError) {
      await supabase.from("journal_entries").delete().eq("id", journalEntry.id);
      return { success: false, error: "Failed to create journal lines" };
    }

    return { success: true, journalEntryId: journalEntry.id };
  } catch (error) {
    console.error("Error in postPOSSaleReversal:", error);
    return { success: false, error: "Internal error" };
  }
}

/**
 * Helper function to post COGS reversal with opposite signs
 */
async function postPOSCOGSReversal(
  companyId: string,
  userId: string,
  data: POSCOGSPostingData
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    if (data.totalCOGS === 0) {
      return { success: true };
    }

    // Get accounts
    const { data: cogsAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", companyId)
      .eq("account_number", "C-5000")
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    const { data: inventoryAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", companyId)
      .eq("account_number", "A-1200")
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (!cogsAccount || !inventoryAccount) {
      return { success: false, error: "Required accounts not found" };
    }

    // Get journal code
    const { data: journalCodeResult } = await supabase.rpc(
      "get_next_journal_code",
      { p_company_id: companyId }
    );

    if (!journalCodeResult) {
      return { success: false, error: "Failed to generate journal code" };
    }

    const journalCode = journalCodeResult as string;

    // Create journal entry
    const { data: journalEntry, error: journalError } = await supabase
      .from("journal_entries")
      .insert({
        company_id: companyId,
        journal_code: journalCode,
        posting_date: data.transactionDate,
        reference_type: "pos_transaction",
        reference_id: data.transactionId,
        reference_code: data.transactionCode,
        description: data.description,
        status: "posted",
        source_module: "COGS",
        total_debit: Math.abs(data.totalCOGS),
        total_credit: Math.abs(data.totalCOGS),
        posted_at: new Date().toISOString(),
        posted_by: userId,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (journalError || !journalEntry) {
      return { success: false, error: "Failed to create journal entry" };
    }

    // Create journal lines with REVERSED debits/credits
    const journalLines = [
      {
        company_id: companyId,
        journal_entry_id: journalEntry.id,
        account_id: cogsAccount.id,
        debit: 0,
        credit: Math.abs(data.totalCOGS),
        description: `Void - COGS reversal - POS ${data.transactionCode}`,
        line_number: 1,
        created_by: userId,
      },
      {
        company_id: companyId,
        journal_entry_id: journalEntry.id,
        account_id: inventoryAccount.id,
        debit: Math.abs(data.totalCOGS),
        credit: 0,
        description: `Void - Inventory reversal - POS ${data.transactionCode}`,
        line_number: 2,
        created_by: userId,
      },
    ];

    const { error: linesError } = await supabase
      .from("journal_lines")
      .insert(journalLines);

    if (linesError) {
      await supabase.from("journal_entries").delete().eq("id", journalEntry.id);
      return { success: false, error: "Failed to create journal lines" };
    }

    return { success: true, journalEntryId: journalEntry.id };
  } catch (error) {
    console.error("Error in postPOSCOGSReversal:", error);
    return { success: false, error: "Internal error" };
  }
}
