import { NextResponse } from "next/server";
import { requireAnyPermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { logQuotationError } from "../../quotations/_shared";

export async function GET() {
  try {
    const unauthorized = await requireAnyPermission([
      [RESOURCES.MANUFACTURING, "view"],
      [RESOURCES.STOCK_TRANSFORMATIONS, "view"],
    ]);
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("manufacturing_workstations")
      .select("id, workstation_code, workstation_name, description, sort_order, is_active")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      logQuotationError("Error fetching manufacturing workstations:", error);
      return NextResponse.json({ error: "Failed to load workstations" }, { status: 500 });
    }

    return NextResponse.json({
      data: (data || []).map((row) => ({
        id: row.id,
        code: row.workstation_code,
        name: row.workstation_name,
        description: row.description,
        sortOrder: row.sort_order,
        isActive: row.is_active,
      })),
    });
  } catch (error) {
    logQuotationError("Unexpected manufacturing workstations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
