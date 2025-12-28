/**
 * General Ledger Query API
 *
 * Endpoint:
 * - GET /api/accounting/ledger - Query general ledger for account(s)
 *
 * Query params:
 * - accountId or accountNumber (required)
 * - dateFrom (required)
 * - dateTo (required)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import type { AccountLedger, LedgerEntry, Account } from "@/types/accounting";

/**
 * GET /api/accounting/ledger
 * Query general ledger entries for a specific account within a date range
 */
export async function GET(request: NextRequest) {
  try {
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
    const accountId = searchParams.get("accountId");
    const accountNumber = searchParams.get("accountNumber");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Validate required parameters
    if (!accountId && !accountNumber) {
      return NextResponse.json(
        { error: "accountId or accountNumber is required" },
        { status: 400 }
      );
    }

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: "dateFrom and dateTo are required" },
        { status: 400 }
      );
    }

    // Resolve account
    let account: Account | null = null;
    let accountData: any = null;

    if (accountId) {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", accountId)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }

      accountData = data;
    } else if (accountNumber) {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("account_number", accountNumber)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404 }
        );
      }

      accountData = data;
    }

    if (!accountData) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Transform account data to TypeScript type
    account = {
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

    // Calculate opening balance (all posted entries before dateFrom)
    const { data: openingLines, error: openingError } = await supabase
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
      .lt("journal_entries.posting_date", dateFrom)
      .eq("journal_entries.status", "posted")
      .is("journal_entries.deleted_at", null);

    if (openingError) {
      console.error("Error calculating opening balance:", openingError);
      return NextResponse.json(
        { error: "Failed to calculate opening balance" },
        { status: 500 }
      );
    }

    // Calculate opening balance based on account type
    let openingBalance = 0;
    if (openingLines && openingLines.length > 0) {
      const totalDebits = openingLines.reduce(
        (sum, line) => sum + Number(line.debit),
        0
      );
      const totalCredits = openingLines.reduce(
        (sum, line) => sum + Number(line.credit),
        0
      );

      // For debit-normal accounts (asset, expense, cogs): debit increases, credit decreases
      // For credit-normal accounts (liability, equity, revenue): credit increases, debit decreases
      if (
        account.accountType === "asset" ||
        account.accountType === "expense" ||
        account.accountType === "cogs"
      ) {
        openingBalance = totalDebits - totalCredits;
      } else {
        openingBalance = totalCredits - totalDebits;
      }
    }

    // Get ledger entries within date range
    const { data: journalLines, error: linesError } = await supabase
      .from("journal_lines")
      .select(
        `
        *,
        journal_entries!inner (
          id,
          journal_code,
          posting_date,
          description,
          reference_type,
          reference_code,
          source_module,
          status
        )
      `
      )
      .eq("account_id", account.id)
      .eq("company_id", companyId)
      .gte("journal_entries.posting_date", dateFrom)
      .lte("journal_entries.posting_date", dateTo)
      .eq("journal_entries.status", "posted")
      .is("journal_entries.deleted_at", null);

    if (linesError) {
      console.error("Error fetching ledger entries:", linesError);
      return NextResponse.json(
        { error: "Failed to fetch ledger entries" },
        { status: 500 }
      );
    }

    // Sort journal lines by posting date manually (since we can't use .order() with nested fields)
    const sortedJournalLines = (journalLines || []).sort((a, b) => {
      const dateA = new Date((a.journal_entries as any).posting_date).getTime();
      const dateB = new Date((b.journal_entries as any).posting_date).getTime();
      return dateA - dateB;
    });

    // Build ledger entries with running balance
    const entries: LedgerEntry[] = [];
    let runningBalance = openingBalance;
    let totalDebits = 0;
    let totalCredits = 0;

    if (sortedJournalLines) {
      for (const line of sortedJournalLines) {
        const je = line.journal_entries as unknown as {
          id: string;
          journal_code: string;
          posting_date: string;
          description: string | null;
          reference_type: string | null;
          reference_code: string | null;
          source_module: string;
        };

        const debit = Number(line.debit);
        const credit = Number(line.credit);

        // Update running balance
        if (
          account.accountType === "asset" ||
          account.accountType === "expense" ||
          account.accountType === "cogs"
        ) {
          // Debit-normal accounts
          runningBalance += debit - credit;
        } else {
          // Credit-normal accounts
          runningBalance += credit - debit;
        }

        totalDebits += debit;
        totalCredits += credit;

        entries.push({
          id: line.id,
          journalEntryId: je.id,
          journalCode: je.journal_code,
          postingDate: je.posting_date,
          accountId: account.id,
          accountNumber: account.account_number,
          accountName: account.account_name,
          debit,
          credit,
          balance: runningBalance,
          description: line.description || je.description,
          referenceType: je.reference_type as LedgerEntry["referenceType"],
          referenceCode: je.reference_code || null,
          sourceModule: je.source_module as LedgerEntry["sourceModule"],
        });
      }
    }

    const ledger: AccountLedger = {
      account,
      openingBalance,
      closingBalance: runningBalance,
      totalDebits,
      totalCredits,
      entries,
    };

    return NextResponse.json({ data: ledger });
  } catch (error) {
    console.error("Unexpected error in GET /api/accounting/ledger:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
