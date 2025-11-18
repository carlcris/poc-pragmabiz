import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/quotations/[id]/status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quotationId } = await params
    const { status } = await request.json()

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    const validStatuses = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'ordered']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch current quotation
    const { data: quotation, error: fetchError } = await supabase
      .from('sales_quotations')
      .select('*')
      .eq('id', quotationId)
      .is('deleted_at', null)
      .single()

    if (fetchError || !quotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      )
    }

    // Validate status transitions - allow manual flagging for draft and sent
    const currentStatus = quotation.status

    // Allow flexible transitions from draft and sent statuses
    if (currentStatus === 'draft') {
      // From draft, can go to: sent, accepted, rejected
      if (!['sent', 'accepted', 'rejected'].includes(status)) {
        return NextResponse.json(
          { error: `Cannot change status from draft to ${status}` },
          { status: 400 }
        )
      }
    } else if (currentStatus === 'sent') {
      // From sent, can go to: accepted, rejected, expired
      if (!['accepted', 'rejected', 'expired'].includes(status)) {
        return NextResponse.json(
          { error: `Cannot change status from sent to ${status}` },
          { status: 400 }
        )
      }
    } else if (currentStatus === 'accepted') {
      // From accepted, can only go to ordered (via conversion)
      if (status !== 'ordered') {
        return NextResponse.json(
          { error: 'Accepted quotations can only be converted to orders' },
          { status: 400 }
        )
      }
    } else {
      // rejected, expired, ordered are final states
      return NextResponse.json(
        { error: `Cannot change status from ${currentStatus}` },
        { status: 400 }
      )
    }

    // Update quotation status
    const { data: updatedQuotation, error: updateError } = await supabase
      .from('sales_quotations')
      .update({
        status,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quotationId)
      .select(`
        *,
        customers:customer_id (
          id,
          customer_name,
          email
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating quotation status:', updateError)
      return NextResponse.json(
        { error: 'Failed to update quotation status' },
        { status: 500 }
      )
    }

    // Format the response to match the Quotation type
    const formattedQuotation = {
      id: updatedQuotation.id,
      companyId: updatedQuotation.company_id,
      quotationNumber: updatedQuotation.quotation_code,
      quotationDate: updatedQuotation.quotation_date,
      customerId: updatedQuotation.customer_id,
      customerName: updatedQuotation.customers?.customer_name || '',
      customerEmail: updatedQuotation.customers?.email || '',
      validUntil: updatedQuotation.valid_until,
      priceListId: updatedQuotation.price_list_id,
      subtotal: parseFloat(updatedQuotation.subtotal),
      discountAmount: parseFloat(updatedQuotation.discount_amount),
      taxAmount: parseFloat(updatedQuotation.tax_amount),
      totalAmount: parseFloat(updatedQuotation.total_amount),
      status: updatedQuotation.status,
      notes: updatedQuotation.notes,
      termsConditions: updatedQuotation.terms_conditions,
      salesOrderId: updatedQuotation.sales_order_id,
      createdAt: updatedQuotation.created_at,
      updatedAt: updatedQuotation.updated_at,
      lineItems: [],
    }

    return NextResponse.json(formattedQuotation)
  } catch (error) {
    console.error('Unexpected error changing quotation status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
