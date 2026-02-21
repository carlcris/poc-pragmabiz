import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
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

type UserContext = {
  userId: string;
  companyId: string;
  accessibleBusinessUnitIds: string[];
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

function transformDbWarehouse(dbWarehouse: DbWarehouse): Warehouse {
  return {
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
  };
}

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

async function getUserContext(): Promise<
  | { ok: true; context: UserContext; supabase: Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"] }
  | { ok: false; response: NextResponse }
> {
  const { supabase } = await createServerClientWithBU();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (userError || !userRow?.company_id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "User company not found" }, { status: 400 }),
    };
  }

  const { data: buAccess, error: buError } = await supabase
    .from("user_business_unit_access")
    .select("business_unit_id")
    .eq("user_id", user.id);

  if (buError) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Failed to resolve business unit access" }, { status: 500 }),
    };
  }

  const accessibleBusinessUnitIds = (buAccess || [])
    .map((row) => row.business_unit_id)
    .filter((value): value is string => Boolean(value));

  return {
    ok: true,
    context: {
      userId: user.id,
      companyId: userRow.company_id,
      accessibleBusinessUnitIds,
    },
    supabase,
  };
}

// GET /api/warehouses
export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requireLookupDataAccess(RESOURCES.WAREHOUSES);
    if (unauthorized) return unauthorized;

    const resolved = await getUserContext();
    if (!resolved.ok) return resolved.response;

    const { supabase, context } = resolved;
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
    const offset = (page - 1) * limit;

    if (context.accessibleBusinessUnitIds.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          page,
          total: 0,
          totalPages: 0,
          limit,
        },
      });
    }

    const buScope = `business_unit_id.in.(${context.accessibleBusinessUnitIds.join(",")}),business_unit_id.is.null`;

    let query = supabase
      .from("warehouses")
      .select("*", { count: "exact" })
      .eq("company_id", context.companyId)
      .is("deleted_at", null)
      .or(buScope);

    if (search) {
      query = query.or(
        `warehouse_code.ilike.%${search}%,warehouse_name.ilike.%${search}%,city.ilike.%${search}%`
      );
    }

    if (country) {
      query = query.ilike("country", `%${country}%`);
    }

    if (parsedIsActive !== null) {
      query = query.eq("is_active", parsedIsActive);
    }

    const { data, error, count } = await query
      .order("warehouse_code", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch warehouses", details: error.message },
        { status: 500 }
      );
    }

    const rows = (data || []) as DbWarehouse[];
    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: rows.map(transformDbWarehouse),
      pagination: {
        page,
        total,
        totalPages,
        limit,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/warehouses
export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
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
        { error: "Missing required fields", details: "code and name are required" },
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
      return NextResponse.json(
        { error: "Failed to validate warehouse code", details: checkError.message },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: "Warehouse code already exists", details: `Warehouse code "${code}" is already in use` },
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
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create warehouse", details: insertError.message },
        { status: 500 }
      );
    }

    await ensureWarehouseDefaultLocation({
      supabase,
      companyId: newWarehouse.company_id,
      warehouseId: newWarehouse.id,
      userId: user.id,
    });

    return NextResponse.json({ data: transformDbWarehouse(newWarehouse as DbWarehouse) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
