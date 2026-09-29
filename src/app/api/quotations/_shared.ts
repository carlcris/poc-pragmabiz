import type {
  FrameQuotationComponent,
  FrameQuotationMatLayer,
  FrameQuotationSize,
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
  date_received: string | null;
  due_date: string | null;
  items_received: string | null;
  payment_terms: string | null;
  status: string | null;
  accepted_by_name?: string | null;
  accepted_channel?: string | null;
  accepted_at?: string | null;
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
  pricing_tier: string | null;
  pricing_tier_name: string | null;
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
export type DbQuotationItemConfiguration = {
  id: string;
  quotation_item_id: string;
  size_index: number | null;
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
  billing_mode: string | null;
  artwork_length_in: number | string | null;
  artwork_width_in: number | string | null;
  frame_width_in: number | string | null;
  size_mode: string | null;
  overlap_in: number | string | null;
  mat_source: string | null;
  glazing_cut_to_mat_outer: boolean | null;
  mat_included: boolean | null;
  glazing_included: boolean | null;
  glazing_type: string | null;
  glazing_unit_rate: number | null;
  glazing_sheets: number | null;
  glazing_remarks: string | null;
  backing_type: string | null;
  moulding_material: string | null;
  frame_quantity: number | string | null;
  backing_unit_rate: number | null;
  framing_instructions: string | null;
  backing_thickness_in: number | string | null;
  component_discounts: Record<string, number> | null;
  frame_rate: number | string | null;
  mat_unit_rate: number | string | null;
  mat_border_l_in: number | string | null;
  mat_border_w_in: number | string | null;
  flexipoints_numerator: number | null;
  flexipoints_denominator: number | null;
  multipoints_numerator: number | null;
  multipoints_denominator: number | null;
  items?: DbItem | DbItem[] | null;
};

export type DbQuotationItemMatLayer = {
  id: string;
  configuration_id: string;
  layer_index: number;
  mat_board_item_id: string;
  border_or_reveal_l_in: number | string;
  border_or_reveal_w_in: number | string;
  unit_rate: number | string | null;
  items?: DbItem | DbItem[] | null;
};
export type DbQuotationItemAttachment = {
  id: string;
  configuration_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number | string;
};
export type DbQuotationItemComponent = {
  id: string;
  quotation_item_id: string;
  configuration_id: string | null;
  component_type: string;
  source: string;
  item_id: string;
  description: string | null;
  qty_per_frame: number | string;
  total_quantity: number | string;
  uom_id: string;
  unit_rate: number | string;
  discount_percent: number | string | null;
  discount_amount: number | string | null;
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
    "Only confirmed or in-progress sales orders can create frame job orders":
      "Only confirmed or in-progress sales orders can create job orders",
    "Only confirmed, in-progress, or invoiced sales orders can create frame job orders":
      "Only confirmed, in-progress, or invoiced sales orders can create job orders",
    "This sales order already has a frame job order": "This sales order already has a job order",
    FRAME_JOB_ORDER_PERMISSION_DENIED:
      "You do not have permission to create a job order from this sales order",
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

  // The RPC raises stable codes rather than prose so the wording can live here
  // and be translated without touching a migration.
  const acceptanceMessages: Record<string, string> = {
    ACCEPTANCE_NAME_REQUIRED: "Enter who accepted the quotation.",
    ACCEPTANCE_CHANNEL_REQUIRED: "Choose the channel it was accepted through.",
    ACCEPTANCE_WAIVER_REQUIRED: "Attach the signed waiver.",
    QUOTATION_STATUS_TRANSITION_INVALID: "The quotation status has changed. Refresh and try again.",
    QUOTATION_NOT_EDITABLE: "Only draft or sent quotations can be edited.",
  };
  if (acceptanceMessages[message]) {
    return acceptanceMessages[message];
  }

  if (
    message === "Quotation not found" ||
    message === "Only accepted quotations can be converted to sales orders" ||
    message === "This quotation has already been converted to a sales order" ||
    message === "Quotation must have at least one item" ||
    message === "Business unit context required" ||
    message === "Only draft, sent, or accepted quotations can be confirmed" ||
    message === "This quotation has already been confirmed" ||
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
    message === "Sales order not found" ||
    message === "Only confirmed or in-progress sales orders can create frame job orders" ||
    message ===
      "Only confirmed, in-progress, or invoiced sales orders can create frame job orders" ||
    message === "This sales order already has a frame job order" ||
    message === "FRAME_JOB_ORDER_PERMISSION_DENIED" ||
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

/** Narrow the stored glass/backing types, which are free text at the DB boundary. */
const asFrameGlazingType = (value: string | null): FrameQuotationConfiguration["glazingType"] => {
  if (
    value === "clear" ||
    value === "double" ||
    value === "acrylic" ||
    value === "non_glare" ||
    value === "octagon"
  ) {
    return value;
  }
  return undefined;
};

const asFrameMouldingMaterial = (
  value: string | null
): FrameQuotationConfiguration["mouldingMaterial"] =>
  value === "polystyrene" || value === "wood" ? value : undefined;

const asFrameBackingType = (value: string | null): FrameQuotationConfiguration["backingType"] => {
  if (value === "mdf" || value === "plywood" || value === "sintra" || value === "foam") {
    return value;
  }
  return undefined;
};

const asFrameComponentType = (value: string): FrameQuotationComponent["componentType"] => {
  if (value === "molding" || value === "material" || value === "accessory") return value;
  return "material";
};

const asFrameComponentSource = (value: string): FrameQuotationComponent["source"] => {
  if (value === "auto" || value === "manual") return value;
  return "manual";
};

/** One stored configuration → the shape the app edits and prints. */
const toFrameConfiguration = (
  configuration: DbQuotationItemConfiguration,
  attachments: DbQuotationItemAttachment[] = []
): FrameQuotationConfiguration => {
  const moldingItem = Array.isArray(configuration.items)
    ? configuration.items[0]
    : configuration.items;
  return {
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
    billingMode: configuration.billing_mode === "chop_join" ? "chop_join" : "framing",
    artworkLengthIn: numberOrUndefined(configuration.artwork_length_in),
    artworkWidthIn: numberOrUndefined(configuration.artwork_width_in),
    frameWidthIn: numberOrUndefined(configuration.frame_width_in),
    sizeMode: configuration.size_mode === "outside" ? "outside" : "artwork",
    overlapIn: numberOrUndefined(configuration.overlap_in),
    matSource: configuration.mat_source === "customer" ? "customer" : "store",
    glazingCutToMatOuter: configuration.glazing_cut_to_mat_outer ?? true,
    matIncluded: configuration.mat_included ?? undefined,
    glazingIncluded: configuration.glazing_included ?? undefined,
    glazingType: asFrameGlazingType(configuration.glazing_type),
    glazingUnitRate: configuration.glazing_unit_rate ?? undefined,
    glazingSheets: configuration.glazing_sheets ?? undefined,
    glazingRemarks: configuration.glazing_remarks ?? undefined,
    backingType: asFrameBackingType(configuration.backing_type),
    mouldingMaterial: asFrameMouldingMaterial(configuration.moulding_material),
    frameQuantity: numberOrUndefined(configuration.frame_quantity),
    backingUnitRate: configuration.backing_unit_rate ?? undefined,
    framingInstructions: configuration.framing_instructions ?? undefined,
    backingThicknessIn: numberOrUndefined(configuration.backing_thickness_in),
    componentDiscounts: configuration.component_discounts ?? undefined,
    frameRate: numberOrUndefined(configuration.frame_rate),
    matUnitRate: numberOrUndefined(configuration.mat_unit_rate),
    matBorderLIn: numberOrUndefined(configuration.mat_border_l_in),
    matBorderWIn: numberOrUndefined(configuration.mat_border_w_in),
    flexipointsNumerator: numberOrUndefined(configuration.flexipoints_numerator),
    flexipointsDenominator: numberOrUndefined(configuration.flexipoints_denominator),
    multipointsNumerator: numberOrUndefined(configuration.multipoints_numerator),
    multipointsDenominator: numberOrUndefined(configuration.multipoints_denominator),
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      storagePath: attachment.storage_path,
      fileName: attachment.file_name,
      mimeType: attachment.mime_type,
      fileSizeBytes: Number(attachment.file_size_bytes),
    })),
  };
};

