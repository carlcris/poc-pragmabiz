import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';

// GET /api/analytics/sales/by-time - Time series data
export const GET = async (req: NextRequest) => {
  try {
    await requirePermission(RESOURCES.REPORTS, 'view');
    const { supabase } = await createServerClientWithBU();

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const employeeId = searchParams.get("employeeId");
    const granularity = searchParams.get("granularity") || "daily"; // "daily", "weekly", "monthly"

    // Build query for invoices
    let query = supabase
      .from("sales_invoices")
      .select("invoice_date, total_amount, commission_total")
      .is("deleted_at", null)
      .in("status", ["paid", "partially_paid", "sent", "overdue"]);

    // Apply date filters
    if (dateFrom) {
      query = query.gte("invoice_date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("invoice_date", dateTo);
    }

    // Apply employee filter
    if (employeeId) {
      query = query.eq("primary_employee_id", employeeId);
    }

    query = query.order("invoice_date", { ascending: true });

    const { data: invoices, error: invoicesError } = await query;

    if (invoicesError) {

      return NextResponse.json(
        { error: "Failed to fetch analytics data", details: invoicesError.message },
        { status: 500 }
      );
    }

    // Group by date based on granularity
    const groupByPeriod = (date: string): string => {
      const d = new Date(date);

      if (granularity === "monthly") {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      } else if (granularity === "weekly") {
        // Get week number
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        return `${d.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
      } else {
        // Daily
        return date;
      }
    };

    const timeStats = invoices?.reduce((acc: Record<string, { period: string; totalSales: number; totalCommission: number; count: number }>, inv: { invoice_date: string; total_amount: number; commission_total: number }) => {
      const period = groupByPeriod(inv.invoice_date);

      if (!acc[period]) {
        acc[period] = {
          period,
          totalSales: 0,
          totalCommission: 0,
          count: 0,
        };
      }

      acc[period].totalSales += Number(inv.total_amount);
      acc[period].totalCommission += Number(inv.commission_total);
      acc[period].count += 1;

      return acc;
    }, {}) || {};

    // Convert to array and calculate average
    const timeArray = Object.values(timeStats)
      .map((stat) => ({
        date: stat.period,
        period: stat.period,
        sales: stat.totalSales,
        totalSales: stat.totalSales,
        commission: stat.totalCommission,
        commissions: stat.totalCommission, // Alias for TypeScript compatibility
        totalCommission: stat.totalCommission,
        transactions: stat.count,
        transactionCount: stat.count,
        averageOrderValue: stat.count > 0 ? stat.totalSales / stat.count : 0,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return NextResponse.json({
      data: timeArray,
      granularity,
    });
  } catch {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};
