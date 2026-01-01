import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';

// GET /api/commission/summary - Get commission summary statistics
export const GET = async (req: NextRequest) => {
  try {
    await requirePermission(RESOURCES.COMMISSIONS, 'view');

    const { supabase } = await createServerClientWithBU();

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const employeeId = searchParams.get("employeeId");

    // Build query for invoice employees (commission records)
    let query = supabase
      .from("invoice_employees")
      .select(`
        id,
        commission_amount,
        commission_split_percentage,
        created_at,
        invoice_id,
        employee_id,
        sales_invoices!inner(
          invoice_code,
          invoice_date,
          total_amount,
          status,
          customer_id
        ),
        employees!inner(
          employee_code,
          first_name,
          last_name,
          role,
          commission_rate
        )
      `);

    // Apply filters
    if (dateFrom) {
      query = query.gte("sales_invoices.invoice_date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("sales_invoices.invoice_date", dateTo);
    }
    if (employeeId) {
      query = query.eq("employee_id", employeeId);
    }

    const { data: commissions, error } = await query;

    if (error) {

      return NextResponse.json(
        { error: "Failed to fetch commission data", details: error.message },
        { status: 500 }
      );
    }

    // Calculate summary statistics
    const totalCommission = commissions?.reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;
    const totalSales = commissions?.reduce((sum, c) => sum + Number(c.sales_invoices.total_amount), 0) || 0;
    const transactionCount = commissions?.length || 0;

    // Group by status
    const paidCommission = commissions?.filter(c => c.sales_invoices.status === "paid")
      .reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;

    const pendingCommission = commissions?.filter(c => c.sales_invoices.status !== "paid")
      .reduce((sum, c) => sum + Number(c.commission_amount), 0) || 0;

    // Get unique employees count
    const uniqueEmployees = new Set(commissions?.map(c => c.employee_id)).size;

    // Calculate average commission per transaction
    const avgCommissionPerTransaction = transactionCount > 0 ? totalCommission / transactionCount : 0;

    // Calculate effective commission rate
    const effectiveRate = totalSales > 0 ? (totalCommission / totalSales) * 100 : 0;

    return NextResponse.json({
      summary: {
        totalCommission,
        totalSales,
        transactionCount,
        paidCommission,
        pendingCommission,
        uniqueEmployees,
        avgCommissionPerTransaction,
        effectiveRate,
      },
      commissions: commissions?.map(c => ({
        id: c.id,
        invoiceCode: c.sales_invoices.invoice_code,
        invoiceDate: c.sales_invoices.invoice_date,
        invoiceAmount: c.sales_invoices.total_amount,
        invoiceStatus: c.sales_invoices.status,
        employeeCode: c.employees.employee_code,
        employeeName: `${c.employees.first_name} ${c.employees.last_name}`,
        commissionRate: c.employees.commission_rate,
        commissionAmount: c.commission_amount,
        splitPercentage: c.commission_split_percentage,
        createdAt: c.created_at,
      })) || [],
    });
  } catch (error) {

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};
