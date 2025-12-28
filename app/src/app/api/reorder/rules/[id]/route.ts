import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/reorder/rules/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase } = await createServerClientWithBU()
    const body = await request.json()

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

    // Verify rule exists and belongs to user's company
    const { data: existingRule } = await supabase
      .from('reorder_rules')
      .select('id, company_id')
      .eq('id', id)
      .single()

    if (!existingRule) {
      return NextResponse.json({ error: 'Reorder rule not found' }, { status: 404 })
    }

    if (existingRule.company_id !== userData.company_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Update reorder rule
    const updateData: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }

    if (body.reorderPoint !== undefined) updateData.reorder_point = body.reorderPoint
    if (body.minQty !== undefined) updateData.min_qty = body.minQty
    if (body.maxQty !== undefined) updateData.max_qty = body.maxQty
    if (body.reorderQty !== undefined) updateData.reorder_qty = body.reorderQty
    if (body.leadTimeDays !== undefined) updateData.lead_time_days = body.leadTimeDays
    if (body.isActive !== undefined) updateData.is_active = body.isActive

    const { data: rule, error: updateError } = await supabase
      .from('reorder_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating reorder rule:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Failed to update reorder rule' },
        { status: 500 }
      )
    }

    return NextResponse.json(rule)
  } catch (error) {
    console.error('Unexpected error in PATCH /api/reorder/rules/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/reorder/rules/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Verify rule exists and belongs to user's company
    const { data: existingRule } = await supabase
      .from('reorder_rules')
      .select('id, company_id')
      .eq('id', id)
      .single()

    if (!existingRule) {
      return NextResponse.json({ error: 'Reorder rule not found' }, { status: 404 })
    }

    if (existingRule.company_id !== userData.company_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete reorder rule
    const { error: deleteError } = await supabase
      .from('reorder_rules')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting reorder rule:', deleteError)
      return NextResponse.json({ error: 'Failed to delete reorder rule' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Reorder rule deleted successfully' })
  } catch (error) {
    console.error('Unexpected error in DELETE /api/reorder/rules/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
