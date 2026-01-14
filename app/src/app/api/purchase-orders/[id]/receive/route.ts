import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { postAPBill } from '@/services/accounting/apPosting'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'
import { normalizeTransactionItems } from '@/services/inventory/normalizationService'
import { adjustItemLocation, ensureWarehouseDefaultLocation } from '@/services/inventory/locationService'
import type { StockTransactionItemInput } from '@/types/inventory-normalization'
import type { Tables } from '@/types/supabase'

type PurchaseOrderRow = Tables<'purchase_orders'>
type PurchaseOrderItemRow = Tables<'purchase_order_items'>

type PurchaseOrderQueryRow = PurchaseOrderRow & {
  items: PurchaseOrderItemRow[]
}

type PurchaseOrderReceiptItemInput = {
  purchaseOrderItemId: string
  itemId: string
  quantityOrdered: number
  quantityReceived: number
  packagingId?: string | null
  uomId?: string | null
  rate: number
  notes?: string | null
}

type PurchaseOrderReceiveBody = {
  warehouseId: string
  receiptDate?: string
  batchSequenceNumber?: string | null
  supplierInvoiceNumber?: string | null
  supplierInvoiceDate?: string | null
  notes?: string | null
  items?: PurchaseOrderReceiptItemInput[]
  locationId?: string | null
}

