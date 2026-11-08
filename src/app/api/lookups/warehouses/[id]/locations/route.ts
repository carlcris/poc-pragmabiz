import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requireLookupDataAccess } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWarehouseLocationNamePaths } from "@/lib/warehouse-location-name-path";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseLimit = (raw: string | null) => {
  const parsed = Number.parseInt(raw || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
};

const normalizeSearch = (raw: string | null) => {
  const value = raw?.trim().replace(/[,%()]/g, " ");
  return value ? value : null;
};

type LocationOptionRow = {
  id: string;
  company_id: string;
  warehouse_id: string;
  code: string;
  name: string | null;
  parent_id: string | null;
  path_ids: string[];
  location_path: string;
  location_type: string;
  is_pickable: boolean | null;
  is_storable: boolean | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

const mapLocationOption = (
  location: LocationOptionRow,
  namePaths: ReadonlyMap<string, string>
) => ({
  id: location.id,
  companyId: location.company_id,
  warehouseId: location.warehouse_id,
  code: location.code,
  name: location.name,
  parentId: location.parent_id,
  locationPath: location.location_path,
  locationNamePath: namePaths.get(location.id) ?? location.code,
  locationType: location.location_type,
  isPickable: location.is_pickable ?? false,
  isStorable: location.is_storable ?? false,
  isActive: location.is_active ?? false,
  createdAt: location.created_at,
  updatedAt: location.updated_at,
});

async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requireLookupDataAccess(RESOURCES.WAREHOUSES);
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { companyId, accessibleBusinessUnitIds } = context;
    const adminSupabase = createAdminClient();

    const { id: warehouseId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const search = normalizeSearch(searchParams.get("search"));
    const limit = parseLimit(searchParams.get("limit"));
    const page = Number(searchParams.get("page") ?? "1");
    if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) {
      return NextResponse.json({ error: "Invalid page" }, { status: 400 });
    }
    const selectedId = searchParams.get("selectedId")?.trim() || null;
    if (selectedId && !UUID_PATTERN.test(selectedId)) {
      return NextResponse.json({ error: "Invalid selected location" }, { status: 400 });
    }
    const excludeSubtreeId = searchParams.get("excludeSubtreeId") || null;
    if (excludeSubtreeId && !UUID_PATTERN.test(excludeSubtreeId)) {
      return NextResponse.json({ error: "Invalid excluded location" }, { status: 400 });
    }
    const pickableOnly = searchParams.get("pickableOnly") === "true";
    const includeInactive = searchParams.get("includeInactive") === "true";
    const storableOnly = searchParams.get("storableOnly") === "true";
    const locationType = searchParams.get("locationType")?.trim() || null;
    const allowedLocationTypes = new Set(["zone", "aisle", "rack", "shelf", "bin", "crate"]);
    if (locationType && !allowedLocationTypes.has(locationType)) {
      return NextResponse.json({ error: "Invalid location type" }, { status: 400 });
    }

    const { data: warehouse, error: warehouseError } = await adminSupabase
      .from("warehouses")
      .select("id, business_unit_id")
      .eq("id", warehouseId)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (warehouseError) {
      console.error("Failed to validate warehouse for location lookup:", warehouseError);
      return NextResponse.json({ error: "Failed to validate warehouse" }, { status: 500 });
    }

    if (!warehouse || !accessibleBusinessUnitIds.includes(warehouse.business_unit_id)) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    let query = adminSupabase
      .from("warehouse_locations")
      .select(
        "id, company_id, warehouse_id, code, name, parent_id, path_ids, location_path, location_type, is_pickable, is_storable, is_active, created_at, updated_at"
      )
      .eq("company_id", companyId)
      .eq("warehouse_id", warehouseId)
      .is("deleted_at", null)
      .order("location_path", { ascending: true })
      .order("id", { ascending: true })
      .range((page - 1) * limit, page * limit);

    if (!includeInactive) query = query.eq("is_active", true);
    if (excludeSubtreeId) query = query.not("path_ids", "cs", `{${excludeSubtreeId}}`);
    if (pickableOnly) query = query.eq("is_pickable", true);
    if (storableOnly) query = query.eq("is_storable", true);
    if (locationType) query = query.eq("location_type", locationType);
    if (search) {
      // Stored addresses include codes between the names displayed by the picker.
      // Match each slash-separated segment in order, allowing those codes in between.
      const pattern = search
        .split("/")
        .map((segment) => segment.trim().replace(/[\\_%]/g, "\\$&"))
        .filter(Boolean)
        .join("%/%");
      if (pattern) query = query.ilike("location_path", `%${pattern}%`);
    }

    const { data: matches, error } = await query;
    if (error) {
      console.error("Failed to fetch warehouse location lookup options:", error);
      return NextResponse.json({ error: "Failed to fetch warehouse locations" }, { status: 500 });
    }

    const data = (matches ?? []).slice(0, limit);

    let selected = selectedId ? (data || []).find((location) => location.id === selectedId) : null;
    if (selectedId && !selected) {
      let selectedQuery = adminSupabase
        .from("warehouse_locations")
        .select(
          "id, company_id, warehouse_id, code, name, parent_id, path_ids, location_path, location_type, is_pickable, is_storable, is_active, created_at, updated_at"
        )
        .eq("id", selectedId)
        .eq("company_id", companyId)
        .eq("warehouse_id", warehouseId)
        .is("deleted_at", null);

      if (!includeInactive) selectedQuery = selectedQuery.eq("is_active", true);
      if (excludeSubtreeId)
        selectedQuery = selectedQuery.not("path_ids", "cs", `{${excludeSubtreeId}}`);
      if (pickableOnly) selectedQuery = selectedQuery.eq("is_pickable", true);
      if (storableOnly) selectedQuery = selectedQuery.eq("is_storable", true);
      if (locationType) selectedQuery = selectedQuery.eq("location_type", locationType);

      const { data: selectedLocation, error: selectedError } = await selectedQuery.maybeSingle();
      if (selectedError) {
        console.error("Failed to fetch selected warehouse location option:", selectedError);
        return NextResponse.json({ error: "Failed to fetch warehouse locations" }, { status: 500 });
      }
      selected = selectedLocation;
    }

    const rows: LocationOptionRow[] = [
      ...(data || []),
      ...(selected && !data?.includes(selected) ? [selected] : []),
    ];
    const { data: namePaths, error: namePathError } = await fetchWarehouseLocationNamePaths(
      adminSupabase,
      companyId,
      rows
    );
    if (namePathError) {
      console.error("Failed to fetch warehouse location lookup ancestors:", namePathError);
      return NextResponse.json({ error: "Failed to fetch warehouse locations" }, { status: 500 });
    }

    return NextResponse.json({
      data: (data || []).map((row) => mapLocationOption(row, namePaths)),
      selected: selected ? mapLocationOption(selected, namePaths) : null,
      hasMore: (matches?.length ?? 0) > limit,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "lookups",
  route: "/api/lookups/warehouses/[id]/locations",
});
