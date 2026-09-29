import { NextRequest, NextResponse } from "next/server";
import { withActivityLogging } from "@/lib/activity-logging/route-activity-logger";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { asRpcClient, logQuotationError } from "../../_shared";

type ConversionResult = {
  sales_order_id: string;
  order_code: string;
};

type ConversionFailure = {
  code: string;
  message: string;
  status: 400 | 401 | 403 | 404 | 409 | 500;
};

const conversionFailureByCode: Record<string, ConversionFailure> = {
  SALES_ORDER_UNAUTHENTICATED: {
    code: "QUOTATION_CONVERT_UNAUTHENTICATED",
    message: "Sign in again before converting this quotation.",
    status: 401,
  },
  SALES_ORDER_FORBIDDEN: {
    code: "QUOTATION_CONVERT_FORBIDDEN",
    message: "You do not have permission to create sales orders.",
    status: 403,
  },
  QUOTATION_CONVERT_NOT_FOUND: {
    code: "QUOTATION_CONVERT_NOT_FOUND",
    message: "Quotation not found.",
    status: 404,
  },
  QUOTATION_CONVERT_WRONG_BUSINESS_UNIT: {
    code: "QUOTATION_CONVERT_WRONG_BUSINESS_UNIT",
    message: "Switch to the quotation's business unit and try again.",
    status: 409,
  },
  QUOTATION_CONVERT_NOT_ACCEPTED: {
    code: "QUOTATION_CONVERT_NOT_ACCEPTED",
    message: "Only accepted quotations can be converted to sales orders.",
    status: 409,
  },
  QUOTATION_CONVERT_ALREADY_ORDERED: {
    code: "QUOTATION_CONVERT_ALREADY_ORDERED",
    message: "Part of this quotation is already in a sales order.",
    status: 409,
  },
  QUOTATION_CONVERT_EMPTY: {
    code: "QUOTATION_CONVERT_EMPTY",
    message: "Add at least one quotation item before converting it.",
    status: 400,
  },
  QUOTATION_CONVERT_TOO_MANY_ITEMS: {
    code: "QUOTATION_CONVERT_TOO_MANY_ITEMS",
    message: "This quotation has too many items to convert in one sales order.",
    status: 400,
  },
  QUOTATION_CONVERT_INVALID_LINE: {
    code: "QUOTATION_CONVERT_CHANGED",
    message: "A quotation item is incomplete. Review the quotation and try again.",
    status: 409,
  },
  QUOTATION_CONVERT_INVALID_FRAME_SIZES: {
    code: "QUOTATION_CONVERT_CHANGED",
    message: "The quotation's frame sizes changed. Review the quotation and try again.",
    status: 409,
  },
  SALES_ORDER_CUSTOMER_INVALID: {
    code: "QUOTATION_CONVERT_CHANGED",
    message: "The quotation customer is no longer available.",
    status: 409,
  },
  SALES_ORDER_QUOTATION_LINE_INVALID: {
    code: "QUOTATION_CONVERT_CHANGED",
    message: "The quotation changed while it was being converted. Refresh and try again.",
    status: 409,
  },
  SALES_ORDER_QUOTATION_FRAME_INVALID: {
    code: "QUOTATION_CONVERT_CHANGED",
    message: "The quotation changed while it was being converted. Refresh and try again.",
    status: 409,
  },
  SALES_ORDER_FRAME_QUANTITY_EXCEEDS_REMAINING: {
    code: "QUOTATION_CONVERT_ALREADY_ORDERED",
    message: "Part of this quotation is already in a sales order.",
    status: 409,
  },
  SALES_ORDER_FRAME_QUANTITY_MISMATCH: {
    code: "QUOTATION_CONVERT_CHANGED",
    message: "The quotation's frame quantities are incomplete. Review the quotation and try again.",
    status: 409,
  },
  SALES_ORDER_FRAME_SIZE_INVALID: {
    code: "QUOTATION_CONVERT_CHANGED",
    message: "The quotation's frame sizes are incomplete. Review the quotation and try again.",
    status: 409,
  },
};

function getConversionFailure(internalMessage: string | null | undefined): ConversionFailure {
  const internalCode = Object.keys(conversionFailureByCode).find((code) =>
    internalMessage?.includes(code)
  );

  return internalCode
    ? conversionFailureByCode[internalCode]
    : {
        code: "QUOTATION_CONVERT_FAILED",
        message: "The quotation could not be converted. Try again.",
        status: 500,
      };
}

async function POSTHandler(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, "create");
    if (unauthorized) return unauthorized;

    const { id: quotationId } = await params;
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Sign in again before converting this quotation.",
          code: "QUOTATION_CONVERT_UNAUTHENTICATED",
        },
        { status: 401 }
      );
    }

    if (!currentBusinessUnitId) {
      return NextResponse.json(
        {
          error: "Select a business unit before converting this quotation.",
          code: "QUOTATION_CONVERT_WRONG_BUSINESS_UNIT",
        },
        { status: 400 }
      );
    }

    const { data, error } = await asRpcClient(supabase).rpc(
      "convert_accepted_sales_quotation_to_order_transaction",
      {
        p_quotation_id: quotationId,
        p_business_unit_id: currentBusinessUnitId,
      }
    );
    const rows = Array.isArray(data) ? (data as ConversionResult[]) : [];
    const result = rows[0];

    if (error || !result) {
      logQuotationError("Failed to convert quotation to sales order:", error);
      const failure = getConversionFailure(error?.message);
      return NextResponse.json(
        { error: failure.message, code: failure.code },
        { status: failure.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        salesOrderId: result.sales_order_id,
        orderNumber: result.order_code,
      },
      { status: 201 }
    );
  } catch (error) {
    logQuotationError("Unexpected quotation conversion failure:", error);
    return NextResponse.json(
      {
        error: "The quotation could not be converted. Try again.",
        code: "QUOTATION_CONVERT_FAILED",
      },
      { status: 500 }
    );
  }
}

export const POST = withActivityLogging(POSTHandler, {
  action: "convert_to_sales_order",
  resourceType: "quotations",
  route: "/api/quotations/[id]/convert-to-sales-order",
});
