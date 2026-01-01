import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

// GET /api/purchase-orders
export async function GET(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.PURCHASE_ORDERS, 'view')
    const { supabase } = await createServerClientWithBU()
    const { searchParams } = new URL(request.url)

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

    // Build query
    let query = supabase
      .from('purchase_orders')
      .select(
        `
        *,
        supplier:suppliers!purchase_orders_supplier_id_fkey(id, supplier_code, supplier_name),
        items:purchase_order_items(
          id,
          item_id,
          item:items(id, item_code, item_name),
          quantity,
          uom:units_of_measure(id, code, name),
          rate,
          discount_percent,
          tax_percent,
          line_total,
          quantity_received
        )
      `,
        { count: 'exact' }
      )
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)

    // Apply filters
    const status = searchParams.get('status')
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const supplierId = searchParams.get('supplier_id')
    if (supplierId) {
      query = query.eq('supplier_id', supplierId)
    }

    const search = searchParams.get('search')
    if (search) {
      query = query.or(`order_code.ilike.%${search}%`)
    }

    // Date range filters
    const fromDate = searchParams.get('from_date')
    if (fromDate) {
      query = query.gte('order_date', fromDate)
    }

    const toDate = searchParams.get('to_date')
    if (toDate) {
      query = query.lte('order_date', toDate)
    }

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query.range(from, to).order('created_at', { ascending: false })

    const { data: purchaseOrders, error, count } = await query

    if (error) {

      return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 })
    }

    // Format response
    const formattedOrders = purchaseOrders?.map((order) => ({
      id: order.id,
      companyId: order.company_id,
      orderCode: order.order_code,
      supplierId: order.supplier_id,
      supplier: order.supplier
        ? {
            id: order.supplier.id,
            code: order.supplier.supplier_code,
            name: order.supplier.supplier_name,
          }
        : null,
      orderDate: order.order_date,
      expectedDeliveryDate: order.expected_delivery_date,
      deliveryAddress: order.delivery_address_line1,
      deliveryAddressLine2: order.delivery_address_line2,
      deliveryCity: order.delivery_city,
      deliveryState: order.delivery_state,
      deliveryCountry: order.delivery_country,
      deliveryPostalCode: order.delivery_postal_code,
      subtotal: parseFloat(order.subtotal || 0),
      discountAmount: parseFloat(order.discount_amount || 0),
      taxAmount: parseFloat(order.tax_amount || 0),
      totalAmount: parseFloat(order.total_amount || 0),
      status: order.status,
      notes: order.notes,
      approvedBy: order.approved_by,
      approvedAt: order.approved_at,
      items: order.items?.map((item: any) => ({
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
      createdBy: order.created_by,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    }))

    return NextResponse.json({
      data: formattedOrders,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/purchase-orders
export async function POST(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.PURCHASE_ORDERS, 'create')
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

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 400 })
    }

    // Validate line items exist
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Purchase order must have at least one item' },
        { status: 400 }
      )
    }

    // Generate order code if not provided (PO-YYYY-NNNN)
    let orderCode = body.orderCode
    if (!orderCode) {
      const year = new Date().getFullYear()
      const { data: orders } = await supabase
        .from('purchase_orders')
        .select('order_code')
        .eq('company_id', userData.company_id)
        .like('order_code', `PO-${year}-%`)
        .order('order_code', { ascending: false })
        .limit(1)

      let nextNum = 1
      if (orders && orders.length > 0) {
        const lastNum = parseInt(orders[0].order_code.split('-')[2])
        nextNum = lastNum + 1
      }
      orderCode = `PO-${year}-${String(nextNum).padStart(4, '0')}`
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

    // Create purchase order
    const { data: purchaseOrder, error: orderError } = await supabase
      .from('purchase_orders')
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        order_code: orderCode,
        supplier_id: body.supplierId,
        order_date: body.orderDate || new Date().toISOString().split('T')[0],
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
        status: body.status || 'draft',
        notes: body.notes,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (orderError) {

      return NextResponse.json(
        { error: orderError.message || 'Failed to create purchase order' },
        { status: 500 }
      )
    }

    // Create line items
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

      // Rollback: delete the order
      await supabase.from('purchase_orders').delete().eq('id', purchaseOrder.id)
      return NextResponse.json(
        { error: itemsError.message || 'Failed to create purchase order items' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        id: purchaseOrder.id,
        orderCode: purchaseOrder.order_code,
        totalAmount: parseFloat(purchaseOrder.total_amount),
      },
      { status: 201 }
    )
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
