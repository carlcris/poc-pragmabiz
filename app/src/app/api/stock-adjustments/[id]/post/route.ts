import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/stock-adjustments/[id]/post - Post/approve stock adjustment (creates stock transaction)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Generate stock transaction code (ST-YYYY-NNNN)
    const currentYear = new Date().getFullYear()
    const { data: lastStockTx } = await supabase
      .from('stock_transactions')
      .select('transaction_code')
      .eq('company_id', userData.company_id)
      .like('transaction_code', `ST-${currentYear}-%`)
      .order('transaction_code', { ascending: false })
      .limit(1)

    let nextStockTxNum = 1
    if (lastStockTx && lastStockTx.length > 0) {
      const match = lastStockTx[0].transaction_code.match(/ST-\d+-(\d+)/)
      if (match) {
        nextStockTxNum = parseInt(match[1]) + 1
      }
    }
    const stockTxCode = `ST-${currentYear}-${String(nextStockTxNum).padStart(4, '0')}`

    // Determine transaction type based on adjustment type
    let transactionType: 'in' | 'out'
    const totalDifference = items.reduce((sum: number, item: any) => sum + parseFloat(item.difference), 0)

    if (totalDifference > 0) {
      transactionType = 'in'
    } else if (totalDifference < 0) {
      transactionType = 'out'
    } else {
      return NextResponse.json({ error: 'No net adjustment (total difference is zero)' }, { status: 400 })
    }

    // Create stock transaction
    const { data: stockTransaction, error: stockTxError } = await supabase
      .from('stock_transactions')
      .insert({
        company_id: userData.company_id,
        transaction_code: stockTxCode,
        transaction_type: transactionType,
        transaction_date: adjustment.adjustment_date,
        warehouse_id: adjustment.warehouse_id,
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
      console.error('Error creating stock transaction:', stockTxError)
      return NextResponse.json(
        { error: stockTxError.message || 'Failed to create stock transaction' },
        { status: 500 }
      )
    }

    // Create stock transaction items and update stock ledger
    for (const item of items) {
      const difference = parseFloat(item.difference)

      // Skip items with zero difference
      if (difference === 0) continue

      // Create stock transaction item
      const { data: stockTxItem, error: stockTxItemError } = await supabase
        .from('stock_transaction_items')
        .insert({
          company_id: userData.company_id,
          transaction_id: stockTransaction.id,
          item_id: item.item_id,
          quantity: Math.abs(difference),
          uom_id: item.uom_id,
          unit_cost: parseFloat(item.unit_cost),
          total_cost: Math.abs(parseFloat(item.total_cost)),
          notes: item.reason || `Adjustment: ${adjustment.adjustment_code}`,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single()

      if (stockTxItemError) {
        console.error('Error creating stock transaction item:', stockTxItemError)
        // Rollback stock transaction
        await supabase.from('stock_transactions').delete().eq('id', stockTransaction.id)
        return NextResponse.json(
          { error: 'Failed to create stock transaction items' },
          { status: 500 }
        )
      }

      // Get current stock balance
      const { data: lastLedgerEntry } = await supabase
        .from('stock_ledger')
        .select('qty_after_trans')
        .eq('company_id', userData.company_id)
        .eq('item_id', item.item_id)
        .eq('warehouse_id', adjustment.warehouse_id)
        .order('posting_date', { ascending: false })
        .order('posting_time', { ascending: false })
        .limit(1)

      const currentBalance = lastLedgerEntry && lastLedgerEntry.length > 0
        ? parseFloat(lastLedgerEntry[0].qty_after_trans)
        : 0

      const newBalance = currentBalance + difference

      // Update or create item_warehouse record
      const { data: existingStock } = await supabase
        .from('item_warehouse')
        .select('id, current_stock')
        .eq('company_id', userData.company_id)
        .eq('item_id', item.item_id)
        .eq('warehouse_id', adjustment.warehouse_id)
        .maybeSingle()

      if (existingStock) {
        // Update existing stock record
        const newStock = parseFloat(existingStock.current_stock) + difference
        await supabase
          .from('item_warehouse')
          .update({ current_stock: Math.max(0, newStock) })
          .eq('id', existingStock.id)
      } else {
        // Create new stock record
        await supabase
          .from('item_warehouse')
          .insert({
            company_id: userData.company_id,
            item_id: item.item_id,
            warehouse_id: adjustment.warehouse_id,
            current_stock: Math.max(0, difference),
          })
      }

      // Create stock ledger entry
      await supabase.from('stock_ledger').insert({
        company_id: userData.company_id,
        transaction_id: stockTransaction.id,
        transaction_item_id: stockTxItem.id,
        item_id: item.item_id,
        warehouse_id: adjustment.warehouse_id,
        posting_date: adjustment.adjustment_date,
        posting_time: new Date().toTimeString().split(' ')[0],
        voucher_type: 'Stock Adjustment',
        voucher_no: adjustment.adjustment_code,
        actual_qty: difference,
        qty_after_trans: newBalance,
        incoming_rate: difference > 0 ? parseFloat(item.unit_cost) : 0,
        valuation_rate: parseFloat(item.unit_cost),
        stock_value: newBalance * parseFloat(item.unit_cost),
        stock_value_diff: difference * parseFloat(item.unit_cost),
      })
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
      console.error('Error updating adjustment status:', updateError)
      // Rollback stock transactions
      await supabase.from('stock_transaction_items').delete().eq('transaction_id', stockTransaction.id)
      await supabase.from('stock_ledger').delete().eq('transaction_id', stockTransaction.id)
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
        totalValue: parseFloat(updatedAdjustment.total_value),
        stockTransactionId: updatedAdjustment.stock_transaction_id,
        approvedBy: updatedAdjustment.approved_by,
        approvedAt: updatedAdjustment.approved_at,
        postedBy: updatedAdjustment.posted_by,
        postedAt: updatedAdjustment.posted_at,
        createdBy: updatedAdjustment.created_by,
        updatedBy: updatedAdjustment.updated_by,
        createdAt: updatedAdjustment.created_at,
        updatedAt: updatedAdjustment.updated_at,
        items: updatedItems?.map((item: any) => ({
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
      },
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/stock-adjustments/[id]/post:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
