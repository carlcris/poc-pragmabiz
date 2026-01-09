import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

// GET /api/warehouses/[id]/locations - List locations for a warehouse
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.MANAGE_LOCATIONS, 'view')
    if (unauthorized) return unauthorized

    const { id } = await params
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

    const { data, error } = await supabase
      .from('warehouse_locations')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('warehouse_id', id)
      .is('deleted_at', null)
      .order('code', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch warehouse locations', details: error.message },
        { status: 500 }
      )
    }

    const locations = (data || []).map((location) => ({
      id: location.id,
      companyId: location.company_id,
      warehouseId: location.warehouse_id,
      code: location.code,
      name: location.name,
      parentId: location.parent_id,
      locationType: location.location_type,
      isPickable: location.is_pickable,
      isStorable: location.is_storable,
      isActive: location.is_active,
      createdAt: location.created_at,
      updatedAt: location.updated_at,
    }))

    return NextResponse.json({ data: locations })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/warehouses/[id]/locations - Create a location
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requirePermission(RESOURCES.MANAGE_LOCATIONS, 'create')
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

    if (!body.code) {
      return NextResponse.json(
        { error: 'Location code is required' },
        { status: 400 }
      )
    }

    const { data: existing } = await supabase
      .from('warehouse_locations')
      .select('id')
      .eq('company_id', userData.company_id)
      .eq('warehouse_id', id)
      .eq('code', body.code)
      .is('deleted_at', null)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Location code already exists for this warehouse' },
        { status: 409 }
      )
    }

    const { data: created, error: insertError } = await supabase
      .from('warehouse_locations')
      .insert({
        company_id: userData.company_id,
        warehouse_id: id,
        code: body.code,
        name: body.name || null,
        parent_id: body.parentId || null,
        location_type: body.locationType || 'bin',
        is_pickable: body.isPickable ?? true,
        is_storable: body.isStorable ?? true,
        is_active: body.isActive ?? true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (insertError || !created) {
      return NextResponse.json(
        { error: insertError?.message || 'Failed to create location' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        data: {
          id: created.id,
          companyId: created.company_id,
          warehouseId: created.warehouse_id,
          code: created.code,
          name: created.name,
          parentId: created.parent_id,
          locationType: created.location_type,
          isPickable: created.is_pickable,
          isStorable: created.is_storable,
          isActive: created.is_active,
          createdAt: created.created_at,
          updatedAt: created.updated_at,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
