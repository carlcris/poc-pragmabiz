import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import type { SalesOrder, SalesOrderLineItem, UpdateSalesOrderRequest } from '@/types/sales-order'
import type { Database } from '@/types/database.types'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'
import { normalizeTransactionItems } from '@/services/inventory/normalizationService'
import type { StockTransactionItemInput } from '@/types/inventory-normalization'

type DbSalesOrder = Database['public']['Tables']['sales_orders']['Row']
type DbSalesOrderItem = Database['public']['Tables']['sales_order_items']['Row']
type DbCustomer = Database['public']['Tables']['customers']['Row']
type DbItem = Database['public']['Tables']['items']['Row']
type DbUser = Database['public']['Tables']['users']['Row']
type DbUoM = Database['public']['Tables']['units_of_measure']['Row']

// Transform database sales order to frontend type
function transformDbSalesOrder(
  dbOrder: DbSalesOrder & {
    customers?: DbCustomer | null
    users?: DbUser | null
    sales_quotations?: { quotation_code: string } | null
  },
  items?: SalesOrderLineItem[]
): SalesOrder {
  return {
    id: dbOrder.id,
    companyId: dbOrder.company_id,
    orderNumber: dbOrder.order_code,
    customerId: dbOrder.customer_id,
    customerName: dbOrder.customers?.customer_name || '',
    customerEmail: dbOrder.customers?.email || '',
    quotationId: dbOrder.quotation_id || undefined,
    quotationNumber: dbOrder.sales_quotations?.quotation_code || undefined,
    orderDate: dbOrder.order_date,
    expectedDeliveryDate: dbOrder.expected_delivery_date || '',
    status: dbOrder.status as SalesOrder['status'],
    lineItems: items || [],
    subtotal: Number(dbOrder.subtotal) || 0,
    totalDiscount: Number(dbOrder.discount_amount) || 0,
    totalTax: Number(dbOrder.tax_amount) || 0,
    totalAmount: Number(dbOrder.total_amount) || 0,
    shippingAddress: dbOrder.shipping_address || '',
    shippingCity: dbOrder.shipping_city || '',
    shippingState: dbOrder.shipping_state || '',
    shippingPostalCode: dbOrder.shipping_postal_code || '',
    shippingCountry: dbOrder.shipping_country || '',
    paymentTerms: dbOrder.payment_terms || '',
    notes: dbOrder.notes || '',
    createdBy: dbOrder.created_by || '',
    createdAt: dbOrder.created_at,
    updatedAt: dbOrder.updated_at,
  }
}

// Transform database sales order item to frontend type
function transformDbSalesOrderItem(
  dbItem: DbSalesOrderItem & {
    items?: DbItem | null
    units_of_measure?: DbUoM | null
    item_packaging?: { id: string; pack_name: string; qty_per_pack: number } | null
  }
): SalesOrderLineItem {
  return {
    id: dbItem.id,
    itemId: dbItem.item_id,
    itemCode: dbItem.items?.item_code || '',
    itemName: dbItem.items?.item_name || '',
    description: dbItem.item_description || '',
    quantity: Number(dbItem.quantity),
    packagingId: dbItem.packaging_id,
    packaging: dbItem.item_packaging
      ? {
          id: dbItem.item_packaging.id,
          name: dbItem.item_packaging.pack_name,
          qtyPerPack: Number(dbItem.item_packaging.qty_per_pack),
        }
      : undefined,
    uomId: dbItem.uom_id,
    unitPrice: Number(dbItem.rate),
    discount: Number(dbItem.discount_percent) || 0,
    taxRate: Number(dbItem.tax_percent) || 0,
    lineTotal: Number(dbItem.line_total),
    quantityShipped: Number(dbItem.quantity_shipped) || 0,
    quantityDelivered: Number(dbItem.quantity_delivered) || 0,
  }
}

