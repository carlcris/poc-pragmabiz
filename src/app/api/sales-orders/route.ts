import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import type { SalesOrder, SalesOrderLineItem, CreateSalesOrderRequest } from "@/types/sales-order";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type DbSalesOrder = {
  id: string;
  company_id: string;
  order_code: string;
  customer_id: string | null;
  quotation_id: string | null;
  order_date: string;
  expected_delivery_date: string | null;
  status: string;
  subtotal: number | string | null;
  discount_amount: number | string | null;
  tax_amount: number | string | null;
  total_amount: number | string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  payment_terms: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};
type DbSalesOrderItem = {
  id: string;
  order_id: string;
  item_id: string;
  item_description: string | null;
  quantity: number | string;
  uom_id: string | null;
  rate: number | string;
  discount_percent: number | string | null;
  tax_percent: number | string | null;
  line_total: number | string;
  quantity_shipped: number | string | null;
  quantity_delivered: number | string | null;
  sort_order: number | null;
  created_by: string | null;
  updated_by: string | null;
  deleted_at: string | null;
};
type DbCustomer = { id: string; customer_name: string; email: string | null };
type DbItem = { id: string; item_code: string; item_name: string };
type DbUser = { id: string; first_name: string | null; last_name: string | null };
type DbUoM = { id: string; code: string; name: string };
type DbSalesOrderItemWithRelations = DbSalesOrderItem & {
  items?: DbItem | DbItem[] | null;
  units_of_measure?: DbUoM | DbUoM[] | null;
};
type SalesOrderLineItemInput = Omit<
  SalesOrderLineItem,
  "id" | "lineTotal" | "quantityShipped" | "quantityDelivered"
>;
type CalculatedSalesOrderLineItem = SalesOrderLineItemInput & {
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  quantityShipped?: number;
  quantityDelivered?: number;
};

// Transform database sales order to frontend type
function transformDbSalesOrder(
  dbOrder: DbSalesOrder & {
    customers?: DbCustomer | DbCustomer[] | null;
    users?: DbUser | DbUser[] | null;
    sales_quotations?: { quotation_code: string } | { quotation_code: string }[] | null;
  },
  items?: SalesOrderLineItem[]
): SalesOrder {
  const customer = Array.isArray(dbOrder.customers) ? dbOrder.customers[0] ?? null : dbOrder.customers;
  const quotation = Array.isArray(dbOrder.sales_quotations)
    ? dbOrder.sales_quotations[0] ?? null
    : dbOrder.sales_quotations;

  return {
    id: dbOrder.id,
    companyId: dbOrder.company_id,
    orderNumber: dbOrder.order_code,
    customerId: dbOrder.customer_id || "",
    customerName: customer?.customer_name || "",
    customerEmail: customer?.email || "",
    quotationId: dbOrder.quotation_id || undefined,
    quotationNumber: quotation?.quotation_code || undefined,
    orderDate: dbOrder.order_date,
    expectedDeliveryDate: dbOrder.expected_delivery_date || "",
    status: dbOrder.status as SalesOrder["status"],
    lineItems: items || [],
    subtotal: Number(dbOrder.subtotal) || 0,
    totalDiscount: Number(dbOrder.discount_amount) || 0,
    totalTax: Number(dbOrder.tax_amount) || 0,
    totalAmount: Number(dbOrder.total_amount) || 0,
    shippingAddress: dbOrder.shipping_address || "",
    shippingCity: dbOrder.shipping_city || "",
    shippingState: dbOrder.shipping_state || "",
    shippingPostalCode: dbOrder.shipping_postal_code || "",
    shippingCountry: dbOrder.shipping_country || "",
    paymentTerms: dbOrder.payment_terms || "",
    notes: dbOrder.notes || "",
    createdBy: dbOrder.created_by || "",
    createdAt: dbOrder.created_at,
    updatedAt: dbOrder.updated_at || dbOrder.created_at,
  };
}

// Transform database sales order item to frontend type
function transformDbSalesOrderItem(dbItem: DbSalesOrderItemWithRelations): SalesOrderLineItem {
  const item = Array.isArray(dbItem.items) ? dbItem.items[0] ?? null : dbItem.items;

  return {
    id: dbItem.id,
    itemId: dbItem.item_id,
    itemCode: item?.item_code || "",
    itemName: item?.item_name || "",
    description: dbItem.item_description || "",
    quantity: Number(dbItem.quantity),
    uomId: dbItem.uom_id || "",
    unitPrice: Number(dbItem.rate),
    discount: Number(dbItem.discount_percent) || 0,
    taxRate: Number(dbItem.tax_percent) || 0,
    lineTotal: Number(dbItem.line_total),
    quantityShipped: Number(dbItem.quantity_shipped) || 0,
    quantityDelivered: Number(dbItem.quantity_delivered) || 0,
  };
}

