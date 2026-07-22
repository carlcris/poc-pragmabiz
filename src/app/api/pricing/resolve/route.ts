import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { NextRequest, NextResponse } from "next/server";
import { requireLookupDataAccess } from "@/lib/auth";
import { requireRequestContext } from "@/lib/auth/requestContext";
import { RESOURCES } from "@/constants/resources";
import { resolveCustomerPricingSchema } from "@/lib/validations/customer-pricing";
import { resolveCustomerPrices } from "@/services/pricing/customer-price-resolver";

async function POSTHandler(request: NextRequest) {
  try {
    const customerAccessDenied = await requireLookupDataAccess(RESOURCES.CUSTOMERS);
    if (customerAccessDenied) return customerAccessDenied;

    const itemAccessDenied = await requireLookupDataAccess(RESOURCES.ITEMS);
    if (itemAccessDenied) return itemAccessDenied;

    const context = await requireRequestContext();
    if ("status" in context) return context;
    const { supabase, companyId, currentBusinessUnitId } = context;

    if (!currentBusinessUnitId) {
      return NextResponse.json({ error: "Business unit context required" }, { status: 400 });
    }

    const parsed = resolveCustomerPricingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid pricing request" }, { status: 400 });
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("id", parsed.data.customerId)
      .eq("company_id", companyId)
      .eq("business_unit_id", currentBusinessUnitId)
      .is("deleted_at", null)
      .maybeSingle();

    if (customerError) {
      console.error("Failed to verify pricing customer:", customerError);
      return NextResponse.json({ error: "Failed to resolve customer pricing" }, { status: 500 });
    }

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const data = await resolveCustomerPrices({
      supabase,
      companyId,
      businessUnitId: currentBusinessUnitId,
      customerId: parsed.data.customerId,
      itemIds: parsed.data.itemIds,
      asOfDate: parsed.data.asOfDate || new Date().toISOString().slice(0, 10),
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to resolve customer pricing:", error);
    return NextResponse.json({ error: "Failed to resolve customer pricing" }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "list",
  resourceType: "customer_pricing",
  route: "/api/pricing/resolve",
});
