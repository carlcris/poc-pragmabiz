/**
 * Accounts Receivable (AR) Posting Service
 *
 * Handles automatic GL posting for AR transactions:
 * - Invoice posting: DR Accounts Receivable, CR Revenue
 * - Payment posting: DR Cash/Bank, CR Accounts Receivable
 */

import { createClient } from "@/lib/supabase/server";
import type { CreateJournalLineRequest } from "@/types/accounting";

export type ARInvoicePostingData = {
  invoiceId: string;
  invoiceCode: string;
  customerId: string;
  invoiceDate: string;
  totalAmount: number;
  description?: string;
};

export type ARPaymentPostingData = {
  paymentId: string;
  invoiceId: string;
  invoiceCode: string;
  customerId: string;
  paymentDate: string;
  paymentAmount: number;
  paymentMethod: string;
  description?: string;
};

/**
 * Post AR Invoice to General Ledger
 * Journal Entry:
 *   DR Accounts Receivable (A-1100)
 *   CR Sales Revenue (R-4000)
 */
export async function postARInvoice(
  companyId: string,
  userId: string,
  data: ARInvoicePostingData
): Promise<{ success: boolean; journalEntryId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // Get Accounts Receivable account (A-1100)
    const { data: arAccount, error: arError } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", companyId)
      .eq("account_number", "A-1100")
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (arError || !arAccount) {
      return {
        success: false,
        error: "Accounts Receivable account (A-1100) not found",
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
        description: data.description || `Sales invoice ${data.invoiceCode}`,
        status: "posted", // Auto-post AR entries
        source_module: "AR",
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
        account_id: arAccount.id,
        debit: data.totalAmount,
        credit: 0,
        description: `AR from customer - Invoice ${data.invoiceCode}`,
        line_number: 1,
        created_by: userId,
      },
      {
        company_id: companyId,
        journal_entry_id: journalEntry.id,
        account_id: revenueAccount.id,
        debit: 0,
        credit: data.totalAmount,
        description: `Revenue from Invoice ${data.invoiceCode}`,
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

    return {
      success: false,
      error: "Internal error posting AR invoice",
    };
  }
}

/**
 * Post AR Payment to General Ledger
 * Journal Entry:
 *   DR Cash/Bank (A-1000)
 *   CR Accounts Receivable (A-1100)
 */
export async function postARPayment(
  companyId: string,
  userId: string,
  data: ARPaymentPostingData
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

    // Get Accounts Receivable account (A-1100)
    const { data: arAccount, error: arError } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", companyId)
      .eq("account_number", "A-1100")
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (arError || !arAccount) {
      return {
        success: false,
        error: "Accounts Receivable account (A-1100) not found",
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
        reference_type: "invoice_payment",
        reference_id: data.paymentId,
        reference_code: data.invoiceCode,
        description:
          data.description ||
          `Payment received for Invoice ${data.invoiceCode} via ${data.paymentMethod}`,
        status: "posted", // Auto-post payment entries
        source_module: "AR",
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
        account_id: cashAccount.id,
        debit: data.paymentAmount,
        credit: 0,
        description: `Payment received via ${data.paymentMethod} - Invoice ${data.invoiceCode}`,
        line_number: 1,
        created_by: userId,
      },
      {
        company_id: companyId,
        journal_entry_id: journalEntry.id,
        account_id: arAccount.id,
        debit: 0,
        credit: data.paymentAmount,
        description: `AR payment for Invoice ${data.invoiceCode}`,
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

    return {
      success: false,
      error: "Internal error posting AR payment",
    };
  }
}
