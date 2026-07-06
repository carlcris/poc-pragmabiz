import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import type { PutawayTaskLabel } from "@/types/putaway-task";

type PutawayTransactionItemRow = {
  id: string;
  item_id: string;
  quantity: number | string | null;
  batch_no: string | null;
  transaction:
    | {
        transaction_date: string;
        reference_code: string | null;
        warehouse_id: string | null;
        to_location_id: string | null;
        warehouse:
          | { warehouse_code: string | null }
          | { warehouse_code: string | null }[]
          | null;
        toLocation: { id: string; code: string | null } | { id: string; code: string | null }[] | null;
      }
    | {
        transaction_date: string;
        reference_code: string | null;
        warehouse_id: string | null;
        to_location_id: string | null;
        warehouse:
          | { warehouse_code: string | null }
          | { warehouse_code: string | null }[]
          | null;
        toLocation: { id: string; code: string | null } | { id: string; code: string | null }[] | null;
      }[]
    | null;
  item:
    | { id: string; item_code: string | null; item_name: string | null }
    | { id: string; item_code: string | null; item_name: string | null }[]
    | null;
};

type BatchLocationSkuRow = {
  id: string;
  item_id: string;
  warehouse_id: string;
  location_id: string;
  batch_location_sku: string | null;
  itemBatch: { batch_code: string | null } | { batch_code: string | null }[] | null;
};

const one = <T,>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

const parseNumber = (value: number | string | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, "view");
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const { supabase, companyId, currentBusinessUnitId } = await createServerClientWithBU();
  if (!companyId) {
    return NextResponse.json({ error: "User company not found" }, { status: 400 });
  }

  let query = supabase
    .from("stock_transaction_items")
    .select(
      `
        id,
        item_id,
        quantity,
        batch_no,
        transaction:stock_transactions!inner(
          transaction_date,
          reference_code,
          warehouse_id,
          to_location_id,
          reference_type,
          reference_id,
          company_id,
          business_unit_id,
          deleted_at,
          warehouse:warehouses!stock_transactions_warehouse_id_fkey(warehouse_code),
          toLocation:warehouse_locations!stock_transactions_to_location_id_fkey(id, code)
        ),
        item:items!inner(id, item_code, item_name)
      `
    )
    .eq("transaction.company_id", companyId)
    .eq("transaction.reference_type", "putaway_task")
    .eq("transaction.reference_id", id)
    .is("transaction.deleted_at", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(100);

  if (currentBusinessUnitId) {
    query = query.eq("transaction.business_unit_id", currentBusinessUnitId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching putaway labels:", error);
    return NextResponse.json({ error: "Failed to fetch putaway labels" }, { status: 500 });
  }

  const rows = (data || []) as unknown as PutawayTransactionItemRow[];
  const batchCodes = Array.from(
    new Set(rows.map((row) => row.batch_no).filter((value): value is string => !!value))
  );
  const locationIds = Array.from(
    new Set(
      rows
        .map((row) => one(row.transaction)?.to_location_id)
        .filter((value): value is string => !!value)
    )
  );
  const itemIds = Array.from(new Set(rows.map((row) => row.item_id)));
  const warehouseIds = Array.from(
    new Set(
      rows
        .map((row) => one(row.transaction)?.warehouse_id)
        .filter((value): value is string => !!value)
    )
  );

  let skuByKey = new Map<string, string | null>();
  if (
    batchCodes.length > 0 &&
    locationIds.length > 0 &&
    itemIds.length > 0 &&
    warehouseIds.length > 0
  ) {
    const { data: batchLocations, error: batchLocationError } = await supabase
      .from("item_batch_locations")
      .select(
        `
          id,
          item_id,
          warehouse_id,
          location_id,
          batch_location_sku,
          itemBatch:item_batches!item_batch_locations_item_batch_id_fkey!inner(batch_code)
        `
      )
      .eq("company_id", companyId)
      .in("item_id", itemIds)
      .in("warehouse_id", warehouseIds)
      .in("location_id", locationIds)
      .in("itemBatch.batch_code", batchCodes)
      .is("deleted_at", null)
      .limit(500);

    if (batchLocationError) {
      console.error("Error fetching putaway label SKUs:", batchLocationError);
      return NextResponse.json({ error: "Failed to fetch putaway labels" }, { status: 500 });
    }

    skuByKey = new Map(
      ((batchLocations || []) as unknown as BatchLocationSkuRow[]).map((batchLocation) => {
        const itemBatch = one(batchLocation.itemBatch);
        return [
          [
            batchLocation.item_id,
            batchLocation.warehouse_id,
            batchLocation.location_id,
            itemBatch?.batch_code || "",
          ].join("|"),
          batchLocation.batch_location_sku,
        ];
      })
    );
  }

  const labels: PutawayTaskLabel[] = rows.map(
    (row, index) => {
      const transaction = one(row.transaction);
      const warehouse = one(transaction?.warehouse);
      const location = one(transaction?.toLocation);
      const item = one(row.item);
      const skuKey = [
        row.item_id,
        transaction?.warehouse_id || "",
        transaction?.to_location_id || "",
        row.batch_no || "",
      ].join("|");

      return {
        boxId: `putaway-${row.id}`,
        itemId: item?.id || "",
        batchLocationSku: skuByKey.get(skuKey) ?? null,
        batchNumber: row.batch_no || "",
        referenceNumber: transaction?.reference_code || "PUTAWAY",
        itemCode: item?.item_code || "",
        itemName: item?.item_name || "",
        boxNumber: index + 1,
        quantity: parseNumber(row.quantity),
        postedDate: transaction?.transaction_date || new Date().toISOString().split("T")[0],
        warehouseCode: warehouse?.warehouse_code ?? null,
        locationId: location?.id ?? null,
        locationCode: location?.code ?? null,
      };
    }
  );

  return NextResponse.json({ data: labels });
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "putaway_task_labels",
  route: "/api/putaway-tasks/[id]/labels",
});
