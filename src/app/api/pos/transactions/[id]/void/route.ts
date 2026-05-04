import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithBU } from "@/lib/supabase/server-with-bu";
import { requirePermission } from "@/lib/auth";
import { RESOURCES } from "@/constants/resources";
import type { Tables } from "@/types/supabase";

type POSTransactionRow = Tables<"pos_transactions">;
type POSTransactionItemRow = Tables<"pos_transaction_items">;
type POSTransactionPaymentRow = Tables<"pos_transaction_payments">;

type POSTransactionQueryRow = POSTransactionRow & {
  pos_transaction_items: POSTransactionItemRow[];
  pos_transaction_payments: POSTransactionPaymentRow[];
};

type VoidPOSTransactionBody = {
  reason?: unknown;
};

function mapVoidPOSError(message?: string): { error: string; status: number } {
  switch (message) {
    case "POS_VOID_TRANSACTION_NOT_FOUND":
      return { error: "Transaction not found", status: 404 };
    case "POS_VOID_ALREADY_VOIDED":
      return { error: "Transaction is already voided", status: 400 };
    case "POS_VOID_UNSUPPORTED_STATUS":
      return { error: "Only completed transactions can be voided", status: 400 };
    case "POS_VOID_UNAUTHORIZED":
      return { error: "Unauthorized", status: 403 };
    case "POS_VOID_ORIGINAL_JOURNAL_LINES_NOT_FOUND":
      return { error: "Failed to reverse transaction accounting", status: 500 };
    default:
      return { error: "Failed to void transaction", status: 500 };
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(RESOURCES.POS, "delete");

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
    const { id } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user details for company scoping.
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let requestBody: VoidPOSTransactionBody = {};
    try {
      requestBody = (await request.json()) as VoidPOSTransactionBody;
    } catch {
      requestBody = {};
    }

    const voidReason = typeof requestBody.reason === "string" ? requestBody.reason : null;

    const { error: voidError } = await supabase.rpc("void_pos_transaction", {
      p_transaction_id: id,
      p_company_id: userData.company_id,
      p_user_id: user.id,
      p_business_unit_id: currentBusinessUnitId,
      p_void_reason: voidReason,
    });

    if (voidError) {
      console.error("Failed to void POS transaction", {
        transactionId: id,
        code: voidError.code,
        message: voidError.message,
      });

      const mappedError = mapVoidPOSError(voidError.message);
      return NextResponse.json({ error: mappedError.error }, { status: mappedError.status });
    }

    const { data: voidedTransactionData, error: fetchVoidedError } = await supabase
      .from("pos_transactions")
      .select(
        `
        id,
        transaction_code,
        transaction_date,
        customer_id,
        customer_name,
        subtotal,
        total_discount,
        tax_rate,
        total_tax,
        total_amount,
        amount_paid,
        change_amount,
        status,
        cashier_id,
        cashier_name,
        notes,
        created_at,
        updated_at,
        pos_transaction_items (
          id,
          item_id,
          item_code,
          item_name,
          quantity,
          unit_price,
          discount,
          line_total
        ),
        pos_transaction_payments (
          id,
          payment_method,
          amount,
          reference
        )
      `
      )
      .eq("id", id)
      .eq("company_id", userData.company_id)
      .single();

    if (fetchVoidedError || !voidedTransactionData) {
      return NextResponse.json({ error: "Failed to void transaction" }, { status: 500 });
    }

    const voidedTransaction = voidedTransactionData as POSTransactionQueryRow;

    // ============================================================================
    // RETURN RESPONSE
    // ============================================================================

    // Transform data to match POSTransaction type
    const transformedTransaction = {
      id: voidedTransaction.id,
      companyId: userData.company_id,
      transactionNumber: voidedTransaction.transaction_code,
      transactionDate: voidedTransaction.transaction_date,
      customerId: voidedTransaction.customer_id,
      customerName: voidedTransaction.customer_name,
      items: voidedTransaction.pos_transaction_items.map((item) => ({
        id: item.id,
        itemId: item.item_id,
        itemCode: item.item_code,
        itemName: item.item_name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        discount: Number(item.discount),
        lineTotal: Number(item.line_total),
      })),
      subtotal: Number(voidedTransaction.subtotal),
      totalDiscount: Number(voidedTransaction.total_discount),
      taxRate: Number(voidedTransaction.tax_rate),
      totalTax: Number(voidedTransaction.total_tax),
      totalAmount: Number(voidedTransaction.total_amount),
      payments: voidedTransaction.pos_transaction_payments.map((payment) => ({
        method: payment.payment_method,
        amount: Number(payment.amount),
        reference: payment.reference,
      })),
      amountPaid: Number(voidedTransaction.amount_paid),
      changeAmount: Number(voidedTransaction.change_amount),
      status: voidedTransaction.status,
      cashierId: voidedTransaction.cashier_id,
      cashierName: voidedTransaction.cashier_name,
      notes: voidedTransaction.notes,
      createdAt: voidedTransaction.created_at,
      updatedAt: voidedTransaction.updated_at,
    };

    return NextResponse.json(transformedTransaction);
  } catch (error) {
    console.error("POS void transaction API error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
