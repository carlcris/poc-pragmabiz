import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { NextRequest, NextResponse } from "next/server";
import type { CreateQuotationRequest, QuotationLineItem } from "@/types/quotation";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import {
  asRpcClient,
  fetchQuotationById,
  getClientErrorMessage,
  logQuotationError,
  transformDbQuotation,
  transformDbQuotationItem,
  type DbQuotationItemWithJoins,
  type DbQuotationWithJoins,
} from "./_shared";

type QuotationCursor = {
  quotationDate: string;
  createdAt: string;
  id: string;
};

const MAX_LIMIT = 50;

const parseLimit = (value: string | null) => {
  const parsed = Number.parseInt(value || "10", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 10;
  return Math.min(parsed, MAX_LIMIT);
};

const encodeCursor = (cursor: QuotationCursor) => {
  return Buffer.from(JSON.stringify(cursor), "utf-8").toString("base64url");
};

const decodeCursor = (value: string | null): QuotationCursor | null => {
  if (!value) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf-8")
    ) as Partial<QuotationCursor>;
    if (
      typeof parsed.quotationDate === "string" &&
      typeof parsed.createdAt === "string" &&
      typeof parsed.id === "string"
    ) {
      return {
        quotationDate: parsed.quotationDate,
        createdAt: parsed.createdAt,
        id: parsed.id,
      };
    }
  } catch {}

  return null;
};

// GET /api/quotations - List quotations with server-side filters and cursor pagination
async function GETHandler(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, "view");

    const { supabase } = await createServerClientWithBU();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const limit = parseLimit(searchParams.get("limit"));
    const cursor = decodeCursor(searchParams.get("cursor"));

    let query = supabase
      .from("sales_quotations")
      .select(
        `
        *,
        customers:customer_id (
          id,
          customer_name,
          email
        ),
        users:created_by (
          id,
          first_name,
          last_name
        )
      `,
        { count: "exact" }
      )
      .is("deleted_at", null)
      .order("quotation_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (search) {
      query = query.or(`quotation_code.ilike.%${search}%,notes.ilike.%${search}%`);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    if (dateFrom) {
      query = query.gte("quotation_date", dateFrom);
    }

    if (dateTo) {
      query = query.lte("quotation_date", dateTo);
    }

    if (cursor) {
      query = query.or(
        `quotation_date.lt.${cursor.quotationDate},and(quotation_date.eq.${cursor.quotationDate},created_at.lt.${cursor.createdAt}),and(quotation_date.eq.${cursor.quotationDate},created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
      );
    }

    const { data: rawQuotations, error, count } = await query;

    if (error) {
      logQuotationError("Error fetching quotations:", error);
      return NextResponse.json({ error: "Failed to load quotations" }, { status: 500 });
    }

    const rows = (rawQuotations || []) as DbQuotationWithJoins[];
    const hasMore = rows.length > limit;
    const quotations = hasMore ? rows.slice(0, limit) : rows;
    const quotationIds = quotations.map((quotation) => quotation.id);
    let itemsByQuotation: Record<string, QuotationLineItem[]> = {};

    if (quotationIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from("sales_quotation_items")
        .select(
          `
          *,
          items (
            id,
            item_code,
            item_name
          ),
          units_of_measure (
            id,
            code,
            name
          )
        `
        )
        .in("quotation_id", quotationIds)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (itemsError) {
        logQuotationError("Error fetching quotation items:", itemsError);
        return NextResponse.json({ error: "Failed to load quotations" }, { status: 500 });
      }

      itemsByQuotation =
        (items as DbQuotationItemWithJoins[] | null)?.reduce(
          (acc, item) => {
            if (!acc[item.quotation_id]) {
              acc[item.quotation_id] = [];
            }
            acc[item.quotation_id].push(transformDbQuotationItem(item));
            return acc;
          },
          {} as Record<string, QuotationLineItem[]>
        ) || {};
    }

    const transformedData = quotations.map((quotation) =>
      transformDbQuotation(quotation, itemsByQuotation[quotation.id] || [])
    );

    const lastQuotation = quotations[quotations.length - 1];
    const nextCursor =
      hasMore && lastQuotation
        ? encodeCursor({
            quotationDate: lastQuotation.quotation_date,
            createdAt: lastQuotation.created_at,
            id: lastQuotation.id,
          })
        : null;

    return NextResponse.json({
      data: transformedData,
      pagination: {
        total: count || 0,
        limit,
        nextCursor,
        hasMore,
      },
    });
  } catch (error) {
    logQuotationError("Unexpected quotation list error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/quotations - Create new quotation
async function POSTHandler(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, "create");

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();

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

    const body: CreateQuotationRequest = await request.json();

    if (!body.customerId || !body.quotationDate || !body.items || body.items.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const quotationCode = body.quotationCode?.trim();
    if (quotationCode) {
      return NextResponse.json(
        { error: "quotationCode is generated automatically and must not be provided" },
        { status: 400 }
      );
    }

    const { data: quotationId, error: rpcError } = await asRpcClient(supabase).rpc(
      "create_sales_quotation_transaction",
      {
        p_customer_id: body.customerId,
        p_quotation_date: body.quotationDate,
        p_valid_until: body.validUntil || null,
        p_price_list_id: body.priceListId || null,
        p_terms_conditions: body.termsConditions || null,
        p_notes: body.notes || null,
        p_business_unit_id: currentBusinessUnitId,
        p_items: body.items,
      }
    );

    if (rpcError || typeof quotationId !== "string") {
      logQuotationError("Error creating quotation:", rpcError);
      return NextResponse.json(
        { error: getClientErrorMessage(rpcError, "Failed to create quotation") },
        { status: 500 }
      );
    }

    const { quotation, error: fetchError } = await fetchQuotationById(supabase, quotationId);

    if (fetchError || !quotation) {
      logQuotationError("Error fetching created quotation:", fetchError);
      return NextResponse.json(
        { error: "Quotation was created but could not be loaded" },
        { status: 500 }
      );
    }

    return NextResponse.json(quotation, { status: 201 });
  } catch (error) {
    logQuotationError("Unexpected quotation create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "quotations",
  route: "/api/quotations",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "quotations",
  route: "/api/quotations",
});
