import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { Warehouse } from "@/types/warehouse";

type DbWarehouse = {
  id: string;
  company_id: string;
  business_unit_id?: string | null;
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

type WarehouseUpdate = Partial<DbWarehouse> & { updated_by: string };

type UpdateWarehouseBody = {
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function transformDbWarehouse(dbWarehouse: DbWarehouse): Warehouse {
  return {
    id: dbWarehouse.id,
    companyId: dbWarehouse.company_id,
    businessUnitId: dbWarehouse.business_unit_id ?? null,
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

async function resolveUserScope(supabase: Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"], userId: string) {
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("company_id")
    .eq("id", userId)
    .single();

  if (userError || !userRow?.company_id) {
    return { error: NextResponse.json({ error: "User company not found" }, { status: 400 }) };
  }

  const { data: buAccess, error: buError } = await supabase
    .from("user_business_unit_access")
    .select("business_unit_id")
    .eq("user_id", userId);

  if (buError) {
    return {
      error: NextResponse.json(
        { error: "Failed to resolve business unit access", details: buError.message },
        { status: 500 }
      ),
    };
  }

  const accessibleBusinessUnitIds = (buAccess || [])
    .map((row) => row.business_unit_id)
    .filter((value): value is string => Boolean(value));

  return { companyId: userRow.company_id, accessibleBusinessUnitIds };
}

async function getScopedWarehouse(
  supabase: Awaited<ReturnType<typeof createServerClientWithBU>>["supabase"],
  warehouseId: string,
  companyId: string,
  accessibleBusinessUnitIds: string[]
) {
  if (accessibleBusinessUnitIds.length === 0) return { data: null as DbWarehouse | null, error: null };

  const buScope = `business_unit_id.in.(${accessibleBusinessUnitIds.join(",")}),business_unit_id.is.null`;

  return supabase
    .from("warehouses")
    .select("*")
    .eq("id", warehouseId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .or(buScope)
    .maybeSingle();
}

// GET /api/warehouses/[id]
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, "view");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid warehouse id" }, { status: 400 });
    }

    const scope = await resolveUserScope(supabase, user.id);
    if ("error" in scope) return scope.error;

    const { data, error } = await getScopedWarehouse(
      supabase,
      id,
      scope.companyId,
      scope.accessibleBusinessUnitIds
    );

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch warehouse", details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    return NextResponse.json({ data: transformDbWarehouse(data as DbWarehouse) });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/warehouses/[id]
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, "edit");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid warehouse id" }, { status: 400 });
    }

    const scope = await resolveUserScope(supabase, user.id);
    if ("error" in scope) return scope.error;

    const { data: existing, error: existError } = await getScopedWarehouse(
      supabase,
      id,
      scope.companyId,
      scope.accessibleBusinessUnitIds
    );

    if (existError) {
      return NextResponse.json(
        { error: "Failed to check warehouse", details: existError.message },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    const body = (await request.json()) as UpdateWarehouseBody;
    const updateData: WarehouseUpdate = { updated_by: user.id };

    if (body.name !== undefined) updateData.warehouse_name = body.name.trim();
    if (body.address !== undefined) updateData.address_line1 = body.address.trim() || null;
    if (body.city !== undefined) updateData.city = body.city.trim() || null;
    if (body.state !== undefined) updateData.state = body.state.trim() || null;
    if (body.postalCode !== undefined) updateData.postal_code = body.postalCode.trim() || null;
    if (body.country !== undefined) updateData.country = body.country.trim() || null;
    if (body.phone !== undefined) updateData.phone = body.phone.trim() || null;
    if (body.email !== undefined) updateData.email = body.email.trim() || null;
    if (body.managerId !== undefined) updateData.contact_person = body.managerId.trim() || null;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    if (Object.keys(updateData).length === 1) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    }

    const { data: updatedWarehouse, error: updateError } = await supabase
      .from("warehouses")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", scope.companyId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update warehouse", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: transformDbWarehouse(updatedWarehouse as DbWarehouse) });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/warehouses/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, "delete");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid warehouse id" }, { status: 400 });
    }

    const scope = await resolveUserScope(supabase, user.id);
    if ("error" in scope) return scope.error;

    const { data: existing, error: existError } = await getScopedWarehouse(
      supabase,
      id,
      scope.companyId,
      scope.accessibleBusinessUnitIds
    );

    if (existError) {
      return NextResponse.json(
        { error: "Failed to check warehouse", details: existError.message },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("warehouses")
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", id)
      .eq("company_id", scope.companyId)
      .is("deleted_at", null);

    if (deleteError) {
      return NextResponse.json(
        { error: "Failed to delete warehouse", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Warehouse deleted successfully" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
