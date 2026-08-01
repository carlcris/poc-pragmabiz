import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext, type RequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import type { Warehouse } from "@/types/warehouse";

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

type WarehouseUpdate = {
  warehouse_name?: string;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  contact_person?: string | null;
  is_active?: boolean;
  updated_by: string;
};

const updateWarehouseBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(50).optional(),
  email: z.string().trim().email().max(255).or(z.literal("")).optional(),
  managerId: z.string().trim().max(255).optional(),
  isActive: z.boolean().optional(),
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WAREHOUSE_COLUMNS =
  "id, company_id, business_unit_id, warehouse_code, warehouse_name, address_line1, address_line2, city, state, postal_code, country, phone, email, contact_person, is_active, is_van, created_at, updated_at";

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

function businessUnitContextRequired() {
  return NextResponse.json(
    { error: "Business unit context required", code: "BUSINESS_UNIT_CONTEXT_REQUIRED" },
    { status: 400 }
  );
}

function warehouseNotFound() {
  return NextResponse.json(
    { error: "Warehouse not found", code: "WAREHOUSE_NOT_FOUND" },
    { status: 404 }
  );
}

async function getScopedWarehouse(
  supabase: RequestContext["supabase"],
  warehouseId: string,
  companyId: string,
  businessUnitId: string
) {
  return supabase
    .from("warehouses")
    .select(WAREHOUSE_COLUMNS)
    .eq("id", warehouseId)
    .eq("company_id", companyId)
    .eq("business_unit_id", businessUnitId)
    .is("deleted_at", null)
    .maybeSingle();
}

// GET /api/warehouses/[id]
async function GETHandler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, "view");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId } = context;
    if (!currentBusinessUnitId) return businessUnitContextRequired();

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "Invalid warehouse id", code: "INVALID_WAREHOUSE_ID" },
        { status: 400 }
      );
    }

    const { data, error } = await getScopedWarehouse(
      supabase,
      id,
      companyId,
      currentBusinessUnitId
    );

    if (error) {
      console.error("Failed to fetch warehouse", error);
      return NextResponse.json(
        { error: "Failed to fetch warehouse", code: "WAREHOUSE_FETCH_FAILED" },
        { status: 500 }
      );
    }

    if (!data) return warehouseNotFound();

    return NextResponse.json({ data: transformDbWarehouse(data as DbWarehouse) });
  } catch (error: unknown) {
    console.error("Unexpected warehouse detail error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/warehouses/[id]
async function PUTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, "edit");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;
    if (!currentBusinessUnitId) return businessUnitContextRequired();

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "Invalid warehouse id", code: "INVALID_WAREHOUSE_ID" },
        { status: 400 }
      );
    }

    const { data: existing, error: existError } = await getScopedWarehouse(
      supabase,
      id,
      companyId,
      currentBusinessUnitId
    );

    if (existError) {
      console.error("Failed to check warehouse", existError);
      return NextResponse.json(
        { error: "Failed to check warehouse", code: "WAREHOUSE_CHECK_FAILED" },
        { status: 500 }
      );
    }

    if (!existing) return warehouseNotFound();

    const parsedBody = updateWarehouseBodySchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Invalid warehouse update", code: "WAREHOUSE_UPDATE_INVALID" },
        { status: 400 }
      );
    }

    const body = parsedBody.data;
    const updateData: WarehouseUpdate = { updated_by: userId };

    if (body.name !== undefined) updateData.warehouse_name = body.name;
    if (body.address !== undefined) updateData.address_line1 = body.address || null;
    if (body.city !== undefined) updateData.city = body.city || null;
    if (body.state !== undefined) updateData.state = body.state || null;
    if (body.postalCode !== undefined) updateData.postal_code = body.postalCode || null;
    if (body.country !== undefined) updateData.country = body.country || null;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.email !== undefined) updateData.email = body.email || null;
    if (body.managerId !== undefined) updateData.contact_person = body.managerId || null;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;

    if (Object.keys(updateData).length === 1) {
      return NextResponse.json(
        { error: "No changes provided", code: "WAREHOUSE_NO_CHANGES" },
        { status: 400 }
      );
    }

    const { data: updatedWarehouse, error: updateError } = await supabase
      .from("warehouses")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .select(WAREHOUSE_COLUMNS)
      .single();

    if (updateError) {
      console.error("Failed to update warehouse", updateError);
      return NextResponse.json(
        { error: "Failed to update warehouse", code: "WAREHOUSE_UPDATE_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: transformDbWarehouse(updatedWarehouse as DbWarehouse),
    });
  } catch (error: unknown) {
    console.error("Unexpected warehouse update error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/warehouses/[id]
async function DELETEHandler(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, "delete");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;
    if (!currentBusinessUnitId) return businessUnitContextRequired();

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { error: "Invalid warehouse id", code: "INVALID_WAREHOUSE_ID" },
        { status: 400 }
      );
    }

    const { data: existing, error: existError } = await getScopedWarehouse(
      supabase,
      id,
      companyId,
      currentBusinessUnitId
    );

    if (existError) {
      console.error("Failed to check warehouse", existError);
      return NextResponse.json(
        { error: "Failed to check warehouse", code: "WAREHOUSE_CHECK_FAILED" },
        { status: 500 }
      );
    }

    if (!existing) return warehouseNotFound();

    const { error: deleteError } = await supabase
      .from("warehouses")
      .update({ deleted_at: new Date().toISOString(), updated_by: userId })
      .eq("id", id)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null);

    if (deleteError) {
      console.error("Failed to delete warehouse", deleteError);
      return NextResponse.json(
        { error: "Failed to delete warehouse", code: "WAREHOUSE_DELETE_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Warehouse deleted successfully" });
  } catch (error: unknown) {
    console.error("Unexpected warehouse deletion error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "warehouses",
  route: "/api/warehouses/[id]",
});
export const PUT = withActivityLogging(PUTHandler, {
  action: "update",
  resourceType: "warehouses",
  route: "/api/warehouses/[id]",
});
export const DELETE = withActivityLogging(DELETEHandler, {
  action: "delete",
  resourceType: "warehouses",
  route: "/api/warehouses/[id]",
});
