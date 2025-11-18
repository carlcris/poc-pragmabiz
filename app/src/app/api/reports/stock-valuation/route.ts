import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/stock-valuation
// Returns current stock valuation report
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

    // Extract query parameters
    const warehouseId = searchParams.get('warehouseId')
    const itemId = searchParams.get('itemId')
    const categoryFilter = searchParams.get('category')
    const groupBy = searchParams.get('groupBy') || 'item' // item, warehouse, category

    // Get latest stock balances from stock_ledger
    let query = supabase
      .from('stock_ledger')
      .select(
        `
        item_id,
        warehouse_id,
        qty_after_trans,
        valuation_rate,
        stock_value,
        posting_date,
        posting_time,
        item:items!inner(
          id,
          item_code,
          item_name,
          category,
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

    if (categoryFilter) {
      query = query.eq('item.category', categoryFilter)
    }

    const { data: ledgerEntries, error } = await query

    if (error) {
      console.error('Error fetching stock valuation data:', error)
      return NextResponse.json({ error: 'Failed to fetch stock valuation data' }, { status: 500 })
    }

    // Get latest balance for each item-warehouse combination
    const balancesMap = new Map<string, any>()

    for (const entry of ledgerEntries || []) {
      const key = `${entry.item_id}_${entry.warehouse_id}`

      // Only keep the first (most recent) entry for each item-warehouse combination
      if (!balancesMap.has(key)) {
        balancesMap.set(key, {
          itemId: entry.item_id,
          itemCode: entry.item?.item_code,
          itemName: entry.item?.item_name,
          category: entry.item?.category,
          warehouseId: entry.warehouse_id,
          warehouseCode: entry.warehouse?.warehouse_code,
          warehouseName: entry.warehouse?.warehouse_name,
          quantity: parseFloat(entry.qty_after_trans),
          valuationRate: parseFloat(entry.valuation_rate || 0),
          stockValue: parseFloat(entry.stock_value || 0),
          uom: entry.item?.uom?.code || '',
        })
      }
    }

    // Filter out zero balances
    const stockBalances = Array.from(balancesMap.values()).filter(
      (balance) => balance.quantity > 0
    )

    // Group data based on groupBy parameter
    const valuationMap = new Map<string, any>()

    for (const balance of stockBalances) {
      let key: string
      let groupName: string

      if (groupBy === 'item') {
        key = balance.itemId
        groupName = `${balance.itemCode} - ${balance.itemName}`
      } else if (groupBy === 'warehouse') {
        key = balance.warehouseId
        groupName = `${balance.warehouseCode} - ${balance.warehouseName}`
      } else if (groupBy === 'category') {
        key = balance.category || 'Uncategorized'
        groupName = balance.category || 'Uncategorized'
      } else {
        // item-warehouse
        key = `${balance.itemId}_${balance.warehouseId}`
        groupName = `${balance.itemCode} - ${balance.itemName} @ ${balance.warehouseCode}`
      }

      if (!valuationMap.has(key)) {
        valuationMap.set(key, {
          groupKey: key,
          groupName,
          itemId: groupBy === 'item' || groupBy === 'item-warehouse' ? balance.itemId : null,
          itemCode: groupBy === 'item' || groupBy === 'item-warehouse' ? balance.itemCode : null,
          itemName: groupBy === 'item' || groupBy === 'item-warehouse' ? balance.itemName : null,
          category: balance.category,
          warehouseId:
            groupBy === 'warehouse' || groupBy === 'item-warehouse' ? balance.warehouseId : null,
          warehouseCode:
            groupBy === 'warehouse' || groupBy === 'item-warehouse'
              ? balance.warehouseCode
              : null,
          warehouseName:
            groupBy === 'warehouse' || groupBy === 'item-warehouse'
              ? balance.warehouseName
              : null,
          totalQuantity: 0,
          totalValue: 0,
          averageRate: 0,
          uom: balance.uom,
          warehouseCount: new Set<string>(),
          itemCount: new Set<string>(),
        })
      }

      const valuation = valuationMap.get(key)!
      valuation.totalQuantity += balance.quantity
      valuation.totalValue += balance.stockValue
      valuation.warehouseCount.add(balance.warehouseId)
      valuation.itemCount.add(balance.itemId)
    }

    // Calculate average rate and convert sets to counts
    const valuations = Array.from(valuationMap.values()).map((val) => ({
      ...val,
      averageRate: val.totalQuantity > 0 ? val.totalValue / val.totalQuantity : 0,
      warehouseCount: val.warehouseCount.size,
      itemCount: val.itemCount.size,
    }))

    // Sort by total value (descending)
    valuations.sort((a, b) => b.totalValue - a.totalValue)

    // Calculate summary statistics
    const summary = {
      totalStockValue: valuations.reduce((sum, v) => sum + v.totalValue, 0),
      totalQuantity: valuations.reduce((sum, v) => sum + v.totalQuantity, 0),
      itemCount: new Set(stockBalances.map((b) => b.itemId)).size,
      warehouseCount: new Set(stockBalances.map((b) => b.warehouseId)).size,
      categoryCount: new Set(stockBalances.map((b) => b.category)).size,
      averageItemValue:
        valuations.length > 0
          ? valuations.reduce((sum, v) => sum + v.totalValue, 0) / valuations.length
          : 0,
    }

    // Get top 10 most valuable items
    const topItems = [...valuations]
      .filter((v) => v.itemId) // Only items, not grouped by warehouse/category
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10)

    // Get low value items (bottom 10%)
    const lowValueThreshold = summary.averageItemValue * 0.1
    const lowValueItems = valuations.filter((v) => v.totalValue < lowValueThreshold)

    // Get category breakdown
    const categoryMap = new Map<string, { totalValue: number; itemCount: number }>()

    for (const balance of stockBalances) {
      const category = balance.category || 'Uncategorized'
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { totalValue: 0, itemCount: 0 })
      }
      const cat = categoryMap.get(category)!
      cat.totalValue += balance.stockValue
      cat.itemCount++
    }

    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        totalValue: data.totalValue,
        itemCount: data.itemCount,
        percentage: (data.totalValue / summary.totalStockValue) * 100,
      }))
      .sort((a, b) => b.totalValue - a.totalValue)

    return NextResponse.json({
      data: valuations,
      summary,
      topItems,
      lowValueItems,
      categoryBreakdown,
      filters: {
        warehouseId: warehouseId || null,
        itemId: itemId || null,
        category: categoryFilter || null,
        groupBy,
      },
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/reports/stock-valuation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
