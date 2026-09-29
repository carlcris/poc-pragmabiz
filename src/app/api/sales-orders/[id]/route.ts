import {
  getLineManufacturingStatus,
  type LineManufacturingContext,
} from "@/lib/sales-orders/line-manufacturing-status";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import type { SalesOrder, SalesOrderLineItem } from "@/types/sales-order";
import { salesOrderMutationSchema } from "@/lib/validations/sales-order";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  getSalesOrderMutationFailure,
  loadSalesOrderFrameDetails,
  transformSalesOrderFrameDetails,
  transformSalesOrderQuotationPricing,
  type DbQuotationPricing,
  type DbSalesOrderItemComponent,
  type DbSalesOrderItemConfiguration,
  type DbSalesOrderItemMatLayer,
} from "../frame-details";

type DbSalesOrder = {
  id: string;
  company_id: string;
  order_code: string;
  customer_id: string | null;
  order_date: string;
  expected_delivery_date: string | null;
  status: string;
  fulfilling_warehouse_id: string | null;
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
  discount_amount: number | string | null;
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
type DbWarehouse = { id: string; warehouse_code: string; warehouse_name: string };
type DbSalesOrderItemWithRelations = DbSalesOrderItem & {
  source_pricing?: DbQuotationPricing | DbQuotationPricing[] | null;
  items?: DbItem | DbItem[] | null;
  units_of_measure?: DbUoM | DbUoM[] | null;
  sales_quotations?: { quotation_code: string } | { quotation_code: string }[] | null;
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

const SALES_ORDER_SELECT = `
  id,
  company_id,
  order_code,
  customer_id,
  order_date,
  expected_delivery_date,
  status,
  fulfilling_warehouse_id,
  subtotal,
  discount_amount,
  tax_amount,
  total_amount,
  shipping_address,
  shipping_city,
  shipping_state,
  shipping_postal_code,
  shipping_country,
  payment_terms,
  notes,
  created_by,
  created_at,
  updated_at,
  deleted_at,
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
  fulfilling_warehouse:warehouses!sales_orders_fulfilling_warehouse_id_fkey (
    id,
    warehouse_code,
    warehouse_name
  )
` as const;

const SALES_ORDER_ITEM_SELECT = `
  source_pricing:quotation_item_id (quantity, discount_amount, tax_amount, line_total),
  id,
  order_id,
  item_id,
  quotation_id,
  quotation_item_id,
  skip_inventory,
  item_description,
  quantity,
  uom_id,
  pricing_tier,
  pricing_tier_name,
  rate,
  discount_percent,
  discount_amount,
  tax_percent,
  line_total,
  quantity_shipped,
  quantity_delivered,
  sort_order,
  created_by,
  updated_by,
  deleted_at,
  items:item_id (
    id,
    item_code,
    item_name
  ),
  units_of_measure:uom_id (
    id,
    code,
    name
  ),
  sales_quotations:quotation_id (
    quotation_code
  )
` as const;

// Transform database sales order to frontend type
function transformDbSalesOrder(
  dbOrder: DbSalesOrder & {
    customers?: DbCustomer | DbCustomer[] | null;
    users?: DbUser | DbUser[] | null;
    fulfilling_warehouse?: DbWarehouse | DbWarehouse[] | null;
  },
  items?: SalesOrderLineItem[]
): SalesOrder {
  const customer = Array.isArray(dbOrder.customers)
    ? (dbOrder.customers[0] ?? null)
    : dbOrder.customers;
  const fulfillingWarehouse = Array.isArray(dbOrder.fulfilling_warehouse)
    ? (dbOrder.fulfilling_warehouse[0] ?? null)
    : dbOrder.fulfilling_warehouse;
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
    fulfillingWarehouseId: dbOrder.fulfilling_warehouse_id,
    fulfillingWarehouseCode: fulfillingWarehouse?.warehouse_code ?? null,
    fulfillingWarehouseName: fulfillingWarehouse?.warehouse_name ?? null,
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
  configurations: DbSalesOrderItemConfiguration[] = [],
  components: DbSalesOrderItemComponent[] = [],
  matLayersByConfigurationId: Map<string, DbSalesOrderItemMatLayer[]> = new Map()
): SalesOrderLineItem {
  const item = Array.isArray(dbItem.items) ? (dbItem.items[0] ?? null) : dbItem.items;
  const quotation = Array.isArray(dbItem.sales_quotations)
    ? (dbItem.sales_quotations[0] ?? null)
    : dbItem.sales_quotations;
  const frameDetails = transformSalesOrderFrameDetails(
    configurations,
    components,
    matLayersByConfigurationId
  );

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
    discountAmount: Number(dbItem.discount_amount) || 0,
    quotationPricing: transformSalesOrderQuotationPricing(
      dbItem.source_pricing,
      configurations,
      components
    ),
    taxRate: Number(dbItem.tax_percent) || 0,
    lineTotal: Number(dbItem.line_total),
    skipInventory: dbItem.skip_inventory ?? false,
    quantityShipped: Number(dbItem.quantity_shipped) || 0,
    quantityDelivered: Number(dbItem.quantity_delivered) || 0,
    ...frameDetails,
  };
}

// GET /api/sales-orders/[id] - Get single sales order by ID
async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

    // Fetch sales order with customer info
    const { data: order, error } = await supabase
      .from("sales_orders")
      .select(SALES_ORDER_SELECT)
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from("sales_order_items")
      .select(SALES_ORDER_ITEM_SELECT)
      .eq("order_id", id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (itemsError) {
      console.error("Failed to load sales order items", {
        salesOrderId: id,
        code: itemsError.code,
        message: itemsError.message,
      });
      return NextResponse.json({ error: "Failed to load sales order items" }, { status: 500 });
    }

    const orderItemIds = (items || []).map((item) => item.id);
    const frameDetails = await loadSalesOrderFrameDetails(supabase, orderItemIds);
    if (frameDetails.error) {
      console.error("Failed to load sales order frame details", frameDetails.error);
      return NextResponse.json(
        { error: "Failed to load sales order frame details" },
        { status: 500 }
      );
    }
    const { configurationsByItemId, componentsByItemId, matLayersByConfigurationId } = frameDetails;
    const frameEligibleItemIds = new Set(configurationsByItemId.keys());

    const { data: frameJobOrders } = await supabase
      .from("frame_job_orders")
      .select("id, sales_order_id, job_order_code, status")
      .eq("sales_order_id", id)
      .neq("status", "cancelled")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    const frameJobOrderRow = ((frameJobOrders || []) as DbFrameJobOrderSummary[])[0] || null;
    const frameJobOrder = frameJobOrderRow
      ? {
          id: frameJobOrderRow.id,
          jobOrderCode: frameJobOrderRow.job_order_code,
          status: frameJobOrderRow.status,
        }
      : null;
    const frameJobOrderById = new Map(
      ((frameJobOrders || []) as DbFrameJobOrderSummary[]).map((job) => [
        job.id,
        { id: job.id, jobOrderCode: job.job_order_code, status: job.status },
      ])
    );
    const frameJobOrderIds = [...frameJobOrderById.keys()];

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
        .filter((manufacturingOrder) => manufacturingOrder.frame_job_order_id)
        .map((manufacturingOrder) => [
          manufacturingOrder.frame_job_order_id as string,
          {
            id: manufacturingOrder.id,
            manufacturingOrderCode: manufacturingOrder.manufacturing_order_code,
            status: manufacturingOrder.status,
          },
        ])
    );

    const manufacturingOrderIds = (
      (manufacturingOrders || []) as DbManufacturingOrderSummary[]
    ).map((manufacturingOrder) => manufacturingOrder.id);
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
      frameJobOrderById,
      frameJobOrderItemBySalesOrderItemId,
      manufacturingOrderByJobOrderId,
      operationByManufacturingOrderId,
    };

    const transformedItems =
      items?.map((item) => {
        const transformedItem = transformDbSalesOrderItem(
          item as DbSalesOrderItemWithRelations,
          configurationsByItemId.get(item.id) || [],
          componentsByItemId.get(item.id) || [],
          matLayersByConfigurationId
        );
        transformedItem.manufacturing = getLineManufacturingStatus(item.id, manufacturingContext);
        return transformedItem;
      }) || [];
    const result = transformDbSalesOrder(
      order as DbSalesOrder & {
        customers?: DbCustomer | DbCustomer[] | null;
        users?: DbUser | DbUser[] | null;
      },
      transformedItems
    );
    result.hasFrameJobEligibleItems = frameEligibleItemIds.size > 0;
    result.frameJobOrder = frameJobOrder;

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/sales-orders/[id] - Update sales order
async function PUTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, "edit");
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

    const { id } = await params;
    const parsedBody = salesOrderMutationSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: "Review the sales order details and try again.",
          code: "SALES_ORDER_VALIDATION_FAILED",
        },
        { status: 400 }
      );
    }
    const updateData = parsedBody.data;

    const { error: updateError } = await supabase.rpc("update_sales_order_draft_transaction", {
      p_sales_order_id: id,
      p_customer_id: updateData.customerId,
      p_order_date: updateData.orderDate,
      p_expected_delivery_date: updateData.expectedDeliveryDate,
      p_shipping_address: updateData.shippingAddress,
      p_shipping_city: updateData.shippingCity,
      p_shipping_state: updateData.shippingState,
      p_shipping_postal_code: updateData.shippingPostalCode,
      p_shipping_country: updateData.shippingCountry,
      p_payment_terms: updateData.paymentTerms,
      p_notes: updateData.notes,
      p_items: updateData.lineItems,
    });

    if (updateError) {
      console.error("Failed to update sales order transaction", {
        salesOrderId: id,
        code: updateError.code,
        message: updateError.message,
      });
      const failure = getSalesOrderMutationFailure(updateError.message);
      return NextResponse.json(
        { error: failure.message, code: failure.code },
        { status: failure.status }
      );
    }

    // Fetch updated order with joins
    const { data: updatedOrder, error: updatedOrderError } = await supabase
      .from("sales_orders")
      .select(SALES_ORDER_SELECT)
      .eq("id", id)
      .single();

    const { data: orderItems, error: orderItemsError } = await supabase
      .from("sales_order_items")
      .select(SALES_ORDER_ITEM_SELECT)
      .eq("order_id", id)
      .order("sort_order", { ascending: true });

    if (updatedOrderError || !updatedOrder || orderItemsError) {
      console.error("Failed to load updated sales order", {
        salesOrderId: id,
        order: updatedOrderError
          ? { code: updatedOrderError.code, message: updatedOrderError.message }
          : null,
        items: orderItemsError
          ? { code: orderItemsError.code, message: orderItemsError.message }
          : null,
      });
      return NextResponse.json(
        {
          error: "Sales order was updated but could not be loaded",
          code: "SALES_ORDER_SAVE_FAILED",
        },
        { status: 500 }
      );
    }

    const updatedOrderItemIds = (orderItems || []).map((item) => item.id);
    const updatedFrameDetails = await loadSalesOrderFrameDetails(supabase, updatedOrderItemIds);
    if (updatedFrameDetails.error) {
      console.error("Failed to load updated sales order frame details", updatedFrameDetails.error);
      return NextResponse.json(
        { error: "Sales order was updated but could not be loaded" },
        { status: 500 }
      );
    }

    const items =
      orderItems?.map((item) =>
        transformDbSalesOrderItem(
          item as DbSalesOrderItemWithRelations,
          updatedFrameDetails.configurationsByItemId.get(item.id) || [],
          updatedFrameDetails.componentsByItemId.get(item.id) || [],
          updatedFrameDetails.matLayersByConfigurationId
        )
      ) || [];
    const result = transformDbSalesOrder(
      updatedOrder as DbSalesOrder & {
        customers?: DbCustomer | DbCustomer[] | null;
        users?: DbUser | DbUser[] | null;
      },
      items
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Unexpected sales order update failure", { salesOrderId: await params, error });
    return NextResponse.json(
      { error: "Internal server error", code: "SALES_ORDER_SAVE_FAILED" },
      { status: 500 }
    );
  }
}

