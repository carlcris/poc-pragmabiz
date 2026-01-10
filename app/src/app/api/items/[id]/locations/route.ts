import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextResponse } from 'next/server'
import { requireAnyPermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

// GET /api/items/[id]/locations - List item quantities by warehouse location
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const unauthorized = await requireAnyPermission([
      [RESOURCES.VIEW_LOCATION_STOCK, 'view'],
      [RESOURCES.ITEMS, 'view'],
    ])
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
      .from('item_location')
      .select(
        `
        id,
        item_id,
        warehouse_id,
        location_id,
        qty_on_hand,
        qty_reserved,
        qty_available,
        warehouses!inner(
          id,
          warehouse_code,
          warehouse_name,
          company_id,
          deleted_at
        ),
        warehouse_locations!inner(
          id,
          code,
          name,
          location_type,
          company_id,
          deleted_at
        )
      `
      )
      .eq('company_id', userData.company_id)
      .eq('item_id', id)
      .is('deleted_at', null)
      .eq('warehouses.company_id', userData.company_id)
      .eq('warehouse_locations.company_id', userData.company_id)
      .is('warehouses.deleted_at', null)
      .is('warehouse_locations.deleted_at', null)
      .order('warehouse_id')

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch item locations', details: error.message },
        { status: 500 }
      )
    }

    const warehouseIds = Array.from(new Set((data || []).map((row) => row.warehouse_id)))

    const { data: itemWarehouses } =
      warehouseIds.length > 0
        ? await supabase
            .from('item_warehouse')
            .select('warehouse_id, default_location_id')
            .eq('company_id', userData.company_id)
            .eq('item_id', id)
            .in('warehouse_id', warehouseIds)
            .is('deleted_at', null)
        : { data: [] }

    const defaultLocationMap = new Map(
      (itemWarehouses || []).map((row) => [row.warehouse_id, row.default_location_id])
    )

    const locations = (data || []).map((row) => {
      const defaultLocationId = defaultLocationMap.get(row.warehouse_id) || null
      return {
      id: row.id,
      itemId: row.item_id,
      warehouseId: row.warehouse_id,
      locationId: row.location_id,
      warehouseCode: row.warehouses?.warehouse_code || '',
      warehouseName: row.warehouses?.warehouse_name || '',
      locationCode: row.warehouse_locations?.code || '',
      locationName: row.warehouse_locations?.name || '',
      locationType: row.warehouse_locations?.location_type || '',
      qtyOnHand: Number(row.qty_on_hand) || 0,
      qtyReserved: Number(row.qty_reserved) || 0,
      qtyAvailable: Number(row.qty_available) || 0,
      isDefault: defaultLocationId === row.location_id,
      defaultLocationId,
      }
    })

    return NextResponse.json({ data: locations })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
