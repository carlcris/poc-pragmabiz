import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { getUserCapabilities, hasCapability } from "@/services/permissions/permissionResolver";

// GET /api/analytics/sales/by-location - Location breakdown
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
    const canViewAverageOrderValue = hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.SALES_ANALYTICS_AVERAGE_ORDER_VALUE
    );
    const canViewCommissions = hasCapability(
      capabilities,
      GRANULAR_CAPABILITIES.SALES_ANALYTICS_COMMISSIONS
    );

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const employeeId = searchParams.get("employeeId");
    const groupBy = searchParams.get("groupBy") || "city"; // "city" or "region"
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "100");

    // Build query for invoices with customer location
    let query = supabase
      .from("sales_invoices")
      .select(
        `
        id,
        total_amount,
        commission_total,
        customer_id,
        primary_employee_id,
        customers!inner(billing_city, billing_state)
      `
      )
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
      console.error("Failed to fetch sales by location analytics:", invoicesError);
      return NextResponse.json({ error: "Failed to fetch analytics data" }, { status: 500 });
    }

    type InvoiceRow = {
      total_amount: number | string;
      commission_total: number | string;
      customer_id: string | null;
      customers?:
        | {
            billing_city: string | null;
            billing_state: string | null;
          }
        | {
            billing_city: string | null;
            billing_state: string | null;
          }[]
        | null;
    };

    // Aggregate by location
    const locationStats = ((invoices as InvoiceRow[] | null) || []).reduce(
      (
        acc: Record<
          string,
          {
            city: string;
            regionState: string;
            totalSales: number;
            totalCommission: number;
            count: number;
            customers: Set<string>;
          }
        >,
        inv
      ) => {
        const customer = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers;
        if (!customer) return acc;

        const billingCity = customer.billing_city;
        const billingState = customer.billing_state;
        const location = groupBy === "region" ? billingState : billingCity;

        if (!location) return acc;

        if (!acc[location]) {
          acc[location] = {
            city: billingCity || location,
            regionState: billingState || location,
            totalSales: 0,
            totalCommission: 0,
            count: 0,
            customers: new Set(),
          };
        }

        acc[location].totalSales += Number(inv.total_amount);
        acc[location].totalCommission += Number(inv.commission_total);
        acc[location].count += 1;
        if (inv.customer_id) {
          acc[location].customers.add(inv.customer_id);
        }

        return acc;
      },
      {}
    );

    // Convert to array and sort
    const locationArray = Object.values(locationStats)
      .map((loc) => ({
        city: loc.city,
        regionState: loc.regionState,
        rawTotalSales: loc.totalSales,
        totalSales: canViewTotalSales ? loc.totalSales : null,
        totalCommission: canViewCommissions ? loc.totalCommission : null,
        transactionCount: loc.count,
        uniqueCustomers: loc.customers.size,
        averageOrderValue:
          canViewAverageOrderValue && loc.count > 0 ? loc.totalSales / loc.count : null,
      }))
      .sort((a, b) => b.rawTotalSales - a.rawTotalSales)
      .map(({ rawTotalSales, ...loc }) => {
        void rawTotalSales;
        return loc;
      });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit;
    const paginatedData = locationArray.slice(from, to);

    return NextResponse.json({
      data: paginatedData,
      pagination: {
        page,
        limit,
        total: locationArray.length,
        totalPages: Math.ceil(locationArray.length / limit),
      },
      groupBy,
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
  route: "/api/analytics/sales/by-location",
});
