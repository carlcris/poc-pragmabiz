import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import type { Customer, CreateCustomerRequest } from '@/types/customer'
import type { Database } from '@/types/database.types'
import { requirePermission, requireLookupDataAccess } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

type DbCustomer = Database['public']['Tables']['customers']['Row']

// Transform database customer to frontend Customer type
function transformDbCustomer(dbCustomer: DbCustomer): Customer {
  return {
    id: dbCustomer.id,
    companyId: dbCustomer.company_id,
    customerType: dbCustomer.customer_type as 'individual' | 'business',
    code: dbCustomer.customer_code,
    name: dbCustomer.customer_name,
    email: dbCustomer.email || '',
    phone: dbCustomer.phone || '',
    mobile: undefined,
    website: dbCustomer.website || undefined,
    taxId: dbCustomer.tax_id || undefined,
    billingAddress: `${dbCustomer.billing_address_line1 || ''}${dbCustomer.billing_address_line2 ? ' ' + dbCustomer.billing_address_line2 : ''}`.trim(),
    billingCity: dbCustomer.billing_city || '',
    billingState: dbCustomer.billing_state || '',
    billingPostalCode: dbCustomer.billing_postal_code || '',
    billingCountry: dbCustomer.billing_country || '',
    shippingAddress: `${dbCustomer.shipping_address_line1 || ''}${dbCustomer.shipping_address_line2 ? ' ' + dbCustomer.shipping_address_line2 : ''}`.trim(),
    shippingCity: dbCustomer.shipping_city || '',
    shippingState: dbCustomer.shipping_state || '',
    shippingPostalCode: dbCustomer.shipping_postal_code || '',
    shippingCountry: dbCustomer.shipping_country || '',
    contactPersonName: dbCustomer.contact_person || undefined,
    contactPersonEmail: dbCustomer.contact_email || undefined,
    contactPersonPhone: dbCustomer.contact_phone || undefined,
    paymentTerms: dbCustomer.payment_terms as any || 'net_30',
    creditLimit: Number(dbCustomer.credit_limit || 0),
    currentBalance: 0, // This would need to be calculated from invoices
    notes: '',
    isActive: dbCustomer.is_active ?? true,
    createdAt: dbCustomer.created_at,
    updatedAt: dbCustomer.updated_at,
  }
}

// GET /api/customers - List customers with filters
export async function GET(request: NextRequest) {
  try {
    // Check permission using Lookup Data Access Pattern
    // User can access if they have EITHER:
    // 1. Direct 'customers' view permission, OR
    // 2. Permission to a feature that depends on customers (pos, sales_orders, van_sales, etc.)
    const unauthorized = await requireLookupDataAccess(RESOURCES.CUSTOMERS)
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const customerType = searchParams.get('customerType')
    const isActive = searchParams.get('isActive')

    // Build query (RLS will filter by business unit)
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    // Apply search filter
    if (search) {
      query = query.or(
        `customer_code.ilike.%${search}%,customer_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      )
    }

    // Apply customer type filter
    if (customerType && customerType !== 'all') {
      query = query.eq('customer_type', customerType)
    }

    // Apply active status filter
    if (isActive !== null && isActive !== undefined && isActive !== 'all') {
      query = query.eq('is_active', isActive === 'true')
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const customers = (data || []).map(transformDbCustomer)

    return NextResponse.json({
      data: customers,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/customers - Create new customer
export async function POST(request: NextRequest) {
  try {
    // Check permission
    const unauthorized = await requirePermission(RESOURCES.CUSTOMERS, 'create')
    if (unauthorized) return unauthorized

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

    const body: CreateCustomerRequest = await request.json()

    // Get user's company_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.company_id) {

      return NextResponse.json({ error: 'User company not found' }, { status: 400 })
    }

    const companyId = userData.company_id

    // Check for duplicate customer code
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('company_id', companyId)
      .eq('customer_code', body.code)
      .is('deleted_at', null)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Customer code already exists' },
        { status: 409 }
      )
    }

    // Split billing and shipping addresses into line1 and line2
    const splitAddress = (address: string): [string, string] => {
      if (!address) return ['', '']
      const maxLine1Length = 200
      if (address.length <= maxLine1Length) return [address, '']
      // Try to split at a reasonable point
      const splitPoint = address.lastIndexOf(' ', maxLine1Length)
      if (splitPoint > 0) {
        return [address.substring(0, splitPoint), address.substring(splitPoint + 1)]
      }
      return [address.substring(0, maxLine1Length), address.substring(maxLine1Length)]
    }

    const [billingLine1, billingLine2] = splitAddress(body.billingAddress || '')
    const [shippingLine1, shippingLine2] = splitAddress(body.shippingAddress || '')

    // Insert customer
    // business_unit_id from JWT - set by auth hook
    const { data, error } = await supabase
      .from('customers')
      .insert({
        company_id: companyId,
        business_unit_id: currentBusinessUnitId,
        customer_code: body.code,
        customer_name: body.name,
        customer_type: body.customerType,
        tax_id: body.taxId,
        email: body.email,
        phone: body.phone,
        website: body.website,
        billing_address_line1: billingLine1,
        billing_address_line2: billingLine2,
        billing_city: body.billingCity,
        billing_state: body.billingState,
        billing_country: body.billingCountry,
        billing_postal_code: body.billingPostalCode,
        shipping_address_line1: shippingLine1,
        shipping_address_line2: shippingLine2,
        shipping_city: body.shippingCity,
        shipping_state: body.shippingState,
        shipping_country: body.shippingCountry,
        shipping_postal_code: body.shippingPostalCode,
        payment_terms: body.paymentTerms,
        credit_limit: body.creditLimit,
        credit_days: body.creditLimit > 0 ? 30 : 0, // Default to 30 days if credit limit is set
        contact_person: body.contactPersonName,
        contact_phone: body.contactPersonPhone,
        contact_email: body.contactPersonEmail,
        is_active: body.isActive ?? true,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (error) {

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(transformDbCustomer(data), { status: 201 })
  } catch (error) {

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
