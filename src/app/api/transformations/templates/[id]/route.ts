import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { updateTransformationTemplateSchema } from "@/lib/validations/transformation-template";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";

// GET /api/transformations/templates/[id] - Get template by ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "view");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Fetch template with inputs and outputs
    const { data: template, error } = await supabase
      .from("transformation_templates")
      .select(
        `
        *,
        inputs:transformation_template_inputs(
          *,
          items(id, item_code, item_name),
          uom:units_of_measure(id, uom_name)
        ),
        outputs:transformation_template_outputs(
          *,
          items(id, item_code, item_name),
          uom:units_of_measure(id, uom_name)
        )
      `
      )
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (error || !template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ data: template });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/transformations/templates/[id] - Update template (limited fields)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "edit");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Check if template exists and lock status (used for early UX-friendly erroring)
    const { data: existingTemplate } = await supabase
      .from("transformation_templates")
      .select("id, usage_count")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (!existingTemplate) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Parse and validate request body
    const rawBody = (await request.json()) as Record<string, unknown>;
    const validationResult = updateTransformationTemplateSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    const hasStructuralChanges = data.inputs !== undefined || data.outputs !== undefined;

    // Check if template is locked (usage_count > 0)
    // Only allow isActive updates if locked, block name/description/image/structure changes
    if (existingTemplate.usage_count > 0) {
      if (data.templateName || data.description || data.imageUrl !== undefined || hasStructuralChanges) {
        return NextResponse.json(
          {
            error: `Template is locked because it is used by ${existingTemplate.usage_count} order(s). Only status changes are allowed.`,
          },
          { status: 400 }
        );
      }
    }

    const { data: updatedTemplate, error: rpcError } = await supabase.rpc(
      "update_transformation_template",
      {
        p_template_id: id,
        p_company_id: userData.company_id,
        p_user_id: user.id,
        p_template_name_provided: Object.prototype.hasOwnProperty.call(rawBody, "templateName"),
        p_template_name: data.templateName ?? null,
        p_description_provided: Object.prototype.hasOwnProperty.call(rawBody, "description"),
        p_description: data.description ?? null,
        p_image_url_provided: Object.prototype.hasOwnProperty.call(rawBody, "imageUrl"),
        p_image_url: data.imageUrl ?? null,
        p_is_active_provided: Object.prototype.hasOwnProperty.call(rawBody, "isActive"),
        p_is_active: data.isActive ?? null,
        p_inputs: data.inputs !== undefined ? JSON.parse(JSON.stringify(data.inputs)) : null,
        p_outputs: data.outputs !== undefined ? JSON.parse(JSON.stringify(data.outputs)) : null,
      }
    );

    if (rpcError) {
      if (rpcError.code === "23505") {
        const errorText = [rpcError.message, rpcError.details, rpcError.hint]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        let message: string;
        if (errorText.includes("uq_template_output_item")) {
          message = "Duplicate items in outputs are not allowed";
        } else if (errorText.includes("uq_template_input_item")) {
          message = "Duplicate items in inputs are not allowed";
        } else {
          // Surface the actual unique constraint context instead of mislabeling it.
          message = rpcError.details
            ? `${rpcError.message} (${rpcError.details})`
            : rpcError.message;
        }
        return NextResponse.json({ error: message }, { status: 400 });
      }
      if (rpcError.code === "P0001") {
        return NextResponse.json({ error: rpcError.message }, { status: 400 });
      }
      if (rpcError.code === "P0002") {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }
    const { data: completeTemplate, error: refetchError } = await supabase
      .from("transformation_templates")
      .select(
        `
        *,
        inputs:transformation_template_inputs(
          *,
          items(id, item_code, item_name),
          uom:units_of_measure(id, uom_name)
        ),
        outputs:transformation_template_outputs(
          *,
          items(id, item_code, item_name),
          uom:units_of_measure(id, uom_name)
        )
      `
      )
      .eq("id", id)
      .single();

    if (refetchError) {
      return NextResponse.json({ data: updatedTemplate });
    }

    return NextResponse.json({ data: completeTemplate });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/transformations/templates/[id] - Soft delete template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "delete");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const { id } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Check if template exists and is not locked
    const { data: template } = await supabase
      .from("transformation_templates")
      .select("id, usage_count, template_code")
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .single();

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (template.usage_count > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete template ${template.template_code} because it is used by ${template.usage_count} order(s)`,
        },
        { status: 400 }
      );
    }

    // Soft delete template
    const { error: deleteError } = await supabase
      .from("transformation_templates")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Template deleted successfully" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
