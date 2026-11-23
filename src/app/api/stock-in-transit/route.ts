import { NextRequest, NextResponse } from "next/server";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { getCurrentPricingDate } from "@/lib/pricing/pricing-date";
import { RESOURCES } from "@/constants/resources";
import type { Database, Json } from "@/types/database.types";
import type {
  StockInTransitArrivalRow,
  StockInTransitArrivalWindow,
  StockInTransitArrivalWindowOrderedUnitTotals,
  StockInTransitDestinationTotal,
  StockInTransitItemArrivalsResponse,
  StockInTransitItemRow,
  StockInTransitItemsResponse,
  StockInTransitOrderedUnitTotal,
} from "@/types/stock-in-transit";

type StockInTransitItemRpcRow =
  Database["public"]["Functions"]["get_stock_in_transit_item_summary_page"]["Returns"][number];
type StockInTransitArrivalRpcRow =
  Database["public"]["Functions"]["get_stock_in_transit_item_arrivals_page"]["Returns"][number];

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;
const MAX_RPC_INTEGER = 2_147_483_647;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ARRIVAL_WINDOWS: readonly StockInTransitArrivalWindow[] = [
  "late",
  "next_7_days",
  "days_8_to_14",
  "later",
  "no_eta",
];

const parsePositiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= MAX_RPC_INTEGER
    ? parsed
    : fallback;
};

const toNumber = (value: number | string | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeSearch = (value: string | null) => {
  const normalized = value
    ?.trim()
    .slice(0, 100)
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  return normalized || null;
};

const toArrivalWindow = (value: string): StockInTransitArrivalWindow => {
  const arrivalWindow = ARRIVAL_WINDOWS.find((candidate) => candidate === value);
  if (!arrivalWindow) throw new Error("Unexpected stock in transit arrival window");
  return arrivalWindow;
};

const toOrderedUnitTotals = (value: Json | undefined): StockInTransitOrderedUnitTotal[] => {
  if (!Array.isArray(value)) throw new Error("Unexpected stock in transit ordered unit totals");

  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Unexpected stock in transit ordered unit total");
    }
    const unitName = entry.unit_name;
    const quantity = entry.quantity;
    const quantityPerUnit = entry.qty_per_unit;
    if (
      typeof unitName !== "string" ||
      (typeof quantity !== "number" && typeof quantity !== "string") ||
      typeof quantityPerUnit !== "number" ||
      !Number.isFinite(quantityPerUnit) ||
      quantityPerUnit <= 0
    ) {
      throw new Error("Unexpected stock in transit ordered unit total");
    }
    return { unitName, quantity: toNumber(quantity), quantityPerUnit };
  });
};

const toArrivalWindowOrderedUnitTotals = (
  value: Json | undefined
): StockInTransitArrivalWindowOrderedUnitTotals => {
  if (value === undefined) {
    return { late: [], next_7_days: [], days_8_to_14: [], later: [], no_eta: [] };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Unexpected stock in transit arrival window unit totals");
  }
  return {
    late: toOrderedUnitTotals(value.late ?? []),
    next_7_days: toOrderedUnitTotals(value.next_7_days ?? []),
    days_8_to_14: toOrderedUnitTotals(value.days_8_to_14 ?? []),
    later: toOrderedUnitTotals(value.later ?? []),
    no_eta: toOrderedUnitTotals(value.no_eta ?? []),
  };
};

const toDestinationTotals = (value: Json): StockInTransitDestinationTotal[] => {
  if (!Array.isArray(value)) throw new Error("Unexpected stock in transit destination totals");

  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Unexpected stock in transit destination total");
    }
    const id = entry.destination_business_unit_id;
    const name = entry.destination_business_unit_name;
    const quantity = entry.base_quantity;
    if (
      typeof id !== "string" ||
      (typeof name !== "string" && name !== null) ||
      (typeof quantity !== "number" && typeof quantity !== "string")
    ) {
      throw new Error("Unexpected stock in transit destination total");
    }
    return {
      destinationBusinessUnitId: id,
      destinationBusinessUnitName: name,
      baseQuantity: toNumber(quantity),
      orderedUnitTotals: toOrderedUnitTotals(entry.ordered_unit_totals),
    };
  });
};

const mapItemRow = (row: StockInTransitItemRpcRow): StockInTransitItemRow => ({
  itemId: row.item_id,
  itemCode: row.item_code,
  itemName: row.item_name,
  baseUnitName: row.base_unit_name,
  totalBaseQuantity: toNumber(row.total_base_quantity),
  orderedUnitTotals: toOrderedUnitTotals(row.ordered_unit_totals),
  shipmentCount: toNumber(row.shipment_count),
  nextEstimatedArrivalDate: row.next_estimated_arrival_date,
  nextDaysUntilArrival: row.next_days_until_arrival,
  nextArrivalWindow: toArrivalWindow(row.next_arrival_window),
});

