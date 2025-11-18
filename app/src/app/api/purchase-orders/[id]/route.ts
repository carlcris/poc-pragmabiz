import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/purchase-orders/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Fetch purchase order with related data
    const { data: purchaseOrder, error } = await supabase
      .from('purchase_orders')
      .select(
        `
        *,
        supplier:suppliers!purchase_orders_supplier_id_fkey(id, supplier_code, supplier_name, email, phone, contact_person),
        items:purchase_order_items(
          id,
          item_id,
          item:items(id, item_code, item_name),
          quantity,
          uom_id,
          uom:units_of_measure(id, code, name),
          rate,
          discount_percent,
          tax_percent,
          line_total,
          quantity_received
        )
      `
      )
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Error fetching purchase order:', error)
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Format response
    const formattedOrder = {
      id: purchaseOrder.id,
      companyId: purchaseOrder.company_id,
      orderCode: purchaseOrder.order_code,
      supplierId: purchaseOrder.supplier_id,
      supplier: purchaseOrder.supplier
        ? {
            id: purchaseOrder.supplier.id,
            code: purchaseOrder.supplier.supplier_code,
            name: purchaseOrder.supplier.supplier_name,
            email: purchaseOrder.supplier.email,
            phone: purchaseOrder.supplier.phone,
            contactPerson: purchaseOrder.supplier.contact_person,
          }
        : null,
      orderDate: purchaseOrder.order_date,
      expectedDeliveryDate: purchaseOrder.expected_delivery_date,
      deliveryAddress: purchaseOrder.delivery_address_line1,
      deliveryAddressLine2: purchaseOrder.delivery_address_line2,
      deliveryCity: purchaseOrder.delivery_city,
      deliveryState: purchaseOrder.delivery_state,
      deliveryCountry: purchaseOrder.delivery_country,
      deliveryPostalCode: purchaseOrder.delivery_postal_code,
      subtotal: parseFloat(purchaseOrder.subtotal || 0),
      discountAmount: parseFloat(purchaseOrder.discount_amount || 0),
      taxAmount: parseFloat(purchaseOrder.tax_amount || 0),
      totalAmount: parseFloat(purchaseOrder.total_amount || 0),
      status: purchaseOrder.status,
      notes: purchaseOrder.notes,
      approvedBy: purchaseOrder.approved_by,
      approvedAt: purchaseOrder.approved_at,
      items: purchaseOrder.items?.map((item: any) => ({
        id: item.id,
        itemId: item.item_id,
        item: item.item
          ? {
              id: item.item.id,
              code: item.item.item_code,
              name: item.item.item_name,
            }
          : null,
        quantity: parseFloat(item.quantity),
        uomId: item.uom_id,
        uom: item.uom
          ? {
              id: item.uom.id,
              code: item.uom.code,
              name: item.uom.name,
            }
          : null,
        rate: parseFloat(item.rate),
        discountPercent: parseFloat(item.discount_percent || 0),
        taxPercent: parseFloat(item.tax_percent || 0),
        lineTotal: parseFloat(item.line_total),
        quantityReceived: parseFloat(item.quantity_received || 0),
      })),
      createdBy: purchaseOrder.created_by,
      createdAt: purchaseOrder.created_at,
      updatedAt: purchaseOrder.updated_at,
    }

    return NextResponse.json(formattedOrder)
  } catch (error) {
    console.error('Unexpected error in GET /api/purchase-orders/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/purchase-orders/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 400 })
    }

    // Check if purchase order exists and is in draft status
    const { data: existingOrder, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('id, status')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Only draft purchase orders can be edited
    if (existingOrder.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft purchase orders can be edited' },
        { status: 400 }
      )
    }

    // Validate line items exist
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Purchase order must have at least one item' },
        { status: 400 }
      )
    }

    // Calculate totals
    let subtotal = 0
    const items = body.items.map((item: any) => {
      const itemSubtotal = item.quantity * item.rate
      const discountAmount = itemSubtotal * (item.discountPercent || 0) / 100
      const taxableAmount = itemSubtotal - discountAmount
      const taxAmount = taxableAmount * (item.taxPercent || 0) / 100
      const lineTotal = taxableAmount + taxAmount

      subtotal += itemSubtotal

      return {
        ...item,
        lineTotal,
      }
    })

    const discountAmount = body.discountAmount || 0
    const taxAmount = body.taxAmount || 0
    const totalAmount = subtotal - discountAmount + taxAmount

    // Update purchase order
    const { data: purchaseOrder, error: updateError } = await supabase
      .from('purchase_orders')
      .update({
        supplier_id: body.supplierId,
        order_date: body.orderDate,
        expected_delivery_date: body.expectedDeliveryDate,
        delivery_address_line1: body.deliveryAddress,
        delivery_address_line2: body.deliveryAddressLine2,
        delivery_city: body.deliveryCity,
        delivery_state: body.deliveryState,
        delivery_country: body.deliveryCountry,
        delivery_postal_code: body.deliveryPostalCode,
        subtotal,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: body.notes,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating purchase order:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Failed to update purchase order' },
        { status: 500 }
      )
    }

    // Delete existing line items
    const { error: deleteItemsError } = await supabase
      .from('purchase_order_items')
      .delete()
      .eq('purchase_order_id', id)

    if (deleteItemsError) {
      console.error('Error deleting existing items:', deleteItemsError)
      return NextResponse.json(
        { error: 'Failed to update purchase order items' },
        { status: 500 }
      )
    }

    // Create new line items
    const lineItemsData = items.map((item: any) => ({
      company_id: userData.company_id,
      purchase_order_id: purchaseOrder.id,
      item_id: item.itemId,
      quantity: item.quantity,
      uom_id: item.uomId,
      rate: item.rate,
      discount_percent: item.discountPercent || 0,
      tax_percent: item.taxPercent || 0,
      line_total: item.lineTotal,
      quantity_received: 0,
      created_by: user.id,
      updated_by: user.id,
    }))

    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(lineItemsData)

    if (itemsError) {
      console.error('Error creating purchase order items:', itemsError)
      return NextResponse.json(
        { error: itemsError.message || 'Failed to update purchase order items' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: purchaseOrder.id,
      orderCode: purchaseOrder.order_code,
      totalAmount: parseFloat(purchaseOrder.total_amount),
    })
  } catch (error) {
    console.error('Unexpected error in PUT /api/purchase-orders/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/purchase-orders/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
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

    // Check if purchase order exists
    const { data: purchaseOrder, error: fetchError } = await supabase
      .from('purchase_orders')
      .select('id, order_code, status')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Only draft purchase orders can be deleted
    if (purchaseOrder.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft purchase orders can be deleted' },
        { status: 400 }
      )
    }

    // Soft delete purchase order (line items will be cascade deleted due to ON DELETE CASCADE)
    const { error: deleteError } = await supabase
      .from('purchase_orders')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', userData.company_id)

    if (deleteError) {
      console.error('Error deleting purchase order:', deleteError)
      return NextResponse.json({ error: 'Failed to delete purchase order' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Purchase order ${purchaseOrder.order_code} deleted successfully`,
    })
  } catch (error) {
    console.error('Unexpected error in DELETE /api/purchase-orders/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
