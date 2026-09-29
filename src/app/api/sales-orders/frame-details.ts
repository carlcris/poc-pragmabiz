import type {
  FrameQuotationComponent,
  FrameQuotationConfiguration,
  FrameQuotationMatLayer,
  FrameQuotationSize,
} from "@/types/quotation";
import type { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import type { QuotationLinePricing } from "@/lib/sales-orders/sales-order-line-pricing";

export type DbQuotationPricing = {
  quantity: number | string;
  discount_amount: number | string | null;
  tax_amount: number | string | null;
  line_total: number | string;
};
type DbSourceSize = { frame_quantity: number | string; total_service_fee: number | string };
type DbSourceComponent = { total_amount: number | string; discount_amount: number | string };
const joined = <T>(value: T | T[] | null | undefined): T | undefined =>
  (Array.isArray(value) ? value[0] : value) ?? undefined;

type SupabaseClient = Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"];

type DbItem = { id: string; item_code: string | null; item_name: string | null };
type DbUom = { id: string; code: string | null; name: string | null };

export type DbSalesOrderItemConfiguration = {
  source_pricing?: DbSourceSize | DbSourceSize[] | null;
  id: string;
  order_item_id: string;
  quotation_configuration_id: string | null;
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
  frame_quantity: number | string | null;
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
  glazing_unit_rate: number | string | null;
  glazing_sheets: number | null;
  glazing_remarks: string | null;
  backing_type: string | null;
  moulding_material: string | null;
  backing_unit_rate: number | string | null;
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

export type DbSalesOrderItemComponent = {
  source_pricing?: DbSourceComponent | DbSourceComponent[] | null;
  id: string;
  order_item_id: string;
  configuration_id: string | null;
  quotation_component_id: string | null;
  component_type: string;
  source: string;
  item_id: string;
  description: string | null;
  qty_per_frame: number | string;
  total_quantity: number | string;
  uom_id: string;
  unit_rate: number | string;
  total_amount: number | string;
  discount_percent: number | string;
  discount_amount: number | string;
  rounding_mode: string | null;
  sort_order: number | null;
  items?: DbItem | DbItem[] | null;
  units_of_measure?: DbUom | DbUom[] | null;
};

export type DbSalesOrderItemMatLayer = {
  id: string;
  configuration_id: string;
  quotation_mat_layer_id: string | null;
  layer_index: number;
  mat_board_item_id: string;
  unit_rate: number | string | null;
  items?: DbItem | DbItem[] | null;
};

export const SALES_ORDER_CONFIGURATION_SELECT = `
  source_pricing:quotation_configuration_id (frame_quantity, total_service_fee),
  id,
  order_item_id,
  quotation_configuration_id,
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
  frame_quantity,
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
  backing_unit_rate,
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
` as const;

export const SALES_ORDER_COMPONENT_SELECT = `
  source_pricing:quotation_component_id (total_amount, discount_amount),
  id,
  order_item_id,
  configuration_id,
  quotation_component_id,
  component_type,
  source,
  item_id,
  description,
  qty_per_frame,
  total_quantity,
  uom_id,
  unit_rate,
  total_amount,
  discount_percent,
  discount_amount,
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
` as const;

export const SALES_ORDER_MAT_LAYER_SELECT = `
  id,
  configuration_id,
  quotation_mat_layer_id,
  layer_index,
  mat_board_item_id,
  unit_rate,
  items:mat_board_item_id (
    id,
    item_code,
    item_name
  )
` as const;

const numberOrUndefined = (value: number | string | null): number | undefined =>
  value === null || value === "" ? undefined : Number(value);

const asServiceFeeMode = (value: string): FrameQuotationConfiguration["serviceFeeMode"] => {
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

const asInvoiceDisplayMode = (value: string): FrameQuotationConfiguration["invoiceDisplayMode"] =>
  value === "components" || value === "both" ? value : "summary";

const toConfiguration = (row: DbSalesOrderItemConfiguration): FrameQuotationConfiguration => {
  const moldingItem = Array.isArray(row.items) ? row.items[0] : row.items;
  const glazingType =
    row.glazing_type === "clear" ||
    row.glazing_type === "double" ||
    row.glazing_type === "acrylic" ||
    row.glazing_type === "non_glare" ||
    row.glazing_type === "octagon"
      ? row.glazing_type
      : undefined;
  const backingType =
    row.backing_type === "mdf" ||
    row.backing_type === "plywood" ||
    row.backing_type === "sintra" ||
    row.backing_type === "foam"
      ? row.backing_type
      : undefined;

  return {
    id: row.id,
    quotationConfigurationId: row.quotation_configuration_id || undefined,
    width: Number(row.width),
    height: Number(row.height),
    fixedAllowance: Number(row.fixed_allowance) || 0,
    moldingItemId: row.molding_item_id || undefined,
    moldingItemCode: moldingItem?.item_code || undefined,
    moldingItemName: moldingItem?.item_name || undefined,
    moldingStickLength: numberOrUndefined(row.molding_stick_length),
    moldingSticksRequired: numberOrUndefined(row.molding_sticks_required),
    serviceFeeMode: asServiceFeeMode(row.service_fee_mode),
    serviceType: row.service_type || undefined,
    serviceFeeAmount: Number(row.service_fee_amount) || 0,
    totalServiceFee: Number(row.total_service_fee) || 0,
    invoiceDisplayMode: asInvoiceDisplayMode(row.invoice_display_mode),
    billingMode: row.billing_mode === "chop_join" ? "chop_join" : "framing",
    frameQuantity: numberOrUndefined(row.frame_quantity),
    artworkLengthIn: numberOrUndefined(row.artwork_length_in),
    artworkWidthIn: numberOrUndefined(row.artwork_width_in),
    frameWidthIn: numberOrUndefined(row.frame_width_in),
    sizeMode: row.size_mode === "outside" ? "outside" : "artwork",
    overlapIn: numberOrUndefined(row.overlap_in),
    matSource: row.mat_source === "customer" ? "customer" : "store",
    glazingCutToMatOuter: row.glazing_cut_to_mat_outer ?? true,
    matIncluded: row.mat_included ?? undefined,
    glazingIncluded: row.glazing_included ?? undefined,
    glazingType,
    glazingUnitRate: numberOrUndefined(row.glazing_unit_rate),
    glazingSheets: row.glazing_sheets ?? undefined,
    glazingRemarks: row.glazing_remarks || undefined,
    backingType,
    mouldingMaterial:
      row.moulding_material === "polystyrene" || row.moulding_material === "wood"
        ? row.moulding_material
        : undefined,
    backingUnitRate: numberOrUndefined(row.backing_unit_rate),
    frameRate: numberOrUndefined(row.frame_rate),
    matUnitRate: numberOrUndefined(row.mat_unit_rate),
    matBorderLIn: numberOrUndefined(row.mat_border_l_in),
    matBorderWIn: numberOrUndefined(row.mat_border_w_in),
    flexipointsNumerator: numberOrUndefined(row.flexipoints_numerator),
    flexipointsDenominator: numberOrUndefined(row.flexipoints_denominator),
    multipointsNumerator: numberOrUndefined(row.multipoints_numerator),
    multipointsDenominator: numberOrUndefined(row.multipoints_denominator),
  };
};

const toComponent = (row: DbSalesOrderItemComponent): FrameQuotationComponent => {
  const item = Array.isArray(row.items) ? row.items[0] : row.items;
  const uom = Array.isArray(row.units_of_measure) ? row.units_of_measure[0] : row.units_of_measure;
  return {
    id: row.id,
    quotationComponentId: row.quotation_component_id || undefined,
    componentType:
      row.component_type === "molding" ||
      row.component_type === "accessory" ||
      row.component_type === "material"
        ? row.component_type
        : "material",
    source: row.source === "auto" ? "auto" : "manual",
    itemId: row.item_id,
    itemCode: item?.item_code || undefined,
    itemName: item?.item_name || undefined,
    description: row.description || "",
    qtyPerFrame: Number(row.qty_per_frame),
    totalQuantity: Number(row.total_quantity),
    uomId: row.uom_id,
    uomCode: uom?.code || undefined,
    unitRate: Number(row.unit_rate),
    totalAmount: Number(row.total_amount),
    discountPercent: Number(row.discount_percent),
    discountAmount: Number(row.discount_amount),
    roundingMode: row.rounding_mode === "ceil_per_order" ? "ceil_per_order" : "none",
    sortOrder: row.sort_order || 0,
  };
};

const toMatLayer = (row: DbSalesOrderItemMatLayer): FrameQuotationMatLayer => {
  const item = Array.isArray(row.items) ? row.items[0] : row.items;
  return {
    id: row.id,
    quotationMatLayerId: row.quotation_mat_layer_id || undefined,
    layerIndex: row.layer_index,
    matBoardItemId: row.mat_board_item_id,
    matBoardItemCode: item?.item_code || undefined,
    matBoardItemName: item?.item_name || undefined,
    unitRate: Number(row.unit_rate) || 0,
  };
};

export type SalesOrderFrameDetails = {
  frameConfiguration: FrameQuotationConfiguration | null;
  frameComponents: FrameQuotationComponent[];
  matLayers: FrameQuotationMatLayer[];
  frameSizes?: FrameQuotationSize[];
};

/** Reuse existing source FKs; no extra per-line request or rounded-rate inference. */
export function transformSalesOrderQuotationPricing(
  source: DbQuotationPricing | DbQuotationPricing[] | null | undefined,
  configurations: DbSalesOrderItemConfiguration[],
  components: DbSalesOrderItemComponent[]
): QuotationLinePricing | undefined {
  const line = joined(source);
  if (
    !line ||
    configurations.some((config) => !joined(config.source_pricing)) ||
    components.some((component) => !joined(component.source_pricing))
  )
    return undefined;
  const partsByConfiguration = new Map<
    string,
    QuotationLinePricing["sizes"][number]["components"]
  >();
  for (const component of components) {
    if (!component.configuration_id) continue;
    const original = joined(component.source_pricing)!;
    const parts = partsByConfiguration.get(component.configuration_id) ?? [];
    parts.push({
      amount: Number(original.total_amount),
      discountAmount: Number(original.discount_amount),
    });
    partsByConfiguration.set(component.configuration_id, parts);
  }
  return {
    quantity: Number(line.quantity),
    discountAmount: Number(line.discount_amount),
    taxAmount: Number(line.tax_amount),
    lineTotal: Number(line.line_total),
    sizes: configurations.map((config) => {
      const original = joined(config.source_pricing)!;
      return {
        configurationId: config.quotation_configuration_id!,
        quantity: Number(original.frame_quantity),
        serviceFee: Number(original.total_service_fee),
        components: partsByConfiguration.get(config.id) ?? [],
      };
    }),
  };
}

export const transformSalesOrderFrameDetails = (
  configurations: DbSalesOrderItemConfiguration[],
  components: DbSalesOrderItemComponent[],
  matLayersByConfigurationId: Map<string, DbSalesOrderItemMatLayer[]>
): SalesOrderFrameDetails => {
  const orderedConfigurations = [...configurations].sort(
    (left, right) => (left.size_index ?? 0) - (right.size_index ?? 0)
  );
  const componentsByConfigurationId = new Map<string, DbSalesOrderItemComponent[]>();
  for (const component of components) {
    if (!component.configuration_id) continue;
    const existing = componentsByConfigurationId.get(component.configuration_id) || [];
    existing.push(component);
    componentsByConfigurationId.set(component.configuration_id, existing);
  }

  const frameSizes = orderedConfigurations.map((configuration) => ({
    frameConfiguration: toConfiguration(configuration),
    frameComponents: (componentsByConfigurationId.get(configuration.id) || []).map(toComponent),
    matLayers: (matLayersByConfigurationId.get(configuration.id) || []).map(toMatLayer),
  }));
  const firstSize = frameSizes[0];

  return {
    frameConfiguration: firstSize?.frameConfiguration || null,
    frameComponents: components.map(toComponent),
    matLayers: firstSize?.matLayers || [],
    frameSizes,
  };
};

export type LoadedSalesOrderFrameDetails = {
  configurationsByItemId: Map<string, DbSalesOrderItemConfiguration[]>;
  componentsByItemId: Map<string, DbSalesOrderItemComponent[]>;
  matLayersByConfigurationId: Map<string, DbSalesOrderItemMatLayer[]>;
  error: unknown | null;
};

export const loadSalesOrderFrameDetails = async (
  supabase: SupabaseClient,
  orderItemIds: string[]
): Promise<LoadedSalesOrderFrameDetails> => {
  const configurationsByItemId = new Map<string, DbSalesOrderItemConfiguration[]>();
  const componentsByItemId = new Map<string, DbSalesOrderItemComponent[]>();
  const matLayersByConfigurationId = new Map<string, DbSalesOrderItemMatLayer[]>();
  if (orderItemIds.length === 0) {
    return {
      configurationsByItemId,
      componentsByItemId,
      matLayersByConfigurationId,
      error: null,
    };
  }

  const [configurationResult, componentResult] = await Promise.all([
    supabase
      .from("sales_order_item_configurations")
      .select(SALES_ORDER_CONFIGURATION_SELECT)
      .in("order_item_id", orderItemIds)
      .is("deleted_at", null)
      .order("size_index", { ascending: true }),
    supabase
      .from("sales_order_item_components")
      .select(SALES_ORDER_COMPONENT_SELECT)
      .in("order_item_id", orderItemIds)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
  ]);
  if (configurationResult.error || componentResult.error) {
    return {
      configurationsByItemId,
      componentsByItemId,
      matLayersByConfigurationId,
      error: configurationResult.error || componentResult.error,
    };
  }

  for (const configuration of (configurationResult.data || []) as DbSalesOrderItemConfiguration[]) {
    const existing = configurationsByItemId.get(configuration.order_item_id) || [];
    existing.push(configuration);
    configurationsByItemId.set(configuration.order_item_id, existing);
  }
  for (const component of (componentResult.data || []) as DbSalesOrderItemComponent[]) {
    const existing = componentsByItemId.get(component.order_item_id) || [];
    existing.push(component);
    componentsByItemId.set(component.order_item_id, existing);
  }

  const configurationIds = (configurationResult.data || []).map(
    (configuration) => configuration.id
  );
  if (configurationIds.length > 0) {
    const layerResult = await supabase
      .from("sales_order_item_mat_layers")
      .select(SALES_ORDER_MAT_LAYER_SELECT)
      .in("configuration_id", configurationIds)
      .is("deleted_at", null)
      .order("layer_index", { ascending: true });
    if (layerResult.error) {
      return {
        configurationsByItemId,
        componentsByItemId,
        matLayersByConfigurationId,
        error: layerResult.error,
      };
    }
    for (const layer of (layerResult.data || []) as unknown as DbSalesOrderItemMatLayer[]) {
      const existing = matLayersByConfigurationId.get(layer.configuration_id) || [];
      existing.push(layer);
      matLayersByConfigurationId.set(layer.configuration_id, existing);
    }
  }

  return {
    configurationsByItemId,
    componentsByItemId,
    matLayersByConfigurationId,
    error: null,
  };
};

export type SalesOrderMutationFailure = {
  code: string;
  message: string;
  status: 400 | 401 | 403 | 404 | 409 | 500;
};

const SALES_ORDER_MUTATION_FAILURES: Record<string, SalesOrderMutationFailure> = {
  SALES_ORDER_UNAUTHENTICATED: {
    code: "SALES_ORDER_UNAUTHENTICATED",
    message: "Unauthorized",
    status: 401,
  },
  SALES_ORDER_FORBIDDEN: {
    code: "SALES_ORDER_FORBIDDEN",
    message: "You do not have permission to save this sales order.",
    status: 403,
  },
  SALES_ORDER_NOT_FOUND: {
    code: "SALES_ORDER_NOT_FOUND",
    message: "Sales order not found",
    status: 404,
  },
  SALES_ORDER_NOT_EDITABLE: {
    code: "SALES_ORDER_NOT_EDITABLE",
    message: "Only draft sales orders can be edited.",
    status: 409,
  },
  SALES_ORDER_ITEMS_REQUIRED: {
    code: "SALES_ORDER_ITEMS_REQUIRED",
    message: "Add at least one sales order item.",
    status: 400,
  },
  SALES_ORDER_CUSTOMER_INVALID: {
    code: "SALES_ORDER_CUSTOMER_INVALID",
    message: "Select a valid customer for this sales order.",
    status: 400,
  },
  SALES_ORDER_QUOTATION_LINE_INVALID: {
    code: "SALES_ORDER_QUOTATION_LINE_INVALID",
    message: "A selected quotation line is no longer available for this customer.",
    status: 409,
  },
  SALES_ORDER_QUOTATION_FRAME_INVALID: {
    code: "SALES_ORDER_QUOTATION_FRAME_INVALID",
    message: "A selected frame size no longer belongs to this quotation line.",
    status: 409,
  },
  SALES_ORDER_FRAME_SOURCE_REQUIRED: {
    code: "SALES_ORDER_FRAME_SOURCE_REQUIRED",
    message: "Frame configurations can only be added from an accepted quotation.",
    status: 400,
  },
  SALES_ORDER_FRAME_SIZE_INVALID: {
    code: "SALES_ORDER_FRAME_SIZE_INVALID",
    message: "Review the frame sizes and try again.",
    status: 400,
  },
  SALES_ORDER_FRAME_QUANTITY_EXCEEDS_REMAINING: {
    code: "SALES_ORDER_FRAME_QUANTITY_EXCEEDS_REMAINING",
    message: "A frame-size quantity exceeds the quantity remaining on the quotation.",
    status: 409,
  },
  SALES_ORDER_FRAME_QUANTITY_MISMATCH: {
    code: "SALES_ORDER_FRAME_QUANTITY_MISMATCH",
    message: "Frame size quantities must equal the sales order line quantity.",
    status: 400,
  },
};

export const getSalesOrderMutationFailure = (
  internalCode: string | null | undefined
): SalesOrderMutationFailure =>
  (internalCode && SALES_ORDER_MUTATION_FAILURES[internalCode]) || {
    code: "SALES_ORDER_SAVE_FAILED",
    message: "Failed to save sales order",
    status: 500,
  };
