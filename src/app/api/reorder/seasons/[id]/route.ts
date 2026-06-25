import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { reorderSeasonUpdateSchema } from "@/lib/validations/reorder";

type DbReorderSeason = {
  id: string;
  code: string;
  name: string;
  effective_from: string;
  effective_to: string;
  priority: number;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toSeasonResponse = (row: DbReorderSeason) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  effectiveFrom: row.effective_from,
  effectiveTo: row.effective_to,
  priority: row.priority,
  isActive: row.is_active ?? true,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REORDER_MANAGEMENT, "edit");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, userId } = context;

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid reorder season id" }, { status: 400 });
    }

    const parsed = reorderSeasonUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid season" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      updated_by: userId,
    };
    if (parsed.data.code !== undefined) updateData.code = parsed.data.code.trim().toUpperCase();
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim();
    if (parsed.data.effectiveFrom !== undefined) updateData.effective_from = parsed.data.effectiveFrom;
    if (parsed.data.effectiveTo !== undefined) updateData.effective_to = parsed.data.effectiveTo;
    if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority;
    if (parsed.data.isActive !== undefined) updateData.is_active = parsed.data.isActive;

    const { data: season, error } = await supabase
      .from("reorder_seasons")
      .update(updateData)
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .select("id, code, name, effective_from, effective_to, priority, is_active, created_at, updated_at")
      .maybeSingle();

    if (error) {
      console.error("Error updating reorder season:", error);
      const message =
        error.code === "23505"
          ? "A reorder season with this code already exists"
          : error.code === "23514"
            ? "An active reorder season with the same priority overlaps this date range"
            : "Failed to update reorder season";
      return NextResponse.json({ error: message }, { status: error.code === "23505" ? 409 : 400 });
    }

    if (!season) {
      return NextResponse.json({ error: "Reorder season not found" }, { status: 404 });
    }

    return NextResponse.json({ data: toSeasonResponse(season as DbReorderSeason) });
  } catch (error) {
    console.error("Unexpected error updating reorder season:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.REORDER_MANAGEMENT, "delete");
    if (unauthorized) return unauthorized;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, userId } = context;

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid reorder season id" }, { status: 400 });
    }

    const { data: season, error } = await supabase
      .from("reorder_seasons")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Error deleting reorder season:", error);
      return NextResponse.json({ error: "Failed to delete reorder season" }, { status: 500 });
    }

    if (!season) {
      return NextResponse.json({ error: "Reorder season not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Reorder season deleted" });
  } catch (error) {
    console.error("Unexpected error deleting reorder season:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
