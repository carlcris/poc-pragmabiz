import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'
import { normalizeTransactionItems } from '@/services/inventory/normalizationService'
import type { StockTransactionItemInput } from '@/types/inventory-normalization'

// GET /api/stock-transactions
export async function GET(request: NextRequest) {
  try {
    // Require 'stock_transactions' view permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSACTIONS, 'view')
    if (unauthorized) return unauthorized

    const { supabase } = await createServerClientWithBU()
    const { searchParams } = new URL(request.url)

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

    // Pagination params
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Fetch stock transaction items
    const { data: transactionItems, error: txError } = await supabase
      .from('stock_transaction_items')
      .select(
        `
        id,
        quantity,
        unit_cost,
        total_cost,
        batch_no,
        serial_no,
        expiry_date,
        notes,
        created_at,
        transaction:stock_transactions!inner(
          id,
          transaction_code,
          transaction_type,
          transaction_date,
          warehouse_id,
          to_warehouse_id,
          reference_type,
          reference_id,
          status,
          notes,
          created_by,
          created_at
        ),
        item:items!inner(
          id,
          item_code,
          item_name,
          uom:units_of_measure(id, code, name)
        )
      `
      )
      .eq('transaction.company_id', userData.company_id)
      .is('deleted_at', null)
      .is('transaction.deleted_at', null)

    if (txError) {

      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    // Collect warehouse and user IDs
    const warehouseIds = new Set<string>()
    const userIds = new Set<string>()

    transactionItems.forEach((item: any) => {
      if (item.transaction.warehouse_id) warehouseIds.add(item.transaction.warehouse_id)
      if (item.transaction.to_warehouse_id) warehouseIds.add(item.transaction.to_warehouse_id)
      if (item.transaction.created_by) userIds.add(item.transaction.created_by)
    })

    // Fetch warehouses and users
    const [warehousesData, usersData] = await Promise.all([
      warehouseIds.size > 0
        ? supabase
            .from('warehouses')
            .select('id, warehouse_code, warehouse_name')
            .in('id', Array.from(warehouseIds))
        : Promise.resolve({ data: [] }),
      userIds.size > 0
        ? supabase
            .from('users')
            .select('id, first_name, last_name')
            .in('id', Array.from(userIds))
        : Promise.resolve({ data: [] }),
    ])

    const warehousesMap = new Map(warehousesData.data?.map((w: any) => [w.id, w]) || [])
    const usersMap = new Map(usersData.data?.map((u: any) => [u.id, u]) || [])

    // Format stock transactions
    const formattedTransactions = transactionItems.map((item: any) => {
      const warehouse = warehousesMap.get(item.transaction.warehouse_id)
      const toWarehouse = warehousesMap.get(item.transaction.to_warehouse_id)
      const creator = usersMap.get(item.transaction.created_by)

      return {
        id: item.id, // Use transaction item ID as unique key
        transactionId: item.transaction.id,
        companyId: userData.company_id,
        transactionCode: item.transaction.transaction_code,
        transactionDate: item.transaction.transaction_date,
        transactionType: item.transaction.transaction_type,
        itemId: item.item.id,
        itemCode: item.item.item_code,
        itemName: item.item.item_name,
        warehouseId: item.transaction.warehouse_id,
        warehouseCode: warehouse?.warehouse_code || '',
        warehouseName: warehouse?.warehouse_name || '',
        toWarehouseId: item.transaction.to_warehouse_id,
        toWarehouseCode: toWarehouse?.warehouse_code || '',
        toWarehouseName: toWarehouse?.warehouse_name || '',
        quantity: parseFloat(item.quantity),
        uom: item.item.uom?.code || '',
        unitCost: item.unit_cost ? parseFloat(item.unit_cost) : 0,
        totalCost: item.total_cost ? parseFloat(item.total_cost) : 0,
        batchNo: item.batch_no,
        serialNo: item.serial_no,
        expiryDate: item.expiry_date,
        referenceType: item.transaction.reference_type,
        referenceId: item.transaction.reference_id,
        referenceNumber: item.transaction.transaction_code,
        reason: item.transaction.notes || '',
        notes: item.notes || '',
        createdBy: item.transaction.created_by,
        createdByName: creator ? `${creator.first_name || ''} ${creator.last_name || ''}`.trim() : 'Unknown',
        createdAt: item.transaction.created_at,
        updatedAt: item.created_at,
      }
    })

    // Sort by date (most recent first)
    const allTransactions = formattedTransactions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // Apply pagination
    const total = allTransactions.length
    const from = (page - 1) * limit
    const to = from + limit
    const paginatedTransactions = allTransactions.slice(from, to)

    return NextResponse.json({
      data: paginatedTransactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/stock-transactions
export async function POST(request: NextRequest) {
  try {
    // Require 'stock_transactions' create permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSACTIONS, 'create')
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

    if (!currentBusinessUnitId) {
      return NextResponse.json(
        { error: 'Business unit context required' },
        { status: 400 }
      )
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

    // Validate required fields
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Stock transaction must have at least one item' },
        { status: 400 }
      )
    }

    // Generate transaction code (ST-YYYY-NNNN)
    const currentYear = new Date().getFullYear()
    const { data: lastTransaction } = await supabase
      .from('stock_transactions')
      .select('transaction_code')
      .eq('company_id', userData.company_id)
      .like('transaction_code', `ST-${currentYear}-%`)
      .order('transaction_code', { ascending: false })
      .limit(1)

    let nextNum = 1
    if (lastTransaction && lastTransaction.length > 0) {
      const match = lastTransaction[0].transaction_code.match(/ST-\d+-(\d+)/)
      if (match) {
        nextNum = parseInt(match[1]) + 1
      }
    }
    const transactionCode = `ST-${currentYear}-${String(nextNum).padStart(4, '0')}`

    // Create stock transaction header
    const { data: transaction, error: transactionError } = await supabase
      .from('stock_transactions')
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        transaction_code: transactionCode,
        transaction_type: body.transactionType,
        transaction_date: body.transactionDate || new Date().toISOString().split('T')[0],
        warehouse_id: body.warehouseId,
        to_warehouse_id: body.toWarehouseId || null,
        reference_type: body.referenceType || null,
        reference_id: body.referenceId || null,
        status: 'posted', // Manual transactions are posted immediately
        notes: body.notes || null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (transactionError) {

      return NextResponse.json(
        { error: transactionError.message || 'Failed to create stock transaction' },
        { status: 500 }
      )
    }

    // Normalize item quantities from packages to base units
    const itemInputs: StockTransactionItemInput[] = body.items.map((item: any) => ({
      itemId: item.itemId,
      packagingId: item.packagingId || null,
      inputQty: item.quantity,
      unitCost: item.unitCost || 0,
    }))

    let normalizedItems
    try {
      normalizedItems = await normalizeTransactionItems(userData.company_id, itemInputs)
    } catch (normError) {
      await supabase.from('stock_transactions').delete().eq('id', transaction.id)
      return NextResponse.json(
        { error: normError instanceof Error ? normError.message : 'Failed to normalize item quantities' },
        { status: 400 }
      )
    }

    const postingDate = body.transactionDate || new Date().toISOString().split('T')[0]
    const postingTime = new Date().toTimeString().split(' ')[0]

    // Update stock and create transaction items with normalization metadata
    for (let i = 0; i < normalizedItems.length; i++) {
      const item = normalizedItems[i]
      const originalItem = body.items[i]

      // Get current stock balance from item_warehouse (source of truth)
      const { data: warehouseStock } = await supabase
        .from('item_warehouse')
        .select('current_stock')
        .eq('item_id', item.itemId)
        .eq('warehouse_id', body.warehouseId)
        .single()

      const currentBalance = warehouseStock
        ? parseFloat(String(warehouseStock.current_stock))
        : 0

      // Calculate actual quantity change based on transaction type (use normalized qty)
      let actualQty = item.normalizedQty
      if (body.transactionType === 'out') {
        actualQty = -item.normalizedQty
      } else if (body.transactionType === 'transfer' && body.warehouseId) {
        actualQty = -item.normalizedQty
      }

      const newBalance = currentBalance + actualQty

      // Validate sufficient stock for OUT transactions
      if (newBalance < 0 && body.transactionType === 'out') {
        return NextResponse.json(
          { error: `Insufficient stock for item. Available: ${currentBalance}, Requested: ${item.normalizedQty}` },
          { status: 400 }
        )
      }

      // Create stock transaction item with full normalization metadata
      const { data: stockTxItem, error: stockTxItemError } = await supabase
        .from('stock_transaction_items')
        .insert({
          company_id: userData.company_id,
          transaction_id: transaction.id,
          item_id: item.itemId,
          // Normalization fields
          input_qty: item.inputQty,
          input_packaging_id: item.inputPackagingId,
          conversion_factor: item.conversionFactor,
          normalized_qty: item.normalizedQty,
          base_package_id: item.basePackageId,
          // Standard fields
          quantity: item.normalizedQty,
          uom_id: item.uomId,
          unit_cost: item.unitCost,
          total_cost: item.totalCost,
          // Audit fields
          qty_before: currentBalance,
          qty_after: newBalance,
          valuation_rate: item.unitCost,
          stock_value_before: currentBalance * item.unitCost,
          stock_value_after: newBalance * item.unitCost,
          posting_date: postingDate,
          posting_time: postingTime,
          // Additional fields from original item
          batch_no: originalItem.batchNo || null,
          serial_no: originalItem.serialNo || null,
          expiry_date: originalItem.expiryDate || null,
          notes: originalItem.notes || null,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single()

      if (stockTxItemError) {
        // Rollback: delete the transaction
        await supabase.from('stock_transactions').delete().eq('id', transaction.id)
        return NextResponse.json(
          { error: stockTxItemError.message || 'Failed to create transaction item' },
          { status: 500 }
        )
      }

      // Update item_warehouse current_stock
      const { error: warehouseUpdateError } = await supabase
        .from('item_warehouse')
        .update({
          current_stock: newBalance,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('item_id', item.itemId)
        .eq('warehouse_id', body.warehouseId)

      if (warehouseUpdateError) {

        return NextResponse.json(
          { error: 'Failed to update warehouse inventory' },
          { status: 500 }
        )
      }

      // For transfers, update destination warehouse
      if (body.transactionType === 'transfer' && body.toWarehouseId) {
        const { data: destWarehouseStock } = await supabase
          .from('item_warehouse')
          .select('current_stock')
          .eq('item_id', item.itemId)
          .eq('warehouse_id', body.toWarehouseId)
          .single()

        const destCurrentBalance = destWarehouseStock
          ? parseFloat(String(destWarehouseStock.current_stock))
          : 0

        const destNewBalance = destCurrentBalance + item.normalizedQty

        // Update destination warehouse stock
        if (destWarehouseStock) {
          // Update existing record
          await supabase
            .from('item_warehouse')
            .update({
              current_stock: destNewBalance,
              updated_by: user.id,
              updated_at: new Date().toISOString(),
            })
            .eq('item_id', item.itemId)
            .eq('warehouse_id', body.toWarehouseId)
        } else {
          // Create new item_warehouse record if doesn't exist
          await supabase
            .from('item_warehouse')
            .insert({
              company_id: userData.company_id,
              item_id: item.itemId,
              warehouse_id: body.toWarehouseId,
              current_stock: destNewBalance,
              created_by: user.id,
              updated_by: user.id,
            })
        }
      }
    }

    return NextResponse.json(
      {
        id: transaction.id,
        transactionCode: transaction.transaction_code,
        message: 'Stock transaction created successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}
