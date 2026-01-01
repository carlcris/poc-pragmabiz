import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import type { Item, UpdateItemRequest } from '@/types/item'
import type { Database } from '@/types/database.types'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

type DbItem = Database['public']['Tables']['items']['Row']
type DbItemCategory = Database['public']['Tables']['item_categories']['Row']
type DbUoM = Database['public']['Tables']['units_of_measure']['Row']

// Transform database item to frontend Item type
function transformDbItem(
  dbItem: DbItem & {
    item_categories: DbItemCategory | null
    units_of_measure: DbUoM | null
  }
): Item {
  return {
    id: dbItem.id,
    companyId: dbItem.company_id,
    code: dbItem.item_code,
    name: dbItem.item_name,
    description: dbItem.description || '',
    itemType: dbItem.item_type as Item['itemType'],
    uom: dbItem.units_of_measure?.code || '',
    uomId: dbItem.uom_id,
    category: dbItem.item_categories?.name || '',
    standardCost: Number(dbItem.cost_price) || 0,
    listPrice: Number(dbItem.sales_price) || 0,
    reorderLevel: 0,
    reorderQty: 0,
    imageUrl: dbItem.image_url || undefined,
    isActive: dbItem.is_active ?? true,
    createdAt: dbItem.created_at,
    updatedAt: dbItem.updated_at,
  }
}

// GET /api/items/[id] - Get single item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.ITEMS, 'view')
    if (unauthorized) return unauthorized

    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Fetch item
    const { data, error } = await supabase
      .from('items')
      .select(
        `
        *,
        item_categories (
          id,
          name,
          code
        ),
        units_of_measure (
          id,
          code,
          name
        )
      `
      )
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {

      return NextResponse.json(
        { error: 'Failed to fetch item', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Transform and return
    const item = transformDbItem(data as any)
    return NextResponse.json({ data: item })
  } catch (error) {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/items/[id] - Update item
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.ITEMS, 'edit')
    if (unauthorized) return unauthorized

    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body: UpdateItemRequest = await request.json()

    // Check if item exists
    const { data: existing, error: existError } = await supabase
      .from('items')
      .select('id, company_id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (existError) {

      return NextResponse.json(
        { error: 'Failed to check item', details: existError.message },
        { status: 500 }
      )
    }

    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Build update object
    const updateData: any = {
      updated_by: user.id,
    }

    if (body.name !== undefined) updateData.item_name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.itemType !== undefined) updateData.item_type = body.itemType
    if (body.standardCost !== undefined) {
      updateData.cost_price = body.standardCost.toString()
      updateData.purchase_price = body.standardCost.toString()
    }
    if (body.listPrice !== undefined)
      updateData.sales_price = body.listPrice.toString()
    if (body.imageUrl !== undefined) updateData.image_url = body.imageUrl
    if (body.isActive !== undefined) updateData.is_active = body.isActive

    // Get UoM ID if provided
    if (body.uom) {
      const { data: uomData } = await supabase
        .from('units_of_measure')
        .select('id')
        .eq('company_id', existing.company_id)
        .eq('code', body.uom)
        .is('deleted_at', null)
        .maybeSingle()

      if (!uomData) {
        return NextResponse.json(
          { error: 'Invalid unit of measure', details: `UoM "${body.uom}" not found` },
          { status: 400 }
        )
      }
      updateData.uom_id = uomData.id
    }

    // Get Category ID if provided
    if (body.category) {
      const { data: categoryData } = await supabase
        .from('item_categories')
        .select('id')
        .eq('company_id', existing.company_id)
        .eq('name', body.category)
        .is('deleted_at', null)
        .maybeSingle()

      if (categoryData) {
        updateData.category_id = categoryData.id
      }
    }

    // Update item
    const { data: updatedItem, error: updateError } = await supabase
      .from('items')
      .update(updateData)
      .eq('id', id)
      .select(
        `
        *,
        item_categories (
          id,
          name,
          code
        ),
        units_of_measure (
          id,
          code,
          name
        )
      `
      )
      .single()

    if (updateError) {

      return NextResponse.json(
        { error: 'Failed to update item', details: updateError.message },
        { status: 500 }
      )
    }

    // Transform and return
    const item = transformDbItem(updatedItem as any)
    return NextResponse.json({ data: item })
  } catch (error) {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/items/[id] - Soft delete item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.ITEMS, 'delete')
    if (unauthorized) return unauthorized

    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Check if item exists
    const { data: existing } = await supabase
      .from('items')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Soft delete (set deleted_at timestamp)
    const { error: deleteError } = await supabase
      .from('items')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', id)

    if (deleteError) {

      return NextResponse.json(
        { error: 'Failed to delete item', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Item deleted successfully' })
  } catch (error) {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
