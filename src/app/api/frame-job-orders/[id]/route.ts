import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { logQuotationError } from "../../quotations/_shared";

type RelatedOne<T> = T | T[] | null | undefined;

type DbRelatedName = {
  item_code?: string | null;
  item_name?: string | null;
  code?: string | null;
  name?: string | null;
  customer_name?: string | null;
  quotation_code?: string | null;
  order_code?: string | null;
  invoice_code?: string | null;
  warehouse_code?: string | null;
  warehouse_name?: string | null;
};

type DbJobOrder = {
  id: string;
  job_order_code: string;
  quotation_id: string | null;
  sales_order_id: string | null;
  sales_invoice_id: string | null;
  customer_id: string;
  status: string;
  order_date: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  customers?: RelatedOne<DbRelatedName>;
  sales_quotations?: RelatedOne<DbRelatedName>;
  sales_orders?: RelatedOne<DbRelatedName>;
  sales_invoices?: RelatedOne<DbRelatedName>;
};

type DbJobItem = {
  id: string;
  quotation_item_id: string | null;
  quotation_component_id: string | null;
  sales_order_item_id: string | null;
  sales_order_component_id: string | null;
  item_id: string;
  item_description: string | null;
  required_quantity: number | string;
  issued_quantity: number | string;
  unit_rate: number | string;
  total_amount: number | string;
  created_at: string;
  items?: RelatedOne<DbRelatedName>;
  units_of_measure?: RelatedOne<DbRelatedName>;
  sales_quotation_items?: RelatedOne<{
    item_description: string | null;
    quantity: number | string;
    rate: number | string;
    line_total: number | string;
    sort_order: number | null;
    items?: RelatedOne<DbRelatedName>;
    units_of_measure?: RelatedOne<DbRelatedName>;
  }>;
  sales_quotation_item_components?: RelatedOne<{
    component_type: string;
    source: string;
    description: string | null;
    qty_per_frame: number | string;
    total_quantity: number | string;
    rounding_mode: string | null;
    sort_order: number | null;
  }>;
  sales_order_items?: RelatedOne<{
    item_description: string | null;
    quantity: number | string;
    rate: number | string;
    line_total: number | string;
    sort_order: number | null;
    items?: RelatedOne<DbRelatedName>;
    units_of_measure?: RelatedOne<DbRelatedName>;
  }>;
  sales_order_item_components?: RelatedOne<{
    component_type: string;
    source: string;
    description: string | null;
    qty_per_frame: number | string;
    total_quantity: number | string;
    rounding_mode: string | null;
    sort_order: number | null;
  }>;
};

type DbConfiguration = {
  id: string;
  quotation_item_id?: string;
  order_item_id?: string;
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
  items?: RelatedOne<DbRelatedName>;
};

type DbReservation = {
  id: string;
  quotation_component_id: string | null;
  sales_order_component_id: string | null;
  item_id: string;
  warehouse_id: string;
  quantity: number | string;
  status: string;
  reserved_at: string;
  consumed_at: string | null;
  released_at: string | null;
  items?: RelatedOne<DbRelatedName>;
  warehouses?: RelatedOne<DbRelatedName>;
  units_of_measure?: RelatedOne<DbRelatedName>;
};

type DbManufacturingOrderSummary = {
  id: string;
  manufacturing_order_code: string;
  status: string;
};

type QueryBuilder = {
  eq: (column: string, value: string) => QueryBuilder;
  is: (column: string, value: null) => QueryBuilder;
  in: (column: string, values: string[]) => QueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder;
  maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
};

type QueryStart = {
  select: (columns: string) => QueryBuilder;
};

type QueryClient = {
  from: (table: string) => QueryStart;
};

const one = <T>(value: RelatedOne<T>): T | null => {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
};

const toNumber = (value: number | string | null | undefined) => Number(value) || 0;

const fetchRows = async <T>(query: QueryBuilder): Promise<{ data: T[] | null; error: unknown }> => {
  const result = (await query) as unknown as { data: T[] | null; error: unknown };
  return result;
};

