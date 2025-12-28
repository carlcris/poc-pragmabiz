import { createServerClientWithBU } from '@/lib/supabase/server-with-bu';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await createServerClientWithBU();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's van warehouse and employee_id
    const { data: userData } = await supabase
      .from('users')
      .select('van_warehouse_id, employee_id')
      .eq('id', user.id)
      .single();

    if (!userData?.van_warehouse_id) {
      return NextResponse.json({ error: 'No van warehouse assigned' }, { status: 400 });
    }

    // Get date from query params or default to today
    const searchParams = request.nextUrl.searchParams;
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Get sales invoices for this van warehouse on the specified date
    // Filter by employee_id if available, otherwise by warehouse
    let query = supabase
      .from('sales_invoices')
      .select('id, total_amount, invoice_date, status')
      .eq('warehouse_id', userData.van_warehouse_id)
      .gte('invoice_date', targetDate)
      .lte('invoice_date', targetDate);

    // Only filter by employee if user has an employee_id
    if (userData.employee_id) {
      query = query.eq('primary_employee_id', userData.employee_id);
    }

    const { data: invoices, error: invoicesError } = await query;

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      return NextResponse.json({ error: invoicesError.message }, { status: 500 });
    }

    // Calculate total sales amount for the date
    const totalSales = (invoices || []).reduce((sum, invoice) => {
      return sum + parseFloat(invoice.total_amount || '0');
    }, 0);

    // Get items sold on the date
    const invoiceIds = (invoices || []).map(inv => inv.id);
    let itemsSold = 0;

    if (invoiceIds.length > 0) {
      const { data: invoiceItems } = await supabase
        .from('sales_invoice_items')
        .select('quantity')
        .in('invoice_id', invoiceIds);

      itemsSold = (invoiceItems || []).reduce((sum, item) => {
        return sum + parseFloat(item.quantity || '0');
      }, 0);
    }

    return NextResponse.json({
      todaySales: totalSales,
      transactions: invoices?.length || 0,
      itemsSold: Math.round(itemsSold),
      invoices: invoices || [],
    });

  } catch (error) {
    console.error('Unexpected error in van sales stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
