import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { GRANULAR_CAPABILITIES } from "@/constants/granular-permissions";
import { requireAllPermissions, requirePermission } from "@/lib/auth";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { isCompleteRackRectangle } from "@/lib/warehouse-floor-map-geometry";
import { canAccessCapability } from "@/services/permissions/permissionResolver";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type RackInput = {
  warehouseLocationId: string;
  xBasisPoints: number;
  yBasisPoints: number;
  widthBasisPoints: number;
  heightBasisPoints: number;
};

const BUCKET = "warehouse-floor-maps";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const FILE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const safeError = (error: string, code: string, status: number) =>
  NextResponse.json({ error, code }, { status });

const parsePositiveInteger = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseRackInputs = (value: FormDataEntryValue | null): RackInput[] | null => {
  if (typeof value !== "string" || value.length > 150_000) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length > 500) return null;

    const racks: RackInput[] = [];
    for (const entry of parsed) {
      if (typeof entry !== "object" || entry === null) return null;
      const row = entry as Record<string, unknown>;
      const warehouseLocationId = row.warehouseLocationId;
      const coordinates = [
        row.xBasisPoints,
        row.yBasisPoints,
        row.widthBasisPoints,
        row.heightBasisPoints,
      ];
      if (
        typeof warehouseLocationId !== "string" ||
        !warehouseLocationId.trim() ||
        coordinates.some((coordinate) => !Number.isSafeInteger(coordinate))
      ) {
        return null;
      }

      const [xBasisPoints, yBasisPoints, widthBasisPoints, heightBasisPoints] =
        coordinates as number[];
      if (
        xBasisPoints < 0 ||
        yBasisPoints < 0 ||
        widthBasisPoints < 1 ||
        heightBasisPoints < 1 ||
        xBasisPoints + widthBasisPoints > 10_000 ||
        yBasisPoints + heightBasisPoints > 10_000
      ) {
        return null;
      }

      racks.push({
        warehouseLocationId,
        xBasisPoints,
        yBasisPoints,
        widthBasisPoints,
        heightBasisPoints,
      });
    }

    return racks;
  } catch {
    return null;
  }
};

const loadFloorMap = async (warehouseId: string, companyId: string) => {
  const admin = createAdminClient();
  const { data: map, error: mapError } = await admin
    .from("warehouse_floor_maps")
    .select("id, warehouse_id, name, image_path, image_width, image_height, version")
    .eq("company_id", companyId)
    .eq("warehouse_id", warehouseId)
    .maybeSingle();

  if (mapError) {
    console.error("Failed to load warehouse floor map", mapError);
    throw new Error("FLOOR_MAP_LOAD_FAILED");
  }
  if (!map) return null;

  const [{ data: signedUrl, error: signedUrlError }, { data: racks, error: racksError }] =
    await Promise.all([
      admin.storage.from(BUCKET).createSignedUrl(map.image_path, 3600),
      admin
        .from("warehouse_floor_map_racks")
        .select(
          `
          id,
          warehouse_location_id,
          x_basis_points,
          y_basis_points,
          width_basis_points,
          height_basis_points,
          warehouse_location:warehouse_locations!warehouse_floor_map_racks_warehouse_location_id_fkey(
            code,
            name
          )
        `
        )
        .eq("company_id", companyId)
        .eq("floor_map_id", map.id)
        .order("created_at", { ascending: true }),
    ]);

  if (signedUrlError || racksError || !signedUrl?.signedUrl) {
    console.error("Failed to load warehouse floor map assets", {
      signedUrlError,
      racksError,
    });
    throw new Error("FLOOR_MAP_LOAD_FAILED");
  }

  return {
    id: map.id,
    warehouseId: map.warehouse_id,
    name: map.name,
    imageUrl: signedUrl.signedUrl,
    imageWidth: map.image_width,
    imageHeight: map.image_height,
    version: map.version,
    racks: (racks || []).map((rack) => {
      const location = Array.isArray(rack.warehouse_location)
        ? rack.warehouse_location[0]
        : rack.warehouse_location;
      return {
        id: rack.id,
        warehouseLocationId: rack.warehouse_location_id,
        locationCode: location?.code || "",
        locationName: location?.name || null,
        xBasisPoints: rack.x_basis_points,
        yBasisPoints: rack.y_basis_points,
        widthBasisPoints: rack.width_basis_points,
        heightBasisPoints: rack.height_basis_points,
      };
    }),
  };
};

