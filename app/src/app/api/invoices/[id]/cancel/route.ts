import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

// POST /api/invoices/[id]/cancel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.SALES_INVOICES, 'edit')
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

    // Fetch invoice
    const { data: invoice, error: fetchError } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Cannot cancel paid or already cancelled invoices
    if (invoice.status === 'paid') {
      return NextResponse.json(
        { error: 'Paid invoices cannot be cancelled' },
        { status: 400 }
      )
    }

    if (invoice.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Invoice is already cancelled' },
        { status: 400 }
      )
    }

    // Update status to cancelled
    const { error: updateError } = await supabase
      .from('sales_invoices')
      .update({
        status: 'cancelled',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {

      return NextResponse.json({ error: 'Failed to cancel invoice' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Invoice cancelled successfully' })
  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
