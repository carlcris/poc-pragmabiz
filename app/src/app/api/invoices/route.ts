import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { calculateInvoiceCommission } from '@/services/commission/commissionService'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'
import { normalizeTransactionItems } from '@/services/inventory/normalizationService'
import type { StockTransactionItemInput } from '@/types/inventory-normalization'
import type { CreateInvoiceRequest } from '@/types/invoice'

// GET /api/invoices
export async function GET(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.SALES_INVOICES, 'view')
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
      `, { count: 'exact' })
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)

    // Apply filters
    const status = searchParams.get('status')
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const customerId = searchParams.get('customerId')
    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    const search = searchParams.get('search')
    if (search) {
      query = query.or(`invoice_code.ilike.%${search}%`)
    }

    const dateFrom = searchParams.get('dateFrom')
    if (dateFrom) {
      query = query.gte('invoice_date', dateFrom)
    }

    const dateTo = searchParams.get('dateTo')
    if (dateTo) {
      query = query.lte('invoice_date', dateTo)
    }

    const employeeId = searchParams.get('employeeId')
    if (employeeId) {
      query = query.eq('primary_employee_id', employeeId)
    }

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query.range(from, to).order('created_at', { ascending: false })

    const { data: invoices, error, count } = await query

    if (error) {

      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
    }

    const locationIds = new Set<string>()
    const warehouseIds = new Set<string>()
    invoices?.forEach((invoice) => {
      const locationId = invoice.custom_fields?.locationId
      if (locationId) locationIds.add(locationId)
      if (invoice.warehouse_id) warehouseIds.add(invoice.warehouse_id)
    })

    const [locationsData, warehousesData] = await Promise.all([
      locationIds.size > 0
        ? supabase
            .from('warehouse_locations')
            .select('id, code, name')
            .in('id', Array.from(locationIds))
        : Promise.resolve({ data: [] }),
      warehouseIds.size > 0
        ? supabase
            .from('warehouses')
            .select('id, warehouse_name')
            .in('id', Array.from(warehouseIds))
        : Promise.resolve({ data: [] }),
    ])

    const locationsMap = new Map(locationsData?.data?.map((loc) => [loc.id, loc]) || [])
    const warehousesMap = new Map(warehousesData?.data?.map((wh) => [wh.id, wh]) || [])

    // Fetch line items for each invoice
    const invoiceIds = invoices?.map((inv) => inv.id) || []
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
        ),
        units_of_measure:uom_id (
          code,
          name
        )
      `)
      .in('invoice_id', invoiceIds)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })

    // Format response
    const formattedInvoices = invoices?.map((invoice) => {
      const invoiceItems = items?.filter((item) => item.invoice_id === invoice.id) || []
      const locationId = invoice.custom_fields?.locationId
      const location = locationId ? locationsMap.get(locationId) : null
      const warehouse = invoice.warehouse_id ? warehousesMap.get(invoice.warehouse_id) : null

      return {
        id: invoice.id,
        companyId: invoice.company_id,
        invoiceNumber: invoice.invoice_code,
        customerId: invoice.customer_id,
        customerName: invoice.customers?.customer_name || '',
        customerEmail: invoice.customers?.email || '',
        warehouseId: invoice.warehouse_id || null,
        warehouseName: warehouse?.warehouse_name || '',
        locationId: invoice.custom_fields?.locationId || null,
        locationCode: location?.code || null,
        locationName: location?.name || null,
        salesOrderId: invoice.sales_order_id,
        salesOrderNumber: invoice.sales_orders?.order_code,
        invoiceDate: invoice.invoice_date,
        dueDate: invoice.due_date,
        status: invoice.status,
        lineItems: invoiceItems.map((item) => ({
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
        })),
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
    })

    return NextResponse.json({
      data: formattedInvoices,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/invoices
export async function POST(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.SALES_INVOICES, 'create')
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

    // Generate invoice number
    const { data: lastInvoice } = await supabase
      .from('sales_invoices')
      .select('invoice_code')
      .eq('company_id', userData.company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let invoiceNumber = 'INV-2025-0001'
    if (lastInvoice?.invoice_code) {
      const lastNum = parseInt(lastInvoice.invoice_code.split('-')[2])
      const nextNum = lastNum + 1
      invoiceNumber = `INV-2025-${String(nextNum).padStart(4, '0')}`
    }

    // Calculate totals
    const lineItems = (body.lineItems || []) as CreateInvoiceRequest["lineItems"]
    let subtotal = 0
    let totalDiscount = 0
    let totalTax = 0

    const itemInputs: StockTransactionItemInput[] = lineItems.map((item) => ({
      itemId: item.itemId,
      packagingId: item.packagingId ?? null,
      inputQty: Number(item.quantity),
      unitCost: Number(item.unitPrice),
    }))

    const normalizedItems = await normalizeTransactionItems(userData.company_id, itemInputs)

    const processedItems = lineItems.map((item, index) => {
      const quantity = Number(item.quantity)
      const rate = Number(item.unitPrice)
      const discountPercent = Number(item.discount || 0)
      const taxPercent = Number(item.taxRate || 0)

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
        company_id: userData.company_id,
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

    const totalAmount = subtotal - totalDiscount + totalTax

    // business_unit_id from JWT - set by auth hook
    // Create invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('sales_invoices')
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        invoice_code: invoiceNumber,
        customer_id: body.customerId,
        warehouse_id: body.warehouseId || null,
        custom_fields: body.locationId ? { locationId: body.locationId } : null,
        sales_order_id: body.salesOrderId,
        invoice_date: body.invoiceDate,
        due_date: body.dueDate,
        status: 'draft',
        subtotal,
        discount_amount: totalDiscount,
        tax_amount: totalTax,
        total_amount: totalAmount,
        amount_paid: 0,
        amount_due: totalAmount,
        billing_address_line1: body.billingAddress,
        billing_city: body.billingCity,
        billing_state: body.billingState,
        billing_postal_code: body.billingPostalCode,
        billing_country: body.billingCountry,
        payment_terms: body.paymentTerms,
        notes: body.notes,
        primary_employee_id: body.primaryEmployeeId,
        commission_total: 0,
        commission_split_count: 0,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (invoiceError) {

      return NextResponse.json(
        { error: invoiceError.message || 'Failed to create invoice' },
        { status: 500 }
      )
    }

    // Create invoice items
    const itemsToInsert = processedItems.map((item) => ({
      ...item,
      invoice_id: invoice.id,
    }))

    const { error: itemsError } = await supabase
      .from('sales_invoice_items')
      .insert(itemsToInsert)

    if (itemsError) {

      // Rollback: delete the invoice
      await supabase.from('sales_invoices').delete().eq('id', invoice.id)
      return NextResponse.json(
        { error: itemsError.message || 'Failed to create invoice items' },
        { status: 500 }
      )
    }

    // Calculate commission for the invoice (if employee is assigned)
    try {
      const commissionResult = await calculateInvoiceCommission(
        invoice.id,
        body.primaryEmployeeId
      )

      if (!commissionResult.success) {

      }
    } catch {

      // Don't fail invoice creation if commission calculation fails
    }

    return NextResponse.json(
      {
        id: invoice.id,
        invoiceNumber: invoice.invoice_code,
      },
      { status: 201 }
    )
  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