const getScopedWarehouse = async (warehouseId: string) => {
  const context = await createServerClientWithBU();
  if (!context.userId || !context.companyId || !context.currentBusinessUnitId) return null;

  const { data: warehouse, error } = await context.supabase
    .from("warehouses")
    .select("id, company_id, business_unit_id, warehouse_name")
    .eq("id", warehouseId)
    .eq("company_id", context.companyId)
    .eq("business_unit_id", context.currentBusinessUnitId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("Failed to validate warehouse floor map scope", error);
    return null;
  }

  return warehouse
    ? {
        ...context,
        userId: context.userId,
        companyId: context.companyId,
        currentBusinessUnitId: context.currentBusinessUnitId,
        warehouse,
      }
    : null;
};

async function GETHandler(_request: NextRequest, context: RouteContext) {
  const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, "view");
  if (unauthorized) {
    if (unauthorized.status === 401) return unauthorized;
    return safeError(
      "You do not have permission to view this warehouse floor map",
      "FLOOR_MAP_PERMISSION_DENIED",
      403
    );
  }

  const { id } = await context.params;
  const scoped = await getScopedWarehouse(id);
  if (!scoped) {
    return safeError("Warehouse not found", "WAREHOUSE_NOT_FOUND", 404);
  }

  try {
    return NextResponse.json({ data: await loadFloorMap(id, scoped.companyId) });
  } catch (error) {
    console.error("Warehouse floor map GET failed", error);
    return safeError("Failed to load warehouse floor map", "FLOOR_MAP_LOAD_FAILED", 500);
  }
}

