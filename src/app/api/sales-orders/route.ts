import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import type { SalesOrder, SalesOrderLineItem, CreateSalesOrderRequest } from "@/types/sales-order";
import type { FrameQuotationComponent, FrameQuotationConfiguration } from "@/types/quotation";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

type SupabaseClient = Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"];
type DbSalesOrder = {
  id: string;
  company_id: string;
  order_code: string;
  customer_id: string | null;
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
  quotation_id: string | null;
  quotation_item_id: string | null;
  skip_inventory: boolean | null;
  item_description: string | null;
  quantity: number | string;
  uom_id: string | null;
  pricing_tier: string | null;
  pricing_tier_name: string | null;
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
  sales_quotations?: { quotation_code: string } | { quotation_code: string }[] | null;
};
type DbSalesOrderItemConfiguration = {
  id: string;
  order_item_id: string;
  width: number | string;
  height: number | string;
  fixed_allowance: number | string | null;
  molding_item_id: string | null;
  molding_stick_length: number | string | null;
  molding_sticks_required: number | string | null;
  service_fee_mode: string;
  service_type: string | null;
  service_fee_amount: number | string | null;
  total_service_fee: number | string | null;
  invoice_display_mode: string;
  items?: DbItem | DbItem[] | null;
};
type DbSalesOrderItemComponent = {
  id: string;
  order_item_id: string;
  component_type: string;
  source: string;
  item_id: string;
  description: string | null;
  qty_per_frame: number | string;
  total_quantity: number | string;
  uom_id: string;
  unit_rate: number | string;
  total_amount: number | string;
  rounding_mode: string | null;
  sort_order: number | null;
  items?: DbItem | DbItem[] | null;
  units_of_measure?: DbUoM | DbUoM[] | null;
};
type DbFrameJobOrderSummary = {
  id: string;
  sales_order_id: string;
  job_order_code: string;
  status: string;
};
type DbFrameJobOrderItemSummary = {
  job_order_id: string;
  sales_order_item_id: string | null;
};
type DbManufacturingOrderSummary = {
  id: string;
  frame_job_order_id: string | null;
  manufacturing_order_code: string;
  status: string;
};
type DbManufacturingOperationSummary = {
  id: string;
  manufacturing_order_id: string;
  operation_name: string;
  operation_type: string;
  status: string;
  sequence_no: number;
};
type DbSalesOrderFrameConfigSummary = {
  order_item_id: string;
};
type LineManufacturingContext = {
  eligibleItemIds: Set<string>;
  itemOrderById: Map<string, string>;
  frameJobOrderBySalesOrderId: Map<string, { id: string; jobOrderCode: string; status: string }>;
  frameJobOrderItemBySalesOrderItemId: Map<string, DbFrameJobOrderItemSummary>;
  manufacturingOrderByJobOrderId: Map<
    string,
    { id: string; manufacturingOrderCode: string; status: string }
  >;
  operationByManufacturingOrderId: Map<string, DbManufacturingOperationSummary>;
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

type QuotationLinkRow = {
  id: string;
  item_id: string;
  quotation_id: string;
  sales_quotations?:
    | { id: string; customer_id: string; status: string | null }
    | { id: string; customer_id: string; status: string | null }[]
    | null;
};

async function normalizeQuotationLinkedItems(
  supabase: SupabaseClient,
  customerId: string,
  items: CalculatedSalesOrderLineItem[]
): Promise<{ items: CalculatedSalesOrderLineItem[]; error?: string }> {
  const quotationItemIds = Array.from(
    new Set(items.map((item) => item.quotationItemId).filter((id): id is string => !!id))
  );

  if (quotationItemIds.length === 0) {
    return {
      items: items.map((item) => ({ ...item, quotationId: null, quotationItemId: null })),
    };
  }

  const { data, error } = await supabase
    .from("sales_quotation_items")
    .select(
      `
      id,
      item_id,
      quotation_id,
      sales_quotations:quotation_id (
        id,
        customer_id,
        status
      )
    `
    )
    .in("id", quotationItemIds)
    .is("deleted_at", null);

  if (error) {
    return { items, error: "Failed to validate quotation line items" };
  }

  const quotationLineById = new Map((data as QuotationLinkRow[]).map((row) => [row.id, row]));
  const normalizedItems: CalculatedSalesOrderLineItem[] = [];

  for (const item of items) {
    if (!item.quotationItemId || !item.quotationId) {
      normalizedItems.push({ ...item, quotationId: null, quotationItemId: null });
      continue;
    }

    const quotationLine = quotationLineById.get(item.quotationItemId);
    const quotation = Array.isArray(quotationLine?.sales_quotations)
      ? quotationLine?.sales_quotations[0]
      : quotationLine?.sales_quotations;

    if (
      !quotationLine ||
      quotationLine.quotation_id !== item.quotationId ||
      !quotation ||
      quotation.customer_id !== customerId ||
      !["accepted", "partially_ordered", "ordered"].includes(quotation.status || "")
    ) {
      return { items, error: "Selected quotation line is not available for this customer" };
    }

    normalizedItems.push(
      quotationLine.item_id === item.itemId
        ? item
        : { ...item, quotationId: null, quotationItemId: null }
    );
  }

  return { items: normalizedItems };
}

const asFrameServiceFeeMode = (value: string): FrameQuotationConfiguration["serviceFeeMode"] => {
  switch (value) {
    case "per_order":
    case "size_based":
    case "service_type":
    case "manual":
      return value;
    default:
      return "per_frame";
  }
};

const asFrameInvoiceDisplayMode = (
  value: string
): FrameQuotationConfiguration["invoiceDisplayMode"] => {
  return value === "components" || value === "both" ? value : "summary";
};

const asFrameComponentType = (value: string): FrameQuotationComponent["componentType"] => {
  return value === "molding" || value === "accessory" ? value : "material";
};

const asFrameComponentSource = (value: string): FrameQuotationComponent["source"] => {
  return value === "manual" ? "manual" : "auto";
};

// Transform database sales order to frontend type
function transformDbSalesOrder(
  dbOrder: DbSalesOrder & {
    customers?: DbCustomer | DbCustomer[] | null;
    users?: DbUser | DbUser[] | null;
  },
  items?: SalesOrderLineItem[]
): SalesOrder {
  const customer = Array.isArray(dbOrder.customers)
    ? (dbOrder.customers[0] ?? null)
    : dbOrder.customers;

  return {
    id: dbOrder.id,
    companyId: dbOrder.company_id,
    orderNumber: dbOrder.order_code,
    customerId: dbOrder.customer_id || "",
    customerName: customer?.customer_name || "",
    customerEmail: customer?.email || "",
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
function transformDbSalesOrderItem(
  dbItem: DbSalesOrderItemWithRelations,
  configuration?: DbSalesOrderItemConfiguration | null,
  components: DbSalesOrderItemComponent[] = []
): SalesOrderLineItem {
  const item = Array.isArray(dbItem.items) ? (dbItem.items[0] ?? null) : dbItem.items;
  const quotation = Array.isArray(dbItem.sales_quotations)
    ? (dbItem.sales_quotations[0] ?? null)
    : dbItem.sales_quotations;
  const moldingItem = Array.isArray(configuration?.items)
    ? (configuration?.items[0] ?? null)
    : configuration?.items;

  return {
    id: dbItem.id,
    itemId: dbItem.item_id,
    itemCode: item?.item_code || "",
    itemName: item?.item_name || "",
    quotationId: dbItem.quotation_id,
    quotationNumber: quotation?.quotation_code,
    quotationItemId: dbItem.quotation_item_id,
    description: dbItem.item_description || "",
    quantity: Number(dbItem.quantity),
    uomId: dbItem.uom_id || "",
    uomCode:
      (Array.isArray(dbItem.units_of_measure)
        ? dbItem.units_of_measure[0]?.code
        : dbItem.units_of_measure?.code) || "",
    pricingTier: dbItem.pricing_tier || undefined,
    pricingTierName: dbItem.pricing_tier_name || undefined,
    unitPrice: Number(dbItem.rate),
    discount: Number(dbItem.discount_percent) || 0,
    taxRate: Number(dbItem.tax_percent) || 0,
    lineTotal: Number(dbItem.line_total),
    skipInventory: dbItem.skip_inventory ?? false,
    quantityShipped: Number(dbItem.quantity_shipped) || 0,
    quantityDelivered: Number(dbItem.quantity_delivered) || 0,
    frameConfiguration: configuration
      ? {
          id: configuration.id,
          width: Number(configuration.width),
          height: Number(configuration.height),
          fixedAllowance: Number(configuration.fixed_allowance) || 0,
          moldingItemId: configuration.molding_item_id || undefined,
          moldingItemCode: moldingItem?.item_code || undefined,
          moldingItemName: moldingItem?.item_name || undefined,
          moldingStickLength: configuration.molding_stick_length
            ? Number(configuration.molding_stick_length)
            : undefined,
          moldingSticksRequired: configuration.molding_sticks_required
            ? Number(configuration.molding_sticks_required)
            : undefined,
          serviceFeeMode: asFrameServiceFeeMode(configuration.service_fee_mode),
          serviceType: configuration.service_type || undefined,
          serviceFeeAmount: Number(configuration.service_fee_amount) || 0,
          totalServiceFee: Number(configuration.total_service_fee) || 0,
          invoiceDisplayMode: asFrameInvoiceDisplayMode(configuration.invoice_display_mode),
        }
      : null,
    frameComponents: components.map((component) => {
      const componentItem = Array.isArray(component.items) ? component.items[0] : component.items;
      const uom = Array.isArray(component.units_of_measure)
        ? component.units_of_measure[0]
        : component.units_of_measure;
      return {
        id: component.id,
        componentType: asFrameComponentType(component.component_type),
        source: asFrameComponentSource(component.source),
        itemId: component.item_id,
        itemCode: componentItem?.item_code || undefined,
        itemName: componentItem?.item_name || undefined,
        description: component.description || "",
        qtyPerFrame: Number(component.qty_per_frame),
        totalQuantity: Number(component.total_quantity),
        uomId: component.uom_id,
        uomCode: uom?.code || undefined,
        unitRate: Number(component.unit_rate),
        totalAmount: Number(component.total_amount),
        roundingMode: component.rounding_mode === "ceil_per_order" ? "ceil_per_order" : "none",
        sortOrder: component.sort_order || 0,
      };
    }),
  };
}

function getLineManufacturingStatus(
  lineItemId: string,
  context: LineManufacturingContext
): SalesOrderLineItem["manufacturing"] {
  if (!context.eligibleItemIds.has(lineItemId)) return null;

  const orderId = context.itemOrderById.get(lineItemId);
  const jobOrder = orderId ? context.frameJobOrderBySalesOrderId.get(orderId) : null;

  if (!jobOrder) {
    return {
      required: true,
      status: "needs_job_order",
      label: "Needs Job Order",
    };
  }

  const jobOrderItem = context.frameJobOrderItemBySalesOrderItemId.get(lineItemId);
  const manufacturingOrder = context.manufacturingOrderByJobOrderId.get(
    jobOrderItem?.job_order_id || jobOrder.id
  );

  if (!manufacturingOrder) {
    return {
      required: true,
      status: "job_order_ready",
      label: "Job Order Ready",
      jobOrderId: jobOrder.id,
      jobOrderCode: jobOrder.jobOrderCode,
    };
  }

  const operation = context.operationByManufacturingOrderId.get(manufacturingOrder.id);
  const base = {
    required: true,
    jobOrderId: jobOrder.id,
    jobOrderCode: jobOrder.jobOrderCode,
    manufacturingOrderId: manufacturingOrder.id,
    manufacturingOrderCode: manufacturingOrder.manufacturingOrderCode,
    operationName: operation?.operation_name,
  };

  if (manufacturingOrder.status === "completed") {
    return { ...base, status: "ready_for_release", label: "Ready for Release" };
  }
  if (manufacturingOrder.status === "quality_check") {
    return {
      ...base,
      status: "quality_check",
      label: operation?.operation_name || "Quality Check",
    };
  }
  if (manufacturingOrder.status === "in_progress") {
    return { ...base, status: "in_progress", label: operation?.operation_name || "In Production" };
  }
  if (manufacturingOrder.status === "on_hold") {
    return { ...base, status: "on_hold", label: "On Hold" };
  }
  if (manufacturingOrder.status === "cancelled") {
    return { ...base, status: "cancelled", label: "Cancelled" };
  }

  return { ...base, status: "ready", label: "Ready for Production" };
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
        ),
        sales_quotations:quotation_id (
          quotation_code
        )
      `
      )
      .in("order_id", orderIds)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (itemsError) {
    }

    const orderItemIds = (items || []).map((item) => item.id);
    const { data: frameConfigurations } =
      orderItemIds.length > 0
        ? await supabase
            .from("sales_order_item_configurations")
            .select(
              `
              *,
              items:molding_item_id (
                id,
                item_code,
                item_name
              )
            `
            )
            .in("order_item_id", orderItemIds)
            .is("deleted_at", null)
        : { data: [] };
    const configurationsByItemId = new Map(
      ((frameConfigurations || []) as DbSalesOrderItemConfiguration[]).map((configuration) => [
        configuration.order_item_id,
        configuration,
      ])
    );
    const { data: frameComponents } =
      orderItemIds.length > 0
        ? await supabase
            .from("sales_order_item_components")
            .select(
              `
              *,
              items:item_id (
                id,
                item_code,
                item_name
              ),
              units_of_measure:uom_id (
                id,
                code,
                name
              )
            `
            )
            .in("order_item_id", orderItemIds)
            .is("deleted_at", null)
            .order("sort_order", { ascending: true })
        : { data: [] };
    const componentsByItemId = new Map<string, DbSalesOrderItemComponent[]>();
    for (const component of (frameComponents || []) as DbSalesOrderItemComponent[]) {
      const existing = componentsByItemId.get(component.order_item_id) || [];
      existing.push(component);
      componentsByItemId.set(component.order_item_id, existing);
    }

    const frameEligibleOrderIds = new Set<string>();
    const frameEligibleItemIds = new Set<string>();
    const itemOrderById = new Map((items || []).map((item) => [item.id, item.order_id]));
    for (const configuration of (frameConfigurations || []) as DbSalesOrderFrameConfigSummary[]) {
      const orderId = itemOrderById.get(configuration.order_item_id);
      if (orderId) frameEligibleOrderIds.add(orderId);
      frameEligibleItemIds.add(configuration.order_item_id);
    }

    const { data: frameJobOrders } = await supabase
      .from("frame_job_orders")
      .select("id, sales_order_id, job_order_code, status")
      .in("sales_order_id", orderIds)
      .neq("status", "cancelled")
      .is("deleted_at", null);

    const frameJobOrderBySalesOrderId = new Map(
      ((frameJobOrders || []) as DbFrameJobOrderSummary[]).map((jobOrder) => [
        jobOrder.sales_order_id,
        {
          id: jobOrder.id,
          jobOrderCode: jobOrder.job_order_code,
          status: jobOrder.status,
        },
      ])
    );

    const frameJobOrderIds = ((frameJobOrders || []) as DbFrameJobOrderSummary[]).map(
      (jobOrder) => jobOrder.id
    );
    const { data: frameJobOrderItems } =
      frameJobOrderIds.length > 0
        ? await supabase
            .from("frame_job_order_items")
            .select("job_order_id, sales_order_item_id")
            .in("job_order_id", frameJobOrderIds)
            .is("deleted_at", null)
        : { data: [] };

    const frameJobOrderItemBySalesOrderItemId = new Map(
      ((frameJobOrderItems || []) as DbFrameJobOrderItemSummary[])
        .filter((item) => item.sales_order_item_id)
        .map((item) => [item.sales_order_item_id as string, item])
    );

    const { data: manufacturingOrders } =
      frameJobOrderIds.length > 0
        ? await supabase
            .from("manufacturing_orders")
            .select("id, frame_job_order_id, manufacturing_order_code, status")
            .in("frame_job_order_id", frameJobOrderIds)
            .neq("status", "cancelled")
            .is("deleted_at", null)
        : { data: [] };

    const manufacturingOrderByJobOrderId = new Map(
      ((manufacturingOrders || []) as DbManufacturingOrderSummary[])
        .filter((order) => order.frame_job_order_id)
        .map((order) => [
          order.frame_job_order_id as string,
          {
            id: order.id,
            manufacturingOrderCode: order.manufacturing_order_code,
            status: order.status,
          },
        ])
    );

    const manufacturingOrderIds = (
      (manufacturingOrders || []) as DbManufacturingOrderSummary[]
    ).map((order) => order.id);
    const { data: manufacturingOperations } =
      manufacturingOrderIds.length > 0
        ? await supabase
            .from("manufacturing_operations")
            .select(
              "id, manufacturing_order_id, operation_name, operation_type, status, sequence_no"
            )
            .in("manufacturing_order_id", manufacturingOrderIds)
            .is("deleted_at", null)
            .order("sequence_no", { ascending: true })
        : { data: [] };

    const operationByManufacturingOrderId = new Map<string, DbManufacturingOperationSummary>();
    for (const operation of (manufacturingOperations || []) as DbManufacturingOperationSummary[]) {
      const current = operationByManufacturingOrderId.get(operation.manufacturing_order_id);
      if (!current || current.status !== "in_progress") {
        operationByManufacturingOrderId.set(operation.manufacturing_order_id, operation);
      }
      if (operation.status === "in_progress") {
        operationByManufacturingOrderId.set(operation.manufacturing_order_id, operation);
      }
    }

    const manufacturingContext: LineManufacturingContext = {
      eligibleItemIds: frameEligibleItemIds,
      itemOrderById,
      frameJobOrderBySalesOrderId,
      frameJobOrderItemBySalesOrderItemId,
      manufacturingOrderByJobOrderId,
      operationByManufacturingOrderId,
    };

    const itemsByOrder =
      (items as DbSalesOrderItemWithRelations[] | null)?.reduce(
        (acc, item) => {
          if (!acc[item.order_id]) {
            acc[item.order_id] = [];
          }
          const transformedItem = transformDbSalesOrderItem(
            item,
            configurationsByItemId.get(item.id) || null,
            componentsByItemId.get(item.id) || []
          );
          transformedItem.manufacturing = getLineManufacturingStatus(item.id, manufacturingContext);
          acc[item.order_id].push(transformedItem);
          return acc;
        },
        {} as Record<string, SalesOrderLineItem[]>
      ) || {};

    // Transform to frontend format
    const transformedData = orders.map((order) => ({
      ...transformDbSalesOrder(
        order as DbSalesOrder & {
          customers?: DbCustomer | DbCustomer[] | null;
          users?: DbUser | DbUser[] | null;
        },
        itemsByOrder[order.id] || []
      ),
      hasFrameJobEligibleItems: frameEligibleOrderIds.has(order.id),
      frameJobOrder: frameJobOrderBySalesOrderId.get(order.id) || null,
    }));

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

    // Calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    let itemsWithCalculations: CalculatedSalesOrderLineItem[] = orderData.lineItems.map(
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
    const normalized = await normalizeQuotationLinkedItems(
      supabase,
      orderData.customerId,
      itemsWithCalculations
    );
    if (normalized.error) {
      return NextResponse.json({ error: normalized.error }, { status: 400 });
    }
    itemsWithCalculations = normalized.items;

    const totalAmount = subtotal - totalDiscount + totalTax;

    // business_unit_id from JWT - set by auth hook
    // Create order header (status will default to 'draft' from database)
    const { data: order, error: orderError } = await supabase
      .from("sales_orders")
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        order_date: orderData.orderDate,
        customer_id: orderData.customerId,
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
      quotation_id: item.quotationId || null,
      quotation_item_id: item.quotationItemId || null,
      skip_inventory: item.skipInventory ?? !!item.frameConfiguration,
      item_description: item.description,
      quantity: item.quantity,
      uom_id: item.uomId,
      pricing_tier: item.pricingTier || null,
      pricing_tier_name: item.pricingTierName || null,
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

    const { data: insertedItems, error: itemsError } = await supabase
      .from("sales_order_items")
      .insert(itemsToInsert)
      .select("id, sort_order");

    if (itemsError || !insertedItems) {
      // Rollback: delete the order
      await supabase.from("sales_orders").delete().eq("id", order.id);
      return NextResponse.json(
        { error: itemsError.message || "Failed to create sales order items" },
        { status: 500 }
      );
    }

    const orderItemIdBySortOrder = new Map(
      insertedItems.map((item) => [item.sort_order || 0, item.id] as const)
    );
    const configurationRows = itemsWithCalculations.flatMap((item, index) =>
      item.frameConfiguration
        ? [
            {
              company_id: userData.company_id,
              order_item_id: orderItemIdBySortOrder.get(index),
              quotation_configuration_id: item.quotationItemId
                ? item.frameConfiguration.id || null
                : null,
              width: item.frameConfiguration.width,
              height: item.frameConfiguration.height,
              fixed_allowance: item.frameConfiguration.fixedAllowance || 0,
              molding_item_id: item.frameConfiguration.moldingItemId || null,
              molding_stick_length: item.frameConfiguration.moldingStickLength || null,
              molding_sticks_required: item.frameConfiguration.moldingSticksRequired || null,
              service_fee_mode: item.frameConfiguration.serviceFeeMode,
              service_type: item.frameConfiguration.serviceType || null,
              service_fee_amount: item.frameConfiguration.serviceFeeAmount || 0,
              total_service_fee: item.frameConfiguration.totalServiceFee || 0,
              invoice_display_mode: item.frameConfiguration.invoiceDisplayMode,
              created_by: user.id,
              updated_by: user.id,
            },
          ]
        : []
    );

    if (configurationRows.length > 0) {
      const { data: insertedConfigurations, error: configurationError } = await supabase
        .from("sales_order_item_configurations")
        .insert(configurationRows.filter((row) => row.order_item_id))
        .select("id, order_item_id");

      if (configurationError) {
        await supabase.from("sales_orders").delete().eq("id", order.id);
        return NextResponse.json(
          { error: "Failed to create sales order item configurations" },
          { status: 500 }
        );
      }

      const configurationIdByOrderItemId = new Map(
        (insertedConfigurations || []).map((row) => [row.order_item_id, row.id] as const)
      );
      const componentRows = itemsWithCalculations.flatMap((item, index) => {
        const orderItemId = orderItemIdBySortOrder.get(index);
        const configurationId = orderItemId ? configurationIdByOrderItemId.get(orderItemId) : null;
        if (!orderItemId || !configurationId || !item.frameComponents?.length) return [];
        return item.frameComponents.map((component, componentIndex) => ({
          company_id: userData.company_id,
          order_item_id: orderItemId,
          configuration_id: configurationId,
          quotation_component_id: item.quotationItemId ? component.id || null : null,
          component_type: component.componentType,
          source: component.source,
          item_id: component.itemId,
          description: component.description,
          qty_per_frame: component.qtyPerFrame,
          total_quantity: component.totalQuantity,
          uom_id: component.uomId,
          unit_rate: component.unitRate,
          total_amount: component.totalAmount,
          rounding_mode: component.roundingMode || "none",
          sort_order: component.sortOrder ?? componentIndex,
          created_by: user.id,
          updated_by: user.id,
        }));
      });

      if (componentRows.length > 0) {
        const { error: componentError } = await supabase
          .from("sales_order_item_components")
          .insert(componentRows);

        if (componentError) {
          await supabase.from("sales_orders").delete().eq("id", order.id);
          return NextResponse.json(
            { error: "Failed to create sales order item components" },
            { status: 500 }
          );
        }
      }
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
        ),
        sales_quotations:quotation_id (
          quotation_code
        )
      `
      )
      .eq("order_id", order.id)
      .order("sort_order", { ascending: true });

    const createdOrderItemIds = (orderItems || []).map((item) => item.id);
    const { data: createdConfigurations } =
      createdOrderItemIds.length > 0
        ? await supabase
            .from("sales_order_item_configurations")
            .select(
              `
              *,
              items:molding_item_id (
                id,
                item_code,
                item_name
              )
            `
            )
            .in("order_item_id", createdOrderItemIds)
            .is("deleted_at", null)
        : { data: [] };
    const createdConfigurationsByItemId = new Map(
      ((createdConfigurations || []) as DbSalesOrderItemConfiguration[]).map((configuration) => [
        configuration.order_item_id,
        configuration,
      ])
    );
    const { data: createdComponents } =
      createdOrderItemIds.length > 0
        ? await supabase
            .from("sales_order_item_components")
            .select(
              `
              *,
              items:item_id (
                id,
                item_code,
                item_name
              ),
              units_of_measure:uom_id (
                id,
                code,
                name
              )
            `
            )
            .in("order_item_id", createdOrderItemIds)
            .is("deleted_at", null)
            .order("sort_order", { ascending: true })
        : { data: [] };
    const createdComponentsByItemId = new Map<string, DbSalesOrderItemComponent[]>();
    for (const component of (createdComponents || []) as DbSalesOrderItemComponent[]) {
      const existing = createdComponentsByItemId.get(component.order_item_id) || [];
      existing.push(component);
      createdComponentsByItemId.set(component.order_item_id, existing);
    }

    const items =
      orderItems?.map((item) =>
        transformDbSalesOrderItem(
          item as DbSalesOrderItemWithRelations,
          createdConfigurationsByItemId.get(item.id) || null,
          createdComponentsByItemId.get(item.id) || []
        )
      ) || [];
    const result = transformDbSalesOrder(
      completeOrder as DbSalesOrder & {
        customers?: DbCustomer | DbCustomer[] | null;
        users?: DbUser | DbUser[] | null;
      },
      items
    );

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
