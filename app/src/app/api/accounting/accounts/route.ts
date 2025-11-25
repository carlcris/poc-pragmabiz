/**
 * Chart of Accounts API Routes
 *
 * Endpoints:
 * - GET  /api/accounting/accounts - List all accounts with optional filters
 * - POST /api/accounting/accounts - Create new account
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  Account,
  CreateAccountRequest,
  AccountFilters,
  AccountsResponse
} from "@/types/accounting";

/**
 * GET /api/accounting/accounts
 * List all accounts with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user's company
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's company
    const { data: userData, error: companyError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (companyError || !userData?.company_id) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    const companyId = userData.company_id;

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const filters: AccountFilters = {
      search: searchParams.get("search") || undefined,
      accountType: (searchParams.get("accountType") as AccountFilters["accountType"]) || undefined,
      isActive: searchParams.get("isActive") ? searchParams.get("isActive") === "true" : undefined,
      isSystemAccount: searchParams.get("isSystemAccount") ? searchParams.get("isSystemAccount") === "true" : undefined,
    };

    // Build query
    let query = supabase
      .from("accounts")
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("account_number", { ascending: true });

    // Apply filters
    if (filters.search) {
      query = query.or(
        `account_number.ilike.%${filters.search}%,account_name.ilike.%${filters.search}%`
      );
    }

    if (filters.accountType && filters.accountType !== "all") {
      query = query.eq("account_type", filters.accountType);
    }

    if (filters.isActive !== undefined) {
      query = query.eq("is_active", filters.isActive);
    }

    if (filters.isSystemAccount !== undefined) {
      query = query.eq("is_system_account", filters.isSystemAccount);
    }

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching accounts:", error);
      return NextResponse.json(
        { error: "Failed to fetch accounts" },
        { status: 500 }
      );
    }

    // Transform database snake_case to camelCase
    const transformedData: Account[] = (data || []).map((account: any) => ({
      id: account.id,
      companyId: account.company_id,
      accountNumber: account.account_number,
      accountName: account.account_name,
      accountType: account.account_type,
      parentAccountId: account.parent_account_id,
      isSystemAccount: account.is_system_account,
      isActive: account.is_active,
      level: account.level,
      sortOrder: account.sort_order,
      description: account.description,
      createdAt: account.created_at,
      createdBy: account.created_by,
      updatedAt: account.updated_at,
      updatedBy: account.updated_by,
      deletedAt: account.deleted_at,
      version: account.version,
    }));

    const response: AccountsResponse = {
      data: transformedData,
      pagination: count !== null ? {
        total: count,
        page: 1,
        limit: count,
        totalPages: 1,
      } : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in GET /api/accounting/accounts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounting/accounts
 * Create a new account
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's company
    const { data: userData, error: companyError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (companyError || !userData?.company_id) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    const companyId = userData.company_id;

    // Parse request body
    const body: CreateAccountRequest = await request.json();

    // Validate required fields
    if (!body.accountNumber || !body.accountName || !body.accountType) {
      return NextResponse.json(
        { error: "Missing required fields: accountNumber, accountName, accountType" },
        { status: 400 }
      );
    }

    // Check if account number already exists
    const { data: existingAccount } = await supabase
      .from("accounts")
      .select("id")
      .eq("company_id", companyId)
      .eq("account_number", body.accountNumber)
      .is("deleted_at", null)
      .single();

    if (existingAccount) {
      return NextResponse.json(
        { error: "Account number already exists" },
        { status: 409 }
      );
    }

    // If parent account is provided, verify it exists
    if (body.parentAccountId) {
      const { data: parentAccount, error: parentError } = await supabase
        .from("accounts")
        .select("id, level")
        .eq("id", body.parentAccountId)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .single();

      if (parentError || !parentAccount) {
        return NextResponse.json(
          { error: "Parent account not found" },
          { status: 404 }
        );
      }

      // Set level based on parent
      if (!body.level) {
        body.level = parentAccount.level + 1;
      }
    }

    // Insert new account
    const { data: newAccount, error: insertError } = await supabase
      .from("accounts")
      .insert({
        company_id: companyId,
        account_number: body.accountNumber,
        account_name: body.accountName,
        account_type: body.accountType,
        parent_account_id: body.parentAccountId || null,
        description: body.description || null,
        level: body.level || 1,
        sort_order: body.sortOrder || 0,
        is_system_account: false,
        is_active: true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating account:", insertError);
      return NextResponse.json(
        { error: "Failed to create account" },
        { status: 500 }
      );
    }

    // Transform database snake_case to camelCase
    const transformedAccount: Account = {
      id: newAccount.id,
      companyId: newAccount.company_id,
      accountNumber: newAccount.account_number,
      accountName: newAccount.account_name,
      accountType: newAccount.account_type,
      parentAccountId: newAccount.parent_account_id,
      isSystemAccount: newAccount.is_system_account,
      isActive: newAccount.is_active,
      level: newAccount.level,
      sortOrder: newAccount.sort_order,
      description: newAccount.description,
      createdAt: newAccount.created_at,
      createdBy: newAccount.created_by,
      updatedAt: newAccount.updated_at,
      updatedBy: newAccount.updated_by,
      deletedAt: newAccount.deleted_at,
      version: newAccount.version,
    };

    return NextResponse.json(
      { data: transformedAccount },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in POST /api/accounting/accounts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
