import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

// PATCH /api/warehouse-locations/[id] - Update a warehouse location
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.MANAGE_LOCATIONS, 'edit')
    if (unauthorized) return unauthorized

    const { id } = await params
    const { supabase } = await createServerClientWithBU()
    const body = await request.json()

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

    const updatePayload = {
      code: body.code ?? undefined,
      name: body.name ?? undefined,
      parent_id: body.parentId ?? undefined,
      location_type: body.locationType ?? undefined,
      is_pickable: body.isPickable ?? undefined,
      is_storable: body.isStorable ?? undefined,
      is_active: body.isActive ?? undefined,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }

    const { data: updated, error: updateError } = await supabase
      .from('warehouse_locations')
      .update(updatePayload)
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .select()
      .single()

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message || 'Failed to update location' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: {
        id: updated.id,
        companyId: updated.company_id,
        warehouseId: updated.warehouse_id,
        code: updated.code,
        name: updated.name,
        parentId: updated.parent_id,
        locationType: updated.location_type,
        isPickable: updated.is_pickable,
        isStorable: updated.is_storable,
        isActive: updated.is_active,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
