import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

// POST /api/purchase-orders/[id]/cancel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.PURCHASE_ORDERS, 'edit')
    const { id } = await params
    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 400 })
    }

    // Check if purchase order exists
    const { data: purchaseOrder, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('id, order_code, status')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Cannot cancel already cancelled, received, or partially received orders
    if (['cancelled', 'received', 'partially_received'].includes(purchaseOrder.status)) {
      return NextResponse.json(
        { error: `Cannot cancel purchase order with status: ${purchaseOrder.status}` },
        { status: 400 }
      )
    }

    // Update status to cancelled
    const { error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        status: 'cancelled',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', userData.company_id)

    if (updateError) {

      return NextResponse.json({ error: 'Failed to cancel purchase order' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Purchase order ${purchaseOrder.order_code} cancelled successfully`,
    })
  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
