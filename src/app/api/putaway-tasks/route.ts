import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import type { PutawayTask, PutawayTaskStatus } from "@/types/putaway-task";

type PutawayTaskRow = {
  id: string;
  company_id: string;
  business_unit_id: string | null;
  warehouse_id: string;
  item_id: string;
  uom_id: string | null;
  source_type: string;
  source_id: string;
  source_line_id: string;
  source_reference: string | null;
  source_batch_code: string | null;
  quantity: number | string;
  pending_quantity: number | string;
  posted_quantity: number | string;
  unit_cost: number | string;
  status: PutawayTaskStatus;
  notes: string | null;
  created_at: string;
  warehouse:
    | { warehouse_code: string | null; warehouse_name: string | null }
    | { warehouse_code: string | null; warehouse_name: string | null }[]
    | null;
  item: { item_code: string | null; item_name: string | null } | { item_code: string | null; item_name: string | null }[] | null;
  uom: { code: string | null; name: string | null } | { code: string | null; name: string | null }[] | null;
};

const parsePositiveInt = (value: string | null, fallback: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const parseNumber = (value: number | string | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const quotePostgrestFilterValue = (value: string) =>
  `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const one = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const mapTask = (row: PutawayTaskRow): PutawayTask => ({
  id: row.id,
  companyId: row.company_id,
  businessUnitId: row.business_unit_id,
  warehouseId: row.warehouse_id,
  warehouseCode: one(row.warehouse)?.warehouse_code ?? null,
  warehouseName: one(row.warehouse)?.warehouse_name ?? null,
  itemId: row.item_id,
  itemCode: one(row.item)?.item_code ?? null,
  itemName: one(row.item)?.item_name ?? null,
  uomId: row.uom_id,
  uomCode: one(row.uom)?.code ?? null,
  uomName: one(row.uom)?.name ?? null,
  sourceType: row.source_type,
  sourceId: row.source_id,
  sourceLineId: row.source_line_id,
  sourceReference: row.source_reference,
  sourceBatchCode: row.source_batch_code,
  quantity: parseNumber(row.quantity),
  pendingQuantity: parseNumber(row.pending_quantity),
  postedQuantity: parseNumber(row.posted_quantity),
  unitCost: parseNumber(row.unit_cost),
  status: row.status,
  notes: row.notes,
  createdAt: row.created_at,
});

async function GETHandler(request: NextRequest) {
  const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, "view");
  if (unauthorized) return unauthorized;

  const { supabase, companyId, currentBusinessUnitId } = await createServerClientWithBU();
  if (!companyId) {
    return NextResponse.json({ error: "User company not found" }, { status: 400 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parsePositiveInt(searchParams.get("page"), 1, 500);
  const limit = parsePositiveInt(searchParams.get("limit"), 20, 100);
  const status = searchParams.get("status") || "open";
  const warehouseId = searchParams.get("warehouseId");
  const search = searchParams.get("search")?.trim();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("putaway_tasks")
    .select(
      `
      id,
      company_id,
      business_unit_id,
      warehouse_id,
      item_id,
      uom_id,
      source_type,
      source_id,
      source_line_id,
      source_reference,
      source_batch_code,
      quantity,
      pending_quantity,
      posted_quantity,
      unit_cost,
      status,
      notes,
      created_at,
      warehouse:warehouses!putaway_tasks_warehouse_id_fkey(warehouse_code, warehouse_name),
      item:items!putaway_tasks_item_id_fkey(item_code, item_name),
      uom:units_of_measure!putaway_tasks_uom_id_fkey(code, name)
    `,
      { count: "exact" }
    )
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (currentBusinessUnitId) {
    query = query.eq("business_unit_id", currentBusinessUnitId);
  }

  if (status === "open") {
    query = query.in("status", ["pending", "partial"]);
  } else if (status !== "all") {
    query = query.eq("status", status);
  }

  if (warehouseId) {
    query = query.eq("warehouse_id", warehouseId);
  }

  if (search) {
    const searchPattern = quotePostgrestFilterValue(`%${search}%`);
    query = query.or(
      `source_reference.ilike.${searchPattern},source_type.ilike.${searchPattern},source_batch_code.ilike.${searchPattern}`
    );
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching putaway tasks:", error);
    return NextResponse.json({ error: "Failed to fetch putaway tasks" }, { status: 500 });
  }

  const total = count ?? 0;
  return NextResponse.json({
    data: ((data || []) as unknown as PutawayTaskRow[]).map(mapTask),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "putaway_tasks",
  route: "/api/putaway-tasks",
});