// GET /api/sales-orders - List sales orders with filters
export async function GET(request: NextRequest) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, "view");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    // Build query for sales orders
    let query = supabase
      .from("sales_orders")
      .select(
        `
        *,
        customers:customer_id (
          id,
          customer_name,
          email
        ),
        users:created_by (
          id,
          first_name,
          last_name
        ),
        sales_quotations:quotation_id (
          quotation_code
        )
      `,
        { count: "exact" }
      )
      .is("deleted_at", null)
      .order("order_date", { ascending: false })
      .order("created_at", { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`order_code.ilike.%${search}%,notes.ilike.%${search}%`);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    if (dateFrom) {
      query = query.gte("order_date", dateFrom);
    }

    if (dateTo) {
      query = query.lte("order_date", dateTo);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: orders, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!orders) {
      return NextResponse.json({
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      });
    }

    // Fetch items for each order
    const orderIds = orders.map((o) => o.id);
    const { data: items, error: itemsError } = await supabase
      .from("sales_order_items")
      .select(
        `
        *,
        items (
          id,
          item_code,
          item_name
        ),
        units_of_measure (
          id,
          code,
          name
        )
      `
      )
      .in("order_id", orderIds)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (itemsError) {
    }

    // Group items by order
    const itemsByOrder =
      (items as DbSalesOrderItemWithRelations[] | null)?.reduce(
        (acc, item) => {
          if (!acc[item.order_id]) {
            acc[item.order_id] = [];
          }
          acc[item.order_id].push(transformDbSalesOrderItem(item));
          return acc;
        },
        {} as Record<string, SalesOrderLineItem[]>
      ) || {};

    // Transform to frontend format
    const transformedData = orders.map((order) =>
      transformDbSalesOrder(
        order as DbSalesOrder & {
          customers?: DbCustomer | DbCustomer[] | null;
          users?: DbUser | DbUser[] | null;
          sales_quotations?: { quotation_code: string } | { quotation_code: string }[] | null;
        },
        itemsByOrder[order.id] || []
      )
    );

    return NextResponse.json({
      data: transformedData,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/sales-orders - Create new sales order
export async function POST(request: NextRequest) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, "create");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const body = await request.json();
    const orderData: CreateSalesOrderRequest = body;

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Validate required fields
    if (
      !orderData.customerId ||
      !orderData.orderDate ||
      !orderData.lineItems ||
      orderData.lineItems.length === 0
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Auto-generate order number
    const { data: lastOrder } = await supabase
      .from("sales_orders")
      .select("order_code")
      .eq("company_id", userData.company_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let orderNumber = "SO-00001";
    if (lastOrder?.order_code) {
      const lastNumber = parseInt(lastOrder.order_code.split("-")[1] || "0");
      orderNumber = `SO-${String(lastNumber + 1).padStart(5, "0")}`;
    }

    // Calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    const itemsWithCalculations: CalculatedSalesOrderLineItem[] = orderData.lineItems.map(
      (item) => {
        const itemSubtotal = Number(item.quantity) * item.unitPrice;
        const discountAmount = (itemSubtotal * (item.discount || 0)) / 100;
        const taxableAmount = itemSubtotal - discountAmount;
        const taxAmount = (taxableAmount * (item.taxRate || 0)) / 100;
        const lineTotal = taxableAmount + taxAmount;

        subtotal += itemSubtotal;
        totalDiscount += discountAmount;
        totalTax += taxAmount;

        return {
          ...item,
          discountAmount,
          taxAmount,
          lineTotal,
        };
      }
    );

    const totalAmount = subtotal - totalDiscount + totalTax;

    // business_unit_id from JWT - set by auth hook
    // Create order header (status will default to 'draft' from database)
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        order_code: orderNumber,
        order_date: orderData.orderDate,
        customer_id: orderData.customerId,
        quotation_id: orderData.quotationId,
        expected_delivery_date: orderData.expectedDeliveryDate,
        subtotal: subtotal.toFixed(4),
        discount_amount: totalDiscount.toFixed(4),
        tax_amount: totalTax.toFixed(4),
        total_amount: totalAmount.toFixed(4),
        shipping_address: orderData.shippingAddress,
        shipping_city: orderData.shippingCity,
        shipping_state: orderData.shippingState,
        shipping_postal_code: orderData.shippingPostalCode,
        shipping_country: orderData.shippingCountry,
        payment_terms: orderData.paymentTerms,
        notes: orderData.notes,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: orderError?.message || "Failed to create sales order" },
        { status: 500 }
      );
    }

    // Create order items
    const itemsToInsert = itemsWithCalculations.map((item, index) => ({
      company_id: userData.company_id,
      order_id: order.id,
      item_id: item.itemId,
      item_description: item.description,
      quantity: item.quantity,
      uom_id: item.uomId,
      rate: item.unitPrice,
      discount_percent: item.discount || 0,
      discount_amount: item.discountAmount,
      tax_percent: item.taxRate || 0,
      tax_amount: item.taxAmount,
      line_total: item.lineTotal,
      sort_order: index,
      created_by: user.id,
      updated_by: user.id,
    }));

    const { error: itemsError } = await supabase.from("sales_order_items").insert(itemsToInsert);

    if (itemsError) {
      // Rollback: delete the order
      await supabase.from("sales_orders").delete().eq("id", order.id);
      return NextResponse.json(
        { error: itemsError.message || "Failed to create sales order items" },
        { status: 500 }
      );
    }

    // Fetch the complete order with joins
    const { data: completeOrder } = await supabase
      .from("sales_orders")
      .select(
        `
        *,
        customers:customer_id (
          id,
          customer_name,
          email
        ),
        users:created_by (
          id,
          first_name,
          last_name
        ),
        sales_quotations:quotation_id (
          quotation_code
        )
      `
      )
      .eq("id", order.id)
      .single();

    const { data: orderItems } = await supabase
      .from("sales_order_items")
      .select(
        `
        *,
        items (
          id,
          item_code,
          item_name
        ),
        units_of_measure (
          id,
          code,
          name
        )
      `
      )
      .eq("order_id", order.id)
      .order("sort_order", { ascending: true });

    const items =
      orderItems?.map((item) => transformDbSalesOrderItem(item as DbSalesOrderItemWithRelations)) ||
      [];
    const result = transformDbSalesOrder(
      completeOrder as DbSalesOrder & {
        customers?: DbCustomer | DbCustomer[] | null;
        users?: DbUser | DbUser[] | null;
        sales_quotations?: { quotation_code: string } | { quotation_code: string }[] | null;
      },
      items
    );

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