/** One stored component row → the shape the app edits and prints. */
const toFrameComponent = (component: DbQuotationItemComponent): FrameQuotationComponent => {
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
    discountPercent: Number(component.discount_percent ?? 0) || undefined,
    discountAmount: Number(component.discount_amount ?? 0) || undefined,
    totalAmount: Number(component.total_amount),
    roundingMode: component.rounding_mode === "ceil_per_order" ? "ceil_per_order" : "none",
    sortOrder: component.sort_order || 0,
  };
};

/** One stored mat-layer row → the shape the app edits and prints. */
const toFrameMatLayer = (layer: DbQuotationItemMatLayer): FrameQuotationMatLayer => {
  const boardItem = Array.isArray(layer.items) ? layer.items[0] : layer.items;
  return {
    id: layer.id,
    layerIndex: layer.layer_index,
    matBoardItemId: layer.mat_board_item_id,
    matBoardItemCode: boardItem?.item_code || undefined,
    matBoardItemName: boardItem?.item_name || undefined,
    unitRate: Number(layer.unit_rate),
  };
};

export const transformDbQuotationItem = (
  dbItem: DbQuotationItemWithJoins,
  /**
   * Every configuration on this line, ordered by `size_index`. A line usually
   * has one, but a configured frame may carry several sizes.
   */
  configurations: DbQuotationItemConfiguration[] = [],
  components: DbQuotationItemComponent[] = [],
  matLayersByConfigurationId: Map<string, DbQuotationItemMatLayer[]> = new Map(),
  attachmentsByConfigurationId: Map<string, DbQuotationItemAttachment[]> = new Map()
): QuotationLineItem => {
  const orderedConfigurations = [...configurations].sort(
    (left, right) => (left.size_index ?? 0) - (right.size_index ?? 0)
  );
  const configuration = orderedConfigurations[0] ?? null;
  const componentsByConfigurationId = new Map<string, DbQuotationItemComponent[]>();
  for (const component of components) {
    if (!component.configuration_id) continue;
    const existing = componentsByConfigurationId.get(component.configuration_id) || [];
    existing.push(component);
    componentsByConfigurationId.set(component.configuration_id, existing);
  }

  // Each size carries its own configuration, components and mat layers. The
  // singular fields below still carry the first, so anything reading one
  // configuration keeps working.
  const frameSizes: FrameQuotationSize[] = orderedConfigurations.map((entry) => ({
    frameConfiguration: toFrameConfiguration(
      entry,
      attachmentsByConfigurationId.get(entry.id) || []
    ),
    frameComponents: (componentsByConfigurationId.get(entry.id) || []).map(toFrameComponent),
    matLayers: (matLayersByConfigurationId.get(entry.id) || []).map(toFrameMatLayer),
  }));
  const matLayers = configuration ? matLayersByConfigurationId.get(configuration.id) || [] : [];
  const item = Array.isArray(dbItem.items) ? dbItem.items[0] : dbItem.items;
  const lineUom = Array.isArray(dbItem.units_of_measure)
    ? dbItem.units_of_measure[0]
    : dbItem.units_of_measure;
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
    pricingTier: dbItem.pricing_tier || undefined,
    pricingTierName: dbItem.pricing_tier_name || undefined,
    unitPrice: Number(dbItem.rate),
    discount: Number(dbItem.discount_percent) || 0,
    discountAmount: Number(dbItem.discount_amount) || 0,
    taxRate: Number(dbItem.tax_percent) || 0,
    taxAmount: Number(dbItem.tax_amount) || 0,
    lineTotal: Number(dbItem.line_total),
    sortOrder: dbItem.sort_order || 0,
    frameConfiguration: configuration
      ? toFrameConfiguration(
          configuration,
          attachmentsByConfigurationId.get(configuration.id) || []
        )
      : null,
    frameComponents: components.map(toFrameComponent),
    matLayers: matLayers.map(toFrameMatLayer),
    frameSizes: frameSizes.length > 1 ? frameSizes : undefined,
  };
};