// GET /api/sales-orders/[id] - Get single sales order by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, 'view')
    if (unauthorized) return unauthorized

    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Fetch sales order with customer info
    const { data: order, error } = await supabase
      .from('sales_orders')
      .select(
        `
        *,
        customers:customer_id (
          id,
          customer_name,
          email
        ),
        users:created_by (
          id,
          first_name,
          last_name
        ),
        sales_quotations:quotation_id (
          quotation_code
        )
      `
      )
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from('sales_order_items')
      .select(
        `
        *,
        items (
          id,
          item_code,
          item_name
        ),
        item_packaging (
          id,
          pack_name,
          qty_per_pack
        ),
        units_of_measure (
          id,
          code,
          name
        )
      `
      )
      .eq('order_id', id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })

    if (itemsError) {

    }

    const transformedItems = items?.map(item => transformDbSalesOrderItem(item as any)) || []
    const result = transformDbSalesOrder(order as any, transformedItems)

    return NextResponse.json(result)
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/sales-orders/[id] - Update sales order
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, 'edit')
    if (unauthorized) return unauthorized

    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const body = await request.json()
    const updateData: UpdateSalesOrderRequest = body

    // Check if sales order exists
    const { data: existingOrder, error: fetchError } = await supabase
      .from('sales_orders')
      .select('id, status, company_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    // Calculate totals if line items are provided
    let subtotal = 0
    let totalDiscount = 0
    let totalTax = 0
    let itemsWithCalculations: any[] = []

    if (updateData.lineItems && updateData.lineItems.length > 0) {
      const itemInputs: StockTransactionItemInput[] = updateData.lineItems.map((item) => ({
        itemId: item.itemId,
        packagingId: item.packagingId ?? null,
        inputQty: item.quantity,
        unitCost: item.unitPrice,
      }))

      const normalizedItems = await normalizeTransactionItems(existingOrder.company_id, itemInputs)

      itemsWithCalculations = updateData.lineItems.map((item, index) => {
        const normalizedQty = normalizedItems[index]?.normalizedQty ?? item.quantity
        const itemSubtotal = normalizedQty * item.unitPrice
        const discountAmount = (itemSubtotal * (item.discount || 0) / 100)
        const taxableAmount = itemSubtotal - discountAmount
        const taxAmount = (taxableAmount * (item.taxRate || 0) / 100)
        const lineTotal = taxableAmount + taxAmount

        subtotal += itemSubtotal
        totalDiscount += discountAmount
        totalTax += taxAmount

        return {
          ...item,
          normalizedQty,
          discountAmount,
          taxAmount,
          lineTotal,
        }
      })
    }

    const totalAmount = subtotal - totalDiscount + totalTax

    // Update order header
    const orderUpdate: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }

    if (updateData.customerId) orderUpdate.customer_id = updateData.customerId
    if (updateData.orderDate) orderUpdate.order_date = updateData.orderDate
    if (updateData.expectedDeliveryDate !== undefined) orderUpdate.expected_delivery_date = updateData.expectedDeliveryDate
    if (updateData.status) orderUpdate.status = updateData.status
    if (updateData.shippingAddress !== undefined) orderUpdate.shipping_address = updateData.shippingAddress
    if (updateData.shippingCity !== undefined) orderUpdate.shipping_city = updateData.shippingCity
    if (updateData.shippingState !== undefined) orderUpdate.shipping_state = updateData.shippingState
    if (updateData.shippingPostalCode !== undefined) orderUpdate.shipping_postal_code = updateData.shippingPostalCode
    if (updateData.shippingCountry !== undefined) orderUpdate.shipping_country = updateData.shippingCountry
    if (updateData.paymentTerms !== undefined) orderUpdate.payment_terms = updateData.paymentTerms
    if (updateData.notes !== undefined) orderUpdate.notes = updateData.notes

    // Update totals if items provided
    if (itemsWithCalculations.length > 0) {
      orderUpdate.subtotal = subtotal.toFixed(4)
      orderUpdate.discount_amount = totalDiscount.toFixed(4)
      orderUpdate.tax_amount = totalTax.toFixed(4)
      orderUpdate.total_amount = totalAmount.toFixed(4)
    }

    const { error: updateError } = await supabase
      .from('sales_orders')
      .update(orderUpdate)
      .eq('id', id)

    if (updateError) {

      return NextResponse.json(
        { error: updateError.message || 'Failed to update sales order' },
        { status: 500 }
      )
    }

    // Update line items if provided
    if (updateData.lineItems && updateData.lineItems.length > 0) {
      // Delete existing items
      await supabase
        .from('sales_order_items')
        .delete()
        .eq('order_id', id)

      // Insert new items
      const itemsToInsert = itemsWithCalculations.map((item, index) => ({
        company_id: existingOrder.company_id,
        order_id: id,
        item_id: item.itemId,
        item_description: item.description,
        quantity: item.quantity,
        packaging_id: item.packagingId ?? null,
        uom_id: item.uomId,
        rate: item.unitPrice,
        discount_percent: item.discount || 0,
        discount_amount: item.discountAmount,
        tax_percent: item.taxRate || 0,
        tax_amount: item.taxAmount,
        line_total: item.lineTotal,
        quantity_shipped: item.quantityShipped || 0,
        quantity_delivered: item.quantityDelivered || 0,
        sort_order: index,
        created_by: user.id,
        updated_by: user.id,
      }))

      const { error: itemsError } = await supabase
        .from('sales_order_items')
        .insert(itemsToInsert)

      if (itemsError) {

        return NextResponse.json(
          { error: itemsError.message || 'Failed to update sales order items' },
          { status: 500 }
        )
      }
    }

    // Fetch updated order with joins
    const { data: updatedOrder } = await supabase
      .from('sales_orders')
      .select(
        `
        *,
        customers:customer_id (
          id,
          customer_name,
          email
        ),
        users:created_by (
          id,
          first_name,
          last_name
        ),
        sales_quotations:quotation_id (
          quotation_code
        )
      `
      )
      .eq('id', id)
      .single()

    const { data: orderItems } = await supabase
      .from('sales_order_items')
      .select(
        `
        *,
        items (
          id,
          item_code,
          item_name
        ),
        units_of_measure (
          id,
          code,
          name
        )
      `
      )
      .eq('order_id', id)
      .order('sort_order', { ascending: true })

    const items = orderItems?.map(item => transformDbSalesOrderItem(item as any)) || []
    const result = transformDbSalesOrder(updatedOrder as any, items)

    return NextResponse.json(result)
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/sales-orders/[id] - Soft delete sales order
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.SALES_ORDERS, 'delete')
    if (unauthorized) return unauthorized

    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Check if sales order exists
    const { data: existingOrder, error: fetchError } = await supabase
      .from('sales_orders')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingOrder) {
      return NextResponse.json({ error: 'Sales order not found' }, { status: 404 })
    }

    // Soft delete (set deleted_at timestamp)
    const { error: deleteError } = await supabase
      .from('sales_orders')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', id)

    if (deleteError) {

      return NextResponse.json(
        { error: deleteError.message || 'Failed to delete sales order' },
        { status: 500 }
      )
    }

    // Also soft delete the items
    await supabase
      .from('sales_order_items')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('order_id', id)

    return NextResponse.json({ message: 'Sales order deleted successfully' })
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
