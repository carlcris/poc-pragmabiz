import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'
import { normalizeTransactionItems } from '@/services/inventory/normalizationService'
import type { StockTransactionItemInput } from '@/types/inventory-normalization'

// GET /api/invoices/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.SALES_INVOICES, 'view')
    const { id } = await params
    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch invoice
    const { data: invoice, error } = await supabase
      .from('sales_invoices')
      .select(`
        *,
        customers:customer_id (
          id,
          customer_name,
          email
        ),
        sales_orders:sales_order_id (
          id,
          order_code
        ),
        primary_employee:primary_employee_id (
          id,
          first_name,
          last_name
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const locationId = invoice.custom_fields?.locationId
    const [location, warehouse] = await Promise.all([
      locationId
        ? supabase.from('warehouse_locations').select('code, name').eq('id', locationId).single()
        : Promise.resolve(null),
      invoice.warehouse_id
        ? supabase.from('warehouses').select('warehouse_name').eq('id', invoice.warehouse_id).single()
        : Promise.resolve(null),
    ])

    // Fetch line items
    const { data: items } = await supabase
      .from('sales_invoice_items')
      .select(`
        *,
        items:item_id (
          item_code,
          item_name
        ),
        item_packaging:packaging_id (
          id,
          pack_name,
          qty_per_pack
        )
      `)
      .eq('invoice_id', id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })

    // Format response
    const formattedInvoice = {
      id: invoice.id,
      companyId: invoice.company_id,
      invoiceNumber: invoice.invoice_code,
      customerId: invoice.customer_id,
      customerName: invoice.customers?.customer_name || '',
      customerEmail: invoice.customers?.email || '',
      warehouseId: invoice.warehouse_id || null,
      warehouseName: warehouse?.data?.warehouse_name || '',
      locationId: invoice.custom_fields?.locationId || null,
      locationCode: location?.data?.code || null,
      locationName: location?.data?.name || null,
      salesOrderId: invoice.sales_order_id,
      salesOrderNumber: invoice.sales_orders?.order_code,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      status: invoice.status,
      lineItems: items?.map((item) => ({
        id: item.id,
        itemId: item.item_id,
        itemCode: item.items?.item_code || '',
        itemName: item.items?.item_name || '',
        description: item.item_description || '',
        quantity: parseFloat(item.quantity),
        packagingId: item.packaging_id,
        packaging: item.item_packaging
          ? {
              id: item.item_packaging.id,
              name: item.item_packaging.pack_name,
              qtyPerPack: parseFloat(item.item_packaging.qty_per_pack),
            }
          : undefined,
        uomId: item.uom_id,
        unitPrice: parseFloat(item.rate),
        discount: parseFloat(item.discount_percent),
        taxRate: parseFloat(item.tax_percent),
        lineTotal: parseFloat(item.line_total),
      })) || [],
      subtotal: parseFloat(invoice.subtotal),
      totalDiscount: parseFloat(invoice.discount_amount),
      totalTax: parseFloat(invoice.tax_amount),
      totalAmount: parseFloat(invoice.total_amount),
      amountPaid: parseFloat(invoice.amount_paid),
      amountDue: parseFloat(invoice.amount_due),
      billingAddress: invoice.billing_address_line1 || '',
      billingCity: invoice.billing_city || '',
      billingState: invoice.billing_state || '',
      billingPostalCode: invoice.billing_postal_code || '',
      billingCountry: invoice.billing_country || '',
      paymentTerms: invoice.payment_terms || '',
      notes: invoice.notes || '',
      primaryEmployeeId: invoice.primary_employee_id,
      primaryEmployeeName: invoice.primary_employee
        ? `${invoice.primary_employee.first_name} ${invoice.primary_employee.last_name}`
        : '',
      commissionTotal: parseFloat(invoice.commission_total),
      commissionSplitCount: invoice.commission_split_count,
      createdBy: invoice.created_by,
      createdAt: invoice.created_at,
      updatedAt: invoice.updated_at,
    }

    return NextResponse.json(formattedInvoice)
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/invoices/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.SALES_INVOICES, 'edit')
    const { id } = await params
    const body = await request.json()
    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch existing invoice
    const { data: existingInvoice, error: fetchError } = await supabase
      .from('sales_invoices')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Only draft invoices can be edited
    if (existingInvoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft invoices can be edited' },
        { status: 400 }
      )
    }

    // Calculate totals if line items provided
    let subtotal = existingInvoice.subtotal
    let totalDiscount = existingInvoice.discount_amount
    let totalTax = existingInvoice.tax_amount
    let totalAmount = existingInvoice.total_amount

    if (body.lineItems) {
      subtotal = 0
      totalDiscount = 0
      totalTax = 0

      const itemInputs: StockTransactionItemInput[] = body.lineItems.map((item: any) => ({
        itemId: item.itemId,
        packagingId: item.packagingId ?? null,
        inputQty: parseFloat(item.quantity),
        unitCost: parseFloat(item.unitPrice),
      }))

      const normalizedItems = await normalizeTransactionItems(existingInvoice.company_id, itemInputs)

      const processedItems = body.lineItems.map((item: any, index: number) => {
        const quantity = parseFloat(item.quantity)
        const rate = parseFloat(item.unitPrice)
        const discountPercent = parseFloat(item.discount || 0)
        const taxPercent = parseFloat(item.taxRate || 0)

        const normalizedQty = normalizedItems[index]?.normalizedQty ?? quantity
        const itemTotal = normalizedQty * rate
        const discountAmount = (itemTotal * discountPercent) / 100
        const taxableAmount = itemTotal - discountAmount
        const taxAmount = (taxableAmount * taxPercent) / 100
        const lineTotal = taxableAmount + taxAmount

        subtotal += itemTotal
        totalDiscount += discountAmount
        totalTax += taxAmount

        return {
          company_id: existingInvoice.company_id,
          invoice_id: id,
          item_id: item.itemId,
          item_description: item.description || '',
          quantity,
          packaging_id: item.packagingId ?? null,
          uom_id: item.uomId,
          rate,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          tax_percent: taxPercent,
          tax_amount: taxAmount,
          line_total: lineTotal,
          sort_order: index,
          created_by: user.id,
          updated_by: user.id,
        }
      })

      totalAmount = subtotal - totalDiscount + totalTax

      // Delete existing items
      await supabase
        .from('sales_invoice_items')
        .delete()
        .eq('invoice_id', id)

      // Insert new items
      const { error: itemsError } = await supabase
        .from('sales_invoice_items')
        .insert(processedItems)

      if (itemsError) {

        return NextResponse.json(
          { error: 'Failed to update invoice items' },
          { status: 500 }
        )
      }
    }

    // Update invoice
    const nextCustomFields = 'locationId' in body
      ? {
          ...(existingInvoice.custom_fields || {}),
          locationId: body.locationId || null,
        }
      : existingInvoice.custom_fields

    const { error: updateError } = await supabase
      .from('sales_invoices')
      .update({
        customer_id: body.customerId ?? existingInvoice.customer_id,
        warehouse_id: body.warehouseId ?? existingInvoice.warehouse_id,
        custom_fields: nextCustomFields,
        invoice_date: body.invoiceDate ?? existingInvoice.invoice_date,
        due_date: body.dueDate ?? existingInvoice.due_date,
        subtotal,
        discount_amount: totalDiscount,
        tax_amount: totalTax,
        total_amount: totalAmount,
        amount_due: totalAmount - existingInvoice.amount_paid,
        billing_address_line1: body.billingAddress ?? existingInvoice.billing_address_line1,
        billing_city: body.billingCity ?? existingInvoice.billing_city,
        billing_state: body.billingState ?? existingInvoice.billing_state,
        billing_postal_code: body.billingPostalCode ?? existingInvoice.billing_postal_code,
        billing_country: body.billingCountry ?? existingInvoice.billing_country,
        payment_terms: body.paymentTerms ?? existingInvoice.payment_terms,
        notes: body.notes ?? existingInvoice.notes,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateError) {

      return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/invoices/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.SALES_INVOICES, 'delete')
    const { id } = await params
    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch the invoice to check status and sales order relationship
    const { data: invoice, error: fetchError } = await supabase
      .from('sales_invoices')
      .select('id, status, sales_order_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Only allow deleting draft invoices
    if (invoice.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft invoices can be deleted. Sent or paid invoices cannot be deleted.' },
        { status: 400 }
      )
    }

    // If invoice was created from a sales order, revert the sales order status
    if (invoice.sales_order_id) {
      const { error: orderUpdateError } = await supabase
        .from('sales_orders')
        .update({
          status: 'confirmed',
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.sales_order_id)

      if (orderUpdateError) {

        return NextResponse.json(
          { error: 'Failed to update related sales order' },
          { status: 500 }
        )
      }
    }

    // Soft delete invoice items
    const { error: itemsDeleteError } = await supabase
      .from('sales_invoice_items')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('invoice_id', id)

    if (itemsDeleteError) {

      return NextResponse.json(
        { error: 'Failed to delete invoice items' },
        { status: 500 }
      )
    }

    // Soft delete invoice payments (if any)
    const { error: paymentsDeleteError } = await supabase
      .from('invoice_payments')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('invoice_id', id)

    if (paymentsDeleteError) {

      // Don't fail the request if there are no payments
    }

    // Soft delete commission records (if any)
    const { error: commissionsDeleteError } = await supabase
      .from('invoice_employee_commissions')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('invoice_id', id)

    if (commissionsDeleteError) {

      // Don't fail the request if there are no commissions
    }

    // Soft delete the invoice
    const { error } = await supabase
      .from('sales_invoices')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', id)

    if (error) {

      return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
