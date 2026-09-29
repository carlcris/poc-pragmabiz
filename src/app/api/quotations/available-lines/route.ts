import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { quotationLinePricing } from "@/lib/sales-orders/sales-order-line-pricing";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import {
  asRpcClient,
  logQuotationError,
  transformDbQuotationItem,
  type DbQuotationItemComponent,
  type DbQuotationItemConfiguration,
  type DbQuotationItemMatLayer,
  type DbQuotationItemWithJoins,
} from "../_shared";
import type {
  FrameQuotationComponent,
  FrameQuotationConfiguration,
  FrameQuotationSize,
} from "@/types/quotation";

type AvailableQuotationLineRow = {
  quotation_id: string;
  quotation_code: string;
  quotation_item_id: string;
  item_id: string;
  item_code: string | null;
  item_name: string | null;
  item_description: string | null;
  quantity: number | string;
  ordered_quantity: number | string;
  remaining_quantity: number | string;
  uom_id: string | null;
  uom_code: string | null;
  uom_name: string | null;
  pricing_tier?: string | null;
  pricing_tier_name?: string | null;
  rate: number | string;
  discount_percent: number | string | null;
  tax_percent: number | string | null;
  line_total: number | string;
  quotation_date: string;
  valid_until: string | null;
};

type AvailableFrameSizeRow = {
  configuration_id: string;
  quoted_quantity: number | string;
  ordered_quantity: number | string;
  remaining_quantity: number | string;
};

const toPositiveInteger = (value: string | null, fallback: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(Math.floor(parsed), max);
};

