import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import type { Customer, UpdateCustomerRequest } from '@/types/customer'
import type { Database } from '@/types/database.types'

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

// GET /api/customers/[id] - Get single customer
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

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
      }
      console.error('Error fetching customer:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(transformDbCustomer(data))
  } catch (error) {
    console.error('Error in GET /api/customers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/customers/[id] - Update customer
export async function PUT(
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

    const body: UpdateCustomerRequest = await request.json()

    // Check if customer exists
    const { data: existing, error: existingError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
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

    const updateData: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    }

    // Only include fields that are provided
    if (body.name !== undefined) updateData.customer_name = body.name
    if (body.customerType !== undefined) updateData.customer_type = body.customerType
    if (body.taxId !== undefined) updateData.tax_id = body.taxId
    if (body.email !== undefined) updateData.email = body.email
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.website !== undefined) updateData.website = body.website

    // Billing address
    if (body.billingAddress !== undefined) {
      const [line1, line2] = splitAddress(body.billingAddress)
      updateData.billing_address_line1 = line1
      updateData.billing_address_line2 = line2
    }
    if (body.billingCity !== undefined) updateData.billing_city = body.billingCity
    if (body.billingState !== undefined) updateData.billing_state = body.billingState
    if (body.billingCountry !== undefined) updateData.billing_country = body.billingCountry
    if (body.billingPostalCode !== undefined) updateData.billing_postal_code = body.billingPostalCode

    // Shipping address
    if (body.shippingAddress !== undefined) {
      const [line1, line2] = splitAddress(body.shippingAddress)
      updateData.shipping_address_line1 = line1
      updateData.shipping_address_line2 = line2
    }
    if (body.shippingCity !== undefined) updateData.shipping_city = body.shippingCity
    if (body.shippingState !== undefined) updateData.shipping_state = body.shippingState
    if (body.shippingCountry !== undefined) updateData.shipping_country = body.shippingCountry
    if (body.shippingPostalCode !== undefined) updateData.shipping_postal_code = body.shippingPostalCode

    // Contact person
    if (body.contactPersonName !== undefined) updateData.contact_person = body.contactPersonName
    if (body.contactPersonPhone !== undefined) updateData.contact_phone = body.contactPersonPhone
    if (body.contactPersonEmail !== undefined) updateData.contact_email = body.contactPersonEmail

    // Payment terms
    if (body.paymentTerms !== undefined) updateData.payment_terms = body.paymentTerms
    if (body.creditLimit !== undefined) {
      updateData.credit_limit = body.creditLimit
      updateData.credit_days = body.creditLimit > 0 ? 30 : 0
    }

    if (body.isActive !== undefined) updateData.is_active = body.isActive

    const { data, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating customer:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(transformDbCustomer(data))
  } catch (error) {
    console.error('Error in PUT /api/customers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/customers/[id] - Soft delete customer
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

    // Check if customer exists
    const { data: existing, error: existingError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Soft delete by setting deleted_at timestamp
    const { error } = await supabase
      .from('customers')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      console.error('Error deleting customer:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/customers/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
