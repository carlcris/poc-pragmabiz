import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, requireLookupDataAccess } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { Warehouse, CreateWarehouseRequest } from "@/types/warehouse";
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

// Transform database warehouse to frontend Warehouse type
function transformDbWarehouse(dbWarehouse: DbWarehouse): Warehouse {
  return {
    id: dbWarehouse.id,
    companyId: dbWarehouse.company_id,
    businessUnitId: dbWarehouse.business_unit_id,
    code: dbWarehouse.warehouse_code,
    name: dbWarehouse.warehouse_name,
    description: "", // Not in DB, can add later if needed
    address:
      `${dbWarehouse.address_line1 || ""}${dbWarehouse.address_line2 ? " " + dbWarehouse.address_line2 : ""}`.trim(),
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

// GET /api/warehouses - List warehouses with filters
export async function GET(request: NextRequest) {
  try {
    // Check permission using Lookup Data Access Pattern
    // User can access if they have EITHER:
    // 1. Direct 'warehouses' view permission, OR
    // 2. Permission to a feature that depends on warehouses (van_sales, purchase_orders, stock_transfers, etc.)
    const unauthorized = await requireLookupDataAccess(RESOURCES.WAREHOUSES);
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");
    const isActive = searchParams.get("isActive");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    // Get user's accessible business units
    const { data: userBUAccess } = await supabase
      .from("user_business_unit_access")
      .select("business_unit_id")
      .eq("user_id", user.id);

    const accessibleBUIds = userBUAccess?.map((access) => access.business_unit_id) || [];

    // If user has no business unit access, return empty result
    if (accessibleBUIds.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      });
    }

    // Build query - filter by user's accessible business units
    // Also include warehouses without a business_unit_id (NULL) for backward compatibility
    let query = supabase
      .from("warehouses")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .or(`business_unit_id.in.(${accessibleBUIds.join(",")}),business_unit_id.is.null`);

    // Apply filters
    if (search) {
      query = query.or(
        `warehouse_code.ilike.%${search}%,warehouse_name.ilike.%${search}%,city.ilike.%${search}%`
      );
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq("is_active", isActive === "true");
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    // Order by created_at descending
    query = query.order("created_at", { ascending: false });

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch warehouses", details: error.message },
        { status: 500 }
      );
    }

    // Transform data
    const warehouses = (data || []).map(transformDbWarehouse);

    // Calculate pagination
    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: warehouses,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/warehouses - Create new warehouse
export async function POST(request: NextRequest) {
  try {
    // Require 'warehouses' create permission
    const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, "create");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

    // Check authentication
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

    // Parse request body
    const body: CreateWarehouseRequest = await request.json();

    // Validate required fields
    if (!body.code || !body.name) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          details: "code and name are required",
        },
        { status: 400 }
      );
    }

    // Check for duplicate warehouse code
    const { data: existing } = await supabase
      .from("warehouses")
      .select("id")
      .eq("company_id", body.companyId)
      .eq("warehouse_code", body.code)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error: "Warehouse code already exists",
          details: `Warehouse code "${body.code}" is already in use`,
        },
        { status: 409 }
      );
    }

    // business_unit_id from JWT - set by auth hook
    // Insert warehouse
    const { data: newWarehouse, error: insertError } = await supabase
      .from("warehouses")
      .insert({
        company_id: body.companyId,
        business_unit_id: currentBusinessUnitId,
        warehouse_code: body.code,
        warehouse_name: body.name,
        address_line1: body.address,
        city: body.city,
        state: body.state,
        postal_code: body.postalCode,
        country: body.country,
        phone: body.phone,
        email: body.email,
        contact_person: body.managerId,
        is_active: body.isActive ?? true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
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

    // Transform and return
    const warehouse = transformDbWarehouse(newWarehouse);

    return NextResponse.json({ data: warehouse }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