async function GETHandler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.SALES_QUOTATIONS, "view");
    if (unauthorized) return unauthorized;

    const { id: jobOrderId } = await params;
    const { supabase } = await createServerClientWithBU();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const queryClient = supabase as unknown as QueryClient;
    const { data: jobOrderData, error: jobOrderError } = await queryClient
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
        notes,
        created_at,
        customers:customer_id(customer_name),
        sales_quotations:quotation_id(quotation_code),
        sales_orders:sales_order_id(order_code),
        sales_invoices:sales_invoice_id(invoice_code)
      `
      )
      .eq("id", jobOrderId)
      .is("deleted_at", null)
      .maybeSingle();

    if (jobOrderError) {
      logQuotationError("Error fetching job order detail:", jobOrderError);
      return NextResponse.json({ error: "Failed to load job order" }, { status: 500 });
    }

    if (!jobOrderData) {
      return NextResponse.json({ error: "Job order not found" }, { status: 404 });
    }

    const jobOrder = jobOrderData as DbJobOrder;
    const { data: itemRows, error: itemsError } = await fetchRows<DbJobItem>(
      queryClient
        .from("frame_job_order_items")
        .select(
          `
          id,
          quotation_item_id,
          quotation_component_id,
          sales_order_item_id,
          sales_order_component_id,
          item_id,
          item_description,
          required_quantity,
          issued_quantity,
          unit_rate,
          total_amount,
          created_at,
          items:item_id(item_code, item_name),
          units_of_measure:uom_id(code, name),
          sales_quotation_items:quotation_item_id(
            item_description,
            quantity,
            rate,
            line_total,
            sort_order,
            items:item_id(item_code, item_name),
            units_of_measure:uom_id(code, name)
          ),
          sales_quotation_item_components:quotation_component_id(
            component_type,
            source,
            description,
            qty_per_frame,
            total_quantity,
            rounding_mode,
            sort_order
          ),
          sales_order_items:sales_order_item_id(
            item_description,
            quantity,
            rate,
            line_total,
            sort_order,
            items:item_id(item_code, item_name),
            units_of_measure:uom_id(code, name)
          ),
          sales_order_item_components:sales_order_component_id(
            component_type,
            source,
            description,
            qty_per_frame,
            total_quantity,
            rounding_mode,
            sort_order
          )
        `
        )
        .eq("job_order_id", jobOrderId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
    );

    if (itemsError) {
      logQuotationError("Error fetching job order detail items:", itemsError);
      return NextResponse.json({ error: "Failed to load job order" }, { status: 500 });
    }

    const items = itemRows || [];
    const quotationItemIds = Array.from(
      new Set(items.map((item) => item.quotation_item_id).filter((id): id is string => !!id))
    );
    const salesOrderItemIds = Array.from(
      new Set(items.map((item) => item.sales_order_item_id).filter((id): id is string => !!id))
    );

    let configurations: DbConfiguration[] = [];
    if (quotationItemIds.length > 0) {
      const { data: configurationRows, error: configurationsError } =
        await fetchRows<DbConfiguration>(
          queryClient
            .from("sales_quotation_item_configurations")
            .select(
              `
            id,
            quotation_item_id,
            width,
            height,
            fixed_allowance,
            molding_item_id,
            molding_stick_length,
            molding_sticks_required,
            service_fee_mode,
            service_type,
            service_fee_amount,
            total_service_fee,
            invoice_display_mode,
            items:molding_item_id(item_code, item_name)
          `
            )
            .is("deleted_at", null)
            .in("quotation_item_id", quotationItemIds)
        );

      if (configurationsError) {
        logQuotationError("Error fetching job order configurations:", configurationsError);
        return NextResponse.json({ error: "Failed to load job order" }, { status: 500 });
      }

      configurations = configurationRows || [];
    }

    if (salesOrderItemIds.length > 0) {
      const { data: configurationRows, error: configurationsError } =
        await fetchRows<DbConfiguration>(
          queryClient
            .from("sales_order_item_configurations")
            .select(
              `
            id,
            order_item_id,
            width,
            height,
            fixed_allowance,
            molding_item_id,
            molding_stick_length,
            molding_sticks_required,
            service_fee_mode,
            service_type,
            service_fee_amount,
            total_service_fee,
            invoice_display_mode,
            items:molding_item_id(item_code, item_name)
          `
            )
            .is("deleted_at", null)
            .in("order_item_id", salesOrderItemIds)
        );

      if (configurationsError) {
        logQuotationError(
          "Error fetching job order sales order configurations:",
          configurationsError
        );
        return NextResponse.json({ error: "Failed to load job order" }, { status: 500 });
      }

      configurations = configurations.concat(configurationRows || []);
    }

    const { data: reservationRows, error: reservationsError } = await fetchRows<DbReservation>(
      queryClient
        .from("inventory_reservations")
        .select(
          `
          id,
          quotation_component_id,
          sales_order_component_id,
          item_id,
          warehouse_id,
          quantity,
          status,
          reserved_at,
          consumed_at,
          released_at,
          items:item_id(item_code, item_name),
          warehouses:warehouse_id(warehouse_code, warehouse_name),
          units_of_measure:uom_id(code, name)
        `
        )
        .eq("job_order_id", jobOrderId)
        .is("deleted_at", null)
        .order("reserved_at", { ascending: true })
    );

    if (reservationsError) {
      logQuotationError("Error fetching job order reservations:", reservationsError);
      return NextResponse.json({ error: "Failed to load job order" }, { status: 500 });
    }

    const { data: manufacturingRows, error: manufacturingError } =
      await fetchRows<DbManufacturingOrderSummary>(
        queryClient
          .from("manufacturing_orders")
          .select("id, manufacturing_order_code, status")
          .eq("frame_job_order_id", jobOrderId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
      );

    if (manufacturingError) {
      logQuotationError("Error fetching job order production link:", manufacturingError);
      return NextResponse.json({ error: "Failed to load job order" }, { status: 500 });
    }

    const manufacturingOrder =
      (manufacturingRows || []).find((order) => order.status !== "cancelled") || null;

    const configurationByQuotationItemId = new Map(
      configurations
        .filter((configuration) => configuration.quotation_item_id)
        .map((configuration) => [configuration.quotation_item_id as string, configuration])
    );
    const configurationBySalesOrderItemId = new Map(
      configurations
        .filter((configuration) => configuration.order_item_id)
        .map((configuration) => [configuration.order_item_id as string, configuration])
    );
    const reservationByComponentId = new Map(
      (reservationRows || [])
        .filter(
          (reservation) =>
            reservation.sales_order_component_id || reservation.quotation_component_id
        )
        .map((reservation) => [
          reservation.sales_order_component_id || (reservation.quotation_component_id as string),
          reservation,
        ])
    );
    const quotationLines = new Map<string, ReturnType<typeof buildLine>>();

    for (const item of items) {
      const lineId = item.sales_order_item_id || item.quotation_item_id || "unlinked";
      if (!quotationLines.has(lineId)) {
        quotationLines.set(
          lineId,
          buildLine(
            lineId,
            item,
            item.sales_order_item_id
              ? configurationBySalesOrderItemId.get(item.sales_order_item_id)
              : configurationByQuotationItemId.get(item.quotation_item_id || "")
          )
        );
      }

      const line = quotationLines.get(lineId);
      if (line) {
        line.components.push(
          buildComponent(
            item,
            reservationByComponentId.get(
              item.sales_order_component_id || item.quotation_component_id || ""
            )
          )
        );
      }
    }

    const customer = one(jobOrder.customers);
    const quotation = one(jobOrder.sales_quotations);
    const salesOrder = one(jobOrder.sales_orders);
    const invoice = one(jobOrder.sales_invoices);
    const requiredQuantity = items.reduce((sum, item) => sum + toNumber(item.required_quantity), 0);
    const issuedQuantity = items.reduce((sum, item) => sum + toNumber(item.issued_quantity), 0);

    return NextResponse.json({
      data: {
        id: jobOrder.id,
        jobOrderCode: jobOrder.job_order_code,
        quotationId: jobOrder.quotation_id,
        quotationCode: quotation?.quotation_code || "",
        salesOrderId: jobOrder.sales_order_id,
        salesOrderCode: salesOrder?.order_code || "",
        draftInvoiceId: jobOrder.sales_invoice_id,
        draftInvoiceCode: invoice?.invoice_code || "",
        customerId: jobOrder.customer_id,
        customerName: customer?.customer_name || "",
        status: jobOrder.status,
        orderDate: jobOrder.order_date,
        completedAt: jobOrder.completed_at,
        notes: jobOrder.notes,
        componentCount: items.length,
        requiredQuantity,
        issuedQuantity,
        createdAt: jobOrder.created_at,
        manufacturingOrder: manufacturingOrder
          ? {
              id: manufacturingOrder.id,
              manufacturingOrderCode: manufacturingOrder.manufacturing_order_code,
              status: manufacturingOrder.status,
            }
          : null,
        lines: Array.from(quotationLines.values()).sort((a, b) => a.sortOrder - b.sortOrder),
        reservations: (reservationRows || []).map(buildReservation),
      },
    });
  } catch (error) {
    logQuotationError("Unexpected job order detail error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const buildLine = (quotationItemId: string, item: DbJobItem, configuration?: DbConfiguration) => {
  const sourceItem = one(item.sales_order_items) || one(item.sales_quotation_items);
  const quotedItem = one(sourceItem?.items);
  const quotedUom = one(sourceItem?.units_of_measure);
  const moldingItem = one(configuration?.items);

  return {
    quotationItemId,
    itemCode: quotedItem?.item_code || "",
    itemName: quotedItem?.item_name || "",
    description: sourceItem?.item_description || "",
    quantity: toNumber(sourceItem?.quantity),
    uomCode: quotedUom?.code || "",
    rate: toNumber(sourceItem?.rate),
    lineTotal: toNumber(sourceItem?.line_total),
    sortOrder: sourceItem?.sort_order || 0,
    configuration: configuration
      ? {
          width: toNumber(configuration.width),
          height: toNumber(configuration.height),
          fixedAllowance: toNumber(configuration.fixed_allowance),
          moldingItemCode: moldingItem?.item_code || "",
          moldingItemName: moldingItem?.item_name || "",
          moldingStickLength: toNumber(configuration.molding_stick_length),
          moldingSticksRequired: toNumber(configuration.molding_sticks_required),
          serviceFeeMode: configuration.service_fee_mode,
          serviceType: configuration.service_type || "",
          serviceFeeAmount: toNumber(configuration.service_fee_amount),
          totalServiceFee: toNumber(configuration.total_service_fee),
          invoiceDisplayMode: configuration.invoice_display_mode,
        }
      : null,
    components: [] as ReturnType<typeof buildComponent>[],
  };
};

const buildComponent = (item: DbJobItem, reservation?: DbReservation) => {
  const material = one(item.items);
  const uom = one(item.units_of_measure);
  const component =
    one(item.sales_order_item_components) || one(item.sales_quotation_item_components);
  const reservedWarehouse = one(reservation?.warehouses);

  return {
    id: item.id,
    quotationComponentId: item.quotation_component_id,
    salesOrderComponentId: item.sales_order_component_id,
    componentType: component?.component_type || "material",
    source: component?.source || "",
    itemCode: material?.item_code || "",
    itemName: material?.item_name || "",
    description: item.item_description || component?.description || "",
    qtyPerFrame: toNumber(component?.qty_per_frame),
    requiredQuantity: toNumber(item.required_quantity),
    issuedQuantity: toNumber(item.issued_quantity),
    uomCode: uom?.code || "",
    unitRate: toNumber(item.unit_rate),
    totalAmount: toNumber(item.total_amount),
    roundingMode: component?.rounding_mode || "none",
    sortOrder: component?.sort_order || 0,
    reservation: reservation
      ? {
          id: reservation.id,
          quantity: toNumber(reservation.quantity),
          status: reservation.status,
          warehouseCode: reservedWarehouse?.warehouse_code || "",
          warehouseName: reservedWarehouse?.warehouse_name || "",
          reservedAt: reservation.reserved_at,
          consumedAt: reservation.consumed_at,
          releasedAt: reservation.released_at,
        }
      : null,
  };
};

const buildReservation = (reservation: DbReservation) => {
  const item = one(reservation.items);
  const warehouse = one(reservation.warehouses);
  const uom = one(reservation.units_of_measure);

  return {
    id: reservation.id,
    quotationComponentId: reservation.quotation_component_id,
    salesOrderComponentId: reservation.sales_order_component_id,
    itemCode: item?.item_code || "",
    itemName: item?.item_name || "",
    warehouseCode: warehouse?.warehouse_code || "",
    warehouseName: warehouse?.warehouse_name || "",
    quantity: toNumber(reservation.quantity),
    uomCode: uom?.code || "",
    status: reservation.status,
    reservedAt: reservation.reserved_at,
    consumedAt: reservation.consumed_at,
    releasedAt: reservation.released_at,
  };
};

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "frame_job_orders",
  route: "/api/frame-job-orders/[id]",
});
