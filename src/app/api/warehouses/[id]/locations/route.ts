import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext, type RequestContext } from "@/lib/auth/requestContext";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";

type RouteContext = { params: Promise<{ id: string }> };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCATION_COLUMNS =
  "id, company_id, warehouse_id, code, name, parent_id, location_type, is_pickable, is_storable, is_active, max_capacity, created_at, updated_at";

const createLocationSchema = z
  .object({
    code: z.string().trim().min(1).max(100),
    name: z.string().trim().max(200).nullable().optional(),
    parentId: z.string().uuid().nullable().optional(),
    locationType: z.string().trim().min(1).max(50).optional(),
    isPickable: z.boolean().optional(),
    isStorable: z.boolean().optional(),
    isActive: z.boolean().optional(),
    maxCapacity: z.number().finite().positive().max(999_999_999_999_999_999).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.isStorable === false && value.maxCapacity != null) {
      context.addIssue({
        code: "custom",
        path: ["maxCapacity"],
        message: "Capacity can only be configured for storable locations",
      });
    }
  });

const parsePositiveInteger = (value: string | null, fallback: number, maximum: number) => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
};

const invalidWarehouseId = () =>
  NextResponse.json(
    { error: "Invalid warehouse id", code: "INVALID_WAREHOUSE_ID" },
    { status: 400 }
  );

const warehouseNotFound = () =>
  NextResponse.json({ error: "Warehouse not found", code: "WAREHOUSE_NOT_FOUND" }, { status: 404 });

async function warehouseExistsInCurrentBusinessUnit(
  supabase: RequestContext["supabase"],
  warehouseId: string,
  companyId: string,
  businessUnitId: string
) {
  return supabase
    .from("warehouses")
    .select("id")
    .eq("id", warehouseId)
    .eq("company_id", companyId)
    .eq("business_unit_id", businessUnitId)
    .is("deleted_at", null)
    .maybeSingle();
}

const mapLocation = (location: {
  id: string;
  company_id: string;
  warehouse_id: string;
  code: string;
  name: string | null;
  parent_id: string | null;
  location_type: string;
  is_pickable: boolean | null;
  is_storable: boolean | null;
  is_active: boolean | null;
  max_capacity: number | null;
  created_at: string;
  updated_at: string;
  used_capacity?: number;
  utilization_percent?: number;
  capacity_status?: string;
}) => ({
  id: location.id,
  companyId: location.company_id,
  warehouseId: location.warehouse_id,
  code: location.code,
  name: location.name,
  parentId: location.parent_id,
  locationType: location.location_type,
  isPickable: location.is_pickable ?? false,
  isStorable: location.is_storable ?? false,
  isActive: location.is_active ?? false,
  maxCapacity: location.max_capacity,
  usedCapacity: location.used_capacity ?? 0,
  utilizationPercent: location.utilization_percent ?? 0,
  capacityStatus: location.capacity_status ?? "not_configured",
  createdAt: location.created_at,
  updatedAt: location.updated_at,
});

