import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reorder/alerts
// Returns low stock alerts based on current stock levels and reorder levels
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

    const searchParams = request.nextUrl.searchParams
    const acknowledged = searchParams.get('acknowledged')
    const severity = searchParams.get('severity')
    const warehouseId = searchParams.get('warehouseId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Query items with stock levels below reorder point
    // We compare current_stock against reorder_level to detect low stock
    // Filter by warehouses belonging to current business unit
    let query = supabase
      .from('item_warehouse')
      .select(
        `
        id,
        item_id,
        warehouse_id,
        current_stock,
        reorder_level,
        reorder_quantity,
        max_quantity,
        items!inner (
          id,
          item_code,
          item_name
        ),
        warehouses!inner (
          id,
          warehouse_code,
          warehouse_name,
          business_unit_id
        )
      `,
        { count: 'exact' }
      )
      .eq('company_id', userData.company_id)
      .eq('warehouses.business_unit_id', currentBusinessUnitId)
      .is('deleted_at', null)
      .is('items.deleted_at', null)
      .is('warehouses.deleted_at', null)

    // Apply filters
    if (warehouseId) {
      query = query.eq('warehouse_id', warehouseId)
    }

    // Execute query
    const { data: stockLevels, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching stock levels for alerts:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('Alerts API - Stock levels fetched:', stockLevels?.length || 0)

    // Process alerts - filter by stock level and determine severity
    const alerts = (stockLevels || [])
      .map((stock: any) => {
        const currentStock = parseFloat(stock.current_stock || 0)
        const reorderLevel = parseFloat(stock.reorder_level || 0)
        const maxQuantity = parseFloat(stock.max_quantity || 0)

        // Skip items without reorder level set or with adequate stock
        if (reorderLevel <= 0 || currentStock >= reorderLevel) {
          return null
        }

        // Determine severity based on how far below reorder level
        // Critical: stock is at or below 50% of reorder level
        // Warning: stock is between 50% and 100% of reorder level
        const stockPercentage = (currentStock / reorderLevel) * 100
        let alertSeverity: 'critical' | 'warning' | 'info'
        let message: string

        if (currentStock <= 0) {
          alertSeverity = 'critical'
          message = 'Out of stock - immediate action required'
        } else if (stockPercentage <= 50) {
          alertSeverity = 'critical'
          message = `Critical low stock: ${currentStock.toFixed(2)} units remaining (${stockPercentage.toFixed(0)}% of reorder level)`
        } else {
          alertSeverity = 'warning'
          message = `Low stock: ${currentStock.toFixed(2)} units remaining (below reorder level of ${reorderLevel})`
        }

        return {
          id: stock.id,
          itemId: stock.item_id,
          itemCode: stock.items.item_code,
          itemName: stock.items.item_name,
          warehouseId: stock.warehouse_id,
          warehouseName: stock.warehouses.warehouse_name,
          currentStock: currentStock,
          reorderPoint: reorderLevel,
          minimumLevel: reorderLevel * 0.5, // Use 50% of reorder level as minimum
          maxQuantity: maxQuantity,
          severity: alertSeverity,
          message: message,
          alertType: 'low_stock',
          createdAt: new Date().toISOString(),
          acknowledged: false,
        }
      })
      .filter((alert: any) => alert !== null) // Remove nulls (items with adequate stock)

    // Apply severity filter if provided
    const filteredAlerts = severity
      ? alerts.filter((alert: any) => alert.severity === severity)
      : alerts

    console.log('Alerts API - Filtered alerts:', filteredAlerts.length, 'Total before filter:', alerts.length)

    // Note: acknowledged filter not yet implemented (would require reorder_alerts table)
    // For now, all alerts are unacknowledged

    return NextResponse.json({
      data: filteredAlerts,
      pagination: {
        page,
        limit,
        total: filteredAlerts.length,
        totalPages: Math.ceil(filteredAlerts.length / limit),
      },
    })
  } catch (error) {
    console.error('Unexpected error in GET /api/reorder/alerts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