const mapArrivalRow = (row: StockInTransitArrivalRpcRow): StockInTransitArrivalRow => ({
  loadListId: row.load_list_id,
  loadListNumber: row.ll_number,
  supplierName: row.supplier_name,
  sourceBusinessUnitId: row.source_business_unit_id,
  destinationBusinessUnitId: row.destination_business_unit_id,
  destinationBusinessUnitName: row.destination_business_unit_name,
  estimatedArrivalDate: row.estimated_arrival_date,
  daysUntilArrival: row.days_until_arrival,
  arrivalWindow: toArrivalWindow(row.arrival_window),
  linerName: row.liner_name,
  containerNumber: row.container_number,
  baseQuantity: toNumber(row.base_quantity),
  orderedUnitTotals: toOrderedUnitTotals(row.ordered_unit_totals),
  arrivalBaseQuantity: toNumber(row.arrival_base_quantity),
  arrivalOrderedUnitTotals: toOrderedUnitTotals(row.arrival_ordered_unit_totals),
  arrivalShipmentCount: toNumber(row.arrival_shipment_count),
  arrivalContainerCount: toNumber(row.arrival_container_count),
  arrivalDestinationTotals: toDestinationTotals(row.arrival_destination_totals),
});

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;

    const view = request.nextUrl.searchParams.get("view");
    if (view !== "items" && view !== "arrivals") {
      return NextResponse.json({ error: "Invalid stock in transit view" }, { status: 400 });
    }

    const itemId = request.nextUrl.searchParams.get("itemId");
    if (view === "arrivals" && (!itemId || !UUID_PATTERN.test(itemId))) {
      return NextResponse.json({ error: "Invalid stock in transit item" }, { status: 400 });
    }

    const page = parsePositiveInteger(request.nextUrl.searchParams.get("page"), 1);
    const limit = Math.min(
      parsePositiveInteger(request.nextUrl.searchParams.get("limit"), DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE
    );
    const asOfDate = await getCurrentPricingDate(
      context.supabase,
      context.companyId,
      context.currentBusinessUnitId ?? null
    );

    if (view === "items") {
      const { data, error } = await context.supabase.rpc("get_stock_in_transit_item_summary_page", {
        p_company_id: context.companyId,
        p_as_of_date: asOfDate,
        p_search: normalizeSearch(request.nextUrl.searchParams.get("search")),
        p_page: page,
        p_limit: limit,
      });

      if (error) {
        console.error("Failed to fetch stock in transit items:", error);
        return NextResponse.json({ error: "Failed to fetch stock in transit" }, { status: 500 });
      }

      const rows: StockInTransitItemRpcRow[] = data ?? [];
      const total = rows.length > 0 ? toNumber(rows[0].total_count) : 0;
      const response: StockInTransitItemsResponse = {
        data: rows.map(mapItemRow),
        summary: {
          loadListCount: rows.length > 0 ? toNumber(rows[0].load_list_count) : 0,
          lateLoadListCount: rows.length > 0 ? toNumber(rows[0].late_load_list_count) : 0,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      };

      return NextResponse.json(response);
    }

    const { data, error } = await context.supabase.rpc("get_stock_in_transit_item_arrivals_page", {
      p_company_id: context.companyId,
      p_item_id: itemId!,
      p_as_of_date: asOfDate,
      p_page: page,
      p_limit: limit,
    });

    if (error) {
      console.error("Failed to fetch stock in transit arrivals:", error);
      return NextResponse.json({ error: "Failed to fetch stock in transit" }, { status: 500 });
    }

    const rows: StockInTransitArrivalRpcRow[] = data ?? [];
    const firstRow = rows[0];
    const total = firstRow ? toNumber(firstRow.total_count) : 0;
    const response: StockInTransitItemArrivalsResponse = {
      data: rows.map(mapArrivalRow),
      summary: {
        arrivalWindowTotals: {
          late: toNumber(firstRow?.late_base_quantity),
          next_7_days: toNumber(firstRow?.next_7_days_base_quantity),
          days_8_to_14: toNumber(firstRow?.days_8_to_14_base_quantity),
          later: toNumber(firstRow?.later_base_quantity),
          no_eta: toNumber(firstRow?.no_eta_base_quantity),
        },
        arrivalWindowOrderedUnitTotals: toArrivalWindowOrderedUnitTotals(
          firstRow?.arrival_window_ordered_unit_totals
        ),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected stock in transit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "stock_in_transit",
  route: "/api/stock-in-transit",
});
