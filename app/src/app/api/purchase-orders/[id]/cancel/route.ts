import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/purchase-orders/[id]/cancel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

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
      console.error('Error cancelling purchase order:', updateError)
      return NextResponse.json({ error: 'Failed to cancel purchase order' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Purchase order ${purchaseOrder.order_code} cancelled successfully`,
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/purchase-orders/[id]/cancel:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
