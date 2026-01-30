import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { createTransformationTemplateSchema } from "@/lib/validations/transformation-template";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { CreateTransformationTemplateRequest } from "@/types/transformation-template";

// GET /api/transformations/templates - List transformation templates
export async function GET(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "view");
    if (unauthorized) return unauthorized;

    const { supabase } = await createServerClientWithBU();
    const searchParams = request.nextUrl.searchParams;

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

    // Parse query parameters
    const search = searchParams.get("search") || "";
    const isActive = searchParams.get("isActive");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("transformation_templates")
      .select(
        `
        id,
        company_id,
        template_code,
        template_name,
        description,
        is_active,
        usage_count,
        created_by,
        created_at,
        updated_by,
        updated_at,
        deleted_at,
        inputs:transformation_template_inputs(
          id,
          item_id,
          quantity,
          uom_id,
          sequence,
          notes,
          items:items(
            id,
            item_code,
            item_name
          ),
          uom:units_of_measure(
            id,
            code,
            name
          )
        ),
        outputs:transformation_template_outputs(
          id,
          item_id,
          quantity,
          uom_id,
          sequence,
          is_scrap,
          notes,
          items:items(
            id,
            item_code,
            item_name
          ),
          uom:units_of_measure(
            id,
            code,
            name
          )
        )
      `,
        { count: "exact" }
      )
      .eq("company_id", userData.company_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(
        `template_code.ilike.%${search}%,template_name.ilike.%${search}%,description.ilike.%${search}%`
      );
    }
    if (isActive !== null && isActive !== undefined) {
      query = query.eq("is_active", isActive === "true");
    }

    // Execute query
    const { data: templates, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: templates || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/transformations/templates - Create transformation template
export async function POST(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "create");
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

    // Get user's company
    const { data: userData } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!userData?.company_id) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    // Validate business unit context
    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    // Parse and validate request body
    const body = (await request.json()) as CreateTransformationTemplateRequest;

    // Friendly guard: prevent same item in inputs and outputs
    if (Array.isArray(body?.inputs) && Array.isArray(body?.outputs)) {
      const inputIds = new Set(body.inputs.map((input) => input?.itemId).filter(Boolean));
      const hasCircular = body.outputs.some((output) => inputIds.has(output?.itemId));
      if (hasCircular) {
        return NextResponse.json(
          {
            error:
              "Input and output items must be different. Please choose a different output item.",
          },
          { status: 400 }
        );
      }
    }

    const dataToValidate = {
      ...body,
      companyId: userData.company_id,
    };

    const validationResult = createTransformationTemplateSchema.safeParse(dataToValidate);

    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        {
          error: firstError?.message || "Validation failed",
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check if template code already exists
    const { data: existingTemplate } = await supabase
      .from("transformation_templates")
      .select("id")
      .eq("company_id", userData.company_id)
      .eq("template_code", data.templateCode)
      .is("deleted_at", null)
      .single();

    if (existingTemplate) {
      return NextResponse.json({ error: "Template code already exists" }, { status: 400 });
    }

    // Create template header
    const { data: template, error: templateError } = await supabase
      .from("transformation_templates")
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        template_code: data.templateCode,
        template_name: data.templateName,
        description: data.description,
        is_active: true,
        usage_count: 0,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
    }

    // Create template inputs
    const inputsData = data.inputs.map((input, index) => ({
      template_id: template.id,
      item_id: input.itemId,
      quantity: input.quantity,
      uom_id: input.uomId,
      sequence: input.sequence || index + 1,
      notes: input.notes,
      created_by: user.id,
      updated_by: user.id,
    }));

    const { error: inputsError } = await supabase
      .from("transformation_template_inputs")
      .insert(inputsData);

    if (inputsError) {
      // Rollback: delete template
      await supabase.from("transformation_templates").delete().eq("id", template.id);

      return NextResponse.json({ error: "Failed to create template inputs" }, { status: 500 });
    }

    // Create template outputs
    const outputsData = data.outputs.map((output, index) => ({
      template_id: template.id,
      item_id: output.itemId,
      quantity: output.quantity,
      uom_id: output.uomId,
      sequence: output.sequence || index + 1,
      is_scrap: output.isScrap || false,
      notes: output.notes,
      created_by: user.id,
      updated_by: user.id,
    }));

    const { error: outputsError } = await supabase
      .from("transformation_template_outputs")
      .insert(outputsData);

    if (outputsError) {
      // Rollback: delete template and inputs
      await supabase.from("transformation_template_inputs").delete().eq("template_id", template.id);
      await supabase.from("transformation_templates").delete().eq("id", template.id);

      return NextResponse.json({ error: "Failed to create template outputs" }, { status: 500 });
    }

    // Fetch complete template with inputs/outputs
    const { data: completeTemplate } = await supabase
      .from("transformation_templates")
      .select(
        `
        *,
        inputs:transformation_template_inputs(*),
        outputs:transformation_template_outputs(*)
      `
      )
      .eq("id", template.id)
      .single();

    return NextResponse.json({ data: completeTemplate }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
