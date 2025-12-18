import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export interface ItemWithStock {
  id: string
  code: string
  name: string
  category: string
  categoryId: string
  supplier: string
  supplierId: string | null
  onHand: number
  allocated: number
  available: number
  reorderPoint: number
  onPO: number
  onSO: number
  status: 'normal' | 'low_stock' | 'out_of_stock' | 'overstock' | 'discontinued'
  uom: string
  uomId: string
  standardCost: number
  listPrice: number
  itemType: string
  isActive: boolean
  imageUrl?: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

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
    const warehouseId = searchParams.get('warehouseId')
    const supplierId = searchParams.get('supplierId')
    const stockStatus = searchParams.get('status')
    const itemType = searchParams.get('itemType')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Fetch items with categories
    let itemsQuery = supabase
      .from('items')
      .select(
        `
        *,
        item_categories (
          id,
          name
        ),
        units_of_measure (
          code
        )
      `
      )
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)

    // Apply filters
    if (search) {
      itemsQuery = itemsQuery.or(
        `item_code.ilike.%${search}%,item_name.ilike.%${search}%`
      )
    }

    // Category and supplier filtering will be done after fetching
    // since we need to work with the actual database column names

    if (itemType) {
      itemsQuery = itemsQuery.eq('item_type', itemType)
    }

    const { data: items, error: itemsError } = await itemsQuery

    if (itemsError) {
      console.error('Error fetching items:', itemsError)
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      })
    }

    const itemIds = items.map((i) => i.id)

    // Fetch supplier data separately
    const supplierIds = items
      .map((i: any) => i.supplier_id || i.supplierId)
      .filter((id): id is string => id !== null && id !== undefined)

    const suppliersMap = new Map<string, string>()

    if (supplierIds.length > 0) {
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, supplier_name')
        .eq('company_id', userData.company_id)
        .in('id', supplierIds)

      if (suppliers) {
        for (const supplier of suppliers) {
          suppliersMap.set(supplier.id, supplier.supplier_name)
        }
      }
    }

    // Get current stock levels (On Hand) and reorder levels from item_warehouse
    let stockQuery = supabase
      .from('item_warehouse')
      .select('item_id, warehouse_id, current_stock, reorder_level')
      .eq('company_id', userData.company_id)
      .in('item_id', itemIds)
      .is('deleted_at', null)

    if (warehouseId) {
      stockQuery = stockQuery.eq('warehouse_id', warehouseId)
    }

    const { data: itemWarehouseData } = await stockQuery

    // Calculate On Hand per item (sum current_stock across warehouses)
    const onHandMap = new Map<string, number>()
    const reorderPointMap = new Map<string, number>()

    if (itemWarehouseData) {
      // Sum current_stock across warehouses for each item
      for (const entry of itemWarehouseData) {
        const itemId = entry.item_id
        const currentQty = onHandMap.get(itemId) || 0
        onHandMap.set(itemId, currentQty + parseFloat(entry.current_stock))
      }
    }

    // Calculate reorder points (use max reorder level across warehouses for each item)
    if (itemWarehouseData) {
      for (const iwData of itemWarehouseData) {
        const itemId = iwData.item_id
        const reorderLevel = parseFloat(iwData.reorder_level || '0')
        const currentMax = reorderPointMap.get(itemId) || 0
        if (reorderLevel > currentMax) {
          reorderPointMap.set(itemId, reorderLevel)
        }
      }
    }

    // Get allocated quantity (from sales_order_items where order not yet delivered)
    const { data: salesOrderItems } = await supabase
      .from('sales_order_items')
      .select(
        `
        item_id,
        quantity,
        quantity_delivered,
        sales_orders!inner (
          status
        )
      `
      )
      .eq('sales_orders.company_id', userData.company_id)
      .in('item_id', itemIds)
      .in('sales_orders.status', ['draft', 'confirmed', 'in_progress', 'shipped'])

    const allocatedMap = new Map<string, number>()
    const onSOMap = new Map<string, number>()

    if (salesOrderItems) {
      for (const item of salesOrderItems) {
        const itemId = item.item_id
        const pending = parseFloat(item.quantity) - (parseFloat(item.quantity_delivered) || 0)
        const currentAllocated = allocatedMap.get(itemId) || 0
        const currentOnSO = onSOMap.get(itemId) || 0
        allocatedMap.set(itemId, currentAllocated + pending)
        onSOMap.set(itemId, currentOnSO + parseFloat(item.quantity))
      }
    }
    // Get On PO (from purchase_order_items where order not yet fully received)
    const { data: poItems } = await supabase
      .from('purchase_order_items')
      .select(
        `
        item_id,
        quantity,
        quantity_received,
        purchase_orders!inner (
          status
        )
      `
      )
      .eq('purchase_orders.company_id', userData.company_id)
      .in('item_id', itemIds)
      .in('purchase_orders.status', ['draft', 'approved', 'partially_received'])

    const onPOMap = new Map<string, number>()

    if (poItems) {
      for (const item of poItems) {
        const itemId = item.item_id
        const pending = parseFloat(item.quantity) - (parseFloat(item.quantity_received) || 0)
        const currentOnPO = onPOMap.get(itemId) || 0
        onPOMap.set(itemId, currentOnPO + pending)
      }
    }

    // Build enhanced items with stock data
    const itemsWithStock: ItemWithStock[] = items.map((item: any) => {
      const onHand = onHandMap.get(item.id) || 0
      const allocated = allocatedMap.get(item.id) || 0
      const available = onHand - allocated
      const onPO = onPOMap.get(item.id) || 0
      const onSO = onSOMap.get(item.id) || 0
      // Get reorder level from item_warehouse data (max across warehouses)
      const reorderPoint = reorderPointMap.get(item.id) || 0

      // Determine status
      let status: ItemWithStock['status'] = 'normal'
      if (!item.is_active) {
        status = 'discontinued'
      } else if (available <= 0) {
        status = 'out_of_stock'
      } else if (reorderPoint > 0 && available <= reorderPoint) {
        status = 'low_stock'
      } else if (reorderPoint > 0 && available > reorderPoint * 3) {
        status = 'overstock'
      }

      // Get category_id and supplier_id from the actual database columns
      const categoryId = (item.category_id || item.item_category_id || '') as string
      const supplierId = (item.supplier_id || '') as string
      console.log('available', item.item_name, { onHand, allocated, available, reorderPoint })
      return {
        id: item.id,
        code: item.item_code,
        name: item.item_name,
        category: item.item_categories?.name || '',
        categoryId,
        supplier: supplierId ? (suppliersMap.get(supplierId) || '') : '',
        supplierId,
        onHand,
        allocated,
        available,
        reorderPoint,
        onPO,
        onSO,
        status,
        uom: item.units_of_measure?.code || '',
        uomId: item.uom_id || '',
        standardCost: parseFloat(item.cost_price) || 0,
        listPrice: parseFloat(item.sales_price) || 0,
        itemType: item.item_type,
        isActive: item.is_active ?? true,
        imageUrl: item.image_url || undefined,
      }
    })

    // Apply filters
    let filteredItems = itemsWithStock

    // Filter by category
    if (category) {
      filteredItems = filteredItems.filter((item) => item.categoryId === category)
    }

    // Filter by supplier
    if (supplierId) {
      filteredItems = filteredItems.filter((item) => item.supplierId === supplierId)
    }

    // Filter by status
    if (stockStatus && stockStatus !== 'all') {
      filteredItems = filteredItems.filter((item) => item.status === stockStatus)
    }

    // Apply pagination
    const total = filteredItems.length
    const totalPages = Math.ceil(total / limit)
    const from = (page - 1) * limit
    const to = from + limit
    const paginatedItems = filteredItems.slice(from, to)

    return NextResponse.json({
      data: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/items-enhanced:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
