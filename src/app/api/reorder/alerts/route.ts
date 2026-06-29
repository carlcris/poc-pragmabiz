import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import {
  sortItemUnitOptions,
  transformItemUnitOptionRow,
  type DbItemUnitOptionRow,
} from "@/lib/items/itemUnitOptions";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

type ReorderAlertRpcRow = {
  id: string;
  item_id: string;
  item_code: string | null;
  item_name: string | null;
  total_current_stock: number | string | null;
  total_available_stock: number | string | null;
  reorder_point: number | string | null;
  reorder_quantity: number | string | null;
  minimum_level: number | string | null;
  severity: "critical" | "warning" | "info";
  message: string | null;
  policy_source: "season_override" | "item_default";
  season_id: string | null;
  season_code: string | null;
  season_name: string | null;
  warehouse_breakdown: unknown;
  acknowledged: boolean | null;
  acknowledgment_id: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  total_count: number | string | null;
};

type RelatedUom = {
  code: string | null;
  symbol?: string | null;
};

type ReorderAlertItemRow = {
  id: string;
  uom_id: string | null;
  purchase_price: number | string | null;
  import_cost: number | string | null;
  import_currency: string | null;
  sales_price: number | string | null;
  units_of_measure: RelatedUom | RelatedUom[] | null;
  item_unit_options: DbItemUnitOptionRow[] | null;
};

type PolicyUomRow = {
  code: string | null;
  symbol?: string | null;
};

type ReorderAlertPolicyRow = {
  item_id: string;
  season_id: string;
  item_unit_option_id: string | null;
  uom_id: string;
  qty_per_unit: number | string;
  reorder_quantity: number | string;
  units_of_measure: PolicyUomRow | PolicyUomRow[] | null;
};

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const unwrapRelation = <T>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? value[0] || null : value;