async function GETHandler(request: NextRequest, { params }: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.MANAGE_LOCATIONS, "view");
    if (unauthorized) return unauthorized;

    const requestContext = await requireRequestContext();
    if ("status" in requestContext) return requestContext;
    const { supabase, companyId, currentBusinessUnitId } = requestContext;
    if (!currentBusinessUnitId) {
      return NextResponse.json(
        { error: "Business unit context required", code: "BUSINESS_UNIT_CONTEXT_REQUIRED" },
        { status: 400 }
      );
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) return invalidWarehouseId();

    const { data: warehouse, error: warehouseError } = await warehouseExistsInCurrentBusinessUnit(
      supabase,
      id,
      companyId,
      currentBusinessUnitId
    );
    if (warehouseError) {
      console.error("Failed to verify warehouse location scope", warehouseError);
      return NextResponse.json(
        { error: "Failed to load warehouse locations", code: "WAREHOUSE_LOCATIONS_FETCH_FAILED" },
        { status: 500 }
      );
    }
    if (!warehouse) return warehouseNotFound();

    const { searchParams } = new URL(request.url);
    const page = parsePositiveInteger(searchParams.get("page"), 1, 1_000_000);
    const limit = parsePositiveInteger(searchParams.get("limit"), 20, 100);
    const { data, error } = await supabase.rpc("get_warehouse_location_capacities", {
      p_business_unit_id: currentBusinessUnitId,
      p_warehouse_id: id,
      p_page: page,
      p_limit: limit,
    });

    if (error) {
      console.error("Failed to fetch warehouse locations", error);
      return NextResponse.json(
        { error: "Failed to load warehouse locations", code: "WAREHOUSE_LOCATIONS_FETCH_FAILED" },
        { status: 500 }
      );
    }

    let total = data?.[0]?.total_count;
    if (total == null) {
      const { count, error: countError } = await supabase
        .from("warehouse_locations")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("warehouse_id", id)
        .is("deleted_at", null);

      if (countError) {
        console.error("Failed to count warehouse locations", countError);
        return NextResponse.json(
          { error: "Failed to load warehouse locations", code: "WAREHOUSE_LOCATIONS_FETCH_FAILED" },
          { status: 500 }
        );
      }

      total = count ?? 0;
    }

    return NextResponse.json({
      data: (data ?? []).map(mapLocation),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error: unknown) {
    console.error("Unexpected warehouse locations list error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POSTHandler(request: NextRequest, { params }: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.MANAGE_LOCATIONS, "create");
    if (unauthorized) return unauthorized;

    const requestContext = await requireRequestContext();
    if ("status" in requestContext) return requestContext;
    const { supabase, userId, companyId, currentBusinessUnitId } = requestContext;
    if (!currentBusinessUnitId) {
      return NextResponse.json(
        { error: "Business unit context required", code: "BUSINESS_UNIT_CONTEXT_REQUIRED" },
        { status: 400 }
      );
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) return invalidWarehouseId();

    const parsedBody = createLocationSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: parsedBody.error.issues[0]?.message ?? "Invalid location details",
          code: "INVALID_LOCATION",
        },
        { status: 400 }
      );
    }

    const { data: warehouse, error: warehouseError } = await warehouseExistsInCurrentBusinessUnit(
      supabase,
      id,
      companyId,
      currentBusinessUnitId
    );
    if (warehouseError) {
      console.error("Failed to verify warehouse location scope", warehouseError);
      return NextResponse.json(
        { error: "Failed to create location", code: "WAREHOUSE_LOCATION_CREATE_FAILED" },
        { status: 500 }
      );
    }
    if (!warehouse) return warehouseNotFound();

    const body = parsedBody.data;
    const { data: existing, error: existingError } = await supabase
      .from("warehouse_locations")
      .select("id")
      .eq("company_id", companyId)
      .eq("warehouse_id", id)
      .eq("code", body.code)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) {
      console.error("Failed to check warehouse location code", existingError);
      return NextResponse.json(
        { error: "Failed to create location", code: "WAREHOUSE_LOCATION_CREATE_FAILED" },
        { status: 500 }
      );
    }
    if (existing) {
      return NextResponse.json(
        { error: "Location code already exists for this warehouse", code: "LOCATION_CODE_EXISTS" },
        { status: 409 }
      );
    }

    const { data: created, error: insertError } = await supabase
      .from("warehouse_locations")
      .insert({
        company_id: companyId,
        warehouse_id: id,
        code: body.code,
        name: body.name || null,
        parent_id: body.parentId || null,
        location_type: body.locationType || "bin",
        is_pickable: body.isPickable ?? true,
        is_storable: body.isStorable ?? true,
        is_active: body.isActive ?? true,
        max_capacity: body.maxCapacity ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select(LOCATION_COLUMNS)
      .single();

    if (insertError || !created) {
      console.error("Failed to create warehouse location", insertError);
      if (insertError?.code === "23505") {
        return NextResponse.json(
          {
            error: "Location code already exists for this warehouse",
            code: "LOCATION_CODE_EXISTS",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create location", code: "WAREHOUSE_LOCATION_CREATE_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: mapLocation(created) }, { status: 201 });
  } catch (error: unknown) {
    console.error("Unexpected warehouse location create error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "warehouses",
  route: "/api/warehouses/[id]/locations",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "warehouses",
  route: "/api/warehouses/[id]/locations",
});
