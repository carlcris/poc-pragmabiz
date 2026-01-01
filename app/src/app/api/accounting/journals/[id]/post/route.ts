/**
 * Journal Entry Posting API
 *
 * Endpoint:
 * - POST /api/accounting/journals/[id]/post - Post (finalize) a draft journal entry
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/accounting/journals/[id]/post
 * Post (finalize) a draft journal entry
 * Once posted, journal entries become immutable
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.JOURNAL_ENTRIES, 'edit');
    if (unauthorized) return unauthorized;

    const { id } = await context.params;
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

    // Get journal entry with lines
    const { data: journalEntry, error: fetchError } = await supabase
      .from("journal_entries")
      .select(
        `
        *,
        journal_lines (*)
      `
      )
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !journalEntry) {
      return NextResponse.json(
        { error: "Journal entry not found" },
        { status: 404 }
      );
    }

    // Check if already posted
    if (journalEntry.status === "posted") {
      return NextResponse.json(
        { error: "Journal entry is already posted" },
        { status: 400 }
      );
    }

    // Check if cancelled
    if (journalEntry.status === "cancelled") {
      return NextResponse.json(
        { error: "Cannot post a cancelled journal entry" },
        { status: 400 }
      );
    }

    // Verify journal is balanced
    const epsilon = 0.0001;
    if (
      Math.abs(journalEntry.total_debit - journalEntry.total_credit) > epsilon
    ) {
      return NextResponse.json(
        {
          error: "Journal entry is not balanced",
          details: {
            totalDebit: journalEntry.total_debit,
            totalCredit: journalEntry.total_credit,
          },
        },
        { status: 400 }
      );
    }

    // Verify has at least 2 lines
    if (!journalEntry.journal_lines || journalEntry.journal_lines.length < 2) {
      return NextResponse.json(
        { error: "Journal entry must have at least 2 lines" },
        { status: 400 }
      );
    }

    // Post the journal entry
    const { data: postedEntry, error: postError } = await supabase
      .from("journal_entries")
      .update({
        status: "posted",
        posted_at: new Date().toISOString(),
        posted_by: user.id,
        updated_by: user.id,
      })
      .eq("id", id)
      .eq("company_id", companyId)
      .select(
        `
        *,
        journal_lines (
          *,
          accounts (*)
        )
      `
      )
      .single();

    if (postError) {

      return NextResponse.json(
        { error: "Failed to post journal entry" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: postedEntry,
      message: "Journal entry posted successfully",
    });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
