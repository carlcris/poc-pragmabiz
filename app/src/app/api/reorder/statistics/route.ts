import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reorder/statistics
// Returns summary statistics for reorder management
export async function GET(request: NextRequest) {
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

    // Get all stock levels for the current business unit
    // Filter by warehouses belonging to current business unit
    const { data: stockLevels, error: stockError } = await supabase
      .from('item_warehouse')
      .select(`
        current_stock,
        reorder_level,
        reorder_quantity,
        items!inner(purchase_price),
        warehouses!inner(id, business_unit_id)
      `)
      .eq('company_id', userData.company_id)
      .eq('warehouses.business_unit_id', currentBusinessUnitId)
      .is('deleted_at', null)
      .is('items.deleted_at', null)
      .is('warehouses.deleted_at', null)

    if (stockError) {
      console.error('Error fetching stock levels:', stockError)
      return NextResponse.json({ error: stockError.message }, { status: 500 })
    }

    // Calculate statistics
    let itemsOk = 0
    let itemsLowStock = 0
    let itemsCritical = 0
    let totalEstimatedReorderCost = 0

    stockLevels?.forEach((stock: any) => {
      const currentStock = parseFloat(stock.current_stock || 0)
      const reorderLevel = parseFloat(stock.reorder_level || 0)
      const reorderQuantity = parseFloat(stock.reorder_quantity || 0)
      const purchasePrice = parseFloat(stock.items?.purchase_price || 0)

      // Skip items without reorder level set
      if (reorderLevel <= 0) {
        return
      }

      const stockPercentage = (currentStock / reorderLevel) * 100

      if (currentStock <= 0 || stockPercentage <= 50) {
        // Critical: out of stock or <= 50% of reorder level
        itemsCritical++
        totalEstimatedReorderCost += reorderQuantity * purchasePrice
      } else if (currentStock < reorderLevel) {
        // Low stock: between 50% and 100% of reorder level
        itemsLowStock++
        totalEstimatedReorderCost += reorderQuantity * purchasePrice
      } else {
        // OK: at or above reorder level
        itemsOk++
      }
    })

    return NextResponse.json({
      itemsOk,
      itemsLowStock,
      itemsCritical,
      pendingSuggestions: 0, // Not yet implemented (requires reorder_suggestions table)
      totalEstimatedReorderCost,
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/reorder/statistics:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
