import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { postAPBill } from '@/services/accounting/apPosting'

// GET /api/purchase-receipts/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    const { data: receipt, error } = await supabase
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
          rate,
          notes
        )
      `
      )
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (error || !receipt) {
      return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })
    }

    // Format response
    const formattedReceipt = {
      id: receipt.id,
      companyId: receipt.company_id,
      receiptCode: receipt.receipt_code,
      purchaseOrderId: receipt.purchase_order_id,
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
      items: receipt.items?.map((item: any) => ({
        id: item.id,
        purchaseOrderItemId: item.purchase_order_item_id,
        itemId: item.item_id,
        item: item.item ? {
          id: item.item.id,
          code: item.item.item_code,
          name: item.item.item_name,
        } : undefined,
        quantityOrdered: parseFloat(item.quantity_ordered),
        quantityReceived: parseFloat(item.quantity_received),
        uomId: item.uom_id,
        uom: item.uom ? {
          id: item.uom.id,
          code: item.uom.code,
          name: item.uom.name,
        } : undefined,
        rate: parseFloat(item.rate),
        notes: item.notes,
      })),
      createdAt: receipt.created_at,
      createdBy: receipt.created_by,
      updatedAt: receipt.updated_at,
      updatedBy: receipt.updated_by,
      version: receipt.version,
    }

    return NextResponse.json(formattedReceipt)
  } catch (error) {
    console.error('Unexpected error in GET /api/purchase-receipts/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/purchase-receipts/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase } = await createServerClientWithBU()
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
      console.error('Error updating receipt:', updateError)
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
        const receiptItems = body.items.map((item: any) => ({
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
          console.error('Error updating receipt items:', itemsError)
          return NextResponse.json(
            { error: itemsError.message || 'Failed to update receipt items' },
            { status: 500 }
          )
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
          purchase_receipt_items(quantity_received, rate)
        `)
        .eq('id', id)
        .single()

      if (receiptData) {
        // Calculate total amount from items
        const items = receiptData.purchase_receipt_items as Array<{
          quantity_received: string
          rate: string
        }>
        const totalAmount = items.reduce((sum, item) => {
          return sum + parseFloat(item.quantity_received) * parseFloat(item.rate)
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
          console.error('Error posting AP bill to GL:', apResult.error)
          console.warn(
            `Purchase receipt ${receiptData.receipt_code} updated but AP GL posting failed: ${apResult.error}`
          )
        }
      }
    }

    return NextResponse.json({ message: 'Receipt updated successfully' })
  } catch (error) {
    console.error('Unexpected error in PUT /api/purchase-receipts/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/purchase-receipts/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
      console.error('Error deleting receipt:', deleteError)
      return NextResponse.json(
        { error: deleteError.message || 'Failed to delete receipt' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Receipt deleted successfully' })
  } catch (error) {
    console.error('Unexpected error in DELETE /api/purchase-receipts/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
