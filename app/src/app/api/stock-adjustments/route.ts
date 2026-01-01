import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

// GET /api/stock-adjustments - List stock adjustments
export async function GET(request: NextRequest) {
  try {
    // Require 'stock_adjustments' view permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, 'view')
    if (unauthorized) return unauthorized

    const { supabase } = await createServerClientWithBU()
    const searchParams = request.nextUrl.searchParams

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

    // Parse query parameters
    const search = searchParams.get('search') || ''
    const warehouseId = searchParams.get('warehouseId') || ''
    const adjustmentType = searchParams.get('adjustmentType') || ''
    const status = searchParams.get('status') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Build query - simplified without nested relationships
    let query = supabase
      .from('stock_adjustments')
      .select(
        `
        id,
        company_id,
        adjustment_code,
        adjustment_type,
        adjustment_date,
        warehouse_id,
        status,
        reason,
        notes,
        total_value,
        stock_transaction_id,
        approved_by,
        approved_at,
        posted_by,
        posted_at,
        created_by,
        updated_by,
        created_at,
        updated_at,
        deleted_at
      `,
        { count: 'exact' }
      )
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .order('adjustment_date', { ascending: false })
      .order('created_at', { ascending: false })

    // Apply filters
    if (search) {
      query = query.or(`adjustment_code.ilike.%${search}%,reason.ilike.%${search}%`)
    }
    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId)
    }
    if (adjustmentType) {
      query = query.eq('adjustment_type', adjustmentType)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (startDate) {
      query = query.gte('adjustment_date', startDate)
    }
    if (endDate) {
      query = query.lte('adjustment_date', endDate)
    }

    // Execute query
    const { data: adjustments, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Collect unique IDs for related data
    const warehouseIds = new Set<string>()
    const userIds = new Set<string>()
    const stockTransactionIds = new Set<string>()

    adjustments.forEach((adj: any) => {
      if (adj.warehouse_id) warehouseIds.add(adj.warehouse_id)
      if (adj.created_by) userIds.add(adj.created_by)
      if (adj.updated_by) userIds.add(adj.updated_by)
      if (adj.approved_by) userIds.add(adj.approved_by)
      if (adj.posted_by) userIds.add(adj.posted_by)
      if (adj.stock_transaction_id) stockTransactionIds.add(adj.stock_transaction_id)
    })

    // Fetch related data in parallel
    const [warehousesData, usersData, stockTransactionsData] = await Promise.all([
      warehouseIds.size > 0
        ? supabase.from('warehouses').select('id, warehouse_code, warehouse_name').in('id', Array.from(warehouseIds))
        : Promise.resolve({ data: [] }),
      userIds.size > 0
        ? supabase.from('users').select('id, first_name, last_name').in('id', Array.from(userIds))
        : Promise.resolve({ data: [] }),
      stockTransactionIds.size > 0
        ? supabase.from('stock_transactions').select('id, transaction_code').in('id', Array.from(stockTransactionIds))
        : Promise.resolve({ data: [] }),
    ])

    // Create lookup maps
    const warehousesMap = new Map(warehousesData.data?.map((w: any) => [w.id, w]) || [])
    const usersMap = new Map(usersData.data?.map((u: any) => [u.id, u]) || [])
    const stockTransactionsMap = new Map(stockTransactionsData.data?.map((st: any) => [st.id, st]) || [])

    // Fetch items for each adjustment
    const adjustmentIds = adjustments.map((adj: any) => adj.id)
    const { data: itemsData } = adjustmentIds.length > 0
      ? await supabase
          .from('stock_adjustment_items')
          .select('*')
          .in('adjustment_id', adjustmentIds)
      : { data: [] }

    // Group items by adjustment
    const itemsByAdjustment = new Map<string, any[]>()
    itemsData?.forEach((item: any) => {
      const adjustmentId = item.adjustment_id
      if (!itemsByAdjustment.has(adjustmentId)) {
        itemsByAdjustment.set(adjustmentId, [])
      }
      itemsByAdjustment.get(adjustmentId)!.push(item)
    })

    // Format response
    const formattedData = adjustments.map((adj: any) => {
      const warehouse = warehousesMap.get(adj.warehouse_id)
      const createdBy = usersMap.get(adj.created_by)
      const updatedBy = usersMap.get(adj.updated_by)
      const approvedBy = usersMap.get(adj.approved_by)
      const postedBy = usersMap.get(adj.posted_by)
      const stockTransaction = stockTransactionsMap.get(adj.stock_transaction_id)
      const items = itemsByAdjustment.get(adj.id) || []

      return {
        id: adj.id,
        companyId: adj.company_id,
        adjustmentCode: adj.adjustment_code,
        adjustmentType: adj.adjustment_type,
        adjustmentDate: adj.adjustment_date,
        warehouseId: adj.warehouse_id,
        warehouseName: warehouse?.warehouse_name || null,
        status: adj.status,
        reason: adj.reason,
        notes: adj.notes,
        totalValue: parseFloat(adj.total_value || 0),
        stockTransactionId: adj.stock_transaction_id,
        stockTransactionCode: stockTransaction?.transaction_code || null,
        approvedBy: adj.approved_by,
        approvedByName: approvedBy ? `${approvedBy.first_name || ''} ${approvedBy.last_name || ''}`.trim() : null,
        approvedAt: adj.approved_at,
        postedBy: adj.posted_by,
        postedByName: postedBy ? `${postedBy.first_name || ''} ${postedBy.last_name || ''}`.trim() : null,
        postedAt: adj.posted_at,
        createdBy: adj.created_by,
        createdByName: createdBy ? `${createdBy.first_name || ''} ${createdBy.last_name || ''}`.trim() : null,
        updatedBy: adj.updated_by,
        updatedByName: updatedBy ? `${updatedBy.first_name || ''} ${updatedBy.last_name || ''}`.trim() : null,
        createdAt: adj.created_at,
        updatedAt: adj.updated_at,
        items: items.map((item: any) => ({
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
        })),
      }
    })

    return NextResponse.json({
      data: formattedData,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/stock-adjustments - Create new stock adjustment
export async function POST(request: NextRequest) {
  try {
    // Require 'stock_adjustments' create permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, 'create')
    if (unauthorized) return unauthorized

    const { supabase, currentBusinessUnitId } = await createServerClientWithBU()
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

    // Validate business unit context
    if (!currentBusinessUnitId) {
      return NextResponse.json(
        { error: 'Business unit context required' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!body.warehouseId || !body.adjustmentType || !body.adjustmentDate || !body.reason) {
      return NextResponse.json(
        { error: 'Missing required fields: warehouseId, adjustmentType, adjustmentDate, reason' },
        { status: 400 }
      )
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    // Generate adjustment code with timestamp to avoid duplicates
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
    const milliseconds = now.getTime().toString().slice(-4)
    const adjustmentCode = `ADJ-${dateStr}${milliseconds}`

    // Calculate total value
    const totalValue = body.items.reduce((sum: number, item: any) => {
      const difference = item.adjustedQty - item.currentQty
      return sum + difference * item.unitCost
    }, 0)

    // Create adjustment header
    const { data: adjustment, error: adjustmentError } = await supabase
      .from('stock_adjustments')
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        adjustment_code: adjustmentCode,
        adjustment_type: body.adjustmentType,
        adjustment_date: body.adjustmentDate,
        warehouse_id: body.warehouseId,
        status: 'draft',
        reason: body.reason,
        notes: body.notes || null,
        total_value: totalValue,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (adjustmentError) {

      return NextResponse.json({ error: adjustmentError.message }, { status: 500 })
    }

    // Get item details for items
    const itemIds = body.items.map((item: any) => item.itemId)
    const { data: itemsData } = await supabase
      .from('items')
      .select('id, item_code, item_name')
      .in('id', itemIds)

    const itemsMap = new Map(itemsData?.map((item: any) => [item.id, item]) || [])

    // Get UOM details
    const uomIds = body.items.map((item: any) => item.uomId)
    const { data: uomsData } = await supabase
      .from('units_of_measure')
      .select('id, code')
      .in('id', uomIds)

    const uomsMap = new Map(uomsData?.map((uom: any) => [uom.id, uom]) || [])

    // Create adjustment items
    const adjustmentItems = body.items.map((item: any) => {
      const itemData = itemsMap.get(item.itemId)
      const uomData = uomsMap.get(item.uomId)
      const difference = item.adjustedQty - item.currentQty
      const totalCost = difference * item.unitCost

      return {
        company_id: userData.company_id,
        adjustment_id: adjustment.id,
        item_id: item.itemId,
        item_code: itemData?.item_code || '',
        item_name: itemData?.item_name || '',
        current_qty: item.currentQty,
        adjusted_qty: item.adjustedQty,
        difference: difference,
        unit_cost: item.unitCost,
        total_cost: totalCost,
        uom_id: item.uomId,
        uom_name: uomData?.code || '',
        reason: item.reason || null,
        created_by: user.id,
        updated_by: user.id,
      }
    })

    const { error: itemsError } = await supabase
      .from('stock_adjustment_items')
      .insert(adjustmentItems)

    if (itemsError) {

      // Rollback adjustment
      await supabase.from('stock_adjustments').delete().eq('id', adjustment.id)
      return NextResponse.json({ error: 'Failed to create adjustment items' }, { status: 500 })
    }

    // Fetch the complete adjustment with items
    const { data: completeAdjustment } = await supabase
      .from('stock_adjustments')
      .select('*')
      .eq('id', adjustment.id)
      .single()

    const { data: completeItems } = await supabase
      .from('stock_adjustment_items')
      .select('*')
      .eq('adjustment_id', adjustment.id)

    return NextResponse.json({
      id: completeAdjustment.id,
      companyId: completeAdjustment.company_id,
      adjustmentCode: completeAdjustment.adjustment_code,
      adjustmentType: completeAdjustment.adjustment_type,
      adjustmentDate: completeAdjustment.adjustment_date,
      warehouseId: completeAdjustment.warehouse_id,
      status: completeAdjustment.status,
      reason: completeAdjustment.reason,
      notes: completeAdjustment.notes,
      totalValue: parseFloat(completeAdjustment.total_value),
      createdBy: completeAdjustment.created_by,
      updatedBy: completeAdjustment.updated_by,
      createdAt: completeAdjustment.created_at,
      updatedAt: completeAdjustment.updated_at,
      items: completeItems?.map((item: any) => ({
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
