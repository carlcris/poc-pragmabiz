import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'
import type { Warehouse, UpdateWarehouseRequest } from '@/types/warehouse'
import type { Database } from '@/types/database.types'

type DbWarehouse = Database['public']['Tables']['warehouses']['Row']
type WarehouseUpdate = Partial<DbWarehouse> & { updated_by: string }

// Transform database warehouse to frontend Warehouse type
function transformDbWarehouse(dbWarehouse: DbWarehouse): Warehouse {
  return {
    id: dbWarehouse.id,
    companyId: dbWarehouse.company_id,
    code: dbWarehouse.warehouse_code,
    name: dbWarehouse.warehouse_name,
    description: '', // Not in DB
    address: `${dbWarehouse.address_line1 || ''}${dbWarehouse.address_line2 ? ' ' + dbWarehouse.address_line2 : ''}`.trim(),
    city: dbWarehouse.city || '',
    state: dbWarehouse.state || '',
    postalCode: dbWarehouse.postal_code || '',
    country: dbWarehouse.country || '',
    phone: dbWarehouse.phone || '',
    email: dbWarehouse.email || '',
    managerName: dbWarehouse.contact_person || undefined,
    isActive: dbWarehouse.is_active ?? true,
    createdAt: dbWarehouse.created_at,
    updatedAt: dbWarehouse.updated_at,
  }
}

// GET /api/warehouses/[id] - Get single warehouse
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require 'warehouses' view permission
    const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, 'view')
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

    // Fetch warehouse
    const { data, error } = await supabase
      .from('warehouses')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (error) {

      return NextResponse.json(
        { error: 'Failed to fetch warehouse', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    // Transform and return
    const warehouse = transformDbWarehouse(data)
    return NextResponse.json({ data: warehouse })
  } catch {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/warehouses/[id] - Update warehouse
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require 'warehouses' edit permission
    const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, 'edit')
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
    const body: UpdateWarehouseRequest = await request.json()

    // Check if warehouse exists
    const { data: existing, error: existError } = await supabase
      .from('warehouses')
      .select('id, company_id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (existError) {

      return NextResponse.json(
        { error: 'Failed to check warehouse', details: existError.message },
        { status: 500 }
      )
    }

    if (!existing) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    // Build update object
    const updateData: WarehouseUpdate = {
      updated_by: user.id,
    }

    if (body.name !== undefined) updateData.warehouse_name = body.name
    if (body.address !== undefined) updateData.address_line1 = body.address
    if (body.city !== undefined) updateData.city = body.city
    if (body.state !== undefined) updateData.state = body.state
    if (body.postalCode !== undefined) updateData.postal_code = body.postalCode
    if (body.country !== undefined) updateData.country = body.country
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.email !== undefined) updateData.email = body.email
    if (body.managerId !== undefined) updateData.contact_person = body.managerId
    if (body.isActive !== undefined) updateData.is_active = body.isActive

    // Update warehouse
    const { data: updatedWarehouse, error: updateError } = await supabase
      .from('warehouses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {

      return NextResponse.json(
        { error: 'Failed to update warehouse', details: updateError.message },
        { status: 500 }
      )
    }

    // Transform and return
    const warehouse = transformDbWarehouse(updatedWarehouse)
    return NextResponse.json({ data: warehouse })
  } catch {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/warehouses/[id] - Soft delete warehouse
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require 'warehouses' delete permission
    const unauthorized = await requirePermission(RESOURCES.WAREHOUSES, 'delete')
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

    // Check if warehouse exists
    const { data: existing } = await supabase
      .from('warehouses')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 })
    }

    // Soft delete (set deleted_at timestamp)
    const { error: deleteError } = await supabase
      .from('warehouses')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', id)

    if (deleteError) {

      return NextResponse.json(
        { error: 'Failed to delete warehouse', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Warehouse deleted successfully' })
  } catch {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
