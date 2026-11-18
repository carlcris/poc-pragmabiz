import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { RESOURCES } from "@/constants/resources";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { checkPermissionForUser } from "@/lib/auth/checkPermission";
import { requireRequestContext } from "@/lib/auth/requestContext";
import type { Database, Tables } from "@/types/database.types";
import {
  MAX_STOCK_MOVE_BATCH_SELECTION,
  type StockMoveBatchLookupResponse,
  type StockMoveSourceAvailabilityResponse,
} from "@/types/stock-move";

const PAGE_SIZE = 5;

const sourceParams = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  locationId: z.string().uuid(),
});

const batchLookupQuery = sourceParams.strict().extend({
  search: z.string().trim().max(150).optional(),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
});

const availabilityQuery = sourceParams.strict().extend({
  view: z.literal("availability"),
  selectionMode: z.enum(["include", "exclude"]),
  batchLocationIds: z
    .string()
    .max(MAX_STOCK_MOVE_BATCH_SELECTION * 37 - 1)
    .transform((value) => value.toLowerCase().split(","))
    .pipe(
      z
        .array(z.string().uuid())
        .max(MAX_STOCK_MOVE_BATCH_SELECTION)
        .refine((ids) => new Set(ids).size === ids.length)
    )
    .optional(),
});

const availabilityResponse = z.object({
  availableQuantity: z.number().nonnegative(),
  namedBatches: z
    .array(z.object({ id: z.string().uuid(), qtyAvailable: z.number().positive() }))
    .max(MAX_STOCK_MOVE_BATCH_SELECTION),
});

const querySchema = z.union([batchLookupQuery, availabilityQuery]);

const forbidden = () =>
  NextResponse.json({ error: "You do not have permission to move stock" }, { status: 403 });

const invalidLookup = () =>
  NextResponse.json({ error: "Invalid stock move batch lookup" }, { status: 400 });

type StockMoveBatchLookupRow = Pick<Tables<"item_batch_locations">, "id" | "qty_available"> & {
  batch: Pick<Tables<"item_batches">, "batch_code" | "qty_available">;
};

// Empty related projections enforce scope without exposing related records.
const batchLookupProjection = `
  id, qty_available,
  batch:item_batches!item_batch_locations_item_batch_id_fkey!inner(batch_code, qty_available),
  item:items!item_batch_locations_item_id_fkey!inner(),
  location:warehouse_locations!item_batch_locations_location_id_fkey!inner(),
  warehouse:warehouses!item_batch_locations_warehouse_id_fkey!inner(
    unit:business_units!warehouses_business_unit_id_fkey!inner(
      access:user_business_unit_access!user_business_unit_access_business_unit_id_fkey!inner(
        actor:users!user_business_unit_access_user_id_fkey!inner()
      )
    )
  )
`;

async function getSourceAvailability(
  supabase: SupabaseClient<Database>,
  businessUnitId: string,
  params: z.infer<typeof availabilityQuery>
) {
  const { data, error } = await supabase
    .rpc("get_stock_move_source_availability", {
      p_business_unit_id: businessUnitId,
      p_item_id: params.itemId,
      p_source_warehouse_id: params.warehouseId,
      p_from_location_id: params.locationId,
      p_batch_selection_mode: params.selectionMode,
      p_batch_location_ids: params.batchLocationIds ?? [],
    })
    .single();

  if (error?.code === "42501") return forbidden();
  if (error?.code === "22023") return invalidLookup();
  if (error) throw error;

  const response: StockMoveSourceAvailabilityResponse = availabilityResponse.parse({
    availableQuantity: data.available_quantity,
    namedBatches: data.named_batches,
  });
  return NextResponse.json(response);
}

async function GETHandler(request: NextRequest) {
  try {
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId, userId } = context;
    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Select an active business unit" }, { status: 400 });
    }

    const actor = { id: userId, companyId, businessUnitId: currentBusinessUnitId };
    const [canCreateStockTransaction, canTransferStock] = await Promise.all([
      checkPermissionForUser(actor, RESOURCES.STOCK_TRANSACTIONS, "create"),
      checkPermissionForUser(actor, RESOURCES.TRANSFER_BETWEEN_LOCATIONS, "create"),
    ]);
    if (!canCreateStockTransaction || !canTransferStock) return forbidden();

    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) return invalidLookup();
    if ("view" in parsed.data) {
      return await getSourceAvailability(supabase, currentBusinessUnitId, parsed.data);
    }
    const { itemId, warehouseId, locationId, search, page } = parsed.data;
    const offset = (page - 1) * PAGE_SIZE;

    let query = supabase
      .from("item_batch_locations")
      .select<typeof batchLookupProjection, StockMoveBatchLookupRow>(batchLookupProjection)
      .eq("company_id", companyId)
      .eq("item_id", itemId)
      .eq("warehouse_id", warehouseId)
      .eq("location_id", locationId)
      .is("deleted_at", null)
      .gt("qty_available", 0)
      .eq("batch.company_id", companyId)
      .eq("batch.item_id", itemId)
      .eq("batch.warehouse_id", warehouseId)
      .is("batch.deleted_at", null)
      .gt("batch.qty_available", 0)
      .eq("item.company_id", companyId)
      .eq("item.is_active", true)
      .eq("item.is_stock_item", true)
      .is("item.deleted_at", null)
      .eq("location.company_id", companyId)
      .eq("location.warehouse_id", warehouseId)
      .eq("location.is_active", true)
      .eq("location.is_storable", true)
      .is("location.deleted_at", null)
      .eq("warehouse.company_id", companyId)
      .eq("warehouse.is_active", true)
      .is("warehouse.deleted_at", null)
      .eq("warehouse.business_unit_id", currentBusinessUnitId)
      .eq("warehouse.unit.company_id", companyId)
      .eq("warehouse.unit.is_active", true)
      .eq("warehouse.unit.access.user_id", userId)
      .eq("warehouse.unit.access.actor.company_id", companyId)
      .eq("warehouse.unit.access.actor.is_active", true)
      .is("warehouse.unit.access.actor.deleted_at", null)
      .order("batch(batch_code)")
      .order("id")
      .range(offset, offset + PAGE_SIZE);

    if (search) {
      // Escape regex metacharacters so PostgREST searches for the literal text, including '*'.
      query = query.filter(
        "batch.batch_code",
        "imatch",
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    const response: StockMoveBatchLookupResponse = {
      data: data.slice(0, PAGE_SIZE).map(({ id, qty_available, batch }) => ({
        id,
        batchCode: batch.batch_code,
        qtyAvailable: Math.min(qty_available ?? 0, batch.qty_available ?? 0),
      })),
      hasMore: data.length > PAGE_SIZE,
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to load stock move batches", error);
    return NextResponse.json({ error: "Failed to load available batches" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "lookups",
  route: "/api/lookups/stock-move-batches",
});