// POST /api/purchase-orders/[id]/receive
// Creates a purchase receipt from an approved purchase order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.PURCHASE_ORDERS, 'edit')
    const { id: purchaseOrderId } = await params
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU()
    const body = (await request.json()) as PurchaseOrderReceiveBody

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!currentBusinessUnitId) {
      return NextResponse.json(
        { error: 'Business unit context required' },
        { status: 400 }
      )
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
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .select(
        `
        *,
        items:purchase_order_items(
          id,
          item_id,
          quantity,
          quantity_received,
          packaging_id,
          uom_id,
          rate
        )
      `
      )
      .eq('id', purchaseOrderId)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (poError || !poData) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }
    const po = poData as PurchaseOrderQueryRow

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
        business_unit_id: currentBusinessUnitId,
        receipt_code: receiptCode,
        purchase_order_id: po.id,
        supplier_id: po.supplier_id,
        warehouse_id: body.warehouseId,
        receipt_date: body.receiptDate || new Date().toISOString().split('T')[0],
        batch_sequence_number: body.batchSequenceNumber || null,
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

      return NextResponse.json(
        { error: receiptError.message || 'Failed to create receipt' },
        { status: 500 }
      )
    }

    // Create receipt items from PO items (or from provided items if partial receive)
    const itemsToReceive: PurchaseOrderReceiptItemInput[] = body.items ?? po.items.map((item) => ({
      purchaseOrderItemId: item.id,
      itemId: item.item_id,
      quantityOrdered: Number(item.quantity),
      quantityReceived: Number(item.quantity) - Number(item.quantity_received || 0), // Remaining quantity
      packagingId: item.packaging_id || null, // Package selected by user (null = use base package)
      uomId: item.uom_id, // Deprecated: kept for backward compatibility
      rate: Number(item.rate),
    }))

    // STEP 1: Normalize all item quantities from packages to base units
    const itemInputs: StockTransactionItemInput[] = itemsToReceive.map((item) => ({
      itemId: item.itemId,
      packagingId: item.packagingId || null, // null = use base package
      inputQty: item.quantityReceived,
      unitCost: item.rate,
    }))

    const normalizedItems = await normalizeTransactionItems(userData.company_id, itemInputs)

    const receiptItems = itemsToReceive.map((item, index: number) => ({
      company_id: userData.company_id,
      receipt_id: receipt.id,
      purchase_order_item_id: item.purchaseOrderItemId,
      item_id: item.itemId,
      quantity_ordered: item.quantityOrdered,
      quantity_received: item.quantityReceived,
      packaging_id: normalizedItems[index]?.inputPackagingId || item.packagingId || null,
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

      // Rollback receipt creation
      await supabase.from('purchase_receipts').delete().eq('id', receipt.id)
      return NextResponse.json(
        { error: itemsError.message || 'Failed to create receipt items' },
        { status: 500 }
      )
    }

    // STEP 2: Create stock IN transaction
    // Generate stock transaction code with timestamp to avoid duplicates
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
    const milliseconds = now.getTime().toString().slice(-4)
    const stockTxCode = `ST-${dateStr}${milliseconds}`

    const defaultLocationId = body.locationId
      ? body.locationId
      : await ensureWarehouseDefaultLocation({
          supabase,
          companyId: userData.company_id,
          warehouseId: body.warehouseId,
          userId: user.id,
        })

    // Create stock transaction header
    const { data: stockTransaction, error: stockTxError } = await supabase
      .from('stock_transactions')
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        transaction_code: stockTxCode,
        transaction_type: 'in',
        transaction_date: body.receiptDate || new Date().toISOString().split('T')[0],
        warehouse_id: body.warehouseId,
        to_location_id: defaultLocationId,
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
      // Rollback receipt and items
      await supabase.from('purchase_receipt_items').delete().eq('receipt_id', receipt.id)
      await supabase.from('purchase_receipts').delete().eq('id', receipt.id)
      return NextResponse.json(
        { error: stockTxError.message || 'Failed to create stock transaction' },
        { status: 500 }
      )
    }

    // STEP 3: Create stock transaction items with normalization metadata and update inventory
    const postingDate = body.receiptDate || new Date().toISOString().split('T')[0]
    const postingTime = now.toTimeString().split(' ')[0]

    for (let i = 0; i < normalizedItems.length; i++) {
      const item = normalizedItems[i]
      // Get current stock balance from item_warehouse (source of truth)
      const { data: warehouseStock } = await supabase
        .from('item_warehouse')
        .select('current_stock, default_location_id')
        .eq('item_id', item.itemId)
        .eq('warehouse_id', body.warehouseId)
        .is('deleted_at', null)
        .single()

      const currentBalance = warehouseStock
        ? parseFloat(String(warehouseStock.current_stock))
        : 0

      const newBalance = currentBalance + item.normalizedQty

      // Create stock transaction item with full normalization metadata
      const { error: stockTxItemError } = await supabase
        .from('stock_transaction_items')
        .insert({
          company_id: userData.company_id,
          transaction_id: stockTransaction.id,
          item_id: item.itemId,
          // Normalization fields (NEW)
          input_qty: item.inputQty,
          input_packaging_id: item.inputPackagingId,
          conversion_factor: item.conversionFactor,
          normalized_qty: item.normalizedQty,
          base_package_id: item.basePackageId,
          // Standard fields
          quantity: item.normalizedQty, // Backward compat
          uom_id: item.uomId,
          unit_cost: item.unitCost,
          total_cost: item.totalCost,
          // Audit fields
          qty_before: currentBalance,
          qty_after: newBalance,
          valuation_rate: item.unitCost,
          stock_value_before: currentBalance * item.unitCost,
          stock_value_after: newBalance * item.unitCost,
          posting_date: postingDate,
          posting_time: postingTime,
          notes: `From PO ${po.order_code}`,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single()

      if (stockTxItemError) {
        // Continue with other items but log the error
        continue
      }

      const resolvedLocationId = await adjustItemLocation({
        supabase,
        companyId: userData.company_id,
        itemId: item.itemId,
        warehouseId: body.warehouseId,
        locationId: body.locationId || warehouseStock?.default_location_id || null,
        userId: user.id,
        qtyOnHandDelta: item.normalizedQty,
      })

      // STEP 4: Update item_warehouse with normalized quantity (base units)
      if (warehouseStock) {
        // Update existing record
        await supabase
          .from('item_warehouse')
          .update({
            current_stock: newBalance,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          })
          .eq('item_id', item.itemId)
          .eq('warehouse_id', body.warehouseId)
      } else {
        // Create new item_warehouse record if doesn't exist
        await supabase.from('item_warehouse').insert({
          company_id: userData.company_id,
          item_id: item.itemId,
          warehouse_id: body.warehouseId,
          current_stock: newBalance,
          default_location_id: resolvedLocationId,
          created_by: user.id,
          updated_by: user.id,
        })
      }
    }

    // Update quantity_received in purchase_order_items using input units
    // Keep track of updated quantities for status calculation
    const updatedItems: Array<{ id: string; newQtyReceived: number }> = []

    for (let i = 0; i < itemsToReceive.length; i++) {
      const originalItem = itemsToReceive[i]
      // First get the current quantity_received
      const { data: currentItem } = await supabase
        .from('purchase_order_items')
        .select('quantity_received')
        .eq('id', originalItem.purchaseOrderItemId)
        .single()

      const currentQtyReceived = Number(currentItem?.quantity_received || 0)
      const newQtyReceived = currentQtyReceived + Number(originalItem.quantityReceived || 0)

      await supabase
        .from('purchase_order_items')
        .update({
          quantity_received: newQtyReceived,
          updated_by: user.id,
        })
        .eq('id', originalItem.purchaseOrderItemId)

      // Track the updated item
      updatedItems.push({
        id: originalItem.purchaseOrderItemId,
        newQtyReceived
      })
    }

    // Update purchase order status based on received quantities
    // Use the original PO items data and apply our updates
    const warnings: string[] = []

    const allPoItems = po.items.map((item) => {
      const update = updatedItems.find(u => u.id === item.id)
      return {
        quantity: item.quantity,
        quantity_received: update ? update.newQtyReceived : Number(item.quantity_received || 0)
      }
    })

    if (allPoItems && allPoItems.length > 0) {
      // Check if all items are fully received
      const allFullyReceived = allPoItems.every((item) => {
        const ordered = Number(item.quantity)
        const received = Number(item.quantity_received || 0)
        const isFullyReceived = received >= ordered
        return isFullyReceived
      })

      // Check if any items are received
      const anyReceived = allPoItems.some((item) => {
        const received = Number(item.quantity_received || 0)
        return received > 0
      })

      let newStatus: string = po.status
      if (allFullyReceived) {
        newStatus = 'received'
      } else if (anyReceived) {
        newStatus = 'partially_received'
      }

      // Update PO status if it changed
      if (newStatus !== po.status) {
        const { error: statusUpdateError } = await supabase
          .from('purchase_orders')
          .update({
            status: newStatus,
            updated_by: user.id,
          })
          .eq('id', purchaseOrderId)

        if (statusUpdateError) {
          console.error('Failed to update PO status:', statusUpdateError)
          warnings.push(`Failed to update purchase order status: ${statusUpdateError.message}`)
        }
      }
    }

    // ============================================================================
    // POST-RECEIPT PROCESSING: Accounting Integration
    // ============================================================================

    // Post AP Bill to General Ledger
    try {
      // Calculate total amount from normalized items (actual cost based on base units)
      const totalAmount = normalizedItems.reduce(
        (sum: number, item) => sum + item.totalCost,
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
      } else {

        warnings.push(`GL posting failed: ${apResult.error}`)
      }
    } catch {

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
  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
