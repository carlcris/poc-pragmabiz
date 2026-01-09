import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

// PATCH /api/items/[id]/default-location - Set default location per warehouse for an item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.ITEMS, 'edit')
    if (unauthorized) return unauthorized

    const { id } = await params
    const body = await request.json()

    if (!body.warehouseId) {
      return NextResponse.json({ error: 'warehouseId is required' }, { status: 400 })
    }

    const { supabase } = await createServerClientWithBU()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 400 })
    }

    const { data: item } = await supabase
      .from('items')
      .select('id')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (body.locationId) {
      const { data: location } = await supabase
        .from('warehouse_locations')
        .select('id')
        .eq('id', body.locationId)
        .eq('company_id', userData.company_id)
        .eq('warehouse_id', body.warehouseId)
        .is('deleted_at', null)
        .maybeSingle()

      if (!location) {
        return NextResponse.json({ error: 'Location not found in warehouse' }, { status: 400 })
      }
    }

    const { data: itemWarehouse } = await supabase
      .from('item_warehouse')
      .select('id')
      .eq('company_id', userData.company_id)
      .eq('item_id', id)
      .eq('warehouse_id', body.warehouseId)
      .is('deleted_at', null)
      .maybeSingle()

    if (itemWarehouse) {
      const { error: updateError } = await supabase
        .from('item_warehouse')
        .update({
          default_location_id: body.locationId || null,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemWarehouse.id)

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message || 'Failed to update default location' },
          { status: 500 }
        )
      }
    } else {
      if (!body.locationId) {
        return NextResponse.json(
          { error: 'Default location can only be set when a location is provided' },
          { status: 400 }
        )
      }

      const { error: insertError } = await supabase
        .from('item_warehouse')
        .insert({
          company_id: userData.company_id,
          item_id: id,
          warehouse_id: body.warehouseId,
          default_location_id: body.locationId,
          current_stock: 0,
          created_by: user.id,
          updated_by: user.id,
        })

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message || 'Failed to set default location' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
