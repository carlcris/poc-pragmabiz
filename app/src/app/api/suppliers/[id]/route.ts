import { createServerClientWithBU } from '@/lib/supabase/server-with-bu'
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { RESOURCES } from '@/constants/resources'

// GET /api/suppliers/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.SUPPLIERS, 'view')
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

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 400 })
    }

    // Fetch supplier
    const { data: supplier, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (error) {

      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Format response
    const formattedSupplier = {
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
    }

    return NextResponse.json(formattedSupplier)
  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/suppliers/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.SUPPLIERS, 'edit')
    const { id } = await params
    const { supabase } = await createServerClientWithBU()
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

    // Check if supplier exists
    const { data: existingSupplier, error: fetchError } = await supabase
      .from('suppliers')
      .select('id, status')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !existingSupplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Update supplier
    const { data: supplier, error: updateError } = await supabase
      .from('suppliers')
      .update({
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
        payment_terms: body.paymentTerms,
        credit_limit: body.creditLimit,
        bank_name: body.bankName,
        bank_account_number: body.bankAccountNumber,
        bank_account_name: body.bankAccountName,
        status: body.status,
        notes: body.notes,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .select()
      .single()

    if (updateError) {

      return NextResponse.json(
        { error: updateError.message || 'Failed to update supplier' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: supplier.id,
      code: supplier.supplier_code,
      name: supplier.supplier_name,
    })
  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/suppliers/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(RESOURCES.SUPPLIERS, 'delete')
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

    // Get user's company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!userData?.company_id) {
      return NextResponse.json({ error: 'User company not found' }, { status: 400 })
    }

    // Check if supplier exists
    const { data: supplier, error: fetchError } = await supabase
      .from('suppliers')
      .select('id, supplier_code, supplier_name, status')
      .eq('id', id)
      .eq('company_id', userData.company_id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Check if supplier has related purchase orders
    const { data: purchaseOrders, error: poCheckError } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('supplier_id', id)
      .is('deleted_at', null)
      .limit(1)

    if (poCheckError) {

      return NextResponse.json(
        { error: 'Failed to check supplier dependencies' },
        { status: 500 }
      )
    }

    if (purchaseOrders && purchaseOrders.length > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete supplier with existing purchase orders. Please delete or reassign purchase orders first.',
        },
        { status: 400 }
      )
    }

    // Soft delete supplier
    const { error: deleteError } = await supabase
      .from('suppliers')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', userData.company_id)

    if (deleteError) {

      return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Supplier ${supplier.supplier_code} - ${supplier.supplier_name} deleted successfully`,
    })
  } catch {

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
