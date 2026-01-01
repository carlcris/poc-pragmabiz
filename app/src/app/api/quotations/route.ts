import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import type { Quotation, QuotationLineItem, CreateQuotationRequest } from '@/types/quotation'
import type { Database } from '@/types/database.types'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

type DbQuotation = Database['public']['Tables']['sales_quotations']['Row']
type DbQuotationItem = Database['public']['Tables']['sales_quotation_items']['Row']
type DbCustomer = Database['public']['Tables']['customers']['Row']
type DbItem = Database['public']['Tables']['items']['Row']
type DbUser = Database['public']['Tables']['users']['Row']
type DbUoM = Database['public']['Tables']['units_of_measure']['Row']

// Transform database quotation to frontend type
function transformDbQuotation(
  dbQuotation: DbQuotation & {
    customers?: DbCustomer | null
    users?: DbUser | null
  },
  items?: QuotationLineItem[]
): Quotation {
  return {
    id: dbQuotation.id,
    companyId: dbQuotation.company_id,
    quotationNumber: dbQuotation.quotation_code,
    customerId: dbQuotation.customer_id,
    customerName: dbQuotation.customers?.customer_name,
    customerEmail: dbQuotation.customers?.email,
    quotationDate: dbQuotation.quotation_date,
    validUntil: dbQuotation.valid_until || '',
    status: dbQuotation.status as Quotation['status'],
    salesOrderId: dbQuotation.sales_order_id || undefined,
    lineItems: items || [],
    subtotal: Number(dbQuotation.subtotal) || 0,
    totalDiscount: Number(dbQuotation.discount_amount) || 0,
    totalTax: Number(dbQuotation.tax_amount) || 0,
    totalAmount: Number(dbQuotation.total_amount) || 0,
    terms: dbQuotation.terms_conditions || '',
    notes: dbQuotation.notes || '',
    createdBy: dbQuotation.created_by || '',
    createdByName: dbQuotation.users ? `${dbQuotation.users.first_name || ''} ${dbQuotation.users.last_name || ''}`.trim() : undefined,
    createdAt: dbQuotation.created_at,
    updatedAt: dbQuotation.updated_at,
  }
}

// Transform database quotation item to frontend type
function transformDbQuotationItem(
  dbItem: DbQuotationItem & {
    items?: DbItem | null
    units_of_measure?: DbUoM | null
  }
): QuotationLineItem {
  return {
    id: dbItem.id,
    itemId: dbItem.item_id,
    itemCode: dbItem.items?.item_code,
    itemName: dbItem.items?.item_name,
    description: dbItem.item_description || '',
    quantity: Number(dbItem.quantity),
    uomId: dbItem.uom_id,
    unitPrice: Number(dbItem.rate),
    discount: Number(dbItem.discount_percent) || 0,
    discountAmount: Number(dbItem.discount_amount) || 0,
    taxRate: Number(dbItem.tax_percent) || 0,
    taxAmount: Number(dbItem.tax_amount) || 0,
    lineTotal: Number(dbItem.line_total),
    sortOrder: dbItem.sort_order || 0,
  }
}

