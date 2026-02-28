import { NextRequest, NextResponse } from "next/server";
import { requireLookupDataAccess } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

type LookupType =
  | "warehouses"
  | "warehouse_locations"
  | "items"
  | "customers"
  | "suppliers"
  | "employees"
  | "item_categories"
  | "units_of_measure";

const isLookupType = (value: string | null): value is LookupType =>
  value === "warehouses" ||
  value === "warehouse_locations" ||
  value === "items" ||
  value === "customers" ||
  value === "suppliers" ||
  value === "employees" ||
  value === "item_categories" ||
  value === "units_of_measure";

const parseLimit = (raw: string | null) => {
  const parsed = Number.parseInt(raw || "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
};

const normalizeSearch = (raw: string | null) => {
  const value = raw?.trim();
  return value ? value : null;
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    if (!isLookupType(type)) {
      return NextResponse.json(
        { error: "Invalid lookup type" },
        { status: 400 }
      );
    }

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, accessibleBusinessUnitIds } = context;

    const search = normalizeSearch(searchParams.get("search"));
    const limit = parseLimit(searchParams.get("limit"));
    const includeInactive = searchParams.get("includeInactive") === "true";

    const unauthorized =
      type === "warehouses" || type === "warehouse_locations"
        ? await requireLookupDataAccess(RESOURCES.WAREHOUSES)
        : type === "items"
          ? await requireLookupDataAccess(RESOURCES.ITEMS)
          : type === "customers"
            ? await requireLookupDataAccess(RESOURCES.CUSTOMERS)
            : type === "suppliers"
              ? await requireLookupDataAccess(RESOURCES.SUPPLIERS)
              : type === "employees"
                ? await requireLookupDataAccess(RESOURCES.EMPLOYEES)
                : type === "item_categories"
                  ? await requireLookupDataAccess(RESOURCES.ITEM_CATEGORIES)
                  : await requireLookupDataAccess(RESOURCES.ITEMS); // units_of_measure

    if (unauthorized) return unauthorized;

    if (type === "warehouses") {
      if (accessibleBusinessUnitIds.length === 0) {
        return NextResponse.json({ data: [] });
      }

      let query = supabase
        .from("warehouses")
        .select("id, business_unit_id, code, name, is_active")
        .eq("company_id", companyId)
        .in("business_unit_id", accessibleBusinessUnitIds)
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .limit(limit);

      if (!includeInactive) query = query.eq("is_active", true);
      if (search) {
        query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) {
        return NextResponse.json(
          { error: "Failed to fetch warehouses", details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        data: (data || []).map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          businessUnitId: row.business_unit_id,
          isActive: row.is_active ?? true,
        })),
      });
    }

    if (type === "warehouse_locations") {
      const warehouseId = searchParams.get("warehouseId");
      if (!warehouseId) {
        return NextResponse.json({ error: "warehouseId is required" }, { status: 400 });
      }

      // Ensure warehouse is accessible to the current user before exposing locations.
      const { data: warehouse, error: warehouseError } = await supabase
        .from("warehouses")
        .select("id, business_unit_id")
        .eq("id", warehouseId)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .maybeSingle();

      if (warehouseError) {
        return NextResponse.json(
          { error: "Failed to validate warehouse", details: warehouseError.message },
          { status: 500 }
        );
      }

      if (!warehouse || !accessibleBusinessUnitIds.includes(warehouse.business_unit_id)) {
        return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
      }

      let query = supabase
        .from("warehouse_locations")
        .select(
          "id, company_id, warehouse_id, code, name, parent_id, location_type, is_pickable, is_storable, is_active, created_at, updated_at"
        )
        .eq("company_id", companyId)
        .eq("warehouse_id", warehouseId)
        .is("deleted_at", null)
        .order("code", { ascending: true })
        .limit(limit);

      if (!includeInactive) query = query.eq("is_active", true);
      if (search) {
        query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) {
        return NextResponse.json(
          { error: "Failed to fetch warehouse locations", details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        data:
          (data || []).map((location) => ({
            id: location.id,
            companyId: location.company_id,
            warehouseId: location.warehouse_id,
            code: location.code,
            name: location.name,
            parentId: location.parent_id,
            locationType: location.location_type,
            isPickable: location.is_pickable,
            isStorable: location.is_storable,
            isActive: location.is_active,
            createdAt: location.created_at,
            updatedAt: location.updated_at,
          })) ?? [],
      });
    }

    if (type === "items") {
      let query = supabase
        .from("items")
        .select("id, item_code, item_name, sku, is_active")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("item_name", { ascending: true })
        .limit(limit);
      if (!includeInactive) query = query.eq("is_active", true);
      if (search) query = query.or(`item_code.ilike.%${search}%,item_name.ilike.%${search}%,sku.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) return NextResponse.json({ error: "Failed to fetch items", details: error.message }, { status: 500 });
      return NextResponse.json({ data: (data || []).map((row) => ({ id: row.id, code: row.item_code, name: row.item_name, sku: row.sku, isActive: row.is_active ?? true })) });
    }

    if (type === "customers") {
      let query = supabase
        .from("customers")
        .select("id, customer_code, customer_name, is_active")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("customer_name", { ascending: true })
        .limit(limit);
      if (!includeInactive) query = query.eq("is_active", true);
      if (search) query = query.or(`customer_code.ilike.%${search}%,customer_name.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) return NextResponse.json({ error: "Failed to fetch customers", details: error.message }, { status: 500 });
      return NextResponse.json({ data: (data || []).map((row) => ({ id: row.id, code: row.customer_code, name: row.customer_name, isActive: row.is_active ?? true })) });
    }

    if (type === "suppliers") {
      let query = supabase
        .from("suppliers")
        .select("id, supplier_code, supplier_name, status")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("supplier_name", { ascending: true })
        .limit(limit);
      if (!includeInactive) query = query.eq("status", "active");
      if (search) query = query.or(`supplier_code.ilike.%${search}%,supplier_name.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) return NextResponse.json({ error: "Failed to fetch suppliers", details: error.message }, { status: 500 });
      return NextResponse.json({ data: (data || []).map((row) => ({ id: row.id, code: row.supplier_code, name: row.supplier_name, status: row.status, isActive: row.status === "active" })) });
    }

    if (type === "employees") {
      let query = supabase
        .from("employees")
        .select("id, employee_code, first_name, last_name, is_active")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("employee_code", { ascending: true })
        .limit(limit);
      if (!includeInactive) query = query.eq("is_active", true);
      if (search) query = query.or(`employee_code.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) return NextResponse.json({ error: "Failed to fetch employees", details: error.message }, { status: 500 });
      return NextResponse.json({
        data: (data || []).map((row) => ({
          id: row.id,
          code: row.employee_code,
          name: [row.first_name, row.last_name].filter(Boolean).join(" "),
          firstName: row.first_name,
          lastName: row.last_name,
          isActive: row.is_active ?? true,
        })),
      });
    }

    if (type === "item_categories") {
      let query = supabase
        .from("item_categories")
        .select("id, name, description")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .limit(limit);
      if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      const { data, error } = await query;
      if (error) return NextResponse.json({ error: "Failed to fetch item categories", details: error.message }, { status: 500 });
      return NextResponse.json({ data: (data || []).map((row) => ({ id: row.id, name: row.name, description: row.description })) });
    }

    // units_of_measure
    let query = supabase
      .from("units_of_measure")
      .select("id, code, name, symbol, is_active")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("code", { ascending: true })
      .limit(limit);
    if (!includeInactive) query = query.eq("is_active", true);
    if (search) query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%,symbol.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: "Failed to fetch units of measure", details: error.message }, { status: 500 });
    return NextResponse.json({
      data: (data || []).map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        symbol: row.symbol,
        isActive: row.is_active ?? true,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
