import { warehouseLocationErrorResponse } from "@/lib/warehouse-location-errors";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import type { Database } from "@/types/database.types";
import type { WarehouseLocationBatchPreview } from "@/types/inventory-location";

type RouteContext = { params: Promise<{ id: string }> };
type DatabaseFunctions = Database["public"]["Functions"];
type BatchPreviewRow = DatabaseFunctions["preview_warehouse_locations_batch"]["Returns"][number];
type BatchCreateRow = DatabaseFunctions["create_warehouse_locations_batch"]["Returns"][number];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BATCH_SIZE = 100;

const batchRangeShape = {
  parentId: z.string().uuid().nullable().optional(),
  codePrefix: z.string().max(100),
  from: z.number().int().min(0).max(999_999),
  to: z.number().int().min(0).max(999_999),
  digits: z.number().int().min(1).max(6),
  namePrefix: z.string().max(200).nullable().optional(),
};

const isBoundedRange = (range: { from: number; to: number }) =>
  range.to >= range.from && range.to - range.from < MAX_BATCH_SIZE;

const previewQuerySchema = z
  .object({
    ...batchRangeShape,
    from: z.coerce.number().int().min(0).max(999_999),
    to: z.coerce.number().int().min(0).max(999_999),
    digits: z.coerce.number().int().min(1).max(6),
  })
  .refine(isBoundedRange, { message: "Enter a range of up to 100 numbers" });

const createBatchSchema = z
  .object({
    ...batchRangeShape,
    locationType: z.enum(["zone", "aisle", "rack", "shelf", "bin", "crate"]),
    isStorable: z.boolean(),
    isPickable: z.boolean(),
    isActive: z.boolean(),
    maxCapacity: z.number().finite().positive().max(999_999_999_999_999_999).nullable(),
    skipExisting: z.boolean(),
  })
  .refine(isBoundedRange, { message: "Enter a range of up to 100 numbers" })
  .refine((value) => value.isStorable || (!value.isPickable && value.maxCapacity === null), {
    message: "Only storable locations can be pickable or have a capacity",
  });

const invalidBatch = (message: string) =>
  NextResponse.json({ error: message, code: "LOCATION_BATCH_INVALID" }, { status: 400 });

async function resolveContext(params: RouteContext["params"]) {
  const requestContext = await requireRequestContext();
  if ("status" in requestContext) return { response: requestContext };
  if (!requestContext.currentBusinessUnitId) {
    return {
      response: NextResponse.json(
        { error: "Business unit context required", code: "BUSINESS_UNIT_CONTEXT_REQUIRED" },
        { status: 400 }
      ),
    };
  }
  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return {
      response: NextResponse.json(
        { error: "Invalid warehouse id", code: "INVALID_WAREHOUSE_ID" },
        { status: 400 }
      ),
    };
  }
  return {
    supabase: requestContext.supabase,
    businessUnitId: requestContext.currentBusinessUnitId,
    warehouseId: id,
  };
}

async function GETHandler(request: NextRequest, { params }: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.MANAGE_LOCATIONS, "create");
    if (unauthorized) return unauthorized;
    const context = await resolveContext(params);
    if ("response" in context) return context.response;

    const searchParams = request.nextUrl.searchParams;
    const parsed = previewQuerySchema.safeParse({
      parentId: searchParams.get("parentId") || null,
      codePrefix: searchParams.get("codePrefix") ?? "",
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      digits: searchParams.get("digits"),
      namePrefix: searchParams.get("namePrefix") || null,
    });
    if (!parsed.success) {
      return invalidBatch(parsed.error.issues[0]?.message ?? "Invalid location range");
    }

    const range = parsed.data;
    const { data, error } = await context.supabase.rpc("preview_warehouse_locations_batch", {
      p_business_unit_id: context.businessUnitId,
      p_warehouse_id: context.warehouseId,
      p_code_prefix: range.codePrefix,
      p_from: range.from,
      p_to: range.to,
      p_digits: range.digits,
      p_parent_id: range.parentId ?? undefined,
      p_name_prefix: range.namePrefix ?? undefined,
    });
    if (error) {
      console.error("Failed to preview warehouse location batch", error);
      const knownError = warehouseLocationErrorResponse(error);
      if (knownError) return knownError;
      return NextResponse.json(
        { error: "Failed to preview locations", code: "WAREHOUSE_LOCATION_BATCH_PREVIEW_FAILED" },
        { status: 500 }
      );
    }

    const rows: BatchPreviewRow[] = data ?? [];
    const preview: WarehouseLocationBatchPreview = {
      rows: rows.map((row) => ({
        code: row.code,
        name: row.name,
        locationPath: row.location_path,
        alreadyExists: row.already_exists,
      })),
    };
    return NextResponse.json({ data: preview });
  } catch (error: unknown) {
    console.error("Unexpected warehouse location batch preview error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POSTHandler(request: NextRequest, { params }: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.MANAGE_LOCATIONS, "create");
    if (unauthorized) return unauthorized;
    const context = await resolveContext(params);
    if ("response" in context) return context.response;

    const parsed = createBatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return invalidBatch(parsed.error.issues[0]?.message ?? "Invalid location range");
    }

    const body = parsed.data;
    const { data, error } = await context.supabase.rpc("create_warehouse_locations_batch", {
      p_business_unit_id: context.businessUnitId,
      p_warehouse_id: context.warehouseId,
      p_code_prefix: body.codePrefix,
      p_from: body.from,
      p_to: body.to,
      p_digits: body.digits,
      p_location_type: body.locationType,
      p_is_storable: body.isStorable,
      p_is_pickable: body.isPickable,
      p_is_active: body.isActive,
      p_skip_existing: body.skipExisting,
      p_parent_id: body.parentId ?? undefined,
      p_name_prefix: body.namePrefix ?? undefined,
      p_max_capacity: body.maxCapacity ?? undefined,
    });
    if (error) {
      console.error("Failed to create warehouse location batch", error);
      const knownError = warehouseLocationErrorResponse(error);
      if (knownError) return knownError;
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: "Location code already exists for this warehouse",
            code: "LOCATION_CODE_EXISTS",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create locations", code: "WAREHOUSE_LOCATION_BATCH_CREATE_FAILED" },
        { status: 500 }
      );
    }

    const results: BatchCreateRow[] = data ?? [];
    const result = results[0];
    return NextResponse.json(
      {
        data: {
          createdCount: result?.created_count ?? 0,
          skippedCount: result?.skipped_count ?? 0,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Unexpected warehouse location batch create error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "warehouse_locations",
  route: "/api/warehouses/[id]/locations/batch",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "warehouse_locations",
  route: "/api/warehouses/[id]/locations/batch",
});
