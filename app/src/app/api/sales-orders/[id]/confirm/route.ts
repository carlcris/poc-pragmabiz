import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/sales-orders/[id]/confirm - Confirm a sales order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

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

    // Get the sales order
    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .select('*')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    // Validate status
    if (order.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft orders can be confirmed' },
        { status: 400 }
      )
    }

    // Update status to confirmed
    const { data: updatedOrder, error: updateError } = await supabase
      .from('sales_orders')
      .update({
        status: 'confirmed',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error confirming sales order:', updateError)
      return NextResponse.json({ error: 'Failed to confirm sales order' }, { status: 500 })
    }

    return NextResponse.json(updatedOrder, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in POST /api/sales-orders/[id]/confirm:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
