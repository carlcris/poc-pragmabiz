import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { requireCustomerPricingCapability } from "@/lib/customer-pricing/permissions";
import {
  type CustomerItemPriceRow,
  toCustomerItemPrice,
} from "@/lib/customer-pricing/customer-item-price";
import {
  updateCustomerItemPriceSchema,
  validateCustomerPriceEffectiveRange,
} from "@/lib/validations/customer-pricing";
import type { Database } from "@/types/database.types";

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

const authorizeMutation = async () => {
  const parentDenied = await requirePermission(RESOURCES.CUSTOMERS, "edit");
  if (parentDenied) return parentDenied;

  const context = await requireRequestContext();
  if ("status" in context) return context;
  if (!context.currentBusinessUnitId) {
    return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
  }

  const capabilityDenied = await requireCustomerPricingCapability(
    context.userId,
    context.currentBusinessUnitId,
    "canManage"
  );
  return capabilityDenied || context;
};

async function PATCHHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; priceId: string }> }
) {
  try {
    const authorization = await authorizeMutation();
    if ("status" in authorization) return authorization;
    const { supabase, userId, companyId, currentBusinessUnitId } = authorization;
    const { id: customerId, priceId } = await params;

    const parsed = updateCustomerItemPriceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid special-price update" }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabase
      .from("customer_item_prices")
      .select(CUSTOMER_PRICE_SELECT)
      .eq("id", priceId)
      .eq("customer_id", customerId)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) {
      console.error("Failed to load customer special price for update:", existingError);
      return NextResponse.json({ error: "Failed to update special price" }, { status: 500 });
    }
    if (!existing) return NextResponse.json({ error: "Special price not found" }, { status: 404 });

    const current = existing as CustomerItemPriceRow;
    const effectiveFrom = parsed.data.effectiveFrom ?? current.effective_from;
    const effectiveTo =
      parsed.data.effectiveTo !== undefined
        ? parsed.data.effectiveTo || null
        : current.effective_to;

    if (!validateCustomerPriceEffectiveRange({ effectiveFrom, effectiveTo })) {
      return NextResponse.json({ error: "Invalid effective date range" }, { status: 400 });
    }

    const updateData: Database["public"]["Tables"]["customer_item_prices"]["Update"] = {
      updated_by: userId,
      version: (current.version || 1) + 1,
    };
    if (parsed.data.price !== undefined) updateData.price = parsed.data.price;
    if (parsed.data.currencyCode !== undefined) {
      updateData.currency_code = parsed.data.currencyCode.toUpperCase();
    }
    if (parsed.data.effectiveFrom !== undefined) {
      updateData.effective_from = parsed.data.effectiveFrom;
    }
    if (parsed.data.effectiveTo !== undefined) updateData.effective_to = effectiveTo;
    if (parsed.data.isActive !== undefined) updateData.is_active = parsed.data.isActive;

    const { data, error } = await supabase
      .from("customer_item_prices")
      .update(updateData)
      .eq("id", priceId)
      .eq("customer_id", customerId)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .select(CUSTOMER_PRICE_SELECT)
      .single();

    if (error) {
      console.error("Failed to update customer special price:", error);
      const conflict = error.code === "P0001";
      return NextResponse.json(
        {
          error: conflict
            ? "An active special price overlaps this effective period"
            : "Failed to update special price",
        },
        { status: conflict ? 409 : 500 }
      );
    }

    return NextResponse.json({ data: toCustomerItemPrice(data as CustomerItemPriceRow) });
  } catch (error) {
    console.error("Unexpected customer special-price update error:", error);
    return NextResponse.json({ error: "Failed to update special price" }, { status: 500 });
  }
}

async function DELETEHandler(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; priceId: string }> }
) {
  try {
    const authorization = await authorizeMutation();
    if ("status" in authorization) return authorization;
    const { supabase, userId, companyId, currentBusinessUnitId } = authorization;
    const { id: customerId, priceId } = await params;

    const { data: existing, error: existingError } = await supabase
      .from("customer_item_prices")
      .select("id, version")
      .eq("id", priceId)
      .eq("customer_id", customerId)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) {
      console.error("Failed to load customer special price for deletion:", existingError);
      return NextResponse.json({ error: "Failed to delete special price" }, { status: 500 });
    }
    if (!existing) return NextResponse.json({ error: "Special price not found" }, { status: 404 });

    const { error } = await supabase
      .from("customer_item_prices")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: userId,
        version: existing.version + 1,
      })
      .eq("id", priceId)
      .eq("customer_id", customerId)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null);

    if (error) {
      console.error("Failed to delete customer special price:", error);
      return NextResponse.json({ error: "Failed to delete special price" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected customer special-price delete error:", error);
    return NextResponse.json({ error: "Failed to delete special price" }, { status: 500 });
  }
}

export const PATCH = withActivityLogging(PATCHHandler, {
  action: "update",
  resourceType: "customer_pricing",
  route: "/api/customers/[id]/special-prices/[priceId]",
});
export const DELETE = withActivityLogging(DELETEHandler, {
  action: "delete",
  resourceType: "customer_pricing",
  route: "/api/customers/[id]/special-prices/[priceId]",
});
