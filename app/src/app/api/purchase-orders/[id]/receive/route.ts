import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { postAPBill } from '@/services/accounting/apPosting'

// POST /api/purchase-orders/[id]/receive
// Creates a purchase receipt from an approved purchase order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: purchaseOrderId } = await params
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

    // Get purchase order with items
    const { data: po, error: poError } = await supabase
      .from('purchase_orders')
      .select(
        `
        *,
        items:purchase_order_items(
          id,
          item_id,
          quantity,
          quantity_received,
          uom_id,
          rate
        )
      `
      )
      .eq('id', purchaseOrderId)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (poError || !po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Validate PO status
    if (po.status !== 'approved' && po.status !== 'in_transit' && po.status !== 'partially_received') {
      return NextResponse.json(
        { error: 'Only approved or in-transit purchase orders can be received' },
        { status: 400 }
      )
    }

    // Generate receipt code
    const currentYear = new Date().getFullYear()
    const { data: receipts } = await supabase
      .from('purchase_receipts')
      .select('receipt_code')
      .eq('company_id', userData.company_id)
      .like('receipt_code', `GRN-${currentYear}-%`)
      .order('receipt_code', { ascending: false })
      .limit(1)

    let nextNum = 1
    if (receipts && receipts.length > 0) {
      const match = receipts[0].receipt_code.match(/GRN-\d+-(\d+)/)
      if (match) {
        nextNum = parseInt(match[1]) + 1
      }
    }
    const receiptCode = `GRN-${currentYear}-${String(nextNum).padStart(4, '0')}`

    // Create purchase receipt
    const { data: receipt, error: receiptError } = await supabase
      .from('purchase_receipts')
      .insert({
        company_id: userData.company_id,
        receipt_code: receiptCode,
        purchase_order_id: po.id,
        supplier_id: po.supplier_id,
        warehouse_id: body.warehouseId,
        receipt_date: body.receiptDate || new Date().toISOString().split('T')[0],
        supplier_invoice_number: body.supplierInvoiceNumber || null,
        supplier_invoice_date: body.supplierInvoiceDate || null,
        status: 'received', // Auto-mark as received
        notes: body.notes || null,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (receiptError) {
      console.error('Error creating receipt:', receiptError)
      return NextResponse.json(
        { error: receiptError.message || 'Failed to create receipt' },
        { status: 500 }
      )
    }

    // Create receipt items from PO items (or from provided items if partial receive)
    const itemsToReceive = body.items || po.items.map((item: any) => ({
      purchaseOrderItemId: item.id,
      itemId: item.item_id,
      quantityOrdered: parseFloat(item.quantity),
      quantityReceived: parseFloat(item.quantity) - parseFloat(item.quantity_received || 0), // Remaining quantity
      uomId: item.uom_id,
      rate: parseFloat(item.rate),
    }))

    const receiptItems = itemsToReceive.map((item: any) => ({
      company_id: userData.company_id,
      receipt_id: receipt.id,
      purchase_order_item_id: item.purchaseOrderItemId,
      item_id: item.itemId,
      quantity_ordered: item.quantityOrdered,
      quantity_received: item.quantityReceived,
      uom_id: item.uomId,
      rate: item.rate,
      notes: item.notes,
      created_by: user.id,
      updated_by: user.id,
    }))

    const { error: itemsError } = await supabase
      .from('purchase_receipt_items')
      .insert(receiptItems)

    if (itemsError) {
      console.error('Error creating receipt items:', itemsError)
      // Rollback receipt creation
      await supabase.from('purchase_receipts').delete().eq('id', receipt.id)
      return NextResponse.json(
        { error: itemsError.message || 'Failed to create receipt items' },
        { status: 500 }
      )
    }

    // Create stock IN transaction
    // Generate stock transaction code (ST-YYYY-NNNN)
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

    // Create stock transaction header
    const { data: stockTransaction, error: stockTxError } = await supabase
      .from('stock_transactions')
      .insert({
        company_id: userData.company_id,
        transaction_code: stockTxCode,
        transaction_type: 'in',
        transaction_date: body.receiptDate || new Date().toISOString().split('T')[0],
        warehouse_id: body.warehouseId,
        reference_type: 'purchase_receipt',
        reference_id: receipt.id,
        status: 'posted',
        notes: `Goods received from PO ${po.order_code} - ${receiptCode}`,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (stockTxError) {
      console.error('Error creating stock transaction:', stockTxError)
      // Rollback receipt and items
      await supabase.from('purchase_receipt_items').delete().eq('receipt_id', receipt.id)
      await supabase.from('purchase_receipts').delete().eq('id', receipt.id)
      return NextResponse.json(
        { error: stockTxError.message || 'Failed to create stock transaction' },
        { status: 500 }
      )
    }

    // Create stock transaction items and update stock ledger
    for (const item of itemsToReceive) {
      // Create stock transaction item
      const { data: stockTxItem, error: stockTxItemError } = await supabase
        .from('stock_transaction_items')
        .insert({
          company_id: userData.company_id,
          transaction_id: stockTransaction.id,
          item_id: item.itemId,
          quantity: item.quantityReceived,
          uom_id: item.uomId,
          unit_cost: item.rate,
          total_cost: item.quantityReceived * item.rate,
          notes: `From PO ${po.order_code}`,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single()

      if (stockTxItemError) {
        console.error('Error creating stock transaction item:', stockTxItemError)
        // Continue with other items but log the error
        continue
      }

      // Get current stock balance from ledger
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

      const newBalance = currentBalance + item.quantityReceived

      // Create stock ledger entry
      await supabase.from('stock_ledger').insert({
        company_id: userData.company_id,
        transaction_id: stockTransaction.id,
        transaction_item_id: stockTxItem.id,
        item_id: item.itemId,
        warehouse_id: body.warehouseId,
        posting_date: body.receiptDate || new Date().toISOString().split('T')[0],
        posting_time: new Date().toTimeString().split(' ')[0],
        voucher_type: 'Purchase Receipt',
        voucher_no: receiptCode,
        actual_qty: item.quantityReceived, // Positive for IN
        qty_after_trans: newBalance,
        incoming_rate: item.rate,
        valuation_rate: item.rate,
        stock_value: newBalance * item.rate,
        stock_value_diff: item.quantityReceived * item.rate,
      })
    }

    // Update quantity_received in purchase_order_items
    // This will trigger the PO status update
    for (const item of itemsToReceive) {
      // First get the current quantity_received
      const { data: currentItem } = await supabase
        .from('purchase_order_items')
        .select('quantity_received')
        .eq('id', item.purchaseOrderItemId)
        .single()

      const currentQtyReceived = parseFloat(currentItem?.quantity_received || 0)
      const newQtyReceived = currentQtyReceived + item.quantityReceived

      await supabase
        .from('purchase_order_items')
        .update({
          quantity_received: newQtyReceived,
          updated_by: user.id,
        })
        .eq('id', item.purchaseOrderItemId)
    }

    // Update purchase order status based on received quantities
    // Fetch all items to check if PO is fully or partially received
    const { data: allPoItems, error: itemsFetchError } = await supabase
      .from('purchase_order_items')
      .select('quantity, quantity_received')
      .eq('purchase_order_id', purchaseOrderId)
      .is('deleted_at', null)

    console.log('Fetching PO items for status update:', {
      purchaseOrderId,
      itemsCount: allPoItems?.length,
      items: allPoItems,
      error: itemsFetchError
    })

    if (allPoItems && allPoItems.length > 0) {
      // Check if all items are fully received
      const allFullyReceived = allPoItems.every((item: any) => {
        const ordered = parseFloat(item.quantity)
        const received = parseFloat(item.quantity_received || 0)
        const isFullyReceived = received >= ordered
        console.log(`Item check: ordered=${ordered}, received=${received}, fullyReceived=${isFullyReceived}`)
        return isFullyReceived
      })

      // Check if any items are received
      const anyReceived = allPoItems.some((item: any) => {
        const received = parseFloat(item.quantity_received || 0)
        return received > 0
      })

      let newStatus: string = po.status
      if (allFullyReceived) {
        newStatus = 'received'
      } else if (anyReceived) {
        newStatus = 'partially_received'
      }

      console.log('Status calculation:', {
        currentStatus: po.status,
        allFullyReceived,
        anyReceived,
        newStatus
      })

      // Update PO status if it changed
      if (newStatus !== po.status) {
        const { error: statusUpdateError } = await supabase
          .from('purchase_orders')
          .update({
            status: newStatus,
            updated_by: user.id,
          })
          .eq('id', purchaseOrderId)

        console.log('PO status updated:', {
          purchaseOrderId,
          oldStatus: po.status,
          newStatus,
          error: statusUpdateError
        })
      } else {
        console.log('Status unchanged, no update needed')
      }
    }

    // ============================================================================
    // POST-RECEIPT PROCESSING: Accounting Integration
    // ============================================================================

    const warnings: string[] = []

    // Post AP Bill to General Ledger
    try {
      // Calculate total amount from received items
      const totalAmount = itemsToReceive.reduce(
        (sum: number, item: any) => sum + (item.quantityReceived * item.rate),
        0
      )

      const apResult = await postAPBill(
        userData.company_id,
        user.id,
        {
          purchaseReceiptId: receipt.id,
          purchaseReceiptCode: receipt.receipt_code,
          supplierId: po.supplier_id,
          receiptDate: body.receiptDate || new Date().toISOString().split('T')[0],
          totalAmount,
          description: `Purchase from PO ${po.order_code} - ${receipt.receipt_code}`,
        }
      )

      if (apResult.success) {
        console.log(`AP journal entry created: ${apResult.journalEntryId}`)
      } else {
        console.error('AP GL posting failed:', apResult.error)
        warnings.push(`GL posting failed: ${apResult.error}`)
      }
    } catch (error) {
      console.error('Error posting AP to GL:', error)
      warnings.push('GL posting failed')
    }

    return NextResponse.json(
      {
        id: receipt.id,
        receiptCode: receipt.receipt_code,
        message: 'Goods received successfully. Stock levels updated.',
        warnings: warnings.length > 0 ? warnings : undefined,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error in POST /api/purchase-orders/[id]/receive:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
