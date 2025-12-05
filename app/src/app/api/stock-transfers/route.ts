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
      .select('company_id, van_warehouse_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const toWarehouseId = searchParams.get('to_warehouse_id') || userData.van_warehouse_id;

    // Fetch stock transfers
    let query = supabase
      .from('stock_transfers')
      .select(`
        id,
        transfer_code,
        transfer_date,
        from_warehouse_id,
        to_warehouse_id,
        status,
        notes,
        total_items,
        created_at,
        from_warehouse:warehouses!from_warehouse_id (
          id,
          warehouse_code,
          warehouse_name
        ),
        to_warehouse:warehouses!to_warehouse_id (
          id,
          warehouse_code,
          warehouse_name
        ),
        stock_transfer_items (
          id,
          item_id,
          item_code,
          item_name,
          quantity,
          received_quantity,
          uom_id,
          uom_name,
          sort_order
        )
      `)
      .eq('company_id', userData.company_id)
      .order('transfer_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (toWarehouseId) {
      query = query.eq('to_warehouse_id', toWarehouseId);
    }

    const { data: transfers, error: transfersError } = await query;

    if (transfersError) {
      console.error('Error fetching stock transfers:', transfersError);
      return NextResponse.json(
        { error: 'Failed to fetch stock transfers' },
        { status: 500 }
      );
    }

    // Transform data
    const transformedTransfers = transfers?.map((transfer: any) => ({
      id: transfer.id,
      code: transfer.transfer_code,
      date: transfer.transfer_date,
      status: transfer.status,
      notes: transfer.notes,
      totalItems: transfer.total_items,
      fromWarehouse: {
        id: transfer.from_warehouse?.id,
        code: transfer.from_warehouse?.warehouse_code,
        name: transfer.from_warehouse?.warehouse_name,
      },
      toWarehouse: {
        id: transfer.to_warehouse?.id,
        code: transfer.to_warehouse?.warehouse_code,
        name: transfer.to_warehouse?.warehouse_name,
      },
      items: transfer.stock_transfer_items?.map((item: any) => ({
        id: item.id,
        itemId: item.item_id,
        code: item.item_code,
        name: item.item_name,
        quantity: parseFloat(item.quantity),
        receivedQuantity: parseFloat(item.received_quantity) || 0,
        uomId: item.uom_id,
        uom: item.uom_name,
        sortOrder: item.sort_order,
      })).sort((a: any, b: any) => a.sortOrder - b.sortOrder) || [],
    })) || [];

    return NextResponse.json({
      data: transformedTransfers,
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

    const body = await request.json();
    const { fromWarehouseId, toWarehouseId, transferDate, notes, items } = body;

    // Validate required fields
    if (!fromWarehouseId || !toWarehouseId || !transferDate || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate transfer code
    const transferCode = `ST-${Date.now()}`;

    // Create stock transfer with status='pending'
    const { data: transfer, error: transferError } = await supabase
      .from('stock_transfers')
      .insert({
        company_id: userData.company_id,
        transfer_code: transferCode,
        transfer_date: transferDate,
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        status: 'pending',
        notes: notes || null,
        total_items: items.length,
        requested_by: user.id,
        requested_at: new Date().toISOString(),
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();

    if (transferError) {
      console.error('Error creating stock transfer:', transferError);
      return NextResponse.json(
        { error: 'Failed to create stock transfer' },
        { status: 500 }
      );
    }

    // Create stock transfer items
    const transferItems = items.map((item: any, index: number) => ({
      company_id: userData.company_id,
      transfer_id: transfer.id,
      item_id: item.itemId,
      item_code: item.code,
      item_name: item.name,
      quantity: item.quantity,
      received_quantity: 0,
      uom_id: item.uomId,
      uom_name: item.uomName,
      sort_order: index + 1,
      created_by: user.id,
      updated_by: user.id,
    }));

    const { error: itemsError } = await supabase
      .from('stock_transfer_items')
      .insert(transferItems);

    if (itemsError) {
      console.error('Error creating stock transfer items:', itemsError);
      // Rollback: delete the transfer
      await supabase.from('stock_transfers').delete().eq('id', transfer.id);
      return NextResponse.json(
        { error: 'Failed to create stock transfer items' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Stock transfer created successfully',
        data: {
          id: transfer.id,
          code: transfer.transfer_code,
          status: transfer.status,
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
