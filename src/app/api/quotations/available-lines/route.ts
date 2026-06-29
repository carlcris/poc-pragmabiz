import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import {
  asRpcClient,
  logQuotationError,
  transformDbQuotationItem,
  type DbQuotationItemWithJoins,
} from "../_shared";
import type { FrameQuotationComponent, FrameQuotationConfiguration } from "@/types/quotation";

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
  items?: { id: string; item_code: string | null; item_name: string | null } | null;
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
  items?: { id: string; item_code: string | null; item_name: string | null } | null;
  units_of_measure?: { id: string; code: string | null; name: string | null } | null;
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

    const { data: configurations } =
      quotationItemIds.length > 0
        ? await supabase
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
            .is("deleted_at", null)
        : { data: [] };

    const configurationsByItemId = new Map(
      ((configurations || []) as DbQuotationItemConfiguration[]).map((configuration) => [
        configuration.quotation_item_id,
        configuration,
      ])
    );

    const { data: components } =
      quotationItemIds.length > 0
        ? await supabase
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
            .order("sort_order", { ascending: true })
        : { data: [] };

    const componentsByItemId = new Map<string, DbQuotationItemComponent[]>();
    for (const component of (components || []) as DbQuotationItemComponent[]) {
      const existing = componentsByItemId.get(component.quotation_item_id) || [];
      existing.push(component);
      componentsByItemId.set(component.quotation_item_id, existing);
    }

    const responseRows = rows.map((row) => {
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
        discount_amount: 0,
        tax_percent: row.tax_percent,
        tax_amount: 0,
        line_total: row.line_total,
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
        configurationsByItemId.get(row.quotation_item_id) || null,
        componentsByItemId.get(row.quotation_item_id) || []
      );

      return {
        ...transformed,
        quotationId: row.quotation_id,
        quotationNumber: row.quotation_code,
        quotationItemId: row.quotation_item_id,
        quotationRemainingQuantity: Number(row.remaining_quantity),
        quotationQuantity: Number(row.quantity),
        quotationOrderedQuantity: Number(row.ordered_quantity),
        frameConfiguration: transformed.frameConfiguration as FrameQuotationConfiguration | null,
        frameComponents: transformed.frameComponents as FrameQuotationComponent[],
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
