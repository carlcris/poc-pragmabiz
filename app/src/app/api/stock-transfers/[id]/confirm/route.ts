import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: transferId } = await params;

    // Get the stock transfer
    const { data: transfer, error: transferError } = await supabase
      .from('stock_transfers')
      .select(`
        *,
        stock_transfer_items (*)
      `)
      .eq('id', transferId)
      .eq('company_id', userData.company_id)
      .single();

    if (transferError || !transfer) {
      return NextResponse.json(
        { error: 'Stock transfer not found' },
        { status: 404 }
      );
    }

    // Verify the transfer is for the user's van
    if (transfer.to_warehouse_id !== userData.van_warehouse_id) {
      return NextResponse.json(
        { error: 'This transfer is not assigned to your van' },
        { status: 403 }
      );
    }

    // Verify transfer is in pending status
    if (transfer.status !== 'pending' && transfer.status !== 'in_transit') {
      return NextResponse.json(
        { error: 'Transfer cannot be confirmed in current status' },
        { status: 400 }
      );
    }

    // Update transfer status to received
    const { error: updateError } = await supabase
      .from('stock_transfers')
      .update({
        status: 'received',
        confirmed_by: user.id,
        confirmed_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', transferId);

    if (updateError) {
      console.error('Error updating transfer status:', updateError);
      return NextResponse.json(
        { error: 'Failed to confirm transfer' },
        { status: 500 }
      );
    }

    // Update received quantities for all items
    const itemUpdates = transfer.stock_transfer_items.map((item: any) => ({
      id: item.id,
      received_quantity: item.quantity, // Mark full quantity as received
    }));

    for (const itemUpdate of itemUpdates) {
      await supabase
        .from('stock_transfer_items')
        .update({ received_quantity: itemUpdate.received_quantity })
        .eq('id', itemUpdate.id);
    }

    // Update stock levels for destination warehouse (van)
    for (const item of transfer.stock_transfer_items) {
      // Check if stock record exists
      const { data: existingStock } = await supabase
        .from('item_warehouse')
        .select('id, current_stock')
        .eq('company_id', userData.company_id)
        .eq('item_id', item.item_id)
        .eq('warehouse_id', transfer.to_warehouse_id)
        .single();

      if (existingStock) {
        // Update existing stock
        const newStock = parseFloat(existingStock.current_stock) + parseFloat(item.quantity);
        await supabase
          .from('item_warehouse')
          .update({ current_stock: newStock })
          .eq('id', existingStock.id);
      } else {
        // Create new stock record
        await supabase
          .from('item_warehouse')
          .insert({
            company_id: userData.company_id,
            item_id: item.item_id,
            warehouse_id: transfer.to_warehouse_id,
            current_stock: item.quantity,
          });
      }

      // Decrease stock from source warehouse
      const { data: sourceStock } = await supabase
        .from('item_warehouse')
        .select('id, current_stock')
        .eq('company_id', userData.company_id)
        .eq('item_id', item.item_id)
        .eq('warehouse_id', transfer.from_warehouse_id)
        .single();

      if (sourceStock) {
        const newStock = Math.max(0, parseFloat(sourceStock.current_stock) - parseFloat(item.quantity));
        await supabase
          .from('item_warehouse')
          .update({ current_stock: newStock })
          .eq('id', sourceStock.id);
      }
    }

    return NextResponse.json({
      message: 'Stock transfer confirmed successfully',
      data: {
        id: transferId,
        status: 'received',
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
