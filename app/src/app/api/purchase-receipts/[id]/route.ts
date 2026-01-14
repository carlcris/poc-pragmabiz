import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { postAPBill } from '@/services/accounting/apPosting'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'
import { normalizeTransactionItems } from '@/services/inventory/normalizationService'
import { adjustItemLocation, ensureWarehouseDefaultLocation } from '@/services/inventory/locationService'
import type { StockTransactionItemInput } from '@/types/inventory-normalization'
import type { Tables } from '@/types/supabase'

type PurchaseReceiptRow = Tables<'purchase_receipts'>
type PurchaseReceiptItemRow = Tables<'purchase_receipt_items'>
type PurchaseOrderRow = Tables<'purchase_orders'>
type PurchaseOrderItemRow = Tables<'purchase_order_items'>
type SupplierRow = Tables<'suppliers'>
type WarehouseRow = Tables<'warehouses'>
type ItemRow = Tables<'items'>
type ItemPackagingRow = Tables<'item_packaging'>
type UnitRow = Tables<'units_of_measure'>

type PurchaseReceiptItemQueryRow = PurchaseReceiptItemRow & {
  item?: Pick<ItemRow, 'id' | 'item_code' | 'item_name'> | null
  uom?: Pick<UnitRow, 'id' | 'code' | 'name'> | null
  packaging?: Pick<ItemPackagingRow, 'id' | 'pack_name' | 'qty_per_pack'> | null
}

type PurchaseReceiptQueryRow = PurchaseReceiptRow & {
  purchase_order?: Pick<PurchaseOrderRow, 'id' | 'order_code'> | null
  supplier?: Pick<SupplierRow, 'id' | 'supplier_code' | 'supplier_name'> | null
  warehouse?: Pick<WarehouseRow, 'id' | 'warehouse_code' | 'warehouse_name'> | null
  items?: PurchaseReceiptItemQueryRow[] | null
}

type PurchaseReceiptItemInput = {
  purchaseOrderItemId: string
  itemId: string
  quantityOrdered: number
  quantityReceived: number
  uomId?: string | null
  rate: number
  notes?: string | null
}

type PurchaseReceiptUpdateBody = {
  warehouseId: string
  receiptDate: string
  batchSequenceNumber?: string | null
  supplierInvoiceNumber?: string | null
  supplierInvoiceDate?: string | null
  notes?: string | null
  status?: string
  items?: PurchaseReceiptItemInput[]
}

type ReceiptItemUpdateInput = {
  purchaseOrderItemId: string
  quantityReceived: number
}

