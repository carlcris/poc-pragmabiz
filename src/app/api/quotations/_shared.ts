import type {
  FrameQuotationComponent,
  FrameQuotationConfiguration,
  Quotation,
  QuotationLineItem,
} from "@/types/quotation";
import type { createServerClientWithBU } from "@/lib/supabase/server-with-bu";

type SupabaseClient = Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"];

export type DbQuotation = {
  id: string;
  company_id: string;
  quotation_code: string;
  customer_id: string;
  quotation_date: string;
  valid_until: string | null;
  status: string | null;
  frame_job_order_id?: string | null;
  draft_invoice_id?: string | null;
  subtotal: number | string | null;
  discount_amount: number | string | null;
  tax_amount: number | string | null;
  total_amount: number | string | null;
  terms_conditions: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DbQuotationItem = {
  id: string;
  quotation_id: string;
  item_id: string;
  item_description: string | null;
  quantity: number | string;
  fulfilled_qty: number | string;
  uom_id: string | null;
  rate: number | string;
  discount_percent: number | string | null;
  discount_amount: number | string | null;
  tax_percent: number | string | null;
  tax_amount: number | string | null;
  line_total: number | string;
  sort_order: number | null;
};

type DbCustomer = { id: string; customer_name: string | null; email: string | null };
type DbItem = { id: string; item_code: string | null; item_name: string | null };
type DbUser = { id: string; first_name: string | null; last_name: string | null };
type DbUoM = { id: string; code: string | null; name: string | null };
type DbQuotationItemConfiguration = {
  id: string;
  quotation_item_id: string;
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
type DbQuotationItemComponent = {
  id: string;
  quotation_item_id: string;
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

export type DbQuotationWithJoins = DbQuotation & {
  customers?: DbCustomer | DbCustomer[] | null;
  users?: DbUser | DbUser[] | null;
};

export type DbQuotationItemWithJoins = DbQuotationItem & {
  items?: DbItem | DbItem[] | null;
  units_of_measure?: DbUoM | DbUoM[] | null;
};

export type RpcError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

type RpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: RpcError | null }>;
};

export const asRpcClient = (supabase: SupabaseClient): RpcClient =>
  supabase as unknown as RpcClient;

export const logQuotationError = (message: string, error: unknown) => {
  console.error(message, error);
};

export const getClientErrorMessage = (error: RpcError | null | undefined, fallback: string) => {
  const message = error?.message || "";
  const jobOrderMessageMap: Record<string, string> = {
    "Frame job order not found": "Job order not found",
    "Only reserved or in-progress frame job orders can be completed":
      "Only reserved or in-progress job orders can be completed",
    "Only queued, in-progress, or on-hold job orders can be completed":
      "Only queued, in-progress, or on-hold job orders can be completed",
    "Only reserved or in-progress frame job orders can be pushed to production":
      "Only reserved or in-progress job orders can be pushed to production",
    "Only pending frame job orders can be pushed to production":
      "Only pending job orders can be pushed to production",
    "Production must be completed before the job order can be completed":
      "Production must be completed before the job order can be completed",
    "Job order must be pushed to production before completion":
      "Job order must be pushed to production before completion",
    "Cancelled job orders cannot be completed": "Cancelled job orders cannot be completed",
    "Job orders already in production cannot be cancelled":
      "Job orders already in production cannot be cancelled",
    "Insufficient stock to complete frame job order": "Insufficient stock to complete job order",
    "No stock record exists for a required frame component":
      "A required frame material is not stocked in the selected warehouse",
    "Only confirmed or in-progress sales orders can create frame job orders":
      "Only confirmed or in-progress sales orders can create job orders",
    "Only confirmed, in-progress, or invoiced sales orders can create frame job orders":
      "Only confirmed, in-progress, or invoiced sales orders can create job orders",
    "This sales order already has a frame job order": "This sales order already has a job order",
    "Manufacturing orders must be pushed from job orders": "Orders must be pushed from job orders",
    "Manufacturing order not found": "Order not found",
    "Completed or cancelled manufacturing orders cannot be changed":
      "Completed or cancelled orders cannot be changed",
    "Manufacturing order must be started before it can be placed on hold":
      "Order must be started before it can be placed on hold",
    "Unsupported manufacturing floor action": "Unsupported production action",
  };

  if (jobOrderMessageMap[message]) {
    return jobOrderMessageMap[message];
  }

  if (
    message === "Quotation not found" ||
    message === "Only draft quotations can be edited" ||
    message === "Only accepted quotations can be converted to sales orders" ||
    message === "This quotation has already been converted to a sales order" ||
    message === "Quotation must have at least one item" ||
    message === "Business unit context required" ||
    message === "Only draft, sent, or accepted quotations can be confirmed" ||
    message === "This quotation has already been confirmed" ||
    message === "Warehouse is required to reserve frame materials" ||
    message === "No stock record exists for a required frame component" ||
    message === "Insufficient available stock for a required frame component" ||
    message === "Frame job order not found" ||
    message === "Only reserved or in-progress frame job orders can be completed" ||
    message === "Only queued, in-progress, or on-hold job orders can be completed" ||
    message === "Only reserved or in-progress frame job orders can be pushed to production" ||
    message === "Only pending frame job orders can be pushed to production" ||
    message === "Production must be completed before the job order can be completed" ||
    message === "Job order must be pushed to production before completion" ||
    message === "Cancelled job orders cannot be completed" ||
    message === "Job orders already in production cannot be cancelled" ||
    message === "This job order is already in production" ||
    message === "No stock record exists for a reserved frame component" ||
    message === "Insufficient stock to complete frame job order" ||
    message === "Sales order not found" ||
    message === "Only confirmed or in-progress sales orders can create frame job orders" ||
    message ===
      "Only confirmed, in-progress, or invoiced sales orders can create frame job orders" ||
    message === "This sales order already has a frame job order" ||
    message === "Sales order has no frame-configured items" ||
    message === "Manufacturing orders must be pushed from job orders" ||
    message === "Manufacturing order not found" ||
    message === "Completed or cancelled manufacturing orders cannot be changed" ||
    message === "Manufacturing order must be started before it can be placed on hold" ||
    message === "No pending operation found" ||
    message === "No in-progress operation found" ||
    message === "Unsupported manufacturing floor action"
  ) {
    return message;
  }

  return fallback;
};

const asFrameServiceFeeMode = (value: string): FrameQuotationConfiguration["serviceFeeMode"] => {
  if (
    value === "per_frame" ||
    value === "per_order" ||
    value === "size_based" ||
    value === "service_type" ||
    value === "manual"
  ) {
    return value;
  }
  return "per_frame";
};

const asFrameInvoiceDisplayMode = (
  value: string
): FrameQuotationConfiguration["invoiceDisplayMode"] => {
  if (value === "summary" || value === "components" || value === "both") return value;
  return "summary";
};

const asFrameComponentType = (value: string): FrameQuotationComponent["componentType"] => {
  if (value === "molding" || value === "material" || value === "accessory") return value;
  return "material";
};

const asFrameComponentSource = (value: string): FrameQuotationComponent["source"] => {
  if (value === "auto" || value === "manual") return value;
  return "manual";
};

export const transformDbQuotationItem = (
  dbItem: DbQuotationItemWithJoins,
  configuration?: DbQuotationItemConfiguration | null,
  components: DbQuotationItemComponent[] = []
): QuotationLineItem => {
  const item = Array.isArray(dbItem.items) ? dbItem.items[0] : dbItem.items;
  const lineUom = Array.isArray(dbItem.units_of_measure)
    ? dbItem.units_of_measure[0]
    : dbItem.units_of_measure;
  const moldingItem = configuration
    ? Array.isArray(configuration.items)
      ? configuration.items[0]
      : configuration.items
    : null;
  const quantity = Number(dbItem.quantity) || 0;
  const fulfilledQuantity = Math.min(quantity, Number(dbItem.fulfilled_qty) || 0);

  return {
    id: dbItem.id,
    itemId: dbItem.item_id,
    itemCode: item?.item_code || undefined,
    itemName: item?.item_name || undefined,
    description: dbItem.item_description || "",
    quantity,
    orderedQuantity: fulfilledQuantity,
    remainingQuantity: Math.max(quantity - fulfilledQuantity, 0),
    uomId: dbItem.uom_id || "",
    uomCode: lineUom?.code || undefined,
    uomName: lineUom?.name || undefined,
    unitPrice: Number(dbItem.rate),
    discount: Number(dbItem.discount_percent) || 0,
    discountAmount: Number(dbItem.discount_amount) || 0,
    taxRate: Number(dbItem.tax_percent) || 0,
    taxAmount: Number(dbItem.tax_amount) || 0,
    lineTotal: Number(dbItem.line_total),
    sortOrder: dbItem.sort_order || 0,
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
};

export const transformDbQuotation = (
  dbQuotation: DbQuotationWithJoins,
  items: QuotationLineItem[] = []
): Quotation => {
  const customer = Array.isArray(dbQuotation.customers)
    ? dbQuotation.customers[0]
    : dbQuotation.customers;
  const user = Array.isArray(dbQuotation.users) ? dbQuotation.users[0] : dbQuotation.users;

  return {
    id: dbQuotation.id,
    companyId: dbQuotation.company_id,
    quotationNumber: dbQuotation.quotation_code,
    customerId: dbQuotation.customer_id,
    customerName: customer?.customer_name || undefined,
    customerEmail: customer?.email || undefined,
    quotationDate: dbQuotation.quotation_date,
    validUntil: dbQuotation.valid_until || "",
    status: (dbQuotation.status || "draft") as Quotation["status"],
    frameJobOrderId: dbQuotation.frame_job_order_id || undefined,
    draftInvoiceId: dbQuotation.draft_invoice_id || undefined,
    lineItems: items,
    subtotal: Number(dbQuotation.subtotal) || 0,
    totalDiscount: Number(dbQuotation.discount_amount) || 0,
    totalTax: Number(dbQuotation.tax_amount) || 0,
    totalAmount: Number(dbQuotation.total_amount) || 0,
    terms: dbQuotation.terms_conditions || "",
    notes: dbQuotation.notes || "",
    createdBy: dbQuotation.created_by || "",
    createdByName: user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() : undefined,
    createdAt: dbQuotation.created_at,
    updatedAt: dbQuotation.updated_at,
  };
};

export const fetchQuotationById = async (
  supabase: SupabaseClient,
  id: string
): Promise<{ quotation: Quotation | null; error: unknown }> => {
  const { data: quotation, error } = await supabase
    .from("sales_quotations")
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
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !quotation) {
    return { quotation: null, error };
  }

  const { data: items, error: itemsError } = await supabase
    .from("sales_quotation_items")
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
    .eq("quotation_id", id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    return { quotation: null, error: itemsError };
  }

  const transformedItems = (items as DbQuotationItemWithJoins[] | null) || [];

  const quotationItemIds = transformedItems.map((item) => item.id);
  const configurationsByItemId = new Map<string, DbQuotationItemConfiguration>();
  const componentsByItemId = new Map<string, DbQuotationItemComponent[]>();

  if (quotationItemIds.length > 0) {
    const { data: configurations, error: configurationsError } = await supabase
      .from("sales_quotation_item_configurations")
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
      .in("quotation_item_id", quotationItemIds)
      .is("deleted_at", null);

    if (configurationsError) {
      return { quotation: null, error: configurationsError };
    }

    for (const configuration of (configurations || []) as DbQuotationItemConfiguration[]) {
      configurationsByItemId.set(configuration.quotation_item_id, configuration);
    }

    const { data: components, error: componentsError } = await supabase
      .from("sales_quotation_item_components")
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
      .in("quotation_item_id", quotationItemIds)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (componentsError) {
      return { quotation: null, error: componentsError };
    }

    for (const component of (components || []) as DbQuotationItemComponent[]) {
      const existing = componentsByItemId.get(component.quotation_item_id) || [];
      existing.push(component);
      componentsByItemId.set(component.quotation_item_id, existing);
    }
  }

  const quotationItems = transformedItems.map((item) =>
    transformDbQuotationItem(
      item,
      configurationsByItemId.get(item.id) || null,
      componentsByItemId.get(item.id) || []
    )
  );

  return {
    quotation: transformDbQuotation(quotation as DbQuotationWithJoins, quotationItems),
    error: null,
  };
};