// DELETE /api/sales-orders/[id] - Soft delete sales order
async function DELETEHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, "delete");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();

    const { id } = await params;

    const { error } = await supabase.rpc("delete_sales_order_transaction", {
      p_sales_order_id: id,
    });

    if (error) {
      console.error("Failed to delete sales order", {
        salesOrderId: id,
        code: error.code,
        message: error.message,
      });
      const safeErrorByCode: Record<string, { error: string; status: 404 | 409 }> = {
        SALES_ORDER_NOT_FOUND: { error: "Sales order not found", status: 404 },
        SALES_ORDER_DELETE_STATUS_INVALID: {
          error: "Only draft or confirmed sales orders can be deleted.",
          status: 409,
        },
      };
      const safeError = safeErrorByCode[error.message];
      return NextResponse.json(
        { error: safeError?.error ?? "Failed to delete sales order" },
        { status: safeError?.status ?? 500 }
      );
    }

    return NextResponse.json({ message: "Sales order deleted successfully" });
  } catch (error) {
    console.error("Unexpected sales order deletion failure", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "sales_orders",
  route: "/api/sales-orders/[id]",
});
export const PUT = withActivityLogging(PUTHandler, {
  action: "update",
  resourceType: "sales_orders",
  route: "/api/sales-orders/[id]",
});
export const DELETE = withActivityLogging(DELETEHandler, {
  action: "delete",
  resourceType: "sales_orders",
  route: "/api/sales-orders/[id]",
});
