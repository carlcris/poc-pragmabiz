import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

// POST /api/quotations/[id]/convert-to-sales-order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, 'edit')

    const { id: quotationId } = await params
    const { supabase, currentBusinessUnitId } = await createServerClientWithBU()

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

    // Step 1: Fetch quotation details with items
    const { data: quotation, error: quotationError } = await supabase
      .from('sales_quotations')
      .select(`
        *,
        customers:customer_id (
          id,
          customer_name,
          email
        )
      `)
      .eq('id', quotationId)
      .is('deleted_at', null)
      .single()

    if (quotationError || !quotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      )
    }

    // Step 2: Validate quotation status
    if (quotation.status !== 'accepted') {
      return NextResponse.json(
        { error: 'Only accepted quotations can be converted to sales orders' },
        { status: 400 }
      )
    }

    // Check if already converted
    if (quotation.sales_order_id) {
      return NextResponse.json(
        { error: 'This quotation has already been converted to a sales order' },
        { status: 400 }
      )
    }

    // Fetch quotation items
    const { data: quotationItems, error: itemsError } = await supabase
      .from('sales_quotation_items')
      .select('*')
      .eq('quotation_id', quotationId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })

    if (itemsError) {

      return NextResponse.json(
        { error: 'Failed to fetch quotation items' },
        { status: 500 }
      )
    }

    if (!quotationItems || quotationItems.length === 0) {
      return NextResponse.json(
        { error: 'Quotation must have at least one item' },
        { status: 400 }
      )
    }

    // Step 3: Generate sales order number
    const { data: lastOrder } = await supabase
      .from('sales_orders')
      .select('order_code')
      .eq('company_id', quotation.company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let orderNumber = 'SO-2025-0001'
    if (lastOrder?.order_code) {
      const lastNum = parseInt(lastOrder.order_code.split('-')[2])
      const nextNum = lastNum + 1
      orderNumber = `SO-2025-${String(nextNum).padStart(4, '0')}`
    }

    // Step 4: Create sales order
    const { data: salesOrder, error: orderError } = await supabase
      .from('sales_orders')
      .insert({
        company_id: quotation.company_id,
        business_unit_id: currentBusinessUnitId,
        order_code: orderNumber,
        customer_id: quotation.customer_id,
        quotation_id: quotationId,
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: quotation.valid_until || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'confirmed',
        subtotal: quotation.subtotal,
        discount_amount: quotation.discount_amount,
        tax_amount: quotation.tax_amount,
        total_amount: quotation.total_amount,
        payment_terms: quotation.terms_conditions || 'Payment due within 30 days',
        notes: quotation.notes || '',
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (orderError) {

      return NextResponse.json(
        { error: orderError.message || 'Failed to create sales order' },
        { status: 500 }
      )
    }

    // Step 5: Copy quotation items to sales order items
    const orderItemsToInsert = quotationItems.map((item, index) => ({
      company_id: quotation.company_id,
      order_id: salesOrder.id,
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
      quantity_shipped: 0,
      quantity_delivered: 0,
      sort_order: item.sort_order || index,
      created_by: user.id,
      updated_by: user.id,
    }))

    const { error: orderItemsError } = await supabase
      .from('sales_order_items')
      .insert(orderItemsToInsert)

    if (orderItemsError) {

      // Rollback: delete the sales order
      await supabase.from('sales_orders').delete().eq('id', salesOrder.id)
      return NextResponse.json(
        { error: orderItemsError.message || 'Failed to create sales order items' },
        { status: 500 }
      )
    }

    // Step 6: Update quotation status and link to sales order
    const { error: updateError } = await supabase
      .from('sales_quotations')
      .update({
        status: 'ordered',
        sales_order_id: salesOrder.id,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quotationId)

    if (updateError) {

      // Note: We don't rollback here as the sales order is already created successfully
    }

    // Return success with sales order details
    return NextResponse.json({
      success: true,
      message: 'Quotation successfully converted to Sales Order',
      salesOrder: {
        id: salesOrder.id,
        orderNumber: salesOrder.order_code,
      },
    })
  } catch (error) {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
