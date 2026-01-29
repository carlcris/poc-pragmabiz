/**
 * Accounts Payable (AP) Posting Service
 *
 * Handles automatic GL posting for AP transactions:
 * - Bill posting: DR Inventory/Expense, CR Accounts Payable
 * - Payment posting: DR Accounts Payable, CR Cash/Bank
 */

import { createClient } from "@/lib/supabase/server";

export type APBillPostingData = {
  purchaseReceiptId: string;
  purchaseReceiptCode: string;
  supplierId: string;
  receiptDate: string;
  totalAmount: number;
  description?: string;
};

export type APPaymentPostingData = {
  paymentId: string;
  purchaseReceiptId: string;
  purchaseReceiptCode: string;
  supplierId: string;
  paymentDate: string;
  paymentAmount: number;
  paymentMethod: string;
  description?: string;
};

/**
 * Post AP Bill (Purchase Receipt) to General Ledger
 * Journal Entry:
 *   DR Inventory (A-1200)
 *   CR Accounts Payable (L-2000)
 */
export async function postAPBill(
  companyId: string,
  userId: string,
  data: APBillPostingData
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const supabase = await createClient();

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

    // Get Accounts Payable account (L-2000)
    const { data: apAccount, error: apError } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", companyId)
      .eq("account_number", "L-2000")
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (apError || !apAccount) {
      return {
        success: false,
        error: "Accounts Payable account (L-2000) not found",
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
        posting_date: data.receiptDate,
        reference_type: "purchase_receipt",
        reference_id: data.purchaseReceiptId,
        reference_code: data.purchaseReceiptCode,
        description: data.description || `Purchase receipt ${data.purchaseReceiptCode}`,
        status: "posted", // Auto-post AP entries
        source_module: "AP",
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

    // Create journal lines
    const journalLines = [
      {
        company_id: companyId,
        journal_entry_id: journalEntry.id,
        account_id: inventoryAccount.id,
        debit: data.totalAmount,
        credit: 0,
        description: `Inventory purchase - Receipt ${data.purchaseReceiptCode}`,
        line_number: 1,
        created_by: userId,
      },
      {
        company_id: companyId,
        journal_entry_id: journalEntry.id,
        account_id: apAccount.id,
        debit: 0,
        credit: data.totalAmount,
        description: `AP to supplier - Receipt ${data.purchaseReceiptCode}`,
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
      error: "Internal error posting AP bill",
    };
  }
}

/**
 * Post AP Payment to General Ledger
 * Journal Entry:
 *   DR Accounts Payable (L-2000)
 *   CR Cash/Bank (A-1000)
 */
export async function postAPPayment(
  companyId: string,
  userId: string,
  data: APPaymentPostingData
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // Get Accounts Payable account (L-2000)
    const { data: apAccount, error: apError } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", companyId)
      .eq("account_number", "L-2000")
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (apError || !apAccount) {
      return {
        success: false,
        error: "Accounts Payable account (L-2000) not found",
      };
    }

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
        posting_date: data.paymentDate,
        reference_type: "purchase_receipt",
        reference_id: data.paymentId,
        reference_code: data.purchaseReceiptCode,
        description:
          data.description ||
          `Payment for purchase receipt ${data.purchaseReceiptCode} via ${data.paymentMethod}`,
        status: "posted", // Auto-post payment entries
        source_module: "AP",
        total_debit: data.paymentAmount,
        total_credit: data.paymentAmount,
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
        account_id: apAccount.id,
        debit: data.paymentAmount,
        credit: 0,
        description: `AP payment for Receipt ${data.purchaseReceiptCode}`,
        line_number: 1,
        created_by: userId,
      },
      {
        company_id: companyId,
        journal_entry_id: journalEntry.id,
        account_id: cashAccount.id,
        debit: 0,
        credit: data.paymentAmount,
        description: `Payment via ${data.paymentMethod} - Receipt ${data.purchaseReceiptCode}`,
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
      error: "Internal error posting AP payment",
    };
  }
}
