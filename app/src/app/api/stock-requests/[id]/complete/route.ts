import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'
import { mapStockRequest } from '../../stock-request-mapper'

type StockRequestDbRecord = Parameters<typeof mapStockRequest>[0]

type RouteContext = {
  params: Promise<{ id: string }>
}

// POST /api/stock-requests/[id]/complete - Complete stock request
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const unauthorized = await requirePermission(RESOURCES.STOCK_REQUESTS, 'edit')
    if (unauthorized) return unauthorized

    const { supabase } = await createServerClientWithBU()
    const { id } = await context.params

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if request exists and is received
    const { data: existingRequest, error: checkError } = await supabase
      .from('stock_requests')
      .select('id, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (checkError || !existingRequest) {
      return NextResponse.json({ error: 'Stock request not found' }, { status: 404 })
    }

    if (existingRequest.status !== 'received') {
      return NextResponse.json(
        { error: 'Only received stock requests can be completed' },
        { status: 400 }
      )
    }

    // TODO: Create stock transactions and update inventory levels
    // For now, just update the status

    // Update status to completed
    const { error: updateError } = await supabase
      .from('stock_requests')
      .update({
        status: 'completed',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error completing stock request:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Fetch updated request
    const { data: updatedRequest } = await supabase
      .from('stock_requests')
      .select(
        `
        *,
        source_warehouse:warehouses!stock_requests_source_warehouse_id_fkey(
          id,
          warehouse_code,
          warehouse_name,
          business_unit_id
        ),
        destination_warehouse:warehouses!stock_requests_destination_warehouse_id_fkey(
          id,
          warehouse_code,
          warehouse_name,
          business_unit_id
        ),
        requested_by_user:users!stock_requests_requested_by_user_id_fkey(
          id,
          email,
          first_name,
          last_name
        ),
        received_by_user:users!stock_requests_received_by_fkey(
          id,
          email,
          first_name,
          last_name
        ),
        stock_request_items(
          *,
          items(item_code, item_name),
          units_of_measure(code, symbol),
          packaging:item_packaging(id, pack_name, qty_per_pack)
        )
      `
      )
      .eq('id', id)
      .single()

    if (!updatedRequest) {
      return NextResponse.json({ error: 'Stock request not found' }, { status: 404 })
    }

    return NextResponse.json(mapStockRequest(updatedRequest as StockRequestDbRecord))
  } catch (error) {
    console.error('Error in stock-request complete:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