async function GETHandler(request: NextRequest) {
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
    const customerId = searchParams.get("customerId");
    if (!customerId) {
      return NextResponse.json({ error: "Customer is required" }, { status: 400 });
    }

    const page = toPositiveInteger(searchParams.get("page"), 1, 100000);
    const limit = toPositiveInteger(searchParams.get("limit"), 10, 50);
    const search = searchParams.get("search")?.trim() || null;

    const { data, error } = await asRpcClient(supabase).rpc("get_available_sales_quotation_lines", {
      p_customer_id: customerId,
      p_search: search,
      p_limit: limit,
      p_offset: (page - 1) * limit,
    });

    if (error) {
      logQuotationError("Error loading available quotation lines:", error);
      return NextResponse.json(
        { error: "Failed to load available quotation lines" },
        { status: 500 }
      );
    }

    const rows = (Array.isArray(data) ? data : []) as AvailableQuotationLineRow[];
    const quotationItemIds = rows.map((row) => row.quotation_item_id);

    const { data: configurations, error: configurationsError } =
      quotationItemIds.length > 0
        ? await supabase
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
            .is("deleted_at", null)
            .order("size_index", { ascending: true })
        : { data: [], error: null };

    if (configurationsError) {
      logQuotationError(
        "Error loading available quotation frame configurations:",
        configurationsError
      );
      return NextResponse.json(
        { error: "Failed to load available quotation frame details" },
        { status: 500 }
      );
    }

    const configurationsByItemId = new Map<string, DbQuotationItemConfiguration[]>();
    for (const configuration of (configurations || []) as DbQuotationItemConfiguration[]) {
      const existing = configurationsByItemId.get(configuration.quotation_item_id) || [];
      existing.push(configuration);
      configurationsByItemId.set(configuration.quotation_item_id, existing);
    }

    const configurationIds = Array.from(configurationsByItemId.values())
      .flat()
      .map((configuration) => configuration.id);
    const { data: frameAvailability, error: frameAvailabilityError } =
      quotationItemIds.length > 0
        ? await asRpcClient(supabase).rpc("get_available_sales_quotation_frame_sizes", {
            p_quotation_item_ids: quotationItemIds,
          })
        : { data: [], error: null };
    if (frameAvailabilityError) {
      logQuotationError(
        "Error loading available quotation frame quantities:",
        frameAvailabilityError
      );
      return NextResponse.json(
        { error: "Failed to load available quotation frame details" },
        { status: 500 }
      );
    }
    const frameAvailabilityByConfigurationId = new Map(
      ((frameAvailability || []) as AvailableFrameSizeRow[]).map((availability) => [
        availability.configuration_id,
        availability,
      ])
    );
    const { data: matLayers, error: matLayersError } =
      configurationIds.length > 0
        ? await supabase
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
            .order("layer_index", { ascending: true })
        : { data: [], error: null };
    if (matLayersError) {
      logQuotationError("Error loading available quotation mat layers:", matLayersError);
      return NextResponse.json(
        { error: "Failed to load available quotation frame details" },
        { status: 500 }
      );
    }
    const matLayersByConfigurationId = new Map<string, DbQuotationItemMatLayer[]>();
    for (const layer of (matLayers || []) as unknown as DbQuotationItemMatLayer[]) {
      const existing = matLayersByConfigurationId.get(layer.configuration_id) || [];
      existing.push(layer);
      matLayersByConfigurationId.set(layer.configuration_id, existing);
    }

    const { data: components, error: componentsError } =
      quotationItemIds.length > 0
        ? await supabase
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
            .order("sort_order", { ascending: true })
        : { data: [], error: null };

    if (componentsError) {
      logQuotationError("Error loading available quotation frame components:", componentsError);
      return NextResponse.json(
        { error: "Failed to load available quotation frame details" },
        { status: 500 }
      );
    }

    const componentsByItemId = new Map<string, DbQuotationItemComponent[]>();
    for (const component of (components || []) as DbQuotationItemComponent[]) {
      const existing = componentsByItemId.get(component.quotation_item_id) || [];
      existing.push(component);
      componentsByItemId.set(component.quotation_item_id, existing);
    }

    // The availability RPC returns quantities, not the saved monetary deductions.
    // Fetch only this bounded page's source lines, never reconstruct fixed amounts.
    const { data: pricingRows, error: pricingError } = quotationItemIds.length
      ? await supabase
          .from("sales_quotation_items")
          .select("id, discount_amount, tax_amount, line_total")
          .in("id", quotationItemIds)
          .is("deleted_at", null)
          .limit(quotationItemIds.length)
      : { data: [], error: null };
    if (pricingError || pricingRows?.length !== quotationItemIds.length) {
      logQuotationError("Error loading quotation source pricing:", pricingError);
      return NextResponse.json(
        { error: "Failed to load available quotation details" },
        { status: 500 }
      );
    }
    const pricingById = new Map(pricingRows.map((line) => [line.id, line]));
    const responseRows = rows.map((row) => {
      const pricing = pricingById.get(row.quotation_item_id)!;
      const quotationItem: DbQuotationItemWithJoins = {
        id: row.quotation_item_id,
        quotation_id: row.quotation_id,
        item_id: row.item_id,
        item_description: row.item_description,
        quantity: row.remaining_quantity,
        fulfilled_qty: 0,
        uom_id: row.uom_id,
        pricing_tier: row.pricing_tier || null,
        pricing_tier_name: row.pricing_tier_name || null,
        rate: row.rate,
        discount_percent: row.discount_percent,
        discount_amount: pricing.discount_amount,
        tax_percent: row.tax_percent,
        tax_amount: pricing.tax_amount,
        line_total: pricing.line_total,
        sort_order: 0,
        items: {
          id: row.item_id,
          item_code: row.item_code,
          item_name: row.item_name,
        },
        units_of_measure: row.uom_id
          ? {
              id: row.uom_id,
              code: row.uom_code,
              name: row.uom_name,
            }
          : null,
      };
      const transformed = transformDbQuotationItem(
        quotationItem,
        configurationsByItemId.get(row.quotation_item_id) || [],
        componentsByItemId.get(row.quotation_item_id) || [],
        matLayersByConfigurationId
      );
      const sourceFrameSizes: FrameQuotationSize[] =
        transformed.frameSizes ||
        (transformed.frameConfiguration
          ? [
              {
                frameConfiguration: transformed.frameConfiguration,
                frameComponents: transformed.frameComponents || [],
                matLayers: transformed.matLayers || [],
              },
            ]
          : []);
      const availableFrameSizes = sourceFrameSizes.map((size) => {
        const sourceConfigurationId = size.frameConfiguration.id || "";
        const availability = frameAvailabilityByConfigurationId.get(sourceConfigurationId);
        const quotedQuantity = Number(
          availability?.quoted_quantity ?? size.frameConfiguration.frameQuantity ?? 0
        );
        const orderedQuantity = Number(availability?.ordered_quantity ?? 0);
        const remainingQuantity = Number(
          availability?.remaining_quantity ?? size.frameConfiguration.frameQuantity ?? 0
        );
        return {
          ...size,
          quotedQuantity,
          orderedQuantity,
          remainingQuantity,
          frameConfiguration: {
            ...size.frameConfiguration,
            quotationConfigurationId: sourceConfigurationId,
            frameQuantity: remainingQuantity,
          },
        };
      });

      return {
        ...transformed,
        quotationPricing: quotationLinePricing({ ...transformed, quantity: Number(row.quantity) }),
        quotationId: row.quotation_id,
        quotationNumber: row.quotation_code,
        quotationItemId: row.quotation_item_id,
        quotationRemainingQuantity: Number(row.remaining_quantity),
        quotationQuantity: Number(row.quantity),
        quotationOrderedQuantity: Number(row.ordered_quantity),
        frameConfiguration: transformed.frameConfiguration as FrameQuotationConfiguration | null,
        frameComponents: transformed.frameComponents as FrameQuotationComponent[],
        frameSizes: availableFrameSizes.length > 0 ? availableFrameSizes : undefined,
      };
    });

    return NextResponse.json({
      data: responseRows,
      pagination: {
        page,
        limit,
        hasMore: rows.length === limit,
      },
    });
  } catch (error) {
    logQuotationError("Unexpected available quotation lines error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "quotations",
  route: "/api/quotations/available-lines",
});