// GET /api/quotations - List quotations with filters
export async function GET(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, 'view')

    const { supabase } = await createServerClientWithBU()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const customerId = searchParams.get('customerId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    // Build query for quotations
    let query = supabase
      .from('sales_quotations')
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
        )
      `,
        { count: 'exact' }
      )
      .is('deleted_at', null)
      .order('quotation_date', { ascending: false })
      .order('created_at', { ascending: false })

    // Apply filters
    if (search) {
      query = query.or(`quotation_code.ilike.%${search}%,notes.ilike.%${search}%`)
    }

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (customerId) {
      query = query.eq('customer_id', customerId)
    }

    if (dateFrom) {
      query = query.gte('quotation_date', dateFrom)
    }

    if (dateTo) {
      query = query.lte('quotation_date', dateTo)
    }

    // Pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data: quotations, error, count } = await query

    if (error) {

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!quotations) {
      return NextResponse.json({
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      })
    }

    // Fetch items for each quotation
    const quotationIds = quotations.map((q) => q.id)
    const { data: items, error: itemsError } = await supabase
      .from('sales_quotation_items')
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
      .in('quotation_id', quotationIds)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true })

    if (itemsError) {

    }

    // Group items by quotation
    const itemsByQuotation = items?.reduce((acc, item) => {
      if (!acc[item.quotation_id]) {
        acc[item.quotation_id] = []
      }
      acc[item.quotation_id].push(transformDbQuotationItem(item as any))
      return acc
    }, {} as Record<string, QuotationLineItem[]>) || {}

    // Transform to frontend format
    const transformedData = quotations.map((quotation) =>
      transformDbQuotation(quotation as any, itemsByQuotation[quotation.id] || [])
    )

    return NextResponse.json({
      data: transformedData,
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

// POST /api/quotations - Create new quotation
export async function POST(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.SALES_QUOTATIONS, 'create')

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

    // Get user's company_id from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body: CreateQuotationRequest = await request.json()

    // Validate required fields
    if (!body.customerId || !body.quotationDate || !body.items || body.items.length === 0) {

      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Auto-generate quotation code if not provided
    let quotationCode = body.quotationCode
    if (!quotationCode) {
      const { data: lastQuotation } = await supabase
        .from('sales_quotations')
        .select('quotation_code')
        .eq('company_id', userData.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (lastQuotation?.quotation_code) {
        const lastNumber = parseInt(lastQuotation.quotation_code.split('-')[1] || '0')
        quotationCode = `QT-${String(lastNumber + 1).padStart(5, '0')}`
      } else {
        quotationCode = 'QT-00001'
      }
    } else {
      // Check for duplicate quotation code only if provided
      const { data: existingQuotation } = await supabase
        .from('sales_quotations')
        .select('id')
        .eq('company_id', userData.company_id)
        .eq('quotation_code', quotationCode)
        .is('deleted_at', null)
        .single()

      if (existingQuotation) {
        return NextResponse.json(
          { error: 'Quotation code already exists' },
          { status: 400 }
        )
      }
    }

    // Calculate totals
    let subtotal = 0
    let totalDiscount = 0
    let totalTax = 0

    const itemsWithCalculations = body.items.map((item) => {
      const itemSubtotal = item.quantity * item.rate
      const discountAmount = item.discountAmount || (itemSubtotal * (item.discountPercent || 0) / 100)
      const taxableAmount = itemSubtotal - discountAmount
      const taxAmount = item.taxAmount || (taxableAmount * (item.taxPercent || 0) / 100)
      const lineTotal = taxableAmount + taxAmount

      subtotal += itemSubtotal
      totalDiscount += discountAmount
      totalTax += taxAmount

      return {
        ...item,
        discountAmount,
        taxAmount,
        lineTotal,
      }
    })

    const totalAmount = subtotal - totalDiscount + totalTax

    // business_unit_id from JWT - set by auth hook
    // Create quotation header
    const { data: quotation, error: quotationError } = await supabase
      .from('sales_quotations')
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        quotation_code: quotationCode,
        quotation_date: body.quotationDate,
        customer_id: body.customerId,
        valid_until: body.validUntil,
        price_list_id: body.priceListId,
        subtotal: subtotal.toFixed(4),
        discount_amount: totalDiscount.toFixed(4),
        tax_amount: totalTax.toFixed(4),
        total_amount: totalAmount.toFixed(4),
        status: 'draft',
        notes: body.notes,
        terms_conditions: body.termsConditions,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (quotationError || !quotation) {

      return NextResponse.json(
        { error: quotationError?.message || 'Failed to create quotation' },
        { status: 500 }
      )
    }

    // Create quotation items
    const itemsToInsert = itemsWithCalculations.map((item, index) => ({
      company_id: userData.company_id,
      quotation_id: quotation.id,
      item_id: item.itemId,
      item_description: item.description,
      quantity: item.quantity,
      uom_id: item.uomId,
      rate: item.rate,
      discount_percent: item.discountPercent || 0,
      discount_amount: item.discountAmount,
      tax_percent: item.taxPercent || 0,
      tax_amount: item.taxAmount,
      line_total: item.lineTotal,
      sort_order: item.sortOrder || index,
      notes: item.notes,
      created_by: user.id,
      updated_by: user.id,
    }))

    const { error: itemsError } = await supabase
      .from('sales_quotation_items')
      .insert(itemsToInsert)

    if (itemsError) {

      // Rollback: delete the quotation
      await supabase.from('sales_quotations').delete().eq('id', quotation.id)
      return NextResponse.json(
        { error: itemsError.message || 'Failed to create quotation items' },
        { status: 500 }
      )
    }

    // Fetch the complete quotation with joins
    const { data: completeQuotation } = await supabase
      .from('sales_quotations')
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
        )
      `
      )
      .eq('id', quotation.id)
      .single()

    const { data: quotationItems } = await supabase
      .from('sales_quotation_items')
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
      .eq('quotation_id', quotation.id)
      .order('sort_order', { ascending: true })

    const items = quotationItems?.map(item => transformDbQuotationItem(item as any)) || []
    const result = transformDbQuotation(completeQuotation as any, items)

    return NextResponse.json(result, { status: 201 })
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
