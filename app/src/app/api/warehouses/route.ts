import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import type { Warehouse, CreateWarehouseRequest } from '@/types/warehouse'
import type { Database } from '@/types/database.types'

type DbWarehouse = Database['public']['Tables']['warehouses']['Row']

// Transform database warehouse to frontend Warehouse type
function transformDbWarehouse(dbWarehouse: DbWarehouse): Warehouse {
  return {
    id: dbWarehouse.id,
    companyId: dbWarehouse.company_id,
    code: dbWarehouse.warehouse_code,
    name: dbWarehouse.warehouse_name,
    description: '', // Not in DB, can add later if needed
    address: `${dbWarehouse.address_line1 || ''}${dbWarehouse.address_line2 ? ' ' + dbWarehouse.address_line2 : ''}`.trim(),
    city: dbWarehouse.city || '',
    state: dbWarehouse.state || '',
    postalCode: dbWarehouse.postal_code || '',
    country: dbWarehouse.country || '',
    phone: dbWarehouse.phone || '',
    email: dbWarehouse.email || '',
    managerName: dbWarehouse.contact_person || undefined,
    isActive: dbWarehouse.is_active ?? true,
    isVan: dbWarehouse.is_van ?? false,
    createdAt: dbWarehouse.created_at,
    updatedAt: dbWarehouse.updated_at,
  }
}

// GET /api/warehouses - List warehouses with filters
export async function GET(request: NextRequest) {
  try {
    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Build query
    let query = supabase
      .from('warehouses')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)

    // Apply filters
    if (search) {
      query = query.or(
        `warehouse_code.ilike.%${search}%,warehouse_name.ilike.%${search}%,city.ilike.%${search}%`
      )
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
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch warehouses', details: error.message },
        { status: 500 }
      )
    }

    // Transform data
    const warehouses = (data || []).map(transformDbWarehouse)

    // Calculate pagination
    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      data: warehouses,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/warehouses - Create new warehouse
export async function POST(request: NextRequest) {
  try {
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!currentBusinessUnitId) {
      return NextResponse.json(
        { error: 'Business unit context required' },
        { status: 400 }
      )
    }

    // Parse request body
    const body: CreateWarehouseRequest = await request.json()

    // Validate required fields
    if (!body.code || !body.name) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          details: 'code and name are required',
        },
        { status: 400 }
      )
    }

    // Check for duplicate warehouse code
    const { data: existing } = await supabase
      .from('warehouses')
      .select('id')
      .eq('company_id', body.companyId)
      .eq('warehouse_code', body.code)
      .is('deleted_at', null)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        {
          error: 'Warehouse code already exists',
          details: `Warehouse code "${body.code}" is already in use`,
        },
        { status: 409 }
      )
    }

    // business_unit_id from JWT - set by auth hook
    // Insert warehouse
    const { data: newWarehouse, error: insertError } = await supabase
      .from('warehouses')
      .insert({
        company_id: body.companyId,
        business_unit_id: currentBusinessUnitId,
        warehouse_code: body.code,
        warehouse_name: body.name,
        address_line1: body.address,
        city: body.city,
        state: body.state,
        postal_code: body.postalCode,
        country: body.country,
        phone: body.phone,
        email: body.email,
        contact_person: body.managerId,
        is_active: body.isActive ?? true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to create warehouse', details: insertError.message },
        { status: 500 }
      )
    }

    // Transform and return
    const warehouse = transformDbWarehouse(newWarehouse)

    return NextResponse.json({ data: warehouse }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
