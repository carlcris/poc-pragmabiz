import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { postARPayment } from '@/services/accounting/arPosting'

// GET /api/invoices/[id]/payments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params
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

    // Fetch payments for the invoice
    const { data: payments, error } = await supabase
      .from('invoice_payments')
      .select('*')
      .eq('company_id', userData.company_id)
      .eq('invoice_id', invoiceId)
      .is('deleted_at', null)
      .order('payment_date', { ascending: false })

    if (error) {
      console.error('Error fetching payments:', error)
      return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
    }

    // Format response
    const formattedPayments = payments?.map((payment) => ({
      id: payment.id,
      invoiceId: payment.invoice_id,
      paymentCode: payment.payment_code,
      paymentDate: payment.payment_date,
      amount: parseFloat(payment.amount),
      paymentMethod: payment.payment_method,
      reference: payment.reference,
      notes: payment.notes,
      createdAt: payment.created_at,
      createdBy: payment.created_by,
    }))

    return NextResponse.json({ data: formattedPayments || [] })
  } catch (error) {
    console.error('Unexpected error in GET /api/invoices/[id]/payments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/invoices/[id]/payments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params
    const body = await request.json()
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

    // Fetch invoice
    const { data: invoice, error: fetchError } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('id', invoiceId)
      .is('deleted_at', null)
      .single()

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Cannot record payment for cancelled invoices
    if (invoice.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot record payment for cancelled invoice' },
        { status: 400 }
      )
    }

    const paymentAmount = parseFloat(body.amount)

    // Validate payment amount
    if (paymentAmount <= 0) {
      return NextResponse.json({ error: 'Payment amount must be greater than 0' }, { status: 400 })
    }

    if (paymentAmount > invoice.amount_due) {
      return NextResponse.json(
        { error: 'Payment amount cannot exceed amount due' },
        { status: 400 }
      )
    }

    // Generate payment code (PAY-YYYY-NNNN)
    const year = new Date().getFullYear()
    const { data: lastPayment } = await supabase
      .from('invoice_payments')
      .select('payment_code')
      .eq('company_id', userData.company_id)
      .like('payment_code', `PAY-${year}-%`)
      .order('payment_code', { ascending: false })
      .limit(1)
      .single()

    let nextNum = 1
    if (lastPayment?.payment_code) {
      const match = lastPayment.payment_code.match(/PAY-\d+-(\d+)/)
      if (match) {
        nextNum = parseInt(match[1]) + 1
      }
    }
    const paymentCode = `PAY-${year}-${String(nextNum).padStart(4, '0')}`

    // Record payment
    const { data: payment, error: paymentError } = await supabase
      .from('invoice_payments')
      .insert({
        company_id: userData.company_id,
        invoice_id: invoiceId,
        payment_code: paymentCode,
        payment_date: body.paymentDate,
        amount: paymentAmount,
        payment_method: body.paymentMethod,
        reference: body.reference,
        notes: body.notes,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (paymentError || !payment) {
      console.error('Error recording payment:', paymentError)
      return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
    }

    // Update invoice amounts and status
    const newAmountPaid = parseFloat(invoice.amount_paid) + paymentAmount
    const newAmountDue = parseFloat(invoice.total_amount) - newAmountPaid

    let newStatus = invoice.status
    if (newAmountDue === 0) {
      newStatus = 'paid'
    } else if (newAmountPaid > 0 && newAmountDue > 0) {
      newStatus = 'partially_paid'
    } else if (newStatus === 'sent' || newStatus === 'draft') {
      newStatus = 'sent'
    }

    const { error: updateError } = await supabase
      .from('sales_invoices')
      .update({
        amount_paid: newAmountPaid,
        amount_due: newAmountDue,
        status: newStatus,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Error updating invoice:', updateError)
      return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
    }

    // Post AR payment to general ledger
    const arPaymentResult = await postARPayment(userData.company_id, user.id, {
      paymentId: payment.id,
      invoiceId: invoice.id,
      invoiceCode: invoice.invoice_code,
      customerId: invoice.customer_id,
      paymentDate: body.paymentDate,
      paymentAmount: paymentAmount,
      paymentMethod: body.paymentMethod,
      description: `Payment received for Invoice ${invoice.invoice_code}`,
    })

    if (!arPaymentResult.success) {
      console.error('Error posting AR payment to GL:', arPaymentResult.error)
      // Log warning but don't fail the payment
      console.warn(
        `Payment ${paymentCode} recorded successfully but AR GL posting failed: ${arPaymentResult.error}`
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Payment recorded successfully',
      invoice: {
        amountPaid: newAmountPaid,
        amountDue: newAmountDue,
        status: newStatus,
      },
      journalEntryId: arPaymentResult.journalEntryId,
      arPostingSuccess: arPaymentResult.success,
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/invoices/[id]/payments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
