import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, requireLookupDataAccess } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

// GET /api/suppliers
export async function GET(request: NextRequest) {
  try {
    // Check permission using Lookup Data Access Pattern
    // User can access if they have EITHER:
    // 1. Direct 'suppliers' view permission, OR
    // 2. Permission to a feature that depends on suppliers (purchase_orders, purchase_receipts)
    const unauthorized = await requireLookupDataAccess(RESOURCES.SUPPLIERS)
    if (unauthorized) return unauthorized
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
      .from('suppliers')
      .select('*', { count: 'exact' })
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)

    // Apply filters
    const status = searchParams.get('status')
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const search = searchParams.get('search')
    if (search) {
      query = query.or(`supplier_name.ilike.%${search}%,supplier_code.ilike.%${search}%,email.ilike.%${search}%`)
    }

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query.range(from, to).order('created_at', { ascending: false })

    const { data: suppliers, error, count } = await query

    if (error) {

      return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 })
    }

    // Format response
    const formattedSuppliers = suppliers?.map((supplier) => ({
      id: supplier.id,
      companyId: supplier.company_id,
      code: supplier.supplier_code,
      name: supplier.supplier_name,
      contactPerson: supplier.contact_person,
      email: supplier.email,
      phone: supplier.phone,
      mobile: supplier.mobile,
      website: supplier.website,
      taxId: supplier.tax_id,
      billingAddress: supplier.billing_address_line1,
      billingAddressLine2: supplier.billing_address_line2,
      billingCity: supplier.billing_city,
      billingState: supplier.billing_state,
      billingCountry: supplier.billing_country,
      billingPostalCode: supplier.billing_postal_code,
      shippingAddress: supplier.shipping_address_line1,
      shippingAddressLine2: supplier.shipping_address_line2,
      shippingCity: supplier.shipping_city,
      shippingState: supplier.shipping_state,
      shippingCountry: supplier.shipping_country,
      shippingPostalCode: supplier.shipping_postal_code,
      paymentTerms: supplier.payment_terms,
      creditLimit: supplier.credit_limit ? parseFloat(supplier.credit_limit) : null,
      currentBalance: parseFloat(supplier.current_balance || 0),
      bankName: supplier.bank_name,
      bankAccountNumber: supplier.bank_account_number,
      bankAccountName: supplier.bank_account_name,
      status: supplier.status,
      notes: supplier.notes,
      createdBy: supplier.created_by,
      createdAt: supplier.created_at,
      updatedAt: supplier.updated_at,
    }))

    return NextResponse.json({
      data: formattedSuppliers,
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

// POST /api/suppliers
export async function POST(request: NextRequest) {
  try {
    await requirePermission(RESOURCES.SUPPLIERS, 'create')
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

    // Generate supplier code if not provided
    let supplierCode = body.code
    if (!supplierCode) {
      const { data: lastSupplier } = await supabase
        .from('suppliers')
        .select('supplier_code')
        .eq('company_id', userData.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      let nextNum = 1
      if (lastSupplier?.supplier_code) {
        const lastNum = parseInt(lastSupplier.supplier_code.split('-')[1])
        nextNum = lastNum + 1
      }
      supplierCode = `SUP-${String(nextNum).padStart(3, '0')}`
    }

    // business_unit_id from JWT - set by auth hook
    // Create supplier
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert({
        company_id: userData.company_id,
        business_unit_id: currentBusinessUnitId,
        supplier_code: supplierCode,
        supplier_name: body.name,
        contact_person: body.contactPerson,
        email: body.email,
        phone: body.phone,
        mobile: body.mobile,
        website: body.website,
        tax_id: body.taxId,
        billing_address_line1: body.billingAddress,
        billing_address_line2: body.billingAddressLine2,
        billing_city: body.billingCity,
        billing_state: body.billingState,
        billing_country: body.billingCountry,
        billing_postal_code: body.billingPostalCode,
        shipping_address_line1: body.shippingAddress,
        shipping_address_line2: body.shippingAddressLine2,
        shipping_city: body.shippingCity,
        shipping_state: body.shippingState,
        shipping_country: body.shippingCountry,
        shipping_postal_code: body.shippingPostalCode,
        payment_terms: body.paymentTerms || 'net_30',
        credit_limit: body.creditLimit,
        current_balance: 0,
        bank_name: body.bankName,
        bank_account_number: body.bankAccountNumber,
        bank_account_name: body.bankAccountName,
        status: body.status || 'active',
        notes: body.notes,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (supplierError) {

      return NextResponse.json(
        { error: supplierError.message || 'Failed to create supplier' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        id: supplier.id,
        code: supplier.supplier_code,
        name: supplier.supplier_name,
      },
      { status: 201 }
    )
  } catch (error) {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