/** Numeric column that is genuinely optional — null stays undefined, not 0. */
const numberOrUndefined = (value: number | string | null): number | undefined =>
  value === null || value === "" ? undefined : Number(value);

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
    dateReceived: dbQuotation.date_received || "",
    dueDate: dbQuotation.due_date || "",
    itemsReceived: dbQuotation.items_received || "",
    paymentTerms: dbQuotation.payment_terms || "cash",
    status: (dbQuotation.status || "draft") as Quotation["status"],
    acceptedByName: dbQuotation.accepted_by_name || undefined,
    acceptedChannel: dbQuotation.accepted_channel || undefined,
    acceptedAt: dbQuotation.accepted_at || undefined,
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
  const configurationsByItemId = new Map<string, DbQuotationItemConfiguration[]>();
  const componentsByItemId = new Map<string, DbQuotationItemComponent[]>();
  const matLayersByConfigurationId = new Map<string, DbQuotationItemMatLayer[]>();
  const attachmentsByConfigurationId = new Map<string, DbQuotationItemAttachment[]>();

  if (quotationItemIds.length > 0) {
    const { data: configurations, error: configurationsError } = await supabase
      .from("sales_quotation_item_configurations")
      .select(
        `
        id,
        quotation_item_id,
        size_index,
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
        billing_mode,
        artwork_length_in,
        artwork_width_in,
        frame_width_in,
        size_mode,
        overlap_in,
        mat_source,
        glazing_cut_to_mat_outer,
        mat_included,
        glazing_included,
        glazing_type,
        glazing_unit_rate,
        glazing_sheets,
        glazing_remarks,
        backing_type,
        moulding_material,
        frame_quantity,
        backing_unit_rate,
        framing_instructions,
        backing_thickness_in,
        component_discounts,
        frame_rate,
        mat_unit_rate,
        mat_border_l_in,
        mat_border_w_in,
        flexipoints_numerator,
        flexipoints_denominator,
        multipoints_numerator,
        multipoints_denominator,
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
      const existingConfigurations =
        configurationsByItemId.get(configuration.quotation_item_id) || [];
      existingConfigurations.push(configuration);
      configurationsByItemId.set(configuration.quotation_item_id, existingConfigurations);
    }

    // Sizes print and edit in the order they were entered.
    for (const configurations of configurationsByItemId.values()) {
      configurations.sort((a, b) => (a.size_index ?? 0) - (b.size_index ?? 0));
    }

    const configurationIds = Array.from(configurationsByItemId.values())
      .flat()
      .map((configuration) => configuration.id);

    if (configurationIds.length > 0) {
      const { data: layers, error: layersError } = await supabase
        .from("sales_quotation_item_mat_layers")
        .select(
          `
          id,
          configuration_id,
          layer_index,
          mat_board_item_id,
          border_or_reveal_l_in,
          border_or_reveal_w_in,
          unit_rate,
          items:mat_board_item_id (
            id,
            item_code,
            item_name
          )
        `
        )
        .in("configuration_id", configurationIds)
        .is("deleted_at", null)
        .order("layer_index", { ascending: true });

      if (layersError) {
        return { quotation: null, error: layersError };
      }

      for (const layer of (layers || []) as unknown as DbQuotationItemMatLayer[]) {
        const existing = matLayersByConfigurationId.get(layer.configuration_id) || [];
        existing.push(layer);
        matLayersByConfigurationId.set(layer.configuration_id, existing);
      }

      const { data: attachments, error: attachmentsError } = await supabase
        .from("sales_quotation_item_attachments")
        .select(
          `
          id,
          configuration_id,
          storage_path,
          file_name,
          mime_type,
          file_size_bytes
        `
        )
        .in("configuration_id", configurationIds)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (attachmentsError) {
        return { quotation: null, error: attachmentsError };
      }

      for (const attachment of (attachments || []) as unknown as DbQuotationItemAttachment[]) {
        const existing = attachmentsByConfigurationId.get(attachment.configuration_id) || [];
        existing.push(attachment);
        attachmentsByConfigurationId.set(attachment.configuration_id, existing);
      }
    }

    const { data: components, error: componentsError } = await supabase
      .from("sales_quotation_item_components")
      .select(
        `
        id,
        quotation_item_id,
        configuration_id,
        component_type,
        source,
        item_id,
        description,
        qty_per_frame,
        total_quantity,
        uom_id,
        unit_rate,
        discount_percent,
        discount_amount,
        total_amount,
        rounding_mode,
        sort_order,
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
      configurationsByItemId.get(item.id) || [],
      componentsByItemId.get(item.id) || [],
      matLayersByConfigurationId,
      attachmentsByConfigurationId
    )
  );

  return {
    quotation: transformDbQuotation(quotation as DbQuotationWithJoins, quotationItems),
    error: null,
  };
};
