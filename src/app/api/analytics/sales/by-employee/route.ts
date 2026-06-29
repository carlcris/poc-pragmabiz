import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { getUserCapabilities, hasCapability } from "@/services/permissions/permissionResolver";

// GET /api/analytics/sales/by-employee - Employee performance
const GETHandler = async (req: NextRequest) => {
  try {
    await requirePermission(RESOURCES.REPORTS, "view");
    const { supabase, userId, currentBusinessUnitId } = await createServerClientWithBU();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const capabilities = await getUserCapabilities(userId, currentBusinessUnitId ?? null);
    const canViewTotalSales = hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.SALES_ANALYTICS_TOTAL_SALES
    );
    const canViewCommissions = hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.SALES_ANALYTICS_COMMISSIONS
    );
    const canViewAverageOrderValue = hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.SALES_ANALYTICS_AVERAGE_ORDER_VALUE
    );

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const city = searchParams.get("city");
    const region = searchParams.get("region");
    const limit = parseInt(searchParams.get("limit") || "100");
    const page = parseInt(searchParams.get("page") || "1");

    // Build query for invoices with employee data
    let query = supabase
      .from("sales_invoices")
      .select("primary_employee_id, total_amount, commission_total, invoice_date")
      .is("deleted_at", null)
      .in("status", ["paid", "partially_paid", "sent", "overdue"])
      .not("primary_employee_id", "is", null);

    // Apply date filters
    if (dateFrom) {
      query = query.gte("invoice_date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("invoice_date", dateTo);
    }

    const { data: invoices, error: invoicesError } = await query;

    if (invoicesError) {
      console.error("Failed to fetch sales by employee analytics:", invoicesError);
      return NextResponse.json({ error: "Failed to fetch analytics data" }, { status: 500 });
    }

    // Aggregate by employee
    const employeeStats =
      invoices?.reduce(
        (
          acc: Record<
            string,
            { id: string; totalSales: number; totalCommission: number; count: number }
          >,
          inv: { primary_employee_id: string; total_amount: number; commission_total: number }
        ) => {
          const empId = inv.primary_employee_id;
          if (!acc[empId]) {
            acc[empId] = { id: empId, totalSales: 0, totalCommission: 0, count: 0 };
          }
          acc[empId].totalSales += Number(inv.total_amount);
          acc[empId].totalCommission += Number(inv.commission_total);
          acc[empId].count += 1;
          return acc;
        },
        {}
      ) || {};

    const employeeArray = Object.values(employeeStats);

    // Get employee details
    const employeeIds = employeeArray.map((emp: { id: string }) => emp.id);

    let employeeQuery = supabase
      .from("employees")
      .select("id, employee_code, first_name, last_name, role, commission_rate, city, region_state")
      .in("id", employeeIds)
      .is("deleted_at", null);

    // Apply location filters
    if (city) {
      employeeQuery = employeeQuery.eq("city", city);
    }
    if (region) {
      employeeQuery = employeeQuery.eq("region_state", region);
    }

    const { data: employeeDetails } = await employeeQuery;

    // Get territories for all employees
    const { data: territories } = await supabase
      .from("employee_distribution_locations")
      .select("employee_id, city, region_state")
      .in("employee_id", employeeIds)
      .is("deleted_at", null);

    // Group territories by employee
    const territoriesByEmployee =
      territories?.reduce(
        (
          acc: Record<string, string[]>,
          territory: { employee_id: string; city: string; region_state: string }
        ) => {
          const empId = territory.employee_id;
          if (!acc[empId]) {
            acc[empId] = [];
          }
          const territoryStr = territory.city
            ? `${territory.city}, ${territory.region_state}`
            : territory.region_state;
          if (!acc[empId].includes(territoryStr)) {
            acc[empId].push(territoryStr);
          }
          return acc;
        },
        {}
      ) || {};

    // Merge stats with employee details
    const employeePerformance = employeeArray
      .map((emp: { id: string; totalSales: number; totalCommission: number; count: number }) => {
        const employee = employeeDetails?.find((e: { id: string }) => e.id === emp.id);
        if (!employee) return null;

        return {
          employeeId: emp.id,
          employeeCode: employee.employee_code,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          role: employee.role,
          rawTotalSales: emp.totalSales,
          commissionRate: Number(employee.commission_rate),
          territories: territoriesByEmployee[emp.id] || [],
          totalSales: emp.totalSales,
          totalCommission: emp.totalCommission,
          transactionCount: emp.count,
          averageOrderValue: emp.count > 0 ? emp.totalSales / emp.count : 0,
        };
      })
      .filter((emp): emp is NonNullable<typeof emp> => emp !== null)
      .sort((a, b) => b.rawTotalSales - a.rawTotalSales);

    // Add rank
    const rankedEmployees = employeePerformance.map(({ rawTotalSales, ...emp }, index) => {
      void rawTotalSales;
      return {
        ...emp,
        commissionRate: canViewCommissions ? emp.commissionRate : null,
        totalSales: canViewTotalSales ? emp.totalSales : null,
        totalCommission: canViewCommissions ? emp.totalCommission : null,
        averageOrderValue: canViewAverageOrderValue ? emp.averageOrderValue : null,
        rank: index + 1,
      };
    });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit;
    const paginatedData = rankedEmployees.slice(from, to);

    return NextResponse.json({
      data: paginatedData,
      pagination: {
        page,
        limit,
        total: rankedEmployees.length,
        totalPages: Math.ceil(rankedEmployees.length / limit),
      },
      capabilities: {
        canViewTotalSales,
        canViewCommissions,
        canViewAverageOrderValue,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
};

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "sales",
  route: "/api/analytics/sales/by-employee",
});
