import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/invoices/[id]/post - Post an invoice and create stock transactions
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

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

    // Get the invoice with items
    const { data: invoice, error: invoiceError } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .single()

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Validate status
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft invoices can be posted' },
        { status: 400 }
      )
    }

    // Validate warehouse
    if (!invoice.warehouse_id) {
      return NextResponse.json(
        { error: 'Invoice must have a warehouse to post stock transactions' },
        { status: 400 }
      )
    }

    // Get invoice items
    const { data: invoiceItems, error: itemsError } = await supabase
      .from('sales_invoice_items')
      .select('*')
      .eq('invoice_id', id)
      .is('deleted_at', null)

    if (itemsError || !invoiceItems || invoiceItems.length === 0) {
      return NextResponse.json({ error: 'Invoice items not found' }, { status: 404 })
    }

    // Generate stock transaction code
    const currentYear = new Date().getFullYear()
    const { data: lastTransaction } = await supabase
      .from('stock_transactions')
      .select('transaction_code')
      .eq('company_id', userData.company_id)
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
        company_id: userData.company_id,
        transaction_code: transactionCode,
        transaction_type: 'out',
        transaction_date: invoice.invoice_date,
        warehouse_id: invoice.warehouse_id,
        reference_type: 'sales_invoice',
        reference_id: invoice.id,
        reference_code: invoice.invoice_code,
        notes: `Stock deduction for invoice ${invoice.invoice_code}`,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (transactionError || !stockTransaction) {
      console.error('Error creating stock transaction:', transactionError)
      return NextResponse.json(
        { error: 'Failed to create stock transaction' },
        { status: 500 }
      )
    }

    // Get current stock levels for each item
    const itemIds = invoiceItems.map((item) => item.item_id)

    // Get latest stock balance for each item in this warehouse
    const stockBalances = new Map<string, number>()

    for (const itemId of itemIds) {
      const { data: latestLedger } = await supabase
        .from('stock_ledger')
        .select('qty_after_trans')
        .eq('company_id', userData.company_id)
        .eq('item_id', itemId)
        .eq('warehouse_id', invoice.warehouse_id)
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

    const ledgerEntries = invoiceItems.map((item) => {
      const currentBalance = stockBalances.get(item.item_id) || 0
      const quantity = parseFloat(item.quantity)
      const newBalance = currentBalance - quantity

      return {
        company_id: userData.company_id,
        item_id: item.item_id,
        warehouse_id: invoice.warehouse_id,
        transaction_id: stockTransaction.id,
        transaction_type: 'sales',
        posting_date: postingDate,
        posting_time: postingTime,
        qty_change: -quantity, // Negative for outgoing stock
        qty_after_trans: newBalance,
        uom_id: item.uom_id,
        rate: parseFloat(item.rate),
        value_change: -quantity * parseFloat(item.rate),
        reference_type: 'sales_invoice',
        reference_id: invoice.id,
        reference_code: invoice.invoice_code,
        created_by: user.id,
      }
    })

    const { error: ledgerError } = await supabase
      .from('stock_ledger')
      .insert(ledgerEntries)

    if (ledgerError) {
      console.error('Error creating stock ledger entries:', ledgerError)
      // Rollback: delete the transaction
      await supabase.from('stock_transactions').delete().eq('id', stockTransaction.id)
      return NextResponse.json(
        { error: 'Failed to create stock ledger entries' },
        { status: 500 }
      )
    }

    // Update invoice status to 'sent' (or 'posted')
    const { error: updateError } = await supabase
      .from('sales_invoices')
      .update({
        status: 'sent',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating invoice status:', updateError)
      return NextResponse.json(
        { error: 'Failed to update invoice status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      transactionId: stockTransaction.id,
      transactionCode: stockTransaction.transaction_code,
    }, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in POST /api/invoices/[id]/post:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
