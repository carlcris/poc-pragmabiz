import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

type ItemWarehouseRow = {
  item_id: string
  warehouse_id: string
  current_stock: number | string | null
  item?: {
    item_code: string | null
    item_name: string | null
    category_id: string | null
    category?: {
      category_name: string | null
    } | null
    uom?: {
      code: string | null
    } | null
  } | null
  warehouse?: {
    warehouse_code: string | null
    warehouse_name: string | null
  } | null
}

type StockBalance = {
  itemId: string
  itemCode: string | null
  itemName: string | null
  categoryId: string | null
  category: string
  warehouseId: string
  warehouseCode: string | null
  warehouseName: string | null
  quantity: number
  valuationRate: number
  stockValue: number
  uom: string
}

type ValuationGroup = {
  groupKey: string
  groupName: string
  itemId: string | null
  itemCode: string | null
  itemName: string | null
  category: string
  warehouseId: string | null
  warehouseCode: string | null
  warehouseName: string | null
  totalQuantity: number
  totalValue: number
  averageRate: number
  uom: string
  warehouseCount: Set<string>
  itemCount: Set<string>
}

// GET /api/reports/stock-valuation
// Returns current stock valuation report
export async function GET(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.REPORTS, 'view')
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

    // Extract query parameters
    const warehouseId = searchParams.get('warehouseId')
    const itemId = searchParams.get('itemId')
    const categoryFilter = searchParams.get('category')
    const groupBy = searchParams.get('groupBy') || 'item' // item, warehouse, category

    // Get current stock from item_warehouse (source of truth)
    let query = supabase
      .from('item_warehouse')
      .select(
        `
        item_id,
        warehouse_id,
        current_stock,
        item:items!inner(
          id,
          item_code,
          item_name,
          category_id,
          category:item_categories(id, category_name),
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
      .is('deleted_at', null)

    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId)
    }

    if (itemId) {
      query = query.eq('item_id', itemId)
    }

    if (categoryFilter) {
      query = query.eq('item.category_id', categoryFilter)
    }

    const { data: inventoryData, error } = await query

    if (error) {

      return NextResponse.json({ error: 'Failed to fetch stock valuation data' }, { status: 500 })
    }

    // Get latest valuation rates from stock_transaction_items for each item-warehouse
    const itemWarehousePairs =
      inventoryData?.map((inv) => ({ item_id: inv.item_id, warehouse_id: inv.warehouse_id })) || []

    const valuationRates = new Map<string, number>()
    for (const pair of itemWarehousePairs) {
      const { data: latestTx } = await supabase
        .from('stock_transaction_items')
        .select('valuation_rate')
        .eq('item_id', pair.item_id)
        .order('posting_date', { ascending: false })
        .order('posting_time', { ascending: false })
        .limit(1)
        .single()

      const key = `${pair.item_id}_${pair.warehouse_id}`
      valuationRates.set(key, latestTx?.valuation_rate ? parseFloat(String(latestTx.valuation_rate)) : 0)
    }

    // Build valuation map
    const balancesMap = new Map<string, StockBalance>()

    const typedInventoryData = (inventoryData || []) as ItemWarehouseRow[]
    for (const entry of typedInventoryData) {
      const key = `${entry.item_id}_${entry.warehouse_id}`

      if (!balancesMap.has(key)) {
        const currentStock = parseFloat(String(entry.current_stock || 0))
        const valuationRate = valuationRates.get(key) || 0
        const stockValue = currentStock * valuationRate

        balancesMap.set(key, {
          itemId: entry.item_id,
          itemCode: entry.item?.item_code,
          itemName: entry.item?.item_name,
          categoryId: entry.item?.category_id,
          category: entry.item?.category?.category_name || 'Uncategorized',
          warehouseId: entry.warehouse_id,
          warehouseCode: entry.warehouse?.warehouse_code,
          warehouseName: entry.warehouse?.warehouse_name,
          quantity: currentStock,
          valuationRate: valuationRate,
          stockValue: stockValue,
          uom: entry.item?.uom?.code || '',
        })
      }
    }

    // Filter out zero balances
    const stockBalances = Array.from(balancesMap.values()).filter(
      (balance) => balance.quantity > 0
    )

    // Group data based on groupBy parameter
    const valuationMap = new Map<string, ValuationGroup>()

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
  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
