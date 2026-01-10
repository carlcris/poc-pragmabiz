import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'
import { adjustItemLocation, ensureWarehouseDefaultLocation } from '@/services/inventory/locationService'
import type { Database } from '@/types/database.types'
type DbStockAdjustmentItem = Database['public']['Tables']['stock_adjustment_items']['Row']

// POST /api/stock-adjustments/[id]/post - Post/approve stock adjustment (creates stock transaction)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require 'stock_adjustments' edit permission (posting is a form of editing)
    const unauthorized = await requirePermission(RESOURCES.STOCK_ADJUSTMENTS, 'edit')
    if (unauthorized) return unauthorized

    const { id } = await params
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

    // Fetch adjustment with items
    const { data: adjustment, error: fetchError } = await supabase
      .from('stock_adjustments')
      .select('*')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !adjustment) {
      return NextResponse.json({ error: 'Stock adjustment not found' }, { status: 404 })
    }

    // Only draft adjustments can be posted
    if (adjustment.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft adjustments can be posted' },
        { status: 400 }
      )
    }

    // Fetch adjustment items
    const { data: items } = await supabase
      .from('stock_adjustment_items')
      .select('*')
      .eq('adjustment_id', id)

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items found for this adjustment' }, { status: 400 })
    }

    // STEP 1: Use already-normalized data from stock_adjustment_items
    // The adjustment items were normalized when created, so we use that data
    const typedItems = (items || []) as DbStockAdjustmentItem[]
    const itemsWithChanges = typedItems.filter(
      (item) => parseFloat(String(item.difference ?? 0)) !== 0
    )

    if (itemsWithChanges.length === 0) {
      return NextResponse.json({ error: 'No net adjustment (all differences are zero)' }, { status: 400 })
    }

    // Calculate total normalized difference to determine transaction type
    // The difference is already in normalized (base) units
    const totalNormalizedDifference = itemsWithChanges.reduce((sum, item) => {
      return sum + parseFloat(String(item.difference ?? 0))
    }, 0)

    // Determine transaction type based on total normalized difference
    let transactionType: 'in' | 'out'
    if (totalNormalizedDifference > 0) {
      transactionType = 'in'
    } else if (totalNormalizedDifference < 0) {
      transactionType = 'out'
    } else {
      return NextResponse.json({ error: 'No net adjustment (total difference is zero)' }, { status: 400 })
    }

    // Generate stock transaction code with timestamp to avoid duplicates
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
    const milliseconds = now.getTime().toString().slice(-4)
    const stockTxCode = `ST-${dateStr}${milliseconds}`

    const defaultLocationId = await ensureWarehouseDefaultLocation({
      supabase,
      companyId: userData.company_id,
      warehouseId: adjustment.warehouse_id,
      userId: user.id,
    })

    const selectedLocationId = adjustment.custom_fields?.locationId || defaultLocationId
    const fromLocationId = transactionType === 'out' ? selectedLocationId : null
    const toLocationId = transactionType === 'in' ? selectedLocationId : null

    // Create stock transaction
    const { data: stockTransaction, error: stockTxError } = await supabase
      .from('stock_transactions')
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        transaction_code: stockTxCode,
        transaction_type: transactionType,
        transaction_date: adjustment.adjustment_date,
        warehouse_id: adjustment.warehouse_id,
        from_location_id: fromLocationId,
        to_location_id: toLocationId,
        reference_type: 'stock_adjustment',
        reference_id: adjustment.id,
        status: 'posted',
        notes: `Stock adjustment: ${adjustment.adjustment_code} - ${adjustment.reason}`,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (stockTxError) {

      return NextResponse.json(
        { error: stockTxError.message || 'Failed to create stock transaction' },
        { status: 500 }
      )
    }

    // STEP 3: Create stock transaction items with normalization metadata and update inventory
    const postingDate = adjustment.adjustment_date
    const postingTime = now.toTimeString().split(' ')[0]

    for (const item of typedItems) {
      const normalizedDifference = parseFloat(String(item.difference ?? 0))

      // Skip items with zero difference
      if (normalizedDifference === 0) continue

      // Get current stock from item_warehouse (source of truth)
      const { data: existingStock } = await supabase
        .from('item_warehouse')
        .select('id, current_stock, default_location_id')
        .eq('company_id', userData.company_id)
        .eq('item_id', item.item_id)
        .eq('warehouse_id', adjustment.warehouse_id)
        .is('deleted_at', null)
        .maybeSingle()

      const currentBalance = existingStock
        ? parseFloat(String(existingStock.current_stock))
        : 0

      const newBalance = currentBalance + normalizedDifference

      // Create stock transaction item with normalization metadata from adjustment item
      const { error: stockTxItemError } = await supabase
        .from('stock_transaction_items')
        .insert({
          company_id: userData.company_id,
          transaction_id: stockTransaction.id,
          item_id: item.item_id,
          // Normalization fields (copied from stock_adjustment_items, with fallbacks)
          input_qty: item.input_qty || Math.abs(normalizedDifference),
          input_packaging_id: item.input_packaging_id || null,
          conversion_factor: item.conversion_factor || 1.0,
          normalized_qty: item.normalized_qty || Math.abs(normalizedDifference),
          base_package_id: item.base_package_id || null,
          // Standard fields
          quantity: Math.abs(normalizedDifference), // Backward compat
          uom_id: item.uom_id,
          unit_cost: parseFloat(String(item.unit_cost ?? 0)),
          total_cost: Math.abs(normalizedDifference) * parseFloat(String(item.unit_cost ?? 0)),
          // Audit fields
          qty_before: currentBalance,
          qty_after: newBalance,
          valuation_rate: parseFloat(String(item.unit_cost ?? 0)),
          stock_value_before: currentBalance * parseFloat(String(item.unit_cost ?? 0)),
          stock_value_after: newBalance * parseFloat(String(item.unit_cost ?? 0)),
          posting_date: postingDate,
          posting_time: postingTime,
          notes: item.reason || `Adjustment: ${adjustment.adjustment_code}`,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single()

      if (stockTxItemError) {
        // Rollback stock transaction
        await supabase.from('stock_transactions').delete().eq('id', stockTransaction.id)
        return NextResponse.json(
          { error: 'Failed to create stock transaction items' },
          { status: 500 }
        )
      }

      const resolvedLocationId = await adjustItemLocation({
        supabase,
        companyId: userData.company_id,
        itemId: item.item_id,
        warehouseId: adjustment.warehouse_id,
        locationId: selectedLocationId || existingStock?.default_location_id || null,
        userId: user.id,
        qtyOnHandDelta: normalizedDifference,
      })

      // STEP 4: Update item_warehouse with normalized difference (base units)
      if (existingStock) {
        // Update existing stock record
        await supabase
          .from('item_warehouse')
          .update({
            current_stock: Math.max(0, newBalance),
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingStock.id)
      } else {
        // Create new stock record
        await supabase.from('item_warehouse').insert({
          company_id: userData.company_id,
          item_id: item.item_id,
          warehouse_id: adjustment.warehouse_id,
          current_stock: Math.max(0, newBalance),
          default_location_id: resolvedLocationId,
          created_by: user.id,
          updated_by: user.id,
        })
      }
    }

    // Update adjustment status to posted
    const { error: updateError } = await supabase
      .from('stock_adjustments')
      .update({
        status: 'posted',
        stock_transaction_id: stockTransaction.id,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        posted_by: user.id,
        posted_at: new Date().toISOString(),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {

      // Rollback stock transactions
      await supabase.from('stock_transaction_items').delete().eq('transaction_id', stockTransaction.id)
      await supabase.from('stock_transactions').delete().eq('id', stockTransaction.id)
      return NextResponse.json({ error: 'Failed to update adjustment status' }, { status: 500 })
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

    return NextResponse.json({
      success: true,
      message: 'Stock adjustment posted successfully. Stock levels updated.',
      stockTransactionCode: stockTxCode,
      adjustment: {
        id: updatedAdjustment.id,
        companyId: updatedAdjustment.company_id,
        adjustmentCode: updatedAdjustment.adjustment_code,
        adjustmentType: updatedAdjustment.adjustment_type,
        adjustmentDate: updatedAdjustment.adjustment_date,
        warehouseId: updatedAdjustment.warehouse_id,
        status: updatedAdjustment.status,
        reason: updatedAdjustment.reason,
        notes: updatedAdjustment.notes,
        totalValue: parseFloat(String(updatedAdjustment.total_value ?? 0)),
        stockTransactionId: updatedAdjustment.stock_transaction_id,
        approvedBy: updatedAdjustment.approved_by,
        approvedAt: updatedAdjustment.approved_at,
        postedBy: updatedAdjustment.posted_by,
        postedAt: updatedAdjustment.posted_at,
        createdBy: updatedAdjustment.created_by,
        updatedBy: updatedAdjustment.updated_by,
        createdAt: updatedAdjustment.created_at,
        updatedAt: updatedAdjustment.updated_at,
        items:
          (updatedItems as DbStockAdjustmentItem[] | null)?.map((item) => ({
            id: item.id,
            adjustmentId: item.adjustment_id,
            itemId: item.item_id,
            itemCode: item.item_code,
            itemName: item.item_name,
            currentQty: parseFloat(String(item.current_qty ?? 0)),
            adjustedQty: parseFloat(String(item.adjusted_qty ?? 0)),
            difference: parseFloat(String(item.difference ?? 0)),
            unitCost: parseFloat(String(item.unit_cost ?? 0)),
            totalCost: parseFloat(String(item.total_cost ?? 0)),
            uomId: item.uom_id,
            uomName: item.uom_name,
            reason: item.reason,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
          })) || [],
      },
    })
  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
