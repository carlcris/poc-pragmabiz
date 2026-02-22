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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(RESOURCES.POS, "view");
    const { id } = await params;
    const { supabase, companyId } = await createServerClientWithBU();

    if (!companyId) {
      return NextResponse.json({ error: "User company not found" }, { status: 400 });
    }

    const { data, error } = await supabase
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
      .eq("company_id", companyId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const txn = data as POSTransactionQueryRow;
    const transaction = {
      id: txn.id,
      companyId,
      transactionNumber: txn.transaction_code,
      transactionDate: txn.transaction_date,
      customerId: txn.customer_id,
      customerName: txn.customer_name,
      items: txn.pos_transaction_items.map((item) => ({
        id: item.id,
        itemId: item.item_id,
        itemCode: item.item_code,
        itemName: item.item_name,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        discount: Number(item.discount),
        lineTotal: Number(item.line_total),
      })),
      subtotal: Number(txn.subtotal),
      totalDiscount: Number(txn.total_discount),
      taxRate: Number(txn.tax_rate),
      totalTax: Number(txn.total_tax),
      totalAmount: Number(txn.total_amount),
      payments: txn.pos_transaction_payments.map((payment) => ({
        method: payment.payment_method,
        amount: Number(payment.amount),
        reference: payment.reference,
      })),
      amountPaid: Number(txn.amount_paid),
      changeAmount: Number(txn.change_amount),
      status: txn.status,
      cashierId: txn.cashier_id,
      cashierName: txn.cashier_name,
      itemCount: txn.pos_transaction_items.length,
      notes: txn.notes,
      createdAt: txn.created_at,
      updatedAt: txn.updated_at,
    };

    return NextResponse.json(transaction);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

