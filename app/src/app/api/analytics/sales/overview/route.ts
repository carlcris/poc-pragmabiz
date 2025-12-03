import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/analytics/sales/overview - Summary KPIs
export const GET = async (req: NextRequest) => {
  try {
    const supabase = await createClient();

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const employeeId = searchParams.get("employeeId");
    const city = searchParams.get("city");
    const region = searchParams.get("region");

    // Build base query for invoices
    let query = supabase
      .from("sales_invoices")
      .select("id, total_amount, commission_total, invoice_date, primary_employee_id")
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

    const { data: invoices, error: invoicesError } = await query;

    if (invoicesError) {
      console.error("Error fetching invoices:", invoicesError);
      return NextResponse.json(
        { error: "Failed to fetch analytics data", details: invoicesError.message },
        { status: 500 }
      );
    }

    // Calculate KPIs
    const totalSales = invoices?.reduce((sum: number, inv: { total_amount: number }) => sum + Number(inv.total_amount), 0) || 0;
    const totalCommission = invoices?.reduce((sum: number, inv: { commission_total: number }) => sum + Number(inv.commission_total), 0) || 0;
    const transactionCount = invoices?.length || 0;
    const averageOrderValue = transactionCount > 0 ? totalSales / transactionCount : 0;

    // Get active agents count
    const { count: activeAgents } = await supabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("role", "sales_agent")
      .eq("is_active", true)
      .is("deleted_at", null);

    // Get trend data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0];

    const { data: trendData, error: trendError } = await supabase
      .from("sales_invoices")
      .select("invoice_date, total_amount")
      .is("deleted_at", null)
      .in("status", ["paid", "partially_paid", "sent", "overdue"])
      .gte("invoice_date", thirtyDaysAgoStr)
      .order("invoice_date", { ascending: true });

    if (trendError) {
      console.error("Error fetching trend data:", trendError);
    }

    // Group by date
    const trendByDate = trendData?.reduce((acc: Record<string, number>, inv: { invoice_date: string; total_amount: number }) => {
      const date = inv.invoice_date;
      acc[date] = (acc[date] || 0) + Number(inv.total_amount);
      return acc;
    }, {}) || {};

    const trend = Object.entries(trendByDate).map(([date, sales]) => ({
      date,
      sales,
    }));

    // Get top 5 employees
    const { data: topEmployees, error: topEmpError } = await supabase
      .from("sales_invoices")
      .select("primary_employee_id, total_amount, commission_total")
      .is("deleted_at", null)
      .in("status", ["paid", "partially_paid", "sent", "overdue"])
      .not("primary_employee_id", "is", null);

    if (topEmpError) {
      console.error("Error fetching top employees:", topEmpError);
    }

    // Aggregate by employee
    const employeeStats = topEmployees?.reduce((acc: Record<string, { id: string; totalSales: number; totalCommission: number; count: number }>, inv: { primary_employee_id: string; total_amount: number; commission_total: number }) => {
      const empId = inv.primary_employee_id;
      if (!acc[empId]) {
        acc[empId] = { id: empId, totalSales: 0, totalCommission: 0, count: 0 };
      }
      acc[empId].totalSales += Number(inv.total_amount);
      acc[empId].totalCommission += Number(inv.commission_total);
      acc[empId].count += 1;
      return acc;
    }, {}) || {};

    const topEmployeesArray = Object.values(employeeStats)
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 5);

    // Get employee details
    const employeeIds = topEmployeesArray.map((emp: { id: string }) => emp.id);
    const { data: employeeDetails } = await supabase
      .from("employees")
      .select("id, first_name, last_name")
      .in("id", employeeIds);

    const topEmployeesWithNames = topEmployeesArray.map((emp: { id: string; totalSales: number; totalCommission: number; count: number }) => {
      const employee = employeeDetails?.find((e: { id: string }) => e.id === emp.id);
      return {
        employeeId: emp.id,
        employeeName: employee ? `${employee.first_name} ${employee.last_name}` : "Unknown",
        totalSales: emp.totalSales,
        totalCommission: emp.totalCommission,
        transactionCount: emp.count,
      };
    });

    return NextResponse.json({
      data: {
        totalSales,
        totalCommissions: totalCommission, // Use plural to match TypeScript interface
        totalCommission, // Keep for backward compatibility
        activeAgents: activeAgents || 0,
        averageOrderValue,
        transactionCount,
        trend,
        topEmployees: topEmployeesWithNames,
      },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};
