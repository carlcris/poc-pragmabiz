import { warehouseLocationErrorResponse } from "@/lib/warehouse-location-errors";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import type { WarehouseLocationDetail } from "@/types/inventory-location";

type RouteContext = { params: Promise<{ id: string }> };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LOCATION_COLUMNS =
  "id, company_id, warehouse_id, code, name, parent_id, location_type, is_pickable, is_storable, is_active, max_capacity, location_path, created_at, updated_at";

const updateLocationSchema = z
  .object({
    name: z.string().trim().max(200).nullable().optional(),
    parentId: z.string().uuid().nullable().optional(),
    locationType: z.enum(["zone", "aisle", "rack", "shelf", "bin", "crate"]).optional(),
    isPickable: z.boolean().optional(),
    isStorable: z.boolean().optional(),
    isActive: z.boolean().optional(),
    maxCapacity: z.number().finite().positive().max(999_999_999_999_999_999).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "At least one location field is required",
  });

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
  location_path: string;
  child_count?: number;
  subtree_quantity?: number;
  created_at: string;
  updated_at: string;
}) => ({
  id: location.id,
  companyId: location.company_id,
  warehouseId: location.warehouse_id,
  code: location.code,
  name: location.name,
  parentId: location.parent_id,
  locationPath: location.location_path,
  childCount: location.child_count ?? 0,
  subtreeQuantity: location.subtree_quantity ?? 0,
  locationType: location.location_type,
  isPickable: location.is_pickable ?? false,
  isStorable: location.is_storable ?? false,
  isActive: location.is_active ?? false,
  maxCapacity: location.max_capacity,
  createdAt: location.created_at,
  updatedAt: location.updated_at,
});

const ancestorsSchema = z.array(
  z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string().nullable(),
    locationPath: z.string(),
    isActive: z.boolean(),
  })
);

