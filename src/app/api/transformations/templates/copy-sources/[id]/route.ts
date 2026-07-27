import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import type { TransformationTemplateCopySource } from "@/types/transformation-template";

const templateIdSchema = z.string().uuid();

async function GETHandler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "create");
    if (unauthorized) return unauthorized;

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const { id } = await params;
    const validationResult = templateIdSchema.safeParse(id);
    if (!validationResult.success) {
      return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc(
      "get_transformation_template_copy_source_with_additional_outputs",
      {
        p_template_id: validationResult.data,
      }
    );

    if (error) {
      if (error.code === "P0002") {
        return NextResponse.json({ error: "Template copy source not found" }, { status: 404 });
      }

      console.error("Failed to load transformation template copy source", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json({ error: "Failed to load template copy source" }, { status: 500 });
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return NextResponse.json({ error: "Template copy source not found" }, { status: 404 });
    }

    return NextResponse.json({ data: data as TransformationTemplateCopySource });
  } catch (error) {
    console.error("Unexpected transformation template copy source detail error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "view",
  resourceType: "transformations",
  route: "/api/transformations/templates/copy-sources/[id]",
});
