import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';

// GET /api/analytics/sales/by-location - Location breakdown
export const GET = async (req: NextRequest) => {
  try {
    await requirePermission(RESOURCES.REPORTS, 'view');
    const { supabase } = await createServerClientWithBU();

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
      .select(`
        id,
        total_amount,
        commission_total,
        customer_id,
        primary_employee_id,
        customers!inner(billing_city, billing_state)
      `)
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

      return NextResponse.json(
        { error: "Failed to fetch analytics data", details: invoicesError.message },
        { status: 500 }
      );
    }

    type InvoiceRow = {
      total_amount: number | string;
      commission_total: number | string;
      customer_id: string | null;
      customers?: {
        billing_city: string | null;
        billing_state: string | null;
      } | null;
    };

    // Aggregate by location
    const locationStats = (invoices as InvoiceRow[] | null || []).reduce(
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
        const customer = inv.customers;
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
    }, {});

    // Convert to array and sort
    const locationArray = Object.values(locationStats)
      .map((loc) => ({
        city: loc.city,
        regionState: loc.regionState,
        totalSales: loc.totalSales,
        totalCommission: loc.totalCommission,
        transactionCount: loc.count,
        uniqueCustomers: loc.customers.size,
        averageOrderValue: loc.count > 0 ? loc.totalSales / loc.count : 0,
      }))
      .sort((a, b) => b.totalSales - a.totalSales);

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
    });
  } catch {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};
