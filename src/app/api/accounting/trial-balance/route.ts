/**
 * Trial Balance API
 *
 * Endpoint:
 * - GET /api/accounting/trial-balance - Generate trial balance report
 *
 * Query params:
 * - asOfDate (required) - Date to run the trial balance as of (YYYY-MM-DD)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import type { TrialBalance, TrialBalanceRow, Account } from "@/types/accounting";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

/**
 * GET /api/accounting/trial-balance
 * Generate a trial balance report as of a specific date
 */
export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.GENERAL_LEDGER, "view");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();

    // Get current user's company
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: userData, error: companyError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (companyError || !userData?.company_id) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyId = userData.company_id;

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const asOfDate = searchParams.get("asOfDate");

    // Validate required parameters
    if (!asOfDate) {
      return NextResponse.json({ error: "asOfDate is required" }, { status: 400 });
    }

    // Get all active accounts
    const { data: accounts, error: accountsError } = await supabase
      .from("accounts")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (accountsError) {
      return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ error: "No accounts found" }, { status: 404 });
    }

    // Build trial balance rows
    const trialBalanceRows: TrialBalanceRow[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const accountData of accounts) {
      // Transform account data
      const account: Account = {
        id: accountData.id,
        companyId: accountData.company_id,
        accountNumber: accountData.account_number,
        accountName: accountData.account_name,
        accountType: accountData.account_type,
        parentAccountId: accountData.parent_account_id,
        isSystemAccount: accountData.is_system_account,
        isActive: accountData.is_active,
        level: accountData.level,
        sortOrder: accountData.sort_order,
        description: accountData.description,
        createdAt: accountData.created_at,
        createdBy: accountData.created_by,
        updatedAt: accountData.updated_at,
        updatedBy: accountData.updated_by,
        deletedAt: accountData.deleted_at,
        version: accountData.version,
      };

      // Get all posted journal lines for this account up to the asOfDate
      const { data: journalLines, error: linesError } = await supabase
        .from("journal_lines")
        .select(
          `
          debit,
          credit,
          journal_entries!inner (
            posting_date,
            status
          )
        `
        )
        .eq("account_id", account.id)
        .eq("company_id", companyId)
        .lte("journal_entries.posting_date", asOfDate)
        .eq("journal_entries.status", "posted")
        .is("journal_entries.deleted_at", null);

      if (linesError) {
        continue; // Skip this account if there's an error
      }

      // Calculate account balance
      let accountDebits = 0;
      let accountCredits = 0;

      if (journalLines && journalLines.length > 0) {
        accountDebits = journalLines.reduce((sum, line) => sum + Number(line.debit), 0);
        accountCredits = journalLines.reduce((sum, line) => sum + Number(line.credit), 0);
      }

      // Calculate balance based on account type
      let balance = 0;
      if (
        account.accountType === "asset" ||
        account.accountType === "expense" ||
        account.accountType === "cogs"
      ) {
        // Debit-normal accounts
        balance = accountDebits - accountCredits;
      } else {
        // Credit-normal accounts (liability, equity, revenue)
        balance = accountCredits - accountDebits;
      }

      // Only include accounts with activity (non-zero balance)
      if (balance !== 0) {
        // Determine debit/credit column placement
        // Assets, Expenses, COGS with positive balance go in Debit column
        // Liabilities, Equity, Revenue with positive balance go in Credit column
        let debitAmount = 0;
        let creditAmount = 0;

        if (
          account.accountType === "asset" ||
          account.accountType === "expense" ||
          account.accountType === "cogs"
        ) {
          // Debit-normal accounts
          if (balance > 0) {
            debitAmount = balance;
          } else {
            creditAmount = Math.abs(balance);
          }
        } else {
          // Credit-normal accounts
          if (balance > 0) {
            creditAmount = balance;
          } else {
            debitAmount = Math.abs(balance);
          }
        }

        trialBalanceRows.push({
          accountNumber: account.accountNumber,
          accountName: account.accountName,
          accountType: account.accountType,
          debit: debitAmount,
          credit: creditAmount,
          balance: balance,
        });

        totalDebits += debitAmount;
        totalCredits += creditAmount;
      }
    }

    // Sort by account number
    trialBalanceRows.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    // Check if balanced (debits should equal credits)
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01; // Allow for small rounding errors

    const trialBalance: TrialBalance = {
      asOfDate,
      accounts: trialBalanceRows,
      totalDebits,
      totalCredits,
      isBalanced,
    };

    return NextResponse.json({ data: trialBalance });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
