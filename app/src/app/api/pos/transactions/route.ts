import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const cashierId = searchParams.get('cashierId');

    // Build query
    let query = supabase
      .from('pos_transactions')
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
      `, { count: 'exact' })
      .eq('company_id', userData.company_id)
      .order('transaction_date', { ascending: false });

    // Apply filters
    if (search) {
      query = query.or(`transaction_code.ilike.%${search}%,customer_name.ilike.%${search}%,cashier_name.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (dateFrom) {
      query = query.gte('transaction_date', dateFrom);
    }

    if (dateTo) {
      // Add one day to include the entire end date
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt('transaction_date', endDate.toISOString().split('T')[0]);
    }

    if (cashierId) {
      query = query.eq('cashier_id', cashierId);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching POS transactions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch POS transactions' },
        { status: 500 }
      );
    }

    // Transform data to match POSTransaction type
    const transactions = data?.map((txn: any) => ({
      id: txn.id,
      companyId: userData.company_id,
      transactionNumber: txn.transaction_code,
      transactionDate: txn.transaction_date,
      customerId: txn.customer_id,
      customerName: txn.customer_name,
      items: txn.pos_transaction_items.map((item: any) => ({
        id: item.id,
        itemId: item.item_id,
        itemCode: item.item_code,
        itemName: item.item_name,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unit_price),
        discount: parseFloat(item.discount),
        lineTotal: parseFloat(item.line_total),
      })),
      subtotal: parseFloat(txn.subtotal),
      totalDiscount: parseFloat(txn.total_discount),
      taxRate: parseFloat(txn.tax_rate),
      totalTax: parseFloat(txn.total_tax),
      totalAmount: parseFloat(txn.total_amount),
      payments: txn.pos_transaction_payments.map((payment: any) => ({
        method: payment.payment_method,
        amount: parseFloat(payment.amount),
        reference: payment.reference,
      })),
      amountPaid: parseFloat(txn.amount_paid),
      changeAmount: parseFloat(txn.change_amount),
      status: txn.status,
      cashierId: txn.cashier_id,
      cashierName: txn.cashier_name,
      notes: txn.notes,
      createdAt: txn.created_at,
      updatedAt: txn.updated_at,
    })) || [];

    return NextResponse.json({
      data: transactions,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log('=== POS POST HANDLER CALLED ===');
  try {
    const supabase = await createClient();

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
      .select('company_id, first_name, last_name')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user data:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const fullName = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'Unknown';

    const body = await request.json();
    const { customerId, items, payments, notes } = body;

    // Validate required fields
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required' },
        { status: 400 }
      );
    }

    if (!payments || payments.length === 0) {
      return NextResponse.json(
        { error: 'Payments are required' },
        { status: 400 }
      );
    }

    // Calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    const taxRate = 0; // Can be configured

    const processedItems = items.map((item: any) => {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = (itemSubtotal * (item.discount || 0)) / 100;
      const lineTotal = itemSubtotal - itemDiscount;

      subtotal += itemSubtotal;
      totalDiscount += itemDiscount;

      return {
        ...item,
        lineTotal,
      };
    });

    const totalTax = ((subtotal - totalDiscount) * taxRate) / 100;
    const totalAmount = subtotal - totalDiscount + totalTax;

    const amountPaid = payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount), 0);
    const changeAmount = amountPaid - totalAmount;

    if (changeAmount < 0) {
      return NextResponse.json(
        { error: 'Insufficient payment amount' },
        { status: 400 }
      );
    }

    // Get customer name if customerId provided
    let customerName = null;
    if (customerId) {
      const { data: customer } = await supabase
        .from('customers')
        .select('name')
        .eq('id', customerId)
        .single();
      customerName = customer?.name;
    }

    // Generate transaction code
    const transactionCode = `POS-${Date.now()}`;

    // Create transaction header
    const { data: transaction, error: transactionError } = await supabase
      .from('pos_transactions')
      .insert({
        company_id: userData.company_id,
        transaction_code: transactionCode,
        transaction_date: new Date().toISOString(),
        customer_id: customerId,
        customer_name: customerName,
        subtotal: subtotal.toFixed(4),
        total_discount: totalDiscount.toFixed(4),
        tax_rate: taxRate.toFixed(2),
        total_tax: totalTax.toFixed(4),
        total_amount: totalAmount.toFixed(4),
        amount_paid: amountPaid.toFixed(4),
        change_amount: changeAmount.toFixed(4),
        status: 'completed',
        cashier_id: user.id,
        cashier_name: fullName,
        notes,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      return NextResponse.json(
        { error: 'Failed to create transaction' },
        { status: 500 }
      );
    }

    // Create transaction items
    const itemsToInsert = processedItems.map((item: any) => ({
      pos_transaction_id: transaction.id,
      item_id: item.itemId,
      item_code: item.itemCode,
      item_name: item.itemName,
      quantity: item.quantity.toFixed(4),
      unit_price: item.unitPrice.toFixed(4),
      discount: (item.discount || 0).toFixed(2),
      line_total: item.lineTotal.toFixed(4),
    }));

    const { error: itemsError } = await supabase
      .from('pos_transaction_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('Error creating transaction items:', itemsError);
      // Rollback transaction
      await supabase.from('pos_transactions').delete().eq('id', transaction.id);
      return NextResponse.json(
        { error: 'Failed to create transaction items' },
        { status: 500 }
      );
    }

    // Create transaction payments
    const paymentsToInsert = payments.map((payment: any) => ({
      pos_transaction_id: transaction.id,
      payment_method: payment.method,
      amount: parseFloat(payment.amount).toFixed(4),
      reference: payment.reference,
    }));

    const { error: paymentsError } = await supabase
      .from('pos_transaction_payments')
      .insert(paymentsToInsert);

    if (paymentsError) {
      console.error('Error creating transaction payments:', paymentsError);
      // Rollback transaction
      await supabase.from('pos_transactions').delete().eq('id', transaction.id);
      return NextResponse.json(
        { error: 'Failed to create transaction payments' },
        { status: 500 }
      );
    }

    // Fetch the complete transaction
    const { data: completeTransaction } = await supabase
      .from('pos_transactions')
      .select(`
        *,
        pos_transaction_items (*),
        pos_transaction_payments (*)
      `)
      .eq('id', transaction.id)
      .single();

    return NextResponse.json({
      data: {
        id: completeTransaction.id,
        companyId: completeTransaction.company_id,
        transactionNumber: completeTransaction.transaction_code,
        transactionDate: completeTransaction.transaction_date,
        customerId: completeTransaction.customer_id,
        customerName: completeTransaction.customer_name,
        items: completeTransaction.pos_transaction_items.map((item: any) => ({
          id: item.id,
          itemId: item.item_id,
          itemCode: item.item_code,
          itemName: item.item_name,
          quantity: parseFloat(item.quantity),
          unitPrice: parseFloat(item.unit_price),
          discount: parseFloat(item.discount),
          lineTotal: parseFloat(item.line_total),
        })),
        subtotal: parseFloat(completeTransaction.subtotal),
        totalDiscount: parseFloat(completeTransaction.total_discount),
        taxRate: parseFloat(completeTransaction.tax_rate),
        totalTax: parseFloat(completeTransaction.total_tax),
        totalAmount: parseFloat(completeTransaction.total_amount),
        payments: completeTransaction.pos_transaction_payments.map((payment: any) => ({
          method: payment.payment_method,
          amount: parseFloat(payment.amount),
          reference: payment.reference,
        })),
        amountPaid: parseFloat(completeTransaction.amount_paid),
        changeAmount: parseFloat(completeTransaction.change_amount),
        status: completeTransaction.status,
        cashierId: completeTransaction.cashier_id,
        cashierName: completeTransaction.cashier_name,
        notes: completeTransaction.notes,
        createdAt: completeTransaction.created_at,
        updatedAt: completeTransaction.updated_at,
      },
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
