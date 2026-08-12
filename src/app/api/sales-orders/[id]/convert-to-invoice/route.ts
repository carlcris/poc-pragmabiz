import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { RESOURCES } from "@/constants/resources";
import { requirePermission } from "@/lib/auth";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { postARInvoice } from "@/services/accounting/arPosting";
import { calculateCOGS, postCOGS, type COGSItem } from "@/services/accounting/cogsPosting";

const conversionSchema = z
  .object({
    warehouseId: z.string().uuid(),
    locationId: z.string().uuid().optional(),
  })
  .strict();

type ConversionResult = {
  invoiceId: string;
  invoiceCode: string;
  companyId: string;
  customerId: string;
  invoiceDate: string;
  totalAmount: number;
  warehouseId: string;
  orderCode: string;
  stockItems: Array<{ itemId: string; quantity: number }>;
};

const conversionErrors: Record<string, { error: string; status: 404 | 409 }> = {
  SALES_ORDER_NOT_FOUND: { error: "This sales order is no longer available.", status: 404 },
  SALES_ORDER_STATUS_CHANGED: {
    error: "Only confirmed or in-progress sales orders can be converted to invoices.",
    status: 409,
  },
  SALES_ORDER_WAREHOUSE_MISMATCH: {
    error: "Use the warehouse that owns this sales order's inventory reservation.",
    status: 409,
  },
  SALES_ORDER_WAREHOUSE_INVALID: {
    error: "The fulfillment warehouse is no longer available.",
    status: 409,
  },
  SALES_ORDER_ALREADY_INVOICED: {
    error: "This sales order has already been converted to an invoice.",
    status: 409,
  },
  SALES_ORDER_ITEMS_REQUIRED: {
    error: "The sales order must contain at least one item.",
    status: 409,
  },
  SALES_ORDER_CUSTOMER_NOT_FOUND: {
    error: "The sales order customer is no longer available.",
    status: 409,
  },
  SALES_ORDER_LOCATION_INVALID: {
    error: "Select an active storage location in the fulfillment warehouse.",
    status: 409,
  },
  SALES_ORDER_RESERVATION_CONFLICT: {
    error: "The inventory reservation changed. Refresh the order before converting it.",
    status: 409,
  },
  SALES_ORDER_WAREHOUSE_PROJECTION_CONFLICT: {
    error: "Reserved warehouse stock is no longer sufficient for this order.",
    status: 409,
  },
  SALES_ORDER_LOCATION_STOCK_CONFLICT: {
    error: "Stock at the selected location changed. Refresh and try again.",
    status: 409,
  },
  SALES_ORDER_BATCH_STOCK_CONFLICT: {
    error: "Batch stock changed while the invoice was being created. Try again.",
    status: 409,
  },
  SALES_ORDER_LOCATION_STOCK_INSUFFICIENT: {
    error: "The selected location does not have enough unreserved stock for this order.",
    status: 409,
  },
  INVENTORY_RESERVATION_UNIT_CONVERSION_MISSING: {
    error: "An order item is missing its base-unit conversion.",
    status: 409,
  },
};

const isConversionResult = (value: unknown): value is ConversionResult => {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.invoiceId === "string" &&
    typeof result.invoiceCode === "string" &&
    typeof result.companyId === "string" &&
    typeof result.customerId === "string" &&
    typeof result.invoiceDate === "string" &&
    typeof result.totalAmount === "number" &&
    typeof result.warehouseId === "string" &&
    typeof result.orderCode === "string" &&
    Array.isArray(result.stockItems) &&
    result.stockItems.every(
      (item) =>
        item !== null &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).itemId === "string" &&
        typeof (item as Record<string, unknown>).quantity === "number"
    )
  );
};

const logConversionSideEffectError = (message: string, error: unknown) => {
  console.error(message, error);
};

async function POSTHandler(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, "edit");
  if (unauthorized) return unauthorized;

  try {
    const body: unknown = await request.json();
    const validation = conversionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Select a fulfillment warehouse and a valid location." },
        { status: 400 }
      );
    }

    const { id } = await params;
    const { supabase } = await createServerClientWithBU();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("convert_sales_order_to_invoice_transaction", {
      p_sales_order_id: id,
      p_warehouse_id: validation.data.warehouseId,
      p_location_id: validation.data.locationId ?? null,
    });

    if (error) {
      console.error("Failed to convert sales order to invoice", {
        salesOrderId: id,
        code: error.code,
        message: error.message,
      });
      const safeError = conversionErrors[error.message];
      return NextResponse.json(
        { error: safeError?.error ?? "The sales order could not be converted to an invoice." },
        { status: safeError?.status ?? 500 }
      );
    }

    if (!isConversionResult(data)) {
      console.error("Sales order conversion returned an invalid result", { salesOrderId: id });
      return NextResponse.json(
        { error: "The invoice was created but its result could not be loaded. Refresh the page." },
        { status: 409 }
      );
    }

    let arResult: { success: boolean; journalEntryId?: string; error?: string } = {
      success: false,
    };
    try {
      arResult = await postARInvoice(data.companyId, user.id, {
        invoiceId: data.invoiceId,
        invoiceCode: data.invoiceCode,
        customerId: data.customerId,
        invoiceDate: data.invoiceDate,
        totalAmount: data.totalAmount,
        description: `Sales invoice ${data.invoiceCode} (from SO ${data.orderCode})`,
      });
    } catch (postingError) {
      logConversionSideEffectError("AR posting failed after invoice conversion", postingError);
    }

    let cogsCalculation: {
      success: boolean;
      items?: COGSItem[];
      totalCOGS?: number;
      error?: string;
    } = { success: false };
    let cogsResult: { success: boolean; journalEntryId?: string; error?: string } = {
      success: false,
    };

    try {
      if (data.stockItems.length > 0) {
        cogsCalculation = await calculateCOGS(data.companyId, data.warehouseId, data.stockItems);
      }
      if (cogsCalculation.success && cogsCalculation.items && cogsCalculation.totalCOGS) {
        cogsResult = await postCOGS(data.companyId, user.id, {
          invoiceId: data.invoiceId,
          invoiceCode: data.invoiceCode,
          warehouseId: data.warehouseId,
          invoiceDate: data.invoiceDate,
          items: cogsCalculation.items,
          totalCOGS: cogsCalculation.totalCOGS,
          description: `COGS for invoice ${data.invoiceCode} (from SO ${data.orderCode})`,
        });
      }
    } catch (cogsError) {
      logConversionSideEffectError("COGS posting failed after invoice conversion", cogsError);
    }

    return NextResponse.json({
      success: true,
      message: "Sales order successfully converted to Invoice",
      invoice: { id: data.invoiceId, invoiceNumber: data.invoiceCode },
      arJournalEntryId: arResult.journalEntryId,
      arPostingSuccess: arResult.success,
      cogsJournalEntryId: cogsResult.journalEntryId,
      cogsPostingSuccess: cogsResult.success,
      cogsTotalAmount: cogsCalculation.totalCOGS,
    });
  } catch (error) {
    console.error("Unexpected sales order invoice conversion failure", { error });
    return NextResponse.json(
      { error: "The sales order could not be converted to an invoice." },
      { status: 500 }
    );
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "convert_to_invoice",
  resourceType: "sales_orders",
  route: "/api/sales-orders/[id]/convert-to-invoice",
});