const parseAcknowledgmentStatus = (value: string | null) => {
  if (value === "true" || value === "all") return "all";
  if (value === "only" || value === "acknowledged") return "acknowledged";
  return "active";
};

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REORDER_MANAGEMENT, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId } = context;

    const searchParams = request.nextUrl.searchParams;
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = Math.min(parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT), MAX_LIMIT);
    const search = searchParams.get("search")?.trim() || null;
    const severity = searchParams.get("severity")?.trim() || null;
    const asOfDate = searchParams.get("asOfDate")?.trim() || null;
    const acknowledgmentStatus = parseAcknowledgmentStatus(searchParams.get("acknowledged"));

    const { data, error } = await supabase.rpc("get_effective_reorder_alerts", {
      p_company_id: companyId,
      p_as_of_date: asOfDate || undefined,
      p_search: search,
      p_severity: severity,
      p_page: page,
      p_limit: limit,
      p_acknowledgment_status: acknowledgmentStatus,
    });

    if (error) {
      console.error("Error fetching reorder alerts:", error);
      return NextResponse.json({ error: "Failed to fetch reorder alerts" }, { status: 500 });
    }

    const rows = (data || []) as ReorderAlertRpcRow[];
    const itemIds = Array.from(new Set(rows.map((row) => row.item_id).filter(Boolean)));
    const seasonIds = Array.from(
      new Set(
        rows
          .filter((row) => row.policy_source === "season_override" && row.season_id)
          .map((row) => row.season_id as string)
      )
    );
    const itemDetailsById = new Map<string, ReorderAlertItemRow>();
    const policyDetailsByKey = new Map<string, ReorderAlertPolicyRow>();

    if (itemIds.length > 0) {
      const { data: itemRows, error: itemError } = await supabase
        .from("items")
        .select(
          `
          id,
          uom_id,
          purchase_price,
          import_cost,
          import_currency,
          sales_price,
          units_of_measure(code, symbol),
          item_unit_options(
            id,
            item_id,
            uom_id,
            option_label,
            qty_per_unit,
            barcode,
            is_base,
            is_default,
            is_active,
            sort_order,
            units_of_measure(id, code, name, symbol)
          )
        `
        )
        .eq("company_id", companyId)
        .in("id", itemIds)
        .is("deleted_at", null);

      if (itemError) {
        console.error("Error fetching reorder alert item details:", itemError);
        return NextResponse.json({ error: "Failed to fetch reorder alerts" }, { status: 500 });
      }

      for (const itemRow of (itemRows || []) as ReorderAlertItemRow[]) {
        itemDetailsById.set(itemRow.id, itemRow);
      }
    }

    if (itemIds.length > 0 && seasonIds.length > 0) {
      const { data: policyRows, error: policyError } = await supabase
        .from("reorder_season_item_policies")
        .select(
          `
          item_id,
          season_id,
          item_unit_option_id,
          uom_id,
          qty_per_unit,
          reorder_quantity,
          units_of_measure(code, symbol)
        `
        )
        .eq("company_id", companyId)
        .in("item_id", itemIds)
        .in("season_id", seasonIds)
        .eq("is_active", true)
        .is("deleted_at", null);

      if (policyError) {
        console.error("Error fetching reorder alert policy details:", policyError);
        return NextResponse.json({ error: "Failed to fetch reorder alerts" }, { status: 500 });
      }

      for (const policyRow of (policyRows || []) as ReorderAlertPolicyRow[]) {
        policyDetailsByKey.set(`${policyRow.season_id}:${policyRow.item_id}`, policyRow);
      }
    }

    const alerts = rows.map((row) => {
      const currentStock = toNumber(row.total_available_stock);
      const reorderPoint = toNumber(row.reorder_point);
      const reorderQuantity = toNumber(row.reorder_quantity);
      const itemDetails = itemDetailsById.get(row.item_id);
      const baseUom = unwrapRelation(itemDetails?.units_of_measure ?? null);
      const unitOptions = sortItemUnitOptions(
        (itemDetails?.item_unit_options || [])
          .filter((option) => option.is_active)
          .map((option) => transformItemUnitOptionRow(option, baseUom?.code || ""))
      );
      const requisitionUnitOption =
        unitOptions.find((option) => option.isDefault) ||
        unitOptions.find((option) => option.isBase) ||
        unitOptions[0] ||
        null;
      const policyDetails =
        row.policy_source === "season_override" && row.season_id
          ? policyDetailsByKey.get(`${row.season_id}:${row.item_id}`) || null
          : null;
      const policyUnitOption = policyDetails?.item_unit_option_id
        ? unitOptions.find((option) => option.id === policyDetails.item_unit_option_id) || null
        : null;
      const policyUom = unwrapRelation(policyDetails?.units_of_measure ?? null);
      const alertRequisitionUomId =
        policyDetails?.uom_id || requisitionUnitOption?.uomId || itemDetails?.uom_id || "";
      const alertRequisitionUomLabel =
        policyUnitOption?.displayLabel ||
        policyUom?.symbol ||
        policyUom?.code ||
        requisitionUnitOption?.displayLabel ||
        baseUom?.symbol ||
        baseUom?.code ||
        "";
      const alertRequisitionItemUnitOptionId =
        policyDetails?.item_unit_option_id || requisitionUnitOption?.id || "";
      const alertRequisitionQtyPerUnit = policyDetails
        ? toNumber(policyDetails.qty_per_unit) || 1
        : requisitionUnitOption?.qtyPerUnit || 1;
      const importCost =
        itemDetails?.import_cost == null ? null : toNumber(itemDetails.import_cost);
      const purchasePrice = toNumber(itemDetails?.purchase_price);
      const salesPrice = toNumber(itemDetails?.sales_price);
      const requisitionUnitPrice = importCost ?? purchasePrice ?? salesPrice;

      return {
        id: row.id,
        itemId: row.item_id,
        itemCode: row.item_code || "",
        itemName: row.item_name || "",
        currentStock,
        totalCurrentStock: toNumber(row.total_current_stock),
        totalAvailableStock: currentStock,
        reorderPoint,
        reorderQuantity,
        minimumLevel: toNumber(row.minimum_level),
        severity: row.severity,
        message: row.message || "",
        alertType: "low_stock" as const,
        createdAt: new Date().toISOString(),
        acknowledged: Boolean(row.acknowledged),
        acknowledgmentId: row.acknowledgment_id,
        acknowledgedBy: row.acknowledged_by,
        acknowledgedAt: row.acknowledged_at,
        policySource: row.policy_source,
        seasonId: row.season_id,
        seasonCode: row.season_code,
        seasonName: row.season_name,
        warehouseBreakdown: row.warehouse_breakdown,
        warehouseId: null,
        warehouseName: null,
        requisitionUomId: alertRequisitionUomId,
        requisitionUomLabel: alertRequisitionUomLabel,
        requisitionItemUnitOptionId: alertRequisitionItemUnitOptionId,
        requisitionQtyPerUnit: alertRequisitionQtyPerUnit,
        requisitionUnitPrice,
        requisitionUnitPriceCurrency:
          importCost == null ? null : itemDetails?.import_currency || null,
      };
    });

    const total = rows.length > 0 ? toNumber(rows[0].total_count) : 0;

    return NextResponse.json({
      data: alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      },
    });
  } catch (error) {
    console.error("Unexpected error fetching reorder alerts:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "reorder",
  route: "/api/reorder/alerts",
});
