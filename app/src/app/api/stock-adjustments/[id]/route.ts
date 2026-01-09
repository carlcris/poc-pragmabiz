import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

// GET /api/stock-adjustments/[id] - Get single stock adjustment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require 'stock_adjustments' view permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, 'view')
    if (unauthorized) return unauthorized

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

    // Fetch adjustment
    const { data: adjustment, error } = await supabase
      .from('stock_adjustments')
      .select('*')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (error || !adjustment) {
      return NextResponse.json({ error: 'Stock adjustment not found' }, { status: 404 })
    }

    // Fetch items
    const { data: items } = await supabase
      .from('stock_adjustment_items')
      .select('*')
      .eq('adjustment_id', id)

    // Fetch related data
    const locationId = adjustment.custom_fields?.locationId
    const [warehouse, location] = await Promise.all([
      adjustment.warehouse_id
        ? supabase.from('warehouses').select('warehouse_name').eq('id', adjustment.warehouse_id).single()
        : Promise.resolve(null),
      locationId
        ? supabase.from('warehouse_locations').select('code, name').eq('id', locationId).single()
        : Promise.resolve(null),
    ])

    const stockTransaction = adjustment.stock_transaction_id
      ? await supabase.from('stock_transactions').select('transaction_code').eq('id', adjustment.stock_transaction_id).single()
      : null

    const createdBy = await supabase.from('users').select('first_name, last_name').eq('id', adjustment.created_by).single()
    const approvedBy = adjustment.approved_by
      ? await supabase.from('users').select('first_name, last_name').eq('id', adjustment.approved_by).single()
      : null
    const postedBy = adjustment.posted_by
      ? await supabase.from('users').select('first_name, last_name').eq('id', adjustment.posted_by).single()
      : null

    return NextResponse.json({
      id: adjustment.id,
      companyId: adjustment.company_id,
      adjustmentCode: adjustment.adjustment_code,
      adjustmentType: adjustment.adjustment_type,
      adjustmentDate: adjustment.adjustment_date,
      warehouseId: adjustment.warehouse_id,
      locationId: adjustment.custom_fields?.locationId || null,
      locationCode: location?.data?.code || null,
      locationName: location?.data?.name || null,
      warehouseName: warehouse?.data?.warehouse_name || null,
      status: adjustment.status,
      reason: adjustment.reason,
      notes: adjustment.notes,
      totalValue: parseFloat(adjustment.total_value || 0),
      stockTransactionId: adjustment.stock_transaction_id,
      stockTransactionCode: stockTransaction?.data?.transaction_code || null,
      approvedBy: adjustment.approved_by,
      approvedByName: approvedBy?.data ? `${approvedBy.data.first_name || ''} ${approvedBy.data.last_name || ''}`.trim() : null,
      approvedAt: adjustment.approved_at,
      postedBy: adjustment.posted_by,
      postedByName: postedBy?.data ? `${postedBy.data.first_name || ''} ${postedBy.data.last_name || ''}`.trim() : null,
      postedAt: adjustment.posted_at,
      createdBy: adjustment.created_by,
      createdByName: createdBy?.data ? `${createdBy.data.first_name || ''} ${createdBy.data.last_name || ''}`.trim() : null,
      updatedBy: adjustment.updated_by,
      createdAt: adjustment.created_at,
      updatedAt: adjustment.updated_at,
      items: items?.map((item: any) => ({
        id: item.id,
        adjustmentId: item.adjustment_id,
        itemId: item.item_id,
        itemCode: item.item_code,
        itemName: item.item_name,
        currentQty: parseFloat(item.current_qty),
        adjustedQty: parseFloat(item.adjusted_qty),
        difference: parseFloat(item.difference),
        unitCost: parseFloat(item.unit_cost),
        totalCost: parseFloat(item.total_cost),
        uomId: item.uom_id,
        uomName: item.uom_name,
        reason: item.reason,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })) || [],
    })
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/stock-adjustments/[id] - Update stock adjustment (draft only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require 'stock_adjustments' edit permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, 'edit')
    if (unauthorized) return unauthorized

    const { id } = await params
    const body = await request.json()
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

    // Check adjustment exists and is draft
    const { data: adjustment, error: fetchError } = await supabase
      .from('stock_adjustments')
      .select('status, custom_fields')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !adjustment) {
      return NextResponse.json({ error: 'Stock adjustment not found' }, { status: 404 })
    }

    if (adjustment.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft adjustments can be updated' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }

    if (body.adjustmentType) updateData.adjustment_type = body.adjustmentType
    if (body.adjustmentDate) updateData.adjustment_date = body.adjustmentDate
    if (body.warehouseId) updateData.warehouse_id = body.warehouseId
    if (body.reason) updateData.reason = body.reason
    if (body.notes !== undefined) updateData.notes = body.notes
    if ('locationId' in body) {
      const locationValue =
        typeof body.locationId === 'string' && body.locationId.length > 0
          ? body.locationId
          : null
      updateData.custom_fields = {
        ...(adjustment.custom_fields || {}),
        locationId: locationValue,
      }
    }

    // Update items if provided
    if (body.items) {
      // Delete existing items
      await supabase.from('stock_adjustment_items').delete().eq('adjustment_id', id)

      // Get item details
      const itemIds = body.items.map((item: any) => item.itemId)
      const { data: itemsData } = await supabase
        .from('items')
        .select('id, item_code, item_name')
        .in('id', itemIds)

      const itemsMap = new Map(itemsData?.map((item: any) => [item.id, item]) || [])

      // Get UOM details
      const uomIds = body.items.map((item: any) => item.uomId)
      const { data: uomsData } = await supabase
        .from('uoms')
        .select('id, uom_name')
        .in('id', uomIds)

      const uomsMap = new Map(uomsData?.map((uom: any) => [uom.id, uom]) || [])

      // Create new items
      const adjustmentItems = body.items.map((item: any) => {
        const itemData = itemsMap.get(item.itemId)
        const uomData = uomsMap.get(item.uomId)
        const difference = item.adjustedQty - item.currentQty
        const totalCost = difference * item.unitCost

        return {
          company_id: userData.company_id,
          adjustment_id: id,
          item_id: item.itemId,
          item_code: itemData?.item_code || '',
          item_name: itemData?.item_name || '',
          current_qty: item.currentQty,
          adjusted_qty: item.adjustedQty,
          difference: difference,
          unit_cost: item.unitCost,
          total_cost: totalCost,
          uom_id: item.uomId,
          uom_name: uomData?.uom_name || '',
          reason: item.reason || null,
          created_by: user.id,
          updated_by: user.id,
        }
      })

      await supabase.from('stock_adjustment_items').insert(adjustmentItems)

      // Calculate new total value
      const totalValue = body.items.reduce((sum: number, item: any) => {
        const difference = item.adjustedQty - item.currentQty
        return sum + difference * item.unitCost
      }, 0)

      updateData.total_value = totalValue
    }

    // Update adjustment
    const { error: updateError } = await supabase
      .from('stock_adjustments')
      .update(updateData)
      .eq('id', id)

    if (updateError) {

      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Fetch updated adjustment
    const { data: updatedAdjustment } = await supabase
      .from('stock_adjustments')
      .select('*')
      .eq('id', id)
      .single()

    const { data: updatedItems } = await supabase
      .from('stock_adjustment_items')
      .select('*')
      .eq('adjustment_id', id)

    const updatedLocationId = updatedAdjustment?.custom_fields?.locationId
    const location = updatedLocationId
      ? await supabase.from('warehouse_locations').select('code, name').eq('id', updatedLocationId).single()
      : null

    return NextResponse.json({
      id: updatedAdjustment.id,
      companyId: updatedAdjustment.company_id,
      adjustmentCode: updatedAdjustment.adjustment_code,
      adjustmentType: updatedAdjustment.adjustment_type,
      adjustmentDate: updatedAdjustment.adjustment_date,
      warehouseId: updatedAdjustment.warehouse_id,
      locationId: updatedAdjustment.custom_fields?.locationId || null,
      locationCode: location?.data?.code || null,
      locationName: location?.data?.name || null,
      status: updatedAdjustment.status,
      reason: updatedAdjustment.reason,
      notes: updatedAdjustment.notes,
      totalValue: parseFloat(updatedAdjustment.total_value),
      createdBy: updatedAdjustment.created_by,
      updatedBy: updatedAdjustment.updated_by,
      createdAt: updatedAdjustment.created_at,
      updatedAt: updatedAdjustment.updated_at,
      items: updatedItems?.map((item: any) => ({
        id: item.id,
        adjustmentId: item.adjustment_id,
        itemId: item.item_id,
        itemCode: item.item_code,
        itemName: item.item_name,
        currentQty: parseFloat(item.current_qty),
        adjustedQty: parseFloat(item.adjusted_qty),
        difference: parseFloat(item.difference),
        unitCost: parseFloat(item.unit_cost),
        totalCost: parseFloat(item.total_cost),
        uomId: item.uom_id,
        uomName: item.uom_name,
        reason: item.reason,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })) || [],
    })
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/stock-adjustments/[id] - Soft delete stock adjustment (draft only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require 'stock_adjustments' delete permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, 'delete')
    if (unauthorized) return unauthorized

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

    // Check adjustment exists and is draft
    const { data: adjustment, error: fetchError } = await supabase
      .from('stock_adjustments')
      .select('status')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !adjustment) {
      return NextResponse.json({ error: 'Stock adjustment not found' }, { status: 404 })
    }

    if (adjustment.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft adjustments can be deleted' },
        { status: 400 }
      )
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('stock_adjustments')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', id)

    if (deleteError) {

      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
