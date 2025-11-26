/**
 * Dashboard Widgets API
 *
 * Endpoint:
 * - GET /api/analytics/dashboard/widgets - Get dashboard widget data
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DashboardWidgetData } from "@/types/analytics";

/**
 * GET /api/analytics/dashboard/widgets
 * Get dashboard widget data including today's sales, top agent, and recent activity
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get current user and company
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userData, error: companyError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (companyError || !userData?.company_id) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const companyId = userData.company_id;
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // Get today's sales from POS transactions
    const { data: todayTransactions } = await supabase
      .from("pos_transactions")
      .select("total_amount, created_at")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${today}T23:59:59`);

    // Get yesterday's sales for growth calculation
    const { data: yesterdayTransactions } = await supabase
      .from("pos_transactions")
      .select("total_amount")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("created_at", `${yesterday}T00:00:00`)
      .lt("created_at", `${yesterday}T23:59:59`);

    const todayAmount = todayTransactions?.reduce((sum, t) => sum + Number(t.total_amount), 0) || 0;
    const yesterdayAmount = yesterdayTransactions?.reduce((sum, t) => sum + Number(t.total_amount), 0) || 0;
    const growth = yesterdayAmount > 0 ? ((todayAmount - yesterdayAmount) / yesterdayAmount) * 100 : 0;

    // Get top agent (user with most sales today)
    const { data: topAgentData } = await supabase
      .from("pos_transactions")
      .select(`
        created_by,
        total_amount,
        users!inner (
          id,
          first_name,
          last_name
        )
      `)
      .eq("company_id", companyId)
      .eq("status", "completed")
      .gte("created_at", `${today}T00:00:00`)
      .lt("created_at", `${today}T23:59:59`)
      .order("total_amount", { ascending: false })
      .limit(1);

    const topAgent = topAgentData && topAgentData.length > 0 ? {
      employeeId: topAgentData[0].created_by,
      name: `${(topAgentData[0].users as any).first_name} ${(topAgentData[0].users as any).last_name}`,
      sales: Number(topAgentData[0].total_amount),
      transactions: 1,
    } : {
      employeeId: "",
      name: "No sales yet",
      sales: 0,
      transactions: 0,
    };

    // Get recent activity (last 5 transactions)
    const { data: recentTransactions, error: recentError } = await supabase
      .from("pos_transactions")
      .select(`
        id,
        transaction_code,
        total_amount,
        created_at,
        customers (
          customer_name
        ),
        users!pos_transactions_created_by_fkey (
          first_name,
          last_name
        )
      `)
      .eq("company_id", companyId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(5);

    const recentActivity = recentTransactions?.map((t) => ({
      id: t.id,
      time: new Date(t.created_at).toLocaleTimeString(),
      customer: t.customers ? (t.customers as any).customer_name : "Walk-in Customer",
      amount: Number(t.total_amount),
      agent: t.users ? `${(t.users as any).first_name} ${(t.users as any).last_name}` : "Unknown",
      location: "POS", // Could be enhanced with actual location data
    })) || [];

    const widgetData: DashboardWidgetData = {
      todaysSales: {
        amount: todayAmount,
        growth: growth,
        transactions: todayTransactions?.length || 0,
      },
      topAgent,
      recentActivity,
    };

    return NextResponse.json(widgetData);
  } catch (error) {
    console.error("Unexpected error in GET /api/analytics/dashboard/widgets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