// GET /api/purchase-receipts/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check permission
    await requirePermission(RESOURCES.PURCHASE_RECEIPTS, 'view')

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

    // Fetch receipt with all related data
    const { data: receiptData, error } = await supabase
      .from('purchase_receipts')
      .select(
        `
        *,
        purchase_order:purchase_orders!purchase_receipts_purchase_order_id_fkey(id, order_code),
        supplier:suppliers!purchase_receipts_supplier_id_fkey(id, supplier_code, supplier_name),
        warehouse:warehouses!purchase_receipts_warehouse_id_fkey(id, warehouse_code, warehouse_name),
        items:purchase_receipt_items(
          id,
          purchase_order_item_id,
          item_id,
          item:items(id, item_code, item_name),
          quantity_ordered,
          quantity_received,
          uom_id,
          uom:units_of_measure(id, code, name),
          packaging_id,
          packaging:item_packaging(id, pack_name, qty_per_pack),
          rate,
          notes
        )
      `
      )
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (error || !receiptData) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }
    const receipt = receiptData as PurchaseReceiptQueryRow

    // Format response
    const formattedReceipt = {
      id: receipt.id,
      companyId: receipt.company_id,
      receiptCode: receipt.receipt_code,
      purchaseOrderId: receipt.purchase_order_id,
      batchSequenceNumber: receipt.batch_sequence_number,
      purchaseOrder: receipt.purchase_order ? {
        id: receipt.purchase_order.id,
        orderCode: receipt.purchase_order.order_code,
      } : undefined,
      supplierId: receipt.supplier_id,
      supplier: receipt.supplier ? {
        id: receipt.supplier.id,
        code: receipt.supplier.supplier_code,
        name: receipt.supplier.supplier_name,
      } : undefined,
      warehouseId: receipt.warehouse_id,
      warehouse: receipt.warehouse ? {
        id: receipt.warehouse.id,
        code: receipt.warehouse.warehouse_code,
        name: receipt.warehouse.warehouse_name,
      } : undefined,
      receiptDate: receipt.receipt_date,
      supplierInvoiceNumber: receipt.supplier_invoice_number,
      supplierInvoiceDate: receipt.supplier_invoice_date,
      status: receipt.status,
      notes: receipt.notes,
      items: receipt.items?.map((item) => ({
        id: item.id,
        purchaseOrderItemId: item.purchase_order_item_id,
        itemId: item.item_id,
        item: item.item ? {
          id: item.item.id,
          code: item.item.item_code,
          name: item.item.item_name,
        } : undefined,
        quantityOrdered: Number(item.quantity_ordered),
        quantityReceived: Number(item.quantity_received),
        uomId: item.uom_id,
        uom: item.uom ? {
          id: item.uom.id,
          code: item.uom.code,
          name: item.uom.name,
        } : undefined,
        packagingId: item.packaging_id,
        packaging: item.packaging ? {
          id: item.packaging.id,
          name: item.packaging.pack_name,
          qtyPerPack: item.packaging.qty_per_pack,
        } : undefined,
        rate: Number(item.rate),
        notes: item.notes,
      })),
      createdAt: receipt.created_at,
      createdBy: receipt.created_by,
      updatedAt: receipt.updated_at,
      updatedBy: receipt.updated_by,
      version: receipt.version,
    }

    return NextResponse.json(formattedReceipt)
  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/purchase-receipts/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check permission
    await requirePermission(RESOURCES.PURCHASE_RECEIPTS, 'edit')

    const { id } = await params
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU()
    const body = (await request.json()) as PurchaseReceiptUpdateBody

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

    // Check if receipt exists and is in draft status
    const { data: existingReceipt } = await supabase
      .from('purchase_receipts')
      .select('status, purchase_order_id')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (!existingReceipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    if (existingReceipt.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft receipts can be edited' },
        { status: 400 }
      )
    }

    // Update receipt
    const { error: updateError } = await supabase
      .from('purchase_receipts')
      .update({
        warehouse_id: body.warehouseId,
        receipt_date: body.receiptDate,
        batch_sequence_number: body.batchSequenceNumber || null,
        supplier_invoice_number: body.supplierInvoiceNumber,
        supplier_invoice_date: body.supplierInvoiceDate,
        notes: body.notes,
        status: body.status,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', userData.company_id)

    if (updateError) {

      return NextResponse.json(
        { error: updateError.message || 'Failed to update receipt' },
        { status: 500 }
      )
    }

    // Update items if provided
    if (body.items) {
      // Delete existing items
      await supabase
        .from('purchase_receipt_items')
        .delete()
        .eq('receipt_id', id)

      // Insert new items
      if (body.items.length > 0) {
        const receiptItems = body.items.map((item) => ({
          company_id: userData.company_id,
          receipt_id: id,
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

          return NextResponse.json(
            { error: itemsError.message || 'Failed to update receipt items' },
            { status: 500 }
          )
        }
      }
    }

    if (body.status === 'received' && existingReceipt.status === 'draft') {
      let itemsForUpdate: ReceiptItemUpdateInput[] = body.items || []

      if (itemsForUpdate.length === 0) {
        const { data: receiptItems } = await supabase
          .from('purchase_receipt_items')
          .select('purchase_order_item_id, quantity_received')
          .eq('receipt_id', id)

        itemsForUpdate = (receiptItems || []).map((item) => ({
          purchaseOrderItemId: item.purchase_order_item_id,
          quantityReceived: item.quantity_received,
        }))
      }

      for (const item of itemsForUpdate) {
        const { data: currentItem } = await supabase
          .from('purchase_order_items')
          .select('quantity_received')
          .eq('id', item.purchaseOrderItemId)
          .single()

        const currentQty = Number(currentItem?.quantity_received || 0)
        const newQty = currentQty + Number(item.quantityReceived || 0)

        await supabase
          .from('purchase_order_items')
          .update({
            quantity_received: newQty,
            updated_by: user.id,
          })
          .eq('id', item.purchaseOrderItemId)
      }

      if (existingReceipt.purchase_order_id) {
        const { data: poItemsData } = await supabase
          .from('purchase_order_items')
          .select('quantity, quantity_received')
          .eq('purchase_order_id', existingReceipt.purchase_order_id)
          .is('deleted_at', null)

        const poItems = (poItemsData as PurchaseOrderItemRow[] | null) || []

        if (poItems.length > 0) {
          const allFullyReceived = poItems.every((poItem) => {
            const ordered = Number(poItem.quantity)
            const received = Number(poItem.quantity_received || 0)
            return received >= ordered
          })

          const anyReceived = poItems.some((poItem) => {
            const received = Number(poItem.quantity_received || 0)
            return received > 0
          })

          let newStatus: string | null = null
          if (allFullyReceived) {
            newStatus = 'received'
          } else if (anyReceived) {
            newStatus = 'partially_received'
          }

          if (newStatus) {
            await supabase
              .from('purchase_orders')
              .update({
                status: newStatus,
                updated_by: user.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingReceipt.purchase_order_id)
          }
        }
      }
    }

    // Update inventory and create stock transaction when receipt is posted
    if (body.status === 'received' && existingReceipt.status !== 'received') {
      const { data: receiptData } = await supabase
        .from('purchase_receipts')
        .select(
          `
          id,
          receipt_code,
          warehouse_id,
          receipt_date,
          purchase_receipt_items(
            item_id,
            quantity_received,
            packaging_id,
            uom_id,
            rate
          )
        `
        )
        .eq('id', id)
        .single()

      if (receiptData?.warehouse_id) {
        const items = receiptData.purchase_receipt_items as Array<
          Pick<
            PurchaseReceiptItemRow,
            'item_id' | 'quantity_received' | 'packaging_id' | 'uom_id' | 'rate'
          >
        >

        const itemInputs: StockTransactionItemInput[] = items.map((item) => ({
          itemId: item.item_id,
          packagingId: item.packaging_id || null,
          inputQty: Number(item.quantity_received || 0),
          unitCost: Number(item.rate || 0),
        }))

        const normalizedItems = await normalizeTransactionItems(userData.company_id, itemInputs)

        const now = new Date()
        const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
        const milliseconds = now.getTime().toString().slice(-4)
        const stockTxCode = `ST-${dateStr}${milliseconds}`

        const defaultLocationId = await ensureWarehouseDefaultLocation({
          supabase,
          companyId: userData.company_id,
          warehouseId: receiptData.warehouse_id,
          userId: user.id,
        })

        const { data: stockTransaction, error: stockTxError } = await supabase
          .from('stock_transactions')
          .insert({
            company_id: userData.company_id,
            business_unit_id: currentBusinessUnitId || null,
            transaction_code: stockTxCode,
            transaction_type: 'in',
            transaction_date: receiptData.receipt_date,
            warehouse_id: receiptData.warehouse_id,
            to_location_id: defaultLocationId,
            reference_type: 'purchase_receipt',
            reference_id: receiptData.id,
            status: 'posted',
            notes: `Goods received - ${receiptData.receipt_code}`,
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

        const postingDate = receiptData.receipt_date
        const postingTime = now.toTimeString().split(' ')[0]

        for (let i = 0; i < normalizedItems.length; i++) {
          const item = normalizedItems[i]

          const { data: warehouseStock } = await supabase
            .from('item_warehouse')
            .select('current_stock, default_location_id')
            .eq('item_id', item.itemId)
            .eq('warehouse_id', receiptData.warehouse_id)
            .is('deleted_at', null)
            .single()

          const currentBalance = warehouseStock
            ? parseFloat(String(warehouseStock.current_stock))
            : 0
          const newBalance = currentBalance + item.normalizedQty

          const { error: stockTxItemError } = await supabase
            .from('stock_transaction_items')
            .insert({
              company_id: userData.company_id,
              transaction_id: stockTransaction.id,
              item_id: item.itemId,
              input_qty: item.inputQty,
              input_packaging_id: item.inputPackagingId,
              conversion_factor: item.conversionFactor,
              normalized_qty: item.normalizedQty,
              base_package_id: item.basePackageId,
              quantity: item.normalizedQty,
              uom_id: item.uomId,
              unit_cost: item.unitCost,
              total_cost: item.totalCost,
              qty_before: currentBalance,
              qty_after: newBalance,
              valuation_rate: item.unitCost,
              stock_value_before: currentBalance * item.unitCost,
              stock_value_after: newBalance * item.unitCost,
              posting_date: postingDate,
              posting_time: postingTime,
              notes: `Receipt ${receiptData.receipt_code}`,
              created_by: user.id,
              updated_by: user.id,
            })

          if (stockTxItemError) {
            continue
          }

          const resolvedLocationId = await adjustItemLocation({
            supabase,
            companyId: userData.company_id,
            itemId: item.itemId,
            warehouseId: receiptData.warehouse_id,
            locationId: defaultLocationId || warehouseStock?.default_location_id || null,
            userId: user.id,
            qtyOnHandDelta: item.normalizedQty,
          })

          if (warehouseStock) {
            await supabase
              .from('item_warehouse')
              .update({
                current_stock: newBalance,
                updated_by: user.id,
                updated_at: new Date().toISOString(),
              })
              .eq('item_id', item.itemId)
              .eq('warehouse_id', receiptData.warehouse_id)
          } else {
            await supabase
              .from('item_warehouse')
              .insert({
                company_id: userData.company_id,
                item_id: item.itemId,
                warehouse_id: receiptData.warehouse_id,
                current_stock: newBalance,
                default_location_id: resolvedLocationId,
                created_by: user.id,
                updated_by: user.id,
              })
          }
        }
      }
    }

    // Post AP transaction to general ledger if status changed to 'received'
    if (body.status === 'received' && existingReceipt.status !== 'received') {
      // Get receipt details for AP posting
      const { data: receiptData } = await supabase
        .from('purchase_receipts')
        .select(`
          id,
          receipt_code,
          supplier_id,
          receipt_date,
          purchase_receipt_items(
            quantity_received,
            rate,
            packaging:item_packaging(qty_per_pack)
          )
        `)
        .eq('id', id)
        .single()

      if (receiptData) {
        // Calculate total amount from items
        const items = receiptData.purchase_receipt_items as Array<{
          quantity_received: number
          rate: number
          packaging?: { qty_per_pack: number } | null
        }>
        const totalAmount = items.reduce((sum, item) => {
          const conversionFactor = item.packaging?.qty_per_pack ?? 1
          return sum + Number(item.quantity_received) * conversionFactor * Number(item.rate)
        }, 0)

        const apResult = await postAPBill(userData.company_id, user.id, {
          purchaseReceiptId: receiptData.id,
          purchaseReceiptCode: receiptData.receipt_code,
          supplierId: receiptData.supplier_id,
          receiptDate: receiptData.receipt_date,
          totalAmount,
          description: `Purchase receipt ${receiptData.receipt_code}`,
        })

        if (!apResult.success) {

        }
      }
    }

    return NextResponse.json({ message: 'Receipt updated successfully' })
  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/purchase-receipts/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check permission
    await requirePermission(RESOURCES.PURCHASE_RECEIPTS, 'delete')

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

    // Check if receipt exists and is in draft status
    const { data: existingReceipt } = await supabase
      .from('purchase_receipts')
      .select('status')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (!existingReceipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    if (existingReceipt.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft receipts can be deleted' },
        { status: 400 }
      )
    }

    // Soft delete (set deleted_at timestamp)
    const { error: deleteError } = await supabase
      .from('purchase_receipts')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', id)
      .eq('company_id', userData.company_id)

    if (deleteError) {

      return NextResponse.json(
        { error: deleteError.message || 'Failed to delete receipt' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Receipt deleted successfully' })
  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
