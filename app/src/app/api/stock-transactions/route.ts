import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/stock-transactions
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
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

    // Build query - Get transaction items with related data
    let query = supabase
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
      `,
        { count: 'exact' }
      )
      .eq('transaction.company_id', userData.company_id)
      .is('deleted_at', null)
      .is('transaction.deleted_at', null)

    // Apply filters
    const transactionType = searchParams.get('transactionType')
    if (transactionType && transactionType !== 'all') {
      query = query.eq('transaction.transaction_type', transactionType)
    }

    const itemId = searchParams.get('itemId')
    if (itemId) {
      query = query.eq('item_id', itemId)
    }

    const warehouseId = searchParams.get('warehouseId')
    if (warehouseId) {
      query = query.eq('transaction.warehouse_id', warehouseId)
    }

    const startDate = searchParams.get('startDate')
    if (startDate) {
      query = query.gte('transaction.transaction_date', startDate)
    }

    const endDate = searchParams.get('endDate')
    if (endDate) {
      query = query.lte('transaction.transaction_date', endDate)
    }

    const search = searchParams.get('search')
    if (search) {
      query = query.or(
        `transaction.transaction_code.ilike.%${search}%,item.item_name.ilike.%${search}%,item.item_code.ilike.%${search}%`
      )
    }

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query.range(from, to).order('created_at', { ascending: false })

    const { data: transactionItems, error, count } = await query

    if (error) {
      console.error('Error fetching stock transactions:', error)
      return NextResponse.json({ error: 'Failed to fetch stock transactions' }, { status: 500 })
    }

    // Get unique warehouse IDs and user IDs
    const warehouseIds = new Set<string>()
    const userIds = new Set<string>()

    transactionItems?.forEach((item: any) => {
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

    // Format response - flatten the nested structure
    const formattedTransactions = transactionItems?.map((item: any) => {
      const warehouse = warehousesMap.get(item.transaction.warehouse_id)
      const toWarehouse = warehousesMap.get(item.transaction.to_warehouse_id)
      const creator = usersMap.get(item.transaction.created_by)

      return {
        id: item.id,
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

    return NextResponse.json({
      data: formattedTransactions,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/stock-transactions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/stock-transactions
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
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
      console.error('Error creating stock transaction:', transactionError)
      return NextResponse.json(
        { error: transactionError.message || 'Failed to create stock transaction' },
        { status: 500 }
      )
    }

    // Create transaction items
    const transactionItems = body.items.map((item: any) => ({
      company_id: userData.company_id,
      transaction_id: transaction.id,
      item_id: item.itemId,
      quantity: item.quantity,
      uom_id: item.uomId,
      unit_cost: item.unitCost || 0,
      total_cost: item.quantity * (item.unitCost || 0),
      batch_no: item.batchNo || null,
      serial_no: item.serialNo || null,
      expiry_date: item.expiryDate || null,
      notes: item.notes || null,
      created_by: user.id,
      updated_by: user.id,
    }))

    const { data: createdItems, error: itemsError } = await supabase
      .from('stock_transaction_items')
      .insert(transactionItems)
      .select()

    if (itemsError || !createdItems) {
      console.error('Error creating transaction items:', itemsError)
      // Rollback: delete the transaction
      await supabase.from('stock_transactions').delete().eq('id', transaction.id)
      return NextResponse.json(
        { error: itemsError?.message || 'Failed to create transaction items' },
        { status: 500 }
      )
    }

    // Create stock ledger entries
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i]
      const createdItem = createdItems[i]
      // Get current stock balance
      const { data: lastLedgerEntry } = await supabase
        .from('stock_ledger')
        .select('qty_after_trans')
        .eq('company_id', userData.company_id)
        .eq('item_id', item.itemId)
        .eq('warehouse_id', body.warehouseId)
        .order('posting_date', { ascending: false })
        .order('posting_time', { ascending: false })
        .limit(1)

      const currentBalance = lastLedgerEntry && lastLedgerEntry.length > 0
        ? parseFloat(lastLedgerEntry[0].qty_after_trans)
        : 0

      // Calculate actual quantity change based on transaction type
      let actualQty = item.quantity
      if (body.transactionType === 'out') {
        actualQty = -item.quantity
      } else if (body.transactionType === 'transfer' && body.warehouseId) {
        actualQty = -item.quantity // OUT from source warehouse
      }

      const newBalance = currentBalance + actualQty

      // Insert stock ledger entry
      await supabase.from('stock_ledger').insert({
        company_id: userData.company_id,
        transaction_id: transaction.id,
        transaction_item_id: createdItem.id,
        item_id: item.itemId,
        warehouse_id: body.warehouseId,
        posting_date: body.transactionDate || new Date().toISOString().split('T')[0],
        posting_time: new Date().toTimeString().split(' ')[0],
        voucher_type: 'Stock Transaction',
        voucher_no: transactionCode,
        actual_qty: actualQty,
        qty_after_trans: newBalance,
        incoming_rate: item.unitCost || 0,
        valuation_rate: item.unitCost || 0,
        stock_value: newBalance * (item.unitCost || 0),
        stock_value_diff: actualQty * (item.unitCost || 0),
        batch_no: item.batchNo || null,
        serial_no: item.serialNo || null,
      })

      // For transfers, create entry in destination warehouse
      if (body.transactionType === 'transfer' && body.toWarehouseId) {
        const { data: destLastLedgerEntry } = await supabase
          .from('stock_ledger')
          .select('qty_after_trans')
          .eq('company_id', userData.company_id)
          .eq('item_id', item.itemId)
          .eq('warehouse_id', body.toWarehouseId)
          .order('posting_date', { ascending: false })
          .order('posting_time', { ascending: false })
          .limit(1)

        const destCurrentBalance = destLastLedgerEntry && destLastLedgerEntry.length > 0
          ? parseFloat(destLastLedgerEntry[0].qty_after_trans)
          : 0

        const destNewBalance = destCurrentBalance + item.quantity

        await supabase.from('stock_ledger').insert({
          company_id: userData.company_id,
          transaction_id: transaction.id,
          transaction_item_id: createdItem.id,
          item_id: item.itemId,
          warehouse_id: body.toWarehouseId,
          posting_date: body.transactionDate || new Date().toISOString().split('T')[0],
          posting_time: new Date().toTimeString().split(' ')[0],
          voucher_type: 'Stock Transaction',
          voucher_no: transactionCode,
          actual_qty: item.quantity, // IN to destination warehouse
          qty_after_trans: destNewBalance,
          incoming_rate: item.unitCost || 0,
          valuation_rate: item.unitCost || 0,
          stock_value: destNewBalance * (item.unitCost || 0),
          stock_value_diff: item.quantity * (item.unitCost || 0),
          batch_no: item.batchNo || null,
          serial_no: item.serialNo || null,
        })
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
    console.error('Unexpected error in POST /api/stock-transactions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
