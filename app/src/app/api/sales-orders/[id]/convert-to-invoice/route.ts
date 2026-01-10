import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { postARInvoice } from '@/services/accounting/arPosting'
import { calculateCOGS, postCOGS } from '@/services/accounting/cogsPosting'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'
import { normalizeTransactionItems } from '@/services/inventory/normalizationService'
import { adjustItemLocation, ensureWarehouseDefaultLocation } from '@/services/inventory/locationService'
import type { StockTransactionItemInput } from '@/types/inventory-normalization'

// POST /api/sales-orders/[id]/convert-to-invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check permission first
    const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, 'edit')
    if (unauthorized) return unauthorized

    const { id: salesOrderId } = await params
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU()
    const body = await request.json()

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

    // Validate warehouse_id from request body
    if (!body.warehouseId) {
      return NextResponse.json(
        { error: 'Warehouse is required to create invoice and stock transactions' },
        { status: 400 }
      )
    }

    // Step 1: Fetch sales order details with items
    const { data: salesOrder, error: salesOrderError } = await supabase
      .from('sales_orders')
      .select(`
        *,
        customers:customer_id (
          id,
          customer_name,
          email,
          billing_address_line1,
          billing_address_line2,
          billing_city,
          billing_state,
          billing_country,
          billing_postal_code
        )
      `)
      .eq('id', salesOrderId)
      .is('deleted_at', null)
      .single()

    if (salesOrderError || !salesOrder) {
      return NextResponse.json(
        { error: 'Sales order not found' },
        { status: 404 }
      )
    }

    // Step 2: Validate sales order status
    if (salesOrder.status !== 'confirmed' && salesOrder.status !== 'processing') {
      return NextResponse.json(
        { error: 'Only confirmed or processing sales orders can be converted to invoices' },
        { status: 400 }
      )
    }

    // Check if already converted
    const { data: existingInvoice } = await supabase
      .from('sales_invoices')
      .select('id, invoice_code')
      .eq('sales_order_id', salesOrderId)
      .is('deleted_at', null)
      .single()

    if (existingInvoice) {
      return NextResponse.json(
        {
          error: 'This sales order has already been converted to an invoice',
          invoice: {
            id: existingInvoice.id,
            invoiceNumber: existingInvoice.invoice_code,
          }
        },
        { status: 400 }
      )
    }

    // Fetch sales order items
    const { data: salesOrderItems, error: itemsError } = await supabase
      .from('sales_order_items')
      .select('*')
      .eq('order_id', salesOrderId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })

    if (itemsError) {

      return NextResponse.json(
        { error: 'Failed to fetch sales order items' },
        { status: 500 }
      )
    }

    if (!salesOrderItems || salesOrderItems.length === 0) {
      return NextResponse.json(
        { error: 'Sales order must have at least one item' },
        { status: 400 }
      )
    }

    const itemInputs: StockTransactionItemInput[] = salesOrderItems.map((item) => ({
      itemId: item.item_id,
      packagingId: item.packaging_id || null,
      inputQty: parseFloat(item.quantity),
      unitCost: parseFloat(item.rate),
    }))

    const normalizedItems = await normalizeTransactionItems(salesOrder.company_id, itemInputs)

    // Step 3: Generate invoice number (handle both old INV-NNNNN and new INV-YYYY-NNNN formats)
    const { data: invoices } = await supabase
      .from('sales_invoices')
      .select('invoice_code')
      .eq('company_id', salesOrder.company_id)
      .order('created_at', { ascending: false })
      .limit(1)

    let invoiceNumber = 'INV-2025-0001'
    if (invoices && invoices.length > 0 && invoices[0].invoice_code) {
      const parts = invoices[0].invoice_code.split('-')
      if (parts.length === 3) {
        // New format: INV-YYYY-NNNN
        const lastNum = parseInt(parts[2])
        const nextNum = lastNum + 1
        invoiceNumber = `INV-2025-${String(nextNum).padStart(4, '0')}`
      } else if (parts.length === 2) {
        // Old format: INV-NNNNN - convert to new format starting from that number
        const lastNum = parseInt(parts[1])
        const nextNum = lastNum + 1
        invoiceNumber = `INV-2025-${String(nextNum).padStart(4, '0')}`
      }
    }

    // Step 4: Calculate due date (default: 30 days from now)
    const today = new Date()
    const dueDate = new Date(today)
    dueDate.setDate(dueDate.getDate() + 30)

    // Step 5: Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('sales_invoices')
      .insert({
        company_id: salesOrder.company_id,
        business_unit_id: currentBusinessUnitId,
        invoice_code: invoiceNumber,
        customer_id: salesOrder.customer_id,
        warehouse_id: body.warehouseId,
        custom_fields: body.locationId ? { locationId: body.locationId } : null,
        sales_order_id: salesOrderId,
        invoice_date: today.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        status: 'sent',
        subtotal: salesOrder.subtotal,
        discount_amount: salesOrder.discount_amount,
        tax_amount: salesOrder.tax_amount,
        total_amount: salesOrder.total_amount,
        amount_paid: 0,
        amount_due: salesOrder.total_amount,
        billing_address_line1: salesOrder.customers?.billing_address_line1 || '',
        billing_address_line2: salesOrder.customers?.billing_address_line2 || '',
        billing_city: salesOrder.customers?.billing_city || '',
        billing_state: salesOrder.customers?.billing_state || '',
        billing_country: salesOrder.customers?.billing_country || '',
        billing_postal_code: salesOrder.customers?.billing_postal_code || '',
        payment_terms: salesOrder.payment_terms || 'Payment due within 30 days',
        notes: salesOrder.notes || '',
        commission_total: 0,
        commission_split_count: 0,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (invoiceError) {

      return NextResponse.json(
        { error: invoiceError.message || 'Failed to create invoice' },
        { status: 500 }
      )
    }

    // Step 6: Copy sales order items to invoice items
    const invoiceItemsToInsert = salesOrderItems.map((item, index) => {
      return {
        company_id: salesOrder.company_id,
        invoice_id: invoice.id,
        item_id: item.item_id,
        item_description: item.item_description,
        quantity: parseFloat(item.quantity),
        packaging_id: item.packaging_id || null,
        uom_id: item.uom_id,
        rate: item.rate,
        discount_percent: item.discount_percent || 0,
        discount_amount: item.discount_amount || 0,
        tax_percent: item.tax_percent || 0,
        tax_amount: item.tax_amount || 0,
        line_total: item.line_total,
        sort_order: item.sort_order || index,
        created_by: user.id,
        updated_by: user.id,
      }
    })

    const { error: invoiceItemsError } = await supabase
      .from('sales_invoice_items')
      .insert(invoiceItemsToInsert)

    if (invoiceItemsError) {

      // Rollback: delete the invoice
      await supabase.from('sales_invoices').delete().eq('id', invoice.id)
      return NextResponse.json(
        { error: invoiceItemsError.message || 'Failed to create invoice items' },
        { status: 500 }
      )
    }

    // Step 7: Create stock transactions and ledger entries
    // Generate stock transaction code
    const currentYear = new Date().getFullYear()
    const { data: lastTransaction } = await supabase
      .from('stock_transactions')
      .select('transaction_code')
      .eq('company_id', salesOrder.company_id)
      .like('transaction_code', `ST-${currentYear}-%`)
      .order('transaction_code', { ascending: false })
      .limit(1)

    let nextTransactionNum = 1
    if (lastTransaction && lastTransaction.length > 0) {
      const match = lastTransaction[0].transaction_code.match(/ST-\d+-(\d+)/)
      if (match) {
        nextTransactionNum = parseInt(match[1]) + 1
      }
    }
    const transactionCode = `ST-${currentYear}-${String(nextTransactionNum).padStart(4, '0')}`

    const defaultLocationId = await ensureWarehouseDefaultLocation({
      supabase,
      companyId: salesOrder.company_id,
      warehouseId: body.warehouseId,
      userId: user.id,
    })
    const selectedLocationId = body.locationId || defaultLocationId

    // Create stock transaction header
    const { data: stockTransaction, error: transactionError } = await supabase
      .from('stock_transactions')
      .insert({
        company_id: salesOrder.company_id,
        business_unit_id: currentBusinessUnitId,
        transaction_code: transactionCode,
        transaction_type: 'out',
        transaction_date: today.toISOString().split('T')[0],
        warehouse_id: body.warehouseId,
        from_location_id: selectedLocationId,
        reference_type: 'sales_invoice',
        reference_id: invoice.id,
        reference_code: invoice.invoice_code,
        notes: `Stock deduction for invoice ${invoice.invoice_code} (from SO ${salesOrder.order_code})`,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (transactionError || !stockTransaction) {

      // Rollback: delete invoice items and invoice
      await supabase.from('sales_invoice_items').delete().eq('invoice_id', invoice.id)
      await supabase.from('sales_invoices').delete().eq('id', invoice.id)
      return NextResponse.json(
        { error: 'Failed to create stock transaction' },
        { status: 500 }
      )
    }

    // Create stock transaction items
    const transactionItemsToInsert = salesOrderItems.map((item, index) => {
      const normalizedItem = normalizedItems[index]
      const normalizedQty = normalizedItem?.normalizedQty ?? parseFloat(item.quantity)

      return {
        company_id: salesOrder.company_id,
        transaction_id: stockTransaction.id,
        item_id: item.item_id,
        quantity: normalizedQty,
        uom_id: normalizedItem?.uomId ?? item.uom_id,
        unit_cost: parseFloat(item.rate),
        total_cost: normalizedQty * parseFloat(item.rate),
        input_qty: normalizedItem?.inputQty ?? parseFloat(item.quantity),
        input_packaging_id: normalizedItem?.inputPackagingId ?? item.packaging_id ?? null,
        conversion_factor: normalizedItem?.conversionFactor ?? 1.0,
        normalized_qty: normalizedQty,
        base_package_id: normalizedItem?.basePackageId ?? null,
        created_by: user.id,
        updated_by: user.id,
      }
    })

    const { data: transactionItems, error: transactionItemsError } = await supabase
      .from('stock_transaction_items')
      .insert(transactionItemsToInsert)
      .select()

    if (transactionItemsError || !transactionItems) {

      // Rollback: delete transaction, invoice items, and invoice
      await supabase.from('stock_transactions').delete().eq('id', stockTransaction.id)
      await supabase.from('sales_invoice_items').delete().eq('invoice_id', invoice.id)
      await supabase.from('sales_invoices').delete().eq('id', invoice.id)
      return NextResponse.json(
        { error: 'Failed to create stock transaction items' },
        { status: 500 }
      )
    }

    // Update stock transaction items with before/after quantities and update item_warehouse
    const now = new Date()
    const postingDate = now.toISOString().split('T')[0]
    const postingTime = now.toTimeString().split(' ')[0]

    for (let i = 0; i < salesOrderItems.length; i++) {
      const item = salesOrderItems[i]
      const transactionItem = transactionItems[i]
      const normalizedQty = normalizedItems[i]?.normalizedQty ?? parseFloat(item.quantity)
      const rate = parseFloat(item.rate)

      // Get current stock from item_warehouse (source of truth)
      const { data: warehouseStock } = await supabase
        .from('item_warehouse')
        .select('current_stock, default_location_id')
        .eq('item_id', item.item_id)
        .eq('warehouse_id', body.warehouseId)
        .single()

      const currentBalance = warehouseStock
        ? parseFloat(String(warehouseStock.current_stock))
        : 0

      const newBalance = currentBalance - normalizedQty

      // Validate sufficient stock
      if (newBalance < 0) {

        // Rollback: delete transaction items, transaction, invoice items, and invoice
        await supabase.from('stock_transaction_items').delete().eq('transaction_id', stockTransaction.id)
        await supabase.from('stock_transactions').delete().eq('id', stockTransaction.id)
        await supabase.from('sales_invoice_items').delete().eq('invoice_id', invoice.id)
        await supabase.from('sales_invoices').delete().eq('id', invoice.id)
        return NextResponse.json(
          { error: `Insufficient stock for item. Available: ${currentBalance}, Requested: ${normalizedQty}` },
          { status: 400 }
        )
      }

      // Update stock_transaction_items with before/after quantities
      const { error: updateTxItemError } = await supabase
        .from('stock_transaction_items')
        .update({
          qty_before: currentBalance,
          qty_after: newBalance,
          valuation_rate: rate,
          stock_value_before: currentBalance * rate,
          stock_value_after: newBalance * rate,
          posting_date: postingDate,
          posting_time: postingTime,
        })
        .eq('id', transactionItem.id)

      if (updateTxItemError) {

        // Rollback
        await supabase.from('stock_transaction_items').delete().eq('transaction_id', stockTransaction.id)
        await supabase.from('stock_transactions').delete().eq('id', stockTransaction.id)
        await supabase.from('sales_invoice_items').delete().eq('invoice_id', invoice.id)
        await supabase.from('sales_invoices').delete().eq('id', invoice.id)
        return NextResponse.json(
          { error: 'Failed to update stock transaction items' },
          { status: 500 }
        )
      }

      await adjustItemLocation({
        supabase,
        companyId: salesOrder.company_id,
        itemId: item.item_id,
        warehouseId: body.warehouseId,
        locationId: selectedLocationId || warehouseStock?.default_location_id || null,
        userId: user.id,
        qtyOnHandDelta: -normalizedQty,
      })

      // Update item_warehouse current_stock
      const { error: updateWarehouseError } = await supabase
        .from('item_warehouse')
        .update({
          current_stock: newBalance,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('item_id', item.item_id)
        .eq('warehouse_id', body.warehouseId)

      if (updateWarehouseError) {

        // Rollback
        await supabase.from('stock_transaction_items').delete().eq('transaction_id', stockTransaction.id)
        await supabase.from('stock_transactions').delete().eq('id', stockTransaction.id)
        await supabase.from('sales_invoice_items').delete().eq('invoice_id', invoice.id)
        await supabase.from('sales_invoices').delete().eq('id', invoice.id)
        return NextResponse.json(
          { error: 'Failed to update warehouse inventory' },
          { status: 500 }
        )
      }
    }

    // Step 8: Update sales order status to 'invoiced'
    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({
        status: 'invoiced',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', salesOrderId)

    if (updateError) {

      // Note: We don't rollback here as the invoice is already created successfully
    }

    // Step 9: Post AR transaction to general ledger
    const arResult = await postARInvoice(salesOrder.company_id, user.id, {
      invoiceId: invoice.id,
      invoiceCode: invoice.invoice_code,
      customerId: invoice.customer_id,
      invoiceDate: invoice.invoice_date,
      totalAmount: parseFloat(invoice.total_amount),
      description: `Sales invoice ${invoice.invoice_code} (from SO ${salesOrder.order_code})`,
    })

    if (!arResult.success) {

      // Log warning but don't fail the invoice conversion

    }

    // Step 10: Calculate and post COGS to general ledger
    const cogsCalculation = await calculateCOGS(
      salesOrder.company_id,
      body.warehouseId,
      salesOrderItems.map((item, index) => ({
        itemId: item.item_id,
        quantity: normalizedItems[index]?.normalizedQty ?? parseFloat(item.quantity),
      }))
    )

    let cogsResult: { success: boolean; journalEntryId?: string; error?: string } = {
      success: true,
      journalEntryId: undefined
    }

    if (cogsCalculation.success && cogsCalculation.items && cogsCalculation.totalCOGS) {
      cogsResult = await postCOGS(salesOrder.company_id, user.id, {
        invoiceId: invoice.id,
        invoiceCode: invoice.invoice_code,
        warehouseId: body.warehouseId,
        invoiceDate: invoice.invoice_date,
        items: cogsCalculation.items,
        totalCOGS: cogsCalculation.totalCOGS,
        description: `COGS for invoice ${invoice.invoice_code} (from SO ${salesOrder.order_code})`,
      })

      if (!cogsResult.success && cogsResult.error) {

      }
    } else {

    }

    // Return success with invoice details
    return NextResponse.json({
      success: true,
      message: 'Sales order successfully converted to Invoice',
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_code,
      },
      arJournalEntryId: arResult.journalEntryId,
      arPostingSuccess: arResult.success,
      cogsJournalEntryId: cogsResult.journalEntryId,
      cogsPostingSuccess: cogsResult.success,
      cogsTotalAmount: cogsCalculation.totalCOGS,
    })
  } catch {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
