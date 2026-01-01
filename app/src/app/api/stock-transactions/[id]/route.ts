import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

// GET /api/stock-transactions/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require 'stock_transactions' view permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSACTIONS, 'view')
    if (unauthorized) return unauthorized

    const { id } = await params
    const { supabase } = await createServerClientWithBU()

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

    // Get transaction with items
    const { data: transaction, error: txError } = await supabase
      .from('stock_transactions')
      .select(
        `
        *,
        items:stock_transaction_items(
          id,
          item_id,
          item:items(id, item_code, item_name, uom:units_of_measure(id, code, name)),
          quantity,
          uom_id,
          unit_cost,
          total_cost,
          qty_before,
          qty_after,
          valuation_rate,
          stock_value_before,
          stock_value_after,
          posting_date,
          posting_time,
          batch_no,
          serial_no,
          expiry_date,
          notes
        ),
        warehouse:warehouses!stock_transactions_warehouse_id_fkey(id, warehouse_code, warehouse_name),
        toWarehouse:warehouses!stock_transactions_to_warehouse_id_fkey(id, warehouse_code, warehouse_name),
        creator:users!stock_transactions_created_by_fkey(id, first_name, last_name)
      `
      )
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (txError || !transaction) {
      return NextResponse.json({ error: 'Stock transaction not found' }, { status: 404 })
    }

    // Format response
    const formattedTransaction = {
      id: transaction.id,
      transactionCode: transaction.transaction_code,
      transactionType: transaction.transaction_type,
      transactionDate: transaction.transaction_date,
      warehouseId: transaction.warehouse_id,
      warehouseCode: transaction.warehouse?.warehouse_code,
      warehouseName: transaction.warehouse?.warehouse_name,
      toWarehouseId: transaction.to_warehouse_id,
      toWarehouseCode: transaction.toWarehouse?.warehouse_code,
      toWarehouseName: transaction.toWarehouse?.warehouse_name,
      referenceType: transaction.reference_type,
      referenceId: transaction.reference_id,
      status: transaction.status,
      notes: transaction.notes,
      items: transaction.items?.map((item: any) => ({
        id: item.id,
        itemId: item.item_id,
        itemCode: item.item.item_code,
        itemName: item.item.item_name,
        quantity: parseFloat(item.quantity),
        uomId: item.uom_id,
        uom: item.item.uom?.code || '',
        unitCost: item.unit_cost ? parseFloat(item.unit_cost) : 0,
        totalCost: item.total_cost ? parseFloat(item.total_cost) : 0,
        qtyBefore: item.qty_before ? parseFloat(item.qty_before) : null,
        qtyAfter: item.qty_after ? parseFloat(item.qty_after) : null,
        valuationRate: item.valuation_rate ? parseFloat(item.valuation_rate) : null,
        stockValueBefore: item.stock_value_before ? parseFloat(item.stock_value_before) : null,
        stockValueAfter: item.stock_value_after ? parseFloat(item.stock_value_after) : null,
        postingDate: item.posting_date,
        postingTime: item.posting_time,
        batchNo: item.batch_no,
        serialNo: item.serial_no,
        expiryDate: item.expiry_date,
        notes: item.notes,
      })),
      createdBy: transaction.created_by,
      createdByName: transaction.creator ? `${transaction.creator.first_name || ''} ${transaction.creator.last_name || ''}`.trim() || 'Unknown' : 'Unknown',
      createdAt: transaction.created_at,
      updatedAt: transaction.updated_at,
    }

    return NextResponse.json(formattedTransaction)
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/stock-transactions/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require 'stock_transactions' delete permission
    const unauthorized = await requirePermission(RESOURCES.STOCK_TRANSACTIONS, 'delete')
    if (unauthorized) return unauthorized

    const { id } = await params
    const { supabase } = await createServerClientWithBU()

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

    // Get transaction to check status
    const { data: transaction } = await supabase
      .from('stock_transactions')
      .select('status, company_id')
      .eq('id', id)
      .single()

    if (!transaction) {
      return NextResponse.json({ error: 'Stock transaction not found' }, { status: 404 })
    }

    if (transaction.company_id !== userData.company_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Only allow deleting draft transactions
    if (transaction.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft transactions can be deleted' },
        { status: 400 }
      )
    }

    // Soft delete
    const { error } = await supabase
      .from('stock_transactions')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', id)

    if (error) {

      return NextResponse.json({ error: 'Failed to delete stock transaction' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Stock transaction deleted successfully' })
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
