import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/stock-balances
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

    // Get latest stock balances from stock_ledger
    // We need to get the most recent entry for each item-warehouse combination
    const warehouseId = searchParams.get('warehouseId')
    const itemId = searchParams.get('itemId')

    // Build a query to get distinct item-warehouse combinations with their latest balance
    let query = supabase
      .from('stock_ledger')
      .select(
        `
        item_id,
        warehouse_id,
        qty_after_trans,
        posting_date,
        posting_time,
        item:items!inner(
          id,
          item_code,
          item_name,
          uom:units_of_measure(id, code, name)
        ),
        warehouse:warehouses!inner(
          id,
          warehouse_code,
          warehouse_name
        )
      `
      )
      .eq('company_id', userData.company_id)
      .order('posting_date', { ascending: false })
      .order('posting_time', { ascending: false })

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId)
    }

    if (itemId) {
      query = query.eq('item_id', itemId)
    }

    const { data: ledgerEntries, error } = await query

    if (error) {
      console.error('Error fetching stock balances:', error)
      return NextResponse.json({ error: 'Failed to fetch stock balances' }, { status: 500 })
    }

    // Group by item_id + warehouse_id and get the latest entry for each
    const balancesMap = new Map<string, any>()

    for (const entry of ledgerEntries || []) {
      const key = `${entry.item_id}_${entry.warehouse_id}`

      // Only keep the first (most recent) entry for each item-warehouse combination
      if (!balancesMap.has(key)) {
        balancesMap.set(key, {
          itemId: entry.item_id,
          itemCode: entry.item.item_code,
          itemName: entry.item.item_name,
          warehouseId: entry.warehouse_id,
          warehouseCode: entry.warehouse.warehouse_code,
          warehouseName: entry.warehouse.warehouse_name,
          quantity: parseFloat(entry.qty_after_trans),
          uom: entry.item.uom?.code || '',
          lastUpdated: `${entry.posting_date} ${entry.posting_time}`,
        })
      }
    }

    // Convert map to array
    const stockBalances = Array.from(balancesMap.values())

    // Filter out zero balances if requested
    const includeZero = searchParams.get('includeZero') === 'true'
    const filteredBalances = includeZero
      ? stockBalances
      : stockBalances.filter((balance) => balance.quantity > 0)

    // Apply low stock filter if requested
    const lowStockOnly = searchParams.get('lowStockOnly') === 'true'
    if (lowStockOnly) {
      // TODO: This would require joining with reorder_rules table
      // For now, just return items with quantity < 10
      return NextResponse.json(
        filteredBalances.filter((balance) => balance.quantity < 10)
      )
    }

    return NextResponse.json(filteredBalances)
  } catch (error) {
    console.error('Unexpected error in GET /api/stock-balances:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
