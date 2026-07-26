import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { createTransformationTemplateSchema } from "@/lib/validations/transformation-template";
import type { Json } from "@/types/database.types";
import type { CreateTransformationTemplateRequest } from "@/types/transformation-template";

const TEMPLATE_DETAIL_SELECT = `
  id,
  company_id,
  business_unit_id,
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
  copied_from_template_id,
  copied_from_business_unit_id,
  copied_at,
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
    items:items(id, item_code, item_name),
    uom:units_of_measure(id, code, name)
  ),
  outputs:transformation_template_outputs(
    id,
    item_id,
    quantity,
    uom_id,
    sequence,
    is_scrap,
    notes,
    items:items(id, item_code, item_name),
    uom:units_of_measure(id, code, name)
  )
`;

const generateDesignerTemplateCode = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 900 + 100).toString();
  return `DST-${timestamp}${random}`;
};

const parseBoundedInteger = (value: string | null, fallback: number, maximum: number) => {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
};

const sanitizeSearch = (value: string) =>
  value
    .trim()
    .slice(0, 100)
    .replace(/[,%_()]/g, "");

const toJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;

async function GETHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "view");
    if (unauthorized) return unauthorized;

    const { supabase, userId, companyId } = await createServerClientWithBU();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!companyId) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const search = sanitizeSearch(request.nextUrl.searchParams.get("search") || "");
    const isActive = request.nextUrl.searchParams.get("isActive");
    const page = parseBoundedInteger(request.nextUrl.searchParams.get("page"), 1, 1_000_000);
    const limit = parseBoundedInteger(request.nextUrl.searchParams.get("limit"), 20, 100);
    const offset = (page - 1) * limit;

    let query = supabase
      .from("transformation_templates")
      .select(TEMPLATE_DETAIL_SELECT, { count: "exact" })
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(
        `template_code.ilike.%${search}%,template_name.ilike.%${search}%,description.ilike.%${search}%`
      );
    }
    if (isActive === "true" || isActive === "false") {
      query = query.eq("is_active", isActive === "true");
    }

    const { data: templates, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error("Failed to list transformation templates", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { error: "Failed to load transformation templates" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: templates || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Unexpected transformation template list error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function POSTHandler(request: NextRequest) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSFORMATIONS, "create");
    if (unauthorized) return unauthorized;

    const { supabase, userId, companyId, currentBusinessUnitId } = await createServerClientWithBU();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!companyId) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }
    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const body = (await request.json()) as CreateTransformationTemplateRequest;
    const validationResult = createTransformationTemplateSchema.safeParse({
      ...body,
      companyId,
    });

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: validationResult.error.issues[0]?.message || "Validation failed",
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
        : data.inputs;

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
        : data.outputs;

    const templateCode =
      data.templateCode ||
      (data.templateKind === "sheet_layout" ? generateDesignerTemplateCode() : "");

    if (!templateCode) {
      return NextResponse.json({ error: "Template code is required" }, { status: 400 });
    }

    const { data: templateId, error: createError } = await supabase.rpc(
      "create_transformation_template",
      {
        p_template_code: templateCode,
        p_template_name: data.templateName,
        p_template_kind: data.templateKind,
        p_description: data.description ?? null,
        p_image_url: data.imageUrl ?? null,
        p_sheet_width: data.sheetWidth ?? null,
        p_sheet_height: data.sheetHeight ?? null,
        p_sheet_unit: data.sheetUnit ?? null,
        p_layout: data.layout ? toJson(data.layout) : null,
        p_inputs: toJson(resolvedInputs),
        p_outputs: toJson(resolvedOutputs),
        p_copied_from_template_id: data.copiedFromTemplateId ?? null,
      }
    );

    if (createError || !templateId) {
      console.error("Failed to create transformation template", {
        code: createError?.code,
        message: createError?.message,
      });

      if (createError?.code === "23505") {
        return NextResponse.json({ error: "Template code already exists" }, { status: 400 });
      }
      if (createError?.code === "P0002") {
        return NextResponse.json(
          { error: "The selected copy source is no longer available" },
          { status: 400 }
        );
      }
      if (createError?.code === "P0001") {
        return NextResponse.json({ error: "Template data is invalid" }, { status: 400 });
      }

      return NextResponse.json(
        { error: "Failed to create transformation template" },
        { status: 500 }
      );
    }

    const { data: completeTemplate, error: refetchError } = await supabase
      .from("transformation_templates")
      .select(TEMPLATE_DETAIL_SELECT)
      .eq("id", templateId)
      .single();

    if (refetchError || !completeTemplate) {
      console.error("Created transformation template could not be reloaded", {
        templateId,
        code: refetchError?.code,
        message: refetchError?.message,
      });
      return NextResponse.json(
        {
          data: {
            id: templateId,
            company_id: companyId,
            business_unit_id: currentBusinessUnitId,
            template_code: templateCode,
            template_name: data.templateName,
            description: data.description ?? null,
            image_url: data.imageUrl ?? null,
            template_kind: data.templateKind,
            sheet_width: data.sheetWidth ?? null,
            sheet_height: data.sheetHeight ?? null,
            sheet_unit: data.sheetUnit ?? null,
            layout_json: data.layout ?? null,
            is_active: true,
            usage_count: 0,
            copied_from_template_id: data.copiedFromTemplateId ?? null,
            inputs: [],
            outputs: [],
          },
        },
        { status: 201 }
      );
    }

    return NextResponse.json({ data: completeTemplate }, { status: 201 });
  } catch (error) {
    console.error("Unexpected transformation template create error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "transformations",
  route: "/api/transformations/templates",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "transformations",
  route: "/api/transformations/templates",
});
