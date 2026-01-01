import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import type { Item, CreateItemRequest } from '@/types/item'
import type { Database } from '@/types/database.types'
import { requirePermission, requireLookupDataAccess } from '@/lib/auth'
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
    uomId: dbItem.uom_id,  // Added uomId field
    category: dbItem.item_categories?.name || '',
    standardCost: Number(dbItem.cost_price) || 0,
    listPrice: Number(dbItem.sales_price) || 0,
    reorderLevel: 0, // Will come from item_warehouse table
    reorderQty: 0, // Will come from item_warehouse table
    imageUrl: dbItem.image_url || undefined,
    isActive: dbItem.is_active ?? true,
    createdAt: dbItem.created_at,
    updatedAt: dbItem.updated_at,
  }
}

// GET /api/items - List items with filters
export async function GET(request: NextRequest) {
  try {
    // Check permission using Lookup Data Access Pattern
    // User can access if they have EITHER:
    // 1. Direct 'items' view permission, OR
    // 2. Permission to a feature that depends on items (pos, sales_orders, etc.)
    const unauthorized = await requireLookupDataAccess(RESOURCES.ITEMS)
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

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 400 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const itemType = searchParams.get('itemType')
    const isActive = searchParams.get('isActive')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Build query
    let query = supabase
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
      `,
        { count: 'exact' }
      )
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)

    // Apply filters
    if (search) {
      query = query.or(
        `item_code.ilike.%${search}%,item_name.ilike.%${search}%,description.ilike.%${search}%`
      )
    }

    if (category) {
      query = query.eq('item_categories.name', category)
    }

    if (itemType) {
      query = query.eq('item_type', itemType)
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    // Order by created_at descending
    query = query.order('created_at', { ascending: false })

    // Execute query
    const { data, error, count } = await query

    if (error) {

      return NextResponse.json(
        { error: 'Failed to fetch items', details: error.message },
        { status: 500 }
      )
    }

    // Transform data
    const items = (data || []).map((item) => transformDbItem(item as any))

    // Calculate pagination
    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/items - Create new item
export async function POST(request: NextRequest) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.ITEMS, 'create')
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

    // Parse request body
    const body: CreateItemRequest = await request.json()

    // Validate required fields
    if (!body.code || !body.name || !body.itemType || !body.uom) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          details: 'code, name, itemType, and uom are required',
        },
        { status: 400 }
      )
    }

    // Check for duplicate item code
    const { data: existing } = await supabase
      .from('items')
      .select('id')
      .eq('company_id', body.companyId)
      .eq('item_code', body.code)
      .is('deleted_at', null)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Item code already exists', details: `Item code "${body.code}" is already in use` },
        { status: 409 }
      )
    }

    // Get UoM ID by code
    const { data: uomData } = await supabase
      .from('units_of_measure')
      .select('id')
      .eq('company_id', body.companyId)
      .eq('code', body.uom)
      .is('deleted_at', null)
      .maybeSingle()

    if (!uomData) {
      return NextResponse.json(
        { error: 'Invalid unit of measure', details: `UoM "${body.uom}" not found` },
        { status: 400 }
      )
    }

    // Get Category ID by name (if provided)
    let categoryId: string | null = null
    if (body.category) {
      const { data: categoryData } = await supabase
        .from('item_categories')
        .select('id')
        .eq('company_id', body.companyId)
        .eq('name', body.category)
        .is('deleted_at', null)
        .maybeSingle()

      if (categoryData) {
        categoryId = categoryData.id
      }
    }

    // Insert item
    const { data: newItem, error: insertError } = await supabase
      .from('items')
      .insert({
        company_id: body.companyId,
        item_code: body.code,
        item_name: body.name,
        description: body.description || null,
        item_type: body.itemType,
        uom_id: uomData.id,
        category_id: categoryId,
        cost_price: body.standardCost?.toString(),
        sales_price: body.listPrice?.toString(),
        purchase_price: body.standardCost?.toString(),
        image_url: body.imageUrl || null,
        is_stock_item: body.itemType !== 'service',
        is_active: body.isActive ?? true,
        created_by: user.id,
        updated_by: user.id,
      })
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

    if (insertError) {

      return NextResponse.json(
        { error: 'Failed to create item', details: insertError.message },
        { status: 500 }
      )
    }

    // Transform and return
    const item = transformDbItem(newItem as any)

    return NextResponse.json({ data: item }, { status: 201 })
  } catch (error) {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
