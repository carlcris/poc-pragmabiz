import { NextRequest, NextResponse } from 'next/server';
import { createServerClientWithBU } from '@/lib/supabase/server-with-bu';
import { reversePOSTransaction } from '@/services/accounting/posPosting';
import { reversePOSStockTransaction } from '@/services/inventory/posStockService';
import { requirePermission } from '@/lib/auth';
import { RESOURCES } from '@/constants/resources';
import type { Tables } from '@/types/supabase';

type POSTransactionRow = Tables<'pos_transactions'>;
type POSTransactionItemRow = Tables<'pos_transaction_items'>;
type POSTransactionPaymentRow = Tables<'pos_transaction_payments'>;

type POSTransactionQueryRow = POSTransactionRow & {
  pos_transaction_items: POSTransactionItemRow[];
  pos_transaction_payments: POSTransactionPaymentRow[];
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.POS, 'delete');

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU();
    const { id } = await params;

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user details including van_warehouse_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id, van_warehouse_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get the transaction to verify it exists and belongs to the company
    const { data: transaction, error: fetchError } = await supabase
      .from('pos_transactions')
      .select('id, status, company_id, transaction_code')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .single();

    if (fetchError || !transaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Check if transaction is already voided
    if (transaction.status === 'voided') {
      return NextResponse.json(
        { error: 'Transaction is already voided' },
        { status: 400 }
      );
    }

    // Update transaction status to voided
    const { data: voidedTransactionData, error: voidError } = await supabase
      .from('pos_transactions')
      .update({
        status: 'voided',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
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
      `)
      .single();

    if (voidError) {

      return NextResponse.json(
        { error: 'Failed to void transaction' },
        { status: 500 }
      );
    }
    const voidedTransaction = voidedTransactionData as POSTransactionQueryRow;

    // ============================================================================
    // POST-VOID PROCESSING: Reverse Stock & Accounting Entries
    // ============================================================================

    const warnings: string[] = [];

    // 1. Reverse stock transaction (if warehouse assigned)
    if (userData.van_warehouse_id) {
      try {
        const stockReversalResult = await reversePOSStockTransaction(
          userData.company_id,
          currentBusinessUnitId!,
          user.id,
          id,
          transaction.transaction_code,
          userData.van_warehouse_id
        );

        if (stockReversalResult.success) {
        } else {

          warnings.push(`Stock reversal failed: ${stockReversalResult.error}`);
        }
      } catch {

        warnings.push('Stock reversal failed');
      }
    } else {
      warnings.push('No warehouse assigned - stock reversal skipped');
    }

    // 2. Reverse GL entries (both sale and COGS)
    try {
      const glReversalResult = await reversePOSTransaction(
        userData.company_id,
        user.id,
        id
      );

      if (glReversalResult.success) {
      } else {

        warnings.push(`GL reversal failed: ${glReversalResult.error}`);
      }
    } catch {

      warnings.push('GL reversal failed');
    }

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

    return NextResponse.json({
      data: transformedTransaction,
      warnings: warnings.length > 0 ? warnings : undefined,
    });

  } catch {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
