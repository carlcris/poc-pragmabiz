import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { logQuotationError } from "../quotations/_shared";

type FrameJobOrderRow = {
  id: string;
  job_order_code: string;
  quotation_id: string | null;
  sales_order_id: string | null;
  sales_invoice_id: string | null;
  customer_id: string;
  status: string;
  order_date: string;
  completed_at: string | null;
  created_at: string;
  customers?: { customer_name: string | null } | { customer_name: string | null }[] | null;
  sales_quotations?: { quotation_code: string | null } | { quotation_code: string | null }[] | null;
  sales_orders?: { order_code: string | null } | { order_code: string | null }[] | null;
  sales_invoices?: { invoice_code: string | null } | { invoice_code: string | null }[] | null;
};

type ManufacturingOrderRow = {
  id: string;
  frame_job_order_id: string;
  manufacturing_order_code: string;
  status: string;
  created_at: string;
};

type FrameJobOrderItemRow = {
  job_order_id: string;
  required_quantity: number | string;
  issued_quantity: number | string;
};

type SupabaseQueryClient = {
  from: (table: string) => {
    select: (
      columns: string,
      options?: { count?: "exact" }
    ) => {
      is: (column: string, value: null) => SupabaseQueryBuilder;
    };
  };
};

type SupabaseQueryBuilder = {
  eq: (column: string, value: string) => SupabaseQueryBuilder;
  is: (column: string, value: null) => SupabaseQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseQueryBuilder;
  range: (
    from: number,
    to: number
  ) => Promise<{ data: unknown[] | null; error: unknown; count: number | null }>;
  in: (
    column: string,
    values: string[]
  ) => SupabaseQueryBuilder &
    Promise<{ data: unknown[] | null; error: unknown; count: number | null }>;
};

const MAX_LIMIT = 50;

const parsePositiveInt = (raw: string | null, fallback: number) => {
  const parsed = Number.parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.SALES_QUOTATIONS, "view");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), 10), MAX_LIMIT);
    const status = searchParams.get("status")?.trim();
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const queryClient = supabase as unknown as SupabaseQueryClient;

    let query = queryClient
      .from("frame_job_orders")
      .select(
        `
        id,
        job_order_code,
        quotation_id,
        sales_order_id,
        sales_invoice_id,
        customer_id,
        status,
        order_date,
        completed_at,
        created_at,
        customers:customer_id(customer_name),
        sales_quotations:quotation_id(quotation_code),
        sales_orders:sales_order_id(order_code),
        sales_invoices:sales_invoice_id(invoice_code)
      `,
        { count: "exact" }
      )
      .is("deleted_at", null);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      logQuotationError("Error fetching job orders:", error);
      return NextResponse.json({ error: "Failed to load job orders" }, { status: 500 });
    }

    const rows = (data || []) as FrameJobOrderRow[];
    const jobOrderIds = rows.map((row) => row.id);
    const itemCounts = new Map<
      string,
      { componentCount: number; requiredQuantity: number; issuedQuantity: number }
    >();
    const manufacturingByJobOrderId = new Map<
      string,
      { id: string; manufacturingOrderCode: string; status: string }
    >();

    if (jobOrderIds.length > 0) {
      const { data: itemRows, error: itemsError } = await (queryClient
        .from("frame_job_order_items")
        .select("job_order_id, required_quantity, issued_quantity")
        .is("deleted_at", null)
        .in("job_order_id", jobOrderIds) as Promise<{
        data: unknown[] | null;
        error: unknown;
        count: number | null;
      }>);

      if (itemsError) {
        logQuotationError("Error fetching job order items:", itemsError);
        return NextResponse.json({ error: "Failed to load job orders" }, { status: 500 });
      }

      for (const item of (itemRows || []) as FrameJobOrderItemRow[]) {
        const current = itemCounts.get(item.job_order_id) || {
          componentCount: 0,
          requiredQuantity: 0,
          issuedQuantity: 0,
        };
        current.componentCount += 1;
        current.requiredQuantity += Number(item.required_quantity) || 0;
        current.issuedQuantity += Number(item.issued_quantity) || 0;
        itemCounts.set(item.job_order_id, current);
      }

      const { data: manufacturingRows, error: manufacturingError } = await (queryClient
        .from("manufacturing_orders")
        .select("id, frame_job_order_id, manufacturing_order_code, status, created_at")
        .is("deleted_at", null)
        .in("frame_job_order_id", jobOrderIds) as Promise<{
        data: unknown[] | null;
        error: unknown;
        count: number | null;
      }>);

      if (manufacturingError) {
        logQuotationError("Error fetching job order production links:", manufacturingError);
        return NextResponse.json({ error: "Failed to load job orders" }, { status: 500 });
      }

      for (const order of ((manufacturingRows || []) as ManufacturingOrderRow[]).sort((a, b) =>
        a.created_at < b.created_at ? 1 : -1
      )) {
        if (
          order.status === "cancelled" ||
          manufacturingByJobOrderId.has(order.frame_job_order_id)
        ) {
          continue;
        }

        manufacturingByJobOrderId.set(order.frame_job_order_id, {
          id: order.id,
          manufacturingOrderCode: order.manufacturing_order_code,
          status: order.status,
        });
      }
    }

    return NextResponse.json({
      data: rows.map((row) => {
        const customer = Array.isArray(row.customers) ? row.customers[0] : row.customers;
        const quotation = Array.isArray(row.sales_quotations)
          ? row.sales_quotations[0]
          : row.sales_quotations;
        const salesOrder = Array.isArray(row.sales_orders) ? row.sales_orders[0] : row.sales_orders;
        const invoice = Array.isArray(row.sales_invoices)
          ? row.sales_invoices[0]
          : row.sales_invoices;
        const counts = itemCounts.get(row.id) || {
          componentCount: 0,
          requiredQuantity: 0,
          issuedQuantity: 0,
        };

        return {
          id: row.id,
          jobOrderCode: row.job_order_code,
          quotationId: row.quotation_id,
          quotationCode: quotation?.quotation_code || "",
          salesOrderId: row.sales_order_id,
          salesOrderCode: salesOrder?.order_code || "",
          draftInvoiceId: row.sales_invoice_id,
          draftInvoiceCode: invoice?.invoice_code || "",
          customerId: row.customer_id,
          customerName: customer?.customer_name || "",
          status: row.status,
          orderDate: row.order_date,
          completedAt: row.completed_at,
          componentCount: counts.componentCount,
          requiredQuantity: counts.requiredQuantity,
          issuedQuantity: counts.issuedQuantity,
          createdAt: row.created_at,
          manufacturingOrder: manufacturingByJobOrderId.get(row.id) || null,
        };
      }),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    logQuotationError("Unexpected job order list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
