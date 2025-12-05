import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { postARInvoice } from '@/services/accounting/arPosting'
import { calculateCOGS, postCOGS } from '@/services/accounting/cogsPosting'

// POST /api/sales-orders/[id]/convert-to-invoice
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: salesOrderId } = await params
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
      console.error('Error fetching sales order items:', itemsError)
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
        invoice_code: invoiceNumber,
        customer_id: salesOrder.customer_id,
        warehouse_id: body.warehouseId,
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
      console.error('Error creating invoice:', invoiceError)
      return NextResponse.json(
        { error: invoiceError.message || 'Failed to create invoice' },
        { status: 500 }
      )
    }

    // Step 6: Copy sales order items to invoice items
    const invoiceItemsToInsert = salesOrderItems.map((item, index) => ({
      company_id: salesOrder.company_id,
      invoice_id: invoice.id,
      item_id: item.item_id,
      item_description: item.item_description,
      quantity: item.quantity,
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
    }))

    const { error: invoiceItemsError } = await supabase
      .from('sales_invoice_items')
      .insert(invoiceItemsToInsert)

    if (invoiceItemsError) {
      console.error('Error creating invoice items:', invoiceItemsError)
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

    // Create stock transaction header
    const { data: stockTransaction, error: transactionError } = await supabase
      .from('stock_transactions')
      .insert({
        company_id: salesOrder.company_id,
        transaction_code: transactionCode,
        transaction_type: 'out',
        transaction_date: today.toISOString().split('T')[0],
        warehouse_id: body.warehouseId,
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
      console.error('Error creating stock transaction:', transactionError)
      // Rollback: delete invoice items and invoice
      await supabase.from('sales_invoice_items').delete().eq('invoice_id', invoice.id)
      await supabase.from('sales_invoices').delete().eq('id', invoice.id)
      return NextResponse.json(
        { error: 'Failed to create stock transaction' },
        { status: 500 }
      )
    }

    // Create stock transaction items
    const transactionItemsToInsert = salesOrderItems.map((item) => ({
      company_id: salesOrder.company_id,
      transaction_id: stockTransaction.id,
      item_id: item.item_id,
      quantity: parseFloat(item.quantity),
      uom_id: item.uom_id,
      unit_cost: parseFloat(item.rate),
      total_cost: parseFloat(item.quantity) * parseFloat(item.rate),
      created_by: user.id,
      updated_by: user.id,
    }))

    const { data: transactionItems, error: transactionItemsError } = await supabase
      .from('stock_transaction_items')
      .insert(transactionItemsToInsert)
      .select()

    if (transactionItemsError || !transactionItems) {
      console.error('Error creating stock transaction items:', transactionItemsError)
      // Rollback: delete transaction, invoice items, and invoice
      await supabase.from('stock_transactions').delete().eq('id', stockTransaction.id)
      await supabase.from('sales_invoice_items').delete().eq('invoice_id', invoice.id)
      await supabase.from('sales_invoices').delete().eq('id', invoice.id)
      return NextResponse.json(
        { error: 'Failed to create stock transaction items' },
        { status: 500 }
      )
    }

    // Get current stock levels for each item
    const itemIds = salesOrderItems.map((item) => item.item_id)
    const stockBalances = new Map<string, number>()

    for (const itemId of itemIds) {
      const { data: latestLedger } = await supabase
        .from('stock_ledger')
        .select('qty_after_trans')
        .eq('company_id', salesOrder.company_id)
        .eq('item_id', itemId)
        .eq('warehouse_id', body.warehouseId)
        .order('posting_date', { ascending: false })
        .order('posting_time', { ascending: false })
        .limit(1)
        .single()

      stockBalances.set(itemId, latestLedger ? parseFloat(latestLedger.qty_after_trans) : 0)
    }

    // Create stock ledger entries for each item
    const now = new Date()
    const postingDate = now.toISOString().split('T')[0]
    const postingTime = now.toTimeString().split(' ')[0]

    const ledgerEntries = salesOrderItems.map((item, index) => {
      const currentBalance = stockBalances.get(item.item_id) || 0
      const quantity = parseFloat(item.quantity)
      const newBalance = currentBalance - quantity
      const transactionItem = transactionItems[index]

      return {
        company_id: salesOrder.company_id,
        item_id: item.item_id,
        warehouse_id: body.warehouseId,
        transaction_id: stockTransaction.id,
        transaction_item_id: transactionItem.id,
        posting_date: postingDate,
        posting_time: postingTime,
        voucher_type: 'Sales Invoice',
        voucher_no: invoice.invoice_code,
        actual_qty: -quantity, // Negative for outgoing stock
        qty_after_trans: newBalance,
        incoming_rate: null,
        valuation_rate: parseFloat(item.rate),
        stock_value: newBalance * parseFloat(item.rate),
        stock_value_diff: -quantity * parseFloat(item.rate),
        transaction_type: 'sales',
        qty_change: -quantity,
        uom_id: item.uom_id,
        rate: parseFloat(item.rate),
        value_change: -quantity * parseFloat(item.rate),
        reference_type: 'sales_invoice',
        reference_id: invoice.id,
        reference_code: invoice.invoice_code,
      }
    })

    const { error: ledgerError } = await supabase
      .from('stock_ledger')
      .insert(ledgerEntries)

    if (ledgerError) {
      console.error('Error creating stock ledger entries:', ledgerError)
      // Rollback: delete transaction items, transaction, invoice items, and invoice
      await supabase.from('stock_transaction_items').delete().eq('transaction_id', stockTransaction.id)
      await supabase.from('stock_transactions').delete().eq('id', stockTransaction.id)
      await supabase.from('sales_invoice_items').delete().eq('invoice_id', invoice.id)
      await supabase.from('sales_invoices').delete().eq('id', invoice.id)
      return NextResponse.json(
        { error: 'Failed to create stock ledger entries' },
        { status: 500 }
      )
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
      console.error('Error updating sales order:', updateError)
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
      console.error('Error posting AR invoice to GL:', arResult.error)
      // Log warning but don't fail the invoice conversion
      console.warn(
        `Invoice ${invoice.invoice_code} created successfully but AR GL posting failed: ${arResult.error}`
      )
    }

    // Step 10: Calculate and post COGS to general ledger
    const cogsCalculation = await calculateCOGS(
      salesOrder.company_id,
      body.warehouseId,
      salesOrderItems.map((item) => ({
        itemId: item.item_id,
        quantity: parseFloat(item.quantity),
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
        console.error('Error posting COGS to GL:', cogsResult.error)
        console.warn(
          `Invoice ${invoice.invoice_code} created successfully but COGS GL posting failed: ${cogsResult.error}`
        )
      }
    } else {
      console.error('Error calculating COGS:', cogsCalculation.error)
      console.warn(
        `Invoice ${invoice.invoice_code} created successfully but COGS calculation failed: ${cogsCalculation.error}`
      )
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
  } catch (error) {
    console.error('Unexpected error during conversion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
