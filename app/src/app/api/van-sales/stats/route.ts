import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's van warehouse
    const { data: userData } = await supabase
      .from('users')
      .select('van_warehouse_id')
      .eq('id', user.id)
      .single();

    if (!userData?.van_warehouse_id) {
      return NextResponse.json({ error: 'No van warehouse assigned' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];

    // Get today's sales invoices for this van warehouse
    const { data: invoices, error: invoicesError } = await supabase
      .from('sales_invoices')
      .select('id, total_amount, invoice_date, status')
      .eq('warehouse_id', userData.van_warehouse_id)
      .eq('primary_employee_id', user.id) // Sales by this user
      .gte('invoice_date', today)
      .lte('invoice_date', today);

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      return NextResponse.json({ error: invoicesError.message }, { status: 500 });
    }

    // Calculate total sales amount for today
    const totalSales = (invoices || []).reduce((sum, invoice) => {
      return sum + parseFloat(invoice.total_amount || '0');
    }, 0);

    // Get items sold today
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
