import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

// GET /api/sales-orders/[id]/payment-summary
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check permission first
    const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, 'view')
    if (unauthorized) return unauthorized

    const { id: salesOrderId } = await params
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

    // Fetch invoices for this sales order
    const { data: invoices, error: invoicesError } = await supabase
      .from('sales_invoices')
      .select('id, invoice_code, total_amount, amount_paid, amount_due, status')
      .eq('company_id', userData.company_id)
      .eq('sales_order_id', salesOrderId)
      .is('deleted_at', null)

    if (invoicesError) {

      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
    }

    if (!invoices || invoices.length === 0) {
      return NextResponse.json({
        invoices: [],
        summary: {
          totalInvoiced: 0,
          totalPaid: 0,
          totalDue: 0,
        },
      })
    }

    // Fetch payments for all invoices
    const invoiceIds = invoices.map((inv) => inv.id)
    const { data: payments, error: paymentsError } = await supabase
      .from('invoice_payments')
      .select('*')
      .eq('company_id', userData.company_id)
      .in('invoice_id', invoiceIds)
      .is('deleted_at', null)
      .order('payment_date', { ascending: false })

    if (paymentsError) {

      return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
    }

    // Format invoices with their payments
    const formattedInvoices = invoices.map((invoice) => {
      const invoicePayments = payments?.filter((p) => p.invoice_id === invoice.id) || []

      return {
        id: invoice.id,
        invoiceCode: invoice.invoice_code,
        totalAmount: parseFloat(invoice.total_amount),
        amountPaid: parseFloat(invoice.amount_paid),
        amountDue: parseFloat(invoice.amount_due),
        status: invoice.status,
        payments: invoicePayments.map((payment) => ({
          id: payment.id,
          paymentCode: payment.payment_code,
          paymentDate: payment.payment_date,
          amount: parseFloat(payment.amount),
          paymentMethod: payment.payment_method,
          reference: payment.reference,
          notes: payment.notes,
        })),
      }
    })

    // Calculate summary
    const totalInvoiced = invoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0)
    const totalPaid = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount_paid), 0)
    const totalDue = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount_due), 0)

    return NextResponse.json({
      invoices: formattedInvoices,
      summary: {
        totalInvoiced,
        totalPaid,
        totalDue,
      },
    })
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