async function PUTHandler(request: NextRequest, context: RouteContext) {
  const parentPermissionDenied = await requireAllPermissions([
    [RESOURCES.WAREHOUSES, "view"],
    [RESOURCES.WAREHOUSES, "edit"],
  ]);
  if (parentPermissionDenied) {
    if (parentPermissionDenied.status === 401) return parentPermissionDenied;
    return safeError(
      "You do not have permission to change this warehouse floor map",
      "FLOOR_MAP_PERMISSION_DENIED",
      403
    );
  }

  const { id } = await context.params;
  const scoped = await getScopedWarehouse(id);
  if (!scoped) {
    return safeError("Warehouse not found", "WAREHOUSE_NOT_FOUND", 404);
  }

  const canManageFloorMap = await canAccessCapability(
    scoped.userId,
    GRANULAR_CAPABILITIES.WAREHOUSE_FLOOR_MAP_MANAGE,
    "edit",
    scoped.currentBusinessUnitId
  );
  if (!canManageFloorMap) {
    return safeError(
      "You do not have permission to change this warehouse floor map",
      "FLOOR_MAP_PERMISSION_DENIED",
      403
    );
  }

  const formData = await request.formData();
  const name = typeof formData.get("name") === "string" ? String(formData.get("name")).trim() : "";
  const imageWidth = parsePositiveInteger(formData.get("imageWidth"));
  const imageHeight = parsePositiveInteger(formData.get("imageHeight"));
  const racks = parseRackInputs(formData.get("racks"));
  const fileEntry = formData.get("file");
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

  if (!name || name.length > 120 || !imageWidth || !imageHeight || !racks) {
    return safeError("Floor map details are invalid", "INVALID_FLOOR_MAP", 400);
  }
  if (racks.some((rack) => !isCompleteRackRectangle(rack))) {
    return safeError(
      "Draw a rectangle over the complete rack before saving",
      "RACK_MAPPING_TOO_SMALL",
      400
    );
  }
  if (file && (!ALLOWED_MIME_TYPES.has(file.type) || file.size > MAX_FILE_SIZE)) {
    return safeError("Use a PNG, JPEG, or WebP image up to 10 MB", "INVALID_FLOOR_MAP_IMAGE", 400);
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("warehouse_floor_maps")
    .select("id, image_path")
    .eq("company_id", scoped.companyId)
    .eq("warehouse_id", id)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to inspect existing warehouse floor map", existingError);
    return safeError("Failed to save warehouse floor map", "FLOOR_MAP_SAVE_FAILED", 500);
  }
  if (!file && !existing?.image_path) {
    return safeError("Floor map image is required", "FLOOR_MAP_IMAGE_REQUIRED", 400);
  }

  let imagePath = existing?.image_path || "";
  let uploadedPath: string | null = null;
  if (file) {
    const fileExtension = FILE_EXTENSION_BY_MIME_TYPE[file.type];
    uploadedPath = `${scoped.companyId}/${id}/${randomUUID()}${fileExtension}`;
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(uploadedPath, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload warehouse floor map", uploadError);
      return safeError("Failed to upload floor map image", "FLOOR_MAP_UPLOAD_FAILED", 500);
    }
    imagePath = uploadedPath;
  }

  const { error: saveError } = await scoped.supabase.rpc("save_warehouse_floor_map", {
    p_actor_user_id: scoped.userId,
    p_company_id: scoped.companyId,
    p_image_height: imageHeight,
    p_image_path: imagePath,
    p_image_width: imageWidth,
    p_name: name,
    p_racks: racks.map((rack) => ({
      warehouse_location_id: rack.warehouseLocationId,
      x_basis_points: rack.xBasisPoints,
      y_basis_points: rack.yBasisPoints,
      width_basis_points: rack.widthBasisPoints,
      height_basis_points: rack.heightBasisPoints,
    })),
    p_warehouse_id: id,
  });

  if (saveError) {
    console.error("Failed to save warehouse floor map", saveError);
    if (uploadedPath) {
      const { error: cleanupError } = await admin.storage.from(BUCKET).remove([uploadedPath]);
      if (cleanupError) {
        console.error("Failed to clean up uncommitted floor map image", cleanupError);
      }
    }
    if (saveError.message.includes("RACK_MAPPING_TOO_SMALL")) {
      return safeError(
        "Draw a rectangle over the complete rack before saving",
        "RACK_MAPPING_TOO_SMALL",
        400
      );
    }
    if (saveError.message.includes("FLOOR_MAP_PERMISSION_DENIED")) {
      return safeError(
        "You do not have permission to change this warehouse floor map",
        "FLOOR_MAP_PERMISSION_DENIED",
        403
      );
    }
    return safeError("Failed to save warehouse floor map", "FLOOR_MAP_SAVE_FAILED", 500);
  }

  if (uploadedPath && existing?.image_path && existing.image_path !== uploadedPath) {
    const { error: cleanupError } = await admin.storage.from(BUCKET).remove([existing.image_path]);
    if (cleanupError) {
      console.error("Failed to remove replaced warehouse floor map image", cleanupError);
    }
  }

  try {
    return NextResponse.json({ data: await loadFloorMap(id, scoped.companyId) });
  } catch (error) {
    console.error("Warehouse floor map saved but could not be reloaded", error);
    return safeError(
      "Floor map was saved but could not be reloaded",
      "FLOOR_MAP_RELOAD_FAILED",
      500
    );
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "warehouse_floor_maps",
  route: "/api/warehouses/[id]/floor-map",
});

export const PUT = withActivityLogging(PUTHandler, {
  action: "update",
  resourceType: "warehouse_floor_maps",
  route: "/api/warehouses/[id]/floor-map",
});
