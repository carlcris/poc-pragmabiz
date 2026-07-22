import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import {
  getCustomerPricingCapabilities,
  requireCustomerPricingCapability,
} from "@/lib/customer-pricing/permissions";
import {
  type CustomerItemPriceRow,
  toCustomerItemPrice,
} from "@/lib/customer-pricing/customer-item-price";
import { createCustomerItemPriceSchema } from "@/lib/validations/customer-pricing";
import { can } from "@/services/permissions/permissionResolver";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const parsePositiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeSearch = (value: string | null) =>
  value
    ?.trim()
    .slice(0, 100)
    .replace(/[%_,().]/g, " ")
    .trim() || "";

const CUSTOMER_PRICE_SELECT = `
  id,
  customer_id,
  item_id,
  price_tier,
  price,
  currency_code,
  effective_from,
  effective_to,
  is_active,
  created_at,
  updated_at,
  version,
  item:items!inner(item_code, item_name)
`;

async function GETHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parentDenied = await requirePermission(RESOURCES.CUSTOMERS, "view");
    if (parentDenied) return parentDenied;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const capabilityDenied = await requireCustomerPricingCapability(
      userId,
      currentBusinessUnitId,
      "canView"
    );
    if (capabilityDenied) return capabilityDenied;

    const { id: customerId } = await params;
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .maybeSingle();

    if (customerError) {
      console.error("Failed to verify special-price customer:", customerError);
      return NextResponse.json({ error: "Failed to fetch special prices" }, { status: 500 });
    }
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const searchParams = request.nextUrl.searchParams;
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = Math.min(
      parsePositiveInteger(searchParams.get("limit"), DEFAULT_LIMIT),
      MAX_LIMIT
    );
    const search = normalizeSearch(searchParams.get("search"));
    const priceTier = searchParams.get("priceTier")?.trim().toLowerCase().slice(0, 50);
    const status = searchParams.get("status");
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("customer_item_prices")
      .select(CUSTOMER_PRICE_SELECT, { count: "exact" })
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .is("item.deleted_at", null);

    if (search) {
      query = query.or(`item_code.ilike.%${search}%,item_name.ilike.%${search}%`, {
        referencedTable: "items",
      });
    }
    if (priceTier) query = query.eq("price_tier", priceTier);
    if (status === "active") query = query.eq("is_active", true);
    if (status === "inactive") query = query.eq("is_active", false);

    const { data, error, count } = await query
      .order("effective_from", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      console.error("Failed to fetch customer special prices:", error);
      return NextResponse.json({ error: "Failed to fetch special prices" }, { status: 500 });
    }

    const capabilities = await getCustomerPricingCapabilities(userId, currentBusinessUnitId);
    const canEditCustomers = await can(userId, RESOURCES.CUSTOMERS, "edit", currentBusinessUnitId);

    return NextResponse.json({
      data: ((data || []) as CustomerItemPriceRow[]).map(toCustomerItemPrice),
      capabilities: { canManage: canEditCustomers && capabilities.canManage },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: count ? Math.ceil(count / limit) : 0,
      },
    });
  } catch (error) {
    console.error("Unexpected customer special-price list error:", error);
    return NextResponse.json({ error: "Failed to fetch special prices" }, { status: 500 });
  }
}

async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const parentDenied = await requirePermission(RESOURCES.CUSTOMERS, "edit");
    if (parentDenied) return parentDenied;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, userId, companyId, currentBusinessUnitId } = context;

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const capabilityDenied = await requireCustomerPricingCapability(
      userId,
      currentBusinessUnitId,
      "canManage"
    );
    if (capabilityDenied) return capabilityDenied;

    const parsed = createCustomerItemPriceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid special price" }, { status: 400 });
    }

    const { id: customerId } = await params;
    const normalizedTier = parsed.data.priceTier.toLowerCase();
    const [{ data: customer, error: customerError }, { data: item, error: itemError }] =
      await Promise.all([
        supabase
          .from("customers")
          .select("id")
          .eq("id", customerId)
          .eq("company_id", companyId)
          .eq("business_unit_id", currentBusinessUnitId)
          .is("deleted_at", null)
          .maybeSingle(),
        supabase
          .from("items")
          .select("id, item_code, item_name")
          .eq("id", parsed.data.itemId)
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .maybeSingle(),
      ]);

    if (customerError || itemError) {
      console.error("Failed to validate customer special-price ownership:", {
        customerError,
        itemError,
      });
      return NextResponse.json({ error: "Failed to create special price" }, { status: 500 });
    }
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

    const { data: tier } = await supabase
      .from("item_prices")
      .select("id")
      .eq("company_id", companyId)
      .eq("item_id", parsed.data.itemId)
      .eq("price_tier", normalizedTier)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    if (!tier) {
      return NextResponse.json(
        { error: "The selected price tier is not configured for this item" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("customer_item_prices")
      .insert({
        company_id: companyId,
        business_unit_id: currentBusinessUnitId,
        customer_id: customerId,
        item_id: parsed.data.itemId,
        price_tier: normalizedTier,
        price: parsed.data.price,
        currency_code: parsed.data.currencyCode.toUpperCase(),
        effective_from: parsed.data.effectiveFrom,
        effective_to: parsed.data.effectiveTo || null,
        is_active: parsed.data.isActive,
        created_by: userId,
        updated_by: userId,
      })
      .select(CUSTOMER_PRICE_SELECT)
      .single();

    if (error) {
      console.error("Failed to create customer special price:", error);
      const conflict = error.code === "P0001";
      return NextResponse.json(
        {
          error: conflict
            ? "An active special price overlaps this effective period"
            : "Failed to create special price",
        },
        { status: conflict ? 409 : 500 }
      );
    }

    return NextResponse.json(
      { data: toCustomerItemPrice(data as CustomerItemPriceRow) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected customer special-price create error:", error);
    return NextResponse.json({ error: "Failed to create special price" }, { status: 500 });
  }
}

export const GET = withActivityLogging(GETHandler, {
  action: "list",
  resourceType: "customer_pricing",
  route: "/api/customers/[id]/special-prices",
});
export const POST = withActivityLogging(POSTHandler, {
  action: "create",
  resourceType: "customer_pricing",
  route: "/api/customers/[id]/special-prices",
});
