import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import { createTransformationTemplateSchema } from "@/lib/validations/transformation-template";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { CreateTransformationTemplateRequest } from "@/types/transformation-template";

const generateDesignerTemplateCode = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 900 + 100).toString();
  return `DST-${timestamp}${random}`;
};

const getDbErrorMessage = (message: string, details?: string | null, hint?: string | null) =>
  [message, details, hint].filter(Boolean).join(" ");

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
        image_url,
        template_kind,
        sheet_width,
        sheet_height,
        sheet_unit,
        layout_json,
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

    const resolvedInputs =
      data.templateKind === "sheet_layout" && data.layout?.sourceItem
        ? [
            {
              itemId: data.layout.sourceItem.itemId,
              quantity: 1,
              uomId: data.layout.sourceItem.uomId,
              sequence: 1,
              notes: "Parent sheet",
            },
          ]
        : data.inputs || [];

    const resolvedOutputs =
      data.templateKind === "sheet_layout"
        ? Object.values(
            (data.layout?.sections || []).reduce<
              Record<
                string,
                {
                  itemId: string;
                  quantity: number;
                  uomId: string;
                  sequence: number;
                  isScrap: boolean;
                  notes?: string;
                }
              >
            >((accumulator, section) => {
              if (section.type !== "piece" || !section.mappedItem) return accumulator;

              const existing = accumulator[section.mappedItem.itemId];
              if (existing) {
                existing.quantity += 1;
                return accumulator;
              }

              accumulator[section.mappedItem.itemId] = {
                itemId: section.mappedItem.itemId,
                quantity: 1,
                uomId: section.mappedItem.uomId,
                sequence: section.order,
                isScrap: false,
                notes: "Mapped sheet layout piece",
              };
              return accumulator;
            }, {})
          ).sort((a, b) => a.sequence - b.sequence)
        : data.outputs || [];

    const templateCode =
      data.templateCode || (data.templateKind === "sheet_layout" ? generateDesignerTemplateCode() : "");

    if (!templateCode) {
      return NextResponse.json({ error: "Template code is required" }, { status: 400 });
    }

    // Check if template code already exists
    const { data: existingTemplate } = await supabase
      .from("transformation_templates")
      .select("id")
      .eq("company_id", userData.company_id)
      .eq("template_code", templateCode)
      .is("deleted_at", null)
      .single();

    if (existingTemplate) {
      return NextResponse.json({ error: "Template code already exists" }, { status: 400 });
    }

    // Create template header
    const insertPayload = {
      company_id: userData.company_id,
      business_unit_id: currentBusinessUnitId,
      template_code: templateCode,
      template_name: data.templateName,
      description: data.description,
      image_url: data.imageUrl || null,
      template_kind: data.templateKind,
      sheet_width: data.sheetWidth ?? null,
      sheet_height: data.sheetHeight ?? null,
      sheet_unit: data.sheetUnit ?? null,
      layout_json: data.layout ?? null,
      is_active: true,
      usage_count: 0,
      created_by: user.id,
      updated_by: user.id,
    };

    const { data: insertedTemplate, error: templateError } = await supabase
      .from("transformation_templates")
      .insert(insertPayload)
      .select("id")
      .maybeSingle();

    if (templateError) {
      const errorMessage = getDbErrorMessage(
        templateError.message,
        templateError.details,
        templateError.hint
      );
      const status = templateError.code?.startsWith("23") ? 400 : 500;
      return NextResponse.json(
        { error: errorMessage || "Failed to create template" },
        { status }
      );
    }

    const templateId = insertedTemplate?.id;

    if (!templateId) {
      const { data: fallbackTemplate, error: fallbackError } = await supabase
        .from("transformation_templates")
        .select("id")
        .eq("company_id", userData.company_id)
        .eq("business_unit_id", currentBusinessUnitId)
        .eq("template_code", templateCode)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackError || !fallbackTemplate?.id) {
        const errorMessage = fallbackError
          ? getDbErrorMessage(fallbackError.message, fallbackError.details, fallbackError.hint)
          : "Template was inserted but could not be reloaded";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
      }

      const resolvedTemplateId = fallbackTemplate.id;
      const { data: reloadedTemplate } = await supabase
        .from("transformation_templates")
        .select(
          `
          *,
          inputs:transformation_template_inputs(*),
          outputs:transformation_template_outputs(*)
        `
        )
        .eq("id", resolvedTemplateId)
        .single();

      return NextResponse.json({
        data: reloadedTemplate ?? { ...insertPayload, id: resolvedTemplateId },
      });
    }

    // Create template inputs
    const inputsData = resolvedInputs.map((input, index) => ({
      template_id: templateId,
      item_id: input.itemId,
      quantity: input.quantity,
      uom_id: input.uomId,
      sequence: input.sequence || index + 1,
      notes: input.notes,
      created_by: user.id,
      updated_by: user.id,
    }));

    const { error: inputsError } = inputsData.length
      ? await supabase.from("transformation_template_inputs").insert(inputsData)
      : { error: null };

    if (inputsError) {
      // Rollback: delete template
      await supabase.from("transformation_templates").delete().eq("id", templateId);

      return NextResponse.json(
        { error: getDbErrorMessage(inputsError.message, inputsError.details, inputsError.hint) },
        { status: 500 }
      );
    }

    // Create template outputs
    const outputsData = resolvedOutputs.map((output, index) => ({
      template_id: templateId,
      item_id: output.itemId,
      quantity: output.quantity,
      uom_id: output.uomId,
      sequence: output.sequence || index + 1,
      is_scrap: output.isScrap || false,
      notes: output.notes,
      created_by: user.id,
      updated_by: user.id,
    }));

    const { error: outputsError } = outputsData.length
      ? await supabase.from("transformation_template_outputs").insert(outputsData)
      : { error: null };

    if (outputsError) {
      // Rollback: delete template and inputs
      await supabase.from("transformation_template_inputs").delete().eq("template_id", templateId);
      await supabase.from("transformation_templates").delete().eq("id", templateId);

      return NextResponse.json(
        { error: getDbErrorMessage(outputsError.message, outputsError.details, outputsError.hint) },
        { status: 500 }
      );
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
      .eq("id", templateId)
      .single();

    return NextResponse.json({ data: completeTemplate }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
