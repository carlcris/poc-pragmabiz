/**
 * Journal Entry API Routes
 *
 * Endpoints:
 * - GET  /api/accounting/journals - List journal entries with filters
 * - POST /api/accounting/journals - Create new journal entry (draft or posted)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import type {
  CreateJournalEntryRequest,
  JournalEntriesResponse,
  JournalEntryFilters,
  JournalEntryWithLines,
  Account,
} from "@/types/accounting";
import {
  validateJournalEntry,
  calculateJournalTotals,
} from "@/services/accounting/journalValidation";

// Helper function to transform database records to TypeScript types
function transformJournalEntry(entry: any): JournalEntryWithLines {
  return {
    id: entry.id,
    companyId: entry.company_id,
    journalCode: entry.journal_code,
    postingDate: entry.posting_date,
    referenceType: entry.reference_type,
    referenceId: entry.reference_id,
    referenceCode: entry.reference_code,
    description: entry.description,
    status: entry.status,
    sourceModule: entry.source_module,
    totalDebit: Number(entry.total_debit),
    totalCredit: Number(entry.total_credit),
    postedAt: entry.posted_at,
    postedBy: entry.posted_by,
    createdAt: entry.created_at,
    createdBy: entry.created_by,
    updatedAt: entry.updated_at,
    updatedBy: entry.updated_by,
    deletedAt: entry.deleted_at,
    version: entry.version,
    lines: (entry.journal_lines || []).map((line: any) => ({
      id: line.id,
      companyId: line.company_id,
      journalEntryId: line.journal_entry_id,
      accountId: line.account_id,
      debit: Number(line.debit),
      credit: Number(line.credit),
      description: line.description,
      lineNumber: line.line_number,
      costCenterId: line.cost_center_id,
      projectId: line.project_id,
      createdAt: line.created_at,
      createdBy: line.created_by,
      account: line.accounts ? {
        id: line.accounts.id,
        companyId: line.accounts.company_id,
        accountNumber: line.accounts.account_number,
        accountName: line.accounts.account_name,
        accountType: line.accounts.account_type,
        parentAccountId: line.accounts.parent_account_id,
        isSystemAccount: line.accounts.is_system_account,
        isActive: line.accounts.is_active,
        level: line.accounts.level,
        sortOrder: line.accounts.sort_order,
        description: line.accounts.description,
        createdAt: line.accounts.created_at,
        createdBy: line.accounts.created_by,
        updatedAt: line.accounts.updated_at,
        updatedBy: line.accounts.updated_by,
        deletedAt: line.accounts.deleted_at,
        version: line.accounts.version,
      } as Account : undefined,
    })),
  };
}

/**
 * GET /api/accounting/journals
 * List journal entries with optional filtering
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
    const filters: JournalEntryFilters = {
      search: searchParams.get("search") || undefined,
      status:
        (searchParams.get("status") as JournalEntryFilters["status"]) ||
        undefined,
      sourceModule:
        (searchParams.get(
          "sourceModule"
        ) as JournalEntryFilters["sourceModule"]) || undefined,
      referenceType:
        (searchParams.get(
          "referenceType"
        ) as JournalEntryFilters["referenceType"]) || undefined,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      accountId: searchParams.get("accountId") || undefined,
    };

    // Build query for journal entries
    let query = supabase
      .from("journal_entries")
      .select(
        `
        *,
        journal_lines (
          *,
          accounts (*)
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("posting_date", { ascending: false })
      .order("created_at", { ascending: false });

    // Apply filters
    if (filters.search) {
      query = query.or(
        `journal_code.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    if (filters.sourceModule && filters.sourceModule !== "all") {
      query = query.eq("source_module", filters.sourceModule);
    }

    if (filters.referenceType && filters.referenceType !== "all") {
      query = query.eq("reference_type", filters.referenceType);
    }

    if (filters.dateFrom) {
      query = query.gte("posting_date", filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte("posting_date", filters.dateTo);
    }

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching journal entries:", error);
      return NextResponse.json(
        { error: "Failed to fetch journal entries" },
        { status: 500 }
      );
    }

    // If accountId filter is provided, filter in memory (since it's on journal_lines)
    let filteredData = data || [];
    if (filters.accountId) {
      filteredData = filteredData.filter((entry) =>
        entry.journal_lines?.some(
          (line: { account_id: string }) => line.account_id === filters.accountId
        )
      );
    }

    // Transform database records to TypeScript types
    const transformedData: JournalEntryWithLines[] = filteredData.map(transformJournalEntry);

    const response: JournalEntriesResponse = {
      data: transformedData,
      pagination:
        count !== null
          ? {
              total: transformedData.length,
              page: 1,
              limit: transformedData.length,
              totalPages: 1,
            }
          : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in GET /api/accounting/journals:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/journals
 * Create a new journal entry (manual journal)
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase } = await createServerClientWithBU();

    // Get current user
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

    // Parse request body
    const body: CreateJournalEntryRequest = await request.json();

    // Validate journal entry
    const validation = validateJournalEntry(body.postingDate, body.lines);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // Calculate totals
    const totals = calculateJournalTotals(body.lines);

    // Resolve account IDs from account numbers if provided
    const resolvedLines = await Promise.all(
      body.lines.map(async (line, index) => {
        let accountId = line.accountId;

        // If account number is provided instead of ID, resolve it
        if (!accountId && line.accountNumber) {
          const { data: account, error: accountError } = await supabase
            .from("accounts")
            .select("id")
            .eq("company_id", companyId)
            .eq("account_number", line.accountNumber)
            .is("deleted_at", null)
            .single();

          if (accountError || !account) {
            throw new Error(
              `Account not found for account number: ${line.accountNumber} at line ${index + 1}`
            );
          }

          accountId = account.id;
        }

        // Verify account exists and belongs to company
        if (accountId) {
          const { data: account, error: accountError } = await supabase
            .from("accounts")
            .select("id, is_active")
            .eq("id", accountId)
            .eq("company_id", companyId)
            .is("deleted_at", null)
            .single();

          if (accountError || !account) {
            throw new Error(`Account not found: ${accountId} at line ${index + 1}`);
          }

          if (!account.is_active) {
            throw new Error(
              `Account is inactive: ${accountId} at line ${index + 1}`
            );
          }
        }

        return {
          ...line,
          accountId: accountId!,
        };
      })
    );

    // Get next journal code using the database function
    const { data: journalCodeResult, error: codeError } = await supabase.rpc(
      "get_next_journal_code",
      { p_company_id: companyId }
    );

    if (codeError || !journalCodeResult) {
      console.error("Error getting next journal code:", codeError);
      return NextResponse.json(
        { error: "Failed to generate journal code" },
        { status: 500 }
      );
    }

    const journalCode = journalCodeResult as string;

    // Start transaction: Create journal entry header
    const { data: journalEntry, error: journalError } = await supabase
      .from("journal_entries")
      .insert({
        company_id: companyId,
        journal_code: journalCode,
        posting_date: body.postingDate,
        reference_type: body.referenceType || null,
        reference_id: body.referenceId || null,
        reference_code: body.referenceCode || null,
        description: body.description || null,
        status: "draft",
        source_module: body.sourceModule || "Manual",
        total_debit: totals.totalDebit,
        total_credit: totals.totalCredit,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (journalError || !journalEntry) {
      console.error("Error creating journal entry:", journalError);
      return NextResponse.json(
        { error: "Failed to create journal entry" },
        { status: 500 }
      );
    }

    // Create journal lines
    const journalLinesData = resolvedLines.map((line, index) => ({
      company_id: companyId,
      journal_entry_id: journalEntry.id,
      account_id: line.accountId,
      debit: line.debit,
      credit: line.credit,
      description: line.description || null,
      line_number: index + 1,
      created_by: user.id,
    }));

    const { data: journalLines, error: linesError } = await supabase
      .from("journal_lines")
      .insert(journalLinesData)
      .select();

    if (linesError) {
      // Rollback: Delete the journal entry
      await supabase
        .from("journal_entries")
        .delete()
        .eq("id", journalEntry.id);

      console.error("Error creating journal lines:", linesError);
      return NextResponse.json(
        { error: "Failed to create journal lines" },
        { status: 500 }
      );
    }

    // Fetch complete journal entry with lines and accounts
    const { data: completeEntry, error: fetchError } = await supabase
      .from("journal_entries")
      .select(
        `
        *,
        journal_lines (
          *,
          accounts (*)
        )
      `
      )
      .eq("id", journalEntry.id)
      .single();

    if (fetchError) {
      console.error("Error fetching complete journal entry:", fetchError);
      return NextResponse.json(
        { error: "Journal created but failed to fetch complete data" },
        { status: 500 }
      );
    }

    // Transform database record to TypeScript type
    const transformedEntry = transformJournalEntry(completeEntry);

    return NextResponse.json({ data: transformedEntry }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/accounting/journals:", error);

    // Check if error is our custom account resolution error
    if (error instanceof Error && error.message.includes("Account not found")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
