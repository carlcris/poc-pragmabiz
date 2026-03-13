import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";

type ShipmentStageFilter = "all" | "incoming" | "in_transit" | "arrived";

type LoadListReportRow = {
  id: string;
  ll_number: string;
  supplier_ll_number: string | null;
  container_number: string | null;
  seal_number: string | null;
  batch_number: string | null;
  liner_name: string | null;
  estimated_arrival_date: string | null;
  actual_arrival_date: string | null;
  load_date: string | null;
  status: string;
  created_at: string;
  supplier?:
    | { supplier_name: string | null; supplier_code: string | null }
    | { supplier_name: string | null; supplier_code: string | null }[]
    | null;
  warehouse?:
    | { warehouse_name: string | null; warehouse_code: string | null }
    | { warehouse_name: string | null; warehouse_code: string | null }[]
    | null;
  business_unit?:
    | { name: string | null }
    | { name: string | null }[]
    | null;
  load_list_items?:
    | {
        load_list_qty: number | string | null;
        received_qty: number | string | null;
        shortage_qty: number | string | null;
        damaged_qty: number | string | null;
        total_price: number | string | null;
      }[]
    | null;
};

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

const one = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const toNumber = (value: number | string | null | undefined) => {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapStageToStatuses = (shipmentStage: ShipmentStageFilter) => {
  if (shipmentStage === "incoming") return ["pending_approval", "confirmed"];
  if (shipmentStage === "in_transit") return ["in_transit"];
  if (shipmentStage === "arrived") return ["arrived", "receiving", "received"];
  return ["pending_approval", "confirmed", "in_transit", "arrived", "receiving", "received"];
};

const getShipmentStage = (status: string): Exclude<ShipmentStageFilter, "all"> => {
  if (status === "pending_approval" || status === "confirmed") return "incoming";
  if (status === "in_transit") return "in_transit";
  return "arrived";
};

export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REPORTS, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId } = context;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(
      Math.max(
        Number.parseInt(searchParams.get("limit") || `${DEFAULT_PAGE_SIZE}`, 10) || DEFAULT_PAGE_SIZE,
        10
      ),
      MAX_PAGE_SIZE
    );
    const search = searchParams.get("search")?.trim() || null;
    const supplierId = searchParams.get("supplierId") || null;
    const shipmentStage = (searchParams.get("shipmentStage") || "all") as ShipmentStageFilter;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("load_lists")
      .select(
        `
        id,
        ll_number,
        supplier_ll_number,
        container_number,
        seal_number,
        batch_number,
        liner_name,
        estimated_arrival_date,
        actual_arrival_date,
        load_date,
        status,
        created_at,
        supplier:suppliers(supplier_name, supplier_code),
        warehouse:warehouses(warehouse_name, warehouse_code),
        business_unit:business_units(name),
        load_list_items(
          load_list_qty,
          received_qty,
          shortage_qty,
          damaged_qty,
          total_price
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .in("status", mapStageToStatuses(shipmentStage));

    if (currentBusinessUnitId) {
      query = query.eq("business_unit_id", currentBusinessUnitId);
    }

    if (supplierId) {
      query = query.eq("supplier_id", supplierId);
    }

    if (search) {
      query = query.or(
        `ll_number.ilike.%${search}%,supplier_ll_number.ilike.%${search}%,container_number.ilike.%${search}%,seal_number.ilike.%${search}%,batch_number.ilike.%${search}%,liner_name.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query
      .range(from, to)
      .order("estimated_arrival_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch shipments report" }, { status: 500 });
    }

    const rows = ((data || []) as LoadListReportRow[]).map((row) => {
      const supplier = one(row.supplier);
      const warehouse = one(row.warehouse);
      const businessUnit = one(row.business_unit);
      const items = row.load_list_items || [];

      return {
        id: row.id,
        llNumber: row.ll_number,
        supplierLlNumber: row.supplier_ll_number,
        supplierName: supplier?.supplier_name || "",
        supplierCode: supplier?.supplier_code || null,
        warehouseName: warehouse?.warehouse_name || "",
        warehouseCode: warehouse?.warehouse_code || null,
        businessUnitName: businessUnit?.name || null,
        containerNumber: row.container_number,
        sealNumber: row.seal_number,
        batchNumber: row.batch_number,
        linerName: row.liner_name,
        shipmentStage: getShipmentStage(row.status),
        status: row.status,
        estimatedArrivalDate: row.estimated_arrival_date,
        actualArrivalDate: row.actual_arrival_date,
        loadDate: row.load_date,
        itemCount: items.length,
        totalQuantity: items.reduce((sum, item) => sum + toNumber(item.load_list_qty), 0),
        totalValue: items.reduce((sum, item) => sum + toNumber(item.total_price), 0),
        receivedQuantity: items.reduce((sum, item) => sum + toNumber(item.received_qty), 0),
        shortageQuantity: items.reduce((sum, item) => sum + toNumber(item.shortage_qty), 0),
        damagedQuantity: items.reduce((sum, item) => sum + toNumber(item.damaged_qty), 0),
        createdAt: row.created_at,
      };
    });

    const summary = rows.reduce(
      (accumulator, row) => {
        accumulator.totalShipments += 1;
        accumulator.totalContainers += row.containerNumber ? 1 : 0;
        accumulator.totalQuantity += row.totalQuantity;
        accumulator.totalValue += row.totalValue;
        if (row.shipmentStage === "incoming") accumulator.incomingCount += 1;
        if (row.shipmentStage === "in_transit") accumulator.inTransitCount += 1;
        if (row.shipmentStage === "arrived") accumulator.arrivedCount += 1;
        return accumulator;
      },
      {
        totalShipments: 0,
        totalContainers: 0,
        totalQuantity: 0,
        totalValue: 0,
        incomingCount: 0,
        inTransitCount: 0,
        arrivedCount: 0,
      }
    );

    return NextResponse.json({
      data: rows,
      summary,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.max(1, Math.ceil((count || 0) / limit)),
      },
      filters: {
        search,
        supplierId,
        shipmentStage,
        currentBusinessUnitId,
      },
    });
  } catch (error) {
    console.error("Error generating shipments report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
