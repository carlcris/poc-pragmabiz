import { warehouseLocationErrorResponse } from "@/lib/warehouse-location-errors";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import type { Database } from "@/types/database.types";
import type { WarehouseLocationCopyPreview } from "@/types/inventory-location";

type RouteContext = { params: Promise<{ id: string }> };
type DatabaseFunctions = Database["public"]["Functions"];
type CopyPlanRow = DatabaseFunctions["plan_warehouse_location_copy"]["Returns"][number];
type CopyResultRow = DatabaseFunctions["copy_warehouse_location_structure"]["Returns"][number];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const copyRequestSchema = z
  .object({
    destinationParentId: z.string().uuid().nullable(),
    nameFind: z.string().max(200).nullable(),
    nameReplace: z.string().max(200).nullable(),
  })
  .strict();

const invalidCopy = (message: string) =>
  NextResponse.json({ error: message, code: "LOCATION_COPY_INVALID" }, { status: 400 });

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
        { error: "Invalid location id", code: "INVALID_LOCATION_ID" },
        { status: 400 }
      ),
    };
  }
  return {
    supabase: requestContext.supabase,
    businessUnitId: requestContext.currentBusinessUnitId,
    sourceId: id,
  };
}

const knownOrGenericError = (
  error: { message: string; code?: string },
  message: string,
  code: string
) =>
  warehouseLocationErrorResponse(error) ??
  NextResponse.json({ error: message, code }, { status: 500 });

async function GETHandler(request: NextRequest, { params }: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.MANAGE_LOCATIONS, "create");
    if (unauthorized) return unauthorized;
    const context = await resolveContext(params);
    if ("response" in context) return context.response;

    const searchParams = request.nextUrl.searchParams;
    const parsed = copyRequestSchema.safeParse({
      destinationParentId: searchParams.get("destinationParentId") || null,
      nameFind: searchParams.get("nameFind") || null,
      nameReplace: searchParams.get("nameReplace") || null,
    });
    if (!parsed.success) {
      return invalidCopy(parsed.error.issues[0]?.message ?? "Invalid copy request");
    }

    const copy = parsed.data;
    const { data, error } = await context.supabase.rpc("plan_warehouse_location_copy", {
      p_business_unit_id: context.businessUnitId,
      p_source_id: context.sourceId,
      p_destination_parent_id: copy.destinationParentId ?? undefined,
      p_name_find: copy.nameFind ?? undefined,
      p_name_replace: copy.nameReplace ?? undefined,
    });
    if (error) {
      console.error("Failed to preview warehouse location copy", error);
      return knownOrGenericError(
        error,
        "Failed to preview the copy",
        "WAREHOUSE_LOCATION_COPY_PREVIEW_FAILED"
      );
    }

    const rows: CopyPlanRow[] = data ?? [];
    const preview: WarehouseLocationCopyPreview = {
      rows: rows.map((row) => ({
        sourceId: row.source_id,
        depth: row.depth,
        code: row.code,
        name: row.name,
        locationPath: row.location_path,
        locationType: row.location_type,
      })),
    };
    return NextResponse.json({ data: preview });
  } catch (error: unknown) {
    console.error("Unexpected warehouse location copy preview error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POSTHandler(request: NextRequest, { params }: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.MANAGE_LOCATIONS, "create");
    if (unauthorized) return unauthorized;
    const context = await resolveContext(params);
    if ("response" in context) return context.response;

    const parsed = copyRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return invalidCopy(parsed.error.issues[0]?.message ?? "Invalid copy request");
    }

    const copy = parsed.data;
    const { data, error } = await context.supabase.rpc("copy_warehouse_location_structure", {
      p_business_unit_id: context.businessUnitId,
      p_source_id: context.sourceId,
      p_destination_parent_id: copy.destinationParentId ?? undefined,
      p_name_find: copy.nameFind ?? undefined,
      p_name_replace: copy.nameReplace ?? undefined,
    });
    if (error) {
      console.error("Failed to copy warehouse location structure", error);
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: "Location code already exists for this warehouse",
            code: "LOCATION_CODE_EXISTS",
          },
          { status: 409 }
        );
      }
      return knownOrGenericError(
        error,
        "Failed to copy locations",
        "WAREHOUSE_LOCATION_COPY_FAILED"
      );
    }

    const results: CopyResultRow[] = data ?? [];
    const result = results[0];
    if (!result) {
      console.error("Warehouse location copy returned no result");
      return NextResponse.json(
        { error: "Failed to copy locations", code: "WAREHOUSE_LOCATION_COPY_FAILED" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { data: { rootId: result.root_id, createdCount: result.created_count } },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Unexpected warehouse location copy error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "warehouse_locations",
  route: "/api/warehouse-locations/[id]/copy",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "warehouse_locations",
  route: "/api/warehouse-locations/[id]/copy",
});
