import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user details
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
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
      .select('id, status, company_id')
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
    const { data: voidedTransaction, error: voidError } = await supabase
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
      console.error('Error voiding transaction:', voidError);
      return NextResponse.json(
        { error: 'Failed to void transaction' },
        { status: 500 }
      );
    }

    // Transform data to match POSTransaction type
    const transformedTransaction = {
      id: voidedTransaction.id,
      companyId: userData.company_id,
      transactionNumber: voidedTransaction.transaction_code,
      transactionDate: voidedTransaction.transaction_date,
      customerId: voidedTransaction.customer_id,
      customerName: voidedTransaction.customer_name,
      items: voidedTransaction.pos_transaction_items.map((item: any) => ({
        id: item.id,
        itemId: item.item_id,
        itemCode: item.item_code,
        itemName: item.item_name,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unit_price),
        discount: parseFloat(item.discount),
        lineTotal: parseFloat(item.line_total),
      })),
      subtotal: parseFloat(voidedTransaction.subtotal),
      totalDiscount: parseFloat(voidedTransaction.total_discount),
      taxRate: parseFloat(voidedTransaction.tax_rate),
      totalTax: parseFloat(voidedTransaction.total_tax),
      totalAmount: parseFloat(voidedTransaction.total_amount),
      payments: voidedTransaction.pos_transaction_payments.map((payment: any) => ({
        method: payment.payment_method,
        amount: parseFloat(payment.amount),
        reference: payment.reference,
      })),
      amountPaid: parseFloat(voidedTransaction.amount_paid),
      changeAmount: parseFloat(voidedTransaction.change_amount),
      status: voidedTransaction.status,
      cashierId: voidedTransaction.cashier_id,
      cashierName: voidedTransaction.cashier_name,
      notes: voidedTransaction.notes,
      createdAt: voidedTransaction.created_at,
      updatedAt: voidedTransaction.updated_at,
    };

    return NextResponse.json({
      data: transformedTransaction,
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
