import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";

const confirmSalesOrderSchema = z.object({ warehouseId: z.string().uuid() }).strict();

const confirmErrors: Record<string, { error: string; status: 404 | 409 }> = {
  SALES_ORDER_NOT_FOUND: { error: "This sales order is no longer available.", status: 404 },
  SALES_ORDER_STATUS_CHANGED: {
    error: "Only draft sales orders can be confirmed.",
    status: 409,
  },
  SALES_ORDER_WAREHOUSE_INVALID: {
    error: "Select an active warehouse in the current business unit.",
    status: 409,
  },
  INVENTORY_RESERVATION_STOCK_UNAVAILABLE: {
    error: "One or more items are not stocked in the selected warehouse.",
    status: 409,
  },
  INVENTORY_RESERVATION_INSUFFICIENT_STOCK: {
    error: "The selected warehouse does not have enough available stock for this order.",
    status: 409,
  },
  INVENTORY_RESERVATION_UNIT_CONVERSION_MISSING: {
    error: "An order item is missing its base-unit conversion.",
    status: 409,
  },
};

async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, "edit");
  if (unauthorized) return unauthorized;

  try {
    const body: unknown = await request.json();
    const validation = confirmSalesOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Select a fulfillment warehouse." }, { status: 400 });
    }

    const { id } = await params;
    const { supabase } = await createServerClientWithBU();
    const { error } = await supabase.rpc("confirm_sales_order_with_inventory", {
      p_sales_order_id: id,
      p_warehouse_id: validation.data.warehouseId,
    });

    if (error) {
      console.error("Failed to confirm sales order", {
        salesOrderId: id,
        code: error.code,
        message: error.message,
      });
      const safeError = confirmErrors[error.message];
      return NextResponse.json(
        { error: safeError?.error ?? "The sales order could not be confirmed." },
        { status: safeError?.status ?? 500 }
      );
    }

    const { data: order, error: fetchError } = await supabase
      .from("sales_orders")
      .select(
        "id, company_id, business_unit_id, order_code, order_date, customer_id, expected_delivery_date, price_list_id, subtotal, discount_amount, tax_amount, total_amount, status, fulfilling_warehouse_id, shipping_address, shipping_city, shipping_state, shipping_postal_code, shipping_country, payment_terms, notes, created_at, created_by, updated_at, updated_by, version, custom_fields"
      )
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { error: "The order was confirmed but could not be reloaded. Refresh the page." },
        { status: 409 }
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("Unexpected sales order confirmation failure", { error });
    return NextResponse.json({ error: "The sales order could not be confirmed." }, { status: 500 });
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "confirm",
  resourceType: "sales_orders",
  route: "/api/sales-orders/[id]/confirm",
});
