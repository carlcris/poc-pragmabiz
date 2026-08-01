import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, requireLookupDataAccess } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { Warehouse } from "@/types/warehouse";
import { ensureWarehouseDefaultLocation } from "@/services/inventory/locationService";

type DbWarehouse = {
  id: string;
  company_id: string;
  business_unit_id: string | null;
  warehouse_code: string;
  warehouse_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  is_active: boolean | null;
  is_van: boolean | null;
  created_at: string;
  updated_at: string | null;
};

type WarehousePageRpcRow = {
  id: string;
  companyId: string;
  businessUnitId: string | null;
  code: string;
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  managerName: string | null;
  isActive: boolean;
  isVan: boolean;
  createdAt: string;
  updatedAt: string;
  total_count: number | string;
};

type CreateWarehouseBody = {
  code?: string;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  managerId?: string;
  isActive?: boolean;
};

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const WAREHOUSE_COLUMNS =
  "id, company_id, business_unit_id, warehouse_code, warehouse_name, address_line1, address_line2, city, state, postal_code, country, phone, email, contact_person, is_active, is_van, created_at, updated_at";

const transformDbWarehouse = (dbWarehouse: DbWarehouse): Warehouse => ({
  id: dbWarehouse.id,
  companyId: dbWarehouse.company_id,
  businessUnitId: dbWarehouse.business_unit_id,
  code: dbWarehouse.warehouse_code,
  name: dbWarehouse.warehouse_name,
  description: "",
  address:
    `${dbWarehouse.address_line1 || ""}${dbWarehouse.address_line2 ? ` ${dbWarehouse.address_line2}` : ""}`.trim(),
  city: dbWarehouse.city || "",
  state: dbWarehouse.state || "",
  postalCode: dbWarehouse.postal_code || "",
  country: dbWarehouse.country || "",
  phone: dbWarehouse.phone || "",
  email: dbWarehouse.email || "",
  managerName: dbWarehouse.contact_person || undefined,
  isActive: dbWarehouse.is_active ?? true,
  isVan: dbWarehouse.is_van ?? false,
  createdAt: dbWarehouse.created_at,
  updatedAt: dbWarehouse.updated_at || dbWarehouse.created_at,
});

function parsePositiveInt(raw: string | null, fallback: number): number {
  const parsed = Number.parseInt(raw || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseIsActive(raw: string | null): boolean | null {
  if (raw === null) return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

function normalizeSearch(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.trim().replace(/[,%]/g, " ");
  return normalized.length > 0 ? normalized : null;
}

// GET /api/warehouses
async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requireLookupDataAccess(RESOURCES.WAREHOUSES);
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;

    const { supabase, companyId, currentBusinessUnitId } = context;
    if (!currentBusinessUnitId) {
      return NextResponse.json(
        { error: "Business unit context required", code: "BUSINESS_UNIT_CONTEXT_REQUIRED" },
        { status: 400 }
      );
    }
    const searchParams = request.nextUrl.searchParams;

    const search = normalizeSearch(searchParams.get("search"));
    const country = normalizeSearch(searchParams.get("country"));
    const parsedIsActive = parseIsActive(searchParams.get("isActive"));

    if (searchParams.get("isActive") !== null && parsedIsActive === null) {
      return NextResponse.json({ error: "Invalid isActive filter" }, { status: 400 });
    }

    const page = parsePositiveInt(searchParams.get("page"), 1);
    const requestedLimit = parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT);
    const limit = Math.min(requestedLimit, MAX_LIMIT);
    const { data, error } = await supabase.rpc("get_warehouses", {
      p_company_id: companyId,
      p_business_unit_id: currentBusinessUnitId,
      p_search: search,
      p_country: country,
      p_is_active: parsedIsActive,
      p_page: page,
      p_limit: limit,
    });

    if (error) {
      console.error("Failed to fetch warehouses", error);
      return NextResponse.json(
        { error: "Failed to fetch warehouses", code: "WAREHOUSE_LIST_FAILED" },
        { status: 500 }
      );
    }

    const rows = (data || []) as WarehousePageRpcRow[];
    const total = rows.length > 0 ? Number(rows[0].total_count) || 0 : 0;
    const totalPages = Math.ceil(total / limit);

    const warehouses: Warehouse[] = rows.map(({ total_count: totalCount, ...warehouse }) => {
      void totalCount;
      return {
        ...warehouse,
        managerName: warehouse.managerName || undefined,
      };
    });

    return NextResponse.json({
      data: warehouses,
      pagination: {
        page,
        total,
        totalPages,
        limit,
      },
    });
  } catch (error: unknown) {
    console.error("Unexpected warehouse list error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/warehouses
async function POSTHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, "create");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!currentBusinessUnitId) {
      return NextResponse.json(
        { error: "Business unit context required", code: "BUSINESS_UNIT_CONTEXT_REQUIRED" },
        { status: 400 }
      );
    }

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (userError || !userRow?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const body = (await request.json()) as CreateWarehouseBody;
    const code = body.code?.trim();
    const name = body.name?.trim();

    if (!code || !name) {
      return NextResponse.json(
        {
          error: "Warehouse code and name are required",
          code: "WAREHOUSE_REQUIRED_FIELDS_MISSING",
        },
        { status: 400 }
      );
    }

    const { data: existing, error: checkError } = await supabase
      .from("warehouses")
      .select("id")
      .eq("company_id", userRow.company_id)
      .eq("warehouse_code", code)
      .is("deleted_at", null)
      .maybeSingle();

    if (checkError) {
      console.error("Failed to validate warehouse code", checkError);
      return NextResponse.json(
        { error: "Failed to validate warehouse code", code: "WAREHOUSE_CODE_CHECK_FAILED" },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: "Warehouse code already exists", code: "WAREHOUSE_CODE_CONFLICT" },
        { status: 409 }
      );
    }

    const { data: newWarehouse, error: insertError } = await supabase
      .from("warehouses")
      .insert({
        company_id: userRow.company_id,
        business_unit_id: currentBusinessUnitId,
        warehouse_code: code,
        warehouse_name: name,
        address_line1: body.address?.trim() || null,
        city: body.city?.trim() || null,
        state: body.state?.trim() || null,
        postal_code: body.postalCode?.trim() || null,
        country: body.country?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
        contact_person: body.managerId?.trim() || null,
        is_active: body.isActive ?? true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select(WAREHOUSE_COLUMNS)
      .single();

    if (insertError) {
      console.error("Failed to create warehouse", insertError);
      return NextResponse.json(
        { error: "Failed to create warehouse", code: "WAREHOUSE_CREATE_FAILED" },
        { status: 500 }
      );
    }

    await ensureWarehouseDefaultLocation({
      supabase,
      companyId: newWarehouse.company_id,
      warehouseId: newWarehouse.id,
      userId: user.id,
    });

    return NextResponse.json(
      { data: transformDbWarehouse(newWarehouse as DbWarehouse) },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Unexpected warehouse creation error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "warehouses",
  route: "/api/warehouses",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "warehouses",
  route: "/api/warehouses",
});
