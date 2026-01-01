/**
 * Single Account API Routes
 *
 * Endpoints:
 * - GET    /api/accounting/accounts/[id] - Get single account
 * - PUT    /api/accounting/accounts/[id] - Update account
 * - DELETE /api/accounting/accounts/[id] - Soft delete account
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import type { UpdateAccountRequest } from "@/types/accounting";
import { requirePermission } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/accounting/accounts/[id]
 * Get a single account by ID
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.CHART_OF_ACCOUNTS, 'view');
    if (unauthorized) return unauthorized;

    const { id } = await context.params;
    const { supabase } = await createServerClientWithBU();

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

    // Get account
    const { data: account, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (error || !account) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: account });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/accounting/accounts/[id]
 * Update an account
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.CHART_OF_ACCOUNTS, 'edit');
    if (unauthorized) return unauthorized;

    const { id } = await context.params;
    const { supabase } = await createServerClientWithBU();

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

    // Get existing account
    const { data: existingAccount, error: fetchError } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingAccount) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Parse request body
    const body: UpdateAccountRequest = await request.json();

    // Build update object (only include provided fields)
    const updateData: Record<string, unknown> = {
      updated_by: user.id,
    };

    if (body.accountName !== undefined) {
      updateData.account_name = body.accountName;
    }

    if (body.accountType !== undefined) {
      updateData.account_type = body.accountType;
    }

    if (body.parentAccountId !== undefined) {
      // If changing parent, verify new parent exists
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

        // Check for circular reference (can't be parent of self)
        if (body.parentAccountId === id) {
          return NextResponse.json(
            { error: "Account cannot be its own parent" },
            { status: 400 }
          );
        }
      }

      updateData.parent_account_id = body.parentAccountId;
    }

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    if (body.isActive !== undefined) {
      updateData.is_active = body.isActive;
    }

    if (body.sortOrder !== undefined) {
      updateData.sort_order = body.sortOrder;
    }

    // Update account
    const { data: updatedAccount, error: updateError } = await supabase
      .from("accounts")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", companyId)
      .select()
      .single();

    if (updateError) {

      return NextResponse.json(
        { error: "Failed to update account" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: updatedAccount });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/accounting/accounts/[id]
 * Soft delete an account (only if not a system account and has no transactions)
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.CHART_OF_ACCOUNTS, 'delete');
    if (unauthorized) return unauthorized;

    const { id } = await context.params;
    const { supabase } = await createServerClientWithBU();

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

    // Get existing account
    const { data: existingAccount, error: fetchError } = await supabase
      .from("accounts")
      .select("*, is_system_account")
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingAccount) {
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Check if system account
    if (existingAccount.is_system_account) {
      return NextResponse.json(
        { error: "Cannot delete system account" },
        { status: 403 }
      );
    }

    // Check if account has posted journal entries
    const { data: journalLines, error: journalError } = await supabase
      .from("journal_lines")
      .select("id")
      .eq("account_id", id)
      .limit(1);

    if (journalError) {

      return NextResponse.json(
        { error: "Failed to verify account usage" },
        { status: 500 }
      );
    }

    if (journalLines && journalLines.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete account with posted transactions" },
        { status: 409 }
      );
    }

    // Soft delete the account
    const { error: deleteError } = await supabase
      .from("accounts")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
        is_active: false,
      })
      .eq("id", id)
      .eq("company_id", companyId);

    if (deleteError) {

      return NextResponse.json(
        { error: "Failed to delete account" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Account deleted successfully" },
      { status: 200 }
    );
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