async function GETHandler(_request: NextRequest, { params }: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.MANAGE_LOCATIONS, "view");
    if (unauthorized) return unauthorized;

    const requestContext = await requireRequestContext();
    if ("status" in requestContext) return requestContext;
    const { supabase, currentBusinessUnitId } = requestContext;
    if (!currentBusinessUnitId) {
      return NextResponse.json(
        { error: "Business unit context required", code: "BUSINESS_UNIT_CONTEXT_REQUIRED" },
        { status: 400 }
      );
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "Invalid location id", code: "INVALID_LOCATION_ID" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("get_warehouse_location_detail", {
      p_business_unit_id: currentBusinessUnitId,
      p_location_id: id,
    });
    if (error) {
      console.error("Failed to load warehouse location detail", error);
      return NextResponse.json(
        { error: "Failed to load location", code: "WAREHOUSE_LOCATION_FETCH_FAILED" },
        { status: 500 }
      );
    }

    const location = data?.[0];
    if (!location) {
      return NextResponse.json(
        { error: "Warehouse location not found", code: "WAREHOUSE_LOCATION_NOT_FOUND" },
        { status: 404 }
      );
    }
    const ancestors = ancestorsSchema.safeParse(location.ancestors);
    if (!ancestors.success) {
      console.error("Invalid warehouse location ancestors", ancestors.error);
      return NextResponse.json(
        { error: "Failed to load location", code: "WAREHOUSE_LOCATION_FETCH_FAILED" },
        { status: 500 }
      );
    }

    const detail: WarehouseLocationDetail = {
      id: location.id,
      warehouseId: location.warehouse_id,
      code: location.code,
      name: location.name,
      parentId: location.parent_id,
      locationType: location.location_type,
      isPickable: location.is_pickable,
      isStorable: location.is_storable,
      isActive: location.is_active,
      maxCapacity: location.max_capacity,
      locationPath: location.location_path,
      ancestors: ancestors.data,
      childCount: location.child_count,
      activeChildCount: location.active_child_count,
      descendantCount: location.descendant_count,
      directOnHand: location.direct_on_hand,
      directReserved: location.direct_reserved,
      subtreeOnHand: location.subtree_on_hand,
      subtreeReserved: location.subtree_reserved,
      stockedLocationCount: location.stocked_location_count,
      directPendingPutaway: location.direct_pending_putaway,
      subtreePendingPutaway: location.subtree_pending_putaway,
    };
    return NextResponse.json({ data: detail });
  } catch (error: unknown) {
    console.error("Unexpected warehouse location detail error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function PATCHHandler(request: NextRequest, { params }: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.MANAGE_LOCATIONS, "edit");
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
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "Invalid location id", code: "INVALID_LOCATION_ID" },
        { status: 400 }
      );
    }

    const parsedBody = updateLocationSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: parsedBody.error.issues[0]?.message ?? "Invalid location details",
          code: "INVALID_LOCATION",
        },
        { status: 400 }
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("warehouse_locations")
      .select("id, is_storable, warehouse:warehouses!inner(id)")
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("warehouses.business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) {
      console.error("Failed to verify warehouse location scope", existingError);
      return NextResponse.json(
        { error: "Failed to update location", code: "WAREHOUSE_LOCATION_UPDATE_FAILED" },
        { status: 500 }
      );
    }
    if (!existing) {
      return NextResponse.json(
        { error: "Warehouse location not found", code: "WAREHOUSE_LOCATION_NOT_FOUND" },
        { status: 404 }
      );
    }

    const body = parsedBody.data;
    const willBeStorable = body.isStorable ?? existing.is_storable ?? false;
    if (!willBeStorable && body.maxCapacity != null) {
      return NextResponse.json(
        {
          error: "Capacity can only be configured for storable locations",
          code: "CAPACITY_REQUIRES_STORABLE_LOCATION",
        },
        { status: 400 }
      );
    }

    const updatePayload = {
      name: body.name,
      parent_id: body.parentId,
      location_type: body.locationType,
      is_pickable: body.isPickable,
      is_storable: body.isStorable,
      is_active: body.isActive,
      max_capacity: body.maxCapacity,
    };

    const { data: updated, error: updateError } = await supabase
      .rpc("update_warehouse_location", {
        p_business_unit_id: currentBusinessUnitId,
        p_location_id: id,
        p_changes: updatePayload,
      })
      .select(LOCATION_COLUMNS)
      .single();

    if (updateError || !updated) {
      console.error("Failed to update warehouse location", updateError);
      const hierarchyError = updateError && warehouseLocationErrorResponse(updateError);
      if (hierarchyError) return hierarchyError;
      if (updateError?.code === "23505") {
        return NextResponse.json(
          {
            error: "Location code already exists for this warehouse",
            code: "LOCATION_CODE_EXISTS",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update location", code: "WAREHOUSE_LOCATION_UPDATE_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: mapLocation(updated) });
  } catch (error: unknown) {
    console.error("Unexpected warehouse location update error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function DELETEHandler(_request: NextRequest, { params }: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.MANAGE_LOCATIONS, "delete");
    if (unauthorized) return unauthorized;
    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, currentBusinessUnitId } = context;
    if (!currentBusinessUnitId) {
      return NextResponse.json(
        { error: "Business unit context required", code: "BUSINESS_UNIT_CONTEXT_REQUIRED" },
        { status: 400 }
      );
    }
    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "Invalid location id", code: "INVALID_LOCATION_ID" },
        { status: 400 }
      );
    }
    const { error } = await supabase.rpc("delete_warehouse_location", {
      p_business_unit_id: currentBusinessUnitId,
      p_location_id: id,
    });
    if (error) {
      console.error("Failed to delete warehouse location", error);
      if (
        error.message === "WAREHOUSE_LOCATION_NOT_FOUND" ||
        error.message === "LOCATION_WAREHOUSE_INVALID"
      ) {
        return NextResponse.json(
          { error: "Warehouse location not found", code: "WAREHOUSE_LOCATION_NOT_FOUND" },
          { status: 404 }
        );
      }
      if (error.message === "LOCATION_DELETE_FORBIDDEN") {
        return NextResponse.json(
          {
            error: "You do not have permission to delete locations",
            code: "LOCATION_DELETE_FORBIDDEN",
          },
          { status: 403 }
        );
      }
      const knownError = warehouseLocationErrorResponse(error);
      if (knownError) return knownError;
      return NextResponse.json(
        { error: "Failed to delete location", code: "WAREHOUSE_LOCATION_DELETE_FAILED" },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Unexpected warehouse location deletion error", error);
    return NextResponse.json(
      { error: "Failed to delete location", code: "WAREHOUSE_LOCATION_DELETE_FAILED" },
      { status: 500 }
    );
  }
}

export const DELETE = withActivityLogging(DELETEHandler, {
  action: "delete",
  resourceType: "warehouse_locations",
  route: "/api/warehouse-locations/[id]",
});

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "warehouse_locations",
  route: "/api/warehouse-locations/[id]",
});
export const PATCH = withActivityLogging(PATCHHandler, {
  action: "update",
  resourceType: "warehouse_locations",
  route: "/api/warehouse-locations/[id]",
});
